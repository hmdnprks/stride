import "server-only";

import { savedClient } from "./auth";
import { mapRun } from "./map";
import type { DailyRaw, Range, Run, Trends } from "./types";
import { addDays, buildTrends, eachDay, isoDate, LOAD_WARMUP_DAYS, rangeWindow } from "../trends";

// History for the trend charts, from the unofficial Connect endpoints the
// Garmin Connect website uses for its own reports. Requests are split into
// 28-day windows (the longest span some endpoints accept) and every metric is
// fetched independently, so one failing endpoint only empties its charts.

const API = "https://connectapi.garmin.com";
const CHUNK_DAYS = 28;
const CONCURRENCY = 4;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);

function chunks(from: string, to: string) {
  const out: { from: string; to: string }[] = [];
  for (let start = from; start <= to; start = addDays(start, CHUNK_DAYS)) {
    const end = addDays(start, CHUNK_DAYS - 1);
    out.push({ from: start, to: end < to ? end : to });
  }
  return out;
}

async function pool<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

/** Body battery level from one `[timestamp, level]`-style sample. */
function batteryLevel(sample: unknown) {
  if (!Array.isArray(sample)) return null;
  const level = sample.slice(1).find((v) => typeof v === "number" && v >= 0 && v <= 100);
  return typeof level === "number" ? level : null;
}

export interface History {
  daily: DailyRaw[];
  /** Runs from LOAD_WARMUP_DAYS before `from`, so load figures are warm. */
  runs: Run[];
  warnings: string[];
}

export async function getLiveTrends(range: Range): Promise<Trends> {
  const today = isoDate(new Date());
  const { from, to } = rangeWindow(range, today);
  const h = await fetchHistory(from, to);
  return buildTrends(range, h.daily, h.runs, h.warnings, today);
}

