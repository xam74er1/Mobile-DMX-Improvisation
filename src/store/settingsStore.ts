import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface SettingsState {
  receiverIp: string
  receiverPort: number
  universe: number
  setReceiverIp: (ip: string) => void
  setReceiverPort: (port: number) => void
  setUniverse: (universe: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      receiverIp: '127.0.0.1', // Default to localhost for testing with the visualizer
      receiverPort: 6454,
      universe: 0,

      setReceiverIp: (ip) => set({ receiverIp: ip }),
      setReceiverPort: (port) => set({ receiverPort: port }),
      setUniverse: (universe) => set({ universe }),
    }),
    {
      name: 'dmx-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
