import type {
  Confidence,
  ElectricalScenario,
  EventEntry,
  PermissionState,
  SimParams,
  SimSnapshot,
} from "./types";

export const SAMPLE_RATE = 3200;
export const WINDOW_SAMPLES = 640;
export const SCOPE_CYCLES = 4;
export const PICKUP_PU = 0.25;
export const SLOPE = 0.35;

const DT = 1 / SAMPLE_RATE;
const PACKET_INTERVAL_MS = 1;
const SECURE_WINDOW_MS = 120;
const RECOVERY_MS = 80;

export const defaultParams: SimParams = {
  mode: "A",
  scenario: "THROUGH_LOAD",
  forwardDelayMs: 5,
  returnDelayMs: 5,
  jitterMs: 0,
  packetLossPct: 0,
  corruptionPct: 0,
  rttStepMs: 0,
  clockOffsetMs: 0,
  clockDriftPpm: 0,
  syncQuality: "VALID",
  remoteMagnitudePct: 100,
  dcOffsetPct: 0,
  harmonicsPct: 0,
  freqHz: 50,
};

export interface Traces {
  local: Float32Array;
  remoteRx: Float32Array;
  remoteAligned: Float32Array;
  idiff: Float32Array;
  idiffRaw: Float32Array;
  ibias: Float32Array;
  valid: Float32Array;
}

type Gains = { local: number; remote: number; sign: 1 | -1 };

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function scenarioEventActive(scenario: ElectricalScenario, time: number) {
  const phase = ((time % 1.6) + 1.6) % 1.6;
  switch (scenario) {
    case "THROUGH_LOAD":
      return false;
    case "LOAD_CHANGE":
    case "EXTERNAL_FAULT":
    case "INTERNAL_FAULT":
      return phase >= 0.8;
    case "CT_SATURATION":
    case "CT_POLARITY":
      return true;
  }
}

function scenarioGains(scenario: ElectricalScenario, time: number): Gains {
  const active = scenarioEventActive(scenario, time);
  switch (scenario) {
    case "THROUGH_LOAD":
      return { local: 1, remote: 1, sign: -1 };
    case "LOAD_CHANGE": {
      const amplitude = active ? 1.8 : 1;
      return { local: amplitude, remote: amplitude, sign: -1 };
    }
    case "EXTERNAL_FAULT": {
      const amplitude = active ? 4.5 : 1;
      return { local: amplitude, remote: amplitude, sign: -1 };
    }
    case "INTERNAL_FAULT": {
      const amplitude = active ? 3.5 : 1;
      return {
        local: amplitude,
        remote: active ? amplitude * 0.9 : 1,
        sign: active ? 1 : -1,
      };
    }
    case "CT_SATURATION":
      return { local: 3.2, remote: 3.2, sign: -1 };
    case "CT_POLARITY":
      return { local: 1, remote: 1, sign: 1 };
  }
}

const INITIAL_SNAPSHOT: SimSnapshot = {
  t: 0,
  eventActive: false,
  state: "NORMAL",
  secureRemainingMs: 0,
  confidence: { channel: 1, alignment: 1, waveform: 1, electrical: 0 },
  reasons: [],
  rttMs: 0,
  estOneWayMs: 0,
  trueForwardMs: 0,
  trueReturnMs: 0,
  asymmetryMs: 0,
  residualMs: 0,
  phaseErrorDeg: 0,
  packetAgeMs: 0,
  idiffPu: 0,
  ibiasPu: 0,
  rawIdiffPu: 0,
  operate: false,
  tripPermitted: true,
  lossEvents: 0,
  packetsRx: 0,
};

function createTraces(): Traces {
  return {
    local: new Float32Array(WINDOW_SAMPLES),
    remoteRx: new Float32Array(WINDOW_SAMPLES),
    remoteAligned: new Float32Array(WINDOW_SAMPLES),
    idiff: new Float32Array(WINDOW_SAMPLES),
    idiffRaw: new Float32Array(WINDOW_SAMPLES),
    ibias: new Float32Array(WINDOW_SAMPLES),
    valid: new Float32Array(WINDOW_SAMPLES),
  };
}

export class Engine {
  params: SimParams = { ...defaultParams };
  t = 0;
  events: EventEntry[] = [];

