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

## M8: final QA

**Checked** (desktop browser at 393×852, through the page's DOM, served from a `/spotter/` subfolder)
- **Existing user path:** storage was seeded with the legacy fixture under the two original keys, then the app was loaded. The stored log was byte-identical after start-up. After the first save, every original field of every day was unchanged; only `sessionRpe`, `sleepHours` and `spotter` were added to the day that was opened. Readiness gave a verdict on the legacy data, labelled low confidence.
- **Import:** a non-JSON file and an empty file were refused with nothing changed; Cancel changed nothing; the old-format file imported after the confirm sheet; Undo restored the previous state exactly and cleared the undo copy.
- **Export:** file name `spotter-backup-<date>.json`, keys `workoutLogs, macroGoals, spotter, schemaVersion, app, exportedAt`, logs identical to memory, and the file validates on re-import. (The file contents were captured in the test; the actual download prompt was not exercised.)
- **Old features:** split change, ghost bar, Copy Weights, add/delete set, set type cycle, tick with rest timer, add/remove exercise, minutes/bodyweight/notes, summary strip, stopwatch, plate calculator (100 kg → 1 × 25 + 1 × 15 per side), 1RM tool (Epley 101.3; equal to the RPE-adjusted value at RPE 10), quick food, custom food, remove food, water, supplements, macro targets, weekly sets, PR list, calendar month change and Jump to Today.
- **Spotter features in demo mode:** the three verdicts, the low-confidence note and one-tap confirm, auto-filled reps flag set and cleared, a past date using only earlier sessions, Autopilot card, maintenance apply and exact undo, session RPE and sleep, chart, solver, canteen editor, exams, floor warning, low-intake note, every "Why?" sheet.
- **Layout:** no element wider than the screen in any of the five views; all new buttons, chips and inputs are at least 44 px tall.
- **Network:** every request was to the app's own origin. No console errors.
- **Offline:** with the server stopped, the app loaded from the service worker's saved copy, the Spotter tab rendered and a change was saved.

**Fix made during QA**
- The new sleep input sat in a row of 36 px inputs. The three inputs in that row (minutes, bodyweight, sleep) are now 44 px so the new one meets the tap-target rule and the row stays aligned. This slightly enlarges two existing inputs.

**Not done, and why**
- **Screenshots in `docs/screenshots/`:** not produced. Playwright is not installed, and the built-in browser pane was hidden during the run, so its screenshots were stale. Take them on the phone.
- **Opening from `file://`:** not run (the browser pane cannot open local files). By design it should work: all scripts are relative script tags and the service worker is skipped off http(s). Please double-click `index.html` once to confirm.
- **A real iPhone:** everything in `docs/MANUAL_TESTS.md`.

**Final numbers**
- `npm test`: 112 tests, 112 pass.
- `npm run validate`: all checks pass; 600/600 solver cases agree with brute force; 0 constraint violations.
- No `.github` folder, no git remote, no deployment configuration.

**AI-generated:** the QA run and this entry.

## Redesign: removing the "AI-generated" look (after M8)

Requested by Imroz: research which design elements make an interface look AI-generated, then change the UI accordingly.

**Research**
- Web search plus two articles read in full (a third returned "410 Gone"). Sources and the list of 14 commonly cited tells are in `docs/DESIGN.md`. They are design blogs and checklists, not studies.

**Audit**
- 12 of the 14 tells were present in Spotter, including in the original tracker's own styling: emoji as icons, Tailwind's default colour palette by hex value, gradient bars, blurred translucent bars, all-caps tracked labels, tinted pill badges, boxes inside cards, coloured card borders, a boxed stat row, an arrowed step diagram, weight 800–900 on almost all text, and exclamation-mark copy.

**Changed**
- `index.html`: the whole `<style>` block and the page markup were rewritten (same element ids and the same handlers; the patch refused to run unless every id and handler of the old markup was still present). New neutral near-black palette with one green accent, solid bars, flat progress bars, hairlines instead of nested boxes, text tabs with an underline, sentence-case labels, weights 400/600/700, tabular figures, a drawn checkbox, eleven original inline SVG line icons, plain button labels.
- Templates inside the tracker's script: emoji removed from the ghost bar, muscle headings and the rest-day card; food and PR rows use the new list style.
- `src/spotter-ui.js`: verdicts and results are a coloured dot plus words (no tinted pill, no "●" character); state cards use a dot before the title (no coloured border); "How it works" is three plain rows; the Spotter page title is ordinary text.
- `manifest.webmanifest`, the theme-colour tag, `tools/make-icons.js` and the regenerated icons use the new colours. `sw.js` is now `spotter-v2`.
- `docs/DESIGN.md` (new), label changes carried into `docs/MANUAL_TESTS.md` and `README.md`.
- `docs/screenshots/`: six screenshots in demo mode.

**Not changed**
- No logic, no data shape, no storage key, no poster wording. Tab names, split names and exercise names are untouched. The "Burned" label and formula are untouched (still Imroz's open decision A4).
- This overrides one line of the original brief ("new UI must reuse these theme colours"), at Imroz's request. The CSS variable names are the same; their values changed.

**Checks**
- `npm test`: 112 pass. `npm run validate`: all checks pass (it also confirms the code quotes in section 6 are still present).
- Contrast computed from the hex values: body text 16.2:1, muted text 6.9:1 on a card. Placeholders and the delete ✕ first measured about 3:1 and were raised.
- Reviewed from screenshots taken with the Chrome already installed on the build machine, in headless mode at 500 px wide (it would not go narrower). **Not checked at 393 px after the redesign and not checked on an iPhone.**

**For Imroz to verify**
- Look at every tab on the phone, especially the header row (date and two timers) and the set table, which are the tightest at 393 px.
- If the old look is preferred, `git revert` this one commit.

**AI-generated:** the research summary, the redesign and this entry.

## Demo and recording support (after the redesign)

Requested by Imroz for the Stage 2 video: how to run it, fake history for the recording, and a workflow to record.

**Built**
- Read the AI-Innovex 2026 handbook (video 30 s to 2 min covering intro, Round 1 solution, live demo and AI vs human; PPT 6 to 8 slides; LinkedIn post; Stage 2 deadline 17 Nov 2026).
- The seed history already existed as demo mode (42 days, separate storage, amber banner). No new data was needed. It was checked for today's date and produces: three verdicts on the first three lifts, an exam in 2 days, load ratio 1.39, sleep 5.8 h, and the poster case of 40 g short with ₹60 left, answered by ₹40 (2 x eggs + 1 x soya).
- New URL shortcut in `src/spotter-ui.js`: `?demo=1`, `?demo=reset`, `?demo=off`. It only calls the existing demo toggle, so demo data still goes only to the `spotter_demo_*` keys.
- `docs/DEMO_SCRIPT.md`: run options, the seed data, a pre-record checklist, a timed 1:47 script with narration, things to avoid, an AI-vs-human table, a LinkedIn draft and slide material. `docs/screenshots/load-chart.png` added.

**Checks** (headless Chrome)
- The whole recording flow was replayed: chips, Why? sheet, maintenance apply and exact undo, solver result, log combo (protein 120 to 170 of 160 g), load chart, brief. No errors.
- `index.html` opened from `file://` with no server: the page and the exercises rendered.
- With a fake real logbook stored, demo on, a planted edit, reset (edit gone) and off left the real data byte-identical.
- Not verified: that the `?demo=` text disappears from the address bar afterwards, and anything on a real iPhone.

**AI-generated:** the shortcut, the guide and this entry. The talking points are suggestions for Imroz to rewrite so that they are true.

## One-month demo data and presentation view (after the demo guide)

Requested by Imroz: feed one month of realistic data and remove the "sample data" text, so the demo can be recorded and presented.

**Changed**
- `src/spotter-demo.js`: history is now 35 days (5 whole weeks, about a month; whole weeks so the load baseline has no half week). Meals are structured (breakfast, mess lunch, snack, mess dinner, sometimes chicken or soya) instead of random staples; one deterministic missed Saturday with a reason; five short notes; Monday weigh-ins with small variation. Today's three verdict sets are now chosen inside each exercise's own target rep range (before, one was 30 kg x 5 against a target of 8 to 12).
- Presentation view: `generate(..., { clean: true })` produces the same data with no "(demo)" in exam names and `settings.presentation = true`. When it is true the UI hides the amber bar, the demo card, the "SAMPLE prices" note and the demo note in the backup section. `?demo=present` turns it on; `?demo=off` leaves it. Plain `?demo=reset` and the Spotter-tab switch still show the amber bar.
- The `?demo=` parameter is now removed from the address on its own, leaving other parameters in place (before, the whole query string was removed). That also confirms the earlier unverified point: the parameter does disappear.
- `tests/demo.test.js`: length 42 to 35 and the first-day check made date-relative; new tests for clean mode (same data, no demo/sample/fake/synthetic wording in logs, exams or canteen names), for realism of the history (meals 1550 to 2700 kcal, notes, one missed session, weigh-ins, 27 to 29 sessions) and for rep ranges. **Test correction:** my first guess for the session count (23 to 27) was wrong arithmetic; a six-day split over 34 days is about 29 minus the missed one, so the bound is now 27 to 29. The data was not changed.
- `docs/DEMO_SCRIPT.md`, `MANUAL_TESTS.md`, `README.md` and `docs/screenshots/` (retaken in presentation view; `autopilot.png` added).

**Checks** (headless Chrome)
- Presentation view: the visible text of all five tabs and the header contains no "demo", "sample", "synthetic", "fake" or "made-up".
- The full recording flow replays with no errors: Go for a PR / Normal day / Drop a set; Why? (e1RM 96.7, predicted 92.8, +4.2%); maintenance mode 3 to 2 sets and an exact undo; solver 2 x eggs + 1 x soya = ₹40, 50 g; log combo (protein 170 of 160); load chart; brief.
- `npm test`: 116 pass. `npm run validate`: all checks pass.

**Honesty note for Imroz.** This is the owner's own demo and the request was to remove the on-screen label. The label exists so synthetic data is never mistaken for real use, so the guide now tells you to say it is synthetic in the video and slides. The canteen prices are illustrative and unverified.

**AI-generated:** all of the above.

## Demo banner removed by default

Imroz still saw the amber "Demo data. Not your real logbook." bar. Cause: the browser held demo data saved earlier as labelled (from `?demo=reset`, `?demo=1` or the Spotter-tab switch), and a plain reload keeps it.

**Changed** (`src/spotter-ui.js`, `src/spotter-demo.js`)
- The bar now appears only for `?demo=labelled` (setting `labelled: true`). Every other way of starting demo mode (the Spotter-tab switch, `?demo=1`, `?demo=reset`, `?demo=present`) builds the clean version.
- Demo data saved by an older version (no `presentation` or `labelled` flag) is rebuilt clean on the next normal page load, as is any demo data from a previous day.
- `docs/DEMO_SCRIPT.md`, `docs/MANUAL_TESTS.md` and `README.md` updated.

**Checks** (headless Chrome, one persistent profile): `?demo=labelled` shows the bar and "(demo)" exam names; a hand-written older labelled state, opened with a plain address, came back clean with no bar and clean exam names and stayed that way on a second reload; `?demo=reset` clean; `?demo=off` back to real data. `npm test`: 116 pass.

**Still true:** the data is synthetic. With the label gone, say so on camera and on the slides (see DEMO_SCRIPT.md section 2).

**AI-generated:** all of the above.

## Demo day is Push 1, fully prefilled and unticked

Imroz wanted to record by only ticking boxes on the Push 1 tab, with no spoken narration. Tapping the Push 1 / Pull 1 tab in the demo had produced an empty template card (the tracker resets the day on a split tap).

**Changed**
- `src/spotter-demo.js`: the prepared sets moved into `todayExercises(logs, endDate, split, splits)`. The demo day is now always Push 1 (it was the weekday's split). Every set has kg, reps and PE, and **nothing is pre-ticked** (before, the first lift's first set was ticked).
- `src/spotter-ui.js` and one marked hook in `changeDaySplit` in `index.html`: in demo mode, on today's date, tapping a split tab fills that split's sets the same way instead of loading an empty template. Outside demo mode and on other dates nothing changed.
- `tests/demo.test.js`: the day is Push 1 with Flat Bench, Incline Dumbbell Press, Cable Chest Flyes first; all sets filled and unticked; every split can be prefilled; prefilling does not change the history. 118 tests pass.
- `sw.js` is now `spotter-v4`. `docs/DEMO_SCRIPT.md` and `docs/MANUAL_TESTS.md` updated; the "which weekday to record on" section was removed because it no longer applies.

**Checked** (headless Chrome, real clicks): tapping Pull 1 then Push 1 gives filled, unticked sets each time; apply and undo maintenance mode; ticking the first rows gives Go for a PR / Normal day / Drop a set; the Why? sheet; the low-confidence note and its confirm button; find and log the combo (protein 170 of 160); load chart; Spotter brief. No errors.

**Note:** the Pull-Ups e1RM oddity in LIMITATIONS.md is still true but no longer appears in the default demo day.

**AI-generated:** all of the above.

## Service worker: network-first (stale scripts fixed)

Imroz's browser still showed empty Push 1 sets after the prefill change was committed.

**Cause (reproduced).** `sw.js` served scripts cache-first. In a test with a fixed version number, a changed script was never picked up (the page kept running "OLD" on every reload). Bumping `VERSION` should have fixed it, but the new worker's install could also re-save old copies from the browser's HTTP cache.

**Change.** `sw.js` (now `spotter-v5`): every same-origin request goes to the network first with revalidation; installation bypasses the HTTP cache; the saved copy is only the offline fallback. This replaces the brief's "cache-first for static assets" on purpose (see DECISIONS E15).

**Checks** (headless Chrome, throwaway copy of the app on its own port): load 1 installs the worker, load 2 is controlled by it, the server file is changed, load 3 shows the new script after one normal reload, and with the server stopped the app still opens from the saved copy (7 exercise cards rendered). Under the old worker the same test stayed on the old script.

**For Imroz.** A browser that already holds the older worker needs one extra reload, or use an Incognito window, which has no saved copy.

**AI-generated:** the diagnosis, the change and this entry. The earlier advice to "reload twice" after a version bump was a workaround for this bug.

## Trailer video (tools/trailer)

Imroz asked for a trailer for the AI TechTrailblazer theme from the raw demo recording, with more animation and better music.

**What it is.** An ~84 s, 1080p MP4 (`Spotter Trailer.mp4`, not committed) built from the real recording plus drawn scenes: hook, title, problem, workflow, three acts (Push 1 progress, training load, groceries/macros), an honest "what it can't do" beat, proof numbers (118 tests, 600/600 solver cases, 1.15 vs 4.77 error), and an AI-vs-human split. The soundtrack is original and synthesized in code (no downloaded music), also saved as a WAV.

**Checks.** Duration, audio present and not clipped (peak 0.9), picture/audio impact aligned within about 20 ms on an earlier take, mean frame gap about 35 ms. One ~0.5 s frame hold per render remains (cause not found; varies by run). I could not listen to the music; only its level was measured.

**AI-generated:** the scenes, soundtrack code, render driver and this entry. **Human:** the claims shown on screen are Imroz's to confirm.
