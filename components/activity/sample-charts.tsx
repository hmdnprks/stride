"use client";

import { useState } from "react";
import useMeasure from "react-use-measure";
import type { ActivitySample } from "@/lib/garmin/types";
import { linear, linePath, niceTicks, timeTicks } from "../charts/scale";

const M = { left: 48, right: 12 };
const H = 110;
const AXIS = 22;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

type Key = "paceSecPerKm" | "hr" | "elevationM" | "cadenceSpm";
// `minSpan`: the smallest y-range shown, so normal sensor noise on a steady
// run doesn't get zoomed into spikes.
const SERIES: {
  key: Key;
  title: string;
  unit: string;
  format: (v: number) => string;
  minSpan: number;
  invert?: boolean;
  area?: boolean;
  time?: boolean;
}[] = [
  { key: "paceSecPerKm", title: "Pace", unit: "/km", format: clock, minSpan: 60, invert: true, time: true },
  { key: "hr", title: "Heart rate", unit: "bpm", format: (v) => String(Math.round(v)), minSpan: 20 },
  { key: "elevationM", title: "Elevation", unit: "m", format: (v) => String(Math.round(v)), minSpan: 20, area: true },
  { key: "cadenceSpm", title: "Cadence", unit: "spm", format: (v) => String(Math.round(v)), minSpan: 12 },
];

/** Domain clipped to the 3rd–97th percentile so a pause doesn't flatten the chart. */
function robustDomain(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
  return [q(0.03), q(0.97)] as const;
}

/**
 * Pace, heart rate, elevation and cadence as small multiples over distance.
 * One cursor drives all four, with a single readout of every value at that point.
 */
export function SampleCharts({ samples }: { samples: ActivitySample[] }) {
  const [ref, { width }] = useMeasure();
  const [hover, setHover] = useState<number | null>(null);

  const series = SERIES.filter((s) => samples.some((x) => x[s.key] !== null));
  if (!samples.length || !series.length) {
    return <p className="rounded-2xl bg-muted p-6 text-sm text-muted-foreground">This run has no recorded streams.</p>;
  }

  const maxKm = samples[samples.length - 1].km;
  const x = linear(0, maxKm, M.left, Math.max(M.left + 1, width - M.right));
  const kmTicks = niceTicks(0, maxKm, Math.max(3, Math.floor((width - M.left) / 90))).ticks.filter((t) => t <= maxKm);

  const nearest = (px: number) => {
    const km = ((px - M.left) / Math.max(1, width - M.left - M.right)) * maxKm;
    let best = 0;
    for (let i = 1; i < samples.length; i++) if (Math.abs(samples[i].km - km) < Math.abs(samples[best].km - km)) best = i;
    return best;
  };

  const h = hover !== null ? samples[hover] : null;
  const tableRows = samples.filter((_, i) => i % Math.max(1, Math.round(samples.length / (maxKm * 2))) === 0);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* One readout for every series at the cursor. */}
      <div className="flex min-h-11 flex-wrap items-baseline gap-x-6 gap-y-1 rounded-xl bg-muted px-4 py-2 text-sm" aria-live="polite">
        {h ? (
          <>
            <span className="text-muted-foreground tabular-nums">{h.km.toFixed(2)} km</span>
            {series.map((s) => (
              <span key={s.key} className="flex items-baseline gap-1.5">
                <span className="font-semibold tabular-nums">
                  {h[s.key] === null ? "–" : s.format(h[s.key]!)}
                  {s.unit.startsWith("/") && <span className="font-normal text-muted-foreground">{s.unit}</span>}
                </span>
                <span className="text-muted-foreground">
                  {s.unit.startsWith("/") ? "" : `${s.unit} `}
                  {s.title.toLowerCase()}
                </span>
              </span>
            ))}
          </>
        ) : (
          <span className="text-muted-foreground">Hover or use the arrow keys to read values along the run.</span>
        )}
      </div>

      <div
        ref={ref}
        role="group"
        aria-label="Pace, heart rate, elevation and cadence over distance"
        tabIndex={0}
        className="touch-pan-y outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        onPointerMove={(e) => setHover(nearest(e.clientX - e.currentTarget.getBoundingClientRect().left))}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover(0)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          const jump = Math.max(1, Math.round(samples.length / 50));
          setHover((i) => Math.max(0, Math.min(samples.length - 1, (i ?? 0) + step * jump)));
        }}
      >
        {width > 0 &&
          series.map((s, si) => {
            const vals = samples.map((p) => p[s.key]).filter((v): v is number => v !== null);
            const [rlo, rhi] = robustDomain(vals);
            const grow = Math.max(0, s.minSpan - (rhi - rlo)) / 2;
            const [lo, hi] = [rlo - grow, rhi + grow];
            const pad = (hi - lo) * 0.1 || 1;
            // Never pad a non-negative measure below zero.
            const floor = Math.min(...vals) >= 0 ? Math.max(0, lo - pad) : lo - pad;
            const t = s.time ? timeTicks(floor, hi + pad, 3) : niceTicks(floor, hi + pad, 3);
            const last = si === series.length - 1;
            const top = 24; // room for the chart's title
            const height = top + H + (last ? AXIS : 0);
            // Pace is inverted: faster (fewer seconds) sits higher.
            const y = s.invert ? linear(t.min, t.max, top, top + H - 8) : linear(t.min, t.max, top + H - 8, top);
            const clamp = (v: number) => Math.max(t.min, Math.min(t.max, v));
            const pts = samples.map((p) => (p[s.key] === null ? null : { x: x(p.km), y: y(clamp(p[s.key]!)) }));
            const line = linePath(pts);
            const firstX = pts.find(Boolean)?.x ?? M.left;
            const lastX = [...pts].reverse().find(Boolean)?.x ?? M.left;
            const baseY = y(s.invert ? t.max : t.min);

            return (
              <svg key={s.key} width={width} height={height} className="block overflow-visible" aria-hidden>
                <text x={M.left} y={13} className="fill-foreground text-[12px] font-semibold">
                  {s.title}
                  <tspan className="fill-muted-foreground font-normal"> {s.unit}</tspan>
                </text>
                {t.ticks.map((tick) => (
                  <g key={tick}>
                    <line x1={M.left} x2={width - M.right} y1={y(tick)} y2={y(tick)} stroke="var(--grid)" />
                    <text x={M.left - 8} y={y(tick) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                      {s.format(tick)}
                    </text>
                  </g>
                ))}
                {s.area && <path d={`${line}L${lastX},${baseY}L${firstX},${baseY}Z`} fill="var(--series)" opacity={0.1} />}
                <path d={line} fill="none" stroke="var(--series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {hover !== null && (
                  <>
                    <line x1={x(samples[hover].km)} x2={x(samples[hover].km)} y1={top} y2={top + H - 8} stroke="var(--muted-foreground)" opacity={0.5} />
                    {pts[hover] && <circle cx={pts[hover]!.x} cy={pts[hover]!.y} r={4} fill="var(--series)" stroke="var(--background)" strokeWidth={2} />}
                  </>
                )}
                {last &&
                  kmTicks.map((k) => (
                    <text key={k} x={x(k)} y={top + H + 10} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">
                      {k} km
                    </text>
                  ))}
              </svg>
            );
          })}
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
                <th className="px-3 py-2 font-medium">Distance</th>
                {series.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right font-medium">
                    {s.title} ({s.unit})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.km} className="border-t border-border">
                  <td className="px-3 py-1.5 text-muted-foreground">{r.km.toFixed(2)} km</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right">
                      {r[s.key] === null ? "–" : s.format(r[s.key]!)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
