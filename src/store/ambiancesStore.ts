import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { FixtureState } from '../dmx/DMXService'
import { dmxService } from '../dmx'
import { useLightsStore } from './lightsStore'
import { useSettingsStore } from './settingsStore'
import { useDMXStatusStore } from './dmxStatusStore'
import type { AmbianceEffect } from '../effects/runner'

export type LightState = FixtureState
export type { AmbianceEffect }

export interface AmbianceCategory {
  id: string
  name: string
}

export interface Ambiance {
  id: string
  name: string
  icon?: string        // MaterialIcons name, optional
  categoryId?: string  // links to AmbianceCategory.id
  lightStates: Record<string, LightState>
  effects: AmbianceEffect[]   // can be empty []
}

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

export function defaultLightState(): LightState {
  return { r: 0, g: 0, b: 0, w: 0, a: 0, uv: 0, intensity: 100, isOn: true }
}

const L = 'light-1'

export const DEFAULT_CATEGORIES: AmbianceCategory[] = [
  { id: 'cat-colors',  name: 'Colors' },
  { id: 'cat-effects', name: 'Effects' },
]

export const DEFAULT_AMBIANCES: Ambiance[] = [
  // ── Static colors ──────────────────────────────────────────
  {
    id: 'amb-blue',   name: 'Blue',   icon: 'wb-incandescent', categoryId: 'cat-colors',
    lightStates: { [L]: { r: 0,   g: 68,  b: 255, w: 0,   a: 0, uv: 0, intensity: 100, isOn: true } }, effects: [],
  },
  {
    id: 'amb-red',    name: 'Red',    icon: 'wb-incandescent', categoryId: 'cat-colors',
    lightStates: { [L]: { r: 255, g: 0,   b: 0,   w: 0,   a: 0, uv: 0, intensity: 100, isOn: true } }, effects: [],
  },
  {
    id: 'amb-green',  name: 'Green',  icon: 'wb-incandescent', categoryId: 'cat-colors',
    lightStates: { [L]: { r: 0,   g: 200, b: 0,   w: 0,   a: 0, uv: 0, intensity: 100, isOn: true } }, effects: [],
  },
  {
    id: 'amb-white',  name: 'White',  icon: 'wb-sunny',        categoryId: 'cat-colors',
    lightStates: { [L]: { r: 0,   g: 0,   b: 0,   w: 255, a: 0, uv: 0, intensity: 100, isOn: true } }, effects: [],
  },
  {
    id: 'amb-purple', name: 'Purple', icon: 'wb-incandescent', categoryId: 'cat-colors',
    lightStates: { [L]: { r: 160, g: 0,   b: 255, w: 0,   a: 0, uv: 0, intensity: 100, isOn: true } }, effects: [],
  },
  {
    id: 'amb-cyan',   name: 'Cyan',   icon: 'wb-incandescent', categoryId: 'cat-colors',
    lightStates: { [L]: { r: 0,   g: 220, b: 220, w: 0,   a: 0, uv: 0, intensity: 100, isOn: true } }, effects: [],
  },

  // ── Effects — one example per preset kind ──────────────────
  // strobe: classic stroboscope (rapid white flashes)
  {
    id: 'amb-strobe', name: 'Strobe Party', icon: 'flash-on', categoryId: 'cat-effects',
    lightStates: { [L]: { r: 255, g: 255, b: 255, w: 255, a: 0, uv: 0, intensity: 100, isOn: true } },
    effects: [{ id: 'eff-strobe-1', presetId: 'strobe', targetLightIds: 'all', bpm: 600, repeat: true,  durationMs: 2000, maxIntensity: 100 }],
  },
  // beat: single pulse on each beat — good for music sync
  {
    id: 'amb-beat', name: 'Beat Drop', icon: 'music-note', categoryId: 'cat-effects',
    lightStates: { [L]: { r: 255, g: 255, b: 255, w: 0, a: 0, uv: 0, intensity: 100, isOn: true } },
    effects: [{ id: 'eff-beat-1', presetId: 'beat', targetLightIds: 'all', bpm: 120, repeat: true, durationMs: 4000, maxIntensity: 100 }],
  },
  // heartbeat: lub-dub double pulse, red
  {
    id: 'amb-heartbeat', name: 'Heartbeat', icon: 'flare', categoryId: 'cat-effects',
    lightStates: { [L]: { r: 200, g: 0, b: 0, w: 0, a: 0, uv: 0, intensity: 100, isOn: true } },
    effects: [{ id: 'eff-hb-1', presetId: 'heartbeat', targetLightIds: 'all', bpm: 72, repeat: true, durationMs: 2000, maxIntensity: 100 }],
  },
  // alternate: red/blue police flash
  {
    id: 'amb-police', name: 'Alert', icon: 'blur-on', categoryId: 'cat-effects',
    lightStates: { [L]: { r: 255, g: 0, b: 0, w: 0, a: 0, uv: 0, intensity: 100, isOn: true } },
    effects: [{ id: 'eff-police-1', presetId: 'police', targetLightIds: 'all', bpm: 240, repeat: true, durationMs: 2000, maxIntensity: 100 }],
  },
  // breathe: slow sine-wave brightness oscillation
  {
    id: 'amb-breathe', name: 'Ocean Breathe', icon: 'waves', categoryId: 'cat-effects',
    lightStates: { [L]: { r: 0, g: 68, b: 255, w: 0, a: 0, uv: 0, intensity: 100, isOn: true } },
    effects: [{ id: 'eff-breathe-1', presetId: 'breathe', targetLightIds: 'all', bpm: 12, repeat: true, durationMs: 5000, maxIntensity: 100 }],
  },
  // breathe variation: warm orange glow
  {
    id: 'amb-warm-breathe', name: 'Warm Breathe', icon: 'wb-incandescent', categoryId: 'cat-effects',
    lightStates: { [L]: { r: 255, g: 80, b: 10, w: 30, a: 0, uv: 0, intensity: 100, isOn: true } },
    effects: [{ id: 'eff-wbreathе-1', presetId: 'breathe', targetLightIds: 'all', bpm: 8, repeat: true, durationMs: 7500, maxIntensity: 90 }],
  },
  // ramp_up: intensity rises from 0 — great for scene entrances
  {
    id: 'amb-sunrise', name: 'Sunrise', icon: 'wb-sunny', categoryId: 'cat-effects',
    lightStates: { [L]: { r: 255, g: 60, b: 0, w: 0, a: 0, uv: 0, intensity: 100, isOn: true } },
    effects: [{ id: 'eff-rampup-1', presetId: 'ramp_up', targetLightIds: 'all', bpm: 20, repeat: false, durationMs: 6000, maxIntensity: 100 }],
  },
  // ramp_down: intensity falls to 0 — great for scene endings
  {
    id: 'amb-ramp-down', name: 'Fade Out', icon: 'brightness-5', categoryId: 'cat-effects',
    lightStates: { [L]: { r: 255, g: 255, b: 255, w: 0, a: 0, uv: 0, intensity: 100, isOn: true } },
    effects: [{ id: 'eff-rampdown-1', presetId: 'ramp_down', targetLightIds: 'all', bpm: 20, repeat: false, durationMs: 4000, maxIntensity: 100 }],
  },
  // flash: single ultra-bright white burst
  {
    id: 'amb-flash', name: 'Gunshot Flash', icon: 'star', categoryId: 'cat-effects',
    lightStates: { [L]: { r: 255, g: 255, b: 255, w: 255, a: 0, uv: 0, intensity: 100, isOn: true } },
    effects: [{ id: 'eff-flash-1', presetId: 'flash', targetLightIds: 'all', bpm: 120, repeat: false, durationMs: 70, maxIntensity: 100 }],
  },
  // color_transition: smooth color cross-fade
  {
    id: 'amb-colorfade', name: 'Blue → Purple', icon: 'gradient', categoryId: 'cat-effects',
    lightStates: { [L]: { r: 0, g: 68, b: 255, w: 0, a: 0, uv: 0, intensity: 100, isOn: true } },
    effects: [{ id: 'eff-fade-1', presetId: 'color_transition', targetLightIds: 'all', bpm: 20, repeat: true, durationMs: 4000, maxIntensity: 100, toColor: { r: 180, g: 0, b: 255, w: 0 } }],
  },
  // clap: celebration burst for applause moments
  {
    id: 'amb-clap', name: 'Applause', icon: 'stars', categoryId: 'cat-effects',
    lightStates: { [L]: { r: 255, g: 255, b: 255, w: 255, a: 0, uv: 0, intensity: 100, isOn: true } },
    effects: [{ id: 'eff-clap-1', presetId: 'clap', targetLightIds: 'all', bpm: 80, repeat: true, durationMs: 4000, maxIntensity: 100 }],
  },

  // color_transition variation: red → orange sunset
  {
    id: 'amb-sunset', name: 'Red Sunset', icon: 'filter-drama', categoryId: 'cat-effects',
    lightStates: { [L]: { r: 255, g: 10, b: 0, w: 0, a: 0, uv: 0, intensity: 100, isOn: true } },
    effects: [{ id: 'eff-sunset-1', presetId: 'color_transition', targetLightIds: 'all', bpm: 15, repeat: true, durationMs: 5000, maxIntensity: 100, toColor: { r: 255, g: 130, b: 0, w: 0 } }],
  },
]

