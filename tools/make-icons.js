/*
 * One-off script: draws the Spotter icon (an emerald barbell with a "spotter"
 * chevron under it, on navy) and writes icons/icon.svg plus PNGs at 192, 512
 * and 180 px. Uses only Node built-ins (zlib). Run: node tools/make-icons.js
 *
 * The art stays inside the middle 72% of the square, so the same PNG is safe
 * as a "maskable" icon and as an iOS Home Screen icon (iOS rounds the corners).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const NAVY = [15, 15, 14]; // --bg-main  #0f0f0e (near-black; the name is historical)
const EMERALD = [76, 195, 138]; // --accent   #4cc38a
const MINT = [237, 236, 231]; // --text-main #edece7 (the chevron)

// Shapes in a 0..1 square. Rounded rectangles and thick line segments.
const RECTS = [
  { x0: 0.14, y0: 0.465, x1: 0.86, y1: 0.535, r: 0.03, c: EMERALD }, // bar
  { x0: 0.255, y0: 0.29, x1: 0.335, y1: 0.71, r: 0.03, c: EMERALD }, // inner plate, left
  { x0: 0.665, y0: 0.29, x1: 0.745, y1: 0.71, r: 0.03, c: EMERALD }, // inner plate, right
  { x0: 0.18, y0: 0.36, x1: 0.235, y1: 0.64, r: 0.025, c: EMERALD }, // outer plate, left
  { x0: 0.765, y0: 0.36, x1: 0.82, y1: 0.64, r: 0.025, c: EMERALD } // outer plate, right
];
const LINES = [
  { ax: 0.39, ay: 0.85, bx: 0.5, by: 0.765, w: 0.022, c: MINT }, // spotter chevron, left arm
  { ax: 0.5, ay: 0.765, bx: 0.61, by: 0.85, w: 0.022, c: MINT } // spotter chevron, right arm
];

function inRect(s, x, y) {
  const cx = Math.min(Math.max(x, s.x0 + s.r), s.x1 - s.r);
  const cy = Math.min(Math.max(y, s.y0 + s.r), s.y1 - s.r);
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= s.r * s.r;
}
function inLine(s, x, y) {
  const dx = s.bx - s.ax, dy = s.by - s.ay;
  let t = ((x - s.ax) * dx + (y - s.ay) * dy) / (dx * dx + dy * dy);
  t = Math.min(1, Math.max(0, t));
  const px = s.ax + t * dx, py = s.ay + t * dy;
  return (x - px) * (x - px) + (y - py) * (y - py) <= s.w * s.w;
}
function colourAt(x, y) {
  for (const s of LINES) if (inLine(s, x, y)) return s.c;
  for (const s of RECTS) if (inRect(s, x, y)) return s.c;
  return NAVY;
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const SS = 4; // 4x4 samples per pixel for smooth edges
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let py = 0; py < size; py++) {
    raw[o++] = 0; // filter type 0 for this row
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = colourAt((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
        r += c[0]; g += c[1]; b += c[2];
      }
      raw[o++] = Math.round(r / (SS * SS)); raw[o++] = Math.round(g / (SS * SS)); raw[o++] = Math.round(b / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGB, no alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))
  ]);
}

function svg() {
  const S = 512, hex = c => "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
  const n = v => +(v * S).toFixed(1);
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" role="img" aria-label="Spotter">\n`;
  out += `  <rect width="${S}" height="${S}" fill="${hex(NAVY)}"/>\n`;
  for (const s of RECTS) out += `  <rect x="${n(s.x0)}" y="${n(s.y0)}" width="${n(s.x1 - s.x0)}" height="${n(s.y1 - s.y0)}" rx="${n(s.r)}" fill="${hex(s.c)}"/>\n`;
  for (const s of LINES) out += `  <line x1="${n(s.ax)}" y1="${n(s.ay)}" x2="${n(s.bx)}" y2="${n(s.by)}" stroke="${hex(s.c)}" stroke-width="${n(s.w * 2)}" stroke-linecap="round"/>\n`;
  return out + "</svg>\n";
}

const dir = path.join(__dirname, "..", "icons");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "icon.svg"), svg());
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon-180.png", 180]]) {
  fs.writeFileSync(path.join(dir, name), png(size));
  console.log("wrote icons/" + name);
}
