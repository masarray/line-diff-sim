export type AlgoMode = "A" | "B" | "C" | "D";

export type PermissionState =
  | "NORMAL"
  | "WATCH"
  | "SECURE"
  | "BLOCKED"
  | "RECOVERY";

export type ElectricalScenario =
  | "THROUGH_LOAD"
  | "LOAD_CHANGE"
  | "EXTERNAL_FAULT"
  | "INTERNAL_FAULT"
  | "CT_SATURATION"
  | "CT_POLARITY";

export type SyncQuality = "VALID" | "DEGRADED" | "INVALID";

export interface SimParams {
  mode: AlgoMode;
  scenario: ElectricalScenario;
  // communication
  forwardDelayMs: number;
  returnDelayMs: number;
  jitterMs: number;
  packetLossPct: number;
  corruptionPct: number;
  rttStepMs: number;
  // time
  clockOffsetMs: number;
  clockDriftPpm: number;
  syncQuality: SyncQuality;
  // electrical
  remoteMagnitudePct: number;
  dcOffsetPct: number;
  harmonicsPct: number;
  freqHz: number;
}

export interface Confidence {
  channel: number;
  alignment: number;
  waveform: number;
  electrical: number;
}

export interface SimSnapshot {
  t: number;
  state: PermissionState;
  secureRemainingMs: number;
  confidence: Confidence;
  reasons: string[];
  rttMs: number;
  estOneWayMs: number;
  trueForwardMs: number;
  trueReturnMs: number;
  asymmetryMs: number;
  residualMs: number;
  phaseErrorDeg: number;
  packetAgeMs: number;
  idiffPu: number;
  ibiasPu: number;
  rawIdiffPu: number;
  operate: boolean;
  tripPermitted: boolean;
  lossEvents: number;
  packetsRx: number;
}

export interface EventEntry {
  t: number;
  label: string;
  kind: "state" | "reason" | "trip";
}
