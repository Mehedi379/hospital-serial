/*
 * Hospital Smart Serial & Voice Calling System
 * Simple backend: Express REST API + Socket.IO real-time.
 *
 * Flow:
 *   Reception adds a patient (+ manual serial)  ->  Assistant sees the list
 *   Assistant presses CALL  ->  status = CALLED  ->  Socket.IO 'patient.called'
 *   ->  connected TV instantly shows the serial + patient and speaks it.
 *
 * Data is kept IN MEMORY (resets when the server restarts). Perfect for a
 * simple, single-clinic setup. For production, swap the arrays for a database.
 */

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const translit = require('./public/translit'); // Bangla <-> English name auto-conversion (shared with browser)

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 5000;

app.use(express.json());
// Serve the TV / Assistant / Reception pages from /public
app.use(express.static(path.join(__dirname, 'public')));

/* ------------------------------------------------------------------ */
/* File-based "database" (zero dependency, survives restart)          */
/* data.json is written next to server.js. For production swap this   */
/* for a real database (see DEPLOYMENT_ROADMAP.md).                   */
/* ------------------------------------------------------------------ */
const fs = require('fs');
// DATA_DIR lets a cloud host (e.g. Render) mount a persistent disk. Falls back
// to the app folder locally, so nothing changes when running on your own PC.
const DATA_DIR = process.env.DATA_DIR || __dirname;
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
const DB_FILE = path.join(DATA_DIR, 'data.json');

/* ------------------------------------------------------------------ */
/* Optional MongoDB persistence. If MONGODB_URI is set (e.g. on Render) */
/* the whole state blob is stored as one document in the cloud, so data */
/* survives restarts/sleep. With no URI it falls back to the local      */
/* data.json file — so nothing changes when running on your own PC.     */
/* ------------------------------------------------------------------ */
let mongoColl = null;
async function initMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return false;
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  mongoColl = client.db('hospital').collection('state');
  console.log('  Connected to MongoDB — data persists in the cloud.');
  return true;
}

let patients = [];
let tvs = [];
let doctors = [];        // editable doctor directory (persisted in data.json)
let seq = 0;             // internal id counter (patients)
let docSeq = 0;          // internal id counter (doctors)
let currentCall = null;  // last patient announced (any doctor) — for all-doctor TVs
const currentCallByDoctor = {}; // doctorName -> last call for that doctor's own TV
let breaks = {};         // doctorName -> { type, note, startedAt } — doctor is on break (persisted)
let ads = [];            // scrolling notices/ads shown on the TV board (persisted)
let adSeq = 0;           // internal id counter (ads)

/* Break types offered on the assistant panel. Label/BnLabel are shown on TVs. */
const BREAK_TYPES = {
  lunch:  { label: 'Lunch Break',        labelBn: 'লাঞ্চ ব্রেক' },
  namaz:  { label: 'Namaz Break',        labelBn: 'নামাজের ব্রেক' },
  report: { label: 'Reviewing Reports',  labelBn: 'রিপোর্ট দেখছেন' },
  other:  { label: 'Break',              labelBn: 'ব্রেক' },
};

/* ------------------------------------------------------------------ */
/* Doctor directory — EDITABLE from admin.html (add/edit/delete).     */
/* Each doctor has: name (En+Bn), qualification, specialty (En+Bn),   */
/* chamberNumber (room) and floor. Seeded below on first run, then    */
/* persisted in data.json. Reception/Assistant/TV all read from here. */
/* ------------------------------------------------------------------ */
const DEFAULT_DOCTORS = [
  {
    name: 'Dr. Oliur Rahman', nameBn: 'ডা. ওলিউর রহমান',
    qualification: 'MBBS, FCPS (Medicine), MD (Gastroenterology)',
    specialty: 'Senior Consultant — Hepatology', specialtyBn: 'সিনিয়র কনসালট্যান্ট — হেপাটোলজি',
    chamberNumber: '03', floor: '1',
  },
  {
    name: 'Dr. Farhana Chowdhury', nameBn: 'ডা. ফারহানা চৌধুরী',
    qualification: 'MBBS, FCPS (Medicine)',
    specialty: 'Hepatology Specialist', specialtyBn: 'হেপাটোলজি বিশেষজ্ঞ',
    chamberNumber: '01', floor: '1',
  },
  {
    name: 'Dr. Tariqul Islam', nameBn: 'ডা. তারিকুল ইসলাম',
    qualification: 'MBBS, MS (Surgery)',
    specialty: 'Therapeutic Endoscopy', specialtyBn: 'থেরাপিউটিক এন্ডোস্কোপি',
    chamberNumber: '02', floor: '1',
  },
  {
    name: 'Dr. Masud Parvez', nameBn: 'ডা. মাসুদ পারভেজ',
    qualification: 'MBBS, FCPS (Surgery)',
    specialty: 'Gastrointestinal Surgeon', specialtyBn: 'গ্যাস্ট্রোইনটেস্টাইনাল সার্জন',
    chamberNumber: '04', floor: '1',
  },
  {
    name: 'Dr. Nargis Sultana', nameBn: 'ডা. নার্গিস সুলতানা',
    qualification: 'MBBS, DCH',
    specialty: 'Pediatric Gastroenterology', specialtyBn: 'পেডিয়াট্রিক গ্যাস্ট্রোএন্টেরোলজি',
    chamberNumber: '05', floor: '1',
  },
];
const findDoctor = (name) =>
  doctors.find((d) => d.name.toLowerCase() === String(name || '').trim().toLowerCase());

