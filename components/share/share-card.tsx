"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download04Icon, Share08Icon } from "@hugeicons/core-free-icons";

type Format = "story" | "square";

const FORMATS: { id: Format; label: string; hint: string }[] = [
  { id: "story", label: "Story", hint: "9:16, for Instagram and WhatsApp status" },
  { id: "square", label: "Square", hint: "1:1, for chats and feeds" },
];

/**
 * "Share" opens a panel with a live preview of the image card, a format
 * choice and, for runs, whether to draw the route. Then the phone's share
 * sheet (where the browser can share files) or a plain download.
 */
export function ShareCard({
  src,
  filename,
  label,
  routeOption = false,
}: {
  /** Card URL without format options, e.g. /api/card/run/123 or …?source=demo */
  src: string;
  /** Download name without extension. */
  filename: string;
  label: string;
  /** Offer to draw the GPS route (run story cards). */
  routeOption?: boolean;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("story");
  const [withRoute, setWithRoute] = useState(false);
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");

  const params = new URLSearchParams({ format });
  if (routeOption && withRoute && format === "story") params.set("route", "1");
  const url = `${src}${src.includes("?") ? "&" : "?"}${params}`;
  const name = `${filename}-${format}.png`;

  async function share() {
    setStatus("busy");
    try {
      const blob = await fetch(url).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      });
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        save(URL.createObjectURL(blob));
      }
      setStatus("idle");
    } catch (err) {
      // Closing the share sheet isn't a failure.
      setStatus(err instanceof DOMException && err.name === "AbortError" ? "idle" : "error");
    }
  }

  function save(href: string) {
    const link = document.createElement("a");
    link.href = href;
    link.download = name;
    link.click();
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 items-center gap-2 self-start rounded-full bg-secondary px-4 text-sm font-semibold outline outline-1 outline-border hover:outline-foreground aria-expanded:bg-foreground aria-expanded:text-background aria-expanded:outline-foreground"
      >
        <HugeiconsIcon icon={Share08Icon} size={18} strokeWidth={1.8} />
        {label}
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
              {/* eslint-disable-next-line @next/next/no-img-element -- generated per request, not an optimisable asset */}
              <img
                key={url}
                src={url}
                alt={`Preview of the ${format} card`}
                className={`self-center rounded-2xl bg-panel shadow-sm sm:self-start ${format === "story" ? "aspect-[9/16] w-44 sm:w-56" : "aspect-square w-60 sm:w-72"}`}
              />

              <div className="flex min-w-0 flex-col gap-5">
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm text-muted-foreground">Size</legend>
                  <div className="flex flex-wrap gap-2">
                    {FORMATS.map((f) => (
                      <label
                        key={f.id}
                        className="flex h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold outline outline-1 outline-border hover:outline-foreground has-checked:bg-foreground has-checked:text-background has-checked:outline-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring"
                      >
                        <input type="radio" name={`${panelId}-format`} value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} className="sr-only" />
                        {f.label}
                      </label>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">{FORMATS.find((f) => f.id === format)!.hint}</p>
                </fieldset>

                {routeOption && (
                  <label className={`flex items-start gap-3 text-sm ${format === "story" ? "" : "text-muted-foreground"}`}>
                    <input
                      type="checkbox"
                      checked={withRoute}
                      disabled={format !== "story"}
                      onChange={(e) => setWithRoute(e.target.checked)}
                      className="mt-0.5 size-5 accent-primary"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold">Draw the route</span>
                      <span className="text-muted-foreground">
                        {format === "story" ? "Off by default: a route often starts at your front door." : "Story size only."}
                      </span>
                    </span>
                  </label>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={share}
                    disabled={status === "busy"}
                    className="flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-deep hover:text-background disabled:opacity-60"
                  >
                    <HugeiconsIcon icon={Share08Icon} size={18} strokeWidth={1.8} />
                    {status === "busy" ? "Preparing image…" : "Share"}
                  </button>
                  <button
                    type="button"
                    onClick={() => save(url)}
                    className="flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold outline outline-1 outline-border hover:outline-foreground"
                  >
                    <HugeiconsIcon icon={Download04Icon} size={18} strokeWidth={1.8} />
                    Download
                  </button>
                </div>
                {status === "error" && (
                  <p role="alert" className="text-sm font-semibold">
                    Couldn&apos;t make the image. Check your connection and try again.
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
