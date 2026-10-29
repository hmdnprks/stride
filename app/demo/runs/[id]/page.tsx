import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ActivitySkeleton, ActivityView } from "@/components/activity/activity-view";
import { getDemoActivity } from "@/lib/garmin";
import { requireUnlocked } from "@/lib/gate-server";
import { getRaces } from "@/lib/race-data";

export const metadata: Metadata = { title: "Demo run | Stride" };

async function Activity({ params }: { params: PageProps<"/demo/runs/[id]">["params"] }) {
  // Demo runs are generated relative to today.
  await connection();
  await requireUnlocked();
  const { id } = await params;
  const detail = getDemoActivity(id);
  if (!detail) notFound();
  const { races } = await getRaces("demo");
  const race = races.past.find((r) => r.run?.id === detail.run.id) ?? null;
  return <ActivityView detail={detail} backHref="/demo#runs" source="demo" race={race} />;
}

export default function DemoRunPage({ params }: PageProps<"/demo/runs/[id]">) {
  return (
    <Suspense fallback={<ActivitySkeleton />}>
      <Activity params={params} />
    </Suspense>
  );
}
