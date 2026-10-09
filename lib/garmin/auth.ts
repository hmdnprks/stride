import "server-only";

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { GarminConnect } from "garmin-connect";
import { kvDel, kvGet, kvSet } from "../kv";

// Sign-in to Garmin's SSO, the same flow the Garmin Connect mobile app uses.
// We drive the SSO form ourselves (so we can handle the MFA code step), then
// hand the resulting ticket to `garmin-connect` to exchange for OAuth tokens.
// Only the tokens are saved (in the key-value store); the password never is.

const TOKENS_KEY = "garmin-tokens";
const MFA_TTL_SECONDS = 600;
/** Where earlier local versions kept tokens; read once so local sign-ins carry over. */
const LEGACY_TOKEN_DIR = path.join(process.cwd(), ".garmin-tokens");
// The library insists on credentials even though we only ever use tokens.
const NO_CREDENTIALS = { username: "", password: "" };
const SSO = "https://sso.garmin.com/sso";
const EMBED = `${SSO}/embed`;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const SIGNIN_PARAMS = new URLSearchParams({
  id: "gauth-widget",
  embedWidget: "true",
  gauthHost: EMBED,
  service: EMBED,
  source: EMBED,
  redirectAfterAccountLoginUrl: EMBED,
  redirectAfterAccountCreationUrl: EMBED,
}).toString();

/** Minimal cookie-keeping fetch for the SSO pages. */
class SsoSession {
  jar: Map<string, string>;

  constructor(cookies: [string, string][] = []) {
    this.jar = new Map(cookies);
  }

  async request(url: string, init: RequestInit = {}) {
    const res = await fetch(url, {
      redirect: "manual",
      ...init,
      headers: {
        "User-Agent": UA,
        Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "),
        ...init.headers,
      },
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return { status: res.status, html: await res.text() };
  }

  post(url: string, form: Record<string, string>) {
    return this.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://sso.garmin.com",
        Referer: `${SSO}/signin`,
      },
      body: new URLSearchParams(form).toString(),
    });
  }
}

