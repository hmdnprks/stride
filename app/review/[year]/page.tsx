import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { YearReviewSkeleton, YearReviewView } from "@/components/review/year-review";
import { getGarminReview, isConnected } from "@/lib/garmin";
import { requireUnlocked } from "@/lib/gate-server";

export async function generateMetadata({ params }: PageProps<"/review/[year]">): Promise<Metadata> {
  return { title: `${(await params).year} in review | Stride` };
}

async function Review({ params }: { params: PageProps<"/review/[year]">["params"] }) {
  await connection();
  await requireUnlocked();
  if (!(await isConnected())) redirect("/login");
  const { year } = await params;
  if (!/^\d{4}$/.test(year)) notFound();
  const data = await getGarminReview(Number(year));
  if (!data) notFound();
  return <YearReviewView {...data} base="" />;
}

export default function ReviewPage({ params }: PageProps<"/review/[year]">) {
  return (
    <Suspense fallback={<YearReviewSkeleton />}>
      <Review params={params} />
    </Suspense>
  );
}
