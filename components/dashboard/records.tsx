import Link from "next/link";
import type { Gear, PersonalRecord } from "@/lib/garmin";
import { clock, pace, shortDate } from "@/lib/format";

export function PersonalRecords({ records, runHref }: { records: PersonalRecord[]; runHref: (id: string) => string }) {
  if (!records.length) {
    return <p className="text-sm text-muted-foreground">No personal records yet. Garmin sets them from your fastest efforts.</p>;
  }
  return (
    <ul>
      {records.map((r) => (
        <li key={r.label} className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-0.5 border-b border-border py-3">
          <span className="font-semibold">{r.label}</span>
          <span className="num text-right text-[2.375rem] font-semibold">{clock(r.timeSec)}</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {pace(r.timeSec / (r.distanceM / 1000))} per km{r.date && `, ${shortDate(`${r.date} 12:00:00`)} ${r.date.slice(0, 4)}`}
          </span>
          {r.activityId ? (
            <Link href={runHref(r.activityId)} className="text-right text-sm font-semibold text-primary underline-offset-4 hover:underline">
              View run
            </Link>
          ) : (
            <span />
          )}
        </li>
      ))}
    </ul>
  );
}

function ShoeRow({ shoe }: { shoe: Gear }) {
  const used = shoe.distanceM / shoe.limitM;
  const leftKm = Math.round((shoe.limitM - shoe.distanceM) / 1000);
  const status = used >= 1 ? "Past its replacement distance" : used >= 0.9 ? `Replace soon, ${leftKm} km left` : `${leftKm} km left`;

  return (
    <li className="flex flex-col gap-2 border-b border-border py-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-semibold">{shoe.name}</span>
        <span className="flex items-baseline gap-1">
          <span className="num text-[2.375rem] font-semibold">{Math.round(shoe.distanceM / 1000)}</span>
          <span className="text-sm text-muted-foreground">of {Math.round(shoe.limitM / 1000)} km</span>
        </span>
      </div>
      {/* Meter: track is a lighter step of the same blue. */}
      <div
        className="h-2 overflow-hidden rounded-full bg-lane"
        role="meter"
        aria-valuenow={Math.round(shoe.distanceM / 1000)}
        aria-valuemin={0}
        aria-valuemax={Math.round(shoe.limitM / 1000)}
        aria-label={`${shoe.name} distance`}
      >
        <div className="h-full rounded-full bg-series" style={{ width: `${Math.min(100, used * 100)}%` }} />
      </div>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {used >= 0.9 && (
          <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-foreground" aria-hidden>
            <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8 6v3.5M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
        <span>
          <span className={used >= 0.9 ? "font-semibold text-foreground" : ""}>{status}.</span> {shoe.runs} runs
          {shoe.defaultLimit ? ". Using a default limit; set your own in Garmin Connect." : "."}
        </span>
      </p>
    </li>
  );
}

export function ShoeMileage({ gear }: { gear: Gear[] }) {
  if (!gear.length) {
    return <p className="text-sm text-muted-foreground">No shoes yet. Add them under Gear in Garmin Connect to track their mileage.</p>;
  }
  return (
    <ul>
      {[...gear]
        .sort((a, b) => b.distanceM / b.limitM - a.distanceM / a.limitM)
        .map((g) => (
          <ShoeRow key={g.id} shoe={g} />
        ))}
    </ul>
  );
}
