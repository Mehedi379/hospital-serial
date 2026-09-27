# Hospital Smart Serial & Voice Calling System

## Sompurno Deployment Roadmap (Shuru theke Shesh)

> Ei document-ta apnar hospital product-ta ekti asholi hospital-e deploy korar jonno **shuru theke shesh porjonto** sob step bornona kore. Eta apnar ba apnar developer team-er jonno reference.

---

## 0. Ekhon apnar kase ki ache (Current State)

| Jinis | Obostha |
|---|---|
| UI Design (`DESIGN.md`) | ✅ Design system ready (colors, typography) |
| `code.html` (TV Display screen) | ⚠️ Static UI mockup — kono logic nei |
| `code1.html` (Assistant Mobile panel) | ⚠️ Static UI — buttons kaj kore na |
| Backend API | ❌ Nei |
| Database | ❌ Nei |
| Real-time sync (TV update) | ❌ Nei |
| Voice announcement | ❌ Nei |
| Hosting / Deployment | ❌ Nei |

**Mane:** Sundor design ache, kintu kono kaj kore na. Eta ke kajkora product banate hole niche-r step gulo lagbe.

---

## 1. Architecture Overview (Puro system-ta kivabe kaj korbe)

```
┌────────────────────────────────────────────────────────────┐
│                     HOSPITAL NETWORK                         │
│                                                              │
│  [Reception PC] ──┐                                          │
│                   │                                          │
│  [Assistant Mobile] ──┤                                      │
│                   │        ┌──────────────┐                  │
│  [Doctor Tablet] ─┼──────► │   BACKEND    │ ◄──► [Database]  │
│                   │        │   API SERVER │                  │
│  [Admin PC] ──────┘        │ + WebSocket  │                  │
│                            └──────┬───────┘                  │
│                                   │ (real-time push)         │
│                                   ▼                          │
│                        [Waiting Room TV(s)] 🔊 Voice         │
└────────────────────────────────────────────────────────────┘
```

**Mul concept:** Sob device (reception, mobile, TV) ekta **central backend server**-er sathe connected thakbe. Assistant NEXT chaple → server sob connected TV-te **real-time** push korbe → TV screen change + voice baje.

> ⚠️ **Guruttopurno:** localStorage diye eta hobe na, karon reception/mobile/TV alada alada device. Alada device connect korte **server lagbei**.

---

## 2. STEP-BY-STEP ROADMAP

### PHASE 1 — API Design & Contract (Postman) 🎯
**Ki:** Backend banano-r age sob API endpoint design kora.

- [ ] Data models thik kora: Patient, Doctor, Assistant, Department, Chamber, TV, Queue, Call, Announcement, Setting, AuditLog
- [ ] REST endpoints define kora (niche section 3 dekhun)
- [ ] Real-time events define kora (WebSocket) (niche section 4)
- [ ] Postman-e **collection** banano — sob endpoint soho
- [ ] Postman-e **mock server** banano — jate backend ready howar age frontend test korte pare
- [ ] Postman-e **environment variables** (baseUrl, tokens)

**Tools:** Postman (ei ta ekhoni kora jay)
**Somoy:** 1-2 din

---

### PHASE 2 — Database Design
**Ki:** Data kothay save hobe.

- [ ] Database select: **PostgreSQL** (recommended, relational data-r jonno bhalo) othoba MySQL
- [ ] Tables: `patients`, `doctors`, `assistants`, `departments`, `chambers`, `tvs`, `queue_entries`, `calls`, `announcements`, `settings`, `audit_logs`, `users`
- [ ] Relationships: doctor → chamber → tv; patient → queue_entry → doctor
- [ ] Daily serial reset logic (settings onujayi)
- [ ] Index: queue lookup fast korar jonno

**Somoy:** 2-3 din

---

### PHASE 3 — Backend Development
**Ki:** API server banano.

