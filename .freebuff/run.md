# Run doc — Hospital Smart Serial & Voice Calling System

Node.js app in `app/` (Express + Socket.IO, static pages in `app/public/`, file-backed
DB at `app/data.json`). No build step. Default port **5000**.

## Reproduce artifacts (fresh checkout)

1. **Install dependencies** (package-lock present, use npm):
   ```
   cd app && npm install
   ```
2. **Vendor the Tailwind runtime** (NOT an npm dependency — a single browser script).
   The machine this project runs on cannot reach `https://cdn.tailwindcss.com` from the
   browser sandbox, so the Play-CDN build is vendored:
   ```
   curl -L -o app/public/vendor/tailwind.js https://cdn.tailwindcss.com
   ```
   All four pages load it via `<script src="vendor/tailwind.js">`. If the download
   fails on a network that can reach the CDN, either retry or temporarily restore the
   CDN `<script>` tags — the shared theme in `app/public/theme.js` works with both.

## Run the server

```
cd app
npm run dev
```

- **IMPORTANT (this machine):** a global `PORT=0` env var is set, which makes
  `process.env.PORT || 5000` bind a random port. Always start with an explicit port:
  - bash/POSIX: `PORT=5000 npm run dev`
  - PowerShell (detached, per Freebuff preview recipe):
    ```powershell
    $env:PORT='5000'; (Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory '<project>\app' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id
    ```
    (stdout and stderr must point at different files.)
- Health check: `curl http://localhost:5000/api/patients` → JSON array (200).
- Screens: `/` launcher, `/reception.html`, `/assistant.html`, `/tv.html`.
- Data persists to `app/data.json` (survives restart). No `.env` files exist —
  nothing to copy from the main checkout (this workspace IS the main checkout).
