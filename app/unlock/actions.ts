"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_COOKIE, GATE_MAX_AGE, gateToken, passwordMatches, safeNext } from "@/lib/gate";

export type UnlockState = { error?: string };

export async function unlockAction(_: UnlockState, form: FormData): Promise<UnlockState> {
  const password = String(form.get("password") ?? "");
  if (!passwordMatches(password)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 500));
    return { error: "That password isn't right." };
  }
  (await cookies()).set(GATE_COOKIE, gateToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_MAX_AGE,
  });
  redirect(safeNext(form.get("next")));
}
