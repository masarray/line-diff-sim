import { useEffect, useState } from "react";
import {
  assessRelay,
  createRelayLatchState,
  resetRelayLatch,
  scenarioLabel,
  updateRelayLatch,
  type RelayAssessment,
} from "@/lib/relay/relayLatch";
import { PICKUP_PU } from "@/lib/sim/engine";
import type { SimParams, SimSnapshot } from "@/lib/sim/types";

type LedTone = "green" | "amber" | "red" | "violet";

const LED_ACTIVE: Record<LedTone, string> = {
  green: "bg-ok shadow-[0_0_7px_color-mix(in_oklch,var(--ok)_65%,transparent)]",
  amber: "bg-warn shadow-[0_0_7px_color-mix(in_oklch,var(--warn)_65%,transparent)]",
  red: "bg-danger shadow-[0_0_8px_color-mix(in_oklch,var(--danger)_70%,transparent)]",
  violet: "bg-[oklch(0.7_0.13_300)] shadow-[0_0_7px_oklch(0.7_0.13_300/0.55)]",
};

const ASSESSMENT_LABEL: Record<RelayAssessment, string> = {
  READY: "87L IN SERVICE",
  PICKUP_RESTRAINED: "87L PICKUP",
  TRIP_PREVENTED: "TRIP PREVENTED",
  VALID_FAULT_TRIP: "VALID FAULT TRIP",
  UNWANTED_TRIP: "MALTRIP CAPTURED",
};

