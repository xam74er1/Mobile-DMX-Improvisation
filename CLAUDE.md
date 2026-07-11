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
- **Connection tab**: receiver IP, UDP port, Art-Net universe, test-connection blink
- **Lights tab**: virtual stage preview, add/remove/configure fixtures (address, channel mode, rotation, beam width, default color, max intensity), stage zones
- **Backup tab**: export/import ambiances (JSON or Myriad SLS), factory reset

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
