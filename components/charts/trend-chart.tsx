"use client";

import { useState, type ReactNode } from "react";
import useMeasure from "react-use-measure";
import { barPath, bucketLabel, linear, linePath, niceTicks, shortDay } from "./scale";
import { useTrendsPending } from "./pending";

type Num = number | null;
/** Any record with a bucket start; layers read numeric fields by key. */
export type Row = { start: string };

export type Layer =
  | { kind: "line"; key: string; label: string; tone?: "series" | "context"; endLabel?: boolean }
  | { kind: "bars"; key: string; label: string }
  | { kind: "stack"; parts: { key: string; label: string; color: string }[] }
  | { kind: "range"; low: string; high: string; label: string }
  | { kind: "band"; low: string; high: string; label: string };

const TONE = { series: "var(--series)", context: "var(--context)" };

type Mark = "line" | "rect" | "wash";
type TipRow = { label: string; color: string; mark: Mark; value: string };
const M = { top: 12, bottom: 26, left: 40 };

const val = (row: Row, key: string): Num => {
  const v = (row as unknown as Record<string, unknown>)[key];
  return typeof v === "number" ? v : null;
};

/** Every distinct series a reader must be able to identify. */
function seriesOf(layers: Layer[]) {
  return layers.flatMap((l): { label: string; color: string; mark: "line" | "rect" | "wash" }[] => {
    switch (l.kind) {
      case "line":
        return [{ label: l.label, color: TONE[l.tone ?? "series"], mark: "line" }];
      case "bars":
      case "range":
        return [{ label: l.label, color: TONE.series, mark: "rect" }];
      case "band":
        return [{ label: l.label, color: TONE.series, mark: "wash" }];
      case "stack":
        return l.parts.map((p) => ({ label: p.label, color: p.color, mark: "rect" as const }));
    }
  });
}

function Swatch({ color, mark }: { color: string; mark: "line" | "rect" | "wash" }) {
  if (mark === "line") return <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: color }} />;
  return (
    <span
      className="inline-block size-2.5 rounded-[3px]"
      style={{ background: color, opacity: mark === "wash" ? 0.25 : 1 }}
    />
  );
}

