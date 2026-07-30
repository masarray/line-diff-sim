import { defaultParams } from "./engine";
import type { SimParams } from "./types";

export interface Preset {
  id: string;
  name: string;
  desc: string;
  params: Partial<SimParams>;
}

export const presets: Preset[] = [
  {
    id: "healthy",
    name: "Healthy",
    desc: "Symmetrical channel with no jitter",
    params: {
      forwardDelayMs: 5,
      returnDelayMs: 5,
      jitterMs: 0,
      packetLossPct: 0,
      corruptionPct: 0,
      rttStepMs: 0,
      syncQuality: "VALID",
    },
  },
  {
    id: "maltrip",
    name: "Maltrip Demo",
    desc: "Mode A through-load with severe path asymmetry",
    params: {
      mode: "A",
      scenario: "THROUGH_LOAD",
      forwardDelayMs: 12,
      returnDelayMs: 3,
      jitterMs: 0,
      packetLossPct: 0,
      corruptionPct: 0,
      rttStepMs: 0,
      remoteMagnitudePct: 100,
    },
  },
  {
    id: "smart-corrected",
    name: "Smart Corrected",
    desc: "Same asymmetric through-load corrected by mode D",
    params: {
      mode: "D",
      scenario: "THROUGH_LOAD",
      forwardDelayMs: 12,
      returnDelayMs: 3,
      jitterMs: 0,
      packetLossPct: 0,
      corruptionPct: 0,
      rttStepMs: 0,
      remoteMagnitudePct: 100,
    },
  },
  {
    id: "asym",
    name: "Asymmetric Path",
    desc: "Forward 12 ms / return 3 ms",
    params: {
      forwardDelayMs: 12,
      returnDelayMs: 3,
      jitterMs: 0.4,
      packetLossPct: 0,
      rttStepMs: 0,
    },
  },
  {
    id: "jitter",
    name: "Jitter Burst",
    desc: "Bounded 6 ms jitter",
    params: {
      forwardDelayMs: 7,
      returnDelayMs: 6,
      jitterMs: 6,
      packetLossPct: 1,
    },
  },
  {
    id: "unreliable",
    name: "Comm Unreliable",
    desc: "Packet loss and corruption",
    params: {
      forwardDelayMs: 9,
      returnDelayMs: 5,
      jitterMs: 4,
      packetLossPct: 18,
      corruptionPct: 3,
    },
  },
  {
    id: "rttstep",
    name: "RTT Route Step",
    desc: "Route switching adds 9 ms",
    params: {
      forwardDelayMs: 6,
      returnDelayMs: 6,
      rttStepMs: 9,
      jitterMs: 1,
    },
  },
  {
    id: "synclost",
    name: "Sync Lost",
    desc: "Invalid GPS quality with clock drift",
    params: {
      syncQuality: "INVALID",
      clockOffsetMs: 1.5,
      clockDriftPpm: 120,
      forwardDelayMs: 8,
      returnDelayMs: 4,
    },
  },
];

export function applyPreset(base: SimParams, preset: Preset): SimParams {
  return {
    ...defaultParams,
    mode: base.mode,
    scenario: base.scenario,
    ...preset.params,
  };
}
