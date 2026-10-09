"use client";

// Adapted from uselayouts "inline-edit" (https://uselayouts.com).
// Changes: numeric and controlled, saves through an async callback, Enter to
// save and Escape to cancel, labelled buttons, native input, project tokens.

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, useTransition } from "react";
import { Edit01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

const spring = { type: "spring", bounce: 0.1 } as const;

export function InlineEdit({
  value,
  label,
  suffix,
  placeholder,
  onSave,
}: {
  value: number | null;
  /** Accessible name, e.g. "Monthly goal". */
  label: string;
  suffix?: string;
  placeholder?: string;
  onSave: (value: number | null) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const begin = () => {
    setDraft(value === null ? "" : String(value));
    setIsEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };
  const commit = () => {
    const n = draft.trim() === "" ? null : Number(draft);
    setIsEditing(false);
    if (n === value || (n !== null && !Number.isFinite(n))) return;
    startTransition(() => onSave(n));
  };

  return (
    <motion.div
      layout
      className={cn(
        "relative flex w-44 items-center overflow-hidden rounded-full border-2 bg-background transition-colors",
        isEditing ? "border-foreground" : "border-border",
        pending && "opacity-60",
      )}
    >
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        min={0}
        aria-label={label}
        value={draft}
        placeholder={placeholder}
        readOnly={!isEditing}
        onChange={(e) => setDraft(e.target.value)}
        onClick={() => !isEditing && begin()}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setIsEditing(false);
        }}
        className={cn(
          "h-11 w-full bg-transparent pr-20 pl-4 text-base tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
          isEditing ? "text-foreground" : "cursor-pointer text-muted-foreground",
        )}
      />
      {suffix && <span className="pointer-events-none absolute right-12 text-sm text-muted-foreground">{suffix}</span>}
      <AnimatePresence initial={false} mode="popLayout">
        {!isEditing ? (
          <motion.button
            key="edit"
            type="button"
            aria-label={`Edit ${label.toLowerCase()}`}
            initial={{ x: 50 }}
            animate={{ x: 0 }}
            exit={{ x: 50 }}
            transition={spring}
            onClick={begin}
            className="absolute right-1 flex size-9 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={Edit01Icon} size={18} />
          </motion.button>
        ) : (
          <motion.button
            key="save"
            type="button"
            aria-label={`Save ${label.toLowerCase()}`}
            initial={{ x: 50 }}
            animate={{ x: 0 }}
            exit={{ x: 50 }}
            transition={spring}
            onClick={commit}
            className="absolute right-1 z-20 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-deep hover:text-background"
          >
            <HugeiconsIcon icon={Tick02Icon} size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
