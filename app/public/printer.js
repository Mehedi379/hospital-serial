/*
 * printer.js — one-tap serial-ticket printing for Reception + Assistant.
 *
 * WHY a canvas: thermal printers have no Bangla font built in, so raw ESC/POS
 * text would print Bangla names as garbage. We render the WHOLE ticket to a
 * canvas (the browser draws Bangla perfectly) and print that image. The exact
 * same canvas is used on BOTH print paths, so the ticket looks identical:
 *
 *   1) Bluetooth (no dialog)  — Web Bluetooth: canvas -> 1-bit raster -> ESC/POS
 *                               GS v 0. After a one-time pair, a click prints
 *                               straight to the printer with NO dialog/page.
 *   2) Standard (any printer) — canvas drawn into a hidden iframe and sent to
 *                               the OS print dialog. Works with ANY printer on
 *                               the device (USB / WiFi / desktop / phone).
 *
 * Each device remembers its own choice (localStorage). Bluetooth needs Android
 * Chrome; everything else falls back to Standard automatically.
 */
(function () {
  'use strict';

  const CFG = {
    hospital: 'সিলেট গ্যাস্ট্রোলিভার হাসপাতাল',
    hospitalEn: 'Sylhet Gastroliver Hospital',
    footer: 'ধন্যবাদ — সুস্থ থাকুন',
  };

  const LS_MODE = 'hosp.print.mode';   // 'bt' | 'browser'
  const LS_WIDTH = 'hosp.print.width'; // '58' | '80'

  const getMode = () => localStorage.getItem(LS_MODE) || 'browser';
  const getWidth = () => (localStorage.getItem(LS_WIDTH) === '80' ? 80 : 58);
  // Printable dots: 58mm ≈ 384, 80mm ≈ 576 (standard for most POS heads).
  const dotsFor = (mm) => (mm === 80 ? 576 : 384);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') { try { window.showToast(msg, kind); return; } catch (_) {} }
    // Minimal self-contained toast if the host page has none.
    let t = document.getElementById('__printToast');
    if (!t) {
      t = document.createElement('div');
      t.id = '__printToast';
      t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;background:#222;color:#fff;padding:10px 16px;border-radius:9999px;font:600 13px system-ui;box-shadow:0 6px 20px rgba(0,0,0,.3);max-width:90vw;text-align:center;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2800);
    t.style.transition = 'opacity .3s';
  }

  /* ---------------------------------------------------------------------------
   * Ticket rendering — draw the ticket onto a white canvas at printer dot width.
   * Big serial number is the focus; everything else is supporting text.
   * ------------------------------------------------------------------------- */
  // Room number = floor+chamber (floor 1, ch 03 → Room 103). Accepts either
  // the doctor directory entry (has floor) or the patient record (may only
  // have chamberNumber). ONE shared rule for every page so the same patient
  // always prints the same room.
  function roomFor(doctor, patient) {
    // Only PURE numeric strings count as numbers — parseInt("1A") would
    // wrongly yield 1, so alphanumeric chambers stay as their raw string.
    const num = (v) => (/^\d+$/.test(String(v == null ? '' : v).trim()) ? parseInt(v, 10) : null);
    const fromDoctor = doctor || null;
    const fromPatient = patient || null;
    const f = num(fromDoctor && fromDoctor.floor != null ? fromDoctor.floor : (fromPatient && fromPatient.floor));
    const c = num(fromDoctor && fromDoctor.chamberNumber != null ? fromDoctor.chamberNumber : (fromPatient && fromPatient.chamberNumber));
    if (f != null && f > 0 && c != null) return f * 100 + c;
    if (c != null) return c;
    // Last resort: raw string (e.g. "1A") — keep it readable.
    const raw = (fromDoctor && fromDoctor.chamberNumber) || (fromPatient && fromPatient.chamberNumber);
    return raw != null && raw !== '' ? String(raw) : '—';
  }

  // Make sure the Bangla webfont is actually loaded BEFORE we measure/draw —
  // otherwise the canvas falls back to a system font and the ticket looks
  // different across devices. document.fonts.load() triggers the fetch (the
  // font is only used off-DOM on canvas, so nothing loads it on its own).
  async function ensureBanglaFont(mm) {
    if (!document.fonts || !document.fonts.load) return;
    const W = dotsFor(mm);
    const bn = "'Noto Sans Bengali'";
    const spec = `700 ${Math.round(W * 0.062)}px ${bn}, 600 ${Math.round(W * 0.05)}px ${bn}, 800 ${Math.round(W * 0.34)}px ${bn}`;
    try {
      await Promise.race([
        Promise.all(spec.split(', ').map((s) => document.fonts.load(s, 'সিরিয়াল রোগী 0123456789'))),
        sleep(2500), // never block printing longer than this — OS font is the fallback
      ]);
      await Promise.race([document.fonts.ready, sleep(500)]);
    } catch (_) { /* print anyway with whatever we have */ }
  }

  function wrapText(ctx, text, maxW) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function buildTicketCanvas(data, mm) {
    const W = dotsFor(mm);
    const pad = Math.round(W * 0.05);
    const innerW = W - pad * 2;
    const bn = "'Noto Sans Bengali','Hind Siliguri','Nikosh',sans-serif";
    const mono = "'JetBrains Mono','DejaVu Sans Mono',monospace";

    // Measure pass on a scratch context so we can size the canvas exactly.
    const scratch = document.createElement('canvas').getContext('2d');
    const F = {
      hosp: Math.round(W * 0.062),
      hospEn: Math.round(W * 0.040),
      label: Math.round(W * 0.042),
      serial: Math.round(W * 0.34),   // the star of the ticket
      body: Math.round(W * 0.050),
      foot: Math.round(W * 0.040),
    };
    const lh = (px) => Math.round(px * 1.5); // generous — Bangla marks never clip

    scratch.font = `700 ${F.hosp}px ${bn}`;
    const hospLines = wrapText(scratch, CFG.hospital, innerW);

    const rows = [];
    const pushRow = (label, value) => { if (value != null && value !== '') rows.push([label, value]); };
    pushRow('রোগী', data.name || data.nameEn || '');
    pushRow('ডাক্তার', data.doctor || '');
    pushRow('রুম', data.room != null ? String(data.room) : '');
    pushRow('তারিখ', data.datetime || '');

    // Compute total height.
    let H = pad;
    H += hospLines.length * lh(F.hosp);
    if (CFG.hospitalEn) H += lh(F.hospEn);
    H += Math.round(pad * 0.6);            // rule
    H += lh(F.label);                      // "SERIAL / সিরিয়াল"
    H += Math.round(F.serial * 1.15);      // big number block
    H += Math.round(pad * 0.6);            // rule
    // body rows may wrap (long names)
    scratch.font = `600 ${F.body}px ${bn}`;
    const rowLineCount = rows.map(([lab, val]) => {
      const prefix = lab + ' : ';
      const availW = innerW - scratch.measureText(prefix).width;
      return Math.max(1, wrapText(scratch, val, availW).length);
    });
    rowLineCount.forEach((n) => { H += n * lh(F.body); });
    H += Math.round(pad * 0.6);            // rule
    if (CFG.footer) H += lh(F.foot);
    H += pad;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'top';

    let y = pad;
    const center = W / 2;
    const rule = () => {
      const ry = y + Math.round(pad * 0.28);
      ctx.save();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = Math.max(1, Math.round(W * 0.004));
      ctx.setLineDash([Math.round(W * 0.02), Math.round(W * 0.015)]);
      ctx.beginPath();
      ctx.moveTo(pad, ry);
      ctx.lineTo(W - pad, ry);
      ctx.stroke();
      ctx.restore();
      y += Math.round(pad * 0.6);
    };

    // Hospital name (Bangla, wrapped) + English subtitle.
    ctx.textAlign = 'center';
    ctx.font = `700 ${F.hosp}px ${bn}`;
    hospLines.forEach((ln) => { ctx.fillText(ln, center, y); y += lh(F.hosp); });
    if (CFG.hospitalEn) {
      ctx.font = `600 ${F.hospEn}px ${bn}`;
      ctx.fillText(CFG.hospitalEn, center, y); y += lh(F.hospEn);
    }
    rule();

    // Serial label + the big number.
    ctx.font = `600 ${F.label}px ${bn}`;
    ctx.fillText('SERIAL / সিরিয়াল', center, y);
    y += lh(F.label);
    ctx.font = `800 ${F.serial}px ${mono}`;
    ctx.fillText(String(data.serial != null ? data.serial : '—'), center, y);
    y += Math.round(F.serial * 1.15);
    rule();

    // Body rows, left-aligned, wrapping long values under the label indent.
    ctx.textAlign = 'left';
    ctx.font = `600 ${F.body}px ${bn}`;
    rows.forEach(([lab, val]) => {
      const prefix = lab + ' : ';
      const px = pad;
      ctx.fillText(prefix, px, y);
      const indent = ctx.measureText(prefix).width;
      const lines = wrapText(ctx, val, innerW - indent);
      lines.forEach((ln, i) => {
        ctx.fillText(ln, px + (i === 0 ? indent : indent), y);
        if (i < lines.length - 1) y += lh(F.body);
      });
      y += lh(F.body);
    });
    rule();

    if (CFG.footer) {
      ctx.textAlign = 'center';
      ctx.font = `600 ${F.foot}px ${bn}`;
      ctx.fillText(CFG.footer, center, y);
      y += lh(F.foot);
    }

    return canvas;
  }

  /* ---------------------------------------------------------------------------
   * Standard print — draw the canvas into a hidden iframe sized to the roll and
   * fire the OS print dialog. Universal: any printer the device already has.
   * ------------------------------------------------------------------------- */
  function browserPrint(canvas, mm) {
    const dataUrl = canvas.toDataURL('image/png');
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
      '@page{size:' + mm + 'mm auto;margin:0}' +
      'html,body{margin:0;padding:0}' +
      'img{display:block;width:' + mm + 'mm}' +
      '</style></head><body><img src="' + dataUrl + '"></body></html>'
    );
    doc.close();
    const done = () => setTimeout(() => { try { frame.remove(); } catch (_) {} }, 1500);
    const go = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (_) { toast('প্রিন্ট শুরু করা গেল না', 'err'); }
      done();
    };
    const img = doc.querySelector('img');
    if (img && !img.complete) img.onload = () => setTimeout(go, 60);
    else setTimeout(go, 120);
  }

  /* ---------------------------------------------------------------------------
   * Bluetooth (Web Bluetooth) — direct, dialog-free ESC/POS raster printing.
   * ------------------------------------------------------------------------- */
  // Thrown when the user cancels our OWN flow (device picker, pairing) — must
  // ABORT the whole print, never fall back to the OS dialog.
  class UserCancelled extends Error {}

  const isCancelError = (e) =>
    e instanceof UserCancelled ||
    (e && (e.name === 'NotFoundError' || e.name === 'AbortError' || e.name === 'NotAllowedError' || e.name === 'SecurityError') &&
      // NotAllowedError also fires for blocked permissions — but a picker the
      // user closed is NotFoundError, so treat all of these as "no printer chosen".
      true);
  // Service UUIDs seen on common cheap BLE thermal printers. Must be listed as
  // optionalServices or the browser blocks access to their characteristics.
  const BT_SERVICES = [
    0x18f0, 0x1801, 0xff00, 0xffe0, 0xff10, 0xfff0,
    '000018f0-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000fff0-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',           // Microchip / many POS
    '6e400001-b5a3-f393-e0a9-e50e24dcca9e',           // Nordic UART
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  ];

  let btChar = null;   // cached writable characteristic (this session)
  let btDevice = null;

  function btSupported() {
    return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
  }

  async function findWritable(server) {
    const services = await server.getPrimaryServices();
    for (const s of services) {
      let chars = [];
      try { chars = await s.getCharacteristics(); } catch (_) { continue; }
      for (const c of chars) {
        if (c.properties && (c.properties.write || c.properties.writeWithoutResponse)) return c;
      }
    }
    return null;
  }

  async function connectDevice(dev) {
    const server = await dev.gatt.connect();
    const ch = await findWritable(server);
    if (!ch) throw new Error('printer has no writable channel');
    btChar = ch;
    btDevice = dev;
    dev.addEventListener('gattserverdisconnected', () => { btChar = null; });
    return ch;
  }

  // Pair once (called from setup). Requires a user gesture.
  async function btPair() {
    if (!btSupported()) throw new Error('unsupported');
    let dev;
    try {
      dev = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BT_SERVICES,
      });
    } catch (e) {
      throw new UserCancelled(e && e.name === 'NotFoundError' ? 'user cancelled the device picker' : (e && e.message) || 'pairing failed');
    }
    await connectDevice(dev);
    return dev;
  }

  // Get a live characteristic without a picker if we can (silent reconnect).
  async function btEnsure() {
    if (btChar && btDevice && btDevice.gatt && btDevice.gatt.connected) return btChar;
    if (btDevice && btDevice.gatt) {            // reconnect the known device
      try { return await connectDevice(btDevice); } catch (_) {}
    }
    if (navigator.bluetooth && navigator.bluetooth.getDevices) {
      try {
        const devs = await navigator.bluetooth.getDevices();
        if (devs && devs.length) {
          // reconnect the first remembered device
          for (const d of devs) {
            try { return await connectDevice(d); } catch (_) {}
          }
        }
      } catch (_) {}
    }
    // No silent path available — needs a one-time pick (user gesture).
    return null;
  }

  function canvasToRaster(canvas) {
    const w = canvas.width, h = canvas.height;
    const bytesPerRow = Math.ceil(w / 8);
    const img = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    const out = new Uint8Array(bytesPerRow * h);
    for (let y = 0; y < h; y++) {
      const row = y * bytesPerRow;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const a = img[i + 3];
        const lum = a < 128 ? 255 : (0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2]);
        if (lum < 128) out[row + (x >> 3)] |= (0x80 >> (x & 7));
      }
    }
    return { bytesPerRow, h, out };
  }

  async function writeChunks(ch, bytes) {
    // 20 bytes = the guaranteed payload of the DEFAULT BLE ATT_MTU (23).
    // Larger chunks (we tried 180) are faster but drop bytes on strict-MTU
    // printers/adapters → torn/garbled tickets. Slow but universally safe.
    const CH = 20;
    const canNoResp = ch.properties && ch.properties.writeWithoutResponse;
    for (let i = 0; i < bytes.length; i += CH) {
      const slice = bytes.subarray(i, Math.min(i + CH, bytes.length));
      if (canNoResp) await ch.writeValueWithoutResponse(slice);
      else await ch.writeValue(slice);
      await sleep(canNoResp ? 2 : 1);
    }
  }

  async function btPrint(ch, canvas) {
    const { bytesPerRow, h, out } = canvasToRaster(canvas);
    // ESC @ : initialise
    await writeChunks(ch, new Uint8Array([0x1b, 0x40]));
    // GS v 0 raster — split into bands so height fits the 16-bit field cleanly.
    const BAND = 255;
    for (let y0 = 0; y0 < h; y0 += BAND) {
      const rows = Math.min(BAND, h - y0);
      const header = new Uint8Array([
        0x1d, 0x76, 0x30, 0x00,
        bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
        rows & 0xff, (rows >> 8) & 0xff,
      ]);
      const body = out.subarray(y0 * bytesPerRow, (y0 + rows) * bytesPerRow);
      const packet = new Uint8Array(header.length + body.length);
      packet.set(header, 0);
      packet.set(body, header.length);
      await writeChunks(ch, packet);
    }
    // Feed + (attempt) cut. Printers without a cutter ignore the cut byte.
    await writeChunks(ch, new Uint8Array([0x1b, 0x64, 0x03, 0x1d, 0x56, 0x42, 0x00]));
  }

  /* ---------------------------------------------------------------------------
   * Public: print a ticket for one patient/serial.
   * data = { serial, name, nameEn, doctor, room, datetime }
   * ------------------------------------------------------------------------- */
  async function printTicket(data) {
    const mm = getWidth();
    const d = Object.assign({}, data);
    if (!d.datetime) d.datetime = formatNow();
    await ensureBanglaFont(mm);           // webfont fetched before any measuring
    const canvas = buildTicketCanvas(d, mm);

    if (getMode() === 'bt' && btSupported()) {
      try {
        let ch = await btEnsure();
        if (!ch) {
          // No silent path — pair now (this call is inside a click gesture).
          // User cancelling the picker must ABORT, not fall back to the OS dialog.
          toast('ব্লুটুথ প্রিন্টার সংযোগ হচ্ছে…', 'info');
          try {
            await btPair();
          } catch (pairErr) {
            if (pairErr instanceof UserCancelled) {
              toast('প্রিন্ট বাতিল করা হলো', 'warn');
              return;                       // ← stop here: no dialog, no fallback
            }
            throw pairErr;                  // real failure → fall back below
          }
          ch = btChar;
        }
        await btPrint(ch, canvas);
        toast('🖨️ টিকিট প্রিন্ট হচ্ছে', 'ok');
        return;
      } catch (e) {
        if (e instanceof UserCancelled) {
          toast('প্রিন্ট বাতিল করা হলো', 'warn');
          return;                           // user said no — abort everything
        }
        console.warn('BT print failed, falling back to standard print', e);
        toast('ব্লুটুথে যাওয়া গেল না — সাধারণ প্রিন্টে পাঠানো হলো', 'warn');
        // fall through to browser print
      }
    }
    browserPrint(canvas, mm);
  }

  function formatNow(dt) {
    const d = dt ? new Date(dt) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    let h = d.getHours();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}  ${pad(h)}:${pad(d.getMinutes())} ${ap}`;
  }

  /* ---------------------------------------------------------------------------
   * Setup modal — pick Bluetooth (pair once) or Standard, and roll width.
   * Injected from JS so host pages need no extra HTML.
   * ------------------------------------------------------------------------- */
  function openSetup() {
    let m = document.getElementById('__printSetup');
    if (m) { m.style.display = 'flex'; syncSetup(); return; }
    m = document.createElement('div');
    m.id = '__printSetup';
    m.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui;';
    m.innerHTML =
      '<div style="width:100%;max-width:32rem;background:#fff;color:#111;border-radius:18px 18px 0 0;padding:20px;box-shadow:0 -8px 30px rgba(0,0,0,.25);">' +
      '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
      '    <div style="font-weight:800;font-size:18px;">🖨️ প্রিন্টার সেটআপ</div>' +
      '    <button id="__psClose" style="border:0;background:#eee;border-radius:9999px;width:32px;height:32px;font-size:16px;cursor:pointer;">✕</button>' +
      '  </div>' +
      '  <div style="font-size:13px;color:#555;margin-bottom:14px;">এই ডিভাইসে টিকিট কীভাবে প্রিন্ট হবে বেছে নিন। একবার সেট করলেই মনে রাখবে।</div>' +
      '  <div style="display:flex;flex-direction:column;gap:10px;">' +
      '    <button id="__psBt" style="text-align:left;border:2px solid #ddd;background:#fafafa;border-radius:14px;padding:14px;cursor:pointer;">' +
      '      <div style="font-weight:800;font-size:15px;">📶 ব্লুটুথ প্রিন্টার (সরাসরি, ডায়ালগ ছাড়া)</div>' +
      '      <div style="font-size:12px;color:#666;margin-top:4px;">একবার প্রিন্টার সিলেক্ট করুন — এরপর Print ক্লিক করলেই সরাসরি বের হবে। (Android Chrome)</div>' +
      '      <div id="__psBtState" style="font-size:12px;font-weight:700;margin-top:6px;color:#0a7;"></div>' +
      '    </button>' +
      '    <button id="__psBrowser" style="text-align:left;border:2px solid #ddd;background:#fafafa;border-radius:14px;padding:14px;cursor:pointer;">' +
      '      <div style="font-weight:800;font-size:15px;">🖨️ সাধারণ প্রিন্ট (সব প্রিন্টারে চলে)</div>' +
      '      <div style="font-size:12px;color:#666;margin-top:4px;">USB / WiFi / ডেস্কটপ — যেকোনো প্রিন্টার। ক্লিক করলে ছোট প্রিন্ট ডায়ালগ আসবে।</div>' +
      '    </button>' +
      '  </div>' +
      '  <div style="margin-top:16px;">' +
      '    <div style="font-weight:700;font-size:13px;margin-bottom:6px;">রোল সাইজ</div>' +
      '    <div style="display:flex;gap:8px;">' +
      '      <button data-w="58" class="__psW" style="flex:1;border:2px solid #ddd;background:#fafafa;border-radius:10px;padding:10px;font-weight:700;cursor:pointer;">58mm</button>' +
      '      <button data-w="80" class="__psW" style="flex:1;border:2px solid #ddd;background:#fafafa;border-radius:10px;padding:10px;font-weight:700;cursor:pointer;">80mm</button>' +
      '    </div>' +
      '  </div>' +
      '  <button id="__psTest" style="margin-top:16px;width:100%;background:#111;color:#fff;border:0;border-radius:12px;padding:13px;font-weight:800;font-size:15px;cursor:pointer;">টেস্ট প্রিন্ট</button>' +
      '</div>';
    document.body.appendChild(m);

    const close = () => { m.style.display = 'none'; };
    m.addEventListener('click', (e) => { if (e.target === m) close(); });
    document.getElementById('__psClose').onclick = close;

    document.getElementById('__psBrowser').onclick = () => {
      localStorage.setItem(LS_MODE, 'browser');
      syncSetup();
      toast('সাধারণ প্রিন্ট সেট হলো', 'ok');
    };
    document.getElementById('__psBt').onclick = async () => {
      if (!btSupported()) { toast('এই ব্রাউজারে ব্লুটুথ প্রিন্ট সাপোর্ট নেই (Android Chrome দরকার)', 'warn'); return; }
      try {
        await btPair();
        localStorage.setItem(LS_MODE, 'bt');
        syncSetup();
        toast('✅ ব্লুটুথ প্রিন্টার যুক্ত হলো', 'ok');
      } catch (e) {
        if (e && e.name === 'NotFoundError') return; // user cancelled the picker
        toast('ব্লুটুথ যুক্ত করা গেল না — আবার চেষ্টা করুন', 'err');
      }
    };
    m.querySelectorAll('.__psW').forEach((b) => {
      b.onclick = () => { localStorage.setItem(LS_WIDTH, b.dataset.w); syncSetup(); };
    });
    document.getElementById('__psTest').onclick = () => {
      printTicket({ serial: 12, name: 'টেস্ট রোগী', nameEn: 'Test Patient', doctor: 'Dr. Test', room: 103 });
    };

    syncSetup();
  }

  function syncSetup() {
    const mode = getMode(), width = getWidth();
    const bt = document.getElementById('__psBt');
    const br = document.getElementById('__psBrowser');
    if (bt) bt.style.borderColor = mode === 'bt' ? '#0a7' : '#ddd';
    if (br) br.style.borderColor = mode === 'browser' ? '#0a7' : '#ddd';
    const st = document.getElementById('__psBtState');
    if (st) st.textContent = mode === 'bt' ? (btDevice ? '✓ যুক্ত: ' + (btDevice.name || 'প্রিন্টার') : '✓ সেট করা আছে') : '';
    document.querySelectorAll('.__psW').forEach((b) => {
      b.style.borderColor = String(width) === b.dataset.w ? '#0a7' : '#ddd';
    });
  }

  window.HospitalPrinter = {
    printTicket,
    openSetup,
    isBluetoothMode: () => getMode() === 'bt',
    isBluetoothSupported: btSupported,
    roomFor,                            // shared floor+chamber rule (both pages)
    _buildCanvas: buildTicketCanvas,   // exposed for preview/testing
  };
})();
