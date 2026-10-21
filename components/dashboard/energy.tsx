"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { BananaIcon, DonutIcon, Hamburger01Icon, Pizza01Icon, RiceBowl01Icon } from "@hugeicons/core-free-icons";
import { FOODS, servings, servingsLabel, type EnergyPeriod, type Food } from "@/lib/energy";

const ICONS: Record<string, IconSvgElement> = {
  pizza: Pizza01Icon,
  "nasi-goreng": RiceBowl01Icon,
  burger: Hamburger01Icon,
  doughnut: DonutIcon,
  banana: BananaIcon,
};

/** Past this many pieces, each icon stands for several servings. */
const MAX_PIECES = 30;
const kcal = (n: number) => n.toLocaleString("en-GB");
const day = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** The servings drawn as pieces; the last one cut to its fraction. */
function Pieces({ count, food }: { count: number; food: Food }) {
  const reduce = useReducedMotion();
  const per = count > MAX_PIECES ? Math.ceil(count / MAX_PIECES / 5) * 5 : 1;
  const units = count / per;
  const pieces = Array.from({ length: Math.ceil(units) }, (_, i) => Math.min(1, units - i));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 text-primary" aria-hidden="true">
        {pieces.map((share, i) => (
          <motion.span
            key={`${food.id}-${i}`}
            className="relative block size-7"
            initial={reduce ? false : { opacity: 0, scale: 0.4, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0.45, duration: 0.5, delay: Math.min(i, 24) * 0.025 }}
          >
            {/* A part serving: the whole outline, coloured in up to its share. */}
            {share < 1 && <HugeiconsIcon icon={ICONS[food.id]} size={28} strokeWidth={1.6} className="absolute inset-0 text-lane" />}
            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${share * 100}%` }}>
              <HugeiconsIcon icon={ICONS[food.id]} size={28} strokeWidth={1.6} />
            </span>
          </motion.span>
        ))}
      </div>
      {per > 1 && <p className="text-xs text-muted-foreground">Each one is {per} {food.many}.</p>}
    </div>
  );
}

function Period({ label, period, food }: { label: string; period: EnergyPeriod; food: Food }) {
  const count = period.active === null ? null : servings(period.active, food);
  const words = count === null ? null : servingsLabel(count, food);
  // "3½" big, "pizzas" small; fractions and short counts read as one phrase.
  const [figure, ...rest] = words?.split(" ") ?? [];
  const bigFigure = count !== null && count >= 1;

  return (
    <div className="flex flex-col gap-4 border-t-2 border-foreground pt-4">
      <span className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {day(period.from)} – today
        </span>
      </span>
      {count === null ? (
        <p className="text-sm text-muted-foreground">No calorie data yet. Sync your watch and it will appear.</p>
      ) : (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2" aria-label={`${words} burned ${label.toLowerCase()}`}>
            {bigFigure ? (
              <>
                <span className="num text-[4.5rem] leading-none font-bold sm:text-[5.5rem]">{figure}</span>
                <span className="text-lg font-semibold">{rest.join(" ")}</span>
              </>
            ) : (
              <span className="wide text-2xl font-bold">{words}</span>
            )}
          </p>
          <Pieces count={count} food={food} />
          <p className="text-sm text-muted-foreground">
            {kcal(period.active!)} active kcal
            {period.running !== null && period.runs > 0
              ? `, ${kcal(period.running)} of it from ${period.runs} ${period.runs === 1 ? "run" : "runs"}.`
              : "."}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Active calories this week and this month, shown as servings of a food you
 * pick. Resting calories are left out on purpose (see lib/energy.ts).
 */
export function EnergyBurned({ week, month }: { week: EnergyPeriod; month: EnergyPeriod }) {
  const [foodId, setFoodId] = useState(FOODS[0].id);
  const food = FOODS.find((f) => f.id === foodId)!;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="wide text-lg font-semibold">Burned off</h2>
        <p className="max-w-[64ch] text-sm text-muted-foreground">
          Active calories only: what you burned above resting, from runs and everything else you did.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Count it in</legend>
        <div className="flex flex-wrap gap-2">
          {FOODS.map((f) => (
            <label
              key={f.id}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold outline outline-1 outline-border hover:outline-foreground has-checked:bg-foreground has-checked:text-background has-checked:outline-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input type="radio" name="energy-food" value={f.id} checked={f.id === foodId} onChange={() => setFoodId(f.id)} className="sr-only" />
              <HugeiconsIcon icon={ICONS[f.id]} size={18} strokeWidth={1.8} />
              {f.many[0].toUpperCase() + f.many.slice(1)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-10 md:grid-cols-2 md:gap-14">
        <Period label="This week" period={week} food={food} />
        <Period label="This month" period={month} food={food} />
      </div>

      <p className="text-xs text-muted-foreground">
        One {food.one} is about {kcal(food.kcal)} kcal ({food.serving}). Calories are Garmin&apos;s estimate from your heart rate and
        body size; food values are typical servings, rounded.
      </p>
    </section>
  );
}