  private random = seededRandom(20260730);
  private scope = createTraces();
  private snapshotValue: SimSnapshot = {
    ...INITIAL_SNAPSHOT,
    confidence: { ...INITIAL_SNAPSHOT.confidence },
  };

  private jitterState = 0;
  private packetClockMs = 0;
  private packetAgeMs = 0;
  private lossRemainingMs = 0;
  private lossState = false;
  private corrupt = false;
  private lossEvents = 0;
  private packetsRx = 0;

  private previousRtt: number | null = null;
  private lastValidEstimate = 0;
  private trackingEstimate = 0;
  private trackingInitialized = false;

  private confidence: Confidence = {
    channel: 1,
    alignment: 1,
    waveform: 1,
    electrical: 0,
  };
  private permissionState: PermissionState = "NORMAL";
  private stateTimerMs = 0;
  private secureRemainingMs = SECURE_WINDOW_MS;

  private idiffEnergy = 0;
  private rawEnergy = 0;
  private ibiasEnergy = 0;
  private rmsSamples = 0;
  private idiffRms = 0;
  private rawRms = 0;
  private ibiasRms = 0;
  private operateTimerMs = 0;
  private operating = false;

  get snapshot() {
    return this.snapshotValue;
  }

  reset() {
    this.t = 0;
    this.events = [];
    this.random = seededRandom(20260730);
    this.scope = createTraces();
    this.snapshotValue = {
      ...INITIAL_SNAPSHOT,
      confidence: { ...INITIAL_SNAPSHOT.confidence },
    };
    this.jitterState = 0;
    this.packetClockMs = 0;
    this.packetAgeMs = 0;
    this.lossRemainingMs = 0;
    this.lossState = false;
    this.corrupt = false;
    this.lossEvents = 0;
    this.packetsRx = 0;
    this.previousRtt = null;
    this.lastValidEstimate = 0;
    this.trackingEstimate = 0;
    this.trackingInitialized = false;
    this.confidence = { channel: 1, alignment: 1, waveform: 1, electrical: 0 };
    this.permissionState = "NORMAL";
    this.stateTimerMs = 0;
    this.secureRemainingMs = SECURE_WINDOW_MS;
    this.idiffEnergy = 0;
    this.rawEnergy = 0;
    this.ibiasEnergy = 0;
    this.rmsSamples = 0;
    this.idiffRms = 0;
    this.rawRms = 0;
    this.ibiasRms = 0;
    this.operateTimerMs = 0;
    this.operating = false;
  }

  private log(label: string, kind: EventEntry["kind"]) {
    this.events.unshift({ t: this.t, label, kind });
    if (this.events.length > 60) this.events.pop();
  }

  private signal(kind: "local" | "remote", time: number) {
    const gains = scenarioGains(this.params.scenario, time);
    const angularFrequency = 2 * Math.PI * this.params.freqHz;
    const eventPhase = ((time % 1.6) + 1.6) % 1.6;
    const dc =
      (this.params.dcOffsetPct / 100) * Math.exp(-eventPhase / 0.15);
    const harmonic =
      (this.params.harmonicsPct / 100) *
      Math.sin(3 * angularFrequency * time);

    if (kind === "local") {
      let value =
        gains.local * Math.sin(angularFrequency * time) +
        dc +
        gains.local * harmonic;
      if (this.params.scenario === "CT_SATURATION") {
        value = clamp(value, -2.2, 2.2);
      }
      return value;
    }

    const scale =
      (this.params.remoteMagnitudePct / 100) * gains.remote * gains.sign;
    return scale * (Math.sin(angularFrequency * time) + harmonic);
  }

  private impairments() {
    const params = this.params;
    this.jitterState +=
      (this.random() - 0.5) * params.jitterMs * 0.6 -
      this.jitterState * 0.08;
    this.jitterState = clamp(
      this.jitterState,
      -params.jitterMs,
      params.jitterMs,
    );
    const routeStep = this.t >= 1.2 ? params.rttStepMs : 0;
    return {
      forward: Math.max(
        0,
        params.forwardDelayMs + routeStep + this.jitterState,
      ),
      returnPath: Math.max(0, params.returnDelayMs),
    };
  }

