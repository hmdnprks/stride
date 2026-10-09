# Stride — As-Built UI Art Direction Brief

*Read-only audit of commit `e6011ee` on `feat/garmin-dashboard`. No project files were changed during the audit; `git status` was clean before and after.*

**Evidence tags used below**

- **[Code]**: verified in source, with file and line.
- **[Rendered]**: seen in a headless-Chrome screenshot of the existing production build, on demo data.
- **[Measured]**: computed, e.g. contrast ratios or computed styles read from the live page.
- **[Interpretation]**: a design reading, not a fact.

**What was inspected, and what wasn't**

- **Rendered during the audit:** Today in light and dark mode, at 1440×900 and 390×844. Fitness, Runs and Goals in light mode at 1440×900.
- **Seen earlier, not re-captured during the audit:** the run detail page and the login page.
- **Not inspected:** rendering with real Garmin data, screen readers, and browsers other than Chrome.

**A note on terms.** "Hero Readiness, Recovery, Fitness, Running" describes an earlier design that was replaced. The app today has four tabs: **Today, Fitness, Runs, Goals** (`components/dashboard/frame.tsx:19-24`). Those terms are mapped onto the current tabs below.

---

## 1. Product identity and design philosophy

**Evidence**

- **One typeface and three palette roles [Code].** Archivo is the only font loaded (`app/layout.tsx:2,6-10`). The palette comment names black, white and "running-track blue" (`app/globals.css:5-15`).
- **A sport-watch panel [Code].** The Today view centres on a four-field "data screen from a sport watch, scaled up" (`components/watch-face.tsx` doc comment, `:22`).
- **Weight carries meaning [Code].** Score figures get heavier as the score rises (`components/stat-number.tsx:5-11,44`).
- **Charts are custom SVG [Code].** No chart library is imported. Charts live in `components/charts/*`.
- **Sentences lead the views [Rendered].** Each view opens with a sentence ("Ready for a quality session.") rather than a grid of cards.

**Interpretation**

- **Category:** a personal **sports-watch instrument panel** crossed with a **plain-language coach**. It doesn't read as a generic SaaS dashboard: there's no sidebar and no grid of identical shadowed cards. It isn't an editorial journal either: no serif, no long-form layout. It sits closer to a premium fitness product than to a lab-grade sports-science tool.
- **Intended feeling:** calm confidence. A big, legible answer first ("Ready for a quality session"), then evidence, then depth.
- **Density versus personality:** clarity and personality win over density. The Today page is about 3,200px tall on desktop [Measured], with large figures and generous whitespace.
- **Coherence:** the identity is coherent and project-specific. The uselayouts components were adapted to its tokens, not left on their defaults. The exception is the theme toggle (§5).

## 2. Typography

| Role | Implementation | Evidence |
|---|---|---|
| Family | Archivo, variable in weight and width (`axes: ["wdth"]`), the only font loaded. No serif, no monospace. | `app/layout.tsx:2,6-10`; `globals.css:112,127` |
| Big numbers | `.num`: width 62 (condensed), tabular figures, −0.01em tracking, line-height 0.82 | `globals.css:134-139`; computed `"wdth" 62` [Measured] |
| Headlines and section headings | `.wide`: width 125 (expanded), −0.02em tracking | `globals.css:152-155`; computed `"wdth" 125` on h1 [Measured] |
| H1 (Today headline, run name) | `wide text-2xl` (38px) → `sm:text-3xl` (52px), bold, leading 1.05 | `views.tsx:127`; `activity-view.tsx:100` |
| H2 (sections) | `wide text-lg` (21px), semibold | `views.tsx:16`; `insights.tsx:87,109`; `trends.tsx:55` |
| H3 (chart titles) | Normal width, `text-base`, semibold | `trend-chart.tsx:159`; `pace-hr-chart.tsx:61` |
| Labels | Sentence case, `text-sm`, muted colour. No uppercase, letter-spacing or mono anywhere in UI text. | grep found only one deliberate tracking use, on the verification-code input (`login-form.tsx:53`) |
| Chart axes | `text-[11px]`, muted colour, tabular figures | `trend-chart.tsx:207-220` (13 uses of `text-[11px]` overall) |
| Type scale | Custom steps: 13, 14, 16, 21, 28, 38, 52px | `globals.css:114-121` |
| Weights | Semibold (52 uses), medium (38), bold (14), extrabold (3, the wordmark). Score figures range from weight 150 to 900. | grep counts; `stat-number.tsx:5-11` |

