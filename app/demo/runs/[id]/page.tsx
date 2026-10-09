import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ActivitySkeleton, ActivityView } from "@/components/activity/activity-view";
import { getDemoActivity } from "@/lib/garmin";

export const metadata: Metadata = { title: "Demo run | Stride" };

async function Activity({ params }: { params: PageProps<"/demo/runs/[id]">["params"] }) {
  // Demo runs are generated relative to today.
  await connection();
  const { id } = await params;
  const detail = getDemoActivity(id);
  if (!detail) notFound();
  return <ActivityView detail={detail} backHref="/demo#runs" />;
}

export default function DemoRunPage({ params }: PageProps<"/demo/runs/[id]">) {
  return (
    <Suspense fallback={<ActivitySkeleton />}>
      <Activity params={params} />
    </Suspense>
  );
}
