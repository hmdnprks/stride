import "server-only";

import { savedClient } from "./auth";
import { mapRun } from "./map";
import type { Gear, HrZoneSettings, PersonalRecord, Run, RunningExtras } from "./types";
import { buildCalendar, calendarStart, isoDate } from "../trends";

// Personal records, shoes and the year calendar. These don't follow the trend
// range, so they're fetched and cached on their own.

const API = "https://connectapi.garmin.com";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

/** Shoe replacement distance when none is set in Garmin Connect. */
export const DEFAULT_SHOE_LIMIT_M = 700_000;

// Connect's personal-record type IDs for running. 1–5 are confirmed against a
// real account (the API returns no labels, only these IDs); 6 (marathon)
// follows the same sequence. 7 is "longest run", a distance, so it's skipped.
const PR_TYPES: Record<number, { label: string; distanceM: number }> = {
  1: { label: "1K", distanceM: 1000 },
  2: { label: "1 mile", distanceM: 1609.34 },
  3: { label: "5K", distanceM: 5000 },
  4: { label: "10K", distanceM: 10000 },
  5: { label: "Half marathon", distanceM: 21097.5 },
  6: { label: "Marathon", distanceM: 42195 },
};

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);

export async function getLiveExtras(): Promise<RunningExtras> {
  const { gc, save } = savedClient();
  const get = (url: string, params?: Record<string, unknown>) =>
    gc.get<Json>(`${API}${url}`, params ? { params } : undefined);
  const profile = await gc.getUserProfile();
  const today = isoDate(new Date());
  const warnings: string[] = [];

  async function section<T>(label: string, fallback: T, load: () => Promise<T>): Promise<T> {
    try {
      return await load();
    } catch (err) {
      warnings.push(`${label}: ${err instanceof Error ? err.message : "failed"}`);
      return fallback;
    }
  }

  const [records, gear, runs, hrZones] = await Promise.all([
    section<PersonalRecord[]>("Personal records", [], async () => {
      // Path is case-sensitive: "personalrecord", all lowercase.
      const raw: Json[] = await get(`/personalrecord-service/personalrecord/prs/${profile.displayName}`);
      return (raw ?? [])
        .filter((r) => PR_TYPES[r?.typeId] && num(r?.value))
        .map((r) => {
          // Prefer local time: an early run's GMT date can be the day before.
          const stamp: string | undefined =
            r.activityStartDateTimeLocalFormatted ?? r.prStartTimeLocalFormatted ?? r.actStartDateTimeInGMTFormatted;
          return {
            ...PR_TYPES[r.typeId],
            timeSec: Math.round(r.value),
            date: stamp ? stamp.slice(0, 10) : null,
            activityId: r.activityId ? String(r.activityId) : null,
          };
        })
        .sort((a, b) => a.distanceM - b.distanceM);
    }),

    section<Gear[]>("Shoes", [], async () => {
      const raw: Json[] = await get(`/gear-service/gear/filterGear`, { userProfilePk: profile.profileId });
      const shoes = (raw ?? []).filter(
        (g) => String(g?.gearStatusName ?? "active").toLowerCase() === "active" && /shoe/i.test(String(g?.gearTypeName ?? "Shoes")),
      );
      return Promise.all(
        shoes.map(async (g): Promise<Gear> => {
          const stats = await get(`/gear-service/gear/stats/${g.uuid}`).catch(() => null);
          const limit = num(g.maximumMeters);
          return {
            id: String(g.uuid),
            name: g.displayName || g.customMakeModel || "Shoes",
            distanceM: num(stats?.totalDistance) ?? 0,
            runs: num(stats?.totalActivities) ?? 0,
            limitM: limit && limit > 0 ? limit : DEFAULT_SHOE_LIMIT_M,
            defaultLimit: !(limit && limit > 0),
            since: typeof g.dateBegin === "string" ? g.dateBegin.slice(0, 10) : null,
          };
        }),
      );
    }),

    section<Run[]>("Training calendar", [], async () => {
      const PAGE = 100;
      let all: Run[] = [];
      for (let start = 0; ; start += PAGE) {
        const page: Json[] = await get(`/activitylist-service/activities/search/activities`, {
          start,
          limit: PAGE,
          activityType: "running",
          startDate: calendarStart(today),
          endDate: today,
        });
        all = all.concat((page ?? []).map(mapRun));
        if (!page || page.length < PAGE) break;
      }
      return all;
    }),

    section<HrZoneSettings | null>("Heart-rate zones", null, async () => {
      const raw: Json[] = await get(`/biometric-service/heartRateZones`);
      const list = Array.isArray(raw) ? raw : [];
      // Running-specific zones if set, else the default ones.
      const z = list.find((x) => x?.sport === "RUNNING") ?? list.find((x) => x?.sport === "DEFAULT") ?? list[0];
      const floors = [1, 2, 3, 4, 5].map((i) => num(z?.[`zone${i}Floor`]));
      const maxHr = num(z?.maxHeartRateUsed);
      if (!maxHr || floors.some((f) => f === null)) return null;
      return { floors: floors as HrZoneSettings["floors"], maxHr, method: typeof z.trainingMethod === "string" ? z.trainingMethod : null };
    }),
  ]);

  save();
  return { records, gear, hrZones, calendar: buildCalendar(runs, today), warnings };
}
