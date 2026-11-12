"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../src/spotter-core.js");
const fx = require("./fixtures/load-5-weeks.json");
const { set, ex, day } = require("./helpers.js");

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `expected ${b} ± ${tol}, got ${a}`);

test("hand-computed 5-week fixture: every number", () => {
  // Daily loads = session RPE x minutes
  //   Jan 26: 6x60=360   Jan 28: 7x50=350   Jan 30: 6x45=270            -> week -4 = 980
  //   Feb  2: 7x60=420   Feb  4: 7x60=420   Feb  6: 8x40=320            -> week -3 = 1160
  //   Feb 10: minutes but no RPE; Feb 12: RPE but 0 minutes             -> week -2 = no data
  //   Feb 16: 6x70=420   Feb 19: 8x55=440   Feb 21: 7x60=420            -> week -1 = 1280
  //   Feb 23: 8x60=480   Feb 25: 9x70=630   Feb 27: 8x50=400  Mar 1: 7x30=210 -> this week = 1720
  // Chronic = (980 + 1160 + 1280) / 3 = 1140   (week -2 is missing, not zero)
  // Ratio   = 1720 / 1140 = 1.5088  -> above 1.5 -> "Big spike vs your usual"
  for (const [date, expected] of Object.entries(fx.expected.dailyLoads)) {
    assert.equal(C.dailyLoad(fx.logs[date]), expected, date);
  }
  const s = C.loadSummary(fx.logs, fx.activeDate);
  assert.equal(s.status, "ok");
  assert.equal(s.acute.load, 1720);
  assert.equal(s.acute.start, "2026-02-23");
  assert.equal(s.acute.end, "2026-03-01");
  fx.expected.weeks.forEach((w, i) => {
    assert.equal(s.weeks[i].start, w.start, w.label);
    assert.equal(s.weeks[i].end, w.end, w.label);
    assert.equal(s.weeks[i].load, w.load, w.label);
    assert.equal(s.weeks[i].hasData, w.hasData, w.label);
  });
  assert.equal(s.weeksWithData, 3);
  assert.equal(s.chronic, 1140);
  near(s.ratio, 1.5088, 0.00005);
  assert.equal(s.band.label, "Big spike vs your usual");
});

test("the baseline window is activeDate-34 .. activeDate-7 and excludes this week", () => {
  const s = C.loadSummary(fx.logs, fx.activeDate);
  assert.equal(s.weeks[3].start, C.addDays(fx.activeDate, -34));
  assert.equal(s.weeks[0].end, C.addDays(fx.activeDate, -7));
  // Doubling this week's load must not change the baseline.
  const logs = JSON.parse(JSON.stringify(fx.logs));
  logs["2026-02-25"].durationMinutes = 140;
  assert.equal(C.loadSummary(logs, fx.activeDate).chronic, 1140);
});

test("days missing session RPE or minutes contribute nothing; nothing is guessed", () => {
  assert.equal(C.dailyLoad({ sessionRpe: null, durationMinutes: 60 }), null);
  assert.equal(C.dailyLoad({ sessionRpe: 7, durationMinutes: 0 }), null);
  assert.equal(C.dailyLoad({ sessionRpe: 7 }), null);
  assert.equal(C.dailyLoad({ durationMinutes: 45 }), null); // a legacy day
  assert.equal(C.dailyLoad({ sessionRpe: 11, durationMinutes: 45 }), null);
  assert.equal(C.dailyLoad({ sessionRpe: 0, durationMinutes: 45 }), null);
  assert.equal(C.dailyLoad(undefined), null);
  assert.equal(C.dailyLoad({ sessionRpe: "7", durationMinutes: 45 }), 315);
});

test("fewer than 2 baseline weeks with data: Not enough history yet", () => {
  const logs = { "2026-02-27": { sessionRpe: 8, durationMinutes: 50 }, "2026-02-21": { sessionRpe: 7, durationMinutes: 60 } };
  const s = C.loadSummary(logs, "2026-03-01");
  assert.equal(s.status, "not-enough");
  assert.equal(s.ratio, null);
  assert.equal(s.weeksWithData, 1);
  const a = C.autopilot(logs, [], "2026-03-01");
  assert.ok(C.explainAutopilot(a).rows.some(r => r[1] === "Not enough history yet"));
});

