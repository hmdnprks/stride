"use client";

import { useState } from "react";
import useMeasure from "react-use-measure";
import type { RunPoint } from "@/lib/garmin/types";
import { linear, niceTicks, shortDay, timeTicks } from "./scale";
import { useTrendsPending } from "./pending";

const M = { top: 28, right: 12, bottom: 34, left: 48 };
const HIT_RADIUS = 24;

const pace = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Least-squares fit of pace on heart rate. */
function fit(runs: RunPoint[]) {
  if (runs.length < 3) return null;
  const n = runs.length;
  const mx = runs.reduce((a, r) => a + r.avgHr, 0) / n;
  const my = runs.reduce((a, r) => a + r.paceSecPerKm, 0) / n;
  const sxx = runs.reduce((a, r) => a + (r.avgHr - mx) ** 2, 0);
  if (!sxx) return null;
  const slope = runs.reduce((a, r) => a + (r.avgHr - mx) * (r.paceSecPerKm - my), 0) / sxx;
  return (hr: number) => my + slope * (hr - mx);
}

/**
 * Each run as a dot: heart rate across, pace up (faster is higher). Over
 * weeks, a fitter runner's dots drift up and to the left.
 */
export function PaceHrChart({ runs, height = 240 }: { runs: RunPoint[]; height?: number }) {
  const [ref, { width }] = useMeasure();
  const [hover, setHover] = useState<number | null>(null);
  const pending = useTrendsPending();

  const empty = runs.length === 0;
  const xs = niceTicks(Math.min(...runs.map((r) => r.avgHr)) - 3, Math.max(...runs.map((r) => r.avgHr)) + 3);
  const ys = timeTicks(Math.min(...runs.map((r) => r.paceSecPerKm)) - 5, Math.max(...runs.map((r) => r.paceSecPerKm)) + 5);
  const x = linear(xs.min, xs.max, M.left, width - M.right);
  // Inverted: lower seconds per km (faster) sits higher.
  const y = linear(ys.min, ys.max, M.top, M.top + height);
  const trend = fit(runs);

  const nearest = (px: number, py: number) => {
    let best: number | null = null;
    let bestD = HIT_RADIUS ** 2;
    runs.forEach((r, i) => {
      const d = (x(r.avgHr) - px) ** 2 + (y(r.paceSecPerKm) - py) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  const h = hover !== null ? runs[hover] : null;

  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <figcaption className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">Pace against heart rate</h3>
        <p className="text-sm text-muted-foreground">
          Each dot is a run. Dots higher at the same heart rate mean faster running for the same effort.
        </p>
        {!empty && trend && (
          <ul className="mt-1 flex gap-4 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-series" />
              Runs
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-context" />
              Trend
            </li>
          </ul>
        )}
      </figcaption>

      <div
        ref={ref}
        className="relative transition-opacity duration-200"
        style={{ height: height + M.top + M.bottom, opacity: pending ? 0.45 : 1 }}
      >
        {empty ? (
          <p className="flex h-full items-center justify-center rounded-2xl bg-muted text-sm text-muted-foreground">
            No runs with heart rate in this range.
          </p>
        ) : (
          width > 0 && (
            <>
              <svg
                width={width}
                height={height + M.top + M.bottom}
                role="img"
                aria-label="Pace against heart rate for each run. Use the arrow keys to step through runs."
                tabIndex={0}
                className="touch-pan-y overflow-visible outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                onPointerMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHover(nearest(e.clientX - rect.left, e.clientY - rect.top));
                }}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(runs.length - 1)}
                onBlur={() => setHover(null)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") setHover((i) => Math.max(0, (i ?? runs.length) - 1));
                  else if (e.key === "ArrowRight") setHover((i) => Math.min(runs.length - 1, (i ?? -1) + 1));
                  else if (e.key === "Escape") setHover(null);
                  else return;
                  e.preventDefault();
                }}
              >
                {ys.ticks.map((t) => (
                  <g key={`y${t}`}>
                    <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
                    <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                      {pace(t)}
                    </text>
                  </g>
                ))}
                {xs.ticks.map((t) => (
                  <text key={`x${t}`} x={x(t)} y={M.top + height + 18} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">
                    {t}
                  </text>
                ))}
                <text x={width - M.right} y={M.top + height + 32} textAnchor="end" className="fill-muted-foreground text-[11px]">
                  Average heart rate, bpm
                </text>
                <text x={M.left - 40} y={12} className="fill-muted-foreground text-[11px]">
                  Pace per km
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

                {runs.map((r, i) => (
                  <circle
                    key={r.id}
                    cx={x(r.avgHr)}
                    cy={y(r.paceSecPerKm)}
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
                  className="pointer-events-none absolute z-10 min-w-40 rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-[0_8px_24px_-12px_rgb(10_27_92/0.4)]"
                  style={{
                    top: Math.max(0, y(h.paceSecPerKm) - 70),
                    ...(x(h.avgHr) > width / 2 ? { right: width - x(h.avgHr) + 14 } : { left: x(h.avgHr) + 14 }),
                  }}
                >
                  <p className="mb-1 text-muted-foreground">
                    {h.name}, {shortDay(h.date)}
                  </p>
                  <p>
                    <span className="font-semibold tabular-nums">{pace(h.paceSecPerKm)} /km</span>{" "}
                    <span className="text-muted-foreground">at</span>{" "}
                    <span className="font-semibold tabular-nums">{h.avgHr} bpm</span>
                  </p>
                  <p className="text-muted-foreground tabular-nums">{h.distanceKm} km</p>
                </div>
              )}
            </>
          )
        )}
      </div>

      {!empty && (
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
                  <th className="px-3 py-2 font-medium">Run</th>
                  <th className="px-3 py-2 text-right font-medium">Pace /km</th>
                  <th className="px-3 py-2 text-right font-medium">Heart rate</th>
                  <th className="px-3 py-2 text-right font-medium">Distance</th>
                </tr>
              </thead>
              <tbody>
                {[...runs].reverse().map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-1.5 text-muted-foreground">{shortDay(r.date)}</td>
                    <td className="px-3 py-1.5">{r.name}</td>
                    <td className="px-3 py-1.5 text-right">{pace(r.paceSecPerKm)}</td>
                    <td className="px-3 py-1.5 text-right">{r.avgHr} bpm</td>
                    <td className="px-3 py-1.5 text-right">{r.distanceKm} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
