import type { ActivitySample } from "@/lib/garmin/types";
import { routeModel } from "@/lib/route-3d";
import { routeShape } from "@/lib/route-shape";
import { Route3D } from "./route-3d";

/** The route as a flat line, north up: the 3D model's stand-in while it loads, or without WebGL. */
function RouteLine({ route }: { route: [number, number][] }) {
  const W = 400;
  const H = 300;
  const { d, start, end, loop } = routeShape(route, W, H, 28);
  const [sx, sy] = start;
  const [ex, ey] = end;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" opacity={0.18} />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {!loop && <circle cx={ex} cy={ey} r={6} fill="var(--panel)" stroke="currentColor" strokeWidth={3} />}
      <circle cx={sx} cy={sy} r={6} fill="currentColor" stroke="var(--panel)" strokeWidth={2} />
    </svg>
  );
}

/**
 * The route as a solid model on the watch-face panel. No basemap on purpose:
 * drawing it ourselves keeps GPS tracks off third-party tile servers.
 */
export function RouteMap({ route, samples, distanceM }: { route: [number, number][]; samples: ActivitySample[]; distanceM: number }) {
  if (route.length < 2) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-[2rem] bg-panel p-8 text-center text-panel-muted">
        No GPS route. Indoor or treadmill run.
      </div>
    );
  }

  const model = routeModel(route, samples, distanceM);
  const height =
    model.climbRangeM === null
      ? "No elevation recorded, so the wall is level."
      : `The wall's height follows the elevation (${Math.round(model.climbRangeM)} m from lowest to highest), exaggerated to show it.`;
  return (
    <Route3D
      model={model}
      fallback={<RouteLine route={route} />}
      caption={`${height} The navy block marks the start. Drag or use the arrow keys to turn it.`}
    />
  );
}
