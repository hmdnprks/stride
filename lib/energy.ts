import type { DailyRaw, Run } from "./garmin/types";
import { addDays, eachDay, mondayOf } from "./trends";

// Calories burned this week and this month, and what that would be in food.
// Only active calories count: resting (BMR) calories are burned whether you
// run or not, so including them would make a rest day look like a feast.

export interface Food {
  id: string;
  one: string;
  many: string;
  /** kcal per serving, rounded. */
  kcal: number;
  serving: string;
}

/**
 * Rounded typical values for one serving. Calories vary a lot by recipe and
 * size, so these are for fun, not for counting.
 */
export const FOODS: Food[] = [
  { id: "pizza", one: "pizza", many: "pizzas", kcal: 2300, serving: "a whole 14-inch cheese pizza" },
  { id: "nasi-goreng", one: "plate of nasi goreng", many: "plates of nasi goreng", kcal: 650, serving: "a restaurant plate, with egg" },
  { id: "burger", one: "burger", many: "burgers", kcal: 550, serving: "a fast-food double burger" },
  { id: "doughnut", one: "doughnut", many: "doughnuts", kcal: 250, serving: "a glazed ring doughnut" },
  { id: "banana", one: "banana", many: "bananas", kcal: 105, serving: "a medium banana" },
];

export interface EnergyPeriod {
  /** First and last day counted (the last is today). */
  from: string;
  to: string;
  /** Active calories, kcal; null when no day in the period has calorie data. */
  active: number | null;
  /** The part of `active` from runs. */
  running: number | null;
  runs: number;
}

const dateOf = (r: Run) => r.startLocal.slice(0, 10);

function period(from: string, to: string, daily: DailyRaw[], runs: Run[]): EnergyPeriod {
  const days = new Set(eachDay(from, to));
  const active = daily.filter((d) => days.has(d.date) && typeof d.kcalActive === "number");
  // Only runs on days with a calorie total, so "from running" stays a part of it.
  const counted = new Set(active.map((d) => d.date));
  const inPeriod = runs.filter((r) => counted.has(dateOf(r)));
  const total = active.length ? Math.round(active.reduce((a, d) => a + d.kcalActive!, 0)) : null;
  const running = inPeriod.some((r) => typeof r.activeCalories === "number")
    ? Math.round(inPeriod.reduce((a, r) => a + (r.activeCalories ?? 0), 0))
    : null;
  return { from, to, active: total, running: total === null || running === null ? null : Math.min(running, total), runs: inPeriod.length };
}

/** Average active calories on the 28 days before today that have calorie data, kcal. */
function usualDay(daily: DailyRaw[], today: string) {
  const from = addDays(today, -28);
  const days = daily.filter((d) => d.date >= from && d.date < today && typeof d.kcalActive === "number");
  return days.length >= 7 ? Math.round(days.reduce((a, d) => a + d.kcalActive!, 0) / days.length) : null;
}

/** Today so far, this week (from Monday) and this month (from the 1st), up to today. */
export function energyBurned(daily: DailyRaw[], runs: Run[], today: string) {
  return {
    today: { ...period(today, today, daily, runs), usual: usualDay(daily, today) },
    week: period(mondayOf(today), today, daily, runs),
    month: period(`${today.slice(0, 7)}-01`, today, daily, runs),
    lastWeek: period(addDays(mondayOf(today), -7), addDays(mondayOf(today), -1), daily, runs),
  };
}

/** The biggest food that makes at least one serving, for "about 2 doughnuts". */
export function closestFood(kcal: number) {
  return [...FOODS].sort((a, b) => b.kcal - a.kcal).find((f) => servings(kcal, f) >= 1) ?? null;
}

/** How many servings of `food` some calories are worth, to the nearest quarter. */
export function servings(kcal: number, food: Food) {
  return Math.round((kcal / food.kcal) * 4) / 4;
}

const FRACTIONS: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

/** "3½ pizzas", "1 burger", "¾ of a pizza", "less than ¼ of a pizza". */
export function servingsLabel(count: number, food: Food) {
  if (count === 0) return `less than ¼ of a ${food.one}`;
  const whole = Math.floor(count);
  const part = FRACTIONS[count - whole] ?? "";
  if (!whole) return `${part} of a ${food.one}`;
  return `${whole}${part} ${count === 1 ? food.one : food.many}`;
}
