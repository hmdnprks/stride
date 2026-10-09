import type { Dashboard as Data, InsightsData, RunningExtras, StrideSettings, Trends } from "@/lib/garmin";
import { goalProgress, racePlan, recoveryCheck, sleepPerformance, weeklySummary } from "@/lib/insights";
import { addDays, isoDate } from "@/lib/trends";
import { DistanceGoals, RaceCountdown } from "./goals";
import { DashboardFrame } from "./frame";
import { FitnessView, RunsView, TodayView } from "./views";

export function Dashboard({
  data,
  trends,
  extras,
  insights,
  settings,
}: {
  data: Data;
  trends: Trends;
  extras: RunningExtras;
  insights: InsightsData;
  settings: StrideSettings;
}) {
  const today = isoDate(new Date());
  const { daily, runs } = insights;
  const week = weeklySummary(daily, runs, today);
  const recovery = recoveryCheck(daily, runs, data.bodyBattery?.current ?? null, today);
  const sleepPerf = sleepPerformance(daily, runs.filter((r) => r.startLocal.slice(0, 10) >= addDays(today, -89)), extras.hrZones);
  const goals = goalProgress(extras.calendar, settings, today);
  const last28Km = runs.filter((r) => r.startLocal.slice(0, 10) > addDays(today, -28)).reduce((a, r) => a + r.distanceM, 0) / 1000;
  const plan = settings.race ? racePlan(settings.race, last28Km / 4, data.racePredictions, today) : null;
  const synced = new Date(data.fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <DashboardFrame
      name={data.athleteName}
      live={data.source === "garmin"}
      range={trends.range}
      views={{
        today: <TodayView data={data} trends={trends} recovery={recovery} week={week} />,
        fitness: <FitnessView data={data} trends={trends} sleepPerf={sleepPerf} />,
        runs: <RunsView data={data} trends={trends} extras={extras} />,
        goals: (
          <div className="flex flex-col gap-16">
            <RaceCountdown source={data.source} race={settings.race} plan={plan} />
            <DistanceGoals source={data.source} goals={goals} />
            <p className="text-sm text-muted-foreground">
              Goals and your race are saved on this computer, separately for {data.source === "demo" ? "the demo" : "your Garmin data"}.
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
