import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type AppLanguage = 'fr' | 'en'

interface SettingsState {
  receiverIp: string
  receiverPort: number
  universe: number
  masterIntensity: number  // 0–100 global brightness cap applied to all lights
  fadeDurationMs: number   // duration of the Panel 1 manual Fade In / Fade Out buttons
  language: AppLanguage    // app UI language — default French
  setReceiverIp: (ip: string) => void
  setReceiverPort: (port: number) => void
  setUniverse: (universe: number) => void
  setMasterIntensity: (v: number) => void
  setFadeDurationMs: (ms: number) => void
  setLanguage: (lang: AppLanguage) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      receiverIp: '127.0.0.1', // Default to localhost for testing with the visualizer
      receiverPort: 6454,
      universe: 0,
      masterIntensity: 100,
      fadeDurationMs: 3000,
      language: 'fr',

      setReceiverIp: (ip) => set({ receiverIp: ip }),
      setReceiverPort: (port) => set({ receiverPort: port }),
      setUniverse: (universe) => set({ universe }),
      setMasterIntensity: (v) => set({ masterIntensity: Math.min(100, Math.max(0, Math.round(v))) }),
      setFadeDurationMs: (ms) => set({ fadeDurationMs: Math.min(10000, Math.max(500, Math.round(ms))) }),
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'dmx-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
