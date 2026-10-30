import Link from "next/link";
import type { Run } from "@/lib/garmin/types";
import { clock, km, pace, paceOf, shortDate } from "@/lib/format";

/** One run in a list: date, name, distance, then time, pace and heart rate. */
export function RunRow({ run, href, race }: { run: Run; href: string; race?: string | null }) {
  return (
    <li className="border-b border-border">
      <Link
        href={href}
        className="group -mx-3 grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 rounded-xl px-3 py-4 transition-colors hover:bg-muted md:grid-cols-[8rem_1fr_7rem_6rem_6rem_4rem]"
      >
        <span className="order-2 text-sm text-muted-foreground md:order-none">{shortDate(run.startLocal)}</span>
        <span className="order-1 flex flex-wrap items-baseline gap-x-2 md:order-none">
          <span className="font-semibold underline-offset-4 group-hover:underline">{run.name}</span>
          {race !== undefined && race !== null && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
              {race && race !== run.name ? `Race: ${race}` : "Race"}
            </span>
          )}
        </span>
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
