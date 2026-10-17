import type { ActivitySample } from "./garmin/types";

// The route as a solid wall, like a circuit model: GPS points flattened to
// metres, resampled evenly, with a height for each point. The wall's top
// follows elevation (exaggerated) when the run has it; otherwise it's level.

/** Longest side of the model, in scene units. */
export const EXTENT = 10;
/** Wall height before any elevation, and its thickness, in scene units. */
export const BASE_HEIGHT = 0.75;
export const WALL_WIDTH = 0.42;
/** Vertical exaggeration: a run's climbs are tiny next to its length. */
export const EXAGGERATION = 10;
/** Elevation never lifts the wall by more than this, so a hilly run stays readable. */
const MAX_RISE = 2.4;
const POINTS = 480;

export interface RouteModel {
  /** [x, z] on the ground plane, centred on the origin; north is −z. */
  points: [number, number][];
  /** Wall height at each point. */
  heights: number[];
  /** Start and finish meet: draw the wall as a closed loop. */
  loop: boolean;
  /** Elevation range used, in metres (null when the run has none). */
  climbRangeM: number | null;
  /** Angle of the route's long axis on the ground (radians, from +x towards +z). */
  axis: number;
}

const toMetres = (route: [number, number][]) => {
  const lat0 = route[0][0];
  const k = Math.cos((lat0 * Math.PI) / 180);
  return route.map(([lat, lon]) => [(lon - route[0][1]) * 111_320 * k, -(lat - lat0) * 110_540] as [number, number]);
};

/** Evenly spaced points along the line, plus each one's share of the distance (0–1). */
function resample(pts: [number, number][], n: number) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  const out: [number, number][] = [];
  const at: number[] = [];
  let j = 0;
  for (let s = 0; s < n; s++) {
    const d = (s / (n - 1)) * total;
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const t = Math.min(1, Math.max(0, (d - cum[j]) / seg));
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t]);
    at.push(total ? d / total : 0);
  }
  return { out, at, totalM: total };
}

/** Elevation at a distance (km), interpolated between samples that have one. */
function elevationAt(samples: { km: number; m: number }[], km: number) {
  if (km <= samples[0].km) return samples[0].m;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].km >= km) {
      const a = samples[i - 1];
      const b = samples[i];
      return a.m + ((b.m - a.m) * (km - a.km)) / (b.km - a.km || 1);
    }
  }
  return samples[samples.length - 1].m;
}

export function routeModel(route: [number, number][], samples: ActivitySample[], distanceM: number): RouteModel {
  const { out, at, totalM } = resample(toMetres(route), Math.min(POINTS, Math.max(2, route.length)));

  // Centre and scale so the longest side is EXTENT.
  const xs = out.map((p) => p[0]);
  const zs = out.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const spanM = Math.max(x1 - x0, z1 - z0) || 1;
  const unit = EXTENT / spanM;
  const points = out.map(([x, z]) => [(x - (x0 + x1) / 2) * unit, (z - (z0 + z1) / 2) * unit] as [number, number]);

  // Elevation comes per sample along the run; match it to points by distance.
  const elev = samples.filter((s) => s.elevationM !== null).map((s) => ({ km: s.km, m: s.elevationM! }));
  const runKm = (distanceM || totalM) / 1000;
  let heights = points.map(() => BASE_HEIGHT);
  let climbRangeM: number | null = null;
  if (elev.length >= 2) {
    const m = at.map((share) => elevationAt(elev, share * runKm));
    const low = Math.min(...m);
    climbRangeM = Math.max(...m) - low;
    const scale = Math.min(unit * EXAGGERATION, climbRangeM ? MAX_RISE / climbRangeM : Infinity);
    heights = m.map((v) => BASE_HEIGHT + (v - low) * scale);
  }

  const [sx, sz] = points[0];
  const [ex, ez] = points[points.length - 1];
  // Long axis by principal components, so the camera can look at the route side-on.
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (const [x, z] of points) {
    sxx += x * x;
    szz += z * z;
    sxz += x * z;
  }
  const axis = 0.5 * Math.atan2(2 * sxz, sxx - szz);

  return { points, heights, loop: Math.hypot(ex - sx, ez - sz) < EXTENT * 0.04, climbRangeM, axis };
}
