"use client";

import Link from "next/link";
import { useState } from "react";
import type { Run } from "@/lib/garmin/types";
import { RACE_DISTANCES } from "@/lib/races";
import { RunRow } from "../dashboard/run-row";
import { ThemeToggle } from "../uselayouts/theme-toggle";

type Filter = "all" | "races" | (typeof RACE_DISTANCES)[number]["label"];

/** Within 6% of a race distance, so a watch reading 10.4 km for a 10K still counts. */
const near = (run: Run, km: number) => Math.abs(run.distanceM / 1000 - km) <= km * 0.06;
const monthName = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

/**
 * Every stored run, newest first and grouped by month, with races marked.
 * Filters narrow it to races or to runs near a race distance.
 */
export function AllRuns({
  runs,
  races,
  base,
}: {
  runs: Run[];
  /** Run id → race name, for every run that counts as a race. */
  races: Record<string, string>;
  /** "" for live data, "/demo" for the demo. */
  base: "" | "/demo";
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const sorted = [...runs].sort((a, b) => b.startLocal.localeCompare(a.startLocal));
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all" as Filter, label: "All", count: sorted.length },
    { id: "races" as Filter, label: "Races", count: sorted.filter((r) => r.id in races).length },
    ...RACE_DISTANCES.map((d) => ({ id: d.label as Filter, label: d.label === "Half" ? "Half marathon" : d.label, count: sorted.filter((r) => near(r, d.km)).length })),
  ].filter((f) => f.id === "all" || f.count > 0);

  const shown = sorted.filter((r) => {
    if (filter === "all") return true;
    if (filter === "races") return r.id in races;
    return near(r, RACE_DISTANCES.find((d) => d.label === filter)!.km);
  });
  const months = new Map<string, Run[]>();
  for (const r of shown) {
    const m = r.startLocal.slice(0, 7);
    months.set(m, [...(months.get(m) ?? []), r]);
  }
  const totalKm = Math.round(runs.reduce((a, r) => a + r.distanceM, 0) / 1000);
  const oldest = sorted[sorted.length - 1];

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <Link
            href={`${base || "/"}#runs`}
            className="flex h-11 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-semibold outline outline-1 outline-border hover:outline-foreground"
          >
            <span aria-hidden>‹</span> Dashboard
          </Link>
          <span className="wide text-lg font-extrabold">Stride</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10 sm:px-8">
        <header className="flex flex-col gap-3">
          <h1 className="wide text-2xl leading-[1.05] font-bold sm:text-3xl">All runs</h1>
          <p className="text-base text-muted-foreground">
            {sorted.length
              ? `${sorted.length.toLocaleString("en-GB")} runs, ${totalKm.toLocaleString("en-GB")} km, since ${new Date(`${oldest.startLocal.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Open a run to mark it as a race.`
              : "No runs stored yet. They appear after the first sync."}
          </p>
        </header>

        {sorted.length > 0 && (
          <fieldset>
            <legend className="sr-only">Show</legend>
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <label
                  key={f.id}
                  className="flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold outline outline-1 outline-border hover:outline-foreground has-checked:bg-foreground has-checked:text-background has-checked:outline-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring"
                >
                  <input type="radio" name="runs-filter" value={f.id} checked={filter === f.id} onChange={() => setFilter(f.id)} className="sr-only" />
                  {f.label}
                  <span className="font-normal opacity-70 tabular-nums">{f.count}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {[...months].map(([month, list]) => (
          <section key={month} className="flex flex-col gap-2">
            <h2 className="flex flex-wrap items-baseline justify-between gap-x-4 border-b-2 border-foreground pb-2">
              <span className="wide text-lg font-semibold">{monthName(month)}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {list.length} {list.length === 1 ? "run" : "runs"}, {Math.round(list.reduce((a, r) => a + r.distanceM, 0) / 1000)} km
              </span>
            </h2>
            <ul>
              {list.map((r) => (
                <RunRow key={r.id} run={r} href={`${base}/runs/${r.id}`} race={r.id in races ? races[r.id] : undefined} />
              ))}
            </ul>
          </section>
        ))}
        {sorted.length > 0 && !shown.length && <p className="text-sm text-muted-foreground">No runs match.</p>}
      </main>
    </div>
  );
}
