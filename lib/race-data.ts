import "server-only";

import { getDemoHistory, getGarminAllHistory, type DataSource } from "./garmin";
import { buildRaces } from "./races";
import { getSettings } from "./settings";
import { isoDate } from "./trends";

/** Every race for the run page, the year in review and the export, from all stored history. */
export async function getRaces(source: DataSource, today = isoDate(new Date())) {
  const [settings, history] = await Promise.all([
    getSettings(source),
    source === "demo" ? getDemoHistory(400) : getGarminAllHistory().catch(() => null),
  ]);
  const races = history
    ? buildRaces(settings.races, history.runs, history.daily, today, settings.raceMarks)
    : { upcoming: [], past: [] };
  return { races, marks: settings.raceMarks, runs: history?.runs ?? [] };
}
