import type { Run } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);

/**
 * Garmin's training load, or an estimate when the watch doesn't report one.
 * Some watches give Training Effect but no per-run load; every run still has
 * time in heart-rate zones, so load is minutes in each zone weighted 1 to 5
 * (Edwards' TRIMP). It lands on a similar scale to Garmin's EPOC-based load.
 * Also fills `loadEstimated` on runs stored before it existed.
 */
export function withLoad(run: Omit<Run, "loadEstimated"> & { loadEstimated?: boolean }): Run {
  if (run.load !== null || !run.hrZones) return { ...run, loadEstimated: run.loadEstimated ?? false };
  const load = run.hrZones.reduce((sum, sec, i) => sum + (sec / 60) * (i + 1), 0);
  return { ...run, load: Math.round(load), loadEstimated: true };
}

/**
 * Garmin's run calories include the resting (BMR) calories burned during the
 * run; the active part is what the run added on top.
 */
export function runCalories(total: number | null, bmr: number | null) {
  return { calories: total, activeCalories: total !== null && bmr !== null ? Math.max(0, Math.round(total - bmr)) : null };
}

/** One activity from Connect's activity list, as a Run. */
export function mapRun(a: any): Run {
  const zones = [1, 2, 3, 4, 5].map((z) => num(a[`hrTimeInZone_${z}`]));
  return withLoad({
    id: String(a.activityId),
    name: a.activityName ?? "Run",
    startLocal: a.startTimeLocal,
    distanceM: num(a.distance) ?? 0,
    durationSec: num(a.duration) ?? 0,
    avgHr: num(a.averageHR),
    elevationGainM: num(a.elevationGain),
    load: num(a.activityTrainingLoad),
    hrZones: zones.every((z) => z !== null) ? (zones as Run["hrZones"]) : null,
    cadenceSpm: num(a.averageRunningCadenceInStepsPerMinute),
    strideCm: num(a.avgStrideLength),
    groundContactMs: num(a.avgGroundContactTime),
    verticalRatioPct: num(a.avgVerticalRatio),
    ...runCalories(num(a.calories), num(a.bmrCalories)),
  });
}
