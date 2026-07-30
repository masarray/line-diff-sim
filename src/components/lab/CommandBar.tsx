import type { ChangeEvent } from "react";
import type {
  AlgoMode,
  ElectricalScenario,
  PermissionState,
} from "@/lib/sim/types";

const MODES: { id: AlgoMode; label: string }[] = [
  { id: "A", label: "A · Conventional Ping-Pong" },
  { id: "B", label: "B · Ping-Pong + Secure Window" },
  { id: "C", label: "C · GPS Time Sync" },
  { id: "D", label: "D · Smart Waveform Tracking" },
];

const SCENARIOS: { id: ElectricalScenario; label: string }[] = [
  { id: "THROUGH_LOAD", label: "Through load" },
  { id: "LOAD_CHANGE", label: "Load change" },
  { id: "EXTERNAL_FAULT", label: "External fault" },
  { id: "INTERNAL_FAULT", label: "Internal fault" },
  { id: "CT_SATURATION", label: "CT saturation" },
  { id: "CT_POLARITY", label: "CT polarity error" },
];

const stateColor: Record<PermissionState, string> = {
  NORMAL: "text-ok border-ok/50 bg-ok/10",
  WATCH: "text-warn border-warn/50 bg-warn/10",
  SECURE: "text-warn border-warn/60 bg-warn/15",
  BLOCKED: "text-danger border-danger/60 bg-danger/15",
  RECOVERY: "text-lane-local border-lane-local/50 bg-lane-local/10",
};

interface Props {
  mode: AlgoMode;
  scenario: ElectricalScenario;
  onMode: (mode: AlgoMode) => void;
  onScenario: (scenario: ElectricalScenario) => void;
  running: boolean;
  onRun: () => void;
  onStep: () => void;
  onReset: () => void;
  speed: number;
  onSpeed: (speed: number) => void;
  simTime: number;
  state: PermissionState;
  secureMs: number;
  operate: boolean;
  eventActive: boolean;
}

export function CommandBar(props: Props) {
  return (
    <header className="panel flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
      <div className="flex items-center gap-2 pr-2">
        <div className="h-6 w-1 rounded-sm bg-primary" />
        <div className="leading-tight">
          <div className="font-mono text-[11px] tracking-[0.18em] text-primary">87L</div>
          <h1 className="text-xs font-semibold tracking-tight">
            Line Differential Algorithm Lab
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-sm border border-border bg-secondary/40 p-0.5">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            aria-pressed={props.mode === mode.id}
            onClick={() => props.onMode(mode.id)}
            className={`rounded-[3px] px-2 py-1 font-mono text-[10px] tracking-wide transition-colors ${
              props.mode === mode.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <select
        aria-label="Electrical scenario"
        value={props.scenario}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          props.onScenario(event.target.value as ElectricalScenario)
        }
        className="rounded-sm border border-border bg-secondary/40 px-2 py-1 font-mono text-[10px] text-foreground"
      >
        {SCENARIOS.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>
            {scenario.label}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-pressed={props.running}
          onClick={props.onRun}
          className="rounded-sm border border-border bg-secondary/40 px-2.5 py-1 font-mono text-[10px] tracking-wide hover:bg-accent"
        >
          {props.running ? "PAUSE" : "RUN"}
        </button>
        <button
          type="button"
          onClick={props.onStep}
          className="rounded-sm border border-border bg-secondary/40 px-2.5 py-1 font-mono text-[10px] tracking-wide hover:bg-accent"
        >
          STEP
        </button>
        <button
          type="button"
          onClick={props.onReset}
          className="rounded-sm border border-border bg-secondary/40 px-2.5 py-1 font-mono text-[10px] tracking-wide hover:bg-accent"
        >
          RESET
        </button>
      </div>

      <label className="flex items-center gap-1.5">
        <span className="label-xs">Speed</span>
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={props.speed}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            props.onSpeed(Number(event.target.value))
          }
          className="w-20"
        />
        <span className="font-mono text-[10px] text-muted-foreground">
          {props.speed.toFixed(2)}x
        </span>
      </label>

      <div className="ml-auto flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          t = {props.simTime.toFixed(3)} s
        </span>
        {props.eventActive && (
          <span className="rounded-sm border border-primary/60 bg-primary/10 px-2 py-1 font-mono text-[10px] font-semibold tracking-widest text-primary">
            EVENT ACTIVE
          </span>
        )}
        {props.operate && (
          <span className="rounded-sm border border-danger/60 bg-danger/20 px-2 py-1 font-mono text-[10px] font-semibold tracking-widest text-danger">
            87L OPERATE
          </span>
        )}
        <span
          className={`rounded-sm border px-2 py-1 font-mono text-[10px] font-semibold tracking-widest ${stateColor[props.state]}`}
        >
          {props.state === "SECURE"
            ? `SECURE WINDOW · ${props.secureMs.toFixed(0)} ms`
            : props.state}
        </span>
      </div>
    </header>
  );
}
