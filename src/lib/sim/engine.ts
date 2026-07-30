import type {
  Confidence,
  ElectricalScenario,
  EventEntry,
  PermissionState,
  SimParams,
  SimSnapshot,
} from "./types";

export const SAMPLE_RATE = 3200; // Hz
export const WINDOW_SAMPLES = 640;
export const SCOPE_CYCLES = 4;
const DT = 1 / SAMPLE_RATE;
const PICKUP_PU = 0.25;
const SLOPE = 0.35;
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

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Traces {
  local: Float32Array;
  remoteRx: Float32Array;
  remoteAligned: Float32Array;
  idiff: Float32Array;
  idiffRaw: Float32Array;
  ibias: Float32Array;
  valid: Float32Array;
}

function scenarioGains(scenario: ElectricalScenario, t: number) {
  // returns [localAmp, remoteAmp, remoteSign]
  switch (scenario) {
    case "THROUGH_LOAD":
      return { local: 1, remote: 1, sign: -1 };
    case "LOAD_CHANGE": {
      const a = 1 + 0.8 * (Math.sin(2 * Math.PI * 0.35 * t) > 0 ? 1 : 0);
      return { local: a, remote: a, sign: -1 };
    }
    case "EXTERNAL_FAULT": {
      const f = t % 1.6 > 0.8 ? 4.5 : 1;
      return { local: f, remote: f, sign: -1 };
    }
    case "INTERNAL_FAULT": {
      const f = t % 1.6 > 0.8 ? 3.5 : 1;
      const internal = t % 1.6 > 0.8;
      return { local: f, remote: internal ? f * 0.9 : 1, sign: internal ? 1 : -1 };
    }
    case "CT_SATURATION":
      return { local: 3.2, remote: 3.2, sign: -1 };
    case "CT_POLARITY":
      return { local: 1, remote: 1, sign: 1 };
  }
}

