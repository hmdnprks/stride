import "server-only";

import fs from "node:fs";
import path from "node:path";

// Small key-value store for everything Stride must remember between requests:
// the Garmin session, goals, a sign-in waiting for its verification code, and
// the stored daily history.
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

export async function kvDel(...keys: string[]) {
  if (!keys.length) return;
  if (kvConfigured) {
    await redis(["DEL", ...keys.map((k) => PREFIX + k)]);
    return;
  }
  const store = readFile();
  for (const key of keys) delete store[PREFIX + key];
  writeFile(store);
}

/** Several values in one round trip; null for each missing key. */
export async function kvGetMany<T>(keys: string[]): Promise<(T | null)[]> {
  if (!keys.length) return [];
  if (kvConfigured) {
    const raw = await redis<(string | null)[]>(["MGET", ...keys.map((k) => PREFIX + k)]);
    return keys.map((_, i) => (raw?.[i] == null ? null : (JSON.parse(raw[i]!) as T)));
  }
  return Promise.all(keys.map((k) => kvGet<T>(k)));
}

/** Store several values (no expiry) in one round trip. */
export async function kvSetMany(entries: [key: string, value: unknown][]) {
  if (!entries.length) return;
  if (kvConfigured) {
    await redis(["MSET", ...entries.flatMap(([k, v]) => [PREFIX + k, JSON.stringify(v)])]);
    return;
  }
  const store = readFile();
  for (const [k, v] of entries) store[PREFIX + k] = { value: v, expires: null };
  writeFile(store);
}

/** Set `key` only if it's absent, for `ttlSeconds`. True when this call claimed it (a simple lock). */
export async function kvClaim(key: string, ttlSeconds: number): Promise<boolean> {
  if (kvConfigured) return (await redis<string>(["SET", PREFIX + key, "1", "NX", "EX", ttlSeconds])) === "OK";
  const store = readFile();
  const held = store[PREFIX + key];
  if (held && (held.expires === null || held.expires > Date.now())) return false;
  store[PREFIX + key] = { value: 1, expires: Date.now() + ttlSeconds * 1000 };
  writeFile(store);
  return true;
}
