import type { DailyRaw, PersonalRecord, Run } from "./garmin/types";
import { addDays, eachDay, isoDate } from "./trends";

// A year of running, read like a race result: months are the splits, then
// the standout runs, the records set, and how the body changed.

export interface MonthSplit {
  /** YYYY-MM */
  month: string;
  km: number;
  runs: number;
  durationSec: number;
  paceSecPerKm: number | null;
  avgHr: number | null;
}

export interface BodyChange {
  key: "vo2" | "restingHr" | "hrv" | "sleepScore";
  label: string;
  unit: string;
  digits: number;
  /** Which direction is an improvement. */
  better: "up" | "down";
  /** Average of the first and last month with readings. */
  from: number | null;
  to: number | null;
  fromMonth: string | null;
  toMonth: string | null;
  monthly: (number | null)[];
}

export interface YearReview {
  year: number;
  /** First and last day covered (clamped to stored history and today). */
  from: string;
  to: string;
  /** Share of the year that has passed, 0–1 (1 for past years). */
  elapsed: number;
  totals: { km: number; runs: number; durationSec: number; climbM: number };
  months: MonthSplit[];
  longest: Run | null;
  /** Fastest average pace over 5 km or more. */
  fastest: Run | null;
  biggestWeek: { start: string; km: number; runs: number } | null;
  weeksActive: number;
  weeksTotal: number;
  records: PersonalRecord[];
  body: BodyChange[];
}

const dateOf = (r: Run) => r.startLocal.slice(0, 10);
const round = (x: number, digits = 0) => Math.round(x * 10 ** digits) / 10 ** digits;

function mondayOf(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return addDays(date, -((d.getDay() + 6) % 7));
}

const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

const BODY: Omit<BodyChange, "from" | "to" | "fromMonth" | "toMonth" | "monthly">[] = [
  { key: "vo2", label: "VO2 max", unit: "", digits: 1, better: "up" },
  { key: "restingHr", label: "Resting heart rate", unit: "bpm", digits: 0, better: "down" },
  { key: "hrv", label: "Overnight HRV", unit: "ms", digits: 0, better: "up" },
  { key: "sleepScore", label: "Sleep score", unit: "", digits: 0, better: "up" },
];

/**
 * Build the review for `year` from daily readings and runs. `from` is where
 * Stride's history begins (it may start partway through the year).
 */
export function buildReview(
  year: number,
  daily: DailyRaw[],
  runs: Run[],
  records: PersonalRecord[],
  { from: coverFrom, today = isoDate(new Date()) }: { from?: string; today?: string } = {},
): YearReview {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const from = coverFrom && coverFrom > yearStart ? coverFrom : yearStart;
  const to = today < yearEnd ? today : yearEnd;

  const inYear = runs.filter((r) => dateOf(r) >= from && dateOf(r) <= to).sort((a, b) => a.startLocal.localeCompare(b.startLocal));
  const days = daily.filter((d) => d.date >= from && d.date <= to);

  const lastMonth = Number(to.slice(5, 7));
  const monthKeys = Array.from({ length: lastMonth }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

  const months: MonthSplit[] = monthKeys.map((month) => {
    const rs = inYear.filter((r) => dateOf(r).startsWith(month));
    const distanceM = rs.reduce((a, r) => a + r.distanceM, 0);
    const durationSec = rs.reduce((a, r) => a + r.durationSec, 0);
    const withHr = rs.filter((r) => r.avgHr !== null);
    const hrTime = withHr.reduce((a, r) => a + r.durationSec, 0);
    return {
      month,
      km: round(distanceM / 1000, 1),
      runs: rs.length,
      durationSec,
      paceSecPerKm: distanceM ? durationSec / (distanceM / 1000) : null,
      // Weighted by time, so a long run counts for more than a short one.
      avgHr: hrTime ? Math.round(withHr.reduce((a, r) => a + r.avgHr! * r.durationSec, 0) / hrTime) : null,
    };
  });

  // Weeks run Monday to Sunday; ones that straddle New Year count only their days in this year.
  const weeks = new Map<string, { km: number; runs: number }>();
  for (const date of eachDay(from, to)) {
    const w = mondayOf(date);
    if (!weeks.has(w)) weeks.set(w, { km: 0, runs: 0 });
  }
  for (const r of inYear) {
    const w = weeks.get(mondayOf(dateOf(r)))!;
    w.km += r.distanceM / 1000;
    w.runs += 1;
  }
  let biggestWeek: YearReview["biggestWeek"] = null;
  for (const [start, w] of weeks) {
    if (w.km > 0 && (!biggestWeek || w.km > biggestWeek.km)) biggestWeek = { start, km: round(w.km, 1), runs: w.runs };
  }

  const longest = inYear.reduce<Run | null>((best, r) => (!best || r.distanceM > best.distanceM ? r : best), null);
  const paceOf = (r: Run) => r.durationSec / (r.distanceM / 1000);
  const fastest = inYear
    .filter((r) => r.distanceM >= 5000)
    .reduce<Run | null>((best, r) => (!best || paceOf(r) < paceOf(best) ? r : best), null);

  const body: BodyChange[] = BODY.map((b) => {
    const monthly = monthKeys.map((m) => {
      const v = mean(days.filter((d) => d.date.startsWith(m)).map((d) => d[b.key]));
      return v === null ? null : round(v, b.digits);
    });
    const first = monthly.findIndex((v) => v !== null);
    const last = monthly.findLastIndex((v) => v !== null);
    return {
      ...b,
      monthly,
      from: first >= 0 ? monthly[first] : null,
      to: last >= 0 ? monthly[last] : null,
      fromMonth: first >= 0 ? monthKeys[first] : null,
      toMonth: last >= 0 ? monthKeys[last] : null,
    };
  });

  const dayOfYear = (date: string) => (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${yearStart}T12:00:00Z`)) / 86_400_000 + 1;
  const elapsed = to === yearEnd ? 1 : dayOfYear(to) / dayOfYear(yearEnd);

  return {
    year,
    from,
    to,
    elapsed,
    totals: {
      km: round(inYear.reduce((a, r) => a + r.distanceM, 0) / 1000, 1),
      runs: inYear.length,
      durationSec: inYear.reduce((a, r) => a + r.durationSec, 0),
      climbM: Math.round(inYear.reduce((a, r) => a + (r.elevationGainM ?? 0), 0)),
    },
    months,
    longest,
    fastest,
    biggestWeek,
    weeksActive: [...weeks.values()].filter((w) => w.runs > 0).length,
    weeksTotal: weeks.size,
    records: records.filter((r) => r.date?.startsWith(String(year))),
    body,
  };
}

/** Years from the start of stored history to this one, newest first. */
export function reviewYears(historyFrom: string | null, today = isoDate(new Date())) {
  const last = Number(today.slice(0, 4));
  const first = historyFrom ? Number(historyFrom.slice(0, 4)) : last;
  return Array.from({ length: last - first + 1 }, (_, i) => last - i);
}
