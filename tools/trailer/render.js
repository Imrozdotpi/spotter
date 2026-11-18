/*
 * Renders a page in headless Chrome and saves the video it records.
 *
 *   node render.js --root <folder with the page> --page "<file.html?query>" --video "<source mp4>" --out "<output file>" [--timeout 240]
 *
 * The page is served from --root; the source video is served at /demo.mp4 (with Range support).
 * The page records itself with MediaRecorder and, when finished, sets window.__done = true,
 * window.__b64 = base64 of the recording and window.__mime = its MIME type.
 * Nothing leaves this machine: the server listens on 127.0.0.1 only.
 */
"use strict";
const { spawn } = require("child_process");
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");

const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i >= 0 ? process.argv[i + 1] : d; };
const root = path.resolve(arg("root", __dirname));
const page = arg("page", "trailer.html");
const video = arg("video", "");
const out = arg("out", "");
const shots = arg("shots", "");   // prefix for preview frames (page must set window.__shots)
const wav = arg("wav", "");       // path to save the soundtrack as a WAV
const timeoutS = +arg("timeout", 240);
const PORT = 4188, DEBUG = 9344;

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/demo.mp4" && video) {
    const size = fs.statSync(video).size, range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range), start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], size - 1) : size - 1;
      res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Content-Type": "video/mp4" });
      return fs.createReadStream(video, { start, end }).pipe(res);
    }
    res.writeHead(200, { "Accept-Ranges": "bytes", "Content-Length": size, "Content-Type": "video/mp4" });
    return fs.createReadStream(video).pipe(res);
  }
  const f = path.join(root, p === "/" ? "index.html" : p.replace(/^\//, ""));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(f).pipe(res);
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise(r => server.listen(PORT, "127.0.0.1", r));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "spotter-trailer-"));
  const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
    "--headless=new", "--remote-debugging-port=" + DEBUG, "--user-data-dir=" + profile,
    "--autoplay-policy=no-user-gesture-required", "--window-size=1920,1080", "--hide-scrollbars",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
    "about:blank"
  ], { stdio: "ignore" });
  let code = 0;
  try {
    let targets = null;
    for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${DEBUG}/json`)).json(); if (targets.length) break; } catch (e) {} await sleep(500); }
    const tgt = targets.find(t => t.type === "page");
    const ws = new WebSocket(tgt.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pending = {};
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } };
    const send = (method, params) => new Promise(res => { const i = ++id; pending[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async expr => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
    await send("Page.enable"); await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/${page}` });
    const t0 = Date.now(); let last = "";
    while ((Date.now() - t0) / 1000 < timeoutS) {
      await sleep(1000);
      const st = await ev("JSON.stringify({done: !!window.__done, err: window.__err || null, log: window.__log || ''})");
      const s = st ? JSON.parse(st) : {};
      if (s.log && s.log !== last) { console.log("page:", s.log); last = s.log; }
      if (s.err) throw new Error("page error: " + s.err);
      if (s.done) break;
    }
    const grab = async name => {
      const len = await ev("window." + name + " ? window." + name + ".length : 0"), parts = [];
      for (let i = 0; i < len; i += 2000000) parts.push(await ev("window." + name + ".slice(" + i + ", " + Math.min(i + 2000000, len) + ")"));
      return parts.join("");
    };
    const stats = await ev("JSON.stringify({audio: window.__audioStats ? {peakBefore: window.__audioStats.peakBefore, gain: window.__audioStats.gain, seconds: window.__audioStats.seconds} : null, rec: window.__stats || null})");
    console.log("stats", stats);
    if (shots) {
      const n = await ev("window.__shots ? window.__shots.length : 0");
      for (let i = 0; i < n; i++) { const d = await ev("window.__shots[" + i + "]"); fs.writeFileSync(shots + "-" + String(i + 1).padStart(2, "0") + ".jpg", Buffer.from(d.split(",")[1], "base64")); }
      console.log("saved", n, "preview frames");
    }
    if (wav) { const w = await grab("__wavB64"); fs.writeFileSync(wav, Buffer.from(w, "base64")); console.log("saved", wav, fs.statSync(wav).size, "bytes"); }
    if (out) {
      const data = await grab("__b64");
      if (!data) throw new Error("no recording was produced (timeout?)");
      fs.writeFileSync(out, Buffer.from(data, "base64"));
      console.log("saved", out, fs.statSync(out).size, "bytes", await ev("window.__mime"));
    }
  } catch (e) { console.log("FAILED:", e.message); code = 1; }
  finally { chrome.kill(); server.close(); setTimeout(() => process.exit(code), 500); }
})();
