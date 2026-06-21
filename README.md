# Mobile DMX Improvisator

A mobile app for controlling DMX lights in real time via the **Eurolite FreeDMX AP WiFi interface** (Art-Net over UDP).

Works on **Android** (full DMX control), **iOS** (full DMX control), and **Web** (UI preview only — no UDP).

---

## Prerequisites

| Tool | Minimum Version | Download |
|------|----------------|---------|
| Node.js | **18.13+** | https://nodejs.org (LTS installer) |
| npm | 9+ | Included with Node |
| Android Studio | Any recent | https://developer.android.com/studio (for Android builds) |

> **Important:** Node 16 is not supported. Install Node 20 LTS or higher before continuing.

---

## Install

```bash
npm install
```

This installs all dependencies including `react-native-udp` (for Art-Net), `react-native-paper` (UI), and Zustand (state).

---

## Run — Web (UI preview, no DMX)

```bash
# Option A: use the batch script (Windows)
start-web.bat

# Option B: command line
npx expo start --web
```

Opens in your browser at `http://localhost:8081`. The UI is fully functional but DMX packets are logged to the browser console instead of being sent over UDP.

---

## Run — Android (full DMX control)

> Requires a connected Android device (USB debugging on) **or** an Android emulator.

```bash
# Option A: use the batch script (Windows)
start-android.bat

# Option B: command line
npx expo run:android
```

This builds a **development APK** with native modules (including the UDP socket for Art-Net) and installs it on your device. The first build takes a few minutes; subsequent launches are faster via the dev server.

> **Why not Expo Go?** The `react-native-udp` native module is not bundled in Expo Go. You must use `npx expo run:android` (development build) to get real DMX output.

---

## Connect to Eurolite FreeDMX AP

1. On your phone, connect to the Eurolite AP's WiFi network (it creates its own hotspot)
2. Open the app → **Settings** tab
3. Set **Receiver IP** to `2.0.0.1` (Eurolite default)
4. Leave **Port** at `6454` and **Universe** at `0`
5. Tap **Test Connection (Blink)** — your lights should flash twice

---

## App Guide

### Panel 1 — Control (show mode)

- **Blackout button** (top) — one tap kills all lights; tap again to restore. Fast and reliable for stage.
- **Light cards** — each card shows the fixture's current color. Tap to toggle on/off.
- **Long-press a card** — jumps to the Editor with that fixture pre-selected.
- **+ button** (bottom right) — add a new fixture or a new category/folder.

All state (colors, intensities, which lights are on) is **saved automatically** and restored on next launch.

### Panel 2 — Editor

- **All Lights toggle** — when enabled, every change applies to all fixtures at once (great for quick color washes).
- **Fixture chips** — tap to switch between fixtures.
- **Quick Colors** — 8 preset swatches (Red, Green, Blue, White, Warm, Pink, Cyan, Purple).
- **Color Wheel** — full HSV chromatic picker for any color.
- **White Channel** — separate slider for the W channel on RGBW fixtures.
- **Intensity** — global brightness 0–100% (multiplied into all channels before sending).
- **Copy / Paste Color** — copy a fixture's color and paste it onto another.

Changes are sent to the lights **live** as you drag sliders or tap swatches.

### Panel 3 — Settings

**Fixtures section**
- Edit name, DMX start address (1–512), and channel mode per fixture.
- Channel modes: `RGB (3ch)`, `RGBW (4ch)`, `Dim+RGB (4ch)`, `Dim+RGBW (5ch)`.
- Add or remove fixtures. The DMX address auto-increments when adding.

**Network section**
- Receiver IP, UDP Port, Art-Net Universe.
- **Test Connection** sends a blink sequence to verify the link.

---

## What Is Saved (Persistence)

| Data | Saved? |
|------|--------|
| Fixture names, addresses, modes | ✅ Yes |
| Categories / folders | ✅ Yes |
| Light colors & intensities | ✅ Yes |
| Which lights are on/off | ✅ Yes |
| Blackout state | ✅ Yes |
| Network settings (IP/port) | ✅ Yes |

Storage uses `AsyncStorage` (native) / `localStorage` (web).

---

## Architecture

```
src/dmx/          ← ISOLATED protocol layer (swap Art-Net → sACN here only)
  types.ts        ← IDMXClient interface
  ArtNetClient.ts ← UDP implementation
  MockClient.ts   ← Web/test no-op
  DMXService.ts   ← 512-channel universe manager

src/store/        ← Zustand + AsyncStorage
src/components/   ← Reusable UI
app/(tabs)/       ← 3 tab screens
```

To swap the DMX protocol: implement `IDMXClient` in a new file, update `src/dmx/index.ts`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Lights don't respond | Check phone is on Eurolite WiFi, IP is 2.0.0.1, test connection blinks |
| Build fails | Ensure Node 18+: `node --version` |
| `react-native-udp` error on web | Expected — UDP is disabled on web (use Android build) |
| First build is slow | Normal — Gradle downloads on first run |