export function TrendChart({
  title,
  summary,
  rows,
  bucket,
  layers,
  format,
  domain,
  height = 200,
}: {
  title: string;
  summary?: ReactNode;
  rows: Row[];
  bucket: "day" | "week";
  layers: Layer[];
  format: (v: number) => string;
  /** Fixed y-domain, e.g. [0, 100] for scores. */
  domain?: [number, number];
  height?: number;
}) {
  const [ref, { width }] = useMeasure();
  const [hover, setHover] = useState<number | null>(null);
  const pending = useTrendsPending();

  const series = seriesOf(layers);
  const hasEndLabel = layers.some((l) => l.kind === "line" && l.endLabel);
  const right = hasEndLabel ? 48 : 8;

  // Y domain from every value drawn; bar-like layers grow from zero.
  const values: number[] = [];
  let fromZero = false;
  for (const row of rows) {
    for (const l of layers) {
      if (l.kind === "line" || l.kind === "bars") values.push(val(row, l.key) ?? NaN);
      if (l.kind === "range" || l.kind === "band") values.push(val(row, l.low) ?? NaN, val(row, l.high) ?? NaN);
      if (l.kind === "stack") values.push(l.parts.reduce((a, p) => a + (val(row, p.key) ?? 0), 0));
      if (l.kind === "bars" || l.kind === "stack") fromZero = true;
    }
  }
  const finite = values.filter(Number.isFinite);
  const empty = finite.length === 0 || finite.every((v) => v === 0 && !fromZero);

  const lo = domain ? domain[0] : fromZero ? 0 : Math.min(...finite);
  const hi = domain ? domain[1] : Math.max(...finite);
  const pad = domain || fromZero ? 0 : (hi - lo) * 0.15 || 1;
  const { ticks, min, max } = domain ? { ticks: niceTicks(lo, hi, 5).ticks, min: lo, max: hi } : niceTicks(lo - pad, hi + pad);

  const plotW = Math.max(0, width - M.left - right);
  const n = rows.length;
  const step = n ? plotW / n : 0;
  const cx = (i: number) => M.left + step * (i + 0.5);
  const y = linear(min, max, M.top + height, M.top);
  // Thin bars with air between them; never more than 24px.
  const barW = Math.max(1, Math.min(24, step * 0.62, step - 2));

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 72))));
  const dim = (i: number) => (hover !== null && hover !== i ? 0.4 : 1);

  const pick = (clientX: number, rect: DOMRect) => {
    const i = Math.floor((clientX - rect.left - M.left) / (step || 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const tooltipRows = (row: Row) =>
    layers.flatMap((l): TipRow[] => {
      switch (l.kind) {
        case "line":
        case "bars": {
          const v = val(row, l.key);
          return [{ label: l.label, color: l.kind === "line" ? TONE[l.tone ?? "series"] : TONE.series, mark: l.kind === "line" ? "line" : "rect", value: v === null ? "–" : format(v) }];
        }
        case "range":
        case "band": {
          const a = val(row, l.low);
          const b = val(row, l.high);
          return [{ label: l.label, color: TONE.series, mark: l.kind === "band" ? "wash" : "rect", value: a === null || b === null ? "–" : `${format(a)}–${format(b)}` }];
        }
        case "stack":
          return [...l.parts]
            .reverse()
            .map((p): TipRow => ({ label: p.label, color: p.color, mark: "rect", value: val(row, p.key) === null ? "–" : format(val(row, p.key)!) }));
      }
    });

  const lastIndex = (key: string) => {
    for (let i = n - 1; i >= 0; i--) if (val(rows[i], key) !== null) return i;
    return -1;
  };

  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <figcaption className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
        {series.length > 1 && (
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {series.map((s) => (
              <li key={s.label} className="flex items-center gap-1.5">
                <Swatch color={s.color} mark={s.mark} />
                {s.label}
              </li>
            ))}
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
            No data for this range.
          </p>
        ) : (
          width > 0 && (
            <>
              <svg
                width={width}
                height={height + M.top + M.bottom}
                role="img"
                aria-label={`${title}. Use the arrow keys to step through values.`}
                tabIndex={0}
                className="touch-pan-y overflow-visible outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(n - 1)}
                onBlur={() => setHover(null)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
                  else if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
                  else if (e.key === "Escape") setHover(null);
                  else return;
                  e.preventDefault();
                }}
              >
                {/* Grid and y ticks */}
                {ticks.map((t) => (
                  <g key={t}>
                    <line x1={M.left} x2={width - right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
                    <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                      {format(t)}
                    </text>
                  </g>
                ))}

                {/* x labels */}
                {rows.map((r, i) =>
                  (n - 1 - i) % labelEvery === 0 ? (
                    <text key={r.start} x={cx(i)} y={M.top + height + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                      {shortDay(r.start)}
                    </text>
                  ) : null,
                )}

                {layers.map((l, li) => {
                  if (l.kind === "band") {
                    const top = rows.map((r, i) => (val(r, l.high) === null ? null : { x: cx(i), y: y(val(r, l.high)!) }));
                    const bottom = rows.map((r, i) => (val(r, l.low) === null ? null : { x: cx(i), y: y(val(r, l.low)!) }));
                    const segments: string[] = [];
                    let start = -1;
                    for (let i = 0; i <= n; i++) {
                      const ok = i < n && top[i] && bottom[i];
                      if (ok && start < 0) start = i;
                      if (!ok && start >= 0) {
                        const t = top.slice(start, i) as { x: number; y: number }[];
                        const b = (bottom.slice(start, i) as { x: number; y: number }[]).reverse();
                        segments.push(`M${t.map((p) => `${p.x},${p.y}`).join("L")}L${b.map((p) => `${p.x},${p.y}`).join("L")}Z`);
                        start = -1;
                      }
                    }
                    return <path key={li} d={segments.join("")} fill="var(--series)" opacity={0.1} />;
                  }
                  if (l.kind === "bars") {
                    return rows.map((r, i) => {
                      const v = val(r, l.key);
                      if (!v) return null;
                      return <path key={`${li}-${i}`} d={barPath(cx(i) - barW / 2, y(0), y(v), barW)} fill="var(--series)" opacity={dim(i)} />;
                    });
                  }
                  if (l.kind === "range") {
                    const w = Math.min(barW, 12);
                    return rows.map((r, i) => {
                      const a = val(r, l.low);
                      const b = val(r, l.high);
                      if (a === null || b === null) return null;
                      return <path key={`${li}-${i}`} d={barPath(cx(i) - w / 2, y(a), y(b), w, true)} fill="var(--series)" opacity={dim(i)} />;
                    });
                  }
                  if (l.kind === "stack") {
                    return rows.map((r, i) => {
                      let base = 0;
                      const parts = l.parts.filter((p) => (val(r, p.key) ?? 0) > 0);
                      return (
                        <g key={`${li}-${i}`} opacity={dim(i)}>
                          {parts.map((p, pi) => {
                            const v = val(r, p.key)!;
                            const y0 = y(base);
                            const y1 = y(base + v);
                            base += v;
                            const isTop = pi === parts.length - 1;
                            // 2px surface gap between segments.
                            const gapTop = isTop ? y1 : Math.min(y0 - 0.5, y1 + 2);
                            return isTop ? (
                              <path key={p.key} d={barPath(cx(i) - barW / 2, y0, gapTop, barW)} fill={p.color} />
                            ) : (
                              <rect key={p.key} x={cx(i) - barW / 2} y={gapTop} width={barW} height={Math.max(0, y0 - gapTop)} fill={p.color} />
                            );
                          })}
                        </g>
                      );
                    });
                  }
                  // line
                  const color = TONE[l.tone ?? "series"];
                  const pts = rows.map((r, i) => (val(r, l.key) === null ? null : { x: cx(i), y: y(val(r, l.key)!) }));
                  const last = lastIndex(l.key);
                  return (
                    <g key={li}>
                      <path d={linePath(pts)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                      {/* Lone points (no neighbours) still need a mark. */}
                      {pts.map((p, i) =>
                        p && !pts[i - 1] && !pts[i + 1] ? <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} /> : null,
                      )}
                      {l.endLabel && last >= 0 && (
                        <>
                          <circle cx={pts[last]!.x} cy={pts[last]!.y} r={4} fill={color} stroke="var(--background)" strokeWidth={2} />
                          <text x={pts[last]!.x + 9} y={pts[last]!.y + 4} className="fill-foreground text-[12px] font-semibold tabular-nums">
                            {format(val(rows[last], l.key)!)}
                          </text>
                        </>
                      )}
                      {hover !== null && pts[hover] && (
                        <circle cx={pts[hover]!.x} cy={pts[hover]!.y} r={4} fill={color} stroke="var(--background)" strokeWidth={2} />
                      )}
                    </g>
                  );
                })}

                {/* Crosshair for line charts */}
                {hover !== null && layers.some((l) => l.kind === "line" || l.kind === "band") && (
                  <line x1={cx(hover)} x2={cx(hover)} y1={M.top} y2={M.top + height} stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.5} />
                )}
              </svg>

              {hover !== null && rows[hover] && (
                <div
                  className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-[0_8px_24px_-12px_rgb(10_27_92/0.4)]"
                  style={
                    cx(hover) > width / 2
                      ? { right: width - cx(hover) + 12 }
                      : { left: cx(hover) + 12 }
                  }
                >
                  <p className="mb-1 text-muted-foreground">{bucketLabel(rows[hover].start, bucket)}</p>
                  <ul className="flex flex-col gap-0.5">
                    {tooltipRows(rows[hover]).map((t) => (
                      <li key={t.label} className="flex items-center gap-2">
                        <Swatch color={t.color} mark={t.mark} />
                        <span className="font-semibold text-foreground tabular-nums">{t.value}</span>
                        <span className="text-muted-foreground">{t.label}</span>
                      </li>
                    ))}
                  </ul>
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
                  <th className="px-3 py-2 font-medium">{bucket === "week" ? "Week of" : "Date"}</th>
                  {tooltipRows(rows[0]).map((t) => (
                    <th key={t.label} className="px-3 py-2 text-right font-medium">
                      {t.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.start} className="border-t border-border">
                    <td className="px-3 py-1.5 text-muted-foreground">{shortDay(r.start)}</td>
                    {tooltipRows(r).map((t) => (
                      <td key={t.label} className="px-3 py-1.5 text-right">
                        {t.value}
                      </td>
                    ))}
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
