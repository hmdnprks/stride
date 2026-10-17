import { cookies } from "next/headers";
import { ImageResponse } from "next/og";
import { getDemoActivity, getDemoHistory, getGarminActivity, getGarminRunsBetween, isConnected } from "@/lib/garmin";
import { CARD_FORMATS, cardFonts, isCardFormat, RunCard, WeekCard } from "@/lib/card";
import { GATE_COOKIE, isUnlocked } from "@/lib/gate";
import { addDays, mondayOf } from "@/lib/trends";

// Share images: /api/card/run/{activityId} and /api/card/week/{any date in the week}.
// ?format=story|square (default story), ?route=1 to draw the GPS route on a
// run's story card (off by default: a route usually starts at home), and
// ?source=demo for the demo dashboard.

export const maxDuration = 60;

export async function GET(request: Request, { params }: RouteContext<"/api/card/[kind]/[id]">) {
  if (!isUnlocked((await cookies()).get(GATE_COOKIE)?.value)) return new Response("Stride is locked.", { status: 401 });
  const { kind, id } = await params;
  const query = new URL(request.url).searchParams;
  const format = isCardFormat(query.get("format")) ? (query.get("format") as "story" | "square") : "story";
  const demo = query.get("source") === "demo";
  if (!demo && !(await isConnected())) return new Response("Not connected to Garmin.", { status: 409 });

  let card;
  if (kind === "run") {
    const detail = demo ? getDemoActivity(id) : await getGarminActivity(id);
    if (!detail) return new Response("Run not found.", { status: 404 });
    card = <RunCard run={detail.run} route={query.get("route") === "1" ? detail.route : null} format={format} />;
  } else if (kind === "week" && /^\d{4}-\d{2}-\d{2}$/.test(id)) {
    const start = mondayOf(id);
    const end = addDays(start, 6);
    const runs = demo
      ? getDemoHistory(400).runs.filter((r) => r.startLocal.slice(0, 10) >= start && r.startLocal.slice(0, 10) <= end)
      : await getGarminRunsBetween(start, end);
    card = <WeekCard week={{ start, runs }} format={format} />;
  } else {
    return new Response("Not found", { status: 404 });
  }

  const { width, height } = CARD_FORMATS[format];
  return new ImageResponse(card, {
    width,
    height,
    fonts: await cardFonts(),
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
