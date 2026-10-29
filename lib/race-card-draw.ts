import { markSvg, TRACK_BLUE } from "./brand";
import { routeShape } from "./route-shape";

// The race card: the share card's watch-face panel with the runner's own
// photos on it, the medal cut out and the bib pinned up like paper. Drawn on a
// canvas in the browser, so the photos never leave the phone. The fonts are
// the fixed Archivo instances the server-drawn cards use (public/fonts).

export const RACE_CARD_SIZES = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
} as const;
export type RaceCardFormat = keyof typeof RACE_CARD_SIZES;

export interface RaceCardData {
  name: string;
  /** e.g. "Half marathon" */
  distanceName: string;
  date: string;
  distanceKm: string;
  time: string;
  pace: string;
  /** Short distance label for the best mark, e.g. "Half" */
  bestAt: string | null;
  /** "3:12 faster than Garmin predicted" */
  versus: string | null;
  avgHr: number | null;
  route: [number, number][];
}

export interface BibPhoto {
  image: CanvasImageSource & { width: number; height: number };
  /** 1 fills the bib; larger zooms in. */
  zoom: number;
  /** Pan, as a share of the photo's size. */
  x: number;
  y: number;
}

export interface RaceCardInput {
  data: RaceCardData;
  athlete: string;
  bibNumber: string;
  bib: BibPhoto | null;
  /** The medal cut out of its background, trimmed to its edges. */
  medal: (CanvasImageSource & { width: number; height: number }) | null;
}

/** Where the bib landed, in card pixels, so dragging in the preview can pan the photo. */
export type BibBox = { cx: number; cy: number; w: number; h: number } | null;

const WHITE = "#ffffff";
const MUTED = "#b9c7ff";
const LINE = "rgba(255,255,255,0.22)";
const INK = "#0b1a57";

const FONTS = [
  ["Card Condensed", "300", "archivo-condensed-300.ttf"],
  ["Card Condensed", "600", "archivo-condensed-600.ttf"],
  ["Card Wide", "700", "archivo-wide-700.ttf"],
  ["Card", "500", "archivo-500.ttf"],
] as const;

let ready: Promise<HTMLImageElement> | null = null;

/** Load the card fonts and the Stride mark once. */
export function loadCardAssets() {
  ready ??= (async () => {
    await Promise.all(
      FONTS.map(async ([family, weight, file]) => {
        const face = new FontFace(family, `url(/fonts/${file})`, { weight });
        document.fonts.add(await face.load());
      }),
    );
    const mark = new Image();
    mark.src = `data:image/svg+xml;utf8,${encodeURIComponent(markSvg({ corner: 112 }))}`;
    await mark.decode();
    return mark;
  })();
  ready.catch(() => (ready = null));
  return ready;
}

const font = (family: "Card" | "Card Condensed" | "Card Wide", weight: number, size: number) => `${weight} ${size}px "${family}"`;

/** Lines of text that fit `width`, at most `max` lines, the last cut with an ellipsis. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    lines.length = max;
    let last = lines[max - 1];
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    lines[max - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** The route, drawn faint behind the photos, or as the picture when there are none. */
function drawRoute(ctx: CanvasRenderingContext2D, route: [number, number][], x: number, y: number, w: number, h: number, faint: boolean) {
  if (route.length < 2) return;
  const { d, start, end, loop } = routeShape(route, w, h, 24);
  ctx.save();
  ctx.translate(x, y);
  const path = new Path2D(d);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = WHITE;
  ctx.globalAlpha = faint ? 0.1 : 0.2;
  ctx.lineWidth = faint ? 30 : 22;
  ctx.stroke(path);
  ctx.globalAlpha = faint ? 0.45 : 1;
  ctx.lineWidth = faint ? 6 : 8;
  ctx.stroke(path);
  ctx.globalAlpha = 1;
  if (!loop) {
    ctx.beginPath();
    ctx.arc(end[0], end[1], 16, 0, Math.PI * 2);
    ctx.fillStyle = TRACK_BLUE;
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.stroke();
  }
  if (!faint || !loop) {
    ctx.beginPath();
    ctx.arc(start[0], start[1], 16, 0, Math.PI * 2);
    ctx.fillStyle = WHITE;
    ctx.fill();
  }
  ctx.restore();
}

