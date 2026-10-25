"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { removeRaceAction, saveGoalAction, saveRaceAction, type RaceFormState } from "@/app/actions";
import type { DataSource, RaceGoal } from "@/lib/garmin/types";
import type { GoalProgress, racePlan } from "@/lib/insights";
import { clock, pace } from "@/lib/format";
import type { FinishedRace } from "@/lib/races";
import { addDays, isoDate } from "@/lib/trends";
import { cn } from "@/lib/utils";
import { InlineEdit } from "../uselayouts/inline-edit";
import { StatusButton } from "../uselayouts/save-button";
import { BuildUp, RunPicker, runHref, versusPrediction } from "./races";

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
      {race && <input type="hidden" name="id" value={race.id} />}
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
        {onDone && (
          <button type="button" onClick={onDone} className="h-12 px-4 text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/** A finished race shown this many days after, in place of the countdown. */
const RESULT_DAYS = 21;
const daysSince = (date: string) => Math.round((Date.parse(`${isoDate(new Date())}T12:00:00`) - Date.parse(`${date}T12:00:00`)) / 86_400_000);
const ago = (days: number) => (days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);

function FormCard({ source, race, title, onDone }: { source: DataSource; race: RaceGoal | null; title: string; onDone?: () => void }) {
  return (
    <section className="grid gap-8 rounded-[2rem] border-2 border-border p-6 sm:p-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col gap-2">
        <h2 className="wide text-xl leading-tight font-bold">{title}</h2>
        <p className="text-muted-foreground">
          Add it and Stride counts down, tells you when to start tapering, and shows Garmin&apos;s predicted finish time. After race day,
          it keeps your result.
        </p>
      </div>
      <RaceForm source={source} race={race} onDone={onDone} />
    </section>
  );
}

const panelButton = "h-10 rounded-full bg-panel-foreground/15 px-4 text-sm font-semibold hover:bg-panel-foreground/25";

/** The latest race's result, for a few weeks after race day. */
function RaceResult({ source, race }: { source: DataSource; race: FinishedRace }) {
  const vs = versusPrediction(race);
  return (
    <section className="flex flex-col gap-8 rounded-[2rem] bg-panel p-6 text-panel-foreground sm:p-8">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-panel-muted">Finished {ago(daysSince(race.date))}</span>
        <h2 className="wide text-xl leading-tight font-bold sm:text-2xl">{race.name}</h2>
        <p className="text-panel-muted">
          {distanceLabel(race.distanceKm)} on {longDate(race.date)}
        </p>
      </div>

      {race.run ? (
        <div className="flex flex-wrap items-end gap-x-12 gap-y-4">
          <p className="flex flex-col gap-1">
            <span className="num text-[4.5rem] leading-none font-bold sm:text-[7rem]">{clock(race.run.durationSec)}</span>
            <span className="text-panel-muted">{vs ?? "Finish time"}</span>
          </p>
          <dl className="flex gap-10 pb-2">
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-panel-muted">Pace</dt>
              <dd className="num text-[2.375rem] font-semibold">{pace(race.run.paceSecPerKm)}</dd>
            </div>
            {race.run.avgHr && (
              <div className="flex flex-col gap-1">
                <dt className="text-sm text-panel-muted">Heart rate</dt>
                <dd className="num text-[2.375rem] font-semibold">{race.run.avgHr}</dd>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-panel-muted">On your watch</dt>
              <dd className="num text-[2.375rem] font-semibold">{race.run.distanceKm}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="max-w-[64ch]">Stride couldn&apos;t find the run for this race on {longDate(race.date)}.</p>
      )}

      <BuildUp race={race} tone="panel" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <RunPicker source={source} race={race} tone="panel" />
        {race.run && (
          <Link href={runHref(source, race.run.id)} className={`${panelButton} inline-flex items-center`}>
            View the run
          </Link>
        )}
      </div>
    </section>
  );
}

type Mode = { kind: "add" } | { kind: "edit"; race: RaceGoal } | null;

export function RaceCountdown({
  source,
  race,
  plan,
  latest,
  later,
}: {
  source: DataSource;
  /** The next race, or null. */
  race: RaceGoal | null;
  plan: Plan | null;
  /** The most recent finished race, shown for a while when nothing is coming up. */
  latest: FinishedRace | null;
  /** Races after the next one. */
  later: RaceGoal[];
}) {
  const [mode, setMode] = useState<Mode>(null);
  const close = () => setMode(null);

  if (mode?.kind === "edit") return <FormCard source={source} race={mode.race} title="Edit your race" onDone={close} />;
  if (mode?.kind === "add") return <FormCard source={source} race={null} title={race ? "Add another race" : "Your next race"} onDone={close} />;

  if (!race || !plan) {
    if (latest && daysSince(latest.date) <= RESULT_DAYS) {
      return (
        <div className="flex flex-col gap-4">
          <RaceResult source={source} race={latest} />
          <button
            type="button"
            onClick={() => setMode({ kind: "add" })}
            className="h-11 self-start rounded-full px-4 text-sm font-semibold outline outline-1 outline-border hover:outline-foreground"
          >
            Add your next race
          </button>
        </div>
      );
    }
    return <FormCard source={source} race={null} title="Training for a race?" />;
  }

  return (
    <div className="flex flex-col gap-4">
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
            <button type="button" onClick={() => setMode({ kind: "edit", race })} className={panelButton}>
              Edit race
            </button>
            <button
              type="button"
              onClick={() => void removeRaceAction(source, race.id)}
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

      {later.length > 0 && (
        <ul className="flex flex-col">
          {later.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border py-3">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{r.name}</span>
                <span className="text-sm text-muted-foreground">
                  {distanceLabel(r.distanceKm)} on {longDate(r.date)}
                </span>
              </span>
              <span className="flex items-center gap-4 text-sm">
                <button type="button" onClick={() => setMode({ kind: "edit", race: r })} className="font-semibold text-primary underline-offset-4 hover:underline">
                  Edit
                </button>
                <button type="button" onClick={() => void removeRaceAction(source, r.id)} className="text-muted-foreground hover:text-foreground">
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setMode({ kind: "add" })}
        className="h-11 self-start rounded-full px-4 text-sm font-semibold outline outline-1 outline-border hover:outline-foreground"
      >
        Add another race
      </button>
    </div>
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
