import type { DailyRaw, Dashboard, Range, Run, Trends } from "./types";
import { buildTrends, eachDay, isoDate, rangeWindow } from "../trends";

// Deterministic sample data so the dashboard looks real without a Garmin login.

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const RUN_TEMPLATES = [
  { name: "Easy Run", km: [6, 9], pace: [345, 375], hr: [138, 148], intensity: 1.2 },
  { name: "Tempo Run", km: [8, 11], pace: [285, 305], hr: [158, 168], intensity: 2.2 },
  { name: "Intervals 6×800m", km: [7, 9], pace: [300, 320], hr: [152, 162], intensity: 2.4 },
  { name: "Recovery Run", km: [4, 6], pace: [370, 395], hr: [128, 136], intensity: 0.9 },
  { name: "Long Run", km: [16, 24], pace: [330, 355], hr: [145, 152], intensity: 1.6 },
];

// Mon..Sun → template index, or null for a rest day.
const WEEK_PLAN = [0, 2, 3, 1, null, 4, 3];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function localStamp(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
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
    const pace = lerp(t.pace) * fitness;
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
