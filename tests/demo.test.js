"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../src/spotter-core.js");
const Demo = require("../src/spotter-demo.js");
const sample = require("./fixtures/sample-prices.json");

// Read the tracker's own templates out of index.html, so the test uses exactly what the app uses.
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
function grab(startMarker, endMarker) {
  const a = html.indexOf(startMarker) + startMarker.length, b = html.indexOf(endMarker);
  return new Function("return (" + html.slice(a, b).trim().replace(/;$/, "") + ");")();
}
const SPLITS = grab("const SPLITS = ", "const STAPLES = ");
const STAPLES = grab("const STAPLES = ", "const SUPPS = ");

const KEY_LOGS = "lakshay_ppl_tracker_v1", KEY_GOALS = "lakshay_macro_goals_v1";
const WEEK = ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]; // Sun..Sat

test("demo data is deterministic: same date and seed give identical data", () => {
  const a = Demo.generate("2026-11-12", SPLITS, STAPLES);
  const b = Demo.generate("2026-11-12", SPLITS, STAPLES);
  assert.deepEqual(a, b);
  assert.notDeepEqual(Demo.generate("2026-11-12", SPLITS, STAPLES, 7).logs, a.logs);
});

test("demo data covers exactly 5 weeks (35 days, about a month) ending on the given day and is labelled", () => {
  const g = Demo.generate("2026-11-12", SPLITS, STAPLES);
  const keys = Object.keys(g.logs).sort();
  assert.equal(keys.length, 35);
  assert.equal(keys[0], C.addDays("2026-11-12", -34));
  assert.equal(keys[34], "2026-11-12");
  assert.equal(g.settings.presentation, false);
  assert.equal(g.demo, true);
  assert.ok(g.exams.every(e => e.label.includes("(demo)")));
  assert.equal(g.settings.demoDate, "2026-11-12");
  assert.equal(C.validateBackup({ workoutLogs: g.logs }, STAPLES).ok, true, "demo logs have a valid shape");
});

test("demo canteen: the fixture's SAMPLE prices first, then extra priced SAMPLE items, and the poster combo is unchanged", () => {
  const g = Demo.generate("2026-11-12", SPLITS, STAPLES);
  assert.equal(sample.sample, true);
  assert.deepEqual(
    g.canteen.slice(0, sample.items.length).map(i => [i.name, i.price, i.maxServings, i.available]),
    sample.items.map(i => [i.name, i.price, i.maxServings, i.available])
  );
  const extras = g.canteen.slice(sample.items.length);
  assert.ok(extras.length >= 4 && extras.every(i => i.price > 0 && i.available && i.pro > 0));
  // the larger menu must not change the answer shown in the slides: 40 g short, Rs 60, 1090 kcal left -> Rs 40, 50 g, 452 kcal
  const res = C.solveCombo(g.canteen, { gap: 40, budget: 60, caloriesRemaining: 1090 });
  assert.equal(res.status, "optimal");
  assert.equal(res.plan.totals.cost, 40);
  assert.equal(res.plan.totals.pro, 50);
  assert.equal(res.plan.totals.cal, 452);
});

for (const date of WEEK) {
  test(`demo shows all three Acts when opened on ${date}`, () => {
    const g = Demo.generate(date, SPLITS, STAPLES);
    const today = g.logs[date];
    assert.equal(today.split, "push1", "the demo day is always Push 1");
    assert.deepEqual(today.exercises.slice(0, 3).map(e => e.name), ["Flat Bench Press", "Incline Dumbbell Press", "Cable Chest Flyes"]);
    // every set arrives prefilled and unticked, so the day is shown by just ticking boxes
    assert.ok(today.exercises.every(e => e.sets.every(x => !x.done && +x.weight > 0 && +x.reps > 0 && +x.rpe >= 6)));

    // ACT II: exam week, load climbing, short sleep -> strong maintenance suggestion
    const a = C.autopilot(g.logs, g.exams, date);
    assert.equal(a.exam.mode, "exam");
    assert.equal(a.exam.next.daysAway, 2);
    assert.ok(a.load.ratio > 1.3 && a.load.ratio < 1.5, "ratio " + a.load.ratio);
    assert.equal(a.load.band.label, "Load is climbing fast");
    assert.ok(a.sleep.avg < 6.5);
    assert.equal(a.kind, "maintenance-strong");

    // ACT I: ticking the first set of the first three lifts gives the three verdicts
    const verdicts = today.exercises.slice(0, 3).map(ex => {
      const copy = JSON.parse(JSON.stringify(ex));
      copy.sets[0].done = true;
      const r = C.readiness(g.logs, date, copy);
      assert.equal(r.status, "verdict", ex.name);
      assert.equal(r.confidence, "normal", ex.name);
      return r.verdict.chip;
    });
    assert.deepEqual(verdicts, ["Go for a PR", "Normal day", "Drop a set"]);

    // ACT III: the poster case
    const info = C.nutritionGap(g.goals, today, g.settings.calorieFloor);
    assert.equal(info.proteinGap, 40);
    assert.equal(info.caloriesRemaining, 1090);
    const s = C.solveCombo(g.canteen, { gap: 40, budget: g.settings.lastBudget, caloriesRemaining: 1090 });
    assert.equal(s.status, "optimal");
    assert.equal(s.plan.totals.cost, 40);

    // Safety: demo history is fed above the floor, so no low-intake note appears by default
    assert.equal(C.lowIntake(g.logs, date, g.settings.calorieFloor).flag, false);
  });
}

