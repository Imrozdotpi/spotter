/*
 * Spotter UI.
 *
 * Rendering and event wiring for everything Spotter adds to the tracker.
 * All decisions come from src/spotter-core.js; this file only reads the app's
 * existing globals (logs, goals, activeDate, saveAll, renderWorkout, ...),
 * calls the core, and draws the result.
 *
 * Rule for this file: every piece of user text (exercise names, food names,
 * exam labels, file contents) goes through esc() before it reaches innerHTML,
 * and inline handlers only ever receive numbers.
 */
(function () {
  "use strict";

  var C = SpotterCore;
  var CFG = C.CONFIG;
  var esc = C.escapeHtml;

  // Spotter's own stored data: { schemaVersion, settings, exams, canteen }
  var state = C.migrate(null, STAPLES);
  var pendingImport = null;

  function $(id) { return document.getElementById(id); }
  function todayKey() { return toDateKey(new Date()); }
  function day() { return ensureDay(activeDate); }
  function floor() { return C.cleanFloor(state.settings.calorieFloor); }

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  function loadState() {
    state = C.migrate(SpotterStore.loadSpotter(), STAPLES);
  }

  function saveState() {
    SpotterStore.saveSpotter(state);
    refresh();
  }

  // ------------------------------------------------------------------
  // Bottom sheet (one reusable modal)
  // ------------------------------------------------------------------
  var CLOSE_BTN = '<button class="btn btn-dark sp-btn" style="width:100%; margin-top:12px;" onclick="closeModals()">Close</button>';

  function openSheet(html) {
    $("spModalBody").innerHTML = html;
    $("spModal").classList.add("open");
    $("spModal").firstElementChild.scrollTop = 0;
  }

  // Turns an explanation object from the core into HTML. All text is escaped here.
  function explainHtml(e, kicker) {
    var h = '<div class="sp-kicker">' + esc(kicker || "Why?") + "</div>";
    h += '<div class="sp-title" style="margin:2px 0 4px;">' + esc(e.title) + "</div>";
    if (e.lead) h += "<p>" + esc(e.lead) + "</p>";
    (e.rows || []).forEach(function (r) {
      h += '<div class="sp-row"><span>' + esc(r[0]) + "</span><span>" + esc(r[1]) + "</span></div>";
    });
    if (e.formula && e.formula.length) h += '<div class="sp-formula">' + esc(e.formula.join("\n")) + "</div>";
    if (e.notes && e.notes.length) {
      h += '<ul style="margin-top:10px;">' + e.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>";
    }
    return h;
  }

  function messageSheet(title, lines, buttonsHtml) {
    var h = '<div class="sp-title" style="margin-bottom:6px;">' + esc(title) + "</div>";
    h += lines.map(function (l) { return "<p>" + esc(l) + "</p>"; }).join("");
    openSheet(h + (buttonsHtml || CLOSE_BTN));
  }

  // ------------------------------------------------------------------
  // Backup, restore, undo
  // ------------------------------------------------------------------
  function exportBackup() {
    var demo = SpotterStore.isDemo();
    var stamp = new Date().toISOString();
    var data = C.buildExport(logs, goals, state, stamp, demo);
    var name = (demo ? "spotter-DEMO-backup-" : "spotter-backup-") + activeDate + ".json";
    try {
      var blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    } catch (e) {
      messageSheet("Backup failed", ["This browser could not create the backup file."]);
      return;
    }
    if (!demo) {
      state.settings.lastBackupAt = stamp;
      saveState();
    }
  }

  function importBackup(ev) {
    var input = ev.target;
    var f = input.files && input.files[0];
    if (!f) return;
    if (SpotterStore.isDemo()) {
      input.value = "";
      messageSheet("Demo mode is on", ["Turn demo mode off in the Spotter tab before restoring a backup. This keeps demo data and your real logbook apart."]);
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      input.value = ""; // so the same file can be picked again
      var parsed;
      try { parsed = JSON.parse(e.target.result); }
      catch (err) { messageSheet("Cannot read this file", ["It is not a valid backup file. Nothing was changed."]); return; }
      var v = C.validateBackup(parsed, STAPLES);
      if (!v.ok) { messageSheet("Backup not imported", v.errors.concat(["Nothing was changed."])); return; }
      pendingImport = v;
      var cur = Object.keys(logs).length;
      var h = '<div class="sp-title" style="margin-bottom:6px;">Restore this backup?</div>';
      h += '<div class="sp-row"><span>Days in the file</span><span>' + v.summary.days + "</span></div>";
      h += '<div class="sp-row"><span>From</span><span>' + esc(v.summary.first) + "</span></div>";
      h += '<div class="sp-row"><span>To</span><span>' + esc(v.summary.last) + "</span></div>";
      h += '<div class="sp-row"><span>Sets / foods</span><span>' + v.summary.sets + " / " + v.summary.foods + "</span></div>";
      h += '<div class="sp-row"><span>Macro goals</span><span>' + (v.summary.hasGoals ? "In the file" : "Keep current") + "</span></div>";
      h += '<div class="sp-row"><span>Spotter settings</span><span>' + (v.summary.hasSpotter ? "In the file" : "Keep current") + "</span></div>";
      h += "<p>This replaces the " + cur + " day" + (cur === 1 ? "" : "s") + " on this phone with the file. A copy of what you have now is kept, so you can undo this once.</p>";
      v.warnings.forEach(function (w) { h += '<p class="sp-low">' + esc(w) + "</p>"; });
      h += '<div style="display:flex; gap:8px; margin-top:12px;">' +
        '<button class="btn btn-dark sp-btn" style="flex:1;" onclick="SpotterUI.cancelImport()">Cancel</button>' +
        '<button class="btn btn-green sp-btn" style="flex:1;" onclick="SpotterUI.confirmImport()">Replace my data</button></div>';
      openSheet(h);
    };
    reader.onerror = function () { input.value = ""; messageSheet("Cannot read this file", ["Nothing was changed."]); };
    reader.readAsText(f);
  }

  function cancelImport() { pendingImport = null; closeModals(); }

  function confirmImport() {
    var v = pendingImport;
    pendingImport = null;
    if (!v || SpotterStore.isDemo()) { closeModals(); return; }
    var saved = SpotterStore.saveSnapshot({ logs: logs, goals: goals, spotter: state, savedAt: new Date().toISOString() });
    if (!saved) {
      messageSheet("Import cancelled", ["There was not enough storage to keep an undo copy of your current data, so nothing was changed.", "Download a backup of your current data first, then try again."]);
      return;
    }
    var keepBackupAt = state.settings.lastBackupAt;
    logs = v.logs;
    if (v.goals) goals = v.goals;
    if (v.spotter) {
      state = v.spotter;
      state.settings.lastBackupAt = keepBackupAt;
    }
    SpotterStore.saveSpotter(state);
    saveAll();
    selectDate(activeDate);
    renderTab();
    messageSheet("Backup restored", [v.summary.days + " days loaded. If this was a mistake, use \"Undo last import\" in the backup section."]);
  }

  function askUndoImport() {
    var snap = SpotterStore.loadSnapshot();
    if (!snap) return;
    var n = Object.keys(snap.logs || {}).length;
    var h = '<div class="sp-title" style="margin-bottom:6px;">Undo the last import?</div>' +
      "<p>This puts back the " + n + " day" + (n === 1 ? "" : "s") + " you had before the import. Anything logged since the import will be replaced.</p>" +
      '<div style="display:flex; gap:8px; margin-top:12px;">' +
      '<button class="btn btn-dark sp-btn" style="flex:1;" onclick="closeModals()">Cancel</button>' +
      '<button class="btn btn-green sp-btn" style="flex:1;" onclick="SpotterUI.undoImport()">Undo import</button></div>';
    openSheet(h);
  }

  function undoImport() {
    var snap = SpotterStore.loadSnapshot();
    closeModals();
    if (!snap || SpotterStore.isDemo() || !snap.logs || typeof snap.logs !== "object") return;
    logs = snap.logs;
    if (snap.goals && typeof snap.goals === "object") goals = snap.goals;
    if (snap.spotter) state = C.migrate(snap.spotter, STAPLES);
    SpotterStore.clearSnapshot();
    SpotterStore.saveSpotter(state);
    saveAll();
    selectDate(activeDate);
    renderTab();
  }

  // "Last backup: N days ago" plus a gentle reminder after a week.
  function backupInfoHtml() {
    var h = "";
    if (SpotterStore.isDemo()) {
      if (state.settings.presentation) return ""; // presentation view: no demo wording on screen
      return '<div class="sp-note">Demo mode is on. A backup made now contains demo data only and cannot be restored over your real logbook.</div>';
    }
    var last = state.settings.lastBackupAt;
    var days = last ? C.daysSince(last, Date.now()) : null;
    var label = days === null ? "never" : (days === 0 ? "today" : (days === 1 ? "1 day ago" : days + " days ago"));
    h += '<div class="sp-note">Last backup: <strong>' + esc(label) + "</strong></div>";
    var hasData = Object.keys(logs).length > 1;
    if (hasData && (days === null || days >= CFG.BACKUP_REMIND_DAYS)) {
      h += '<div class="sp-low">A gentle reminder: your logbook lives only on this phone. Safari can clear a site\'s data after about a week without a visit, unless the app is on your Home Screen. Downloading a backup keeps it safe.</div>';
    }
    if (SpotterStore.loadSnapshot()) {
      h += '<button class="btn btn-dark sp-btn" style="width:100%; margin-top:10px;" onclick="SpotterUI.askUndoImport()">Undo last import</button>';
    }
    return h;
  }

  function renderBanners() {
    // The demo label is hidden only in presentation view (?demo=present), for screen recordings.
    $("spDemoBanner").classList.toggle("sp-hidden", !SpotterStore.isDemo() || !!state.settings.presentation);
    var warn = $("spStoreWarn");
    if (SpotterStore.writeFailed()) {
      warn.textContent = "Could not save to this phone's storage. Download a backup now so nothing is lost.";
      warn.classList.remove("sp-hidden");
    } else {
      warn.classList.add("sp-hidden");
    }
  }

  // Things the user has typed or seen that are not stored: they reset when the date changes.
  var ui = { gapOverride: null, solve: null, solveSig: "", loggedNote: "", deleteArmed: -1 };
  var DEFAULT_GOALS = { cal: 2500, pro: 160, carb: 280, fat: 70 }; // same defaults as the tracker

  function n1(v) { return C.fmt(v, v % 1 ? 1 : 0); }
  function rs(v) { return C.fmt(v, v % 1 ? 2 : 0); } // rupees: paise only when needed

  // ==================================================================
  // ACT I - Readiness From Your Lifts
  // ==================================================================
  function readinessFor(exIdx) {
    var ex = day().exercises[exIdx];
    return ex ? C.readiness(logs, activeDate, ex) : null;
  }

  function readinessChipHtml(r, exIdx) {
    if (!r || r.status === "placeholder") return "";
    var click = ' onclick="SpotterUI.whyReadiness(' + exIdx + ')"';
    if (r.status === "no-set") {
      if (!r.skipped.length) return "";
      return '<button class="sp-chip sp-grey"' + click + ">No readable set yet · Why?</button>";
    }
    if (r.status === "building") {
      return '<button class="sp-chip sp-grey"' + click + ">Building your trend: " + r.n + " of " + r.need + " sessions logged</button>";
    }
    if (r.status === "unstable") {
      return '<button class="sp-chip sp-grey"' + click + ">Trend not readable yet · Why?</button>";
    }
    var h = '<button class="sp-chip sp-' + r.verdict.tone + '"' + click + ">" + esc(r.verdict.chip) +
      ' <span class="sp-meta">· ' + r.n + " sessions · Why?</span></button>";
    if (r.confidence === "low") {
      h += '<div class="sp-low">' + esc(C.lowConfidenceText(r)) + "</div>";
      if (r.lowReasons.indexOf("rpe-prefilled") >= 0 || r.lowReasons.indexOf("rpe-unknown") >= 0) {
        h += '<button class="btn btn-dark sp-btn" style="margin-top:6px;" onclick="SpotterUI.confirmRpe(' + exIdx + ')">Yes, it felt like RPE ' + esc(n1(r.today.rpe)) + "</button>";
      }
    }
    return h;
  }

  function renderReadiness() {
    var exs = day().exercises || [];
    for (var i = 0; i < exs.length; i++) {
      var el = $("spReady-" + i);
      if (el) el.innerHTML = readinessChipHtml(readinessFor(i), i);
    }
  }

  // One tap to say "the pre-filled RPE was right" without retyping it.
  function confirmRpe(exIdx) {
    var ex = day().exercises[exIdx];
    var f = ex ? C.firstWorkingSet(ex) : null;
    if (!f || !f.found) return;
    ex.sets[f.index].rpeConfirmed = true;
    saveAll();
  }

  function whyReadiness(exIdx) {
    var ex = day().exercises[exIdx];
    if (!ex) return;
    var r = C.readiness(logs, activeDate, ex);
    var h = explainHtml(C.explainReadiness(r, ex.name), "ACT I · Readiness From Your Lifts · Why?");
    if (r.status === "verdict") {
      h += '<div class="sp-kicker" style="margin-top:10px;">Sessions in the trend (first working set)</div>';
      r.history.forEach(function (s) {
        h += '<div class="sp-row"><span>' + esc(s.date) + "</span><span>" + esc(n1(s.w) + " × " + n1(s.r) + " @ " + n1(s.rpe) + " → " + C.fmt(s.e1rm, 1) + " kg") + "</span></div>";
      });
    }
    openSheet(h + CLOSE_BTN);
  }

  // ==================================================================
  // ACT II - Exam-Week Autopilot
  // ==================================================================
  function sessionStarted(d) {
    if (Number(d.durationMinutes) > 0) return true;
    return (d.exercises || []).some(function (ex) { return (ex.sets || []).some(function (s) { return s.done; }); });
  }

  function renderSessionRpe() {
    var el = $("spSessionRpe");
    if (!el) return;
    var d = day();
    if (!sessionStarted(d) && d.sessionRpe === null) { el.innerHTML = ""; return; }
    var cur = Number(d.sessionRpe);
    var h = '<div style="margin-bottom:10px;"><span class="sp-lbl">Session RPE: how hard was the whole session? (1 very easy · 10 maximal)</span><div class="sp-rpe-grid">';
    for (var n = 1; n <= 10; n++) {
      h += '<button class="sp-rpe-btn' + (cur === n ? " on" : "") + '" onclick="SpotterUI.setSessionRpe(' + n + ')">' + n + "</button>";
    }
    h += "</div>";
    var load = C.dailyLoad(d);
    if (load !== null) h += '<div class="sp-note">Today\'s load = ' + cur + " × " + n1(Number(d.durationMinutes)) + " min = <strong>" + C.fmt(load, 0) + "</strong></div>";
    else if (d.sessionRpe !== null) h += '<div class="sp-note">Add the session minutes to get today\'s load.</div>';
    else h += '<div class="sp-note">Tap a number after training. Load = session RPE × minutes.</div>';
    el.innerHTML = h + "</div>";
  }

  function setSessionRpe(n) {
    var d = day();
    d.sessionRpe = Number(d.sessionRpe) === n ? null : n; // tap again to clear
    saveAll();
  }

  function saveSleep(v) {
    var d = day();
    if (v === "" || v === null || v === undefined) d.sleepHours = null;
    else {
      var h = C.validSleep(String(v));
      d.sleepHours = isNaN(h) ? null : Math.round(h * 2) / 2; // step 0.5
    }
    saveAll();
  }

  function setPlanHtml(fraction, label) {
    var plan = C.setPlan(day(), fraction).filter(function (p) { return p.planned > 0; });
    if (!plan.length) return "";
    var h = '<div class="sp-kicker" style="margin-top:10px;">' + esc(label) + "</div>";
    plan.forEach(function (p) {
      h += '<div class="sp-row"><span>' + esc(p.name) + "</span><span>" + p.planned + " → " + p.keep + " sets</span></div>";
    });
    return h;
  }

  function renderAutopilot() {
    var el = $("spAutopilot");
    if (!el) return;
    var d = day();
    var a = C.autopilot(logs, state.exams, activeDate);
    var maint = d.spotter && d.spotter.maintenance;
    if (!a.show && !maint) { el.innerHTML = ""; return; }
    var t = C.autopilotText(a);
    var h = '<div class="card sp-status sp-tone-' + (t.tone || "grey") + '">';
    h += '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;"><div>';
    h += '<div class="sp-kicker">Exam-Week Autopilot</div>';
    h += '<div class="sp-title" style="margin-top:2px;">' + esc(t.title || "Maintenance mode is on") + "</div></div>";
    h += '<button class="btn btn-dark sp-btn" onclick="SpotterUI.whyAutopilot()">Why?</button></div>';

    if (a.exam.next) h += '<div class="sp-row"><span>Exam</span><span>' + esc(C.examLine(a.exam.next)) + "</span></div>";
    else if (a.exam.last && a.exam.mode === "ramp") h += '<div class="sp-row"><span>Last exam</span><span>' + esc(a.exam.last.label + ", " + a.exam.last.daysAgo + " d ago") + "</span></div>";
    if (a.load.status === "ok") {
      h += '<div class="sp-row"><span>Load this week</span><span>' + C.fmt(a.load.acute.load, 0) + " vs " + C.fmt(a.load.chronic, 0) + " avg</span></div>";
      h += '<div class="sp-row"><span>Ratio</span><span>' + C.fmt(a.load.ratio, 2) + " · " + esc(a.load.band.label) + "</span></div>";
    } else {
      h += '<div class="sp-row"><span>Load ratio</span><span>' + (a.load.status === "not-enough" ? "Not enough history yet" : "No load logged this week") + "</span></div>";
    }
    h += '<div class="sp-row"><span>Sleep</span><span>' + (a.sleep ? C.fmt(a.sleep.avg, 1) + " h avg (" + a.sleep.n + " night" + (a.sleep.n === 1 ? "" : "s") + ")" : "Not logged") + "</span></div>";
    if (t.body) h += '<div class="sp-note" style="color:var(--text-main);">' + esc(t.body) + "</div>";

    if (maint) {
      h += '<div class="sp-note">Maintenance mode is applied to this day: ' + (maint.removedTotal || 0) + " set" + (maint.removedTotal === 1 ? "" : "s") + " removed, " + (maint.changedTotal || 0) + " adjusted. Completed sets were not touched.</div>";
      h += '<button class="btn btn-dark sp-btn" style="width:100%; margin-top:10px;" onclick="SpotterUI.undoMaintenance()">Undo maintenance mode</button>';
    } else if (a.exam.mode === "exam" && d.split !== "rest" && (d.exercises || []).length) {
      h += '<button class="btn btn-green sp-btn" style="width:100%; margin-top:10px;" onclick="SpotterUI.applyMaintenance()">Apply maintenance mode</button>';
    }
    h += '<div class="sp-note">A warning flag, not an injury predictor. Wellness guidance, not medical advice.</div>';
    el.innerHTML = h + "</div>";
  }

  function applyMaintenance() {
    var res = C.applyMaintenance(day());
    if (!res.applied) return;
    logs[activeDate] = res.day;
    saveAll();
    renderWorkout();
  }

  function undoMaintenance() {
    var res = C.undoMaintenance(day());
    if (!res.undone) return;
    logs[activeDate] = res.day;
    saveAll();
    renderWorkout();
    if (!res.exact) {
      messageSheet("Maintenance mode undone", ["Sets were added, removed or renamed after maintenance mode was applied. Every removed set is back, but it was placed at the end of its exercise instead of its exact old position."]);
    }
  }

  function whyAutopilot() {
    var a = C.autopilot(logs, state.exams, activeDate);
    var h = explainHtml(C.explainAutopilot(a), "ACT II · Exam-Week Autopilot · Why?");
    var maint = day().spotter && day().spotter.maintenance;
    if (!maint && a.exam.mode === "exam") h += setPlanHtml(CFG.MAINT_SET_FRACTION, "Maintenance mode would change today's sets to");
    if (a.exam.mode === "ramp") h += setPlanHtml(CFG.RAMP_SET_FRACTION, "About 80% of today's sets");
    openSheet(h + CLOSE_BTN);
  }

  // Weekly-load bar chart (plain SVG, no library).
  function renderLoadChart() {
    var el = $("spLoadChart");
    if (!el) return;
    var s = C.weeklyLoadSeries(logs, state.exams, activeDate);
    var max = 1;
    s.forEach(function (w) { if (w.load > max) max = w.load; });
    var W = 330, H = 168, top = 24, base = 126, bw = 40;
    var gap = (W - s.length * bw) / (s.length + 1);
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Weekly training load for the last ' + s.length + ' weeks">';
    svg += '<line x1="0" y1="' + base + '" x2="' + W + '" y2="' + base + '" style="stroke:var(--border); stroke-width:1;"/>';
    s.forEach(function (w, i) {
      var x = gap + i * (bw + gap), cx = x + bw / 2;
      if (w.hasData) {
        var bh = Math.max(4, (w.load / max) * (base - top));
        var fill = w.hasExam ? "var(--legs)" : (w.isCurrent ? "var(--accent)" : "var(--rest)");
        svg += '<rect x="' + x.toFixed(1) + '" y="' + (base - bh).toFixed(1) + '" width="' + bw + '" height="' + bh.toFixed(1) + '" rx="5" style="fill:' + fill + ";" + (w.isCurrent ? " stroke:var(--text-main); stroke-width:1.5;" : "") + '"/>';
        svg += '<text x="' + cx.toFixed(1) + '" y="' + (base - bh - 5).toFixed(1) + '" text-anchor="middle" style="fill:var(--text-main); font-size:10px; font-weight:600;">' + C.fmt(w.load, 0) + "</text>";
      } else {
        svg += '<rect x="' + x.toFixed(1) + '" y="' + (base - 16) + '" width="' + bw + '" height="16" rx="5" style="fill:none; stroke:' + (w.hasExam ? "var(--legs)" : "var(--border)") + '; stroke-width:1.5; stroke-dasharray:4 3;"/>';
        svg += '<text x="' + cx.toFixed(1) + '" y="' + (base - 21) + '" text-anchor="middle" style="fill:var(--text-muted); font-size:10px;">–</text>';
      }
      svg += '<text x="' + cx.toFixed(1) + '" y="' + (base + 14) + '" text-anchor="middle" style="fill:var(--text-muted); font-size:9px;">' + w.end.slice(8) + "/" + w.end.slice(5, 7) + "</text>";
      if (w.isCurrent) svg += '<text x="' + cx.toFixed(1) + '" y="' + (base + 26) + '" text-anchor="middle" style="fill:var(--accent); font-size:9px; font-weight:600;">this week</text>';
    });
    svg += "</svg>";
    function key(style, label) { return '<span style="display:inline-flex; align-items:center; gap:4px; margin-right:10px;"><span style="width:10px; height:10px; border-radius:3px; display:inline-block; ' + style + '"></span>' + label + "</span>"; }
    var h = '<div class="sp-note" style="margin:0 0 6px;">load = session RPE × minutes, summed over each 7 days. Labels show the last day of each week.</div>' + svg;
    h += '<div class="sp-note">' + key("background:var(--accent);", "This week") + key("background:var(--legs);", "Exam week") + key("background:var(--rest);", "Other") + key("border:1.5px dashed var(--border);", "No load logged") + "</div>";
    var ls = C.loadSummary(logs, activeDate);
    var line = ls.status === "ok" ? "Ratio " + C.fmt(ls.ratio, 2) + " · " + ls.band.label + ". A warning flag, not an injury predictor."
      : (ls.status === "not-enough" ? "Not enough history yet for a ratio." : "No load logged this week.");
    h += '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:8px;"><div class="sp-note" style="margin:0;">' + esc(line) + '</div><button class="btn btn-dark sp-btn" onclick="SpotterUI.whyAutopilot()">Why?</button></div>';
    el.innerHTML = h;
  }

  // ==================================================================
  // ACT III - Protein on a Hostel Budget
  // ==================================================================
  function gapInfo() { return C.nutritionGap(goals, day(), floor()); }
  function currentGap(info) { return ui.gapOverride !== null ? ui.gapOverride : info.proteinGap; }
  function solveSig(info) {
    return JSON.stringify([activeDate, currentGap(info), state.settings.lastBudget, info.caloriesRemaining, state.canteen, SpotterStore.isDemo()]);
  }

  function solverResultHtml(res) {
    var msg = C.solverMessage(res);
    if (!res.plan) {
      var h0 = '<div class="sp-note" style="color:var(--text-main); margin-top:12px;">' + esc(msg) + "</div>";
      if (res.status === "no-items") h0 += '<button class="btn btn-dark sp-btn" style="width:100%; margin-top:8px;" onclick="SpotterUI.goCanteen()">Add canteen prices</button>';
      return h0;
    }
    var ok = res.status === "optimal";
    var h = '<div class="sp-chip ' + (ok ? "sp-green" : "sp-amber") + '" style="width:100%; margin-top:12px; white-space:normal;">' + esc(msg) + "</div>";
    res.plan.lines.forEach(function (l) {
      h += '<div class="sp-row"><span style="color:var(--text-main);"><strong>' + l.servings + " ×</strong> " + esc(l.name) + "</span><span>₹" + rs(l.cost) + " · " + esc(n1(l.pro)) + " g · " + C.fmt(l.cal, 0) + " kcal</span></div>";
    });
    var t = res.plan.totals;
    h += '<div class="sp-row" style="border-bottom:none;"><span style="color:var(--text-main); font-weight:700;">Total</span><span style="color:var(--accent);">₹' + rs(t.cost) + " · " + esc(n1(t.pro)) + " g · " + C.fmt(t.cal, 0) + " kcal</span></div>";
    h += '<div style="display:flex; gap:8px; margin-top:8px;">' +
      '<button class="btn btn-green sp-btn" style="flex:1;" onclick="SpotterUI.logCombo()">Log this combo</button>' +
      '<button class="btn btn-dark sp-btn" onclick="SpotterUI.whySolver()">Why?</button></div>';
    return h;
  }

  function renderSolverCard() {
    var gapEl = $("spGap");
    if (!gapEl) return;
    var info = gapInfo();
    if (document.activeElement !== gapEl) gapEl.value = n1(currentGap(info));
    var budEl = $("spBudget");
    if (document.activeElement !== budEl) budEl.value = state.settings.lastBudget === null ? "" : state.settings.lastBudget;
    $("spCalLeft").textContent = C.fmt(Math.max(0, info.caloriesRemaining), 0);

    var prep = C.prepareItems(state.canteen);
    var hints = [];
    if (prep.unpriced.length) hints.push(prep.unpriced.length + " canteen item" + (prep.unpriced.length === 1 ? " has" : "s have") + " no price yet and " + (prep.unpriced.length === 1 ? "is" : "are") + " skipped. Add prices in the Spotter tab.");
    if (info.belowFloor) hints.push("Your calorie goal is under your " + C.fmt(info.floor, 0) + " kcal floor, so calories left is measured against the floor.");
    if (ui.gapOverride !== null) hints.push("Using the gap you typed. Clear the box to go back to goal − logged (" + n1(info.proteinGap) + " g).");
    if (ui.loggedNote) hints.push(ui.loggedNote);
    $("spSolverHint").textContent = hints.join(" ");

    if (ui.solve && ui.solveSig !== solveSig(info)) ui.solve = null; // inputs changed: the old answer no longer applies
    $("spSolverResult").innerHTML = ui.solve ? solverResultHtml(ui.solve) : "";
  }

  function onGapInput(v) {
    var n = C.num(String(v));
    ui.gapOverride = (isNaN(n) || n < 0) ? null : n;
    ui.loggedNote = "";
    renderSolverCard();
  }

  function onBudgetInput(v) {
    state.settings.lastBudget = C.priceOf(v);
    SpotterStore.saveSpotter(state); // remembered for next time
    ui.loggedNote = "";
    renderSolverCard();
    renderBanners();
  }

  function runSolver() {
    var info = gapInfo();
    ui.loggedNote = "";
    ui.solve = C.solveCombo(state.canteen, { gap: currentGap(info), budget: state.settings.lastBudget, caloriesRemaining: info.caloriesRemaining });
    ui.solveSig = solveSig(info);
    renderSolverCard();
  }

  function whySolver() {
    var info = gapInfo();
    if (!ui.solve || ui.solveSig !== solveSig(info)) runSolver();
    openSheet(explainHtml(C.explainSolver(ui.solve), "ACT III · Protein on a Hostel Budget · Why?") + CLOSE_BTN);
  }

  // Adds the suggested foods to the selected day, one entry per item.
  function logCombo() {
    if (!ui.solve || !ui.solve.plan) return;
    var d = day(), count = 0;
    ui.solve.plan.lines.forEach(function (l) {
      d.foods.push({
        name: (l.servings > 1 ? l.servings + " × " : "") + l.name,
        cal: C.round(l.cal, 1), pro: C.round(l.pro, 1), carb: C.round(l.carb, 1), fat: C.round(l.fat, 1)
      });
      count++;
    });
    ui.solve = null;
    ui.gapOverride = null;
    ui.loggedNote = "Logged " + count + " item" + (count === 1 ? "" : "s") + " to " + activeDate + ".";
    saveAll();
  }

  // ==================================================================
  // Safety messages
  // ==================================================================
  function renderLowIntake() {
    var el = $("spLowIntake");
    if (!el) return;
    var li = C.lowIntake(logs, activeDate, floor());
    if (!li.flag) { el.innerHTML = ""; return; }
    el.innerHTML = '<div class="card sp-status sp-tone-blue"><div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">' +
      '<div><div class="sp-title">A gentle note</div><div class="sp-note" style="color:var(--text-main);">' + esc(C.lowIntakeText(li)) + "</div></div>" +
      '<button class="btn btn-dark sp-btn" onclick="SpotterUI.whyLowIntake()">Why?</button></div></div>';
  }

  function whyLowIntake() {
    openSheet(explainHtml(C.explainLowIntake(C.lowIntake(logs, activeDate, floor())), "Honest by design · Why?") + CLOSE_BTN);
  }

  function floorWarn() {
    var el = $("spFloorWarn");
    if (!el) return;
    var v = Number($("goalCal").value);
    el.textContent = (v > 0 && v < floor()) ? C.floorWarningText(v, floor()) : "";
  }

  // ==================================================================
  // Spotter tab
  // ==================================================================
  function briefHtml() {
    var d = day(), h = "";
    var isToday = activeDate === todayKey();
    h += '<div class="card"><div class="sp-kicker">' + (isToday ? "Today's brief" : "Brief for " + esc(activeDate)) + "</div>";

    // Readiness
    h += '<div class="sp-title" style="margin:8px 0 4px;">Readiness From Your Lifts</div>';
    var any = false;
    (d.exercises || []).forEach(function (ex, i) {
      var r = C.readiness(logs, activeDate, ex);
      if (r.status !== "verdict" && r.status !== "building") return;
      any = true;
      var chip = r.status === "verdict"
        ? '<button class="sp-chip sp-' + r.verdict.tone + '" onclick="SpotterUI.whyReadiness(' + i + ')">' + esc(r.verdict.chip) + "</button>"
        : '<button class="sp-chip sp-grey" onclick="SpotterUI.whyReadiness(' + i + ')">' + r.n + " of " + r.need + " sessions</button>";
      h += '<div class="sp-item"><div class="sp-item-main">' + esc(ex.name) +
        (r.status === "verdict" ? "<small>" + (r.pctDiff >= 0 ? "+" : "−") + C.fmt(Math.abs(r.pctDiff), 1) + "% vs trend · " + r.n + " sessions" + (r.confidence === "low" ? " · low confidence" : "") + "</small>" : "<small>Building your trend</small>") +
        "</div>" + chip + "</div>";
    });
    if (!any) h += '<div class="sp-note">Tick the first working set of a lift in the Workout tab. Spotter then compares it with your trend for that lift.</div>';

    // Autopilot
    var a = C.autopilot(logs, state.exams, activeDate), t = C.autopilotText(a);
    h += '<div class="sp-title" style="margin:14px 0 4px;">Exam-Week Autopilot</div>';
    h += '<div class="sp-item"><div class="sp-item-main">' + esc(t.title || "Nothing to flag") + "<small>" +
      esc(t.body || (state.exams.length ? "No exam within 14 days and no load spike." : "Add your exam dates below so Spotter can plan around them.")) + "</small></div>" +
      '<button class="btn btn-dark sp-btn" onclick="SpotterUI.whyAutopilot()">Why?</button></div>';

    // Protein gap
    var info = gapInfo();
    h += '<div class="sp-title" style="margin:14px 0 4px;">Protein on a Hostel Budget</div>';
    h += '<div class="sp-item"><div class="sp-item-main">' + (info.proteinGap > 0 ? "Protein gap: " + esc(n1(info.proteinGap)) + " g" : "Protein goal reached") +
      "<small>" + C.fmt(Math.max(0, info.caloriesRemaining), 0) + " kcal left" + (info.belowFloor ? " (measured against your floor)" : "") + "</small></div>" +
      '<button class="btn btn-green sp-btn" onclick="SpotterUI.goSolver()">Find combo</button></div>';

    // Low intake
    var li = C.lowIntake(logs, activeDate, floor());
    if (li.flag) {
      h += '<div class="sp-item" style="border-bottom:none;"><div class="sp-item-main" style="font-weight:600;">' + esc(C.lowIntakeText(li)) + "</div>" +
        '<button class="btn btn-dark sp-btn" onclick="SpotterUI.whyLowIntake()">Why?</button></div>';
    }
    return h + "</div>";
  }

  function renderBrief() {
    var el = $("spBrief");
    if (el) el.innerHTML = briefHtml();
  }

  function pricedCountText() {
    var total = state.canteen.length;
    var priced = state.canteen.filter(function (it) { return C.priceOf(it.price) !== null; }).length;
    return priced + " of " + total + " items have a price" + (priced < total ? ". Items without a price are skipped by the search." : ".");
  }

  function canteenRowHtml(it, i) {
    var priced = C.priceOf(it.price) !== null;
    return '<div class="sp-item">' +
      '<div class="sp-item-main">' + esc(it.name) + (it.available === false ? ' <span class="sp-grey">(not available)</span>' : "") +
      "<small>" + esc(n1(it.pro)) + " g protein · " + C.fmt(it.cal, 0) + " kcal · max " + it.maxServings +
      ' <span id="spNeed-' + i + '" style="color:var(--legs);">' + (priced ? "" : "· needs price") + "</span></small></div>" +
      '<input type="number" inputmode="decimal" class="mob-input sp-in" style="width:76px;" placeholder="₹" aria-label="Price in rupees" value="' + (priced ? esc(it.price) : "") + '" onchange="SpotterUI.setPrice(' + i + ', this.value)" />' +
      '<button class="btn btn-dark sp-btn" onclick="SpotterUI.openItem(' + i + ')">Edit</button></div>';
  }

  function demoCardHtml() {
    var on = SpotterStore.isDemo();
    if (typeof SpotterDemo === "undefined" && !on) return "";
    if (on && state.settings.presentation) return ""; // presentation view: leave with ?demo=off
    return '<div class="card"><div class="sp-title">Demo mode</div>' +
      '<div class="sp-note">Loads about a month of made-up training, sleep, food, exams and canteen prices into a separate storage area. Your real logbook is not touched and comes back when you turn demo mode off. Demo data is rebuilt fresh each time demo mode is turned on, and each new day.</div>' +
      '<button class="btn ' + (on ? "btn-dark" : "btn-green") + ' sp-btn" style="width:100%; margin-top:10px;" onclick="SpotterUI.toggleDemo()">' + (on ? "Turn demo mode off (back to my data)" : "Turn demo mode on") + "</button></div>";
  }

  function renderTab() {
    var el = $("spTab");
    if (!el) return;
    var h = "";
    h += '<div class="sp-page-head"><div class="sp-h1">Spotter</div>' +
      '<div style="font-weight:600; margin-top:2px;">Your logbook is the wearable.</div>' +
      '<div class="sp-note">AI training insights for students, from the workout log they already keep. No band. No subscription. ₹0.</div></div>';

    h += '<div id="spBrief"></div>';

    h += '<div class="card"><div class="sp-title">How it works</div><div class="sp-steps">' +
      '<div><span>Your logbook</span><span>never leaves your phone</span></div>' +
      '<div><span>On-device AI</span><span>regression · time series · linear programming</span></div>' +
      '<div><span>Your spotter</span><span>explains every call</span></div></div>' +
      '<div class="sp-note">The "AI" is three small models that run on this phone: a regression on your lifts, a time series of your session load, and an integer programme for food cost. The explanations are fixed templates. There is no language model and no internet connection.</div></div>';

    // Settings: exams
    h += '<div class="card"><div class="sp-title">Exam dates</div>';
    if (!state.exams.length) h += '<div class="sp-note">No exams yet. Add them so Autopilot can suggest maintenance mode in exam week.</div>';
    state.exams.forEach(function (e, i) {
      h += '<div class="sp-item"><div class="sp-item-main">' + esc(e.label) + "<small>" + esc(e.date) + "</small></div>" +
        '<button class="btn btn-dark sp-btn" aria-label="Remove exam" onclick="SpotterUI.removeExam(' + i + ')">✕</button></div>';
    });
    h += '<div class="sp-grid2" style="margin-top:10px;">' +
      '<div><label class="sp-lbl" for="spExamLabel">Exam</label><input type="text" id="spExamLabel" maxlength="60" class="mob-input sp-in sp-left" placeholder="e.g. DBMS mid-sem" /></div>' +
      '<div><label class="sp-lbl" for="spExamDate">Date</label><input type="date" id="spExamDate" class="mob-input sp-in" /></div></div>' +
      '<div id="spExamMsg" class="sp-low"></div>' +
      '<button class="btn btn-green sp-btn" style="width:100%; margin-top:8px;" onclick="SpotterUI.addExam()">Add exam</button></div>';

    // Settings: floor and budget
    h += '<div class="card"><div class="sp-title">Safety and budget</div><div class="sp-grid2" style="margin-top:8px;">' +
      '<div><label class="sp-lbl" for="spFloorInput">Calorie floor (kcal/day)</label><input type="number" id="spFloorInput" class="mob-input sp-in" value="' + floor() + '" onchange="SpotterUI.setFloor(this.value)" /></div>' +
      '<div><label class="sp-lbl" for="spBudgetDefault">Default budget (₹)</label><input type="number" id="spBudgetDefault" class="mob-input sp-in" placeholder="₹" value="' + (state.settings.lastBudget === null ? "" : esc(state.settings.lastBudget)) + '" onchange="SpotterUI.setBudget(this.value)" /></div></div>' +
      '<div class="sp-note">The floor is a general wellness floor, not personalised medical advice. Spotter never suggests eating below it, and flags several logged days under it. Allowed range: ' + CFG.CALORIE_FLOOR_MIN + "–" + CFG.CALORIE_FLOOR_MAX + " kcal.</div></div>";

    // Settings: canteen
    h += '<div class="card" id="spCanteenCard"><div style="display:flex; justify-content:space-between; align-items:center; gap:8px;"><div class="sp-title">Canteen catalog</div>' +
      '<button class="btn btn-green sp-btn" onclick="SpotterUI.openItem(-1)">Add item</button></div>' +
      '<div class="sp-note" id="spPricedCount">' + esc(pricedCountText()) + "</div>" +
      (SpotterStore.isDemo() && !state.settings.presentation ? '<div class="sp-low">Demo mode: these are SAMPLE prices, not real canteen prices.</div>' : '<div class="sp-note">Type the price of one serving in rupees. Use your own canteen\'s prices.</div>');
    state.canteen.forEach(function (it, i) { h += canteenRowHtml(it, i); });
    h += "</div>";

    // Settings: backup
    h += '<div class="card"><div class="sp-title">Backup and restore</div>' +
      '<div class="sp-note">Your logbook is stored only in this browser on this phone. A backup file is the only copy. It contains your personal training and food log, so keep it somewhere private.</div>' +
      '<div style="display:flex; gap:8px; margin-top:10px;">' +
      '<button class="btn btn-green sp-btn" style="flex:1;" onclick="exportBackup()">Download backup</button>' +
      '<button class="btn btn-dark sp-btn" style="flex:1;" onclick="document.getElementById(\'restoreInput\').click()">Restore file</button></div>' +
      '<div id="spBackupInfo2"></div></div>';

    h += demoCardHtml();

    h += '<div class="card"><div class="sp-title">About</div>' +
      '<div class="sp-note" style="color:var(--text-main);">Wellness guidance, not medical advice.</div>' +
      '<div class="sp-note">RPE is subjective, so Spotter trusts your trend over any single day. Load spikes are flags, not injury predictions. Spotter never suggests eating below a safe calorie floor.</div>' +
      '<div class="sp-note">Data version ' + CFG.SCHEMA_VERSION + ". Everything runs on this device.</div></div>";

    el.innerHTML = h;
    renderBrief();
    $("spBackupInfo2").innerHTML = backupInfoHtml();
  }

  function addExam() {
    var label = $("spExamLabel").value, date = $("spExamDate").value;
    if (!C.isDateKey(date)) { $("spExamMsg").textContent = "Pick the exam date first."; return; }
    state.exams = C.cleanExams(state.exams.concat([{ label: label, date: date }]));
    saveState();
    renderTab();
  }

  function removeExam(i) {
    state.exams.splice(i, 1);
    saveState();
    renderTab();
  }

  function setFloor(v) {
    state.settings.calorieFloor = C.cleanFloor(v);
    $("spFloorInput").value = state.settings.calorieFloor;
    saveState();
  }

  function setBudget(v) {
    state.settings.lastBudget = C.priceOf(v);
    saveState();
  }

  // Inline price edit. The list is not redrawn, so the keyboard stays where the user is typing.
  function setPrice(i, v) {
    var it = state.canteen[i];
    if (!it) return;
    it.price = C.priceOf(v);
    var need = $("spNeed-" + i);
    if (need) need.textContent = it.price === null ? "· needs price" : "";
    var pc = $("spPricedCount");
    if (pc) pc.textContent = pricedCountText();
    saveState();
  }

  function field(id, label, value, type, extra) {
    return '<div><label class="sp-lbl" for="' + id + '">' + esc(label) + '</label><input type="' + type + '" id="' + id + '" class="mob-input sp-in' + (type === "text" ? " sp-left" : "") + '" value="' + esc(value) + '" ' + (extra || "") + " /></div>";
  }

  function openItem(i) {
    ui.deleteArmed = -1;
    var it = i >= 0 ? state.canteen[i] : { name: "", cal: "", pro: "", carb: "", fat: "", price: null, maxServings: CFG.CANTEEN_MAX_SERVINGS_DEFAULT, available: true };
    if (!it) return;
    var h = '<div class="sp-title" style="margin-bottom:8px;">' + (i >= 0 ? "Edit canteen item" : "Add canteen item") + "</div>";
    h += field("spItName", "Name (one serving)", it.name, "text", 'maxlength="60" placeholder="e.g. Paneer bhurji plate"');
    h += '<div class="sp-grid2" style="margin-top:8px;">' +
      field("spItPrice", "Price per serving (₹)", it.price === null ? "" : it.price, "number", 'inputmode="decimal"') +
      field("spItMax", "Max servings (1–" + CFG.CANTEEN_MAX_SERVINGS_LIMIT + ")", it.maxServings, "number", 'inputmode="numeric"') +
      field("spItPro", "Protein (g)", it.pro, "number", 'inputmode="decimal"') +
      field("spItCal", "Calories (kcal)", it.cal, "number", 'inputmode="decimal"') +
      field("spItCarb", "Carbs (g)", it.carb, "number", 'inputmode="decimal"') +
      field("spItFat", "Fat (g)", it.fat, "number", 'inputmode="decimal"') + "</div>";
    h += '<label style="display:flex; align-items:center; gap:10px; min-height:44px; margin-top:8px; font-size:0.84rem;"><input type="checkbox" id="spItAvail" class="mob-check" style="margin:0;" ' + (it.available !== false ? "checked" : "") + " /> Available at my canteen</label>";
    h += '<div id="spItMsg" class="sp-low"></div>';
    h += '<div style="display:flex; gap:8px; margin-top:12px;">' +
      '<button class="btn btn-dark sp-btn" style="flex:1;" onclick="closeModals()">Cancel</button>' +
      '<button class="btn btn-green sp-btn" style="flex:1;" onclick="SpotterUI.saveItem(' + i + ')">Save</button></div>';
    if (i >= 0) h += '<button class="btn btn-dark sp-btn" id="spItDel" style="width:100%; margin-top:8px; color:var(--push);" onclick="SpotterUI.deleteItem(' + i + ')">Delete item</button>';
    openSheet(h);
  }

  function saveItem(i) {
    var name = $("spItName").value.trim();
    if (!name) { $("spItMsg").textContent = "Give the item a name."; return; }
    var raw = {
      name: name, price: $("spItPrice").value, maxServings: $("spItMax").value,
      pro: $("spItPro").value, cal: $("spItCal").value, carb: $("spItCarb").value, fat: $("spItFat").value,
      available: $("spItAvail").checked
    };
    if (i >= 0 && state.canteen[i]) { raw.id = state.canteen[i].id; state.canteen[i] = raw; }
    else state.canteen.push(raw);
    state.canteen = C.cleanCanteen(state.canteen); // parses numbers, clamps max servings, fixes ids
    closeModals();
    saveState();
    renderTab();
  }

  function deleteItem(i) {
    if (ui.deleteArmed !== i) { // first tap arms, second tap deletes
      ui.deleteArmed = i;
      $("spItDel").textContent = "Tap again to delete";
      return;
    }
    ui.deleteArmed = -1;
    state.canteen.splice(i, 1);
    closeModals();
    saveState();
    renderTab();
  }

  function goSolver() {
    switchView("nutrition", document.querySelectorAll(".nav-item")[1]);
    var card = $("spSolverCard");
    if (card && card.scrollIntoView) card.scrollIntoView({ block: "start" });
  }

  function goCanteen() {
    switchView("spotter", $("navSpotter"));
    var card = $("spCanteenCard");
    if (card && card.scrollIntoView) card.scrollIntoView({ block: "start" });
  }

  // ==================================================================
  // Demo mode
  // ==================================================================
  // Reloads logs, goals and Spotter state from whichever storage area (real or demo) is now active.
  function reloadFromStorage() {
    var l = SpotterStore.loadLogs(), g = SpotterStore.loadGoals();
    logs = (l && typeof l === "object") ? l : {};
    goals = (g && typeof g === "object") ? g : { cal: DEFAULT_GOALS.cal, pro: DEFAULT_GOALS.pro, carb: DEFAULT_GOALS.carb, fat: DEFAULT_GOALS.fat };
    loadState();
    ui.gapOverride = null; ui.solve = null; ui.loggedNote = "";
  }

  // Demo data is built around "today". If demo mode was left on overnight, rebuild it for the new day.
  function refreshStaleDemo() {
    if (!SpotterStore.isDemo() || typeof SpotterDemo === "undefined") return;
    if (state.settings.demoDate === todayKey()) return;
    SpotterStore.enterDemo(SpotterDemo.generate(todayKey(), SPLITS, STAPLES, undefined, { clean: !!state.settings.presentation }));
    reloadFromStorage();
  }

  function toggleDemo() {
    if (SpotterStore.isDemo()) SpotterStore.exitDemo();
    else if (typeof SpotterDemo === "undefined") return;
    else SpotterStore.enterDemo(SpotterDemo.generate(todayKey(), SPLITS, STAPLES));
    afterDemoSwitch();
  }

  // Turns demo mode on with freshly built data. clean = presentation view (no demo wording, no banner).
  function startDemo(clean) {
    if (typeof SpotterDemo === "undefined") return;
    SpotterStore.enterDemo(SpotterDemo.generate(todayKey(), SPLITS, STAPLES, undefined, { clean: !!clean }));
    afterDemoSwitch();
  }

  function afterDemoSwitch() {
    reloadFromStorage();
    var t = new Date();
    calYear = t.getFullYear();
    calMonth = t.getMonth();
    selectDate(todayKey());
    refresh();
    renderTab();
    window.scrollTo(0, 0);
  }

  // ==================================================================
  // Refresh hooks called by the tracker
  // ==================================================================
  function isActive(view) {
    var el = $("view-" + view);
    return !!el && el.classList.contains("active");
  }

  // Called after every saveAll(). Only redraws Spotter's own containers, never an input the user is typing in.
  function refresh() {
    renderBanners();
    var info = $("spBackupInfo");
    if (info) info.innerHTML = backupInfoHtml();
    var info2 = $("spBackupInfo2");
    if (info2) info2.innerHTML = backupInfoHtml();
    renderReadiness();
    renderSessionRpe();
    renderAutopilot();
    renderSolverCard();
    renderLowIntake();
    renderBrief();
    if (isActive("stats")) renderLoadChart();
  }

  function onDateChange() {
    ui.gapOverride = null;
    ui.solve = null;
    ui.loggedNote = "";
  }

  function onViewChange(view) {
    if (view === "spotter") renderTab();
    refresh();
  }

  // Called at the end of renderWorkout(): fills the containers that function just created.
  function renderWorkoutExtras() {
    var d = day();
    var sleepEl = $("spSleepInput");
    if (sleepEl && document.activeElement !== sleepEl) sleepEl.value = (d.sleepHours === null || d.sleepHours === undefined) ? "" : d.sleepHours;
    renderReadiness();
    renderSessionRpe();
    renderAutopilot();
  }

  var extraApi = {
    whyReadiness: whyReadiness, confirmRpe: confirmRpe,
    setSessionRpe: setSessionRpe, applyMaintenance: applyMaintenance, undoMaintenance: undoMaintenance, whyAutopilot: whyAutopilot,
    logCombo: logCombo, whyLowIntake: whyLowIntake, goSolver: goSolver, goCanteen: goCanteen,
    addExam: addExam, removeExam: removeExam, setFloor: setFloor, setBudget: setBudget, setPrice: setPrice,
    openItem: openItem, saveItem: saveItem, deleteItem: deleteItem, toggleDemo: toggleDemo, renderLoadChart: renderLoadChart
  };

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  function init() {
    loadState();
    refreshStaleDemo();
    SpotterStore.saveSpotter(state); // writes defaults on first run; a no-op change afterwards
    try {
      // Ask the browser to keep this site's storage. No network involved.
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    } catch (e) {}
    try {
      // Offline support. Service workers only exist on http(s); from file:// the app simply runs without one.
      if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register("./sw.js").catch(function () {});
      }
    } catch (e) {}
    selectDate(activeDate); // redraw the tracker now that Spotter is ready
    applyDemoParam();
    refresh();
  }

  // Shortcuts for screen recordings, added to the end of the address:
  //   ?demo=present  rebuild the demo data and hide every "demo" / "sample" label (presentation view)
  //   ?demo=reset    rebuild the demo data, with the demo label shown
  //   ?demo=1        turn demo mode on, keeping any changes made
  //   ?demo=off      back to the real logbook
  // Demo mode only ever uses the separate spotter_demo_* keys, so this cannot touch the real logbook.
  // The demo parameter (only) is removed from the address afterwards so a reload does not repeat it.
  function applyDemoParam() {
    var params = null, q = null;
    try { params = new URLSearchParams(location.search); q = params.get("demo"); } catch (e) { return; }
    if (!q) return;
    var on = SpotterStore.isDemo();
    if (q === "off") { if (on) toggleDemo(); }
    else if (q === "present") startDemo(true);
    else if (q === "reset") startDemo(false);
    else if (q === "1" || q === "on") { if (!on) startDemo(false); }
    try {
      params.delete("demo");
      var rest = params.toString();
      history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
    } catch (e) {}
  }

  var api = {
    init: init, refresh: refresh, onDateChange: onDateChange, onViewChange: onViewChange,
    renderWorkoutExtras: renderWorkoutExtras, renderTab: renderTab, floorWarn: floorWarn,
    saveSleep: saveSleep, whySolver: whySolver, runSolver: runSolver, onGapInput: onGapInput, onBudgetInput: onBudgetInput,
    exportBackup: exportBackup, importBackup: importBackup, cancelImport: cancelImport, confirmImport: confirmImport,
    askUndoImport: askUndoImport, undoImport: undoImport,
    getState: function () { return state; }
  };
  for (var k in extraApi) if (Object.prototype.hasOwnProperty.call(extraApi, k)) api[k] = extraApi[k];
  window.SpotterUI = api;
  init();
})();