- [ ] Tech select: **Node.js + Express** (othoba NestJS) — recommended, WebSocket-er jonno easy
- [ ] Sob REST endpoint implement kora (Phase 1-er contract onujayi)
- [ ] **WebSocket / Socket.IO** setup — real-time TV push-er jonno
- [ ] Authentication: JWT-based login (Admin, Reception, Assistant, Doctor roles)
- [ ] Role-based access control (RBAC)
- [ ] Serial generation logic (normal + priority: P001)
- [ ] Queue state machine: WAITING → CALLING → CALLED → (MISSED / HOLD / COMPLETED)
- [ ] Audit log — protita important action save

**Somoy:** 2-3 saptaho

---

### PHASE 4 — Real-time & Voice
**Ki:** TV instant update + voice announcement.

- [ ] **WebSocket channel** per TV / per chamber
- [ ] Assistant "CALL" → server → WebSocket event → TV screen update
- [ ] **Voice announcement:**
  - Option A (simple): TV browser-e **Web Speech API** (`speechSynthesis`) — Bangla + English support
  - Option B (better quality): Server-side TTS (Google Cloud TTS / Amazon Polly — Bangla voice) → audio file → TV play
- [ ] Announcement template: `"Serial number {serial}, {patient}, please proceed to {doctor}, chamber {chamber}"`
- [ ] Recall = same event re-fire
- [ ] Custom announcement broadcast (All TVs / specific TV)

**Somoy:** 1 saptaho

---

### PHASE 5 — Frontend Integration
**Ki:** `code.html` ar `code1.html` ke real API-r sathe connect kora.

- [ ] TV Display (`code.html`): WebSocket connect → real-time call receive → animation + voice
- [ ] Assistant Mobile (`code1.html`): buttons → API call (NEXT/RECALL/MISSED/HOLD/CALL ANY)
- [ ] Reception panel: patient register → serial generate
- [ ] Admin dashboard: live queue, reports, settings, manage doctors/TVs
- [ ] Doctor dashboard (optional)
- [ ] Login screen + session management
- [ ] Responsive: Desktop / Tablet / Mobile / TV (landscape)

> Suggestion: Static HTML-er poriborte **React/Next.js** e convert korle maintain kora onek shoja hobe. Kintu ekhon-kar HTML diyeo shuru kora jay.

**Somoy:** 2-3 saptaho

---

### PHASE 6 — Deployment & Hosting
**Ki:** Product ke live kora.

**Option A — Cloud (multiple hospital / branch):**
- [ ] Backend + DB: **AWS / DigitalOcean / Railway / Render**
- [ ] Frontend: Vercel / Netlify (othoba backend-er sathe served)
- [ ] Domain + **HTTPS (SSL)** — obosshoi (Web Speech API + security-r jonno lage)
- [ ] Managed PostgreSQL (AWS RDS / DigitalOcean managed DB)

**Option B — On-premise (ekta hospital, internet nirbhorota kom):**
- [ ] Ekta local server PC hospital-er modhye
- [ ] Backend + DB oi PC-te cholbe
- [ ] Sob device local WiFi diye connect (reception, mobile, TV)
- [ ] Suvidha: internet down thakleo cholbe

**Somoy:** 3-5 din

---

### PHASE 7 — Devices (Hardware) Setup
**Ki:** Asholi hospital-e ki ki lagbe.

| Device | Kaj | Suggestion |
|---|---|---|
| **Reception PC** | Patient entry | Sadharon Windows PC + browser |
| **Assistant device** | Patient calling | Mobile / Tablet (Android) — protita chamber-e ekta |
| **Waiting room TV** | Display + voice | Smart TV / Android TV Box (jemon MI Box, Firestick) + **speaker** (voice jore shona-r jonno) |
| **Doctor tablet** (optional) | Queue dekha | Tablet |
| **Admin PC** | Manage everything | PC |
| **Network** | Sob connect | Bhalo **WiFi router** — stable connection important |

> 💡 TV-te ekta browser (Android TV-r Chrome / kiosk app) khule TV display page-ta full-screen kore rakhbe. Voice-er jonno TV-te **bhalo speaker** lage.

**Somoy:** Hospital-er size onujayi

---

