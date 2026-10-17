import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";
import type { Run } from "./garmin/types";
import { markDataUri, TRACK_BLUE } from "./brand";
import { clock, pace, paceOf } from "./format";
import { routeShape } from "./route-shape";
import { addDays } from "./trends";

// Shareable images of a run or a week, drawn as the watch-face panel: track
// blue, white figures, thin lines between fields. Rendered with ImageResponse
// (Satori), which only does flexbox and static fonts, so Archivo is bundled as
// fixed instances in assets/fonts rather than the variable font the site uses.

export const CARD_FORMATS = {
  story: { width: 1080, height: 1920, label: "Story" },
  square: { width: 1080, height: 1080, label: "Square" },
} as const;
export type CardFormat = keyof typeof CARD_FORMATS;
export const isCardFormat = (v: unknown): v is CardFormat => typeof v === "string" && v in CARD_FORMATS;

const WHITE = "#ffffff";
const MUTED = "#b9c7ff";
const LINE = "rgba(255,255,255,0.22)";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let fonts: Promise<{ name: string; data: Buffer; weight: 300 | 500 | 600 | 700; style: "normal" }[]> | null = null;

/** Archivo instances: condensed for figures, wide for names, regular for labels. */
export function cardFonts() {
  fonts ??= Promise.all(
    (
      [
        ["Archivo Condensed", 300, "archivo-condensed-300.ttf"],
        ["Archivo Condensed", 600, "archivo-condensed-600.ttf"],
        ["Archivo Wide", 700, "archivo-wide-700.ttf"],
        ["Archivo", 500, "archivo-500.ttf"],
      ] as const
    ).map(async ([name, weight, file]) => ({ name, weight, style: "normal" as const, data: await readFile(path.join(FONT_DIR, file)) })),
  );
  return fonts;
}

interface Field {
  label: string;
  value: string;
  unit?: string;
}

/**
 * Fields split by thin lines, like the watch's data screen: a 2×2 grid on a
 * story, one row of four on a square card, where height is short.
 */