/** Per-day wellness readings and runs for any date window. */
export async function fetchHistory(from: string, to: string): Promise<History> {
  const { gc, save } = savedClient();
  const get = (url: string, params?: Record<string, unknown>) =>
    gc.get<Json>(`${API}${url}`, params ? { params } : undefined);

  const user = (await gc.getUserProfile()).displayName;
  const windows = chunks(from, to);
  const warnings: string[] = [];

  const days = new Map<string, DailyRaw>(
    eachDay(from, to).map((date) => [
      date,
      {
        date,
        bbHigh: null,
        bbLow: null,
        sleepScore: null,
        sleepSec: null,
        deepSec: null,
        lightSec: null,
        remSec: null,
        awakeSec: null,
        restingHr: null,
        hrv: null,
        hrvLow: null,
        hrvHigh: null,
        vo2: null,
        pred5k: null,
        pred10k: null,
        predHalf: null,
        predMarathon: null,
      },
    ]),
  );
  const set = (date: string | undefined, patch: Partial<DailyRaw>) => {
    const day = date && days.get(date);
    if (day) Object.assign(day, patch);
  };

  async function metric(label: string, load: () => Promise<void>) {
    try {
      await load();
    } catch (err) {
      warnings.push(`${label} history: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  const perWindow = (fn: (w: { from: string; to: string }) => Promise<void>) => () => pool(windows, fn).then(() => {});

  let runs: Run[] = [];

  await Promise.all([
    metric(
      "Body battery",
      perWindow(async (w) => {
        const raw: Json[] = await get(`/wellness-service/wellness/bodyBattery/reports/daily`, {
          startDate: w.from,
          endDate: w.to,
        });
        for (const day of raw ?? []) {
          const levels = (day?.bodyBatteryValuesArray ?? []).map(batteryLevel).filter((v: number | null) => v !== null);
          if (levels.length) set(day.date, { bbHigh: Math.max(...levels), bbLow: Math.min(...levels) });
        }
      }),
    ),

    metric("Sleep", async () => {
      await pool(windows, async (w) => {
        const raw = await get(`/sleep-service/stats/sleep/daily/${w.from}/${w.to}`);
        for (const s of raw?.individualStats ?? []) {
          const v = s?.values ?? {};
          set(s?.calendarDate, {
            sleepScore: num(v.sleepScore) ?? num(v.overallSleepScore) ?? num(v.sleepScores?.overall?.value),
            sleepSec: num(v.totalSleepTimeInSeconds) ?? num(v.sleepTimeSeconds) ?? num(v.totalSleepSeconds),
            deepSec: num(v.deepTime) ?? num(v.deepSleepSeconds),
            lightSec: num(v.lightTime) ?? num(v.lightSleepSeconds),
            remSec: num(v.remTime) ?? num(v.remSleepSeconds),
            awakeSec: num(v.awakeTime) ?? num(v.awakeSleepSeconds),
          });
        }
      });

      // Fallback for short ranges: the per-night endpoint the Today view uses.
      const found = [...days.values()].some((d) => d.sleepScore !== null);
      if (!found && eachDay(from, to).length <= CHUNK_DAYS) {
        await pool(eachDay(from, to), async (date) => {
          const raw = await get(`/wellness-service/wellness/dailySleepData/${user}`, { date, nonSleepBufferMinutes: 60 });
          const s = raw?.dailySleepDTO;
          if (!s) return;
          set(date, {
            sleepScore: num(s.sleepScores?.overall?.value),
            sleepSec: num(s.sleepTimeSeconds),
            deepSec: num(s.deepSleepSeconds),
            lightSec: num(s.lightSleepSeconds),
            remSec: num(s.remSleepSeconds),
            awakeSec: num(s.awakeSleepSeconds),
          });
        });
      }
    }),

    metric(
      "Resting heart rate",
      perWindow(async (w) => {
        const raw = await get(`/userstats-service/wellness/daily/${user}`, {
          fromDate: w.from,
          untilDate: w.to,
          metricId: 60,
        });
        for (const m of raw?.allMetrics?.metricsMap?.WELLNESS_RESTING_HEART_RATE ?? []) {
          set(m?.calendarDate, { restingHr: num(m?.value) });
        }
      }),
    ),

    metric(
      "HRV",
      perWindow(async (w) => {
        const raw = await get(`/hrv-service/hrv/daily/${w.from}/${w.to}`);
        for (const h of raw?.hrvSummaries ?? []) {
          set(h?.calendarDate, {
            hrv: num(h?.lastNightAvg),
            hrvLow: num(h?.baseline?.balancedLow),
            hrvHigh: num(h?.baseline?.balancedUpper),
          });
        }
      }),
    ),

    metric(
      "VO2 max",
      perWindow(async (w) => {
        const raw: Json[] = await get(`/metrics-service/metrics/maxmet/daily/${w.from}/${w.to}`);
        for (const r of raw ?? []) {
          set(r?.generic?.calendarDate, { vo2: num(r?.generic?.vo2MaxPreciseValue) ?? num(r?.generic?.vo2MaxValue) });
        }
      }),
    ),

    metric("Race predictor", async () => {
      // One request for the whole range; Connect's own chart asks the same way.
      const raw: Json[] = await get(`/metrics-service/metrics/racepredictions/daily/${user}`, {
        fromCalendarDate: from,
        toCalendarDate: to,
      });
      for (const r of raw ?? []) {
        set(r?.calendarDate, {
          pred5k: num(r?.time5K),
          pred10k: num(r?.time10K),
          predHalf: num(r?.timeHalfMarathon),
          predMarathon: num(r?.timeMarathon),
        });
      }
    }),

    metric("Runs", async () => {
      const PAGE = 100;
      for (let start = 0; ; start += PAGE) {
        const page: Json[] = await get(`/activitylist-service/activities/search/activities`, {
          start,
          limit: PAGE,
          activityType: "running",
          startDate: addDays(from, -LOAD_WARMUP_DAYS),
          endDate: to,
        });
        runs = runs.concat((page ?? []).map(mapRun));
        if (!page || page.length < PAGE) break;
      }
    }),
  ]);

  save();
  return { daily: [...days.values()], runs, warnings };
}
