import "server-only";

import fs from "node:fs";
import path from "node:path";

// Small key-value store for everything Stride must remember between requests:
// the Garmin session, goals, and a sign-in waiting for its verification code.
//
// - Deployed: Upstash Redis over its REST API (what Vercel's Redis/KV
//   integration provides). Plain fetch, no client library.
// - Local development: a JSON file in .stride/, so it works with no setup.

/**
 * Find the REST URL and token. Vercel's storage integration lets you choose a
 * prefix (e.g. STRIDE_STORAGE_KV_REST_API_URL), so accept any
 * <prefix>KV_REST_API_URL with its matching <prefix>KV_REST_API_TOKEN, plus
 * Upstash's own UPSTASH_REDIS_REST_URL / _TOKEN names.
 */
function restCredentials(): { url?: string; token?: string } {
  for (const [name, url] of Object.entries(process.env)) {
    if (!url || !name.endsWith("KV_REST_API_URL")) continue;
    const token = process.env[name.replace(/KV_REST_API_URL$/, "KV_REST_API_TOKEN")];
    if (token) return { url, token };
  }
  return { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };
}

const { url: URL, token: TOKEN } = restCredentials();
const FILE = path.join(process.cwd(), ".stride", "kv.json");
const PREFIX = "stride:";

export const kvConfigured = Boolean(URL && TOKEN);

async function redis<T>(args: (string | number)[]): Promise<T | null> {
  const res = await fetch(URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { result?: T; error?: string } | null;
  if (!res.ok || body?.error) throw new Error(`Database error: ${body?.error ?? res.status}`);
  return body?.result ?? null;
}

/* Local file fallback (development only). */

type FileStore = Record<string, { value: unknown; expires: number | null }>;

function readFile(): FileStore {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeFile(store: FileStore) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
  } catch (err) {
    // A read-only disk means we're deployed without a database configured.
    throw new Error(
      "No database configured. Connect Upstash Redis (it sets <prefix>KV_REST_API_URL and <prefix>KV_REST_API_TOKEN) or set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN on the server." +
        (err instanceof Error ? ` (${err.message})` : ""),
    );
  }
}

/* Public API */

export async function kvGet<T>(key: string): Promise<T | null> {
  if (kvConfigured) {
    const raw = await redis<string>(["GET", PREFIX + key]);
    return raw === null ? null : (JSON.parse(raw) as T);
  }
  const entry = readFile()[PREFIX + key];
  if (!entry || (entry.expires !== null && entry.expires < Date.now())) return null;
  return entry.value as T;
}

/** Store a JSON-serialisable value, optionally expiring after `ttlSeconds`. */
export async function kvSet(key: string, value: unknown, ttlSeconds?: number) {
  if (kvConfigured) {
    const args: (string | number)[] = ["SET", PREFIX + key, JSON.stringify(value)];
    if (ttlSeconds) args.push("EX", ttlSeconds);
    await redis(args);
    return;
  }
  const store = readFile();
  store[PREFIX + key] = { value, expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null };
  writeFile(store);
}

export async function kvDel(key: string) {
  if (kvConfigured) {
    await redis(["DEL", PREFIX + key]);
    return;
  }
  const store = readFile();
  delete store[PREFIX + key];
  writeFile(store);
}
