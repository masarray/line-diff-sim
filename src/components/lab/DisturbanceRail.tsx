import type { ChangeEvent, ReactNode } from "react";
import { applyPreset, presets } from "@/lib/sim/presets";
import type { SimParams, SyncQuality } from "@/lib/sim/types";

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block px-2 py-1">
      <div className="flex items-baseline justify-between">
        <span className="label-xs">{label}</span>
        <span className="font-mono text-[10px] text-foreground/90">
          {value.toFixed(step < 1 ? 1 : 0)}
          <span className="text-muted-foreground"> {unit}</span>
        </span>
      </div>
      <input
        type="range"
        className="mt-1 w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(Number(event.target.value))
        }
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-border/70 pb-1.5">
      <div className="px-2 pt-2 pb-0.5 font-mono text-[10px] tracking-[0.16em] text-primary/90">
        {title}
      </div>
      {children}
    </div>
  );
}

export function DisturbanceRail({
  params,
  setParams,
}: {
  params: SimParams;
  setParams: (updater: (params: SimParams) => SimParams) => void;
}) {
  const set = <Key extends keyof SimParams>(key: Key) =>
    (value: SimParams[Key]) =>
      setParams((previous) => ({ ...previous, [key]: value }));

  return (
    <aside className="panel flex min-h-0 flex-col overflow-y-auto">
      <Section title="PRESETS">
        <div className="grid grid-cols-2 gap-1 p-1.5">
          {presets.map((preset) => (
            <button
              key={preset.id}
              title={preset.desc}
              onClick={() => setParams((previous) => applyPreset(previous, preset))}
              className="rounded-sm border border-border bg-secondary/30 px-1.5 py-1 text-left font-mono text-[9.5px] leading-tight tracking-wide text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
            >
              {preset.name.toUpperCase()}
            </button>
          ))}
        </div>
      </Section>

      <Section title="COMMUNICATION">
        <Slider
          label="Forward delay"
          value={params.forwardDelayMs}
          min={0}
          max={50}
          step={0.5}
          unit="ms"
          onChange={set("forwardDelayMs")}
        />
        <Slider
          label="Return delay"
          value={params.returnDelayMs}
          min={0}
          max={50}
          step={0.5}
          unit="ms"
          onChange={set("returnDelayMs")}
        />
        <Slider
          label="Jitter (RMS)"
          value={params.jitterMs}
          min={0}
          max={10}
          step={0.1}
          unit="ms"
          onChange={set("jitterMs")}
        />
        <Slider
          label="Packet loss"
          value={params.packetLossPct}
          min={0}
          max={60}
          step={1}
          unit="%"
          onChange={set("packetLossPct")}
        />
        <Slider
          label="Corruption"
          value={params.corruptionPct}
          min={0}
          max={20}
          step={0.5}
          unit="%"
          onChange={set("corruptionPct")}
        />
        <Slider
          label="RTT step @1.2s"
          value={params.rttStepMs}
          min={-10}
          max={20}
          step={0.5}
          unit="ms"
          onChange={set("rttStepMs")}
        />
      </Section>

      <Section title="TIME SYNC">
        <Slider
          label="Clock offset"
          value={params.clockOffsetMs}
          min={-5}
          max={5}
          step={0.1}
          unit="ms"
          onChange={set("clockOffsetMs")}
        />
        <Slider
          label="Clock drift"
          value={params.clockDriftPpm}
          min={0}
          max={200}
          step={5}
          unit="ppm"
          onChange={set("clockDriftPpm")}
        />
        <div className="flex gap-1 px-2 py-1">
          {(["VALID", "DEGRADED", "INVALID"] as SyncQuality[]).map((quality) => (
            <button
              key={quality}
              onClick={() => set("syncQuality")(quality)}
              className={`flex-1 rounded-sm border px-1 py-1 font-mono text-[9px] tracking-wide transition-colors ${
                params.syncQuality === quality
                  ? "border-primary/70 bg-primary/15 text-primary"
                  : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {quality}
            </button>
          ))}
        </div>
      </Section>

      <Section title="ELECTRICAL">
        <Slider
          label="Remote magnitude"
          value={params.remoteMagnitudePct}
          min={50}
          max={150}
          step={1}
          unit="%"
          onChange={set("remoteMagnitudePct")}
        />
        <Slider
          label="DC offset"
          value={params.dcOffsetPct}
          min={0}
          max={80}
          step={1}
          unit="%"
          onChange={set("dcOffsetPct")}
        />
        <Slider
          label="3rd harmonic"
          value={params.harmonicsPct}
          min={0}
          max={40}
          step={1}
          unit="%"
          onChange={set("harmonicsPct")}
        />
        <Slider
          label="Frequency"
          value={params.freqHz}
          min={45}
          max={65}
          step={0.5}
          unit="Hz"
          onChange={set("freqHz")}
        />
      </Section>

      <p className="px-2 py-2 font-mono text-[9px] leading-relaxed text-muted-foreground">
        Conceptual simulation defaults — not recommended field settings.
      </p>
    </aside>
  );
}
