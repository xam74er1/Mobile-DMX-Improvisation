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

  store/
    fixturesStore.ts     # Fixture list: name, DMX address, channel mode
    sceneStore.ts        # Live state: current color+intensity per fixture
    settingsStore.ts     # Network config: IP, port, universe
    profilesStore.ts     # Categories/folders for Panel 1

  components/
    BlackoutButton.tsx   # Big on/off at top of Panel 1
    LightCard.tsx        # Colored fixture card in Panel 1
    CategoryFolder.tsx   # Collapsible group of LightCards
    SimpleColorPicker.tsx  # Color swatches (R/G/B/W + custom)
    WheelColorPicker.tsx   # Chromatic HSV wheel
    IntensitySlider.tsx  # 0–100% brightness slider
    FixtureChannelEditor.tsx  # Channel mode + address editor (Panel 3)

  constants/
    defaultColors.ts     # Preset colors: Red, Green, Blue, White, etc.
    channelModes.ts      # Supported DMX channel mode definitions
```

---

## DMX Protocol Layer

The `src/dmx/` folder is intentionally **self-contained**. The rest of the app only touches `DMXService` — never the client directly.

```typescript
// types.ts — the contract
interface IDMXClient {
  connect(host: string, port: number): Promise<void>
  sendUniverse(universe: number, channels: Uint8Array): Promise<void>
  disconnect(): void
  readonly isConnected: boolean
}
```

**To swap the protocol** (e.g. Art-Net → sACN, or HTTP): implement `IDMXClient` in a new file, update `src/dmx/index.ts` factory. Nothing else changes.

**Art-Net specifics:**
- UDP port `6454` (standard Art-Net port)
- Eurolite FreeDMX AP default IP: `2.0.0.1` (its own AP DHCP)
- OpOutput packet: 12-byte header + 512 DMX channel values
- Universe 0 by default

---

## Channel Modes

Each fixture declares its DMX channel layout:

| Mode | Channels | Description |
|------|----------|-------------|
| `RGB` | 3 | R, G, B |
| `RGBW` | 4 | R, G, B, W |
| `DIM_RGB` | 4 | Dimmer, R, G, B |
| `DIM_RGBW` | 5 | Dimmer, R, G, B, W |

Each fixture also has a **DMX start address** (1–512). `DMXService` writes the correct bytes at the right offset.

---

## State Management

All state is **Zustand** stores with **AsyncStorage** persistence:

| Store | Contents | Persisted |
|-------|----------|-----------|
| `fixturesStore` | Fixture configs | Yes |
| `sceneStore` | Current colors/intensity | Optional |
| `settingsStore` | IP, port, universe | Yes |
| `profilesStore` | Categories + order | Yes |

---

## Three Panels

### Panel 1 — Control (show mode)
- Full-width **Blackout** button at top (one tap → all lights off)
- Grid of fixture cards grouped by category
- Tap card: toggle fixture on/off + send DMX
- Long-press card: jump to Panel 2 for that fixture
- FAB (+): add fixture or category

### Panel 2 — Light Editor
- "All lights" toggle (edit all simultaneously)
- Per-fixture: simple color swatches, chromatic wheel, intensity slider
- Copy/paste color between fixtures
- All changes send DMX live

### Panel 3 — Settings
- Fixture list: add/remove/rename, set DMX address + channel mode
- Network config: receiver IP, UDP port, Art-Net universe
- "Test connection" button (sends a blink sequence)

---

## Key Libraries

| Package | Purpose |
|---------|---------|
| `expo` ~51 | Core SDK |
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
