"use client";

// Adapted from uselayouts "theme-toggle" (https://uselayouts.com).
// Changes: drives the page theme (data-theme + localStorage), sized for a
// toolbar, track colour from the project's primary token.

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";

export function ThemeToggle() {
  const checked = useSyncExternalStore(subscribe, isDark, () => false);

  const setTheme = (dark: boolean) => {
    const theme = dark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  };

  const wrapper = checked
    ? "bg-gradient-to-b from-[#0d1838] to-[#1a2a55] shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_1px_1px_rgb(0_0_0/0.5)]"
    : "bg-gradient-to-b from-[#d5dbe8] to-[#eef2fd] shadow-[0_1px_1px_rgb(255_255_255/0.6)]";
  const track = checked
    ? "bg-[#1a2a55] shadow-[inset_0_0_0.0625em_0.125em_rgb(255_255_255/0.05),inset_0_0.0625em_0.125em_rgb(0_0_0/0.75)]"
    : "bg-[#e3e8f5] shadow-[inset_0_0_0.0625em_0.125em_rgb(255_255_255/0.2),inset_0_0.0625em_0.125em_rgb(0_0_0/0.4)]";
  const knob = checked
    ? "bg-[#c5cdd8] shadow-[inset_0_-0.0625em_0.0625em_0.125em_rgb(0_0_0/0.16),inset_0_-0.125em_0.0625em_rgb(0_0_0/0.22),inset_0_0.1875em_0.0625em_rgb(255_255_255/0.5),0_0.125em_0.125em_rgb(0_0_0/0.45)]"
    : "bg-[#eef2fd] shadow-[inset_0_-0.0625em_0.0625em_0.125em_rgb(0_0_0/0.1),inset_0_-0.125em_0.0625em_rgb(0_0_0/0.2),inset_0_0.1875em_0.0625em_rgb(255_255_255/0.3),0_0.125em_0.125em_rgb(0_0_0/0.5)]";
  const grip = checked
    ? "bg-[radial-gradient(circle_at_50%_0,#eef2f7,#64748b)]"
    : "bg-[radial-gradient(circle_at_50%_0,#f5f5f5,#c4c4c4)]";

  return (
    <div className={`relative flex items-center justify-center rounded-[0.5em] p-[0.125em] text-[1.125rem] ${wrapper}`}>
      <input
        type="checkbox"
        role="switch"
        aria-label="Dark mode"
        checked={checked}
        onChange={(e) => setTheme(e.target.checked)}
        className="peer absolute inset-0 z-[1] size-full cursor-pointer appearance-none rounded-[inherit] opacity-0"
      />
      <div
        className={`relative flex h-[1.5em] w-[3em] items-center rounded-[0.375em] transition-[background-color] duration-[400ms] ease-linear peer-checked:bg-primary peer-checked:[&_[data-knob]]:translate-x-[1.5em] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring ${track}`}
      >
        <div
          data-knob
          className={`absolute left-[0.0625em] flex size-[1.375em] items-center justify-center rounded-[0.3125em] transition-transform duration-[220ms] ease-[cubic-bezier(0.32,0.72,0,1)] [will-change:transform] ${knob}`}
        >
          <div className="absolute mx-auto grid grid-cols-[repeat(3,min-content)] gap-[0.125em]">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={`size-[0.125em] rounded-full ${grip}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
