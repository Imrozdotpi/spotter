# Limitations and responsible use

Spotter gives wellness guidance from a personal training log. It is not medical advice, it does not diagnose anything, and it cannot predict injury. This page lists what it cannot do and where it can be wrong.

## 1. The inputs are subjective and often incomplete

- **RPE is a feeling.** Two people, or the same person on two days, can rate the same effort differently. That is why Spotter compares today with your own trend and not with a table, and why one odd past session is set aside rather than trusted.
- **Much of the stored RPE was never typed.** The tracker pre-fills RPE on every new set (from the target, the previous set, or a copied session). Spotter marks whether an RPE was typed or confirmed, labels unconfirmed verdicts "low confidence", and shows how many past sessions had a typed RPE. On data logged before Spotter there is no way to know, so those sets are treated as unknown. **A trend built mostly on pre-filled RPE is really a trend of weight and reps at an assumed effort.**
- **Reps can be auto-filled too.** Ticking a set with empty reps fills in the low end of the target range. Spotter flags this.
- **Session RPE, minutes and sleep are optional.** If you do not log them, Act II has nothing to work with and says so.

## 2. The formulas come from other people's data

- **Epley's formula and the RTS RPE chart were built from trained lifters**, mostly on barbell lifts. They may fit beginners, lighter or heavier lifters, women, older lifters, or machine and isolation exercises less well. Spotter has not been validated on any group; it has only been checked against the chart (see `VALIDATION.md`, section 1).
- **Against that chart, the formula is closest at 4–6 reps** (about 0.4 points of error) and drifts at 1–3 reps and at 7–10 reps, up to 5 points for 10 reps at RPE 6.5. The chart stops at 10 reps, so the 11–12 rep range Spotter accepts is not validated at all.
- **Why this matters less than it sounds, and when it still matters:** Spotter compares your e1RM with your own earlier e1RMs from the same formula, so a constant bias cancels out. A bias that changes with rep count does not. If you normally do 5 reps and today do 10, the comparison is less fair.
- **Bodyweight exercises (pull-ups, dips).** Spotter only sees the weight you type, which for these lifts is the added load. The e1RM it shows is therefore the estimate for the added weight (for example 14.8 kg for 10 kg × 12), not for body weight plus load. The trend and the verdict stay consistent from session to session, but the kilogram figure is not a real max, and a set with no added weight (empty or 0) is not used at all. Found while preparing the demo; not yet handled in the app.
- A straight line is a simple model of strength. Real progress has plateaus, deloads and breaks. After a layoff the "trend" still points where it pointed before.

## 3. Small personal datasets are noisy

- A verdict can rest on as few as 4 sessions. With so few points, the line and the "typical swing" are rough estimates, and a verdict near a threshold could go either way. The number of sessions used is always shown.
- With exactly 4 sessions, no odd session can be set aside (there would be too few left).
- The thresholds (±1 swing, 4 swings for an odd session, 1.5% minimum swing) are reasonable defaults chosen for this project. They are not tuned on data and have not been tested on real users.

## 4. The load ratio is a flag with mixed evidence

- The acute-to-chronic load ratio comes from team-sport research. Later work has criticised both the method and the claim that it predicts injury, and the "safe" bands (0.8–1.3) are not established for resistance training. From memory, the commonly cited papers are Gabbett (2016) in favour and Impellizzeri and colleagues (2020) against; **I have not verified these references. Check them before citing.**
- Spotter therefore uses the ratio only to say "your week is much heavier than your usual" and words it as a flag. The app says "A warning flag, not an injury predictor" wherever the ratio appears.
- Session RPE × minutes treats a long easy session and a short hard one as similar. It ignores what you actually lifted.
- Weeks with nothing logged are left out of the average. A real week off is therefore also left out, which can make the baseline too high and hide a genuine spike on your return.
- Exam logic is a calendar rule. It knows nothing about how stressful a given exam is for you.

## 5. Food numbers are approximate

