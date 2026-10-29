import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { YearReviewSkeleton, YearReviewView } from "@/components/review/year-review";
import { getDemoReview } from "@/lib/garmin";
import { requireUnlocked } from "@/lib/gate-server";
import { getRaces } from "@/lib/race-data";

export async function generateMetadata({ params }: PageProps<"/demo/review/[year]">): Promise<Metadata> {
  return { title: `${(await params).year} in review (demo) | Stride` };
}

async function Review({ params }: { params: PageProps<"/demo/review/[year]">["params"] }) {
  // Demo data is generated relative to today.
  await connection();
  await requireUnlocked();
  const { year } = await params;
  if (!/^\d{4}$/.test(year)) notFound();
  const [data, { races }] = await Promise.all([getDemoReview(Number(year)), getRaces("demo")]);
  if (!data) notFound();
  const season = races.past.filter((r) => r.date.startsWith(year)).reverse();
  return <YearReviewView {...data} races={season} base="/demo" />;
}

export default function DemoReviewPage({ params }: PageProps<"/demo/review/[year]">) {
  return (
    <Suspense fallback={<YearReviewSkeleton />}>
      <Review params={params} />
    </Suspense>
  );
}
