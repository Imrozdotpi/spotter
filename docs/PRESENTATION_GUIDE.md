# Spotter: presentation and demo guide

Built from Spotter.pptx (8 slides) and its speaker notes. Study order: 1) the 30-second pitch, 2) the slide-by-slide script, 3) the live demo, 4) the Q&A bank, 5) the numbers sheet.

## 0. Fix these before you present

1. **Slide 6 notes say "Fill in the three [TO CONFIRM] lines before presenting."** Make sure the Me / AI cards say only what is true.
2. **Your ppt and your trailer disagree about who chose the formulas.** Slide 3 says Claude (chat) "proposed the three features, formulas and thresholds". Slide 6 says you chose the three features. The trailer end card says formulas and thresholds are *yours*. Pick one true version and use it everywhere. Safe, honest wording: *"I set the problem, the constraints and the decisions. The AI proposed the methods and thresholds, and I reviewed and chose them. Claude Code wrote the code and tests."* Fix the trailer card if it says otherwise.
3. Demo data is **generated**. Say so out loud once. Never present it as real results.

## 1. The 30-second pitch (memorise)

"Students who lift have no affordable way to answer three weekly questions: is today a strong day, should I ease off in exam week, and how do I hit protein on a hostel budget. Bands cost money, and workout apps only record numbers. Spotter reads the workout log you already keep and applies three Data Science methods on the phone: regression, time series and integer linear programming. It costs zero, sends nothing anywhere, and every call has a Why? panel. Your logbook is the wearable."

## 2. Slide-by-slide script (about 6 to 8 minutes)

**Slide 1: Title (20 s).** Say the tagline: *Your logbook is the wearable.* Name, theme (AI TechTrailblazer), one line: AI training insights from the log students already keep, ₹0.

**Slide 2: Problem and solution (1 min).**
- Three questions: strong or weak day? ease off around exams? protein on a hostel budget?
- Bands cost money and subscriptions. Apps only record.
- The original tracker logged sets, reps, RPE, minutes, bodyweight, food, water, supplements, but every number was a fixed formula and nothing learned from the log.
- Map: Act I regression (readiness, with Go for a PR / Normal day / Drop a set), Act II time series (exam-week autopilot), Act III integer linear programming (cheapest protein combo).

**Slide 3: AI integration (1 min). Expect the "is there an AI model?" question here.**
- Answer first: *No language model, no deep learning, nothing trained in advance, nothing sent anywhere.* It is small models fitted to each user's own log, running on the phone.
- Explanations are fixed sentence templates filled with numbers. Every output has a Why? panel, so any call can be checked by hand.
- Two layers of AI: in the app (the three methods) and used to build it (Claude, Gemini for poster visuals, Claude Code for code, tests, docs).

**Slide 4: Methodology (2 min, the core slide).** Use the worked examples, not the abstract formulas.
- **Act I.** e1RM = weight × (1 + (reps + RIR)/30), RIR = 10 − RPE. Take the first working set each day (1 to 12 reps, RPE 6 to 10). Fit a least-squares line over the last 8 sessions (need 4, within 90 days). z = (today − predicted) ÷ s, with s at least 1.5% of the prediction. z ≥ +1 Go for a PR, z ≤ −1 Drop a set, otherwise Normal day. One past session more than 4 swings off the line is set aside. Example: trend predicts 129.50 kg, today's e1RM is 126.42 kg, z = −1.59, so Drop a set.
- **Act II.** Load = session RPE × minutes. Ratio = acute (last 7 days) ÷ chronic (mean weekly load of the 4 prior weeks that have data). Bands: under 0.8 lighter, 0.8 to 1.3 normal, 1.3 to 1.5 climbing fast, over 1.5 big spike. Exam within 6 days triggers Maintenance mode (same weights, about 60% of sets, RPE 8 or lower, no failure sets), then a ramp back to about 80% after. Example: past weeks 980, 1160, (missing), 1280 give chronic 1140. This week 1720 gives 1.51, Big spike.
- **Act III.** Minimise total price subject to protein ≥ gap, calories ≤ left, price ≤ budget, whole servings. Solved exactly by branch and bound. Ties go to fewer calories, then fewer items. Example: 40 g short, ₹60, 1,090 kcal left gives 2 × 2 boiled eggs plus 1 × soya chunks = ₹40, 50 g, 452 kcal (illustrative prices).

**Slide 5: Implementation (45 s).** Vanilla HTML, CSS, JS. No framework, no build step, no libraries. Logic is pure functions in spotter-core.js (about 1,300 lines), UI in spotter-ui.js (about 900), every threshold in spotter-config.js. Offline through a service worker and manifest. Data in localStorage; imports are validated, confirmed and undoable. Node's built-in test runner. Static hosting on GitHub Pages.

**Slide 6: Validation and human contribution (1 min).**
- 118 unit tests pass. 600/600 random canteens where the solver equals brute force, 0 constraint violations. 16/16 readiness scenarios give the expected verdict. Load ratio 1.5088 on a hand-computed fixture. `npm run validate` reproduces it.
- e1RM vs the published RPE chart over 80 cells: error 1.15 points with RPE vs 4.77 without, 75.8% less. Best at 4 to 6 reps, worst at 10 reps at RPE 6.5 (+5.0 pts).
- Outlier guard: one −20% session moves the prediction 0.28% with the guard, 10.43% without.
- Be honest about the split (see section 0). 8 issues found in the original tracker: 4 handled, 1 left as is, 3 open.

