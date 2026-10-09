import type { Run } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** One activity from Connect's activity list, as a Run. */
export function mapRun(a: any): Run {
  const zones = [1, 2, 3, 4, 5].map((z) => num(a[`hrTimeInZone_${z}`]));
  return {
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
  };
}
