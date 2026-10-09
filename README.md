# Stride — Garmin Dashboard

A personal dashboard for Garmin Connect data covering running, recovery and fitness. Built with Next.js 16 and Tailwind v4.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. You'll land on the sign-in page; use **Explore with demo data** to look around without an account.

## Connect your Garmin account

Sign in on the `/login` page with the email and password you use on Garmin Connect. If your account has two-step verification, the page asks for the code next.

Garmin doesn't offer a public API for personal accounts (the official Health API is for approved businesses), so the app signs in through Garmin's own SSO, the same flow the Garmin Connect mobile app uses, and reads the unofficial Connect endpoints.

- Your password is sent only to Garmin and never saved. The OAuth session tokens are saved to `.garmin-tokens/` (git-ignored) and last about a year.
- **Sign out of Garmin** in the page footer deletes the tokens.
- Data is cached for 15 minutes. Signing in or out clears the cache.
- Garmin can change these endpoints at any time. Each section loads on its own, so if one breaks, only that card shows "no data", and the reason is listed in the page footer.
- This is built for running on your own computer. The dashboard has no access control of its own, so don't deploy it publicly as is.

## Deploying

Stride is built for one person. Deployed, it needs three things a laptop doesn't:

1. **A database** for your Garmin session, goals and sign-ins waiting for a verification code. Serverless hosts (Vercel, AWS Lambda) have a read-only disk. Stride uses Upstash Redis over its REST API (no extra package). Set either pair:
   - `KV_REST_API_URL` and `KV_REST_API_TOKEN` (added automatically by Vercel's Upstash/Redis integration), or
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
2. **A password** in front of the whole site: `STRIDE_PASSWORD`. Without it, a deployed Stride stays locked rather than exposing your health data. Use a long, random password; changing it signs every browser out.

3. **Your time zone**: `STRIDE_TIMEZONE`, as an IANA name such as `Asia/Jakarta`. Servers run in UTC, so without it "today", weeks, months and the "Synced at" time follow UTC instead of your local time.

Then redeploy, open the site, enter the password, and sign in to Garmin.

Locally, neither is required: with no database configured, data is kept in `.stride/kv.json` (git-ignored), and with no password set in development the site stays open.

## Design

Watch-face direction: the Today view is a scaled-up four-field data screen, like a sport watch's.

- **Type:** Archivo (variable weight and width) only. Numbers run condensed, headings run wide.
- **Weight encodes value:** Body battery and sleep score get heavier as they rise (`components/stat-number.tsx`).
- **Colour:** black, white, track blue `#1F47F5`, pale lane blue. Dark mode uses deep navy. Tokens live in `app/globals.css` under shadcn names.
- **Charts:** hand-built SVG in `components/charts/`, following the dataviz skill: one axis per chart, a hover and arrow-key tooltip, a table view under every chart, colours checked with its palette validator (sleep stages use a validated ordinal blue ramp).
- **Components:** from [uselayouts](https://uselayouts.com), installed via the shadcn registry (`@uselayouts/...`, see `components.json`) and adapted in `components/uselayouts/`: discrete tabs (view switcher), save button (Sync and Sign in states), smooth dropdown (account menu), theme toggle. Numbers animate with NumberFlow.

## Structure

```
app/page.tsx               Live dashboard (redirects to /login when not connected)
app/login/page.tsx         Sign-in page
app/demo/page.tsx          Dashboard on demo data
app/runs/[id]/page.tsx     One run in detail (demo: app/demo/runs/[id])
app/actions.ts             Sign-in, verification code, sync and sign-out server actions
components/dashboard/      Frame (header, tabs, range picker), views, trends, insights, goals
components/charts/         TrendChart, PaceHrChart, CalendarHeatmap, Sparkline, RangePicker
components/activity/       Run detail: route shape, per-sample charts, splits
components/watch-face.tsx  The four-field data screen
components/stat-number.tsx Weight-encoded animated figures
components/uselayouts/     Adapted uselayouts components
components/login-form.tsx  Sign-in and verification code form
lib/garmin/auth.ts         Garmin SSO sign-in (incl. MFA), token storage
lib/garmin/live.ts         Garmin Connect fetcher (today)
lib/garmin/history.ts      Garmin Connect history for the trend charts
lib/garmin/extras.ts       Personal records, shoes, the year calendar
lib/garmin/activity.ts     One activity: streams, GPS route, laps
lib/garmin/map.ts          Connect activity → Run mapping
lib/trends.ts              Date ranges, weekly bucketing, training load
lib/insights.ts            Weekly summary, sleep vs performance, recovery check, goals, race plan
lib/settings.ts            Goals and race, stored in .stride/settings.json
lib/garmin/demo.ts         Demo data
lib/garmin/index.ts        getGarminDashboard(): cached live data
lib/format.ts              Units, pace, durations, running totals
```

## Roadmap

See [ROADMAP.md](./ROADMAP.md).
