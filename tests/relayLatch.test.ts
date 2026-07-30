import assert from "node:assert/strict";
import test from "node:test";
import {
  assessRelay,
  createRelayLatchState,
  resetRelayLatch,
  updateRelayLatch,
} from "../src/lib/relay/relayLatch.ts";
import { Engine, PICKUP_PU, defaultParams } from "../src/lib/sim/engine.ts";
import { applyPreset, presets } from "../src/lib/sim/presets.ts";
import type { SimParams, SimSnapshot } from "../src/lib/sim/types.ts";

function snapshot(overrides: Partial<SimSnapshot> = {}): SimSnapshot {
  return {
    t: 1.05,
    eventActive: true,
    state: "NORMAL",
    secureRemainingMs: 0,
    confidence: { channel: 1, alignment: 1, waveform: 1, electrical: 1 },
    reasons: [],
    rttMs: 10,
    estOneWayMs: 5,
    trueForwardMs: 5,
    trueReturnMs: 5,
    asymmetryMs: 0,
    residualMs: 0,
    phaseErrorDeg: 0,
    packetAgeMs: 0,
    idiffPu: 1.42,
    ibiasPu: 1.1,
    rawIdiffPu: 1.42,
    operate: true,
    tripPermitted: true,
    lossEvents: 0,
    packetsRx: 1000,
    ...overrides,
  };
}

function params(overrides: Partial<SimParams> = {}): SimParams {
  return { ...defaultParams, ...overrides };
}

test("virtual relay latches and classifies a valid internal-fault trip", () => {
  const latched = updateRelayLatch(
    createRelayLatchState(),
    snapshot(),
    params({ scenario: "INTERNAL_FAULT", mode: "B" }),
  );

  assert.equal(latched.latched, true);
  assert.equal(latched.classification, "VALID_FAULT_TRIP");
  assert.equal(latched.tripTimeSeconds, 1.05);
  assert.equal(latched.idiffPu, 1.42);
});

test("virtual relay identifies non-internal operation as maltrip", () => {
  const latched = updateRelayLatch(
    createRelayLatchState(),
    snapshot({ eventActive: false, residualMs: -4.5 }),
    params({ scenario: "THROUGH_LOAD", mode: "A" }),
  );

  assert.equal(latched.classification, "UNWANTED_TRIP");
  assert.equal(latched.scenarioLabel, "Through load");
  assert.equal(latched.modeLabel, "Conventional ping-pong");
});

test("trip target remains latched after the operate condition clears", () => {
  const latched = updateRelayLatch(
    createRelayLatchState(),
    snapshot(),
    params({ scenario: "INTERNAL_FAULT" }),
  );
  const retained = updateRelayLatch(
    latched,
    snapshot({ t: 2, eventActive: false, operate: false, idiffPu: 0 }),
    params({ scenario: "INTERNAL_FAULT" }),
  );

  assert.strictEqual(retained, latched);
});

test("relay reset is inhibited during active operate and clears afterward", () => {
  const latched = updateRelayLatch(
    createRelayLatchState(),
    snapshot(),
    params({ scenario: "INTERNAL_FAULT" }),
  );

  const inhibited = resetRelayLatch(latched, true);
  assert.equal(inhibited.latched, true);
  assert.equal(inhibited.resetInhibited, true);

  const released = updateRelayLatch(
    inhibited,
    snapshot({ operate: false, eventActive: false }),
    params({ scenario: "INTERNAL_FAULT" }),
  );
  assert.equal(released.resetInhibited, false);

  const cleared = resetRelayLatch(released, false);
  assert.equal(cleared.latched, false);
});

test("pickup with blocked permission is presented as trip prevented", () => {
  const decision = assessRelay(
    snapshot({ operate: false, tripPermitted: false, idiffPu: PICKUP_PU * 1.2 }),
    createRelayLatchState(),
    PICKUP_PU,
  );

  assert.equal(decision, "TRIP_PREVENTED");
});

test("maltrip and smart-corrected presets produce contrasting outcomes", () => {
  const maltripPreset = presets.find((preset) => preset.id === "maltrip");
  const smartPreset = presets.find((preset) => preset.id === "smart-corrected");
  assert.ok(maltripPreset);
  assert.ok(smartPreset);

  const conventional = new Engine();
  conventional.params = applyPreset(defaultParams, maltripPreset);
  conventional.advance(0.5);

  const smart = new Engine();
  smart.params = applyPreset(defaultParams, smartPreset);
  smart.advance(0.5);

  assert.equal(conventional.snapshot.operate, true);
  assert.ok(conventional.snapshot.idiffPu > PICKUP_PU);
  assert.equal(smart.snapshot.operate, false);
  assert.ok(Math.abs(smart.snapshot.residualMs) < 0.1);
});
