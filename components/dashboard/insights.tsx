import type { recoveryCheck, sleepPerformance, weeklySummary } from "@/lib/insights";
import { SleepRunChart } from "../charts/sleep-run-chart";

type Recovery = ReturnType<typeof recoveryCheck>;
type Weekly = ReturnType<typeof weeklySummary>;
type SleepPerf = ReturnType<typeof sleepPerformance>;

function SignalIcon({ flagged }: { flagged: boolean }) {
  return flagged ? (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-label="Needs attention">
      <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 6v3.5M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-label="Fine">
      <path d="m3 8.5 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Recovery check. Quiet when things are fine; inverted (ink on paper turns to
 * paper on ink) when two or more signals flag, so it can't be missed.
 */
export function RecoveryCheck({ check }: { check: Recovery }) {
  if (!check.signals.length) return null;
  const alert = check.level !== "ok";
  return (
    <section
      aria-label="Recovery check"
      className={alert ? "rounded-[1.5rem] bg-foreground p-6 text-background sm:p-8" : "rounded-[1.5rem] bg-muted p-6 sm:p-8"}
    >
      <p className="wide text-lg leading-snug font-bold">{check.headline}</p>
      <p className={`mt-1 text-sm ${alert ? "opacity-75" : "text-muted-foreground"}`}>
        {check.flags} of {check.signals.length} recovery signals {check.flags === 1 ? "is" : "are"} off. Two or more is the cue to back off.
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {check.signals.map((s) => (
          <li key={s.key} className={`flex items-start gap-2.5 text-sm ${s.flagged ? "font-semibold" : alert ? "opacity-75" : "text-muted-foreground"}`}>
            <span className="mt-0.5">
              <SignalIcon flagged={s.flagged} />
            </span>
            <span>
              <span className={s.flagged ? "" : alert ? "" : "text-foreground"}>{s.label}:</span> {s.detail}.
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Delta({ label, now, before, unit, digits = 0, lowerIsBetter = false }: {
  label: string;
  now: number | null;
  before: number | null;
  unit?: string;
  digits?: number;
  lowerIsBetter?: boolean;
}) {
  if (now === null) return null;
  const d = before !== null ? now - before : null;
  const shown = (v: number) => v.toFixed(digits);
  const better = d === null || d === 0 ? null : lowerIsBetter ? d < 0 : d > 0;
  return (
    <div className="flex flex-col gap-1 border-t-2 border-foreground pt-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="num text-[2.75rem] font-bold">{shown(now)}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </span>
      {d !== null && (
        <span className="text-sm text-muted-foreground tabular-nums">
          {d === 0 ? "Same as" : `${d > 0 ? "+" : "−"}${shown(Math.abs(d))} vs`} the week before
          {better !== null && <span className="sr-only">{better ? ", an improvement" : ", a step back"}</span>}
        </span>
      )}
    </div>
  );
}

export function WeeklySummary({ week }: { week: Weekly }) {
  const { current: c, previous: p } = week;
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="wide text-lg font-semibold">Your week</h2>
        <p className="text-sm text-muted-foreground">The last 7 days compared with the 7 before.</p>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
        <Delta label="Distance" now={c.km} before={p.km} unit="km" digits={1} />
        <Delta label="Runs" now={c.runs} before={p.runs} />
        <Delta label="Sleep score" now={c.sleepScore} before={p.sleepScore} />
        <Delta label="Overnight HRV" now={c.hrv} before={p.hrv} unit="ms" />
      </div>
      <ul className="flex max-w-[72ch] flex-col gap-2 text-base leading-relaxed">
        {week.sentences.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </section>
  );
}

export function SleepPerformance({ result }: { result: SleepPerf }) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex max-w-[72ch] flex-col gap-2">
        <h2 className="wide text-lg font-semibold">Does sleep make you faster?</h2>
        <p className="text-base leading-relaxed">{result.verdict}</p>
        <p className="text-sm text-muted-foreground">
          Uses your easy runs from the last 90 days (average heart rate up to {result.easyCap} bpm), so hard sessions don&apos;t
          skew it. Efficiency is metres covered per heartbeat: higher means you ran further for the same effort.
        </p>
      </div>
      <SleepRunChart points={result.points} />
    </section>
  );
}
