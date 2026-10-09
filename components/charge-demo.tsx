"use client";

import { useEffect, useState } from "react";
import { StatNumber } from "./stat-number";

// One overnight recharge, played once: the figure climbs and thickens.
const STEPS = [5, 18, 34, 51, 67, 82, 94, 100];
const STEP_MS = 420;

export function ChargeDemo() {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => setI(STEPS.length - 1), 0);
      return () => clearTimeout(id);
    }
    if (i >= STEPS.length - 1) return;
    const id = setTimeout(() => setI((n) => n + 1), i === 0 ? 700 : STEP_MS);
    return () => clearTimeout(id);
  }, [i]);

  const value = STEPS[i];
  const done = i === STEPS.length - 1;

  return (
    <div className="flex h-full flex-col gap-2 lg:justify-between lg:gap-6">
      <span className="text-base font-medium text-panel-muted">Body battery</span>
      <StatNumber
        value={value}
        score={value}
        className="text-[5.5rem] transition-[font-weight] duration-500 ease-out sm:text-[8rem] lg:text-[12rem]"
      />
      <p className="hidden max-w-[24ch] text-sm leading-relaxed text-panel-muted sm:block" aria-live="polite">
        {done ? "Fully charged. Your scores print heavier the higher they go." : "Charging overnight…"}
      </p>
    </div>
  );
}
