import assert from "node:assert/strict";
import test from "node:test";
import {
  Engine,
  WINDOW_SAMPLES,
  defaultParams,
  scenarioEventActive,
} from "../src/lib/sim/engine.ts";
import type { SimParams } from "../src/lib/sim/types.ts";

function createEngine(overrides: Partial<SimParams> = {}) {
  const engine = new Engine();
  engine.params = { ...defaultParams, ...overrides };
  return engine;
}

function maximumAbsolute(samples: Float32Array) {
  let maximum = 0;
  for (const sample of samples) maximum = Math.max(maximum, Math.abs(sample));
  return maximum;
}

test("advance covers the requested simulation interval", () => {
  const engine = createEngine();
  engine.advance(3);
  assert.ok(Math.abs(engine.snapshot.t - 3) < 1e-9);
});

test("healthy smart tracking starts without false RTT-step transitions", () => {
  const engine = createEngine({ mode: "D" });
  engine.advance(0.5);

  assert.equal(engine.snapshot.state, "NORMAL");
  assert.equal(engine.snapshot.operate, false);
  assert.equal(
    engine.events.some((event) => event.label.includes("COMM_RTT_STEP")),
    false,
  );
});

test("smart tracking corrects representative asymmetric paths", () => {
  const conventional = createEngine({
    mode: "A",
    forwardDelayMs: 12,
    returnDelayMs: 3,
  });
  const smart = createEngine({
    mode: "D",
    forwardDelayMs: 12,
    returnDelayMs: 3,
  });

  conventional.advance(0.5);
  smart.advance(0.5);

  assert.ok(Math.abs(smart.snapshot.residualMs) < 0.1);
  assert.ok(
    Math.abs(smart.snapshot.residualMs) <
      Math.abs(conventional.snapshot.residualMs),
  );
  assert.notEqual(smart.snapshot.state, "BLOCKED");
});

test("secure mode blocks sustained packet loss without false operate", () => {
  const engine = createEngine({ mode: "B", packetLossPct: 100 });
  engine.advance(0.3);

  assert.equal(engine.snapshot.state, "BLOCKED");
  assert.equal(engine.snapshot.packetsRx, 0);
  assert.ok(engine.snapshot.packetAgeMs > 20);
  assert.equal(engine.snapshot.operate, false);
  assert.equal(engine.events.some((event) => event.kind === "trip"), false);
});

test("internal fault operates while external fault remains restrained", () => {
  const internal = createEngine({
    mode: "B",
    scenario: "INTERNAL_FAULT",
  });
  const external = createEngine({
    mode: "B",
    scenario: "EXTERNAL_FAULT",
  });

  internal.advance(1.05);
  external.advance(1.05);

  assert.equal(internal.snapshot.eventActive, true);
  assert.equal(internal.snapshot.operate, true);
  assert.equal(internal.events.some((event) => event.kind === "trip"), true);
  assert.equal(external.snapshot.operate, false);
});

test("phase-locked local scope remains stationary", () => {
  const engine = createEngine();
  engine.advance(0.2);
  const before = Float32Array.from(engine.scopeTraces().local);
  engine.advance(0.4);
  const after = engine.scopeTraces().local;

  assert.equal(before.length, WINDOW_SAMPLES);
  for (let index = 0; index < WINDOW_SAMPLES; index++) {
    assert.equal(after[index], before[index]);
  }
});

test("active fault changes the stationary oscilloscope frame", () => {
  const engine = createEngine({ scenario: "INTERNAL_FAULT" });
  engine.advance(0.5);
  const preFaultMagnitude = maximumAbsolute(engine.scopeTraces().local);

  engine.advance(0.5);
  const faultMagnitude = maximumAbsolute(engine.scopeTraces().local);

  assert.equal(engine.snapshot.eventActive, true);
  assert.ok(faultMagnitude > preFaultMagnitude * 3);
});

test("transient event window is deterministic", () => {
  assert.equal(scenarioEventActive("INTERNAL_FAULT", 0.799), false);
  assert.equal(scenarioEventActive("INTERNAL_FAULT", 0.8), true);
  assert.equal(scenarioEventActive("INTERNAL_FAULT", 1.599), true);
  assert.equal(scenarioEventActive("INTERNAL_FAULT", 1.6), false);
});
