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

test("demo data covers exactly 6 weeks ending on the given day and is labelled", () => {
  const g = Demo.generate("2026-11-12", SPLITS, STAPLES);
  const keys = Object.keys(g.logs).sort();
  assert.equal(keys.length, 42);
  assert.equal(keys[0], "2026-10-02");
  assert.equal(keys[41], "2026-11-12");
  assert.equal(g.demo, true);
  assert.ok(g.exams.every(e => e.label.includes("(demo)")));
  assert.equal(g.settings.demoDate, "2026-11-12");
  assert.equal(C.validateBackup({ workoutLogs: g.logs }, STAPLES).ok, true, "demo logs have a valid shape");
});

test("demo canteen uses the SAMPLE prices from the fixture and nothing else", () => {
  const g = Demo.generate("2026-11-12", SPLITS, STAPLES);
  assert.equal(sample.sample, true);
  assert.deepEqual(
    g.canteen.map(i => [i.name, i.price, i.maxServings, i.available]),
    sample.items.map(i => [i.name, i.price, i.maxServings, i.available])
  );
});

for (const date of WEEK) {
  test(`demo shows all three Acts when opened on ${date}`, () => {
    const g = Demo.generate(date, SPLITS, STAPLES);
    const today = g.logs[date];
    assert.notEqual(today.split, "rest");

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
    assert.equal(today.exercises[0].sets[0].done, true); // one verdict is visible straight away

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
  assert.equal(Object.keys(logs).length, 42);
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
