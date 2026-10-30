"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { routeShape } from "@/lib/route-shape";

// The route on a real map: MapLibre with OpenFreeMap's free vector tiles (no
// key, OpenStreetMap data). The map follows the page theme. Until it loads,
// or without WebGL, a flat drawing of the route shows instead.

const STYLES = { light: "https://tiles.openfreemap.org/styles/positron", dark: "https://tiles.openfreemap.org/styles/dark" };
const COLORS = {
  light: { line: "#1F47F5", casing: "#ffffff", dot: "#ffffff" },
  dark: { line: "#8ea4ff", casing: "#020818", dot: "#020818" },
};
type Theme = keyof typeof STYLES;

function pageTheme(): Theme {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "dark" || set === "light") return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** The route as a flat line, north up, while the map loads or when it can't. */
function RouteLine({ route }: { route: [number, number][] }) {
  const W = 400;
  const H = 300;
  const { d, start, end, loop } = routeShape(route, W, H, 28);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full text-panel-foreground" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" opacity={0.18} />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {!loop && <circle cx={end[0]} cy={end[1]} r={6} fill="var(--panel)" stroke="currentColor" strokeWidth={3} />}
      <circle cx={start[0]} cy={start[1]} r={6} fill="currentColor" stroke="var(--panel)" strokeWidth={2} />
    </svg>
  );
}

/** GeoJSON for the line and its start and finish (MapLibre wants [lon, lat]). */
function routeData(route: [number, number][]) {
  const coords = route.map(([lat, lon]) => [lon, lat]);
  return {
    line: { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: coords } },
    ends: {
      type: "FeatureCollection" as const,
      features: [
        { type: "Feature" as const, properties: { end: "finish" }, geometry: { type: "Point" as const, coordinates: coords[coords.length - 1] } },
        { type: "Feature" as const, properties: { end: "start" }, geometry: { type: "Point" as const, coordinates: coords[0] } },
      ],
    },
  };
}

function addRoute(map: MapLibreMap, route: [number, number][], theme: Theme) {
  const c = COLORS[theme];
  const { line, ends } = routeData(route);
  if (map.getSource("route")) {
    (map.getSource("route") as GeoJSONSource).setData(line);
    return;
  }
  map.addSource("route", { type: "geojson", data: line });
  map.addSource("ends", { type: "geojson", data: ends });
  const round = { "line-join": "round", "line-cap": "round" } as const;
  map.addLayer({ id: "route-casing", type: "line", source: "route", layout: round, paint: { "line-color": c.casing, "line-width": 9 } });
  map.addLayer({ id: "route-line", type: "line", source: "route", layout: round, paint: { "line-color": c.line, "line-width": 5 } });
  // Start: a filled dot. Finish: a ring.
  map.addLayer({
    id: "route-ends",
    type: "circle",
    source: "ends",
    paint: {
      "circle-radius": 7,
      "circle-color": ["match", ["get", "end"], "start", c.line, c.dot],
      "circle-stroke-color": ["match", ["get", "end"], "start", c.dot, c.line],
      "circle-stroke-width": 3,
    },
  });
}

export function RouteMap({ route }: { route: [number, number][] }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    const el = host.current;
    if (!el || route.length < 2) return;
    let map: MapLibreMap | null = null;
    let observer: MutationObserver | null = null;
    let disposed = false;
    const media = matchMedia("(prefers-color-scheme: dark)");
    let theme = pageTheme();

    const retheme = () => {
      const next = pageTheme();
      if (!map || next === theme) return;
      theme = next;
      map.setStyle(STYLES[theme]);
    };

    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (disposed) return;
        maplibre.setWorkerUrl(new URL("/maplibre-worker", location.origin).href);
        const lats = route.map((p) => p[0]);
        const lons = route.map((p) => p[1]);
        map = new maplibre.Map({
          container: el,
          style: STYLES[theme],
          bounds: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
          fitBoundsOptions: { padding: 40 },
          attributionControl: { compact: true },
          // Scrolling the page past the map shouldn't zoom it.
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.on("style.load", () => map && addRoute(map, route, theme));
        map.once("load", () => {
          if (disposed) return;
          // Start the attribution folded to its "i" button; it opens on tap.
          el.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
          setState("ready");
        });
        map.on("error", (e) => {
          // Tile hiccups are fine; only give up when the style itself can't load.
          if (!map?.isStyleLoaded() && !disposed) setState((s) => (s === "loading" ? "failed" : s));
          console.warn("Route map:", e.error?.message);
        });
        observer = new MutationObserver(retheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        media.addEventListener("change", retheme);
      } catch {
        if (!disposed) setState("failed"); // No WebGL: keep the drawing.
      }
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      media.removeEventListener("change", retheme);
      map?.remove();
    };
  }, [route]);

  if (route.length < 2) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-[2rem] bg-panel p-8 text-center text-panel-muted">
        No GPS route. Indoor or treadmill run.
      </div>
    );
  }

  return (
    <figure className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-panel">
        {state !== "ready" && (
          <div className="absolute inset-0 p-6">
            <RouteLine route={route} />
          </div>
        )}
        <div
          ref={host}
          role="img"
          aria-label="Map of the run's route"
          className={`absolute inset-0 transition-opacity duration-500 ${state === "ready" ? "opacity-100" : "opacity-0"}`}
        />
      </div>
      <figcaption className="text-sm text-muted-foreground">
        {state === "failed"
          ? "The map couldn't load, so this is the route's shape, north up."
          : "The filled dot is the start, the ring the finish. Use the buttons, pinch, or Ctrl/⌘ and scroll to zoom."}
      </figcaption>
    </figure>
  );
}
