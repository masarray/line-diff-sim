import { useCallback, useEffect, useRef, useState } from "react";
import { Engine, defaultParams } from "./engine";
import type { SimParams, SimSnapshot } from "./types";

export function useSimulation() {
  const engineRef = useRef<Engine | null>(null);
  if (!engineRef.current) engineRef.current = new Engine();
  const engine = engineRef.current;

  const [params, setParamsState] = useState<SimParams>({ ...defaultParams });
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(0.25);
  const [snapshot, setSnapshot] = useState<SimSnapshot>(engine.snapshot);
  const [tick, setTick] = useState(0);

  const setParams = useCallback(
    (updater: SimParams | ((p: SimParams) => SimParams)) => {
      setParamsState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        engine.params = next;
        return next;
      });
      setSnapshot({ ...engine.snapshot });
      setTick((current) => current + 1);
    },
    [engine],
  );

  useEffect(() => {
    engine.params = params;
  }, [engine, params]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (running) engine.advance(dt * speed);
      acc += dt;
      if (acc > 0.05) {
        acc = 0;
        setSnapshot({ ...engine.snapshot });
        setTick((t) => t + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, running, speed]);

  const stepOnce = useCallback(() => {
    engine.advance(0.002);
    setSnapshot({ ...engine.snapshot });
    setTick((t) => t + 1);
  }, [engine]);

  const reset = useCallback(() => {
    engine.reset();
    setSnapshot({ ...engine.snapshot });
    setTick((t) => t + 1);
  }, [engine]);

  return {
    engine,
    params,
    setParams,
    running,
    setRunning,
    speed,
    setSpeed,
    snapshot,
    stepOnce,
    reset,
    tick,
  };
}
