import type { DailyRaw, Run } from "./garmin/types";

// CSV exports of everything Stride has stored: one row per run, and one row
// per day of wellness readings. Metric units, named in the headers.
//
// Durations and paces are written as h:mm:ss even under an hour, because
// spreadsheets read "21:45" as a time of day (or 21 hours), not 21 minutes.

export const EXPORTS = {
  runs: "Runs",
  daily: "Daily readings",
} as const;
export type ExportKind = keyof typeof EXPORTS;

export const isExportKind = (v: unknown): v is ExportKind => typeof v === "string" && v in EXPORTS;

type Cell = string | number | null;

/** 0:21:45, or empty when unknown. */
function hms(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const s = Math.round(seconds);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

const fixed = (x: number | null, digits: number) => (x === null ? null : Number(x.toFixed(digits)));
const hours = (sec: number | null) => (sec === null ? null : fixed(sec / 3600, 2));

function escape(cell: Cell) {
  if (cell === null) return "";
  let s = String(cell);
  // A run name starting with = + - @ would run as a formula in Excel or Sheets.
  if (typeof cell === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(header: string[], rows: Cell[][]) {
  // The byte-order mark makes Excel read the file as UTF-8 (run names, accents).
  return "﻿" + [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n") + "\r\n";
}

export function runsCsv(runs: Run[], { garmin }: { garmin: boolean }) {
  const header = [
    "Date",
    "Start time",
    "Name",
    "Distance (km)",
    "Duration",
    "Pace (per km)",
    "Avg heart rate (bpm)",
    "Elevation gain (m)",
    "Training load",
    "Training load source",
    ...[1, 2, 3, 4, 5].map((z) => `Zone ${z} (min)`),
    "Cadence (spm)",
    "Stride length (cm)",
    "Ground contact (ms)",
    "Vertical ratio (%)",
    "Garmin Connect link",
  ];
  const rows = [...runs]
    .sort((a, b) => b.startLocal.localeCompare(a.startLocal))
    .map((r) => [
      r.startLocal.slice(0, 10),
      r.startLocal.slice(11, 16),
      r.name,
      fixed(r.distanceM / 1000, 2),
      hms(r.durationSec),
      hms(r.distanceM ? r.durationSec / (r.distanceM / 1000) : null),
      r.avgHr,
      fixed(r.elevationGainM, 0),
      fixed(r.load, 0),
      r.load === null ? null : r.loadEstimated ? "Estimated from heart-rate zones" : "Garmin",
      ...[0, 1, 2, 3, 4].map((z) => (r.hrZones ? fixed(r.hrZones[z] / 60, 1) : null)),
      fixed(r.cadenceSpm, 0),
      fixed(r.strideCm, 0),
      fixed(r.groundContactMs, 0),
      fixed(r.verticalRatioPct, 1),
      garmin ? `https://connect.garmin.com/modern/activity/${r.id}` : null,
    ]);
  return csv(header, rows);
}

export function dailyCsv(days: DailyRaw[]) {
  const header = [
    "Date",
    "Body battery high",
    "Body battery low",
    "Sleep score",
    "Sleep (h)",
    "Deep sleep (h)",
    "Light sleep (h)",
    "REM sleep (h)",
    "Awake (h)",
    "Resting heart rate (bpm)",
    "Overnight HRV (ms)",
    "HRV balanced low (ms)",
    "HRV balanced high (ms)",
    "VO2 max",
    "Predicted 5K",
    "Predicted 10K",
    "Predicted half marathon",
    "Predicted marathon",
  ];
  // Days with no readings at all (watch not worn) are left out.
  const rows = days
    .filter((d) => Object.entries(d).some(([k, v]) => k !== "date" && v !== null))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((d) => [
      d.date,
      d.bbHigh,
      d.bbLow,
      d.sleepScore,
      hours(d.sleepSec),
      hours(d.deepSec),
      hours(d.lightSec),
      hours(d.remSec),
      hours(d.awakeSec),
      d.restingHr,
      d.hrv,
      d.hrvLow,
      d.hrvHigh,
      fixed(d.vo2, 1),
      hms(d.pred5k),
      hms(d.pred10k),
      hms(d.predHalf),
      hms(d.predMarathon),
    ]);
  return csv(header, rows);
}
