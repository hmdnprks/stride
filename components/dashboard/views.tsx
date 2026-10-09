import Link from "next/link";
import type { ReactNode } from "react";
import type { Dashboard, Run, RunningExtras, Sleep, Trends } from "@/lib/garmin";
import type { recoveryCheck, sleepPerformance, weeklySummary } from "@/lib/insights";
import { clock, hm, km, pace, paceOf, runningTotals, shortDate } from "@/lib/format";
import { CalendarHeatmap } from "../charts/calendar-heatmap";
import { Sparkline } from "../charts/sparkline";
import { WatchFace } from "../watch-face";
import { RecoveryCheck, SleepPerformance, WeeklySummary } from "./insights";
import { PersonalRecords, ShoeMileage } from "./records";
import { FitnessTrends, RecoveryTrends, RunningTrends } from "./trends";

/* Shared bits */

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="wide text-lg font-semibold">{children}</h2>;
}

function Figure({
  label,
  value,
  unit,
  note,
  trend,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  trend?: (number | null)[];
}) {
  return (
    <div className="flex flex-col gap-3 border-t-2 border-foreground pt-4">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="num text-[5rem] font-bold sm:text-[6.5rem]">{value}</span>
        {unit && <span className="text-base font-medium text-muted-foreground">{unit}</span>}
        {trend && <Sparkline values={trend} color="var(--series)" className="ml-auto self-end" />}
      </span>
      {note && <p className="max-w-[32ch] text-sm leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}

function Missing({ what }: { what: string }) {
  return <p className="text-sm text-muted-foreground">No {what} yet. Wear your watch overnight and sync it.</p>;
}

/* Today */

function readiness({ bodyBattery, sleep }: Dashboard) {
  if (!bodyBattery) return { headline: "Sync your watch to see today's readiness.", detail: null };
  const bb = bodyBattery.current;
  const detail = `Body battery ${bb}${sleep ? ` after ${hm(sleep.durationSec)} of sleep` : ""}.`;
  if (bb >= 70 && (sleep?.score ?? 100) >= 75) return { headline: "Ready for a quality session.", detail };
  if (bb >= 40) return { headline: "Good for an easy aerobic run.", detail };
  return { headline: "Take it easy today.", detail };
}

function BatteryRange({ low, high, current }: { low: number; high: number; current: number }) {
  return (
    <div className="relative h-10" role="img" aria-label={`Body battery ranged from ${low} to ${high} today and is now ${current}`}>
      <div className="absolute inset-x-0 top-4 h-2 rounded-full bg-lane" />
      <div className="absolute top-4 h-2 rounded-full bg-primary/35" style={{ left: `${low}%`, width: `${high - low}%` }} />
      <div className="absolute top-1 h-8 w-1 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${current}%` }} />
      <span className="absolute top-full mt-1 text-xs text-muted-foreground tabular-nums" style={{ left: `${low}%` }}>
        {low}
      </span>
      <span className="absolute top-full mt-1 text-xs text-muted-foreground tabular-nums" style={{ right: `${100 - high}%` }}>
        {high}
      </span>
    </div>
  );
}

function SleepStages({ sleep }: { sleep: Sleep }) {
  const stages = [
    { label: "Deep", sec: sleep.deepSec, color: "bg-stage-deep" },
    { label: "Light", sec: sleep.lightSec, color: "bg-stage-light" },
    { label: "REM", sec: sleep.remSec, color: "bg-stage-rem" },
    { label: "Awake", sec: sleep.awakeSec, color: "bg-stage-awake" },
  ];
  const total = stages.reduce((a, s) => a + s.sec, 0) || 1;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {stages.map((s) => (
          <div key={s.label} className={s.color} style={{ width: `${(s.sec / total) * 100}%` }} />
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        {stages.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:gap-1">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className={`size-2.5 rounded-full ${s.color}`} />
              {s.label}
            </dt>
            <dd className="text-base font-semibold tabular-nums">{hm(s.sec)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function TodayView({
  data,
  trends,
  recovery,
  week,
}: {
  data: Dashboard;
  trends: Trends;
  recovery: ReturnType<typeof recoveryCheck>;
  week: ReturnType<typeof weeklySummary>;
}) {
  const recent = (key: keyof Trends["points"][number]) =>
    trends.points.slice(-14).map((p) => (typeof p[key] === "number" ? (p[key] as number) : null));
  const { bodyBattery: bb, sleep, heart } = data;
  const { headline, detail } = readiness(data);
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col gap-10">
      <header className="flex max-w-3xl flex-col gap-3">
        <p className="text-base text-muted-foreground">{date}</p>
        <h1 className="wide text-2xl leading-[1.05] font-bold text-balance sm:text-3xl">{headline}</h1>
        {detail && <p className="text-lg text-muted-foreground">{detail}</p>}
      </header>

      {recovery.level !== "ok" && <RecoveryCheck check={recovery} />}

      <div className="flex flex-col gap-3">
        <WatchFace
          fields={[
            {
              label: "Body battery",
              value: bb?.current ?? null,
              score: bb?.current,
              note: bb ? `Low ${bb.low}, high ${bb.high}` : "Not synced",
              trend: recent("bbHigh"),
            },
            {
              label: "Sleep score",
              value: sleep?.score ?? null,
              score: sleep?.score,
              note: sleep ? [hm(sleep.durationSec), sleep.qualifier?.toLowerCase()].filter(Boolean).join(", ") : "Not synced",
              trend: recent("sleepScore"),
            },
            {
              label: "Resting heart rate",
              value: heart?.restingHr ?? null,
              unit: "bpm",
              trend: recent("restingHr"),
            },
            {
              label: "Overnight HRV",
              value: heart?.hrvLastNight ?? null,
              unit: "ms",
              note:
                heart?.hrvWeeklyAvg != null
                  ? `7-day average ${heart.hrvWeeklyAvg}${heart.hrvStatus ? `, ${heart.hrvStatus.toLowerCase()}` : ""}`
                  : undefined,
              trend: recent("hrv"),
            },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          Body battery and sleep score get heavier as they rise. Lines show the last {Math.min(14, trends.points.length)}{" "}
          {trends.bucket === "week" ? "weeks" : "days"}.
        </p>
      </div>

      <div className="grid gap-12 md:grid-cols-2 md:gap-16">
        <section className="flex flex-col gap-6">
          <Heading>Body battery through the day</Heading>
          {bb ? (
            <>
              <BatteryRange low={bb.low} high={bb.high} current={bb.current} />
              <dl className="mt-4 flex gap-10">
                <div className="flex flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">Charged</dt>
                  <dd className="num text-[3.25rem] font-semibold">+{bb.charged}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">Drained</dt>
                  <dd className="num text-[3.25rem] font-semibold">−{bb.drained}</dd>
                </div>
              </dl>
            </>
          ) : (
            <Missing what="body battery data" />
          )}
        </section>

        <section className="flex flex-col gap-6">
          <Heading>Last night&apos;s sleep</Heading>
          {sleep ? <SleepStages sleep={sleep} /> : <Missing what="sleep data" />}
        </section>
      </div>

      {recovery.level === "ok" && <RecoveryCheck check={recovery} />}
      <WeeklySummary week={week} />

      <RecoveryTrends trends={trends} />
    </div>
  );
}

/* Fitness */

export function FitnessView({
  data,
  trends,
  sleepPerf,
}: {
  data: Dashboard;
  trends: Trends;
  sleepPerf: ReturnType<typeof sleepPerformance>;
}) {
  const { vo2Max, fitnessAge, trainingStatus, racePredictions: rp } = data;
  const races = rp
    ? [
        { label: "5K", t: rp.fiveK, d: 5 },
        { label: "10K", t: rp.tenK, d: 10 },
        { label: "Half marathon", t: rp.half, d: 21.0975 },
        { label: "Marathon", t: rp.marathon, d: 42.195 },
      ]
    : [];
  const younger = fitnessAge ? fitnessAge.chronologicalAge - fitnessAge.fitnessAge : 0;

  return (
    <div className="flex flex-col gap-16">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {vo2Max ? (
          <Figure
            label="VO2 max"
            value={vo2Max.value}
            unit="ml/kg/min"
            trend={trends.points.map((p) => p.vo2)}
            note={
              vo2Max.change30d === null
                ? "Not enough history for a trend yet."
                : vo2Max.change30d === 0
                  ? "Unchanged over the last 30 days."
                  : `${vo2Max.change30d > 0 ? "Up" : "Down"} ${Math.abs(vo2Max.change30d)} over the last 30 days.`
            }
          />
        ) : (
          <Missing what="VO2 max estimate" />
        )}

        {fitnessAge ? (
          <Figure
            label="Fitness age"
            value={fitnessAge.fitnessAge}
            unit="years"
            note={
              <>
                {younger > 0
                  ? `${younger} years younger than your real age of ${fitnessAge.chronologicalAge}.`
                  : `Your real age is ${fitnessAge.chronologicalAge}.`}
                {fitnessAge.achievable !== null && ` You could reach ${fitnessAge.achievable}.`}
              </>
            }
          />
        ) : (
          <Missing what="fitness age" />
        )}

        {trainingStatus ? (
          <div className="flex flex-col gap-3 border-t-2 border-foreground pt-4">
            <span className="text-sm font-medium text-muted-foreground">Training status</span>
            <span className="wide pt-3 text-2xl leading-none font-bold text-primary sm:text-3xl">{trainingStatus.status}</span>
            {trainingStatus.acuteLoad !== null && (
              <p className="pt-3 text-sm text-muted-foreground">Acute load {Math.round(trainingStatus.acuteLoad)}</p>
            )}
          </div>
        ) : (
          <Missing what="training status" />
        )}
      </div>

      <section className="flex flex-col gap-4">
        <Heading>Race predictions</Heading>
        {races.length ? (
          <ul>
            {races.map((r) => (
              <li
                key={r.label}
                className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 border-b border-border py-4 sm:grid-cols-[14rem_1fr_auto]"
              >
                <span className="text-lg font-semibold">{r.label}</span>
                <span className="num text-right text-[3.25rem] font-semibold sm:text-left">{r.t ? clock(r.t) : "--"}</span>
                {r.t && (
                  <span className="col-span-2 text-sm text-muted-foreground tabular-nums sm:col-span-1">
                    {pace(r.t / r.d)} per km
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Missing what="race predictions" />
        )}
      </section>

      <SleepPerformance result={sleepPerf} />

      <FitnessTrends trends={trends} />
    </div>
  );
}

/* Runs */

function RunRow({ run, href }: { run: Run; href: string }) {
  return (
    <li className="border-b border-border">
      <Link
        href={href}
        className="group -mx-3 grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 rounded-xl px-3 py-4 transition-colors hover:bg-muted md:grid-cols-[8rem_1fr_7rem_6rem_6rem_4rem]"
      >
        <span className="order-2 text-sm text-muted-foreground md:order-none">{shortDate(run.startLocal)}</span>
        <span className="order-1 font-semibold underline-offset-4 group-hover:underline md:order-none">{run.name}</span>
        <span className="order-1 text-right md:order-none">
          <span className="num text-[2.375rem] font-semibold">{km(run.distanceM, 2)}</span>
          <span className="ml-1 text-sm text-muted-foreground">km</span>
        </span>
        <span className="order-3 col-span-2 flex gap-4 text-sm tabular-nums md:order-none md:col-span-3 md:grid md:grid-cols-[6rem_6rem_4rem] md:text-right md:text-base">
          <span>{clock(run.durationSec)}</span>
          <span className="font-semibold text-primary">{pace(paceOf(run))} /km</span>
          <span className="text-muted-foreground">{run.avgHr ? `${run.avgHr} bpm` : ""}</span>
        </span>
      </Link>
    </li>
  );
}

export function RunsView({ data, trends, extras }: { data: Dashboard; trends: Trends; extras: RunningExtras }) {
  const runHref = (id: string) => (data.source === "demo" ? `/demo/runs/${id}` : `/runs/${id}`);
  const { week, month, longest } = runningTotals(data.runs);

  return (
    <div className="flex flex-col gap-16">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        <Figure
          label="This week"
          value={km(week.distanceM)}
          unit="km"
          note={week.count ? `${week.count} ${week.count === 1 ? "run" : "runs"}, ${hm(week.durationSec)} on your feet.` : "No runs yet this week."}
        />
        <Figure
          label="Last 30 days"
          value={km(month.distanceM, 0)}
          unit="km"
          note={month.count ? `${month.count} runs at an average of ${pace(month.avgPace)} per km.` : "No runs in the last 30 days."}
        />
        {longest && (
          <Figure
            label="Longest run in 30 days"
            value={km(longest.distanceM)}
            unit="km"
            note={`${longest.name} on ${shortDate(longest.startLocal)}, ${pace(paceOf(longest))} per km.`}
          />
        )}
      </div>

      <section className="flex flex-col gap-4">
        <Heading>Recent runs</Heading>
        {data.runs.length ? (
          <ul>
            {data.runs.slice(0, 12).map((r) => (
              <RunRow key={r.id} run={r} href={runHref(r.id)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No runs found. Record a run on your watch and sync it.</p>
        )}
      </section>

      <CalendarHeatmap days={extras.calendar} />

      <div className="grid gap-12 md:grid-cols-2 md:gap-14">
        <section className="flex flex-col gap-4">
          <Heading>Personal records</Heading>
          <PersonalRecords records={extras.records} runHref={runHref} />
        </section>
        <section className="flex flex-col gap-4">
          <Heading>Shoes</Heading>
          <ShoeMileage gear={extras.gear} />
        </section>
      </div>
      {extras.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {extras.warnings.map((w) => (
            <li key={w}>Couldn&apos;t load {w}</li>
          ))}
        </ul>
      )}

      <RunningTrends trends={trends} hrZones={extras.hrZones} />
    </div>
  );
}
