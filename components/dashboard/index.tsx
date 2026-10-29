import type { Dashboard as Data, InsightsData, RunningExtras, StrideSettings, Trends } from "@/lib/garmin";
import { goalProgress, racePlan, recoveryCheck, heatPerformance, HEAT_WEEKS, sleepPerformance, weeklySummary } from "@/lib/insights";
import { energyBurned } from "@/lib/energy";
import { buildRaces } from "@/lib/races";
import { addDays, isoDate } from "@/lib/trends";
import { DistanceGoals, RaceCountdown } from "./goals";
import { PastRaces } from "./races";
import { DashboardFrame } from "./frame";
import { FitnessView, RunsView, TodayView } from "./views";

export function Dashboard({
  data,
  trends,
  extras,
  insights,
  history,
  settings,
}: {
  data: Data;
  trends: Trends;
  extras: RunningExtras;
  insights: InsightsData;
  /** All stored days and runs, for past races. */
  history: InsightsData;
  settings: StrideSettings;
}) {
  const today = isoDate(new Date());
  const { daily, runs } = insights;
  const week = weeklySummary(daily, runs, today);
  const recovery = recoveryCheck(daily, runs, data.bodyBattery?.current ?? null, today);
  const sleepPerf = sleepPerformance(daily, runs.filter((r) => r.startLocal.slice(0, 10) >= addDays(today, -89)), extras.hrZones);
  // Insight data carries runs from 4 weeks before its 90 days, so 16 weeks of runs fit.
  const heatPerf = heatPerformance(runs.filter((r) => r.startLocal.slice(0, 10) >= addDays(today, -(HEAT_WEEKS * 7 - 1))), extras.hrZones);
  const energy = energyBurned(daily, runs, today);
  const goals = goalProgress(extras.calendar, settings, today);
  const last28Km = runs.filter((r) => r.startLocal.slice(0, 10) > addDays(today, -28)).reduce((a, r) => a + r.distanceM, 0) / 1000;
  const races = buildRaces(settings.races, history.runs, history.daily, today, settings.raceMarks);
  // Ring every race day on the calendar, Stride's marks and matched goals included.
  const raceDays = new Set(races.past.flatMap((r) => (r.run ? [r.run.startLocal.slice(0, 10)] : [])));
  const runningExtras = { ...extras, calendar: extras.calendar.map((d) => ({ ...d, race: raceDays.has(d.date) })) };
  const next = races.upcoming[0] ?? null;
  const plan = next ? racePlan(next, last28Km / 4, data.racePredictions, today) : null;
  const synced = new Date(data.fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <DashboardFrame
      name={data.athleteName}
      live={data.source === "garmin"}
      range={trends.range}
      views={{
        today: <TodayView data={data} trends={trends} recovery={recovery} week={week} />,
        fitness: <FitnessView data={data} trends={trends} sleepPerf={sleepPerf} heatPerf={heatPerf} />,
        runs: <RunsView data={data} trends={trends} extras={runningExtras} energy={energy} />,
        goals: (
          <div className="flex flex-col gap-16">
            <RaceCountdown source={data.source} race={next} plan={plan} latest={races.past[0] ?? null} later={races.upcoming.slice(1)} />
            <PastRaces source={data.source} races={races.past} />
            <DistanceGoals source={data.source} goals={goals} />
            <p className="text-sm text-muted-foreground">
              Goals and races are saved on this computer, separately for {data.source === "demo" ? "the demo" : "your Garmin data"}.
            </p>
          </div>
        ),
      }}
      footer={
        <div className="flex flex-col gap-2">
          <p>{data.source === "demo" ? "Sample data, not from a real watch." : `Synced from Garmin Connect at ${synced}.`}</p>
          {insights.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs">
              {insights.warnings.map((w) => (
                <li key={w}>Couldn&apos;t load {w}</li>
              ))}
            </ul>
          )}
          {data.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs">
              {data.warnings.map((w) => (
                <li key={w}>Couldn&apos;t load {w}</li>
              ))}
            </ul>
          )}
        </div>
      }
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-24 sm:px-8">
      <div className="flex flex-col gap-3">
        <div className="h-4 w-40 animate-pulse rounded-full bg-muted" />
        <div className="h-12 w-full max-w-lg animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-[28rem] animate-pulse rounded-[2rem] bg-muted" />
      <p className="text-sm text-muted-foreground">Loading your data from Garmin Connect…</p>
    </div>
  );
}
