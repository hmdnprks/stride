import type { CalendarDay, DailyRaw, HrZoneSettings, RacePredictions, RaceGoal, Run, StrideSettings } from "./garmin/types";
import { addDays, isoDate } from "./trends";

// Plain-language insights computed from data the dashboard already has.
// Everything here is pure so live and demo data go through the same logic.

const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const dateOf = (r: Run) => r.startLocal.slice(0, 10);
const clock = (sec: number) => {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000);

/* ---------- Weekly summary ---------- */

export interface WeekStats {
  km: number;
  runs: number;
  paceSecPerKm: number | null;
  sleepScore: number | null;
  restingHr: number | null;
  hrv: number | null;
  load: number;
}

function weekStats(daily: DailyRaw[], runs: Run[], from: string, to: string): WeekStats {
  const days = daily.filter((d) => d.date >= from && d.date <= to);
  const rs = runs.filter((r) => dateOf(r) >= from && dateOf(r) <= to);
  const m = rs.reduce((a, r) => a + r.distanceM, 0);
  const sec = rs.reduce((a, r) => a + r.durationSec, 0);
  return {
    km: Math.round(m / 100) / 10,
    runs: rs.length,
    paceSecPerKm: m ? sec / (m / 1000) : null,
    sleepScore: avg(days.map((d) => d.sleepScore)),
    restingHr: avg(days.map((d) => d.restingHr)),
    hrv: avg(days.map((d) => d.hrv)),
    load: rs.reduce((a, r) => a + (r.load ?? 0), 0),
  };
}

/** Last 7 days against the 7 before, as a handful of plain sentences. */
export function weeklySummary(daily: DailyRaw[], runs: Run[], today = isoDate(new Date())) {
  const current = weekStats(daily, runs, addDays(today, -6), today);
  const previous = weekStats(daily, runs, addDays(today, -13), addDays(today, -7));
  const sentences: string[] = [];

  // Distance always leads.
  const dKm = Math.round((current.km - previous.km) * 10) / 10;
  if (!current.runs) sentences.push("No runs in the last 7 days.");
  else
    sentences.push(
      `You ran ${current.km} km over ${current.runs} ${current.runs === 1 ? "run" : "runs"}, ${
        Math.abs(dKm) < 2 ? "about the same as the week before" : `${Math.abs(dKm)} km ${dKm > 0 ? "more" : "less"} than the week before`
      }.`,
    );

  if (current.paceSecPerKm && previous.paceSecPerKm) {
    const d = Math.round(current.paceSecPerKm - previous.paceSecPerKm);
    if (Math.abs(d) >= 5)
      sentences.push(`Average pace was ${Math.abs(d)} s/km ${d < 0 ? "faster" : "slower"}, at ${clock(current.paceSecPerKm)} per km.`);
  }
  if (current.sleepScore !== null && previous.sleepScore !== null) {
    const d = Math.round(current.sleepScore - previous.sleepScore);
    if (Math.abs(d) >= 3)
      sentences.push(`Sleep scores averaged ${Math.round(current.sleepScore)}, ${d > 0 ? "up" : "down"} from ${Math.round(previous.sleepScore)}.`);
  }
  if (current.hrv !== null && previous.hrv !== null) {
    const d = Math.round(current.hrv - previous.hrv);
    if (Math.abs(d) >= 4)
      sentences.push(
        `Overnight HRV averaged ${Math.round(current.hrv)} ms, ${d > 0 ? `up ${d} ms, a sign you're absorbing training well` : `down ${-d} ms, so recovery may be lagging`}.`,
      );
  }
  if (current.restingHr !== null && previous.restingHr !== null) {
    const d = Math.round(current.restingHr - previous.restingHr);
    if (Math.abs(d) >= 2) sentences.push(`Resting heart rate is ${d > 0 ? "up" : "down"} ${Math.abs(d)} bpm, at ${Math.round(current.restingHr)}.`);
  }
  if (previous.load > 0) {
    const pct = Math.round(((current.load - previous.load) / previous.load) * 100);
    if (Math.abs(pct) >= 20)
      sentences.push(`Training load ${pct > 0 ? `rose ${pct}%; give recovery some room` : `fell ${-pct}%, an easier week`}.`);
  }
  return { current, previous, sentences };
}

/* ---------- Sleep and performance ---------- */

export interface SleepRunPoint {
  id: string;
  date: string;
  name: string;
  sleepScore: number;
  /** Metres covered per heartbeat: higher means more efficient running. */
  metresPerBeat: number;
  paceSecPerKm: number;
  avgHr: number;
}

