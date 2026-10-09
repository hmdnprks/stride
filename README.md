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
app/actions.ts             Sign-in, verification code, sync and sign-out server actions
components/dashboard/      Frame (header, tabs, range picker), views and trend sections
components/charts/         TrendChart, PaceHrChart, Sparkline, RangePicker
components/watch-face.tsx  The four-field data screen
components/stat-number.tsx Weight-encoded animated figures
components/uselayouts/     Adapted uselayouts components
components/login-form.tsx  Sign-in and verification code form
lib/garmin/auth.ts         Garmin SSO sign-in (incl. MFA), token storage
lib/garmin/live.ts         Garmin Connect fetcher (today)
lib/garmin/history.ts      Garmin Connect history for the trend charts
lib/trends.ts              Date ranges, weekly bucketing, training load
lib/garmin/demo.ts         Demo data
lib/garmin/index.ts        getGarminDashboard(): cached live data
lib/format.ts              Units, pace, durations, running totals
```

## Roadmap

See [ROADMAP.md](./ROADMAP.md).
