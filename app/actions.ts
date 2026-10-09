"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { disconnect, signIn, verifyMfa, type SignInResult } from "@/lib/garmin/auth";
import { GARMIN_CACHE_TAG, type DataSource } from "@/lib/garmin";
import { saveSettings } from "@/lib/settings";

const MFA_COOKIE = "garmin_mfa";

export type SignInState = { step: "credentials" | "mfa"; error?: string; email?: string };

async function settle(result: SignInResult, email: string | undefined, stepOnError: SignInState["step"]): Promise<SignInState> {
  const jar = await cookies();
  if (result.ok) {
    jar.delete(MFA_COOKIE);
    updateTag(GARMIN_CACHE_TAG);
    redirect("/");
  }
  if ("mfaId" in result) {
    jar.set(MFA_COOKIE, result.mfaId, { httpOnly: true, sameSite: "strict", maxAge: 600, path: "/" });
    return { step: "mfa", email };
  }
  return { step: stepOnError, error: result.error, email };
}

/** Single entry point for the sign-in form; the submit button's `intent` picks the step. */
export async function authAction(prev: SignInState, form: FormData): Promise<SignInState> {
  switch (form.get("intent")) {
    case "verify":
      return verifyMfaStep(prev, form);
    case "back":
      (await cookies()).delete(MFA_COOKIE);
      return { step: "credentials", email: prev.email };
    default:
      return signInStep(form);
  }
}

async function signInStep(form: FormData): Promise<SignInState> {
  (await cookies()).delete(MFA_COOKIE);
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { step: "credentials", error: "Enter your Garmin email and password.", email };

  let result: SignInResult;
  try {
    result = await signIn(email, password);
  } catch (err) {
    result = { ok: false, error: `Sign-in failed: ${err instanceof Error ? err.message : "unknown error"}` };
  }
  return settle(result, email, "credentials");
}

async function verifyMfaStep(prev: SignInState, form: FormData): Promise<SignInState> {
  const jar = await cookies();
  const mfaId = jar.get(MFA_COOKIE)?.value;
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!mfaId) return { step: "credentials", error: "That verification step expired. Sign in again." };
  if (!/^\d{4,8}$/.test(code)) return { ...prev, step: "mfa", error: "Enter the numeric code from Garmin." };

  let result: SignInResult;
  try {
    result = await verifyMfa(mfaId, code);
  } catch (err) {
    result = { ok: false, error: `Verification failed: ${err instanceof Error ? err.message : "unknown error"}` };
  }
  const expired = !result.ok && "error" in result && /expired/i.test(result.error);
  if (expired) jar.delete(MFA_COOKIE);
  return settle(result, prev.email, expired ? "credentials" : "mfa");
}

export async function signOutAction() {
  disconnect();
  updateTag(GARMIN_CACHE_TAG);
  redirect("/login");
}

/** Drops the 15-minute cache so the next render pulls fresh data from Garmin. */
export async function syncAction() {
  updateTag(GARMIN_CACHE_TAG);
}

/* ---------- Goals and race (stored locally in .stride/settings.json) ---------- */

const sourceOf = (v: unknown): DataSource => (v === "garmin" ? "garmin" : "demo");

/** Save a monthly or yearly distance goal in km; empty or 0 clears it. */
export async function saveGoalAction(source: DataSource, period: "month" | "year", km: number | null) {
  const value = km !== null && Number.isFinite(km) && km > 0 ? Math.min(100_000, Math.round(km)) : null;
  saveSettings(sourceOf(source), period === "month" ? { monthKm: value } : { yearKm: value });
  refresh();
}

export type RaceFormState = { error?: string; saved?: boolean };

const DISTANCES: Record<string, number> = { "5k": 5, "10k": 10, half: 21.0975, marathon: 42.195 };

export async function saveRaceAction(_: RaceFormState, form: FormData): Promise<RaceFormState> {
  const source = sourceOf(form.get("source"));
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const date = String(form.get("date") ?? "");
  const preset = String(form.get("distance") ?? "");
  const custom = Number(form.get("customKm"));
  const distanceKm = DISTANCES[preset] ?? (preset === "custom" && custom > 0 && custom <= 400 ? custom : NaN);

  if (!name) return { error: "Give the race a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick the race date." };
  if (!Number.isFinite(distanceKm)) return { error: "Choose a distance, or enter one in km." };

  saveSettings(source, { race: { name, date, distanceKm } });
  refresh();
  return { saved: true };
}

export async function clearRaceAction(source: DataSource) {
  saveSettings(sourceOf(source), { race: null });
  refresh();
}
