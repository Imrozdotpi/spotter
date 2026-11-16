# Demo and screen-recording guide

Everything here was replayed step by step in a headless browser before it was written down. The numbers below are what appears on screen. The talking points are suggestions: **say only what is true for you.**

## 0. What the handbook asks for

From the AI-Innovex 2026 handbook (Stage 2):

| Requirement | Detail |
|---|---|
| Video | High definition, **strictly 30 seconds to 2 minutes** |
| Must cover | Project intro · the proposed solution from Round 1 · live demo of the working implementation · AI vs human contribution |
| Slides | Official PPT template (sent by email), 6–8 slides: Title, Problem Statement, AI Pipeline, Working Demo Screenshots, Validation, Scalability |
| LinkedIn | Post the video, tag The NorthCap University (NCU), include `#AIInnovex2026 #TheNorthCapUniversity #NCUGurugram #ArtificialIntelligence`, and submit the post link in the Stage 2 form |
| Deadline | **17 November 2026** (video, slides and LinkedIn post) |
| Finale | 19 November 2026, 2:00 PM, Smart Classroom |

## 1. How to run it

**Option A, laptop (simplest).** Open a terminal in the project folder and start a local server:

```bash
python -m http.server 8000
```

Open this address in Chrome or Edge:

```
http://localhost:8000/?demo=reset
```

Press F12, click the device-toolbar icon (or Ctrl+Shift+M), choose a phone size of **393 × 852** (iPhone 14 Pro), and refresh. Record that window.

**Option B, real iPhone, no hosting needed.** Run the same server on the laptop, put the phone on the same Wi-Fi, find the laptop's address with `ipconfig` (the "IPv4 Address", for example 192.168.1.20), and open `http://192.168.1.20:8000/?demo=reset` in Safari. Windows may ask to allow Python through the firewall: allow it on Private networks. (Offline install will not work this way, but the demo does.)

**Option C, hosted.** If you have already deployed to GitHub Pages: `https://<your-username>.github.io/<repo>/?demo=reset`.

**Option D, no server.** Double-click `index.html`. The page opens and demo mode works (checked in Chrome). Offline caching is off, which doesn't matter for a recording. Then use the Spotter tab to turn demo mode on, since `?demo=` needs an address you can edit.

## 2. The fake history (already built in)

You don't need to add anything. **Demo mode** creates a believable six-week history and puts it in a separate storage area, so your real logbook is never touched. It was verified that a real logbook is byte-identical after turning demo on, resetting and turning it off.

**Shortcut links** (add to the end of the address):

| Link ending | Effect |
|---|---|
| `?demo=reset` | Turn demo on and **rebuild it from scratch**. Use this before every take. |
| `?demo=1` | Turn demo on, keep any changes you have made |
| `?demo=off` | Back to real data |

Without the links: Spotter tab → scroll to the bottom → "Turn demo mode on" / "off".

**What is in it** (42 days ending today, all made up, labelled by an amber bar saying "Demo data. Not your real logbook."):

- Push/Pull/Legs sessions with slow, noisy progression (bench from about 70 kg to about 77 kg), two or three missed sessions, session RPE (6–8), session minutes (55–75), sleep (6.5–8 h normally), bodyweight, supplements, water and food every day.
- **Exams:** a past quiz three weeks ago (shows as the amber bar in the chart), **DBMS mid-sem in 2 days**, Operating Systems in 4 days.
- **This week is heavy and the last nights were short**, so Autopilot fires: load 3400 against a 4-week average of 2441 (ratio 1.39, "Load is climbing fast"), sleep average 5.8 h.
- **Today's lifts** are set up so the first three exercises give the three verdicts: a green "Go for a PR" (already ticked), then "Normal day" and "Drop a set" once you tick them.
- **Food today:** 1410 kcal and 120 g protein against a 160 g goal, so you are exactly **40 g short with 1090 kcal left**, the poster's example.
- **Canteen:** your ten quick foods with **SAMPLE prices** (eggs ₹14, soya ₹12, paneer ₹40 …). They are placeholders, not real canteen prices; say "sample prices" on camera.

The data is built around today's date, so the exam countdown and the week charts always line up. Numbers can shift by a few hundredths on other weekdays (the ratio is 1.39–1.41); the verdicts and the 40 g / ₹40 result do not change.

## 3. Before you press record

- [ ] Open `…/?demo=reset`. You should see the amber demo bar and, on Workout, the Autopilot card at the top.
- [ ] Phone: Do Not Disturb on, silent mode on (the rest timer beeps after 90 seconds), brightness up, battery above 50%, portrait lock on.
- [ ] Phone recording: Control Centre → Screen Recording. Long-press it and turn the microphone on if you are speaking live. Laptop: Win+Alt+R (Xbox Game Bar) records the browser window; OBS also works.
- [ ] Rehearse once with a stopwatch. **Aim for 1:45 to 1:55.** The limit is 2:00.
- [ ] For a retake, reload `…/?demo=reset`.

## 4. The recording script (about 1:47)

