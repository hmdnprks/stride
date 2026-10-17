"use client";

import { useState, type ReactNode } from "react";
import useMeasure from "react-use-measure";
import type { HeatRunPoint, SleepRunPoint } from "@/lib/insights";
import { linear, niceTicks, shortDay } from "./scale";

const M = { top: 12, right: 12, bottom: 34, left: 44 };
const HIT_RADIUS = 24;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

interface EasyRunPoint {
  id: string;
  date: string;
  name: string;
  metresPerBeat: number;
  paceSecPerKm: number;
  avgHr: number;
}

function fit(xsOf: number[], ysOf: number[]) {
  if (xsOf.length < 3) return null;
  const n = xsOf.length;
  const mx = xsOf.reduce((a, v) => a + v, 0) / n;
  const my = ysOf.reduce((a, v) => a + v, 0) / n;
  const sxx = xsOf.reduce((a, v) => a + (v - mx) ** 2, 0);
  if (!sxx) return null;
  const slope = xsOf.reduce((a, v, i) => a + (v - mx) * (ysOf[i] - my), 0) / sxx;
  return (x: number) => my + slope * (x - mx);
}

/**
 * Each easy run as a dot: some condition across (sleep, dew point), running
 * efficiency up, with a trend line, a tooltip, arrow-key stepping and a table.
 */
function EasyRunScatter<P extends EasyRunPoint>({
  points,
  xOf,
  xLabel,
  xColumn,
  xFormat = String,
  xPad,
  ariaLabel,
  empty,
  describe,
  height = 220,
}: {
  points: P[];
  xOf: (p: P) => number;
  /** Axis title, e.g. "Sleep score the night before". */
  xLabel: string;
  /** Table column heading for x. */
  xColumn: string;
  xFormat?: (v: number) => string;
  /** Room either side of the data on the x axis. */
  xPad: number;
  ariaLabel: string;
  empty: string;
  /** Tooltip line under the efficiency figure. */
  describe: (p: P) => ReactNode;
  height?: number;
}) {
  const [ref, { width }] = useMeasure();
  const [hover, setHover] = useState<number | null>(null);

  if (!points.length) {
    return <p className="rounded-2xl bg-muted p-6 text-sm text-muted-foreground">{empty}</p>;
  }

  const xVals = points.map(xOf);
  const xs = niceTicks(Math.min(...xVals) - xPad, Math.max(...xVals) + xPad, 5);
  const ys = niceTicks(Math.min(...points.map((p) => p.metresPerBeat)) * 0.97, Math.max(...points.map((p) => p.metresPerBeat)) * 1.03, 4);
  const x = linear(xs.min, xs.max, M.left, width - M.right);
  const y = linear(ys.min, ys.max, M.top + height, M.top);
  const trend = fit(xVals, points.map((p) => p.metresPerBeat));

  const nearest = (px: number, py: number) => {
    let best: number | null = null;
    let bestD = HIT_RADIUS ** 2;
    points.forEach((p, i) => {
      const d = (x(xOf(p)) - px) ** 2 + (y(p.metresPerBeat) - py) ** 2;
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
              aria-label={`${ariaLabel} Use the arrow keys to step through runs.`}
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
                  {xFormat(t)}
                </text>
              ))}
              <text x={width - M.right} y={M.top + height + 32} textAnchor="end" className="fill-muted-foreground text-[11px]">
                {xLabel}
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
                  cx={x(xOf(p))}
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
                  ...(x(xOf(h)) > width / 2 ? { right: width - x(xOf(h)) + 14 } : { left: x(xOf(h)) + 14 }),
                }}
              >
                <p className="mb-1 text-muted-foreground">
                  {h.name}, {shortDay(h.date)}
                </p>
                <p>
                  <span className="font-semibold tabular-nums">{h.metresPerBeat.toFixed(2)} m</span>{" "}
                  <span className="text-muted-foreground">per heartbeat</span>
                </p>
                <p className="tabular-nums text-muted-foreground">{describe(h)}</p>
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
                <th className="px-3 py-2 text-right font-medium">{xColumn}</th>
                <th className="px-3 py-2 text-right font-medium">m per beat</th>
                <th className="px-3 py-2 text-right font-medium">Pace /km</th>
                <th className="px-3 py-2 text-right font-medium">Heart rate</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-1.5 text-muted-foreground">{shortDay(p.date)}</td>
                  <td className="px-3 py-1.5 text-right">{xFormat(xOf(p))}</td>
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

/** Each easy run: last night's sleep score across, running efficiency up. */
export function SleepRunChart({ points }: { points: SleepRunPoint[] }) {
  return (
    <EasyRunScatter
      points={points}
      xOf={(p) => p.sleepScore}
      xLabel="Sleep score the night before"
      xColumn="Sleep score"
      xPad={3}
      ariaLabel="Easy-run efficiency against the previous night's sleep score."
      empty="No easy runs with sleep data yet."
      describe={(p) => `Slept ${p.sleepScore}, ran ${clock(p.paceSecPerKm)} /km at ${p.avgHr} bpm`}
    />
  );
}

/** Each easy run: dew point at the start across, running efficiency up. */
export function HeatRunChart({ points }: { points: HeatRunPoint[] }) {
  return (
    <EasyRunScatter
      points={points}
      xOf={(p) => p.dewPointC}
      xLabel="Dew point at the start (°C)"
      xColumn="Dew point"
      xFormat={(v) => `${Math.round(v)}°`}
      xPad={1}
      ariaLabel="Easy-run efficiency against the dew point at the start."
      empty="No easy runs with weather yet. Weather fills in as Stride syncs."
      describe={(p) => `${Math.round(p.tempC)}°C, dew point ${Math.round(p.dewPointC)}°C; ran ${clock(p.paceSecPerKm)} /km at ${p.avgHr} bpm`}
    />
  );
}
