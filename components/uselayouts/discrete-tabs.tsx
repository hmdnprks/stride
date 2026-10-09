"use client";

// Adapted from uselayouts "discrete-tabs" (https://uselayouts.com).
// Changes: controlled value/onChange, real tab semantics, project tokens,
// sentence-case labels instead of mono uppercase.

import { useState } from "react";
import { motion } from "motion/react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { cn } from "@/lib/utils";

export interface DiscreteTab<T extends string> {
  id: T;
  title: string;
  icon: IconSvgElement;
}

const spring = { type: "spring", damping: 20, stiffness: 230, mass: 1.2 } as const;

export function DiscreteTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: DiscreteTab<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  // Skip the label's blur-in until the user has picked a tab, so the
  // initially active tab doesn't animate on page load.
  const [interacted, setInteracted] = useState(false);
  return (
    <div role="tablist" aria-label={label} className="flex items-center gap-2">
      {tabs.map((tab) => (
        <TabButton
          key={tab.id}
          tab={tab}
          isActive={value === tab.id}
          interacted={interacted}
          onSelect={() => {
            setInteracted(true);
            onChange(tab.id);
          }}
        />
      ))}
    </div>
  );
}

function TabButton<T extends string>({
  tab,
  isActive,
  interacted,
  onSelect,
}: {
  tab: DiscreteTab<T>;
  isActive: boolean;
  interacted: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${tab.id}`}
      id={`tab-${tab.id}`}
      layoutId={`tab-${tab.id}`}
      transition={{ layout: spring }}
      onClick={onSelect}
      className="flex rounded-full"
      style={{ willChange: "transform" }}
    >
      <motion.span
        layout
        transition={{ layout: spring }}
        className={cn(
          "flex h-11 items-center gap-2 overflow-hidden rounded-full outline outline-1 transition-colors duration-75 ease-out",
          isActive
            ? "bg-foreground px-4 text-background outline-foreground"
            : "bg-secondary px-3 text-muted-foreground outline-border hover:text-foreground",
        )}
      >
        <motion.span layoutId={`tab-icon-${tab.id}`} className="shrink-0" style={{ willChange: "transform" }}>
          <HugeiconsIcon icon={tab.icon} size={20} strokeWidth={1.8} />
        </motion.span>
        {isActive ? (
          <motion.span
            initial={interacted ? { opacity: 0, filter: "blur(4px)" } : false}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: interacted ? 0.2 : 0, ease: [0.86, 0, 0.07, 1] }}
            className="text-sm font-semibold whitespace-nowrap"
          >
            {tab.title}
          </motion.span>
        ) : (
          <span className="sr-only">{tab.title}</span>
        )}
      </motion.span>
    </motion.button>
  );
}
