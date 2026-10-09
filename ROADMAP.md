# Stride — Feature Roadmap

Planned work for the Garmin dashboard, roughly in priority order. Tick items off as they ship.

## ✅ Phase 1 — Today dashboard (shipped)

- [x] Hero readiness summary: Body Battery, Sleep Score, VO2 Max, Fitness Age
- [x] Recovery: Body Battery (current, high/low, charged/drained), sleep score + stages, resting HR, HRV
- [x] Fitness: VO2 max (30-day change), fitness age vs. real age, training status + acute load, race predictor
- [x] Running: this week, last 30 days, longest run, 10 most recent runs
- [x] Sign-in page for Garmin (two-step verification supported), sign out, demo mode
- [x] Light/dark mode, mobile layout

## ✅ Phase 2 — Trends & charts (shipped)

- [x] Date range switcher: 7D / 4W / 3M / 1Y (3M and 1Y group by week)
- [x] Weekly distance bars with a 4-week rolling average
- [x] VO2 max line over time
- [x] Sleep score over time, and sleep stages stacked per night
- [x] Body Battery daily low-to-high range
- [x] Resting heart rate and HRV trend lines (HRV with its balanced band)
- [x] Pace vs heart rate scatter with a trend line
- [x] Sparklines in the watch-face fields and the VO2 max figure
- [x] Training load: last 7 days vs 4-week average, with the ratio in plain words
- [x] Every chart: hover/keyboard tooltip and a "Show as table" view

Follow-ups:

- [ ] Verify the live history endpoints against a real account (sleep stats and HRV ranges are the least certain)
- [ ] Include non-running activities in training load (currently runs only)

## ✅ Phase 3 — Running deep-dives (shipped)

- [x] Activity detail page (`/runs/[id]`): route shape, splits with relative speed, pace / heart rate / elevation / cadence on a shared cursor
- [x] Personal records board (1K, mile, 5K, 10K, half, marathon) with dates and links to the run
- [x] Race predictor history, one chart per distance
- [x] Time in heart-rate zones per day or week (validated Z1–Z5 ramp)
- [x] Running dynamics: cadence, stride length, ground contact time, vertical ratio
- [x] Shoe mileage against each shoe's replacement distance, with a "replace soon" note
- [x] Training calendar heatmap for the last 52 weeks

Follow-ups:

- [ ] Verify against a real account: personal-record type IDs for half and marathon, race-predictor history, gear endpoints
- [ ] Optional basemap under the route (needs a tile provider; currently the shape is drawn without one to keep GPS tracks private)

## ✅ Phase 4 — Insights (shipped)

- [x] Weekly summary: last 7 days against the 7 before, as figures and plain sentences
- [x] Sleep and performance: easy-run efficiency (metres per heartbeat) against the previous night's sleep score, with a hedged verdict
- [x] Goal tracking: monthly and yearly distance goals, editable in place, with projections
- [x] Race countdown with a taper timeline and advice for each phase, plus Garmin's predicted time
- [x] Recovery check: HRV against your baseline, Body Battery, load ratio and resting heart rate; warns when two or more flag

Notes:

- Goals and the race are stored locally in `.stride/settings.json` (git-ignored), separately for demo and live data.
- Taper length: 7 days up to 10K, 10 days for a half, 21 days for a marathon.

## Phase 5 — Platform

- [ ] Local database (SQLite) to store daily snapshots, so history survives Garmin API changes and loads instantly
- [ ] Background sync (cron) instead of fetching on page load
- [ ] Manual refresh button that bypasses the 15-minute cache
- [ ] Unit toggle: km ↔ miles
- [ ] Export to CSV
- [ ] Optional Strava import for activities
- [ ] App password / access control so it can be deployed beyond localhost
- [ ] PWA / home-screen install

## Ideas backlog

- Weather overlay on runs (heat and humidity vs. pace)
- Year-in-review page
- Shareable image card for a run or a week
