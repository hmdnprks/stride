import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Dashboard, DashboardSkeleton } from "@/components/dashboard";
import { getGarminDashboard, getGarminTrends, isConnected, type Dashboard as Data, type Trends } from "@/lib/garmin";
import { parseRange } from "@/lib/trends";

async function LiveDashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  // Health data is per-request (and per-day), never part of the build output.
  await connection();
  if (!isConnected()) redirect("/login");
  const range = parseRange((await searchParams).range);

  // History is optional: if it fails, the charts say so and today still shows.
  const trendsP: Promise<Trends> = getGarminTrends(range).catch((err) => ({
    range,
    bucket: "day" as const,
    points: [],
    runs: [],
    warnings: [`history: ${err instanceof Error ? err.message : "failed"}`],
  }));

  let data: Data;
  try {
    data = await getGarminDashboard();
  } catch {
    // Saved tokens rejected (expired / revoked) or Garmin unreachable.
    redirect("/login?reason=expired");
  }

  return <Dashboard data={data} trends={await trendsP} />;
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <LiveDashboard searchParams={searchParams} />
    </Suspense>
  );
}
