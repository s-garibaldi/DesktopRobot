# Desktop Robot - Frontend

Tauri desktop application frontend with animated robot face and emotion controls.

## Structure

- `src/` - React components and application code
- `src-tauri/` - Rust backend for Tauri (file I/O, system integration)
- `package.json` - Frontend dependencies

## Running

```bash
npm install
npm run tauri dev
```

## Building

```bash
npm run tauri build
```

## Microphone access (macOS)

The app needs microphone entitlements so macOS allows `getUserMedia`. These are set in `src-tauri/Entitlements.plist`.

### Mic access when running dev (`npm run tauri dev`)

A Cargo runner signs the dev binary with the mic entitlements before it runs, so dev mode can get mic access:

1. **Try normal dev first** (the runner is used when the binary is run):
   ```bash
   npm run tauri dev
   ```
   If the app prompts for microphone and the mic works, you’re done.

2. **If mic still doesn’t work in dev**, use the script that runs the app via `cargo run` (so the runner always runs):
   ```bash
   npm install   # installs concurrently if needed
   npm run dev:with-mic
   ```
   This starts the Vite dev server and the Tauri app; the app binary is code-signed with the mic entitlements before each run.

### Mic access when running the built app

1. **Rebuild and run the built app** so entitlements apply:
   ```bash
   npm run tauri build
   ```
   Then open the app from `src-tauri/target/release/bundle/macos/` (e.g. `Desktop Robot.app`). The first time you tap "Enable Microphone", macOS should show the permission prompt.

2. **If the app doesn’t appear in System Settings → Privacy & Security → Microphone**, run the **built** `.app` (not `tauri dev`) at least once and click "Enable Microphone" so the system can show the prompt and add the app to the list.

3. **If you previously denied access** and want to reset:
   ```bash
   tccutil reset Microphone com.desktoprobot.app
   ```
   Then run the app again and enable the microphone when prompted.
