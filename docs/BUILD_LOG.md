# Build log

A factual record of each milestone, for disclosing AI versus human contribution.

**Who did what, overall**

- **Imroz (human):** the idea, the poster, the original tracker `mobile-gym.html` (baseline commit `0fc4318`), the build brief in `docs/PROMPT.md` (every formula, threshold and rule in it), the answers to the Phase 0 questions, and all open decisions in `docs/DECISIONS.md`.
- **AI (Claude, working from the brief):** everything committed after the baseline: the code in `src/`, the hooks added to `index.html`, the tests, the fixtures, the validation script, the icons and these documents. Each entry below lists the files.

Nothing was deployed, pushed or published by the AI. There is no git remote.

---

## Phase 0: read, plan, baseline

- Read all 1,667 lines of `mobile-gym.html`.
- Saved the brief verbatim as `docs/PROMPT.md`.
- `git init`; committed `mobile-gym.html` untouched (`0fc4318`).
- Wrote `docs/PLAN.md` with findings, conflicts and five questions.
- **Answers received:** the tracker is opened in Safari; Spotter will be hosted on GitHub. Questions 2–5: go with the recommendations (one-tap RPE confirm: yes; auto-filled reps: flag as low confidence; phone-width QA with the built-in browser, no Playwright install; own branch-and-bound solver).
- Whether the old address and the new address are the same is still unknown, so the docs assume they differ and tell Imroz to move data with a backup file.

## M1: core logic, config, unit tests

**Built**
- `src/spotter-config.js`: every threshold and default, one comment each.
- `src/spotter-core.js`: pure functions for all three Acts, safety, explanations, migration, backup validation and storage. No DOM, no clock.
- `tests/bruteforce.js`: an independent brute-force solver (shares no code with the core).
- `tests/helpers.js`, fixtures (`rts-chart.json`, `load-5-weeks.json`, `sample-prices.json`, `legacy-backup.json`) and `tools/make-legacy-fixture.js`.
- `package.json` (scripts only), `.gitattributes` (LF line endings), `.gitignore` (personal backup files).

**Tests added (100, all passing)**
- `tests/e1rm.test.js` (11), `tests/readiness.test.js` (22), `tests/load.test.js` (24), `tests/solver.test.js` (15), `tests/safety.test.js` (13), `tests/migration.test.js` (15).
- The solver agrees with the brute force on 250 seeded random canteens inside the unit tests (cost, both tie-breaks, and the fallback).

**Decisions made here (all listed in DECISIONS.md for Imroz to confirm)**
1. **A "set aside one wild session" step was added to the regression. This is not in the brief.** Reason: the brief asks for a test proving that one wildly off session moves the prediction only modestly. With plain least squares that is false when the odd session is the most recent one: a −20% day last week moved the prediction by more than 5% and could turn a normal day into a false "Go for a PR". The test `why the set-aside step exists` shows this. The fix: before fitting, each past session is compared with the line through the *other* sessions; if one is more than 4 typical swings off, that one session (at most one) is left out, and the "Why?" panel says so. It needs at least 5 sessions, so with exactly 4 nothing is set aside. It can be switched off by setting `READINESS_OUTLIER_T` to `Infinity`.
2. Band edges: 0.8 and 1.3 belong to "normal"; 1.5 belongs to "climbing".
3. If nothing is logged this week, there is no ratio (rather than a ratio of 0).
4. Low-intake flag: today is never counted (the day may not be finished); logged days more than 3 days apart are not "in a row".
5. Sleep average never reaches back more than 7 days.
6. The calorie-floor setting cannot be set below 1200 or above 4000.
7. Items priced ₹0 are treated as "no price".
8. Solver arithmetic uses whole paise and thousandths, so cost ties are exact.

**One fix during the milestone**
- The maintenance undo record first stored `rpeConfirmed: undefined`, which disappears when saved as JSON. The test `applying twice…` caught it. The code was fixed (the record is now plain JSON). The test was not changed.

**For Imroz to verify**
- Read `src/spotter-config.js` top to bottom: these are the numbers you will be asked about.
- Decision 1 above.

**AI-generated:** all files in this milestone.

## M2: data model, migrate(), backup/import, rpeConfirmed

**Built**
- `mobile-gym.html` renamed to `index.html` in its own commit (`2a46595`, no content change).
- 32 marked edits to `index.html` (search for `SPOTTER HOOK`):
  - Storage now goes through `SpotterStore` (from the core). In normal use it reads and writes the two original keys with the same content as before.
  - `ensureDay` lazily adds `sessionRpe`, `sleepHours` and `spotter` to a day.
  - New sets get `rpeConfirmed: false` in `createDayObject`, `addSet`, `copyGhostSets` and `confirmAddExercise`. `editSet` sets `rpeConfirmed: true` when the PE box is edited.
  - `toggleDone` marks `repsAutoFilled: true` when it fills reps from the target range; editing reps clears it.
  - `changeDaySplit` carries `sessionRpe` and `sleepHours` across and clears maintenance undo data.
  - `exportBackup` / `importBackup` now call the new versions in `src/spotter-ui.js`.
  - Markup containers, a 5th nav button, the reusable bottom sheet and the Spotter CSS block (used from M3 on).