test("turning demo mode on and off with real demo data leaves the real keys byte-identical", () => {
  const data = {
    [KEY_LOGS]: JSON.stringify({ "2026-11-10": { split: "pull1", exercises: [], foods: [], notes: "real" } }),
    [KEY_GOALS]: JSON.stringify({ cal: 2200, pro: 140, carb: 250, fat: 60 }),
    spotter_exams: JSON.stringify([{ label: "Real exam", date: "2026-12-01" }]),
    spotter_canteen: JSON.stringify([{ id: "real", name: "Real item", cal: 1, pro: 1, carb: 0, fat: 0, price: 10, maxServings: 3, available: true }]),
    spotter_settings: JSON.stringify({ calorieFloor: 1600, lastBudget: 80, lastBackupAt: "2026-11-01T00:00:00.000Z" }),
    spotter_schemaVersion: "1"
  };
  const writes = [];
  const be = { get: k => (k in data ? data[k] : null), set: (k, v) => { data[k] = v; writes.push(k); } };
  const snapshot = () => JSON.stringify(Object.keys(data).filter(k => !k.startsWith("spotter_demo_")).sort().map(k => [k, data[k]]));
  const before = snapshot();

  const st = C.makeStorage(be, KEY_LOGS, KEY_GOALS);
  st.enterDemo(Demo.generate("2026-11-12", SPLITS, STAPLES));

  // Use the demo the way the app does: load, migrate, edit, save.
  const logs = st.loadLogs();
  assert.equal(Object.keys(logs).length, 35);
  assert.ok(!("2026-11-10" in logs) || logs["2026-11-10"].notes !== "real");
  const state = C.migrate(st.loadSpotter(), STAPLES);
  assert.equal(state.settings.lastBudget, 60);
  assert.equal(state.exams.length, 3);
  logs["2026-11-12"].sessionRpe = 9;
  logs["2026-11-12"] = C.applyMaintenance(logs["2026-11-12"]).day;
  state.canteen[1].price = 99;
  state.exams.push({ label: "Another (demo)", date: "2026-11-20" });
  st.saveLogsGoals(logs, st.loadGoals());
  st.saveSpotter(state);

  assert.ok(writes.length >= 11);
  assert.ok(writes.every(k => k.startsWith("spotter_demo_")), "only demo keys were written: " + [...new Set(writes)].join(", "));
  assert.equal(snapshot(), before);

  st.exitDemo();
  assert.equal(snapshot(), before);
  assert.deepEqual(st.loadLogs(), { "2026-11-10": { split: "pull1", exercises: [], foods: [], notes: "real" } });
  const real = C.migrate(st.loadSpotter(), STAPLES);
  assert.deepEqual(real.exams, [{ label: "Real exam", date: "2026-12-01" }]);
  assert.equal(real.canteen[0].price, 10);
  assert.equal(real.settings.lastBackupAt, "2026-11-01T00:00:00.000Z");
});

test("a demo export is marked and refused on import", () => {
  const g = Demo.generate("2026-11-12", SPLITS, STAPLES);
  const file = JSON.parse(JSON.stringify(C.buildExport(g.logs, g.goals, g, "2026-11-12T10:00:00.000Z", true)));
  assert.equal(file.demo, true);
  assert.equal(C.validateBackup(file, STAPLES).ok, false);
});

// ---------------- presentation view (no demo wording) and realism ----------------

test("clean (presentation) data is identical apart from labels and the presentation flag", () => {
  const a = Demo.generate("2026-11-12", SPLITS, STAPLES);
  const b = Demo.generate("2026-11-12", SPLITS, STAPLES, undefined, { clean: true });
  assert.deepEqual(a.logs, b.logs);
  assert.deepEqual(a.canteen, b.canteen);
  assert.deepEqual(a.goals, b.goals);
  assert.equal(b.settings.presentation, true);
  assert.equal(b.demo, true, "still stored as demo data, in the demo keys only");
  assert.deepEqual(b.exams.map(e => e.label), ["Discrete Maths quiz", "DBMS mid-sem", "Operating Systems"]);
  assert.ok(a.exams.every(e => e.label.endsWith("(demo)")));
});

