import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, isUnlocked } from "./lib/gate";

// First line of the password gate: every page except /unlock, the cron sync
// (which checks CRON_SECRET itself), the app icons, manifest, service worker
// and offline page, and static assets requires the unlock cookie. Pages and
// server actions check again.
export function proxy(request: NextRequest) {
  if (isUnlocked(request.cookies.get(GATE_COOKIE)?.value)) return NextResponse.next();
  const url = new URL("/unlock", request.url);
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!unlock|api/sync|_next/static|_next/image|icon.svg|apple-icon|pwa/|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
