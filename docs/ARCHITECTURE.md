# Spotter architecture

Spotter is a layer on top of an existing workout and food tracker. The tracker records what you did. Spotter reads that record and gives three kinds of guidance, each with its reason.

## What the "AI" is, exactly

Three small models, all running in the browser on the phone:

| Act | Method | What it learns from |
|---|---|---|
| I. Readiness From Your Lifts | **Regression**: a least-squares line through your recent estimated one-rep maxes | Your own last 4–8 sessions of that lift |
| II. Exam-Week Autopilot | **Time series**: weekly session load compared with its own 4-week average, plus calendar rules | Your session RPE, minutes, sleep and exam dates |
| III. Protein on a Hostel Budget | **Integer linear programming**: an exact search for the cheapest whole-serving combination | Today's food log, your goals, your canteen's prices |

The explanations ("Why?") are fixed sentence templates filled in with the numbers. 

It is **not** a language model, **not** a neural network, and **not** deep learning. Nothing is trained in advance and nothing is sent anywhere. "Learning" here means the numbers come from your own log and change as the log grows.

## Pipeline

```
Your logbook                      On-device AI                         Your spotter
(never leaves your phone)                                              (explains every call)

sets: weight, reps, RPE   ──►  e1RM per set ─► first working set ─►  "Go for a PR" /
                               ─► line through past sessions (OLS)    "Normal day" /
                               ─► z-score of today vs the line        "Drop a set"            + Why?

session RPE, minutes      ──►  daily load = RPE × minutes
sleep hours                    ─► this week vs 4-week average         Autopilot card:
exam dates                     ─► exam week / ramp-back rules     ─►  maintenance mode,       + Why?
                               ─► sleep average                       ramp back, load flag

foods logged, goals       ──►  protein gap, calories remaining
canteen items + prices         ─► integer programme               ─►  cheapest combo          + Why?
budget                            (branch and bound)                  or "most you can get"

                               calorie floor, low-intake check    ─►  gentle notes            + Why?
```

Inputs come from `localStorage`. Decisions come from pure functions in `src/spotter-core.js`. The UI in `src/spotter-ui.js` only draws what those functions return.

## File map

