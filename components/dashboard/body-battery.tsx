import type { BodyBattery as Data } from "@/lib/garmin";
import { BODY_BATTERY_INFO } from "@/lib/glossary";
import { InfoTip } from "../info-tip";
import { StatNumber } from "../stat-number";

// Inner well of the battery, in viewBox units.
const WELL = { x: 15, y: 15, w: 190, h: 70, r: 11 };

/**
 * Body battery as a battery: the solid fill is now, the pale part above it is
 * how high it got today, and a notch marks the day's low.
 */
function BatteryGauge({ current, low, high }: { current: number; low: number; high: number }) {
  const at = (v: number) => (Math.max(0, Math.min(100, v)) / 100) * WELL.w;
  return (
    <svg viewBox="0 0 240 100" className="h-auto w-full max-w-[15rem] shrink-0 overflow-visible sm:max-w-[17rem]" aria-hidden>
      <defs>
        <clipPath id="battery-well">
          <rect x={WELL.x} y={WELL.y} width={WELL.w} height={WELL.h} rx={WELL.r} />
        </clipPath>
      </defs>
      <rect x="3" y="3" width="214" height="94" rx="22" fill="none" stroke="currentColor" strokeWidth="6" />
      <rect x="223" y="33" width="14" height="34" rx="5" fill="currentColor" />
      <g clipPath="url(#battery-well)">
        <rect x={WELL.x} y={WELL.y} width={WELL.w} height={WELL.h} className="fill-lane" />
        <rect x={WELL.x} y={WELL.y} width={at(high)} height={WELL.h} className="fill-primary/25" />
        <rect x={WELL.x} y={WELL.y} width={at(current)} height={WELL.h} className="battery-fill fill-primary" />
      </g>
      {/* The day's low, as a notch under the well. */}
      <path d={`M${WELL.x + at(low)} ${WELL.y + WELL.h + 4} l-5 9 h10 z`} className="fill-muted-foreground" />
    </svg>
  );
}

const level = (v: number) =>
  v >= 75 ? "Well charged." : v >= 50 ? "Enough in the tank." : v >= 25 ? "Running lower; keep today easy." : "Low. A day to rest.";

export function BodyBattery({ data }: { data: Data | null }) {
  return (
    <section aria-label="Body battery" className="flex flex-col gap-3">
      <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground sm:text-base">
        Body battery
        <InfoTip label="body battery">{BODY_BATTERY_INFO}</InfoTip>
      </span>
      {data ? (
        <>
          <div
            className="flex items-center gap-5"
            role="img"
            aria-label={`Body battery ${data.current} of 100; ranged from ${data.low} to ${data.high} today`}
          >
            <BatteryGauge current={data.current} low={data.low} high={data.high} />
            <span className="flex items-baseline gap-1" aria-hidden>
              <StatNumber value={data.current} score={data.current} className="text-[4.5rem] sm:text-[5.5rem]" />
              <span className="text-lg font-semibold text-muted-foreground">%</span>
            </span>
          </div>
          <p className="max-w-[44ch] text-sm text-muted-foreground">
            {level(data.current)} Low {data.low}, high {data.high} today; charged +{data.charged}, drained −{data.drained}.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No body battery yet. Wear your watch overnight and sync it.</p>
      )}
    </section>
  );
}
