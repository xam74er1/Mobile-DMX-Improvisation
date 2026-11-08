import { Platform } from 'react-native'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Native talks straight to the Eurolite FreeDMX AP by default. The two UDP
// transports below target two genuinely different ports on the same device
// — they are NOT interchangeable, and this was previously a bug (the 'udp'
// transport defaulted to 10100 and silently never reached the Art-Net
// listener; see git history / CLAUDE.md "Port mismatch" note):
//   - 'udp' (real Art-Net, ArtDMX OpCode 0x5000) MUST target UDP 6454 — the
//     Art-Net-standard port, fixed by spec and not configurable on the
//     device. The device's own web config "Artnet" tab only exposes
//     Name/Net/Subnet/Universe, never a port field, because of this.
//   - 'freedmx' (the device's own original proprietary protocol, see below)
//     targets UDP 10100 — the device's factory "General → UDP-Port" setting,
//     which IS user-changeable on the device and has nothing to do with
//     Art-Net.
// Confirmed against an independent, known-working reference: SmartLightShow
// (Myriad Software's official companion app for this exact device) builds
// byte-identical ArtDMX packets and lets the user type the destination port
// separately from the IP — i.e. it does not hardcode 10100 either.
// Web can't open a raw UDP socket at all, so it defaults to WebSocket
// against the desktop visualizer bridge instead (see
// dmx-visualizer/server/server.py). Either platform can switch to WS/HTTP
// (e.g. testing against the bridge instead of real hardware); only native
// can pick UDP or freedmx, since those are raw-UDP transports a browser
// can't do.
//
// 'freedmx' speaks the Eurolite freeDMX AP's own original proprietary
// protocol — the one its factory Light'J app actually uses — instead of
// Art-Net. Same IP, different port, completely different framing (see
// FreeDMXNativeClient and docs/DMX_PACKET_PROTOCOL.md §11.3). It exists as
// a fallback: some units' firmware never implements the Art-Net side at
// all, only this original protocol.
export type Transport = 'udp' | 'freedmx' | 'ws' | 'http'
const DEFAULT_TRANSPORT: Transport = Platform.OS === 'web' ? 'ws' : 'udp'
export const TRANSPORT_DEFAULT_PORT: Record<Transport, number> = { udp: 6454, freedmx: 10100, ws: 8080, http: 8081 }
const DEFAULT_IP = Platform.OS === 'web' ? '127.0.0.1' : '192.168.4.1'

export type AppLanguage = 'fr' | 'en'

interface SettingsState {
  receiverIp: string
  receiverPort: number
  universe: number
  masterIntensity: number  // 0–100 global brightness cap applied to all lights
  fadeDurationMs: number   // duration of the Panel 1 manual Fade In / Fade Out buttons
  language: AppLanguage    // app UI language — default French
  transport: Transport     // how DMX data actually reaches the receiver/bridge
  // HTTP transport path appended to http://host:port — empty by default so a
  // bare IP:port can be probed directly; the desktop visualizer bridge
  // (dmx-visualizer/server/server.py) requires this be set to "/dmx".
  httpPath: string
  setReceiverIp: (ip: string) => void
  setReceiverPort: (port: number) => void
  setUniverse: (universe: number) => void
  setMasterIntensity: (v: number) => void
  setFadeDurationMs: (ms: number) => void
  setLanguage: (lang: AppLanguage) => void
  setTransport: (t: Transport) => void
  setHttpPath: (path: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      receiverIp: DEFAULT_IP,
      receiverPort: TRANSPORT_DEFAULT_PORT[DEFAULT_TRANSPORT],
      universe: 0,
      masterIntensity: 100,
      fadeDurationMs: 3000,
      language: 'fr',
      transport: DEFAULT_TRANSPORT,
      httpPath: '',

      setReceiverIp: (ip) => set({ receiverIp: ip }),
      setReceiverPort: (port) => set({ receiverPort: port }),
      setUniverse: (universe) => set({ universe }),
      setMasterIntensity: (v) => set({ masterIntensity: Math.min(100, Math.max(0, Math.round(v))) }),
      setFadeDurationMs: (ms) => set({ fadeDurationMs: Math.min(10000, Math.max(500, Math.round(ms))) }),
      setLanguage: (lang) => set({ language: lang }),
      setTransport: (t) => set({ transport: t }),
      setHttpPath: (path) => set({ httpPath: path }),
    }),
    {
      name: 'dmx-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Installs from before the port fix persisted the old broken default
      // (transport: 'udp' i.e. real Art-Net, paired with receiverPort: 10100
      // — the device's *proprietary*-protocol port, not the Art-Net-standard
      // 6454; see TRANSPORT_DEFAULT_PORT comment above). That combination
      // silently sent ArtDMX to a port nothing was listening for it on. On
      // first launch after upgrading, correct exactly that stale combo to
      // the real Art-Net port — anything else the user explicitly configured
      // (a different port, or FreeDMX/WS/HTTP transport) is left untouched.
      migrate: (persistedState, version) => {
        const state = persistedState as SettingsState
        if (version < 1 && state?.transport === 'udp' && state?.receiverPort === 10100) {
          return { ...state, receiverPort: 6454 }
        }
        return state
      },
    },
  ),
)