async function loadDb() {
  try {
    let raw = null;
    if (mongoColl) {
      const doc = await mongoColl.findOne({ _id: 'state' });
      raw = doc && doc.data ? doc.data : null;
    } else if (fs.existsSync(DB_FILE)) {
      raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
    if (raw) {
      patients = Array.isArray(raw.patients) ? raw.patients : [];
      tvs = Array.isArray(raw.tvs) ? raw.tvs : [];
      ads = Array.isArray(raw.ads) ? raw.ads : [];
      adSeq = Number(raw.adSeq) || ads.reduce((m, a) => Math.max(m, Number(a.id) || 0), 0);
      // Drop records with no created date (corrupt rows can never break boot).
      patients = patients.filter((p) => p && p.createdAt);
      seq = Number(raw.seq) || patients.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
      // Doctor directory: load if present, otherwise seed the defaults.
      if (Array.isArray(raw.doctors) && raw.doctors.length) {
        doctors = raw.doctors;
        docSeq = Number(raw.docSeq) || doctors.reduce((m, d) => Math.max(m, Number(d.id) || 0), 0);
        // Restore break states (survive restart — a doctor on lunch is still on lunch).
        breaks = (raw.breaks && typeof raw.breaks === 'object' && !Array.isArray(raw.breaks)) ? raw.breaks : {};
        // Drop breaks of doctors that no longer exist.
        for (const bn of Object.keys(breaks)) if (!doctors.find((d) => d.name === bn)) delete breaks[bn];
      } else {
        doctors = DEFAULT_DOCTORS.map((d) => ({ id: String(++docSeq), ...d }));
        saveDb();
      }
      // Restore the last announced patient (most recently CALLED today) so TVs
      // that connect after a restart still show who was called.
      const called = patients
        .filter((p) => p.status === 'CALLED' && p.calledAt && isToday(p.calledAt))
        .sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt))[0];
      if (called) {
        currentCall = {
          serialNumber: called.serialNumber,
          patientName: called.patientName,
          patientNameBn: called.patientNameBn || '',
          doctorName: called.doctorName,
          doctorNameBn: called.doctorNameBn || '',
          doctorQualification: called.doctorQualification || '',
          doctorSpecialty: called.doctorSpecialty || '',
          doctorSpecialtyBn: called.doctorSpecialtyBn || '',
          chamberNumber: called.chamberNumber,
          floor: (doctors.find((d) => d.name === called.doctorName) || {}).floor || '',
          callCount: called.callCount,
        };
        // Per-doctor restore: most recent CALLED patient for each doctor.
        patients
          .filter((p) => p.status === 'CALLED' && p.calledAt && isToday(p.calledAt))
          .sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt))
          .forEach((p) => {
            if (p.doctorName && !currentCallByDoctor[p.doctorName]) {
              currentCallByDoctor[p.doctorName] = {
                serialNumber: p.serialNumber,
                patientName: p.patientName,
                patientNameBn: p.patientNameBn || '',
                doctorName: p.doctorName,
                doctorNameBn: p.doctorNameBn || '',
                doctorQualification: p.doctorQualification || '',
                doctorSpecialty: p.doctorSpecialty || '',
                doctorSpecialtyBn: p.doctorSpecialtyBn || '',
                chamberNumber: p.chamberNumber,
                floor: (doctors.find((d) => d.name === p.doctorName) || {}).floor || '',
                callCount: p.callCount,
                photoURL: (doctors.find((d) => d.name === p.doctorName) || {}).photoURL || '',
              };
            }
          });
      }
      console.log(`  Loaded ${patients.length} patient(s), ${doctors.length} doctor(s), ${tvs.length} TV(s) from data.json`);
    }
  } catch (e) {
    console.error('  Could not read data.json, starting fresh:', e.message);
  }
  // No data.json (or empty directory): seed the default doctor list.
  if (!doctors.length) {
    doctors = DEFAULT_DOCTORS.map((d) => ({ id: String(++docSeq), ...d }));
    saveDb();
  }
}

let saveTimer = null;
function saveDb() {
  // debounce writes so rapid calls don't thrash the disk
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 100);
}

// Crash-safe persistence: write to a temp file first, then rename over the real
// one. A power cut mid-write can then never leave data.json half-written —
// worst case the previous complete file stays.
function persistNow() {
  clearTimeout(saveTimer);
  const blob = { patients, tvs, doctors, seq, docSeq, breaks, ads, adSeq };
  if (mongoColl) {
    // Cloud: upsert the whole state as one document (fire-and-forget).
    mongoColl.updateOne({ _id: 'state' }, { $set: { data: blob } }, { upsert: true })
      .catch((e) => console.error('  Mongo save failed:', e.message));
    return;
  }
  const tmp = DB_FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(blob, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    console.error('  Could not write data.json:', e.message);
  }
}

// Daily housekeeping: once a day, move finished (COMPLETED) patients older than
// today into data-archive.json so the live file stays small and fast. MISSED
// and WAITING patients are NEVER archived (they may still be called back).
// null (not today) so the FIRST housekeeping run of a new day — including a
// normal morning restart — archives yesterday's finished patients.
let lastArchiveDay = null;
function dailyHousekeeping() {
  const today = new Date().toDateString();
  if (today === lastArchiveDay) return;
  lastArchiveDay = today;
  const keep = [];
  const archive = [];
  for (const p of patients) {
    const done = p.status === 'COMPLETED' && !isToday(p.createdAt);
    (done ? archive : keep).push(p);
  }
  if (!archive.length) return;
  const archiveFile = path.join(__dirname, 'data-archive.json');
  try {
    let old = [];
    if (fs.existsSync(archiveFile)) old = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
    fs.writeFileSync(archiveFile, JSON.stringify(old.concat(archive), null, 2));
    patients = keep;
    persistNow();
    console.log(`  Daily housekeeping: archived ${archive.length} finished patient(s) to data-archive.json`);
  } catch (e) { console.error('  Archive failed:', e.message); }
}

const nextId = () => String(++seq);
const isToday = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
};

(async () => {
  try {
    await initMongo();
  } catch (e) {
    console.error('  MongoDB connect failed — falling back to local file:', e.message);
    mongoColl = null;
  }
  await loadDb();
  dailyHousekeeping();
})();
// Re-check at 1-minute intervals in case the server runs across midnight.
setInterval(dailyHousekeeping, 60 * 1000);
// Flush pending writes before shutdown so no last call is lost.
process.on('SIGINT', () => { persistNow(); process.exit(0); });
process.on('SIGTERM', () => { persistNow(); process.exit(0); });
process.on('uncaughtException', (e) => { console.error('  Uncaught error (server keeps running):', e.message); persistNow(); });

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
function findPatient(id) {
  return patients.find((p) => p.id === String(id));
}

// Clear the "now calling" memory when a called patient is finished, missed-then-
// removed, or deleted — otherwise a deleted/test patient would re-appear on TVs
// that connect later.
function clearCurrentCall(patient) {
  if (patient.doctorName && currentCallByDoctor[patient.doctorName] && currentCallByDoctor[patient.doctorName].serialNumber === patient.serialNumber) {
    delete currentCallByDoctor[patient.doctorName];
  }
  if (currentCall && currentCall.serialNumber === patient.serialNumber && currentCall.patientName === patient.patientName) {
    currentCall = null;
  }
}

