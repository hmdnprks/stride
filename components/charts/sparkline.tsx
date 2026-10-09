import { linePath } from "./scale";

/**
 * A small trend line for a stat tile. Decorative: the full values live in the
 * charts and tables below, so it's hidden from assistive tech.
 */
export function Sparkline({
  values,
  width = 120,
  height = 28,
  color = "currentColor",
  className = "",
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const pad = 3;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2);
  const pts = values.map((v, i) => (v === null ? null : { x: x(i), y: y(v) }));
  const lastI = values.findLastIndex((v) => v !== null);

  return (
    <svg width={width} height={height} aria-hidden className={`overflow-visible ${className}`}>
      <path d={linePath(pts)} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
      <circle cx={pts[lastI]!.x} cy={pts[lastI]!.y} r={3} fill={color} />
    </svg>
  );
}
