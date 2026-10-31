import { cookies } from "next/headers";
import { getDemoHistory, isConnected, loadAllHistory } from "@/lib/garmin";
import { dailyCsv, isExportKind, runsCsv } from "@/lib/export";
import { GATE_COOKIE, isUnlocked } from "@/lib/gate";
import { buildRaces } from "@/lib/races";
import { getSettings } from "@/lib/settings";
import { isoDate } from "@/lib/trends";

// CSV downloads from the account menu: /api/export/runs and /api/export/daily,
// with ?source=demo for the demo dashboard. Garmin exports cover everything
// stored (about 400 days once synced).

/** Before the first sync, an export fetches a year from Garmin. */
export const maxDuration = 120;

export async function GET(request: Request, { params }: RouteContext<"/api/export/[kind]">) {
  if (!isUnlocked((await cookies()).get(GATE_COOKIE)?.value)) return new Response("Stride is locked.", { status: 401 });
  const { kind } = await params;
  if (!isExportKind(kind)) return new Response("Not found", { status: 404 });

  const demo = new URL(request.url).searchParams.get("source") === "demo";
  if (!demo && !(await isConnected())) return new Response("Not connected to Garmin.", { status: 409 });

  let history;
  try {
    history = demo ? getDemoHistory(400) : await loadAllHistory();
  } catch (err) {
    return new Response(`Couldn't load your data: ${err instanceof Error ? err.message : "unknown error"}`, { status: 502 });
  }
  let body;
  if (kind === "runs") {
    // The Race column follows Stride's races: Garmin's marks, Stride's own, and matched goals.
    const settings = await getSettings(demo ? "demo" : "garmin");
    const races = new Set(buildRaces(settings.races, history.runs, history.daily, isoDate(new Date()), settings.raceMarks, settings.raceNames).past.map((r) => r.run?.id));
    body = runsCsv(history.runs.map((r) => ({ ...r, race: races.has(r.id) })), { garmin: !demo });
  } else {
    body = dailyCsv(history.daily);
  }
  const name = `stride-${demo ? "demo-" : ""}${kind}-${isoDate(new Date())}.csv`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
