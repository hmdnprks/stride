import { cookies } from "next/headers";
import { getDemoHistory, isConnected, loadAllHistory } from "@/lib/garmin";
import { dailyCsv, isExportKind, runsCsv } from "@/lib/export";
import { GATE_COOKIE, isUnlocked } from "@/lib/gate";
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
  const body = kind === "runs" ? runsCsv(history.runs, { garmin: !demo }) : dailyCsv(history.daily);
  const name = `stride-${demo ? "demo-" : ""}${kind}-${isoDate(new Date())}.csv`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
