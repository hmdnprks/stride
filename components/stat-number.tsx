"use client";

import NumberFlow from "@number-flow/react";

const LIGHTEST = 150;
const HEAVIEST = 900;

/** Font weight for a 0–100 score: the higher the score, the heavier the figure. */
export function scoreWeight(score: number) {
  const s = Math.max(0, Math.min(100, score));
  return Math.round(LIGHTEST + (s / 100) * (HEAVIEST - LIGHTEST));
}

/**
 * A large figure. When `score` is given its weight is driven by it, so a 90
 * lands heavy and a 20 lands thin. On load the weight "charges up" from thin
 * (CSS only, so it works before hydration); later value changes, e.g. after a
 * sync, roll via NumberFlow.
 */
export function StatNumber({
  value,
  score,
  weight = 600,
  decimals = 0,
  className = "",
}: {
  value: number | null;
  score?: number;
  weight?: number;
  decimals?: number;
  className?: string;
}) {
  if (value === null) {
    return (
      <span className={`num ${className}`} style={{ fontWeight: LIGHTEST }}>
        --
      </span>
    );
  }

  return (
    <span
      className={`num charge inline-block ${className}`}
      style={{ fontWeight: score !== undefined ? scoreWeight(score) : weight }}
    >
      <NumberFlow
        value={value}
        format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }}
        transformTiming={{ duration: 900, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        spinTiming={{ duration: 900, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
    </span>
  );
}
