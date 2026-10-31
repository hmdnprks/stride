import type { DailyRaw, RaceGoal, Run } from "./garmin/types";
import { clock } from "./format";
import { addDays, isoDate } from "./trends";

// Races: the ones set as goals in Stride and the runs marked as races (in
// Garmin Connect, or in Stride over Garmin's mark), joined up. A goal finds its run by date and distance (or by
// hand), and each finished race gets its result and how training went before it.

export const RACE_DISTANCES = [
  { km: 5, label: "5K", pred: "pred5k" },
  { km: 10, label: "10K", pred: "pred10k" },
  { km: 21.0975, label: "Half", pred: "predHalf" },
  { km: 42.195, label: "Marathon", pred: "predMarathon" },
] as const;

/** Weeks of training shown before each race (the last is race week). */
export const BUILD_WEEKS = 8;

/** A run as the race picker lists it. */
export interface RaceCandidate {
  id: string;
  name: string;
  startLocal: string;
  distanceKm: number;
  durationSec: number;
}

export interface FinishedRace {
  /** The goal's id, or the run's for races only marked in Garmin. */
  key: string;
  goal: RaceGoal | null;
  name: string;
  date: string;
  distanceKm: number;
  run: RaceCandidate & { avgHr: number | null; paceSecPerKm: number } | null;
  /** The run was picked by hand rather than matched. */
  picked: boolean;
  /** Runs around race day to choose from (goals only). */
  candidates: RaceCandidate[];
  /** Garmin's predicted time for the distance going into the race, seconds. */
  predictedSec: number | null;
  /** Kilometres per week before the race, oldest first; the last is the 7 days before race day. */
  weeks: number[];
  /** Fastest race at this distance in Stride (only when there's more than one). */
  best: boolean;
}

export interface Races {
  /** Upcoming goals, soonest first. */
  upcoming: RaceGoal[];
  /** Finished races, most recent first. */
  past: FinishedRace[];
}

const dateOf = (r: Run) => r.startLocal.slice(0, 10);
const round1 = (x: number) => Math.round(x * 10) / 10;

/** The standard distance a race is closest to, if it's within a few percent. */
export function standardDistance(km: number) {
  return RACE_DISTANCES.find((d) => Math.abs(d.km - km) / d.km < 0.05) ?? null;
}

export const distanceLabel = (km: number) => standardDistance(km)?.label ?? `${round1(km)} km`;

/** "Half marathon", "10K", or "15 km". */
export const distanceName = (km: number) => (standardDistance(km)?.label === "Half" ? "Half marathon" : distanceLabel(km));

/** "3:12 faster than Garmin predicted", or null when there's nothing fair to compare. */
export function versusPrediction(race: FinishedRace) {
  if (!race.run || !race.predictedSec) return null;
  // A run well off the race distance (picked by hand) isn't comparable.
  if (Math.abs(race.run.distanceKm - race.distanceKm) / race.distanceKm > 0.1) return null;
  const diff = race.run.durationSec - race.predictedSec;
  if (Math.abs(diff) < 5) return "Right on Garmin's prediction";
  return `${clock(Math.abs(diff))} ${diff < 0 ? "faster" : "slower"} than Garmin predicted`;
}


const candidate = (r: Run): RaceCandidate => ({
  id: r.id,
  name: r.name,
  startLocal: r.startLocal,
  distanceKm: round1(r.distanceM / 1000),
  durationSec: r.durationSec,
});

/**
 * The run that was this race: the one picked by hand, else a run on race day
 * that Garmin marks as a race, else the one closest to the race distance
 * (within 15%, so a warm-up jog isn't taken for a half).
 */
function matchRun(goal: RaceGoal, runs: Run[], notRace: Set<string>) {
  if (goal.runId) {
    const picked = runs.find((r) => r.id === goal.runId);
    if (picked) return { run: picked, picked: true };
  }
  const onDay = runs.filter((r) => dateOf(r) === goal.date && !notRace.has(r.id));
  const near = (r: Run) => Math.abs(r.distanceM / 1000 - goal.distanceKm) / goal.distanceKm;
  const marked = onDay.filter((r) => r.race).sort((a, b) => near(a) - near(b))[0];
  const closest = onDay.filter((r) => near(r) <= 0.15).sort((a, b) => near(a) - near(b))[0];
  return { run: marked ?? closest ?? null, picked: false };
}

