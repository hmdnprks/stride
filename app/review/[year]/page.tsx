import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { YearReviewSkeleton, YearReviewView } from "@/components/review/year-review";
import { getGarminReview, isConnected } from "@/lib/garmin";
import { requireUnlocked } from "@/lib/gate-server";
import { getRaces } from "@/lib/race-data";

export async function generateMetadata({ params }: PageProps<"/review/[year]">): Promise<Metadata> {
  return { title: `${(await params).year} in review | Stride` };
}

async function Review({ params }: { params: PageProps<"/review/[year]">["params"] }) {
  await connection();
  await requireUnlocked();
  if (!(await isConnected())) redirect("/login");
  const { year } = await params;
  if (!/^\d{4}$/.test(year)) notFound();
  const [data, { races }] = await Promise.all([getGarminReview(Number(year)), getRaces("garmin")]);
  if (!data) notFound();
  const season = races.past.filter((r) => r.date.startsWith(year)).reverse();
  return <YearReviewView {...data} races={season} base="" />;
}

export default function ReviewPage({ params }: PageProps<"/review/[year]">) {
  return (
    <Suspense fallback={<YearReviewSkeleton />}>
      <Review params={params} />
    </Suspense>
  );
}