| Time | Screen | What you do | What to say (edit to your own words) |
|---|---|---|---|
| 0:00–0:10 | **Spotter** tab | Tap Spotter. Show the title and the brief, then scroll slowly to "How it works". | "Fitness bands tell you if you're ready to train, but students can't afford them. Spotter reads the workout log you already keep. Everything runs on the phone." |
| 0:10–0:35 | **Workout** tab, Flat Bench Press | Scroll to the first exercise. Point at the green chip "Go for a PR · 8 sessions". Tap it: the Why? sheet shows today's e1RM 101.5 kg, predicted 97.7 kg, +3.9%, and the formula. Close it. Tick the **first set** of Incline Dumbbell Press (amber "Normal day") and Cable Chest Flyes (red "Drop a set"). | "Act one, readiness. Spotter fits a trend line through my last eight sessions of this lift and compares today's first working set with it. I'm 3.9 percent above my own trend: Go for a PR. The Why panel shows the formula. Next lift: normal day. This one: drop a set, keep the weight." |
| 0:35–1:00 | Scroll to the top of **Workout** | Show the Autopilot card: DBMS in 2 days, load 3400 vs 2441, ratio 1.39, sleep 5.8 h. Tap **Apply maintenance mode**, scroll down to show exercises now have 2 sets instead of 3, scroll back and tap **Undo maintenance mode**. | "Act two, exam-week autopilot. It compares this week's load, session RPE times minutes, with my four-week average, and looks at exams and sleep. DBMS is in two days and I'm sleeping under six hours, so it suggests maintenance mode: same weights, fewer sets, nothing to failure. One tap applies it, one tap undoes it. It's a warning flag, not an injury predictor." |
| 1:00–1:25 | **Calories** tab, scroll to the protein card | Show gap 40 g, budget ₹60, calories left 1090. Tap **Find cheapest combo**: "2 × 2 Boiled Eggs + 1 × Soya Chunks, ₹40, 50 g". Tap **Why?** for three seconds, close it, tap **Log this combo**. | "Act three, protein on a hostel budget. I'm 40 grams short with 60 rupees. This is an integer linear programme, solved exactly: two servings of eggs and one soya, 40 rupees, 50 grams. These are sample prices. One tap logs it." |
| 1:25–1:35 | **PRs & Vol** tab | Scroll to the weekly load chart (amber bar = the exam week three weeks ago, green outlined bar = this week). | "I validated it: the formula against the published RPE chart, 112 unit tests, and the solver matches an independent brute-force search on 600 random cases. Every call has a Why button." |
| 1:35–1:47 | **Spotter** tab, scroll to About | Show "Wellness guidance, not medical advice." | "The idea, the formulas, the thresholds and the decisions are mine. Claude wrote the code and tests from my brief, and what it generated is logged. It's regression, time series and optimisation, not a language model." |

**Why the order:** it follows the poster (Act I, II, III), then validation and the AI-versus-human point the handbook asks for.

### If you run over 2:00

Cut in this order: the Why? sheet in Act III, the chart beat, then the "Next lift" line in Act I.

### Things to avoid on camera

- **Don't tap the split chips** (Push 1, Pull 1 …): that replaces the day's exercises.
- **Don't enter Session RPE** during the take. It changes the live ratio from 1.39 to 1.60 and will confuse the narration. If you want to show that it updates live, do it as a separate short clip.
- Don't open Restore or Backup with real data loaded. In demo mode they are safe, but they add nothing to the story.
- Don't leave the demo bar out of frame. It's honest, and it says the history is synthetic.

## 5. The "AI vs human" part (judges mark this 15 + 10)

Facts from the project record (`docs/BUILD_LOG.md`, `docs/DECISIONS.md`):

| Human (Imroz) | AI (Claude) |
|---|---|
| The idea, the poster, the original tracker | Code in `src/`, the hooks added to the tracker |
| The brief: every formula and threshold, the three methods, the safety rules | Unit tests, validation script, fixtures |
| Decisions: calorie floor, which features, answers to the build questions | Documents (architecture, limitations, decisions, manual tests) |
| Final review and the decisions still open in `DECISIONS.md` | The visual redesign |

State only what you actually did. The documents list open decisions with a blank "Imroz's decision" line: fill those in before the Q&A, and be ready to explain each formula yourself (the worked examples are in `docs/ARCHITECTURE.md`).

## 6. LinkedIn post (draft)

> Introducing Spotter: AI training insights for students, from the workout log they already keep. No band. No subscription.
>
> It runs entirely on the phone and does three things:
> 1. Readiness: compares today's first working set with my own trend (regression)
> 2. Exam-week autopilot: weighs training load against exam dates and sleep, and suggests maintenance mode (time series)
> 3. Protein on a hostel budget: finds the cheapest canteen combo that closes my protein gap (integer linear programming)
>
> Every call comes with a "Why?" panel. Wellness guidance, not medical advice. Load spikes are flags, not injury predictions.
>
> Built for AI-Innovex 2026 at The NorthCap University (NCU). Claude wrote the code and tests from my brief; the design decisions and formulas are mine.
>
> #AIInnovex2026 #TheNorthCapUniversity #NCUGurugram #ArtificialIntelligence

Tag the university's LinkedIn page when you post, and edit the last two lines of the body if they are not accurate for you.

## 7. Slide material

Screenshots already in `docs/screenshots/` (demo mode): `workout.png`, `calories.png`, `spotter-tab.png`, `stats.png`, `tools.png`, `why-readiness.png`, `load-chart.png`.

| Slide | Use |
|---|---|
| Title, Problem Statement | README top section; poster text |
| AI Pipeline | The diagram and the three methods in `docs/ARCHITECTURE.md` |
| Working Demo Screenshots | The files above |
| Validation | 112 tests pass. Solver agrees with brute force on 600 of 600 random cases, 0 constraint violations. Formula vs RPE chart: 1.15 points mean error, against 4.77 for plain Epley. Load example checked by hand. All from `docs/VALIDATION.md` |
| Scalability | Costs ₹0 to run: no server, no accounts, hosted as static files, each user's data stays on their own phone. **Be honest about limits** (`docs/LIMITATIONS.md`): no user study, no outcome data, food and price data are approximate |