// Broadcast a call to every connected TV and speak it.
// Server-side scoping: each socket is tagged with its doctor (from the connect
// query '?doctor=NAME'). A per-doctor TV receives ONLY its own doctor's calls —
// the waiting-hall TV (no ?doctor=) receives every call. Assistant/reception
// panels keep listening to everything for their live lists.
function broadcastCall(patient) {
  const data = {
    id: patient.id,              // panels need the id to act on the restored call
    status: patient.status,      // CALLED snapshot — lets panels re-enable buttons
    serialNumber: patient.serialNumber,
    patientName: patient.patientName,
    patientNameBn: patient.patientNameBn || '',
    doctorName: patient.doctorName,
    doctorNameBn: patient.doctorNameBn || '',
    doctorQualification: patient.doctorQualification || '',
    doctorSpecialty: patient.doctorSpecialty || '',
    doctorSpecialtyBn: patient.doctorSpecialtyBn || '',
    chamberNumber: patient.chamberNumber,
    floor: (findDoctor(patient.doctorName) || {}).floor || '',
    callCount: patient.callCount,
    photoURL: (findDoctor(patient.doctorName) || {}).photoURL || '',
  };
  currentCall = data; // remember so a TV that connects later can restore it
  if (patient.doctorName) currentCallByDoctor[patient.doctorName] = data;

  // 1) The doctor's own room(s): join-room broadcast.
  if (patient.doctorName) {
    io.to('doctor:' + patient.doctorName).emit('patient.called', data);
    // 2) Every socket that did NOT pick a doctor (waiting-hall TVs + panels):
    //    clients tagged 'doctor:*' are excluded via their room membership — we
    //    send to all, then the per-doctor rooms simply get a duplicate which
    //    their client-side guard ignores; harmless but we avoid it anyway by
    //    tracking scoped sockets.
    for (const [id, s] of io.of('/').sockets) {
      if (!s.data.doctorScope) s.emit('patient.called', data);
    }
  } else {
    io.emit('patient.called', data);
  }
  return { event: 'patient.called', data };
}

/* ================================================================== */
/* 1 + 2. PATIENT ENTRY & LIST                                        */
/* ================================================================== */

// POST /api/patients  -> create a patient.
// SIMPLE SERIAL: serialNumber is OPTIONAL — omit it (or send 0/null) and the
// server assigns the next free number for that doctor automatically (1, 2, 3…).
// A manual number still works (e.g. continuing a paper register).
// Name auto-conversion: type the name in English -> Bangla fills automatically;
// type it in Bangla -> English fills automatically. TV shows BOTH.
app.post('/api/patients', (req, res) => {
  const { patientName, patientNameBn, serialNumber, doctorName, chamberNumber } = req.body || {};
  if (!patientName || !doctorName) {
    return res.status(400).json({
      success: false,
      message: 'patientName and doctorName are required',
    });
  }

  const rawName = String(patientName).trim();
  const rawBn = String(patientNameBn || '').trim();
  let finalName = rawName;
  let finalNameBn = rawBn;
  if (rawName && translit.detectScript(rawName) === 'en') {
    if (!finalNameBn) finalNameBn = translit.toBangla(rawName); // English typed → Bangla auto
  } else if (rawName && translit.detectScript(rawName) === 'bn') {
    finalNameBn = rawName;                                      // Bangla typed → stays Bangla
    finalName = translit.toEnglish(rawName) || rawName;         // → English auto (primary)
  }

  // The chamber ALWAYS follows the doctor from the directory — an assistant
  // for one doctor can never register a serial into another doctor's chamber.
  const doc = findDoctor(doctorName);
  const chamber = doc ? doc.chamberNumber : String(chamberNumber || '').trim();

  // One serial number belongs to ONE doctor per day — duplicates rejected.
  // SIMPLE SERIAL: no number given -> next free number for this doctor today.
  const docKey = String(doctorName).trim().toLowerCase();
  let serial = Number(serialNumber);
  if (!serial || serial < 1) {
    serial = patients
      .filter((p) => isToday(p.createdAt)
        && String(p.doctorName || '').trim().toLowerCase() === docKey)
      .reduce((m, p) => Math.max(m, Number(p.serialNumber) || 0), 0) + 1;
  }
  const dup = patients.find((p) => isToday(p.createdAt)
    && String(p.doctorName || '').trim().toLowerCase() === docKey
    && Number(p.serialNumber) === serial);
  if (dup) {
    return res.status(409).json({
      success: false,
      message: `Serial ${serial} already exists for ${doctorName} today (patient: ${dup.patientName})`,
    });
  }

  // Pull the full consulting-doctor details from the directory (if known).
  const patient = {
    id: nextId(),
    patientName: finalName,
    patientNameBn: finalNameBn,
    serialNumber: serial,
    doctorName,
    doctorNameBn: doc ? doc.nameBn : '',
    doctorQualification: doc ? doc.qualification : '',
    doctorSpecialty: doc ? doc.specialty : '',
    doctorSpecialtyBn: doc ? doc.specialtyBn : '',
    // chamber is decided by the doctor's directory entry (never by the client)
    chamberNumber: chamber,
    status: 'WAITING',
    callCount: 0,
    calledAt: null,
    createdAt: new Date().toISOString(),
  };
  patients.push(patient);
  saveDb();
  io.emit('patient.added', patient); // let assistant panels refresh live
  return res.status(201).json(patient);
});

// GET /api/patients  -> today's patients (optional ?doctor=Dr.+Name filter)
app.get('/api/patients', (req, res) => {
  let todays = patients.filter((p) => isToday(p.createdAt));
  if (req.query.doctor) {
    const want = String(req.query.doctor).trim().toLowerCase();
    todays = todays.filter((p) => String(p.doctorName || '').toLowerCase() === want);
  }
  // Attach the doctor's floor so every page can show the combined room number
  // (floor 1 + chamber 03 -> Room 103) without extra lookups.
  const withFloor = todays.map((p) => ({
    ...p,
    floor: (findDoctor(p.doctorName) || {}).floor || '',
  }));
  return res.status(200).json(withFloor);
});

// GET /api/patients/:id
app.get('/api/patients/:id', (req, res) => {
  const patient = findPatient(req.params.id);
  if (!patient) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }
  return res.status(200).json(patient);
});