**Assessment [Interpretation]:** distinctive. Using one family across its width range (condensed numbers against wide headlines) is the typographic identity, and it reads as watch-like rather than templated.

**Weaknesses**

- **Big numbers sit outside the type scale.** There are 15 one-off sizes, from `text-[2.25rem]` to `text-[12rem]` (grep).
- **Big numbers use tabular figures.** `.num` applies `tabular-nums` everywhere, including large standalone numbers like "72", where proportional figures usually look tighter.

## 3. Colour and visual tokens

**Core tokens [Code]** (`globals.css:16-80`, mapped to Tailwind at `82-110`)

| Token | Light | Dark | Role |
|---|---|---|---|
| background | `#FFFFFF` | `#040A1E` (navy) | page |
| foreground | `#000000` | `#F3F6FF` | text, active tab, rules above figures |
| primary | `#1F47F5` | `#7391FF` | buttons, links, emphasised text |
| panel | `#1F47F5` | `#1A3AD6` | watch face, race card, route map, login |
| panel-muted | `#B9C7FF` | `#AEBCFF` | labels on the panel |
| muted / secondary | `#EEF2FD` | `#0D1838` | quiet fills, pills, empty states |
| muted-foreground | `#57617D` | `#8C99BD` | secondary text |
| border / lane | `#DCE3F5` | `#1A2A55` | dividers, meter tracks |
| deep | `#0A1B5C` | `#C9D5FF` | button hover |

**Chart tokens [Code]** (`globals.css:33-46,67-78`)

- **Series:** `series` is the main data blue. `context` is the grey for comparison lines. `grid` is for gridlines.
- **Two ordinal blue ramps:**
  - **`stage-*` (4 steps), sleep stages:** awake is lightest, deep is darkest. Dark mode reverses this so the deepest stage is the brightest.
  - **`zone-1…5`, heart-rate zones:** zone 1 is lightest.
- **The calendar heatmap** reuses the sleep-stage ramp for distance bands (`calendar-heatmap.tsx:9-14`).
- **Validation:** the comments say these colours were checked with the dataviz validator. That can't be re-verified from the code alone; the checks were run separately during development.

**Semantic colour:** there's no warning or error palette. Status is shown with icons and inversion instead: black on white flips for the recovery alert (`insights.tsx:31`), and a warning triangle marks shoes due for replacement (`records.tsx`).

**Radii [Code]**

- **`rounded-full` (42 uses):** pills, buttons, tabs, meters.
- **`rounded-[2rem]` (7 uses):** blue panels and big cards.
- **`rounded-xl` and `rounded-2xl` (22 uses):** inputs, tooltips, tables, empty states.
- **`rounded-[1.5rem]` (2 uses):** the recovery card only.

**Shadows [Code]:** almost flat. One tooltip shadow (×4) and one dropdown shadow. The theme toggle is the exception, with five layered inset shadows (`theme-toggle.tsx`).

**Gradients [Code]:** only in the theme toggle.

**Hard-coded colours [Code]:** 12 hex values, all in `components/uselayouts/theme-toggle.tsx`. Everything else uses tokens.

**Spacing [Interpretation from code]:**

- **Page:** content is capped at `max-w-6xl` (1152px), with 16px side padding on phones and 32px from small screens up (`frame.tsx:124,156`).
- **Within a section:** gaps of 24–64px between blocks. Figure groups use 40px; most other blocks 48–64px.

**Contrast [Measured]**

| Pair | Ratio | Result |
|---|---|---|
| Body / muted text (both modes) | 5.5–6.9:1 | passes |
| White on the blue panel | 6.4:1 | passes |
| **panel-muted on panel, light mode** | **3.87:1** | **fails 4.5:1 for small text.** Affects watch-face labels and notes, which are `text-sm` (`watch-face.tsx:32,40,43`) |
| panel-muted on panel, dark mode | 4.37:1 | narrowly fails 4.5:1 |

