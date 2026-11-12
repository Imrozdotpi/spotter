"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../src/spotter-core.js");
const { bruteForce } = require("./bruteforce.js");
const { rng, randomInstance } = require("./helpers.js");
const sample = require("./fixtures/sample-prices.json");

const item = (name, price, pro, cal, extra) => Object.assign({ id: name, name, price, pro, cal, carb: 0, fat: 0, maxServings: 3, available: true }, extra || {});
const picks = res => Object.fromEntries(res.plan.lines.map(l => [l.name, l.servings]));

test("picks the cheapest way to close the gap", () => {
  const cat = [item("Eggs", 14, 12, 140), item("Soya", 12, 26, 172), item("Paneer", 40, 18, 265)];
  const r = C.solveCombo(cat, { gap: 40, budget: 60, caloriesRemaining: 1000 });
  assert.equal(r.status, "optimal");
  assert.deepEqual(picks(r), { Soya: 2 });
  assert.equal(r.plan.totals.cost, 24);
  assert.equal(r.plan.totals.pro, 52);
});

test("every constraint holds in the answer and servings are whole numbers", () => {
  const cat = [item("A", 17.5, 11.5, 150), item("B", 9, 6, 90), item("C", 33, 21, 310, { maxServings: 2 })];
  const p = { gap: 37, budget: 70, caloriesRemaining: 640 };
  const r = C.solveCombo(cat, p);
  assert.equal(r.status, "optimal");
  assert.ok(r.plan.totals.pro >= p.gap);
  assert.ok(r.plan.totals.cal <= p.caloriesRemaining);
  assert.ok(r.plan.totals.cost <= p.budget);
  for (const l of r.plan.lines) {
    assert.ok(Number.isInteger(l.servings) && l.servings >= 1);
    assert.ok(l.servings <= cat.find(c => c.name === l.name).maxServings);
  }
});

test("the calorie limit changes the answer", () => {
  const cat = [item("Cheap but heavy", 10, 20, 500), item("Lean but dear", 30, 20, 100)];
  assert.deepEqual(picks(C.solveCombo(cat, { gap: 40, budget: 100, caloriesRemaining: 2000 })), { "Cheap but heavy": 2 });
  assert.deepEqual(picks(C.solveCombo(cat, { gap: 40, budget: 100, caloriesRemaining: 700 })), { "Cheap but heavy": 1, "Lean but dear": 1 });
  assert.deepEqual(picks(C.solveCombo(cat, { gap: 40, budget: 100, caloriesRemaining: 250 })), { "Lean but dear": 2 });
});

test("tie on cost: fewer calories wins", () => {
  const cat = [item("Fatty", 20, 20, 300), item("Lean", 20, 20, 150)];
  assert.deepEqual(picks(C.solveCombo(cat, { gap: 20, budget: 50, caloriesRemaining: 1000 })), { Lean: 1 });
  assert.deepEqual(picks(C.solveCombo(cat.slice().reverse(), { gap: 20, budget: 50, caloriesRemaining: 1000 })), { Lean: 1 });
});

test("tie on cost and calories: fewer different items wins", () => {
  const cat = [item("Half A", 10, 10, 100, { maxServings: 1 }), item("Half B", 10, 10, 100, { maxServings: 1 }), item("Whole", 20, 20, 200, { maxServings: 1 })];
  const r = C.solveCombo(cat, { gap: 20, budget: 50, caloriesRemaining: 1000 });
  assert.deepEqual(picks(r), { Whole: 1 });
  assert.equal(r.plan.totals.distinct, 1);
  const r2 = C.solveCombo(cat.slice().reverse(), { gap: 20, budget: 50, caloriesRemaining: 1000 });
  assert.deepEqual(picks(r2), { Whole: 1 });
});

test("items without a price or marked unavailable are ignored and reported", () => {
  const cat = [
    item("No price", null, 50, 100), item("Empty price", "", 50, 100), item("Zero price", 0, 50, 100),
    item("Off the menu", 1, 50, 100, { available: false }), item("Real", 25, 20, 200)
  ];
  const r = C.solveCombo(cat, { gap: 20, budget: 100, caloriesRemaining: 1000 });
  assert.deepEqual(picks(r), { Real: 1 });
  assert.deepEqual(r.unpriced, ["No price", "Empty price", "Zero price"]);
  assert.equal(r.unavailableCount, 1);
  assert.equal(r.usableCount, 1);
});

test("maxServings is respected", () => {
  const cat = [item("Soya", 12, 26, 172, { maxServings: 1 }), item("Eggs", 14, 12, 140)];
  const r = C.solveCombo(cat, { gap: 40, budget: 60, caloriesRemaining: 1000 });
  assert.deepEqual(picks(r), { Soya: 1, Eggs: 2 });
  assert.equal(r.plan.totals.cost, 40);
});

test("infeasible on budget: fallback gives the most protein and the plain-English sentence", () => {
  const cat = [item("Eggs", 14, 12, 140), item("Paneer", 40, 18, 265)];
  const r = C.solveCombo(cat, { gap: 60, budget: 30, caloriesRemaining: 1000 });
  assert.equal(r.status, "fallback");
  assert.deepEqual(picks(r), { Eggs: 2 });
  assert.equal(C.solverMessage(r), "With ₹30 and 1000 kcal left, the most you can get is 24 g of your 60 g gap.");
  assert.ok(r.plan.totals.cost <= 30);
});

test("infeasible on calories: fallback respects the calorie limit", () => {
  const cat = [item("Eggs", 14, 12, 140), item("Paneer", 40, 18, 265)];
  const r = C.solveCombo(cat, { gap: 60, budget: 500, caloriesRemaining: 300 });
  assert.equal(r.status, "fallback");
  assert.ok(r.plan.totals.cal <= 300);
  assert.equal(r.plan.totals.pro, 24); // 2 x eggs (280 kcal) beats 1 x paneer (18 g)
});