// POST /api/patients/reset  -> clear the day's list so serials start from 1 again.
//   body: { scope: 'today' | 'all', doctor?: 'Dr. Name' }
//   - scope 'today' (default): remove today's patients (all doctors, or just one)
//   - scope 'all': remove EVERY patient (full wipe)
// Removed patients are archived to data-archive.json first (nothing is lost).
app.post('/api/patients/reset', (req, res) => {
  const { scope, doctor } = req.body || {};
  const doc = doctor ? String(doctor).trim().toLowerCase() : '';
  const shouldRemove = (p) => {
    if (scope === 'all') return doc ? String(p.doctorName || '').toLowerCase() === doc : true;
    // default: today's only
    if (!isToday(p.createdAt)) return false;
    return doc ? String(p.doctorName || '').toLowerCase() === doc : true;
  };
  const removed = patients.filter(shouldRemove);
  if (!removed.length) return res.status(200).json({ success: true, message: 'কিছু মুছার নেই', removed: 0 });

  // Archive removed rows so history is never lost.
  try {
    const archiveFile = path.join(__dirname, 'data-archive.json');
    let old = [];
    if (fs.existsSync(archiveFile)) old = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
    fs.writeFileSync(archiveFile, JSON.stringify(old.concat(removed), null, 2));
  } catch (e) { console.error('  reset archive failed:', e.message); }

  patients = patients.filter((p) => !shouldRemove(p));
  removed.forEach(clearCurrentCall); // clear any "now calling" that referred to a removed patient
  saveDb();
  io.emit('patients.reset', { scope: scope || 'today', doctor: doctor || null, removed: removed.length });
  io.emit('patient.updated', {}); // nudge all panels to reload
  return res.status(200).json({ success: true, message: `${removed.length} জন রোগী মুছে ফেলা হলো — সিরিয়াল আবার ১ থেকে শুরু হবে`, removed: removed.length });
});

// DELETE /api/patients/:id  -> remove a patient entry (admin cleanup / wrong entry)
app.delete('/api/patients/:id', (req, res) => {
  const idx = patients.findIndex((p) => p.id === String(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, message: 'Patient not found' });
  const [removed] = patients.splice(idx, 1);
  clearCurrentCall(removed);
  saveDb();
  io.emit('patient.updated', removed);
  return res.status(200).json({ success: true, message: 'Patient removed', data: removed });
});

/* ================================================================== */
/* 3-7. CALL ACTIONS                                                  */
/* ================================================================== */

// Shared guard: only ONE patient per doctor may be CALLED at a time.
function findBusyDoctorCall(patient) {
  return patients.find((p) => p.id !== patient.id
    && String(p.doctorName || '').trim().toLowerCase() === String(patient.doctorName || '').trim().toLowerCase()
    && p.status === 'CALLED');
}

// POST /api/patients/:id/call
app.post('/api/patients/:id/call', (req, res) => {
  const patient = findPatient(req.params.id);
  if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
  if (patient.status === 'COMPLETED') {
    return res.status(409).json({ success: false, message: 'এই রোগী ইতিমধ্যে DONE — আবার ডাকা যাবে না' });
  }
  const busy = findBusyDoctorCall(patient);
  if (busy) {
    return res.status(409).json({ success: false, message: `আগে Serial ${busy.serialNumber} (${busy.patientName}) শেষ করুন — DONE বা MISSED চাপুন` });
  }
  // Doctor on break? Announcements are blocked (DONE/MISS still work).
  const br = breaks[patient.doctorName];
  if (br) {
    const t = BREAK_TYPES[br.type] || BREAK_TYPES.other;
    return res.status(423).json({ success: false, code: 'DOCTOR_ON_BREAK', message: `${t.labelBn} চলছে — ডাক্তার ব্রেকে আছেন। আগে ব্রেক শেষ করুন।` });
  }

  patient.status = 'CALLED';
  patient.callCount += 1;
  patient.calledAt = new Date().toISOString();
  saveDb();
  broadcastCall(patient);
  return res.status(200).json({ success: true, message: 'Patient called', data: patient });
});

// POST /api/patients/:id/recall  -> same patient, same serial, count++
// Accepts CALLED *and* MISSED patients — recalling a missed patient is the
// same action as the list's CALL AGAIN button (hero panel uses this route).
app.post('/api/patients/:id/recall', (req, res) => {
  const patient = findPatient(req.params.id);
  if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
  if (patient.status !== 'CALLED' && patient.status !== 'MISSED') {
    return res.status(409).json({ success: false, message: 'শুধু CALLED বা MISSED রোগী RECALL করা যায় — আগে CALL করুন' });
  }
  // Doctor on break? Recall re-announces on the TV, so it is blocked too
  // (same rule as CALL / CALL AGAIN — DONE/MISS still work during a break).
  const br = breaks[patient.doctorName];
  if (br) {
    const t = BREAK_TYPES[br.type] || BREAK_TYPES.other;
    return res.status(423).json({ success: false, code: 'DOCTOR_ON_BREAK', message: `${t.labelBn} চলছে — ডাক্তার ব্রেকে আছেন। আগে ব্রেক শেষ করুন।` });
  }

  patient.status = 'CALLED';
  patient.callCount += 1;
  patient.calledAt = new Date().toISOString();
  saveDb();
  broadcastCall(patient);
  return res.status(200).json({ success: true, message: 'Patient recalled', data: patient });
});

// How many people a missed serial waits before its turn comes back around.
// Missing a serial re-queues it this many WAITING patients later (same doctor),
// so it returns to the front automatically — no manual "Call Again" needed.
const REQUEUE_AFTER = 3;

// POST /api/patients/:id/missed  -> re-queues the serial 3 people later
app.post('/api/patients/:id/missed', (req, res) => {
  const patient = findPatient(req.params.id);
  if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
  if (patient.status !== 'CALLED') {
    return res.status(409).json({ success: false, message: 'শুধু CALLED রোগী MISSED করা যায়' });
  }

  // Pull the patient out of the queue, then slot it back in REQUEUE_AFTER
  // WAITING patients (of the same doctor) later. If fewer than that are
  // waiting, it goes to the end of the list.
  const from = patients.indexOf(patient);
  if (from !== -1) patients.splice(from, 1);
  patient.status = 'WAITING';

  let seen = 0;
  let insertAt = patients.length;
  for (let i = 0; i < patients.length; i++) {
    const q = patients[i];
    if (q.status === 'WAITING' && isToday(q.createdAt)
        && String(q.doctorName || '') === String(patient.doctorName || '')) {
      seen += 1;
      if (seen === REQUEUE_AFTER) { insertAt = i + 1; break; }
    }
  }
  patients.splice(insertAt, 0, patient);

  // No longer "now calling" — clear the snapshot so TVs stop showing it as served.
  clearCurrentCall(patient);
  saveDb();
  io.emit('patient.updated', patient);
  return res.status(200).json({ success: true, message: 'Patient re-queued', data: patient, requeuedAfter: seen });
});

