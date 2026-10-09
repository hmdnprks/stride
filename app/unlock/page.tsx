import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UnlockForm } from "@/components/unlock-form";
import { ThemeToggle } from "@/components/uselayouts/theme-toggle";
import { GATE_COOKIE, gateMode, isUnlocked, safeNext } from "@/lib/gate";

export const metadata: Metadata = { title: "Unlock | Stride" };

async function Gate({ searchParams }: { searchParams: PageProps<"/unlock">["searchParams"] }) {
  await connection();
  const next = safeNext((await searchParams).next);
  if (isUnlocked((await cookies()).get(GATE_COOKIE)?.value)) redirect(next);

  if (gateMode() === "missing-password") {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="wide text-xl leading-tight font-bold">Stride is locked</h1>
        <p className="text-panel-muted">
          No password is set on this server, so Stride stays private. Set the <code>STRIDE_PASSWORD</code> environment
          variable and redeploy to unlock it.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="wide text-xl leading-tight font-bold">This Stride is private</h1>
        <p className="text-panel-muted">Enter the password to see the dashboard.</p>
      </header>
      <UnlockForm next={next} />
    </div>
  );
}

export default function UnlockPage({ searchParams }: PageProps<"/unlock">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
        <span className="wide text-lg font-extrabold">Stride</span>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
        <section className="rounded-[2rem] bg-panel p-6 text-panel-foreground sm:p-10">
          <Suspense fallback={<p className="text-sm text-panel-muted">Loading…</p>}>
            <Gate searchParams={searchParams} />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
