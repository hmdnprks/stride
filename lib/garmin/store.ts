import "server-only";

import { kvClaim, kvDel, kvGet, kvGetMany, kvSetMany, kvSet } from "../kv";
import { savedClient } from "./auth";
import { emptyDay, fetchHistory, pool, type History } from "./history";
import { withLoad } from "./map";
import { mapWeather } from "./weather";
import type { DailyRaw, Run } from "./types";
import { addDays, eachDay, isoDate, LOAD_WARMUP_DAYS } from "../trends";

// Stored daily history, so charts read finished days from the database and
// only ask Garmin for the last few. One key per month holds that month's
// daily readings and runs; a meta key says which days are covered.
//
// A sync (daily cron, or after a page load when the store is behind) fetches
// from the last stored day to yesterday, and re-fetches the last week each
// time so data a watch uploads late still lands. The first sync backfills a
// little over a year: enough for the 1Y charts and their load warm-up.

const META_KEY = "history:meta";
const LOCK_KEY = "history:lock";
const monthKey = (month: string) => `history:${month}`;

/** First sync covers this many days, so 1Y (Monday-aligned, plus load warm-up) is complete. */
const BACKFILL_DAYS = 400;
/** Every sync re-fetches this many recent days, for late watch uploads. */
const REFETCH_DAYS = 7;
/** Pages always fetch at least the last few days live (today included). */
const LIVE_DAYS = 3;
/** A failing sync is retried this many times before its gaps are accepted. */
const MAX_ATTEMPTS = 3;
/** Don't retry a failed sync from page loads more often than this. */
const RETRY_AFTER_MS = 60 * 60 * 1000;
/** Weather is fetched once per run and kept; this many runs per sync at most. */
const WEATHER_PER_SYNC = 250;
/** Long enough for a full backfill; released early when the sync ends. */
const LOCK_SECONDS = 300;

interface Month {
  days: DailyRaw[];
  runs: Run[];
}

export interface HistoryMeta {
  /** Stored days run from `from` to `through` (runs from LOAD_WARMUP_DAYS earlier); null until the backfill succeeds. */
  from: string | null;
  through: string | null;
  /** When the last sync finished (ISO), and how it went. */
  syncedAt: string;
  attempts: number;
  lastError: string | null;
  /** Every stored run has its weather (or is known to have none). */
  weatherComplete?: boolean;
  /** Stored days and runs have their calories (added after the first stores were backfilled). */
  caloriesComplete?: boolean;
  /** When a catch-up (weather, calories) last ran (ISO), so failures retry hourly at most. */
  catchUpTriedAt?: string;
  /** Older name for catchUpTriedAt. */
  weatherTriedAt?: string;
}

const runDate = (r: Run) => r.startLocal.slice(0, 10);
const min = (a: string, b: string) => (a < b ? a : b);
const max = (a: string, b: string) => (a > b ? a : b);

function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); ) {
    out.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  return out;
}

/** Fill gaps in `base` with `next`'s readings; a reading that's missing in `next` keeps the old one. */
function mergeDay(base: DailyRaw | undefined, next: DailyRaw): DailyRaw {
  if (!base) return next;
  const out = { ...base };
  for (const [k, v] of Object.entries(next) as [keyof DailyRaw, DailyRaw[keyof DailyRaw]][]) {
    if (v !== null && v !== undefined) Object.assign(out, { [k]: v });
  }
  return out;
}

export function getHistoryMeta() {
  return kvGet<HistoryMeta>(META_KEY);
}

async function readMonths(from: string, to: string) {
  const months = monthsBetween(from, to);
  const stored = await kvGetMany<Month>(months.map(monthKey));
  return new Map(
    months.map((m, i) => {
      const month = stored[i] ?? { days: [], runs: [] };
      return [m, { ...month, runs: month.runs.map(withLoad) }];
    }),
  );
}

/**
 * Write fetched days and runs into the store. Days merge with what's there;
 * runs inside the fetched window replace the stored ones, so a run deleted
 * in Garmin Connect disappears too (unless the run list itself failed).
 */
async function writeHistory(h: History, from: string, through: string, runsOk: boolean) {
  const runsFrom = addDays(from, -LOAD_WARMUP_DAYS);
  const months = await readMonths(runsFrom, through);

  for (const day of h.daily) {
    if (day.date < from || day.date > through) continue;
    const month = months.get(day.date.slice(0, 7))!;
    const i = month.days.findIndex((d) => d.date === day.date);
    if (i >= 0) month.days[i] = mergeDay(month.days[i], day);
    else month.days.push(day);
  }

  // Re-fetched runs come without weather; keep what's stored rather than fetch it again.
  const storedWeather = new Map([...months.values()].flatMap((m) => m.runs.map((r) => [r.id, r.weather] as const)));

  if (runsOk) {
    for (const month of months.values()) {
      month.runs = month.runs.filter((r) => runDate(r) < runsFrom || runDate(r) > through);
    }
  }
  for (const run of h.runs) {
    const date = runDate(run);
    if (date < runsFrom || date > through) continue;
    const month = months.get(date.slice(0, 7))!;
    const weather = run.weather ?? storedWeather.get(run.id);
    month.runs = [...month.runs.filter((r) => r.id !== run.id), weather === undefined ? run : { ...run, weather }];
  }

  for (const month of months.values()) {
    month.days.sort((a, b) => a.date.localeCompare(b.date));
    month.runs.sort((a, b) => a.startLocal.localeCompare(b.startLocal));
  }
  await kvSetMany([...months].map(([m, data]) => [monthKey(m), data]));
}

