/*
 * Spotter trailer: all scenes drawn on one 1920x1080 canvas, recorded to MP4 with MediaRecorder.
 * Uses the user's own demo recording (Spotter Demo.mp4) for every shot of the app. Everything else
 * (type, icons, counters, transitions, sound) is generated here. Text on screen contains only facts
 * from the project record (docs/VALIDATION.md, docs/ARCHITECTURE.md).
 *
 *   ?preview=2.5,6,12   draw single frames at those times and return them as images (no recording)
 *   ?avoff=0.12         seconds to delay the picture relative to the sound
 */
(function () {
  "use strict";
  const W = TL.W, H = TL.H, T_END = TL.total;
  const C = { bg: "#0f0f0e", card: "#191918", input: "#222220", line: "#30302d", text: "#edece7", muted: "#a3a29a", dim: "#6c6b65", accent: "#4cc38a", amber: "#dfa63c", red: "#e5675c", blue: "#6fa8dc" };
  const SANS = '"Segoe UI","Helvetica Neue",Arial,sans-serif', MONO = 'Consolas,"Cascadia Mono","Courier New",monospace';

  const cv = document.getElementById("c"); cv.width = W; cv.height = H;
  let ctx = cv.getContext("2d", { alpha: false });
  const off = document.createElement("canvas"); off.width = W; off.height = H;
  const offCtx = off.getContext("2d", { alpha: false });
  const log = s => { window.__log = s; };
  const clamp = (x, a, b) => Math.min(b == null ? 1 : b, Math.max(a == null ? 0 : a, x));
  const prog = (t, a, d) => clamp((t - a) / d);
  const ease = {
    out3: t => 1 - Math.pow(1 - t, 3), out5: t => 1 - Math.pow(1 - t, 5), expo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
    inOut3: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  };
  const grng = mulberry32(7);

  // ---------- drawing helpers ----------
  function txt(s, x, y, o) {
    o = o || {};
    ctx.save();
    ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    ctx.font = (o.weight || 700) + " " + (o.size || 48) + "px " + (o.font || SANS);
    ctx.fillStyle = o.color || C.text; ctx.textAlign = o.align || "left"; ctx.textBaseline = o.base || "alphabetic";
    if ("letterSpacing" in ctx) ctx.letterSpacing = (o.ls || 0) + "px";
    ctx.fillText(s, x, y); ctx.restore();
  }
  function mw(s, size, weight, ls, font) {
    ctx.save(); ctx.font = (weight || 700) + " " + size + "px " + (font || SANS);
    if ("letterSpacing" in ctx) ctx.letterSpacing = (ls || 0) + "px";
    const w = ctx.measureText(s).width; ctx.restore(); return w;
  }
  // coloured text typed out character by character; returns the x where the visible text ends
  function rich(parts, nVis, x, y, size, weight, align, alpha, font) {
    const full = parts.map(p => p[0]).join(""), total = mw(full, size, weight, 0, font);
    let cx = align === "center" ? x - total / 2 : x, left = nVis;
    for (const p of parts) {
      if (left <= 0) break;
      txt(p[0].slice(0, left), cx, y, { size, weight, color: p[1], alpha, font });
      cx += mw(p[0], size, weight, 0, font); left -= p[0].length;
    }
    return cx;
  }
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  function card(x, y, w, h, r, fill, stroke, lw) {
    rr(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = lw || 2; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function label(s, x, y, t0, t) {
    const p = prog(t, t0, 0.4); if (p <= 0) return;
    txt(s, x, y, { size: 26, weight: 700, color: C.accent, ls: 6, alpha: p });
    ctx.fillStyle = C.accent; ctx.globalAlpha *= 0.9; ctx.fillRect(x, y + 18, mw(s, 26, 700, 6) * ease.out3(p), 3); ctx.globalAlpha = 1;
  }
  function chip(cx, cy, s, o) {
    o = o || {}; const size = o.size || 26, pad = o.pad || 30, w = mw(s, size, 700, 3) + pad * 2, h = size + 32;
    ctx.save(); ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    card(cx - w / 2, cy - h / 2, w, h, h / 2, o.fill || "rgba(0,0,0,0)", o.stroke || C.line, 2);
    txt(s, cx, cy + size * 0.35, { size, weight: 700, color: o.color || C.muted, align: "center", ls: 3 });
    ctx.restore(); return w;
  }
  function callout(x, y, s, color, t0, t) {
    const p = prog(t, t0, 0.4); if (p <= 0) return;
    const e = ease.back(p), w = 68 + mw(s, 38, 600) + 40;
    ctx.save(); ctx.globalAlpha *= clamp(p * 3);
    ctx.translate(x, y + 38); ctx.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e); ctx.translate(-x, -(y + 38));
    card(x, y, w, 76, 20, C.card, C.line, 2);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x + 38, y + 38, 13, 0, 7); ctx.fill();
    txt(s, x + 68, y + 51, { size: 38, weight: 600 });
    ctx.restore();
  }
  function formulaBox(x, y, lines, t, t0, t1, size) {
    const p = prog(t, t0 - 0.3, 0.3); if (p <= 0) return;
    size = size || 30; const h = 44 + lines.length * (size + 22), full = lines.join("\n"), n = Math.floor(full.length * prog(t, t0, t1 - t0) + 0.001);
    ctx.save(); ctx.globalAlpha *= p; card(x, y, 800, h, 16, C.input, C.line, 2);
    let left = n, yy = y + 22 + size + 6, endX = x + 28, endY = yy;
    for (const ln of lines) {
      const seg = ln.slice(0, Math.max(0, left)); txt(seg, x + 28, yy, { size, weight: 500, font: MONO, color: C.text });
      endX = x + 28 + mw(seg, size, 500, 0, MONO); endY = yy; left -= ln.length + 1; yy += size + 22; if (left <= 0) break;
    }
    if (t < t1 + 1.5 && Math.floor(t * 2.5) % 2 === 0) { ctx.fillStyle = C.accent; ctx.fillRect(endX + 4, endY - size + 4, 12, size); }
    ctx.restore();
  }
  function strokePath(pathFn, len, p, color, lw) {
    if (p <= 0) return;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.setLineDash([len * p, len * 2]); ctx.beginPath(); pathFn(); ctx.stroke(); ctx.restore();
  }
  function check(x, y, s, p, color) {
    strokePath(() => { ctx.moveTo(x, y + s * 0.5); ctx.lineTo(x + s * 0.35, y + s * 0.85); ctx.lineTo(x + s, y + s * 0.1); }, s * 1.6, p, color, 7);
  }

  // ---------- sprites ----------
  let shadowSprite, glowSprite, vignette;
  function makeSprites() {
    shadowSprite = document.createElement("canvas"); shadowSprite.width = 760; shadowSprite.height = 1260;
    let c = shadowSprite.getContext("2d"); c.filter = "blur(36px)"; c.fillStyle = "rgba(0,0,0,0.8)"; c.beginPath(); c.roundRect(130, 170, 500, 900, 70); c.fill();
    glowSprite = document.createElement("canvas"); glowSprite.width = 900; glowSprite.height = 1300;
    c = glowSprite.getContext("2d"); const g = c.createRadialGradient(450, 650, 60, 450, 650, 520);
    g.addColorStop(0, "rgba(76,195,138,0.2)"); g.addColorStop(1, "rgba(76,195,138,0)"); c.fillStyle = g; c.fillRect(0, 0, 900, 1300);
    vignette = document.createElement("canvas"); vignette.width = W; vignette.height = H;
    c = vignette.getContext("2d"); const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)"); c.fillStyle = v; c.fillRect(0, 0, W, H);
  }
  // 0..1 spike on every beat (120 BPM) while the kick is playing: the visuals breathe with the music
  function beatPulse(t) {
    const kicking = (t >= 4 && t < 58) || (t >= 64 && t < 80); if (!kicking) return 0;
    return Math.exp(-(t % 0.5) * 9);
  }
  function drawBg(t) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(237,236,231," + (0.05 + 0.035 * beatPulse(t)).toFixed(3) + ")";
    const sp = 56, o = (t * 9) % sp;
    for (let y = -sp; y < H + sp; y += sp) for (let x = -sp; x < W + sp; x += sp) ctx.fillRect(x + o, y + o * 0.5, 2, 2);
    ctx.drawImage(vignette, 0, 0);
  }

  // ---------- video segments (the user's own demo recording) ----------
  const segs = TL.segs.map(s => Object.assign({}, s, { v: null, state: "idle" }));
  function loadSeg(seg) {
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = "/demo.mp4";
    v.style.cssText = "position:fixed;left:-9999px;top:0;width:2px";
    document.body.appendChild(v); seg.v = v;
    return new Promise((res, rej) => {
      v.addEventListener("loadedmetadata", () => { v.currentTime = seg.src; }, { once: true });
      v.addEventListener("seeked", () => res(), { once: true });
      v.addEventListener("error", () => rej(new Error("could not load the demo video")), { once: true });
    });
  }
  const seek = (v, time) => new Promise(r => { const h = () => { v.removeEventListener("seeked", h); r(); }; v.addEventListener("seeked", h); v.currentTime = time; });
  function pickSeg(group, t) { const list = segs.filter(s => s.group === group); let best = list[0]; for (const s of list) if (t >= s.t) best = s; return best; }
  function updateVideos(t) {
    for (const s of segs) {
      if (s.state === "idle" && t >= s.t) { s.v.playbackRate = s.rate || 1; s.v.play().catch(() => {}); s.state = "playing"; }
      else if (s.state === "playing" && t >= s.t + s.d) { s.v.pause(); s.state = "done"; }
    }
  }
  async function syncVideosTo(t) {
    for (const s of segs) { const target = s.src + clamp(t - s.t, 0, s.d); if (Math.abs(s.v.currentTime - target) > 0.03) await seek(s.v, target); }
  }

  function phone(group, t, cx, cy, sc, alpha) {
    const seg = pickSeg(group, t), v = seg.v; if (!v) return;
    const sw = 384 * sc, sh = 848 * sc, bz = 14 * sc, r = 34 * sc;
    ctx.save(); ctx.globalAlpha *= alpha == null ? 1 : alpha;
    const gw = 900 * sc * 1.15, gh = 1300 * sc * 1.15, pulse = beatPulse(t);
    ctx.save(); ctx.globalAlpha *= 0.75 + 0.5 * pulse; ctx.drawImage(glowSprite, cx - gw / 2, cy - gh / 2, gw, gh); ctx.restore();
    const dw = (sw + 2 * bz) * 760 / 500, dh = (sh + 2 * bz) * 1260 / 900; ctx.drawImage(shadowSprite, cx - dw / 2, cy - dh / 2 + 18, dw, dh);
    rr(cx - sw / 2 - bz, cy - sh / 2 - bz, sw + 2 * bz, sh + 2 * bz, r + bz); ctx.fillStyle = "#161615"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#3a3a36"; ctx.stroke();
    ctx.save(); rr(cx - sw / 2, cy - sh / 2, sw, sh, r); ctx.clip(); ctx.fillStyle = C.bg; ctx.fillRect(cx - sw / 2, cy - sh / 2, sw, sh);
    if (v.readyState >= 2) ctx.drawImage(v, 0, 0, v.videoWidth, v.videoHeight, cx - sw / 2, cy - sh / 2, sw, sh);
    ctx.restore();
    ctx.restore();
  }

  // ---------- scenes ----------
  function sceneHook(t) {
    const size = 128, weight = 800, w1 = ["Fitness", "bands", "cost", "money."], sp = mw(" ", size, weight);
    const widths = w1.map(w => mw(w, size, weight)), total = widths.reduce((a, b) => a + b, 0) + sp * 3;
    const q = ease.inOut3(prog(t, 1.9, 0.5)), y1 = 500 - q * 140, a1 = 1 - q * 0.65;
    let x = (W - total) / 2;
    w1.forEach((w, i) => { const p = prog(t, TL.hookWords[i], 0.45); if (p > 0) txt(w, x, y1 + (1 - ease.back(p)) * 70, { size, weight, alpha: clamp(p * 4) * a1 }); x += widths[i] + sp; });
    const parts = [["Your ", C.text], ["logbook", C.accent], [" already holds the signal.", C.text]];
    const full = parts.map(p => p[0]).join(""), n = Math.floor(full.length * prog(t, TL.hookType[0], TL.hookType[1] - TL.hookType[0]) + 0.001);
    if (n > 0) {
      const endX = rich(parts, n, W / 2, 650, 92, 700, "center", 1);
      if (Math.floor(t * 3) % 2 === 0) { ctx.fillStyle = C.accent; ctx.fillRect(endX + 8, 650 - 72, 12, 84); }
    }
    ctx.fillStyle = C.accent; ctx.fillRect(140, 100, 120 * ease.out3(prog(t, 0.1, 0.8)), 4);
    txt("AI-INNOVEX 2026", 140, 150, { size: 24, weight: 700, color: C.muted, ls: 6, alpha: prog(t, 0.3, 0.5) });
  }
  function glitchWrap(fn, t) {
    const u = prog(t, TL.glitch[0], TL.glitch[1] - TL.glitch[0]), saved = ctx;
    ctx = offCtx; offCtx.fillStyle = C.bg; offCtx.fillRect(0, 0, W, H); fn(t); ctx = saved;
    ctx.drawImage(off, 0, 0);
    for (let k = 0; k < 10; k++) { const sy = Math.floor(grng() * H), sh = 10 + Math.floor(grng() * 70), dx = (grng() - 0.5) * (20 + u * 140) * (0.4 + u); ctx.drawImage(off, 0, sy, W, sh, dx, sy, W, sh); }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35 * (0.3 + u); ctx.drawImage(off, -8 * (1 + u), 0); ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,0.12)"; for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  }

  function sceneTitle(t) {
    const lt = t - 4, cx = 960, cy = 270;
    const bar = () => { ctx.moveTo(cx - 290, cy); ctx.lineTo(cx + 290, cy); };
    const plate = (x, y, w, h) => () => { ctx.roundRect(x, y, w, h, 10); };
    const plates = [[cx - 222, cy - 78, 44, 156, 0.35], [cx + 178, cy - 78, 44, 156, 0.35], [cx - 268, cy - 52, 28, 104, 0.55], [cx + 240, cy - 52, 28, 104, 0.55]];
    const fillA = 0.16 * prog(lt, 1.0, 0.4);
    if (fillA > 0) { ctx.save(); ctx.globalAlpha *= fillA; ctx.fillStyle = C.accent; plates.forEach(p => { rr(p[0], p[1], p[2], p[3], 10); ctx.fill(); }); ctx.restore(); }
    strokePath(bar, 580, ease.out3(prog(lt, 0.05, 0.5)), C.accent, 10);
    plates.forEach(p => strokePath(plate(p[0], p[1], p[2], p[3]), 2 * (p[2] + p[3]), ease.out3(prog(lt, p[4], 0.5)), C.accent, 10));
    const word = "SPOTTER", size = 250, ls = 6, ws = word.split("").map(ch => mw(ch, size, 800, 0) + ls), total = ws.reduce((a, b) => a + b, 0) - ls;
    let x = (W - total) / 2; const y = 640;
    word.split("").forEach((ch, i) => {
      const p = prog(lt, 0.05 + i * 0.07, 0.35), e = ease.out5(p), s = 1.8 - 0.8 * e, wch = ws[i] - ls;
      if (p > 0) { ctx.save(); ctx.translate(x + wch / 2, y - 90); ctx.scale(s, s); txt(ch, 0, 90, { size, weight: 800, align: "center", alpha: clamp(p * 5) }); ctx.restore(); }
      x += ws[i];
    });
    ctx.fillStyle = C.accent; ctx.fillRect((W - total) / 2, 676, total * ease.out5(prog(lt, 0.75, 0.5)), 10);
    const tp = prog(lt, 1.1, 0.5);
    if (tp > 0) rich([["Your logbook is the ", C.text], ["wearable", C.accent], [".", C.text]], 99, W / 2, 790 + (1 - ease.out3(tp)) * 24, 60, 500, "center", tp);
    const c1 = "AI TECHTRAILBLAZER", c2 = "AI-INNOVEX 2026  ·  THE NORTHCAP UNIVERSITY";
    const w1 = mw(c1, 26, 700, 3) + 60, w2 = mw(c2, 26, 700, 3) + 60, gap = 24, x0 = W / 2 - (w1 + w2 + gap) / 2;
    chip(x0 + w1 / 2, 890, c1, { stroke: C.accent, color: C.accent, alpha: prog(lt, 1.7, 0.3) });
    chip(x0 + w1 + gap + w2 / 2, 890, c2, { alpha: prog(lt, 1.9, 0.3) });
    if (lt < 0.3) { ctx.fillStyle = "rgba(255,255,255," + (0.85 * (1 - lt / 0.3)).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); }
  }

  function sceneProblem(t) {
    const lt = t - 8;
    label("01 · PROBLEM ADDRESSED", 140, 130, 8.2, t);
    const p1 = prog(lt, 0.4, 0.6); txt("Heavy exam weeks.", 140, 280 + (1 - ease.out3(p1)) * 30, { size: 96, weight: 800, alpha: p1 });
    const p2 = prog(lt, 0.9, 0.6); txt("No band. No budget.", 140, 390 + (1 - ease.out3(p2)) * 30, { size: 96, weight: 800, color: C.muted, alpha: p2 });
    ["Is today a strong day, or a tired one?", "Should I ease off before this exam?", "How do I hit my protein on ₹60?"].forEach((q, i) => {
      const p = prog(t, TL.problemCards[i], 0.6); if (p <= 0) return;
      const x = 140 - (1 - ease.expo(p)) * 1300, y = 520 + i * 130;
      card(x, y, 1180, 104, 22, C.card, C.line, 2);
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(x + 62, y + 52, 28, 0, 7); ctx.fill();
      txt(String(i + 1), x + 62, y + 64, { size: 34, weight: 800, color: "#06140d", align: "center" });
      txt(q, x + 118, y + 68, { size: 44, weight: 600 });
    });
    const cx = 1590, pf = prog(t, 12.8, 0.4);
    txt("Fitness band", cx, 500, { size: 46, weight: 600, color: C.muted, align: "center", alpha: pf });
    txt("+ subscription", cx, 558, { size: 46, weight: 600, color: C.muted, align: "center", alpha: pf });
    const sp = ease.out3(prog(t, TL.strike, 0.35));
    if (sp > 0) { ctx.strokeStyle = C.red; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(cx - 200, 520); ctx.lineTo(cx - 200 + 400 * sp, 520 - 6 * sp); ctx.stroke(); }
    const pl = prog(t, TL.yourLog, 0.5); txt("Your logbook", cx, 690 + (1 - ease.out3(pl)) * 24, { size: 60, weight: 800, color: C.accent, align: "center", alpha: pl });
    const pz = prog(t, TL.zero, 0.4);
    if (pz > 0) { ctx.save(); ctx.translate(cx, 910); const s = 1.5 - 0.5 * ease.out5(pz); ctx.scale(s, s); txt("₹0", 0, 0, { size: 210, weight: 800, align: "center", alpha: clamp(pz * 4) }); ctx.restore(); txt("no server  ·  no accounts", cx, 990, { size: 28, color: C.muted, align: "center", alpha: prog(t, TL.zero + 0.5, 0.4) }); }
  }

  function sceneWorkflow(t) {
    const lt = t - 18;
    label("02 · AI-ASSISTED WORKFLOW", 140, 130, 18.2, t);
    txt("THE PIPELINE", 140, 235, { size: 24, weight: 700, color: C.muted, ls: 5, alpha: prog(lt, 0.3, 0.4) });
    const nodes = [["Your logbook", ["never leaves", "your phone"]], ["On-device AI", ["regression · time series", "linear programming"]], ["Your spotter", ["explains", "every call"]]], xs = [360, 960, 1560], y = 300;
    nodes.forEach((n, i) => {
      const p = prog(t, TL.nodes[i], 0.5); if (p <= 0) return; const e = ease.back(p);
      ctx.save(); ctx.globalAlpha *= clamp(p * 3); ctx.translate(xs[i], y + 85); ctx.scale(0.8 + 0.2 * e, 0.8 + 0.2 * e); ctx.translate(-xs[i], -(y + 85));
      card(xs[i] - 230, y, 460, 170, 24, C.card, i === 1 ? C.accent : C.line, i === 1 ? 3 : 2);
      txt(n[0], xs[i], y + 66, { size: 46, weight: 800, align: "center" });
      txt(n[1][0], xs[i], y + 112, { size: 26, weight: 500, color: C.muted, align: "center" });
      txt(n[1][1], xs[i], y + 146, { size: 26, weight: 500, color: C.muted, align: "center" });
      ctx.restore();
    });
    [[600, 720, TL.nodes[1]], [1200, 1320, TL.nodes[2]]].forEach(a => {
      const p = prog(t, a[2] - 0.2, 0.4); if (p <= 0) return;
      ctx.strokeStyle = C.accent; ctx.lineWidth = 4; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(a[0], y + 85); ctx.lineTo(a[0] + (a[1] - a[0]) * p, y + 85); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(a[1] - 4, y + 85); ctx.lineTo(a[1] - 22, y + 70); ctx.moveTo(a[1] - 4, y + 85); ctx.lineTo(a[1] - 22, y + 100); ctx.stroke(); ctx.globalAlpha = 1;
      const dx = a[0] + (a[1] - a[0]) * ((t * 0.9) % 1); ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(dx, y + 85, 8, 0, 7); ctx.fill();
    });
    const cw = ["Regression", "Time series", "Linear programming"], ww = cw.map(s => mw(s.toUpperCase(), 28, 700, 3) + 60), tot = ww.reduce((a, b) => a + b, 0) + 24 * 2;
    let cx = 960 - tot / 2;
    cw.forEach((s, i) => { chip(cx + ww[i] / 2, 560, s.toUpperCase(), { stroke: C.accent, color: C.text, size: 28, alpha: ease.out3(prog(t, TL.chips[i], 0.3)) }); cx += ww[i] + 24; });
    txt("HOW IT WAS BUILT", 140, 690, { size: 24, weight: 700, color: C.muted, ls: 5, alpha: prog(t, 21.9, 0.4) });
    const steps = [["My brief", "formulas, rules, limits"], ["Claude builds", "code and tests"], ["Checked", "118 tests · brute force"], ["I review", "and decide"]], sx = [315, 745, 1175, 1605];
    steps.forEach((s, i) => {
      const p = prog(t, TL.steps[i], 0.45); if (p <= 0) return; const e = ease.out5(p);
      card(sx[i] - 190 - (1 - e) * 80, 740, 380, 130, 20, C.card, i === 3 ? C.accent : C.line, 2);
      ctx.globalAlpha = clamp(p * 3);
      txt(s[0], sx[i] - (1 - e) * 80, 795, { size: 40, weight: 800, align: "center" });
      txt(s[1], sx[i] - (1 - e) * 80, 842, { size: 26, weight: 500, color: C.muted, align: "center" });
      ctx.globalAlpha = 1;
      if (i < 3) { ctx.strokeStyle = C.accent; ctx.lineWidth = 5; ctx.globalAlpha = 0.8 * clamp(p * 3); ctx.beginPath(); ctx.moveTo(sx[i] + 205, 805); ctx.lineTo(sx[i] + 235, 805); ctx.lineTo(sx[i] + 222, 792); ctx.moveTo(sx[i] + 235, 805); ctx.lineTo(sx[i] + 222, 818); ctx.stroke(); ctx.globalAlpha = 1; }
    });
    const foot = "Not an LLM. No server. Nothing leaves the phone.", n = Math.floor(foot.length * prog(t, TL.foot, 1.6) + 0.001);
    if (n > 0) txt(foot.slice(0, n), 140, 960, { size: 36, weight: 600, color: C.accent });
  }

  function actPhone(group, t, base) {
    const lt = t - base, slide = group === "act1" ? ease.expo(prog(t, 28.0, 0.9)) : 1;
    const sc = { act1: 1.06, act2: 1.09, act3: 1.12 }[group] + 0.05 * prog(lt, 0, 10);
    phone(group, t, 520 - (1 - slide) * 520, 540 + Math.sin(t * 1.3) * 5, sc, 1);
  }
  function panelHead(t, lt, act, headParts, sub) {
    const px = 1020, p = prog(lt, 0.5, 0.5);
    txt("03 · FINAL PROOF OF WORK", px, 120, { size: 26, weight: 700, color: C.muted, ls: 5, alpha: prog(lt, 0.4, 0.4) });
    txt(act, px, 210, { size: 40, weight: 800, color: C.accent, ls: 8, alpha: p });
    rich(headParts[0], headParts[1], px, 310 + (1 - ease.out3(p)) * 24, 70, 800, "left", p);
    txt(sub, px, 372, { size: 32, weight: 500, color: C.muted, alpha: prog(lt, 0.8, 0.5) });
  }
  function sceneAct1(t) {
    const lt = t - 28; actPhone("act1", t, 28);
    panelHead(t, lt, "ACT I", [[["Readiness from my lifts", C.text]], 99], "Today's first working set vs my own trend.");
    formulaBox(1020, 430, ["e1RM = weight × (1 + (reps + 10 − RPE) / 30)"], t, 28.8, 31.0, 30);
    callout(1020, 640, "Go for a PR", C.accent, TL.act1Callouts[0], t);
    callout(1020, 740, "Normal day", C.amber, TL.act1Callouts[1], t);
    callout(1020, 840, "Drop a set, keep the weight", C.red, TL.act1Callouts[2], t);
    txt("Regression on my last 8 sessions  ·  z-score vs trend", 1020, 985, { size: 28, color: C.muted, alpha: prog(lt, 2, 0.5) });
  }
  function sceneAct2(t) {
    const lt = t - 38; actPhone("act2", t, 38);
    const v = (1.40 * ease.out3(prog(t, TL.act2Count[0], TL.act2Count[1] - TL.act2Count[0]))).toFixed(2);
    panelHead(t, lt, "ACT II", [[[v + "×", C.accent], [" my usual load.", C.text]], 99], "Exam in 2 days  ·  sleep 5.8 h  ·  Exam-Week Autopilot");
    formulaBox(1020, 430, ["load = session RPE × minutes"], t, 38.8, 40.0, 30);
    callout(1020, 640, "Maintenance mode · one tap", C.amber, TL.act2Callouts[0], t);
    callout(1020, 740, "Undo restores every set", C.blue, TL.act2Callouts[1], t);
    callout(1020, 840, "Session RPE × minutes = load", C.accent, TL.act2Callouts[2], t);
    txt("Time series: this week vs my 4-week average", 1020, 985, { size: 28, color: C.muted, alpha: prog(lt, 2, 0.5) });
  }
  function sceneAct3(t) {
    const lt = t - 48; actPhone("act3", t, 48);
    panelHead(t, lt, "ACT III", [[["40 g short. ₹60 left.", C.text]], 99], "Cheapest canteen combo, solved exactly.");
    formulaBox(1020, 430, ["minimise  cost", "s.t.  protein ≥ gap,  calories ≤ remaining"], t, 49.0, 51.6, 28);
    const pr = prog(t, TL.act3Count[0] - 0.3, 0.4);
    if (pr > 0) {
      const n = Math.round(40 * ease.out3(prog(t, TL.act3Count[0], TL.act3Count[1] - TL.act3Count[0])));
      ctx.save(); ctx.globalAlpha *= pr;
      txt("₹" + n, 1020, 800, { size: 210, weight: 800, color: C.accent });
      txt("50 g protein", 1480, 715, { size: 46, weight: 700 }); txt("452 kcal", 1480, 775, { size: 46, weight: 600, color: C.muted });
      ctx.restore();
    }
    [["2 × boiled eggs", "₹28", TL.act3Lines[1], 860], ["1 × soya chunks", "₹12", TL.act3Lines[2], 912]].forEach(r => {
      const p = prog(t, r[2], 0.35); if (p <= 0) return;
      ctx.save(); ctx.globalAlpha *= p; txt(r[0], 1020, r[3], { size: 34, weight: 600 }); txt(r[1], 1800, r[3], { size: 34, weight: 700, color: C.accent, align: "right" });
      ctx.fillStyle = C.dim; for (let x = 1020 + mw(r[0], 34, 600) + 16; x < 1800 - mw(r[1], 34, 700) - 16; x += 14) ctx.fillRect(x, r[3] - 8, 4, 3);
      ctx.restore();
    });
    txt("Integer linear programming  ·  prices are illustrative", 1020, 985, { size: 26, color: C.dim, alpha: prog(lt, 2.5, 0.5) });
  }

  function sceneHonest(t) {
    const lt = t - 58; phone("honest", t, 470, 540 + Math.sin(t * 1.3) * 5, 0.95, 1);
    const px = 900, p = prog(lt, 0.3, 0.5);
    txt("BUILT TO BE HONEST", px, 120, { size: 26, weight: 700, color: C.accent, ls: 6, alpha: p });
    txt("It shows its work.", px, 250 + (1 - ease.out3(p)) * 24, { size: 84, weight: 800, alpha: p });
    const rows = [["RPE is subjective, so it trusts", "your trend over any single day."], ["Load spikes are flags,", "not injury predictions."], ["Never plans below a safe", "calorie floor."]];
    rows.forEach((r, i) => {
      const t0 = TL.honest[i], pp = prog(t, t0, 0.4); if (pp <= 0) return;
      const y = 380 + i * 150;
      ctx.save(); ctx.globalAlpha *= clamp(pp * 2.5);
      card(px, y, 900, 124, 22, C.card, C.line, 2);
      ctx.fillStyle = "rgba(76,195,138,0.16)"; ctx.beginPath(); ctx.arc(px + 62, y + 62, 34, 0, 7); ctx.fill();
      check(px + 44, y + 40, 36, ease.out3(prog(t, t0 + 0.2, 0.35)), C.accent);
      txt(r[0], px + 120, y + 54, { size: 36, weight: 600 }); txt(r[1], px + 120, y + 98, { size: 36, weight: 600 });
      ctx.restore();
    });
    txt("Wellness guidance, not medical advice.", px, 925, { size: 32, color: C.muted, weight: 500, alpha: prog(t, TL.honest[3], 0.5) });
  }

  function sceneProof(t) {
    const lt = t - 64;
    label("04 · PROMPTS & CODE REVIEW", 140, 130, 64.2, t);
    const hp = prog(lt, 0.3, 0.5); txt("Checked, not just built.", 140, 270 + (1 - ease.out3(hp)) * 24, { size: 92, weight: 800, alpha: hp });
    const cards = [
      { v: p => Math.round(118 * p) + "", label: "unit tests pass" },
      { v: p => Math.round(600 * p) + " / 600", label: "solver cases match a brute-force check" },
      { v: p => (4.77 - 3.62 * p).toFixed(2), label: "points of error vs the RPE chart (4.77 without RPE)" },
      { v: () => "0", label: "servers, accounts or API keys" }
    ], pos = [[140, 360], [1000, 360], [140, 650], [1000, 650]];
    cards.forEach((c, i) => {
      const t0 = TL.proof[i], p = prog(t, t0, 0.5); if (p <= 0) return; const e = ease.back(p), x = pos[i][0], y = pos[i][1];
      ctx.save(); ctx.globalAlpha *= clamp(p * 3); ctx.translate(x + 390, y + 125); ctx.scale(0.85 + 0.15 * e, 0.85 + 0.15 * e); ctx.translate(-(x + 390), -(y + 125));
      card(x, y, 780, 250, 26, C.card, C.line, 2);
      const cp = ease.out3(prog(t, t0 + 0.1, TL.proofCountDur));
      txt(c.v(cp), x + 50, y + 150, { size: 130, weight: 800, color: i === 3 ? C.text : C.accent });
      txt(c.label, x + 50, y + 208, { size: 28, weight: 500, color: C.muted });
      const done = prog(t, t0 + 0.1 + TL.proofCountDur, 0.3); if (done > 0) check(x + 705, y + 40, 38, ease.out3(done), C.accent);
      ctx.restore();
    });
    const ln = "Every call shows its Why.", n = Math.floor(ln.length * prog(t, TL.proofLine, 1.2) + 0.001);
    if (n > 0) txt(ln.slice(0, n), 140, 985, { size: 46, weight: 700 });
  }

  function sceneOutro(t) {
    const lt = t - 74; phone("outro", t, 460, 540 + Math.sin(t * 1.3) * 5, 0.9, 1);
    const px = 900, p = prog(lt, 0.3, 0.6);
    txt("SPOTTER", px, 250 + (1 - ease.out3(p)) * 30, { size: 150, weight: 800, ls: 4, alpha: p });
    rich([["Your logbook is the ", C.text], ["wearable", C.accent], [".", C.text]], 99, px, 330, 50, 500, "left", prog(lt, 0.7, 0.5));
    [["MINE", ["idea · formulas", "thresholds · decisions"], TL.outroCols[0], 900, C.accent], ["CLAUDE", ["code · tests · docs", "written from my brief"], TL.outroCols[1], 1350, C.blue]].forEach(c => {
      const pp = prog(t, c[2], 0.5); if (pp <= 0) return; const e = ease.out5(pp);
      ctx.save(); ctx.globalAlpha *= clamp(pp * 3);
      card(c[3], 400 + (1 - e) * 40, 430, 200, 24, C.card, C.line, 2);
      txt(c[0], c[3] + 36, 462 + (1 - e) * 40, { size: 30, weight: 800, color: c[4], ls: 6 });
      c[1].forEach((w, i) => txt(w, c[3] + 36, 522 + i * 46 + (1 - e) * 40, { size: 32, weight: 500 }));
      ctx.restore();
    });
    const hp = prog(t, TL.hashtags, 0.6);
    txt("#AIInnovex2026  #TheNorthCapUniversity", px, 760, { size: 32, weight: 600, color: C.muted, alpha: hp });
    txt("#NCUGurugram  #ArtificialIntelligence", px, 806, { size: 32, weight: 600, color: C.muted, alpha: hp });
    chip(px + 215, 900, "AI TECHTRAILBLAZER", { stroke: C.accent, color: C.accent, alpha: hp });
    txt("Demo data generated for this video", px, 985, { size: 26, color: C.dim, alpha: prog(t, TL.footer, 0.6) });
  }

  const SCENES = { hook: sceneHook, title: sceneTitle, problem: sceneProblem, workflow: sceneWorkflow, act1: sceneAct1, act2: sceneAct2, act3: sceneAct3, honest: sceneHonest, proof: sceneProof, outro: sceneOutro };
  const sceneIndex = t => { for (let i = 0; i < TL.scenes.length; i++) if (t >= TL.scenes[i][1] && t < TL.scenes[i][2]) return i; return TL.scenes.length - 1; };

  // Before the animation starts, the recorder's encoder needs about a second to warm up. This cold open (a
  // blinking cursor where the first word will appear) fills that time, and keeps the picture changing every
  // frame so the encoder never idles.
  const WARM = 1.5;
  function renderWarm() {
    drawBg(0);
    if (Math.floor(performance.now() / 220) % 2 === 0) { ctx.fillStyle = C.accent; ctx.fillRect(140, 405, 14, 108); }
    ctx.fillStyle = "rgba(237,236,231,0.08)"; ctx.fillRect(0, H - 6, W, 6);
  }
  function renderFrame(t) {
    if (t < 0) { renderWarm(); return; }
    ctx.save();
    let sx = 0, sy = 0;
    TL.hits.forEach(h => { const dt = t - h[0]; if (dt >= 0 && dt < 0.6) { const a = h[1] * 12 * Math.exp(-dt * 9); sx += Math.sin(dt * 85) * a; sy += Math.cos(dt * 70) * a * 0.6; } });
    ctx.translate(sx, sy);
    drawBg(t);
    const i = sceneIndex(t), sc = TL.scenes[i], lt = t - sc[1], id = sc[0];
    if (id === "hook" && t >= TL.glitch[0]) glitchWrap(sceneHook, t);
    else if (id !== "hook" && id !== "title" && lt < 0.5) {
      const edge = ease.inOut3(lt / 0.5) * W, prev = TL.scenes[i - 1];
      ctx.save(); ctx.beginPath(); ctx.rect(edge, 0, W - edge, H); ctx.clip(); SCENES[prev[0]](prev[2] - 0.32); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, edge, H); ctx.clip(); SCENES[id](t); ctx.restore();
      ctx.fillStyle = C.accent; ctx.fillRect(edge - 5, 0, 10, H);
    } else SCENES[id](t);
    ctx.restore();
    ctx.fillStyle = "rgba(237,236,231,0.08)"; ctx.fillRect(0, H - 6, W, 6);
    ctx.fillStyle = C.accent; ctx.fillRect(0, H - 6, W * clamp(t / T_END), 6);
    if (t > T_END - 0.9) { ctx.fillStyle = "rgba(15,15,14," + clamp((t - (T_END - 0.9)) / 0.8).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- main ----------
  const q = new URLSearchParams(location.search);
  const b64 = async blob => { const u8 = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); };

  async function main() {
    try {
      makeSprites();
      log("building soundtrack");
      const sound = await buildSoundtrack(TL);
      window.__audioStats = sound.stats;
      window.__wavB64 = bufferToWavBase64(sound.buffer);
      log("loading demo footage");
      for (const s of segs) await loadSeg(s);

      if (q.get("preview")) {                          // single frames, no recording
        const times = q.get("preview").split(",").map(Number); window.__shots = [];
        for (const t of times) { await syncVideosTo(t); await new Promise(r => setTimeout(r, 120)); renderFrame(t); window.__shots.push(cv.toDataURL("image/jpeg", 0.88)); }
        log("preview ready"); window.__done = true; return;
      }

      log("recording");
      const stream = cv.captureStream(TL.FPS);
      const ac = new AudioContext({ sampleRate: 44100 }); await ac.resume();
      const dest = ac.createMediaStreamDestination(), src = ac.createBufferSource();
      src.buffer = sound.buffer; src.connect(dest); stream.addTrack(dest.stream.getAudioTracks()[0]);
      const mimes = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm"];
      const mime = mimes.find(m => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10e6, audioBitsPerSecond: 256e3 });
      const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      const stopped = new Promise(r => rec.onstop = r);
      renderWarm();
      rec.start(1000);
      const avoff = +(q.get("avoff") || 0);
      src.start(ac.currentTime + 0.3 + WARM);
      const t0 = performance.now() + (300 + WARM * 1000) + avoff * 1000;
      let last = 0, frames = 0, worst = 0, lastDraw = 0, lastRaf = 0;
      const stalls = [], longTasks = [];
      try { new PerformanceObserver(l => l.getEntries().forEach(e => longTasks.push([+((e.startTime - t0) / 1000).toFixed(2), Math.round(e.duration)]))).observe({ type: "longtask", buffered: true }); } catch (e) {}
      await new Promise(resolve => {
        function frame(now) {
          const t = (now - t0) / 1000;
          if (lastRaf && now - lastRaf > 150) stalls.push([+t.toFixed(2), Math.round(now - lastRaf), performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null]);
          lastRaf = now;
          if (now - last >= 1000 / TL.FPS - 3) {
            if (lastDraw) worst = Math.max(worst, now - lastDraw);
            lastDraw = now; last = now;
            const tt = t < 0 ? -1 : clamp(t, 0, T_END); updateVideos(Math.max(tt, 0)); renderFrame(tt); frames++;
            if (frames % 60 === 0) log("recording " + tt.toFixed(1) + " s");
          }
          if (t < T_END + 0.35) requestAnimationFrame(frame); else resolve();
        }
        requestAnimationFrame(frame);
      });
      rec.stop(); await stopped; src.stop();
      const blob = new Blob(chunks, { type: mime });
      window.__b64 = await b64(blob); window.__mime = mime;
      window.__stats = { frames, worstFrameMs: +worst.toFixed(1), bytes: blob.size, mime, stalls, longTasks: longTasks.filter(x => x[1] > 100) };
      log("done: " + JSON.stringify(window.__stats)); window.__done = true;
    } catch (e) { window.__err = String(e && e.stack || e); }
  }
  main();
})();
