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
  const PAD = 28;
  const lats = route.map((p) => p[0]);
  const lons = route.map((p) => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  // Equirectangular projection: shrink longitude by cos(latitude).
  const k = Math.cos((midLat * Math.PI) / 180);
  const xs = lons.map((l) => l * k);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...lats), Math.max(...lats)];
  const scale = Math.min((W - PAD * 2) / (x1 - x0 || 1), (H - PAD * 2) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * scale) / 2;
  const oy = (H - (y1 - y0) * scale) / 2;
  const pts = route.map(([lat], i) => [ox + (xs[i] - x0) * scale, H - (oy + (lat - y0) * scale)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const [sx, sy] = pts[0];
  const [ex, ey] = pts[pts.length - 1];
  const loop = Math.hypot(ex - sx, ey - sy) < 12;

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
