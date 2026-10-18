/* ============================================================================
   Bulk Add — add 60/70+ patients at once from a daily list.
   Three ways to bring names in:
     1) Paste   — one name per line (copy from phone / Excel / anywhere)
     2) File    — upload an Excel (.xlsx/.xls) or CSV / text file
     3) Scan    — take a photo of a paper list → OCR (Bangla + English)
   All three land in ONE editable table, so a wrong name / spelling can be
   fixed right there before adding. Then "Add all" assigns serials in order.

   Shared by reception.html and assistant.html. Usage:
     BulkAdd.open({ doctors, lockDoctor: 'Dr. Name'|null, onDone: fn });
   Offline-safe: Excel + OCR libraries are vendored under /vendor and loaded
   only when first needed (so normal use stays fast).
   ========================================================================== */
(function () {
  const API = '/api';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = { doctors: [], lockDoctor: null, onDone: null, names: [] };
  const libLoaded = {};
  function loadScript(src) {
    if (libLoaded[src]) return libLoaded[src];
    libLoaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = () => { libLoaded[src] = null; reject(new Error('load failed: ' + src)); };
      document.head.appendChild(s);
    });
    return libLoaded[src];
  }

  /* ---- Turn one raw line into a clean name --------------------------------
     Daily lists usually look like "1. Md Karim", "2) Rahim", "12 - Sultana"
     or CSV "12,Md Karim,Male". Strip a leading serial + separator, and for a
     comma/tab row keep the field that looks most like a name (most letters). */
  function cleanName(line) {
    let s = String(line == null ? '' : line).trim();
    if (!s) return '';
    if (/[,\t;|]/.test(s)) {
      const cols = s.split(/[,\t;|]+/).map((c) => c.trim()).filter(Boolean);
      const scored = cols
        .filter((c) => (c.match(/[\p{L}]/gu) || []).length >= 2) // has ≥2 letters
        .sort((a, b) => (b.match(/[\p{L}]/gu) || []).length - (a.match(/[\p{L}]/gu) || []).length);
      s = scored[0] || cols[0] || s;
    }
    s = s.replace(/^\s*[0-9০-৯]+\s*[.\):\-–—]?\s*/, ''); // drop leading "12. " / "১২) " / "3 Name"
    s = s.replace(/\s{2,}/g, ' ').trim();
    return s;
  }
  function namesFromText(txt) {
    return String(txt || '').split(/\r?\n/).map(cleanName).filter(Boolean);
  }

  /* ---- Build the modal once ---------------------------------------------- */
  let el = {};
  function buildModal() {
    if (el.root) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div id="baOverlay" style="display:none" class="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="bg-surface-container-lowest text-on-surface w-full sm:max-w-2xl max-h-[92vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div class="flex items-center justify-between p-4 border-b border-surface-container">
          <h3 class="font-display font-extrabold text-lg flex items-center gap-2"><span class="mso">group_add</span> একসাথে অনেক রোগী যোগ করুন</h3>
          <button id="baClose" class="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center"><span class="mso text-[18px]">close</span></button>
        </div>
        <div class="p-4 overflow-y-auto flex flex-col gap-3">
          <label class="text-sm font-bold" id="baDocWrap">ডাক্তার
            <select id="baDoctor" class="mt-1 w-full bg-surface-container-low rounded-lg px-3 py-2.5 font-medium"></select>
          </label>
          <div class="flex gap-1.5 bg-surface-container rounded-xl p-1 text-sm font-bold">
            <button data-tab="paste" class="baTab flex-1 py-2 rounded-lg">✍️ লিস্ট পেস্ট</button>
            <button data-tab="file"  class="baTab flex-1 py-2 rounded-lg">📄 Excel/CSV</button>
            <button data-tab="scan"  class="baTab flex-1 py-2 rounded-lg">📷 ছবি স্ক্যান</button>
          </div>
          <div id="baPastePane" class="baPane">
            <textarea id="baPaste" rows="6" placeholder="প্রতি লাইনে একটি নাম —&#10;Md. Abdul Karim&#10;মোঃ রহিম উদ্দিন&#10;Sultana Begum" class="w-full bg-surface-container-low rounded-lg px-3 py-2.5 font-medium"></textarea>
            <button id="baPasteBtn" class="mt-2 w-full bg-primary text-on-primary rounded-lg py-2.5 font-bold">নাম বের করুন →</button>
          </div>
          <div id="baFilePane" class="baPane" style="display:none">
            <input id="baFile" type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" class="w-full bg-surface-container-low rounded-lg px-3 py-2.5 font-medium" />
            <p class="text-[11px] text-on-surface-variant mt-1">Excel (.xlsx/.xls) বা CSV/টেক্সট ফাইল। নাম যেই কলামে থাকবে অটো খুঁজে নেবে।</p>
          </div>
          <div id="baScanPane" class="baPane" style="display:none">
            <div id="baCamWrap" class="relative rounded-xl overflow-hidden bg-black" style="display:none">
              <video id="baVideo" playsinline autoplay muted class="w-full max-h-[40vh] object-contain bg-black"></video>
              <div class="absolute inset-x-0 bottom-0 p-2 flex gap-2 bg-gradient-to-t from-black/70 to-transparent">
                <button id="baShoot" class="flex-1 bg-white text-black rounded-lg py-2.5 font-bold flex items-center justify-center gap-1"><span class="mso">photo_camera</span> ছবি তুলে যোগ করুন</button>
                <button id="baCamStop" class="px-3 bg-black/50 text-white rounded-lg"><span class="mso">close</span></button>
              </div>
            </div>
            <button id="baCamStart" class="w-full bg-primary text-on-primary rounded-lg py-2.5 font-bold flex items-center justify-center gap-1"><span class="mso">photo_camera</span> ক্যামেরা চালু করুন — পেজের ওপর ধরুন</button>
            <label class="block mt-2 text-[12px] font-bold text-on-surface-variant">অথবা গ্যালারি/ফাইল থেকে ছবি দিন
              <input id="baImg" type="file" accept="image/*" capture="environment" class="mt-1 w-full bg-surface-container-low rounded-lg px-3 py-2 font-medium" />
            </label>
            <p class="text-[11px] text-on-surface-variant mt-1">স্পষ্ট ছাপার লেখা ভালো আসে। যতবার ছবি তুলবেন, নাম নিচের তালিকায় যোগ হতে থাকবে — পড়ার পর ঠিক করে নিন।</p>
            <canvas id="baCanvas" class="hidden"></canvas>
            <div id="baOcrStatus" class="text-[12px] font-bold text-secondary mt-2" style="display:none"></div>
          </div>
          <div class="border-t border-surface-container pt-3">
            <div class="flex items-center justify-between mb-2">
              <span class="font-bold text-sm">নামের তালিকা (<span id="baCount">0</span>) — ঠিক করে নিন</span>
              <button id="baAddRow" class="text-secondary text-sm font-bold flex items-center gap-1"><span class="mso text-base">add</span>সারি</button>
            </div>
            <div id="baList" class="flex flex-col gap-1.5 max-h-[32vh] overflow-y-auto"></div>
            <div id="baEmpty" class="text-center text-on-surface-variant text-sm py-4">উপরের যেকোনো উপায়ে নাম আনুন</div>
          </div>
        </div>
        <div class="p-4 border-t border-surface-container flex gap-2">
          <button id="baCancel" class="flex-1 bg-surface-container rounded-xl py-3 font-bold">বাতিল</button>
          <button id="baSubmit" class="flex-[2] bg-secondary text-on-secondary rounded-xl py-3 font-display font-extrabold disabled:opacity-50">সব যোগ করুন</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(wrap.firstElementChild);
    el.root = document.getElementById('baOverlay');
    const g = (id) => document.getElementById(id);
    el = { root: el.root, close: g('baClose'), cancel: g('baCancel'), submit: g('baSubmit'),
      doctor: g('baDoctor'), docWrap: g('baDocWrap'), paste: g('baPaste'), pasteBtn: g('baPasteBtn'),
      file: g('baFile'), img: g('baImg'), ocrStatus: g('baOcrStatus'), list: g('baList'),
      empty: g('baEmpty'), count: g('baCount'), addRow: g('baAddRow'),
      camWrap: g('baCamWrap'), video: g('baVideo'), canvas: g('baCanvas'),
      camStart: g('baCamStart'), camStop: g('baCamStop'), shoot: g('baShoot') };
    wireEvents();
  }

  /* ---- Events ------------------------------------------------------------ */
  function wireEvents() {
    el.close.onclick = el.cancel.onclick = hide;
    el.root.addEventListener('click', (e) => { if (e.target === el.root) hide(); });
    document.querySelectorAll('.baTab').forEach((b) => { b.onclick = () => switchTab(b.dataset.tab); });
    el.pasteBtn.onclick = () => { addNames(namesFromText(el.paste.value)); el.paste.value = ''; };
    el.addRow.onclick = () => { state.names.push(''); renderList(); const last = el.list.querySelector('.baRow:last-child input'); if (last) last.focus(); };
    el.file.onchange = () => handleFile(el.file.files[0]);
    el.img.onchange = () => { if (el.img.files[0]) runOcr(el.img.files[0]); el.img.value = ''; };
    el.camStart.onclick = startCamera;
    el.camStop.onclick = stopCamera;
    el.shoot.onclick = shootFrame;
    el.submit.onclick = submit;
    switchTab('paste');
  }
  function switchTab(tab) {
    document.querySelectorAll('.baTab').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('bg-surface-container-lowest', on);
      b.classList.toggle('shadow-sm', on);
    });
    const show = (id, on) => { const n = document.getElementById(id); if (n) n.style.display = on ? '' : 'none'; };
    show('baPastePane', tab === 'paste'); show('baFilePane', tab === 'file'); show('baScanPane', tab === 'scan');
    if (tab !== 'scan') stopCamera();
  }

  /* ---- Transliterate English names to Bangla for display ----------------- */
  function displayBn(name) {
    if (typeof window !== 'undefined' && window.translit) {
      return window.translit.toBangla(name);
    }
    return name;
  }
  /* ---- Editable name list ------------------------------------------------ */
  function addNames(list) {
    if (!list || !list.length) return;
    state.names = state.names.concat(list);
    renderList();
  }
  function renderList() {
    const base = Number(el.doctor.dataset.nextSerial || 1);
    el.count.textContent = state.names.length;
    el.empty.style.display = state.names.length ? 'none' : 'block';
    el.list.innerHTML = state.names.map((n, i) => `
      <div class="baRow flex items-center gap-1">
        <span class="font-mono text-sm font-bold w-8 text-center text-on-surface-variant shrink-0">${base + i}</span>
        <div class="flex-1 flex flex-col gap-0.5">
          <input value="${esc(n)}" data-i="${i}" class="baName w-full bg-surface-container-low rounded-lg px-2.5 py-2 text-sm font-medium" />
          <span class="text-[11px] text-on-surface-variant">${esc(displayBn(n))}</span>
        </div>
        <button data-i="${i}" class="baDel w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center shrink-0"><span class="mso text-[16px]">close</span></button>
      </div>`).join('');
    el.list.querySelectorAll('.baName').forEach((inp) => {
      inp.oninput = () => { state.names[Number(inp.dataset.i)] = inp.value; };
    });
    el.list.querySelectorAll('.baDel').forEach((b) => {
      b.onclick = () => { state.names.splice(Number(b.dataset.i), 1); renderList(); };
    });
    el.submit.textContent = state.names.length ? `সব যোগ করুন (${state.names.length})` : 'সব যোগ করুন';
    el.submit.disabled = !state.names.length;
  }

  /* ---- File: Excel (.xlsx/.xls) or CSV / text ---------------------------- */
  async function handleFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
        addNames(namesFromText(await file.text()));
      } else {
        await loadScript('/vendor/xlsx.full.min.js');
        const buf = await file.arrayBuffer();
        const wb = window.XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
        const names = rows.map((r) => cleanName((Array.isArray(r) ? r : [r]).join('\t'))).filter(Boolean);
        addNames(names);
      }
    } catch (e) {
      alert('ফাইল পড়া গেল না: ' + e.message + '\nCSV বা Excel ফাইল দিন।');
    }
    el.file.value = '';
  }

  /* ---- Scan: live camera (point at the page) → OCR ----------------------
     getUserMedia needs a secure context (https:// or localhost). On a plain
     http:// LAN tablet the browser blocks the live camera, so we fall back to
     the native capture file input, which still opens the phone camera. */
  let camStream = null;
  async function startCamera() {
    const st = el.ocrStatus;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      st.style.display = ''; st.textContent = 'ℹ️ এই ব্রাউজারে লাইভ ক্যামেরা নেই — নিচের "গ্যালারি/ফাইল" দিয়ে ছবি দিন।';
      return;
    }
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      el.video.srcObject = camStream;
      el.camWrap.style.display = '';
      el.camStart.style.display = 'none';
      st.style.display = 'none';
    } catch (e) {
      st.style.display = '';
      st.textContent = location.protocol === 'https:' || location.hostname === 'localhost'
        ? '❌ ক্যামেরা খোলা গেল না: ' + e.message
        : '⚠️ লাইভ ক্যামেরার জন্য https দরকার (ফোনে HOME/ইনস্টল করা অ্যাপে চলবে)। আপাতত নিচের "গ্যালারি/ফাইল" দিয়ে ছবি তুলুন।';
    }
  }
  function stopCamera() {
    if (camStream) { camStream.getTracks().forEach((t) => t.stop()); camStream = null; }
    if (el.video) el.video.srcObject = null;
    if (el.camWrap) el.camWrap.style.display = 'none';
    if (el.camStart) el.camStart.style.display = '';
  }
  function shootFrame() {
    if (!camStream) return;
    const v = el.video, c = el.canvas;
    c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((blob) => { if (blob) runOcr(blob); }, 'image/jpeg', 0.92);
  }

  async function runOcr(imgSource) {
    const st = el.ocrStatus;
    st.style.display = ''; st.textContent = 'OCR ইঞ্জিন লোড হচ্ছে…';
    try {
      await loadScript('/vendor/tesseract/tesseract.min.js');
      st.textContent = 'ছবি পড়া হচ্ছে… (একটু সময় লাগতে পারে)';
      const worker = await window.Tesseract.createWorker(['eng', 'ben'], 1, {
        workerPath: '/vendor/tesseract/worker.min.js',
        corePath: '/vendor/tesseract/',
        langPath: '/vendor/tesseract/lang',
        gzip: true,
        logger: (m) => { if (m.status === 'recognizing text') st.textContent = 'পড়া হচ্ছে… ' + Math.round(m.progress * 100) + '%'; },
      });
      const { data: { text } } = await worker.recognize(imgSource);
      await worker.terminate();
      const names = namesFromText(text);
      if (!names.length) { st.textContent = '⚠️ কোনো নাম পড়া গেল না — আরও স্পষ্ট/কাছ থেকে ছবি দিন।'; }
      else { st.textContent = '✅ ' + names.length + ' টি নাম যোগ হলো — নিচে ঠিক করে নিন।'; addNames(names); }
    } catch (e) {
      st.textContent = '❌ OCR চালানো গেল না: ' + e.message;
    }
  }

  /* ---- Submit all -------------------------------------------------------- */
  async function submit() {
    const doctorName = state.lockDoctor || el.doctor.value;
    if (!doctorName) { alert('আগে ডাক্তার বাছুন'); return; }
    const names = state.names.map((n) => String(n || '').trim()).filter(Boolean);
    if (!names.length) { alert('কোনো নাম নেই'); return; }
    el.submit.disabled = true;
    const orig = el.submit.textContent;
    el.submit.textContent = 'যোগ হচ্ছে…';
    try {
      const res = await fetch(API + '/patients/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorName, names }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'যোগ করা যায়নি');
      hide();
      if (state.onDone) state.onDone(data);
      else alert('✅ ' + data.count + ' জন রোগী যোগ হলো');
    } catch (e) {
      alert('❌ ' + e.message);
      el.submit.disabled = false; el.submit.textContent = orig;
    }
  }

  /* ---- Open / close ------------------------------------------------------ */
  function populateDoctors() {
    if (state.lockDoctor) {
      el.docWrap.style.display = 'none';
      el.doctor.dataset.nextSerial = String(nextSerialFor(state.lockDoctor));
      return;
    }
    el.docWrap.style.display = '';
    el.doctor.innerHTML = '<option value="" disabled selected>ডাক্তার বাছুন…</option>' +
      (state.doctors || []).map((d) => `<option value="${esc(d.name)}">${esc(d.name)}${d.specialty ? ' — ' + esc(d.specialty) : ''}</option>`).join('');
    el.doctor.dataset.nextSerial = '1';
    el.doctor.onchange = () => { el.doctor.dataset.nextSerial = String(nextSerialFor(el.doctor.value)); renderList(); };
  }
  function nextSerialFor(docName) {
    const key = String(docName || '').trim().toLowerCase();
    const list = state.patients || [];
    const today = (iso) => { const d = new Date(iso); const n = new Date(); return d.toDateString() === n.toDateString(); };
    const max = list.filter((p) => today(p.createdAt) && String(p.doctorName || '').trim().toLowerCase() === key)
      .reduce((m, p) => Math.max(m, Number(p.serialNumber) || 0), 0);
    return max + 1;
  }
  function show() { el.root.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  function hide() { stopCamera(); el.root.style.display = 'none'; document.body.style.overflow = ''; state.names = []; }

  function open(opts) {
    opts = opts || {};
    state.doctors = opts.doctors || [];
    state.patients = opts.patients || [];
    state.lockDoctor = opts.lockDoctor || null;
    state.onDone = opts.onDone || null;
    state.names = [];
    buildModal();
    populateDoctors();
    renderList();
    switchTab('paste');
    show();
  }

  window.BulkAdd = { open };
})();
