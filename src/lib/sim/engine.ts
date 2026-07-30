import {
  Engine as CoreEngine,
  SCOPE_CYCLES,
  WINDOW_SAMPLES,
  scenarioEventActive,
} from "./engineCore.ts";
import type { ElectricalScenario } from "./types";
import type { Traces } from "./engineCore.ts";

export {
  PICKUP_PU,
  SAMPLE_RATE,
  SCOPE_CYCLES,
  SLOPE,
  WINDOW_SAMPLES,
  defaultParams,
  scenarioEventActive,
} from "./engineCore.ts";
export type { Traces } from "./engineCore.ts";

type Gains = { local: number; remote: number; sign: 1 | -1 };

function gainsForScope(
  scenario: ElectricalScenario,
  active: boolean,
): Gains {
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

function createScopeFrame(): Traces {
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

export class Engine extends CoreEngine {
  private scopeFrame = createScopeFrame();

  override scopeTraces(): Traces {
    const params = this.params;
    const snapshot = this.snapshot;
    const active = scenarioEventActive(params.scenario, snapshot.t);
    const gains = gainsForScope(params.scenario, active);
    const angularFrequency = 2 * Math.PI * params.freqHz;
    const eventPhase = ((snapshot.t % 1.6) + 1.6) % 1.6;
    const dc =
      (params.dcOffsetPct / 100) * Math.exp(-eventPhase / 0.15);
    const spanSeconds = SCOPE_CYCLES / Math.max(1, params.freqHz);
    const staleShiftMs =
      snapshot.packetAgeMs > 0 ? snapshot.packetAgeMs : 0;
    const corrupt = snapshot.reasons.includes("COMM_CORRUPT");
    const quality =
      corrupt || snapshot.packetAgeMs > 20
        ? 0
        : snapshot.packetAgeMs > 0
          ? 0.5
          : 1;

    const sample = (kind: "local" | "remote", phaseTime: number) => {
      const harmonic =
        (params.harmonicsPct / 100) *
        Math.sin(3 * angularFrequency * phaseTime);

      if (kind === "local") {
        let value =
          gains.local * Math.sin(angularFrequency * phaseTime) +
          dc +
          gains.local * harmonic;
        if (params.scenario === "CT_SATURATION") {
          value = Math.max(-2.2, Math.min(2.2, value));
        }
        return value;
      }

      const scale =
        (params.remoteMagnitudePct / 100) * gains.remote * gains.sign;
      return scale *
        (Math.sin(angularFrequency * phaseTime) + harmonic);
    };

    for (let index = 0; index < WINDOW_SAMPLES; index++) {
      const phaseTime =
        (index / (WINDOW_SAMPLES - 1)) * spanSeconds;
      const local = sample("local", phaseTime);
      const remoteRx = sample(
        "remote",
        phaseTime - snapshot.trueForwardMs / 1000,
      );
      const remoteAligned = sample(
        "remote",
        phaseTime -
          snapshot.trueForwardMs / 1000 -
          staleShiftMs / 1000 +
          snapshot.estOneWayMs / 1000,
      );
      const remoteRaw = sample(
        "remote",
        phaseTime -
          snapshot.trueForwardMs / 1000 +
          snapshot.rttMs / 2000,
      );

      this.scopeFrame.local[index] = local;
      this.scopeFrame.remoteRx[index] = remoteRx;
      this.scopeFrame.remoteAligned[index] = remoteAligned;
      this.scopeFrame.idiff[index] = Math.abs(local + remoteAligned);
      this.scopeFrame.idiffRaw[index] = Math.abs(local + remoteRaw);
      this.scopeFrame.ibias[index] =
        (Math.abs(local) + Math.abs(remoteAligned)) / 2;
      this.scopeFrame.valid[index] = quality;
    }

    return { ...this.scopeFrame };
  }
}
