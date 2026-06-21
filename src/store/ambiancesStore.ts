import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { FixtureState } from '../dmx/DMXService'
import { dmxService } from '../dmx'
import { useLightsStore } from './lightsStore'
import { useSettingsStore } from './settingsStore'

export type LightState = FixtureState

export interface Ambiance {
  id: string
  name: string
  lightStates: Record<string, LightState>
}

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

export function defaultLightState(): LightState {
  return { r: 0, g: 0, b: 0, w: 0, intensity: 100, isOn: true }
}

const FIRST_LIGHT_ID = 'light-1'

const DEFAULT_AMBIANCES: Ambiance[] = [
  {
    id: 'amb-blue',
    name: 'Blue',
    lightStates: { [FIRST_LIGHT_ID]: { r: 0, g: 68, b: 255, w: 0, intensity: 100, isOn: true } },
  },
  {
    id: 'amb-red',
    name: 'Red',
    lightStates: { [FIRST_LIGHT_ID]: { r: 255, g: 0, b: 0, w: 0, intensity: 100, isOn: true } },
  },
  {
    id: 'amb-green',
    name: 'Green',
    lightStates: { [FIRST_LIGHT_ID]: { r: 0, g: 200, b: 0, w: 0, intensity: 100, isOn: true } },
  },
  {
    id: 'amb-white',
    name: 'White',
    lightStates: { [FIRST_LIGHT_ID]: { r: 0, g: 0, b: 0, w: 255, intensity: 100, isOn: true } },
  },
]

function sendDMX(lightStates: Record<string, LightState> | null, blackout: boolean) {
  const lights = useLightsStore.getState().lights
  const { receiverIp, receiverPort, universe } = useSettingsStore.getState()
  const fixtures = lights.map((l) => ({
    id: l.id,
    dmxAddress: l.dmxAddress,
    channelMode: l.channelMode,
  }))
  dmxService
    .sync(fixtures, lightStates ?? {}, blackout || lightStates === null, receiverIp, receiverPort, universe)
    .catch((e) => console.warn('[DMX]', e))
}

interface AmbiancesState {
  ambiances: Ambiance[]
  activeAmbianceId: string | null
  blackout: boolean

  activateAmbiance: (id: string) => void
  deactivateAll: () => void
  setBlackout: (on: boolean) => void
  toggleBlackout: () => void

  addAmbiance: (name: string) => string
  removeAmbiance: (id: string) => void
  renameAmbiance: (id: string, name: string) => void
  duplicateAmbiance: (id: string) => string

  setLightState: (ambianceId: string, lightId: string, patch: Partial<LightState>) => void
  getLightState: (ambianceId: string, lightId: string) => LightState
}

export const useAmbiancesStore = create<AmbiancesState>()(
  persist(
    (set, get) => ({
      ambiances: DEFAULT_AMBIANCES,
      activeAmbianceId: null,
      blackout: false,

      activateAmbiance: (id) => {
        const ambiance = get().ambiances.find((a) => a.id === id)
        if (!ambiance) return
        set({ activeAmbianceId: id, blackout: false })
        sendDMX(ambiance.lightStates, false)
      },

      deactivateAll: () => {
        set({ activeAmbianceId: null })
        sendDMX(null, false)
      },

      setBlackout: (on) => {
        set({ blackout: on })
        if (on) {
          sendDMX(null, true)
        } else {
          const { activeAmbianceId, ambiances } = get()
          const active = ambiances.find((a) => a.id === activeAmbianceId)
          sendDMX(active?.lightStates ?? null, false)
        }
      },

      toggleBlackout: () => {
        get().setBlackout(!get().blackout)
      },

      addAmbiance: (name) => {
        const id = `amb-${makeId()}`
        set((s) => ({
          ambiances: [...s.ambiances, { id, name, lightStates: {} }],
        }))
        return id
      },

      removeAmbiance: (id) =>
        set((s) => ({
          ambiances: s.ambiances.filter((a) => a.id !== id),
          activeAmbianceId: s.activeAmbianceId === id ? null : s.activeAmbianceId,
        })),

      renameAmbiance: (id, name) =>
        set((s) => ({
          ambiances: s.ambiances.map((a) => (a.id === id ? { ...a, name } : a)),
        })),

      duplicateAmbiance: (id) => {
        const src = get().ambiances.find((a) => a.id === id)
        if (!src) return ''
        const newId = `amb-${makeId()}`
        set((s) => ({
          ambiances: [
            ...s.ambiances,
            { id: newId, name: `${src.name} (copy)`, lightStates: { ...src.lightStates } },
          ],
        }))
        return newId
      },

      setLightState: (ambianceId, lightId, patch) => {
        set((s) => {
          const ambiances = s.ambiances.map((a) => {
            if (a.id !== ambianceId) return a
            const prev = a.lightStates[lightId] ?? defaultLightState()
            return {
              ...a,
              lightStates: { ...a.lightStates, [lightId]: { ...prev, ...patch } },
            }
          })
          if (s.activeAmbianceId === ambianceId && !s.blackout) {
            const updated = ambiances.find((a) => a.id === ambianceId)
            if (updated) sendDMX(updated.lightStates, false)
          }
          return { ambiances }
        })
      },

      getLightState: (ambianceId, lightId) => {
        const amb = get().ambiances.find((a) => a.id === ambianceId)
        return amb?.lightStates[lightId] ?? defaultLightState()
      },
    }),
    {
      name: 'dmx-ambiances',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        ambiances: s.ambiances,
        activeAmbianceId: s.activeAmbianceId,
        blackout: s.blackout,
      }),
    },
  ),
)
