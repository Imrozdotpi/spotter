"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../src/spotter-core.js");
const { set, ex } = require("./helpers.js");

// The original tracker's formula, copied from mobile-gym.html (calc1RM / renderStatsView).
const appEpley = (w, r) => (r === 1 ? w : w * (1 + r / 30));

test("e1RM at RPE 10 equals the app's plain Epley exactly, reps 1-12", () => {
  for (let r = 1; r <= 12; r++) {
    for (const w of [20, 62.5, 100, 142.5]) {
      assert.equal(C.e1rm(w, r, 10), appEpley(w, r), `w=${w} r=${r}`);
      assert.equal(C.epley(w, r), appEpley(w, r));
    }
  }
});

test("a true single at RPE 10 is the weight itself", () => {
  assert.equal(C.e1rm(140, 1, 10), 140);
});

test("each rep in reserve counts like one extra rep", () => {
  // 100 kg x 5 @ RPE 8 -> RIR 2 -> same as 7 reps to failure: 100 * (1 + 7/30)
  assert.equal(C.e1rm(100, 5, 8), 100 * (1 + 7 / 30));
  assert.equal(C.e1rm(100, 5, 8), C.e1rm(100, 7, 10));
  // half RPE steps work too: 8.5 -> RIR 1.5
  assert.equal(C.e1rm(80, 6, 8.5), 80 * (1 + 7.5 / 30));
  // a single at RPE 9 is NOT a max: RIR 1 -> 2 effective reps
  assert.equal(C.e1rm(100, 1, 9), 100 * (1 + 2 / 30));
});

test("eligibility: accepts normal and failure sets inside the ranges", () => {
  assert.equal(C.setEligibility(set(100, 5, 8)).ok, true);
  assert.equal(C.setEligibility(set(100, 5, 10, { type: "F" })).ok, true);
  assert.equal(C.setEligibility(set(100, 1, 6)).ok, true);
  assert.equal(C.setEligibility(set(100, 12, 10)).ok, true);
});

test("eligibility: rejects with a reason", () => {
  assert.equal(C.setEligibility(set(100, 5, 8, { done: false })).code, "not-done");
  assert.equal(C.setEligibility(set(100, 5, 8, { type: "W" })).code, "warmup");
  assert.equal(C.setEligibility(set(100, 5, 8, { type: "D" })).code, "dropset");
  assert.equal(C.setEligibility(set("", 5, 8)).code, "no-weight");
  assert.equal(C.setEligibility(set(0, 5, 8)).code, "no-weight");
  assert.equal(C.setEligibility(set(100, 13, 8)).code, "reps-range");
  assert.equal(C.setEligibility(set(100, 0, 8)).code, "reps-range");
  assert.equal(C.setEligibility(set(100, "", 8)).code, "reps-range");
  assert.equal(C.setEligibility(set(100, 5, 5.5)).code, "rpe-range");
  assert.equal(C.setEligibility(set(100, 5, 10.5)).code, "rpe-range");
  assert.equal(C.setEligibility(set(100, 5, "")).code, "rpe-range");
  assert.equal(C.setEligibility(null).code, "not-done");
});

test("eligibility: a set with no type field (very old data) counts as normal", () => {
  const s = { weight: "60", reps: "8", rpe: "8.5", done: true };
  assert.equal(C.setEligibility(s).ok, true);
});

test("string inputs are parsed; junk is rejected", () => {
  const el = C.setEligibility({ type: "N", weight: " 82.5 ", reps: "6", rpe: "8.5", done: true });
  assert.deepEqual([el.w, el.r, el.rpe], [82.5, 6, 8.5]);
  assert.ok(Number.isNaN(C.num("abc")));
  assert.ok(Number.isNaN(C.num("")));
  assert.ok(Number.isNaN(C.num(null)));
  assert.equal(C.num("7"), 7);
});

test("first working set skips warm-ups, drop sets and unticked sets", () => {
  const e = ex("Flat Bench Press", [
    set(40, 10, 6, { type: "W" }),
    set(80, 8, 8, { done: false }),
    set(80, 15, 9), // too many reps
    set(82.5, 6, 8.5),
    set(85, 5, 9)
  ]);
  const f = C.firstWorkingSet(e);
  assert.equal(f.found, true);
  assert.equal(f.index, 3);
  assert.equal(f.w, 82.5);
  assert.deepEqual(f.skipped.map(s => s.code), ["warmup", "reps-range"]);
});

test("first working set: none found reports why", () => {
  const f = C.firstWorkingSet(ex("Cable Chest Flyes", [set(20, 15, 9), set(20, 14, 9)]));
  assert.equal(f.found, false);
  assert.equal(f.skipped.length, 2);
  assert.equal(f.skipped[0].text, "reps outside 1–12");
});

test("name normalisation: trim, lowercase, collapse spaces", () => {
  assert.equal(C.normName("  Flat   BENCH press "), "flat bench press");
  assert.equal(C.normName(null), "");
  assert.equal(C.isPlaceholderName("legs session (tap name to edit)"), true);
  assert.equal(C.isPlaceholderName("Custom Exercise"), true);
  assert.equal(C.isPlaceholderName(""), true);
  assert.equal(C.isPlaceholderName("Barbell Squat"), false);
});

test("date helper: UTC day arithmetic, month and year ends, invalid keys", () => {
  assert.equal(C.addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(C.addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(C.addDays("2025-12-31", 1), "2026-01-01");
  assert.equal(C.diffDays("2026-03-29", "2026-03-28"), 1); // a DST change day in many zones
  assert.equal(C.diffDays("2026-11-01", "2026-10-25"), 7);
  assert.equal(C.isDateKey("2026-02-31"), false);
  assert.equal(C.isDateKey("2026-2-3"), false);
  assert.equal(C.isDateKey("2026-02-03"), true);
});