// POST /api/patients/:id/call-again  -> missed patient back to CALLED + announce
app.post('/api/patients/:id/call-again', (req, res) => {
  const patient = findPatient(req.params.id);
  if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
  if (patient.status !== 'MISSED') {
    return res.status(409).json({ success: false, message: 'শুধু MISSED রোগী CALL AGAIN করা যায়' });
  }
  const busy = findBusyDoctorCall(patient);
  if (busy) {
    return res.status(409).json({ success: false, message: `আগে Serial ${busy.serialNumber} (${busy.patientName}) শেষ করুন — DONE বা MISSED চাপুন` });
  }
  // Doctor on break? Announcements are blocked (DONE/MISS still work).
  const br = breaks[patient.doctorName];
  if (br) {
    const t = BREAK_TYPES[br.type] || BREAK_TYPES.other;
    return res.status(423).json({ success: false, code: 'DOCTOR_ON_BREAK', message: `${t.labelBn} চলছে — ডাক্তার ব্রেকে আছেন। আগে ব্রেক শেষ করুন।` });
  }

  patient.status = 'CALLED';
  patient.callCount += 1;
  patient.calledAt = new Date().toISOString();
  saveDb();
  broadcastCall(patient);
  return res.status(200).json({ success: true, message: 'Patient called again', data: patient });
});

// POST /api/patients/:id/complete
app.post('/api/patients/:id/complete', (req, res) => {
  const patient = findPatient(req.params.id);
  if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
  if (patient.status !== 'CALLED' && patient.status !== 'MISSED') {
    return res.status(409).json({ success: false, message: 'শুধু CALLED বা MISSED রোগী DONE করা যায়' });
  }

  patient.status = 'COMPLETED';
  clearCurrentCall(patient); // DONE -> no longer "now calling" on TVs
  saveDb();
  io.emit('patient.updated', patient);
  return res.status(200).json({ success: true, message: 'Patient completed', data: patient });
});

/* ================================================================== */
/* 8-10. TV REGISTRATION                                              */
/* ================================================================== */

// POST /api/tv/register
app.post('/api/tv/register', (req, res) => {
  const { tvName, location } = req.body || {};
  const tv = {
    tvId: 'TV-' + String(tvs.length + 1).padStart(3, '0'),
    tvName: tvName || 'Waiting Area',
    location: location || 'Unknown',
    status: 'ONLINE',
  };
  tvs.push(tv);
  saveDb();
  return res.status(200).json({ success: true, message: 'TV registered', data: tv });
});

// GET /api/tv
app.get('/api/tv', (req, res) => {
  return res.status(200).json(tvs);
});

/* ================================================================== */
/* DOCTOR DIRECTORY (admin-manageable)                                */
/* ================================================================== */
// GET /api/doctors  -> list for the reception picker / admin / launcher
app.get('/api/doctors', (req, res) => {
  return res.status(200).json(doctors);
});

/* ================================================================== */
/* ADS / NOTICES — scrolling messages shown at the bottom of the TV   */
/* board. Managed from the admin panel; only ENABLED ones are shown.  */
/* ================================================================== */
// GET /api/ads -> all ads (admin). TV filters to enabled ones itself.
app.get('/api/ads', (req, res) => res.status(200).json(ads));

// POST /api/ads  { text, enabled? } -> add a notice
app.post('/api/ads', (req, res) => {
  const text = String((req.body && req.body.text) || '').trim();
  if (!text) return res.status(400).json({ success: false, message: 'বিজ্ঞাপনের লেখা দিন' });
  const ad = { id: String(++adSeq), text: text.slice(0, 300), enabled: true, createdAt: new Date().toISOString() };
  ads.push(ad);
  saveDb();
  io.emit('ads.updated', ads);
  return res.status(201).json({ success: true, data: ad });
});

// PUT /api/ads/:id  { text?, enabled? } -> edit or show/hide a notice
app.put('/api/ads/:id', (req, res) => {
  const ad = ads.find((a) => String(a.id) === String(req.params.id));
  if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
  if (req.body && typeof req.body.text === 'string') ad.text = req.body.text.trim().slice(0, 300);
  if (req.body && typeof req.body.enabled === 'boolean') ad.enabled = req.body.enabled;
  saveDb();
  io.emit('ads.updated', ads);
  return res.status(200).json({ success: true, data: ad });
});

// DELETE /api/ads/:id -> remove a notice
app.delete('/api/ads/:id', (req, res) => {
  const before = ads.length;
  ads = ads.filter((a) => String(a.id) !== String(req.params.id));
  if (ads.length === before) return res.status(404).json({ success: false, message: 'Ad not found' });
  saveDb();
  io.emit('ads.updated', ads);
  return res.status(200).json({ success: true });
});

/* ================================================================== */
/* PWA MANIFEST (per-doctor installable Assistant app)                */
/* Each doctor's assistant can "Add to Home Screen" and it opens like */
/* a native app, straight into THAT doctor's panel. The manifest is   */
/* generated per doctor so the icon/name/start page match.            */
/* ================================================================== */
// GET /api/server-info -> the server's own LAN IP addresses + port, so the
// Setup page can show the exact links to type on TVs/phones — WHEREVER the
// server runs (home today, hospital tomorrow) it auto-detects the right IP.
app.get('/api/server-info', (req, res) => {
  const os = require('os');
  const nifs = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nifs)) {
    for (const ni of nifs[name] || []) {
      if (ni.family === 'IPv4' && !ni.internal) ips.push({ iface: name, address: ni.address });
    }
  }
  return res.status(200).json({ port: PORT, httpsPort: (typeof httpsPort === 'number' ? httpsPort : 0), ips, hostname: os.hostname() });
});

app.get('/manifest.webmanifest', (req, res) => {
  const doctor = String(req.query.doctor || '').trim();
  const doc = doctor ? findDoctor(doctor) : null;
  const nice = doc ? doc.name : (doctor || 'Assistant');
  const start = doctor
    ? '/assistant.html?doctor=' + encodeURIComponent(doctor)
    : '/assistant.html';
  res.setHeader('Content-Type', 'application/manifest+json');
  return res.status(200).json({
    name: 'Assistant — ' + nice,
    short_name: doc ? (doc.name.replace(/^Dr\.?\s*/i, 'Dr ')) : 'Assistant',
    description: 'Hospital serial calling — assistant panel',
    start_url: start,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#3a0a0d',
    theme_color: '#3a0a0d',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  });
});

