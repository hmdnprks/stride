import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { DataSource, StrideSettings } from "./garmin/types";

// Goals and the target race live in a small JSON file next to the app. It's a
// single-user app running on your own machine, so a file is all it needs.
// Demo and live data keep separate settings.

const FILE = path.join(process.cwd(), ".stride", "settings.json");

const EMPTY: StrideSettings = { monthKm: null, yearKm: null, race: null };

/** Sample goals so the demo shows every state out of the box. */
function demoDefaults(): StrideSettings {
  const race = new Date();
  race.setDate(race.getDate() + 26);
  const date = `${race.getFullYear()}-${String(race.getMonth() + 1).padStart(2, "0")}-${String(race.getDate()).padStart(2, "0")}`;
  return { monthKm: 200, yearKm: 2400, race: { name: "City Half Marathon", date, distanceKm: 21.0975 } };
}

type FileShape = Partial<Record<DataSource, StrideSettings>>;

function readFile(): FileShape {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

export function getSettings(source: DataSource): StrideSettings {
  const saved = readFile()[source];
  const base = source === "demo" ? demoDefaults() : EMPTY;
  return saved ? { ...base, ...saved } : base;
}

/** Stores only what the runner changed, so demo defaults (like a race date
 * relative to today) aren't frozen into the file by an unrelated edit. */
export function saveSettings(source: DataSource, patch: Partial<StrideSettings>) {
  const all = readFile();
  all[source] = { ...all[source], ...patch } as StrideSettings;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
}
