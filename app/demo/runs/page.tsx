import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AllRuns } from "@/components/runs/all-runs";
import { requireUnlocked } from "@/lib/gate-server";
import { getRaces } from "@/lib/race-data";
import { raceNames } from "@/lib/races";

export const metadata: Metadata = { title: "All runs (demo) | Stride" };

async function Runs() {
  await connection();
  await requireUnlocked();
  const { races, runs } = await getRaces("demo");
  return <AllRuns runs={runs} races={raceNames(races.past)} base="/demo" />;
}

export default function DemoRunsPage() {
  return (
    <Suspense fallback={<p className="mx-auto w-full max-w-6xl px-4 py-24 text-sm text-muted-foreground sm:px-8">Loading your runs…</p>}>
      <Runs />
    </Suspense>
  );
}
