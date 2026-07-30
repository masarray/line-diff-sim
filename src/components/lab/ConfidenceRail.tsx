import type { EventEntry, SimSnapshot } from "@/lib/sim/types";

function Bar({
  label,
  value,
  note,
  invert,
}: {
  label: string;
  value: number;
  note: string;
  invert?: boolean;
}) {
  const percentage = Math.max(0, Math.min(100, Math.round(value * 100)));
  const good = invert ? percentage < 50 : percentage >= 85;
  const medium = invert ? percentage < 75 : percentage >= 60;
  const color = good ? "bg-ok" : medium ? "bg-warn" : "bg-danger";
  const text = good ? "text-ok" : medium ? "text-warn" : "text-danger";

  return (
    <div className="px-2 py-1.5">
      <div className="flex items-baseline justify-between">
        <span className="label-xs">{label}</span>
        <span className={`font-mono text-[10px] font-semibold ${text}`}>
          {percentage}%
        </span>
      </div>
      <div
        className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-grid"
        role="progressbar"
        aria-label={`${label} confidence`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
      >
        <div
          className={`h-full ${color} transition-[width] duration-150`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">{note}</div>
    </div>
  );
}

export function ConfidenceRail({
  snap,
  events,
}: {
  snap: SimSnapshot;
  events: EventEntry[];
}) {
  const confidence = snap.confidence;

  return (
    <aside className="panel flex min-h-0 flex-col overflow-hidden">
      <div className="border-b border-border/70 px-2 pt-2 pb-0.5 font-mono text-[10px] tracking-[0.16em] text-primary/90">
        CONFIDENCE &amp; PERMISSION
      </div>
      <Bar
        label="Channel"
        value={confidence.channel}
        note={`asym ${snap.asymmetryMs.toFixed(2)} ms · age ${snap.packetAgeMs.toFixed(1)} ms`}
      />
      <Bar
        label="Alignment"
        value={confidence.alignment}
        note={`residual ±${Math.abs(snap.residualMs).toFixed(2)} ms · ${snap.phaseErrorDeg.toFixed(1)}°`}
      />
      <Bar label="Waveform" value={confidence.waveform} note="continuity / coherence" />
      <Bar
        label="Electrical event"
        value={confidence.electrical}
        note={
          confidence.electrical > 0.6
            ? "internal fault plausible"
            : "no internal fault"
        }
        invert
      />

      <div className="border-y border-border/70 px-2 py-1.5">
        <div className="label-xs">Reason codes</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {snap.reasons.length === 0 && (
            <span className="font-mono text-[9px] text-muted-foreground">— none —</span>
          )}
          {snap.reasons.map((reason) => (
            <span
              key={reason}
              className="rounded-sm border border-warn/40 bg-warn/10 px-1 py-0.5 font-mono text-[9px] text-warn"
            >
              {reason}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-2 border-b border-border/70 px-2 py-1.5 font-mono text-[10px]">
        <Metric label="Idiff" value={`${snap.idiffPu.toFixed(3)} pu`} />
        <Metric label="Ibias" value={`${snap.ibiasPu.toFixed(3)} pu`} />
        <Metric label="Raw Idiff" value={`${snap.rawIdiffPu.toFixed(3)} pu`} />
        <Metric
          label="Trip perm."
          value={snap.tripPermitted ? "ALLOWED" : "REJECTED"}
          danger={!snap.tripPermitted}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="label-xs px-2 pt-1.5">Event timeline</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {events.length === 0 && (
            <div className="py-2 font-mono text-[9px] text-muted-foreground">
              No state transition or operate event yet.
            </div>
          )}
          {events.map((event, index) => (
            <div
              key={`${event.t}-${event.label}-${index}`}
              className="flex gap-2 border-b border-border/40 py-1 font-mono text-[9px]"
            >
              <span className="text-muted-foreground">{event.t.toFixed(3)}s</span>
              <span className={event.kind === "trip" ? "text-danger" : "text-foreground/85"}>
                {event.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function Metric({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={danger ? "text-danger" : "text-foreground"}>{value}</span>
    </div>
  );
}
