import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getLiveDashboard } from "./live";
import { getLiveTrends } from "./history";
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
