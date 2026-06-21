import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ChannelMode } from '../constants/channelModes'

export interface Light {
  id: string
  name: string
  dmxAddress: number
  channelMode: ChannelMode
  sceneX: number  // 0.0–1.0 fraction of stage width
  sceneY: number  // 0.0–1.0 fraction of stage height
}

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

// Default x positions for up to 6 new lights so they spread nicely
const DEFAULT_POS = [
  [0.5, 0.35],
  [0.25, 0.35], [0.75, 0.35],
  [0.25, 0.65], [0.5, 0.65], [0.75, 0.65],
]

const DEFAULT_LIGHTS: Light[] = [
  { id: 'light-1', name: 'Light 1', dmxAddress: 1, channelMode: 'RGB', sceneX: 0.5, sceneY: 0.35 },
]

interface LightsState {
  lights: Light[]
  addLight: (name: string, dmxAddress: number, channelMode: ChannelMode) => string
  updateLight: (id: string, patch: Partial<Omit<Light, 'id'>>) => void
  updateLightPosition: (id: string, x: number, y: number) => void
  removeLight: (id: string) => void
  moveLight: (fromIndex: number, toIndex: number) => void
}

export const useLightsStore = create<LightsState>()(
  persist(
    (set, get) => ({
      lights: DEFAULT_LIGHTS,

      addLight: (name, dmxAddress, channelMode) => {
        const id = `light-${makeId()}`
        const idx = get().lights.length
        const [sx, sy] = DEFAULT_POS[idx % DEFAULT_POS.length] ?? [0.5, 0.5]
        set((s) => ({
          lights: [...s.lights, { id, name, dmxAddress, channelMode, sceneX: sx, sceneY: sy }],
        }))
        return id
      },

      updateLight: (id, patch) =>
        set((s) => ({
          lights: s.lights.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),

      updateLightPosition: (id, x, y) =>
        set((s) => ({
          lights: s.lights.map((l) =>
            l.id === id ? { ...l, sceneX: x, sceneY: y } : l,
          ),
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
