"use client";

import { useTransition } from "react";
import { markRaceAction } from "@/app/actions";
import type { DataSource } from "@/lib/garmin/types";
import { cn } from "@/lib/utils";

/**
 * Count this run as a race or not, over Garmin's mark. Where Stride's choice
 * would match Garmin's, the mark is cleared rather than stored.
 */
export function RaceToggle({ source, runId, race, garminRace, goal }: { source: DataSource; runId: string; race: boolean; garminRace: boolean; goal: boolean }) {
  const [pending, start] = useTransition();
  const turnOn = () => markRaceAction(source, runId, garminRace ? null : true);
  // A goal race matched to this run needs an explicit "not a race" too.
  const turnOff = () => markRaceAction(source, runId, garminRace || goal ? false : null);

  return (
    <div className="flex items-center gap-3 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={race}
        disabled={pending}
        onClick={() => start(() => (race ? turnOff() : turnOn()))}
        className="flex h-11 items-center gap-3 rounded-full pr-1 font-semibold disabled:opacity-60"
      >
        <span className={cn("flex h-7 w-12 items-center rounded-full p-1 transition-colors", race ? "bg-primary" : "bg-muted outline outline-1 outline-border")}>
          <span className={cn("size-5 rounded-full shadow-sm transition-transform", race ? "translate-x-5 bg-primary-foreground" : "bg-foreground/60")} />
        </span>
        Race
      </button>
      <span className="text-muted-foreground">
        {race ? "Shows in Past races, on the calendar and in your year in review." : "Was this a race? Switch it on to add it to your races."}
      </span>
    </div>
  );
}
