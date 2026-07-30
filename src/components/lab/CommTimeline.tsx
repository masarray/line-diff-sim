import type { SimSnapshot } from "@/lib/sim/types";

export function CommTimeline({ snap }: { snap: SimSnapshot }) {
  const total = Math.max(1, snap.rttMs);
  const fwdPct = (snap.trueForwardMs / total) * 100;
  const retPct = (snap.trueReturnMs / total) * 100;
  const estPct = (snap.estOneWayMs / total) * 100;

  return (
    <section className="panel px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-mono text-[10px] tracking-[0.16em] text-primary/90">
          COMMUNICATION TIMELINE
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          RTT <span className="text-foreground">{snap.rttMs.toFixed(2)} ms</span>
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          RTT/2 <span className="text-foreground">{(snap.rttMs / 2).toFixed(2)} ms</span>
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          Applied est <span className="text-foreground">{snap.estOneWayMs.toFixed(2)} ms</span>
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          Asymmetry{" "}
          <span className={Math.abs(snap.asymmetryMs) > 1 ? "text-warn" : "text-foreground"}>
            {snap.asymmetryMs.toFixed(2)} ms
          </span>
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          Packets <span className="text-foreground">{snap.packetsRx}</span> · gaps{" "}
          <span className={snap.lossEvents ? "text-warn" : "text-foreground"}>{snap.lossEvents}</span>
        </span>
      </div>

      <div className="mt-2 flex h-4 w-full items-stretch overflow-hidden rounded-sm border border-border">
        <div
          className="flex items-center justify-center bg-lane-local/25 font-mono text-[9px] text-lane-local"
          style={{ width: `${fwdPct}%` }}
        >
          FWD {snap.trueForwardMs.toFixed(1)}
        </div>
        <div
          className="flex items-center justify-center bg-lane-remote/25 font-mono text-[9px] text-lane-remote"
          style={{ width: `${retPct}%` }}
        >
          RET {snap.trueReturnMs.toFixed(1)}
        </div>
      </div>
      <div className="relative mt-1 h-3">
        <div
          className="absolute top-0 h-3 w-px bg-primary"
          style={{ left: `${Math.min(100, estPct)}%` }}
        />
        <span
          className="absolute top-0 -translate-x-1/2 font-mono text-[9px] text-primary"
          style={{ left: `${Math.min(97, estPct)}%` }}
        >
          ▲ alignment estimate
        </span>
      </div>
    </section>
  );
}