/** Garmin's prediction for the distance on the latest day in the week before the race. */
function predictionBefore(date: string, km: number, byDate: Map<string, DailyRaw>) {
  const std = standardDistance(km);
  if (!std) return null;
  for (let i = 1; i <= 7; i++) {
    const v = byDate.get(addDays(date, -i))?.[std.pred];
    if (typeof v === "number") return v;
  }
  return null;
}

function weeklyKm(date: string, runs: Run[]) {
  return Array.from({ length: BUILD_WEEKS }, (_, i) => {
    const to = addDays(date, -1 - (BUILD_WEEKS - 1 - i) * 7);
    const from = addDays(to, -6);
    return round1(runs.filter((r) => dateOf(r) >= from && dateOf(r) <= to).reduce((a, r) => a + r.distanceM / 1000, 0));
  });
}

/** Runs with Stride's race marks applied over Garmin's. */
export function applyRaceMarks(runs: Run[], marks: Record<string, boolean>) {
  return runs.map((r) => (r.id in marks ? { ...r, race: marks[r.id] } : r));
}

/**
 * Upcoming and finished races. `runs` and `daily` should reach back
 * BUILD_WEEKS before the oldest race for its build-up and prediction.
 */
export function buildRaces(
  goals: RaceGoal[],
  allRuns: Run[],
  daily: DailyRaw[],
  today = isoDate(new Date()),
  marks: Record<string, boolean> = {},
  names: Record<string, string> = {},
): Races {
  const runs = applyRaceMarks(allRuns, marks);
  const notRace = new Set(Object.keys(marks).filter((id) => !marks[id]));
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const past: FinishedRace[] = [];
  const upcoming: RaceGoal[] = [];
  const taken = new Set<string>();

  const finish = (key: string, goal: RaceGoal | null, name: string, date: string, distanceKm: number, run: Run | null, picked: boolean): FinishedRace => ({
    key,
    goal,
    name,
    date,
    distanceKm,
    run: run && { ...candidate(run), avgHr: run.avgHr, paceSecPerKm: Math.round(run.durationSec / (run.distanceM / 1000)) },
    picked,
    candidates: goal ? runs.filter((r) => dateOf(r) >= addDays(date, -1) && dateOf(r) <= addDays(date, 1)).map(candidate) : [],
    predictedSec: predictionBefore(date, distanceKm, byDate),
    weeks: weeklyKm(date, runs),
    best: false,
  });

  for (const goal of goals) {
    const { run, picked } = goal.date <= today ? matchRun(goal, runs, notRace) : { run: null, picked: false };
    // On race day the goal stays a countdown until its run shows up.
    if (goal.date > today || (goal.date === today && !run)) {
      upcoming.push(goal);
      continue;
    }
    if (run) taken.add(run.id);
    past.push(finish(goal.id, goal, goal.name, goal.date, goal.distanceKm, run, picked));
  }

  for (const run of runs) {
    if (!run.race || taken.has(run.id)) continue;
    const km = run.distanceM / 1000;
    past.push(finish(run.id, null, names[run.id] || run.name, dateOf(run), standardDistance(km)?.km ?? round1(km), run, false));
  }

  // Best time per distance, among races with a run.
  const byDistance = new Map<number, FinishedRace[]>();
  for (const race of past) if (race.run) byDistance.set(race.distanceKm, [...(byDistance.get(race.distanceKm) ?? []), race]);
  for (const group of byDistance.values()) {
    if (group.length < 2) continue;
    group.reduce((a, b) => (b.run!.durationSec < a.run!.durationSec ? b : a)).best = true;
  }

  return {
    upcoming: upcoming.sort((a, b) => a.date.localeCompare(b.date)),
    past: past.sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/** Run id → race name, for every finished race with a run. */
export function raceNames(past: FinishedRace[]): Record<string, string> {
  return Object.fromEntries(past.flatMap((r) => (r.run ? [[r.run.id, r.name]] : [])));
}
