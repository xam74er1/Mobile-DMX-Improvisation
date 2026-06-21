import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { FixtureState } from '../dmx/DMXService'
import { dmxService } from '../dmx'
import { useFixturesStore } from './fixturesStore'
import { useSettingsStore } from './settingsStore'
import { DEFAULT_COLORS } from '../constants/defaultColors'

export interface RGBW {
  r: number
  g: number
  b: number
  w: number
}

interface SceneState {
  channels: Record<string, FixtureState>
  blackout: boolean
  copiedColor: (RGBW & { intensity: number }) | null
  selectedFixtureId: string | null

  // Actions
  setFixtureState: (id: string, patch: Partial<FixtureState>) => void
  toggleFixture: (id: string) => void
  setBlackout: (on: boolean) => void
  toggleBlackout: () => void
  copyColor: (id: string) => void
  pasteColor: (id: string) => void
  setAllColor: (color: RGBW, intensity?: number) => void
  selectFixture: (id: string | null) => void
  ensureFixture: (id: string) => void
}

function defaultFixtureState(id: string): FixtureState {
  const presets = DEFAULT_COLORS.slice(0, 4)
  const idx = parseInt(id.replace(/\D/g, ''), 10) || 0
  const preset = presets[(idx - 1) % presets.length] ?? presets[0]
  return {
    r: preset.r,
    g: preset.g,
    b: preset.b,
    w: preset.w,
    intensity: 100,
    isOn: false,
  }
}

function sendDMX(channels: Record<string, FixtureState>, blackout: boolean) {
  const { fixtures } = useFixturesStore.getState()
  const { receiverIp, receiverPort, universe } = useSettingsStore.getState()
  dmxService
    .sync(fixtures, channels, blackout, receiverIp, receiverPort, universe)
    .catch((e) => console.warn('[DMX] sync error', e))
}

export const useSceneStore = create<SceneState>()(
  persist(
    (set, get) => ({
      channels: {},
      blackout: false,
      copiedColor: null,
      selectedFixtureId: null,

      ensureFixture: (id) => {
        if (!get().channels[id]) {
          set((s) => ({
            channels: { ...s.channels, [id]: defaultFixtureState(id) },
          }))
        }
      },

      setFixtureState: (id, patch) => {
        set((s) => {
          const prev = s.channels[id] ?? defaultFixtureState(id)
          const updated = { ...s.channels, [id]: { ...prev, ...patch } }
          sendDMX(updated, s.blackout)
          return { channels: updated }
        })
      },

      toggleFixture: (id) => {
        set((s) => {
          const prev = s.channels[id] ?? defaultFixtureState(id)
          const updated = { ...s.channels, [id]: { ...prev, isOn: !prev.isOn } }
          sendDMX(updated, s.blackout)
          return { channels: updated }
        })
      },

      setBlackout: (on) => {
        set((s) => {
          sendDMX(s.channels, on)
          return { blackout: on }
        })
      },

      toggleBlackout: () => {
        set((s) => {
          const on = !s.blackout
          sendDMX(s.channels, on)
          return { blackout: on }
        })
      },

      copyColor: (id) => {
        const state = get().channels[id]
        if (!state) return
        set({
          copiedColor: {
            r: state.r,
            g: state.g,
            b: state.b,
            w: state.w,
            intensity: state.intensity,
          },
        })
      },

      pasteColor: (id) => {
        const { copiedColor } = get()
        if (!copiedColor) return
        set((s) => {
          const prev = s.channels[id] ?? defaultFixtureState(id)
          const updated = { ...s.channels, [id]: { ...prev, ...copiedColor } }
          sendDMX(updated, s.blackout)
          return { channels: updated }
        })
      },

      setAllColor: (color, intensity?) => {
        const { fixtures } = useFixturesStore.getState()
        set((s) => {
          const updated = { ...s.channels }
          for (const f of fixtures) {
            const prev = updated[f.id] ?? defaultFixtureState(f.id)
            updated[f.id] = {
              ...prev,
              ...color,
              ...(intensity !== undefined ? { intensity } : {}),
            }
          }
          sendDMX(updated, s.blackout)
          return { channels: updated }
        })
      },

      selectFixture: (id) => set({ selectedFixtureId: id }),
    }),
    {
      name: 'dmx-scene',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist color/intensity data; transient UI state is re-derived on mount
      partialize: (state) => ({
        channels: state.channels,
        blackout: state.blackout,
      }),
    },
  ),
)
