/*
 * Spotter configuration.
 * Every threshold and default used by the Spotter logic lives here, so each
 * number can be found, questioned and changed in one place.
 * See docs/DECISIONS.md for why each value was picked.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SpotterConfig = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  return {
    SCHEMA_VERSION: 1, // version number written to spotter_schemaVersion and into backups

    // ---------- ACT I: readiness (regression) ----------
    EPLEY_DIVISOR: 30, // the "30" in Epley: e1RM = w * (1 + reps / 30)
    E1RM_MIN_REPS: 1, // fewest reps a set may have to be used
    E1RM_MAX_REPS: 12, // most reps; above this Epley-style estimates get unreliable
    E1RM_MIN_RPE: 6, // lowest RPE used; below this "reps in reserve" is a guess
    E1RM_MAX_RPE: 10, // RPE 10 = nothing left
    READINESS_WINDOW_DAYS: 90, // only sessions from the last 90 days build the trend
    READINESS_MAX_SESSIONS: 8, // use at most the 8 most recent sessions
    READINESS_MIN_SESSIONS: 4, // no verdict with fewer than 4 sessions
    READINESS_SD_FLOOR_PCT: 0.015, // typical swing is never taken as less than 1.5% of the prediction
    READINESS_Z_PR: 1.0, // z at or above this -> "Go for a PR"
    READINESS_Z_DROP: -1.0, // z at or below this -> "Drop a set, keep the weight"
    READINESS_OUTLIER_T: 4.0, // a past session this many swings off the others' trend is set aside (max one)
    PLACEHOLDER_NAMES: ["Legs Session (Tap name to edit)", "Custom Exercise"], // template names, never matched as history

    // ---------- ACT II: exam-week autopilot (time series) ----------
    LOAD_ACUTE_DAYS: 7, // "this week" = the 7 days ending on the selected date
    LOAD_CHRONIC_WEEKS: 4, // baseline = the 4 weeks before that
    LOAD_MIN_CHRONIC_WEEKS: 2, // need at least 2 baseline weeks with a logged load
    BAND_LOW: 0.8, // ratio below this -> "Lighter than usual"
    BAND_HIGH: 1.3, // ratio above this -> "Load is climbing fast"
    BAND_SPIKE: 1.5, // ratio above this -> "Big spike vs your usual"
    EXAM_WEEK_DAYS: 6, // exam week = an exam today or within the next 6 days
    RAMP_BACK_DAYS: 7, // ramp-back = last exam 1-7 days ago and none in the next 7
    EXAM_COUNTDOWN_DAYS: 14, // show an exam countdown from 14 days out
    SLEEP_NIGHTS: 3, // average the last 3 nights that have a sleep entry
    SLEEP_LOOKBACK_DAYS: 7, // ...but never reach back further than 7 days
    SLEEP_LOW_HOURS: 6.5, // average below this strengthens the maintenance suggestion
    SLEEP_MAX_HOURS: 14, // largest sleep value accepted
    MAINT_SET_FRACTION: 0.6, // maintenance mode keeps ceil(60%) of planned sets
    MAINT_RPE_CAP: 8, // maintenance mode caps target RPE at 8
    RAMP_SET_FRACTION: 0.8, // ramp-back week suggests about 80% of usual sets
    CHART_WEEKS: 6, // weekly-load chart shows the last 6 weeks

    // ---------- ACT III: protein on a hostel budget (integer programming) ----------
    CANTEEN_MAX_SERVINGS_DEFAULT: 3, // default upper bound on servings of one item
    CANTEEN_MAX_SERVINGS_LIMIT: 10, // hard upper bound an item can be set to
    SOLVER_NODE_CAP: 2000000, // safety stop for the search; result is then marked "not proven optimal"

    // ---------- Safety ----------
    CALORIE_FLOOR_DEFAULT: 1500, // general wellness floor in kcal/day (not personalised advice)
    CALORIE_FLOOR_MIN: 1200, // the floor setting itself cannot be set below this
    CALORIE_FLOOR_MAX: 4000, // sanity limit on the floor setting
    LOGGED_DAY_MIN_FOODS: 2, // a day counts as "logged" for intake only with 2+ foods
    LOW_INTAKE_MIN_DAYS: 3, // flag after 3 logged days in a row under the floor
    LOW_INTAKE_MAX_GAP_DAYS: 3, // logged days more than 3 days apart are not "in a row"
    LOW_INTAKE_LOOKBACK_DAYS: 30, // how far back the low-intake check looks

    // ---------- Backup ----------
    BACKUP_REMIND_DAYS: 7 // remind to back up after 7 days (Safari may clear unused site data)
  };
});
