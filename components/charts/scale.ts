/** Round tick steps (1, 2, 5 × 10ⁿ) covering [min, max]; no 2.5s, so whole-number labels stay exact. */
export function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return { ticks, min: lo, max: hi };
}

export function linear(d0: number, d1: number, r0: number, r1: number) {
  return (v: number) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "9 Oct" from YYYY-MM-DD, without timezone drift. */
export function shortDay(date: string) {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function bucketLabel(start: string, bucket: "day" | "week") {
  return bucket === "week" ? `Week of ${shortDay(start)}` : shortDay(start);
}

/** Path for a vertical bar with rounded data-end(s). */
export function barPath(x: number, y0: number, y1: number, w: number, roundBoth = false) {
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);
  const h = bottom - top;
  const r = Math.max(0, Math.min(4, w / 2, roundBoth ? h / 2 : h));
  const rb = roundBoth ? r : 0;
  return [
    `M${x},${bottom - rb}`,
    `V${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `H${x + w - r}`,
    `Q${x + w},${top} ${x + w},${top + r}`,
    `V${bottom - rb}`,
    rb ? `Q${x + w},${bottom} ${x + w - rb},${bottom}H${x + rb}Q${x},${bottom} ${x},${bottom - rb}` : `H${x}`,
    "Z",
  ].join("");
}

/** Line path that breaks at missing values. */
export function linePath(points: ({ x: number; y: number } | null)[]) {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

/** Ticks for durations in seconds, on 15 s / 30 s / 1 min / 2 min / 5 min steps. */
export function timeTicks(min: number, max: number, count = 4) {
  const step = [15, 30, 60, 120, 300].find((s) => (max - min) / s <= count) ?? 600;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);
  return { ticks, min: lo, max: hi };
}
