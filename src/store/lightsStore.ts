import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ChannelMode } from '../constants/channelModes'

export interface LightColor {
  r: number
  g: number
  b: number
  w: number
  a: number
  uv: number
}

export interface Light {
  id: string
  name: string
  dmxAddress: number
  channelMode: ChannelMode
  sceneX: number      // 0.0–1.0 fraction of stage width  (lens centre)
  sceneY: number      // 0.0–1.0 fraction of stage height (lens centre)
  rotation: number    // degrees — 0 = beam toward stage/floor (↓), 90 = right, 180 = toward audience (top)
  beamWidth: number   // 0.3 (tight spot) → 2.5 (wide wash), default 1.0
  defaultColor: LightColor
}

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

const SPREAD_POS = [
  [0.5,  0.30],
  [0.25, 0.30], [0.75, 0.30],
  [0.17, 0.30], [0.50, 0.30], [0.83, 0.30],
]
const DEFAULT_COLORS_CYCLE: LightColor[] = [
  { r: 255, g: 255, b: 255, w: 0, a: 0, uv: 0 },
  { r: 255, g: 0,   b: 0,   w: 0, a: 0, uv: 0 },
  { r: 0,   g: 68,  b: 255, w: 0, a: 0, uv: 0 },
  { r: 0,   g: 200, b: 0,   w: 0, a: 0, uv: 0 },
  { r: 255, g: 120, b: 0,   w: 0, a: 0, uv: 0 },
  { r: 200, g: 0,   b: 200, w: 0, a: 0, uv: 0 },
]

// 4 fixtures, 11ch mode each (16-bit dim + strobe + RGBWA+UV), 11 channels apart:
// addresses 1, 12, 23, 34 — matches the Cameo ROOT PAR 6 11ch DMX chart.
const DEFAULT_LIGHTS: Light[] = [0.2, 0.4, 0.6, 0.8].map((sceneX, i) => ({
  id: `light-${i + 1}`,
  name: `Light ${i + 1}`,
  dmxAddress: i * 11 + 1,
  channelMode: 'DIM16_RGBWAUV',
  sceneX,
  sceneY: 0.30,
  rotation: 0,
  beamWidth: 1.0,
  defaultColor: DEFAULT_COLORS_CYCLE[i],
}))

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
        const [sx, sy] = SPREAD_POS[idx % SPREAD_POS.length] ?? [0.5, 0.3]
        const defaultColor = DEFAULT_COLORS_CYCLE[idx % DEFAULT_COLORS_CYCLE.length]
        set((s) => ({
          lights: [
            ...s.lights,
            { id, name, dmxAddress, channelMode, sceneX: sx, sceneY: sy,
              rotation: 0, beamWidth: 1.0, defaultColor },
          ],
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
      version: 5,
      migrate: (state: any, fromVersion: number) => {
        const migratedLights = (state.lights ?? []).map((l: any) => ({
          sceneX: 0.5,
          sceneY: 0.3,
          rotation: 0,
          beamWidth: 1.0,
          ...l,
          defaultColor: { a: 0, uv: 0, ...(l.defaultColor ?? { r: 255, g: 255, b: 255, w: 0 }) },
        }))
        // Anyone still on the old single-fixture seed gets bumped to the new
        // 4x 11ch default; an already-customized rig (4+ lights) is left alone.
        const lights = fromVersion < 5 && migratedLights.length < 4 ? DEFAULT_LIGHTS : migratedLights
        return { ...state, lights }
      },
    },
  ),
)
