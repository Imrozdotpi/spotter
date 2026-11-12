# SPOTTER: FULL BUILD BRIEF (AI-INNOVEX 2026, Stage 2)

You are building Spotter end to end in this folder. Read this whole brief before doing anything. It is long on purpose: every requirement traces back to either (a) promises printed on my Stage 1 poster, which the competition requires me to implement exactly, or (b) the Stage 2 judging criteria. If anything here is wrong about the existing code, trust the code and tell me.

## 0. Context
- I'm Imroz Kamboj, B.Tech CSE (Data Science), 3rd year, NorthCap University. GitHub: Imrozdotpi.
- Spotter is my entry in AI-INNOVEX 2026, category "AI TechTrailblazer: Best Technical Implementation". I'm a top-12 finalist.
- Competition rule: "Round 2 is strictly the implementation of your Round 1 proposal." The problem and solution must stay identical to the poster. Build exactly what section 2 promises: nothing that contradicts it, and no scope creep beyond what's needed.
- Spotter is an on-device AI layer on top of my existing workout and nutrition tracker, mobile-gym.html: a single-file vanilla JS app that stores everything in localStorage. The tracker logs sets, reps, RPE, minutes, bodyweight, food, water and supplements, but every number in it is a fixed formula. Spotter adds three features that learn from that log.
- I'll demo it on my iPhone (Safari, 393×852 viewport) in a 30s–2min video and present it live to a jury of industry experts. I will be questioned on every formula and decision, so clarity and honesty matter more than flash.

## 1. Hard rules (non-negotiable)
1. HOSTING, DEPLOYMENT AND CI ARE MINE. Do not create a .github/ folder or any workflow file. Do not add a git remote, push, or run gh or any other GitHub command. Do not configure GitHub Pages, Netlify, Vercel or any other host. You MAY run git init and make LOCAL commits at milestones. Make the project Pages-ready (section 7) so I can deploy it myself.
2. Zero runtime network. Apart from loading its own static files from the same origin, the shipped app must make no network requests. No CDNs, no web fonts, no analytics, no LLM/AI APIs, no API keys anywhere. "Your logbook never leaves your phone" is printed on my poster, and it must be literally true.
3. No frameworks, no bundler, no build step. Vanilla HTML/CSS/JS that runs by opening index.html. Tests run on plain Node (node --test) with no npm dependencies. The only third-party code allowed is a vendored MIT/BSD-licensed solver file, if you choose that route (4.3), with its license file.
4. Never lose my existing data. My phone already has real logs in localStorage under the app's current keys (the constants KEY_LOGS and KEY_GOALS). Keep those keys and that data shape working exactly as now. Add new data alongside; never rename or delete existing keys or fields. Old backup JSON files must still import.
5. Don't invent data. No made-up food prices, workout history or citations outside the clearly labeled demo mode and test fixtures. If you're unsure of a fact or reference, say so in the docs instead of guessing.
6. Explain, don't diagnose. Every Spotter output is wellness guidance, not medical advice, and must show its reason. Load spikes are flags, never injury predictions.
7. Keep every existing feature working: splits, calendar, ghost "last best", timers, plate calculator, 1RM tool, macros, water, supplements, PRs, weekly volume, export/import.

