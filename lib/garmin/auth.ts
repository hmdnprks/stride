import "server-only";

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { GarminConnect } from "garmin-connect";

// Sign-in to Garmin's SSO, the same flow the Garmin Connect mobile app uses.
// We drive the SSO form ourselves (so we can handle the MFA code step), then
// hand the resulting ticket to `garmin-connect` to exchange for OAuth tokens.
// Only the tokens are saved; the password is never stored.

const TOKEN_DIR = path.join(process.cwd(), ".garmin-tokens");
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
  private jar = new Map<string, string>();

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

// Pending MFA challenges, keyed by an id kept in an httpOnly cookie.
// Kept on globalThis so dev-mode hot reloads don't drop them.
interface Pending {
  session: SsoSession;
  csrf: string;
  expires: number;
}
const pending: Map<string, Pending> = ((globalThis as { __garminMfa?: Map<string, Pending> }).__garminMfa ??=
  new Map());

export type SignInResult =
  | { ok: true }
  | { ok: false; mfaId: string }
  | { ok: false; error: string };

async function finish(ticket: string) {
  const gc = new GarminConnect(NO_CREDENTIALS);
  await gc.client.fetchOauthConsumer();
  const oauth1 = await gc.client.getOauth1Token(ticket);
  await gc.client.exchange(oauth1);
  gc.exportTokenToFile(TOKEN_DIR);
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
    pending.set(mfaId, { session, csrf: mfaCsrf, expires: Date.now() + 10 * 60_000 });
    return { ok: false, mfaId };
  }

  const ticket = ticketOf(res.html);
  if (!ticket) return { ok: false, error: explain(res.status, res.html) };
  await finish(ticket);
  return { ok: true };
}

export async function verifyMfa(mfaId: string, code: string): Promise<SignInResult> {
  const p = pending.get(mfaId);
  if (!p || p.expires < Date.now()) {
    pending.delete(mfaId);
    return { ok: false, error: "That verification step expired. Sign in again." };
  }

  const res = await p.session.post(`${SSO}/verifyMFA/loginEnterMfaCode?${SIGNIN_PARAMS}`, {
    "mfa-code": code,
    embed: "true",
    _csrf: p.csrf,
    fromPage: "setupEnterMfaCode",
  });

  const ticket = ticketOf(res.html);
  if (!ticket) {
    // Garmin re-renders the code form on a wrong code; keep the challenge alive.
    const retryCsrf = csrfOf(res.html);
    if (retryCsrf) p.csrf = retryCsrf;
    return { ok: false, error: messageOf(res.html) ?? "That code didn't work. Check it and try again." };
  }

  pending.delete(mfaId);
  await finish(ticket);
  return { ok: true };
}

export function isConnected() {
  return fs.existsSync(path.join(TOKEN_DIR, "oauth1_token.json")) && fs.existsSync(path.join(TOKEN_DIR, "oauth2_token.json"));
}

export function disconnect() {
  fs.rmSync(TOKEN_DIR, { recursive: true, force: true });
}

/** A client authenticated with the saved tokens. Refreshes OAuth2 as needed. */
export function savedClient() {
  const gc = new GarminConnect(NO_CREDENTIALS);
  gc.loadTokenByFile(TOKEN_DIR);
  return {
    gc,
    save: () => gc.exportTokenToFile(TOKEN_DIR),
  };
}
