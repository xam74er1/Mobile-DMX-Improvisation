import { Platform } from 'react-native'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Native talks straight to the Eurolite FreeDMX AP by default, whose
// factory address is 192.168.4.1 on UDP port 10100 (per its own manual —
// NOT the Art-Net-standard 6454; that's a common source of "nothing
// responds" even with everything else configured correctly, see
// CLAUDE.md). Web can't open a raw UDP socket at all, so it defaults to
// WebSocket against the desktop visualizer bridge instead (see
// dmx-visualizer/server/server.py). Either platform can switch to WS/HTTP
// (e.g. testing against the bridge instead of real hardware); only native
// can pick UDP, since that's the one transport a browser can't do.
export type Transport = 'udp' | 'ws' | 'http'
const DEFAULT_TRANSPORT: Transport = Platform.OS === 'web' ? 'ws' : 'udp'
export const TRANSPORT_DEFAULT_PORT: Record<Transport, number> = { udp: 10100, ws: 8080, http: 8081 }
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
  setReceiverIp: (ip: string) => void
  setReceiverPort: (port: number) => void
  setUniverse: (universe: number) => void
  setMasterIntensity: (v: number) => void
  setFadeDurationMs: (ms: number) => void
  setLanguage: (lang: AppLanguage) => void
  setTransport: (t: Transport) => void
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

      setReceiverIp: (ip) => set({ receiverIp: ip }),
      setReceiverPort: (port) => set({ receiverPort: port }),
      setUniverse: (universe) => set({ universe }),
      setMasterIntensity: (v) => set({ masterIntensity: Math.min(100, Math.max(0, Math.round(v))) }),
      setFadeDurationMs: (ms) => set({ fadeDurationMs: Math.min(10000, Math.max(500, Math.round(ms))) }),
      setLanguage: (lang) => set({ language: lang }),
      setTransport: (t) => set({ transport: t }),
    }),
    {
      name: 'dmx-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
