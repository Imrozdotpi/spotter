# Spotter

**Your logbook is the wearable.** AI training insights for students, from the workout log they already keep. No band. No subscription. ₹0.

Spotter is an on-device layer on top of a workout and nutrition tracker. The tracker records sets, reps, RPE, minutes, bodyweight, food, water and supplements. Spotter reads that log and adds three things:

| | Feature | Method |
|---|---|---|
| ACT I | **Readiness From Your Lifts.** Compares today's first working set with your own trend: "Go for a PR", "Normal day" or "Drop a set, keep the weight". | Regression |
| ACT II | **Exam-Week Autopilot.** Weighs your training load against your exam calendar and sleep, and suggests maintenance mode in exam week. | Time series |
| ACT III | **Protein on a Hostel Budget.** Finds the cheapest whole-serving mix of canteen foods that closes your protein gap. | Integer linear programming |

Every output has a "Why?" that shows its inputs, formula and reason. Everything runs in the browser on the phone. There is no server, no account, no analytics, no API key and no language model. The logbook never leaves the device.

Wellness guidance, not medical advice.

Entry for AI-INNOVEX 2026, category "AI TechTrailblazer: Best Technical Implementation". Author: Imroz Kamboj.

## Run it locally

No build step and nothing to install.

- **Simplest:** open `index.html` in a browser. Everything works except offline caching (service workers need http or https).
- **With offline support:** serve the folder with any static file server and open the address it prints, for example:

  ```bash
  python -m http.server 8000
  ```

To see all three features without weeks of logging: open the app with `?demo=present` on the end of the address (a month of generated history with no demo labels, for screen recordings; `?demo=off` goes back; `?demo=labelled` brings the amber "Demo data" bar back), or **Spotter tab → Turn demo mode on.** Demo data is generated, stored separately from real data, and should always be described as synthetic. `docs/DEMO_SCRIPT.md` has a recording script.

## Test it

Needs Node 20 or newer. No npm packages.

```bash
npm test
```

```bash
npm run validate
```

- `npm test` runs 112 unit tests (`tests/*.test.js`).
- `npm run validate` checks the formulas against reference data, compares the solver with an independent brute force on 600 cases, and rewrites `docs/VALIDATION.md`.

There is no Playwright smoke test: Playwright was not installed on the build machine and was not added. On-device checks are in `docs/MANUAL_TESTS.md`.

## Project structure

```
index.html               the app (original tracker + edits marked "SPOTTER HOOK")
src/
  spotter-config.js      every threshold and default, one comment each
  spotter-core.js        all logic as pure functions (no DOM, no clock)
  spotter-demo.js        generator for the made-up demo history
  spotter-ui.js          rendering and events for the new UI
sw.js                    service worker (offline)
manifest.webmanifest     install-to-Home-Screen metadata
icons/                   app icon (SVG + PNG 192, 512, 180)
tests/
  *.test.js              unit tests
  bruteforce.js          independent brute-force solver (tests only)
  validate.js            writes docs/VALIDATION.md
  fixtures/              reference chart, hand-computed load example, legacy backup, SAMPLE prices
tools/                   one-off scripts (icon and fixture generators)
docs/
  PROMPT.md              the build brief, verbatim
  PLAN.md                the plan written before building
  ARCHITECTURE.md        pipeline, data model, the three methods with worked examples
  DECISIONS.md           every default and threshold, with a line for Imroz's decision
  LIMITATIONS.md         what Spotter cannot do; responsible-use notes
  VALIDATION.md          generated test report
  MANUAL_TESTS.md        step-by-step checklist for the iPhone
  BUILD_LOG.md           what was built when, and what was AI-generated
  DESIGN.md              why the interface was restyled, with sources
  DEMO_SCRIPT.md         how to run the demo, the seed data, and a 2-minute recording script
```

## Your data

- Stored in the browser's `localStorage` on your device, under the tracker's original keys plus keys starting with `spotter_`.
- **Back it up.** Spotter tab → Backup and restore → Download backup. The file is the only copy outside the phone. It contains your personal log in plain text.
- Browser storage belongs to one web address. If you open Spotter at a different address than your old tracker, it starts empty: download a backup from the old one and restore it in the new one.
- On iPhone, add the app to the Home Screen. Safari can clear the data of sites that are not used for about a week.

## Deploying (done by Imroz)

Nothing in this repository deploys anything. There is no `.github` folder, no workflow, no remote and no hosting configuration. To put it on GitHub Pages you will need to do the following yourself:

1. **Back up first.** On your phone, open the current tracker and download a backup.
2. Create a GitHub repository and push this folder to it (`git remote add origin …`, `git push`).
3. In the repository: Settings → Pages → deploy from the `main` branch, root folder.
4. Open the Pages address on your phone. `index.html` is at the root and every path is relative, so a project address such as `https://<user>.github.io/<repo>/` works without changes.
5. If the address is different from the one you use today, the app opens empty. Restore your backup (Spotter tab → Restore file).
6. Add to Home Screen. Check that your data is there too; if not, restore the backup again inside the Home Screen app.
7. Work through `docs/MANUAL_TESTS.md`.

**Every time you change a file and redeploy:** just push. The service worker fetches every file from the network first and only uses its saved copy when you are offline, so an update appears on the next normal reload (a phone that still runs the older worker may need one extra reload). Raising `VERSION` in `sw.js` is optional now; it only clears old saved copies.

Before the repository goes public, check that no personal backup file is in it. `.gitignore` already excludes `my-backup.json` and `*-backup-*.json`.

## Honest by design

- RPE is subjective, so Spotter trusts your trend over any single day.
- Load spikes are flags, not injury predictions.
- Spotter never suggests eating below a safe calorie floor, and gently flags several logged days under it.
- What it cannot do is written down in `docs/LIMITATIONS.md`.

## Credits

The tracker (`index.html` before the `SPOTTER HOOK` edits), the idea, the poster and the build brief are Imroz Kamboj's. The Spotter modules, tests and documents were written by an AI assistant (Claude) working from that brief; `docs/BUILD_LOG.md` lists exactly what. No third-party code is included.