- **Nutrition values are averages.** The quick-food list ("2 Boiled Eggs", "Paneer (100g)") uses round figures. Canteen portions vary from day to day and are rarely weighed. Treat the protein total as an estimate.
- **Prices change**, and the result is only as current as the prices you typed. Items without a price are ignored.
- **The model optimises cost for protein and nothing else.** It does not consider taste, variety, fibre, micronutrients, allergies, religious or ethical diets, or what is actually on the counter today. "Cheapest" is not "best". Use the availability switch and max servings to keep it sensible.
- The sample prices used in tests and demo mode are placeholders, not real prices.
- "Calories remaining" depends on everything else being logged.

## 6. The safety features are simple

- The calorie floor is one number for everyone (default 1500 kcal). It is not personalised to your size, sex, age or training, and for an active student the right minimum is probably well above it. It is a tripwire.
- The low-intake note depends on logging. If you eat but do not log, it can appear wrongly. If you log only one food on a day, that day is ignored. It cannot detect or diagnose an eating problem. If food, weight or training are causing you distress, talk to a doctor or a counsellor.
- Spotter does not know about injuries, illness, medication or medical conditions. If something hurts, a green chip does not mean you should lift.

## 7. Privacy and data safety

- **Everything is stored only in this browser on this phone**, in `localStorage`. There is no account, no server and no network request. That is good for privacy and bad for durability.
- **If the phone is lost, reset or the browser data is cleared, the logbook is gone** unless you have a backup file.
- **iOS Safari can clear a site's storage** after about a week without a visit unless the site has been added to the Home Screen. Spotter asks the browser to keep the data (`navigator.storage.persist()`), but the browser may ignore that. The app shows the last backup date and reminds you after 7 days.
- **A Safari tab and the Home Screen app may not share storage.** I am not certain how current iOS versions behave. Take a backup before installing to the Home Screen and restore it there if the app opens empty.
- **Moving to a new web address starts empty**, because browser storage belongs to one address. Move data with a backup file.
- **Backup files contain your personal training, bodyweight, sleep and food log** in plain, unencrypted text. Store and share them accordingly.
- Anyone with your unlocked phone can read the data. There is no PIN.

## 8. Known issues in the underlying tracker

These were found while reading the original code. Details, evidence and status are in `VALIDATION.md`, section 6, and `DECISIONS.md`.

| Issue | Status |
|---|---|
| "Calories burned" uses a made-up formula (minutes × 5.5 + sets × 4) | Not changed. Spotter does not use it. Awaiting Imroz's decision. |
| RPE pre-filled on every set | Tracked with `rpeConfirmed`; shown as low confidence. |
| Reps auto-filled when ticking an empty set | Tracked with `repsAutoFilled`; shown as low confidence. |
| Epley-style estimates weak at very low and high reps | Sets outside 1–12 reps or RPE 6–10 are skipped, with the reason shown. |
| Renaming an exercise starts a new history | Only spacing and capital letters are forgiven. A stable exercise id is proposed, not built. |
| Exercise and food names are inserted into the page without escaping | New Spotter screens escape all text. The three old spots are unchanged; a three-line fix is proposed. Risk is low while the only text is your own typing and your own backup files, but **do not import a backup file from someone you do not trust.** |
| A failed save is silent | Spotter now shows a red warning if a write does not stick. |
| Changing a day's split discards that day's logged sets without asking | Unchanged. A confirm step is proposed. |
| If stored data ever became unreadable, the tracker would start empty and overwrite it on the next save | Unchanged (original behaviour). Backups are the protection. |
| Pinch-zoom is disabled | Unchanged. An accessibility cost. |

## 9. What has and has not been tested

- **Tested:** the logic, with 112 unit tests and a validation report (formula against the RPE chart, readiness scenarios, a hand-computed load example, 600 solver cases against brute force, safety checks). The interface was checked in a desktop browser at iPhone size (393×852).
- **Not tested:** a real iPhone, real Safari storage behaviour, installing to the Home Screen, long-term use, or any person other than the author. No Playwright run (not installed). No user study. The checklist in `MANUAL_TESTS.md` covers what must be checked on the phone.
- **Not claimed:** that following Spotter's suggestions improves strength, prevents injury or improves exam results. Nothing here has been evaluated for outcomes.
