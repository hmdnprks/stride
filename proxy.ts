import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, isUnlocked } from "./lib/gate";

// First line of the password gate: every page except /unlock and static
// assets requires the unlock cookie. Pages and server actions check again.
export function proxy(request: NextRequest) {
  if (isUnlocked(request.cookies.get(GATE_COOKIE)?.value)) return NextResponse.next();
  const url = new URL("/unlock", request.url);
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!unlock|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
