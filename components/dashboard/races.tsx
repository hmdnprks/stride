"use client";

import Link from "next/link";
import { useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { pickRaceRunAction, removeRaceAction } from "@/app/actions";
import type { DataSource } from "@/lib/garmin/types";
import { clock, pace, shortDate } from "@/lib/format";
import { BUILD_WEEKS, distanceLabel, type FinishedRace } from "@/lib/races";
import { cn } from "@/lib/utils";

export const runHref = (source: DataSource, id: string) => (source === "demo" ? `/demo/runs/${id}` : `/runs/${id}`);
const fullDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** "3:12 faster than Garmin predicted", or null when there's nothing fair to compare. */
export function versusPrediction(race: FinishedRace) {
  if (!race.run || !race.predictedSec) return null;
  // A run well off the race distance (picked by hand) isn't comparable.
  if (Math.abs(race.run.distanceKm - race.distanceKm) / race.distanceKm > 0.1) return null;
  const diff = race.run.durationSec - race.predictedSec;
  if (Math.abs(diff) < 5) return "Right on Garmin's prediction";
  return `${clock(Math.abs(diff))} ${diff < 0 ? "faster" : "slower"} than Garmin predicted`;
}

/** Kilometres in each of the weeks before the race, race week last. */
export function BuildUp({ race, tone = "default" }: { race: FinishedRace; tone?: "default" | "panel" }) {
  const top = Math.max(...race.weeks, 1);
  const build = race.weeks.slice(0, -1);
  const avg = build.reduce((a, b) => a + b, 0) / build.length;
  const raceWeek = race.weeks[race.weeks.length - 1];
  const muted = tone === "panel" ? "text-panel-muted" : "text-muted-foreground";
  const bar = tone === "panel" ? "bg-panel-foreground" : "bg-series";

  return (
    <figure className="flex max-w-xl flex-col gap-3">
      <figcaption className="text-sm">
        <span className="font-semibold">The {BUILD_WEEKS} weeks before. </span>
        <span className={muted}>
          {avg > 0
            ? `About ${Math.round(avg)} km a week, peaking at ${Math.round(Math.max(...build))} km. Race week was ${Math.round(raceWeek)} km${
                avg >= 5 ? `, ${Math.round((raceWeek / avg) * 100)}% of that average` : ""
              }.`
            : "No runs recorded in the weeks before."}
        </span>
      </figcaption>
      <div className="flex h-20 items-end gap-1.5" aria-hidden>
        {race.weeks.map((km, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end">
            <div
              className={cn("rounded-t-sm", bar, i === race.weeks.length - 1 ? "opacity-50" : "")}
              style={{ height: `${Math.max(2, (km / top) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className={cn("flex justify-between text-xs", muted)} aria-hidden>
        <span>{BUILD_WEEKS} weeks out</span>
        <span>Race week</span>
      </div>
    </figure>
  );
}

/** Choose which run on or around race day was the race. */
export function RunPicker({ source, race, tone = "default" }: { source: DataSource; race: FinishedRace; tone?: "default" | "panel" }) {
  const [pending, start] = useTransition();
  if (!race.goal) return null;
  const goalId = race.goal.id;
  const field =
    tone === "panel"
      ? "border-panel-foreground/30 bg-panel text-panel-foreground focus:border-panel-foreground"
      : "border-border bg-background text-foreground focus:border-foreground";

  if (!race.candidates.length) {
    return (
      <p className={cn("text-sm", tone === "panel" ? "text-panel-muted" : "text-muted-foreground")}>
        No runs recorded around {fullDate(race.date)}. If you ran it, sync your watch and it will show up here.
      </p>
    );
  }
  return (
    <label className="flex w-full min-w-0 flex-col gap-2 text-sm sm:max-w-md">
      <span className="font-medium">{race.run ? "Wrong run?" : "Which run was the race?"}</span>
      <select
        value={race.picked ? race.run?.id : ""}
        disabled={pending}
        onChange={(e) => start(() => pickRaceRunAction(source, goalId, e.target.value || null))}
        className={cn("h-11 w-full min-w-0 truncate rounded-xl border-2 px-3 outline-none disabled:opacity-60", field)}
      >
        <option value="">{race.run && !race.picked ? `Matched: ${race.run.name}` : "Pick automatically"}</option>
        {race.candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {shortDate(c.startLocal)}, {c.distanceKm} km in {clock(c.durationSec)}: {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function RaceRow({ source, race }: { source: DataSource; race: FinishedRace }) {
  const [pending, start] = useTransition();
  const vs = versusPrediction(race);
  return (
    <li className="border-b border-border">
      <details className="group">
        <summary className="-mx-3 grid cursor-pointer list-none grid-cols-[1fr_auto_1.25rem] items-baseline gap-x-6 gap-y-1 rounded-xl px-3 py-4 transition-colors hover:bg-muted md:grid-cols-[7rem_1fr_9rem_6rem_1.5rem] [&::-webkit-details-marker]:hidden">
          <span className="order-2 text-sm text-muted-foreground tabular-nums md:order-none">{fullDate(race.date)}</span>
          <span className="order-1 flex flex-wrap items-baseline gap-x-2 md:order-none">
            <span className="font-semibold underline-offset-4 group-hover:underline">{race.name}</span>
            <span className="text-sm text-muted-foreground">{distanceLabel(race.distanceKm)}</span>
            {race.best && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Best</span>}
          </span>
          <span className="order-1 text-right md:order-none">
            {race.run ? <span className="num text-[2.375rem] font-semibold">{clock(race.run.durationSec)}</span> : <span className="text-sm text-muted-foreground">No run found</span>}
          </span>
          <span className="order-2 text-right text-sm font-semibold text-primary tabular-nums md:order-none md:text-base">
            {race.run ? `${pace(race.run.paceSecPerKm)} /km` : ""}
          </span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={20}
            className="order-1 row-span-2 self-center justify-self-end text-muted-foreground transition-transform group-open:rotate-180 md:order-none md:row-span-1"
            aria-hidden
          />
        </summary>
        <div className="flex flex-col gap-6 pt-2 pb-8">
          {vs && <p className="text-sm">{vs}{race.predictedSec ? ` (${clock(race.predictedSec)}).` : "."}</p>}
          <BuildUp race={race} />
          <RunPicker source={source} race={race} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {race.run && (
              <Link href={runHref(source, race.run.id)} className="font-semibold text-primary underline-offset-4 hover:underline">
                View the run
              </Link>
            )}
            {race.goal && (
              <button
                type="button"
                disabled={pending}
                onClick={() => start(() => removeRaceAction(source, race.goal!.id))}
                className="text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                Remove from Stride
              </button>
            )}
          </div>
        </div>
      </details>
    </li>
  );
}

export function PastRaces({ source, races }: { source: DataSource; races: FinishedRace[] }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="wide text-lg font-semibold">Past races</h2>
      {races.length ? (
        <ul>
          {races.map((r) => (
            <RaceRow key={r.key} source={source} race={r} />
          ))}
        </ul>
      ) : (
        <p className="max-w-[64ch] text-sm text-muted-foreground">
          Races you add here, or mark as a race in Garmin Connect, show up after race day with your time and how your training went.
        </p>
      )}
    </section>
  );
}
