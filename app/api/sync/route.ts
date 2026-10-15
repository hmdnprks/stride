import { timingSafeEqual } from "node:crypto";
import { isConnected, syncHistory } from "@/lib/garmin";

// Daily history sync, called by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set, it's refused.
// The proxy lets this path past the password gate, so the secret is its lock.

/** A first sync backfills a year of history, which can take a minute or two. */
export const maxDuration = 300;

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isConnected())) return Response.json({ status: "not-connected" });
  try {
    return Response.json(await syncHistory());
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