## 4. Layout and information hierarchy

**Structure [Code, Rendered]**

- **Navigation:** a sticky top bar with backdrop blur. Left: the wordmark. Centre: four icon tabs, where only the active one shows its label. Right: Connect/Sync, the theme switch and the account menu (`frame.tsx:123-154`). There's no sidebar.
- **Below the bar:** a "Trends over" range picker (hidden on Goals), then the active tab's content.
- **On phones:** the tabs drop to their own row under the logo (`frame.tsx:128`). Grids collapse to one column. The watch face stays 2×2, and its sparklines are hidden (`watch-face.tsx`, `hidden sm:block`).

**Today, top to bottom [Rendered]**

1. Range picker
2. Date and an H1 readiness sentence ("Ready for a quality session.")
3. **Blue watch face** filling the content width: Body Battery, Sleep score, Resting HR, Overnight HRV
4. A caption explaining the weight encoding
5. Two columns: Body Battery through the day (range bar, Charged +68 / Drained −41) and Last night's sleep (stage bar)
6. Recovery check card. It moves above the watch face when alerting (`views.tsx:131,202`).
7. Your week: four figures and plain sentences
8. Recovery trend charts

**What draws the eye first, and why [Interpretation]**

1. **The blue watch face:** the only large saturated area on the page, with ~128px numbers.
2. **The H1 sentence:** expanded, bold, black.
3. **The black active tab pill.**

The readiness sentence above the panel gives the numbers meaning before you read them.

**The old section names, mapped**

- **"Hero readiness":** the H1 sentence plus the watch face.
- **"Recovery":** the Today tab.
- **"Fitness":** its own tab (VO2 max, fitness age, training status, race predictions, sleep vs performance, trends).
- **"Running":** the Runs tab (totals, recent runs, calendar, records, shoes, zones, pace vs HR, running dynamics).

**Understanding versus scanning [Interpretation]:** the design leans towards understanding:

- **Every chart has a summary sentence** (`trends.tsx`).
- **The recovery check and weekly summary** turn readings into judgements.

The cost is length: Today is about 3.5 viewports tall on desktop.

## 5. Component library and uselayouts

All five uselayouts components are local adaptations. Each file states what it changed (`components/uselayouts/*.tsx:3-5`). The `@uselayouts` registry is configured in `components.json:22`.

| Component | Used in | Kept from the original | Changed |
|---|---|---|---|
| `discrete-tabs` | main tabs (`frame.tsx:12`) | pill shape, icon plus expanding label, spring motion, blur-in label | controlled, tab semantics, sentence case (no mono uppercase), project tokens |
| `save-button` → `StatusButton` | Sync, Sign in, Verify, Save race (`frame.tsx:14`, `login-form.tsx:5`, `goals.tsx:10`) | per-letter morphing label, spinner/tick badge | controlled status, configurable labels, native button, `solid`/`quiet`/`ink` variants |
| `smooth-dropdown` | account menu (`frame.tsx:13`) | morph from circle to panel, hover bar and background | items from props, keyboard support, header row |
| `theme-toggle` | header, login, run detail | **skeuomorphic look: gradients, inset shadows, dotted grip, 12 hard-coded hex values** | drives `data-theme` and localStorage; track uses `primary` when on |
| `inline-edit` | goal values (`goals.tsx:9`) | pill with pencil that becomes a tick, spring | numeric, async save, Enter/Escape, labelled buttons |

**Distinctive custom pieces (not uselayouts) [Code]**

- **The watch face** (`watch-face.tsx`)
- **Weight-encoded numbers** (`stat-number.tsx`)
- **The Body Battery range bar** (`views.tsx:60`)
- **The route drawn on the blue panel** (`route-map.tsx`)
- **The charging demo on the login page** (`charge-demo.tsx:7-8`)
- **The race card with its phase strip** (`goals.tsx`)
- **All charts**