const INITIAL_SNAPSHOT: SimSnapshot = {
  t: 0,
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

export class Engine {
  params: SimParams = { ...defaultParams };
  t = 0;
  private rnd = mulberry32(20260730);
  private scopeOut: Traces = {
    local: new Float32Array(WINDOW_SAMPLES),
    remoteRx: new Float32Array(WINDOW_SAMPLES),
    remoteAligned: new Float32Array(WINDOW_SAMPLES),
    idiff: new Float32Array(WINDOW_SAMPLES),
    idiffRaw: new Float32Array(WINDOW_SAMPLES),
    ibias: new Float32Array(WINDOW_SAMPLES),
    valid: new Float32Array(WINDOW_SAMPLES),
  };

  private jitterState = 0;
  private lossState = false;
  private lossTimer = 0;
  private lastValidEst = 0;
  private trackEst = 0;
  private packetAgeMs = 0;
  private corrupt = false;
  private conf: Confidence = { channel: 1, alignment: 1, waveform: 1, electrical: 0 };
  private state: PermissionState = "NORMAL";
  private stateTimerMs = 0;
  private secureRemainingMs = SECURE_WINDOW_MS;
  private reasons: string[] = [];
  private lossEvents = 0;
  private packetsRx = 0;
  private prevRtt = 0;
  private idiffAcc = 0;
  private ibiasAcc = 0;
  private rawAcc = 0;
  private accN = 0;
  private idiffRms = 0;
  private ibiasRms = 0;
  private rawRms = 0;
  private operateTimerMs = 0;
  events: EventEntry[] = [];

  reset() {
    this.t = 0;
    this.rnd = mulberry32(20260730);
    this.state = "NORMAL";
    this.events = [];
    this.lossEvents = 0;
    this.packetsRx = 0;
    this.conf = { channel: 1, alignment: 1, waveform: 1, electrical: 0 };
    this.jitterState = 0;
    this.lossState = false;
    this.lossTimer = 0;
    this.lastValidEst = 0;
    this.trackEst = 0;
    this.packetAgeMs = 0;
    this.corrupt = false;
    this.stateTimerMs = 0;
    this.secureRemainingMs = SECURE_WINDOW_MS;
    this.reasons = [];
    this.prevRtt = 0;
    this.idiffAcc = 0;
    this.ibiasAcc = 0;
    this.rawAcc = 0;
    this.accN = 0;
    this.idiffRms = 0;
    this.ibiasRms = 0;
    this.rawRms = 0;
    this.operateTimerMs = 0;
    for (const trace of Object.values(this.scopeOut)) trace.fill(0);
    this._snap = { ...INITIAL_SNAPSHOT, confidence: { ...INITIAL_SNAPSHOT.confidence } };
  }

  private logEvent(label: string, kind: EventEntry["kind"]) {
    this.events.unshift({ t: this.t, label, kind });
    if (this.events.length > 60) this.events.pop();
  }

  private signal(kind: "local" | "remote", tt: number) {
    const p = this.params;
    const g = scenarioGains(p.scenario, tt);
    const w = 2 * Math.PI * p.freqHz;
    const eventPhase = ((tt % 1.6) + 1.6) % 1.6;
    const dc = (p.dcOffsetPct / 100) * Math.exp(-eventPhase / 0.15);
    const h = (p.harmonicsPct / 100) * Math.sin(3 * w * tt);
    if (kind === "local") {
      let v = g.local * Math.sin(w * tt) + dc + g.local * h;
      if (p.scenario === "CT_SATURATION") v = Math.max(-2.2, Math.min(2.2, v));
      return v;
    }
    const scale = (p.remoteMagnitudePct / 100) * g.remote * g.sign;
    return scale * (Math.sin(w * tt) + h);
  }

  private scopeSignal(kind: "local" | "remote", phaseTime: number) {
    const p = this.params;
    const gains = scenarioGains(p.scenario, this.t);
    const angularFrequency = 2 * Math.PI * p.freqHz;
    const eventPhase = ((this.t % 1.6) + 1.6) % 1.6;
    const dc = (p.dcOffsetPct / 100) * Math.exp(-eventPhase / 0.15);
    const harmonic =
      (p.harmonicsPct / 100) * Math.sin(3 * angularFrequency * phaseTime);

    if (kind === "local") {
      let value =
        gains.local * Math.sin(angularFrequency * phaseTime) +
        dc +
        gains.local * harmonic;
      if (p.scenario === "CT_SATURATION") {
        value = Math.max(-2.2, Math.min(2.2, value));
      }
      return value;
    }

    const scale = (p.remoteMagnitudePct / 100) * gains.remote * gains.sign;
    return scale * (Math.sin(angularFrequency * phaseTime) + harmonic);
  }

  private impairments() {
    const p = this.params;
    // jitter (random walk, bounded)
    this.jitterState +=
      (this.rnd() - 0.5) * p.jitterMs * 0.6 - this.jitterState * 0.08;
    this.jitterState = Math.max(-p.jitterMs, Math.min(p.jitterMs, this.jitterState));
    const rttStep = this.t > 1.2 ? p.rttStepMs : 0;
    const fwd = Math.max(0, p.forwardDelayMs + rttStep + this.jitterState);
    const ret = Math.max(0, p.returnDelayMs);
    return { fwd, ret };
  }

  private tickPacket(dtMs: number) {
    const p = this.params;
    // packet cadence: 1 kHz-ish -> every 1 ms
    this.packetAgeMs += dtMs;
    if (this.packetAgeMs < 1) return;
    this.packetsRx++;
    const lost = this.rnd() * 100 < p.packetLossPct;
    if (this.lossState) {
      this.lossTimer -= this.packetAgeMs;
      if (this.lossTimer <= 0) this.lossState = false;
    } else if (lost) {
      this.lossState = true;
      this.lossTimer = 3 + this.rnd() * 12;
      this.lossEvents++;
    }
    this.corrupt = this.rnd() * 100 < p.corruptionPct;
    if (!this.lossState && !this.corrupt) this.packetAgeMs = 0;
  }

  step(dt: number) {
    const p = this.params;
    this.t += dt;
    const dtMs = dt * 1000;
    this.tickPacket(dtMs);
    const { fwd, ret } = this.impairments();
    const rtt = fwd + ret;
    const asym = fwd - ret;

    // ---- alignment estimate per mode ----
    const pingPongEst = rtt / 2;
    const clockErrMs = p.clockOffsetMs + (p.clockDriftPpm * 1e-6 * this.t) * 1000;
    let est = pingPongEst;
    let syncFallback = false;

    if (p.mode === "C") {
      if (p.syncQuality === "INVALID") {
        est = pingPongEst;
        syncFallback = true;
      } else {
        est = fwd + clockErrMs + (p.syncQuality === "DEGRADED" ? 0.4 : 0);
      }
    } else if (p.mode === "D") {
      // bounded search converging toward the alignment that minimises Idiff
      const bound = 3; // ms
      const target = Math.max(
        pingPongEst - bound,
        Math.min(pingPongEst + bound, fwd),
      );
      this.trackEst += (target - this.trackEst) * 0.02;
      est = this.trackEst;
    }
    if (p.mode !== "D") this.trackEst = est;

    const dataInvalid = this.corrupt || this.packetAgeMs > 20;
    const stale = this.lossState;

    if ((p.mode === "B" || p.mode === "D") && (stale || dataInvalid)) {
      est = this.lastValidEst; // freeze last-valid alignment
    } else {
      this.lastValidEst = est;
    }

    const residual = est - fwd;
    const phaseErrDeg = 360 * p.freqHz * (residual / 1000);

    // ---- waveforms ----
    const local = this.signal("local", this.t);
    const remoteRx = this.signal("remote", this.t - fwd / 1000);
    const alignedTime = stale
      ? this.t - fwd / 1000 - this.packetAgeMs / 1000 + est / 1000
      : this.t - fwd / 1000 + est / 1000;
    const remoteAligned = this.signal("remote", alignedTime);
    const rawAligned = this.signal("remote", this.t - fwd / 1000 + pingPongEst / 1000);

    const idiff = local + remoteAligned;
    const idiffRaw = local + rawAligned;
    const ibias = (Math.abs(local) + Math.abs(remoteAligned)) / 2;

    // ---- one-cycle RMS accumulators ----
    this.idiffAcc += idiff * idiff;
    this.rawAcc += idiffRaw * idiffRaw;
    this.ibiasAcc += ibias * ibias;
    this.accN++;
    const cycleSamples = Math.round(SAMPLE_RATE / p.freqHz);
    if (this.accN >= cycleSamples) {
      this.idiffRms = Math.sqrt(this.idiffAcc / this.accN);
      this.rawRms = Math.sqrt(this.rawAcc / this.accN);
      this.ibiasRms = Math.sqrt(this.ibiasAcc / this.accN);
      this.idiffAcc = this.rawAcc = this.ibiasAcc = 0;
      this.accN = 0;
    }

    // ---- confidence ----
    const reasons: string[] = [];
    let channel = 1;
    if (Math.abs(asym) > 0.5) {
      channel -= Math.min(0.45, Math.abs(asym) / 20);
      reasons.push("COMM_ASYMMETRY");
    }
    if (p.jitterMs > 0.5) {
      channel -= Math.min(0.35, p.jitterMs / 25);
      reasons.push("COMM_JITTER_BURST");
    }
    if (stale) {
      channel -= 0.35;
      reasons.push("COMM_PACKET_GAP");
    }
    if (Math.abs(rtt - this.prevRtt) > 3) reasons.push("COMM_RTT_STEP");
    this.prevRtt += (rtt - this.prevRtt) * 0.05;
    if (this.corrupt) {
      channel = 0;
      reasons.push("COMM_CORRUPT");
    }

    let alignment = 1 - Math.min(1, Math.abs(residual) / 4);
    if (Math.abs(residual) > 0.3) reasons.push("ALIGN_RESIDUAL_HIGH");
    if (p.mode === "D" && Math.abs(residual) > 1.5) reasons.push("ALIGN_TRACK_AMBIGUOUS");
    if (p.mode === "C" && p.syncQuality !== "VALID") {
      alignment -= p.syncQuality === "INVALID" ? 0.5 : 0.2;
      reasons.push("SYNC_QUALITY_LOW");
    }
    if (syncFallback) reasons.push("SYNC_FALLBACK_PINGPONG");

    let waveform = 1 - Math.min(1, this.rawRms > 0 ? Math.abs(phaseErrDeg) / 90 : 0);
    if (stale || dataInvalid) {
      waveform -= 0.4;
      reasons.push("WAVE_DISCONTINUITY");
    }

    const internalish =
      p.scenario === "INTERNAL_FAULT" || p.scenario === "CT_POLARITY";
    const electrical = internalish
      ? Math.min(1, 0.35 + this.idiffRms / Math.max(0.2, this.ibiasRms))
      : Math.max(0, 0.15 - Math.abs(residual) / 20);
    if (electrical > 0.6) reasons.push("ELEC_EVENT_PLAUSIBLE");

    const smooth = (a: number, b: number) => a + (b - a) * 0.06;
    this.conf = {
      channel: smooth(this.conf.channel, Math.max(0, Math.min(1, channel))),
      alignment: smooth(this.conf.alignment, Math.max(0, Math.min(1, alignment))),
      waveform: smooth(this.conf.waveform, Math.max(0, Math.min(1, waveform))),
      electrical: smooth(this.conf.electrical, Math.max(0, Math.min(1, electrical))),
    };

    // ---- state machine ----
    const soft = Math.min(this.conf.channel, this.conf.alignment, this.conf.waveform);
    const hardFail = dataInvalid || (p.mode === "C" && p.syncQuality === "INVALID" && !syncFallback);
    const prev = this.state;
    this.stateTimerMs += dtMs;

    if (p.mode === "A") {
      // baseline: no security logic beyond hard validity
      this.state = hardFail ? "BLOCKED" : "NORMAL";
    } else {
      switch (this.state) {
        case "NORMAL":
          if (hardFail) this.state = "BLOCKED";
          else if (soft < 0.85) this.state = "WATCH";
          break;
        case "WATCH":
          if (hardFail) this.state = "BLOCKED";
          else if (soft < 0.7) {
            this.state = "SECURE";
            this.secureRemainingMs = SECURE_WINDOW_MS;
          } else if (soft > 0.9) this.state = "NORMAL";
          break;
        case "SECURE":
          this.secureRemainingMs -= dtMs;
          if (hardFail || this.secureRemainingMs <= 0) this.state = "BLOCKED";
          else if (soft > 0.82) this.state = "WATCH";
          break;
        case "BLOCKED":
          if (!hardFail && soft > 0.6) {
            this.state = "RECOVERY";
            this.stateTimerMs = 0;
          }
          break;
        case "RECOVERY":
          if (hardFail || soft < 0.55) this.state = "BLOCKED";
          else if (this.stateTimerMs > RECOVERY_MS) this.state = "NORMAL";
          break;
      }
    }
    if (prev !== this.state) {
      this.stateTimerMs = 0;
      this.logEvent(`${prev} → ${this.state}${reasons[0] ? ` · ${reasons[0]}` : ""}`, "state");
    }

    // ---- protection ----
    const raisedPickup = this.state === "SECURE" ? PICKUP_PU * 1.6 : PICKUP_PU;
    const charOk =
      this.idiffRms > Math.max(raisedPickup, SLOPE * this.ibiasRms);
    const permitted = this.state !== "BLOCKED";
    if (charOk && permitted) this.operateTimerMs += dtMs;
    else this.operateTimerMs = 0;
    const operate = this.operateTimerMs > (this.state === "SECURE" ? 25 : 10);
    if (operate && this.operateTimerMs - dtMs <= 10) this.logEvent("87L OPERATE", "trip");

    this.reasons = Array.from(new Set(reasons)).slice(0, 4);

    this._snap = {
      t: this.t,
      state: this.state,
      secureRemainingMs: this.state === "SECURE" ? Math.max(0, this.secureRemainingMs) : 0,
      confidence: this.conf,
      reasons: this.reasons,
      rttMs: rtt,
      estOneWayMs: est,
      trueForwardMs: fwd,
      trueReturnMs: ret,
      asymmetryMs: asym,
      residualMs: residual,
      phaseErrorDeg: phaseErrDeg,
      packetAgeMs: this.packetAgeMs,
      idiffPu: this.idiffRms,
      ibiasPu: this.ibiasRms,
      rawIdiffPu: this.rawRms,
      operate,
      tripPermitted: permitted,
      lossEvents: this.lossEvents,
      packetsRx: this.packetsRx,
    };
  }

  private _snap: SimSnapshot = {
    ...INITIAL_SNAPSHOT,
    confidence: { ...INITIAL_SNAPSHOT.confidence },
  };

  get snapshot() {
    return this._snap;
  }

  advance(seconds: number) {
    const steps = Math.min(2000, Math.round(seconds / DT));
    for (let i = 0; i < steps; i++) this.step(DT);
  }

  /**
   * Builds a phase-locked oscilloscope frame. The horizontal axis always spans
   * the same four electrical cycles, so the sine waves do not scroll. Only
   * magnitude, distortion, phase alignment, and data quality change.
   */
  scopeTraces(): Traces {
    const p = this.params;
    const snap = this._snap;
    const pingPongEstimateMs = snap.rttMs / 2;
    const staleShiftMs = this.lossState ? snap.packetAgeMs : 0;
    const quality = this.corrupt || snap.packetAgeMs > 20 ? 0 : this.lossState ? 0.5 : 1;
    const spanSeconds = SCOPE_CYCLES / Math.max(1, p.freqHz);

    for (let i = 0; i < WINDOW_SAMPLES; i++) {
      const phaseTime = (i / (WINDOW_SAMPLES - 1)) * spanSeconds;
      const local = this.scopeSignal("local", phaseTime);
      const remoteRx = this.scopeSignal(
        "remote",
        phaseTime - snap.trueForwardMs / 1000,
      );
      const remoteAligned = this.scopeSignal(
        "remote",
        phaseTime - snap.trueForwardMs / 1000 - staleShiftMs / 1000 + snap.estOneWayMs / 1000,
      );
      const remoteRaw = this.scopeSignal(
        "remote",
        phaseTime - snap.trueForwardMs / 1000 + pingPongEstimateMs / 1000,
      );

      this.scopeOut.local[i] = local;
      this.scopeOut.remoteRx[i] = remoteRx;
      this.scopeOut.remoteAligned[i] = remoteAligned;
      this.scopeOut.idiff[i] = Math.abs(local + remoteAligned);
      this.scopeOut.idiffRaw[i] = Math.abs(local + remoteRaw);
      this.scopeOut.ibias[i] = (Math.abs(local) + Math.abs(remoteAligned)) / 2;
      this.scopeOut.valid[i] = quality;
    }

    return { ...this.scopeOut };
  }
}
