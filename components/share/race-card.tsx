"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download04Icon, Medal01Icon, Share08Icon } from "@hugeicons/core-free-icons";
import {
  drawRaceCard,
  loadCardAssets,
  loadPhoto,
  RACE_CARD_SIZES,
  trimTransparent,
  type BibBox,
  type BibPhoto,
  type RaceCardData,
  type RaceCardFormat,
} from "@/lib/race-card-draw";

type Medal =
  | { status: "none" }
  | { status: "cutting"; progress: number | null }
  | { status: "ready"; image: HTMLCanvasElement }
  | { status: "error"; message: string };

const NAME_KEY = "stride:card-name";
const bibKey = (id: string) => `stride:card-bib:${id}`;

function remembered(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function remember(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
}

/** Cut the medal out of the photo in the browser; the model downloads once (about 40 MB) and is cached. */
async function cutOut(file: File, onProgress: (share: number) => void) {
  const { removeBackground } = await import("@imgly/background-removal");
  const photo = await loadPhoto(file, 1400);
  const input = await new Promise<Blob>((resolve, reject) => photo.toBlob((b) => (b ? resolve(b) : reject(new Error("photo"))), "image/png"));
  const files = new Map<string, [number, number]>();
  const blob = await removeBackground(input, {
    model: "isnet_quint8",
    output: { format: "image/png" },
    progress: (key, current, total) => {
      if (!key.startsWith("fetch:") || !total) return;
      files.set(key, [current, total]);
      const [done, all] = [...files.values()].reduce(([a, b], [c, t]) => [a + c, b + t], [0, 0]);
      onProgress(done / all);
    },
  });
  return trimTransparent(blob);
}

function PhotoButton({ label, onPick, disabled }: { label: string; onPick: (file: File) => void; disabled?: boolean }) {
  return (
    <label className="flex h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold outline outline-1 outline-border hover:outline-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring has-disabled:cursor-default has-disabled:opacity-60">
      <input
        type="file"
        accept="image/*"
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
      {label}
    </label>
  );
}

/**
 * The race card: the result in the watch-face style with the runner's medal
 * (cut out of its background) and bib on it. Everything is drawn here in the
 * browser; the photos aren't uploaded or kept.
 */
export function RaceCard({ data, runId, filename }: { data: RaceCardData; runId: string; filename: string }) {
  const panelId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bibBox = useRef<BibBox>(null);
  const drag = useRef<{ x: number; y: number; bx: number; by: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<RaceCardFormat>("story");
  const [mark, setMark] = useState<HTMLImageElement | null>(null);
  const [assetsFailed, setAssetsFailed] = useState(false);
  const [medal, setMedal] = useState<Medal>({ status: "none" });
  const [bib, setBib] = useState<BibPhoto | null>(null);
  const [bibNumber, setBibNumber] = useState("");
  const [athlete, setAthlete] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");

  // Open straight away when linked from a race (…#race-card), and restore the name and bib number.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reading the URL and localStorage once, after hydration */
    setAthlete(remembered(NAME_KEY));
    setBibNumber(remembered(bibKey(runId)));
    if (location.hash === "#race-card") setOpen(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [runId]);

  useEffect(() => {
    if (!open || mark) return;
    loadCardAssets().then(setMark, () => setAssetsFailed(true));
  }, [open, mark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!open || !mark || !canvas) return;
    const ctx = canvas.getContext("2d")!;
    bibBox.current = drawRaceCard(
      ctx,
      format,
      { data, athlete, bibNumber, bib, medal: medal.status === "ready" ? medal.image : null },
      mark,
    );
  }, [open, mark, format, data, athlete, bibNumber, bib, medal]);

  async function pickMedal(file: File) {
    setMedal({ status: "cutting", progress: null });
    try {
      const image = await cutOut(file, (progress) => setMedal({ status: "cutting", progress }));
      setMedal(image ? { status: "ready", image } : { status: "error", message: "Couldn't find the medal in that photo. Try one with the medal against a plain background." });
    } catch {
      setMedal({ status: "error", message: "Couldn't cut out the medal. Check your connection (the first time downloads the cut-out tool) and try again." });
    }
  }

  async function pickBib(file: File) {
    try {
      setBib({ image: await loadPhoto(file), zoom: 1, x: 0, y: 0 });
    } catch {
      setBib(null);
    }
  }

  /** Card pixels under a pointer on the preview. */
  function cardPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const { width, height } = RACE_CARD_SIZES[format];
    return { x: ((e.clientX - rect.left) / rect.width) * width, y: ((e.clientY - rect.top) / rect.height) * height };
  }

  function startDrag(e: React.PointerEvent<HTMLCanvasElement>) {
    const box = bibBox.current;
    if (!bib || !box) return;
    const p = cardPoint(e);
    if (Math.abs(p.x - box.cx) > box.w / 2 || Math.abs(p.y - box.cy) > box.h / 2) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: p.x, y: p.y, bx: bib.x, by: bib.y };
  }

  function moveDrag(e: React.PointerEvent<HTMLCanvasElement>) {
    const start = drag.current;
    const box = bibBox.current;
    if (!start || !bib || !box) return;
    const p = cardPoint(e);
    // Pan as a share of the photo as drawn (it covers the bib, times the zoom).
    const scale = Math.max(box.w / bib.image.width, box.h / bib.image.height) * bib.zoom;
    const clamp = (v: number) => Math.max(-0.5, Math.min(0.5, v));
    setBib({ ...bib, x: clamp(start.bx + (p.x - start.x) / (bib.image.width * scale)), y: clamp(start.by + (p.y - start.y) / (bib.image.height * scale)) });
  }

  const name = `${filename}-${format}.png`;
  const toBlob = () => new Promise<Blob>((resolve, reject) => canvasRef.current?.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"));

  async function share() {
    setStatus("busy");
    try {
      const blob = await toBlob();
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else save(blob);
      setStatus("idle");
    } catch (err) {
      setStatus(err instanceof DOMException && err.name === "AbortError" ? "idle" : "error");
    }
  }

  async function download() {
    try {
      save(await toBlob());
    } catch {
      setStatus("error");
    }
  }

  function save(blob: Blob) {
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  }

  const { width, height } = RACE_CARD_SIZES[format];
  const cutting = medal.status === "cutting";

  return (
    <div id="race-card" className="flex scroll-mt-24 flex-col gap-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 items-center gap-2 self-start rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-deep hover:text-background aria-expanded:bg-foreground aria-expanded:text-background"
      >
        <HugeiconsIcon icon={Medal01Icon} size={18} strokeWidth={1.8} />
        Race card
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-6 rounded-[2rem] border border-border p-4 sm:flex-row sm:p-6">
              <div className="flex flex-col items-center gap-2 self-center sm:self-start">
                <canvas
                  ref={canvasRef}
                  width={width}
                  height={height}
                  role="img"
                  aria-label={`Preview of the ${format} race card`}
                  onPointerDown={startDrag}
                  onPointerMove={moveDrag}
                  onPointerUp={() => (drag.current = null)}
                  onPointerCancel={() => (drag.current = null)}
                  className={`touch-none rounded-2xl bg-panel shadow-sm ${format === "story" ? "aspect-[9/16] w-56 sm:w-64" : "aspect-square w-72"} ${bib ? "cursor-grab active:cursor-grabbing" : ""}`}
                />
                {!mark && <p className="text-sm text-muted-foreground">{assetsFailed ? "Couldn't load the card's fonts." : "Loading…"}</p>}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-6">
                <fieldset className="flex flex-col gap-3">
                  <legend className="mb-2 text-sm font-semibold">Medal</legend>
                  <div className="flex flex-wrap items-center gap-2">
                    <PhotoButton label={medal.status === "ready" ? "Change photo" : "Add a photo"} onPick={pickMedal} disabled={cutting} />
                    {medal.status === "ready" && (
                      <button type="button" onClick={() => setMedal({ status: "none" })} className="h-11 px-2 text-sm text-muted-foreground hover:text-foreground">
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {cutting
                      ? medal.progress !== null && medal.progress < 1
                        ? `Getting the cut-out tool ready… ${Math.round(medal.progress * 100)}%`
                        : "Cutting out the medal…"
                      : medal.status === "error"
                        ? medal.message
                        : "Stride cuts the medal out of the photo. The first time downloads a 40 MB tool; photos stay on this device."}
                  </p>
                </fieldset>

                <fieldset className="flex flex-col gap-3">
                  <legend className="mb-2 text-sm font-semibold">Bib</legend>
                  <div className="flex flex-wrap items-center gap-2">
                    <PhotoButton label={bib ? "Change photo" : "Add a photo"} onPick={pickBib} />
                    {bib && (
                      <button type="button" onClick={() => setBib(null)} className="h-11 px-2 text-sm text-muted-foreground hover:text-foreground">
                        Remove
                      </button>
                    )}
                  </div>
                  {bib && (
                    <label className="flex max-w-xs flex-col gap-1 text-sm">
                      <span className="text-muted-foreground">Zoom, then drag the bib in the preview to frame it</span>
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.05}
                        value={bib.zoom}
                        onChange={(e) => setBib({ ...bib, zoom: Number(e.target.value) })}
                        className="accent-primary"
                      />
                    </label>
                  )}
                  <label className="flex max-w-xs flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">Bib number{bib ? "" : " (printed on a plain bib without a photo)"}</span>
                    <input
                      value={bibNumber}
                      maxLength={8}
                      inputMode="text"
                      autoComplete="off"
                      onChange={(e) => {
                        setBibNumber(e.target.value.toUpperCase());
                        remember(bibKey(runId), e.target.value.toUpperCase());
                      }}
                      className="h-11 rounded-xl border-2 border-border bg-background px-3 outline-none focus:border-foreground"
                    />
                  </label>
                </fieldset>

                <label className="flex max-w-xs flex-col gap-1 text-sm">
                  <span className="font-semibold">Your name</span>
                  <input
                    value={athlete}
                    maxLength={40}
                    autoComplete="name"
                    onChange={(e) => {
                      setAthlete(e.target.value);
                      remember(NAME_KEY, e.target.value);
                    }}
                    className="h-11 rounded-xl border-2 border-border bg-background px-3 outline-none focus:border-foreground"
                  />
                </label>

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-semibold">Size</legend>
                  <div className="flex flex-wrap gap-2">
                    {(["story", "square"] as const).map((f) => (
                      <label
                        key={f}
                        className="flex h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold outline outline-1 outline-border hover:outline-foreground has-checked:bg-foreground has-checked:text-background has-checked:outline-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring"
                      >
                        <input type="radio" name={`${panelId}-format`} value={f} checked={format === f} onChange={() => setFormat(f)} className="sr-only" />
                        {f === "story" ? "Story" : "Square"}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={share}
                    disabled={status === "busy" || !mark || cutting}
                    className="flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-deep hover:text-background disabled:opacity-60"
                  >
                    <HugeiconsIcon icon={Share08Icon} size={18} strokeWidth={1.8} />
                    {status === "busy" ? "Preparing image…" : "Share"}
                  </button>
                  <button
                    type="button"
                    onClick={download}
                    disabled={!mark || cutting}
                    className="flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold outline outline-1 outline-border hover:outline-foreground disabled:opacity-60"
                  >
                    <HugeiconsIcon icon={Download04Icon} size={18} strokeWidth={1.8} />
                    Download
                  </button>
                </div>
                {status === "error" && (
                  <p role="alert" className="text-sm font-semibold">
                    Couldn&apos;t make the image. Try again.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