- `src/spotter-ui.js` (first part): state loading through `migrate()`, the bottom sheet, export (Blob download, same `workoutLogs` / `macroGoals` names plus `spotter` and `schemaVersion`), import with validation, a confirm step, a one-step undo copy (`spotter_preimport_snapshot`), "Last backup: N days ago", the 7-day reminder, the storage-failure warning and `navigator.storage.persist()`.

**Tests**
- No new test files; the migration, backup and storage tests were written in M1 (`tests/migration.test.js`). All 100 pass.
- Checked in the browser at 393×852: the app loads with no console errors, the day object has the three new fields, and the four `spotter_*` keys are created.

**Decisions made here**
- Import is blocked while demo mode is on, and a demo export is refused as a real import.
- If there is no room to store the undo copy, the import is cancelled rather than done without a safety net.
- A file with zero days is refused (it would erase the logbook).
- Export file name is now `spotter-backup-YYYY-MM-DD.json`.

**For Imroz to verify**
- On the phone: the Download Backup button actually saves a file from Safari and from the Home Screen app (the method changed from a `data:` link to a Blob download).
- That an old backup from the current tracker restores correctly (MANUAL_TESTS.md).

**AI-generated:** all changes in this milestone. The untouched parts of `index.html` are Imroz's original code.

## M3: UI for the three Acts, Spotter tab, Tools and Stats

**Built** (all in `src/spotter-ui.js`, drawn into containers added to `index.html` in M2)
- **ACT I:** a readiness chip on each exercise card under the ghost bar, in the poster's words and colours ("Go for a PR" green, "Normal day" amber, "Drop a set" red), with the number of sessions used. Grey chips for "Building your trend: X of 4 sessions logged" and "No readable set yet". The chip updates in place when a ticked set is edited, without closing the keyboard.
- **One-tap RPE confirm** (agreed in Phase 0): under a low-confidence note, "Yes, it felt like RPE 8.5" sets `rpeConfirmed` without retyping.
- **ACT II:** session RPE chips (1–10, two rows of five so each is at least 44 px), a sleep input next to minutes and bodyweight, and the Autopilot card at the top of the workout view (exam countdown, load vs 4-week average, ratio and band, sleep, suggestion, Apply/Undo). The card only appears when there is something to say.
- **Weekly-load chart** in Stats: 6 bars in plain SVG, this week outlined, exam weeks amber, weeks with no logged load drawn as a dashed outline.
- **ACT III:** the "Protein on a Hostel Budget" card in the Calories view (gap, budget, calories left, "Find cheapest combo", result list with totals, "Log this combo").
- **Spotter tab:** today's brief, the "How it works" pipeline with the poster wording, settings (exam dates, calorie floor, default budget, canteen catalog with inline prices and an editor, backup/restore), and the About line.
- **Tools:** the 1RM calculator takes an RPE and shows plain Epley and the RPE-adjusted e1RM.

**Tests**
- No new unit tests (the UI has no logic of its own; everything it shows comes from the tested core).
- Checked in the browser at 393×852 through the page's DOM: all five tabs render, no console errors, nothing overflows the screen width, the three verdict chips appear, the solver card returns the expected combo, apply → undo of maintenance mode leaves the day byte-identical.
- Injection check: an exam label and a canteen item named `<img src=x onerror=...>` were shown as text and did not run.

**Decisions made here**
- "Log this combo" adds one food entry per item (for example "2 × 2 Boiled Eggs"), not one per serving.
- The protein-gap box shows goal − logged until you type in it; clearing it returns to the automatic value.
- A solver answer disappears as soon as any input it used changes, so a stale answer is never shown.
- Deleting a canteen item needs two taps.

## M4: "Why?" explanations and safety messages

**Built**
- A "Why?" bottom sheet for every Spotter output: each readiness chip (inputs, e1RM, prediction, % difference, typical swing, z, sessions used, formula, and the list of sessions in the trend), the Autopilot card and the chart (numbers, formula, band limits, and the set plan maintenance mode would apply), the solver (inputs, model, tie-break rule, ignored items) and the low-intake note.
- Calorie-floor warning inside the macro targets sheet when the goal is under the floor.
- The low-intake note on the Calories view, in calm wording, with its own "Why?".
- "A warning flag, not an injury predictor" and "Wellness guidance, not medical advice" on the Autopilot card.
- All explanation text comes from fixed templates in `src/spotter-core.js` (section 6). No language model is involved.

