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

  const publishSnapshot = useCallback(() => {
    setSnapshot({ ...engine.snapshot });
    setTick((current) => current + 1);
  }, [engine]);

  const setParams = useCallback(
    (updater: SimParams | ((params: SimParams) => SimParams)) => {
      setParamsState((previous) => {
        const next =
          typeof updater === "function" ? updater(previous) : updater;
        engine.params = next;
        return next;
      });
      publishSnapshot();
    },
    [engine, publishSnapshot],
  );

  useEffect(() => {
    engine.params = params;
  }, [engine, params]);

  useEffect(() => {
    let animationFrame = 0;
    let previousTime = performance.now();
    let presentationAccumulator = 0;

    const loop = (now: number) => {
      const elapsedSeconds = Math.min(0.05, (now - previousTime) / 1000);
      previousTime = now;

      if (running) {
        engine.advance(elapsedSeconds * speed);
        presentationAccumulator += elapsedSeconds;
        if (presentationAccumulator >= 0.05) {
          presentationAccumulator = 0;
          publishSnapshot();
        }
      }

      animationFrame = requestAnimationFrame(loop);
    };

    animationFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrame);
  }, [engine, publishSnapshot, running, speed]);

  const stepOnce = useCallback(() => {
    setRunning(false);
    engine.advance(0.002);
    publishSnapshot();
  }, [engine, publishSnapshot]);

  const reset = useCallback(() => {
    engine.reset();
    publishSnapshot();
  }, [engine, publishSnapshot]);

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
