# Hospital Smart Serial & Voice Calling System

A **simple**, working full-stack app: manually add patients + serial, an assistant calls a serial from a phone/tablet, and the connected waiting-room TV **instantly** shows it and **speaks** it (Bangla + English).

```
Reception  →  adds patient + serial
Assistant  →  presses CALL
Backend    →  Socket.IO real-time
TV         →  shows serial + patient  🔊 voice announcement
Missed     →  CALL AGAIN  (same serial)
```

## What's inside

```
app/
  server.js            Express REST API + Socket.IO (port 5000, file-backed data.json)
  package.json
  public/
    index.html         Launcher (common screens + per-doctor ASSIST/TV/HOME buttons)
    admin.html         Admin setup: add/edit/delete doctors (room, floor, details)
    reception.html     Register patient + serial
    assistant.html     Mobile panel: CALL / RECALL / MISSED / CALL AGAIN / DONE / NEXT
    add-home.html      Mobile "Add to Home Screen" helper (HTTPS setup + native install dialog)
    tv.html            Full-screen waiting-room display + Web Speech voice (female)
    theme.js           Shared design system (colors / fonts)
    vendor/tailwind.js Vendored Tailwind runtime (no CDN needed on hospital LAN)
```

## Multi-doctor / multi-room setup (10–20 doctors, per-floor TVs)

1. **Admin Setup** (`admin.html`): add every doctor with name (English + বাংলা),
   qualification, specialty, **room/chamber number** and **floor**. Doctors persist
   in `data.json` and appear everywhere instantly.
2. The launcher lists every doctor with two buttons:
   - **ASSIST** → `assistant.html?doctor=Dr.+Name` — a phone/tablet dedicated to that
     doctor: its queue, metrics and NEXT button only handle that doctor's patients,
     and the Add-Patient form is pre-locked to the doctor.
   - **TV** → `tv.html?doctor=Dr.+Name` — a chamber TV for that doctor's room: header
     shows doctor + chamber + floor, and it only displays/announces that doctor's
     calls. Open the right link on each room's TV.
3. **Waiting Hall TV** (`tv.html` with no `?doctor=`) shows **every** doctor's calls —
   use it for the main waiting hall / floor-wide display.
4. Floor 1 with 5 TVs + 5 rooms? Open each room's TV link on that room's screen —
   done. Add doctors any time from Admin; new doctors appear on the launcher
   automatically.

## Run it

```bash
cd app
npm install
npm start
```

The server listens on **port 5000 (HTTP)** and automatically starts **port 5001 (HTTPS)**
with a self-signed certificate. HTTPS exists so the per-doctor Assistant can be installed
as a real app on phones: browsers only show the native "Add to Home Screen" install dialog
on secure origins. Use the **HOME** button (Launcher / Admin) on the phone —
`add-home.html` walks through the one-time certificate warning and fires the real install
dialog (hospital-logo icon on the home screen). TVs and the rest of the LAN keep using HTTP.

Then open (each on its own device / browser tab):

| Screen | URL |
|---|---|
| Launcher | http://localhost:5000/ |
| Reception | http://localhost:5000/reception.html |
| Assistant (mobile) | http://localhost:5000/assistant.html |
| Waiting Room TV | http://localhost:5000/tv.html |
| Phone app install (HOME button) | http://<PC-IP>:5000/assistant.html?install=1 → https://<PC-IP>:5001 |

> On a real hospital LAN, replace `localhost` with the server PC's IP (e.g. `http://192.168.0.10:5000/tv.html`) so tablets and the TV can connect.

## Try the flow

1. **Reception**: add a patient (name + serial + doctor + chamber) → appears in the list.
2. **Assistant**: press **CALL** on that patient (or **NEXT PATIENT**).
3. **TV**: the serial + name + doctor + chamber appear instantly and a voice announces it.
4. If the patient doesn't come → **MISSED** → later press **CALL AGAIN** (same serial, announced again).
5. **DONE** marks the patient completed.

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/patients` | Add patient (`patientName`, `serialNumber`, `doctorName`, `chamberNumber`) |
| GET | `/api/patients` | Today's patients (optional `?doctor=Dr.+Name` filter) |
| GET | `/api/patients/:id` | One patient |
| DELETE | `/api/patients/:id` | Remove a patient entry (admin cleanup) |
| POST | `/api/patients/:id/call` | Call → status `CALLED` + TV event |
| POST | `/api/patients/:id/recall` | Recall (callCount++) + TV event |
| POST | `/api/patients/:id/missed` | Mark `MISSED` |
| POST | `/api/patients/:id/call-again` | Missed → `CALLED` + TV event |
| POST | `/api/patients/:id/complete` | Mark `COMPLETED` |
| GET | `/api/doctors` | Doctor directory |
| POST | `/api/doctors` | Add doctor (name, nameBn, qualification, specialty, chamberNumber, floor) |
| PUT | `/api/doctors/:id` | Update doctor |
| DELETE | `/api/doctors/:id` | Remove doctor |
| POST | `/api/tv/register` | Register a TV |
| GET | `/api/tv` | List TVs |
| POST | `/api/ads/upload` | Upload an ad image (`multipart/form-data`, field `image`, max 10 MB; JPG/PNG/WEBP/GIF) |

Real-time Socket.IO event: **`patient.called`** `{ serialNumber, patientName, doctorName, chamberNumber, callCount }`.

## Notes

- **Voice**: uses the browser's built-in Web Speech API with a **female voice** when available (picked automatically per language). Announcements are **spoken twice** (English + Bangla, then repeated) after a soft chime, spoken slowly (rate 0.75) for clarity. Press the **VOICE TEST** button on the TV header to check the sound level and see which voices are installed. Bangla voice quality depends on the TV device/browser (Chrome on Android TV works well; a Bangla TTS voice such as Google বাংলা gives the best result). Keep the TV browser tab focused and volume up. Click **VOICE TEST** once if the browser blocks autoplay audio.
- **Data is in memory** — it resets when the server restarts. This keeps the demo simple. For permanent storage, connect a database (see `postman/documents/DEPLOYMENT_ROADMAP.md`).
- The matching **Postman collection** (`Hospital Simple Serial Calling API`) can test every endpoint against `http://localhost:5000`.
- **TV ads/images**: From Admin, choose **ছবি / ব্যানার** and upload a JPG, PNG, WEBP, or GIF image (up to 10 MB). Uploaded images are served by the hospital server itself, avoiding external image-host hotlink and embedding blocks. The existing image URL option is still available.