/* ================================================================== */
/* NAME TRANSLITERATION PROXY (English -> accurate Bangla)            */
/* The built-in rule-based translit is only approximate. Google Input */
/* Tools gives correct Bangla spellings. We proxy it server-side      */
/* (word-by-word), keep honorifics fixed, and cache. Falls back to    */
/* the client's local translit when offline.                          */
/* ================================================================== */
const HONORIFICS_EN_BN = {
  'md': 'মোঃ', 'md.': 'মোঃ', 'mohammad': 'মোহাম্মদ', 'muhammad': 'মুহাম্মদ',
  'mst': 'মোসাঃ', 'mst.': 'মোসাঃ', 'mrs': 'মিসেস', 'mr': 'মিঃ', 'mr.': 'মিঃ',
  'dr': 'ডা.', 'dr.': 'ডা.', 'md-': 'মোঃ',
};
// Common Bangladeshi name words Google sometimes spells oddly — force the right one.
const NAME_OVERRIDES_EN_BN = {
  'akter': 'আক্তার', 'akther': 'আক্তার', 'aktar': 'আক্তার',
  'khatun': 'খাতুন', 'begum': 'বেগম', 'uddin': 'উদ্দিন',
  'miah': 'মিয়া', 'mia': 'মিয়া', 'hossain': 'হোসেন', 'hossen': 'হোসেন',
  'chowdhury': 'চৌধুরী', 'choudhury': 'চৌধুরী',
};
/* Google Input Tools can hang (no internet / firewall / slow link). Two guards:
   1) Every request gets a hard 3s timeout — after that we settle with the
      local rule-based transliteration, so /api/translit can NEVER hang.
   2) After 3 consecutive failures we skip the network entirely for 60s
      (cooldown) — an offline hospital LAN gets instant local results instead
      of a 3s wait on every word. */
const TRANSLIT_TIMEOUT_MS = 3000;
let translitFailStreak = 0;
let translitSkipUntil = 0;
function isTranslitDown() { return Date.now() < translitSkipUntil; }
function noteTranslitFailure() {
  translitFailStreak += 1;
  if (translitFailStreak >= 3) {
    translitSkipUntil = Date.now() + 60 * 1000; // stop dialing a dead network for 60s
    translitFailStreak = 0;
  }
}
function googleTranslitWord(word) {
  return new Promise((resolve) => {
    const clean = word.replace(/[^a-zA-Z]/g, '');
    if (!clean) return resolve(word);
    const low = clean.toLowerCase();
    if (HONORIFICS_EN_BN[low] || HONORIFICS_EN_BN[low + '.']) {
      return resolve(HONORIFICS_EN_BN[low] || HONORIFICS_EN_BN[low + '.']);
    }
    if (NAME_OVERRIDES_EN_BN[low]) return resolve(NAME_OVERRIDES_EN_BN[low]);
    // Network known-down (or still cooling down): instant local fallback.
    if (isTranslitDown()) return resolve(translit.toBangla(clean));
    const url = 'https://inputtools.google.com/request?text=' + encodeURIComponent(clean) +
      '&itc=bn-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8';
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
    const fallback = () => { noteTranslitFailure(); finish(translit.toBangla(clean)); }; // local rule-based
    const timer = setTimeout(() => {
      try { req.destroy(); } catch (e) {}
      fallback();
    }, TRANSLIT_TIMEOUT_MS);
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
      let data = '';
      r.on('data', (c) => (data += c));
      r.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j[0] === 'SUCCESS' && j[1] && j[1][0] && j[1][0][1] && j[1][0][1][0]) {
            translitFailStreak = 0; // network is healthy again
            return finish(j[1][0][1][0]);
          }
        } catch (e) {}
        fallback(); // bad/empty response — local fallback
      });
    });
    req.on('error', () => fallback());
  });
}
const translitCache = new Map();
app.get('/api/translit', async (req, res) => {
  const text = String(req.query.text || '').trim().slice(0, 120);
  if (!text) return res.status(400).json({ success: false, message: 'text required' });
  if (translit.detectScript(text) === 'bn') return res.json({ text, bangla: text }); // already Bangla
  if (translitCache.has(text)) return res.json({ text, bangla: translitCache.get(text) });
  try {
    const words = text.split(/(\s+)/); // keep the spaces
    const out = await Promise.all(words.map((w) => (/\s/.test(w) || !w ? Promise.resolve(w) : googleTranslitWord(w))));
    const bangla = out.join('');
    translitCache.set(text, bangla);
    return res.json({ text, bangla });
  } catch (e) {
    return res.json({ text, bangla: translit.toBangla(text) });
  }
});

/* ================================================================== */
/* TEXT-TO-SPEECH PROXY (clear Bangla voice)                          */
/* The TV can't reliably hit Google TTS directly (browser CORS /      */
/* referrer / autoplay blocks). So the server fetches the Bangla MP3  */
/* and streams it back SAME-ORIGIN — the TV just plays /api/tts?...   */
/* Cached on disk so repeated serials don't re-hit Google.            */
/* ================================================================== */
const https = require('https');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const TTS_DIR = path.join(__dirname, '.tts-cache');
try { if (!fs.existsSync(TTS_DIR)) fs.mkdirSync(TTS_DIR); } catch (e) {}

/* Announcement voice — Microsoft Neural. Voice was chosen by MEASURING the
   audio of every Bangla voice: both BD voices (Nabanita, Pradeep) swallow the
   word-final "য়" of ছয়/নয় (say "ছো"/"নো"), but Tanishaa (bn-IN) pronounces
   the standard spelling fully (ছয় = ছইয় duration). Slightly slower so waiting
   patients understand clearly. */
const TTS_VOICE = 'bn-IN-TanishaaNeural';
const TTS_RATE = '-6%';
const TTS_PITCH = '-1Hz';
const TTS_VOLUME = '+40%';   // louder so it carries across a waiting room

// Synthesize with the Microsoft neural voice → returns an MP3 Buffer.
function synthEdge(text, voice, rate) {
  return new Promise((resolve, reject) => {
    try {
      const tts = new MsEdgeTTS();
      tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3).then(() => {
        const { audioStream } = tts.toStream(text, { rate, pitch: TTS_PITCH, volume: TTS_VOLUME });
        const chunks = [];
        const to = setTimeout(() => reject(new Error('edge-tts timeout')), 8000);
        audioStream.on('data', (c) => chunks.push(c));
        audioStream.on('end', () => { clearTimeout(to); resolve(Buffer.concat(chunks)); });
        audioStream.on('error', (e) => { clearTimeout(to); reject(e); });
      }).catch(reject);
    } catch (e) { reject(e); }
  });
}

