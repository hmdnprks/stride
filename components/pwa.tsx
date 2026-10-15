"use client";

import { useEffect } from "react";

// Installed-app plumbing: registers the service worker (production only, so
// development never serves stale pages) and keeps the browser's theme colour,
// which tints the status bar of the installed app, matched to the page theme.

const THEME_COLORS = { light: "#ffffff", dark: "#040a1e" };

function syncThemeColor() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[dark ? "dark" : "light"]);
}

export function Pwa() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    syncThemeColor();
    const observer = new MutationObserver(syncThemeColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return null;
}
