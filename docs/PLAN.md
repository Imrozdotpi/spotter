# Spotter build plan (Phase 0)

Written after reading all 1,667 lines of `mobile-gym.html` and the full brief (`docs/PROMPT.md`).
Nothing in the app has been changed yet. Baseline commit: `0fc4318`.

## 1. What I verified in the existing code

Everything in section 3 of the brief is correct. Line references are to `mobile-gym.html`.

| Brief says | Code | Status |
|---|---|---|
| `SafeStore` wraps localStorage | lines 900–916 | Correct. Note: on a write failure (e.g. storage full) it silently falls back to memory, so data would be lost on reload with no warning. |
| `KEY_LOGS`, `KEY_GOALS` | lines 1013–1014: `"lakshay_ppl_tracker_v1"`, `"lakshay_macro_goals_v1"` | Correct. These exact strings stay. |
| Day object shape | `createDayObject` 1044–1064, `ensureDay` 1066–1076 | Correct. |
| Set fields are strings, types N/W/D/F | 1059–1061, `cycleType` 1307 | Correct. `durationMinutes` is a number; `bodyweight` is a string. |
| RPE is pre-filled | 1060 (template), 1340–1341 (`addSet`), 1204 (`copyGhostSets`), 1398–1400 (`confirmAddExercise`) | Correct, and there is a fourth source the brief did not list: `confirmAddExercise` hard-codes `"8.5"`. |
| History matched by lowercase name | `getGhostBest` 1187 | Correct. |
| Placeholder name | 952, 986: `"Legs Session (Tap name to edit)"` | Correct. `confirmAddExercise` also creates `"Custom Exercise"` when the name is left blank (1394). I will treat that as a placeholder too. |
| Plain Epley in tools and PRs | 1589, 1620 | Correct. |
| Calories burned = `mins*5.5 + done*4` | 1372–1373 | Correct. Also: when no minutes are entered it invents `done × 2.5` minutes. |
| Water goal 3500 ml | 1509–1510 | Correct. |
| Unescaped `innerHTML` | 1282 (exercise name inside a `value="…"` attribute), 1503 (food name), 1630 (PR name) | Correct. A name containing `"` already breaks the input on line 1282. |
| No external requests | whole file | Correct. No `fetch`, no `<link>`, no remote `src`. |

## 2. Things in the code the brief did not mention (they affect the build)

1. **Reps are auto-filled too.** `toggleDone` (1324–1327) fills empty reps with the first number of the target range (`"6-10"` → `6`) when a set is ticked. So a ticked set can have reps you never typed. Readiness needs weight > 0, so you did type *something*, but the reps may be the range minimum. I will add a `repsAutoFilled` flag in that one place and show it in "Why?" the same way as unconfirmed RPE. See question 3.
2. **`changeDaySplit` rebuilds the day** (1210–1222) and copies only six named fields. Without a hook it would silently drop `sessionRpe`, `sleepHours` and `spotter`. I will add those to the copy list (SPOTTER HOOK). It also discards the day's exercises with no confirmation. That is existing behaviour; I will leave it and list it in LIMITATIONS.md.
3. **`editSet` saves but does not re-render** (1315–1318). That is deliberate: it keeps the keyboard open. So the readiness chip must update in place when you edit a ticked set, without calling `renderWorkout()`.
4. **`ensureDay` creates and saves a day for every date you look at.** So "a day exists in `logs`" does not mean "a day was logged". Spotter will judge days by content only (a done set, a load, foods), never by the key existing.
5. **`importBackup`** (1646–1660) overwrites everything with no validation and no confirmation, and swallows errors. The brief already asks for this to be replaced.
6. **`exportBackup`** (1636–1644) uses a `data:` URL download. I am not sure this works inside an iOS Home Screen app. I will switch to a Blob download and you verify on the phone (MANUAL_TESTS.md). The file contents keep the same two top-level names.
7. `logs` and `goals` are `let` globals in a classic script. A second classic script can read and reassign them, so `src/spotter-ui.js` can use them without changing how they are declared.
8. The viewport tag disables pinch zoom (`user-scalable=no`). This is an accessibility cost. I will not change it; it goes in DECISIONS.md as a proposal.
9. The backup file is named `ppl-mobile-backup-…`. I plan to name new exports `spotter-backup-…`. Old files still import.

