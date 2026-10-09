"use client";

// Adapted from uselayouts "save-button" (https://uselayouts.com).
// Changes: status is controlled by the caller, labels are configurable, uses a
// native button (no shadcn Button in this project), project tokens.

import { AnimatePresence, motion } from "motion/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

export type ButtonStatus = "idle" | "loading" | "success";

export function StatusButton({
  status,
  labels,
  onClick,
  type = "button",
  name,
  value,
  className,
  variant = "solid",
}: {
  status: ButtonStatus;
  labels: Record<ButtonStatus, string>;
  onClick?: () => void;
  type?: "button" | "submit";
  name?: string;
  value?: string;
  className?: string;
  variant?: "solid" | "quiet" | "ink";
}) {
  const text = labels[status];

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type={type}
        name={name}
        value={value}
        onClick={onClick}
        disabled={status !== "idle"}
        aria-live="polite"
        className={cn(
          "relative inline-flex w-full items-center justify-center rounded-full font-semibold transition-colors duration-300 disabled:cursor-default",
          variant === "quiet" ? "h-11 min-w-[104px] px-5 text-sm" : "h-12 min-w-[140px] px-8 text-base",
          status === "idle"
            ? {
                solid: "bg-primary text-primary-foreground hover:bg-deep hover:text-background",
                quiet: "bg-secondary text-foreground outline outline-1 outline-border hover:outline-foreground",
                ink: "bg-foreground text-background hover:bg-deep",
              }[variant]
            : variant === "ink"
              ? "bg-foreground/70 text-background"
              : "bg-muted text-muted-foreground outline outline-1 outline-border",
        )}
      >
        <span className="flex items-center justify-center">
          <AnimatePresence mode="popLayout" initial={false}>
            {text.split("").map((char, i) => (
              <motion.span
                key={`${char}-${i}`}
                layout
                initial={{ opacity: 0, scale: 0, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 500, damping: 30, mass: 1 }}
                className="inline-block whitespace-pre"
              >
                {char}
              </motion.span>
            ))}
          </AnimatePresence>
        </span>
      </button>

      <span className="pointer-events-none absolute -top-1 -right-1 z-10">
        <AnimatePresence mode="wait">
          {status !== "idle" && (
            <motion.span
              initial={{ opacity: 0, scale: 0, x: -8, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0, x: -8, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={cn(
                "relative flex size-6 items-center justify-center rounded-full ring-3 ring-background",
                status === "success" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              <AnimatePresence mode="popLayout">
                {status === "loading" && (
                  <motion.span
                    key="loader"
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M12 2A10 10 0 1 0 22 12A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8A8 8 0 0 1 12 20Z"
                        opacity=".5"
                      />
                      <path fill="currentColor" d="M20 12h2A10 10 0 0 0 12 2V4A8 8 0 0 1 20 12Z">
                        <animateTransform
                          attributeName="transform"
                          dur="1s"
                          from="0 12 12"
                          repeatCount="indefinite"
                          to="360 12 12"
                          type="rotate"
                        />
                      </path>
                    </svg>
                  </motion.span>
                )}
                {status === "success" && (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, opacity: 0, filter: "blur(4px)" }}
                    animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                    exit={{ scale: 0, opacity: 0, filter: "blur(4px)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <HugeiconsIcon icon={Tick02Icon} className="size-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </span>
  );
}
