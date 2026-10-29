"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

/**
 * A small "i" that explains a term: opens on hover, focus or tap, closes on
 * Escape, tap outside or scroll. The bubble sits in the top layer (popover), so
 * cards with overflow-hidden, like the watch face, don't clip it.
 */
export function InfoTip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = bubble.current;
    const btn = button.current;
    if (!el || !btn) return;
    if (!open) {
      if (el.matches(":popover-open")) el.hidePopover();
      return;
    }
    el.showPopover();
    // Below the button, kept inside the screen with a 16px gutter.
    const r = btn.getBoundingClientRect();
    const width = el.offsetWidth;
    el.style.left = `${Math.max(16, Math.min(window.innerWidth - width - 16, r.left + r.width / 2 - width / 2))}px`;
    el.style.top = `${r.bottom + 8}px`;

    const close = () => setOpen(false);
    const outside = (e: PointerEvent) => !btn.contains(e.target as Node) && !el.contains(e.target as Node) && close();
    const escape = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("resize", close);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onPointerEnter={(e) => e.pointerType !== "touch" && setOpen(true)}
        onPointerLeave={(e) => e.pointerType !== "touch" && setOpen(false)}
        onFocus={(e) => e.currentTarget.matches(":focus-visible") && setOpen(true)}
        onBlur={() => setOpen(false)}
        className={cn("-m-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full opacity-70 hover:opacity-100 aria-expanded:opacity-100", className)}
      >
        <HugeiconsIcon icon={InformationCircleIcon} size={17} strokeWidth={1.8} aria-hidden />
      </button>
      <div
        ref={bubble}
        id={id}
        role="tooltip"
        popover="manual"
        className="fixed m-0 w-72 max-w-[calc(100vw-2rem)] rounded-xl border-0 bg-foreground p-3.5 text-sm leading-relaxed font-normal text-background shadow-lg"
      >
        {children}
      </div>
    </>
  );
}