## 3. Where the brief and the code (or reality) conflict

- **localStorage belongs to one web address.** Your real logs live under whatever address you open `mobile-gym.html` from today. If Spotter is served from a different address (or from the Home Screen instead of a Safari tab), it will start empty. That is not data loss, the old data is still where it was, but it will look like it. The safe path is: export a backup from the old app → open Spotter → import. This is the single biggest risk to "never lose my data", and it is outside the code. See question 1. I am not certain how current iOS shares storage between a Safari tab and a Home Screen app, so MANUAL_TESTS.md will tell you to take a backup first and not rely on it.
- **"Linear programming" on the poster vs whole servings.** The model is an integer linear programme. I plan to solve it with branch and bound, using the LP relaxation as the bound (section 5). In docs I will call it "integer linear programming, solved by branch and bound with a linear-programming bound". That is accurate and still matches the poster line.
- **Band edges.** The brief gives "0.8–1.3" and "1.3–1.5" without saying which band owns the edge. Plan: `< 0.8` lighter, `0.8 ≤ r ≤ 1.3` normal, `1.3 < r ≤ 1.5` climbing, `> 1.5` spike. This matches "stronger wording if the ratio is **above** 1.3". Listed in DECISIONS.md.
- **Maintenance "restores exactly".** Exact restore is guaranteed if you do not add or delete sets on that exercise between Apply and Undo. If you do, Undo puts the removed sets back at the end of the exercise and says so. Changing the split after Apply throws the exercises away (existing behaviour), so the undo data is cleared with them.
- **RTS chart.** I will store the numbers exactly as you gave them. I have not checked them against the original source, and VALIDATION.md will say "chart values supplied by Imroz" rather than cite a page I have not seen.
- **Foster (2001) and Stigler (1945).** I will cite them by author and year only, as on the poster, and mark full references as "to be confirmed by Imroz" unless you give me the exact citations.
- **Playwright is not installed** on this machine (checked global npm and the browser cache). Per the brief I will skip the Playwright smoke test and say so. For M8 I can do the phone-width pass (393×852) with the browser built into this app, including a check of network requests and console errors, and save screenshots. See question 4.

## 4. File map

```
index.html                 the app (mobile-gym.html renamed; edits marked // SPOTTER HOOK)
src/spotter-config.js      CONFIG: every threshold and default, one comment each
src/spotter-core.js        all logic, pure functions, UMD (window.SpotterCore / require)
src/spotter-demo.js        seeded synthetic history generator (pure; used by demo mode and tests)
src/spotter-ui.js          rendering + events for new UI; escapes all user text
manifest.webmanifest
sw.js
icons/                     icon.svg, icon-192.png, icon-512.png, apple-touch-icon-180.png
tools/make-icons.js        one-off Node script that draws the PNGs (no dependencies)
tests/*.test.js            e1rm, readiness, load, maintenance, solver, safety, migration, demo
tests/bruteforce.js        independent enumerator (tests and validation only)
tests/validate.js          writes docs/VALIDATION.md
tests/fixtures/            rts-chart.json, legacy-backup.json, load-5-weeks.json, sample-prices.json
docs/                      PROMPT, PLAN, ARCHITECTURE, DECISIONS, LIMITATIONS, VALIDATION,
                           MANUAL_TESTS, BUILD_LOG
package.json               scripts only, no dependencies
README.md
.gitattributes             force LF line endings (git warned about CRLF conversion on Windows)
```

Changes from the brief's layout, with reasons:
- `src/spotter-demo.js` is separate from core so synthetic data is clearly fenced off from real logic. Rule 5 says invented data must be labelled; a separate file makes that obvious to a reader.
- `tools/make-icons.js` exists because there is no build step and no image library. It writes PNGs using Node's built-in `zlib`. It is run once; the PNGs are committed.
- `tests/bruteforce.js` lives in `tests/` so the independent checker can never be loaded by the app.
- No `vendor/` folder (section 5 below).

Script order in `index.html`: config → core → demo → the existing inline script → ui. All are plain `<script src="./…">` tags, so the app still runs from `file://`.

