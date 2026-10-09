import "server-only";

import { savedClient } from "./auth";
import { mapRun } from "./map";
import type { Dashboard } from "./types";

// Garmin has no public API for personal accounts. This uses the unofficial
// Connect endpoints (same ones the web app calls) via the `garmin-connect`
// package. Endpoints can change without notice, so every section is fetched
// independently and a failure only blanks that one card.

const API = "https://connectapi.garmin.com";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

function isoDate(d: Date) {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function titleCase(raw: string) {
  return raw
    .replace(/_\d+$/, "")
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function getLiveDashboard(): Promise<Dashboard> {
  const { gc, save } = savedClient();
  const get = (url: string, params?: Record<string, unknown>) =>
    gc.get<Json>(`${API}${url}`, params ? { params } : undefined);

  const profile = await gc.getUserProfile();
  const user = profile.displayName;
  const today = isoDate(new Date());
  const warnings: string[] = [];

  async function section<T>(label: string, load: () => Promise<T | null>): Promise<T | null> {
    try {
      return await load();
    } catch (err) {
      warnings.push(`${label}: ${err instanceof Error ? err.message : "failed"}`);
      return null;
    }
  }

  const summaryP = section("Daily summary", () =>
    get(`/usersummary-service/usersummary/daily/${user}`, { calendarDate: today }),
  );

  const [summary, sleep, hrv, vo2Max, fitnessAge, trainingStatus, racePredictions, runs] =
    await Promise.all([
      summaryP,

      section("Sleep", async () => {
        const raw = await get(`/wellness-service/wellness/dailySleepData/${user}`, {
          date: today,
          nonSleepBufferMinutes: 60,
        });
        const s = raw?.dailySleepDTO;
        const score = s?.sleepScores?.overall?.value;
        if (typeof score !== "number") return null;
        return {
          score,
          qualifier: s.sleepScores.overall.qualifierKey ? titleCase(s.sleepScores.overall.qualifierKey) : null,
          durationSec: s.sleepTimeSeconds ?? 0,
          deepSec: s.deepSleepSeconds ?? 0,
          lightSec: s.lightSleepSeconds ?? 0,
          remSec: s.remSleepSeconds ?? 0,
          awakeSec: s.awakeSleepSeconds ?? 0,
        };
      }),

      section("HRV", async () => {
        const raw = await get(`/hrv-service/hrv/${today}`);
        return raw?.hrvSummary ?? null;
      }),

      section("VO2 max", async () => {
        const raw: Json[] = await get(`/metrics-service/metrics/maxmet/daily/${isoDate(daysAgo(45))}/${today}`);
        const values = (raw ?? [])
          .map((r) => ({ date: r?.generic?.calendarDate as string, v: r?.generic?.vo2MaxPreciseValue ?? r?.generic?.vo2MaxValue }))
          .filter((r) => typeof r.v === "number")
          .sort((a, b) => a.date.localeCompare(b.date));
        if (!values.length) return null;
        const latest = values[values.length - 1];
        const cutoff = isoDate(daysAgo(30));
        const old = values.find((r) => r.date >= cutoff) ?? values[0];
        return {
          value: Math.round(latest.v * 10) / 10,
          change30d: old === latest ? null : Math.round((latest.v - old.v) * 10) / 10,
        };
      }),

      section("Fitness age", async () => {
        const raw = await get(`/fitnessage-service/fitnessage/${today}`);
        if (typeof raw?.fitnessAge !== "number") return null;
        return {
          fitnessAge: Math.round(raw.fitnessAge),
          chronologicalAge: raw.chronologicalAge,
          achievable: typeof raw.achievableFitnessAge === "number" ? Math.round(raw.achievableFitnessAge) : null,
        };
      }),

      section("Training status", async () => {
        const raw = await get(`/metrics-service/metrics/trainingstatus/aggregated/${today}`);
        const byDevice = raw?.mostRecentTrainingStatus?.latestTrainingStatusData ?? {};
        const latest: Json = Object.values(byDevice)[0];
        if (!latest?.trainingStatusFeedbackPhrase) return null;
        return {
          status: titleCase(latest.trainingStatusFeedbackPhrase),
          acuteLoad: latest.acuteTrainingLoadDTO?.dailyTrainingLoadAcute ?? null,
        };
      }),

      section("Race predictions", async () => {
        const raw = await get(`/metrics-service/metrics/racepredictions/latest/${user}`);
        if (!raw) return null;
        return {
          fiveK: raw.time5K ?? null,
          tenK: raw.time10K ?? null,
          half: raw.timeHalfMarathon ?? null,
          marathon: raw.timeMarathon ?? null,
        };
      }),

      section("Runs", async () => {
        const raw: Json[] = await get(`/activitylist-service/activities/search/activities`, {
          start: 0,
          limit: 60,
          activityType: "running",
        });
        return (raw ?? []).map(mapRun);
      }),
    ]);

  // Tokens may have been refreshed during the requests above.
  save();

  const s: Json = summary;
  return {
    source: "garmin",
    fetchedAt: new Date().toISOString(),
    athleteName: profile.fullName?.split(" ")[0] || profile.displayName,
    bodyBattery:
      typeof s?.bodyBatteryMostRecentValue === "number"
        ? {
            current: s.bodyBatteryMostRecentValue,
            high: s.bodyBatteryHighestValue ?? s.bodyBatteryMostRecentValue,
            low: s.bodyBatteryLowestValue ?? s.bodyBatteryMostRecentValue,
            charged: s.bodyBatteryChargedValue ?? 0,
            drained: s.bodyBatteryDrainedValue ?? 0,
          }
        : null,
    sleep,
    heart: {
      restingHr: s?.restingHeartRate ?? null,
      hrvLastNight: hrv?.lastNightAvg ?? null,
      hrvWeeklyAvg: hrv?.weeklyAvg ?? null,
      hrvStatus: hrv?.status ? titleCase(hrv.status) : null,
    },
    vo2Max,
    fitnessAge,
    trainingStatus,
    racePredictions,
    runs: runs ?? [],
    warnings,
  };
}