## 2. What the poster promises (implement all of it)
Poster copy, quoted where exact:
- Title "SPOTTER". Tagline "Your logbook is the wearable." Pitch: "AI training insights for students, from the workout log they already keep. No band. No subscription." Cost: "₹0".
- ACT I · Readiness From Your Lifts. "Reads fatigue from your sets, not your wrist." Formula "e1RM = weight × (1 + (reps + 10 - RPE) / 30)". "Today's first working set vs. your trend." Outputs: "Go for a PR" (green), "Normal day" (amber), "Drop a set" (red; long form "Drop a set, keep the weight").
- ACT II · Exam-Week Autopilot. "Weighs your training load against your exam calendar." "load = session RPE × minutes" (Foster, 2001). "This week vs. your 4-week average, plus exam dates and sleep." "→ Maintenance mode in exam week", ramping back up after exams. "A warning flag, not an injury predictor."
- ACT III · Protein on a Hostel Budget. "Closes your protein gap at the lowest cost." "minimize cost s.t. protein ≥ gap, calories ≤ remaining" (Stigler's diet problem, 1945, linear programming). "→ Cheapest mix of eggs, soya and paneer". Example: "40 g protein short, ₹60 left. Cheapest canteen combo?"
- Pipeline: "Your logbook · never leaves your phone" → "On-device AI" → "Your spotter · explains every call".
- Honest by Design: "RPE is subjective, so Spotter trusts your trend over any single day." "Load spikes are flags, not injury predictions." "Never suggests eating below a safe calorie floor." Also: flag several days of very low intake, and "Wellness guidance, not medical advice."
- "Data Science in action: regression · time series · linear programming". All three must be real in the code: regression (Act I), time series (Act II), linear/integer programming (Act III).

## 3. The existing app: read every line before planning
mobile-gym.html, about 1,670 lines. Facts I already know (verify them):
- Storage: a SafeStore wrapper over localStorage. logs = { "YYYY-MM-DD": day } is stored under KEY_LOGS; goals = {cal, pro, carb, fat} under KEY_GOALS. saveAll() persists and re-renders.
- Day object (createDayObject / ensureDay): { split, durationMinutes, bodyweight, waterMl, supplements[], foods[], notes, exercises[] }.
- Exercise: { muscle, name, targetReps, targetRpe, sets[] }. Set: { type, weight, reps, rpe, done }. weight, reps and rpe are STRINGS (parseFloat them). Set types cycle N (normal), W (warm-up), D (drop set), F (failure) via cycleType().
- DATA-QUALITY ISSUE: every new set's rpe is PRE-FILLED. createDayObject uses the exercise's targetRpe, addSet copies the previous set, and copyGhostSets copies old RPE. So a stored RPE may never have been entered by me, but readiness depends on real RPE. Add a per-set flag rpeConfirmed = true, set only when I actually edit the RPE input (editSet with field 'rpe'). Copied or prefilled values are unconfirmed. Legacy sets have no flag (treat as unknown). Surface this honestly (4.1).
- Exercise history is matched by name (getGhostBest compares lowercase names). Names are free text and editable. Normalise names (trim, lowercase, collapse spaces) in ONE helper and use it wherever Spotter matches history. Exclude placeholder names like "Legs Session (Tap name to edit)".
- Views: view-workout, view-nutrition, view-tools, view-stats, with a bottom nav driven by switchView(viewName, btn). activeDate is the calendar-selected date and can be in the past. Every Spotter calculation must be relative to activeDate and use only earlier dates as history.
- Food: a STAPLES array of {name, cal, pro, carb, fat}; quickLogFood and addCustomFood log foods per day. The water goal is hard-coded at 3500 ml.
- Tools: calc1RM() uses plain Epley (r === 1 ? w : w * (1 + r/30)). Stats: renderStatsView() shows weekly sets per muscle (excluding W) and all-time PRs by Epley.
- updateSummaryStrip() estimates calories burned as mins*5.5 + doneSets*4. That isn't an evidence-based formula. Do NOT silently change it: log it as a known issue and propose options in DECISIONS.md.
- Rendering uses innerHTML with unescaped user text (exercise and food names). All NEW Spotter rendering must escape user text. Note the existing XSS risk in LIMITATIONS.md and propose (don't force) a fix.
- The app makes no external requests today (system fonts only). Keep it that way.
- Theme: CSS variables in :root: --bg-main #090d16, --bg-card #131b2e, --border #24324d, --text-main, --text-muted, --accent #10b981 (emerald), --legs #f59e0b (amber), --push #ef4444 (red), --pull #3b82f6 (blue). New UI must reuse these and the existing card/btn/chip classes so it looks native. Mobile first, tap targets ≥ 44px.

## 4. Features to build

### 4.1 ACT I: Readiness From Your Lifts (regression)
Goal: once I tick today's first working set of a lift, Spotter says whether today is a PR day, a normal day or a drop-a-set day, by comparing that set with my own trend for that lift.
- RPE-adjusted e1RM: RIR = 10 − RPE; e1RM = weight × (1 + (reps + RIR) / 30). If reps + RIR = 1 (a true single at RPE 10), e1RM = weight, matching the app's existing r === 1 rule. At RPE 10 the result must equal the app's plain Epley exactly.
- Eligible set: done, type N or F (not W or D), weight > 0, 1 ≤ reps ≤ 12, 6 ≤ RPE ≤ 10. Outside these ranges the formula is unreliable, so skip the set and say why in "Why?".
- "First working set" = the first eligible set of that exercise on a given day. Use first working sets for BOTH today and the history, so the comparison is like-for-like (same fatigue state).
- History: same normalised exercise name, dates before activeDate, within the last 90 days, up to the 8 most recent sessions. Require at least 4 sessions; with fewer, show "Building your trend: X of 4 sessions logged" and no verdict.
- Model: ordinary least squares fit y = a + b·x, where x = days since the earliest session in the window and y = first-working-set e1RM. Predict at today's x. Compute the residual standard deviation s with n−2 degrees of freedom. Floor s at 1.5% of the prediction so a very smooth history doesn't make the verdict hypersensitive.
- Score: z = (today − predicted) / s. Verdict: z ≥ +1.0 → "Go for a PR"; z ≤ −1.0 → "Drop a set, keep the weight"; otherwise "Normal day". In plain English: more than one typical day-to-day swing above or below your trend.
- "Trusts your trend over any single day": the verdict is always relative to the fitted trend, never to one previous session. Add tests proving that one wildly off session in the history moves the prediction only modestly, and that today's set never alters the trend it is judged against.
- Confidence: if today's set RPE is unconfirmed, still compute the verdict but label it "Low confidence: RPE was pre-filled at X. Tap PE to enter how hard it really felt." Always show n (sessions used).
- UI: on each exercise card in the workout view, under the ghost bar, a compact readiness chip (green/amber/red, using the poster wording) once today's first working set is done. Tapping it opens a "Why?" panel showing today's set (w × r @ RPE), today's e1RM, the predicted e1RM from the trend, the % difference, sessions used, the formula and a one-line suggestion. Also update the Tools 1RM calculator to take an RPE input and show both plain Epley and the RPE-adjusted e1RM.

### 4.2 ACT II: Exam-Week Autopilot (time series)
Goal: adapt training to my academic calendar using session load, exams and sleep.
New inputs (each must be a one-tap action or close to it):
- Session RPE per day (sessionRpe, 1–10, Foster's CR-10 "how hard was the whole session"): a 1–10 chip row on the workout view, shown once the session has started (any set done or minutes entered).
- Sleep per day (sleepHours: last night's sleep, 0–14, step 0.5): a small input near the day's minutes and bodyweight inputs.
- Exam calendar: a list of {label, date} entries I add and remove in Spotter settings.
Model:
- Daily load = sessionRpe × durationMinutes, only when both exist. Otherwise the day has no load; never guess.
- Acute load = sum over the 7 days ending on activeDate (activeDate−6 to activeDate). Chronic load = mean weekly load over the 4 weeks before that (activeDate−34 to activeDate−7), so this week isn't averaged into its own baseline. Count only weeks with at least one logged load: a week with no logs is missing data, not zero (record this choice in DECISIONS.md). Ratio = acute / chronic. With fewer than 2 such weeks, show "Not enough history yet".
- Bands (flags only, and the wording must say so): ratio < 0.8 "Lighter than usual"; 0.8–1.3 "In your normal range"; 1.3–1.5 "Load is climbing fast"; > 1.5 "Big spike vs your usual". Note in LIMITATIONS.md that research on this ratio is mixed and it is not an injury predictor.
- Exam week = any exam dated within activeDate to activeDate+6. Ramp-back week = the last exam was within the previous 7 days and no exam falls in the next 7.
- In exam week, suggest Maintenance mode. Use stronger wording if the ratio is above 1.3 OR average sleep over the last 3 nights with data is under 6.5 h.
- Maintenance mode = keep the weights, keep each exercise at ceil(60%) of its planned sets (minimum 1), cap RPE at 8, no F (failure) sets. Provide a one-tap "Apply maintenance mode" on today's workout. It must trim only sets I haven't completed, and be fully reversible: "Undo" restores the removed sets exactly, from data stored on the day object. In a ramp-back week, suggest about 80% of usual sets.
- UI: an Autopilot card at the top of the workout view, shown only when there's something to say. It shows the exam countdown, this week's load vs the 4-week average with the ratio and band, average sleep, the suggestion, Apply/Undo, and a "Why?" with the numbers and formula. Also add a weekly-load bar chart to the Stats view (last 6 weeks, current week highlighted, exam weeks in amber), drawn with plain SVG/CSS and no chart library.

### 4.3 ACT III: Protein on a Hostel Budget (integer linear programming)
Goal: given my protein gap, budget and calories left, find the cheapest combo of canteen foods that closes the gap.
Data:
- A canteen catalog stored as spotter_canteen: items {id, name, cal, pro, carb, fat, price (₹ per serving), maxServings (default 3), available (bool)}. Pre-fill it from STAPLES with price EMPTY; I'll enter real prices from my canteen. The solver ignores items without a price, and the UI shows which ones need prices. Let me add, edit and delete items.
Model (decision variable x_i = integer servings, 0 ≤ x_i ≤ maxServings_i, over available priced items only):
- minimise Σ price_i·x_i
- subject to Σ pro_i·x_i ≥ gap, Σ cal_i·x_i ≤ caloriesRemaining, Σ price_i·x_i ≤ budget.
- Break cost ties by fewer calories, then by fewer distinct items.
- If infeasible: solve the fallback "maximise protein subject to budget and calories" and say plainly "With ₹X and Y kcal left, the most you can get is Z g of your W g gap."
- gap defaults to max(0, protein goal − protein logged on activeDate) and is editable. Budget is an input I type; remember the last value. caloriesRemaining = effective calorie goal − calories logged (see 4.4 for the floor). If caloriesRemaining ≤ 0, don't run the solver; explain that today's calories are used up.
Solver: servings must be whole numbers (you can't buy 1.37 eggs). Either vendor a small MIT/BSD-licensed solver that supports integer variables (e.g. javascript-lp-solver) into vendor/ with its license, OR write your own exact branch-and-bound. Your choice; justify it in DECISIONS.md. Either way, also write an INDEPENDENT brute-force enumerator (a separate code path, used only in tests and validation) and prove the two agree (section 6).
UI: a "Protein on a Hostel Budget" card in the nutrition view. It shows the gap, ₹ budget and calories left, and a "Find cheapest combo" button. The result lists item × servings with ₹, protein and kcal, plus totals. Add "Log this combo" (adds the foods to today in one tap) and "Why?" (the model in plain words plus the numbers). The canteen editor lives in the Spotter tab.

### 4.4 Honest-by-design safety
- Calorie floor: a setting, default 1500 kcal/day, described as a general wellness floor, not personalised medical advice. I'll decide the final default, so list it in DECISIONS.md. If my calorie goal is set below the floor, show a gentle warning in the macro modal and use the floor as the effective goal for Spotter's calories-remaining. Spotter must never output a plan or message that implies eating below the floor.
- Low-intake flag: if 3 or more consecutive logged days (a logged day has at least 2 foods logged) total below the floor, show a calm, non-judgemental note on the nutrition view: logged intake has been under the floor for N days; if that's not intentional, consider eating more; this is wellness guidance, not medical advice. No shaming and no numbers-chasing language.
- Every verdict carries a "Why?" with its inputs, formula and reason. Explanations are deterministic, on-device templates (NOT an LLM), written in plain English with short sentences.

### 4.5 Spotter tab
Add a 5th bottom-nav tab, "Spotter", matching the existing nav style. It contains:
- Today's brief: readiness for lifts done today, Autopilot status, the protein gap with a shortcut to the solver, and any low-intake flag.
- The "How it works" pipeline: Your logbook · never leaves your phone → On-device AI → Your spotter · explains every call.
- Settings: exam dates, calorie floor, default budget, canteen catalog, backup/export/import, demo mode toggle, and an About line, "Wellness guidance, not medical advice."

### 4.6 Data model, migration, backup
- Add the new per-day fields lazily in ensureDay: sessionRpe (null), sleepHours (null), and a spotter object for things like maintenance-mode undo data. Add rpeConfirmed per set where relevant. None of them may be required.
- New top-level keys use the prefix spotter_ (canteen, exams, settings, schemaVersion). Write a migrate() that runs on boot, is idempotent, and is tested against a realistically shaped legacy backup fixture.
- Export: keep workoutLogs and macroGoals with the same names as now, so old importers still work, and add spotter { canteen, exams, settings } and schemaVersion. Import: accept both the old and new formats, validate the shape, show a confirm step before overwriting, and save a one-step undo snapshot (spotter_preimport_snapshot).
- iPhone storage: Safari can clear storage for sites not used for about 7 days unless they're added to the Home Screen. Call navigator.storage.persist() where supported, show "Last backup: N days ago" in Settings, and give a gentle reminder after 7 days.

### 4.7 Demo mode (clearly labeled)
Demo mode is for testing and as a fallback for the demo video. Turning it on loads a deterministic, seeded 6-week synthetic history into a SEPARATE storage namespace (spotter_demo_*). The history includes PPL sessions with realistic progression and noise, session RPEs, sleep, one exam week, foods and SAMPLE canteen prices. While it's on, a persistent amber "DEMO DATA" banner shows on every screen. Turning it off returns to my real data untouched. Real and demo data must never mix; add a test for this.

### 4.8 Offline / installable (PWA)
- manifest.webmanifest: name "Spotter", theme and background colours from the CSS variables, and icons.
- apple-touch-icon and the iOS meta tags.
- sw.js: a versioned cache, network-first for the HTML so updates show up, cache-first for static assets, same-origin only.
- All paths RELATIVE ("./"), so it works from a GitHub Pages project subpath like /spotter/.
- Generate simple original icons (an emerald barbell/spotter mark on navy) as SVG plus PNG at 192, 512 and 180. No brand logos.

### 4.9 Rebrand
The visible app name becomes "Spotter" (title, header, manifest). Keep my PPL split templates and everything else.

## 5. Code structure
Target layout (change it only with a reason in PLAN.md):
- index.html: the app. Phase 0 commits mobile-gym.html untouched as the baseline, then renames it to index.html in the next commit. Keep edits minimal and clearly marked (// SPOTTER HOOK) to wire in the new modules.
- src/spotter-core.js: ALL logic as pure functions with no DOM and no Date.now() inside (pass dates in). Covers e1RM, eligibility, first working set, OLS and residual SD, the readiness verdict, daily/weekly load, ratio and bands, exam/ramp detection, the maintenance plan, the solver wrapper and fallback, the calorie floor and low-intake detection, explanation text builders, name normalisation and migrate(). Use a UMD-style wrapper so it works as a browser global (SpotterCore) and via require() in Node.
- src/spotter-ui.js: rendering and event wiring for the new UI, reusing the existing globals (logs, goals, activeDate, saveAll, renderWorkout, etc.). Escape all user text.
- src/spotter-config.js: every threshold and default from section 4 in one CONFIG object, each with a one-line comment.
- vendor/: only if you vendor a solver (plus its LICENSE).
- manifest.webmanifest, sw.js, icons/
- tests/: node:test files per feature, fixtures/, and validate.js
- docs/: see section 8
- package.json: scripts only ("test": "node --test", "validate": "node tests/validate.js"), no dependencies.
- README.md: what it is, how to run it locally (open index.html or use any static server), how to test, and the project structure.
Dates: activeDate keys are local "YYYY-MM-DD". Do all day arithmetic by parsing keys as UTC midnight, to avoid timezone and DST bugs, in one helper.

## 6. Testing and validation (judged under "Testing & Output Validation" and "Technical Mastery")
Unit tests (node --test; all must pass):
- e1RM: RPE 10 equals plain Epley for reps 1–12; a true single at RPE 10 equals the weight; eligibility edge cases; string inputs.
- Readiness: flat, rising and falling trends; exactly 3 vs 4 sessions; a single outlier in the history (bounded effect); unconfirmed RPE → low confidence; placeholder names excluded; a past activeDate uses only earlier data.
- Load: a hand-computed 5-week fixture with the expected daily loads, acute, chronic, ratio and band written out in the test so a human can check the arithmetic; days missing sessionRpe or minutes contribute nothing; exam-week and ramp-back detection at the boundaries; apply → undo for maintenance mode restores exactly; completed sets are never removed.
- Solver: constraints always satisfied; infeasible → correct fallback; integer servings; tie-break rules; unpriced and unavailable items ignored.
- Safety: a goal below the floor → floor used and warning shown; the low-intake flag at 2 vs 3 days and with sparse logging.
- Migration/backup: a legacy backup imports; an export → import round trip is lossless; demo and real data never mix.
Benchmarks: tests/validate.js uses deterministic seeds and writes docs/VALIDATION.md with tables and PASS/FAIL.
1. e1RM vs the published RTS RPE chart (Tuchscherer). Store it in tests/fixtures/rts-chart.json as % of 1RM for reps 1–10 at RPE 10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5:
   1: 100, 97.8, 95.5, 93.9, 92.2, 90.7, 89.2, 87.8
   2: 95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3, 85.0
   3: 92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7, 82.4
   4: 89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1, 79.9
   5: 86.3, 85.0, 83.7, 82.4, 81.1, 79.9, 78.6, 77.4
   6: 83.7, 82.4, 81.1, 79.9, 78.6, 77.4, 76.2, 75.1
   7: 81.1, 79.9, 78.6, 77.4, 76.2, 75.1, 73.9, 72.3
   8: 78.6, 77.4, 76.2, 75.1, 73.9, 72.3, 70.7, 69.4
   9: 76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0, 66.7
   10: 73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3, 64.0
   For each cell, compute the % of 1RM our formula implies (100 / (1 + (reps + RIR)/30), with the single-rep rule). Report the error per cell, mean absolute error overall and by rep range, and where it's worst. This is a comparison, not a pass/fail on exact match, so report it honestly. Also compare against plain Epley (ignoring RPE) to show what adding RPE buys.
2. Readiness: a scenario table of expected vs actual verdicts for each synthetic scenario.
3. Load: the hand-computed fixture, expected vs actual for every number.
4. Solver vs brute force: at least 500 seeded random instances (3–10 items, prices ₹5–80, maxServings 1–4), with each instance's brute-force search space capped at about 200,000 combinations. Report agreement on optimal cost (to ₹0.01), feasibility agreement, constraint violations (must be 0), and mean/max solve time. Add the poster case "40 g protein short, ₹60 left" using tests/fixtures/sample-prices.json, clearly marked SAMPLE (I'll replace it with real prices).
5. A summary of the safety checks.
6. "Issues found": the calories-burned formula, the RPE pre-fill, Epley's weakness at very low and high reps, exercise renames breaking history, and unescaped innerHTML. For each, give the evidence and the decision taken or still pending.
If Playwright is already available on this machine, add a smoke test at an iPhone viewport (393×852): the app loads, all five tabs render, there are no console errors, there are zero network requests beyond same-origin files, and screenshots of each Spotter screen go to docs/screenshots/. If Playwright isn't available, skip this and say so. Don't install heavy tooling without asking.

## 7. Pages-ready (but don't deploy)
index.html sits at the repo root. All asset paths are relative, with no absolute "/" paths and no server code. It must work from a subfolder and from file:// (the service worker only works over http/https; degrade gracefully). Add a short "Deploying (done by Imroz)" note to the README describing what I'll need to do myself, without doing any of it.

## 8. Docs (deliverables; keep them in plain English)
- docs/PROMPT.md: this brief, verbatim. Save it first; the competition asks for my prompts.
- docs/PLAN.md: your plan, written in Phase 0.
- docs/ARCHITECTURE.md: the pipeline (inputs → on-device models → decisions → explanations), the data model, a file map, and each of the three methods with its formula and one worked example using real numbers. Be precise about what the "AI" is: regression, time-series load monitoring and integer optimisation running on-device, with template explanations. It is not an LLM and not deep learning. No hype words.
- docs/DECISIONS.md: every default and threshold, the options considered, why you picked it, and a blank "Imroz's decision:" line on each. I will review and own these.
- docs/LIMITATIONS.md (responsible AI): RPE is subjective; the RTS chart and Epley come from trained-lifter populations (possible bias for beginners and other groups); evidence on the load ratio is mixed; food values are averages and canteen portions vary; prices change; small personal datasets are noisy; privacy (local-only storage, device loss, iOS storage clearing, backups contain personal data); not medical advice; plus the issues found in section 6.
- docs/VALIDATION.md: generated by npm run validate.
- docs/MANUAL_TESTS.md: a step-by-step checklist I run on my iPhone: install to the Home Screen, test offline, test each feature against its expected result, demo mode on/off, backup/import, maintenance apply/undo.
- docs/BUILD_LOG.md: for each milestone, what you built, files touched, tests added, decisions made, anything I must verify, and which parts were AI-generated. Keep it factual; I'll use it to disclose AI vs human contribution.

## 9. How to work
Phase 0 (then STOP): read every line of mobile-gym.html and this brief. Save docs/PROMPT.md. Run git init and commit mobile-gym.html untouched as the baseline. Write docs/PLAN.md covering milestones, file map, data-model changes, risks, anything in this brief that conflicts with the code, and up to 5 questions for me. Then wait for my "go".
After my go, work through these milestones without stopping, unless you're blocked or a choice risks my data:
 M1 core logic + config + unit tests (all three features + safety)
 M2 data model, migrate(), backup/import, rpeConfirmed
 M3 UI: readiness chips, Autopilot card + inputs, solver card + canteen editor, Spotter tab, Tools 1RM update, Stats load chart
 M4 "Why?" explanations and safety messages everywhere
 M5 demo mode
 M6 PWA/offline, icons, rebrand
 M7 validation report + all docs
 M8 final QA: full test run, validate, a manual pass at iPhone viewport, fix what you find, final summary
After each milestone: run all tests, update BUILD_LOG.md, make a local commit with a clear message, and give me a 3–5 line summary. Fix failing tests before moving on. Never weaken a test to make it pass; if a test was wrong, say so in BUILD_LOG.md.

## 10. Definition of done
- npm test passes. npm run validate regenerates VALIDATION.md with zero solver constraint violations and 100% agreement with brute force (or every mismatch explained and fixed).
- At phone width, index.html keeps every old feature working. All three Acts work on my real data once I've logged enough sessions, and immediately in demo mode.
- Every Spotter output has a working "Why?".
- No network requests at runtime; works offline after the first load over http(s).
- My existing localStorage data and old backup files load unchanged.
- Poster wording matches wherever it appears in the UI.
- Every doc in section 8 exists and is accurate.
- No .github folder, no remotes, no deployment config.
- Final message: what was built, how to run it, test and validation results, the open decisions waiting for me in DECISIONS.md, and known limitations.