function pearson(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

const MIN_RUNS = 8;
const GOOD_SLEEP = 80;
const POOR_SLEEP = 70;

/**
 * Easy runs paired with the sleep score from the night before. Garmin dates a
 * night's sleep by the morning you wake, so it shares the run's date.
 */
export function sleepPerformance(daily: DailyRaw[], runs: Run[], zones: HrZoneSettings | null) {
  const sleepOn = new Map(daily.map((d) => [d.date, d.sleepScore]));
  const withHr = runs.filter((r) => r.avgHr && r.distanceM > 2000 && r.durationSec > 0);
  // "Easy": inside zone 2 or below; without zones, the lower half by heart rate.
  const hrs = withHr.map((r) => r.avgHr!).sort((a, b) => a - b);
  const easyCap = zones ? zones.floors[2] - 1 : hrs[Math.floor(hrs.length / 2)] ?? 0;

  const points: SleepRunPoint[] = withHr
    .filter((r) => r.avgHr! <= easyCap && typeof sleepOn.get(dateOf(r)) === "number")
    .map((r) => ({
      id: r.id,
      date: dateOf(r),
      name: r.name,
      sleepScore: sleepOn.get(dateOf(r)) as number,
      metresPerBeat: Math.round((r.distanceM / (r.durationSec / 60) / r.avgHr!) * 100) / 100,
      paceSecPerKm: Math.round(r.durationSec / (r.distanceM / 1000)),
      avgHr: r.avgHr!,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const r = pearson(
    points.map((p) => p.sleepScore),
    points.map((p) => p.metresPerBeat),
  );
  const good = points.filter((p) => p.sleepScore >= GOOD_SLEEP);
  const poor = points.filter((p) => p.sleepScore < POOR_SLEEP);
  const goodAvg = avg(good.map((p) => p.metresPerBeat));
  const poorAvg = avg(poor.map((p) => p.metresPerBeat));

  let verdict: string;
  if (points.length < MIN_RUNS || r === null) {
    verdict = `Not enough easy runs with sleep data yet (${points.length} of ${MIN_RUNS} needed). Check back after a few more weeks.`;
  } else {
    const strength = Math.abs(r) < 0.1 ? "no clear" : Math.abs(r) < 0.3 ? "a weak" : Math.abs(r) < 0.5 ? "a moderate" : "a strong";
    const direction = r > 0 ? "better sleep goes with more efficient running" : "better sleep goes with less efficient running";
    const compare =
      good.length >= 3 && poor.length >= 3 && goodAvg && poorAvg
        ? ` After nights scoring ${GOOD_SLEEP} or more, your easy runs covered ${Math.abs(Math.round(((goodAvg - poorAvg) / poorAvg) * 100))}% ${
            goodAvg >= poorAvg ? "more" : "less"
          } distance per heartbeat than after nights under ${POOR_SLEEP} (${good.length} runs against ${poor.length}).`
        : "";
    verdict =
      strength === "no clear"
        ? `No clear link so far between sleep score and easy-run efficiency (r = ${r.toFixed(2)}).${compare}`
        : `There's ${strength} link: ${direction} (r = ${r.toFixed(2)}).${compare} It's a correlation, not proof; heat, terrain and fatigue matter too.`;
  }

  return { points, r, verdict, easyCap };
}

/* ---------- Recovery check ---------- */

export interface RecoverySignal {
  key: "hrv" | "battery" | "load" | "restingHr";
  label: string;
  flagged: boolean;
  detail: string;
}

/** Today's readings against your own baselines. Two or more flags is a warning. */
export function recoveryCheck(daily: DailyRaw[], runs: Run[], bodyBattery: number | null, today = isoDate(new Date())) {
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const t = byDate.get(today);
  const signals: RecoverySignal[] = [];

  if (t?.hrv != null) {
    const low = t.hrvLow;
    const flagged = low != null && t.hrv < low;
    signals.push({
      key: "hrv",
      label: "Overnight HRV",
      flagged,
      detail:
        low != null && t.hrvHigh != null
          ? `${t.hrv} ms, ${flagged ? "below" : "within or above"} your normal ${low}–${t.hrvHigh} ms`
          : `${t.hrv} ms`,
    });
  }

  if (bodyBattery != null) {
    const flagged = bodyBattery < 30 || (t?.bbHigh != null && t.bbHigh < 50);
    signals.push({
      key: "battery",
      label: "Body Battery",
      flagged,
      detail: t?.bbHigh != null ? `${bodyBattery} now, peaked at ${t.bbHigh} this morning` : `${bodyBattery} now`,
    });
  }

  const loadIn = (from: string, to: string) =>
    runs.filter((r) => dateOf(r) >= from && dateOf(r) <= to).reduce((a, r) => a + (r.load ?? 0), 0);
  const acute = loadIn(addDays(today, -6), today);
  const chronic = loadIn(addDays(today, -27), today) / 4;
  if (chronic > 0) {
    const ratio = acute / chronic;
    signals.push({
      key: "load",
      label: "Training load",
      flagged: ratio > 1.3,
      detail: `last 7 days at ${ratio.toFixed(1)}× your 4-week average${ratio > 1.3 ? ", a sharp jump" : ""}`,
    });
  }

  if (t?.restingHr != null) {
    const base = avg(Array.from({ length: 7 }, (_, i) => byDate.get(addDays(today, -1 - i))?.restingHr));
    if (base !== null) {
      const d = Math.round(t.restingHr - base);
      signals.push({
        key: "restingHr",
        label: "Resting heart rate",
        flagged: d >= 5,
        detail: `${t.restingHr} bpm, ${d === 0 ? "level with" : `${Math.abs(d)} ${d > 0 ? "above" : "below"}`} your 7-day average`,
      });
    }
  }

  const flags = signals.filter((s) => s.flagged).length;
  const level: "ok" | "caution" | "rest" = flags >= 3 ? "rest" : flags === 2 ? "caution" : "ok";
  const headline =
    level === "rest"
      ? "Your body is asking for rest. Take a rest day or a very easy 20–30 minutes."
      : level === "caution"
        ? "Recovery looks stretched. Keep today easy and skip the hard session."
        : "Recovery signals look fine.";
  return { level, flags, signals, headline };
}

/* ---------- Distance goals ---------- */

export interface GoalProgress {
  period: "month" | "year";
  label: string;
  goalKm: number | null;
  km: number;
  projectedKm: number;
  daysLeft: number;
  /** km a week needed from here to reach the goal. */
  perWeekNeeded: number | null;
  done: boolean;
}

export function goalProgress(calendar: CalendarDay[], settings: StrideSettings, today = isoDate(new Date())): GoalProgress[] {
  const [y, m] = today.split("-").map(Number);
  const periods = [
    { period: "month" as const, label: new Date(y, m - 1, 1).toLocaleString("en-GB", { month: "long" }), start: `${today.slice(0, 7)}-01`, end: isoDate(new Date(y, m, 0)), goalKm: settings.monthKm },
    { period: "year" as const, label: String(y), start: `${y}-01-01`, end: `${y}-12-31`, goalKm: settings.yearKm },
  ];
  return periods.map((p) => {
    const km = Math.round(calendar.filter((d) => d.date >= p.start && d.date <= today).reduce((a, d) => a + d.km, 0) * 10) / 10;
    const elapsed = daysBetween(p.start, today) + 1;
    const total = daysBetween(p.start, p.end) + 1;
    const daysLeft = total - elapsed;
    const projectedKm = Math.round((km / elapsed) * total);
    const remaining = p.goalKm !== null ? Math.max(0, p.goalKm - km) : null;
    return {
      period: p.period,
      label: p.label,
      goalKm: p.goalKm,
      km,
      projectedKm,
      daysLeft,
      perWeekNeeded: remaining !== null && daysLeft > 0 ? Math.round((remaining / daysLeft) * 7 * 10) / 10 : null,
      done: p.goalKm !== null && km >= p.goalKm,
    };
  });
}

/* ---------- Race plan ---------- */

export type RacePhase = "build" | "taper" | "race-week" | "race-day" | "done";

const STANDARD = [
  { km: 5, key: "fiveK" },
  { km: 10, key: "tenK" },
  { km: 21.0975, key: "half" },
  { km: 42.195, key: "marathon" },
] as const;

/** Taper length grows with race distance. */
export const taperDaysFor = (km: number) => (km >= 40 ? 21 : km >= 20 ? 10 : 7);

export function racePlan(race: RaceGoal, recentWeeklyKm: number, predictions: RacePredictions | null, today = isoDate(new Date())) {
  const daysToGo = daysBetween(today, race.date);
  const taperDays = taperDaysFor(race.distanceKm);
  const taperStart = addDays(race.date, -taperDays);
  const phase: RacePhase =
    daysToGo < 0 ? "done" : daysToGo === 0 ? "race-day" : daysToGo <= 7 ? "race-week" : daysToGo <= taperDays ? "taper" : "build";

  const std = STANDARD.find((s) => Math.abs(s.km - race.distanceKm) / s.km < 0.02);
  const predictedSec = std && predictions ? predictions[std.key] : null;
  const taperKm = Math.round(recentWeeklyKm * (race.distanceKm >= 40 ? 0.6 : 0.7));
  const taperStartLabel = new Date(`${taperStart}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const advice: Record<RacePhase, string> = {
    build: `Your taper starts on ${taperStartLabel}. Until then, keep building gradually; you've averaged ${Math.round(recentWeeklyKm)} km a week over the last 4 weeks.`,
    taper: `You're in your taper. Aim for about ${taperKm} km a week, around ${race.distanceKm >= 40 ? "60" : "70"}% of your usual, and keep a few short, fast efforts so your legs stay sharp.`,
    "race-week": "Race week. Keep runs short and easy, add a few 20-second strides two or three days out, and protect your sleep.",
    "race-day": "Race day. Start a little slower than feels right; you can always speed up later.",
    done: "This race is behind you. Set your next one.",
  };

  return {
    daysToGo,
    phase,
    taperStart,
    taperDays,
    predicted: predictedSec ? clock(predictedSec) : null,
    advice: advice[phase],
  };
}
