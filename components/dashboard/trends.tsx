"use client";

import type { ReactNode } from "react";
import type { HrZoneSettings, TrendPoint, Trends } from "@/lib/garmin/types";
import { RANGE_LABELS } from "@/lib/trends";
import { PaceHrChart } from "../charts/pace-hr-chart";
import { TrendChart } from "../charts/trend-chart";

const whole = (v: number) => String(Math.round(v));
const clock = (sec: number) => {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

const PREDICTIONS = [
  { key: "pred5k", label: "5K" },
  { key: "pred10k", label: "10K" },
  { key: "predHalf", label: "Half marathon" },
  { key: "predMarathon", label: "Marathon" },
] as const;

const DYNAMICS = [
  { key: "cadenceSpm", title: "Cadence", unit: "spm", note: "Steps per minute. Most runners settle between 165 and 185." },
  { key: "strideCm", title: "Stride length", unit: "cm", note: "Grows as you get faster at the same cadence." },
  { key: "groundContactMs", title: "Ground contact time", unit: "ms", note: "Time each foot spends on the ground. Lower is usually more efficient." },
  { key: "verticalRatioPct", title: "Vertical ratio", unit: "%", note: "Bounce relative to stride length. Lower is more efficient." },
] as const;
const oneDp = (v: number) => v.toFixed(1);
const hm = (h: number) => {
  const mins = Math.round(h * 60);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
};
const hoursTick = (h: number) => `${h}h`;

function mean(points: TrendPoint[], key: keyof TrendPoint) {
  const v = points.map((p) => p[key]).filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function first(points: TrendPoint[], key: keyof TrendPoint) {
  const p = points.find((x) => typeof x[key] === "number");
  return p ? (p[key] as number) : null;
}
function last(points: TrendPoint[], key: keyof TrendPoint) {
  const p = [...points].reverse().find((x) => typeof x[key] === "number");
  return p ? (p[key] as number) : null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-8">
      <h2 className="wide text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-12 md:grid-cols-2 md:gap-x-14">{children}</div>;
}

function Warnings({ trends }: { trends: Trends }) {
  if (!trends.warnings.length) return null;
  return (
    <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
      {trends.warnings.map((w) => (
        <li key={w}>Couldn&apos;t load {w}</li>
      ))}
    </ul>
  );
}

/* Today tab */

export function RecoveryTrends({ trends }: { trends: Trends }) {
  const p = trends.points;
  const hi = mean(p, "bbHigh");
  const lo = mean(p, "bbLow");
  const sleep = mean(p, "sleepScore");
  const sleepH = mean(p, "sleepH");
  const rhr = mean(p, "restingHr");
  const hrv = mean(p, "hrv");
  const range = RANGE_LABELS[trends.range];

  return (
    <Section title={`Recovery over ${range}`}>
      <TrendChart
        title="Body battery"
        summary={
          hi !== null && lo !== null
            ? `${trends.bucket === "week" ? "Typical daily range, averaged per week." : "Lowest to highest each day."} On average it peaked at ${Math.round(hi)} and bottomed out at ${Math.round(lo)}.`
            : undefined
        }
        rows={p}
        bucket={trends.bucket}
        layers={[{ kind: "range", low: "bbLow", high: "bbHigh", label: "Low to high" }]}
        format={whole}
        domain={[0, 100]}
      />
      <Grid>
        <TrendChart
          title="Sleep stages"
          summary={sleepH !== null ? `${hm(sleepH)} a night on average.` : undefined}
          rows={p}
          bucket={trends.bucket}
          layers={[
            {
              kind: "stack",
              parts: [
                { key: "deepH", label: "Deep", color: "var(--stage-deep)" },
                { key: "lightH", label: "Light", color: "var(--stage-light)" },
                { key: "remH", label: "REM", color: "var(--stage-rem)" },
                { key: "awakeH", label: "Awake", color: "var(--stage-awake)" },
              ],
            },
          ]}
          format={(v) => (v >= 1 || v === 0 ? (Number.isInteger(v) ? hoursTick(v) : hm(v)) : `${Math.round(v * 60)}m`)}
        />
        <TrendChart
          title="Sleep score"
          summary={sleep !== null ? `Averaging ${Math.round(sleep)}.` : undefined}
          rows={p}
          bucket={trends.bucket}
          layers={[{ kind: "line", key: "sleepScore", label: "Sleep score", endLabel: true }]}
          format={whole}
        />
        <TrendChart
          title="Resting heart rate"
          summary={rhr !== null ? `Averaging ${Math.round(rhr)} bpm. Lower usually means better recovered.` : undefined}
          rows={p}
          bucket={trends.bucket}
          layers={[{ kind: "line", key: "restingHr", label: "Resting heart rate", endLabel: true }]}
          format={whole}
        />
        <TrendChart
          title="Overnight HRV"
          summary={hrv !== null ? `Averaging ${Math.round(hrv)} ms. Inside the shaded band is your normal, balanced range.` : undefined}
          rows={p}
          bucket={trends.bucket}
          layers={[
            { kind: "band", low: "hrvLow", high: "hrvHigh", label: "Balanced range" },
            { kind: "line", key: "hrv", label: "HRV", endLabel: true },
          ]}
          format={whole}
        />
      </Grid>
      <Warnings trends={trends} />
    </Section>
  );
}

/* Fitness tab */

export function FitnessTrends({ trends }: { trends: Trends }) {
  const p = trends.points;
  const v0 = first(p, "vo2");
  const v1 = last(p, "vo2");
  const acute = last(p, "acuteLoad");
  const chronic = last(p, "chronicLoad");
  const ratio = acute !== null && chronic ? acute / chronic : null;

  const vo2Summary =
    v0 !== null && v1 !== null
      ? v1 === v0
        ? "Flat over this range."
        : `${v1 > v0 ? "Up" : "Down"} ${Math.abs(v1 - v0).toFixed(1)} over this range.`
      : undefined;

  const loadSummary =
    ratio === null
      ? undefined
      : `This week's load is ${ratio.toFixed(1)}× your 4-week average. ${
          ratio < 0.8 ? "You're training less than usual." : ratio > 1.3 ? "That's a big jump; watch for fatigue." : "That's a sustainable build."
        }`;

  return (
    <Section title={`Fitness over ${RANGE_LABELS[trends.range]}`}>
      <Grid>
        <TrendChart
          title="VO2 max"
          summary={vo2Summary}
          rows={p}
          bucket={trends.bucket}
          layers={[{ kind: "line", key: "vo2", label: "VO2 max", endLabel: true }]}
          format={oneDp}
        />
        <TrendChart
          title="Training load from runs"
          summary={loadSummary}
          rows={p}
          bucket={trends.bucket}
          layers={[
            { kind: "line", key: "chronicLoad", label: "4-week average", tone: "context" },
            { kind: "line", key: "acuteLoad", label: "Last 7 days", endLabel: true },
          ]}
          format={whole}
        />
      </Grid>

      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold">Race prediction history</h3>
        <p className="text-sm text-muted-foreground">
          Garmin&apos;s predicted finish time for each distance. Lower is faster; each chart has its own scale.
        </p>
      </div>
      <Grid>
        {PREDICTIONS.map((r) => {
          const a = first(p, r.key);
          const b = last(p, r.key);
          const diff = a !== null && b !== null ? b - a : null;
          return (
            <TrendChart
              key={r.key}
              title={r.label}
              summary={
                diff === null
                  ? undefined
                  : Math.abs(diff) < 1
                    ? "Unchanged over this range."
                    : `${clock(Math.abs(diff))} ${diff < 0 ? "faster" : "slower"} over this range.`
              }
              rows={p}
              bucket={trends.bucket}
              layers={[{ kind: "line", key: r.key, label: r.label, endLabel: true }]}
              format={clock}
              timeAxis
              height={140}
            />
          );
        })}
      </Grid>
      <Warnings trends={trends} />
    </Section>
  );
}


/* Heart-rate zones */

const ZONES = [
  { key: "z1H", n: 1, name: "Recovery", color: "var(--zone-1)", feel: "Very easy. Warm-ups, cool-downs and recovery jogs." },
  { key: "z2H", n: 2, name: "Endurance", color: "var(--zone-2)", feel: "Easy and conversational. Builds your aerobic base; most of your running belongs here." },
  { key: "z3H", n: 3, name: "Tempo", color: "var(--zone-3)", feel: "Moderately hard; you can talk in short sentences. Improves aerobic efficiency." },
  { key: "z4H", n: 4, name: "Threshold", color: "var(--zone-4)", feel: "Hard but controlled. Raises the pace you can hold for longer." },
  { key: "z5H", n: 5, name: "Maximum", color: "var(--zone-5)", feel: "Very hard, short efforts only. Builds VO2 max and top-end speed." },
] as const;

const METHOD: Record<string, string> = {
  HR_MAX: "a percentage of your max heart rate",
  HRR: "your heart rate reserve",
  LTHR: "your lactate threshold heart rate",
};

/** "115–133 bpm": a zone runs from its floor to just below the next floor. */
function bpmRange(settings: HrZoneSettings, n: number) {
  const lo = settings.floors[n - 1];
  const hi = n < 5 ? settings.floors[n] - 1 : settings.maxHr;
  return `${lo}–${hi} bpm`;
}

function HeartRateZones({ trends, settings }: { trends: Trends; settings: HrZoneSettings | null }) {
  const hours = ZONES.map((z) => trends.points.reduce((a, p) => a + (p[z.key] ?? 0), 0));
  const total = hours.reduce((a, b) => a + b, 0);
  const share = (h: number) => (total ? Math.round((h / total) * 100) : 0);
  const easy = total ? share(hours[0] + hours[1]) : null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">Time in heart-rate zones</h3>
        <p className="max-w-[72ch] text-sm text-muted-foreground">
          {easy === null
            ? "No heart-rate data for runs in this range."
            : `${hm(total)} of running. ${easy}% was easy (zones 1 and 2). Many training plans aim for about 80% easy, with the rest spread across zones 3 to 5.`}
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <TrendChart
          title="Hours per zone"
          rows={trends.points}
          bucket={trends.bucket}
          layers={[
            {
              kind: "stack",
              parts: ZONES.map((z) => ({ key: z.key, label: `Zone ${z.n}, ${z.name.toLowerCase()}`, color: z.color })),
            },
          ]}
          format={(v) => (v > 0 && Number.isInteger(v) ? `${v}h` : hm(v))}
          height={220}
          hideLegend
        />

        {/* The key doubles as the legend: listed Z5 to Z1 to match the stack. */}
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col">
            {[...ZONES].reverse().map((z) => {
              const h = hours[z.n - 1];
              return (
                <li key={z.key} className="flex flex-col gap-1.5 border-b border-border py-3 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-baseline gap-2">
                      <span className="size-3 shrink-0 translate-y-0.5 rounded-[4px]" style={{ background: z.color }} />
                      <span className="font-semibold">
                        Zone {z.n}, {z.name}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">{settings ? bpmRange(settings, z.n) : null}</span>
                  </div>
                  <p className="pl-5 text-sm leading-snug text-muted-foreground">{z.feel}</p>
                  {total > 0 && (
                    <div className="flex items-center gap-3 pl-5">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-lane">
                        <div className="h-full rounded-full" style={{ width: `${share(h)}%`, background: z.color }} />
                      </div>
                      <span className="w-24 text-right text-sm tabular-nums">
                        <span className="font-semibold">{share(h)}%</span>{" "}
                        <span className="text-muted-foreground">{h ? hm(h) : "0m"}</span>
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            {settings
              ? `Your zones from Garmin Connect, set from ${METHOD[settings.method ?? ""] ?? "your heart rate settings"} (max ${settings.maxHr} bpm). Change them on your watch or in Garmin Connect.`
              : "Zone ranges unavailable; showing time per zone only."}
          </p>
        </div>
      </div>
    </section>
  );
}

/* Runs tab */

export function RunningTrends({ trends, hrZones }: { trends: Trends; hrZones: HrZoneSettings | null }) {
  const weekly = trends.bucket === "week";
  // 4-week rolling average of weekly distance, as context for the bars.
  const rows = trends.points.map((pt, i, all) => {
    const window = all.slice(Math.max(0, i - 3), i + 1);
    return { ...pt, avgKm: weekly && window.length === 4 ? Math.round((window.reduce((a, w) => a + w.distanceKm, 0) / 4) * 10) / 10 : null };
  });
  const total = trends.points.reduce((a, pt) => a + pt.distanceKm, 0);
  const runs = trends.points.reduce((a, pt) => a + pt.runs, 0);

  return (
    <Section title={`Running over ${RANGE_LABELS[trends.range]}`}>
      <TrendChart
        title={weekly ? "Distance per week" : "Distance per day"}
        summary={`${Math.round(total)} km across ${runs} ${runs === 1 ? "run" : "runs"}.`}
        rows={rows}
        bucket={trends.bucket}
        layers={[
          { kind: "bars", key: "distanceKm", label: weekly ? "Weekly distance" : "Distance" },
          ...(weekly ? [{ kind: "line" as const, key: "avgKm", label: "4-week average", tone: "context" as const }] : []),
        ]}
        format={(v) => `${Number.isInteger(v) ? v : v.toFixed(1)} km`}
        height={220}
      />
      <HeartRateZones trends={trends} settings={hrZones} />
      <PaceHrChart runs={trends.runs} />

      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold">Running dynamics</h3>
        <p className="text-sm text-muted-foreground">
          Form metrics from your watch, averaged by distance. Needs a watch or sensor that records running dynamics.
        </p>
      </div>
      <Grid>
        {DYNAMICS.map((d) => {
          const v = mean(trends.points, d.key);
          return (
            <TrendChart
              key={d.key}
              title={d.title}
              summary={v === null ? undefined : `Averaging ${d.key === "verticalRatioPct" ? `${v.toFixed(1)}%` : `${Math.round(v)} ${d.unit}`}. ${d.note}`}
              rows={trends.points}
              bucket={trends.bucket}
              layers={[{ kind: "line", key: d.key, label: d.title, endLabel: true }]}
              format={d.key === "verticalRatioPct" ? oneDp : whole}
              height={140}
            />
          );
        })}
      </Grid>
      <Warnings trends={trends} />
    </Section>
  );
}
