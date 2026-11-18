/*
 * Shared timeline for the Spotter trailer. Both the soundtrack (audio.js) and the animation
 * (trailer.js) read these numbers, so sounds land exactly on the visuals they belong to.
 * All times are in seconds from the start of the trailer. 120 BPM: one beat = 0.5 s, one bar = 2 s.
 *
 * Structure follows the AI TechTrailblazer deliverables:
 *   Problem addressed -> AI-assisted workflow -> Final proof of work (the demo) -> Prompts and code review
 * and the handbook's four video items (intro, Round 1 solution, live demo, AI vs human contribution).
 */
const TL = {
  W: 1920, H: 1080, FPS: 30, total: 82, bpm: 120,

  // [id, start, end]
  scenes: [
    ["hook", 0, 4], ["title", 4, 8], ["problem", 8, 18], ["workflow", 18, 28],
    ["act1", 28, 38], ["act2", 38, 48], ["act3", 48, 58],
    ["honest", 58, 64], ["proof", 64, 74], ["outro", 74, 82]
  ],

  // big sounds + screen shake: [time, strength 0..1]
  hits: [[4, 1], [8, 0.55], [18, 0.6], [28, 0.9], [38, 0.7], [48, 0.7], [58, 0.5], [64, 0.75], [74, 1]],

  // hook
  hookWords: [0.30, 0.55, 0.80, 1.05], hookType: [1.9, 3.4], glitch: [3.45, 4.0],

  // problem
  problemCards: [9.3, 10.1, 10.9], strike: 13.4, yourLog: 14.0, zero: 15.0,

  // workflow
  nodes: [18.5, 19.2, 19.9], chips: [21.2, 21.5, 21.8], steps: [22.2, 22.8, 23.4, 24.0], foot: 25.6,

  // acts
  act1Callouts: [29.5, 31.9, 35.3],
  act2Count: [38.8, 40.2], act2Callouts: [39.8, 42.8, 44.7],
  act3Count: [50.3, 51.3], act3Lines: [49.3, 51.6, 52.0],

  // honest, proof, outro
  honest: [58.9, 59.8, 60.7, 61.8],
  proof: [64.6, 65.2, 65.8, 66.4], proofCountDur: 1.0, proofLine: 70.5,
  outroCols: [75.2, 75.9], hashtags: 77.2, footer: 78.0,

  // pieces of the user's own demo recording (Spotter Demo.mp4): scene time t, length d, source time src, playback rate
  segs: [
    { id: "A1", group: "act1", t: 28.6, d: 2.8, src: 10.2 },   // Flat Bench ticked -> "Go for a PR"
    { id: "A2", group: "act1", t: 31.7, d: 3.2, src: 15.0 },   // Incline "Normal day" + Why? sheet
    { id: "A3", group: "act1", t: 35.2, d: 2.6, src: 28.2 },   // Cable Chest Flyes "Drop a set"
    { id: "B1", group: "act2", t: 38.4, d: 5.7, src: 0.7 },    // Autopilot: apply maintenance mode, undo
    { id: "B2", group: "act2", t: 44.4, d: 3.1, src: 44.5 },   // session RPE chips, 30/30 done
    { id: "C1", group: "act3", t: 48.4, d: 5.4, src: 60.2 },   // protein card, Why?, cheapest combo, logged
    { id: "D1", group: "honest", t: 58.4, d: 2.6, src: 34.0 }, // low-confidence note + one-tap confirm
    { id: "E1", group: "outro", t: 74.4, d: 2.5, src: 71.9 }   // Spotter tab, today's brief
  ]
};

// sounds for UI pops (chips, cards, callouts) and for counters
TL.pops = [].concat(TL.problemCards, TL.nodes, TL.chips, TL.steps, TL.act1Callouts, TL.act2Callouts, TL.act3Lines.slice(0, 1),
  TL.honest, TL.proof, TL.outroCols).sort((a, b) => a - b);
TL.counters = [TL.act2Count, TL.act3Count].concat(TL.proof.map(t => [t + 0.1, t + 0.1 + TL.proofCountDur]));
TL.dings = [TL.act3Count[1], TL.proof[0] + 1.1, TL.proof[1] + 1.1, TL.proof[2] + 1.1, TL.proof[3] + 1.1, TL.proofLine];
// risers (noise sweeps) that end on a section start
TL.risers = [[2.0, 4.0], [16.0, 18.0], [26.0, 28.0], [36.0, 38.0], [46.0, 48.0], [62.0, 64.0], [72.0, 74.0]];
TL.rolls = [[26.0, 28.0], [36.0, 38.0], [46.0, 48.0], [72.0, 74.0]]; // snare rolls

if (typeof module === "object" && module.exports) module.exports = TL;
