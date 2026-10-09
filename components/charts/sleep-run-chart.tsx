"use client";

import { useState } from "react";
import useMeasure from "react-use-measure";
import type { SleepRunPoint } from "@/lib/insights";
import { linear, niceTicks, shortDay } from "./scale";

const M = { top: 12, right: 12, bottom: 34, left: 44 };
const HIT_RADIUS = 24;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function fit(points: SleepRunPoint[]) {
  if (points.length < 3) return null;
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.sleepScore, 0) / n;
  const my = points.reduce((a, p) => a + p.metresPerBeat, 0) / n;
  const sxx = points.reduce((a, p) => a + (p.sleepScore - mx) ** 2, 0);
  if (!sxx) return null;
  const slope = points.reduce((a, p) => a + (p.sleepScore - mx) * (p.metresPerBeat - my), 0) / sxx;
  return (x: number) => my + slope * (x - mx);
}

/** Each easy run: last night's sleep score across, running efficiency up. */
export function SleepRunChart({ points, height = 220 }: { points: SleepRunPoint[]; height?: number }) {
  const [ref, { width }] = useMeasure();
  const [hover, setHover] = useState<number | null>(null);

  if (!points.length) {
    return <p className="rounded-2xl bg-muted p-6 text-sm text-muted-foreground">No easy runs with sleep data yet.</p>;
  }

  const xs = niceTicks(Math.min(...points.map((p) => p.sleepScore)) - 3, Math.max(...points.map((p) => p.sleepScore)) + 3, 5);
  const ys = niceTicks(Math.min(...points.map((p) => p.metresPerBeat)) * 0.97, Math.max(...points.map((p) => p.metresPerBeat)) * 1.03, 4);
  const x = linear(xs.min, xs.max, M.left, width - M.right);
  const y = linear(ys.min, ys.max, M.top + height, M.top);
  const trend = fit(points);

  const nearest = (px: number, py: number) => {
    let best: number | null = null;
    let bestD = HIT_RADIUS ** 2;
    points.forEach((p, i) => {
      const d = (x(p.sleepScore) - px) ** 2 + (y(p.metresPerBeat) - py) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };
  const h = hover !== null ? points[hover] : null;

  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <ul className="flex gap-4 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-series" />
          Easy runs
        </li>
        {trend && (
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-context" />
            Trend
          </li>
        )}
      </ul>

      <div ref={ref} className="relative" style={{ height: height + M.top + M.bottom }}>
        {width > 0 && (
          <>
            <svg
              width={width}
              height={height + M.top + M.bottom}
              role="img"
              aria-label="Easy-run efficiency against the previous night's sleep score. Use the arrow keys to step through runs."
              tabIndex={0}
              className="touch-pan-y overflow-visible outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setHover(nearest(e.clientX - r.left, e.clientY - r.top));
              }}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(points.length - 1)}
              onBlur={() => setHover(null)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setHover((i) => Math.max(0, (i ?? points.length) - 1));
                else if (e.key === "ArrowRight") setHover((i) => Math.min(points.length - 1, (i ?? -1) + 1));
                else if (e.key === "Escape") setHover(null);
                else return;
                e.preventDefault();
              }}
            >
              {ys.ticks.map((t) => (
                <g key={`y${t}`}>
                  <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
                  <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                    {t.toFixed(2)}
                  </text>
                </g>
              ))}
              {xs.ticks.map((t) => (
                <text key={`x${t}`} x={x(t)} y={M.top + height + 18} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">
                  {t}
                </text>
              ))}
              <text x={width - M.right} y={M.top + height + 32} textAnchor="end" className="fill-muted-foreground text-[11px]">
                Sleep score the night before
              </text>
              {trend && (
                <line
                  x1={x(xs.min)}
                  x2={x(xs.max)}
                  y1={y(trend(xs.min))}
                  y2={y(trend(xs.max))}
                  stroke="var(--context)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              )}
              {points.map((p, i) => (
                <circle
                  key={p.id}
                  cx={x(p.sleepScore)}
                  cy={y(p.metresPerBeat)}
                  r={hover === i ? 6 : 4}
                  fill="var(--series)"
                  stroke="var(--background)"
                  strokeWidth={2}
                  opacity={hover !== null && hover !== i ? 0.5 : 1}
                />
              ))}
            </svg>
            {h && (
              <div
                className="pointer-events-none absolute z-10 min-w-44 rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-[0_8px_24px_-12px_rgb(10_27_92/0.4)]"
                style={{
                  top: Math.max(0, y(h.metresPerBeat) - 78),
                  ...(x(h.sleepScore) > width / 2 ? { right: width - x(h.sleepScore) + 14 } : { left: x(h.sleepScore) + 14 }),
                }}
              >
                <p className="mb-1 text-muted-foreground">
                  {h.name}, {shortDay(h.date)}
                </p>
                <p>
                  <span className="font-semibold tabular-nums">{h.metresPerBeat.toFixed(2)} m</span>{" "}
                  <span className="text-muted-foreground">per heartbeat</span>
                </p>
                <p className="tabular-nums text-muted-foreground">
                  Slept {h.sleepScore}, ran {clock(h.paceSecPerKm)} /km at {h.avgHr} bpm
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <details className="group text-sm">
        <summary className="w-fit cursor-pointer text-muted-foreground select-none hover:text-foreground">
          <span className="group-open:hidden">Show as table</span>
          <span className="hidden group-open:inline">Hide table</span>
        </summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="sticky top-0 bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Sleep score</th>
                <th className="px-3 py-2 text-right font-medium">m per beat</th>
                <th className="px-3 py-2 text-right font-medium">Pace /km</th>
                <th className="px-3 py-2 text-right font-medium">Heart rate</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-1.5 text-muted-foreground">{shortDay(p.date)}</td>
                  <td className="px-3 py-1.5 text-right">{p.sleepScore}</td>
                  <td className="px-3 py-1.5 text-right">{p.metresPerBeat.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">{clock(p.paceSecPerKm)}</td>
                  <td className="px-3 py-1.5 text-right">{p.avgHr} bpm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
