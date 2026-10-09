import "server-only";

import { savedClient } from "./auth";
import type { ActivityDetail, ActivitySample, Run, Split } from "./types";

// One run in full: summary, per-sample streams, GPS polyline and laps.

const API = "https://connectapi.garmin.com";
const MAX_SAMPLES = 600;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** Some watches report cadence per foot; normalise to steps per minute. */
const spm = (x: number | null) => (x === null ? null : x < 120 ? Math.round(x * 2) : Math.round(x));

export async function getLiveActivity(id: string): Promise<ActivityDetail | null> {
  if (!/^\d+$/.test(id)) return null;
  const { gc, save } = savedClient();
  const get = (url: string) => gc.get<Json>(`${API}${url}`);
  const warnings: string[] = [];

  let summary: Json;
  try {
    summary = await get(`/activity-service/activity/${id}`);
  } catch {
    return null;
  }
  if (!summary?.summaryDTO) return null;
  const s = summary.summaryDTO;

  const run: Run = {
    id,
    name: summary.activityName ?? "Run",
    startLocal: String(s.startTimeLocal ?? "").replace("T", " ").slice(0, 19),
    distanceM: num(s.distance) ?? 0,
    durationSec: num(s.duration) ?? 0,
    avgHr: num(s.averageHR),
    elevationGainM: num(s.elevationGain),
    load: num(s.activityTrainingLoad),
    hrZones: null,
    cadenceSpm: spm(num(s.averageRunCadence)),
    strideCm: num(s.strideLength),
    groundContactMs: num(s.groundContactTime),
    verticalRatioPct: num(s.verticalRatio),
  };

  const [details, laps] = await Promise.all([
    get(`/activity-service/activity/${id}/details?maxChartSize=2000&maxPolylineSize=4000`).catch((err) => {
      warnings.push(`Charts and route: ${err instanceof Error ? err.message : "failed"}`);
      return null;
    }),
    get(`/activity-service/activity/${id}/splits`).catch((err) => {
      warnings.push(`Splits: ${err instanceof Error ? err.message : "failed"}`);
      return null;
    }),
  ]);

  // Streams: metricDescriptors name the columns of each activityDetailMetrics row.
  let samples: ActivitySample[] = [];
  if (details?.metricDescriptors && details?.activityDetailMetrics) {
    const col = (key: string) => details.metricDescriptors.find((d: Json) => d.key === key)?.metricsIndex as number | undefined;
    const iDist = col("sumDistance");
    const iSpeed = col("directSpeed");
    const iHr = col("directHeartRate");
    const iElev = col("directElevation");
    const iCad = col("directDoubleCadence") ?? col("directRunCadence");
    const at = (row: Json, i: number | undefined) => (i === undefined ? null : num(row?.metrics?.[i]));
    const rows: Json[] = details.activityDetailMetrics;
    const stride = Math.max(1, Math.ceil(rows.length / MAX_SAMPLES));
    samples = rows
      .filter((_, i) => i % stride === 0)
      .map((row) => {
        const speed = at(row, iSpeed);
        return {
          km: Math.round(((at(row, iDist) ?? 0) / 1000) * 1000) / 1000,
          paceSecPerKm: speed && speed > 0.5 ? Math.round(1000 / speed) : null,
          hr: at(row, iHr),
          elevationM: at(row, iElev),
          cadenceSpm: spm(at(row, iCad)),
        };
      })
      .filter((x) => x.km > 0);
  }

  const route: [number, number][] = (details?.geoPolylineDTO?.polyline ?? [])
    .map((p: Json) => [num(p?.lat), num(p?.lon)])
    .filter((p: (number | null)[]): p is [number, number] => p[0] !== null && p[1] !== null);

  const splits: Split[] = (laps?.lapDTOs ?? []).map(
    (l: Json, i: number): Split => ({
      index: i + 1,
      distanceM: num(l.distance) ?? 0,
      durationSec: Math.round(num(l.duration) ?? 0),
      avgHr: num(l.averageHR),
      elevationGainM: num(l.elevationGain),
      cadenceSpm: spm(num(l.averageRunCadence)),
    }),
  );

  save();
  return {
    run,
    maxHr: num(s.maxHR),
    calories: num(s.calories),
    route,
    samples,
    splits,
    warnings,
  };
}
