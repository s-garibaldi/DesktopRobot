# Raspberry Pi Deployment Plan

This document outlines how to run the Desktop Robot on a Raspberry Pi with an HDMI LCD, USB microphone, and USB speaker.

---

## Architecture Overview

| Component | Current (macOS/Windows) | On Raspberry Pi |
|-----------|-------------------------|------------------|
| **Frontend** | Tauri desktop app (React + Rust) | Web app in Chromium (kiosk mode) |
| **Backend** | Next.js on `localhost:3000` | Next.js on `localhost:3000` (same) |
| **Memory** | Tauri file storage or localStorage | localStorage (already supported) |
| **Audio** | System default devices | USB mic/speaker via PulseAudio/ALSA |

---

## Recommended Approach: Web Kiosk (No Tauri on Pi)

**Why not build Tauri for Raspberry Pi?**

- Tauri 1.x has limited official support for Linux ARM (Raspberry Pi). You would need to cross-compile or build on-device, and WebView/GTK stack on Pi can be fragile.
- The backend already falls back to **localStorage** when Tauri is not available, so persistence works in a browser.
- A single Chromium window in kiosk mode is simpler to deploy, update, and debug.

**Flow on Pi:**

1. Build the **frontend** as static files (Vite build).
2. Run the **backend** (Next.js) on the Pi.
3. Serve the frontend (e.g. from Next.js or a small static server).
4. Launch **Chromium in kiosk mode** pointing at the app URL.
5. Use **systemd** to start backend and kiosk on boot.

---

## Phase 1: Code and Build Readiness

### 1.1 Configurable backend URL

The frontend currently hardcodes `http://localhost:3000`. For Pi (and flexibility), make it configurable via environment variable so the same build can work on Pi (localhost) or with a remote backend.

- **Frontend**: Add `VITE_BACKEND_URL` (e.g. `http://localhost:3000`). Use it in `RealtimeBridge.tsx` for `realtimeUrl` and for the iframe `origin` check.
- **Build**: Set `VITE_BACKEND_URL=http://localhost:3000` when building for Pi.

### 1.2 Optional: Single-server deployment

To avoid running two processes (frontend static server + Next.js), you can serve the built frontend from the Next.js app:

- Build the frontend: `cd frontend && npm run build` → `frontend/dist/`.
- Copy `frontend/dist/*` into `backend/public/robot/` (or similar).
- Add a route or redirect in Next.js so that `http://localhost:3000/robot` (or `/`) serves that static app.
- The React app’s iframe would then point to the same origin (e.g. `http://localhost:3000`), so one URL, one Node process.

### 1.3 Build commands for Pi

- **Backend**: `cd backend && npm ci && npm run build` (same as today).
- **Frontend**: `cd frontend && npm ci && VITE_BACKEND_URL=http://localhost:3000 npm run build`.
- If using single-server: copy `frontend/dist` → `backend/public/robot` and configure Next.js to serve it.

---

## Phase 2: Raspberry Pi Setup

### 2.1 Hardware recommendations

- **Raspberry Pi 4 (4 GB RAM)** or **Pi 5** for comfortable Node + Chromium + voice.
- **Raspberry Pi OS 64-bit** (Bullseye/Bookworm) for better Node.js and Chromium support.
- HDMI display, USB microphone, USB speaker (as you specified).

### 2.2 OS and dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Node.js 18+ (use NodeSource or install from Raspberry Pi OS repo)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Chromium for kiosk
sudo apt install -y chromium-browser unclutter

# Audio (usually already present)
sudo apt install -y pulseaudio pulseaudio-utils
```

### 2.3 Audio: USB microphone and USB speaker

- **List devices**: `arecord -l` (capture), `aplay -l` (playback).
- Set defaults so the browser uses the right devices. Options:
  - **PulseAudio**: create or edit `~/.config/pulse/default.pa` or use `pavucontrol` to set default sink/source.
  - **ALSA**: e.g. `~/.asoundrc` with `pcm.!default` and `ctl.!default` pointing to the USB card.
- Reboot or restart PulseAudio after changes. Test with:
  - `arecord -d 3 test.wav && aplay test.wav`
  - In Chromium, check site permissions and ensure the correct mic is selected (and that the app requests microphone access).

### 2.4 Display

- Connect HDMI LCD; set resolution in `raspi-config` or via `config.txt`/desktop settings.
- Disable screen blanking for kiosk (e.g. in autostart or in the kiosk script):
  - `xset s off && xset -dpms && xset s noblank`

---

## Phase 3: Running the App

### 3.1 Backend

```bash
cd /path/to/DesktopRobot/backend
npm ci
npm run build
# Optional: set NODE_OPTIONS=--max-old-space-size=2048 if you hit OOM
npm start
```

Runs on `http://localhost:3000` (or `0.0.0.0:3000` if you need access from other devices).

