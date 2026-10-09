import Link from "next/link";
import type { ActivityDetail, Split } from "@/lib/garmin/types";
import { clock, hm, km, pace, paceOf, parseLocal } from "@/lib/format";
import { ThemeToggle } from "../uselayouts/theme-toggle";
import { RouteMap } from "./route-map";
import { SampleCharts } from "./sample-charts";

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col gap-2 border-t-2 border-foreground pt-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="num text-[3.25rem] font-bold sm:text-[4rem]">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </span>
    </div>
  );
}

function SplitsTable({ splits }: { splits: Split[] }) {
  const paces = splits.map((s) => (s.distanceM ? s.durationSec / (s.distanceM / 1000) : 0));
  const full = paces.filter((_, i) => splits[i].distanceM >= 900);
  const fastest = full.length ? Math.min(...full) : 0;
  // Mark only the first split at the fastest pace, even when several tie.
  const fastestIndex = splits.findIndex((s, i) => s.distanceM >= 900 && paces[i] === fastest);
  const slowest = full.length ? Math.max(...full) : 0;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Km</th>
            <th className="px-4 py-2.5 font-medium">Pace</th>
            <th className="w-[30%] px-4 py-2.5 font-medium">
              <span className="sr-only">Relative speed</span>
            </th>
            <th className="px-4 py-2.5 text-right font-medium">Time</th>
            <th className="px-4 py-2.5 text-right font-medium">Heart rate</th>
            <th className="px-4 py-2.5 text-right font-medium">Climb</th>
            <th className="px-4 py-2.5 text-right font-medium">Cadence</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {splits.map((s, i) => {
            const p = paces[i];
            const partial = s.distanceM < 900;
            // Bar length is speed relative to the slowest full split.
            const share = slowest && p ? Math.max(0.08, Math.min(1, (slowest / p - 0.85) / (slowest / fastest - 0.85 || 1))) : 0;
            const isFastest = i === fastestIndex && splits.length > 1;
            return (
              <tr key={s.index} className="border-t border-border">
                <td className="px-4 py-2 text-muted-foreground">{partial ? `${(s.distanceM / 1000).toFixed(2)}` : s.index}</td>
                <td className="px-4 py-2 font-semibold">{p ? pace(p) : "–"}</td>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2">
                    <span className="h-2 rounded-full bg-series" style={{ width: `${share * 100}%`, opacity: partial ? 0.4 : 1 }} />
                    {isFastest && <span className="text-xs whitespace-nowrap text-muted-foreground">Fastest</span>}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">{clock(s.durationSec)}</td>
                <td className="px-4 py-2 text-right">{s.avgHr ? `${Math.round(s.avgHr)} bpm` : "–"}</td>
                <td className="px-4 py-2 text-right">{s.elevationGainM !== null ? `${Math.round(s.elevationGainM)} m` : "–"}</td>
                <td className="px-4 py-2 text-right">{s.cadenceSpm ? `${s.cadenceSpm} spm` : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ActivityView({ detail, backHref }: { detail: ActivityDetail; backHref: string }) {
  const { run } = detail;
  const when = parseLocal(run.startLocal).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <Link href={backHref} className="flex h-11 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-semibold outline outline-1 outline-border hover:outline-foreground">
            <span aria-hidden>‹</span> All runs
          </Link>
          <span className="wide text-lg font-extrabold">Stride</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-4 py-10 sm:px-8">
        <header className="flex flex-col gap-3">
          <p className="text-base text-muted-foreground">{when}</p>
          <h1 className="wide text-2xl leading-[1.05] font-bold sm:text-3xl">{run.name}</h1>
        </header>

        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          <Stat label="Distance" value={km(run.distanceM, 2)} unit="km" />
          <Stat label="Time" value={clock(run.durationSec)} />
          <Stat label="Average pace" value={pace(paceOf(run))} unit="/km" />
          <Stat label="Average heart rate" value={run.avgHr ? String(Math.round(run.avgHr)) : "–"} unit="bpm" />
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Max heart rate", detail.maxHr ? `${Math.round(detail.maxHr)} bpm` : null],
            ["Climb", run.elevationGainM !== null ? `${Math.round(run.elevationGainM)} m` : null],
            ["Cadence", run.cadenceSpm ? `${run.cadenceSpm} spm` : null],
            ["Stride length", run.strideCm ? `${(run.strideCm / 100).toFixed(2)} m` : null],
            ["Training load", run.load !== null ? String(Math.round(run.load)) : null],
            ["Calories", detail.calories ? `${Math.round(detail.calories)}` : null],
          ]
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
        </dl>

        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <section className="flex flex-col gap-4">
            <h2 className="wide text-lg font-semibold">Route</h2>
            <RouteMap route={detail.route} />
          </section>
          <section className="flex min-w-0 flex-col gap-4">
            <h2 className="wide text-lg font-semibold">Along the run</h2>
            <SampleCharts samples={detail.samples} />
          </section>
        </div>

        <section className="flex flex-col gap-4">
          <h2 className="wide text-lg font-semibold">Splits</h2>
          {detail.splits.length ? (
            <SplitsTable splits={detail.splits} />
          ) : (
            <p className="text-sm text-muted-foreground">No splits recorded for this run.</p>
          )}
          <p className="text-sm text-muted-foreground">
            {hm(run.durationSec)} total. Bars show each split&apos;s speed; longer is faster.
          </p>
        </section>

        {detail.warnings.length > 0 && (
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {detail.warnings.map((w) => (
              <li key={w}>Couldn&apos;t load {w}</li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-24 sm:px-8">
      <div className="h-12 w-full max-w-md animate-pulse rounded-full bg-muted" />
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">Loading the run from Garmin Connect…</p>
    </div>
  );
}
