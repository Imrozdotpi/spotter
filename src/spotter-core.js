/*
 * Spotter core logic.
 *
 * Pure functions only: no DOM, no localStorage, no Date.now(). Every function
 * gets the data and the date it needs as arguments, so the same code runs in
 * the phone browser (global SpotterCore) and in Node tests (require).
 *
 * Sections:
 *   1. Dates and names
 *   2. ACT I   - e1RM, eligibility, regression, readiness verdict
 *   3. ACT II  - session load, ratio, exams, sleep, maintenance mode
 *   4. ACT III - integer programme: cheapest protein combo (branch and bound)
 *   5. Safety  - calorie floor, low-intake flag
 *   6. Explanations ("Why?" text, fixed templates)
 *   7. Data    - migrate, backup validation, storage with demo namespace
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./spotter-config.js"));
  } else {
    root.SpotterCore = factory(root.SpotterConfig);
  }
})(typeof self !== "undefined" ? self : this, function (CONFIG) {
  "use strict";

  // =====================================================================
  // 1. DATES AND NAMES
  // =====================================================================

  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var MS_DAY = 86400000;

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  // "YYYY-MM-DD" -> whole days since 1970-01-01, read as UTC midnight.
  // All day arithmetic goes through this, so timezones and DST cannot shift a date.
  function keyToDayNum(key) {
    var p = key.split("-");
    return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / MS_DAY);
  }

  function dayNumToKey(n) {
    var d = new Date(n * MS_DAY);
    return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
  }

  function isDateKey(key) {
    if (typeof key !== "string" || !DATE_RE.test(key)) return false;
    return dayNumToKey(keyToDayNum(key)) === key; // rejects 2026-02-31 etc.
  }

  function addDays(key, n) { return dayNumToKey(keyToDayNum(key) + n); }
  function diffDays(a, b) { return keyToDayNum(a) - keyToDayNum(b); } // a minus b

  // Strict number parse. "" / null / "abc" -> NaN. The app stores set fields as strings.
  function num(v) {
    if (typeof v === "number") return isFinite(v) ? v : NaN;
    if (typeof v !== "string") return NaN;
    var t = v.trim();
    if (t === "") return NaN;
    var n = Number(t);
    return isFinite(n) ? n : NaN;
  }

  // The ONE place exercise names are normalised for matching history.
  function normName(name) {
    return String(name == null ? "" : name).trim().toLowerCase().replace(/\s+/g, " ");
  }

  function isPlaceholderName(name, cfg) {
    cfg = cfg || CONFIG;
    var n = normName(name);
    if (n === "") return true;
    for (var i = 0; i < cfg.PLACEHOLDER_NAMES.length; i++) {
      if (normName(cfg.PLACEHOLDER_NAMES[i]) === n) return true;
    }
    return false;
  }

  function round(n, d) {
    var f = Math.pow(10, d || 0);
    return Math.round(n * f) / f;
  }

  function fmt(n, d) {
    if (typeof n !== "number" || !isFinite(n)) return "–";
    return round(n, d || 0).toFixed(d || 0);
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // =====================================================================
  // 2. ACT I - READINESS FROM YOUR LIFTS (regression)
  // =====================================================================

  // Plain Epley, exactly as the original tracker computes it.
  function epley(weight, reps) {
    return reps === 1 ? weight : weight * (1 + reps / CONFIG.EPLEY_DIVISOR);
  }

  // RPE-adjusted e1RM. RIR (reps in reserve) = 10 - RPE.
  // e1RM = weight * (1 + (reps + RIR) / 30).
  // A true single at RPE 10 (reps + RIR = 1) is the weight itself.
  // At RPE 10 this is the same arithmetic as epley().
  function e1rm(weight, reps, rpe) {
    var effective = reps + (10 - rpe);
    return effective === 1 ? weight : weight * (1 + effective / CONFIG.EPLEY_DIVISOR);
  }

  var SKIP_TEXT = {
    "not-done": "not ticked as done",
    "warmup": "warm-up set",
    "dropset": "drop set",
    "no-weight": "no weight entered",
    "reps-range": "reps outside 1–12",
    "rpe-range": "RPE outside 6–10"
  };

  // Can this set be used for an e1RM? Returns the parsed numbers or the reason it was skipped.
  function setEligibility(set, cfg) {
    cfg = cfg || CONFIG;
    if (!set || !set.done) return { ok: false, code: "not-done" };
    var type = set.type || "N";
    if (type === "W") return { ok: false, code: "warmup" };
    if (type === "D") return { ok: false, code: "dropset" };
    var w = num(set.weight), r = num(set.reps), rpe = num(set.rpe);
    if (!(w > 0)) return { ok: false, code: "no-weight" };
    if (!(r >= cfg.E1RM_MIN_REPS && r <= cfg.E1RM_MAX_REPS)) return { ok: false, code: "reps-range" };
    if (!(rpe >= cfg.E1RM_MIN_RPE && rpe <= cfg.E1RM_MAX_RPE)) return { ok: false, code: "rpe-range" };
    return { ok: true, w: w, r: r, rpe: rpe };
  }

  // First eligible set of an exercise on one day.
  function firstWorkingSet(ex, cfg) {
    cfg = cfg || CONFIG;
    var skipped = [];
    var sets = (ex && Array.isArray(ex.sets)) ? ex.sets : [];
    for (var i = 0; i < sets.length; i++) {
      var el = setEligibility(sets[i], cfg);
      if (el.ok) {
        return {
          found: true, index: i, w: el.w, r: el.r, rpe: el.rpe,
          e1rm: e1rm(el.w, el.r, el.rpe),
          rpeConfirmed: sets[i].rpeConfirmed, // true, false, or undefined (logged before Spotter)
          repsAutoFilled: sets[i].repsAutoFilled === true,
          skipped: skipped
        };
      }
      if (sets[i] && sets[i].done) skipped.push({ index: i, code: el.code, text: SKIP_TEXT[el.code] });
    }
    return { found: false, skipped: skipped };
  }

  // First working sets of the same lift on EARLIER dates, oldest first.
  function readinessHistory(logs, activeDate, exName, cfg) {
    cfg = cfg || CONFIG;
    var target = normName(exName);
    var today = keyToDayNum(activeDate);
    var oldest = today - cfg.READINESS_WINDOW_DAYS;
    var out = [];
    Object.keys(logs || {}).filter(isDateKey).sort().forEach(function (key) {
      var dn = keyToDayNum(key);
      if (dn >= today || dn < oldest) return;
      var day = logs[key];
      if (!day || !Array.isArray(day.exercises)) return;
      for (var i = 0; i < day.exercises.length; i++) {
        var ex = day.exercises[i];
        if (!ex || normName(ex.name) !== target) continue;
        var f = firstWorkingSet(ex, cfg);
        if (f.found) {
          out.push({ date: key, dayNum: dn, e1rm: f.e1rm, w: f.w, r: f.r, rpe: f.rpe, rpeConfirmed: f.rpeConfirmed });
          break;
        }
      }
    });
    return out.slice(-cfg.READINESS_MAX_SESSIONS);
  }

  // Ordinary least squares for y = a + b*x. s = residual standard deviation with n-2 degrees of freedom.
  function ols(points) {
    var n = points.length, i, mx = 0, my = 0;
    for (i = 0; i < n; i++) { mx += points[i].x; my += points[i].y; }
    mx /= n; my /= n;
    var sxx = 0, sxy = 0;
    for (i = 0; i < n; i++) {
      sxx += (points[i].x - mx) * (points[i].x - mx);
      sxy += (points[i].x - mx) * (points[i].y - my);
    }
    var b = sxx > 0 ? sxy / sxx : 0;
    var a = my - b * mx;
    var sse = 0;
    for (i = 0; i < n; i++) {
      var res = points[i].y - (a + b * points[i].x);
      sse += res * res;
    }
    var s = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;
    return { a: a, b: b, n: n, s: s, mx: mx, sxx: sxx, sse: sse };
  }

  // "Trust the trend over any single day": find at most one past session that
  // sits wildly off the line fitted through all the OTHER sessions.
  // Returns its index, or -1. Needs one spare session beyond the minimum.
  function findOutlier(points, cfg) {
    cfg = cfg || CONFIG;
    if (points.length < cfg.READINESS_MIN_SESSIONS + 1) return -1;
    var worst = -1, worstT = 0;
    for (var i = 0; i < points.length; i++) {
      var others = points.filter(function (_, j) { return j !== i; });
      var f = ols(others);
      var pred = f.a + f.b * points[i].x;
      var s = Math.max(f.s, cfg.READINESS_SD_FLOOR_PCT * Math.abs(pred));
      var h = 1 / others.length + (f.sxx > 0 ? Math.pow(points[i].x - f.mx, 2) / f.sxx : 0);
      var t = Math.abs(points[i].y - pred) / (s * Math.sqrt(1 + h));
      if (t > worstT) { worstT = t; worst = i; }
    }
    return worstT > cfg.READINESS_OUTLIER_T ? worst : -1;
  }

  var VERDICTS = {
    pr: { key: "pr", chip: "Go for a PR", long: "Go for a PR", tone: "green" },
    normal: { key: "normal", chip: "Normal day", long: "Normal day", tone: "amber" },
    drop: { key: "drop", chip: "Drop a set", long: "Drop a set, keep the weight", tone: "red" }
  };

  // The readiness call for one exercise on activeDate.
  // `ex` is today's exercise object. Only dates before activeDate build the trend,
  // so today's set can never change the line it is judged against.
  function readiness(logs, activeDate, ex, cfg) {
    cfg = cfg || CONFIG;
    if (!ex || isPlaceholderName(ex.name, cfg)) return { status: "placeholder" };

    var today = firstWorkingSet(ex, cfg);
    if (!today.found) return { status: "no-set", skipped: today.skipped };

    var hist = readinessHistory(logs, activeDate, ex.name, cfg);
    if (hist.length < cfg.READINESS_MIN_SESSIONS) {
      return { status: "building", n: hist.length, need: cfg.READINESS_MIN_SESSIONS, today: today };
    }

    var x0 = hist[0].dayNum;
    var pts = hist.map(function (h) { return { x: h.dayNum - x0, y: h.e1rm }; });
    var dropIdx = findOutlier(pts, cfg);
    var dropped = dropIdx >= 0 ? hist[dropIdx] : null;
    var used = hist.filter(function (_, i) { return i !== dropIdx; });
    var usedPts = pts.filter(function (_, i) { return i !== dropIdx; });

    var fit = ols(usedPts);
    var xToday = keyToDayNum(activeDate) - x0;
    var predicted = fit.a + fit.b * xToday;
    if (!(predicted > 0)) return { status: "unstable", n: used.length, today: today };

    var s = Math.max(fit.s, cfg.READINESS_SD_FLOOR_PCT * predicted);
    var z = (today.e1rm - predicted) / s;
    var verdict = z >= cfg.READINESS_Z_PR ? VERDICTS.pr : (z <= cfg.READINESS_Z_DROP ? VERDICTS.drop : VERDICTS.normal);

    var low = [];
    if (today.rpeConfirmed === false) low.push("rpe-prefilled");
    else if (today.rpeConfirmed !== true) low.push("rpe-unknown");
    if (today.repsAutoFilled) low.push("reps-autofilled");

    return {
      status: "verdict",
      verdict: verdict,
      today: today,
      n: used.length,
      predicted: predicted,
      s: s,
      sRaw: fit.s,
      sFloored: fit.s < cfg.READINESS_SD_FLOOR_PCT * predicted,
      z: z,
      pctDiff: (today.e1rm - predicted) / predicted * 100,
      slopePerWeek: fit.b * 7,
      confidence: low.length ? "low" : "normal",
      lowReasons: low,
      history: used,
      dropped: dropped,
      historyConfirmed: used.filter(function (h) { return h.rpeConfirmed === true; }).length
    };
  }

  // =====================================================================
  // 3. ACT II - EXAM-WEEK AUTOPILOT (time series)
  // =====================================================================

  // Foster's session load: session RPE x minutes. null when either is missing - never guessed.
  function dailyLoad(day) {
    if (!day) return null;
    var rpe = num(day.sessionRpe), mins = num(day.durationMinutes);
    if (!(rpe >= 1 && rpe <= 10) || !(mins > 0)) return null;
    return rpe * mins;
  }

  // Sum of logged loads over the 7 days ending on endDayNum.
  function weekLoad(logs, endDayNum) {
    var sum = 0, count = 0, days = [];
    for (var d = endDayNum - 6; d <= endDayNum; d++) {
      var key = dayNumToKey(d);
      var l = dailyLoad(logs ? logs[key] : null);
      if (l !== null) { sum += l; count++; days.push({ date: key, load: l }); }
    }
    return { start: dayNumToKey(endDayNum - 6), end: dayNumToKey(endDayNum), load: sum, count: count, hasData: count > 0, days: days };
  }

  function loadBand(ratio, cfg) {
    cfg = cfg || CONFIG;
    if (ratio < cfg.BAND_LOW) return { key: "low", label: "Lighter than usual", tone: "blue" };
    if (ratio <= cfg.BAND_HIGH) return { key: "normal", label: "In your normal range", tone: "green" };
    if (ratio <= cfg.BAND_SPIKE) return { key: "climbing", label: "Load is climbing fast", tone: "amber" };
    return { key: "spike", label: "Big spike vs your usual", tone: "red" };
  }

  // Acute = this week (activeDate-6 .. activeDate).
  // Chronic = mean weekly load of the 4 weeks before (activeDate-34 .. activeDate-7),
  // counting only weeks that have at least one logged load.
  function loadSummary(logs, activeDate, cfg) {
    cfg = cfg || CONFIG;
    var today = keyToDayNum(activeDate);
    var acute = weekLoad(logs, today);
    var weeks = [];
    for (var w = 1; w <= cfg.LOAD_CHRONIC_WEEKS; w++) weeks.push(weekLoad(logs, today - 7 * w));
    var valid = weeks.filter(function (wk) { return wk.hasData; });
    var out = { acute: acute, weeks: weeks, weeksWithData: valid.length, chronic: null, ratio: null, band: null, status: "ok" };
    if (valid.length < cfg.LOAD_MIN_CHRONIC_WEEKS) { out.status = "not-enough"; return out; }
    out.chronic = valid.reduce(function (a, wk) { return a + wk.load; }, 0) / valid.length;
    if (!acute.hasData) { out.status = "no-acute"; return out; }
    out.ratio = acute.load / out.chronic;
    out.band = loadBand(out.ratio, cfg);
    return out;
  }

  function cleanExams(exams) {
    if (!Array.isArray(exams)) return [];
    return exams.filter(function (e) { return e && isDateKey(e.date); })
      .map(function (e) { return { label: String(e.label == null ? "" : e.label).trim().slice(0, 60) || "Exam", date: e.date }; })
      .sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : (a.label < b.label ? -1 : (a.label > b.label ? 1 : 0))); });
  }

  // Exam week  = an exam on activeDate or within the next 6 days.
  // Ramp-back  = the last exam was 1-7 days ago and no exam falls in the next 7 days.
  function examStatus(exams, activeDate, cfg) {
    cfg = cfg || CONFIG;
    var today = keyToDayNum(activeDate);
    var list = cleanExams(exams).map(function (e) { return { label: e.label, date: e.date, daysAway: keyToDayNum(e.date) - today }; });
    var upcoming = list.filter(function (e) { return e.daysAway >= 0; });
    var past = list.filter(function (e) { return e.daysAway < 0; });
    var inWeek = upcoming.filter(function (e) { return e.daysAway <= cfg.EXAM_WEEK_DAYS; });
    var next = upcoming.length ? upcoming[0] : null;
    var last = past.length ? past[past.length - 1] : null;
    var mode = "none";
    if (inWeek.length) mode = "exam";
    else if (last && -last.daysAway <= cfg.RAMP_BACK_DAYS && !(next && next.daysAway <= cfg.RAMP_BACK_DAYS)) mode = "ramp";
    return { mode: mode, next: next, last: last ? { label: last.label, date: last.date, daysAgo: -last.daysAway } : null, inWeek: inWeek };
  }

  function validSleep(v, cfg) {
    cfg = cfg || CONFIG;
    var n = num(v);
    return (n >= 0 && n <= cfg.SLEEP_MAX_HOURS) ? n : NaN;
  }

  // Average of the last 3 nights that have a sleep entry (activeDate's entry = last night).
  function sleepAverage(logs, activeDate, cfg) {
    cfg = cfg || CONFIG;
    var today = keyToDayNum(activeDate), nights = [];
    for (var d = today; d > today - cfg.SLEEP_LOOKBACK_DAYS && nights.length < cfg.SLEEP_NIGHTS; d--) {
      var day = logs ? logs[dayNumToKey(d)] : null;
      if (!day || day.sleepHours === null || day.sleepHours === undefined || day.sleepHours === "") continue;
      var h = validSleep(day.sleepHours, cfg);
      if (!isNaN(h)) nights.push({ date: dayNumToKey(d), hours: h });
    }
    if (!nights.length) return null;
    return { avg: nights.reduce(function (a, n) { return a + n.hours; }, 0) / nights.length, n: nights.length, nights: nights };
  }

  // Puts load, exams and sleep together into one suggestion.
  function autopilot(logs, exams, activeDate, cfg) {
    cfg = cfg || CONFIG;
    var exam = examStatus(exams, activeDate, cfg);
    var load = loadSummary(logs, activeDate, cfg);
    var sleep = sleepAverage(logs, activeDate, cfg);
    var highLoad = load.status === "ok" && load.ratio > cfg.BAND_HIGH;
    var lowSleep = !!sleep && sleep.avg < cfg.SLEEP_LOW_HOURS;

    var kind = "none";
    if (exam.mode === "exam") kind = (highLoad || lowSleep) ? "maintenance-strong" : "maintenance";
    else if (exam.mode === "ramp") kind = "ramp";
    else if (highLoad) kind = "load-flag";

    var countdown = !!exam.next && exam.next.daysAway <= cfg.EXAM_COUNTDOWN_DAYS;
    return {
      kind: kind, exam: exam, load: load, sleep: sleep,
      highLoad: highLoad, lowSleep: lowSleep, countdown: countdown,
      show: kind !== "none" || countdown
    };
  }

  // What a set looked like before maintenance mode touched it (plain JSON, so it survives storage unchanged).
  function snapshotSet(s, index) {
    var snap = { index: index, rpe: s.rpe, hadType: Object.prototype.hasOwnProperty.call(s, "type"), hadConfirmed: Object.prototype.hasOwnProperty.call(s, "rpeConfirmed") };
    if (snap.hadType) snap.type = s.type;
    if (snap.hadConfirmed) snap.rpeConfirmed = s.rpeConfirmed;
    return snap;
  }

  function targetSets(planned, fraction) {
    if (planned <= 0) return 0;
    return Math.max(1, Math.ceil(planned * fraction - 1e-9));
  }

  // What maintenance mode (or a ramp-back week) would do, per exercise. Changes nothing.
  function setPlan(day, fraction) {
    var exs = (day && Array.isArray(day.exercises)) ? day.exercises : [];
    return exs.map(function (ex, i) {
      var sets = Array.isArray(ex.sets) ? ex.sets : [];
      var done = sets.filter(function (s) { return s && s.done; }).length;
      var target = targetSets(sets.length, fraction);
      var keep = Math.max(target, done); // completed sets are never removed
      return { exIdx: i, name: ex.name, planned: sets.length, done: done, target: target, keep: keep, remove: sets.length - keep };
    });
  }

  // Apply maintenance mode to a day. Returns a NEW day object; the input is not changed.
  // Removes only sets that are not done (from the end), caps the RPE of remaining
  // undone sets at 8, and turns undone F (failure) sets into N.
  // Everything removed or changed is stored in day.spotter.maintenance for undo.
  function applyMaintenance(day, cfg) {
    cfg = cfg || CONFIG;
    var out = clone(day);
    if (!out.spotter || typeof out.spotter !== "object") out.spotter = {};
    if (out.spotter.maintenance) return { day: out, applied: false, reason: "already-applied" };
    var plan = setPlan(out, cfg.MAINT_SET_FRACTION);
    var record = { fraction: cfg.MAINT_SET_FRACTION, rpeCap: cfg.MAINT_RPE_CAP, exercises: [] };
    var removedTotal = 0, changedTotal = 0;

    (out.exercises || []).forEach(function (ex, exIdx) {
      if (!Array.isArray(ex.sets)) return;
      var keep = plan[exIdx].keep;
      var removed = [];
      for (var i = ex.sets.length - 1; i >= 0 && ex.sets.length > keep; i--) {
        if (!ex.sets[i].done) removed.push({ index: i, set: ex.sets.splice(i, 1)[0] });
      }
      removed.reverse(); // ascending original index, so undo can re-insert in order
      var changed = [];
      ex.sets.forEach(function (s, i) {
        if (s.done) return;
        var before = null;
        var rpe = num(s.rpe);
        if (rpe > cfg.MAINT_RPE_CAP) {
          before = snapshotSet(s, i);
          s.rpe = String(cfg.MAINT_RPE_CAP);
          s.rpeConfirmed = false; // a capped target is not a felt RPE
        }
        if (s.type === "F") {
          if (!before) before = snapshotSet(s, i);
          s.type = "N";
        }
        if (before) changed.push(before);
      });
      removedTotal += removed.length;
      changedTotal += changed.length;
      record.exercises.push({ exIdx: exIdx, name: ex.name, removed: removed, changed: changed, countAfter: ex.sets.length });
    });

    record.removedTotal = removedTotal;
    record.changedTotal = changedTotal;
    out.spotter.maintenance = record;
    return { day: out, applied: true, removed: removedTotal, changed: changedTotal };
  }

  // Undo maintenance mode. Returns a NEW day. `exact` is true when every set went
  // back to its original position; it is false if sets or exercises were added,
  // deleted or renamed in between (removed sets are then put back at the end).
  function undoMaintenance(day) {
    var out = clone(day);
    var rec = out.spotter && out.spotter.maintenance;
    if (!rec) return { day: out, undone: false, exact: true };
    var exact = true;
    (rec.exercises || []).forEach(function (r) {
      var ex = (out.exercises || [])[r.exIdx];
      if (!ex || normName(ex.name) !== normName(r.name)) {
        // The exercise moved or was renamed: find it by name, else give up on it.
        ex = (out.exercises || []).filter(function (e) { return normName(e.name) === normName(r.name); })[0];
        exact = false;
        if (!ex) return;
      }
      if (!Array.isArray(ex.sets)) ex.sets = [];
      var sameShape = ex.sets.length === r.countAfter;
      if (sameShape) {
        r.changed.forEach(function (c) {
          var s = ex.sets[c.index];
          if (!s || s.done) return; // never rewrite a set completed since
          s.rpe = c.rpe;
          if (c.hadType) s.type = c.type; else delete s.type;
          if (c.hadConfirmed) s.rpeConfirmed = c.rpeConfirmed; else delete s.rpeConfirmed;
        });
        r.removed.forEach(function (rm) { ex.sets.splice(rm.index, 0, rm.set); });
      } else {
        exact = false;
        r.removed.forEach(function (rm) { ex.sets.push(rm.set); });
      }
    });
    delete out.spotter.maintenance;
    return { day: out, undone: true, exact: exact };
  }

  // Weekly loads for the Stats chart: nWeeks blocks of 7 days, the last one ending on activeDate.
  function weeklyLoadSeries(logs, exams, activeDate, cfg) {
    cfg = cfg || CONFIG;
    var today = keyToDayNum(activeDate);
    var list = cleanExams(exams).map(function (e) { return keyToDayNum(e.date); });
    var out = [];
    for (var w = cfg.CHART_WEEKS - 1; w >= 0; w--) {
      var end = today - 7 * w;
      var wk = weekLoad(logs, end);
      wk.isCurrent = w === 0;
      wk.hasExam = list.some(function (d) { return d >= end - 6 && d <= end; });
      out.push(wk);
    }
    return out;
  }

  // =====================================================================
  // 4. ACT III - PROTEIN ON A HOSTEL BUDGET (integer linear programme)
  // =====================================================================
  //
  //   decision  x_i = whole servings of item i,  0 <= x_i <= maxServings_i
  //   minimise  sum(price_i * x_i)
  //   subject to  sum(protein_i * x_i) >= gap
  //               sum(calories_i * x_i) <= caloriesRemaining
  //               sum(price_i * x_i)    <= budget
  //   ties on cost: fewer calories, then fewer different items.
  //
  // Solved exactly by branch and bound. The bound at each node is the LP
  // relaxation of what is left with the calorie limit dropped: "the cheapest
  // way to cover the remaining protein if servings could be fractional". With a
  // single covering constraint that LP is solved by taking items in order of
  // price per gram of protein.
  //
  // All arithmetic is on whole numbers: price in paise, protein and calories in
  // thousandths. So cost ties are exact, with no floating-point surprises.

  function priceOf(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = typeof v === "number" ? v : num(String(v));
    return n > 0 ? n : null;
  }

  function maxServingsOf(v, cfg) {
    var n = Math.floor(typeof v === "number" ? v : num(String(v == null ? "" : v)));
    if (!(n >= 1)) return cfg.CANTEEN_MAX_SERVINGS_DEFAULT;
    return Math.min(n, cfg.CANTEEN_MAX_SERVINGS_LIMIT);
  }

  function nonNeg(v) {
    var n = typeof v === "number" ? v : num(String(v == null ? "" : v));
    return n >= 0 ? n : NaN;
  }

  // Splits the catalog into items the solver can use and items it must ignore.
  function prepareItems(catalog, cfg) {
    cfg = cfg || CONFIG;
    var usable = [], unpriced = [], unavailable = [];
    (Array.isArray(catalog) ? catalog : []).forEach(function (it, idx) {
      if (!it) return;
      if (it.available === false) { unavailable.push(it); return; }
      var price = priceOf(it.price);
      if (price === null) { unpriced.push(it); return; }
      var pro = nonNeg(it.pro), cal = nonNeg(it.cal);
      if (isNaN(pro) || isNaN(cal)) return;
      usable.push({
        idx: idx, ref: it,
        P: Math.round(price * 100), // paise
        G: Math.round(pro * 1000), // milligrams of protein
        K: Math.round(cal * 1000), // thousandths of a kcal
        max: maxServingsOf(it.maxServings, cfg)
      });
    });
    return { usable: usable, unpriced: unpriced, unavailable: unavailable };
  }

  // Exact minimum-cost cover. Returns null when no combination satisfies all constraints.
  function solveMinCost(items, gapG, calK, budgetP, cfg) {
    cfg = cfg || CONFIG;
    // An item with no protein can only add cost and calories, so it is never part of an optimum.
    var its = items.filter(function (it) { return it.G > 0 && it.P > 0; });
    its.sort(function (a, b) { return a.P * b.G - b.P * a.G || a.K * b.G - b.K * a.G || a.idx - b.idx; });
    var n = its.length, i;
    var sufG = new Array(n + 1); sufG[n] = 0;
    for (i = n - 1; i >= 0; i--) sufG[i] = sufG[i + 1] + its[i].G * its[i].max;

    var best = null, nodes = 0, capped = false;
    var x = new Array(n); for (i = 0; i < n; i++) x[i] = 0;

    // LP bound: cheapest fractional cover of `need` using items from position `from` on.
    function lowerBound(from, need) {
      var cost = 0;
      for (var j = from; j < n && need > 0; j++) {
        var take = Math.min(its[j].G * its[j].max, need);
        cost += take * its[j].P / its[j].G;
        need -= take;
      }
      return need > 0 ? Infinity : cost;
    }

    function better(c, k, d) {
      if (best === null) return true;
      if (c !== best.c) return c < best.c;
      if (k !== best.k) return k < best.k;
      return d < best.d;
    }

    function dfs(pos, c, g, k, d) {
      if (capped) return;
      if (++nodes > cfg.SOLVER_NODE_CAP) { capped = true; return; }
      if (g >= gapG) { // covered: buying anything more only costs more
        if (better(c, k, d)) best = { c: c, g: g, k: k, d: d, x: x.slice() };
        return;
      }
      if (pos === n) return;
      if (g + sufG[pos] < gapG) return; // not enough protein left to ever cover the gap
      var limit = best === null ? budgetP : Math.min(best.c, budgetP);
      // Strictly worse than the best known cost -> cut. Equal cost is kept for the tie-breaks.
      if (c + Math.ceil(lowerBound(pos, gapG - g) - 1e-6) > limit) return;
      var it = its[pos];
      for (var q = it.max; q >= 0; q--) {
        var nc = c + q * it.P, nk = k + q * it.K;
        if (nc > budgetP || nk > calK) continue;
        x[pos] = q;
        dfs(pos + 1, nc, g + q * it.G, nk, d + (q > 0 ? 1 : 0));
      }
      x[pos] = 0;
    }

    dfs(0, 0, 0, 0, 0);
    if (best === null) return { found: false, nodes: nodes, exact: !capped };
    return { found: true, picks: picksFrom(its, best.x), nodes: nodes, exact: !capped };
  }

  // Fallback when the gap cannot be closed: the most protein that budget and calories allow.
  // Ties on protein: lower cost, then fewer calories, then fewer different items.
  function solveMaxProtein(items, calK, budgetP, cfg) {
    cfg = cfg || CONFIG;
    var its = items.filter(function (it) { return it.G > 0 && it.P > 0; });
    its.sort(function (a, b) { return b.G * a.P - a.G * b.P || a.idx - b.idx; }); // protein per rupee, best first
    var n = its.length, i;
    var pos = {}; its.forEach(function (it, j) { pos[it.idx] = j; });
    var byCal = its.slice().sort(function (a, b) {
      if (a.K === 0 || b.K === 0) return (a.K === 0 ? -1 : 0) - (b.K === 0 ? -1 : 0);
      return b.G * a.K - a.G * b.K;
    }); // protein per kcal, best first
    var sufG = new Array(n + 1); sufG[n] = 0;
    for (i = n - 1; i >= 0; i--) sufG[i] = sufG[i + 1] + its[i].G * its[i].max;

    var best = { g: 0, c: 0, k: 0, d: 0, x: its.map(function () { return 0; }) };
    var nodes = 0, capped = false;
    var x = its.map(function () { return 0; });

    // LP bounds: fractional knapsack on money alone, and on calories alone. The true answer is below both.
    function boundBudget(from, money) {
      var g = 0;
      for (var j = from; j < n && money > 0; j++) {
        var spend = Math.min(its[j].P * its[j].max, money);
        g += spend * its[j].G / its[j].P;
        money -= spend;
      }
      return g;
    }
    function boundCal(from, kcal) {
      var g = 0;
      for (var j = 0; j < n; j++) {
        var it = byCal[j];
        if (pos[it.idx] < from) continue;
        if (it.K === 0) { g += it.G * it.max; continue; }
        if (kcal <= 0) break;
        var use = Math.min(it.K * it.max, kcal);
        g += use * it.G / it.K;
        kcal -= use;
      }
      return g;
    }

    function better(g, c, k, d) {
      if (g !== best.g) return g > best.g;
      if (c !== best.c) return c < best.c;
      if (k !== best.k) return k < best.k;
      return d < best.d;
    }

    function dfs(p, c, g, k, d) {
      if (capped) return;
      if (++nodes > cfg.SOLVER_NODE_CAP) { capped = true; return; }
      if (better(g, c, k, d)) best = { g: g, c: c, k: k, d: d, x: x.slice() };
      if (p === n) return;
      var ub = Math.min(sufG[p], boundBudget(p, budgetP - c), boundCal(p, calK - k));
      if (g + Math.floor(ub + 1e-6) < best.g) return; // cannot even tie the best protein
      var it = its[p];
      for (var q = it.max; q >= 0; q--) {
        var nc = c + q * it.P, nk = k + q * it.K;
        if (nc > budgetP || nk > calK) continue;
        x[p] = q;
        dfs(p + 1, nc, g + q * it.G, nk, d + (q > 0 ? 1 : 0));
      }
      x[p] = 0;
    }

    dfs(0, 0, 0, 0, 0);
    return { found: best.g > 0, picks: picksFrom(its, best.x), nodes: nodes, exact: !capped };
  }

  function picksFrom(its, x) {
    var picks = [];
    for (var i = 0; i < its.length; i++) if (x[i] > 0) picks.push({ item: its[i], servings: x[i] });
    picks.sort(function (a, b) { return a.item.idx - b.item.idx; });
    return picks;
  }

  function buildPlan(picks) {
    var lines = [], t = { cost: 0, pro: 0, cal: 0, carb: 0, fat: 0, distinct: 0, costPaise: 0 };
    picks.forEach(function (p) {
      var it = p.item.ref, q = p.servings;
      var price = priceOf(it.price);
      var line = {
        idx: p.item.idx, id: it.id, name: String(it.name == null ? "" : it.name), servings: q,
        price: price, cost: p.item.P * q / 100,
        pro: (nonNeg(it.pro) || 0) * q, cal: (nonNeg(it.cal) || 0) * q,
        carb: (nonNeg(it.carb) || 0) * q, fat: (nonNeg(it.fat) || 0) * q
      };
      lines.push(line);
      t.costPaise += p.item.P * q;
      t.pro += line.pro; t.cal += line.cal; t.carb += line.carb; t.fat += line.fat; t.distinct++;
    });
    t.cost = t.costPaise / 100;
    t.pro = round(t.pro, 3); t.cal = round(t.cal, 3); t.carb = round(t.carb, 3); t.fat = round(t.fat, 3);
    return { lines: lines, totals: t };
  }

  // Public entry point for ACT III.
  // status: "no-gap" | "no-calories" | "no-budget" | "no-items" | "optimal" | "fallback" | "nothing-fits"
  function solveCombo(catalog, params, cfg) {
    cfg = cfg || CONFIG;
    var gap = Number(params.gap), cal = Number(params.caloriesRemaining), budget = Number(params.budget);
    var prep = prepareItems(catalog, cfg);
    var out = {
      status: "", inputs: { gap: gap, caloriesRemaining: cal, budget: budget },
      usableCount: prep.usable.length,
      unpriced: prep.unpriced.map(function (it) { return String(it.name == null ? "" : it.name); }),
      unavailableCount: prep.unavailable.length,
      plan: null, exact: true, nodes: 0
    };
    if (!(gap > 0)) { out.status = "no-gap"; return out; }
    if (!(cal > 0)) { out.status = "no-calories"; return out; }
    if (!(budget > 0)) { out.status = "no-budget"; return out; }
    if (!prep.usable.length) { out.status = "no-items"; return out; }

    var gapG = Math.round(gap * 1000), calK = Math.round(cal * 1000), budgetP = Math.round(budget * 100);
    var res = solveMinCost(prep.usable, gapG, calK, budgetP, cfg);
    out.nodes = res.nodes; out.exact = res.exact;
    if (res.found) { out.status = "optimal"; out.plan = buildPlan(res.picks); return out; }

    var fb = solveMaxProtein(prep.usable, calK, budgetP, cfg);
    out.nodes += fb.nodes; out.exact = out.exact && fb.exact;
    if (!fb.found) { out.status = "nothing-fits"; return out; }
    out.status = "fallback"; out.plan = buildPlan(fb.picks);
    return out;
  }

  // =====================================================================
  // 5. SAFETY - calorie floor and low-intake flag
  // =====================================================================

  function cleanFloor(v, cfg) {
    cfg = cfg || CONFIG;
    var n = typeof v === "number" ? v : num(String(v == null ? "" : v));
    if (!(n > 0)) return cfg.CALORIE_FLOOR_DEFAULT;
    return Math.min(cfg.CALORIE_FLOOR_MAX, Math.max(cfg.CALORIE_FLOOR_MIN, Math.round(n)));
  }

  // If the calorie goal is under the floor, Spotter plans against the floor instead.
  function effectiveCalorieGoal(goalCal, floor) {
    var g = Number(goalCal);
    if (!(g > 0)) return { effective: floor, belowFloor: true, goal: g };
    return g < floor ? { effective: floor, belowFloor: true, goal: g } : { effective: g, belowFloor: false, goal: g };
  }

  function dayTotals(day) {
    var t = { cal: 0, pro: 0, carb: 0, fat: 0, count: 0 };
    ((day && Array.isArray(day.foods)) ? day.foods : []).forEach(function (f) {
      if (!f) return;
      t.cal += Number(f.cal) || 0; t.pro += Number(f.pro) || 0;
      t.carb += Number(f.carb) || 0; t.fat += Number(f.fat) || 0; t.count++;
    });
    return t;
  }

  // The numbers the solver card starts from.
  function nutritionGap(goals, day, floor) {
    var t = dayTotals(day);
    var eff = effectiveCalorieGoal(goals && goals.cal, floor);
    return {
      totals: t,
      proteinGap: Math.max(0, round((Number(goals && goals.pro) || 0) - t.pro, 1)),
      caloriesRemaining: round(eff.effective - t.cal, 1),
      effectiveGoal: eff.effective, belowFloor: eff.belowFloor, floor: floor
    };
  }

  // Low-intake flag: 3 or more logged days in a row, before activeDate, each under the floor.
  // A day is "logged" only if it has at least 2 foods. Days with fewer are unknown and are
  // skipped, but logged days more than 3 calendar days apart do not count as "in a row".
  // activeDate itself is left out: that day may not be finished.
  function lowIntake(logs, activeDate, floor, cfg) {
    cfg = cfg || CONFIG;
    var today = keyToDayNum(activeDate), streak = [], prev = today;
    for (var d = today - 1; d >= today - cfg.LOW_INTAKE_LOOKBACK_DAYS; d--) {
      var key = dayNumToKey(d);
      var t = dayTotals(logs ? logs[key] : null);
      if (t.count < cfg.LOGGED_DAY_MIN_FOODS) continue; // not a logged day: unknown, not zero
      if (prev - d > cfg.LOW_INTAKE_MAX_GAP_DAYS) break;
      if (!(t.cal < floor)) break;
      streak.push({ date: key, cal: t.cal });
      prev = d;
    }
    return { flag: streak.length >= cfg.LOW_INTAKE_MIN_DAYS, days: streak.length, streak: streak, floor: floor };
  }

  // =====================================================================
  // 6. EXPLANATIONS ("Why?") - fixed templates, no language model
  // =====================================================================
  // Each builder returns { title, lead, rows: [[label, value]], formula: [lines], notes: [lines] }.
  // Values are plain text; the UI escapes them before putting them on screen.

  var DISCLAIMER = "Wellness guidance, not medical advice.";

  function setText(t) { return fmt(t.w, t.w % 1 ? 1 : 0) + " kg × " + fmt(t.r, 0) + " @ RPE " + fmt(t.rpe, t.rpe % 1 ? 1 : 0); }

  function lowConfidenceText(r) {
    if (r.status !== "verdict" || r.confidence !== "low") return "";
    var parts = [];
    var rpe = fmt(r.today.rpe, r.today.rpe % 1 ? 1 : 0);
    if (r.lowReasons.indexOf("rpe-prefilled") >= 0) parts.push("Low confidence: RPE was pre-filled at " + rpe + ". Tap PE to enter how hard it really felt.");
    else if (r.lowReasons.indexOf("rpe-unknown") >= 0) parts.push("Low confidence: this RPE (" + rpe + ") was logged before Spotter tracked whether you typed it. Tap PE to enter how hard it really felt.");
    if (r.lowReasons.indexOf("reps-autofilled") >= 0) parts.push((parts.length ? "" : "Low confidence: ") + "Reps were auto-filled from your target range. Check the reps box.");
    return parts.join(" ");
  }

  function explainReadiness(r, exName) {
    var name = String(exName == null ? "" : exName);
    var formula = [
      "RIR = 10 − RPE",
      "e1RM = weight × (1 + (reps + RIR) / 30)",
      "z = (today − predicted) / typical swing"
    ];
    if (r.status === "placeholder") {
      return { title: name, lead: "This is a template name, so Spotter does not track a trend for it. Give the exercise its real name to start one.", rows: [], formula: [], notes: [DISCLAIMER] };
    }
    if (r.status === "no-set") {
      var why = r.skipped.length
        ? r.skipped.map(function (s) { return "Set " + (s.index + 1) + ": " + s.text + "."; })
        : ["No set is ticked yet."];
      return {
        title: name, lead: "No working set to read yet.",
        rows: [],
        formula: formula.slice(0, 2),
        notes: why.concat(["Spotter reads the first ticked set that is normal or to failure, with 1–12 reps and RPE 6–10. Outside that range the e1RM formula is not reliable, so the set is skipped.", DISCLAIMER])
      };
    }
    if (r.status === "building") {
      return {
        title: name,
        lead: "Building your trend: " + r.n + " of " + r.need + " sessions logged.",
        rows: [["Today's set", setText(r.today)], ["Today's e1RM", fmt(r.today.e1rm, 1) + " kg"]],
        formula: formula.slice(0, 2),
        notes: ["Spotter needs " + r.need + " earlier sessions of this lift (in the last " + CONFIG.READINESS_WINDOW_DAYS + " days) before it compares today with your trend.", DISCLAIMER]
      };
    }
    if (r.status === "unstable") {
      return { title: name, lead: "Your recent sessions do not give a usable trend yet.", rows: [], formula: formula, notes: [DISCLAIMER] };
    }
    var up = r.pctDiff >= 0;
    var suggestion = r.verdict.key === "pr"
      ? "You are clearly above your trend today. A good day to try for a PR."
      : (r.verdict.key === "drop"
        ? "You are clearly below your trend today. Keep the weight on the bar and do one set fewer."
        : "You are within your usual day-to-day swing. Train as planned.");
    var notes = [
      "The trend is a straight line fitted through the first working set of your last " + r.n + " sessions. Today's set is compared with the line, not with any single past session.",
      "\"Typical swing\" is how far your past sessions usually sit from that line (" + fmt(r.sRaw, 1) + " kg" + (r.sFloored ? ", raised to the minimum of 1.5% of the prediction" : "") + ").",
      "Above +1 swing is green, below −1 swing is red, in between is amber."
    ];
    if (r.dropped) notes.push("One past session (" + r.dropped.date + ", " + fmt(r.dropped.e1rm, 1) + " kg) was far off the others and was set aside, so a single odd day does not bend your trend.");
    notes.push(r.historyConfirmed + " of the " + r.n + " past sessions have an RPE you typed yourself. The rest used the pre-filled target RPE.");
    var low = lowConfidenceText(r);
    if (low) notes.push(low);
    notes.push("RPE is subjective, so Spotter trusts your trend over any single day.");
    notes.push(DISCLAIMER);
    return {
      title: name,
      lead: r.verdict.long + ". " + suggestion,
      rows: [
        ["Today's set", setText(r.today)],
        ["Today's e1RM", fmt(r.today.e1rm, 1) + " kg"],
        ["Predicted from trend", fmt(r.predicted, 1) + " kg"],
        ["Difference", (up ? "+" : "−") + fmt(Math.abs(r.pctDiff), 1) + "%"],
        ["Typical swing", "±" + fmt(r.s, 1) + " kg"],
        ["Score (z)", (r.z >= 0 ? "+" : "−") + fmt(Math.abs(r.z), 2)],
        ["Sessions used", String(r.n)],
        ["Trend", (r.slopePerWeek >= 0 ? "+" : "−") + fmt(Math.abs(r.slopePerWeek), 2) + " kg per week"]
      ],
      formula: formula,
      notes: notes
    };
  }

  function examLine(e) {
    if (e.daysAway === 0) return e.label + " is today";
    if (e.daysAway === 1) return e.label + " is tomorrow";
    return e.label + " in " + e.daysAway + " days";
  }

  // Short text for the Autopilot card.
  function autopilotText(a) {
    var cfg = CONFIG, out = { title: "", body: "", tone: "amber" };
    var reasons = [];
    if (a.highLoad) reasons.push("your load is " + fmt(a.load.ratio, 2) + "× your 4-week average");
    if (a.lowSleep) reasons.push("you have averaged " + fmt(a.sleep.avg, 1) + " h of sleep");
    if (a.kind === "maintenance") {
      out.title = "Maintenance mode in exam week";
      out.body = "Keep the weights. Do about 60% of your sets. Stop at RPE " + cfg.MAINT_RPE_CAP + ". No sets to failure.";
    } else if (a.kind === "maintenance-strong") {
      out.title = "Maintenance mode in exam week";
      out.body = "Strongly suggested this week: " + reasons.join(" and ") + ". Keep the weights, do about 60% of your sets, stop at RPE " + cfg.MAINT_RPE_CAP + ", no sets to failure.";
      out.tone = "red";
    } else if (a.kind === "ramp") {
      out.title = "Exams done: ramp back up";
      out.body = "Do about 80% of your usual sets this week, then return to normal.";
      out.tone = "green";
    } else if (a.kind === "load-flag") {
      out.title = a.load.band.label;
      out.body = "This week is " + fmt(a.load.ratio, 2) + "× your 4-week average. Consider an easier session. A warning flag, not an injury predictor.";
      out.tone = a.load.band.tone;
    } else if (a.countdown) {
      out.title = "Exam coming up";
      out.body = "Train as normal for now. Spotter will suggest maintenance mode in exam week.";
      out.tone = "blue";
    }
    return out;
  }

  function explainAutopilot(a) {
    var cfg = CONFIG, rows = [], notes = [];
    if (a.exam.next) rows.push(["Next exam", examLine(a.exam.next) + " (" + a.exam.next.date + ")"]);
    else if (a.exam.last) rows.push(["Last exam", a.exam.last.label + ", " + a.exam.last.daysAgo + " day" + (a.exam.last.daysAgo === 1 ? "" : "s") + " ago"]);
    else rows.push(["Exams", "None in your calendar"]);

    rows.push(["This week's load", a.load.acute.hasData ? fmt(a.load.acute.load, 0) + " (" + a.load.acute.count + " session" + (a.load.acute.count === 1 ? "" : "s") + ")" : "No session load logged"]);
    if (a.load.chronic !== null) rows.push(["4-week average", fmt(a.load.chronic, 0) + " per week (" + a.load.weeksWithData + " week" + (a.load.weeksWithData === 1 ? "" : "s") + " with data)"]);
    if (a.load.status === "ok") rows.push(["Ratio", fmt(a.load.ratio, 2) + " · " + a.load.band.label]);
    else if (a.load.status === "not-enough") rows.push(["Ratio", "Not enough history yet"]);
    else rows.push(["Ratio", "No load logged this week"]);
    rows.push(["Sleep", a.sleep ? fmt(a.sleep.avg, 1) + " h average over " + a.sleep.n + " night" + (a.sleep.n === 1 ? "" : "s") : "No sleep logged"]);

    var t = autopilotText(a);
    if (a.exam.mode === "exam") notes.push("An exam falls within the next 7 days, so this counts as exam week.");
    if (a.exam.mode === "ramp") notes.push("Your last exam was within the past 7 days and none is coming in the next 7, so this is a ramp-back week.");
    if (a.kind === "maintenance-strong") notes.push("The wording is stronger because " + (a.highLoad ? "the ratio is above " + cfg.BAND_HIGH : "") + (a.highLoad && a.lowSleep ? " and " : "") + (a.lowSleep ? "average sleep is under " + cfg.SLEEP_LOW_HOURS + " h" : "") + ".");
    if (a.load.status === "not-enough") notes.push("The ratio needs at least " + cfg.LOAD_MIN_CHRONIC_WEEKS + " of the previous 4 weeks to have a logged load. Log session RPE and minutes to build it.");
    notes.push("A day counts only when both session RPE and minutes are logged. A week with nothing logged is treated as missing, not as zero.");
    notes.push("Bands: under " + cfg.BAND_LOW + " lighter than usual, " + cfg.BAND_LOW + "–" + cfg.BAND_HIGH + " normal, " + cfg.BAND_HIGH + "–" + cfg.BAND_SPIKE + " climbing fast, over " + cfg.BAND_SPIKE + " big spike.");
    notes.push("Load spikes are flags, not injury predictions.");
    notes.push(DISCLAIMER);
    return {
      title: "Exam-Week Autopilot",
      lead: t.title ? t.title + ". " + t.body : "Nothing to flag right now.",
      rows: rows,
      formula: ["load = session RPE × minutes", "ratio = this week's load / average weekly load of the 4 weeks before"],
      notes: notes
    };
  }

  function rupees(n) { return "₹" + fmt(n, n % 1 ? 2 : 0); }
  function grams(n) { return fmt(n, n % 1 ? 1 : 0) + " g"; }
  function kcal(n) { return fmt(n, 0) + " kcal"; }

  // One-line result message for the solver card.
  function solverMessage(res) {
    var i = res.inputs;
    switch (res.status) {
      case "no-gap": return "You have already reached today's protein goal.";
      case "no-calories": return "Today's calories are used up, so Spotter will not suggest adding more food.";
      case "no-budget": return "Enter a budget in rupees to search.";
      case "no-items": return res.unpriced.length ? "Add prices in the Spotter tab first. The search only uses items that have a price." : "Your canteen list has no available items.";
      case "optimal": return "Cheapest combo that closes your " + grams(i.gap) + " gap: " + rupees(res.plan.totals.cost) + ".";
      case "fallback": return "With " + rupees(i.budget) + " and " + kcal(i.caloriesRemaining) + " left, the most you can get is " + grams(res.plan.totals.pro) + " of your " + grams(i.gap) + " gap.";
      case "nothing-fits": return "With " + rupees(i.budget) + " and " + kcal(i.caloriesRemaining) + " left, no priced item fits.";
    }
    return "";
  }

  function explainSolver(res) {
    var i = res.inputs, rows = [
      ["Protein gap", grams(i.gap)], ["Budget", rupees(i.budget)], ["Calories left", kcal(i.caloriesRemaining)],
      ["Items searched", res.usableCount + " with a price"]
    ];
    var notes = [];
    if (res.plan) {
      rows.push(["Result cost", rupees(res.plan.totals.cost)]);
      rows.push(["Result protein", grams(res.plan.totals.pro)]);
      rows.push(["Result calories", kcal(res.plan.totals.cal)]);
    }
    if (res.status === "optimal") {
      notes.push("Spotter checked every way of buying whole servings of your priced canteen items. No other combination reaches " + grams(i.gap) + " of protein for less money while staying within " + kcal(i.caloriesRemaining) + " and " + rupees(i.budget) + ".");
      notes.push("If two combinations cost the same, it picks the one with fewer calories, then the one with fewer different items.");
    } else if (res.status === "fallback") {
      notes.push("No combination closes the whole gap inside your budget and calories. So Spotter switched question: what is the most protein you can get? That is the answer shown.");
    }
    if (res.unpriced.length) notes.push("Ignored because they have no price: " + res.unpriced.join(", ") + ".");
    if (res.unavailableCount) notes.push(res.unavailableCount + " item" + (res.unavailableCount === 1 ? " is" : "s are") + " marked not available and ignored.");
    if (!res.exact) notes.push("The search hit its safety limit, so this answer is good but not proven to be the cheapest.");
    notes.push("Method: integer linear programming, solved by branch and bound. Servings are whole numbers and each item has a maximum.");
    notes.push("Calories left is measured against your calorie goal, or the calorie floor if your goal is below it. Spotter only ever suggests adding food here.");
    notes.push("Food values are averages and canteen portions vary. " + DISCLAIMER);
    return {
      title: "Protein on a Hostel Budget",
      lead: solverMessage(res),
      rows: rows,
      formula: ["minimise  cost = Σ price × servings", "subject to  protein ≥ gap", "            calories ≤ remaining", "            cost ≤ budget", "            servings whole, 0 … max"],
      notes: notes
    };
  }

  function lowIntakeText(li) {
    return "Your logged intake has been under " + fmt(li.floor, 0) + " kcal for " + li.days + " logged days in a row. If that is not intentional, consider eating a bit more. " + DISCLAIMER;
  }

  function explainLowIntake(li) {
    return {
      title: "Low-intake note",
      lead: lowIntakeText(li),
      rows: li.streak.slice().reverse().map(function (d) { return [d.date, kcal(d.cal)]; }),
      formula: ["flag when 3 or more logged days in a row are below the calorie floor"],
      notes: [
        "Only days with at least " + CONFIG.LOGGED_DAY_MIN_FOODS + " foods logged are counted. Days with fewer are treated as not logged, not as zero.",
        "Today is not counted, because the day may not be finished.",
        "The floor (" + fmt(li.floor, 0) + " kcal) is a general wellness setting you can change in the Spotter tab. It is not personalised.",
        "If your logs are just incomplete, you can ignore this note."
      ]
    };
  }

  function floorWarningText(goalCal, floor) {
    return "This goal is under your calorie floor of " + fmt(floor, 0) + " kcal. You can save it, but Spotter will plan against " + fmt(floor, 0) + " kcal. " + DISCLAIMER;
  }

  // =====================================================================
  // 7. DATA - migrate, backup, storage
  // =====================================================================

  function slug(name) {
    return normName(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
  }

  function cleanCanteenItem(it, used, cfg) {
    var base = (typeof it.id === "string" && /^[a-z0-9-]{1,60}$/.test(it.id)) ? it.id : slug(it.name);
    var id = base, k = 2;
    while (used[id]) id = base + "-" + (k++);
    used[id] = true;
    function n0(v) { var n = nonNeg(v); return isNaN(n) ? 0 : n; }
    return {
      id: id,
      name: String(it.name == null ? "" : it.name).trim().slice(0, 60) || "Item",
      cal: n0(it.cal), pro: n0(it.pro), carb: n0(it.carb), fat: n0(it.fat),
      price: priceOf(it.price),
      maxServings: maxServingsOf(it.maxServings, cfg),
      available: it.available !== false
    };
  }

  function cleanCanteen(list, cfg) {
    cfg = cfg || CONFIG;
    var used = {};
    return (Array.isArray(list) ? list : []).filter(function (it) { return it && typeof it === "object"; })
      .map(function (it) { return cleanCanteenItem(it, used, cfg); });
  }

  // Canteen list pre-filled from the app's quick foods, with NO prices.
  function canteenFromStaples(staples, cfg) {
    return cleanCanteen((staples || []).map(function (s) {
      return { name: s.name, cal: s.cal, pro: s.pro, carb: s.carb, fat: s.fat, price: null };
    }), cfg);
  }

  function cleanSettings(s, cfg) {
    cfg = cfg || CONFIG;
    var out = {};
    if (s && typeof s === "object" && !Array.isArray(s)) { for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) out[k] = s[k]; }
    out.calorieFloor = cleanFloor(out.calorieFloor, cfg);
    out.lastBudget = priceOf(out.lastBudget);
    out.lastBackupAt = (typeof out.lastBackupAt === "string" && out.lastBackupAt) ? out.lastBackupAt : null;
    return out;
  }

  // Brings stored Spotter data up to the current shape. Never touches workout logs.
  // Only fills in what is missing; running it twice gives the same result as once.
  function migrate(raw, staples, cfg) {
    cfg = cfg || CONFIG;
    raw = (raw && typeof raw === "object") ? raw : {};
    return {
      schemaVersion: cfg.SCHEMA_VERSION,
      settings: cleanSettings(raw.settings, cfg),
      exams: cleanExams(raw.exams),
      canteen: Array.isArray(raw.canteen) ? cleanCanteen(raw.canteen, cfg) : canteenFromStaples(staples, cfg)
    };
  }

  function isPlainObject(o) { return !!o && typeof o === "object" && !Array.isArray(o); }

  // Checks a backup file before anything is overwritten. Accepts:
  //   - the original format  { workoutLogs, macroGoals }
  //   - a bare logs object   { "YYYY-MM-DD": day, ... }   (the old importer accepted this too)
  //   - the Spotter format   { workoutLogs, macroGoals, spotter, schemaVersion }
  function validateBackup(obj, staples, cfg) {
    cfg = cfg || CONFIG;
    var res = { ok: false, errors: [], warnings: [], format: "", logs: null, goals: null, spotter: null, summary: null };
    if (!isPlainObject(obj)) { res.errors.push("This file is not a tracker backup."); return res; }
    if (obj.demo === true) { res.errors.push("This file is a demo-data export. It cannot be imported over your real logbook."); return res; }

    var logs;
    if (obj.workoutLogs !== undefined) { logs = obj.workoutLogs; res.format = isPlainObject(obj.spotter) ? "spotter" : "legacy"; }
    else { logs = obj; res.format = "legacy-bare"; }
    if (!isPlainObject(logs)) { res.errors.push("The backup has no workout log."); return res; }

    var keys = Object.keys(logs);
    if (!keys.length) { res.errors.push("The backup contains no days. Importing it would erase your logbook, so it was refused."); return res; }
    var sets = 0, foods = 0;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], day = logs[k];
      if (!isDateKey(k)) { res.errors.push("Unexpected entry \"" + String(k).slice(0, 30) + "\": not a date."); break; }
      if (!isPlainObject(day)) { res.errors.push("Day " + k + " is not a valid day record."); break; }
      if (day.exercises !== undefined && !Array.isArray(day.exercises)) { res.errors.push("Day " + k + ": exercises is not a list."); break; }
      if (day.foods !== undefined && !Array.isArray(day.foods)) { res.errors.push("Day " + k + ": foods is not a list."); break; }
      var bad = (day.exercises || []).some(function (ex) {
        if (!isPlainObject(ex) || (ex.sets !== undefined && !Array.isArray(ex.sets))) return true;
        sets += (ex.sets || []).length;
        return false;
      });
      if (bad) { res.errors.push("Day " + k + ": an exercise record is malformed."); break; }
      foods += (day.foods || []).length;
    }
    if (res.errors.length) return res;

    if (obj.workoutLogs !== undefined && obj.macroGoals !== undefined) {
      var g = obj.macroGoals;
      var okGoals = isPlainObject(g) && ["cal", "pro", "carb", "fat"].every(function (f) { return typeof g[f] === "number" && isFinite(g[f]) && g[f] > 0; });
      if (okGoals) res.goals = { cal: g.cal, pro: g.pro, carb: g.carb, fat: g.fat };
      else res.warnings.push("The macro goals in the file are not valid. Your current goals will be kept.");
    }
    if (isPlainObject(obj.spotter)) res.spotter = migrate(obj.spotter, staples, cfg);

    keys.sort();
    res.logs = logs;
    res.summary = { days: keys.length, first: keys[0], last: keys[keys.length - 1], sets: sets, foods: foods, hasGoals: !!res.goals, hasSpotter: !!res.spotter };
    res.ok = true;
    return res;
  }

  // The backup file. workoutLogs and macroGoals keep their original names so the old importer still reads it.
  function buildExport(logs, goals, spotterState, exportedAt, isDemo, cfg) {
    cfg = cfg || CONFIG;
    var out = {
      workoutLogs: logs,
      macroGoals: goals,
      spotter: { canteen: spotterState.canteen, exams: spotterState.exams, settings: spotterState.settings },
      schemaVersion: cfg.SCHEMA_VERSION,
      app: "Spotter",
      exportedAt: exportedAt
    };
    if (isDemo) out.demo = true;
    return out;
  }

  var DEMO_FLAG_KEY = "spotter_demo_active";
  var SCHEMA_KEY = "spotter_schemaVersion";
  var SNAPSHOT_KEY = "spotter_preimport_snapshot";

  function storageKeys(demo, keyLogs, keyGoals) {
    return demo
      ? { logs: "spotter_demo_logs", goals: "spotter_demo_goals", exams: "spotter_demo_exams", canteen: "spotter_demo_canteen", settings: "spotter_demo_settings" }
      : { logs: keyLogs, goals: keyGoals, exams: "spotter_exams", canteen: "spotter_canteen", settings: "spotter_settings" };
  }

  // Every read and write of app data goes through this object. It picks the real
  // or the demo key set, so demo mode cannot write to the real keys.
  // `backend` needs get(key) -> string|null and set(key, string).
  function makeStorage(backend, keyLogs, keyGoals) {
    var demo = backend.get(DEMO_FLAG_KEY) === "1";
    var failed = false;

    function put(key, value) {
      backend.set(key, value);
      if (backend.get(key) !== value) failed = true; // the write did not stick (storage full or blocked)
    }
    function read(key) {
      var raw = backend.get(key);
      if (raw === null || raw === undefined || raw === "") return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    }
    function keys() { return storageKeys(demo, keyLogs, keyGoals); }

    return {
      isDemo: function () { return demo; },
      keys: keys,
      writeFailed: function () { return failed; },
      loadLogs: function () { return read(keys().logs); },
      loadGoals: function () { return read(keys().goals); },
      loadSpotter: function () {
        var k = keys();
        return { schemaVersion: demo ? null : read(SCHEMA_KEY), settings: read(k.settings), exams: read(k.exams), canteen: read(k.canteen) };
      },
      saveLogsGoals: function (logs, goals) {
        var k = keys();
        put(k.logs, JSON.stringify(logs));
        put(k.goals, JSON.stringify(goals));
      },
      saveSpotter: function (state) {
        var k = keys();
        put(k.exams, JSON.stringify(state.exams));
        put(k.canteen, JSON.stringify(state.canteen));
        put(k.settings, JSON.stringify(state.settings));
        if (!demo) put(SCHEMA_KEY, JSON.stringify(state.schemaVersion));
      },
      enterDemo: function (data) {
        demo = true;
        put(DEMO_FLAG_KEY, "1");
        var k = keys();
        put(k.logs, JSON.stringify(data.logs));
        put(k.goals, JSON.stringify(data.goals));
        put(k.exams, JSON.stringify(data.exams));
        put(k.canteen, JSON.stringify(data.canteen));
        put(k.settings, JSON.stringify(data.settings));
      },
      exitDemo: function () {
        demo = false;
        put(DEMO_FLAG_KEY, "0");
      },
      saveSnapshot: function (obj) {
        if (demo) return false;
        var before = failed; failed = false;
        put(SNAPSHOT_KEY, JSON.stringify(obj));
        var ok = !failed; failed = before || failed;
        return ok;
      },
      loadSnapshot: function () { return demo ? null : read(SNAPSHOT_KEY); },
      clearSnapshot: function () { if (!demo) put(SNAPSHOT_KEY, ""); }
    };
  }

  // Whole days between a stored ISO timestamp and "now" (both passed in as ms/ISO; no clock is read here).
  function daysSince(iso, nowMs) {
    var t = Date.parse(iso);
    if (isNaN(t)) return null;
    return Math.max(0, Math.floor((nowMs - t) / MS_DAY));
  }

  // Escapes text for safe use inside HTML. Used by all new Spotter rendering.
  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  return {
    CONFIG: CONFIG, DISCLAIMER: DISCLAIMER, VERDICTS: VERDICTS,
    DEMO_FLAG_KEY: DEMO_FLAG_KEY, SCHEMA_KEY: SCHEMA_KEY, SNAPSHOT_KEY: SNAPSHOT_KEY,
    // dates and names
    keyToDayNum: keyToDayNum, dayNumToKey: dayNumToKey, isDateKey: isDateKey, addDays: addDays, diffDays: diffDays,
    num: num, normName: normName, isPlaceholderName: isPlaceholderName, round: round, fmt: fmt, escapeHtml: escapeHtml,
    // act I
    epley: epley, e1rm: e1rm, setEligibility: setEligibility, firstWorkingSet: firstWorkingSet,
    readinessHistory: readinessHistory, ols: ols, findOutlier: findOutlier, readiness: readiness,
    // act II
    dailyLoad: dailyLoad, weekLoad: weekLoad, loadBand: loadBand, loadSummary: loadSummary,
    cleanExams: cleanExams, examStatus: examStatus, validSleep: validSleep, sleepAverage: sleepAverage,
    autopilot: autopilot, targetSets: targetSets, setPlan: setPlan,
    applyMaintenance: applyMaintenance, undoMaintenance: undoMaintenance, weeklyLoadSeries: weeklyLoadSeries,
    // act III
    priceOf: priceOf, prepareItems: prepareItems, solveMinCost: solveMinCost, solveMaxProtein: solveMaxProtein, solveCombo: solveCombo,
    // safety
    cleanFloor: cleanFloor, effectiveCalorieGoal: effectiveCalorieGoal, dayTotals: dayTotals, nutritionGap: nutritionGap, lowIntake: lowIntake,
    // explanations
    explainReadiness: explainReadiness, lowConfidenceText: lowConfidenceText, autopilotText: autopilotText, explainAutopilot: explainAutopilot,
    solverMessage: solverMessage, explainSolver: explainSolver, lowIntakeText: lowIntakeText, explainLowIntake: explainLowIntake,
    floorWarningText: floorWarningText, examLine: examLine,
    // data
    slug: slug, cleanCanteen: cleanCanteen, canteenFromStaples: canteenFromStaples, cleanSettings: cleanSettings,
    migrate: migrate, validateBackup: validateBackup, buildExport: buildExport,
    storageKeys: storageKeys, makeStorage: makeStorage, daysSince: daysSince
  };
});
