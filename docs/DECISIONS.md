# Decisions

Every default, threshold and design choice in Spotter, with the options considered and the reason for the pick. Each one has a blank line for Imroz to accept or change. The numbers live in `src/spotter-config.js`; changing a number there changes the app.

Sources are marked honestly:
- **Brief** = specified by Imroz in `docs/PROMPT.md`.
- **Build** = chosen during the build because the brief left it open.
- **Added** = not in the brief at all.

---

## A. Decisions that most need your attention

### A1. Set aside one wildly off session before fitting the trend (Added)
- **What:** `READINESS_OUTLIER_T = 4`. Before the line is fitted, each past session is compared with the line through the other sessions. If one is more than 4 typical swings away, that one session is left out (never more than one, and only when there are at least 5 sessions). "Why?" says when this happened.
- **Why it was added:** the brief asks for proof that "one wildly off session in the history moves the prediction only modestly". With plain least squares that is not true. In the validation report a single −20% session last week moves the prediction by 10.4% and turns an ordinary day into a false "Go for a PR".
- **Options:** (a) plain least squares and accept the weakness; (b) this step; (c) a robust line such as Theil–Sen, which changes the method the poster names.
- **Picked:** (b). It keeps ordinary least squares, is easy to explain, and makes the poster line "trusts your trend over any single day" true.
- **To switch it off:** set `READINESS_OUTLIER_T` to `Infinity`.
- **Imroz's decision:** 

### A2. Calorie floor default: 1500 kcal/day (Brief, default is yours to set)
- **Options:** 1200, 1500, 1800, or a value based on bodyweight.
- **Picked:** 1500, as in the brief. It is described in the app as "a general wellness floor, not personalised medical advice".
- **Note:** I have no source I can vouch for that makes 1500 the right number for you. An active male student lifting six days a week will usually need far more. Treat it as a tripwire, not a target.
- **Imroz's decision:** 

### A3. The floor setting cannot go below 1200 or above 4000 (Added)
- **Why:** without a lower limit, the safety feature could be switched off by typing a tiny number.
- **Note:** 1200 is a commonly quoted general minimum, but I cannot give you a citation I have checked. Change `CALORIE_FLOOR_MIN` if you have a better-sourced value.
- **Imroz's decision:** 

### A4. Calories-burned number in the summary strip (Brief: do not change silently)
- **Today:** `burned = minutes × 5.5 + done sets × 4`, and with no minutes logged it assumes 2.5 minutes per set. This is not an evidence-based formula. Spotter does not use it anywhere.
- **Options:** (a) leave it; (b) relabel it "rough est."; (c) hide it; (d) replace with a MET-based estimate (kcal ≈ MET × bodyweight in kg × hours), which needs bodyweight and still is only an estimate.
- **Recommendation:** (b) for the competition (honest and a one-word change), (d) later.
- **Status:** unchanged.
- **Imroz's decision:** 

### A5. Escaping user text in the tracker's existing screens (Brief: propose, don't force)
- **Today:** three places put typed text straight into the page: the exercise name input in `renderWorkout`, the food name in `renderNutrition`, the PR name in `renderStatsView`. A name with a `"` already breaks the exercise input.
- **Proposed fix:** wrap each in `SpotterCore.escapeHtml(...)`. Three one-line edits. All new Spotter rendering already does this.
- **Status:** unchanged.
- **Imroz's decision:** 

### A6. Own solver instead of a library (Build, agreed in Phase 0)
- **Options:** vendor `javascript-lp-solver`, or write an exact branch and bound.
- **Picked:** own branch and bound, about 110 lines in `src/spotter-core.js`.
- **Why:** the problem is tiny (10–15 items, a few servings each); you can read and defend every line; no third-party code; whole-number arithmetic makes cost ties exact. It is checked against an independent brute force on 600 cases.
- **Imroz's decision:** 

### A7. Citations (Build)
- The app and docs name Foster (2001), Stigler (1945), Epley and the RTS chart by author and year only. From memory, the full references are: Foster et al., "A new approach to monitoring exercise training", *Journal of Strength and Conditioning Research*, 2001; Stigler, "The cost of subsistence", *Journal of Farm Economics*, 1945. **I have not verified these against the sources. Check them before you cite them.**
- The RTS chart values in `tests/fixtures/rts-chart.json` are the ones you supplied.
- **Imroz's decision:** 

---

## B. ACT I: readiness

