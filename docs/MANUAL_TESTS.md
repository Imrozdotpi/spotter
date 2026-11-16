# Manual test checklist (iPhone)

Run these on the iPhone in Safari once Spotter is hosted. Tick each box. Where a step says "Expected", stop if you see something else and note it.

`SITE` below means the address you host Spotter at.

---

## 0. Before anything: protect your real logbook

- [ ] Open your **current** tracker (the old address) in Safari.
- [ ] Go to **PRs & Vol → Download backup**. Confirm the file is saved in the Files app.
- [ ] Send a copy of that file somewhere safe (your laptop or email to yourself).

Do not skip this. Spotter at a new address starts empty; this file is how your history gets there.

## 1. First load

- [ ] Open `SITE` in Safari. Expected: the header shows **Spotter** and "Your logbook is the wearable." and five tabs at the bottom: Workout, Calories, Tools, PRs & Vol, Spotter.
- [ ] Expected: no red warning bar at the top.
- [ ] If Spotter is at the **same** address as the old tracker: your existing workouts are there. If it is at a **new** address: it is empty. Both are correct.

## 2. Bring your data across (only if it opened empty)

- [ ] Spotter tab → Backup and restore → **Restore file** → choose the backup from step 0.
- [ ] Expected: a sheet titled "Restore this backup?" showing the number of days and the first and last dates. Check they look right.
- [ ] Tap **Replace my data**. Expected: "Backup restored".
- [ ] Open the calendar and tap a few old dates. Expected: sets, weights, foods and notes are all there.
- [ ] PRs & Vol tab. Expected: your PR list is back.
- [ ] Spotter tab → Backup. Expected: an **Undo last import** button exists. (Do not tap it.)

## 3. Install to the Home Screen and go offline

- [ ] In Safari: Share → **Add to Home Screen**. Expected: the icon is a green barbell on near-black, named "Spotter".
- [ ] Open Spotter from the Home Screen. **Check whether your data is there.** If it is empty, restore the backup again here (step 2). From now on, use only the Home Screen app.
- [ ] Close the app. Turn on **Aeroplane Mode** (Wi-Fi off too).
- [ ] Open Spotter from the Home Screen. Expected: it opens and works normally.
- [ ] Log a set, close the app fully, reopen. Expected: the set is still there.
- [ ] Turn Aeroplane Mode off.

## 4. Old features still work

