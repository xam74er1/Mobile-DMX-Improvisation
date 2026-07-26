# Mobile DMX Improvisator — Project Guide

## What This Is

A React Native / Expo app for controlling DMX lights via the **Eurolite FreeDMX AP WiFi interface** (Art-Net protocol over UDP). Designed for live shows: simple enough for non-technical operators, flexible enough for per-fixture configuration.

Targets: **Android** (primary), iOS (secondary), Web (UI only — no DMX send).

---

## Architecture Overview

```
app/                     # expo-router screens (3 bottom tabs)
  _layout.tsx            # root providers
  (tabs)/
    _layout.tsx          # tab bar config
    index.tsx            # Panel 1: Control (main show screen)
    editor.tsx           # Panel 2: Light editor (color/intensity)
    settings.tsx         # Panel 3: Settings + fixture config

src/
  dmx/                   # *** ISOLATED DMX LAYER — change protocol here only ***
    types.ts             # IDMXClient interface + shared types
    ArtNetClient.ts      # Art-Net UDP implementation (Android/iOS)
    WebDMXClient.ts      # Web: WS or HTTP relay to the desktop visualizer (settingsStore.webTransport)
    DMXService.ts        # Universe state manager, maps fixtures → channels
    index.ts             # Factory: picks right client per platform

  effects/
    presets.ts           # Effect definitions (strobe, heartbeat, ramps, etc.)
    runner.ts            # Frame-based (20fps) effects engine — drives DMXService

  store/
    lightsStore.ts       # Fixture list: name, DMX address, channel mode, position
    ambiancesStore.ts    # Scenes ("ambiances"): per-light color/intensity + effects
    settingsStore.ts     # Network config: IP, port, universe, master intensity, web transport (WS/HTTP)
    zonesStore.ts        # Named stage zones for the virtual scene view

  components/
    BlackoutButton.tsx   # Big on/off at top of Panel 1
    AmbianceCard.tsx      # Scene card in Panel 1
    EffectsBar.tsx        # Global one-tap effects (strobe, police, etc.)
    SimpleColorPicker.tsx # Color swatches (R/G/B/W + custom)
    WheelColorPicker.tsx  # Chromatic HSV wheel
    IntensitySlider.tsx  # 0–100% brightness slider
    SceneStage.tsx        # Virtual stage preview (Panel 3)

  constants/
    defaultColors.ts     # Preset colors: Red, Green, Blue, White, etc.
    channelModes.ts      # Supported DMX channel mode definitions + channel counts
```

---

## DMX Protocol Layer

The `src/dmx/` folder is intentionally **self-contained**. The rest of the app only touches `DMXService` — never the client directly.

```typescript
// types.ts — the contract
interface IDMXClient {
  sendUniverse(host: string, port: number, universe: number, channels: Uint8Array): Promise<void>
  dispose(): void
  // Optional — only implemented by transports that speak real Art-Net UDP (native)
  discoverNodes?(durationMs: number, onNode: (node: DiscoveredArtNetNode) => void): Promise<void>
}
```

**To swap the protocol** (e.g. Art-Net → sACN, or HTTP): implement `IDMXClient` in a new file, update `src/dmx/index.ts` factory. Nothing else changes. Two implementations exist today: `ArtNetClient` (native, real Art-Net UDP) and `WebDMXClient` (web — browsers can't send raw UDP, so it relays to the desktop visualizer's Python server instead, over either WebSocket or HTTP per `settingsStore.webTransport`; both `host` and `port` always come from Settings, never hardcoded — see `dmx-visualizer/server/server.py`'s `ws_server` on `8080` and `serve_http_dmx()` on `8081` for the bridge's own default ports, which must match whatever the app is configured to hit).

