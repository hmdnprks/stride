import { routeShape } from "@/lib/route-shape";

/**
 * The route as a line on the watch-face panel. No basemap on purpose: drawing
 * it ourselves keeps GPS tracks off third-party tile servers.
 */
export function RouteMap({ route }: { route: [number, number][] }) {
  if (route.length < 2) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-[2rem] bg-panel p-8 text-center text-panel-muted">
        No GPS route. Indoor or treadmill run.
      </div>
    );
  }

  const W = 400;
  const H = 300;
  const { d, start, end, loop } = routeShape(route, W, H, 28);
  const [sx, sy] = start;
  const [ex, ey] = end;

  return (
    <figure className="flex flex-col gap-2">
      <div className="rounded-[2rem] bg-panel p-4 text-panel-foreground">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Route shape, from start to finish">
          <path d={d} fill="none" stroke="currentColor" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" opacity={0.18} />
          <path d={d} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {!loop && <circle cx={ex} cy={ey} r={6} fill="var(--panel)" stroke="currentColor" strokeWidth={3} />}
          <circle cx={sx} cy={sy} r={6} fill="currentColor" stroke="var(--panel)" strokeWidth={2} />
        </svg>
      </div>
      <figcaption className="text-sm text-muted-foreground">
        {loop ? "Loop. Solid dot marks the start and finish." : "Solid dot is the start, ring is the finish."} North is up.
      </figcaption>
    </figure>
  );
}
