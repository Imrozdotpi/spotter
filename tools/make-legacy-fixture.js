/*
 * One-off script: writes tests/fixtures/legacy-backup.json.
 * The file has the exact shape the ORIGINAL tracker's exportBackup() produced:
 * { workoutLogs, macroGoals }, set fields as strings, pre-filled RPE, no Spotter fields.
 * The numbers are synthetic. Run: node tools/make-legacy-fixture.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const tpl = {
  push1: [["Chest", "Flat Bench Press", "6-10", "8.5", 3], ["Chest", "Incline Dumbbell Press", "8-12", "8.5", 3], ["Chest", "Cable Chest Flyes", "12-15", "9", 3], ["Triceps", "Tricep Rope Pushdown", "10-12", "9", 3]],
  pull1: [["Back", "Pull-Ups", "8-12", "8.5", 3], ["Back", "Deadlift", "5-8", "8.5", 3], ["Back", "Lat Pulldowns", "10-12", "8.5", 3], ["Biceps", "Barbell Bicep Curl", "8-12", "8.5", 3]],
  legs1: [["Legs", "Legs Session (Tap name to edit)", "8-12", "8.5", 4]]
};
const base = { "Flat Bench Press": 70, "Incline Dumbbell Press": 24, "Cable Chest Flyes": 15, "Tricep Rope Pushdown": 25, "Pull-Ups": 0, "Deadlift": 110, "Lat Pulldowns": 50, "Barbell Bicep Curl": 25 };
const plan = [["2026-01-05", "push1"], ["2026-01-06", "pull1"], ["2026-01-07", "legs1"], ["2026-01-08", "push1"], ["2026-01-12", "push1"], ["2026-01-13", "pull1"], ["2026-01-15", "push1"], ["2026-01-19", "push1"], ["2026-01-20", "pull1"], ["2026-01-22", "push1"], ["2026-01-25", "rest"], ["2026-01-26", "push1"]];

const logs = {};
plan.forEach(([date, split], n) => {
  const day = {
    split, durationMinutes: split === "rest" ? 0 : (n % 3 === 0 ? 0 : 55 + n),
    bodyweight: n % 4 === 0 ? "72.5" : "", waterMl: n % 2 ? 2500 : 0,
    supplements: n % 2 ? ["Creatine 5g", "Whey"] : [], foods: [], notes: n === 3 ? "felt strong" : "", exercises: []
  };
  if (n % 2) day.foods.push({ name: "Whey Scoop", cal: 120, pro: 24, carb: 3, fat: 1.5 }, { name: "Chicken (150g)", cal: 248, pro: 46, carb: 0, fat: 5 }, { name: "2 Roti + Dal", cal: 360, pro: 14, carb: 64, fat: 5 });
  if (n === 4) day.foods.push({ name: "Meal", cal: 650, pro: 30, carb: 80, fat: 20 });
  (tpl[split] || []).forEach(([muscle, name, targetReps, targetRpe, count], ei) => {
    const sets = [];
    for (let s = 0; s < count; s++) {
      const w = base[name] ? String(base[name] + Math.floor(n / 3) * 2.5) : "";
      const done = split !== "legs1" && !(n === 8 && ei === 3);
      const lo = +targetReps.match(/\d+/)[0];
      sets.push({ type: (s === 0 && ei === 0 && n % 4 === 0) ? "W" : "N", weight: done ? w : "", reps: done ? String(lo + (s === 0 ? 2 : s === 1 ? 1 : 0)) : "", rpe: targetRpe, done });
    }
    day.exercises.push({ muscle, name, targetReps, targetRpe, sets });
  });
  logs[date] = day;
});

const out = path.join(__dirname, "..", "tests", "fixtures", "legacy-backup.json");
fs.writeFileSync(out, JSON.stringify({ workoutLogs: logs, macroGoals: { cal: 2400, pro: 150, carb: 270, fat: 65 } }));
console.log("wrote", out, Object.keys(logs).length, "days");