test("no load logged this week: no ratio rather than a fake zero", () => {
  const logs = JSON.parse(JSON.stringify(fx.logs));
  for (const d of ["2026-02-23", "2026-02-25", "2026-02-27", "2026-03-01"]) delete logs[d];
  const s = C.loadSummary(logs, fx.activeDate);
  assert.equal(s.status, "no-acute");
  assert.equal(s.ratio, null);
  assert.equal(s.chronic, 1140);
});

test("band edges", () => {
  assert.equal(C.loadBand(0.79).label, "Lighter than usual");
  assert.equal(C.loadBand(0.8).label, "In your normal range");
  assert.equal(C.loadBand(1.3).label, "In your normal range");
  assert.equal(C.loadBand(1.3001).label, "Load is climbing fast");
  assert.equal(C.loadBand(1.5).label, "Load is climbing fast");
  assert.equal(C.loadBand(1.5001).label, "Big spike vs your usual");
});

test("exam week: an exam today up to 6 days ahead; day 7 is not exam week", () => {
  const D = "2026-03-01";
  const mode = off => C.examStatus([{ label: "DBMS", date: C.addDays(D, off) }], D).mode;
  assert.equal(mode(0), "exam");
  assert.equal(mode(6), "exam");
  assert.equal(mode(7), "none");
  assert.equal(mode(30), "none");
  const st = C.examStatus([{ label: "DBMS", date: C.addDays(D, 3) }], D);
  assert.equal(st.next.daysAway, 3);
  assert.equal(C.examLine(st.next), "DBMS in 3 days");
});

test("ramp-back week: last exam 1-7 days ago and none in the next 7", () => {
  const D = "2026-03-10";
  const mode = (...offs) => C.examStatus(offs.map((o, i) => ({ label: "E" + i, date: C.addDays(D, o) })), D).mode;
  assert.equal(mode(-1), "ramp");
  assert.equal(mode(-7), "ramp");
  assert.equal(mode(-8), "none");
  assert.equal(mode(-2, 7), "none"); // another exam exactly 7 days out blocks the ramp-back
  assert.equal(mode(-2, 8), "ramp");
  assert.equal(mode(-2, 3), "exam"); // exam week wins
  assert.equal(mode(), "none");
});

test("exam list is cleaned: bad dates dropped, sorted, label defaulted", () => {
  const out = C.cleanExams([{ label: " OS ", date: "2026-05-10" }, { label: "x", date: "nope" }, null, { date: "2026-05-02" }]);
  assert.deepEqual(out, [{ label: "Exam", date: "2026-05-02" }, { label: "OS", date: "2026-05-10" }]);
});

test("sleep: average of the last 3 nights with data, within the last 7 days", () => {
  const D = "2026-03-10";
  const logs = {
    [D]: { sleepHours: 6 },
    [C.addDays(D, -1)]: { sleepHours: null }, // no entry: skipped
    [C.addDays(D, -2)]: { sleepHours: 5.5 },
    [C.addDays(D, -3)]: { sleepHours: "7" },
    [C.addDays(D, -4)]: { sleepHours: 9 }, // a 4th night: not used
    [C.addDays(D, 1)]: { sleepHours: 12 } // future: never used
  };
  const s = C.sleepAverage(logs, D);
  assert.equal(s.n, 3);
  near(s.avg, (6 + 5.5 + 7) / 3, 1e-12);
  assert.equal(C.sleepAverage({ [C.addDays(D, -7)]: { sleepHours: 4 } }, D), null); // too old
  assert.equal(C.sleepAverage({ [D]: { sleepHours: 30 } }, D), null); // out of range
  assert.equal(C.sleepAverage({}, D), null);
});

test("autopilot: maintenance in exam week; stronger wording on high ratio OR low sleep", () => {
  const D = fx.activeDate; // ratio 1.51 here
  const exam = [{ label: "Maths", date: C.addDays(D, 2) }];
  const strongByLoad = C.autopilot(fx.logs, exam, D);
  assert.equal(strongByLoad.kind, "maintenance-strong");
  assert.equal(C.autopilotText(strongByLoad).title, "Maintenance mode in exam week");

  // normal ratio, good sleep -> plain maintenance
  const calm = JSON.parse(JSON.stringify(fx.logs));
  calm["2026-02-25"].durationMinutes = 20; calm["2026-02-23"].durationMinutes = 30; // acute = 240+180+400+210 = 1030
  calm[D].sleepHours = 8;
  const plain = C.autopilot(calm, exam, D);
  near(plain.load.ratio, 1030 / 1140, 1e-9);
  assert.equal(plain.kind, "maintenance");

  // same, but short sleep -> strong
  calm[D].sleepHours = 6; calm["2026-02-28"] = { sleepHours: 6.5 };
  const tired = C.autopilot(calm, exam, D);
  near(tired.sleep.avg, 6.25, 1e-12);
  assert.equal(tired.kind, "maintenance-strong");
  assert.match(C.autopilotText(tired).body, /averaged 6\.3 h of sleep/);
});

