import type { DailyRaw, Range, Run, RunPoint, TrendPoint, Trends } from "./garmin/types";

/** Days covered by each range, today included. */
export const RANGE_DAYS: Record<Range, number> = { "7d": 7, "4w": 28, "3m": 91, "1y": 364 };
export const RANGE_LABELS: Record<Range, string> = { "7d": "7 days", "4w": "4 weeks", "3m": "3 months", "1y": "1 year" };

/** Longer ranges are bucketed by week so marks stay legible. */
export const bucketFor = (range: Range) => (range === "7d" || range === "4w" ? "day" : "week");

/** Extra history needed before the range starts, so the 28-day load is warm. */
export const LOAD_WARMUP_DAYS = 27;

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function mondayOf(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return addDays(date, -((d.getDay() + 6) % 7));
}

/**
 * First and last day (inclusive) of a range ending today. Weekly ranges start
 * on a Monday so the first bar is a whole week.
 */
export function rangeWindow(range: Range, today = isoDate(new Date())) {
  const from = addDays(today, -(RANGE_DAYS[range] - 1));
  return { from: bucketFor(range) === "week" ? mondayOf(from) : from, to: today };
}

/** Every date from `from` to `to`, inclusive. */
export function eachDay(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const round = (x: number | null, digits = 0) => (x === null ? null : Math.round(x * 10 ** digits) / 10 ** digits);
const hours = (sec: number | null) => (sec === null ? null : sec / 3600);

/**
 * Turn per-day readings and runs into chart points for a range.
 * Runs may start up to LOAD_WARMUP_DAYS before the range for load history.
 */
export function buildTrends(range: Range, daily: DailyRaw[], runs: Run[], warnings: string[] = [], today?: string): Trends {
  const { from, to } = rangeWindow(range, today);
  const bucket = bucketFor(range);
  const byDate = new Map(daily.map((d) => [d.date, d]));

  // Daily running distance, count and load across range + warm-up.
  const runDay = new Map<string, { km: number; runs: number; load: number }>();
  for (const r of runs) {
    const date = r.startLocal.slice(0, 10);
    const cur = runDay.get(date) ?? { km: 0, runs: 0, load: 0 };
    cur.km += r.distanceM / 1000;
    cur.runs += 1;
    cur.load += r.load ?? 0;
    runDay.set(date, cur);
  }
  const loadOn = (date: string) => runDay.get(date)?.load ?? 0;
  const sumLoad = (end: string, days: number) => {
    let s = 0;
    for (let i = 0; i < days; i++) s += loadOn(addDays(end, -i));
    return s;
  };
  const hasLoads = runs.some((r) => r.load !== null);

  // Group the range's days into buckets.
  const groups = new Map<string, string[]>();
  for (const date of eachDay(from, to)) {
    const key = bucket === "day" ? date : mondayOf(date);
    groups.set(key, [...(groups.get(key) ?? []), date]);
  }

  const points: TrendPoint[] = [...groups].map(([start, dates]) => {
    const days = dates.map((d) => byDate.get(d)).filter((d): d is DailyRaw => !!d);
    const pick = (f: (d: DailyRaw) => number | null) => avg(days.map(f));
    const end = dates[dates.length - 1];
    return {
      start,
      bbHigh: round(pick((d) => d.bbHigh)),
      bbLow: round(pick((d) => d.bbLow)),
      sleepScore: round(pick((d) => d.sleepScore)),
      sleepH: round(pick((d) => hours(d.sleepSec)), 2),
      deepH: round(pick((d) => hours(d.deepSec)), 2),
      lightH: round(pick((d) => hours(d.lightSec)), 2),
      remH: round(pick((d) => hours(d.remSec)), 2),
      awakeH: round(pick((d) => hours(d.awakeSec)), 2),
      restingHr: round(pick((d) => d.restingHr)),
      hrv: round(pick((d) => d.hrv)),
      hrvLow: round(pick((d) => d.hrvLow)),
      hrvHigh: round(pick((d) => d.hrvHigh)),
      vo2: round(pick((d) => d.vo2), 1),
      distanceKm: round(dates.reduce((a, d) => a + (runDay.get(d)?.km ?? 0), 0), 1) ?? 0,
      runs: dates.reduce((a, d) => a + (runDay.get(d)?.runs ?? 0), 0),
      acuteLoad: hasLoads ? Math.round(sumLoad(end, 7)) : null,
      chronicLoad: hasLoads ? Math.round(sumLoad(end, 28) / 4) : null,
    };
  });

  const runPoints: RunPoint[] = runs
    .filter((r) => {
      const date = r.startLocal.slice(0, 10);
      return date >= from && date <= to && r.avgHr && r.distanceM > 1000;
    })
    .map((r) => ({
      id: r.id,
      date: r.startLocal.slice(0, 10),
      name: r.name,
      distanceKm: Math.round(r.distanceM / 100) / 10,
      paceSecPerKm: Math.round(r.durationSec / (r.distanceM / 1000)),
      avgHr: r.avgHr as number,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { range, bucket, points, runs: runPoints, warnings };
}

export function parseRange(value: unknown): Range {
  return typeof value === "string" && (["7d", "4w", "3m", "1y"] as string[]).includes(value) ? (value as Range) : "4w";
}
