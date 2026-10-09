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

## Phase 3 — Running deep-dives

- [ ] Activity detail page: route map, splits table, HR / pace / elevation / cadence charts
- [ ] Personal records board (1K, 5K, 10K, half, marathon) with dates
- [ ] Race predictor history, i.e. how your predicted 10K time has changed
- [ ] Heart-rate zone distribution per week (time in Z1–Z5)
- [ ] Running dynamics: cadence, stride length, ground contact time, vertical ratio
- [ ] Shoe/gear mileage tracker with replacement reminders
- [ ] Training calendar heatmap (GitHub-style, coloured by distance)

## Phase 4 — Insights

- [ ] Weekly summary card: what changed vs. last week, in plain sentences
- [ ] Sleep ↔ performance correlation (does a better sleep score mean faster easy pace?)
- [ ] Goal tracking: monthly/yearly distance goals with progress
- [ ] Race countdown with a taper reminder
- [ ] Recovery warnings (HRV below baseline + low Body Battery + high load)

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
