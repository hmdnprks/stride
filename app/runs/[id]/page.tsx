import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { ActivitySkeleton, ActivityView } from "@/components/activity/activity-view";
import { getGarminActivity, isConnected } from "@/lib/garmin";

export const metadata: Metadata = { title: "Run | Stride" };

async function Activity({ params }: { params: PageProps<"/runs/[id]">["params"] }) {
  await connection();
  if (!isConnected()) redirect("/login");
  const { id } = await params;
  const detail = await getGarminActivity(id);
  if (!detail) notFound();
  return <ActivityView detail={detail} backHref="/#runs" />;
}

export default function RunPage({ params }: PageProps<"/runs/[id]">) {
  return (
    <Suspense fallback={<ActivitySkeleton />}>
      <Activity params={params} />
    </Suspense>
  );
}
