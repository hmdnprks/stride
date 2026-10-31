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

- Your password is sent only to Garmin and never saved. The OAuth session tokens are saved in the database (locally, `.stride/kv.json`, which is git-ignored) and last about a year.
- **Sign out of Garmin** in the page footer deletes the tokens.
- Data is cached for 15 minutes. Signing in or out clears the cache.
- Finished days are stored, so charts don't re-download your history on every load. After you sign in, Stride saves a little over a year of daily readings and runs in the background. Each sync then adds the days since the last one and re-fetches the last week, in case your watch uploaded late. Pages read stored days from the database and fetch only the last few days from Garmin. Signing out deletes the stored history.
- Training load comes from Garmin when the watch reports it. Some watches don't (they give Training Effect only), so Stride estimates it from time in each heart-rate zone, weighted 1 to 5. Estimated figures are labelled as such on the charts, the run page and in the export.
- Garmin can change these endpoints at any time. Each section loads on its own, so if one breaks, only that card shows "no data", and the reason is listed in the page footer.
- Deployed, the whole site sits behind a password (see Deploying).

## Deploying

Stride is built for one person. Deployed, it needs these, which a laptop doesn't:

1. **A database** for your Garmin session, goals, stored history and sign-ins waiting for a verification code. Serverless hosts (Vercel, AWS Lambda) have a read-only disk. Stride uses Upstash Redis over its REST API (no extra package). Set either pair:
   - `KV_REST_API_URL` and `KV_REST_API_TOKEN` (added automatically by Vercel's Upstash/Redis integration), or
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
2. **A password** in front of the whole site: `STRIDE_PASSWORD`. Without it, a deployed Stride stays locked rather than exposing your health data. Use a long, random password; changing it signs every browser out.

3. **Your time zone**: `STRIDE_TIMEZONE`, as an IANA name such as `Asia/Jakarta`. Servers run in UTC, so without it "today", weeks, months and the "Synced at" time follow UTC instead of your local time.

4. **A cron secret** for the daily history sync: `CRON_SECRET`, any long random value. `vercel.json` has Vercel call `/api/sync` once a day at 20:00 UTC (03:00 in Jakarta), sending this secret. Without it the endpoint refuses every call. The sync also runs after a page load whenever the stored history is behind, so the cron is a backstop rather than a requirement. The free Hobby plan allows one cron run a day, which is enough.

Then redeploy, open the site, enter the password, and sign in to Garmin.

Locally, neither is required: with no database configured, data is kept in `.stride/kv.json` (git-ignored), and with no password set in development the site stays open.

## Year in review

`/review/2026` (also in the account menu, and under the training calendar) reads a year like a race result. The year's distance sits on the watch-face panel next to a track drawn as far as the year has gone. Below it: each month as a split, the longest and fastest runs, the biggest week, how many weeks had a run, the records set that year that still stand, and how VO2 max, resting heart rate, HRV and sleep score moved from the first month to the latest. Years before Stride's stored history begins aren't available; a year that starts partway through says from when it counts.

## Weather

Each run's start conditions (temperature, feels-like, dew point, humidity, wind) come from Garmin's record of the nearest weather station, so no location goes to a third-party service. They're fetched once per run during a sync and stored with the run; a page load fills in any that are missing. The run page shows them, the runs CSV includes them, and **Does heat slow you down?** on the Fitness tab plots easy-run efficiency (metres per heartbeat) against dew point over the last 16 weeks.

## Calories

Each day's calories (total, active and resting) come from Garmin's calorie report, and each run's from the activity list, so they cost almost no extra requests. On the Runs tab, **Burned off** shows this week's and this month's active calories as servings of a food you pick, drawn as that many pieces, and the running trends chart active calories per day or week, split into running and everything else. Only active calories count towards the food: resting calories are burned whether you run or not. The year in review counts the year in pizzas, and a week's story card counts its runs. Food values are rounded typical servings in `lib/energy.ts`.

## Races

The Goals tab keeps every race, not just the next one. Add as many as you like; the soonest gets the countdown and taper plan. After race day, Stride finds the run that was the race: one on that day you marked as a race in Garmin Connect, else the one closest to the race distance (you can pick a different run). For three weeks the race result takes the countdown's place: finish time against Garmin's prediction going in, pace, heart rate, and your weekly kilometres over the 8 weeks before. **Past races** lists them all, including runs marked as races in Garmin that you never added, with your best time at each distance marked. Race days get a ring on the training calendar and a Race tag on the run page.

**See all runs** under Recent runs opens every stored run, newest first and grouped by month, with races marked; filter to races or to runs near 5K, 10K, half or marathon distance. Every run page has a **Race** switch: turn it on for a race Garmin doesn't know about, or off for a run Garmin marked by mistake. A race can be given its own **Race name** there, shown in Past races, All runs ("Race: …") and on the race card; for a race added on the Goals tab it renames that race. Stride keeps your choice over Garmin's mark, so it works for old runs too (a sync only re-fetches the last week, so changing an old run in Garmin Connect wouldn't reach Stride). Races then show in **Races in {year}** in the year in review.

**Race card** on a race's page makes an image of the result: the finish time, pace, distance and heart rate, the route, your name, and your own photos of the medal and bib. Stride cuts the medal out of its background and pins the bib up like paper (drag and zoom to frame it); with no bib photo, a plain bib is printed with your number. It's all drawn in the browser, so the photos never leave your phone. The cut-out uses [`@imgly/background-removal`](https://github.com/imgly/background-removal-js) (AGPL-3.0): the first time downloads its model, about 40 MB, which the browser then keeps.

## Share cards

**Share run** on a run's page and **Share this week** under the weekly summary make an image in the watch-face style: the distance huge and condensed, then time, pace, heart rate and climb (or, for a week, a bar for each day). Pick **Story** (1080×1920) or **Square** (1080×1080), then **Share** opens the phone's share sheet, or **Download** saves the PNG. A run's story card can draw the route shape; that's off by default, since a route often starts at home.

Images come from `/api/card/run/{id}` and `/api/card/week/{date}`, rendered with `ImageResponse`. It can't use variable fonts, so fixed Archivo instances live in `public/fonts` (SIL Open Font License); the race card, drawn in the browser, loads the same files.

## Export

The account menu has **Export runs (CSV)** and **Export daily readings (CSV)**: everything stored, about 400 days once synced, newest first. Metric units are named in the headers, and each run links to Garmin Connect. Durations, paces and race predictions are written as `h:mm:ss`, so spreadsheets don't read 21:45 as a time of day. On the demo dashboard the same items export the demo data.

## Install on your phone

Stride installs as an app: open it in Safari (iPhone: Share → Add to Home Screen) or Chrome (Android: menu → Install app). It opens full-screen with its own icon, and the status bar follows the light or dark theme.

- **Offline:** the service worker (`public/sw.js`) caches one self-contained page, `public/offline.html`, and shows it when Stride opens without a connection. It reloads by itself when you're back online. Pages with your data are never cached on the device.
- **Losing connection mid-session:** the Sync button turns into an "Offline" label, and anything you tapped retries when the connection returns (Next.js's experimental `useOffline`).
- The service worker registers only in production builds, so `next dev` never serves stale pages.

## Design

Watch-face direction: the Today view is a scaled-up four-field data screen, like a sport watch's.

- **Type:** Archivo (variable weight and width) only. Numbers run condensed, headings run wide.
- **Weight encodes value:** Body battery and sleep score get heavier as they rise (`components/stat-number.tsx`).
- **Colour:** black, white, track blue `#1F47F5`, pale lane blue. Dark mode uses deep navy. Tokens live in `app/globals.css` under shadcn names.
- **Charts:** hand-built SVG in `components/charts/`, following the dataviz skill: one axis per chart, a hover and arrow-key tooltip, a table view under every chart, colours checked with its palette validator (sleep stages use a validated ordinal blue ramp).
- **Route:** each run's route is drawn on a real map: [MapLibre GL](https://maplibre.org) (loaded only on the run page) with [OpenFreeMap](https://openfreemap.org)'s free vector tiles from OpenStreetMap data, no API key. A light map in light mode and a dark one in dark mode; the route is a track-blue line, the start a filled dot and the finish a ring. Scrolling the page past it doesn't zoom it (Ctrl/⌘ and scroll, pinch, or the buttons do). Until it loads, or without WebGL, the route's shape is drawn on the blue panel instead. Showing the map means OpenFreeMap's servers see which map tiles are requested, so roughly where a run was (not the GPS track itself, which is drawn in the browser). MapLibre's worker is served by `app/maplibre-worker/route.ts`.
- **Mark:** a running track whose outer lane is drawn like a lap in progress, white on track blue (`lib/brand.ts`, copied into `app/icon.svg` and `public/offline.html`).
- **Components:** from [uselayouts](https://uselayouts.com), installed via the shadcn registry (`@uselayouts/...`, see `components.json`) and adapted in `components/uselayouts/`: discrete tabs (view switcher), save button (Sync and Sign in states), smooth dropdown (account menu), theme toggle. Numbers animate with NumberFlow.

## Structure

```
app/page.tsx               Live dashboard (redirects to /login when not connected)
app/login/page.tsx         Sign-in page
app/demo/page.tsx          Dashboard on demo data
app/runs/page.tsx          All stored runs by month, filterable (demo: app/demo/runs)
app/runs/[id]/page.tsx     One run in detail (demo: app/demo/runs/[id])
app/actions.ts             Sign-in, verification code, sync and sign-out server actions
components/dashboard/      Frame (header, tabs, range picker), views, trends, insights, goals
components/charts/         TrendChart, PaceHrChart, CalendarHeatmap, Sparkline, RangePicker
components/activity/       Run detail: route map, per-sample charts, splits
components/watch-face.tsx  The four-field data screen
components/stat-number.tsx Weight-encoded animated figures
components/uselayouts/     Adapted uselayouts components
components/login-form.tsx  Sign-in and verification code form
lib/garmin/auth.ts         Garmin SSO sign-in (incl. MFA), token storage
lib/garmin/live.ts         Garmin Connect fetcher (today)
lib/garmin/history.ts      Garmin Connect history for the trend charts
lib/garmin/store.ts        Stored daily history: sync, backfill, store + live reads
lib/export.ts              CSV for runs and daily readings
lib/review.ts              Year in review: monthly splits, highlights, body changes
lib/energy.ts              Active calories this week and month, and food servings
lib/races.ts               Races: goals matched to their runs, race marks, results, build-up, bests
lib/race-data.ts           All races for a source (settings + stored history), for the run page, review and export
lib/race-card-draw.ts      Race card on a canvas: medal cut-out, bib, route, result
lib/card.tsx               Share card layouts (run, week; story, square)
app/api/card/[kind]/[id]   Share card images
components/share/          Share panel (preview, size, route, share or download) and the race card
app/review/[year]          Year in review page (demo: app/demo/review/[year])
app/api/export/[kind]      CSV downloads (account menu)
app/api/sync/route.ts      Daily cron sync (CRON_SECRET)
app/manifest.ts            Web app manifest (icons from app/pwa/[file], app/apple-icon.tsx)
components/pwa.tsx         Service worker registration, theme colour
public/sw.js               Service worker: offline page only
lib/garmin/extras.ts       Personal records, shoes, the year calendar
lib/garmin/activity.ts     One activity: streams, GPS route, laps
lib/garmin/map.ts          Connect activity → Run mapping
lib/garmin/weather.ts      Per-run weather from Garmin (°F/mph → metric)
lib/trends.ts              Date ranges, weekly bucketing, training load
lib/insights.ts            Weekly summary, sleep vs performance, recovery check, goals, race plan
lib/settings.ts            Distance goals, races and race marks, in the key-value store
lib/garmin/demo.ts         Demo data
lib/garmin/index.ts        getGarminDashboard(): cached live data
lib/format.ts              Units, pace, durations, running totals
```

## Roadmap

See [ROADMAP.md](./ROADMAP.md).
