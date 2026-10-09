import { createHmac, timingSafeEqual } from "node:crypto";

// A single shared password in front of the whole site (STRIDE_PASSWORD).
// The cookie holds an HMAC derived from the password, never the password, so
// changing the password signs every browser out.
//
// Fails closed: in production with no password set, the site stays locked.
// Locally with no password set, it stays open for development.

export const GATE_COOKIE = "stride_gate";
export const GATE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const password = () => process.env.STRIDE_PASSWORD ?? "";

export type GateMode = "open" | "on" | "missing-password";

export function gateMode(): GateMode {
  if (password()) return "on";
  return process.env.NODE_ENV === "production" ? "missing-password" : "open";
}

const digest = (secret: string, message: string) => createHmac("sha256", secret).update(message).digest();

/** The cookie value that proves this browser unlocked the site. */
export function gateToken() {
  return digest(password(), "stride-gate-v1").toString("hex");
}

export function isUnlocked(cookieValue: string | undefined) {
  const mode = gateMode();
  if (mode === "open") return true;
  if (mode === "missing-password" || !cookieValue) return false;
  const expected = Buffer.from(gateToken(), "hex");
  const given = Buffer.from(cookieValue, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Constant-time password check (both sides hashed to equal length first). */
export function passwordMatches(input: string) {
  if (gateMode() !== "on") return false;
  const a = digest("stride-compare", input);
  const b = digest("stride-compare", password());
  return timingSafeEqual(a, b);
}

/** Only same-site paths are allowed as the post-unlock destination. */
export function safeNext(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