/**
 * Fetch weather for stored runs that don't have it yet, newest first. A run
 * Garmin has no weather for (treadmill) is stored as null so it isn't asked
 * again; a failed request leaves it for the next sync.
 */
async function fillWeather(from: string, through: string) {
  const months = await readMonths(addDays(from, -LOAD_WARMUP_DAYS), through);
  const missing = [...months.values()]
    .flatMap((m) => m.runs)
    .filter((r) => r.weather === undefined)
    .sort((a, b) => b.startLocal.localeCompare(a.startLocal))
    .slice(0, WEATHER_PER_SYNC);
  if (!missing.length) return { failed: 0, complete: true };

  const { gc, save } = await savedClient();
  let failed = 0;
  await pool(missing, async (run) => {
    try {
      run.weather = mapWeather(await gc.get(`https://connectapi.garmin.com/activity-service/activity/${run.id}/weather`));
    } catch {
      failed++;
    }
  });
  await save();
  await kvSetMany([...months].map(([m, data]) => [monthKey(m), data]));
  const left = [...months.values()].flatMap((m) => m.runs).filter((r) => r.weather === undefined).length;
  return { failed, complete: left === 0 };
}

/**
 * Calories for days and runs stored before Stride kept them: the daily
 * calorie report and the run list, re-fetched for the stored range and merged
 * in (other readings and run weather are kept).
 */
async function backfillCalories(from: string, through: string) {
  const h = await fetchHistory(from, through, ["Calories", "Runs"]);
  await writeHistory(h, from, through, !h.warnings.some((w) => w.startsWith("Runs")));
  if (h.warnings.length) console.warn(`Stride calorie backfill: ${h.warnings.join("; ")}`);
  return h.warnings.length === 0;
}

export type SyncResult =
  | { status: "synced"; from: string; through: string; warnings: string[] }
  | { status: "retrying"; attempts: number; warnings: string[] }
  | { status: "busy" };

/**
 * Bring the store up to yesterday. Only one sync runs at a time. If a metric
 * fails, the fetched data is still saved but the covered range doesn't move,
 * so the next sync tries the same days again (up to MAX_ATTEMPTS times).
 */
export async function syncHistory(): Promise<SyncResult> {
  if (!(await kvClaim(LOCK_KEY, LOCK_SECONDS))) return { status: "busy" };
  try {
    const meta = await getHistoryMeta();
    const today = isoDate(new Date());
    const yesterday = addDays(today, -1);
    const backfilled = Boolean(meta?.from && meta.through);
    const from = backfilled
      ? min(addDays(meta!.through!, 1), addDays(today, -REFETCH_DAYS))
      : addDays(today, -BACKFILL_DAYS);

    const h = await fetchHistory(from, yesterday);
    const runsOk = !h.warnings.some((w) => w.startsWith("Runs"));
    await writeHistory(h, from, yesterday, runsOk);
    const weather = await fillWeather(backfilled ? meta!.from! : from, yesterday);
    if (weather.failed) console.warn(`Stride history sync: weather failed for ${weather.failed} runs; retrying next sync.`);
    // Days fetched just now came with calories; older stored days may not have them.
    const caloriesComplete =
      !h.warnings.some((w) => w.startsWith("Calories")) &&
      (!backfilled || meta!.caloriesComplete || from <= meta!.from! || (await backfillCalories(meta!.from!, addDays(from, -1))));

    const attempts = (meta?.attempts ?? 0) + 1;
    const now = new Date().toISOString();
    if (h.warnings.length && attempts < MAX_ATTEMPTS) {
      await kvSet(META_KEY, { ...(meta ?? { from: null, through: null }), syncedAt: now, attempts, lastError: h.warnings.join("; "), caloriesComplete } satisfies HistoryMeta);
      return { status: "retrying", attempts, warnings: h.warnings };
    }

    const covered = backfilled ? meta!.from! : from;
    await kvSet(META_KEY, {
      from: covered,
      through: yesterday,
      syncedAt: now,
      attempts: 0,
      lastError: h.warnings.length ? h.warnings.join("; ") : null,
      weatherComplete: weather.complete,
      caloriesComplete,
    } satisfies HistoryMeta);
    return { status: "synced", from: covered, through: yesterday, warnings: h.warnings };
  } finally {
    await kvDel(LOCK_KEY);
  }
}

