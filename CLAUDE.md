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
    MockClient.ts        # No-op client for web / offline dev
    DMXService.ts        # Universe state manager, maps fixtures → channels
    index.ts             # Factory: picks right client per platform

  effects/
    presets.ts           # Effect definitions (strobe, heartbeat, ramps, etc.)
    runner.ts            # Frame-based (20fps) effects engine — drives DMXService

  store/
    lightsStore.ts       # Fixture list: name, DMX address, channel mode, position
    ambiancesStore.ts    # Scenes ("ambiances"): per-light color/intensity + effects
    settingsStore.ts     # Network config: IP, port, universe, master intensity
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

**To swap the protocol** (e.g. Art-Net → sACN, or HTTP): implement `IDMXClient` in a new file, update `src/dmx/index.ts` factory. Nothing else changes. Two implementations exist today: `ArtNetClient` (native, real UDP) and `WebSocketDMXClient` (web — relays to the desktop visualizer's Python server since browsers can't do raw UDP).

**Art-Net specifics:**
- UDP port `6454` (standard Art-Net port)
- Eurolite FreeDMX AP default IP: `2.0.0.1` (its own AP DHCP)
- Sequence byte increments 1–255 per packet so receivers can discard out-of-order UDP
- A 1s keep-alive resends the last frame verbatim even when nothing changes, so a receiver's signal-loss timeout never trips during a static scene
- **Network discovery**: `ArtNetClient.discoverNodes()` broadcasts an ArtPoll and reports each ArtPollReply — surfaced in Settings → Connection as "Scan Network". Not available on web (`DMXService.supportsDiscovery()` gates the UI)
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
| `settingsStore` | Receiver IP/port, universe, master intensity | Yes |
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
- **Connection tab**: receiver IP, UDP port, Art-Net universe, test-connection blink, network discovery (ArtPoll scan)
- **Lights tab**: virtual stage preview, add/remove/configure fixtures (address, channel mode, rotation, beam width, default color, max intensity), **Bulk Setup** (apply one channel mode to every fixture at once; auto-renumber DMX addresses in list order, stepping each fixture by its own channel count), stage zones
- **Backup tab**: export/import ambiances (JSON or Myriad SLS), factory reset

---

## Debugging a Failed Show / Connection

When a light doesn't respond, work through this list roughly top to bottom — later steps assume earlier ones are already ruled out.

1. **Check the connection status dot** (small colored dot + label shown near the top of Panel 1/2 once a packet has been sent). Green = UDP sends are succeeding at the OS level; red = the send itself is failing (usually wrong/unreachable IP, or the phone isn't on the fixture's network at all).
2. **Settings → Connection → Test Connection (Blink)** sends two on/off blinks to every configured fixture. If nothing blinks but the app reports success, the UDP packet left the phone fine — the problem is downstream (wrong IP/address/mode on the receiver side, not the app).
3. **Settings → Connection → Scan Network** broadcasts an ArtPoll and lists every Art-Net node that answers. If your receiver doesn't show up here, the phone and the FreeDMX AP are not on the same WiFi network — fix that before touching anything else. (Not available on Web; native app only.)
4. **Wrong network is the #1 real-world cause of "nothing happens."** The Eurolite FreeDMX AP creates its own WiFi access point (default IP `2.0.0.1`, sometimes shown in-app as the "Show" preset `192.168.4.1` depending on firmware/config). Your phone must join *that* WiFi network, not your home/venue WiFi — Art-Net UDP packets don't route across networks or through most routers' AP isolation.
5. **DMX start address mismatch.** The address configured in this app for a fixture (Panel 3 → Lights → pencil icon) must exactly match the address set on the physical fixture's own display/menu. On a Cameo ROOT PAR, that's `MODE → DMX Address → 001–512` on the fixture's OLED menu (hold `UP`/`DOWN` to change the value fast). If addresses don't match, that fixture will read someone else's channel data — it may still light up, just with the wrong colors, or not at all.
6. **Channel mode mismatch.** The channel mode picked in this app (e.g. `RGBWA+UV (6ch)`, `Dim16 + RGBWA+UV (11ch)`) must match the DMX mode set on the fixture (`MODE → DMX Mode` on a Cameo ROOT PAR). If the app sends 6 channels' worth of data but the fixture is set to an 11-channel mode, everything after channel 6 is unfed and the color/dimmer mapping will be off. See `src/constants/channelModes.ts` for the exact channel layout the app sends per mode, and use **Bulk Setup** (Panel 3 → Lights) to push one mode to every fixture at once if the whole rig is the same model.
7. **Overlapping addresses.** The Lights tab list flags fixtures whose channel ranges overlap (⚠ overlaps another fixture) — two fixtures fighting over the same channels will both misbehave. Use **Bulk Setup → Renumber DMX addresses** to auto-space every fixture by its own channel count instead of computing offsets by hand.
8. **Fixture is in Stand-Alone mode, not DMX mode.** If a Cameo ROOT PAR was last used for Auto/Sound/Static/Loop/Master-Slave mode, its front panel shows `Mode Auto` / `Mode Static` / etc. instead of `DMX Address`. It ignores incoming DMX in that state — go into the fixture's menu and select **DMX Mode** explicitly.
9. **Master intensity or per-light max intensity is at (or near) 0%.** Both are hard multipliers applied in `DMXService` on top of the scene's own brightness — check the Panel 1 master slider and each fixture's "Max Intensity" cap (Panel 3 → Lights → pencil icon) if a light seems permanently dim or off regardless of scene.
10. **Blackout is active, or no ambiance is selected.** Panel 1's Blackout button forces every channel to 0 regardless of scene; the Lights-tab virtual stage shows "Showing default colors" when no ambiance is active (default colors are just a preview — no DMX is sent until you activate an ambiance or start Test Mode).
11. **Universe mismatch.** Art-Net universe defaults to `0` on both the app and most receivers; if either side was changed, they won't hear each other. Settings → Connection → Art-Net Universe.
12. **On Web**, no DMX is ever sent (`MockClient` / `WebSocketDMXClient` relay through the desktop visualizer instead) — this is expected; test real fixture output from the Android/iOS dev build only (`npx expo run:android`, not Expo Go — see Getting Started below).

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