// Fallback: Google Translate TTS (used for non-Bangla, or if edge-tts fails).
function synthGoogle(text, lang) {
  return new Promise((resolve, reject) => {
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' +
      encodeURIComponent(lang) + '&q=' + encodeURIComponent(text);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://translate.google.com/' } }, (r) => {
      if (r.statusCode !== 200) { r.resume(); return reject(new Error('google tts ' + r.statusCode)); }
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

app.get('/api/tts', async (req, res) => {
  const text = String(req.query.text || '').trim().slice(0, 200);
  const lang = /^[a-z]{2}(-[a-z]{2})?$/i.test(req.query.lang || '') ? req.query.lang : 'bn';
  if (!text) return res.status(400).json({ success: false, message: 'text required' });

  const isBangla = String(lang).toLowerCase().startsWith('bn');
  const md5 = (s) => require('crypto').createHash('md5').update(s).digest('hex');
  /* Cache key includes the ENGINE that produced the audio. A Google-fallback
     file must NEVER be served for the neural key — otherwise one transient
     edge-tts failure would poison that announcement with the robotic voice
     forever (cache never expires). */
  const edgeKey = md5('edge:' + TTS_VOICE + ':' + TTS_RATE + ':' + TTS_PITCH + ':' + TTS_VOLUME + '|' + text);
  const gKey = md5('google:' + lang + '|' + text);
  const serve = (file) => {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    fs.createReadStream(file).pipe(res);
  };
  const cacheHit = (file) => fs.existsSync(file) && fs.statSync(file).size > 1000;

  if (isBangla && cacheHit(path.join(TTS_DIR, edgeKey + '.mp3'))) return serve(path.join(TTS_DIR, edgeKey + '.mp3'));
  if (!isBangla && cacheHit(path.join(TTS_DIR, gKey + '.mp3'))) return serve(path.join(TTS_DIR, gKey + '.mp3'));

  try {
    let buf, key;
    if (isBangla) {
      // Neural voice first; if that fails (offline / blocked) fall back to Google.
      // Fallback audio is cached under its OWN key so it can't poison the neural key.
      try {
        buf = await synthEdge(text, TTS_VOICE, TTS_RATE);
        key = edgeKey;
      } catch (e) {
        buf = await synthGoogle(text, lang);
        key = gKey;
      }
    } else {
      buf = await synthGoogle(text, lang);
      key = gKey;
    }
    if (!buf || buf.length < 1000) throw new Error('empty tts audio');
    try { fs.writeFileSync(path.join(TTS_DIR, key + '.mp3'), buf); } catch (e) {}
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.end(buf);
  } catch (e) {
    res.status(502).json({ success: false, message: 'tts failed: ' + e.message });
  }
});

// POST /api/doctors  -> add a doctor
app.post('/api/doctors', (req, res) => {
  const { name, nameBn, qualification, specialty, specialtyBn, chamberNumber, floor, photoURL } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, message: 'Doctor name is required' });
  }
  if (findDoctor(name)) {
    return res.status(409).json({ success: false, message: 'A doctor with this name already exists' });
  }
  const doc = {
    id: String(++docSeq),
    name: String(name).trim(),
    nameBn: nameBn || '',
    qualification: qualification || '',
    specialty: specialty || '',
    specialtyBn: specialtyBn || '',
    chamberNumber: String(chamberNumber || '').trim(),
    floor: String(floor || '').trim(),
    photoURL: String(photoURL || '').trim(),
  };
  doctors.push(doc);
  saveDb();
  io.emit('doctors.updated', doctors);
  return res.status(201).json(doc);
});

// PUT /api/doctors/:id  -> update a doctor
app.put('/api/doctors/:id', (req, res) => {
  const doc = doctors.find((d) => d.id === String(req.params.id));
  if (!doc) return res.status(404).json({ success: false, message: 'Doctor not found' });
  const { name, nameBn, qualification, specialty, specialtyBn, chamberNumber, floor, photoURL } = req.body || {};
  if (name && String(name).trim() && String(name).trim().toLowerCase() !== doc.name.toLowerCase() && findDoctor(name)) {
    return res.status(409).json({ success: false, message: 'A doctor with this name already exists' });
  }
  if (name && String(name).trim()) doc.name = String(name).trim();
  if (nameBn !== undefined) doc.nameBn = nameBn;
  if (qualification !== undefined) doc.qualification = qualification;
  if (specialty !== undefined) doc.specialty = specialty;
  if (specialtyBn !== undefined) doc.specialtyBn = specialtyBn;
  if (chamberNumber !== undefined) doc.chamberNumber = String(chamberNumber).trim();
  if (floor !== undefined) doc.floor = String(floor).trim();
  if (photoURL !== undefined) doc.photoURL = String(photoURL).trim();
  saveDb();
  io.emit('doctors.updated', doctors);
  return res.status(200).json(doc);
});

// DELETE /api/doctors/:id  -> remove a doctor
app.delete('/api/doctors/:id', (req, res) => {
  const idx = doctors.findIndex((d) => d.id === String(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, message: 'Doctor not found' });
  const [removed] = doctors.splice(idx, 1);
  delete breaks[removed.name]; // doctor gone → break state gone
  saveDb();
  io.emit('doctors.updated', doctors);
  return res.status(200).json({ success: true, message: 'Doctor removed', data: removed });
});

/* ================================================================== */
/* DOCTOR BREAKS (lunch / namaz / other)                              */
/* ================================================================== */
// GET /api/breaks  -> current break states for all pages
app.get('/api/breaks', (req, res) => {
  const out = Object.entries(breaks).map(([doctorName, b]) => ({
    doctorName,
    type: b.type,
    label: (BREAK_TYPES[b.type] || BREAK_TYPES.other).label,
    labelBn: (BREAK_TYPES[b.type] || BREAK_TYPES.other).labelBn,
    note: b.note || '',
    startedAt: b.startedAt,
  }));
  return res.status(200).json(out);
});

// POST /api/doctors/:id/break  { type: 'lunch'|'namaz'|'other', note? }
app.post('/api/doctors/:id/break', (req, res) => {
  const doc = doctors.find((d) => d.id === String(req.params.id));
  if (!doc) return res.status(404).json({ success: false, message: 'Doctor not found' });
  const { type, note } = req.body || {};
  if (!BREAK_TYPES[type]) return res.status(400).json({ success: false, message: 'type must be lunch, namaz or other' });
  breaks[doc.name] = { type, note: String(note || '').trim(), startedAt: new Date().toISOString() };
  saveDb();
  io.emit('break.started', { doctorName: doc.name, type, label: BREAK_TYPES[type].label, labelBn: BREAK_TYPES[type].labelBn, note: breaks[doc.name].note, startedAt: breaks[doc.name].startedAt });
  return res.status(200).json({ success: true, message: `${doc.name} — ${BREAK_TYPES[type].labelBn} শুরু হলো`, data: breaks[doc.name] });
});

// DELETE /api/doctors/:id/break  -> break over
app.delete('/api/doctors/:id/break', (req, res) => {
  const doc = doctors.find((d) => d.id === String(req.params.id));
  if (!doc) return res.status(404).json({ success: false, message: 'Doctor not found' });
  if (!breaks[doc.name]) return res.status(409).json({ success: false, message: 'এই ডাক্তার এখন ব্রেকে নেই' });
  delete breaks[doc.name];
  saveDb();
  io.emit('break.ended', { doctorName: doc.name });
  return res.status(200).json({ success: true, message: `${doc.name} — ব্রেক শেষ, আবার ডাকা যাবে` });
});

