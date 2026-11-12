"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../src/spotter-core.js");

const KEY_LOGS = "lakshay_ppl_tracker_v1"; // the tracker's real keys, unchanged
const KEY_GOALS = "lakshay_macro_goals_v1";
const legacyText = fs.readFileSync(path.join(__dirname, "fixtures", "legacy-backup.json"), "utf8");
const legacy = () => JSON.parse(legacyText);
const STAPLES = [
  { name: "Whey Scoop", cal: 120, pro: 24, carb: 3, fat: 1.5 },
  { name: "2 Boiled Eggs", cal: 140, pro: 12, carb: 1, fat: 10 },
  { name: "Soya Chunks (50g)", cal: 172, pro: 26, carb: 16, fat: 1 }
];

// A stand-in for localStorage that records every key written.
function fakeBackend(initial) {
  const data = Object.assign({}, initial);
  const writes = [];
  return { data, writes, get: k => (k in data ? data[k] : null), set: (k, v) => { data[k] = v; writes.push(k); } };
}

test("migrate: first run fills defaults and pre-fills the canteen with NO prices", () => {
  const m = C.migrate({ schemaVersion: null, settings: null, exams: null, canteen: null }, STAPLES);
  assert.equal(m.schemaVersion, 1);
  assert.deepEqual(m.settings, { calorieFloor: 1500, lastBudget: null, lastBackupAt: null });
  assert.deepEqual(m.exams, []);
  assert.equal(m.canteen.length, 3);
  assert.deepEqual(m.canteen[1], { id: "2-boiled-eggs", name: "2 Boiled Eggs", cal: 140, pro: 12, carb: 1, fat: 10, price: null, maxServings: 3, available: true });
  assert.ok(m.canteen.every(i => i.price === null));
});

test("migrate is idempotent", () => {
  const once = C.migrate({}, STAPLES);
  once.canteen[0].price = 25;
  once.exams.push({ label: "OS", date: "2026-05-01" });
  once.settings.lastBudget = 60;
  const twice = C.migrate(JSON.parse(JSON.stringify(once)), STAPLES);
  assert.deepEqual(twice, C.migrate(once, STAPLES));
  assert.deepEqual(C.migrate(twice, STAPLES), twice);
  assert.equal(twice.canteen[0].price, 25);
});

test("migrate keeps what is there, repairs what is broken, and keeps unknown settings", () => {
  const m = C.migrate({
    settings: { calorieFloor: "1700", lastBudget: "", futureOption: true },
    exams: [{ label: "DBMS", date: "2026-05-04" }, { label: "bad", date: "soon" }],
    canteen: [{ name: "Samosa", cal: "250", pro: 5, price: "15" }, { name: "Samosa", pro: -3, maxServings: 99, available: false }, null]
  }, STAPLES);
  assert.equal(m.settings.calorieFloor, 1700);
  assert.equal(m.settings.lastBudget, null);
  assert.equal(m.settings.futureOption, true);
  assert.deepEqual(m.exams, [{ label: "DBMS", date: "2026-05-04" }]);
  assert.deepEqual(m.canteen.map(i => i.id), ["samosa", "samosa-2"]);
  assert.equal(m.canteen[0].price, 15);
  assert.equal(m.canteen[0].cal, 250);
  assert.equal(m.canteen[1].pro, 0);
  assert.equal(m.canteen[1].maxServings, 10);
  assert.equal(m.canteen[1].available, false);
  // a canteen that was emptied on purpose stays empty; it is not re-filled
  assert.deepEqual(C.migrate({ canteen: [] }, STAPLES).canteen, []);
});

test("legacy backup (original format) validates and imports unchanged", () => {
  const v = C.validateBackup(legacy(), STAPLES);
  assert.equal(v.ok, true, v.errors.join("; "));
  assert.equal(v.format, "legacy");
  assert.equal(v.summary.days, 12);
  assert.equal(v.summary.first, "2026-01-05");
  assert.equal(v.summary.last, "2026-01-26");
  assert.deepEqual(v.goals, { cal: 2400, pro: 150, carb: 270, fat: 65 });
  assert.equal(v.spotter, null); // old files carry no Spotter data; current settings are kept
  assert.equal(JSON.stringify(v.logs), JSON.stringify(legacy().workoutLogs), "logs pass through byte-for-byte");
});

test("legacy bare-logs file (also accepted by the old importer) still imports", () => {
  const bare = legacy().workoutLogs;
  const v = C.validateBackup(bare, STAPLES);
  assert.equal(v.ok, true);
  assert.equal(v.format, "legacy-bare");
  assert.equal(v.goals, null);
  assert.equal(v.summary.days, 12);
});

