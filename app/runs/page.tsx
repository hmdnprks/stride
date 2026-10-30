import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AllRuns } from "@/components/runs/all-runs";
import { isConnected } from "@/lib/garmin";
import { requireUnlocked } from "@/lib/gate-server";
import { getRaces } from "@/lib/race-data";
import { raceNames } from "@/lib/races";

export const metadata: Metadata = { title: "All runs | Stride" };

async function Runs() {
  await connection();
  await requireUnlocked();
  if (!(await isConnected())) redirect("/login");
  const { races, runs } = await getRaces("garmin");
  return <AllRuns runs={runs} races={raceNames(races.past)} base="" />;
}

export default function RunsPage() {
  return (
    <Suspense fallback={<p className="mx-auto w-full max-w-6xl px-4 py-24 text-sm text-muted-foreground sm:px-8">Loading your runs…</p>}>
      <Runs />
    </Suspense>
  );
}
