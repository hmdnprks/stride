import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ChargeDemo } from "@/components/charge-demo";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/uselayouts/theme-toggle";
import { isConnected } from "@/lib/garmin";
import { requireUnlocked } from "@/lib/gate-server";

export const metadata: Metadata = { title: "Connect Garmin | Stride" };

const NOTICES: Record<string, string> = {
  expired: "Your Garmin session has expired. Sign in again to keep syncing.",
};

async function Gate({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  await connection();
  await requireUnlocked();
  if (await isConnected()) redirect("/");
  const { reason } = await searchParams;
  return <LoginForm notice={typeof reason === "string" ? NOTICES[reason] : undefined} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
        <span className="wide text-lg font-extrabold">Stride</span>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 px-4 py-8 sm:px-8">
        {/* The sign-in sits inside the watch screen, as its second field. */}
        <div className="grid overflow-hidden rounded-[2rem] bg-panel text-panel-foreground lg:grid-cols-[1.1fr_1fr]">
          <section className="px-6 pt-5 pb-4 sm:p-10" aria-label="What Stride shows you">
            <ChargeDemo />
          </section>
          <section className="border-t border-panel-line p-6 sm:p-10 lg:border-t-0 lg:border-l">
            <Suspense fallback={<p className="text-sm text-panel-muted">Loading…</p>}>
              <Gate searchParams={searchParams} />
            </Suspense>
          </section>
        </div>

        <p className="text-sm text-muted-foreground">
          No watch handy?{" "}
          <Link href="/demo" className="font-semibold text-primary underline-offset-4 hover:underline">
            Look around with sample data
          </Link>
        </p>
      </main>
    </div>
  );
}
