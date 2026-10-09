import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Dashboard, DashboardSkeleton } from "@/components/dashboard";
import { getDemoDashboard, getDemoExtras, getDemoInsightsData, getDemoTrends } from "@/lib/garmin";
import { getSettings } from "@/lib/settings";
import { parseRange } from "@/lib/trends";

export const metadata: Metadata = { title: "Demo data | Stride" };

async function DemoDashboard({ searchParams }: { searchParams: PageProps<"/demo">["searchParams"] }) {
  // Demo data is generated relative to today, so render per request.
  await connection();
  const range = parseRange((await searchParams).range);
  return (
    <Dashboard
      data={getDemoDashboard()}
      trends={getDemoTrends(range)}
      extras={getDemoExtras()}
      insights={getDemoInsightsData()}
      settings={getSettings("demo")}
    />
  );
}

export default function DemoPage({ searchParams }: PageProps<"/demo">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DemoDashboard searchParams={searchParams} />
    </Suspense>
  );
}