export const DEFAULT_AMBIANCE_IDS: Set<string> = new Set(DEFAULT_AMBIANCES.map((a) => a.id))
export const DEFAULT_CATEGORY_IDS: Set<string> = new Set(DEFAULT_CATEGORIES.map((c) => c.id))

function sendDMX(lightStates: Record<string, LightState> | null, blackout: boolean) {
  const lights = useLightsStore.getState().lights
  const { receiverIp, receiverPort, universe, masterIntensity } = useSettingsStore.getState()
  const fixtures = lights.map((l) => ({
    id: l.id, dmxAddress: l.dmxAddress, channelMode: l.channelMode, maxIntensity: l.maxIntensity,
  }))
  dmxService
    .sync(fixtures, lightStates ?? {}, blackout || lightStates === null, receiverIp, receiverPort, universe, masterIntensity)
    .then(() => useDMXStatusStore.getState().reportSuccess())
    .catch((e) => {
      console.warn('[DMX]', e)
      useDMXStatusStore.getState().reportError(e?.message ?? 'Send failed')
    })
}

interface AmbiancesState {
  ambiances: Ambiance[]
  categories: AmbianceCategory[]
  activeAmbianceId: string | null
  blackout: boolean

  activateAmbiance: (id: string) => void
  deactivateAll: () => void
  setBlackout: (on: boolean) => void
  toggleBlackout: () => void
  resendCurrent: () => void

