import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { FixtureState } from '../dmx/DMXService'
import { dmxService } from '../dmx'
import { useLightsStore } from './lightsStore'
import { useSettingsStore } from './settingsStore'
import type { AmbianceEffect } from '../effects/runner'

export type LightState = FixtureState
export type { AmbianceEffect }

export interface Ambiance {
  id: string
  name: string
  lightStates: Record<string, LightState>
  effects: AmbianceEffect[]   // can be empty []
}

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

export function defaultLightState(): LightState {
  return { r: 0, g: 0, b: 0, w: 0, intensity: 100, isOn: true }
}

const L = 'light-1'

const DEFAULT_AMBIANCES: Ambiance[] = [
  // Static colors
  {
    id: 'amb-blue',  name: 'Blue',
    lightStates: { [L]: { r: 0, g: 68, b: 255, w: 0, intensity: 100, isOn: true } },
    effects: [],
  },
  {
    id: 'amb-red',   name: 'Red',
    lightStates: { [L]: { r: 255, g: 0, b: 0, w: 0, intensity: 100, isOn: true } },
    effects: [],
  },
  {
    id: 'amb-green', name: 'Green',
    lightStates: { [L]: { r: 0, g: 200, b: 0, w: 0, intensity: 100, isOn: true } },
    effects: [],
  },
  {
    id: 'amb-white', name: 'White',
    lightStates: { [L]: { r: 0, g: 0, b: 0, w: 255, intensity: 100, isOn: true } },
    effects: [],
  },
  // Pre-configured examples with effects
  {
    id: 'amb-strobe', name: 'Strobe Party',
    lightStates: { [L]: { r: 255, g: 255, b: 255, w: 255, intensity: 100, isOn: true } },
    effects: [{
      id: 'eff-strobe-1', presetId: 'strobe', targetLightIds: 'all',
      bpm: 600, repeat: true, durationMs: 2000, maxIntensity: 100,
    }],
  },
  {
    id: 'amb-heartbeat', name: 'Heartbeat',
    lightStates: { [L]: { r: 200, g: 0, b: 0, w: 0, intensity: 100, isOn: true } },
    effects: [{
      id: 'eff-hb-1', presetId: 'heartbeat', targetLightIds: 'all',
      bpm: 72, repeat: true, durationMs: 2000, maxIntensity: 100,
    }],
  },
  {
    id: 'amb-breathe', name: 'Ocean Breathe',
    lightStates: { [L]: { r: 0, g: 68, b: 255, w: 0, intensity: 100, isOn: true } },
    effects: [{
      id: 'eff-breathe-1', presetId: 'breathe', targetLightIds: 'all',
      bpm: 12, repeat: true, durationMs: 5000, maxIntensity: 100,
    }],
  },
  {
    id: 'amb-police', name: 'Alert',
    lightStates: { [L]: { r: 255, g: 0, b: 0, w: 0, intensity: 100, isOn: true } },
    effects: [{
      id: 'eff-police-1', presetId: 'police', targetLightIds: 'all',
      bpm: 240, repeat: true, durationMs: 2000, maxIntensity: 100,
    }],
  },
  {
    id: 'amb-sunrise', name: 'Sunrise',
    lightStates: { [L]: { r: 255, g: 60, b: 0, w: 0, intensity: 100, isOn: true } },
    effects: [{
      id: 'eff-rampup-1', presetId: 'ramp_up', targetLightIds: 'all',
      bpm: 20, repeat: false, durationMs: 6000, maxIntensity: 100,
    }],
  },
  {
    id: 'amb-colorfade', name: 'Blue → Purple',
    lightStates: { [L]: { r: 0, g: 68, b: 255, w: 0, intensity: 100, isOn: true } },
    effects: [{
      id: 'eff-fade-1', presetId: 'color_transition', targetLightIds: 'all',
      bpm: 20, repeat: true, durationMs: 4000, maxIntensity: 100,
      toColor: { r: 180, g: 0, b: 255, w: 0 },
    }],
  },
]

function sendDMX(lightStates: Record<string, LightState> | null, blackout: boolean) {
  const lights = useLightsStore.getState().lights
  const { receiverIp, receiverPort, universe } = useSettingsStore.getState()
  const fixtures = lights.map((l) => ({
    id: l.id, dmxAddress: l.dmxAddress, channelMode: l.channelMode,
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

  addEffect: (ambianceId: string, effect: AmbianceEffect) => void
  updateEffect: (ambianceId: string, effect: AmbianceEffect) => void
  removeEffect: (ambianceId: string, effectId: string) => void
}

export const useAmbiancesStore = create<AmbiancesState>()(
  persist(
    (set, get) => ({
      ambiances: DEFAULT_AMBIANCES,
      activeAmbianceId: null,
      blackout: false,

      activateAmbiance: (id) => {
        // Lazy import to avoid circular dep at module load time
        const { effectsRunner } = require('../effects/runner') as typeof import('../effects/runner')
        const ambiance = get().ambiances.find((a) => a.id === id)
        if (!ambiance) return
        set({ activeAmbianceId: id, blackout: false })
        sendDMX(ambiance.lightStates, false)
        effectsRunner.startAmbianceEffects(ambiance.effects ?? [])
      },

      deactivateAll: () => {
        const { effectsRunner } = require('../effects/runner') as typeof import('../effects/runner')
        effectsRunner.stopAmbianceEffects()
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

      toggleBlackout: () => { get().setBlackout(!get().blackout) },

      addAmbiance: (name) => {
        const id = `amb-${makeId()}`
        set((s) => ({ ambiances: [...s.ambiances, { id, name, lightStates: {}, effects: [] }] }))
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
        const newEffects = (src.effects ?? []).map((e) => ({ ...e, id: `eff-${makeId()}` }))
        set((s) => ({
          ambiances: [
            ...s.ambiances,
            { id: newId, name: `${src.name} (copy)`, lightStates: { ...src.lightStates }, effects: newEffects },
          ],
        }))
        return newId
      },

      setLightState: (ambianceId, lightId, patch) => {
        set((s) => {
          const { effectsRunner } = require('../effects/runner') as typeof import('../effects/runner')
          const ambiances = s.ambiances.map((a) => {
            if (a.id !== ambianceId) return a
            const prev = a.lightStates[lightId] ?? defaultLightState()
            return { ...a, lightStates: { ...a.lightStates, [lightId]: { ...prev, ...patch } } }
          })
          if (s.activeAmbianceId === ambianceId && !s.blackout && !effectsRunner.activeIds.length) {
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

      addEffect: (ambianceId, effect) =>
        set((s) => ({
          ambiances: s.ambiances.map((a) =>
            a.id === ambianceId
              ? { ...a, effects: [...(a.effects ?? []), effect] }
              : a,
          ),
        })),

      updateEffect: (ambianceId, effect) =>
        set((s) => ({
          ambiances: s.ambiances.map((a) =>
            a.id === ambianceId
              ? { ...a, effects: (a.effects ?? []).map((e) => (e.id === effect.id ? effect : e)) }
              : a,
          ),
        })),

      removeEffect: (ambianceId, effectId) =>
        set((s) => ({
          ambiances: s.ambiances.map((a) =>
            a.id === ambianceId
              ? { ...a, effects: (a.effects ?? []).filter((e) => e.id !== effectId) }
              : a,
          ),
        })),
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
