"use client";

import { motion } from "motion/react";
import { RANGES, type Range } from "@/lib/garmin/types";
import { RANGE_LABELS } from "@/lib/trends";
import { cn } from "@/lib/utils";

const SHORT: Record<Range, string> = { "7d": "7D", "4w": "4W", "3m": "3M", "1y": "1Y" };

/** Segmented date-range control; the selection pill slides between options. */
export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div role="radiogroup" aria-label="Trend range" className="flex rounded-full bg-secondary p-1 outline outline-1 outline-border">
      {RANGES.map((r) => {
        const active = r === value;
        return (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={RANGE_LABELS[r]}
            onClick={() => onChange(r)}
            className={cn(
              "relative h-9 rounded-full px-4 text-sm font-semibold tabular-nums transition-colors",
              active ? "text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="range-pill"
                className="absolute inset-0 rounded-full bg-foreground"
                transition={{ type: "spring", damping: 30, stiffness: 400 }}
              />
            )}
            <span className="relative">{SHORT[r]}</span>
          </button>
        );
      })}
    </div>
  );
}