**Patterns that make it cohesive [Interpretation]:**

- **Figures:** a 2px black rule, a small label, then a big condensed number (`views.tsx:19-43`, repeated in insights, goals and run detail).
- **Shapes:** pill-shaped controls everywhere.
- **Panels:** one blue panel type.

**Patterns that feel repetitive [Interpretation]**

- **The figure pattern runs at nearly every level.** Fitness, Runs, Your week, Goals and run detail all open with a row of three or four "rule + label + big number" blocks. It's cohesive, but sections start to look alike.
- **Large wide-spaced list rows** recur for race predictions, recent runs, records and splits.

## 6. Data visualisation and interaction

**Chart types [Code]**

| Metric | Form | File |
|---|---|---|
| Body Battery | floating low–high bar per day or week; today's range bar on Today | `trends.tsx`; `views.tsx:60` |
| Sleep | stacked stage bars (ordinal ramp); score line | `trends.tsx` |
| Resting HR, VO2 max, running dynamics, race predictions | single blue lines with an end-value label | `trends.tsx` |
| HRV | line over a 10%-opacity shaded band for your normal range | `trend-chart.tsx:239` |
| Training load | two lines on one axis: last 7 days (blue) and 4-week average (grey) | `trends.tsx` |
| Distance | weekly bars with a 4-week-average line | `trends.tsx` |
| HR zones | stacked zone bars plus a zone key (bpm, meaning, share) | `trends.tsx:273` onward |
| Pace vs HR; sleep vs efficiency | scatter with trend line; pace axis inverted so faster is higher | `pace-hr-chart.tsx:37`; `sleep-run-chart.tsx` |
| Training calendar | 53×7 heatmap, 4 distance bands | `calendar-heatmap.tsx:9-14` |
| Run detail | 4 stacked charts on a shared cursor; route shape; splits with speed bars | `sample-charts.tsx:27-30`; `route-map.tsx`; `activity-view.tsx` |
| Sparklines | watch face (white) and VO2 max (blue) | `sparkline.tsx` |

**Mark conventions [Code]**

- **Lines:** 2px (`trend-chart.tsx:287`).
- **End markers:** r=4 with a 2px ring in the background colour (`:294`).
- **Bars:** at most 24px wide, about 62% of their slot (`:120`).
- **Gridlines and axes:** 1px solid (`:207`), with sparse x labels (`:122`).
- **Legend:** shown only for two or more series (`:161`).
- **Scales:** one axis per chart throughout.

**Interaction [Code]**

- **Hover:** a crosshair and multi-series tooltip on line charts; other bars dim to 40% (`:123`).
- **Keyboard:** charts are focusable, with arrow-key stepping (`:196`) and a visible focus ring (`:191`). Scatters snap to the nearest point within 24px.
- **Table views:** every chart has a "Show as table" (`:342`).
- **Range changes:** charts dim to 45% while new data loads (`:176`).

**States [Code]**

- **Loading:** pulse skeletons (`dashboard/index.tsx:76-80`; `activity-view.tsx:166-172`).
- **Empty:** "No data for this range." and similar messages.
- **Errors:** small "Couldn't load …" lines under sections.
- **Stale data:** shown only as "Synced from Garmin Connect at HH:MM" in the footer.

**Motion [Code]**

- **Page load:** big numbers "charge" from weight 150 to their final weight (`globals.css:141-150`).
- **Number changes:** NumberFlow rolls digits on update (`stat-number.tsx:46`).
- **Controls:** spring animation on tabs, dropdown, inline edit and buttons.
- **Tab change:** a short blur fade, only when you click a tab.
- **Reduced motion:** honoured globally (`globals.css:162`) and in the login demo (`charge-demo.tsx:14`).

**Light and dark [Rendered, Code]:** dark mode uses its own token values, not a flip. It's navy, the panel darkens to `#1A3AD6`, and the ordinal ramps invert.

**Assessment [Interpretation]:** a coherent single-hue analytics system. Its consistency (one blue, one grey, ordinal ramps) is its strength. Its limitation: almost everything is blue, so similar charts look alike at a glance.

## 7. Distinctiveness and quality

