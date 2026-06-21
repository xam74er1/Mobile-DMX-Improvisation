import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface StageZone {
  id: string
  name: string
  tint: string    // semi-transparent fill color (rgba)
  border: string  // border color
  x: number       // 0–1 fraction of stage width
  y: number       // 0–1 fraction of stage height (excludes audience bar)
  w: number       // 0–1 fraction
  h: number       // 0–1 fraction
}

const DEFAULT_ZONES: StageZone[] = [
  { id: 'zone-l', name: 'Stage Left',   tint: 'rgba(80,120,200,0.08)',  border: 'rgba(80,120,200,0.22)', x: 0,     y: 0, w: 0.333, h: 1 },
  { id: 'zone-c', name: 'Center',       tint: 'rgba(80,200,120,0.08)',  border: 'rgba(80,200,120,0.22)', x: 0.333, y: 0, w: 0.334, h: 1 },
  { id: 'zone-r', name: 'Stage Right',  tint: 'rgba(200,80,120,0.08)',  border: 'rgba(200,80,120,0.22)', x: 0.667, y: 0, w: 0.333, h: 1 },
]

interface ZonesState {
  zones: StageZone[]
  zonesEnabled: boolean
  renameZone: (id: string, name: string) => void
  setZonesEnabled: (on: boolean) => void
  resetZones: () => void
}

export const useZonesStore = create<ZonesState>()(
  persist(
    (set) => ({
      zones: DEFAULT_ZONES,
      zonesEnabled: true,

      renameZone: (id, name) =>
        set((s) => ({
          zones: s.zones.map((z) => (z.id === id ? { ...z, name } : z)),
        })),

      setZonesEnabled: (on) => set({ zonesEnabled: on }),

      resetZones: () => set({ zones: DEFAULT_ZONES }),
    }),
    {
      name: 'dmx-zones',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
