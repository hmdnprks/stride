import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_COOKIE, isUnlocked } from "./gate";

// The proxy is the first check; these repeat it where data is read or changed,
// as Next.js recommends (server actions can be called without passing the proxy).

/** For pages: send locked visitors to the unlock screen. */
export async function requireUnlocked() {
  if (!isUnlocked((await cookies()).get(GATE_COOKIE)?.value)) redirect("/unlock");
}

/** For server actions: refuse to run when the browser hasn't unlocked the site. */
export async function assertUnlocked() {
  if (!isUnlocked((await cookies()).get(GATE_COOKIE)?.value)) throw new Error("Stride is locked.");
}