test("all Spotter logic runs on legacy days that have none of the new fields", () => {
  const logs = legacy().workoutLogs;
  const D = "2026-01-26";
  const bench = logs[D].exercises[0];
  const r = C.readiness(logs, D, bench);
  assert.equal(r.status, "verdict"); // 5 earlier bench sessions with an eligible first working set
  assert.equal(r.confidence, "low"); // legacy RPE: unknown whether it was typed
  assert.deepEqual(r.lowReasons, ["rpe-unknown"]);
  assert.equal(C.loadSummary(logs, D).status, "not-enough"); // no session RPE in old data
  assert.equal(C.sleepAverage(logs, D), null);
  assert.equal(C.autopilot(logs, [], D).show, false);
  assert.equal(C.lowIntake(logs, D, 1500).flag, false);
  assert.equal(C.readiness(logs, "2026-01-07", logs["2026-01-07"].exercises[0]).status, "placeholder");
  const undone = C.undoMaintenance(C.applyMaintenance(logs[D]).day).day;
  assert.deepEqual(undone.exercises, logs[D].exercises);
});

test("export then import is lossless, and the old importer can still read the new file", () => {
  const logs = legacy().workoutLogs;
  logs["2026-01-26"].sessionRpe = 8; logs["2026-01-26"].sleepHours = 6.5;
  logs["2026-01-26"].exercises[0].sets[1].rpeConfirmed = true;
  const goals = { cal: 2300, pro: 155, carb: 260, fat: 60 };
  const state = C.migrate({ exams: [{ label: "OS", date: "2026-05-01" }], settings: { calorieFloor: 1600, lastBudget: 60 } }, STAPLES);
  state.canteen[2].price = 12;

  const file = JSON.parse(JSON.stringify(C.buildExport(logs, goals, state, "2026-02-01T10:00:00.000Z", false)));
  assert.deepEqual(Object.keys(file), ["workoutLogs", "macroGoals", "spotter", "schemaVersion", "app", "exportedAt"]);
  assert.equal(file.schemaVersion, 1);

  const v = C.validateBackup(file, STAPLES);
  assert.equal(v.ok, true);
  assert.equal(v.format, "spotter");
  assert.deepEqual(v.logs, logs);
  assert.deepEqual(v.goals, goals);
  assert.deepEqual(v.spotter.exams, state.exams);
  assert.deepEqual(v.spotter.canteen, state.canteen);
  assert.deepEqual(v.spotter.settings, state.settings);

  // The ORIGINAL importBackup did: logs = d.workoutLogs || d; if (d.macroGoals) goals = d.macroGoals;
  const oldLogs = file.workoutLogs || file;
  assert.deepEqual(oldLogs, logs);
  assert.deepEqual(file.macroGoals, goals);
});

test("bad files are refused before anything is overwritten", () => {
  const bad = x => C.validateBackup(x, STAPLES);
  assert.equal(bad(null).ok, false);
  assert.equal(bad([1, 2]).ok, false);
  assert.equal(bad("text").ok, false);
  assert.equal(bad({}).ok, false); // an empty file would wipe the logbook
  assert.match(bad({}).errors[0], /no days/);
  assert.equal(bad({ workoutLogs: {} }).ok, false);
  assert.equal(bad({ workoutLogs: [] }).ok, false);
  assert.equal(bad({ hello: "world" }).ok, false);
  assert.equal(bad({ workoutLogs: { "2026-13-40": {} } }).ok, false);
  assert.equal(bad({ workoutLogs: { "2026-01-05": "oops" } }).ok, false);
  assert.equal(bad({ workoutLogs: { "2026-01-05": { exercises: "none" } } }).ok, false);
  assert.equal(bad({ workoutLogs: { "2026-01-05": { exercises: [{ sets: 3 }] } } }).ok, false);
  assert.equal(bad({ workoutLogs: { "2026-01-05": { foods: {} } } }).ok, false);
});

test("a demo export cannot be imported over real data", () => {
  const file = C.buildExport(legacy().workoutLogs, { cal: 1, pro: 1, carb: 1, fat: 1 }, C.migrate({}, STAPLES), "2026-02-01T10:00:00.000Z", true);
  assert.equal(file.demo, true);
  const v = C.validateBackup(JSON.parse(JSON.stringify(file)), STAPLES);
  assert.equal(v.ok, false);
  assert.match(v.errors[0], /demo-data export/);
});

test("invalid macro goals in a file are dropped with a warning, the logs still import", () => {
  const f = legacy(); f.macroGoals = { cal: "lots" };
  const v = C.validateBackup(f, STAPLES);
  assert.equal(v.ok, true);
  assert.equal(v.goals, null);
  assert.equal(v.warnings.length, 1);
});

test("storage in real mode writes the original keys with the original content", () => {
  const be = fakeBackend({ [KEY_LOGS]: JSON.stringify(legacy().workoutLogs), [KEY_GOALS]: JSON.stringify(legacy().macroGoals) });
  const st = C.makeStorage(be, KEY_LOGS, KEY_GOALS);
  assert.equal(st.isDemo(), false);
  const logs = st.loadLogs(), goals = st.loadGoals();
  assert.deepEqual(logs, legacy().workoutLogs);
  st.saveLogsGoals(logs, goals);
  assert.equal(be.data[KEY_LOGS], JSON.stringify(legacy().workoutLogs)); // identical to what the old app would write
  assert.equal(be.data[KEY_GOALS], JSON.stringify(legacy().macroGoals));
  st.saveSpotter(C.migrate(st.loadSpotter(), STAPLES));
  assert.deepEqual(be.writes.sort(), [KEY_GOALS, KEY_LOGS, "spotter_canteen", "spotter_exams", "spotter_schemaVersion", "spotter_settings"].sort());
  assert.equal(st.writeFailed(), false);
});