**Slide 7: Value and scalability (45 s).** Users: students who lift and log, especially in exam weeks, eating on a budget. ₹0 to run. No server, accounts or API keys, so more users add no infrastructure cost. Impact is an *expectation, not a result*. Future scope: real-iPhone test run, user study, fix the three open issues, plus the limits (needs logging, 4+ sessions per lift, hand-typed prices, average food values).

**Slide 8: Conclusion (30 s).** Close on the tagline. Safety: calorie floor 1500 (adjustable 1200 to 4000), load spikes are flags not injury predictions, wellness guidance not medical advice. Limits: RPE is subjective, the formula and chart come from trained lifters, prices approximate, data lives only on the phone (back it up). Then invite questions.

## 3. Live demo (4 to 5 minutes)

Setup (do this before the audience arrives)
- Open the hosted link in a **fresh Incognito window** with `?demo=present` (clean demo data, no banner), or reset with `?demo=reset`. Incognito avoids the old cached files.
- Date in the demo data is set for Tue 17 Nov. Open the Push 1 tab and check the sets are prefilled and unticked.
- Have a backup: your screen recording (Spotter Demo.mp4) and the trailer ready to play if wifi or the browser fails. The app also works offline once loaded.

Flow (follow the three acts, same order as the slides)
1. **Frame it (15 s).** "Everything you see runs on this phone or browser. No server."
2. **Act I, readiness.** Open Push 1, read the top card (verdict, e.g. Normal day / Go for a PR / Drop a set). Tap **Why?** and show the inputs, the predicted vs today's e1RM, and z. Say: "It compares today's first working set to my own trend line, not to anyone else." Tick the prefilled sets to show the flow.
3. **Act II, load.** Open the load / week view. Show this week's load against the 4-week usual and the ratio band (demo data gives about 1.40, "climbing fast"). Show an exam date and **Maintenance mode** with its undo. Say: "A flag, not an injury prediction."
4. **Act III, groceries.** Open the protein planner. Show the protein gap, budget and calories left, then the cheapest combo and its Why? panel. Say prices are illustrative and typed by the user.
5. **Trust (30 s).** Mention backup/import (validated, confirmed, undoable), the calorie floor, and the "Not medical advice" wording.
6. **Close.** "118 tests, 600 of 600 against brute force, zero rupees."

If something breaks: do not debug live. Say "let me show the recording", play Spotter Demo.mp4 or the trailer, and continue with the slides.

## 4. Q&A bank (answers are in your own notes and slides)

- **Is there an AI model?** No language model. Regression, time series and optimisation fitted to the user's own log, on the phone. Nothing trained in advance.
- **Where does my data go?** Nowhere. localStorage on the phone. The catch: lose the phone or clear the browser without a backup and it's gone.
- **Why a trend line and not just last week?** One odd day (bad sleep, deload) would mislead; a fitted trend over up to 8 sessions is robust, and the outlier guard sets aside extreme sessions.
- **What if RPE was pre-filled and not honestly rated?** The verdict is labelled low confidence, with a one-tap confirm.
- **Is the acute:chronic ratio an injury predictor?** No. It is a flag; the research is mixed. Based on Foster's session-RPE load.
- **How do you know the solver is optimal?** It matched an exhaustive brute-force search on 600 random canteens, with no constraint violations.
- **How do you know e1RM is right?** Compared cell by cell with the published RPE chart: 1.15 points mean error with RPE vs 4.77 without. It is best at 4 to 6 reps and weakest at 10 reps at low RPE.
- **What did you build vs the AI?** Use your confirmed answer from section 0. Do not overclaim.
- **Why not use a band or an existing app?** Cost, subscriptions, and apps that only record.
- **What are the limits?** Needs logging, 4+ sessions per lift, prices typed by hand, average food values, formulas come from trained lifters (possible bias), bodyweight exercises aren't modelled, 3 known open issues. Say them yourself before they are asked.
- **Is it medical advice?** No. Wellness guidance with a calorie floor and calm notes.
- **What would you do next?** Real-iPhone test run, a user study to measure outcomes, fix the open issues.
- **Has it been proven to help?** No outcome evidence yet. The impact slide says "expectation, not a result", so say it that way.

## 5. Numbers sheet (flash-card these)

| Item | Value |
|---|---|
| Unit tests | 118 |
| Solver vs brute force | 600/600, 0 violations |
| Readiness scenarios | 16/16 |
| Hand-checked load ratio | 1.5088 |
| e1RM error with / without RPE | 1.15 / 4.77 points (75.8% less) |
| Outlier guard example | 0.28% vs 10.43% shift |
| Trend window | last 8 sessions, need 4, within 90 days |
| z thresholds | +1 PR, −1 drop a set, floor s = 1.5% |
| Load ratio bands | 0.8 / 1.3 / 1.5 |
| Maintenance mode | exam within 6 days, about 60% sets, RPE ≤ 8, ramp to about 80% |
| Calorie floor | 1500 default, adjustable 1200 to 4000 |
| Code size | core about 1,300 lines, UI about 900, config 67 |
| Cost | ₹0 |

## 6. Delivery tips

- Lead with the problem and a plain-words answer; use formulas only through the worked examples.
- Say "I decided / I reviewed / the AI proposed" precisely. The judges are looking at AI vs human contribution.
- Keep to time: slides 7 to 8 minutes, demo 4 to 5 minutes, then Q&A.
- Finale is 19 Nov. Rehearse the demo twice end to end, including the fallback video.
