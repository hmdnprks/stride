import Link from "next/link";
import type { Run } from "@/lib/garmin/types";
import type { BodyChange, MonthSplit, YearReview } from "@/lib/review";
import { FOODS } from "@/lib/energy";
import { hm, km, pace, paceOf } from "@/lib/format";
import { Sparkline } from "../charts/sparkline";
import { StatNumber } from "../stat-number";
import { PersonalRecords } from "../dashboard/records";
import { ThemeToggle } from "../uselayouts/theme-toggle";

const monthName = (m: string, month: "long" | "short" = "long") =>
  new Date(`${m}-01T12:00:00`).toLocaleDateString("en-GB", { month });
const dayMonth = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
const thousands = (n: number) => n.toLocaleString("en-GB");

/**
 * The year as one lap of a track: the outer lane is drawn as far as the year
 * has gone (the Stride mark, at full size). A past year is a closed lap.
 */
function YearLap({ elapsed }: { elapsed: number }) {
  const lane = "M198 348A92 92 0 0 1 198 164H314A92 92 0 0 1 314 348H198";
  return (
    <svg viewBox="78 134 356 244" className="w-full max-w-[11rem] sm:max-w-[18rem]" aria-hidden>
      <rect x="170" y="226" width="172" height="60" rx="30" fill="none" stroke="var(--panel-line)" strokeWidth="14" />
      <path d={lane} fill="none" stroke="var(--panel-line)" strokeWidth="26" />
      <path
        d={lane}
        pathLength={1}
        fill="none"
        stroke="var(--panel-foreground)"
        strokeWidth="26"
        strokeLinecap="round"
        strokeDasharray={`${Math.max(0.01, elapsed)} 1`}
        className="lap"
      />
    </svg>
  );
}

