import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { ActivitySkeleton, ActivityView } from "@/components/activity/activity-view";
import { getGarminActivity, isConnected } from "@/lib/garmin";
import { requireUnlocked } from "@/lib/gate-server";
import { getRaces } from "@/lib/race-data";

export const metadata: Metadata = { title: "Run | Stride" };

async function Activity({ params }: { params: PageProps<"/runs/[id]">["params"] }) {
  await connection();
  await requireUnlocked();
  if (!(await isConnected())) redirect("/login");
  const { id } = await params;
  const detail = await getGarminActivity(id);
  if (!detail) notFound();
  const { races } = await getRaces("garmin");
  const race = races.past.find((r) => r.run?.id === detail.run.id) ?? null;
  return <ActivityView detail={detail} backHref="/#runs" source="garmin" race={race} />;
}

export default function RunPage({ params }: PageProps<"/runs/[id]">) {
  return (
    <Suspense fallback={<ActivitySkeleton />}>
      <Activity params={params} />
    </Suspense>
  );
}
