import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { DataSource, StrideSettings } from "./garmin/types";
import { kvGet, kvSet } from "./kv";

// Goals and the target race, stored in the key-value store (a JSON file in
// .stride/ during local development). Demo and live data keep separate settings.

const EMPTY: StrideSettings = { monthKm: null, yearKm: null, race: null };
/** Where earlier local versions kept settings; read so local goals carry over. */
const LEGACY_FILE = path.join(process.cwd(), ".stride", "settings.json");

function legacy(source: DataSource): Partial<StrideSettings> | null {
  try {
    return JSON.parse(fs.readFileSync(LEGACY_FILE, "utf8"))[source] ?? null;
  } catch {
    return null;
  }
}
const key = (source: DataSource) => `settings:${source}`;

/** Sample goals so the demo shows every state out of the box. */
function demoDefaults(): StrideSettings {
  const race = new Date();
  race.setDate(race.getDate() + 26);
  const date = `${race.getFullYear()}-${String(race.getMonth() + 1).padStart(2, "0")}-${String(race.getDate()).padStart(2, "0")}`;
  return { monthKm: 200, yearKm: 2400, race: { name: "City Half Marathon", date, distanceKm: 21.0975 } };
}

export async function getSettings(source: DataSource): Promise<StrideSettings> {
  const saved = (await kvGet<Partial<StrideSettings>>(key(source))) ?? legacy(source);
  const base = source === "demo" ? demoDefaults() : EMPTY;
  return saved ? { ...base, ...saved } : base;
}

/** Stores only what the runner changed, so demo defaults (like a race date
 * relative to today) aren't frozen in by an unrelated edit. */
export async function saveSettings(source: DataSource, patch: Partial<StrideSettings>) {
  const saved = (await kvGet<Partial<StrideSettings>>(key(source))) ?? legacy(source) ?? {};
  await kvSet(key(source), { ...saved, ...patch });
}