  private updatePacketModel(dtMs: number) {
    this.packetClockMs += dtMs;
    while (this.packetClockMs >= PACKET_INTERVAL_MS) {
      this.packetClockMs -= PACKET_INTERVAL_MS;

      let lost = false;
      if (this.lossRemainingMs > 0) {
        lost = true;
        this.lossRemainingMs = Math.max(0, this.lossRemainingMs - 1);
      } else if (this.random() * 100 < this.params.packetLossPct) {
        lost = true;
        this.lossRemainingMs = 2 + Math.floor(this.random() * 11);
        this.lossEvents++;
      }

      const corrupt =
        !lost && this.random() * 100 < this.params.corruptionPct;
      this.lossState = lost;
      this.corrupt = corrupt;

      if (lost || corrupt) {
        this.packetAgeMs += 1;
      } else {
        this.packetAgeMs = 0;
        this.packetsRx++;
      }
    }
  }

  private alignmentEstimate(
    forwardMs: number,
    returnMs: number,
    stale: boolean,
    invalid: boolean,
  ) {
    const params = this.params;
    const pingPong = (forwardMs + returnMs) / 2;
    let estimate = pingPong;
    let syncFallback = false;

    if (params.mode === "C") {
      if (params.syncQuality === "INVALID") {
        syncFallback = true;
      } else {
        const clockError =
          params.clockOffsetMs + params.clockDriftPpm * 1e-3 * this.t;
        estimate =
          forwardMs +
          clockError +
          (params.syncQuality === "DEGRADED" ? 0.4 : 0);
      }
    } else if (params.mode === "D") {
      const cycleMs = 1000 / Math.max(1, params.freqHz);
      const bound = clamp(cycleMs * 0.45, 3, 12);
      const target = clamp(
        forwardMs,
        pingPong - bound,
        pingPong + bound,
      );
      if (!this.trackingInitialized) {
        this.trackingEstimate = pingPong;
        this.trackingInitialized = true;
      }
      this.trackingEstimate +=
        (target - this.trackingEstimate) * 0.02;
      estimate = this.trackingEstimate;
    } else {
      this.trackingInitialized = false;
      this.trackingEstimate = estimate;
    }

    if (
      (params.mode === "B" || params.mode === "D") &&
      (stale || invalid)
    ) {
      estimate = this.lastValidEstimate;
    } else {
      this.lastValidEstimate = estimate;
    }

    return { estimate, pingPong, syncFallback };
  }

  private updateRms(idiff: number, raw: number, ibias: number) {
    this.idiffEnergy += idiff * idiff;
    this.rawEnergy += raw * raw;
    this.ibiasEnergy += ibias * ibias;
    this.rmsSamples++;

    const samplesPerCycle = Math.max(
      1,
      Math.round(SAMPLE_RATE / Math.max(1, this.params.freqHz)),
    );
    if (this.rmsSamples < samplesPerCycle) return;

    this.idiffRms = Math.sqrt(this.idiffEnergy / this.rmsSamples);
    this.rawRms = Math.sqrt(this.rawEnergy / this.rmsSamples);
    this.ibiasRms = Math.sqrt(this.ibiasEnergy / this.rmsSamples);
    this.idiffEnergy = 0;
    this.rawEnergy = 0;
    this.ibiasEnergy = 0;
    this.rmsSamples = 0;
  }

