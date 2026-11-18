# Mobile DMX Improvisator

🇫🇷 [Version française](README.fr.md)

A mobile app for controlling DMX lights in real time via the **Eurolite FreeDMX AP WiFi interface** (Art-Net over UDP).

Works on **Android** (full DMX control), **iOS** (full DMX control), and **Web** (UI preview only — no UDP).

---

## What is it?

**DMX Improvisator** turns your phone into a lighting console. Join the WiFi network of a Eurolite FreeDMX AP box, and you can control your DMX fixtures (LED pars, etc.) live: tap a scene ("ambiance") to light the room, fade in/out, trigger a strobe, or tweak colors on the fly. It is built for live shows — simple enough for a non-technical operator, flexible enough to configure every fixture.

*(Français : l'app transforme votre téléphone en console lumière, via le boîtier WiFi Eurolite FreeDMX AP. Touchez une ambiance pour l'activer, réglez les couleurs en direct, lancez un stroboscope…)*

### Screenshots

| Control (show mode) | Light editor | Settings |
|---|---|---|
| ![Control panel](docs/screenshots/control.png) | ![Editor](docs/screenshots/editor.png) | ![Settings](docs/screenshots/settings.png) |

### How to use it (quick version)

1. Connect the phone to the `freeDMX_AP_xxxxxx` WiFi network.
2. **Settings → Lights → Add**: create each fixture (name, DMX address, channel mode). The address and mode must match what is set on the fixture itself.
3. **Settings → Connection → Test Connection (Blink)**: your lights should flash twice.
4. **Editor**: pick an ambiance, pick a light (or *All Lights*), choose colors / intensity / effects.
5. **Control**: tap an ambiance card to play it. **Blackout** kills everything in one tap. The **Master** slider caps overall brightness.

The screen stays awake while the app is open, so the phone won't lock mid-show.

---

## Download & install the Android app (APK)

No developer tools needed:

1. On your Android phone, open the **[latest release](https://github.com/xam74er1/Mobile-DMX-Improvisation/releases/latest)** on GitHub.
2. Under **Assets**, download the `.apk` file.
3. Open the downloaded file. If Android blocks it, allow **"Install unknown apps"** for your browser / file manager when prompted (Settings → Apps → Special access → Install unknown apps).
4. Tap **Install**, then open **DMX Improvisator**.
5. Connect to the FreeDMX AP WiFi and follow the quick start above. If Android says the WiFi has no internet, choose to **stay connected**.

Useful tutorials:
- [Install apps from outside the Play Store (Android Help)](https://support.google.com/android/answer/12123624)
- [How to sideload an APK on Android (Android Authority)](https://www.androidauthority.com/how-to-install-apks-31494/)
- [Eurolite FreeDMX AP product page](https://www.steinigke.de/en/mpn51860200-eurolite-freedmx-ap-wireless-dmx-interface.html)
- [Art-Net protocol overview](https://en.wikipedia.org/wiki/Art-Net)

> iOS has no APK equivalent: build it yourself with `npx expo run:ios` (see below).

---

## Prerequisites (building from source)

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

1. On your phone, connect to the Eurolite AP's WiFi network — it creates its own unencrypted hotspot named `freeDMX_AP_xxxxxx`
2. Open the app → **Settings** tab — the defaults (`192.168.4.1`, Transport `UDP (Art-Net)`, port `6454`) already match a factory-fresh unit, so this should just work
3. If it doesn't, try Transport `FreeDMX Native` instead (port defaults to `10100`, the device's factory proprietary protocol — some units only implement this, not Art-Net). If that unit's **General → UDP-Port** was ever changed from the factory `10100` on the device's own web config at `http://192.168.4.1`, Settings → Connection → Port needs to match it exactly when using FreeDMX Native (Art-Net's port `6454` is fixed and never needs matching)
4. Leave **Universe** at `0`
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
| Lights don't respond | Check phone is on Eurolite WiFi, IP is 192.168.4.1. With Transport `UDP (Art-Net)`, port must be `6454` (fixed — not the device's UDP-Port setting). With `FreeDMX Native`, port must match the device's own General → UDP-Port setting (factory default `10100`). Try switching transport if one doesn't work. Then test connection blinks |
| Build fails | Ensure Node 18+: `node --version` |
| `react-native-udp` error on web | Expected — UDP is disabled on web (use Android build) |
| First build is slow | Normal — Gradle downloads on first run |
