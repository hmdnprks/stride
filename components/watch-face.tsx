import type { ReactNode } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Sparkline } from "./charts/sparkline";
import { StatNumber } from "./stat-number";
import { InfoTip } from "./info-tip";

export interface WatchField {
  label: string;
  value: number | null;
  /** 0–100 score that drives the figure's weight. */
  score?: number;
  unit?: string;
  note?: ReactNode;
  /** Recent values for a sparkline. */
  trend?: (number | null)[];
  /** What the figure means, in a tooltip by the label. */
  info?: string;
  icon?: IconSvgElement;
}

/**
 * The four-field data screen from a sport watch, scaled up. Fields sit in a
 * 2×2 grid split by thin lines, as on the watch itself.
 */
export function WatchFace({ fields }: { fields: [WatchField, WatchField, WatchField, WatchField] }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-[2rem] bg-panel text-panel-foreground">
      {fields.map((f, i) => (
        <div
          key={f.label}
          className={[
            "flex min-w-0 flex-col gap-3 p-5 sm:p-7",
            i % 2 === 1 ? "border-l border-panel-line" : "",
            i > 1 ? "border-t border-panel-line" : "",
          ].join(" ")}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-panel-muted sm:text-base">
            {f.icon && (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-panel-foreground/12 text-panel-foreground">
                <HugeiconsIcon icon={f.icon} size={18} strokeWidth={1.8} aria-hidden />
              </span>
            )}
            {f.label}
            {f.info && <InfoTip label={f.label}>{f.info}</InfoTip>}
          </span>
          <span className="flex items-baseline gap-2">
            <StatNumber
              value={f.value}
              score={f.score}
              weight={300}
              className="text-[4.5rem] sm:text-[6.5rem] lg:text-[8rem]"
            />
            {f.unit && <span className="text-sm font-medium text-panel-muted sm:text-lg">{f.unit}</span>}
          </span>
          <span className="flex items-end justify-between gap-3">
            {f.note && <span className="text-sm text-panel-muted">{f.note}</span>}
            {f.trend && <Sparkline values={f.trend} color="var(--panel-foreground)" className="ml-auto hidden shrink-0 sm:block" />}
          </span>
        </div>
      ))}
    </div>
  );
}
