import { useEffect, useRef } from "react";
import type { Traces } from "@/lib/sim/engine";
import { SCOPE_CYCLES, WINDOW_SAMPLES } from "@/lib/sim/engine";

type Series = {
  key: keyof Traces;
  color: string;
  dashed?: boolean;
  width?: number;
};

interface Props {
  title: string;
  subtitle?: string;
  traces: Traces;
  series: Series[];
  scale: number;
  height: number;
  tick: number;
  zeroCenter?: boolean;
  threshold?: number;
}

export function WaveformLane({
  title,
  subtitle,
  traces,
  series,
  scale,
  height,
  tick,
  zeroCenter = true,
  threshold,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const width = canvas.clientWidth;
      const canvasHeight = canvas.clientHeight;
      if (width <= 0 || canvasHeight <= 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(canvasHeight * dpr);

      const context = canvas.getContext("2d");
      if (!context) return;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, canvasHeight);

      const css = getComputedStyle(document.documentElement);
      const gridColor = css.getPropertyValue("--grid").trim() || "#333";
      const warningColor = css.getPropertyValue("--warn").trim() || "#d0a63a";
      const mutedColor =
        css.getPropertyValue("--muted-foreground").trim() || "#8c96a3";

      const quality = traces.valid[0] ?? 1;
      if (quality < 1) {
        context.fillStyle =
          quality <= 0
            ? "rgba(220, 70, 70, 0.13)"
            : "rgba(230, 180, 60, 0.10)";
        context.fillRect(0, 0, width, canvasHeight);
      }

      context.strokeStyle = gridColor;
      context.lineWidth = 1;

      // Half-cycle minor divisions. Full-cycle divisions are brighter.
      for (let division = 0; division <= SCOPE_CYCLES * 2; division++) {
        const x = (width * division) / (SCOPE_CYCLES * 2);
        context.globalAlpha = division % 2 === 0 ? 0.9 : 0.38;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvasHeight);
        context.stroke();
      }

      for (let division = 1; division < 4; division++) {
        const y = (canvasHeight * division) / 4;
        context.globalAlpha = division === 2 ? 0.9 : 0.34;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }

      const baseline = zeroCenter ? canvasHeight / 2 : canvasHeight - 2;
      context.globalAlpha = 1;
      context.beginPath();
      context.moveTo(0, baseline);
      context.lineTo(width, baseline);
      context.stroke();

      const yOf = (value: number) => {
        const normalized = value / scale;
        return zeroCenter
          ? baseline - normalized * (canvasHeight / 2 - 4)
          : baseline - normalized * (canvasHeight - 8);
      };

      if (threshold !== undefined) {
        context.strokeStyle = warningColor;
        context.globalAlpha = 0.65;
        context.setLineDash([3, 4]);
        context.beginPath();
        context.moveTo(0, yOf(threshold));
        context.lineTo(width, yOf(threshold));
        context.stroke();
        context.setLineDash([]);
      }

      for (const item of series) {
        const data = traces[item.key];
        context.strokeStyle = item.color;
        context.globalAlpha = 1;
        context.lineWidth = item.width ?? 1.4;
        context.lineJoin = "round";
        context.lineCap = "round";
        context.setLineDash(item.dashed ? [4, 3] : []);
        context.beginPath();

        for (let index = 0; index < WINDOW_SAMPLES; index++) {
          const x = (index / (WINDOW_SAMPLES - 1)) * width;
          const y = yOf(data[index]);
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.stroke();
      }
      context.setLineDash([]);

      // Fixed trigger/reference marker: the sweep is phase locked here.
      context.fillStyle = mutedColor;
      context.globalAlpha = 0.75;
      context.beginPath();
      context.moveTo(1, 1);
      context.lineTo(8, 1);
      context.lineTo(1, 8);
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
    };

    draw();
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [series, scale, threshold, tick, traces, zeroCenter]);

  return (
    <div className="panel relative flex flex-col overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 px-2 pt-1.5">
        <span className="label-xs shrink-0 text-foreground/80">{title}</span>
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="hidden font-mono text-[8px] tracking-[0.12em] text-primary/70 sm:inline">
            AUTO · PHASE LOCK · {SCOPE_CYCLES} CYCLES
          </span>
          <span className="label-xs truncate">{subtitle}</span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={height ? { height } : undefined}
        className="min-h-0 w-full flex-1"
        aria-label={`${title} phase-locked oscilloscope waveform`}
      />
    </div>
  );
}