test("demo and real data never mix", () => {
  const realLogs = JSON.stringify(legacy().workoutLogs), realGoals = JSON.stringify(legacy().macroGoals);
  const be = fakeBackend({ [KEY_LOGS]: realLogs, [KEY_GOALS]: realGoals, spotter_exams: "[{\"label\":\"Real exam\",\"date\":\"2026-05-01\"}]", spotter_canteen: "[]", spotter_settings: "{\"calorieFloor\":1650}", spotter_schemaVersion: "1" });
  const realBefore = JSON.stringify(Object.keys(be.data).sort().map(k => [k, be.data[k]]));
  const REAL_KEYS = [KEY_LOGS, KEY_GOALS, "spotter_exams", "spotter_canteen", "spotter_settings", "spotter_schemaVersion", "spotter_preimport_snapshot"];
  const st = C.makeStorage(be, KEY_LOGS, KEY_GOALS);

  // --- switch demo on and use the app heavily ---
  be.writes.length = 0;
  const demo = { logs: { "2026-03-01": { split: "push1", exercises: [], foods: [] } }, goals: { cal: 2500, pro: 160, carb: 280, fat: 70 }, exams: [{ label: "Demo exam", date: "2026-03-03" }], canteen: [], settings: { calorieFloor: 1500, lastBudget: 60, lastBackupAt: null } };
  st.enterDemo(demo);
  assert.equal(st.isDemo(), true);
  const dl = st.loadLogs();
  dl["2026-03-02"] = { split: "pull1", exercises: [], foods: [{ name: "x", cal: 1, pro: 1, carb: 0, fat: 0 }] };
  st.saveLogsGoals(dl, { cal: 1, pro: 1, carb: 1, fat: 1 });
  st.saveSpotter({ schemaVersion: 1, exams: [], canteen: [{ id: "d", name: "Demo item" }], settings: { calorieFloor: 2000 } });
  assert.equal(st.saveSnapshot({ anything: true }), false); // import snapshots are real-mode only
  st.clearSnapshot();
  for (const k of be.writes) assert.ok(!REAL_KEYS.includes(k), `demo mode wrote real key ${k}`);
  assert.ok(be.writes.every(k => k.startsWith("spotter_demo_")));
  assert.deepEqual(st.loadSpotter().exams, []);
  assert.equal(st.loadSnapshot(), null);

  // a page reload while in demo mode stays in demo mode
  assert.equal(C.makeStorage(be, KEY_LOGS, KEY_GOALS).isDemo(), true);

  // --- switch demo off: real data is byte-identical ---
  st.exitDemo();
  assert.equal(st.isDemo(), false);
  const realAfter = JSON.stringify(Object.keys(be.data).filter(k => !k.startsWith("spotter_demo_")).sort().map(k => [k, be.data[k]]));
  assert.equal(realAfter, realBefore);
  assert.equal(JSON.stringify(st.loadLogs()), realLogs);
  assert.deepEqual(st.loadSpotter().exams, [{ label: "Real exam", date: "2026-05-01" }]);
  assert.equal(st.loadSpotter().settings.calorieFloor, 1650);

  // --- real-mode writes never touch the demo copy ---
  const demoCopy = be.data.spotter_demo_logs;
  st.saveLogsGoals(st.loadLogs(), st.loadGoals());
  assert.equal(be.data.spotter_demo_logs, demoCopy);
});

test("a write that does not stick is detected", () => {
  const be = fakeBackend({});
  be.set = () => {}; // storage full: nothing is stored
  const st = C.makeStorage(be, KEY_LOGS, KEY_GOALS);
  st.saveLogsGoals({ "2026-01-01": {} }, { cal: 1 });
  assert.equal(st.writeFailed(), true);
});

test("import snapshot: saved, read back and cleared in real mode", () => {
  const be = fakeBackend({});
  const st = C.makeStorage(be, KEY_LOGS, KEY_GOALS);
  assert.equal(st.loadSnapshot(), null);
  assert.equal(st.saveSnapshot({ logs: { "2026-01-01": {} }, goals: { cal: 1 } }), true);
  assert.deepEqual(st.loadSnapshot(), { logs: { "2026-01-01": {} }, goals: { cal: 1 } });
  st.clearSnapshot();
  assert.equal(st.loadSnapshot(), null);
});

test("daysSince counts whole days and tolerates junk", () => {
  const now = Date.parse("2026-03-10T12:00:00.000Z");
  assert.equal(C.daysSince("2026-03-10T08:00:00.000Z", now), 0);
  assert.equal(C.daysSince("2026-03-02T12:00:00.000Z", now), 8);
  assert.equal(C.daysSince("never", now), null);
});
