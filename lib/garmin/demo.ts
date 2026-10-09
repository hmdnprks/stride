import type { ActivityDetail, ActivitySample, DailyRaw, Dashboard, InsightsData, Range, Run, RunningExtras, Split, Trends } from "./types";
import { addDays, buildCalendar, buildTrends, eachDay, isoDate, rangeWindow } from "../trends";

// Deterministic sample data so the dashboard looks real without a Garmin login.

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const RUN_TEMPLATES = [
  // `zones`: share of time in heart-rate zones 1–5.
  { name: "Easy Run", km: [6, 9], pace: [345, 375], hr: [138, 148], intensity: 1.2, zones: [0.15, 0.7, 0.13, 0.02, 0] },
  { name: "Tempo Run", km: [8, 11], pace: [285, 305], hr: [158, 168], intensity: 2.2, zones: [0.05, 0.2, 0.3, 0.4, 0.05] },
  { name: "Intervals 6×800m", km: [7, 9], pace: [300, 320], hr: [152, 162], intensity: 2.4, zones: [0.1, 0.3, 0.2, 0.25, 0.15] },
  { name: "Recovery Run", km: [4, 6], pace: [370, 395], hr: [128, 136], intensity: 0.9, zones: [0.55, 0.43, 0.02, 0, 0] },
  { name: "Long Run", km: [16, 24], pace: [330, 355], hr: [145, 152], intensity: 1.6, zones: [0.05, 0.55, 0.35, 0.05, 0] },
];

// Mon..Sun → template index, or null for a rest day.
const WEEK_PLAN = [0, 2, 3, 1, null, 4, 3];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function localStamp(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** Running dynamics and zones that follow pace: faster means quicker, longer steps. */
function demoDynamics(pace: number, durationSec: number, zones: number[]) {
  const cadenceSpm = Math.round(228 - pace * 0.16);
  const speed = 1000 / pace; // m/s
  return {
    hrZones: zones.map((z) => Math.round(z * durationSec)) as Run["hrZones"],
    cadenceSpm,
    strideCm: Math.round((speed / (cadenceSpm / 60)) * 100),
    groundContactMs: Math.round(150 + pace * 0.3),
    verticalRatioPct: Math.round((6 + pace * 0.006) * 10) / 10,
  };
}

function demoRuns(today: Date, rand: () => number): Run[] {
  const runs: Run[] = [];
  // A year plus load warm-up. Fitness improves towards today: older runs are
  // a little slower at a slightly higher heart rate.
  for (let back = 0; back < 400; back++) {
    const day = new Date(today);
    day.setDate(today.getDate() - back);
    const plan = WEEK_PLAN[(day.getDay() + 6) % 7];
    if (plan === null || rand() < 0.12) continue;

    const t = RUN_TEMPLATES[plan];
    const lerp = ([a, b]: number[]) => a + (b - a) * rand();
    const distanceM = Math.round(lerp(t.km) * 1000);
    const fitness = 1 + (back / 365) * 0.07;
    // A modest real effect for the sleep insight: good nights, slightly faster runs.
    const sleep = demoDay(isoDate(day), back).sleepScore ?? 78;
    const pace = lerp(t.pace) * fitness * (1 + (78 - sleep) / 800);
    day.setHours(5, 30 + Math.floor(rand() * 40), 0, 0);

    runs.push({
      id: `demo-${back}`,
      name: t.name,
      startLocal: localStamp(day),
      distanceM,
      durationSec: Math.round((distanceM / 1000) * pace),
      avgHr: Math.round(lerp(t.hr) + (back / 365) * 4),
      elevationGainM: Math.round(lerp([20, 140])),
      load: Math.round(((distanceM / 1000) * pace * t.intensity) / 60),
      ...demoDynamics(pace, Math.round((distanceM / 1000) * pace), t.zones),
    });
  }
  return runs;
}

export function getDemoDashboard(): Dashboard {
  const today = new Date();
  const rand = seeded(20261009);

  return {
    source: "demo",
    fetchedAt: today.toISOString(),
    athleteName: "Runner",
    bodyBattery: { current: 72, high: 94, low: 21, charged: 68, drained: 41 },
    sleep: {
      score: 84,
      qualifier: "Good",
      durationSec: 7 * 3600 + 42 * 60,
      deepSec: 1 * 3600 + 28 * 60,
      lightSec: 4 * 3600 + 6 * 60,
      remSec: 1 * 3600 + 51 * 60,
      awakeSec: 17 * 60,
    },
    heart: { restingHr: 46, hrvLastNight: 68, hrvWeeklyAvg: 64, hrvStatus: "Balanced" },
    vo2Max: { value: 54, change30d: 1 },
    fitnessAge: { fitnessAge: 24, chronologicalAge: 31, achievable: 22 },
    trainingStatus: { status: "Productive", acuteLoad: 612 },
    racePredictions: { fiveK: 20 * 60 + 41, tenK: 43 * 60 + 12, half: 3600 + 36 * 60 + 5, marathon: 3 * 3600 + 22 * 60 + 48 },
    runs: demoRuns(today, rand),
    warnings: [],
  };
}

/* ---------- History ---------- */

/** Uniform 0–1 noise per (date, salt): FNV-1a hash, then a mulberry32 mix. */
function dayNoise(date: string, salt: number) {
  let h = 2166136261 ^ salt;
  for (const c of date) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 15), h | 1);
  h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
  return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
}