const csrfOf = (html: string) => html.match(/name="_csrf"\s+value="(.+?)"/)?.[1];
const titleOf = (html: string) => html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
const ticketOf = (html: string) => html.match(/embed\?ticket=([^"]+)"/)?.[1];
const messageOf = (html: string) =>
  html.match(/id="status-message"[^>]*>([\s\S]*?)<\//)?.[1]?.replace(/\s+/g, " ").trim();

// A sign-in waiting for its verification code, keyed by an id kept in an
// httpOnly cookie. Stored in the key-value store (not memory) because on
// serverless hosting the code may arrive at a different server instance.
interface Pending {
  cookies: [string, string][];
  csrf: string;
}
const mfaKey = (id: string) => `mfa:${id}`;

type Tokens = ReturnType<GarminConnect["exportToken"]>;

export type SignInResult =
  | { ok: true }
  | { ok: false; mfaId: string }
  | { ok: false; error: string };

async function finish(ticket: string) {
  const gc = new GarminConnect(NO_CREDENTIALS);
  await gc.client.fetchOauthConsumer();
  const oauth1 = await gc.client.getOauth1Token(ticket);
  await gc.client.exchange(oauth1);
  await kvSet(TOKENS_KEY, gc.exportToken());
}

function explain(status: number, html: string) {
  const msg = messageOf(html);
  if (/locked/i.test(html)) return "Your Garmin account is locked. Unlock it on connect.garmin.com, then try again.";
  if (msg) return msg;
  if (status === 429) return "Garmin is rate-limiting sign-ins. Wait a few minutes and try again.";
  if (/update phone number/i.test(titleOf(html)))
    return "Garmin wants you to confirm your phone number. Sign in once on connect.garmin.com, then try again.";
  return `Garmin didn't accept the sign-in (status ${status}). Try again in a moment.`;
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const session = new SsoSession();
  await session.request(`${EMBED}?${new URLSearchParams({ id: "gauth-widget", embedWidget: "true", gauthHost: SSO })}`);
  const page = await session.request(`${SSO}/signin?${SIGNIN_PARAMS}`);
  const csrf = csrfOf(page.html);
  if (!csrf) return { ok: false, error: "Couldn't reach Garmin's sign-in page. Check your connection and try again." };

  const res = await session.post(`${SSO}/signin?${SIGNIN_PARAMS}`, {
    username: email,
    password,
    embed: "true",
    _csrf: csrf,
  });

  if (/MFA/i.test(titleOf(res.html))) {
    const mfaCsrf = csrfOf(res.html);
    if (!mfaCsrf) return { ok: false, error: "Garmin asked for a verification code but the page was unexpected." };
    const mfaId = randomUUID();
    await kvSet(mfaKey(mfaId), { cookies: [...session.jar], csrf: mfaCsrf } satisfies Pending, MFA_TTL_SECONDS);
    return { ok: false, mfaId };
  }

  const ticket = ticketOf(res.html);
  if (!ticket) return { ok: false, error: explain(res.status, res.html) };
  await finish(ticket);
  return { ok: true };
}

export async function verifyMfa(mfaId: string, code: string): Promise<SignInResult> {
  const p = await kvGet<Pending>(mfaKey(mfaId));
  if (!p) return { ok: false, error: "That verification step expired. Sign in again." };
  const session = new SsoSession(p.cookies);

  const res = await session.post(`${SSO}/verifyMFA/loginEnterMfaCode?${SIGNIN_PARAMS}`, {
    "mfa-code": code,
    embed: "true",
    _csrf: p.csrf,
    fromPage: "setupEnterMfaCode",
  });

  const ticket = ticketOf(res.html);
  if (!ticket) {
    // Garmin re-renders the code form on a wrong code; keep the challenge alive.
    const retryCsrf = csrfOf(res.html);
    await kvSet(mfaKey(mfaId), { cookies: [...session.jar], csrf: retryCsrf ?? p.csrf } satisfies Pending, MFA_TTL_SECONDS);
    return { ok: false, error: messageOf(res.html) ?? "That code didn't work. Check it and try again." };
  }

  await kvDel(mfaKey(mfaId));
  await finish(ticket);
  return { ok: true };
}

async function loadTokens(): Promise<Tokens | null> {
  const saved = await kvGet<Tokens>(TOKENS_KEY);
  if (saved) return saved;
  // Carry over a session from the old file-based storage (local runs only).
  try {
    return {
      oauth1: JSON.parse(fs.readFileSync(path.join(LEGACY_TOKEN_DIR, "oauth1_token.json"), "utf8")),
      oauth2: JSON.parse(fs.readFileSync(path.join(LEGACY_TOKEN_DIR, "oauth2_token.json"), "utf8")),
    };
  } catch {
    return null;
  }
}

export async function isConnected() {
  return (await loadTokens()) !== null;
}

export async function disconnect() {
  await kvDel(TOKENS_KEY);
  fs.rmSync(LEGACY_TOKEN_DIR, { recursive: true, force: true });
}

/**
 * garmin-connect never settles a request if refreshing an expired session
 * fails (a module-level "refreshing" flag stays set), so every call gets a
 * deadline. A dead session then fails fast and the page sends you to sign in.
 */
const GARMIN_TIMEOUT_MS = 15_000;

function withDeadline<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Garmin didn't respond in time. Your session may have expired; sign in again.")),
      GARMIN_TIMEOUT_MS,
    );
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

/** A client authenticated with the saved tokens. Refreshes OAuth2 as needed. */
export async function savedClient() {
  const tokens = await loadTokens();
  if (!tokens) throw new Error("Not connected to Garmin.");
  const gc = new GarminConnect(NO_CREDENTIALS);
  gc.loadToken(tokens.oauth1, tokens.oauth2);
  return {
    gc: {
      get: <T>(url: string, config?: Parameters<GarminConnect["get"]>[1]) => withDeadline(gc.get<T>(url, config)),
      getUserProfile: () => withDeadline(gc.getUserProfile()),
    },
    /** Persist tokens, which the library may have refreshed during requests. */
    save: () => kvSet(TOKENS_KEY, gc.exportToken()),
  };
}