### 3.2 Frontend (two options)

**Option A – Separate static server (simplest to try first)**

```bash
cd /path/to/DesktopRobot/frontend
npm ci
VITE_BACKEND_URL=http://localhost:3000 npm run build
npx serve -s dist -l 8080
```

Then open in Chromium: `http://localhost:8080` (or `http://localhost:3000/robot` if you implemented single-server).

**Option B – Served by Next.js (single process)**

- After building the frontend, copy `frontend/dist` into `backend/public/robot`.
- Configure Next.js to serve `public/robot` at `/robot` (or `/`).
- Open `http://localhost:3000/robot`.

### 3.3 Chromium kiosk mode

Run Chromium fullscreen, no toolbar, single URL (adjust URL if you use Option B):

```bash
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --start-fullscreen \
  --disable-session-crashed-bubble \
  --autoplay-policy=no-user-gesture-required \
  http://localhost:8080
```

If the app is at `http://localhost:3000/robot`, use that URL instead. Use `--use-fake-ui-for-media-stream` only for testing (auto-grants mic); in production, grant the mic once in Chromium settings or via a startup script that handles permissions.

---

## Phase 4: Auto-start on Boot

### 4.1 systemd service for the backend

Create `/etc/systemd/system/desktop-robot-backend.service`:

```ini
[Unit]
Description=Desktop Robot Next.js Backend
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/DesktopRobot/backend
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable desktop-robot-backend
sudo systemctl start desktop-robot-backend
```

### 4.2 Kiosk (X + Chromium) on boot

- Enable auto-login to desktop (Raspberry Pi OS: “Desktop Autologin”).
- Add a script that:
  1. Waits for backend to be up (e.g. `curl -s -o /dev/null http://localhost:3000/api/health` in a loop).
  2. Disables screen blanking (`xset` as above).
  3. Launches Chromium in kiosk mode to the app URL.
- Run this script from the desktop session’s autostart (e.g. `~/.config/autostart/desktop-robot-kiosk.desktop` or a startup script in the session).

Example `~/.config/autostart/desktop-robot-kiosk.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=Desktop Robot Kiosk
Exec=/home/pi/DesktopRobot/scripts/start-kiosk.sh
```

Example `scripts/start-kiosk.sh` (create and make executable):

```bash
#!/bin/bash
# Wait for backend
until curl -s -o /dev/null http://localhost:3000/api/health; do sleep 2; done
# Disable screen blanking
xset s off && xset -dpms && xset s noblank
# Hide cursor (optional)
unclutter -idle 0.5 -root &
# Launch kiosk (use your actual app URL)
chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run \
  --start-fullscreen --autoplay-policy=no-user-gesture-required \
  http://localhost:8080
```

If you use single-server, replace `http://localhost:8080` with `http://localhost:3000/robot`.

---

## Phase 5: Optional Improvements

- **Tauri on Pi (advanced)**: If you later want a native binary, consider Tauri 2 and building for `linux-arm64-gnu` (or `linux-armv7-gnu` for 32-bit). This requires a working ARM toolchain and WebKitGTK or similar; more work than the kiosk approach.
- **Remote backend**: If the backend runs on another machine, set `VITE_BACKEND_URL` to that URL when building the frontend and ensure CORS and iframe/`postMessage` origin checks allow it.
- **Reverse proxy**: Optionally put nginx in front of the backend (and static frontend) for a single port and future HTTPS.
- **Monitoring**: Use `journalctl -u desktop-robot-backend -f` to watch backend logs.

---

## Checklist Summary

| Step | Action |
|------|--------|
| 1 | Add `VITE_BACKEND_URL` to frontend and use it in `RealtimeBridge.tsx` |
| 2 | Build frontend with `VITE_BACKEND_URL=http://localhost:3000` |
| 3 | (Optional) Serve frontend from Next.js for single-process deployment |
| 4 | Install Raspberry Pi OS 64-bit, Node 18+, Chromium, PulseAudio |
| 5 | Configure USB mic and USB speaker as default ALSA/Pulse devices |
| 6 | Set up backend systemd service and start on boot |
| 7 | Create kiosk autostart script (wait for backend, then launch Chromium) |
| 8 | Disable screen blanking and set HDMI resolution as needed |

Once these are in place, the same codebase will run on your development machine (Tauri or browser) and on the Pi (browser kiosk) with HDMI, USB mic, and USB speaker.