  step(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;

    this.t += dt;
    const dtMs = dt * 1000;
    this.updatePacketModel(dtMs);

    const { forward, returnPath } = this.impairments();
    const rtt = forward + returnPath;
    const asymmetry = forward - returnPath;
    const stale = this.lossState;
    const invalid = this.corrupt || this.packetAgeMs > 20;
    const { estimate, pingPong, syncFallback } = this.alignmentEstimate(
      forward,
      returnPath,
      stale,
      invalid,
    );

    const residual = estimate - forward;
    const phaseErrorDeg =
      360 * this.params.freqHz * (residual / 1000);

    const local = this.signal("local", this.t);
    const alignedTime = stale
      ? this.t -
        forward / 1000 -
        this.packetAgeMs / 1000 +
        estimate / 1000
      : this.t - forward / 1000 + estimate / 1000;
    const remoteAligned = this.signal("remote", alignedTime);
    const remoteRaw = this.signal(
      "remote",
      this.t - forward / 1000 + pingPong / 1000,
    );
    const idiff = local + remoteAligned;
    const rawIdiff = local + remoteRaw;
    const ibias = (Math.abs(local) + Math.abs(remoteAligned)) / 2;
    this.updateRms(idiff, rawIdiff, ibias);

    const reasons: string[] = [];
    let channel = 1;
    if (Math.abs(asymmetry) > 0.5) {
      channel -=
        this.params.mode === "D"
          ? Math.min(0.15, Math.abs(asymmetry) / 60)
          : Math.min(0.45, Math.abs(asymmetry) / 20);
      reasons.push("COMM_ASYMMETRY");
    }
    if (this.params.jitterMs > 0.5) {
      channel -= Math.min(0.35, this.params.jitterMs / 25);
      reasons.push("COMM_JITTER_BURST");
    }
    if (stale) {
      channel -= 0.35;
      reasons.push("COMM_PACKET_GAP");
    }
    if (
      this.previousRtt !== null &&
      Math.abs(rtt - this.previousRtt) > 3
    ) {
      reasons.push("COMM_RTT_STEP");
    }
    this.previousRtt =
      this.previousRtt === null
        ? rtt
        : this.previousRtt + (rtt - this.previousRtt) * 0.05;
    if (this.corrupt) {
      channel = 0;
      reasons.push("COMM_CORRUPT");
    }

    let alignment = 1 - Math.min(1, Math.abs(residual) / 4);
    if (Math.abs(residual) > 0.3) reasons.push("ALIGN_RESIDUAL_HIGH");
    if (this.params.mode === "D" && Math.abs(residual) > 1.5) {
      reasons.push("ALIGN_TRACK_AMBIGUOUS");
    }
    if (
      this.params.mode === "C" &&
      this.params.syncQuality !== "VALID"
    ) {
      alignment -=
        this.params.syncQuality === "INVALID" ? 0.5 : 0.2;
      reasons.push("SYNC_QUALITY_LOW");
    }
    if (syncFallback) reasons.push("SYNC_FALLBACK_PINGPONG");

    let waveform =
      1 - Math.min(1, Math.abs(phaseErrorDeg) / 90);
    if (stale || invalid) {
      waveform -= 0.4;
      reasons.push("WAVE_DISCONTINUITY");
    }

    const internalScenario =
      this.params.scenario === "INTERNAL_FAULT" ||
      this.params.scenario === "CT_POLARITY";
    const electrical = internalScenario
      ? Math.min(
          1,
          0.35 + this.idiffRms / Math.max(0.2, this.ibiasRms),
        )
      : Math.max(0, 0.15 - Math.abs(residual) / 20);
    if (electrical > 0.6) reasons.push("ELEC_EVENT_PLAUSIBLE");

    const smooth = (current: number, target: number) =>
      current + (target - current) * 0.06;
    this.confidence = {
      channel: smooth(this.confidence.channel, clamp(channel)),
      alignment: smooth(this.confidence.alignment, clamp(alignment)),
      waveform: smooth(this.confidence.waveform, clamp(waveform)),
      electrical: smooth(this.confidence.electrical, clamp(electrical)),
    };

    const softConfidence = Math.min(
      this.confidence.channel,
      this.confidence.alignment,
      this.confidence.waveform,
    );
    const hardFailure = invalid;
    const previousState = this.permissionState;
    this.stateTimerMs += dtMs;

    if (this.params.mode === "A") {
      this.permissionState = hardFailure ? "BLOCKED" : "NORMAL";
    } else {
      switch (this.permissionState) {
        case "NORMAL":
          if (hardFailure) this.permissionState = "BLOCKED";
          else if (softConfidence < 0.85) this.permissionState = "WATCH";
          break;
        case "WATCH":
          if (hardFailure) this.permissionState = "BLOCKED";
          else if (softConfidence < 0.7) {
            this.permissionState = "SECURE";
            this.secureRemainingMs = SECURE_WINDOW_MS;
          } else if (softConfidence > 0.9) {
            this.permissionState = "NORMAL";
          }
          break;
        case "SECURE":
          this.secureRemainingMs -= dtMs;
          if (hardFailure || this.secureRemainingMs <= 0) {
            this.permissionState = "BLOCKED";
          } else if (softConfidence > 0.82) {
            this.permissionState = "WATCH";
          }
          break;
        case "BLOCKED":
          if (!hardFailure && softConfidence > 0.6) {
            this.permissionState = "RECOVERY";
            this.stateTimerMs = 0;
          }
          break;
        case "RECOVERY":
          if (hardFailure || softConfidence < 0.55) {
            this.permissionState = "BLOCKED";
          } else if (this.stateTimerMs > RECOVERY_MS) {
            this.permissionState = "NORMAL";
          }
          break;
      }
    }

    if (previousState !== this.permissionState) {
      this.stateTimerMs = 0;
      this.log(
        `${previousState} → ${this.permissionState}${
          reasons[0] ? ` · ${reasons[0]}` : ""
        }`,
        "state",
      );
    }

    const raisedPickup =
      this.permissionState === "SECURE"
        ? PICKUP_PU * 1.6
        : PICKUP_PU;
    const characteristic =
      this.idiffRms >
      Math.max(raisedPickup, SLOPE * this.ibiasRms);
    const tripPermitted = this.permissionState !== "BLOCKED";
    this.operateTimerMs =
      characteristic && tripPermitted
        ? this.operateTimerMs + dtMs
        : 0;
    const operate =
      this.operateTimerMs >
      (this.permissionState === "SECURE" ? 25 : 10);
    if (operate && !this.operating) this.log("87L OPERATE", "trip");
    this.operating = operate;

    this.snapshotValue = {
      t: this.t,
      eventActive: scenarioEventActive(this.params.scenario, this.t),
      state: this.permissionState,
      secureRemainingMs:
        this.permissionState === "SECURE"
          ? Math.max(0, this.secureRemainingMs)
          : 0,
      confidence: this.confidence,
      reasons: Array.from(new Set(reasons)).slice(0, 4),
      rttMs: rtt,
      estOneWayMs: estimate,
      trueForwardMs: forward,
      trueReturnMs: returnPath,
      asymmetryMs: asymmetry,
      residualMs: residual,
      phaseErrorDeg,
      packetAgeMs: this.packetAgeMs,
      idiffPu: this.idiffRms,
      ibiasPu: this.ibiasRms,
      rawIdiffPu: this.rawRms,
      operate,
      tripPermitted,
      lossEvents: this.lossEvents,
      packetsRx: this.packetsRx,
    };
  }