| Criterion | Assessment | Evidence | Works | Generic / underdeveloped |
|---|---|---|---|---|
| Brand distinctiveness | Strong | watch face, weight encoding, condensed/wide Archivo | instantly recognisable top of Today | identity fades lower down, where sections look alike |
| Typography hierarchy | Strong | §2 table | clear H1/H2/H3 roles; numbers carry the voice | ~15 one-off number sizes; tabular figures on big numbers |
| Visual consistency | Good | tokens everywhere except the toggle | shared figure pattern, pills, panel | theme toggle look; 3 large radii; 2 header layouts (dashboard vs run detail/login) |
| Information hierarchy | Good at top, flat below | Today order (§4) | answer first, then evidence | range picker sits above the headline it doesn't affect; long pages |
| Data visualisation | Strong | §6 | one axis, tables, keyboard, ordinal ramps | blue-on-blue sameness; no annotations of events (races, illness) |
| Component reuse | Good | `TrendChart` powers most charts; `Figure`; `StatusButton` | consistent behaviour | two scatter components duplicate logic (`pace-hr-chart`, `sleep-run-chart`) |
| Accessibility | Mixed | §3 contrast; focus rings; tables | keyboard charts, table views, reduced motion | panel label contrast fails in light mode; 11px axis text; blue text used both for pace values and as link colour |
| Responsive | Good | phone screenshot | no sideways scroll; calendar scrolls inside its box | the watch face loses its sparklines on phones; tabs take a whole row |
| Light/dark | Good | separate token sets | navy dark mode, inverted ramps | the toggle looks like a different product in both modes |
| Animation | Appropriate | §6 | one load moment; motion only on interaction | NumberFlow rolls and the weight charge overlap in purpose |

## 8. The brief

### A. Current visual identity

Stride looks like a sport watch's data screen blown up to page size. Pages are pure white, or deep navy in dark mode, and text is true black. One running-track blue (`#1F47F5`) fills the main "watch face" panel and marks primary actions. Everything is set in Archivo. Numbers are condensed like watch fields; headings are wide and confident. Score numbers literally get heavier the higher they are. Each view opens with a plain-English verdict, then large numbers, then quiet, single-hue charts with thin lines, hairline grids and a table under each. Controls are rounded pills with small spring animations. The page stays flat apart from one gradient switch.

### B. Design DNA

- **Visual style:** flat, high-contrast instrument panel; one saturated colour surface. *[Code: tokens and panel]*
- **Typography:** Archivo only, width 62 for numbers and 125 for headings, sentence-case labels. *[Code]*
- **Palette:** black, white, track blue, lane blue, slate; navy for dark mode. *[Code, `globals.css:5-80`]*
- **Layout:** single centred column (max 1152px) with a sticky top bar and four tabs. Order is verdict → numbers → evidence → trends. *[Code; "verdict first" is inferred from ordering]*
- **Components:** pills (`rounded-full`), big panels (`rounded-[2rem]`), 2px black rules above figures, near-zero shadows. *[Code]*
- **Charts:** custom SVG, one blue series plus a grey context line, ordinal blue ramps, one axis per chart, tooltips, tables. *[Code]*
- **Motion and interaction:** one load moment (weight charge), springs only in response to the user, reduced motion respected. *[Code; "philosophy" is inferred]*

### C. Rules the build already follows

1. **No new font families.** Personality comes from Archivo's width and weight axes.
2. **No uppercase, letter-spaced labels and no monospace.** Labels are sentence case.
3. **Colours come from tokens, with dark-mode values defined separately.** The theme toggle is the only exception.
4. **Blue fills mean "the main answer"**: watch face, race card, route, login.
5. **Big figures follow one pattern:** a 2px rule, then the label, then the number, then the unit.
6. **Every chart has a title, a one-sentence summary and a table view.** Legends appear only for two or more series.
7. **One y-axis per chart.** Different scales get separate charts.
8. **Motion happens once on load; after that, only in response to the user.**
9. **Errors and empty states are plain sentences** that say what to do.

### D. Inconsistencies

