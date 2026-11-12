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
    $("spDemoBanner").classList.toggle("sp-hidden", !SpotterStore.isDemo());
    var warn = $("spStoreWarn");
    if (SpotterStore.writeFailed()) {
      warn.textContent = "Could not save to this phone's storage. Download a backup now so nothing is lost.";
      warn.classList.remove("sp-hidden");
    } else {
      warn.classList.add("sp-hidden");
    }
  }

  /* SPOTTER-UI-FEATURES-START */
  function refresh() {
    renderBanners();
    var info = $("spBackupInfo");
    if (info) info.innerHTML = backupInfoHtml();
  }
  function onDateChange() {}
  function onViewChange() { refresh(); }
  function renderWorkoutExtras() {}
  function renderTab() {}
  function floorWarn() {}
  function saveSleep() {}
  function whySolver() {}
  function runSolver() {}
  function onGapInput() {}
  function onBudgetInput() {}
  var extraApi = {};
  /* SPOTTER-UI-FEATURES-END */

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  function init() {
    loadState();
    SpotterStore.saveSpotter(state); // writes defaults on first run; a no-op change afterwards
    try {
      // Ask the browser to keep this site's storage. No network involved.
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    } catch (e) {}
    renderWorkout();
    renderNutrition();
    refresh();
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