## 5. Solver choice

**Plan: write my own exact branch and bound. No vendored library.**

- The problem is small: about 10–15 items, 0–3 servings each, three constraints.
- You will be questioned on it. About 100 lines you can read end to end are easier to defend than a library.
- It keeps third-party code at zero.
- Prices are converted to whole paise so cost comparisons are exact integers, with no floating-point ties.
- Bound: at each node, the cheapest way to cover the remaining protein if servings could be fractional. That is the LP relaxation of the remaining problem with the calorie limit dropped, and for a single covering constraint it is solved exactly by taking items in order of price per gram of protein. A node is cut only when its bound is strictly worse than the best cost found, so ties survive to be compared on calories, then number of distinct items.
- The brute-force enumerator is written separately, shares no code with the solver, and is compared on 500+ seeded instances.

The alternative (vendoring `javascript-lp-solver`) would need a download, which I would ask you about first. It goes in DECISIONS.md with a blank line for your call.

## 6. Data model changes (all additive)

Per day (added lazily in `ensureDay`, never required):
- `sessionRpe`: `null` or 1–10
- `sleepHours`: `null` or 0–14 in steps of 0.5
- `spotter`: `{}`; holds `maintenance` undo data (removed sets with their original positions, and the original `rpe`/`type` of any set that was capped or changed)

Per set:
- `rpeConfirmed`: `true` when you edit the PE box (or confirm it, question 2); `false` on sets created by new code; missing on legacy sets, shown as "unknown"
- `repsAutoFilled`: `true` only when `toggleDone` filled the reps; cleared when you edit reps (question 3)

New localStorage keys (your two existing keys are untouched):
- `spotter_schemaVersion`, `spotter_settings` (`calorieFloor`, `lastBudget`, `lastBackupAt`, `demoActive`), `spotter_exams`, `spotter_canteen`, `spotter_preimport_snapshot`
- Demo namespace: `spotter_demo_logs`, `spotter_demo_goals`, `spotter_demo_exams`, `spotter_demo_canteen`, `spotter_demo_settings`

Storage goes through one small function that picks the real or demo key set. `saveAll()` gets a one-line hook to use it. While demo mode is on, nothing writes to `lakshay_ppl_tracker_v1` or `lakshay_macro_goals_v1`. A test asserts this by recording every key written.

`migrate()` is pure: it takes the stored values and returns what to write. It never deletes or renames, only adds missing keys, and running it twice gives the same result as running it once.

Canteen pre-fill: the ten `STAPLES` items, each with a generated id, `price: null`, `maxServings: 3`, `available: true`. Eggs, soya and paneer are already in `STAPLES`, so the poster example works once you enter prices.

## 7. Milestones

| | What | Done when |
|---|---|---|
| M1 | `spotter-config.js`, `spotter-core.js` (e1RM, eligibility, first working set, OLS, verdict, load, ratio, bands, exam/ramp, maintenance plan/apply/undo, solver + fallback, floor, low-intake, name normalisation, date helper), brute force, unit tests | `npm test` passes |
| M2 | Rename to `index.html`; `ensureDay` fields; `rpeConfirmed`; `changeDaySplit` hook; `migrate()`; new export/import with validation, confirm and undo snapshot; legacy fixture test | Old backup imports; round trip is lossless |
| M3 | Readiness chips, session RPE chips, sleep input, Autopilot card, solver card, canteen editor, Spotter tab (5th nav item), Tools 1RM with RPE, Stats load chart | Every screen works at 393×852 |
| M4 | "Why?" panels for every output; floor warning in macro modal; low-intake note; wording checked against the poster | Every verdict has a working "Why?" |
| M5 | Demo generator, namespace switch, amber "DEMO DATA" banner, isolation test | Demo on/off leaves real keys byte-identical |
| M6 | Manifest, service worker, icons, iOS meta tags, rebrand to "Spotter" | Loads offline after one visit over http |
| M7 | `validate.js` → VALIDATION.md; ARCHITECTURE, DECISIONS, LIMITATIONS, MANUAL_TESTS, README | All docs exist and match the code |
| M8 | Full tests, validate, phone-width pass, fixes, final summary | Definition of done met |

After each: run all tests, update BUILD_LOG.md, local commit, short summary to you.