| File | Role |
|---|---|
| `index.html` | The tracker (Imroz's original app) with small edits marked `SPOTTER HOOK` that call into the modules below. |
| `src/spotter-config.js` | Every threshold and default in one object, each with a comment. |
| `src/spotter-core.js` | All logic. Pure functions: no DOM, no storage access of its own, no clock. Loads in the browser as `SpotterCore` and in Node via `require`. |
| `src/spotter-demo.js` | Generator for the made-up demo history. Kept apart from real logic on purpose. |
| `src/spotter-ui.js` | Rendering and events for the new UI. Escapes all user text. |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline use and Home Screen install. |
| `tests/*.test.js` | Unit tests (Node's built-in runner, no dependencies). |
| `tests/bruteforce.js` | Independent brute-force solver, used only to check the real one. |
| `tests/validate.js` | Writes `docs/VALIDATION.md`. |
| `tools/` | One-off scripts that generated the icons and one test fixture. |

Script load order in `index.html`: config → core → demo → the tracker's own script → UI. All are plain script tags with relative paths, so the app also runs from `file://`.

## Data model

### Unchanged (the tracker's own data)

- `localStorage["lakshay_ppl_tracker_v1"]`: `{ "YYYY-MM-DD": day }`
- `localStorage["lakshay_macro_goals_v1"]`: `{ cal, pro, carb, fat }`
- `day`: `{ split, durationMinutes, bodyweight, waterMl, supplements[], foods[], notes, exercises[] }`
- `exercise`: `{ muscle, name, targetReps, targetRpe, sets[] }`
- `set`: `{ type, weight, reps, rpe, done }` where weight, reps and rpe are strings and type is N, W, D or F.

### Added (all optional; old data works without them)

| Where | Field | Meaning |
|---|---|---|
| day | `sessionRpe` | `null` or 1–10: how hard the whole session felt |
| day | `sleepHours` | `null` or 0–14 in steps of 0.5: last night's sleep |
| day | `spotter.maintenance` | What maintenance mode removed or changed, so it can be undone |
| set | `rpeConfirmed` | `true` if you typed or confirmed the RPE; `false` if pre-filled; missing on sets logged before Spotter |
| set | `repsAutoFilled` | `true` if the tracker filled the reps from the target range when you ticked the set |

### New storage keys

| Key | Content |
|---|---|
| `spotter_schemaVersion` | `1` |
| `spotter_settings` | `{ calorieFloor, lastBudget, lastBackupAt }` |
| `spotter_exams` | `[{ label, date }]` |
| `spotter_canteen` | `[{ id, name, cal, pro, carb, fat, price, maxServings, available }]` |
| `spotter_preimport_snapshot` | One undo copy taken just before a backup is restored |
| `spotter_demo_active` | `"1"` while demo mode is on |
| `spotter_demo_logs`, `_goals`, `_exams`, `_canteen`, `_settings` | Demo data, kept apart from everything above |

Every read and write goes through one object (`makeStorage` in the core). It chooses the real keys or the demo keys. While demo mode is on, no real key is written. A unit test records every write to prove it.

### Backup file

```json
{ "workoutLogs": { ... }, "macroGoals": { ... },
  "spotter": { "canteen": [...], "exams": [...], "settings": { ... } },
  "schemaVersion": 1, "app": "Spotter", "exportedAt": "..." }
```

`workoutLogs` and `macroGoals` keep the names the original tracker used, so its old importer can still read a new file, and Spotter can read old files.

### Dates

Day keys are local dates, `"YYYY-MM-DD"`. All day arithmetic parses the key as UTC midnight and works in whole day numbers (`keyToDayNum`, `dayNumToKey`). Timezones and daylight-saving changes cannot shift a date. The core never reads the clock; the selected date is passed in, and only earlier dates count as history.

---

## ACT I: Readiness From Your Lifts (regression)

**Step 1. Estimated one-rep max for a set**

```
RIR  = 10 − RPE                         (reps in reserve)
e1RM = weight × (1 + (reps + RIR) / 30)
```

If `reps + RIR = 1` (a true single at RPE 10), e1RM is the weight itself. At RPE 10 this is plain Epley, the formula the tracker already used.

Example: 80 kg × 6 at RPE 8.5 → RIR 1.5 → 80 × (1 + 7.5 / 30) = **100.0 kg**.

**Step 2. Which set counts**

A set is eligible if it is ticked, of type N or F (not warm-up or drop set), has weight above 0, 1–12 reps and RPE 6–10. The **first working set** is the first eligible set of that exercise on a day. Today and history both use first working sets, so fresh sets are compared with fresh sets.

**Step 3. History**

Same exercise name (trimmed, lower-cased, single spaces), dates before the selected date, within 90 days, the 8 most recent sessions. Fewer than 4 → no verdict: "Building your trend: X of 4 sessions logged".

**Step 4. The trend**

An ordinary least-squares line `y = a + b·x`, where `x` is days since the earliest session used and `y` is that session's first-working-set e1RM. Before fitting, at most one past session is set aside if it sits more than 4 typical swings away from the line through the *other* sessions (needs at least 5 sessions). This is what stops one freak day bending the trend.

**Step 5. The call**

```
predicted = a + b · x_today
s         = residual standard deviation of the fit (n − 2 degrees of freedom),
            but never less than 1.5% of predicted
z         = (today's e1RM − predicted) / s

z ≥ +1  → "Go for a PR"
z ≤ −1  → "Drop a set, keep the weight"
else    → "Normal day"
```

In words: more than one typical day-to-day swing above or below your own trend.

**Worked example** (from the validation report, "Rising trend, only repeats last week")

Six weekly sessions of 5 reps at RPE 8 with 90, 92.5, 95, 97.5, 100 and 102.5 kg. Each e1RM is weight × (1 + 7/30) = weight × 1.2333:

| Week | Weight | e1RM |
|---|---|---|
| 1 | 90 | 111.00 |
| 2 | 92.5 | 114.08 |
| 3 | 95 | 117.17 |
| 4 | 97.5 | 120.25 |
| 5 | 100 | 123.33 |
| 6 | 102.5 | 126.42 |

The line rises 3.08 kg per week, so the prediction for today (week 7) is **129.50 kg**. The history is perfectly smooth, so the typical swing is the 1.5% minimum: 0.015 × 129.5 = **1.94 kg**.

Today: 102.5 kg × 5 at RPE 8 again → e1RM 126.42 kg.

z = (126.42 − 129.50) / 1.94 = **−1.59** → "Drop a set, keep the weight".

The point: matching last week looks fine against one past session, but it is below where your trend says you should be. Spotter judges against the trend.

**Confidence.** If today's RPE was pre-filled (never typed), the verdict is still shown but labelled low confidence, with a one-tap confirm. "Why?" always shows how many sessions were used and how many of them had a typed RPE.

---

## ACT II: Exam-Week Autopilot (time series)

**Load**

```
daily load   = session RPE × minutes          (only when both are logged)
acute        = sum of daily loads over the 7 days ending on the selected date
chronic      = mean weekly load over the 4 weeks before that (days −34 to −7),
               counting only weeks that have at least one logged load
ratio        = acute / chronic
```

Fewer than 2 baseline weeks with data → "Not enough history yet". This week is never part of its own baseline.

| Ratio | Band |
|---|---|
| below 0.8 | Lighter than usual |
| 0.8 to 1.3 | In your normal range |
| above 1.3, up to 1.5 | Load is climbing fast |
| above 1.5 | Big spike vs your usual |

These are flags. They are not injury predictions.

**Calendar**

- Exam week: an exam on the selected date or in the next 6 days.
- Ramp-back week: the last exam was 1–7 days ago and no exam falls in the next 7 days.

**Sleep**: the average of the last 3 nights that have an entry, looking back at most 7 days.

**Suggestion**

| Situation | Suggestion |
|---|---|
| Exam week | Maintenance mode |
| Exam week and (ratio above 1.3 **or** sleep average under 6.5 h) | Maintenance mode, stronger wording |
| Ramp-back week | About 80% of usual sets |
| No exam, ratio above 1.3 | A load flag |

**Maintenance mode** keeps the weights, keeps `ceil(60%)` of each exercise's planned sets (at least 1), caps RPE at 8 and turns failure sets into normal sets. It only touches sets you have not completed. Everything it removes or changes is stored on the day, and Undo puts it back.

**Worked example** (`tests/fixtures/load-5-weeks.json`, selected date 1 March 2026)

| Week | Sessions (RPE × min) | Weekly load |
|---|---|---|
| −4 (26 Jan – 1 Feb) | 6×60 + 7×50 + 6×45 | 980 |
| −3 (2 – 8 Feb) | 7×60 + 7×60 + 8×40 | 1160 |
| −2 (9 – 15 Feb) | nothing complete logged | missing |
| −1 (16 – 22 Feb) | 6×70 + 8×55 + 7×60 | 1280 |
| this week (23 Feb – 1 Mar) | 8×60 + 9×70 + 8×50 + 7×30 | **1720** |

Chronic = (980 + 1160 + 1280) / 3 = **1140**. Week −2 is left out, not counted as zero.

Ratio = 1720 / 1140 = **1.51** → "Big spike vs your usual". With an exam 2 days away, the card reads "Maintenance mode in exam week", in the stronger wording.

---

## ACT III: Protein on a Hostel Budget (integer linear programming)

**Model**

```
x_i = whole servings of item i,   0 ≤ x_i ≤ maxServings_i
      (only items that are available and have a price)

minimise    Σ price_i · x_i
subject to  Σ protein_i  · x_i ≥ gap
            Σ calories_i · x_i ≤ calories remaining
            Σ price_i    · x_i ≤ budget

ties on cost → fewer calories → fewer different items
```

- gap = protein goal − protein logged today (never below 0; you can type another value).
- calories remaining = effective calorie goal − calories logged, where the effective goal is your goal or the calorie floor, whichever is higher. If nothing remains, the solver does not run.

**Method: branch and bound.** The search decides the servings of one item at a time. At each point it asks: "if I could buy fractions of the remaining items, what is the least the missing protein could cost?" That question is the linear-programming relaxation of what is left (with the calorie limit dropped), and with a single covering constraint it is answered exactly by taking items in order of price per gram of protein. If even that fractional cost cannot beat the best whole-serving answer found so far, the branch is cut. Equal-cost branches are kept so the tie-breaks can be applied. The result is exact, not approximate.

All arithmetic is in whole numbers (paise, and thousandths of a gram and of a kcal), so two combinations that cost the same are recognised as equal.

**If nothing fits:** a second exact search maximises protein within budget and calories, and Spotter says "With ₹X and Y kcal left, the most you can get is Z g of your W g gap."

**Checked against brute force:** a separate program tries every combination. On 600 random canteens the two agree on cost, on both tie-breaks and on the fallback every time, with no constraint broken. See `VALIDATION.md`, section 4.

**Worked example** (SAMPLE prices from `tests/fixtures/sample-prices.json`; not real canteen prices)

Gap 40 g, budget ₹60, 1090 kcal remaining.

| Item | Protein | kcal | SAMPLE price | Max |
|---|---|---|---|---|
| Soya Chunks (50g) | 26 g | 172 | ₹12 | 1 |
| 2 Boiled Eggs | 12 g | 140 | ₹14 | 3 |
| 4 Egg Whites | 14 g | 68 | ₹30 | 3 |
| Paneer (100g) | 18 g | 265 | ₹40 | 2 |
| … | | | | |

Soya is the cheapest protein (₹0.46 per gram) but only one serving is allowed: 26 g for ₹12. The remaining 14 g is cheapest from eggs (₹1.17 per gram): one serving gives 12 g, not enough, so two.

Answer: **1 × Soya Chunks + 2 × 2 Boiled Eggs = ₹40, 50 g protein, 452 kcal.** The nearest alternative, soya + egg whites, reaches exactly 40 g but costs ₹42.

---

## Safety layer

- **Calorie floor** (default 1500 kcal/day, changeable between 1200 and 4000). If your calorie goal is below it, Spotter warns in the targets sheet and plans against the floor.
- **Low-intake note.** If 3 or more logged days in a row before the selected date total under the floor, a calm note appears. A day counts as logged only with 2 or more foods; other days are unknown, not zero.
- Spotter's food feature only ever suggests *adding* food, and never when calories are used up.
- Every output has a "Why?" with its inputs, formula and reason, and the line "Wellness guidance, not medical advice."

## Offline and privacy

There are no network calls in the app. The service worker caches the app's own files so it opens without a connection, and it ignores any request that is not to the app's own address. Data stays in the browser's storage on the device; the only way it leaves is a backup file you download yourself.