function FieldGrid({ fields, size, columns = 2 }: { fields: Field[]; size: number; columns?: 2 | 4 }) {
  const rows = columns === 4 ? [fields] : [fields.slice(0, 2), fields.slice(2, 4)].filter((r) => r.length);
  const width = `${100 / columns}%`;
  return (
    <div style={{ display: "flex", flexDirection: "column", borderTop: `2px solid ${LINE}` }}>
      {rows.map((row, r) => (
        <div key={r} style={{ display: "flex", borderTop: r ? `2px solid ${LINE}` : "none" }}>
          {row.map((f, i) => (
            <div
              key={f.label}
              style={{
                display: "flex",
                flexDirection: "column",
                width,
                padding: `${size * 0.28}px 0 ${size * 0.28}px ${i ? size * 0.36 : 0}px`,
                borderLeft: i ? `2px solid ${LINE}` : "none",
              }}
            >
              <span style={{ fontFamily: "Archivo", fontSize: size * 0.3, color: MUTED }}>{f.label}</span>
              <span style={{ display: "flex", alignItems: "baseline", marginTop: size * 0.08 }}>
                <span style={{ fontFamily: "Archivo Condensed", fontWeight: 600, fontSize: size, lineHeight: 1, color: WHITE }}>{f.value}</span>
                {f.unit && <span style={{ fontFamily: "Archivo", fontSize: size * 0.3, color: MUTED, marginLeft: size * 0.1 }}>{f.unit}</span>}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Frame({ format, children }: { format: CardFormat; children: ReactNode }) {
  const pad = format === "story" ? 96 : 80;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: TRACK_BLUE,
        color: WHITE,
        padding: pad,
        fontFamily: "Archivo",
      }}
    >
      {children}
    </div>
  );
}

/** Mark and wordmark, with the date on the right. */
function Header({ when, size }: { when: string; size: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ display: "flex", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={markDataUri(112)} width={size * 2.2} height={size * 2.2} alt="" />
        <span style={{ fontFamily: "Archivo Wide", fontWeight: 700, fontSize: size, marginLeft: size * 0.6 }}>Stride</span>
      </span>
      <span style={{ fontSize: size * 0.85, color: MUTED }}>{when}</span>
    </div>
  );
}

/** The distance, huge and condensed, as on the watch. */
function Distance({ km, size }: { km: string; size: number }) {
  return (
    <span style={{ display: "flex", alignItems: "baseline" }}>
      <span style={{ fontFamily: "Archivo Condensed", fontWeight: 300, fontSize: size, lineHeight: 0.84, letterSpacing: -size * 0.01 }}>{km}</span>
      <span style={{ fontSize: size * 0.16, color: MUTED, marginLeft: size * 0.05 }}>km</span>
    </span>
  );
}

function Title({ text, size }: { text: string; size: number }) {
  return (
    <span style={{ fontFamily: "Archivo Wide", fontWeight: 700, fontSize: size, lineHeight: 1.08, letterSpacing: -size * 0.02, maxWidth: "100%" }}>
      {text.length > 44 ? `${text.slice(0, 42).trimEnd()}…` : text}
    </span>
  );
}

function RouteDrawing({ route, width, height }: { route: [number, number][]; width: number; height: number }) {
  const { d, start, end, loop } = routeShape(route, width, height, 24);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <path d="${d}" fill="none" stroke="${WHITE}" stroke-opacity="0.2" stroke-width="22" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${WHITE}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>
    ${loop ? "" : `<circle cx="${end[0]}" cy="${end[1]}" r="16" fill="${TRACK_BLUE}" stroke="${WHITE}" stroke-width="7"/>`}
    <circle cx="${start[0]}" cy="${start[1]}" r="16" fill="${WHITE}" stroke="${TRACK_BLUE}" stroke-width="5"/>
  </svg>`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} width={width} height={height} alt="" />;
}

const longDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dayMonth = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

function hoursMinutes(sec: number) {
  const total = Math.round(sec / 60);
  return { value: `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`, unit: "h" };
}

export function RunCard({ run, route, format }: { run: Run; route: [number, number][] | null; format: CardFormat }) {
  const story = format === "story";
  const fields: Field[] = [
    { label: "Time", value: clock(run.durationSec) },
    { label: "Pace", value: pace(paceOf(run)), unit: "/km" },
    { label: "Heart rate", value: run.avgHr ? String(Math.round(run.avgHr)) : "–", unit: run.avgHr ? "bpm" : undefined },
    { label: "Climb", value: run.elevationGainM !== null ? String(Math.round(run.elevationGainM)) : "–", unit: run.elevationGainM !== null ? "m" : undefined },
  ];
  const showRoute = story && route && route.length > 1;

  return (
    <Frame format={format}>
      <Header when={longDate(run.startLocal.slice(0, 10))} size={story ? 40 : 34} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: story ? 120 : 64 }}>
        <Title text={run.name} size={story ? 64 : 52} />
      </div>
      <div style={{ display: "flex", marginTop: story ? 56 : 36 }}>
        <Distance km={(run.distanceM / 1000).toFixed(2)} size={story ? 400 : 300} />
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
        {showRoute && <RouteDrawing route={route} width={888} height={560} />}
      </div>
      <FieldGrid fields={fields} size={story ? 128 : 64} columns={story ? 2 : 4} />
    </Frame>
  );
}

export interface WeekSummary {
  /** Monday, YYYY-MM-DD */
  start: string;
  runs: Run[];
}

export function WeekCard({ week, format }: { week: WeekSummary; format: CardFormat }) {
  const story = format === "story";
  const days = Array.from({ length: 7 }, (_, i) => addDays(week.start, i));
  const perDay = days.map((d) => week.runs.filter((r) => r.startLocal.startsWith(d)).reduce((a, r) => a + r.distanceM / 1000, 0));
  const most = Math.max(1, ...perDay);
  const distanceM = week.runs.reduce((a, r) => a + r.distanceM, 0);
  const durationSec = week.runs.reduce((a, r) => a + r.durationSec, 0);
  const longest = week.runs.reduce((a, r) => Math.max(a, r.distanceM), 0);
  const time = hoursMinutes(durationSec);
  const fields: Field[] = [
    { label: "Runs", value: String(week.runs.length) },
    { label: "Time", ...time },
    { label: "Pace", value: distanceM ? pace(durationSec / (distanceM / 1000)) : "–", unit: distanceM ? "/km" : undefined },
    { label: "Longest", value: longest ? (longest / 1000).toFixed(1) : "–", unit: longest ? "km" : undefined },
  ];
  const barH = story ? 420 : 200;

  return (
    <Frame format={format}>
      <Header when={`Week of ${dayMonth(week.start)}`} size={story ? 40 : 34} />
      <div style={{ display: "flex", marginTop: story ? 120 : 48 }}>
        <Distance km={(distanceM / 1000).toFixed(1)} size={story ? 400 : 260} />
      </div>
      <div style={{ display: "flex", flex: 1 }} />
      {/* One bar per day, Monday to Sunday, scaled to the biggest day. */}
      <div style={{ display: "flex", alignItems: "flex-end", marginBottom: story ? 72 : 40 }}>
        {days.map((d, i) => (
          <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
            <span style={{ fontFamily: "Archivo Condensed", fontWeight: 600, fontSize: story ? 44 : 32, color: perDay[i] ? WHITE : MUTED }}>
              {perDay[i] ? perDay[i].toFixed(perDay[i] < 10 ? 1 : 0) : ""}
            </span>
            <div
              style={{
                width: story ? 72 : 56,
                height: perDay[i] ? Math.max(12, (perDay[i] / most) * barH) : 6,
                marginTop: 12,
                borderRadius: 999,
                background: perDay[i] ? WHITE : LINE,
              }}
            />
            <span style={{ fontSize: story ? 34 : 28, color: MUTED, marginTop: 18 }}>
              {new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short" })}
            </span>
          </div>
        ))}
      </div>
      <FieldGrid fields={fields} size={story ? 128 : 64} columns={story ? 2 : 4} />
    </Frame>
  );
}
