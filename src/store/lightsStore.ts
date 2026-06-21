import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ChannelMode } from '../constants/channelModes'

export interface Light {
  id: string
  name: string
  dmxAddress: number
  channelMode: ChannelMode
}

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

const DEFAULT_LIGHTS: Light[] = [
  { id: 'light-1', name: 'Light 1', dmxAddress: 1, channelMode: 'RGB' },
]

interface LightsState {
  lights: Light[]
  addLight: (name: string, dmxAddress: number, channelMode: ChannelMode) => string
  updateLight: (id: string, patch: Partial<Omit<Light, 'id'>>) => void
  removeLight: (id: string) => void
  moveLight: (fromIndex: number, toIndex: number) => void
}

export const useLightsStore = create<LightsState>()(
  persist(
    (set) => ({
      lights: DEFAULT_LIGHTS,

      addLight: (name, dmxAddress, channelMode) => {
        const id = `light-${makeId()}`
        set((s) => ({ lights: [...s.lights, { id, name, dmxAddress, channelMode }] }))
        return id
      },

      updateLight: (id, patch) =>
        set((s) => ({
          lights: s.lights.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),

      removeLight: (id) =>
        set((s) => ({ lights: s.lights.filter((l) => l.id !== id) })),

      moveLight: (fromIndex, toIndex) =>
        set((s) => {
          const arr = [...s.lights]
          const [item] = arr.splice(fromIndex, 1)
          arr.splice(toIndex, 0, item)
          return { lights: arr }
        }),
    }),
    {
      name: 'dmx-lights',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
