import { readFile } from "node:fs/promises";
import path from "node:path";

// MapLibre's web worker, served from the package so the run page's map can
// start it (the bundler doesn't emit it on its own). Same version as the
// library, so it can be cached for a long time.

const FILE = path.join(process.cwd(), "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
let source: Promise<string> | null = null;

export async function GET() {
  source ??= readFile(FILE, "utf8");
  return new Response(await source, {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
}
