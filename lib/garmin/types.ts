// Normalized shapes the dashboard renders. Every provider (demo, live Garmin)
// maps its raw data into these, so the UI never touches Garmin's API format.

export type DataSource = "demo" | "garmin";

export interface BodyBattery {
  current: number;
  high: number;
  low: number;
  charged: number;
  drained: number;
}

export interface Sleep {
  score: number;
  qualifier: string | null;
  durationSec: number;
  deepSec: number;
  lightSec: number;
  remSec: number;
  awakeSec: number;
}

export interface Heart {
  restingHr: number | null;
  hrvLastNight: number | null;
  hrvWeeklyAvg: number | null;
  hrvStatus: string | null;
}

export interface Vo2Max {
  value: number;
  change30d: number | null;
}

export interface FitnessAge {
  fitnessAge: number;
  chronologicalAge: number;
  achievable: number | null;
}

export interface TrainingStatus {
  status: string;
  acuteLoad: number | null;
}

/** Predicted finish times, in seconds. */
export interface RacePredictions {
  fiveK: number | null;
  tenK: number | null;
  half: number | null;
  marathon: number | null;
}

export interface Run {
  id: string;
  name: string;
  /** Local start time, ISO-like `YYYY-MM-DD HH:mm:ss`. */
  startLocal: string;
  distanceM: number;
  durationSec: number;
  avgHr: number | null;
  elevationGainM: number | null;
  /** Garmin's per-activity training load (EPOC-based). */
  load: number | null;
}

export interface Dashboard {
  source: DataSource;
  fetchedAt: string;
  athleteName: string;
  bodyBattery: BodyBattery | null;
  sleep: Sleep | null;
  heart: Heart | null;
  vo2Max: Vo2Max | null;
  fitnessAge: FitnessAge | null;
  trainingStatus: TrainingStatus | null;
  racePredictions: RacePredictions | null;
  /** Most recent first. */
  runs: Run[];
  /** Sections that failed to load, shown quietly in the footer. */
  warnings: string[];
}

/* ---------- History (Phase 2 trends) ---------- */

export const RANGES = ["7d", "4w", "3m", "1y"] as const;
export type Range = (typeof RANGES)[number];

/** One calendar day of wellness readings, as fetched. */
export interface DailyRaw {
  /** YYYY-MM-DD */
  date: string;
  bbHigh: number | null;
  bbLow: number | null;
  sleepScore: number | null;
  sleepSec: number | null;
  deepSec: number | null;
  lightSec: number | null;
  remSec: number | null;
  awakeSec: number | null;
  restingHr: number | null;
  hrv: number | null;
  /** Personal "balanced" HRV band from Garmin's baseline. */
  hrvLow: number | null;
  hrvHigh: number | null;
  vo2: number | null;
}

/** One chart position: a day, or a week (Mon–Sun) on longer ranges. */
export interface TrendPoint {
  /** First day of the bucket, YYYY-MM-DD. */
  start: string;
  bbHigh: number | null;
  bbLow: number | null;
  sleepScore: number | null;
  /** Hours */
  sleepH: number | null;
  deepH: number | null;
  lightH: number | null;
  remH: number | null;
  awakeH: number | null;
  restingHr: number | null;
  hrv: number | null;
  hrvLow: number | null;
  hrvHigh: number | null;
  vo2: number | null;
  distanceKm: number;
  runs: number;
  /** Rolling 7-day load and 28-day load per week, at the end of the bucket. */
  acuteLoad: number | null;
  chronicLoad: number | null;
}

export interface RunPoint {
  id: string;
  date: string;
  name: string;
  distanceKm: number;
  paceSecPerKm: number;
  avgHr: number;
}

export interface Trends {
  range: Range;
  bucket: "day" | "week";
  points: TrendPoint[];
  /** Runs in range with heart rate, for pace vs heart rate. */
  runs: RunPoint[];
  warnings: string[];
}