function Hero({ review }: { review: YearReview }) {
  const { totals, year, elapsed, from } = review;
  const current = elapsed < 1;
  const partialStart = from > `${year}-01-01`;

  return (
    <section
      aria-label={`${year} totals`}
      className="grid overflow-hidden rounded-[2rem] bg-panel text-panel-foreground lg:grid-cols-[1fr_auto]"
    >
      <div className="flex min-w-0 flex-col gap-4 p-6 sm:p-9">
        <h1 className="wide text-xl font-bold sm:text-2xl">{current ? `${year} so far` : `${year}`}</h1>
        <p className="flex items-baseline gap-3">
          <StatNumber value={totals.km} decimals={0} weight={300} className="text-[5.5rem] sm:text-[8rem] lg:text-[10rem]" />
          <span className="text-lg font-medium text-panel-muted sm:text-xl">km</span>
        </p>
        {partialStart && <p className="text-sm text-panel-muted">Counting from {dayMonth(from)}, when Stride&apos;s history begins.</p>}
      </div>

      <div className="flex flex-row items-center gap-5 border-t border-panel-line px-6 py-5 sm:flex-col sm:justify-center sm:gap-2 sm:px-9 sm:py-6 lg:border-t-0 lg:border-l">
        <YearLap elapsed={elapsed} />
        <p className="text-sm text-panel-muted">{current ? `${Math.round(elapsed * 100)}% of the year run` : "The full year"}</p>
      </div>

      <dl className="grid grid-cols-3 border-t border-panel-line lg:col-span-2">
        {[
          ["Runs", thousands(totals.runs)],
          ["Time", hm(totals.durationSec)],
          ["Climb", `${thousands(totals.climbM)} m`],
        ].map(([label, value], i) => (
          <div key={label} className={`flex min-w-0 flex-col gap-1.5 px-4 py-5 sm:px-9 ${i ? "border-l border-panel-line" : ""}`}>
            <dt className="text-sm text-panel-muted">{label}</dt>
            <dd className="num text-[1.75rem] font-semibold sm:text-[3.25rem]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Months as the splits of a race: distance bars against the biggest month. */
function MonthSplits({ months, current }: { months: MonthSplit[]; current: boolean }) {
  const most = Math.max(0, ...months.map((m) => m.km));
  const biggest = months.findIndex((m) => m.km === most && most > 0);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[600px] text-left text-sm">
        <caption className="sr-only">Distance, runs, time, pace and heart rate for each month</caption>
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Month</th>
            <th className="w-[34%] px-4 py-2.5 font-medium">Distance</th>
            <th className="px-4 py-2.5 text-right font-medium">Runs</th>
            <th className="px-4 py-2.5 text-right font-medium">Time</th>
            <th className="px-4 py-2.5 text-right font-medium">Pace</th>
            <th className="px-4 py-2.5 text-right font-medium">Heart rate</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {months.map((m, i) => {
            const thisMonth = current && i === months.length - 1;
            return (
              <tr key={m.month} className="border-t border-border">
                <th scope="row" className="px-4 py-2.5 font-semibold">
                  {monthName(m.month)}
                  {thisMonth && <span className="font-normal text-muted-foreground"> so far</span>}
                </th>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-3">
                    <span className="num w-12 shrink-0 text-right text-[1.3125rem] font-semibold">{m.km ? Math.round(m.km) : "–"}</span>
                    {/* Bars share one track width, so the "Biggest" note doesn't shorten its bar. */}
                    <span className="flex-1">
                      {m.km > 0 && (
                        <span
                          className="block h-2 rounded-full bg-series"
                          style={{ width: `${Math.max(2, (m.km / most) * 100)}%`, opacity: thisMonth ? 0.45 : 1 }}
                        />
                      )}
                    </span>
                    <span className="w-12 shrink-0 text-xs text-muted-foreground">{i === biggest && "Biggest"}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">{m.runs || "–"}</td>
                <td className="px-4 py-2.5 text-right">{m.runs ? hm(m.durationSec) : "–"}</td>
                <td className="px-4 py-2.5 text-right">{m.paceSecPerKm ? `${pace(m.paceSecPerKm)} /km` : "–"}</td>
                <td className="px-4 py-2.5 text-right">{m.avgHr ? `${m.avgHr} bpm` : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Highlight({ label, value, unit, note, href }: { label: string; value: string; unit?: string; note: string; href?: string }) {
  return (
    <div className="flex flex-col gap-2 border-t-2 border-foreground pt-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="num text-[3.25rem] font-bold sm:text-[4rem]">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </span>
      <span className="text-sm text-muted-foreground">
        {href ? (
          <Link href={href} className="font-semibold text-primary underline-offset-4 hover:underline">
            {note}
          </Link>
        ) : (
          note
        )}
      </span>
    </div>
  );
}

function Highlights({ review, runHref }: { review: YearReview; runHref: (id: string) => string }) {
  const { longest, fastest, biggestWeek, weeksActive, weeksTotal, energy } = review;
  const pizza = FOODS[0];
  const runNote = (r: Run) => `${r.name}, ${dayMonth(r.startLocal.slice(0, 10))}`;

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
      {longest && <Highlight label="Longest run" value={km(longest.distanceM)} unit="km" note={runNote(longest)} href={runHref(longest.id)} />}
      {fastest && (
        <Highlight label="Fastest run over 5 km" value={pace(paceOf(fastest))} unit="/km" note={runNote(fastest)} href={runHref(fastest.id)} />
      )}
      {biggestWeek && (
        <Highlight
          label="Biggest week"
          value={String(Math.round(biggestWeek.km))}
          unit="km"
          note={`Week of ${dayMonth(biggestWeek.start)}, ${biggestWeek.runs} ${biggestWeek.runs === 1 ? "run" : "runs"}`}
        />
      )}
      <Highlight label="Weeks with a run" value={String(weeksActive)} unit={`of ${weeksTotal}`} note={consistency(weeksActive, weeksTotal)} />
      {energy.active !== null && energy.active >= pizza.kcal && (
        <Highlight
          label="Burned off"
          value={thousands(Math.round(energy.active / pizza.kcal))}
          unit={pizza.many}
          note={`${thousands(energy.active)} active kcal${energy.running !== null ? `, ${thousands(energy.running)} from running` : ""}. One pizza is about ${thousands(pizza.kcal)} kcal.`}
        />
      )}
    </div>
  );
}

function consistency(active: number, total: number) {
  const share = total ? active / total : 0;
  if (share >= 0.9) return "Barely a week missed.";
  if (share >= 0.7) return "Most weeks, with a few breaks.";
  if (share >= 0.4) return "On and off through the year.";
  return "A quiet year on the road.";
}

function changeSentence(b: BodyChange) {
  if (b.from === null || b.to === null || b.fromMonth === b.toMonth) return "Not enough readings to compare months.";
  const diff = b.to - b.from;
  const since = `since ${monthName(b.fromMonth!)}`;
  if (Math.abs(diff) < 10 ** -b.digits / 2) return `Unchanged ${since}.`;
  const amount = `${Math.abs(diff).toFixed(b.digits)}${b.unit ? ` ${b.unit}` : ""}`;
  const improved = (diff > 0) === (b.better === "up");
  return `${diff > 0 ? "Up" : "Down"} ${amount} ${since}, ${improved ? "an improvement" : "worth keeping an eye on"}.`;
}

function BodyOverYear({ body }: { body: BodyChange[] }) {
  return (
    <ul className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
      {body.map((b) => (
        <li key={b.key} className="flex flex-col gap-2 border-b border-border py-5">
          <span className="font-semibold">{b.label}</span>
          <span className="flex items-end justify-between gap-4">
            <span className="flex items-baseline gap-1.5">
              <span className="num text-[3.25rem] font-semibold">{b.to === null ? "–" : b.to.toFixed(b.digits)}</span>
              {b.unit && <span className="text-sm text-muted-foreground">{b.unit}</span>}
              {b.toMonth && <span className="text-sm text-muted-foreground">in {monthName(b.toMonth)}</span>}
            </span>
            <Sparkline values={b.monthly} width={140} height={36} className="mb-2 shrink-0 text-series" />
          </span>
          <span className="text-sm text-muted-foreground">
            {b.from !== null && b.fromMonth !== b.toMonth && `${b.from.toFixed(b.digits)} in ${monthName(b.fromMonth!)}. `}
            {changeSentence(b)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="wide text-lg font-semibold">{title}</h2>
        {intro && <p className="max-w-[65ch] text-sm text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

export function YearReviewView({
  review,
  years,
  warnings,
  base,
}: {
  review: YearReview;
  years: number[];
  warnings: string[];
  /** "" for live data, "/demo" for the demo. */
  base: "" | "/demo";
}) {
  const runHref = (id: string) => `${base}/runs/${id}`;
  const current = review.elapsed < 1;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <Link
            href={base || "/"}
            className="flex h-11 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-semibold outline outline-1 outline-border hover:outline-foreground"
          >
            <span aria-hidden>‹</span> Dashboard
          </Link>
          <span className="wide hidden text-lg font-extrabold sm:block">Stride</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-4 py-10 sm:px-8">
        <div className="flex flex-col gap-6">
          {years.length > 1 && (
            <nav aria-label="Years" className="flex flex-wrap gap-2">
              {years.map((y) => (
                <Link
                  key={y}
                  href={`${base}/review/${y}`}
                  aria-current={y === review.year ? "page" : undefined}
                  className="num flex h-11 items-center rounded-full px-5 text-[1.3125rem] font-semibold outline outline-1 outline-border hover:outline-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background aria-[current=page]:outline-foreground"
                >
                  {y}
                </Link>
              ))}
            </nav>
          )}
          <Hero review={review} />
        </div>

        {review.totals.runs === 0 ? (
          <p className="text-base text-muted-foreground">No runs recorded in {review.year}. Pick another year above.</p>
        ) : (
          <>
            <Section
              title="Month by month"
              intro={`Each month as a split: bars show distance against the biggest month${current ? "; this month is still going" : ""}. Pace and heart rate are averages across the month's runs.`}
            >
              <MonthSplits months={review.months} current={current} />
            </Section>

            <Section title="Highlights">
              <Highlights review={review} runHref={runHref} />
            </Section>
          </>
        )}

        <Section title={`Records set in ${review.year}`} intro="Garmin keeps your best effort at each distance; these are the ones you set this year that still stand.">
          {review.records.length ? (
            <PersonalRecords records={review.records} runHref={runHref} />
          ) : (
            <p className="text-sm text-muted-foreground">None of your current records date from {review.year}.</p>
          )}
        </Section>

        <Section title="Your body over the year" intro="Monthly averages, first month with readings against the latest.">
          <BodyOverYear body={review.body} />
        </Section>

        {warnings.length > 0 && (
          <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Some data didn&apos;t load</p>
            <ul className="mt-2 list-disc pl-5">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </footer>
        )}
      </main>
    </div>
  );
}

export function YearReviewSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-24 sm:px-8" aria-busy>
      <div className="h-[22rem] animate-pulse rounded-[2rem] bg-panel/80" />
      <div className="h-80 animate-pulse rounded-2xl bg-muted" />
      <span className="sr-only">Loading your year</span>
    </div>
  );
}