/* ================================================================== */
/* SHORTLINKS for TVs & assistants (easy manual setup on devices)     */
/*   /tv/03      -> TV for whichever doctor sits in room 03           */
/*   /assist/03  -> assistant panel for room 03's doctor              */
/* Staff only need to type the ROOM NUMBER on each TV — no long       */
/* doctor names, no typos.                                            */
/* ================================================================== */
const redirectToDoctor = (page) => (req, res) => {
  const room = String(req.params.room || '').trim();
  // Accept BOTH forms: plain chamber number (/tv/03) and floor+room (/tv/103 =
  // floor 1 room 03). The displayed Room number everywhere is floor*100+chamber.
  let doc = doctors.find((d) => String(d.chamberNumber).trim() === room);
  if (!doc && room.length >= 3) {
    const ch = room.slice(-2).replace(/^0/, '');
    const fl = room.slice(0, -2).replace(/^0/, '');
    doc = doctors.find((d) => String(parseInt(d.chamberNumber, 10)) === ch && String(parseInt(d.floor, 10)) === fl);
  }
  if (!doc) {
    return res.status(302).redirect('/?error=' + encodeURIComponent('No doctor found for room ' + room));
  }
  return res.status(302).redirect('/' + page + '.html?doctor=' + encodeURIComponent(doc.name));
};
app.get('/tv/:room', redirectToDoctor('tv'));
app.get('/assist/:room', redirectToDoctor('assistant'));

/* ------------------------------------------------------------------ */
/* Socket.IO                                                          */
/* ------------------------------------------------------------------ */
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  // TVs pass ?doctor=NAME (socket query). Tag the socket and put it in that
  // doctor's room so broadcastCall can scope events server-side.
  const wantDoctor = String((socket.handshake.query && socket.handshake.query.doctor) || '').trim();
  if (wantDoctor) {
    socket.data.doctorScope = wantDoctor;
    socket.join('doctor:' + wantDoctor);
  }
  const restore = wantDoctor ? currentCallByDoctor[wantDoctor] : currentCall;
  if (restore) socket.emit('current.call', restore);
  // A per-doctor TV that connects while its doctor is on break sees it right away.
  if (wantDoctor && breaks[wantDoctor]) {
    const b = breaks[wantDoctor];
    const t = BREAK_TYPES[b.type] || BREAK_TYPES.other;
    socket.emit('break.started', { doctorName: wantDoctor, type: b.type, label: t.label, labelBn: t.labelBn, note: b.note || '', startedAt: b.startedAt });
  }
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

/* ------------------------------------------------------------------ */
/* AUTO HTTPS — "Add to Home Screen" needs a SECURE CONTEXT           */
/* Browsers only show the native install dialog over HTTPS (or on     */
/* localhost). On the hospital LAN the server is plain HTTP, so the   */
/* HOME button could never install directly on phones. Fix: generate  */
/* a self-signed certificate and serve HTTPS on PORT+443 (5001)       */
/* alongside HTTP. On the phone, https://<PC-IP>:5001 is a secure     */
/* context → the HOME button fires the REAL native install dialog —   */
/* one tap and the app lands on the home screen. (Self-signed certs   */
/* show a one-time warning on first visit; add-home.html walks staff  */
/* through it in Bangla.)                                             */
/* ================================================================== */
let httpsPort = 0;
let httpsServer = null;
// On a cloud host (Render etc.) HTTPS is handled by the platform's proxy, so we
// skip the local self-signed cert. RENDER is set automatically by Render.
const ON_CLOUD = !!(process.env.RENDER || process.env.DATA_DIR);
(async () => {
if (ON_CLOUD) return;
try {
  const selfsigned = require('selfsigned');
  const CERT_DIR = path.join(__dirname, '.certs');
  const CERT_FILE = path.join(CERT_DIR, 'cert.pem');
  const KEY_FILE = path.join(CERT_DIR, 'key.pem');
  let certPem = null;
  let keyPem = null;
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    certPem = fs.readFileSync(CERT_FILE);
    keyPem = fs.readFileSync(KEY_FILE);
  } else {
    const pems = await selfsigned.generate(
      [{ name: 'commonName', value: 'Hospital Serial Calling' }],
      { days: 3650, keySize: 2048, extensions: [
        { name: 'subjectAltName', altNames: [
          { type: 2, value: 'localhost' },              // DNS
          { type: 7, ip: '127.0.0.1' },                 // loopback IPv4
        ]},
      ]});
    certPem = pems.cert;
    keyPem = pems.private;
    try { fs.mkdirSync(CERT_DIR, { recursive: true }); fs.writeFileSync(CERT_FILE, certPem); fs.writeFileSync(KEY_FILE, keyPem); } catch (e) {}
  }
  httpsServer = https.createServer({ key: keyPem, cert: certPem }, app);
  httpsPort = Number(process.env.HTTPS_PORT) || (Number(PORT) === 443 ? 443 : Number(PORT) + 1);
  httpsServer.listen(httpsPort, () => {
    console.log(`  Secure (HTTPS): https://localhost:${httpsPort}  ← phones install PWA from here`);
  });
  httpsServer.on('error', (e) => {
    console.error(`  HTTPS on :${httpsPort} failed (${e.message}) — continuing HTTP-only.`);
    httpsServer = null;
    httpsPort = 0;
  });
  // One-time download of the certificate so phones can trust it (see add-home.html).
  app.get('/cert', (req, res) => {
    res.setHeader('Content-Type', 'application/x-x509-ca-cert');
    res.setHeader('Content-Disposition', 'attachment; filename="hospital-serial-calling.crt"');
    return res.status(200).send(certPem);
  });
} catch (e) {
  console.error('  HTTPS setup skipped:', e.message);
}
})();

/* ------------------------------------------------------------------ */
server.listen(PORT, () => {
  console.log(`\n  Hospital Serial Calling System running:`);
  console.log(`  Reception : http://localhost:${PORT}/reception.html`);
  console.log(`  Assistant : http://localhost:${PORT}/assistant.html`);
  console.log(`  TV Display: http://localhost:${PORT}/tv.html`);
  console.log(`  API base  : http://localhost:${PORT}/api\n`);
});

/* Attach Socket.IO to BOTH servers so real-time works over HTTP and HTTPS. */
io.attach(server);
if (httpsServer) io.attach(httpsServer);
