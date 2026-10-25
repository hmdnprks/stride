import { Suspense } from "react";
import { after, connection } from "next/server";
import { redirect } from "next/navigation";
import { Dashboard, DashboardSkeleton } from "@/components/dashboard";
import {
  getGarminAllHistory,
  getGarminDashboard,
  getGarminExtras,
  getGarminInsightsData,
  getGarminTrends,
  isConnected,
  syncHistoryIfBehind,
  type Dashboard as Data,
  type InsightsData,
  type RunningExtras,
  type Trends,
} from "@/lib/garmin";
import { requireUnlocked } from "@/lib/gate-server";
import { getSettings } from "@/lib/settings";
import { parseRange } from "@/lib/trends";

async function LiveDashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  // Health data is per-request (and per-day), never part of the build output.
  await connection();
  await requireUnlocked();
  if (!(await isConnected())) redirect("/login");
  const range = parseRange((await searchParams).range);

  // Keep the stored history current even without the daily cron (and backfill
  // it after the first sign-in). Runs after the response, so it never slows the page.
  after(syncHistoryIfBehind);

  // History is optional: if it fails, the charts say so and today still shows.
  const trendsP: Promise<Trends> = getGarminTrends(range).catch((err) => ({
    range,
    bucket: "day" as const,
    points: [],
    runs: [],
    loadEstimated: false,
    warnings: [`history: ${err instanceof Error ? err.message : "failed"}`],
  }));

  const extrasP: Promise<RunningExtras> = getGarminExtras().catch((err) => ({
    records: [],
    gear: [],
    hrZones: null,
    calendar: [],
    warnings: [`records and shoes: ${err instanceof Error ? err.message : "failed"}`],
  }));

  const insightsP: Promise<InsightsData> = getGarminInsightsData().catch((err) => ({
    daily: [],
    runs: [],
    warnings: [`insights: ${err instanceof Error ? err.message : "failed"}`],
  }));

  // Past races look back over all stored history; without it, the insight window will do.
  const historyP: Promise<InsightsData | null> = getGarminAllHistory().catch(() => null);

  let data: Data;
  try {
    data = await getGarminDashboard();
  } catch {
    // Saved tokens rejected (expired / revoked) or Garmin unreachable.
    redirect("/login?reason=expired");
  }

  const [trends, extras, insights, history] = await Promise.all([trendsP, extrasP, insightsP, historyP]);
  return (
    <Dashboard
      data={data}
      trends={trends}
      extras={extras}
      insights={insights}
      history={history ?? insights}
      settings={await getSettings("garmin")}
    />
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <LiveDashboard searchParams={searchParams} />
    </Suspense>
  );
}
