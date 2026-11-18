/*
 * Soundtrack for the Spotter trailer, synthesized from scratch with the Web Audio API.
 * No samples, no downloads, no third-party music: it is original and royalty-free, so LinkedIn
 * has nothing to mute for copyright. It is rendered offline (faster than real time) and is the
 * same every run (seeded noise).
 *
 * 120 BPM in A minor (Am - F - C - G). Sections follow the scenes in timeline.js:
 *   hook: low drone + typing ticks + glitch -> title: impact + kick -> problem: groove builds
 *   -> workflow: arpeggio joins -> demo: full groove with snare-roll fills -> honest: breakdown
 *   -> proof: groove returns, counter ticks and dings -> outro: final hit, fade.
 */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

async function buildSoundtrack(TL) {
  const sr = 44100, secs = TL.total + 2.6;
  const oc = new OfflineAudioContext(2, Math.ceil(sr * secs), sr);
  const rnd = mulberry32(1945);
  const beat = 60 / TL.bpm, step = beat / 4, bar = beat * 4;

  // ---------- buses ----------
  const out = oc.createGain(); out.gain.value = 0.85;
  const comp = oc.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 3.2; comp.attack.value = 0.004; comp.release.value = 0.14;
  const clip = oc.createWaveShaper(); const curve = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) { const x = i / 2047 * 2 - 1; curve[i] = Math.tanh(1.2 * x) / Math.tanh(1.2); }
  clip.curve = curve; clip.oversample = "2x";
  out.connect(comp); comp.connect(clip); clip.connect(oc.destination);

  const drums = oc.createGain(); drums.gain.value = 0.95; drums.connect(out);
  const music = oc.createGain(); music.gain.value = 0.85;       // everything melodic sits here and is ducked by the kick
  const pump = oc.createGain(); pump.gain.value = 1; music.connect(pump); pump.connect(out);

  const impulse = oc.createBuffer(2, Math.floor(sr * 2.2), sr);
  for (let c = 0; c < 2; c++) { const d = impulse.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / d.length, 2.8); }
  const verb = oc.createConvolver(); verb.buffer = impulse;
  const verbSend = oc.createGain(); verbSend.gain.value = 0.2; verbSend.connect(verb);
  const verbOut = oc.createGain(); verbOut.gain.value = 0.9; verb.connect(verbOut); verbOut.connect(out);

  const delay = oc.createDelay(1); delay.delayTime.value = beat * 0.75;
  const fb = oc.createGain(); fb.gain.value = 0.32; delay.connect(fb); fb.connect(delay);
  const delaySend = oc.createGain(); delaySend.gain.value = 0.3; delaySend.connect(delay);
  const delayOut = oc.createGain(); delayOut.gain.value = 0.5; delay.connect(delayOut); delayOut.connect(out);

  const nbuf = oc.createBuffer(1, sr * 3, sr); { const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }

  // ---------- helpers ----------
  const filt = (type, f, q) => { const b = oc.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q == null ? 0.7 : q; return b; };
  const envGain = (t, a, d, peak) => { const g = oc.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); return g; };
  const noise = (t, dur) => { const s = oc.createBufferSource(); s.buffer = nbuf; s.start(t, rnd() * (3 - dur - 0.1), dur); return s; };
  const panner = p => { const n = oc.createStereoPanner(); n.pan.value = p; return n; };
  const ducks = [];

  // ---------- instruments ----------
  function kick(t, g) {
    const o = oc.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.16);
    const e = envGain(t, 0.002, 0.42, g); o.connect(e); e.connect(drums); o.start(t); o.stop(t + 0.5);
    const n = noise(t, 0.03), hp = filt("highpass", 2200), ne = envGain(t, 0.001, 0.02, 0.22 * g);
    n.connect(hp); hp.connect(ne); ne.connect(drums);
    ducks.push(t);
  }
  function clap(t, g) {
    [0, 0.012, 0.026].forEach((d, i) => {
      const n = noise(t + d, 0.25), bp = filt("bandpass", 1700, 0.9);
      const e = envGain(t + d, 0.001, i === 2 ? 0.2 : 0.04, g * (i === 2 ? 1 : 0.7));
      n.connect(bp); bp.connect(e); e.connect(drums); e.connect(verbSend);
    });
  }
  function snare(t, g) {
    const n = noise(t, 0.25), hp = filt("highpass", 900), e = envGain(t, 0.001, 0.14, g);
    n.connect(hp); hp.connect(e); e.connect(drums); e.connect(verbSend);
    const o = oc.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    const oe = envGain(t, 0.001, 0.09, g * 0.6); o.connect(oe); oe.connect(drums); o.start(t); o.stop(t + 0.15);
  }
  function hat(t, g, open) {
    const n = noise(t, open ? 0.3 : 0.08), hp = filt("highpass", 7200), e = envGain(t, 0.001, open ? 0.22 : 0.04, g);
    n.connect(hp); hp.connect(e); e.connect(drums);
  }
  function crash(t, g) {
    const n = noise(t, 1.6), hp = filt("highpass", 5200), e = envGain(t, 0.002, 1.4, g);
    n.connect(hp); hp.connect(e); e.connect(out); e.connect(verbSend);
  }
  function bass(t, f, dur, g) {
    const o = oc.createOscillator(); o.type = "sawtooth"; o.frequency.value = f * 2;
    const lp = filt("lowpass", 900, 1.2); lp.frequency.setValueAtTime(1100, t); lp.frequency.exponentialRampToValueAtTime(160, t + dur);
    const e = oc.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + 0.008); e.gain.setValueAtTime(g, t + dur * 0.6); e.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(lp); lp.connect(e); e.connect(music); o.start(t); o.stop(t + dur + 0.08);
    const s = oc.createOscillator(); s.type = "sine"; s.frequency.value = f * 1.0;
    const se = envGain(t, 0.01, dur, g * 0.9); s.connect(se); se.connect(music); s.start(t); s.stop(t + dur + 0.1);
  }
  function pad(t, freqs, dur, g) {
    freqs.forEach((f, k) => [-7, 7].forEach((c, j) => {
      const o = oc.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = c;
      const lp = filt("lowpass", 1500, 0.5); lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1800, t + dur * 0.7);
      const e = oc.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + 0.5); e.gain.setValueAtTime(g, t + dur - 0.4); e.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
      const p = panner(((k + j) % 2 ? 1 : -1) * 0.45);
      o.connect(lp); lp.connect(e); e.connect(p); p.connect(music); e.connect(verbSend); o.start(t); o.stop(t + dur + 0.5);
    }));
  }
  function arp(t, f, g) {
    const o = oc.createOscillator(); o.type = "square"; o.frequency.value = f;
    const lp = filt("lowpass", 3400, 0.8); lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.2);
    const e = envGain(t, 0.004, 0.2, g); const p = panner(Math.sin(t * 3) * 0.5);
    o.connect(lp); lp.connect(e); e.connect(p); p.connect(music); e.connect(delaySend); e.connect(verbSend); o.start(t); o.stop(t + 0.3);
  }
  function riser(a, b, g) {
    const n = oc.createBufferSource(); n.buffer = nbuf; n.loop = true; n.start(a); n.stop(b + 0.05);
    const bp = filt("bandpass", 300, 2.5); bp.frequency.setValueAtTime(300, a); bp.frequency.exponentialRampToValueAtTime(7500, b);
    const e = oc.createGain(); e.gain.setValueAtTime(0.0001, a); e.gain.exponentialRampToValueAtTime(g, b - 0.02); e.gain.linearRampToValueAtTime(0.0001, b + 0.04);
    n.connect(bp); bp.connect(e); e.connect(out); e.connect(verbSend);
  }
  function impact(t, s) {
    const o = oc.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.9);
    const e = envGain(t, 0.004, 1.5, 0.85 * s); o.connect(e); e.connect(out); o.start(t); o.stop(t + 1.6);
    const n = noise(t, 1.6), lp = filt("lowpass", 900); lp.frequency.setValueAtTime(2500, t); lp.frequency.exponentialRampToValueAtTime(120, t + 1.2);
    const ne = envGain(t, 0.002, 1.3, 0.5 * s); n.connect(lp); lp.connect(ne); ne.connect(out); ne.connect(verbSend);
    crash(t, 0.14 * s);
  }
  function pop(t, i) {
    const f = [880, 1046.5, 1318.5, 1568, 1760, 1318.5][i % 6];
    const o = oc.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f * 0.8, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const e = envGain(t, 0.003, 0.22, 0.15); o.connect(e); e.connect(out); e.connect(verbSend); o.start(t); o.stop(t + 0.3);
    const th = oc.createOscillator(); th.type = "sine"; th.frequency.setValueAtTime(140, t); th.frequency.exponentialRampToValueAtTime(70, t + 0.1);
    const te = envGain(t, 0.003, 0.12, 0.1); th.connect(te); te.connect(out); th.start(t); th.stop(t + 0.15);
  }
  function tick(t, f, g) {
    const o = oc.createOscillator(); o.type = "triangle"; o.frequency.value = f;
    const e = envGain(t, 0.001, 0.03, g); o.connect(e); e.connect(out); o.start(t); o.stop(t + 0.05);
  }
  function ding(t) {
    [1318.5, 1975.5, 2637].forEach((f, i) => {
      const o = oc.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const e = envGain(t, 0.002, 0.7 - i * 0.15, 0.12 / (i + 1)); o.connect(e); e.connect(out); e.connect(verbSend); o.start(t); o.stop(t + 0.9);
    });
  }
  function thump(t, g) {
    const o = oc.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
    const e = envGain(t, 0.003, 0.28, g); o.connect(e); e.connect(out); o.start(t); o.stop(t + 0.4);
    const n = noise(t, 0.05), bp = filt("bandpass", 3000, 1), ne = envGain(t, 0.001, 0.03, 0.08); n.connect(bp); bp.connect(ne); ne.connect(out);
  }
  function drone(a, b) {
    [55, 110, 164.81].forEach((f, i) => {
      const o = oc.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const e = oc.createGain(); e.gain.setValueAtTime(0.0001, a); e.gain.linearRampToValueAtTime(0.1 / (i + 1), a + 2.5); e.gain.setValueAtTime(0.1 / (i + 1), b - 0.1); e.gain.linearRampToValueAtTime(0.0001, b + 0.3);
      o.connect(e); e.connect(out); o.start(a); o.stop(b + 0.4);
    });
  }

  // ---------- arrangement ----------
  const CH = [
    { root: 55,    pad: [220, 261.63, 329.63], arp: [440, 523.25, 659.25, 880, 659.25, 523.25, 659.25, 523.25] },
    { root: 43.65, pad: [174.61, 220, 261.63], arp: [349.23, 440, 523.25, 698.46, 523.25, 440, 523.25, 440] },
    { root: 65.41, pad: [196, 261.63, 329.63], arp: [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 783.99, 659.25] },
    { root: 49,    pad: [196, 246.94, 293.66], arp: [392, 493.88, 587.33, 783.99, 587.33, 493.88, 587.33, 493.88] }
  ];
  const SECS = [
    { a: 0,  b: 4,  kick: 0, clap: 0, hat: 0, bass: 0, pad: 0,   arp: 0 },
    { a: 4,  b: 6,  kick: 1, clap: 0, hat: 0, bass: 1, pad: 1,   arp: 0 },
    { a: 6,  b: 14, kick: 1, clap: 1, hat: 1, bass: 1, pad: 1,   arp: 0 },
    { a: 14, b: 18, kick: 1, clap: 1, hat: 2, bass: 1, pad: 1,   arp: 1 },
    { a: 18, b: 28, kick: 1, clap: 1, hat: 2, bass: 1, pad: 1,   arp: 2 },
    { a: 28, b: 58, kick: 1, clap: 1, hat: 3, bass: 2, pad: 1,   arp: 2 },
    { a: 58, b: 64, kick: 0, clap: 0, hat: 0, bass: 3, pad: 1,   arp: 1 },
    { a: 64, b: 74, kick: 1, clap: 1, hat: 2, bass: 2, pad: 1,   arp: 2 },
    { a: 74, b: 80, kick: 1, clap: 1, hat: 3, bass: 2, pad: 1,   arp: 2 },
    { a: 80, b: 99, kick: 0, clap: 0, hat: 0, bass: 0, pad: 0.8, arp: 0 }
  ];
  const secAt = t => SECS.find(s => t >= s.a && t < s.b) || SECS[SECS.length - 1];
  const BASS_PAT = [0, 3, 6, 8, 10, 14];

  drone(0, 4);
  TL.hookWords.forEach((t, i) => thump(t, 0.35 + i * 0.05));
  { const a = TL.hookType[0], b = TL.hookType[1]; for (let i = 0; i < 38; i++) tick(a + (b - a) * i / 38, 1700 + (i % 3) * 120, 0.03); }
  for (let i = 0; i < 9; i++) { // glitch stutter
    const t = TL.glitch[0] + 0.06 * i + rnd() * 0.03, n = noise(t, 0.05), bp = filt("bandpass", 600 + rnd() * 4000, 4), e = envGain(t, 0.001, 0.045, 0.16);
    n.connect(bp); bp.connect(e); e.connect(out);
  }

  const nSteps = Math.floor((TL.total + 2.4) / step);
  for (let s = 0; s < nSteps; s++) {
    const t = s * step, S = secAt(t), ch = CH[Math.floor(t / bar) % 4], inBeat = s % 4, inBar = s % 16;
    if (S.kick && inBeat === 0) kick(t, 1);
    if (S.clap && s % 8 === 4) clap(t, 0.5);
    if (S.hat === 1 && inBeat === 2) hat(t, 0.1, false);
    if (S.hat === 2 && s % 2 === 0) hat(t, s % 4 === 2 ? 0.12 : 0.07, s % 8 === 6);
    if (S.hat === 3) hat(t, s % 4 === 2 ? 0.12 : (s % 2 === 0 ? 0.08 : 0.045), s % 8 === 6);
    if (S.bass === 1 && inBeat === 0) bass(t, ch.root, 0.3, 0.3);
    if (S.bass === 2 && BASS_PAT.indexOf(inBar) >= 0) bass(t, (inBar === 6 || inBar === 14) ? ch.root * 2 : ch.root, 0.2, 0.32);
    if (S.bass === 3 && inBar === 0) bass(t, ch.root, 1.7, 0.3);
    if (S.pad && inBar === 0) pad(t, ch.pad, bar, 0.05 * S.pad);
    if (S.arp === 2 && s % 2 === 0) arp(t, ch.arp[(s / 2) % 8], s % 8 === 0 ? 0.09 : 0.065);
    if (S.arp === 1 && inBeat === 0) arp(t, ch.arp[(s / 4 * 2) % 8], 0.06);
  }

  TL.rolls.forEach(r => { // snare-roll fills
    const a = r[0], b = r[1], half = (a + b) / 2;
    for (let t = a + 0.5; t < half; t += step * 2) snare(t, 0.1 + 0.12 * (t - a) / (b - a));
    for (let t = half; t < b - 0.01; t += step) snare(t, 0.14 + 0.3 * (t - half) / (b - half));
  });
  TL.risers.forEach(r => riser(r[0], r[1], 0.34));
  TL.hits.forEach(h => impact(h[0], h[1]));
  TL.pops.forEach((t, i) => pop(t, i));
  TL.counters.forEach(c => { const n = Math.floor((c[1] - c[0]) / 0.055); for (let i = 0; i < n; i++) tick(c[0] + i * 0.055, 900 + (i / n) * 1500, 0.05); });
  TL.dings.forEach(t => ding(t));

  // kick sidechain: duck the melodic bus on every kick
  ducks.sort((a, b) => a - b);
  pump.gain.setValueAtTime(1, 0);
  let last = -1;
  ducks.forEach(t => { if (t - last < 0.3) return; pump.gain.setValueAtTime(0.35, t); pump.gain.linearRampToValueAtTime(1, t + 0.3); last = t; });

  // final fade
  out.gain.setValueAtTime(0.85, TL.total - 2.4);
  out.gain.linearRampToValueAtTime(0.0001, TL.total + 0.4);

  const buf = await oc.startRendering();

  // normalise to about -1 dBFS and measure
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; } }
  const gain = peak > 0 ? 0.89 / peak : 1;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= gain; }
  const rms = [];
  { const d = buf.getChannelData(0); for (let s = 0; s < TL.total; s++) { let acc = 0; const a = s * sr, b = Math.min(d.length, (s + 1) * sr); for (let i = a; i < b; i++) acc += d[i] * d[i]; rms.push(+(Math.sqrt(acc / (b - a))).toFixed(3)); } }
  return { buffer: buf, stats: { peakBefore: +peak.toFixed(3), gain: +gain.toFixed(2), rmsPerSecond: rms, seconds: buf.duration } };
}

function bufferToWavBase64(buf) {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate, bytes = 44 + n * ch * 2;
  const ab = new ArrayBuffer(bytes), v = new DataView(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, bytes - 8, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, n * ch * 2, true);
  const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const x = Math.max(-1, Math.min(1, chans[c][i])); v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7FFF, true); o += 2; }
  const u8 = new Uint8Array(ab); let s = ""; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
  return btoa(s);
}
