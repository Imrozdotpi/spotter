"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../src/spotter-core.js");
const { set, ex, day, liftLogs } = require("./helpers.js");

const NAME = "Flat Bench Press";
const TODAY = "2026-03-02";

// Weekly sessions before TODAY. e1RM of w x 5 @ 8 is w * (1 + 7/30).
function weekly(weights, extra) {
  const n = weights.length;
  return liftLogs(NAME, weights.map((w, i) => [C.addDays(TODAY, -7 * (n - i)), w, 5, 8, extra]));
}
const todayEx = (w, r, rpe, extra) => ex(NAME, [set(w, r, rpe, Object.assign({ rpeConfirmed: true }, extra))]);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b} ± ${tol}, got ${a}`);

test("flat trend: same performance is a Normal day", () => {
  const logs = weekly([100, 100, 100, 100, 100, 100]);
  const r = C.readiness(logs, TODAY, todayEx(100, 5, 8));
  assert.equal(r.status, "verdict");
  assert.equal(r.verdict.chip, "Normal day");
  near(r.predicted, 100 * (1 + 7 / 30), 1e-9);
  near(r.z, 0, 1e-9);
  assert.equal(r.n, 6);
  assert.equal(r.sFloored, true); // a perfectly smooth history uses the 1.5% floor
});

test("flat trend: clearly above is Go for a PR, clearly below is Drop a set", () => {
  const logs = weekly([100, 100, 100, 100, 100, 100]);
  const up = C.readiness(logs, TODAY, todayEx(105, 5, 8));
  assert.equal(up.verdict.chip, "Go for a PR");
  assert.equal(up.verdict.tone, "green");
  const down = C.readiness(logs, TODAY, todayEx(95, 5, 8));
  assert.equal(down.verdict.chip, "Drop a set");
  assert.equal(down.verdict.long, "Drop a set, keep the weight");
  assert.equal(down.verdict.tone, "red");
});

test("rising trend: being on the line is Normal, not a PR just because it beats last week", () => {
  const logs = weekly([90, 92.5, 95, 97.5, 100, 102.5]);
  const r = C.readiness(logs, TODAY, todayEx(105, 5, 8)); // exactly the next step of the line
  assert.equal(r.verdict.chip, "Normal day");
  near(r.predicted, 105 * (1 + 7 / 30), 1e-6);
  assert.ok(r.slopePerWeek > 0);
  // repeating last week's weight is now BELOW the rising trend
  assert.equal(C.readiness(logs, TODAY, todayEx(102.5, 5, 8)).verdict.chip, "Drop a set");
});

test("falling trend: being on the line is Normal, matching last week is a PR-day signal", () => {
  const logs = weekly([110, 107.5, 105, 102.5, 100, 97.5]);
  assert.equal(C.readiness(logs, TODAY, todayEx(95, 5, 8)).verdict.chip, "Normal day");
  assert.equal(C.readiness(logs, TODAY, todayEx(97.5, 5, 8)).verdict.chip, "Go for a PR");
});

test("verdict thresholds sit at exactly one typical swing", () => {
  const logs = weekly([100, 100, 100, 100, 100, 100]);
  const base = C.readiness(logs, TODAY, todayEx(100, 5, 8));
  const cfg = C.CONFIG;
  // Build today's e1RM directly at z = +1, just under it, -1, just over it (RPE 10, 1 rep => e1RM = weight).
  const at = z => C.readiness(logs, TODAY, todayEx(base.predicted + z * base.s, 1, 10)).verdict.key;
  assert.equal(at(cfg.READINESS_Z_PR + 1e-9), "pr");
  assert.equal(at(0.99), "normal");
  assert.equal(at(cfg.READINESS_Z_DROP - 1e-9), "drop");
  assert.equal(at(-0.99), "normal");
});

test("exactly 3 sessions: no verdict, shows progress; exactly 4: verdict", () => {
  const three = C.readiness(weekly([100, 100, 100]), TODAY, todayEx(100, 5, 8));
  assert.equal(three.status, "building");
  assert.equal(three.n, 3);
  assert.equal(three.need, 4);
  assert.match(C.explainReadiness(three, NAME).lead, /^Building your trend: 3 of 4 sessions logged/);
  const four = C.readiness(weekly([100, 100, 100, 100]), TODAY, todayEx(100, 5, 8));
  assert.equal(four.status, "verdict");
  assert.equal(four.n, 4);
});

test("one wildly off session in the MIDDLE of the history barely moves the prediction", () => {
  const clean = [100, 101, 100, 101, 100, 101, 100, 101];
  const dirty = clean.slice(); dirty[3] = 80; // a -20% day
  const a = C.readiness(weekly(clean), TODAY, todayEx(100, 5, 8));
  const b = C.readiness(weekly(dirty), TODAY, todayEx(100, 5, 8));
  assert.ok(b.dropped, "the odd session is set aside");
  assert.equal(b.dropped.w, 80);
  assert.equal(b.n, 7);
  assert.ok(Math.abs(b.predicted - a.predicted) / a.predicted < 0.01, "prediction moves by under 1%");
  assert.equal(b.verdict.chip, "Normal day");
});

test("one wildly off session as the MOST RECENT one (worst case) barely moves the prediction", () => {
  const clean = [100, 101, 100, 101, 100, 101, 100, 101];
  const dirty = clean.slice(); dirty[7] = 80; // last session was a disaster
  const a = C.readiness(weekly(clean), TODAY, todayEx(100, 5, 8));
  const b = C.readiness(weekly(dirty), TODAY, todayEx(100, 5, 8));
  assert.equal(b.dropped.w, 80);
  assert.ok(Math.abs(b.predicted - a.predicted) / a.predicted < 0.01);
  // The important part: one bad day last week does not turn a normal day into a false "Go for a PR".
  assert.equal(b.verdict.chip, "Normal day");
});

test("why the set-aside step exists: plain least squares alone is pulled hard by one bad recent day", () => {
  const clean = [100, 101, 100, 101, 100, 101, 100, 101];
  const dirty = clean.slice(); dirty[7] = 80;
  const plain = Object.assign({}, C.CONFIG, { READINESS_OUTLIER_T: Infinity });
  const a = C.readiness(weekly(clean), TODAY, todayEx(100, 5, 8), plain);
  const b = C.readiness(weekly(dirty), TODAY, todayEx(100, 5, 8), plain);
  assert.equal(b.dropped, null);
  const shift = Math.abs(b.predicted - a.predicted) / a.predicted;
  assert.ok(shift > 0.05, `without it the prediction moves ${(shift * 100).toFixed(1)}%`);
});

test("an ordinary bad day is NOT set aside (only wild ones are)", () => {
  const r = C.readiness(weekly([100, 102, 99, 101, 97, 101, 100, 102]), TODAY, todayEx(100, 5, 8));
  assert.equal(r.dropped, null);
  assert.equal(r.n, 8);
});

test("with exactly 4 sessions nothing is set aside (documented limit)", () => {
  const r = C.readiness(weekly([100, 100, 100, 70]), TODAY, todayEx(100, 5, 8));
  assert.equal(r.status, "verdict");
  assert.equal(r.dropped, null);
  assert.equal(r.n, 4);
});

test("today's set never alters the trend it is judged against", () => {
  const logs = weekly([100, 102, 99, 101, 100, 103]);
  const a = C.readiness(logs, TODAY, todayEx(60, 5, 8));
  const b = C.readiness(logs, TODAY, todayEx(140, 3, 9.5));
  assert.equal(a.predicted, b.predicted);
  assert.equal(a.s, b.s);
  assert.equal(a.n, b.n);
  assert.deepEqual(a.history, b.history);
  // even when today's day is already stored in the log
  logs[TODAY] = day([todayEx(140, 3, 9.5)]);
  const c = C.readiness(logs, TODAY, logs[TODAY].exercises[0]);
  assert.equal(c.predicted, a.predicted);
  assert.ok(c.history.every(h => h.date < TODAY));
});

test("a past activeDate uses only earlier data", () => {
  const logs = weekly([100, 100, 100, 100, 100]);
  // later sessions with silly numbers must be invisible from TODAY
  logs[C.addDays(TODAY, 3)] = day([ex(NAME, [set(300, 5, 8)])]);
  logs[C.addDays(TODAY, 10)] = day([ex(NAME, [set(300, 5, 8)])]);
  const r = C.readiness(logs, TODAY, todayEx(100, 5, 8));
  assert.equal(r.n, 5);
  near(r.predicted, 100 * (1 + 7 / 30), 1e-9);
  // and from an even earlier date there are too few sessions
  const early = C.readiness(logs, C.addDays(TODAY, -21), todayEx(100, 5, 8));
  assert.equal(early.status, "building");
  assert.equal(early.n, 2);
});

test("history window: last 90 days only, at most the 8 most recent sessions", () => {
  const sessions = [];
  for (let i = 1; i <= 12; i++) sessions.push([C.addDays(TODAY, -7 * i), 100, 5, 8]);
  sessions.push([C.addDays(TODAY, -90), 100, 5, 8]); // exactly 90 days ago: inside
  sessions.push([C.addDays(TODAY, -91), 100, 5, 8]); // 91 days ago: outside
  const logs = liftLogs(NAME, sessions);
  const all = C.readinessHistory(logs, TODAY, NAME, Object.assign({}, C.CONFIG, { READINESS_MAX_SESSIONS: 99 }));
  assert.equal(all.length, 13);
  assert.equal(all[0].date, C.addDays(TODAY, -90));
  const used = C.readinessHistory(logs, TODAY, NAME);
  assert.equal(used.length, 8);
  assert.equal(used[7].date, C.addDays(TODAY, -7));
  assert.equal(used[0].date, C.addDays(TODAY, -56));
});

test("history matches names after normalising, and uses the first working set of each day", () => {
  const logs = {};
  logs[C.addDays(TODAY, -7)] = day([ex("  flat  BENCH press ", [set(40, 10, 6, { type: "W" }), set(100, 5, 8), set(110, 3, 9)])]);
  logs[C.addDays(TODAY, -14)] = day([ex("Incline Dumbbell Press", [set(30, 8, 8)]), ex("FLAT BENCH PRESS", [set(98, 5, 8)])]);
  const h = C.readinessHistory(logs, TODAY, NAME);
  assert.deepEqual(h.map(x => x.w), [98, 100]);
});

test("placeholder names never get a verdict or a history", () => {
  const ph = "Legs Session (Tap name to edit)";
  const logs = liftLogs(ph, [1, 2, 3, 4, 5].map(i => [C.addDays(TODAY, -7 * i), 100, 5, 8]));
  assert.equal(C.readiness(logs, TODAY, ex(ph, [set(100, 5, 8)])).status, "placeholder");
  assert.equal(C.readiness(logs, TODAY, ex("Custom Exercise", [set(100, 5, 8)])).status, "placeholder");
});

test("no eligible set today: status no-set with reasons", () => {
  const r = C.readiness(weekly([100, 100, 100, 100]), TODAY, ex(NAME, [set(100, 15, 8), set(100, 5, 8, { done: false })]));
  assert.equal(r.status, "no-set");
  assert.equal(r.skipped[0].code, "reps-range");
  assert.match(C.explainReadiness(r, NAME).notes.join(" "), /reps outside 1–12/);
});

test("unconfirmed RPE still gives a verdict, marked low confidence with the poster wording", () => {
  const logs = weekly([100, 100, 100, 100, 100]);
  const pre = C.readiness(logs, TODAY, todayEx(100, 5, 8.5, { rpeConfirmed: false }));
  assert.equal(pre.status, "verdict");
  assert.equal(pre.confidence, "low");
  assert.equal(C.lowConfidenceText(pre), "Low confidence: RPE was pre-filled at 8.5. Tap PE to enter how hard it really felt.");
  const ok = C.readiness(logs, TODAY, todayEx(100, 5, 8.5));
  assert.equal(ok.confidence, "normal");
  assert.equal(C.lowConfidenceText(ok), "");
});

test("legacy set with no rpeConfirmed flag is 'unknown' and also low confidence", () => {
  const logs = weekly([100, 100, 100, 100, 100]);
  const legacy = ex(NAME, [set(100, 5, 8)]); // no flag at all
  const r = C.readiness(logs, TODAY, legacy);
  assert.equal(r.confidence, "low");
  assert.deepEqual(r.lowReasons, ["rpe-unknown"]);
  assert.equal(r.historyConfirmed, 0);
});

test("auto-filled reps are flagged as low confidence", () => {
  const r = C.readiness(weekly([100, 100, 100, 100, 100]), TODAY, todayEx(100, 6, 8, { repsAutoFilled: true }));
  assert.deepEqual(r.lowReasons, ["reps-autofilled"]);
  assert.match(C.lowConfidenceText(r), /Reps were auto-filled/);
});

test("the Why? explanation carries every required number", () => {
  const logs = weekly([100, 100, 100, 100, 100, 100], { rpeConfirmed: true });
  const r = C.readiness(logs, TODAY, todayEx(105, 5, 8));
  const e = C.explainReadiness(r, NAME);
  const labels = e.rows.map(x => x[0]);
  for (const need of ["Today's set", "Today's e1RM", "Predicted from trend", "Difference", "Sessions used"]) assert.ok(labels.includes(need), need);
  assert.equal(e.rows[0][1], "105 kg × 5 @ RPE 8");
  assert.ok(e.formula.includes("e1RM = weight × (1 + (reps + RIR) / 30)"));
  assert.match(e.lead, /^Go for a PR\./);
  assert.match(e.notes.join(" "), /6 of the 6 past sessions have an RPE you typed yourself/);
  assert.match(e.notes.join(" "), /Wellness guidance, not medical advice\./);
});

test("ols: recovers a known line and its residual spread", () => {
  const f = C.ols([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }]);
  near(f.a, 1, 1e-12); near(f.b, 2, 1e-12); near(f.s, 0, 1e-12);
  // points (0,0) (1,2) (2,1) (3,3): b = 0.8, a = 0.3, SSE = 1.8, s = sqrt(1.8 / 2)
  const g = C.ols([{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 3 }]);
  near(g.b, 0.8, 1e-12); near(g.a, 0.3, 1e-12); near(g.s, Math.sqrt(0.9), 1e-12);
});