function demoDay(date: string, daysAgo: number): DailyRaw {
  const n = (salt: number) => dayNoise(date, salt) - 0.5;
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const longRunHangover = weekday === 0 ? -8 : 0;
  const progress = 1 - daysAgo / 365; // 0 a year ago, 1 today

  const deep = 5000 + n(1) * 1800;
  const rem = 6200 + n(2) * 2000;
  const light = 14500 + n(3) * 3000;
  const awake = 900 + Math.abs(n(4)) * 1400;
  const baseline = 60 + progress * 6;
  const fiveK = 21 * 60 + 40 - progress * 60 + n(11) * 6;

  return {
    date,
    bbHigh: Math.round(Math.min(100, 86 + n(5) * 22 + longRunHangover)),
    bbLow: Math.round(Math.max(5, 22 + n(6) * 20)),
    sleepScore: Math.round(Math.min(98, 78 + n(7) * 24 + longRunHangover / 2)),
    sleepSec: Math.round(deep + rem + light),
    deepSec: Math.round(deep),
    lightSec: Math.round(light),
    remSec: Math.round(rem),
    awakeSec: Math.round(awake),
    restingHr: Math.round(50 - progress * 4 + n(8) * 4),
    hrv: Math.round(baseline + n(9) * 18),
    hrvLow: Math.round(baseline - 7),
    hrvHigh: Math.round(baseline + 8),
    vo2: Math.round((51 + progress * 3 + n(10) * 0.4) * 10) / 10,
    // Predictions improve with VO2 max; longer races scale up from the 5K.
    pred5k: Math.round(fiveK),
    pred10k: Math.round(fiveK * 2.085),
    predHalf: Math.round(fiveK * 4.66),
    predMarathon: Math.round(fiveK * 9.75),
  };
}

export function getDemoTrends(range: Range): Trends {
  const today = isoDate(new Date());
  const { from } = rangeWindow(range, today);
  const daily = eachDay(from, today).map((date, i, all) => demoDay(date, all.length - 1 - i));
  // buildTrends uses runs before `from` only for the load warm-up.
  const runs = demoRuns(new Date(), seeded(20261009));
  return buildTrends(range, daily, runs, [], today);
}

/* ---------- Records, gear, calendar ---------- */

export function getDemoExtras(): RunningExtras {
  const today = isoDate(new Date());
  const runs = demoRuns(new Date(), seeded(20261009));
  // Point each record at a real demo run long enough to contain it.
  const runFor = (minM: number, nth: number) => runs.filter((r) => r.distanceM >= minM)[nth] ?? null;
  const record = (label: string, distanceM: number, timeSec: number, nth: number) => {
    const run = runFor(distanceM, nth);
    return {
      label,
      distanceM,
      timeSec,
      date: run ? run.startLocal.slice(0, 10) : addDays(today, -190),
      activityId: run?.id ?? null,
    };
  };

  return {
    records: [
      record("1K", 1000, 3 * 60 + 41, 9),
      record("1 mile", 1609.34, 6 * 60 + 5, 9),
      record("5K", 5000, 20 * 60 + 12, 14),
      record("10K", 10000, 42 * 60 + 30, 22),
      record("Half marathon", 21097.5, 3600 + 34 * 60 + 55, 3),
      // No demo run is long enough: a race from before the demo log.
      { label: "Marathon", distanceM: 42195, timeSec: 3 * 3600 + 28 * 60 + 10, date: addDays(today, -190), activityId: null },
    ],
    gear: [
      { id: "g1", name: "Adizero Boston 12", distanceM: 744_000, runs: 96, limitM: 800_000, defaultLimit: false, since: addDays(today, -300) },
      { id: "g2", name: "Pegasus 41", distanceM: 612_300, runs: 88, limitM: 800_000, defaultLimit: false, since: addDays(today, -260) },
      { id: "g3", name: "Clifton 9", distanceM: 188_400, runs: 31, limitM: 700_000, defaultLimit: true, since: addDays(today, -70) },
    ],
    // Garmin's default: percentages of a 192 bpm max.
    hrZones: { floors: [96, 115, 134, 154, 173], maxHr: 192, method: "HR_MAX" },
    calendar: buildCalendar(runs, today),
    warnings: [],
  };
}

/* ---------- Activity detail ---------- */

const SAMPLE_M = 50;