/**
 * A race bib, rotated a little like it's pinned up: the runner's photo inside
 * a paper edge, or with no photo, a plain bib with the number printed on it.
 */
function drawBib(ctx: CanvasRenderingContext2D, input: RaceCardInput, cx: number, cy: number, w: number, h: number, angle: number) {
  const edge = Math.round(w * 0.035);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.shadowColor = "rgba(5,12,50,0.45)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  roundRect(ctx, -w / 2, -h / 2, w, h, edge * 1.4);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.shadowColor = "transparent";

  const iw = w - edge * 2;
  const ih = h - edge * 2;
  if (input.bib) {
    const { image, zoom, x, y } = input.bib;
    roundRect(ctx, -iw / 2, -ih / 2, iw, ih, edge * 0.7);
    ctx.save();
    ctx.clip();
    // Cover the window, then zoom and pan.
    const scale = Math.max(iw / image.width, ih / image.height) * zoom;
    const dw = image.width * scale;
    const dh = image.height * scale;
    const maxX = (dw - iw) / 2;
    const maxY = (dh - ih) / 2;
    const ox = Math.max(-maxX, Math.min(maxX, x * dw));
    const oy = Math.max(-maxY, Math.min(maxY, y * dh));
    ctx.drawImage(image, -dw / 2 + ox, -dh / 2 + oy, dw, dh);
    ctx.restore();
  } else {
    // Printed bib: a blue band with the race name, then the number.
    const band = ih * 0.24;
    roundRect(ctx, -iw / 2, -ih / 2, iw, band, [edge * 0.7, edge * 0.7, 0, 0]);
    ctx.fillStyle = TRACK_BLUE;
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // The race name, shrunk to fit before it's cut short.
    const title = input.data.name.toUpperCase();
    let titleSize = band * 0.34;
    ctx.font = font("Card Wide", 700, titleSize);
    while (ctx.measureText(title).width > iw * 0.88 && titleSize > band * 0.2) ctx.font = font("Card Wide", 700, (titleSize -= 1));
    ctx.fillText(wrap(ctx, title, iw * 0.88, 1)[0], 0, -ih / 2 + band / 2);
    ctx.fillStyle = INK;
    let size = (ih - band) * 0.78;
    ctx.font = font("Card Condensed", 600, size);
    while (ctx.measureText(input.bibNumber).width > iw * 0.84 && size > 20) ctx.font = font("Card Condensed", 600, (size -= 8));
    ctx.fillText(input.bibNumber, 0, -ih / 2 + band + (ih - band) / 2 + size * 0.04);
  }
  // Safety pins at the corners.
  for (const [px, py] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    ctx.beginPath();
    ctx.arc(px * (w / 2 - edge * 1.6), py * (h / 2 - edge * 1.6), edge * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = "#c9cfdf";
    ctx.fill();
    ctx.lineWidth = edge * 0.18;
    ctx.strokeStyle = "#8d96ad";
    ctx.stroke();
  }
  ctx.restore();
}

/** The medal, fitted into a box and tilted, with a soft shadow that follows its outline. */
function drawMedal(ctx: CanvasRenderingContext2D, medal: NonNullable<RaceCardInput["medal"]>, cx: number, cy: number, w: number, h: number, angle: number) {
  const scale = Math.min(w / medal.width, h / medal.height);
  const dw = medal.width * scale;
  const dh = medal.height * scale;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.shadowColor = "rgba(5,12,50,0.5)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 22;
  ctx.drawImage(medal, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

/** Photos and route in a box; returns where the bib went. */
function drawStage(ctx: CanvasRenderingContext2D, input: RaceCardInput, x: number, y: number, w: number, h: number): BibBox {
  const hasBib = !!input.bib || !!input.bibNumber;
  const { medal } = input;
  drawRoute(ctx, input.data.route, x, y, w, h, hasBib || !!medal);

  let box: BibBox = null;
  if (hasBib) {
    // Bibs are about 1.4 times as wide as they're tall.
    const bw = Math.min(w * (medal ? 0.64 : 0.86), (h * (medal ? 0.58 : 0.8)) * 1.4);
    const bh = bw / 1.4;
    const cx = x + (medal ? bw / 2 + w * 0.02 : w / 2);
    const cy = y + (medal ? bh / 2 + h * 0.04 : h / 2);
    drawBib(ctx, input, cx, cy, bw, bh, medal ? -0.07 : -0.04);
    box = { cx, cy, w: bw, h: bh };
  }
  if (medal) {
    if (hasBib) drawMedal(ctx, medal, x + w * 0.7, y + h * 0.64, w * 0.6, h * 0.8, 0.1);
    else drawMedal(ctx, medal, x + w / 2, y + h / 2, w * 0.86, h * 0.94, 0.05);
  }
  return box;
}

function drawHeader(ctx: CanvasRenderingContext2D, mark: HTMLImageElement, date: string, x: number, y: number, w: number, size: number) {
  ctx.drawImage(mark, x, y, size * 2.2, size * 2.2);
  ctx.fillStyle = WHITE;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = font("Card Wide", 700, size);
  ctx.fillText("Stride", x + size * 2.8, y + size * 1.1);
  ctx.fillStyle = MUTED;
  ctx.textAlign = "right";
  ctx.font = font("Card", 500, size * 0.85);
  ctx.fillText(date, x + w, y + size * 1.1);
}

/** Label over a condensed figure, like a field on the watch. */
function drawField(ctx: CanvasRenderingContext2D, label: string, value: string, unit: string, x: number, y: number, size: number) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = MUTED;
  ctx.font = font("Card", 500, size * 0.3);
  ctx.fillText(label, x, y + size * 0.3);
  ctx.fillStyle = WHITE;
  ctx.font = font("Card Condensed", 600, size);
  ctx.fillText(value, x, y + size * 1.3);
  if (unit) {
    const vw = ctx.measureText(value).width;
    ctx.fillStyle = MUTED;
    ctx.font = font("Card", 500, size * 0.3);
    ctx.fillText(unit, x + vw + size * 0.1, y + size * 1.3);
  }
}

function drawBest(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  ctx.font = font("Card Wide", 700, size);
  const w = ctx.measureText(text).width + size * 1.4;
  roundRect(ctx, x, y, w, size * 1.9, size);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.fillStyle = TRACK_BLUE;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + size * 0.7, y + size * 0.98);
  return w;
}

const longDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** Draw the whole card; returns where the bib is, for panning its photo. */
export function drawRaceCard(ctx: CanvasRenderingContext2D, format: RaceCardFormat, input: RaceCardInput, mark: HTMLImageElement): BibBox {
  const { width: W, height: H } = RACE_CARD_SIZES[format];
  const { data } = input;
  const story = format === "story";
  const pad = story ? 88 : 72;
  const inner = W - pad * 2;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = TRACK_BLUE;
  ctx.fillRect(0, 0, W, H);
  drawHeader(ctx, mark, longDate(data.date), pad, pad, inner, story ? 40 : 34);

  // Race name, then the distance.
  const nameSize = story ? 76 : 54;
  ctx.font = font("Card Wide", 700, nameSize);
  const nameLines = wrap(ctx, data.name, inner, story ? 2 : 1);
  ctx.fillStyle = WHITE;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  let y = pad + (story ? 230 : 180);
  for (const line of nameLines) {
    ctx.fillText(line, pad, y);
    y += nameSize * 1.08;
  }
  ctx.fillStyle = MUTED;
  ctx.font = font("Card", 500, story ? 40 : 32);
  ctx.fillText(data.distanceName, pad, y + (story ? 6 : 0));

  const fields: [string, string, string][] = [
    ["Pace", data.pace, "/km"],
    ["Distance", data.distanceKm, "km"],
    ...(data.avgHr ? [["Heart rate", String(Math.round(data.avgHr)), "bpm"] as [string, string, string]] : []),
  ];
  const athlete = input.athlete.trim().toUpperCase();

  if (story) {
    const box = drawStage(ctx, input, pad, y + 70, inner, 1170 - (y + 70));

    // Finish time, huge, with the best mark beside its label and the prediction under it.
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = MUTED;
    ctx.font = font("Card", 500, 38);
    ctx.fillText("Finish time", pad, 1250);
    if (data.bestAt) drawBest(ctx, `Best ${data.bestAt}`, pad + ctx.measureText("Finish time").width + 28, 1214, 26);
    ctx.fillStyle = WHITE;
    let size = 290;
    ctx.font = font("Card Condensed", 300, size);
    while (ctx.measureText(data.time).width > inner && size > 120) ctx.font = font("Card Condensed", 300, (size -= 10));
    ctx.fillText(data.time, pad - 6, 1250 + size * 0.86);
    if (data.versus) {
      ctx.fillStyle = MUTED;
      ctx.font = font("Card", 500, 34);
      ctx.fillText(wrap(ctx, data.versus, inner, 1)[0], pad, 1250 + size * 0.86 + 64);
    }

    // Fields split by thin lines, like the watch's data screen.
    const top = 1600;
    const col = inner / fields.length;
    ctx.fillStyle = LINE;
    ctx.fillRect(pad, top, inner, 2);
    fields.forEach(([label, value, unit], i) => {
      ctx.fillStyle = LINE;
      if (i) ctx.fillRect(pad + col * i - 30, top + 30, 2, 110);
      drawField(ctx, label, value, unit, pad + col * i, top + 32, 84);
    });

    if (athlete) {
      ctx.fillStyle = WHITE;
      ctx.textAlign = "left";
      ctx.font = font("Card Wide", 700, 34);
      ctx.fillText(wrap(ctx, athlete, inner, 1)[0], pad, H - pad);
    }
    return box;
  }

  // Square: result on the left, photos on the right.
  const top = y + 40;
  const left = 440;
  const box = drawStage(ctx, input, pad + left, top - 40, inner - left, H - pad - top + 40);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = MUTED;
  ctx.font = font("Card", 500, 30);
  ctx.fillText("Finish time", pad, top + 30);
  ctx.fillStyle = WHITE;
  let size = 170;
  ctx.font = font("Card Condensed", 300, size);
  while (ctx.measureText(data.time).width > left - 20 && size > 80) ctx.font = font("Card Condensed", 300, (size -= 6));
  ctx.fillText(data.time, pad - 4, top + 30 + size * 0.9);
  let fy = top + 30 + size * 0.9 + 40;
  if (data.bestAt) {
    drawBest(ctx, `Best ${data.bestAt}`, pad, fy, 24);
    fy += 80;
  }
  for (const [label, value, unit] of fields) {
    if (fy + 100 > H - pad - 50) break;
    ctx.fillStyle = LINE;
    ctx.fillRect(pad, fy, left - 40, 2);
    drawField(ctx, label, value, unit, pad, fy + 22, 64);
    fy += 120;
  }
  if (athlete) {
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    ctx.font = font("Card Wide", 700, 28);
    ctx.fillText(wrap(ctx, athlete, left - 30, 1)[0], pad, H - pad);
  }
  return box;
}

/** Shrink a photo so the cut-out and the canvas stay quick on a phone. */
export async function loadPhoto(file: Blob, max = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/** Crop a cut-out to the pixels that are actually there. */
export async function trimTransparent(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let [x0, y0, x1, y1] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d")!.drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
