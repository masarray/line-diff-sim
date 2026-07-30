import type {
  AlgoMode,
  ElectricalScenario,
  SimParams,
  SimSnapshot,
} from "../sim/types.ts";

export type RelayTripClassification = "VALID_FAULT_TRIP" | "UNWANTED_TRIP";

export type RelayAssessment =
  | "READY"
  | "PICKUP_RESTRAINED"
  | "TRIP_PREVENTED"
  | "VALID_FAULT_TRIP"
  | "UNWANTED_TRIP";

export interface RelayLatchState {
  latched: boolean;
  resetInhibited: boolean;
  classification: RelayTripClassification | null;
  tripTimeSeconds: number | null;
  idiffPu: number | null;
  ibiasPu: number | null;
  residualMs: number | null;
  mode: AlgoMode | null;
  modeLabel: string | null;
  scenario: ElectricalScenario | null;
  scenarioLabel: string | null;
  reasonCodes: string[];
}

const MODE_LABELS: Record<AlgoMode, string> = {
  A: "Conventional ping-pong",
  B: "Secure-window supervision",
  C: "GPS time sync",
  D: "Smart waveform tracking",
};

const SCENARIO_LABELS: Record<ElectricalScenario, string> = {
  THROUGH_LOAD: "Through load",
  LOAD_CHANGE: "Load change",
  EXTERNAL_FAULT: "External fault",
  INTERNAL_FAULT: "Internal fault",
  CT_SATURATION: "CT saturation",
  CT_POLARITY: "CT polarity error",
};

export function modeLabel(mode: AlgoMode) {
  return MODE_LABELS[mode];
}

export function scenarioLabel(scenario: ElectricalScenario) {
  return SCENARIO_LABELS[scenario];
}

export function createRelayLatchState(): RelayLatchState {
  return {
    latched: false,
    resetInhibited: false,
    classification: null,
    tripTimeSeconds: null,
    idiffPu: null,
    ibiasPu: null,
    residualMs: null,
    mode: null,
    modeLabel: null,
    scenario: null,
    scenarioLabel: null,
    reasonCodes: [],
  };
}

export function updateRelayLatch(
  previous: RelayLatchState,
  snapshot: SimSnapshot,
  params: SimParams,
): RelayLatchState {
  if (previous.latched) {
    if (previous.resetInhibited && !snapshot.operate) {
      return { ...previous, resetInhibited: false };
    }
    return previous;
  }

  if (!snapshot.operate) return previous;

  const validInternalFault =
    params.scenario === "INTERNAL_FAULT" && snapshot.eventActive;

  return {
    latched: true,
    resetInhibited: false,
    classification: validInternalFault
      ? "VALID_FAULT_TRIP"
      : "UNWANTED_TRIP",
    tripTimeSeconds: snapshot.t,
    idiffPu: snapshot.idiffPu,
    ibiasPu: snapshot.ibiasPu,
    residualMs: snapshot.residualMs,
    mode: params.mode,
    modeLabel: modeLabel(params.mode),
    scenario: params.scenario,
    scenarioLabel: scenarioLabel(params.scenario),
    reasonCodes: [...snapshot.reasons],
  };
}

export function resetRelayLatch(
  previous: RelayLatchState,
  operateConditionActive: boolean,
): RelayLatchState {
  if (!previous.latched) return previous;
  if (operateConditionActive) {
    return { ...previous, resetInhibited: true };
  }
  return createRelayLatchState();
}

export function assessRelay(
  snapshot: SimSnapshot,
  latch: RelayLatchState,
  pickupThresholdPu: number,
): RelayAssessment {
  if (latch.latched) {
    return latch.classification === "UNWANTED_TRIP"
      ? "UNWANTED_TRIP"
      : "VALID_FAULT_TRIP";
  }

  const pickup = snapshot.idiffPu >= pickupThresholdPu * 0.9;
  if (pickup && !snapshot.tripPermitted) return "TRIP_PREVENTED";
  if (pickup) return "PICKUP_RESTRAINED";
  return "READY";
}
