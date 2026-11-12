"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../src/spotter-core.js");
const { day, food } = require("./helpers.js");

const FLOOR = 1500;
const D = "2026-03-10";
const eaten = (...cals) => day([], { foods: cals.map(c => food(c, 10)) });

test("calorie goal below the floor: the floor is used and the warning is raised", () => {
  const e = C.effectiveCalorieGoal(1200, FLOOR);
  assert.equal(e.effective, 1500);
  assert.equal(e.belowFloor, true);
  assert.match(C.floorWarningText(1200, FLOOR), /under your calorie floor of 1500 kcal/);
  assert.match(C.floorWarningText(1200, FLOOR), /Wellness guidance, not medical advice\./);
});

test("calorie goal at or above the floor is used as it is", () => {
  assert.deepEqual(C.effectiveCalorieGoal(1500, FLOOR), { effective: 1500, belowFloor: false, goal: 1500 });
  assert.equal(C.effectiveCalorieGoal(2500, FLOOR).effective, 2500);
  assert.equal(C.effectiveCalorieGoal(0, FLOOR).effective, 1500); // a broken goal falls back to the floor
});

test("calories remaining are measured against the effective goal", () => {
  const today = eaten(400, 500); // 900 kcal, 20 g protein
  const low = C.nutritionGap({ cal: 1000, pro: 160 }, today, FLOOR);
  assert.equal(low.caloriesRemaining, 600); // 1500 - 900, not 1000 - 900
  assert.equal(low.belowFloor, true);
  assert.equal(low.proteinGap, 140);
  const normal = C.nutritionGap({ cal: 2500, pro: 160 }, today, FLOOR);
  assert.equal(normal.caloriesRemaining, 1600);
  assert.equal(C.nutritionGap({ cal: 2500, pro: 15 }, today, FLOOR).proteinGap, 0); // never negative
});

test("the solver never runs when calories are used up, so it cannot push intake around", () => {
  const today = eaten(1300, 1300);
  const g = C.nutritionGap({ cal: 2500, pro: 160 }, today, FLOOR);
  assert.equal(g.caloriesRemaining, -100);
  const r = C.solveCombo([{ name: "Eggs", price: 14, pro: 12, cal: 140, available: true }], { gap: g.proteinGap, budget: 60, caloriesRemaining: g.caloriesRemaining });
  assert.equal(r.status, "no-calories");
  assert.equal(r.plan, null);
});

test("no Spotter message suggests eating less", () => {
  const texts = [
    C.floorWarningText(1000, FLOOR),
    C.lowIntakeText({ floor: FLOOR, days: 3 }),
    C.solverMessage({ status: "no-calories", inputs: { gap: 40, budget: 60, caloriesRemaining: -5 } }),
    C.explainSolver(C.solveCombo([{ name: "Eggs", price: 14, pro: 12, cal: 140, available: true }], { gap: 12, budget: 60, caloriesRemaining: 500 })).notes.join(" ")
  ].join(" ").toLowerCase();
  for (const phrase of ["eat less", "cut calories", "reduce your intake", "skip a meal", "deficit", "burn off"]) {
    assert.ok(!texts.includes(phrase), phrase);
  }
});

test("floor setting is clamped to a sane range", () => {
  assert.equal(C.cleanFloor(undefined), 1500);
  assert.equal(C.cleanFloor("1800"), 1800);
  assert.equal(C.cleanFloor(300), 1200);
  assert.equal(C.cleanFloor(99999), 4000);
  assert.equal(C.cleanFloor("abc"), 1500);
});

test("low-intake flag: 2 logged days under the floor do not flag, 3 do", () => {
  const logs = { [C.addDays(D, -1)]: eaten(600, 500), [C.addDays(D, -2)]: eaten(700, 400) };
  const two = C.lowIntake(logs, D, FLOOR);
  assert.equal(two.days, 2);
  assert.equal(two.flag, false);
  logs[C.addDays(D, -3)] = eaten(900, 300);
  const three = C.lowIntake(logs, D, FLOOR);
  assert.equal(three.days, 3);
  assert.equal(three.flag, true);
  assert.equal(C.lowIntakeText(three), "Your logged intake has been under 1500 kcal for 3 logged days in a row. If that is not intentional, consider eating a bit more. Wellness guidance, not medical advice.");
});

test("low-intake flag: a day at or above the floor ends the run", () => {
  const logs = {
    [C.addDays(D, -1)]: eaten(600, 500), [C.addDays(D, -2)]: eaten(700, 400),
    [C.addDays(D, -3)]: eaten(900, 600), // exactly 1500: not under
    [C.addDays(D, -4)]: eaten(500, 500), [C.addDays(D, -5)]: eaten(500, 500)
  };
  assert.equal(C.lowIntake(logs, D, FLOOR).days, 2);
});

test("sparse logging: days with fewer than 2 foods are 'not logged', not zero", () => {
  const logs = {
    [C.addDays(D, -1)]: eaten(300), // one snack logged: unknown day
    [C.addDays(D, -2)]: day([]), // nothing logged
    [C.addDays(D, -3)]: eaten(300)
  };
  const r = C.lowIntake(logs, D, FLOOR);
  assert.equal(r.days, 0);
  assert.equal(r.flag, false);
});

test("sparse logging: an unlogged day in between is skipped, but a long gap breaks the run", () => {
  const close = {
    [C.addDays(D, -1)]: eaten(600, 500),
    [C.addDays(D, -2)]: eaten(200), // not logged properly: skipped
    [C.addDays(D, -3)]: eaten(700, 400),
    [C.addDays(D, -5)]: eaten(800, 300)
  };
  assert.equal(C.lowIntake(close, D, FLOOR).flag, true);
  const far = {
    [C.addDays(D, -1)]: eaten(600, 500), [C.addDays(D, -2)]: eaten(700, 400),
    [C.addDays(D, -9)]: eaten(800, 300) // a week earlier: not "in a row"
  };
  assert.equal(C.lowIntake(far, D, FLOOR).days, 2);
  const stale = { [C.addDays(D, -6)]: eaten(600, 500), [C.addDays(D, -7)]: eaten(600, 500), [C.addDays(D, -8)]: eaten(600, 500) };
  assert.equal(C.lowIntake(stale, D, FLOOR).flag, false); // nothing recent
});

test("today is never counted: an unfinished day cannot trigger the flag", () => {
  const logs = { [D]: eaten(200, 200), [C.addDays(D, -1)]: eaten(600, 500), [C.addDays(D, -2)]: eaten(700, 400) };
  assert.equal(C.lowIntake(logs, D, FLOOR).days, 2);
});

test("low-intake Why? lists the days and how days are counted", () => {
  const logs = { [C.addDays(D, -1)]: eaten(600, 500), [C.addDays(D, -2)]: eaten(700, 400), [C.addDays(D, -3)]: eaten(900, 300) };
  const e = C.explainLowIntake(C.lowIntake(logs, D, FLOOR));
  assert.deepEqual(e.rows, [[C.addDays(D, -3), "1200 kcal"], [C.addDays(D, -2), "1100 kcal"], [C.addDays(D, -1), "1100 kcal"]]);
  assert.match(e.notes.join(" "), /at least 2 foods/);
});

test("escapeHtml neutralises markup in user text", () => {
  assert.equal(C.escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.equal(C.escapeHtml("Tom's \"A&B\""), "Tom&#39;s &quot;A&amp;B&quot;");
  assert.equal(C.escapeHtml(null), "");
});