**Art-Net specifics:**
- UDP port `6454` is the Art-Net *standard*, but **this app's native default is `10100`** — see below.
- Eurolite FreeDMX AP default IP: `192.168.4.1` (its own AP DHCP — confirmed in the device's own manual; do not use `2.0.0.1`, that was a documentation error in earlier versions of this file)
- **Eurolite FreeDMX AP default UDP port is `10100`, not the Art-Net-standard `6454`** — set on the device itself (its web config at `http://192.168.4.1` → **General** tab → **UDP-Port**). `settingsStore`'s native default (`src/store/settingsStore.ts`) matches this factory value so a fresh install works with an out-of-the-box unit; if a specific unit's port was changed (or `ArtNetClient`'s local `6454` bind for ArtPoll listening is otherwise in the way), update Settings → Connection → Port to match whatever the device's own **UDP-Port** field actually says. The device's separate **Artnet** config tab (Art-Net short/long name, Net/Subnet/Universe) has no port field of its own — everything listens on the one **System → UDP-Port** value.
- Sequence byte increments 1–255 per packet so receivers can discard out-of-order UDP
- A 1s keep-alive resends the last frame verbatim even when nothing changes, so a receiver's signal-loss timeout never trips during a static scene
- **Network discovery**: `ArtNetClient.discoverNodes()` broadcasts an ArtPoll and reports each ArtPollReply — surfaced in Settings → Connection as "Scan Network". Not available on web (`DMXService.supportsDiscovery()` gates the UI). Many budget Art-Net-over-WiFi adapters (the Eurolite FreeDMX AP included) never implement ArtPollReply at all — if a real receiver never shows up in a scan despite being on the right network, that's normal for this class of hardware, not a bug; use the "Show" quick-preset or type the IP directly instead of relying on discovery.
- OpOutput packet: 12-byte header + 512 DMX channel values
- Universe 0 by default

---

## Channel Modes

Each fixture declares its DMX channel layout (see `src/constants/channelModes.ts` for the full list and exact channel counts — from 3ch `RGB` up to 11ch `DIM16_RGBWAUV`, matching the Cameo ROOT PAR 6).

Each fixture also has a **DMX start address** (1–512) and an optional **max intensity cap** (0–100%, hard brightness ceiling for that fixture). `DMXService` writes the correct bytes at the right offset, scaled by both the fixture's own intensity and the global master intensity from `settingsStore`.

### Cameo ROOT PAR 4 / 6 cheat sheet

The default rig is built around the **Cameo ROOT PAR 6** (6× RGBWA+UV LEDs); the ROOT PAR 4 (7× RGBW) is also supported via the RGBW-only modes. Mapping between this app's channel modes and the fixture's own `MODE → DMX Mode` menu:

| App channel mode | Fixture DMX mode | Bytes sent |
|---|---|---|
| `RGB` (3ch) / `RGBW` (4ch) | ROOT PAR 4: `4CH1` | R,G,B[,W] |
| `RGBWA` (5ch) | — | R,G,B,W,A |
| `RGBWAUV` (6ch) | ROOT PAR 6: `6CH` | R,G,B,W,A,UV |
| `DIM_RGBWAUV` (8ch) | ROOT PAR 6: `8CH` | Dim,Strobe,R,G,B,W,A,UV |
| `DIM16_RGBWAUV` (11ch, **default**) | ROOT PAR 6: `11CH` | Dim(coarse),Dim(fine),Strobe,R,G,B,W,A,UV,Macro,MacroSpeed |

To set these on the physical fixture: `MODE` → `DMX Mode` → select with `UP`/`DOWN` → `ENTER` → `MODE` to return. Set the matching start address via `MODE` → `DMX Address` → `UP`/`DOWN` (hold to fast-scroll) → `ENTER`.

Two fixture-side settings worth knowing when debugging odd behavior between shows:
- **`Settings → Sig Fail`** on the fixture controls what it does when DMX stops arriving (e.g. app closed, phone disconnects mid-show): `Hold` keeps the last frame (default), `Black` blacks out, `User 1` shows a stored preset. If a light "gets stuck" after you stop the app, this is why — it's expected, not a bug.
- If fixtures are also daisy-chained via physical DMX XLR cable (rather than each getting its own Art-Net-to-DMX node), the **last fixture in that chain needs a 120Ω terminator**, and a chain tops out at 32 devices — unrelated to this app's WiFi/Art-Net side, but a common source of "some lights work, the last one doesn't."

---

## State Management

All state is **Zustand** stores with **AsyncStorage** persistence:

| Store | Contents | Persisted |
|-------|----------|-----------|
| `lightsStore` | Fixture configs (address, channel mode, position, max intensity) | Yes |
| `ambiancesStore` | Scenes ("ambiances"): per-light color/intensity + attached effects, blackout flag | Yes |
| `settingsStore` | Receiver IP/port, universe, master intensity, web transport (WS/HTTP) | Yes |
| `zonesStore` | Named stage zones for the virtual scene preview | Yes |

The effects engine (`src/effects/runner.ts`) is a singleton, not a Zustand store — it owns its own 50ms ticker and pushes frames straight to `DMXService`, independent of React render cycles.

---

## Three Panels

### Panel 1 — Control (show mode)
- Full-width **Blackout** button at top (one tap → all lights off)
- Manual **Fade In / Fade Out** buttons (ramp all lights from/to black over a fixed duration)
- **Master intensity** slider — global brightness cap applied on top of every light's own intensity
- Grid of ambiance ("scene") cards grouped by category — tap to activate/deactivate
- Long-press card: rename, duplicate, move, delete, or jump to Panel 2

### Panel 2 — Light Editor
- Pick an ambiance to edit, then a light (or "All Lights")
- Simple color swatches, chromatic wheel or RGBW/A/UV sliders, intensity slider
- Attach effects (strobe, heartbeat, ramps, color transitions, etc.) to the ambiance
- All changes send DMX live when that ambiance is active

### Panel 3 — Settings
- **Connection tab**: receiver IP, port, Art-Net universe, test-connection blink, network discovery (ArtPoll scan), and (Web only) a WS/HTTP transport picker for reaching the desktop visualizer bridge
- **Lights tab**: virtual stage preview, add/remove/configure fixtures (address, channel mode, rotation, beam width, default color, max intensity), **Bulk Setup** (apply one channel mode to every fixture at once; auto-renumber DMX addresses in list order, stepping each fixture by its own channel count), stage zones
- **Backup tab**: export/import ambiances (JSON or Myriad SLS), factory reset

---

## Debugging a Failed Show / Connection

When a light doesn't respond, work through this list roughly top to bottom — later steps assume earlier ones are already ruled out.

1. **Check the connection status dot** (small colored dot + label shown near the top of Panel 1/2 once a packet has been sent). Green = UDP sends are succeeding at the OS level; red = the send itself is failing (usually wrong/unreachable IP, or the phone isn't on the fixture's network at all).
2. **Settings → Connection → Test Connection (Blink)** sends two on/off blinks to every configured fixture. If nothing blinks but the app reports success, the UDP packet left the phone fine — the problem is downstream (wrong IP/address/mode on the receiver side, not the app).
3. **Settings → Connection → Scan Network** broadcasts an ArtPoll and lists every Art-Net node that answers. If your receiver doesn't show up here, the phone and the FreeDMX AP are not on the same WiFi network — fix that before touching anything else. (Not available on Web; native app only.)
4. **Wrong network is the #1 real-world cause of "nothing happens."** The Eurolite FreeDMX AP creates its own unencrypted WiFi access point named `freeDMX_AP_xxxxxx` (per-unit suffix), fixed IP `192.168.4.1` — shown in-app as the "Show" quick preset. Your phone must join *that* WiFi network, not your home/venue WiFi — Art-Net UDP packets don't route across networks or through most routers' AP isolation.
5. **Port mismatch — check this right after network, before anything else on this list.** This app's native default (`10100`) matches the FreeDMX AP's factory setting, but if the unit's own **UDP-Port** (its web config at `http://192.168.4.1` → General) was ever changed — or a secondhand/reset unit reverted to something else — Settings → Connection → Port needs to match it exactly, or DMX never arrives no matter how correct everything else is.
6. **DMX start address mismatch.** The address configured in this app for a fixture (Panel 3 → Lights → pencil icon) must exactly match the address set on the physical fixture's own display/menu. On a Cameo ROOT PAR, that's `MODE → DMX Address → 001–512` on the fixture's OLED menu (hold `UP`/`DOWN` to change the value fast). If addresses don't match, that fixture will read someone else's channel data — it may still light up, just with the wrong colors, or not at all.
7. **Channel mode mismatch.** The channel mode picked in this app (e.g. `RGBWA+UV (6ch)`, `Dim16 + RGBWA+UV (11ch)`) must match the DMX mode set on the fixture (`MODE → DMX Mode` on a Cameo ROOT PAR). If the app sends 6 channels' worth of data but the fixture is set to an 11-channel mode, everything after channel 6 is unfed and the color/dimmer mapping will be off. See `src/constants/channelModes.ts` for the exact channel layout the app sends per mode, and use **Bulk Setup** (Panel 3 → Lights) to push one mode to every fixture at once if the whole rig is the same model.
8. **Overlapping addresses.** The Lights tab list flags fixtures whose channel ranges overlap (⚠ overlaps another fixture) — two fixtures fighting over the same channels will both misbehave. Use **Bulk Setup → Renumber DMX addresses** to auto-space every fixture by its own channel count instead of computing offsets by hand.
9. **Fixture is in Stand-Alone mode, not DMX mode.** If a Cameo ROOT PAR was last used for Auto/Sound/Static/Loop/Master-Slave mode, its front panel shows `Mode Auto` / `Mode Static` / etc. instead of `DMX Address`. It ignores incoming DMX in that state — go into the fixture's menu and select **DMX Mode** explicitly.
10. **Master intensity or per-light max intensity is at (or near) 0%.** Both are hard multipliers applied in `DMXService` on top of the scene's own brightness — check the Panel 1 master slider and each fixture's "Max Intensity" cap (Panel 3 → Lights → pencil icon) if a light seems permanently dim or off regardless of scene.
11. **Blackout is active, or no ambiance is selected.** Panel 1's Blackout button forces every channel to 0 regardless of scene; the Lights-tab virtual stage shows "Showing default colors" when no ambiance is active (default colors are just a preview — no DMX is sent until you activate an ambiance or start Test Mode).
12. **Universe mismatch.** Art-Net universe defaults to `0` on both the app and most receivers; if either side was changed, they won't hear each other. Settings → Connection → Art-Net Universe.
13. **On Web**, no DMX ever reaches real hardware directly (`WebDMXClient` relays through the desktop visualizer's Python bridge instead, over WS or HTTP per Settings → Connection → Web Transport) — this is expected; test real fixture output from the Android/iOS dev build only (`npx expo run:android`, not Expo Go — see Getting Started below).
14. **Android joined a WiFi network with no internet (common for isolated APs like the FreeDMX AP).** Some Android devices keep routing traffic — including this app's UDP sends — over mobile data instead of the joined WiFi if that WiFi reports no internet access, unless you tell Android to use it anyway (Settings → WiFi → tap the network → "Use this network even though it has no internet" or equivalent, and/or turn off mobile data while running the show). This looks identical to "wrong network" (#4) from the app's side but the WiFi is actually correct — worth checking specifically if ArtPoll scans and sends both silently go nowhere despite the phone showing it's joined to the right AP.

---

## Key Libraries

| Package | Purpose |
|---------|---------|
| `expo` ~54 | Core SDK |
| `expo-router` | File-based navigation |
| `expo-dev-client` | Enables native modules (needed for UDP) |
| `react-native-udp` | Raw UDP for Art-Net |
| `zustand` | State management |
| `@react-native-async-storage/async-storage` | Persistence |
| `react-native-paper` | Material UI |
| `react-native-reanimated` | Animations |
| `react-native-gesture-handler` | Gestures |
| `react-native-color-picker` | HSV color wheel |
| `@expo/vector-icons` | Icons (bundled with Expo) |

---

## Getting Started (after upgrading Node to 18+)

```bash
# Install dependencies
npm install

# Web preview (no DMX, UI only)
npx expo start --web

# Android development build (required for UDP/DMX)
npx expo run:android

# iOS
npx expo run:ios
```

> **Important**: Expo Go cannot run `react-native-udp`. You must use `expo run:android` (development build) to test DMX functionality on a real device.

---

## Commit Convention

Prefix: `init:` / `feat:` / `fix:` / `chore:`

Example: `feat: Panel 1 - control screen with blackout + light cards`