  addAmbiance: (name: string, categoryId?: string) => string
  removeAmbiance: (id: string) => void
  renameAmbiance: (id: string, name: string) => void
  duplicateAmbiance: (id: string) => string
  setAmbianceIcon: (id: string, icon: string | null) => void
  setAmbianceCategory: (id: string, categoryId: string | null) => void

  addCategory: (name: string) => string
  removeCategory: (id: string) => void
  renameCategory: (id: string, name: string) => void
  reorderCategories: (orderedIds: string[]) => void

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
      categories: DEFAULT_CATEGORIES,
      activeAmbianceId: null,
      blackout: false,

      activateAmbiance: (id) => {
        // Lazy import to avoid circular dep at module load time
        const { effectsRunner } = require('../effects/runner') as typeof import('../effects/runner')
        const ambiance = get().ambiances.find((a) => a.id === id)
        if (!ambiance) return
        // A manual Fade In/Out from Panel 1 must not linger and clobber the
        // newly-activated ambiance a second or two later (e.g. forcing it to
        // blackout once the old fade-out timer completes).
        effectsRunner.stopManualFades()
        set({ activeAmbianceId: id, blackout: false })
        sendDMX(ambiance.lightStates, false)
        effectsRunner.startAmbianceEffects(ambiance.effects ?? [])
      },