1. **The theme toggle:** skeuomorphic gradients, inset shadows and hard-coded colours in an otherwise flat, tokenised UI.
2. **Big-number sizes are one-offs:** 15 sizes off the type scale. Weights differ by context too: bold in Fitness/Runs figures, semibold in lists, score-weighted on the watch face.
3. **Blue text means three things:** link, pace value (`views.tsx:332`) and training status (`views.tsx:274`).
4. **Empty states look different:** some sit in muted rounded boxes, others are plain text (`calendar-heatmap.tsx` vs `records.tsx:7`).
5. **Headers differ across pages:** the dashboard has wordmark, tabs and actions; run detail has a back pill, a centred wordmark and the toggle; login has wordmark and toggle.
6. **Radii vary for the same kind of card:** `rounded-[1.5rem]` (recovery) vs `rounded-[2rem]` (race card) vs `rounded-2xl` (empty states, tables).
7. **The range picker sits above the Today headline,** though it only affects charts further down.

### E. What makes Stride recognisable (worth keeping)

- **The blue watch-face panel** and its grid split by thin lines.
- **Score-weighted numbers** and the "charge" on load.
- **The condensed/wide Archivo pairing.**
- **Verdict sentences above data.**
- **The route drawn on the blue panel** with no map tiles.
- **Navy dark mode** rather than grey-black.
- **Single-hue ordinal ramps** for sleep, zones and the calendar.

### F. Five biggest current weaknesses (by impact)

1. **Long, same-looking pages.** Below the watch face, sections repeat the same figure-row and list patterns, so the hierarchy flattens and Today runs to about 3.5 desktop screens.
2. **Contrast on the panel.** Small light-blue labels on the blue panel measure 3.87:1 in light mode, below WCAG AA for text that size.
3. **Blue-on-blue charts.** Nearly every chart is blue, so it's hard to tell at a glance which metric you're looking at. Identity comes only from titles.
4. **Unclear status language.** There's no defined good/caution/bad colour or icon set beyond the recovery inversion and one triangle, and blue text carries several meanings.
5. **Inconsistent chrome:** the toggle, header variants, ad-hoc number sizes and three panel radii.

### G. Design thesis

> "Stride is a **personal sports-watch instrument panel** for runners who want to **know at a glance whether they're ready and whether their training is working**, expressed through **one variable grotesk stretched between condensed numbers and wide headlines**, a **black, white and track-blue palette**, a **verdict-first single column anchored by a blue watch-face panel**, and **restrained single-hue charts that always explain themselves in a sentence**."

**Support:**

- **Typography:** `globals.css:134-155` and `layout.tsx:6-10`.
- **Palette:** `globals.css:5-80`.
- **Watch face:** `watch-face.tsx:22`.
- **Verdict first:** `views.tsx:125-131`.
- **Chart summaries and tables:** `trends.tsx` and `trend-chart.tsx:161,342`.

---

## Ready for design critique

**Three strongest aspects**

1. **Typography as identity:** Archivo's width and weight axes give Stride a voice no template has.
2. **The watch face plus weight encoding:** a memorable, subject-specific hero that also carries information.
3. **An honest, accessible chart system:** one axis per chart, a table for every chart, keyboard access, and validated ordinal blues.

**Three biggest opportunities to be more distinctive**

1. **Carry the watch-face language below the fold,** so later sections don't fall back on the same figure rows and lists.
2. **Give each metric family a recognisable look within the blue system,** so charts are identifiable before you read the title.
3. **Unify the chrome** (toggle, headers, radii, number sizes) so the system feels deliberate everywhere, not just at the top of Today.

**Decisions still to make**

- **Whether Stride gets a status palette** (good/caution/bad) or keeps status purely typographic and iconographic.
- **How long Today should be.** A one-screen briefing versus a full report changes what moves to other tabs.
- **A formal number scale:** which number sizes exist, and which weight rule applies outside the watch face.
- **Whether blue text is reserved for links only,** or can also highlight data like pace.
- **Header and navigation for non-dashboard pages** (run detail, login).
- **Whether the theme toggle should match the flat system** or stay the one tactile object on purpose.