**Tests**
- Explanation content is covered by unit tests written in M1 (required rows, formulas, exact poster sentences).

**One wording fix:** the "N of N past sessions have an RPE you typed yourself" note no longer adds "The rest…" when there is no rest.

**For Imroz to verify**
- Read each "Why?" panel on the phone. These are the sentences the jury will see.
- The nav icon for the Spotter tab is an emoji (🤝). Change it if you prefer another.

**AI-generated:** all of M3 and M4.

## M5: demo mode

**Built**
- `src/spotter-demo.js`: a seeded, deterministic generator of 6 weeks of made-up data (PPL sessions with progression and noise, session RPE, sleep, foods, one past and one current exam week, SAMPLE canteen prices). Same date and seed always give the same data.
- Demo toggle in the Spotter tab. Demo data is written only to `spotter_demo_*` keys. An amber "DEMO DATA" banner sits in the header on every screen. If demo mode is left on overnight, the data is rebuilt for the new day.
- Opened on any weekday, the demo shows: exam in 2 days, load ratio about 1.4 ("Load is climbing fast"), short sleep, the three readiness verdicts on the first three lifts, and the poster case (40 g protein short, ₹60).

**Tests added (12, total 112 passing)** in `tests/demo.test.js`: determinism, 42 days, SAMPLE prices equal the fixture, all three Acts for each day of the week, real keys byte-identical after demo on → edits → off, demo export refused on import.
- Checked in the browser with the real toggle button: on → edits → off left every non-demo key unchanged.

**For Imroz to verify**
- The SAMPLE prices are placeholders. Replace them only in your real canteen list, not here.

**AI-generated:** all of M5.

## M6: offline, installable, rebrand

**Built**
- `manifest.webmanifest`: name "Spotter", standalone display, background `#090d16` (`--bg-main`), theme `#131b2e` (`--bg-card`), icons.
- `sw.js`: versioned cache (`spotter-v1`), network-first for the page, cache-first for scripts, icons and the manifest, same-origin requests only. Old caches are deleted when the version changes.
- `tools/make-icons.js` and its output in `icons/`: an original mark (emerald barbell with a small chevron under it, on navy) as SVG and as PNG at 192, 512 and 180 px. Drawn by code with Node built-ins; no image library, no brand logos.
- `index.html`: title "Spotter", iOS and manifest tags, apple-touch-icon, and a small "SPOTTER · Your logbook is the wearable." line in the header.
- `src/spotter-ui.js`: registers the service worker on http(s) only. From `file://` the app runs without it.
- Every path is relative (`./…`).

**Tests**
- 112 unit tests still pass.
- Checked in the browser, served from a `/spotter/` subfolder to mimic a GitHub Pages project site: the page loads, the service worker scope is the subfolder, all 11 files are in the cache, no console errors, and every network request went to the same origin.

**Decisions made here**
- Cache-first means a phone keeps using saved scripts until `VERSION` in `sw.js` changes. The README tells Imroz to raise it on every deploy.

**For Imroz to verify**
- On the iPhone: Add to Home Screen shows the Spotter icon and name; the app opens with aeroplane mode on after one online visit.

**AI-generated:** all of M6, including the icon artwork (generated by the script).

## M7: validation report and documents

**Built**
- `tests/validate.js` → `docs/VALIDATION.md` (generated; fixed seeds). Sections: e1RM against the RTS chart (per-cell error, mean error by rep range and RPE range, comparison with plain Epley), readiness scenarios, the hand-computed load fixture, exam and maintenance checks, solver against brute force on 600 seeded cases plus the poster case with SAMPLE prices, safety checks, and issues found in the tracker with the code evidence checked at generation time.
- `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/LIMITATIONS.md`, `docs/MANUAL_TESTS.md`, `README.md`.

**Results of `npm run validate` on the build machine**
- All checks pass.
- e1RM vs chart: mean absolute error 1.15 points with RPE, 4.77 with plain Epley. Best at 4–6 reps (0.39), worst cell 10 reps at RPE 6.5 (+5.0).
- Solver vs brute force: 600 of 600 agree on feasibility; 368 of 368 on cost and on both tie-breaks; 232 of 232 on the fallback; 0 constraint violations; no search reached the safety limit.

**Honesty notes**
- The RTS chart numbers are the ones Imroz supplied; they were not checked against the original source.
- Full references for Foster (2001), Stigler (1945), and the load-ratio papers named in LIMITATIONS.md were written from memory and are marked "not verified". Imroz should check them before citing.
- The validation report says what it does not cover (a real phone, Playwright).

**For Imroz to verify**
- Every "Imroz's decision:" line in DECISIONS.md, starting with section A.
- The worked examples in ARCHITECTURE.md: redo one by hand before the jury does.

**AI-generated:** all of M7. The decisions themselves remain Imroz's to make.
