/* Shared builders for the tests. They produce records in the same shape the app stores. */
"use strict";

// A set exactly as the tracker stores it: weight, reps and rpe are STRINGS.
function set(weight, reps, rpe, extra) {
  return Object.assign({ type: "N", weight: String(weight), reps: String(reps), rpe: String(rpe), done: true }, extra || {});
}

function ex(name, sets, extra) {
  return Object.assign({ muscle: "Chest", name, targetReps: "6-10", targetRpe: "8.5", sets }, extra || {});
}

// A day in the ORIGINAL (pre-Spotter) shape.
function day(exercises, extra) {
  return Object.assign({
    split: "push1", durationMinutes: 0, bodyweight: "", waterMl: 0,
    supplements: [], foods: [], notes: "", exercises: exercises || []
  }, extra || {});
}

function food(cal, pro, name) { return { name: name || "Meal", cal, pro, carb: 0, fat: 0 }; }

// Logs with one exercise and one working set per listed session: [[date, weight, reps, rpe, extra], ...]
function liftLogs(name, sessions) {
  const logs = {};
  for (const [date, w, r, rpe, extra] of sessions) logs[date] = day([ex(name, [set(w, r, rpe, extra)])]);
  return logs;
}

// Small deterministic random generator (mulberry32), so every run uses the same "random" cases.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A random canteen for solver-vs-brute-force checks.
function randomInstance(rand, maxSpace) {
  for (;;) {
    const n = 3 + Math.floor(rand() * 8); // 3..10 items
    const items = [];
    let space = 1;
    for (let i = 0; i < n; i++) {
      const max = 1 + Math.floor(rand() * 4); // 1..4
      space *= max + 1;
      items.push({
        id: "i" + i, name: "Item " + i,
        price: 5 + Math.floor(rand() * 76), // 5..80 rupees
        pro: Math.floor(rand() * 41), // 0..40 g
        cal: 40 + Math.floor(rand() * 361), // 40..400 kcal
        carb: 0, fat: 0, maxServings: max, available: rand() > 0.08
      });
      if (rand() < 0.06) items[i].price = null; // some items have no price
    }
    if (space > maxSpace) continue;
    return {
      items,
      gap: 5 + Math.floor(rand() * 96), // 5..100 g
      budget: 10 + Math.floor(rand() * 191), // 10..200 rupees
      caloriesRemaining: 150 + Math.floor(rand() * 1351) // 150..1500 kcal
    };
  }
}

module.exports = { set, ex, day, food, liftLogs, rng, randomInstance };
