/**
 * A GPS route as an SVG path fitted into a W×H box, north up. Equirectangular
 * projection (longitude shrunk by cos(latitude)), which is plenty at run scale.
 */
export function routeShape(route: [number, number][], W: number, H: number, PAD: number) {
  const lats = route.map((p) => p[0]);
  const lons = route.map((p) => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xs = lons.map((l) => l * k);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...lats), Math.max(...lats)];
  const scale = Math.min((W - PAD * 2) / (x1 - x0 || 1), (H - PAD * 2) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * scale) / 2;
  const oy = (H - (y1 - y0) * scale) / 2;
  const pts = route.map(([lat], i) => [ox + (xs[i] - x0) * scale, H - (oy + (lat - y0) * scale)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const start = pts[0];
  const end = pts[pts.length - 1];
  // Start and finish within a few percent of the box: draw it as a loop.
  const loop = Math.hypot(end[0] - start[0], end[1] - start[1]) < Math.min(W, H) * 0.04;
  return { d, start, end, loop };
}
