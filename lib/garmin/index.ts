import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getLiveDashboard } from "./live";
import { getLiveTrends } from "./history";
import { getHistoryMeta, loadHistory } from "./store";
import { buildReview, reviewYears } from "../review";
import { addDays, isoDate } from "../trends";
import { getLiveExtras } from "./extras";
import { getLiveActivity } from "./activity";
import type { Range } from "./types";

export type * from "./types";
export { getDemoDashboard } from "./demo";
export { isConnected } from "./auth";
export { clearHistory, loadAllHistory, syncHistory, syncHistoryIfBehind } from "./store";

export const GARMIN_CACHE_TAG = "garmin";

/**
 * Live Garmin data for the signed-in account. Cached for 15 minutes so page
 * reloads don't hammer Garmin; sign-in and sign-out clear the cache.
 */
export async function getGarminDashboard() {
  "use cache";
  cacheTag(GARMIN_CACHE_TAG);
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  return getLiveDashboard();
}

export { getDemoTrends } from "./demo";

/** History for the trend charts, cached like the dashboard and cleared by Sync. */
export async function getGarminTrends(range: Range) {
  "use cache";
  cacheTag(GARMIN_CACHE_TAG);
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  return getLiveTrends(range);
}

export { getDemoActivity, getDemoExtras, getDemoHistory, getDemoInsightsData, getDemoReview } from "./demo";

/** All-time records, shoes and the year calendar; cleared by Sync. */
export async function getGarminExtras() {
  "use cache";
  cacheTag(GARMIN_CACHE_TAG);
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  return getLiveExtras();
}

/** One run in full. Finished activities don't change, so cache for longer. */
export async function getGarminActivity(id: string) {
  "use cache";
  cacheTag(GARMIN_CACHE_TAG);
  cacheLife("hours");
  return getLiveActivity(id);
}

/** 90 days of daily readings and runs for the insight cards; cleared by Sync. */
export async function getGarminInsightsData() {
  "use cache";
  cacheTag(GARMIN_CACHE_TAG);
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  const today = isoDate(new Date());
  // Runs come back with a 4-week warm-up before the window, so load ratios work.
  return loadHistory(addDays(today, -89), today);
}

/**
 * The year in review, or null for a year outside stored history. Before the
 * first sync, history is treated as the last year (fetched live).
 */
export async function getGarminReview(year: number) {
  "use cache";
  cacheTag(GARMIN_CACHE_TAG);
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  const today = isoDate(new Date());
  const historyFrom = (await getHistoryMeta())?.from ?? addDays(today, -364);
  const years = reviewYears(historyFrom, today);
  if (!years.includes(year)) return null;

  const from = historyFrom > `${year}-01-01` ? historyFrom : `${year}-01-01`;
  const to = today < `${year}-12-31` ? today : `${year}-12-31`;
  const [history, extras] = await Promise.all([loadHistory(from, to), getGarminExtras()]);
  return {
    review: buildReview(year, history.daily, history.runs, extras.records, { from, today }),
    years,
    warnings: [...history.warnings, ...extras.warnings],
  };
}

/** Runs between two dates (inclusive), for the week share card; cleared by Sync. */
export async function getGarminRunsBetween(from: string, to: string) {
  "use cache";
  cacheTag(GARMIN_CACHE_TAG);
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  const history = await loadHistory(from, to);
  return history.runs.filter((r) => r.startLocal.slice(0, 10) >= from && r.startLocal.slice(0, 10) <= to);
}