test("fallback ties on protein go to the cheaper option", () => {
  const cat = [item("Dear", 30, 20, 100, { maxServings: 1 }), item("Cheap", 10, 20, 100, { maxServings: 1 })];
  const r = C.solveCombo(cat, { gap: 90, budget: 35, caloriesRemaining: 1000 });
  assert.equal(r.status, "fallback");
  assert.deepEqual(picks(r), { Cheap: 1 });
});

test("guard statuses: no gap, calories used up, no budget, no priced items, nothing fits", () => {
  const cat = [item("Eggs", 14, 12, 140)];
  assert.equal(C.solveCombo(cat, { gap: 0, budget: 60, caloriesRemaining: 500 }).status, "no-gap");
  const used = C.solveCombo(cat, { gap: 40, budget: 60, caloriesRemaining: 0 });
  assert.equal(used.status, "no-calories");
  assert.equal(used.plan, null);
  assert.match(C.solverMessage(used), /Today's calories are used up/);
  assert.equal(C.solveCombo(cat, { gap: 40, budget: 60, caloriesRemaining: -120 }).status, "no-calories");
  assert.equal(C.solveCombo(cat, { gap: 40, budget: 0, caloriesRemaining: 500 }).status, "no-budget");
  assert.equal(C.solveCombo(cat, { gap: 40, budget: NaN, caloriesRemaining: 500 }).status, "no-budget");
  assert.equal(C.solveCombo([item("X", null, 10, 100)], { gap: 40, budget: 60, caloriesRemaining: 500 }).status, "no-items");
  assert.equal(C.solveCombo([], { gap: 40, budget: 60, caloriesRemaining: 500 }).status, "no-items");
  assert.equal(C.solveCombo(cat, { gap: 40, budget: 5, caloriesRemaining: 500 }).status, "nothing-fits");
});

test("prices with paise are handled exactly", () => {
  const cat = [item("A", 0.1, 1, 10, { maxServings: 3 }), item("B", 0.2, 1, 10, { maxServings: 3 })];
  const r = C.solveCombo(cat, { gap: 3, budget: 0.3, caloriesRemaining: 100 }); // 0.1 * 3 must equal 0.3
  assert.equal(r.status, "optimal");
  assert.deepEqual(picks(r), { A: 3 });
  assert.equal(r.plan.totals.cost, 0.3);
});

test("poster case with SAMPLE prices: 40 g protein short, ₹60 left", () => {
  assert.equal(sample.sample, true);
  const r = C.solveCombo(sample.items, { gap: 40, budget: 60, caloriesRemaining: 1090 });
  const b = bruteForce(sample.items, 40, 1090, 60);
  assert.equal(r.status, "optimal");
  assert.equal(Math.round(r.plan.totals.cost * 100), b.cheapest.paise);
  assert.deepEqual(picks(r), { "Soya Chunks (50g)": 1, "2 Boiled Eggs": 2 });
  assert.equal(r.plan.totals.cost, 40);
  assert.equal(r.plan.totals.pro, 50);
});

test("agrees with the independent brute force on 250 seeded random canteens", () => {
  const rand = rng(20260);
  let feasible = 0, infeasible = 0;
  for (let n = 0; n < 250; n++) {
    const inst = randomInstance(rand, 60000);
    const r = C.solveCombo(inst.items, inst);
    const b = bruteForce(inst.items, inst.gap, inst.caloriesRemaining, inst.budget);
    const tag = `instance ${n}`;
    assert.equal(r.exact, true, tag);
    if (b.feasible) {
      feasible++;
      assert.equal(r.status, "optimal", tag);
      assert.equal(Math.round(r.plan.totals.cost * 100), b.cheapest.paise, tag + " cost");
      assert.equal(Math.round(r.plan.totals.cal * 1000), b.cheapest.mk, tag + " calories tie-break");
      assert.equal(r.plan.totals.distinct, b.cheapest.distinct, tag + " items tie-break");
      assert.ok(r.plan.totals.pro >= inst.gap - 1e-9, tag);
    } else {
      infeasible++;
      assert.ok(r.status === "fallback" || r.status === "nothing-fits" || r.status === "no-items", tag + " " + r.status);
      const got = r.plan ? Math.round(r.plan.totals.pro * 1000) : 0;
      assert.equal(got, b.mostProtein.mg, tag + " max protein");
      if (r.plan) {
        assert.equal(Math.round(r.plan.totals.cost * 100), b.mostProtein.paise, tag + " fallback cost tie-break");
        assert.ok(r.plan.totals.pro < inst.gap);
      }
    }
    if (r.plan) {
      assert.ok(r.plan.totals.cost <= inst.budget + 1e-9, tag + " budget");
      assert.ok(r.plan.totals.cal <= inst.caloriesRemaining + 1e-9, tag + " calories");
    }
  }
  assert.ok(feasible > 40 && infeasible > 40, `mix of cases: ${feasible} feasible, ${infeasible} infeasible`);
});

test("Why? for the solver shows the model and the inputs", () => {
  const r = C.solveCombo(sample.items, { gap: 40, budget: 60, caloriesRemaining: 1090 });
  const e = C.explainSolver(r);
  assert.equal(e.lead, "Cheapest combo that closes your 40 g gap: ₹40.");
  assert.deepEqual(e.rows.slice(0, 3), [["Protein gap", "40 g"], ["Budget", "₹60"], ["Calories left", "1090 kcal"]]);
  assert.ok(e.formula[0].startsWith("minimise"));
  assert.match(e.notes.join(" "), /branch and bound/);
});