function Led({
  active,
  label,
  tone,
}: {
  active: boolean;
  label: string;
  tone: LedTone;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 font-mono text-[8px] tracking-wide">
      <i
        aria-hidden="true"
        className={`h-2.5 w-2.5 shrink-0 rounded-full border border-black/50 bg-slate-500/65 shadow-inner transition-all ${active ? LED_ACTIVE[tone] : ""}`}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

function RelayNode({
  active,
  label,
  tone = "red",
}: {
  active: boolean;
  label: string;
  tone?: LedTone;
}) {
  const activeClass =
    tone === "green"
      ? "border-emerald-700 bg-emerald-200 text-emerald-950"
      : tone === "violet"
        ? "border-violet-700 bg-violet-200 text-violet-950"
        : tone === "amber"
          ? "border-amber-700 bg-amber-200 text-amber-950"
          : "border-red-700 bg-red-200 text-red-950";

  return (
    <div
      className={`grid h-7 min-w-8 place-items-center rounded-[2px] border px-1 font-mono text-[8px] font-bold ${active ? activeClass : "border-slate-500 bg-slate-200 text-slate-600"}`}
    >
      {label}
    </div>
  );
}

function PathLine({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`h-0.5 min-w-2 flex-1 ${active ? "bg-red-600 shadow-[0_0_5px_rgb(220_38_38/0.55)]" : "bg-slate-500"}`}
    />
  );
}

function BreakerSymbol({ open }: { open: boolean }) {
  return (
    <div className="grid min-w-10 place-items-center gap-0.5">
      <svg
        viewBox="0 0 40 22"
        className={`h-6 w-10 ${open ? "text-red-700" : "text-slate-700"}`}
        role="img"
        aria-label={`Circuit breaker 52 ${open ? "open" : "closed"}`}
      >
        <line x1="1" y1="12" x2="11" y2="12" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <circle cx="28" cy="12" r="2" fill="currentColor" />
        <line
          x1="12"
          y1="12"
          x2={open ? "25" : "28"}
          y2={open ? "3" : "12"}
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <line x1="29" y1="12" x2="39" y2="12" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span className={`font-mono text-[7px] font-bold ${open ? "text-red-800" : "text-slate-700"}`}>
        52 {open ? "OPEN" : "CLOSED"}
      </span>
    </div>
  );
}

function assessmentMessage(
  assessment: RelayAssessment,
  snapshot: SimSnapshot,
  params: SimParams,
) {
  switch (assessment) {
    case "UNWANTED_TRIP":
      return "NON-INTERNAL EVENT PASSED THE TRIP PATH";
    case "VALID_FAULT_TRIP":
      return "INTERNAL FAULT OPERATE CONFIRMED";
    case "TRIP_PREVENTED":
      return "PICKUP PRESENT · PERMISSION BLOCKED";
    case "PICKUP_RESTRAINED":
      return snapshot.tripPermitted
        ? "DIFFERENTIAL ELEMENT ABOVE PICKUP"
        : "SUPERVISION IS RESTRAINING OUTPUT";
    case "READY":
      return `${scenarioLabel(params.scenario).toUpperCase()} · PROTECTION AVAILABLE`;
  }
}

export function VirtualRelay({
  snapshot,
  params,
  running,
}: {
  snapshot: SimSnapshot;
  params: SimParams;
  running: boolean;
}) {
  const [latch, setLatch] = useState(createRelayLatchState);

  useEffect(() => {
    setLatch((previous) => updateRelayLatch(previous, snapshot, params));
  }, [params, snapshot]);

  const assessment = assessRelay(snapshot, latch, PICKUP_PU);
  const pickup = snapshot.idiffPu >= PICKUP_PU * 0.9 || snapshot.operate;
  const blocked = snapshot.state === "BLOCKED" || !snapshot.tripPermitted;
  const secure = ["WATCH", "SECURE", "RECOVERY"].includes(snapshot.state);
  const communicationPoor =
    snapshot.confidence.channel < 0.55 || snapshot.packetAgeMs > 20;
  const hardError =
    blocked ||
    snapshot.reasons.some((reason) =>
      ["PACKET_INTEGRITY_FAIL", "PACKET_TOO_OLD", "TIME_SYNC_INVALID"].includes(reason),
    );
  const tripPathActive = latch.latched;
  const tripIsUnwanted = latch.classification === "UNWANTED_TRIP";

  const lcdBackground = tripPathActive
    ? tripIsUnwanted
      ? "#b98572"
      : "#aa9761"
    : blocked
      ? "#9887aa"
      : secure
        ? "#a79b68"
        : "#83a06d";

  const reset = () => {
    setLatch((previous) => resetRelayLatch(previous, snapshot.operate));
  };

  return (
    <aside className="panel flex min-h-[430px] flex-col overflow-hidden p-1.5 xl:min-h-0" aria-label="Virtual line differential relay">
      <section
        className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-[4px] border bg-slate-300 text-slate-950 shadow-inner ${tripPathActive ? "border-red-700 ring-1 ring-red-600/45" : "border-slate-500"}`}
        style={{
          background:
            "linear-gradient(90deg,rgba(255,255,255,.28),transparent 9%,transparent 91%,rgba(15,23,42,.10)),linear-gradient(180deg,#d9e0e1,#c2cccd 48%,#aebabc)",
        }}
      >
        <header className="grid grid-cols-[38px_minmax(0,1fr)] items-center gap-2 border-b border-slate-700/25 px-2 py-2">
          <div className="grid h-8 place-items-center border border-teal-900 bg-teal-800 font-mono text-sm font-semibold tracking-wide text-teal-50">
            87L
          </div>
          <div className="min-w-0 leading-tight">
            <strong className="block truncate font-mono text-[9px] tracking-[0.08em]">
              VIRTUAL PROTECTION RELAY
            </strong>
            <span className="block truncate font-mono text-[7px] text-slate-600">
              LDX-87 · educational trip validation
            </span>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-1 border-b border-slate-700/20 px-2 py-1.5">
          <Led active={running} label="RUN" tone={running ? "green" : "amber"} />
          <Led
            active
            label="COMM"
            tone={communicationPoor ? "red" : snapshot.confidence.channel < 0.82 ? "amber" : "green"}
          />
          <Led active={hardError} label="ERROR" tone="red" />
        </div>

        <div
          className="mx-2 mt-2 rounded-[2px] border-[3px] border-slate-600 px-2 py-1.5 font-mono text-[#13291b] shadow-inner"
          style={{
            background:
              `repeating-linear-gradient(0deg,rgba(18,39,27,.05) 0 1px,transparent 1px 3px),${lcdBackground}`,
          }}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#13291b]/25 pb-1 text-[8px] font-bold">
            <span className="truncate">{ASSESSMENT_LABEL[assessment]}</span>
            <span>{snapshot.t.toFixed(3)} s</span>
          </div>
          <div className="mt-1 grid grid-cols-[42px_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-[8px]">
            <span>IDIFF</span><strong className="text-right">{snapshot.idiffPu.toFixed(3)} pu</strong>
            <span>IBIAS</span><strong className="text-right">{snapshot.ibiasPu.toFixed(3)} pu</strong>
            <span>STATE</span><strong className="truncate text-right">{snapshot.state}</strong>
            <span>PERM</span><strong className="text-right">{snapshot.tripPermitted ? "ALLOWED" : "BLOCKED"}</strong>
          </div>
          <div className="mt-1 truncate border-t border-[#13291b]/25 pt-1 text-[7px] font-bold">
            {assessmentMessage(assessment, snapshot, params)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-2 py-2 text-slate-800">
          <Led active={pickup} label="87L PICKUP" tone="amber" />
          <Led active={snapshot.tripPermitted} label="TRIP PERMIT" tone="green" />
          <Led active={secure} label="SECURE" tone="amber" />
          <Led active={blocked} label="87L BLOCK" tone="violet" />
          <Led active={snapshot.eventActive} label="EVENT" tone="amber" />
          <Led active={tripPathActive} label="TRIP LATCH" tone="red" />
        </div>

        <div className="mx-2 border border-slate-600/45 bg-white/20 px-2 py-2">
          <div className="mb-1 font-mono text-[7px] tracking-[0.12em] text-slate-600">
            TRIP VALIDATION PATH
          </div>
          <div className="flex items-center">
            <RelayNode active={pickup || tripPathActive} label="87L" tone="amber" />
            <PathLine active={tripPathActive} />
            <RelayNode
              active={snapshot.tripPermitted || tripPathActive}
              label={snapshot.tripPermitted || tripPathActive ? "PERM" : "BLOCK"}
              tone={snapshot.tripPermitted || tripPathActive ? "green" : "violet"}
            />
            <PathLine active={tripPathActive} />
            <RelayNode active={tripPathActive} label="86" tone="red" />
            <PathLine active={tripPathActive} />
            <BreakerSymbol open={tripPathActive} />
          </div>
          <div className={`mt-1.5 font-mono text-[8px] font-bold ${tripPathActive ? "text-red-800" : blocked && pickup ? "text-violet-900" : "text-slate-700"}`}>
            {tripPathActive
              ? "TRIP OUTPUT LATCHED · BREAKER OPEN"
              : blocked && pickup
                ? "OUTPUT BLOCKED · MALTRIP PREVENTED"
                : "TRIP CONTACT RESET · BREAKER CLOSED"}
          </div>
        </div>

        <div className="mt-auto grid grid-cols-[52px_minmax(0,1fr)] gap-2 border-t border-slate-700/25 bg-white/20 px-2 py-2">
          <div
            className={`grid place-items-center rounded-[2px] border px-1 py-1 font-mono ${tripPathActive ? "border-red-800 bg-red-600 text-white" : "border-slate-500 bg-slate-200 text-slate-600"}`}
            aria-label={`Relay target ${tripPathActive ? "trip" : "clear"}`}
          >
            <span className="text-[6px] tracking-widest">TARGET</span>
            <strong className="text-[10px]">{tripPathActive ? "TRIP" : "CLEAR"}</strong>
          </div>

          <div className="min-w-0 font-mono">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[7px] tracking-[0.12em] text-slate-600">TRIP MEMORY</div>
                <div className={`truncate text-[9px] font-bold ${tripIsUnwanted ? "text-red-800" : "text-slate-900"}`}>
                  {tripPathActive
                    ? tripIsUnwanted
                      ? "UNWANTED OPERATION / MALTRIP"
                      : "VALID INTERNAL-FAULT TRIP"
                    : "NO LATCHED OPERATION"}
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                disabled={!tripPathActive}
                className="shrink-0 rounded-[2px] border border-slate-600 bg-gradient-to-b from-slate-100 to-slate-400 px-2 py-1 font-mono text-[7px] font-bold text-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
              >
                RESET RELAY
              </button>
            </div>

            <div className="mt-1 min-h-7 text-[7px] leading-relaxed text-slate-600" aria-live="polite">
              {latch.resetInhibited ? (
                <span className="font-bold text-red-800">RESET INHIBITED · operate condition still active</span>
              ) : tripPathActive ? (
                <>
                  {latch.tripTimeSeconds?.toFixed(3)} s · {latch.idiffPu?.toFixed(3)} pu · {latch.scenarioLabel}
                  <br />
                  {latch.modeLabel} · residual {latch.residualMs?.toFixed(2)} ms
                </>
              ) : (
                "Target remains latched after the waveform event until RESET RELAY is pressed."
              )}
            </div>
          </div>
        </div>
      </section>
    </aside>
  );
}
