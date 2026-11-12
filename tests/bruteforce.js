/*
 * INDEPENDENT brute-force solver for ACT III.
 *
 * Used only by tests and tests/validate.js. It shares no code with
 * src/spotter-core.js: it reads the raw catalog itself, and it tries every
 * possible combination of whole servings, one by one. It is slow and simple on
 * purpose, so it can be trusted as a referee for the branch-and-bound solver.
 *
 * Same model definition as the solver:
 *   price is counted in whole paise, protein and calories in thousandths.
 */
"use strict";

function usableItems(catalog) {
  const out = [];
  for (const it of catalog) {
    if (!it || it.available === false) continue;
    if (it.price === null || it.price === undefined || it.price === "") continue;
    const price = Number(it.price);
    if (!(price > 0)) continue;
    const pro = Number(it.pro), cal = Number(it.cal);
    if (!(pro >= 0) || !(cal >= 0)) continue;
    let max = Math.floor(Number(it.maxServings));
    if (!(max >= 1)) max = 3;
    if (max > 10) max = 10;
    out.push({ name: it.name, paise: Math.round(price * 100), mg: Math.round(pro * 1000), mk: Math.round(cal * 1000), max });
  }
  return out;
}

function searchSpace(catalog) {
  return usableItems(catalog).reduce((n, it) => n * (it.max + 1), 1);
}

// Tries every combination. Returns the best "cheapest cover" and the best "most protein".
function bruteForce(catalog, gap, caloriesRemaining, budget) {
  const items = usableItems(catalog);
  const gapMg = Math.round(gap * 1000);
  const calMk = Math.round(caloriesRemaining * 1000);
  const budgetPaise = Math.round(budget * 100);
  const counts = items.map(() => 0);
  let cheapest = null; // min cost, then min calories, then fewest different items
  let mostProtein = { paise: 0, mg: 0, mk: 0, distinct: 0, counts: counts.slice() }; // max protein, then min cost, calories, items
  let combos = 0;

  for (;;) {
    combos++;
    let paise = 0, mg = 0, mk = 0, distinct = 0;
    for (let i = 0; i < items.length; i++) {
      paise += counts[i] * items[i].paise;
      mg += counts[i] * items[i].mg;
      mk += counts[i] * items[i].mk;
      if (counts[i] > 0) distinct++;
    }
    if (paise <= budgetPaise && mk <= calMk) {
      if (mg >= gapMg) {
        if (cheapest === null ||
            paise < cheapest.paise ||
            (paise === cheapest.paise && (mk < cheapest.mk || (mk === cheapest.mk && distinct < cheapest.distinct)))) {
          cheapest = { paise, mg, mk, distinct, counts: counts.slice() };
        }
      }
      if (mg > mostProtein.mg ||
          (mg === mostProtein.mg && (paise < mostProtein.paise ||
            (paise === mostProtein.paise && (mk < mostProtein.mk || (mk === mostProtein.mk && distinct < mostProtein.distinct)))))) {
        mostProtein = { paise, mg, mk, distinct, counts: counts.slice() };
      }
    }
    // odometer: next combination
    let p = 0;
    while (p < items.length) {
      if (counts[p] < items[p].max) { counts[p]++; break; }
      counts[p] = 0; p++;
    }
    if (p === items.length) break;
  }
  return { feasible: cheapest !== null, cheapest, mostProtein, combos, items };
}

module.exports = { bruteForce, searchSpace, usableItems };