### PHASE 8 — Testing & Go-Live
- [ ] Postman collection diye **API testing** (protita endpoint)
- [ ] **Load test** — ekshathe onek call/queue update thik moto kaj kore kina (Postman-e kora jay)
- [ ] Multi-device real-time test (mobile → TV latency < 1 sec)
- [ ] Voice clarity test (waiting room-e jore shona jay kina)
- [ ] 1-2 din **pilot** ekta chamber-e cholan, tarpor puro hospital-e
- [ ] Staff training (reception + assistant)
- [ ] Backup + data recovery plan

---

## 3. Required REST API Endpoints (Phase 1-e Postman-e banabo)

```
AUTH
  POST   /auth/login
  POST   /auth/logout

PATIENTS / QUEUE
  POST   /patients                 (register + serial generate)
  GET    /patients/:id
  PATCH  /patients/:id
  GET    /queue?doctorId=&status=   (live queue)

CALL ACTIONS (core)
  POST   /queue/:serial/call        (call / next)
  POST   /queue/:serial/recall
  POST   /queue/:serial/missed
  POST   /queue/:serial/hold
  POST   /queue/:serial/release
  POST   /queue/:serial/complete
  POST   /queue/:serial/call-again  (front / return-to-queue)

MASTERS
  GET/POST/PATCH/DELETE  /doctors
  GET/POST/PATCH/DELETE  /assistants
  GET/POST/PATCH/DELETE  /departments
  GET/POST/PATCH/DELETE  /chambers
  GET/POST/PATCH/DELETE  /tvs
  POST   /tvs/pair                  (pairing code)

ANNOUNCEMENTS / VOICE
  POST   /announcements             (custom announcement → TVs)
  GET/PATCH /settings/voice

REPORTS / HISTORY
  GET    /reports/summary
  GET    /calls/history?date=&doctorId=
  GET    /audit-logs

SETTINGS
  GET/PATCH /settings
```

---

## 4. Real-time WebSocket Events (Phase 4)

```
SERVER → TV / clients:
  call.new         { serial, patient, doctor, chamber, tvId }
  call.recall      { serial, ... }
  call.completed   { serial }
  announcement     { message, targetTv, voice }
  tv.status        { tvId, status: connected/disconnected }

CLIENT → SERVER:
  tv.register      { tvId, pairingCode }
  assistant.action { action, serial, doctorId }
```

---

## 5. Recommended Tech Stack (Summary)

| Layer | Recommendation |
|---|---|
| API Design & Test | **Postman** (collection + mock + tests) |
| Backend | **Node.js + Express** (+ Socket.IO for real-time) |
| Database | **PostgreSQL** |
| Frontend | Ekhon-kar HTML → pore **React / Next.js** |
| Voice | Web Speech API (simple) / Google Cloud TTS (Bangla, better) |
| Auth | JWT + role-based access |
| Hosting | Cloud (Railway/Render/AWS) othoba On-premise PC |
| Devices | Android TV box + speaker, Android tablet/mobile, PC |

---

## 6. Timeline Estimate (Approximate)

| Phase | Somoy |
|---|---|
| 1. API Design (Postman) | 1-2 din |
| 2. Database | 2-3 din |
| 3. Backend | 2-3 saptaho |
| 4. Real-time + Voice | 1 saptaho |
| 5. Frontend Integration | 2-3 saptaho |
| 6. Deployment | 3-5 din |
| 7. Devices | Hospital onujayi |
| 8. Testing + Go-live | 1 saptaho |
| **Total** | **~6-8 saptaho** (ekjon developer team) |

---

## 7. Ekhoni ki shuru korte pari (Next Step)

**Phase 1** ekhoni Postman-e shuru kora jay:
1. Sompurno **API collection** banano (upore-r sob endpoint)
2. **Mock server** — jate `code.html` / `code1.html` real backend chara-i test kora jay
3. **Environment** (baseUrl, token) setup

Eta hobe apnar puro product-er **bhitti (foundation)** — er upor developer real backend banabe.

---
*Ei roadmap-ta apnar `postman/documents/` folder-e save kora ache. Kono phase-e detail chaile bolben.*
