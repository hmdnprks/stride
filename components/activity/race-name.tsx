"use client";

import { useState, useTransition } from "react";
import { nameRaceAction } from "@/app/actions";
import type { DataSource } from "@/lib/garmin/types";

/** The race's name as Stride shows it (Past races, All runs, the race card); blank goes back to the run's name. */
export function RaceName({ source, runId, goalId, name, runName }: { source: DataSource; runId: string; goalId: string | null; name: string; runName: string }) {
  const [value, setValue] = useState(name === runName ? "" : name);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const current = name === runName ? "" : name;
  const changed = value.trim() !== current && !(goalId && !value.trim());

  return (
    <form
      className="flex max-w-xl flex-col gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!changed) return;
        start(async () => {
          await nameRaceAction(source, runId, goalId, value);
          setSaved(true);
        });
      }}
    >
      <label htmlFor={`race-name-${runId}`} className="font-semibold">
        Race name
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={`race-name-${runId}`}
          value={value}
          maxLength={80}
          placeholder={runName}
          autoComplete="off"
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          className="h-11 min-w-0 flex-1 basis-64 rounded-xl border-2 border-border bg-background px-3 outline-none focus:border-foreground"
        />
        <button
          type="submit"
          disabled={!changed || pending}
          className="h-11 rounded-full bg-foreground px-5 font-semibold text-background disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="text-muted-foreground" aria-live="polite">
        {saved && !changed ? "Saved." : goalId ? "This race was added on the Goals tab; renaming it here renames it there too." : "Shown in Past races, All runs and on the race card. Leave it blank to use the run's name."}
      </p>
    </form>
  );
}
