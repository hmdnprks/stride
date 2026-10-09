"use client";

import type { ReactNode } from "react";
import type { TrendPoint, Trends } from "@/lib/garmin/types";
import { RANGE_LABELS } from "@/lib/trends";
import { PaceHrChart } from "../charts/pace-hr-chart";
import { TrendChart } from "../charts/trend-chart";

const whole = (v: number) => String(Math.round(v));
const oneDp = (v: number) => v.toFixed(1);
const hm = (h: number) => {
  const mins = Math.round(h * 60);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
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
      <Warnings trends={trends} />
    </Section>
  );
}

/* Runs tab */

export function RunningTrends({ trends }: { trends: Trends }) {
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
      <PaceHrChart runs={trends.runs} />
      <Warnings trends={trends} />
    </Section>
  );
}