| # | Setting | Value | Source | Options considered | Why this one |
|---|---|---|---|---|---|
| B1 | e1RM formula | weight × (1 + (reps + 10 − RPE) / 30) | Brief (poster) | Brzycki, Lombardi, RTS chart lookup | It is the poster's formula, equals the tracker's Epley at RPE 10, and is one line to explain. |
| B2 | Rep range used | 1–12 | Brief | 1–10 (the chart's range), 1–15 | Epley-style estimates drift at high reps (VALIDATION §1). 12 covers most of your template rep ranges. Note the chart only validates up to 10. |
| B3 | RPE range used | 6–10 | Brief | 5–10, 7–10 | Below 6, "reps in reserve" is a guess. |
| B4 | Set types used | N and F | Brief | N only | A failure set is a real maximal effort; warm-ups and drop sets are not comparable. |
| B5 | Which set | First eligible set of the day | Brief | Best set, average of sets | Same fatigue state every time. |
| B6 | History window | 90 days, last 8 sessions | Brief | 60/120 days; 6/10 sessions | Recent enough to reflect current strength, long enough to fit a line. |
| B7 | Minimum sessions | 4 | Brief | 3, 5 | A line and its spread need at least 4 points to mean anything. |
| B8 | Spread floor | 1.5% of the prediction | Brief | 1%, 2%, none | Stops a very smooth history from making the verdict hypersensitive. |
| B9 | Verdict thresholds | z ≥ +1, z ≤ −1 | Brief | ±0.75, ±1.5 | "More than one typical swing" is a plain-English rule. |
| B10 | Unconfirmed RPE | Verdict shown, labelled low confidence | Brief | Hide the verdict | Hiding it would make the feature useless on existing data. |
| B11 | Legacy sets (no flag) | Treated as "unknown", also low confidence | Brief / Build | Treat as confirmed | We cannot know, so we say so. |
| B12 | One-tap "Yes, it felt like RPE X" | Added | Added (agreed) | Retype to confirm | A correct pre-fill could otherwise never be confirmed. |
| B13 | Auto-filled reps | Flagged, low confidence | Added (agreed) | Exclude the set; ignore | The tracker fills reps with the range minimum when a set is ticked empty. |
| B14 | Placeholder names | "Legs Session (Tap name to edit)" and "Custom Exercise" get no trend | Brief / Build | Only the first | "Custom Exercise" is what the tracker names a blank new exercise. |
| B15 | Name matching | trim, lower-case, collapse spaces | Brief | Fuzzy matching | Predictable. A real rename starts a new trend (see C in LIMITATIONS). |

**Imroz's decision on section B:** 

---

## C. ACT II: exam-week autopilot

| # | Setting | Value | Source | Options considered | Why this one |
|---|---|---|---|---|---|
| C1 | Daily load | session RPE × minutes, only when both exist | Brief (Foster) | Estimate missing values | Never guess. |
| C2 | Acute window | 7 days ending on the selected date | Brief | Calendar week | A rolling window is never "half a week". |
| C3 | Baseline | Mean of the 4 weeks before, not including this week | Brief | Include this week (the "coupled" ratio); exponentially weighted average | Keeps this week out of its own baseline. |
| C4 | Missing weeks | A week with no logged load is left out of the average | Brief | Count it as zero | A week you did not log is unknown. Counting it as zero would make every return to logging look like a spike. **The cost:** a real week off (illness, holiday) is also left out, so the baseline can be higher than your true recent load. |
| C5 | Minimum baseline | 2 weeks with data | Brief | 1, 3 | One week is not an average. |
| C6 | No load logged this week | No ratio is shown | Build | Show a ratio of 0 ("Lighter than usual") | Same principle as C4. |
| C7 | Band edges | under 0.8; 0.8–1.3; above 1.3 to 1.5; above 1.5 | Brief; edges chosen in build | Edges belonging to the higher band | Matches "stronger wording if the ratio is **above** 1.3". |
| C8 | Exam week | Exam today or in the next 6 days | Brief | Next 7 | A 7-day window including today. |
| C9 | Ramp-back week | Last exam 1–7 days ago and none in the next 7 | Brief | | |
| C10 | Ramp-back action | Text suggestion only ("about 80% of usual sets"); "Why?" lists the set counts | Build | An Apply button like maintenance mode | The brief says "suggest". Easy to add later. |
| C11 | Exam countdown | The card appears from 14 days before an exam | Build | 7, 21 | "Shown only when there is something to say." |
| C12 | Sleep average | Last 3 nights with an entry, within the last 7 days | Brief; the 7-day limit is build | No limit | Three nights from three weeks ago say nothing about now. |
| C13 | Low-sleep line | under 6.5 h | Brief | 6, 7 | |
| C14 | Maintenance sets | ceil(60%), at least 1 | Brief | 50%, 66% | |
| C15 | Maintenance RPE cap | 8, applied to sets not yet done | Brief | Leave RPE alone | The capped value is marked unconfirmed, since it is a target, not a felt RPE. |
| C16 | Which sets are trimmed | Undone sets, from the end of each exercise | Build | From the start | Warm-ups and first working sets stay. Completed sets are never touched. |
| C17 | Undo after edits | If sets were added or removed in between, removed sets go back at the end and the app says so | Build | Refuse to undo | Nothing is lost either way. |
| C18 | Changing the split after Apply | Undo data is dropped | Build | | The tracker replaces the exercises it referred to. |
| C19 | Session RPE input | 1–10 chips in two rows; tap again to clear | Build | A slider, a number box | One tap, 44 px targets. |

**Imroz's decision on section C:** 

---

## D. ACT III: protein on a hostel budget

| # | Setting | Value | Source | Options considered | Why this one |
|---|---|---|---|---|---|
| D1 | Servings | Whole numbers, 0 … max | Brief | Fractions | You cannot buy 1.37 eggs. |
| D2 | Default max servings | 3 per item (settable 1–10) | Brief; the limit of 10 is build | | Stops "eat 9 servings of soya". |
| D3 | Tie-breaks | Cost, then fewer calories, then fewer different items | Brief | | |
| D4 | Fallback | Maximise protein within budget and calories; ties go to lower cost | Brief; the tie rule is build | | |
| D5 | Items without a price | Ignored and listed | Brief | | |
| D6 | Price of ₹0 | Treated as "no price" | Build | Allow free items | An empty box and 0 are hard to tell apart. **Consequence:** prepaid mess food cannot be entered as free. Say if you want that. |
| D7 | Items with 0 g protein | Never chosen | Build | | They can only add cost and calories. |
| D8 | Calories remaining | Effective goal − logged, where effective goal = max(goal, floor) | Brief | | |
| D9 | Calories used up | Solver does not run | Brief | | |
| D10 | Gap box | Shows goal − logged until you type; clearing it returns to automatic | Build | | |
| D11 | Budget | Remembered between uses | Brief | | |
| D12 | "Log this combo" | One food entry per item, e.g. "2 × 2 Boiled Eggs" | Build | One entry per serving | A shorter food list. |
| D13 | Canteen pre-fill | The tracker's 10 quick foods, prices empty | Brief | | No invented prices outside demo mode. |
| D14 | Arithmetic | Whole paise; protein and calories in thousandths | Build | Floating point | Exact ties. |
| D15 | Search safety limit | 2,000,000 nodes, then the answer is marked "not proven cheapest" | Added | No limit | Protects the phone if someone enters a huge catalog. Largest search in validation: under 100 nodes. |

**Imroz's decision on section D:** 

---

## E. Safety, data and app behaviour

| # | Setting | Value | Source | Why |
|---|---|---|---|---|
| E1 | "Logged day" for intake | At least 2 foods | Brief | One snack is not a day's intake. |
| E2 | Low-intake flag | 3 logged days in a row under the floor | Brief | |
| E3 | Today excluded from the flag | Yes | Build | The day may not be finished; counting it would flag you every morning. |
| E4 | "In a row" | Logged days at most 3 calendar days apart; looks back 30 days | Build | Days logged weeks apart are not a run. |
| E5 | Import | Validate → confirm → keep one undo copy | Brief | |
| E6 | Empty backup file | Refused | Build | It would erase the logbook. |
| E7 | No room for the undo copy | Import is cancelled | Build | Never overwrite without a safety net. |
| E8 | Import in demo mode | Blocked; demo exports are refused as real imports | Build | Keeps demo and real data apart. |
| E9 | Backup reminder | After 7 days, or if never backed up | Brief | Safari may clear unused site data. |
| E10 | "Last backup" time | Set when the download starts | Build | The browser cannot tell us whether you kept the file. |
| E11 | Export file name | `spotter-backup-YYYY-MM-DD.json` | Build | Was `ppl-mobile-backup-…`. Old files still import. |
| E12 | Failed save | Red warning in the header | Added | The tracker's `SafeStore` fails silently. |
| E13 | Demo data | Rebuilt each time demo mode is turned on, and each new day | Build | Always lines up with "today". |
| E14 | Demo history is well fed | No low-intake note in demo by default | Build | MANUAL_TESTS explains how to trigger the note. |
| E15 | Service worker | Cache-first for scripts; raise `VERSION` in `sw.js` on every deploy | Brief / Build | Otherwise phones keep old scripts. |
| E16 | Header | A small "SPOTTER · Your logbook is the wearable." line above the date | Build | The brief asks for the name in the header. Costs about 20 px of height. |
| E17 | Spotter tab icon | 🤝 emoji | Build | Matches the other emoji tabs. |

**Imroz's decision on section E:** 

---

## F. Proposals not built (your call)

| # | Proposal | Why it was not done |
|---|---|---|
| F1 | A stable id per exercise, so renames keep their history | Changes the data model; the brief says not to rename or restructure existing fields. |
| F2 | A confirm step before changing a day's split (it discards that day's logged sets) | Existing behaviour; outside scope. |
| F3 | Allow pinch-zoom (the viewport tag disables it) | Accessibility improvement, but it changes how the existing app feels. |
| F4 | An Apply button for the 80% ramp-back week | The brief says "suggest". |
| F5 | Playwright smoke test | Playwright is not installed; the brief says not to install heavy tooling without asking. |
| F6 | Guard against corrupt stored JSON at start-up | If the stored log ever fails to parse, the tracker starts empty and the next save overwrites it. This is in the original code. A fix would refuse to save and ask for a backup restore. |

**Imroz's decision on section F:** 