function splitsFromSamples(samples: ActivitySample[], totalM: number, totalSec: number): Split[] {
  const splits: Split[] = [];
  for (let k = 1; k <= Math.ceil(totalM / 1000); k++) {
    const part = samples.filter((s) => s.km > k - 1 && s.km <= k + 1e-9);
    if (!part.length) continue;
    const avg = (f: (s: ActivitySample) => number | null) => {
      const v = part.map(f).filter((x): x is number => x !== null);
      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
    };
    let climb = 0;
    for (let j = 1; j < part.length; j++) climb += Math.max(0, (part[j].elevationM ?? 0) - (part[j - 1].elevationM ?? 0));
    splits.push({
      index: k,
      distanceM: Math.min(1000, totalM - (k - 1) * 1000),
      durationSec: part.reduce((a, s) => a + ((s.paceSecPerKm ?? 0) * SAMPLE_M) / 1000, 0),
      avgHr: avg((s) => s.hr),
      elevationGainM: Math.round(climb),
      cadenceSpm: avg((s) => s.cadenceSpm),
    });
  }
  // Scale split times so they add up to the run's recorded duration.
  const sum = splits.reduce((a, s) => a + s.durationSec, 0) || 1;
  return splits.map((s) => ({ ...s, durationSec: Math.round((s.durationSec * totalSec) / sum) }));
}

export function getDemoActivity(id: string): ActivityDetail | null {
  const run = demoRuns(new Date(), seeded(20261009)).find((r) => r.id === id);
  if (!run) return null;

  const n = (i: number, salt: number) => dayNoise(`${id}-${i}`, salt) - 0.5;
  const km = run.distanceM / 1000;
  const avgPace = run.durationSec / km;
  const intervals = run.name.startsWith("Intervals");
  const count = Math.max(2, Math.round(run.distanceM / SAMPLE_M));

  // Hills: a smooth profile scaled so its total climb matches the run's.
  const rawElev = Array.from({ length: count }, (_, i) => {
    const d = ((i + 1) * SAMPLE_M) / 1000;
    return 14 * Math.sin(d * 0.9) + 6 * Math.sin(d * 2.7);
  });
  let rawClimb = 0;
  for (let i = 1; i < count; i++) rawClimb += Math.max(0, rawElev[i] - rawElev[i - 1]);
  const elevScale = run.elevationGainM && rawClimb ? run.elevationGainM / rawClimb : 1;
  // Lift the profile so its lowest point sits at 12 m above sea level.
  const elevBase = 12 - Math.min(...rawElev) * elevScale;

  const samples: ActivitySample[] = Array.from({ length: count }, (_, i) => {
    const d = ((i + 1) * SAMPLE_M) / 1000;
    // Warm-up, then intervals or a gently drifting steady pace.
    const warm = d < 1 ? 1 + (1 - d) * 0.08 : 1;
    const rep = intervals && d > 1.5 && d < km - 1 ? (Math.floor((d - 1.5) / 0.8) % 2 === 0 ? 0.88 : 1.14) : 1;
    const pace = avgPace * warm * rep * (1 + n(i, 1) * 0.03);
    // How much faster than average this moment is (positive = faster).
    const dev = (avgPace - pace) / avgPace;
    return {
      km: Math.round(d * 1000) / 1000,
      paceSecPerKm: Math.round(pace),
      // Centred on the run's averages, rising with effort and a little over time.
      hr: run.avgHr ? Math.round(run.avgHr * (1 + dev * 0.8) + (Math.min(d, 3) - 1.5) * 1.5 + n(i, 2) * 2) : null,
      elevationM: Math.round((elevBase + rawElev[i] * elevScale) * 10) / 10,
      cadenceSpm: run.cadenceSpm ? Math.round(run.cadenceSpm * (1 + dev * 0.4) + n(i, 3) * 2) : null,
    };
  });

  // A loop with a little character: wider east–west, a kink on one side.
  const route: [number, number][] = Array.from({ length: 160 }, (_, i) => {
    const t = (i / 159) * Math.PI * 2;
    const r = 0.012 * Math.sqrt(km / 8);
    return [
      Math.round((r * Math.sin(t) * (1 + 0.15 * Math.sin(3 * t))) * 1e6) / 1e6,
      Math.round((1.5 * r * Math.cos(t) + 0.004 * Math.sin(5 * t)) * 1e6) / 1e6,
    ];
  });

  return {
    run,
    maxHr: run.avgHr ? run.avgHr + 14 : null,
    calories: Math.round(km * 68),
    route,
    samples,
    splits: splitsFromSamples(samples, run.distanceM, run.durationSec),
    warnings: [],
  };
}

/* ---------- Insights ---------- */

export const INSIGHT_DAYS = 90;

export function getDemoInsightsData(): InsightsData {
  const today = isoDate(new Date());
  const from = addDays(today, -(INSIGHT_DAYS - 1));
  const daily = eachDay(from, today).map((date, i, all) => demoDay(date, all.length - 1 - i));
  return { daily, runs: demoRuns(new Date(), seeded(20261009)), warnings: [] };
}
