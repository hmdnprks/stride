import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getLiveDashboard } from "./live";
import { fetchHistory, getLiveTrends } from "./history";
import { addDays, isoDate } from "../trends";
import { getLiveExtras } from "./extras";
import { getLiveActivity } from "./activity";
import type { Range } from "./types";

export type * from "./types";
export { getDemoDashboard } from "./demo";
export { isConnected } from "./auth";

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

export { getDemoActivity, getDemoExtras, getDemoInsightsData } from "./demo";

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
  return fetchHistory(addDays(today, -89), today);
}
