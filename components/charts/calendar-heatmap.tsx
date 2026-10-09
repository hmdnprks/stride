"use client";

import { useEffect, useRef, useState } from "react";
import useMeasure from "react-use-measure";
import type { CalendarDay } from "@/lib/garmin/types";
import { shortDay } from "./scale";

// Sequential, one hue: the validated 4-step blue ramp (shared with sleep stages).
const LEVELS = [
  { max: 0, color: "var(--muted)", label: "Rest" },
  { max: 5, color: "var(--stage-awake)", label: "Up to 5 km" },
  { max: 10, color: "var(--stage-rem)", label: "5–10 km" },
  { max: 16, color: "var(--stage-light)", label: "10–16 km" },
  { max: Infinity, color: "var(--stage-deep)", label: "16 km or more" },
];
const level = (km: number) => LEVELS.findIndex((l) => km <= l.max);

const GAP = 2;
const MIN_CELL = 11;
const MAX_CELL = 18;
const LEFT = 0; // day labels live outside the scroller, pinned
const LABEL_W = 30;
// Padding inside the scroll box so the focus outline isn't clipped.
const SCROLL_PAD = 4;
const TOP = 18;
const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function longestStreak(days: CalendarDay[]) {
  let best = 0;
  let cur = 0;
  for (const d of days) {
    cur = d.runs ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

/** Last 52 weeks of running, one cell per day, darker for longer runs. */
export function CalendarHeatmap({ days }: { days: CalendarDay[] }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  // Measure the scroll box itself, so the grid fits exactly when there's room.
  const [measure, { width: available }] = useMeasure();
  const [hover, setHover] = useState<number | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Open on the most recent weeks; older ones scroll in from the left.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [available]);

  // Keyboard navigation: keep the selected day inside the visible weeks.
  useEffect(() => {
    const el = scroller.current;
    if (!el || hover === null || !available) return;
    const weeksShown = Math.ceil(days.length / 7);
    const cell = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor((available - SCROLL_PAD * 2 - 1) / weeksShown) - GAP));
    const x = Math.floor(hover / 7) * (cell + GAP);
    if (x < el.scrollLeft) el.scrollLeft = x;
    else if (x + cell > el.scrollLeft + el.clientWidth - SCROLL_PAD * 2) el.scrollLeft = x + cell - el.clientWidth + SCROLL_PAD * 2;
  }, [hover, available, days.length]);

  if (!days.length) {
    return <p className="rounded-2xl bg-muted p-6 text-sm text-muted-foreground">No runs in the last 12 months.</p>;
  }

  const weeks = Math.ceil(days.length / 7);
  // Fill the available width; below the minimum cell size, scroll instead.
  const inner = available - SCROLL_PAD * 2 - 1;
  const CELL = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(inner / weeks) - GAP));
  const width = LEFT + weeks * (CELL + GAP);
  const height = TOP + 7 * (CELL + GAP);
  const pos = (i: number) => ({ x: LEFT + Math.floor(i / 7) * (CELL + GAP), y: TOP + (i % 7) * (CELL + GAP) });

  const totalKm = days.reduce((a, d) => a + d.km, 0);
  const totalRuns = days.reduce((a, d) => a + d.runs, 0);

  // Month labels at the first week that starts in a new month.
  const monthLabels: { x: number; label: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    const d = days[w * 7];
    if (!d) continue;
    const m = Number(d.date.slice(5, 7)) - 1;
    const prev = w ? Number(days[(w - 1) * 7].date.slice(5, 7)) - 1 : -1;
    const x = LEFT + w * (CELL + GAP);
    // Skip a label that would run off the end or into the previous one.
    if (m !== prev && x + 24 <= width && (!monthLabels.length || x - monthLabels[monthLabels.length - 1].x >= 28))
      monthLabels.push({ x, label: MONTHS[m] });
  }

  const h = hover !== null ? days[hover] : null;
  const weekly = Array.from({ length: weeks }, (_, w) => {
    const wk = days.slice(w * 7, w * 7 + 7);
    return { start: wk[0].date, km: Math.round(wk.reduce((a, d) => a + d.km, 0) * 10) / 10, runs: wk.reduce((a, d) => a + d.runs, 0) };
  });

  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <figcaption className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">Training calendar</h3>
        <p className="text-sm text-muted-foreground">
          {Math.round(totalKm).toLocaleString("en-GB")} km across {totalRuns} runs in the last 12 months. Longest streak:{" "}
          {longestStreak(days)} days in a row.
        </p>
      </figcaption>

      {/* The tooltip lives out here: a horizontal scroll box clips vertically too. */}
      <div className="relative flex">
        {/* Weekday labels stay put while the weeks scroll. */}
        <svg width={LABEL_W} height={height + SCROLL_PAD} aria-hidden className="shrink-0">
          {DAY_LABELS.map((d, i) =>
            d ? (
              <text key={d} x={0} y={SCROLL_PAD + TOP + i * (CELL + GAP) + CELL - 2} className="fill-muted-foreground text-[11px]">
                {d}
              </text>
            ) : null,
          )}
        </svg>
        <div
          ref={(el) => {
            scroller.current = el;
            measure(el);
          }}
          onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
          className="min-w-0 flex-1 overflow-x-auto"
          style={{ padding: SCROLL_PAD }}
        >
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Training calendar, one square per day. Use the arrow keys to move between days."
            tabIndex={0}
            className="block outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(days.length - 1)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[e.key];
              if (step === undefined) return;
              e.preventDefault();
              setHover((i) => Math.max(0, Math.min(days.length - 1, (i ?? days.length - 1) + step)));
            }}
          >
            {monthLabels.map((m) => (
              <text key={m.x} x={m.x} y={11} className="fill-muted-foreground text-[11px]">
                {m.label}
              </text>
            ))}
            {days.map((d, i) => {
              const { x, y } = pos(i);
              return (
                <rect
                  key={d.date}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  rx={3}
                  fill={LEVELS[level(d.km)].color}
                  stroke={hover === i ? "var(--foreground)" : "none"}
                  strokeWidth={1.5}
                  onPointerEnter={() => setHover(i)}
                />
              );
            })}
          </svg>
        </div>

        {h && hover !== null && (() => {
          // Centre above the cell, in the wrapper's coordinates.
          const cx = LABEL_W + SCROLL_PAD + pos(hover).x - scrollLeft + CELL / 2;
          const full = LABEL_W + available;
          const align = cx < 70 ? "0%" : cx > full - 70 ? "-100%" : "-50%";
          return (
            <div
              className="pointer-events-none absolute z-10 rounded-xl border border-border bg-popover px-3 py-2 text-xs whitespace-nowrap shadow-[0_8px_24px_-12px_rgb(10_27_92/0.4)]"
              style={{
                left: cx,
                top: SCROLL_PAD + pos(hover).y - 6,
                transform: `translate(${align}, -100%)`,
              }}
            >
              <p className="text-muted-foreground">
                {WEEKDAYS[hover % 7]} {shortDay(h.date)}
              </p>
              <p className="font-semibold tabular-nums">
                {h.runs ? `${h.km} km, ${h.runs} ${h.runs === 1 ? "run" : "runs"}` : "Rest day"}
              </p>
            </div>
          );
        })()}
      </div>

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {LEVELS.map((l) => (
          <li key={l.label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: l.color }} />
            {l.label}
          </li>
        ))}
      </ul>

      <details className="group text-sm">
        <summary className="w-fit cursor-pointer text-muted-foreground select-none hover:text-foreground">
          <span className="group-open:hidden">Show weekly totals as table</span>
          <span className="hidden group-open:inline">Hide table</span>
        </summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="sticky top-0 bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Week of</th>
                <th className="px-3 py-2 text-right font-medium">Distance</th>
                <th className="px-3 py-2 text-right font-medium">Runs</th>
              </tr>
            </thead>
            <tbody>
              {[...weekly].reverse().map((w) => (
                <tr key={w.start} className="border-t border-border">
                  <td className="px-3 py-1.5 text-muted-foreground">{shortDay(w.start)}</td>
                  <td className="px-3 py-1.5 text-right">{w.km} km</td>
                  <td className="px-3 py-1.5 text-right">{w.runs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
