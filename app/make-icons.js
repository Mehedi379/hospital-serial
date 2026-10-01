/*
 * make-icons.js — one-shot generator: rebuilds every PWA icon from the
 * hospital's official logo (Sylhet Gastroliver Hospital App Icon.png).
 *
 *   node make-icons.js
 *
 * Outputs into app/public/:
 *   icon-192.png, icon-512.png          — "any" mask (full-bleed logo)
 *   icon-maskable-512.png               — safe-zone padded (80%) on brand maroon
 *   apple-touch-icon.png (180x180)
 *   icon-32.png / icon-48.png           — small UI/favicon sizes
 *   favicon.ico                         — single 48x48 PNG-compressed ICO
 *
 * Pure Node: decodes the source PNG, box-downsamples, re-encodes. No deps.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SRC = path.join(__dirname, '..', 'Sylhet Gastroliver Hospital App Icon.png');
const OUT = path.join(__dirname, 'public');
const BRAND_BG = [0x3a, 0x0a, 0x0d]; // app maroon (matches manifest background_color)

/* ---------- PNG decode ---------- */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, w, h, colorType, bitDepth;
  const idat = [];
  let palette = null, trns = null;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.slice(off + 4, off + 8).toString('ascii');
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
      if (bitDepth !== 8) throw new Error('unsupported bit depth ' + bitDepth);
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const stride = w * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const img = Buffer.alloc(w * h * channels);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const cur = raw[pos++];
      const left = x >= channels ? img[y * stride + x - channels] : 0;
      const up = y > 0 ? img[(y - 1) * stride + x] : 0;
      const ul = y > 0 && x >= channels ? img[(y - 1) * stride + x - channels] : 0;
      let val;
      if (filter === 0) val = cur;
      else if (filter === 1) val = cur + left;
      else if (filter === 2) val = cur + up;
      else if (filter === 3) val = cur + ((left + up) >> 1);
      else {
        const p = left + up - ul;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - ul);
        val = cur + (pa <= pb && pa <= pc ? left : pb <= pc ? up : ul);
      }
      img[y * stride + x] = val & 0xff;
    }
  }
  // normalize to RGBA
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s = i * channels, d = i * 4;
    if (colorType === 6) { rgba[d] = img[s]; rgba[d+1] = img[s+1]; rgba[d+2] = img[s+2]; rgba[d+3] = img[s+3]; }
    else if (colorType === 2) { rgba[d] = img[s]; rgba[d+1] = img[s+1]; rgba[d+2] = img[s+2]; rgba[d+3] = 255; }
    else if (colorType === 0) { rgba[d] = rgba[d+1] = rgba[d+2] = img[s]; rgba[d+3] = 255; }
    else if (colorType === 4) { rgba[d] = rgba[d+1] = rgba[d+2] = img[s]; rgba[d+3] = img[s+1]; }
    else if (colorType === 3) {
      const pi = img[s] * 3;
      rgba[d] = palette[pi]; rgba[d+1] = palette[pi+1]; rgba[d+2] = palette[pi+2];
      rgba[d+3] = trns && img[s] < trns.length ? trns[img[s]] : 255;
    }
  }
  return { w, h, data: rgba };
}

/* ---------- resize (box filter, alpha-aware) ---------- */
function resize(src, dw, dh) {
  const { w: sw, h: sh, data } = src;
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * sh / dh), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sh / dh));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * sw / dw), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sw / dw));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1 && sy < sh; sy++) {
        for (let sx = x0; sx < x1 && sx < sw; sx++) {
          const i = (sy * sw + sx) * 4;
          const al = data[i + 3] / 255;
          r += data[i] * al; g += data[i + 1] * al; b += data[i + 2] * al;
          a += data[i + 3]; n++;
        }
      }
      const d = (y * dw + x) * 4;
      const al = a / (n * 255);
      out[d] = al > 0 ? Math.round(r / a * 255) : 0;
      out[d + 1] = al > 0 ? Math.round(g / a * 255) : 0;
      out[d + 2] = al > 0 ? Math.round(b / a * 255) : 0;
      out[d + 3] = Math.round(a / n);
    }
  }
  return { w: dw, h: dh, data: out };
}

/* ---------- PNG encode ---------- */
const crcTable = [];
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, c]);
}
function encodePng(img) {
  const { w, h, data } = img;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- variants ---------- */
function withPadding(img, size, bg) {
  // logo drawn at 80% of the canvas, centered — maskable safe zone
  const inner = resize(img, Math.round(size * 0.8), Math.round(size * 0.8));
  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    out[i * 4] = bg[0]; out[i * 4 + 1] = bg[1]; out[i * 4 + 2] = bg[2]; out[i * 4 + 3] = 255;
  }
  const off = Math.floor((size - inner.w) / 2);
  for (let y = 0; y < inner.h; y++) {
    inner.data.copy(out, ((y + off) * size + off) * 4, y * inner.w * 4, (y + 1) * inner.w * 4);
  }
  return { w: size, h: size, data: out };
}

/* ---------- ICO (single PNG-compressed entry) ---------- */
function makeIco(img) {
  const png = encodePng(img);
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
  head[6] = img.w; head[7] = img.h; head[8] = 0; head[9] = 0;
  head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12);
  head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
  return Buffer.concat([head, png]);
}

/* ---------- main ---------- */
const src = decodePng(fs.readFileSync(SRC));
console.log('source:', src.w + 'x' + src.h);

const write = (name, img) => {
  const buf = name.endsWith('.ico') ? makeIco(img) : encodePng(img);
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('  ✓', name, Math.round(buf.length / 1024) + 'KB');
};

write('icon-192.png', resize(src, 192, 192));
write('icon-512.png', resize(src, 512, 512));
write('icon-maskable-512.png', withPadding(src, 512, BRAND_BG));
write('apple-touch-icon.png', resize(src, 180, 180));
write('icon-32.png', resize(src, 32, 32));
write('icon-48.png', resize(src, 48, 48));
write('favicon.ico', resize(src, 48, 48));
console.log('done → app/public/');
