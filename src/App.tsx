import { useMemo } from "react";
import { CommTimeline } from "@/components/lab/CommTimeline";
import { CommandBar } from "@/components/lab/CommandBar";
import { ConfidenceRail } from "@/components/lab/ConfidenceRail";
import { DisturbanceRail } from "@/components/lab/DisturbanceRail";
import { VirtualRelay } from "@/components/lab/VirtualRelay";
import { WaveformLane } from "@/components/lab/WaveformLane";
import { PICKUP_PU } from "@/lib/sim/engine";
import { useSimulation } from "@/lib/sim/useSimulation";

export function App() {
  const sim = useSimulation();
  const { snapshot: snap, params } = sim;
  const traces = sim.engine.scopeTraces();

  const laneSeries = useMemo(
    () => ({
      local: [{ key: "local" as const, color: "oklch(0.79 0.15 200)" }],
      rx: [{ key: "remoteRx" as const, color: "oklch(0.8 0.15 78)" }],
      aligned: [
        { key: "local" as const, color: "oklch(0.79 0.15 200 / 0.28)", width: 1 },
        { key: "remoteAligned" as const, color: "oklch(0.8 0.17 145)" },
      ],
      diff: [
        { key: "idiffRaw" as const, color: "oklch(0.7 0.2 20 / 0.55)", dashed: true, width: 1 },
        { key: "ibias" as const, color: "oklch(0.66 0.02 245)", width: 1 },
        { key: "idiff" as const, color: "oklch(0.7 0.2 20)", width: 1.6 },
      ],
    }),
    [],
  );

  return (
    <main className="flex min-h-screen w-full flex-col gap-1.5 bg-background p-1.5 xl:h-screen xl:overflow-hidden">
      <CommandBar
        mode={params.mode}
        scenario={params.scenario}
        onMode={(mode) => sim.setParams((previous) => ({ ...previous, mode }))}
        onScenario={(scenario) =>
          sim.setParams((previous) => ({ ...previous, scenario }))
        }
        running={sim.running}
        onRun={() => sim.setRunning(!sim.running)}
        onStep={sim.stepOnce}
        onReset={sim.reset}
        speed={sim.speed}
        onSpeed={sim.setSpeed}
        simTime={snap.t}
        state={snap.state}
        secureMs={snap.secureRemainingMs}
        operate={snap.operate}
        eventActive={snap.eventActive}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-1.5 lg:grid-cols-[200px_minmax(0,1fr)_232px] xl:grid-cols-[200px_minmax(0,1fr)_232px_270px]">
        <div className="hidden min-h-0 lg:block">
          <DisturbanceRail params={params} setParams={sim.setParams} />
        </div>

        <div className="flex min-h-0 flex-col gap-1.5">
          <div className="grid min-h-[420px] flex-1 grid-rows-4 gap-1.5">
            <WaveformLane
              title="Local current"
              subtitle="phase reference · Ia"
              traces={traces}
              series={laneSeries.local}
              scale={5}
              height={0}
              tick={sim.tick}
            />
            <WaveformLane
              title="Remote received"
              subtitle={`before correction · age ${snap.packetAgeMs.toFixed(1)} ms`}
              traces={traces}
              series={laneSeries.rx}
              scale={5}
              height={0}
              tick={sim.tick}
            />
            <WaveformLane
              title="Remote aligned"
              subtitle={`mode ${params.mode} · residual ${snap.residualMs.toFixed(2)} ms (${snap.phaseErrorDeg.toFixed(1)}°)`}
              traces={traces}
              series={laneSeries.aligned}
              scale={5}
              height={0}
              tick={sim.tick}
            />
            <WaveformLane
              title="Idiff / Ibias"
              subtitle={`raw (dashed) · validated (solid) · pickup ${PICKUP_PU.toFixed(2)} pu`}
              traces={traces}
              series={laneSeries.diff}
              scale={2.5}
              zeroCenter={false}
              height={0}
              tick={sim.tick}
              threshold={PICKUP_PU}
            />
          </div>
          <CommTimeline snap={snap} />
        </div>

        <div className="min-h-0">
          <VirtualRelay snapshot={snap} params={params} running={sim.running} />
        </div>

        <div className="min-h-0 lg:col-span-3 xl:col-span-1">
          <ConfidenceRail snap={snap} events={sim.engine.events} />
        </div>
      </div>

      <div className="lg:hidden">
        <DisturbanceRail params={params} setParams={sim.setParams} />
      </div>

      <footer className="flex flex-wrap justify-between gap-x-4 px-1 font-mono text-[9px] text-muted-foreground">
        <span>Educational &amp; algorithm-research simulator — not a field-certified protection relay.</span>
        <span>GPL-3.0 · Phase-locked scope · Latched virtual relay target</span>
      </footer>
    </main>
  );
}