test("autopilot: ramp-back, load flag without exams, countdown, and nothing to say", () => {
  const D = fx.activeDate;
  assert.equal(C.autopilot(fx.logs, [{ label: "Maths", date: C.addDays(D, -3) }], D).kind, "ramp");
  const flag = C.autopilot(fx.logs, [], D);
  assert.equal(flag.kind, "load-flag");
  assert.match(C.autopilotText(flag).body, /A warning flag, not an injury predictor\./);
  const soon = C.autopilot({}, [{ label: "Maths", date: C.addDays(D, 10) }], D);
  assert.equal(soon.kind, "none");
  assert.equal(soon.show, true);
  const quiet = C.autopilot({}, [{ label: "Maths", date: C.addDays(D, 40) }], D);
  assert.equal(quiet.show, false);
});

test("autopilot Why? lists inputs, formula and the not-a-predictor line", () => {
  const e = C.explainAutopilot(C.autopilot(fx.logs, [{ label: "Maths", date: C.addDays(fx.activeDate, 2) }], fx.activeDate));
  assert.ok(e.formula.includes("load = session RPE × minutes"));
  const rows = Object.fromEntries(e.rows);
  assert.equal(rows["This week's load"], "1720 (4 sessions)");
  assert.equal(rows["4-week average"], "1140 per week (3 weeks with data)");
  assert.equal(rows["Ratio"], "1.51 · Big spike vs your usual");
  assert.match(e.notes.join(" "), /Load spikes are flags, not injury predictions\./);
});

test("weekly series for the chart: 6 weeks, last is current, exam weeks marked", () => {
  const s = C.weeklyLoadSeries(fx.logs, [{ label: "Quiz", date: "2026-02-18" }], fx.activeDate);
  assert.equal(s.length, 6);
  assert.deepEqual(s.map(w => w.load), [0, 980, 1160, 0, 1280, 1720]);
  assert.deepEqual(s.map(w => w.isCurrent), [false, false, false, false, false, true]);
  assert.deepEqual(s.map(w => w.hasExam), [false, false, false, false, true, false]);
  assert.equal(s[5].end, fx.activeDate);
});

// ---------------- maintenance mode ----------------

function planDay() {
  return day([
    ex("Flat Bench Press", [set(80, 8, 8.5), set(80, 8, 9, { done: false }), set(80, 8, 9, { done: false }), set(80, 6, 10, { done: false, type: "F" }), set(60, 12, 9, { done: false, type: "D" })]),
    ex("Incline Dumbbell Press", [set(30, 10, 8.5, { done: false }), set(30, 10, 8.5, { done: false }), set(30, 10, 8.5, { done: false })]),
    ex("Cable Chest Flyes", [set(15, 12, 9), set(15, 12, 9), set(15, 12, 9)]), // all done
    ex("Rear Delt Fly", [set(10, 12, 7, { done: false })])
  ], { spotter: {} });
}

test("set targets: ceil(60%), minimum 1", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 10].map(n => C.targetSets(n, 0.6)), [1, 2, 2, 3, 3, 4, 6]);
  assert.equal(C.targetSets(0, 0.6), 0);
  assert.deepEqual([3, 4, 5].map(n => C.targetSets(n, 0.8)), [3, 4, 4]);
});