  advance(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const steps = Math.round(seconds / DT);
    for (let index = 0; index < steps; index++) this.step(DT);
  }

  scopeTraces(): Traces {
    const snapshot = this.snapshotValue;
    const spanSeconds =
      SCOPE_CYCLES / Math.max(1, this.params.freqHz);
    const staleShiftMs = this.lossState ? snapshot.packetAgeMs : 0;
    const quality =
      this.corrupt || snapshot.packetAgeMs > 20
        ? 0
        : this.lossState
          ? 0.5
          : 1;

    for (let index = 0; index < WINDOW_SAMPLES; index++) {
      const phaseTime =
        (index / (WINDOW_SAMPLES - 1)) * spanSeconds;
      const local = this.signal("local", phaseTime);
      const remoteRx = this.signal(
        "remote",
        phaseTime - snapshot.trueForwardMs / 1000,
      );
      const remoteAligned = this.signal(
        "remote",
        phaseTime -
          snapshot.trueForwardMs / 1000 -
          staleShiftMs / 1000 +
          snapshot.estOneWayMs / 1000,
      );
      const remoteRaw = this.signal(
        "remote",
        phaseTime -
          snapshot.trueForwardMs / 1000 +
          snapshot.rttMs / 2000,
      );

      this.scope.local[index] = local;
      this.scope.remoteRx[index] = remoteRx;
      this.scope.remoteAligned[index] = remoteAligned;
      this.scope.idiff[index] = Math.abs(local + remoteAligned);
      this.scope.idiffRaw[index] = Math.abs(local + remoteRaw);
      this.scope.ibias[index] =
        (Math.abs(local) + Math.abs(remoteAligned)) / 2;
      this.scope.valid[index] = quality;
    }

    return { ...this.scope };
  }
}