- [ ] **Splits:** tap Pull 1, then back to the original split (on an empty test date, since changing split resets that day's exercises).
- [ ] **Calendar:** open it, change month, pick a date, Jump to Today.
- [ ] **Ghost bar:** an exercise you have done before shows "Last best". **Copy weights** fills the sets.
- [ ] **Sets:** type weight, reps, PE; tick; the rest timer starts at 01:30; add a set; delete a set; cycle the type N → W → D → F.
- [ ] **Add Exercise** and **Remove** work.
- [ ] **Timers:** session stopwatch start/pause, Log Session Mins, Reset, the four rest buttons.
- [ ] **Plate calculator:** 100 kg → "Per Side: 1 × 25kg + 1 × 15kg".
- [ ] **1RM tool:** 80 kg × 8 → Epley 101.3 kg. With RPE 8 the second line reads **RPE-adjusted e1RM: 106.7 kg**. With RPE 10 both lines read 101.3.
- [ ] **Macros:** tap a quick food, add a custom food, remove one, change targets.
- [ ] **Water** +250 / +500 / −250, and the **supplement** buttons toggle.
- [ ] **PRs & Vol:** weekly sets per muscle and the PR list show.
- [ ] **Download backup** saves a file named `spotter-backup-…json`. Check it appears in Files. *(This download method was changed; make sure it works both in Safari and in the Home Screen app.)*

## 5. Demo mode

- [ ] Spotter tab → **Turn demo mode on**. Expected: an amber **Demo data. Not your real logbook.** bar on every tab.
- [ ] Workout tab. Expected: an "Exam-Week Autopilot" card at the top, six weeks of history in the calendar.
- [ ] Spotter tab → **Turn demo mode off**. Expected: the amber bar is gone and **your own data is exactly as you left it**. Check a date you know.

## 6. ACT I: readiness (in demo mode)

- [ ] Turn demo mode on. Workout tab, first exercise. Expected: a green chip **Go for a PR · 8 sessions · Why?** with a green dot (the session count can differ).
- [ ] Tick the first set of the second exercise. Expected: amber **Normal day**.
- [ ] Tick the first set of the third exercise. Expected: red **Drop a set**.
- [ ] Tap a chip. Expected: a sheet with today's set, today's e1RM, predicted e1RM, difference in %, sessions used, the formula, and the list of sessions in the trend.
- [ ] Tick the first set of a later exercise. Expected: a chip plus a yellow note beginning **"Low confidence: RPE was pre-filled at …"** and a button **"Yes, it felt like RPE …"**. Tap it. Expected: the note disappears.
- [ ] On a ticked set, change the PE box. Expected: the chip updates and the keyboard stays open.
- [ ] Change a ticked set to type W. Expected: the chip moves to the next working set or disappears.
- [ ] An exercise with 12–15 target reps, ticked with 13+ reps. Expected: grey **No readable set yet · Why?**, and the sheet says "reps outside 1–12".

## 7. ACT II: autopilot (in demo mode)

- [ ] The Autopilot card shows: the exam countdown ("… in 2 days"), load this week vs average, a ratio near 1.4 with "Load is climbing fast", sleep average near 5.8 h, and "A warning flag, not an injury predictor."
- [ ] Tap **Why?** Expected: the numbers, the formula "load = session RPE × minutes", and how today's sets would change.
- [ ] Note how many sets the first three exercises have. Tap **Apply maintenance mode**. Expected: 3-set exercises drop to 2; the set you already ticked is unchanged; PE values above 8 on unticked sets become 8.
- [ ] Tap **Undo maintenance mode**. Expected: every set is back exactly as before.
- [ ] Scroll to Session Details. Expected: a row of chips 1–10 under "Session RPE". Tap **8**, type **60** minutes. Expected: "Today's load = 8 × 60 min = 480".
- [ ] Type **7.5** in "Sleep last night". Change date and come back. Expected: 7.5 is still there.
- [ ] PRs & Vol tab. Expected: a "Weekly Training Load" chart with 6 bars, the last outlined and labelled "this week", exam weeks in amber.
- [ ] Spotter tab → Exam dates: add an exam, see it listed, remove it.

## 8. ACT III: protein on a budget (in demo mode)

- [ ] Calories tab. Expected: the card shows gap **40**, budget **60**, calories left **1090**.
- [ ] Tap **Find cheapest combo**. Expected: "Cheapest combo that closes your 40 g gap: ₹40." with 2 × 2 Boiled Eggs and 1 × Soya Chunks. *(These are SAMPLE prices.)*
- [ ] Tap **Why?** Expected: the model in words, the inputs and the result.
- [ ] Change budget to **20**. Tap Find again. Expected: "With ₹20 and 1090 kcal left, the most you can get is 26 g of your 40 g gap."
- [ ] Set budget back to 60, Find, then **Log this combo**. Expected: the foods appear in "Logged foods" and the protein total rises by 50 g.
- [ ] Spotter tab → Canteen catalog: change a price, tap **Edit** on an item and change its max servings, add a new item, delete it (two taps).

## 9. Safety (in demo mode)

- [ ] Calories tab → Targets → set Calories to **1300**. Expected: a yellow note that the goal is under the 1500 kcal floor. Cancel.
- [ ] Pick three past dates in a row. On each, remove foods until only two small ones remain (well under 1500 kcal in total). Return to today. Expected: an "A gentle note" card with a blue dot at the top of the Calories tab. Tap **Why?**
- [ ] Spotter tab → Safety and budget: type **900** as the floor. Expected: it changes to 1200.
- [ ] Turn demo mode off.

## 10. With your real data

- [ ] Spotter tab → Canteen catalog: enter real prices from your canteen. Items left empty show "needs price".
- [ ] Spotter tab → add your real exam dates.
- [ ] For a lift you have logged at least 4 times in the last 90 days: tick today's first working set. Expected: a verdict chip, probably with a "Low confidence" note because old RPEs were pre-filled.
- [ ] For a lift with fewer sessions. Expected: "Building your trend: X of 4 sessions logged".
- [ ] After a week or two of logging session RPE and minutes, the load ratio appears. Before that, expected: "Not enough history yet".

## 11. Backup round trip

- [ ] Download backup. Expected: Spotter tab shows "Last backup: today".
- [ ] Add a test food. Restore the backup you just downloaded. Expected: the test food is gone.
- [ ] Tap **Undo last import**. Expected: the test food is back. Remove it.
- [ ] Try restoring a file that is not a backup (any other `.json`). Expected: "Backup not imported … Nothing was changed."

## 12. A week later

- [ ] Open the app after 7 days. Expected: your data is still there, and a gentle backup reminder shows if you have not downloaded one since.

---

**If something fails:** note the step number, what you expected and what you saw. Do not clear Safari's website data to "fix" it; that deletes the logbook.
