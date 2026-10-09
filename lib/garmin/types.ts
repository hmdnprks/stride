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
  /** Seconds in heart-rate zones 1–5, or null when unknown. */
  hrZones: [number, number, number, number, number] | null;
  /** Running dynamics averages (null when the watch didn't record them). */
  cadenceSpm: number | null;
  strideCm: number | null;
  groundContactMs: number | null;
  verticalRatioPct: number | null;
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
  /** Predicted race times, seconds. */
  pred5k: number | null;
  pred10k: number | null;
  predHalf: number | null;
  predMarathon: number | null;
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
  /** Hours in each heart-rate zone across the bucket's runs. */
  z1H: number | null;
  z2H: number | null;
  z3H: number | null;
  z4H: number | null;
  z5H: number | null;
  /** Distance-weighted running dynamics across the bucket's runs. */
  cadenceSpm: number | null;
  strideCm: number | null;
  groundContactMs: number | null;
  verticalRatioPct: number | null;
  /** Latest predicted race times in the bucket, seconds. */
  pred5k: number | null;
  pred10k: number | null;
  predHalf: number | null;
  predMarathon: number | null;
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

/* ---------- Phase 3: records, gear, calendar, activity detail ---------- */

export interface PersonalRecord {
  /** e.g. "5K" */
  label: string;
  distanceM: number;
  timeSec: number;
  /** YYYY-MM-DD */
  date: string | null;
  activityId: string | null;
}

export interface Gear {
  id: string;
  name: string;
  distanceM: number;
  runs: number;
  /** Replacement distance; Garmin's per-shoe setting, or a default. */
  limitM: number;
  /** True when the limit is the default rather than set in Garmin. */
  defaultLimit: boolean;
  since: string | null;
}

export interface CalendarDay {
  date: string;
  km: number;
  runs: number;
}

/** Heart-rate zone boundaries as set on the watch / in Garmin Connect. */
export interface HrZoneSettings {
  /** Lower bound of zones 1–5, bpm. Zone n runs to just below zone n+1's floor. */
  floors: [number, number, number, number, number];
  maxHr: number;
  /** How the zones were set: "HR_MAX", "HRR" (reserve) or "LTHR" (lactate threshold). */
  method: string | null;
}

/** Things that don't follow the trend range: all-time PRs, gear, the year calendar. */
export interface RunningExtras {
  records: PersonalRecord[];
  gear: Gear[];
  hrZones: HrZoneSettings | null;
  /** Last 52 full weeks plus this week, oldest first. */
  calendar: CalendarDay[];
  warnings: string[];
}

export interface ActivitySample {
  /** Distance from start, km */
  km: number;
  paceSecPerKm: number | null;
  hr: number | null;
  elevationM: number | null;
  cadenceSpm: number | null;
}

export interface Split {
  /** 1-based kilometre (last split may be partial). */
  index: number;
  distanceM: number;
  durationSec: number;
  avgHr: number | null;
  elevationGainM: number | null;
  cadenceSpm: number | null;
}

export interface ActivityDetail {
  run: Run;
  maxHr: number | null;
  calories: number | null;
  /** [lat, lon] pairs; empty for treadmill runs. */
  route: [number, number][];
  samples: ActivitySample[];
  splits: Split[];
  warnings: string[];
}

/* ---------- Phase 4: insights, goals, race ---------- */

/** 90 days of daily readings plus runs, for the insight cards. */
export interface InsightsData {
  daily: DailyRaw[];
  runs: Run[];
  warnings: string[];
}

export interface RaceGoal {
  name: string;
  /** YYYY-MM-DD */
  date: string;
  distanceKm: number;
}

/** Things the runner sets in Stride itself. */
export interface StrideSettings {
  monthKm: number | null;
  yearKm: number | null;
  race: RaceGoal | null;
}
