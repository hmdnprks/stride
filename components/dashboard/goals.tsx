"use client";

import { useActionState, useState } from "react";
import { clearRaceAction, saveGoalAction, saveRaceAction, type RaceFormState } from "@/app/actions";
import type { DataSource, RaceGoal } from "@/lib/garmin/types";
import type { GoalProgress, racePlan } from "@/lib/insights";
import { addDays } from "@/lib/trends";
import { cn } from "@/lib/utils";
import { InlineEdit } from "../uselayouts/inline-edit";
import { StatusButton } from "../uselayouts/save-button";

type Plan = ReturnType<typeof racePlan>;

const PHASE_LABEL: Record<Plan["phase"], string> = {
  build: "Building",
  taper: "Tapering",
  "race-week": "Race week",
  "race-day": "Race day",
  done: "Finished",
};

const PRESETS = [
  { id: "5k", label: "5K", km: 5 },
  { id: "10k", label: "10K", km: 10 },
  { id: "half", label: "Half", km: 21.0975 },
  { id: "marathon", label: "Marathon", km: 42.195 },
];

const longDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const distanceLabel = (km: number) => PRESETS.find((p) => Math.abs(p.km - km) < 0.01)?.label ?? `${km} km`;

/* Race */

function PhaseStrip({ plan, race }: { plan: Plan; race: RaceGoal }) {
  // Four weeks of build, then the taper (which ends with race week), then race day.
  const total = plan.taperDays + 28;
  const pos = Math.max(0, Math.min(1, 1 - plan.daysToGo / total));
  const raceWeek = 7;
  const taperOnly = plan.taperDays - raceWeek;
  const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const raceWeekStart = addDays(race.date, -raceWeek);
  const segments = [
    { label: `Build until ${short(addDays(plan.taperStart, -1))}`, share: 28 / total, tone: "bg-panel-foreground/25" },
    ...(taperOnly > 0 ? [{ label: `Taper from ${short(plan.taperStart)}`, share: taperOnly / total, tone: "bg-panel-foreground/55" }] : []),
    { label: `Race week from ${short(raceWeekStart)}`, share: raceWeek / total, tone: "bg-panel-foreground/90" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {segments.map((s) => (
            <div key={s.label} className={s.tone} style={{ flex: s.share }} />
          ))}
        </div>
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-panel bg-panel-foreground"
          style={{ left: `${pos * 100}%` }}
          aria-hidden
        />
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-panel-muted">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-4 rounded-full ${s.tone}`} />
            {s.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-2 border-panel-foreground" />
          Today
        </li>
      </ul>
    </div>
  );
}

function RaceForm({ source, race, onDone }: { source: DataSource; race: RaceGoal | null; onDone?: () => void }) {
  const preset = race ? PRESETS.find((p) => Math.abs(p.km - race.distanceKm) < 0.01)?.id ?? "custom" : "half";
  const [distance, setDistance] = useState(preset);
  const [state, action, pending] = useActionState<RaceFormState, FormData>(async (prev, form) => {
    const result = await saveRaceAction(prev, form);
    if (result.saved) onDone?.();
    return result;
  }, {});

  const input =
    "h-12 w-full rounded-xl border-2 border-border bg-background px-4 text-base text-foreground outline-none focus:border-foreground";

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="distance" value={distance} />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Race name</span>
        <input name="name" required defaultValue={race?.name} placeholder="City Half Marathon" className={input} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Date</span>
        <input name="date" type="date" required defaultValue={race?.date} className={input} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Distance</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {[...PRESETS, { id: "custom", label: "Other", km: 0 }].map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={distance === p.id}
              onClick={() => setDistance(p.id)}
              className={cn(
                "h-10 rounded-full px-4 text-sm font-semibold outline outline-1 transition-colors",
                distance === p.id ? "bg-foreground text-background outline-foreground" : "bg-secondary text-muted-foreground outline-border hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {distance === "custom" && (
          <label className="mt-2 flex items-center gap-3">
            <input
              name="customKm"
              type="number"
              step="0.1"
              min="1"
              required
              defaultValue={preset === "custom" ? race?.distanceKm : undefined}
              aria-label="Distance in km"
              className={`${input} w-32`}
            />
            <span className="text-sm text-muted-foreground">km</span>
          </label>
        )}
      </fieldset>
      {state.error && (
        <p role="alert" className="rounded-xl bg-muted px-4 py-3 text-sm">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <StatusButton
          type="submit"
          status={pending ? "loading" : "idle"}
          labels={{ idle: race ? "Save race" : "Set race", loading: "Saving", success: "Saved" }}
        />
        {onDone && race && (
          <button type="button" onClick={onDone} className="h-12 px-4 text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function RaceCountdown({ source, race, plan }: { source: DataSource; race: RaceGoal | null; plan: Plan | null }) {
  const [editing, setEditing] = useState(false);

  if (!race || !plan || editing) {
    return (
      <section className="grid gap-8 rounded-[2rem] border-2 border-border p-6 sm:p-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-2">
          <h2 className="wide text-xl leading-tight font-bold">{race ? "Edit your race" : "Training for a race?"}</h2>
          <p className="text-muted-foreground">
            Add it and Stride counts down, tells you when to start tapering, and shows Garmin&apos;s predicted finish time.
          </p>
        </div>
        <RaceForm source={source} race={race} onDone={race ? () => setEditing(false) : undefined} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 rounded-[2rem] bg-panel p-6 text-panel-foreground sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-panel-muted">{PHASE_LABEL[plan.phase]}</span>
          <h2 className="wide text-xl leading-tight font-bold sm:text-2xl">{race.name}</h2>
          <p className="text-panel-muted">
            {distanceLabel(race.distanceKm)} on {longDate(race.date)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-10 rounded-full bg-panel-foreground/15 px-4 text-sm font-semibold hover:bg-panel-foreground/25"
          >
            Edit race
          </button>
          <button
            type="button"
            onClick={() => void clearRaceAction(source)}
            className="h-10 rounded-full px-4 text-sm text-panel-muted hover:text-panel-foreground"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-12 gap-y-4">
        <p className="flex items-baseline gap-3">
          <span className="num text-[6rem] font-bold sm:text-[9rem]">{Math.max(0, plan.daysToGo)}</span>
          <span className="text-lg text-panel-muted">{plan.daysToGo === 1 ? "day to go" : "days to go"}</span>
        </p>
        {plan.predicted && (
          <p className="flex flex-col gap-1 pb-3">
            <span className="text-sm text-panel-muted">Garmin predicts</span>
            <span className="num text-[3rem] font-semibold">{plan.predicted}</span>
          </p>
        )}
      </div>

      {plan.phase !== "done" && <PhaseStrip plan={plan} race={race} />}
      <p className="max-w-[64ch] text-base leading-relaxed">{plan.advice}</p>
    </section>
  );
}

/* Distance goals */

function goalLine(g: GoalProgress) {
  const span = g.period === "month" ? "this month" : "this year";
  if (g.goalKm === null) return `On pace for about ${g.projectedKm} km ${span}. Set a goal to track it.`;
  if (g.done) return `Goal reached with ${g.daysLeft} ${g.daysLeft === 1 ? "day" : "days"} to spare.`;
  if (g.projectedKm >= g.goalKm) return `On track: at this pace you'll finish ${span} around ${g.projectedKm} km.`;
  return `Behind pace. About ${g.perWeekNeeded} km a week from here gets you there.`;
}

export function DistanceGoals({ source, goals }: { source: DataSource; goals: GoalProgress[] }) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="wide text-lg font-semibold">Distance goals</h2>
      <div className="grid gap-10 md:grid-cols-2 md:gap-14">
        {goals.map((g) => {
          const pct = g.goalKm ? Math.min(100, (g.km / g.goalKm) * 100) : 0;
          return (
            <div key={g.period} className="flex flex-col gap-4 border-t-2 border-foreground pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium text-muted-foreground">{g.label}</span>
                <InlineEdit
                  value={g.goalKm}
                  label={g.period === "month" ? "Monthly goal" : "Yearly goal"}
                  suffix="km"
                  placeholder="Set goal"
                  onSave={(v) => saveGoalAction(source, g.period, v)}
                />
              </div>
              <p className="flex items-baseline gap-2">
                <span className="num text-[4.5rem] font-bold">{Math.round(g.km)}</span>
                <span className="text-base text-muted-foreground">{g.goalKm ? `of ${g.goalKm} km` : "km so far"}</span>
              </p>
              {g.goalKm !== null && (
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-lane"
                  role="meter"
                  aria-label={`${g.label} distance goal`}
                  aria-valuenow={Math.round(g.km)}
                  aria-valuemin={0}
                  aria-valuemax={g.goalKm}
                >
                  <div className="h-full rounded-full bg-series" style={{ width: `${pct}%` }} />
                </div>
              )}
              <p className="text-sm text-muted-foreground">{goalLine(g)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
