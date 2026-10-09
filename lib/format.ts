import type { Run } from "./garmin/types";

export function km(meters: number, digits = 1) {
  return (meters / 1000).toFixed(digits);
}

/** 7h 42m */
export function hm(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** 21:45 or 1:38:20 */
export function clock(seconds: number) {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Seconds per km → 5:12 */
export function pace(secPerKm: number) {
  return clock(secPerKm);
}

export function paceOf(run: Pick<Run, "distanceM" | "durationSec">) {
  return run.distanceM ? run.durationSec / (run.distanceM / 1000) : 0;
}

export function parseLocal(stamp: string) {
  return new Date(stamp.replace(" ", "T"));
}

export function shortDate(stamp: string) {
  return parseLocal(stamp).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export interface Totals {
  distanceM: number;
  durationSec: number;
  count: number;
  avgPace: number;
}

function totals(runs: Run[]): Totals {
  const distanceM = runs.reduce((a, r) => a + r.distanceM, 0);
  const durationSec = runs.reduce((a, r) => a + r.durationSec, 0);
  return { distanceM, durationSec, count: runs.length, avgPace: distanceM ? durationSec / (distanceM / 1000) : 0 };
}

/** Totals for the current week (Mon–Sun) and the trailing 30 days. */
export function runningTotals(runs: Run[], now = new Date()) {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const monthRuns = runs.filter((r) => parseLocal(r.startLocal) >= monthAgo);

  return {
    week: totals(runs.filter((r) => parseLocal(r.startLocal) >= monday)),
    month: totals(monthRuns),
    longest: monthRuns.reduce<Run | null>((best, r) => (!best || r.distanceM > best.distanceM ? r : best), null),
  };
}