test("clean data contains no demo or sample wording anywhere a user can see it", () => {
  const b = Demo.generate("2026-11-12", SPLITS, STAPLES, undefined, { clean: true });
  const visible = JSON.stringify({ logs: b.logs, exams: b.exams, canteen: b.canteen.map(i => i.name) });
  assert.ok(!/demo|sample|fake|synthetic/i.test(visible), visible.match(/.{20}(demo|sample|fake|synthetic).{20}/i));
});

test("history looks like a real month: meals above the floor, notes, one missed session, weekly weigh-ins", () => {
  const g = Demo.generate("2026-11-12", SPLITS, STAPLES);
  const past = Object.keys(g.logs).sort().slice(0, 34).map(k => [k, g.logs[k]]);
  for (const [k, d] of past) {
    const t = C.dayTotals(d);
    assert.ok(t.count >= 3 && t.count <= 6, k + " foods " + t.count);
    assert.ok(t.cal >= 1550 && t.cal <= 2700, k + " kcal " + t.cal);
    assert.ok(t.pro >= 60 && t.pro <= 150, k + " protein " + t.pro);
    assert.ok(d.sleepHours >= 5 && d.sleepHours <= 9, k + " sleep");
  }
  assert.equal(past.filter(([, d]) => d.notes.length).length, 5, "four session notes plus the missed-session note");
  const missed = past.filter(([, d]) => /Skipped legs/.test(d.notes));
  assert.equal(missed.length, 1);
  assert.equal(missed[0][1].exercises.length, 0);
  assert.equal(missed[0][1].durationMinutes, 0);
  const weighed = past.filter(([, d]) => d.bodyweight !== "");
  assert.equal(weighed.length, 5, "one weigh-in per Monday");
  assert.ok(weighed.every(([, d]) => +d.bodyweight >= 71.5 && +d.bodyweight <= 73.2));
  const sessions = past.filter(([, d]) => d.exercises.length);
  assert.ok(sessions.length >= 27 && sessions.length <= 29, "sessions " + sessions.length); // six-day split, about 29 in 34 days, minus the one missed
  for (const [k, d] of sessions) {
    assert.ok(d.durationMinutes >= 30 && d.durationMinutes <= 90, k + " minutes " + d.durationMinutes);
    assert.ok(d.sessionRpe >= 6 && d.sessionRpe <= 9, k + " session RPE");
  }
});

test("today's chosen sets stay inside each exercise's own target rep range", () => {
  for (const date of WEEK) {
    const g = Demo.generate(date, SPLITS, STAPLES);
    for (const ex of g.logs[date].exercises) {
      const nums = String(ex.targetReps).match(/\d+/g).map(Number);
      const lo = nums[0], hi = Math.max(...nums);
      const first = ex.sets[0];
      if (first.rpeConfirmed) { // the three verdict lifts
        const reps = +first.reps;
        assert.ok(reps >= lo && reps <= Math.max(lo, Math.min(12, hi)), date + " " + ex.name + " reps " + reps + " vs " + ex.targetReps);
      }
    }
  }
});

test("every split can be prefilled: all sets have kg, reps and PE, nothing is ticked; rest gives no exercises", () => {
  const date = "2026-11-17";
  const g = Demo.generate(date, SPLITS, STAPLES, undefined, { clean: true });
  for (const split of ["push1", "pull1", "legs1", "push2", "pull2", "legs2"]) {
    const exs = Demo.todayExercises(g.logs, date, split, SPLITS);
    assert.ok(exs.length >= 4, split + " has exercises");
    for (const e of exs) {
      assert.ok(e.sets.length >= 3, split + " " + e.name);
      for (const x of e.sets) {
        assert.ok(+x.weight > 0 && +x.reps > 0 && +x.rpe >= 6 && x.done === false, split + " " + e.name + " " + JSON.stringify(x));
      }
    }
  }
  assert.deepEqual(Demo.todayExercises(g.logs, date, "rest", SPLITS), []);
});

test("prefilling does not depend on today's day already existing in the logs, and does not change the history", () => {
  const date = "2026-11-17";
  const g = Demo.generate(date, SPLITS, STAPLES, undefined, { clean: true });
  const before = JSON.stringify(g.logs);
  const a = Demo.todayExercises(g.logs, date, "push1", SPLITS);
  const withoutToday = JSON.parse(before); delete withoutToday[date];
  const b = Demo.todayExercises(withoutToday, date, "push1", SPLITS);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(g.logs), before, "the logs were not modified");
});