test("apply maintenance: trims undone sets from the end, caps RPE at 8, removes failure sets, keeps weights", () => {
  const before = planDay();
  const frozen = JSON.stringify(before);
  const res = C.applyMaintenance(before);
  assert.equal(JSON.stringify(before), frozen, "the input day is not modified");
  assert.equal(res.applied, true);
  const d = res.day;
  // Bench: 5 planned -> keep 3. The done set stays untouched, the next two are capped.
  assert.equal(d.exercises[0].sets.length, 3);
  assert.deepEqual(d.exercises[0].sets[0], before.exercises[0].sets[0]);
  assert.deepEqual(d.exercises[0].sets.map(s => s.rpe), ["8.5", "8", "8"]);
  assert.deepEqual(d.exercises[0].sets.map(s => s.weight), ["80", "80", "80"]);
  // Incline: 3 planned -> keep 2
  assert.equal(d.exercises[1].sets.length, 2);
  // Flyes: all done -> nothing removed
  assert.deepEqual(d.exercises[2].sets, before.exercises[2].sets);
  // Rear delt: 1 set -> minimum 1, RPE 7 left alone
  assert.equal(d.exercises[3].sets.length, 1);
  assert.equal(d.exercises[3].sets[0].rpe, "7");
  assert.equal(res.removed, 3);
  assert.ok(d.exercises.every(e => e.sets.every(s => s.done || s.type !== "F")));
});

test("apply maintenance never removes or edits a completed set, even when more are done than the target", () => {
  const d0 = day([ex("Deadlift", [set(140, 5, 9.5, { type: "F" }), set(140, 5, 9.5), set(140, 4, 10), set(140, 4, 10), set(140, 3, 10, { done: false })])], { spotter: {} });
  const d1 = C.applyMaintenance(d0).day;
  // 5 planned -> target 3, but 4 are already done -> keep 4
  assert.equal(d1.exercises[0].sets.length, 4);
  assert.deepEqual(d1.exercises[0].sets, d0.exercises[0].sets.slice(0, 4));
});

test("apply then undo restores the day exactly", () => {
  const before = planDay();
  const applied = C.applyMaintenance(before).day;
  assert.notDeepEqual(applied.exercises, before.exercises);
  const undone = C.undoMaintenance(applied);
  assert.equal(undone.undone, true);
  assert.equal(undone.exact, true);
  assert.deepEqual(undone.day, before);
});

test("undo data lives on the day object and survives a save/load round trip", () => {
  const before = planDay();
  const stored = JSON.parse(JSON.stringify(C.applyMaintenance(before).day)); // as if written to localStorage
  assert.ok(stored.spotter.maintenance);
  assert.deepEqual(C.undoMaintenance(stored).day, before);
});

test("apply then undo is exact for legacy days too (no spotter field, sets without flags)", () => {
  const legacy = day([ex("Lat Pulldowns", [set(50, 10, 9, { done: false }), set(50, 10, 9, { done: false }), set(50, 10, 9, { done: false })])]);
  const undone = C.undoMaintenance(C.applyMaintenance(legacy).day).day;
  assert.deepEqual(undone.exercises, legacy.exercises);
  assert.ok(!("rpeConfirmed" in undone.exercises[0].sets[0]));
});

test("sets completed after applying are kept as logged when undoing", () => {
  const applied = C.applyMaintenance(planDay()).day;
  applied.exercises[0].sets[1].done = true; // did the capped set at RPE 8
  applied.exercises[0].sets[1].reps = "7";
  const undone = C.undoMaintenance(applied);
  assert.equal(undone.exact, true);
  assert.equal(undone.day.exercises[0].sets[1].rpe, "8");
  assert.equal(undone.day.exercises[0].sets[1].reps, "7");
  assert.equal(undone.day.exercises[0].sets.length, 5);
});

test("if sets were added in between, undo still returns every removed set and says it was not exact", () => {
  const applied = C.applyMaintenance(planDay()).day;
  applied.exercises[1].sets.push(set(30, 10, 8, { done: false })); // user added a set
  const undone = C.undoMaintenance(applied);
  assert.equal(undone.exact, false);
  assert.equal(undone.day.exercises[1].sets.length, 4);
  assert.equal(undone.day.spotter.maintenance, undefined);
});

test("applying twice does nothing the second time; undo with nothing applied is a no-op", () => {
  const once = C.applyMaintenance(planDay()).day;
  const twice = C.applyMaintenance(once);
  assert.equal(twice.applied, false);
  assert.deepEqual(twice.day, once);
  const plain = planDay();
  assert.deepEqual(C.undoMaintenance(plain).day, plain);
});

test("set plan preview for the ramp-back week uses 80%", () => {
  const p = C.setPlan(planDay(), 0.8);
  assert.deepEqual(p.map(x => [x.planned, x.target]), [[5, 4], [3, 3], [3, 3], [1, 1]]);
});