      deactivateAll: () => {
        const { effectsRunner } = require('../effects/runner') as typeof import('../effects/runner')
        effectsRunner.stopAmbianceEffects()
        effectsRunner.stopManualFades()
        set({ activeAmbianceId: null })
        sendDMX(null, false)
      },

      setBlackout: (on) => {
        const { effectsRunner } = require('../effects/runner') as typeof import('../effects/runner')
        effectsRunner.stopManualFades()
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

      // Re-send the current scene as-is — used when a global setting that
      // affects DMX output (e.g. master intensity) changes.
      resendCurrent: () => {
        const { activeAmbianceId, ambiances, blackout } = get()
        const active = ambiances.find((a) => a.id === activeAmbianceId)
        sendDMX(active?.lightStates ?? null, blackout)
      },

      addAmbiance: (name, categoryId) => {
        const id = `amb-${makeId()}`
        set((s) => ({ ambiances: [...s.ambiances, { id, name, categoryId, lightStates: {}, effects: [] }] }))
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
            {
              id: newId, name: `${src.name} (copy)`,
              icon: src.icon, categoryId: src.categoryId,
              lightStates: { ...src.lightStates }, effects: newEffects,
            },
          ],
        }))
        return newId
      },

      setAmbianceIcon: (id, icon) =>
        set((s) => ({
          ambiances: s.ambiances.map((a) =>
            a.id === id ? { ...a, icon: icon ?? undefined } : a,
          ),
        })),

      setAmbianceCategory: (id, categoryId) =>
        set((s) => ({
          ambiances: s.ambiances.map((a) =>
            a.id === id ? { ...a, categoryId: categoryId ?? undefined } : a,
          ),
        })),

      addCategory: (name) => {
        const id = `cat-${makeId()}`
        set((s) => ({ categories: [...s.categories, { id, name }] }))
        return id
      },

      removeCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          ambiances: s.ambiances.map((a) =>
            a.categoryId === id ? { ...a, categoryId: undefined } : a,
          ),
        })),

      renameCategory: (id, name) =>
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, name } : c)),
        })),

      reorderCategories: (orderedIds) =>
        set((s) => ({
          categories: orderedIds
            .map((id) => s.categories.find((c) => c.id === id))
            .filter((c): c is AmbianceCategory => c !== undefined),
        })),

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
      version: 3,
      migrate: (state: any) => {
        // Add a/uv to existing lightStates (v1→v2, idempotent)
        const ambiances = (state.ambiances ?? []).map((amb: any) => ({
          ...amb,
          lightStates: Object.fromEntries(
            Object.entries(amb.lightStates ?? {}).map(([k, v]: [string, any]) => [
              k, { a: 0, uv: 0, ...v },
            ]),
          ),
        }))
        // Inject any missing default ambiances (v2→v3)
        const existingIds = new Set(ambiances.map((a: any) => a.id))
        const merged = [...ambiances, ...DEFAULT_AMBIANCES.filter((a) => !existingIds.has(a.id))]
        // Inject any missing default categories
        const cats = state.categories ?? []
        const existingCatIds = new Set(cats.map((c: any) => c.id))
        const mergedCats = [...cats, ...DEFAULT_CATEGORIES.filter((c) => !existingCatIds.has(c.id))]
        return { ...state, ambiances: merged, categories: mergedCats }
      },
      partialize: (s) => ({
        ambiances: s.ambiances,
        categories: s.categories,
        activeAmbianceId: s.activeAmbianceId,
        blackout: s.blackout,
      }),
    },
  ),
)
