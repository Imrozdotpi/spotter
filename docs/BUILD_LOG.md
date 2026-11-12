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