## 8. Edits to the existing inline script (all marked `// SPOTTER HOOK`)

Kept as small as I can make them:
1. `saveAll` – write through the real/demo key picker; call Spotter's refresh.
2. Boot load – read through the same picker; run `migrate()`.
3. `ensureDay` – add the three lazy fields.
4. `createDayObject`, `addSet`, `copyGhostSets`, `confirmAddExercise` – new sets get `rpeConfirmed: false`.
5. `editSet` – set `rpeConfirmed: true` on an RPE edit; clear `repsAutoFilled` on a reps edit; update the chip in place.
6. `toggleDone` – mark `repsAutoFilled`.
7. `changeDaySplit` – carry `sessionRpe`, `sleepHours`; clear maintenance undo data.
8. `renderWorkout`, `renderNutrition`, `renderStatsView`, `switchView` – one call each into `spotter-ui.js`.
9. `calc1RM` – add the RPE input and second result line.
10. `exportBackup` / `importBackup` – replaced by the new versions.
11. Markup – nav becomes 5 columns, new `view-spotter` section, sleep input, containers for the new cards, title and header text.

I will not touch `updateSummaryStrip` (calories burned), the ghost logic, timers, plate calculator, PR list or the existing unescaped rendering. Those are documented with proposed fixes for you to accept or reject.

## 9. Risks

| Risk | What I do about it |
|---|---|
| Real data appears missing after moving to a new address | Backup-first steps in MANUAL_TESTS.md and README; import accepts old files; question 1 |
| An import overwrites good data | Validation, a confirm step showing what will be replaced, one-step undo snapshot |
| Storage write fails silently (`SafeStore`) | Spotter shows a visible warning if a write does not read back. `SafeStore` itself is not changed. |
| Demo data leaks into real data | Separate keys, a single key picker, a test that records every write |
| A hook breaks an old feature | Hooks are one-liners; M8 walks every old feature at phone width; MANUAL_TESTS.md lists them all |
| History RPE is mostly pre-filled, so early trends rest on target RPE, not felt RPE | Shown in "Why?" as "N of M sessions had a confirmed RPE"; written up in LIMITATIONS.md |
| Few sessions make the regression noisy | Minimum 4 sessions, the 1.5% floor on spread, n always shown |
| Service worker serves a stale app | Versioned cache name, network-first for HTML, old caches deleted on activate |
| Project folder is inside OneDrive | Sync can briefly lock files during commits. If git errors appear I will tell you rather than work around it. |
| Line endings change on Windows | `.gitattributes` forces LF |

## 10. Questions for you (5)

1. **How do you open the tracker on your iPhone today?** (A web address in Safari, a Home Screen icon, a file in the Files app?) And will Spotter be served from that same address? This decides whether your logs carry over by themselves or need export → import. If you can, export a backup from the phone now and drop it into this folder as `my-backup.json`. I will use its *shape* (not its numbers) for the legacy fixture and add the file to `.gitignore` so it is never committed.
2. **One-tap RPE confirm.** A pre-filled RPE that happens to be right can only be "confirmed" by retyping it. May I add a small "Yes, it felt like 8.5" button inside the low-confidence note, which sets `rpeConfirmed` without typing? It is not in the brief, so I am asking rather than adding it.
3. **Auto-filled reps** (section 2, item 1). Options: (a) flag them and show a low-confidence note, like RPE; (b) treat auto-filled reps as not eligible for readiness; (c) ignore the issue. I recommend (a).
4. **Phone-width QA without Playwright.** OK to use the browser built into this app for the M8 pass and screenshots, with a temporary local static server that lives outside the repo? Or would you rather I ask before installing Playwright? (I recommend the built-in browser; nothing gets installed.)
5. **Solver.** Own branch and bound (section 5, my recommendation) or vendored `javascript-lp-solver`?

Smaller choices I will make myself and list in DECISIONS.md with a blank "Imroz's decision:" line: band edges, ramp-back being a suggestion only (no Apply button), `"Custom Exercise"` treated as a placeholder, export file name, the calorie floor default of 1500, and the proposals for calories burned, pinch zoom and escaping the old `innerHTML`.

**Waiting for your "go".**