/**
 * For a store that's current but missing something added later: weather on
 * runs, calories on days and runs. Also retries a weather fetch that failed.
 */
async function catchUp(meta: HistoryMeta) {
  if (!meta.from || !meta.through || !(await kvClaim(LOCK_KEY, LOCK_SECONDS))) return;
  try {
    const caloriesComplete = meta.caloriesComplete || (await backfillCalories(meta.from, meta.through));
    const weather = meta.weatherComplete ? { complete: true } : await fillWeather(meta.from, meta.through);
    const latest = await getHistoryMeta();
    if (latest) {
      await kvSet(META_KEY, {
        ...latest,
        weatherComplete: weather.complete,
        caloriesComplete,
        catchUpTriedAt: new Date().toISOString(),
      } satisfies HistoryMeta);
    }
  } finally {
    await kvDel(LOCK_KEY);
  }
}

/** Sync if the store is missing or behind, unless a failed sync was tried within the hour. */
export async function syncHistoryIfBehind() {
  const meta = await getHistoryMeta();
  const yesterday = addDays(isoDate(new Date()), -1);
  if (meta?.through && meta.through >= yesterday) {
    const triedAt = meta.catchUpTriedAt ?? meta.weatherTriedAt;
    const tried = triedAt ? Date.parse(triedAt) : 0;
    if ((!meta.weatherComplete || !meta.caloriesComplete) && Date.now() - tried > RETRY_AFTER_MS) {
      await catchUp(meta).catch((err) => console.warn(`Stride catch-up failed: ${err instanceof Error ? err.message : err}`));
    }
    return;
  }
  if (meta?.attempts && Date.now() - Date.parse(meta.syncedAt) < RETRY_AFTER_MS) return;
  try {
    await syncHistory();
  } catch (err) {
    console.warn(`Stride history sync failed: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Daily readings for `from`..`to` and runs from LOAD_WARMUP_DAYS earlier, like
 * fetchHistory: finished days from the store, recent ones from Garmin. Falls
 * back to fetching everything when the store doesn't cover the window.
 */
export async function loadHistory(from: string, to: string): Promise<History> {
  const meta = await getHistoryMeta();
  if (!meta?.from || !meta.through || from < meta.from) return fetchHistory(from, to);

  const today = isoDate(new Date());
  const liveFrom = max(from, min(addDays(meta.through, 1), addDays(today, -(LIVE_DAYS - 1))));
  const storedTo = min(to, addDays(liveFrom, -1));
  const runsFrom = addDays(from, -LOAD_WARMUP_DAYS);

  const [months, live] = await Promise.all([
    readMonths(runsFrom, max(runsFrom, min(to, meta.through))),
    liveFrom <= to ? fetchHistory(liveFrom, to) : null,
  ]);

  const storedDays = new Map<string, DailyRaw>();
  const runs = new Map<string, Run>();
  const storedWeather = new Map<string, Run["weather"]>();
  for (const month of months.values()) {
    for (const r of month.runs) storedWeather.set(r.id, r.weather);
    for (const d of month.days) storedDays.set(d.date, d);
    for (const r of month.runs) if (runDate(r) >= runsFrom && runDate(r) <= storedTo) runs.set(r.id, r);
  }
  const liveDays = new Map(live?.daily.map((d) => [d.date, d]));
  for (const r of live?.runs ?? []) {
    if (runDate(r) < runsFrom || runDate(r) > to) continue;
    const weather = r.weather ?? storedWeather.get(r.id);
    runs.set(r.id, weather === undefined ? r : { ...r, weather });
  }

  const daily = eachDay(from, to).map((date) => {
    const fresh = liveDays.get(date);
    const kept = storedDays.get(date);
    return fresh ? mergeDay(kept, fresh) : (kept ?? emptyDay(date));
  });

  return {
    daily,
    runs: [...runs.values()].sort((a, b) => a.startLocal.localeCompare(b.startLocal)),
    warnings: live?.warnings ?? [],
  };
}

/** Everything stored (or, before the first sync, the last year from Garmin), for the CSV export. */
export async function loadAllHistory() {
  const today = isoDate(new Date());
  const meta = await getHistoryMeta();
  return loadHistory(meta?.from ?? addDays(today, -364), today);
}

/** Forget the stored history (on sign-out, so another account starts fresh). */
export async function clearHistory() {
  const meta = await getHistoryMeta();
  const today = isoDate(new Date());
  const first = addDays(meta?.from ?? addDays(today, -BACKFILL_DAYS), -LOAD_WARMUP_DAYS);
  await kvDel(META_KEY, LOCK_KEY, ...monthsBetween(first, today).map(monthKey));
}
