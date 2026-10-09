"use client";

// Adapted from uselayouts "smooth-dropdown" (https://uselayouts.com).
// Changes: items and trigger come from props, items are real buttons with
// keyboard support (Escape closes), a header row, project tokens.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import useMeasure from "react-use-measure";
import { cn } from "@/lib/utils";

export interface DropdownItem {
  id: string;
  label: string;
  icon: IconSvgElement;
  onSelect: () => void;
}

const easeOutQuint: [number, number, number, number] = [0.23, 1, 0.32, 1];
const spring = { type: "spring", damping: 34, stiffness: 380, mass: 0.8 } as const;
const WIDTH = 248;

export function SmoothDropdown({
  trigger,
  triggerLabel,
  header,
  items,
}: {
  trigger: ReactNode;
  triggerLabel: string;
  header?: ReactNode;
  items: DropdownItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentRef, bounds] = useMeasure();

  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const openHeight = Math.max(44, Math.ceil(bounds.height));

  return (
    <div ref={containerRef} className="relative z-30 size-11">
      <motion.div
        initial={false}
        animate={{ width: isOpen ? WIDTH : 44, height: isOpen ? openHeight : 44, borderRadius: isOpen ? 18 : 22 }}
        transition={spring}
        className="absolute top-0 right-0 origin-top-right overflow-hidden border border-border bg-popover shadow-[0_12px_32px_-12px_rgb(10_27_92/0.35)]"
      >
        <motion.button
          type="button"
          aria-label={triggerLabel}
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
          initial={false}
          animate={{ opacity: isOpen ? 0 : 1, scale: isOpen ? 0.8 : 1 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 flex items-center justify-center"
          style={{ pointerEvents: isOpen ? "none" : "auto" }}
        >
          {trigger}
        </motion.button>

        <div ref={contentRef} style={{ width: WIDTH }}>
          <motion.div
            initial={false}
            animate={{ opacity: isOpen ? 1 : 0 }}
            transition={{ duration: 0.2, delay: isOpen ? 0.08 : 0 }}
            className="p-2"
            style={{ pointerEvents: isOpen ? "auto" : "none" }}
            inert={!isOpen}
          >
            {header && <div className="border-b border-border px-3 pt-2 pb-3">{header}</div>}
            <ul className="mt-1 flex flex-col gap-0.5">
              {items.map((item, index) => {
                const active = hovered === item.id;
                return (
                  <motion.li
                    key={item.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 0 : 8 }}
                    transition={{ delay: isOpen ? 0.06 + index * 0.02 : 0, duration: 0.15, ease: easeOutQuint }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        item.onSelect();
                      }}
                      onMouseEnter={() => setHovered(item.id)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(item.id)}
                      onBlur={() => setHovered(null)}
                      className={cn(
                        "relative flex w-full items-center gap-3 rounded-lg py-2 pl-3 text-left text-sm transition-colors duration-200 ease-out",
                        active ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {active && (
                        <>
                          <motion.span layoutId="dropdown-bg" className="absolute inset-0 rounded-lg bg-muted" transition={spring} />
                          <motion.span
                            layoutId="dropdown-bar"
                            className="absolute inset-y-0 left-0 my-auto h-5 w-[3px] rounded-full bg-primary"
                            transition={spring}
                          />
                        </>
                      )}
                      <HugeiconsIcon icon={item.icon} className="relative z-10 size-[18px]" />
                      <span className="relative z-10 font-medium">{item.label}</span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
