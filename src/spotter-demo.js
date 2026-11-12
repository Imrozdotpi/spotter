/*
 * Spotter demo data.
 *
 * EVERYTHING THIS FILE PRODUCES IS MADE UP. It exists so the three features can
 * be shown without weeks of real logging. It is only ever written to the
 * separate spotter_demo_* storage keys, and the app shows a "DEMO DATA" banner
 * while it is in use.
 *
 * generate(endDate) is pure and deterministic: the same date and seed always
 * give the same 6 weeks. No clock is read here; the date is passed in.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./spotter-core.js"));
  else root.SpotterDemo = factory(root.SpotterCore);
})(typeof self !== "undefined" ? self : this, function (C) {
  "use strict";

  var DAYS = 42; // 6 weeks, ending on endDate
  var SPLIT_BY_WEEKDAY = ["rest", "push1", "pull1", "legs1", "push2", "pull2", "legs2"]; // Sunday first, as in the tracker

  // Made-up starting weights (kg) for the tracker's template exercises.
  var BASE = {
    "flat bench press": 70, "incline dumbbell press": 26, "cable chest flyes": 16, "pec deck flyes": 40,
    "db shoulder press + lateral raises (superset)": 20, "rear delt fly": 10, "shoulder compound press": 40,
    "tricep rope pushdown": 27.5, "dumbbell tricep pullover": 16, "cable tricep pullover": 22.5,
    "overhead cable extension (var 1)": 20, "ez-bar skullcrushers (var 2)": 25,
    "pull-ups": 10, "deadlift": 120, "bent-over barbell rows": 60, "lat pulldowns": 55, "seated cable rows": 50,
    "seated cable t-bar (with dbs)": 30, "barbell bicep curl": 30, "incline db bicep curl": 12, "dumbbell hammer curls": 14,
    "barbell squat": 90, "leg press": 160, "romanian deadlift": 80, "leg curl": 40
  };

  // The tracker's leg days are a placeholder, so demo mode fills them with named lifts.
  var LEGS = [
    { m: "Legs", n: "Barbell Squat", r: "6-10", p: "8.5", s: 3 },
    { m: "Legs", n: "Leg Press", r: "8-12", p: "8.5", s: 3 },
    { m: "Legs", n: "Romanian Deadlift", r: "8-10", p: "8.5", s: 3 },
    { m: "Legs", n: "Leg Curl", r: "10-12", p: "9", s: 3 }
  ];

  // SAMPLE prices in rupees. Placeholders, NOT real canteen prices. Same values as tests/fixtures/sample-prices.json.
  var SAMPLE_PRICES = {
    "Whey Scoop": { price: null, max: 3, available: false },
    "2 Boiled Eggs": { price: 14, max: 3, available: true },
    "4 Egg Whites": { price: 30, max: 3, available: true },
    "Chicken (150g)": { price: 90, max: 2, available: true },
    "Paneer (100g)": { price: 40, max: 2, available: true },
    "Soya Chunks (50g)": { price: 12, max: 1, available: true },
    "Oats + Milk": { price: 35, max: 2, available: true },
    "2 Roti + Dal": { price: 30, max: 2, available: true },
    "White Rice (200g)": { price: 20, max: 2, available: true },
    "Banana + PB": { price: 25, max: 2, available: true }
  };

  function rng(seed) { // mulberry32
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function weekday(dayNum) { return ((dayNum % 7) + 4) % 7; } // 1970-01-01 was a Thursday
  function stepFor(base) { return base >= 40 ? 2.5 : (base >= 15 ? 1 : 0.5); }
  function roundTo(v, step) { return Math.round(v / step) * step; }
  function lowRep(target) { var m = String(target).match(/\d+/); return m ? +m[0] : 8; }
  function templateFor(split, splits) {
    if (split === "legs1" || split === "legs2") return LEGS;
    return (splits[split] && splits[split].list) || [];
  }
  function staple(staples, name) {
    for (var i = 0; i < staples.length; i++) if (staples[i].name === name) return { name: staples[i].name, cal: staples[i].cal, pro: staples[i].pro, carb: staples[i].carb, fat: staples[i].fat };
    return null;
  }

  function emptyDay(split) {
    return { split: split, durationMinutes: 0, bodyweight: "", waterMl: 0, supplements: [], foods: [], notes: "", exercises: [], sessionRpe: null, sleepHours: null, spotter: {} };
  }

  function generate(endDate, splits, staples, seed) {
    var rand = rng(seed === undefined ? 2026 : seed);
    function pick(n) { return Math.floor(rand() * n); }
    var end = C.keyToDayNum(endDate), start = end - (DAYS - 1);
    var logs = {};
    var quizDay = end - 23; // a past exam, so the chart shows an earlier exam week too

    for (var dn = start; dn < end; dn++) {
      var key = C.dayNumToKey(dn);
      var split = SPLIT_BY_WEEKDAY[weekday(dn)];
      var week = Math.floor((dn - start) / 7);
      var d = emptyDay(split);
      var recent = dn > end - 14;
      var missed = !recent && split !== "rest" && rand() < 0.1; // an occasional skipped session

      d.sleepHours = 6.5 + pick(4) * 0.5; // 6.5 - 8.0
      d.waterMl = 2000 + pick(7) * 250;
      if (weekday(dn) === 1) d.bodyweight = (72 + week * 0.2).toFixed(1);
      if (rand() < 0.8) d.supplements.push("Creatine 5g");
      if (rand() < 0.6) d.supplements.push("Whey");

      // Food: two mess meals plus a few staples. Kept comfortably above the calorie floor.
      d.foods.push({ name: "Mess lunch (thali)", cal: 750, pro: 26, carb: 105, fat: 22 });
      d.foods.push({ name: "Mess dinner", cal: 700, pro: 24, carb: 95, fat: 20 });
      var nStaples = 3 + pick(2);
      for (var f = 0; f < nStaples; f++) d.foods.push(staple(staples, staples[pick(staples.length)].name));

      if (split !== "rest" && !missed) {
        templateFor(split, splits).forEach(function (t) {
          var base = BASE[C.normName(t.n)] || 20;
          var step = stepFor(base);
          var w = roundTo(base * (1 + 0.012 * week), step);
          var reps0 = lowRep(t.r) + 1 + pick(3) - 1; // around the low end of the target range
          var typed = rand() < 0.8; // most RPEs "typed", some left at the pre-filled target
          var rpe = typed ? [8, 8.5, 9][pick(3)] : Number(t.p);
          var sets = [];
          for (var s = 0; s < t.s; s++) {
            sets.push({
              type: "N", weight: String(w), reps: String(Math.max(1, reps0 - (s === 0 ? 0 : s === 1 ? pick(2) : 1 + pick(2)))),
              rpe: String(Math.min(10, rpe + (s === t.s - 1 && typed ? 0.5 : 0))), done: true, rpeConfirmed: typed
            });
          }
          d.exercises.push({ muscle: t.m, name: t.n, targetReps: t.r, targetRpe: t.p, sets: sets });
        });
        var mins = 55 + pick(21); // 55 - 75
        if (dn >= quizDay - 2 && dn <= quizDay + 2) mins = Math.round(mins * 0.6); // an easier week around the past exam
        d.durationMinutes = mins;
        d.sessionRpe = 6 + pick(3); // 6 - 8
      }
      logs[key] = d;
    }

    // The last 3 nights were short.
    logs[C.dayNumToKey(end - 2)].sleepHours = 6;
    logs[C.dayNumToKey(end - 1)].sleepHours = 5.5;

    // This week's sessions are harder: set them so the load ratio lands near 1.4 ("Load is climbing fast").
    var chronic = C.loadSummary(logs, endDate).chronic || 2700;
    var thisWeek = [];
    for (var k = end - 6; k < end; k++) if (logs[C.dayNumToKey(k)].exercises.length) thisWeek.push(C.dayNumToKey(k));
    var perSession = 1.4 * chronic / Math.max(1, thisWeek.length);
    thisWeek.forEach(function (key2) {
      var rpe2 = perSession > 720 ? 9 : 8;
      logs[key2].sessionRpe = rpe2;
      logs[key2].durationMinutes = Math.round(perSession / rpe2);
    });

    // ----- today -----
    var todaySplit = SPLIT_BY_WEEKDAY[weekday(end)];
    if (todaySplit === "rest") todaySplit = "push1"; // the demo always opens on a training day
    var today = emptyDay(todaySplit);
    today.sleepHours = 6;
    today.waterMl = 1500;
    today.supplements = ["Creatine 5g"];
    // 120 g protein and 1410 kcal logged -> the poster's "40 g protein short" against a 160 g goal.
    ["Whey Scoop", "Chicken (150g)", "Soya Chunks (50g)", "Oats + Milk", "White Rice (200g)", "White Rice (200g)"].forEach(function (n) {
      var s = staple(staples, n);
      if (s) today.foods.push(s);
    });

    var targets = [1.6, 0, -1.6]; // z-scores to show: Go for a PR, Normal day, Drop a set
    var shown = 0;
    templateFor(todaySplit, splits).forEach(function (t) {
      var base = BASE[C.normName(t.n)] || 20, step = stepFor(base);
      var w0 = roundTo(base * (1 + 0.012 * 5), step);
      var first = { type: "N", weight: String(w0), reps: String(lowRep(t.r) + 1), rpe: String(t.p), done: false, rpeConfirmed: false };
      var ex = { muscle: t.m, name: t.n, targetReps: t.r, targetRpe: t.p, sets: [] };

      // For the first three lifts with enough history, choose a realistic first set that lands on each verdict.
      // Later lifts get an ordinary set at the pre-filled target RPE, left unconfirmed, to show the low-confidence label.
      var showcase = shown < targets.length;
      {
        var probe = C.readiness(logs, endDate, { name: t.n, sets: [{ type: "N", weight: String(w0), reps: "8", rpe: "8", done: true }] });
        if (probe.status === "verdict") {
          var want = showcase ? targets[shown] : 0, bestGap = Infinity, choice = null;
          var rpes = showcase ? [7.5, 8, 8.5, 9] : [Number(t.p)];
          for (var dw = -2; dw <= 2; dw++) {
            for (var reps = 5; reps <= 11; reps++) {
              for (var ri = 0; ri < rpes.length; ri++) {
                var rpe3 = rpes[ri], w = w0 + dw * step;
                var z = (C.e1rm(w, reps, rpe3) - probe.predicted) / probe.s;
                var ok = want > 0 ? z >= 1.25 : (want < 0 ? z <= -1.25 : Math.abs(z) <= 0.5);
                var gapTo = Math.abs(z - want) + Math.abs(dw) * 0.05;
                if (ok && gapTo < bestGap) { bestGap = gapTo; choice = { w: w, reps: reps, rpe: rpe3 }; }
              }
            }
          }
          if (choice) {
            first = { type: "N", weight: String(choice.w), reps: String(choice.reps), rpe: String(choice.rpe), done: showcase && shown === 0, rpeConfirmed: showcase };
            if (showcase) shown++;
          }
        }
      }
      ex.sets.push(first);
      for (var s2 = 1; s2 < t.s; s2++) ex.sets.push({ type: "N", weight: first.weight, reps: first.reps, rpe: String(t.p), done: false, rpeConfirmed: false });
      today.exercises.push(ex);
    });
    logs[endDate] = today;

    // ----- everything else -----
    var canteen = C.cleanCanteen(staples.map(function (s) {
      var p = SAMPLE_PRICES[s.name] || { price: null, max: 3, available: true };
      return { name: s.name, cal: s.cal, pro: s.pro, carb: s.carb, fat: s.fat, price: p.price, maxServings: p.max, available: p.available };
    }));

    return {
      demo: true,
      logs: logs,
      goals: { cal: 2500, pro: 160, carb: 280, fat: 70 },
      exams: C.cleanExams([
        { label: "Quiz (demo)", date: C.dayNumToKey(quizDay) },
        { label: "DBMS mid-sem (demo)", date: C.dayNumToKey(end + 2) },
        { label: "Operating Systems (demo)", date: C.dayNumToKey(end + 4) }
      ]),
      canteen: canteen,
      settings: { calorieFloor: C.CONFIG.CALORIE_FLOOR_DEFAULT, lastBudget: 60, lastBackupAt: null, demoDate: endDate }
    };
  }

  return { generate: generate, SAMPLE_PRICES: SAMPLE_PRICES, DAYS: DAYS };
});
