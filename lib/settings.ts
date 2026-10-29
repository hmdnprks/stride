import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { DataSource, RaceGoal, StrideSettings } from "./garmin/types";
import { DEMO_RACES } from "./garmin/demo";
import { kvGet, kvSet } from "./kv";

// Goals and races, stored in the key-value store (a JSON file in
// .stride/ during local development). Demo and live data keep separate settings.

const EMPTY: StrideSettings = { monthKm: null, yearKm: null, races: [], raceMarks: {} };

/** As saved: earlier versions kept a single `race` instead of the list. */
type Saved = Partial<StrideSettings> & { race?: Omit<RaceGoal, "id"> | null };
/** Where earlier local versions kept settings; read so local goals carry over. */
const LEGACY_FILE = path.join(process.cwd(), ".stride", "settings.json");

function legacy(source: DataSource): Saved | null {
  try {
    return JSON.parse(fs.readFileSync(LEGACY_FILE, "utf8"))[source] ?? null;
  } catch {
    return null;
  }
}
const key = (source: DataSource) => `settings:${source}`;

/** Sample goals so the demo shows every state out of the box: a race coming up and one run. */
function demoDefaults(): StrideSettings {
  const race = new Date();
  race.setDate(race.getDate() + 26);
  const date = `${race.getFullYear()}-${String(race.getMonth() + 1).padStart(2, "0")}-${String(race.getDate()).padStart(2, "0")}`;
  const past = DEMO_RACES().find((r) => r.goal)!;
  return {
    monthKm: 200,
    yearKm: 2400,
    races: [
      { id: "demo-next", name: "City Half Marathon", date, distanceKm: 21.0975 },
      { id: "demo-past", name: past.name, date: past.date, distanceKm: past.km },
    ],
    raceMarks: {},
  };
}

/** The saved settings, with an old single race moved into the list. */
async function readSaved(source: DataSource): Promise<Partial<StrideSettings>> {
  const { race, ...saved } = (await kvGet<Saved>(key(source))) ?? legacy(source) ?? {};
  if (race && !saved.races) saved.races = [{ id: `race-${race.date}`, ...race }];
  return saved;
}

export async function getSettings(source: DataSource): Promise<StrideSettings> {
  const saved = await readSaved(source);
  return { ...(source === "demo" ? demoDefaults() : EMPTY), ...saved };
}

/** Stores only what the runner changed, so demo defaults (like a race date
 * relative to today) aren't frozen in by an unrelated edit. */
export async function saveSettings(source: DataSource, patch: Partial<StrideSettings>) {
  await kvSet(key(source), { ...(await readSaved(source)), ...patch });
}

/** Mark a run as a race (true), not a race (false), or back to Garmin's mark (null). */
export async function markRace(source: DataSource, runId: string, race: boolean | null) {
  const { races, raceMarks } = await getSettings(source);
  const marks = { ...raceMarks };
  if (race === null) delete marks[runId];
  else marks[runId] = race;
  // A race picked for a goal by hand stops being its run once it's "not a race".
  const unpicked = race === false && races.some((r) => r.runId === runId);
  await saveSettings(source, { raceMarks: marks, ...(unpicked && { races: races.map((r) => (r.runId === runId ? { ...r, runId: null } : r)) }) });
}

/** Change the race list; `change` gets the current list (demo defaults included). */
export async function updateRaces(source: DataSource, change: (races: RaceGoal[]) => RaceGoal[]) {
  await saveSettings(source, { races: change((await getSettings(source)).races) });
}
