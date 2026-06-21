/**
 * Frame-based effects runner — 50 ms tick (20 fps).
 * All effect types (discrete + smooth) run through the same frame loop.
 * Multiple slots can run simultaneously, targeting different sets of lights.
 */
import { dmxService } from '../dmx'
import { useLightsStore } from '../store/lightsStore'
import { useSettingsStore } from '../store/settingsStore'
import { useAmbiancesStore } from '../store/ambiancesStore'
import { EFFECT_PRESET_MAP, type RGBW } from './presets'

export const FRAME_MS = 50   // tick interval

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AmbianceEffect {
  id: string
  presetId: string
  targetLightIds: string[] | 'all'
  bpm: number
  repeat: boolean
  durationMs: number      // for smooth effects and total period override
  maxIntensity: number    // 0–100
  toColor?: RGBW          // for color_transition end color
  fromColor?: RGBW        // for color_transition start color (overrides preset default)
}

interface SlotConfig {
  kind: string
  periodFrames: number   // frames per cycle
  flashFrames: number    // frames "on" per cycle
  totalFrames: number    // for non-looping effects
  color: RGBW
  colorB?: RGBW
  maxIntensity: number
  toColor?: RGBW
}

interface Slot {
  id: string
  targetLightIds: string[] | 'all'
  config: SlotConfig
  frame: number
  repeat: boolean
}

type FrameOutput = {
  r: number; g: number; b: number; w: number
  intensity: number; isOn: boolean
}

// ── Runner ────────────────────────────────────────────────────────────────────

class EffectsRunner {
  private slots = new Map<string, Slot>()
  private ticker: ReturnType<typeof setInterval> | null = null
  // Tracks which slots belong to the active ambiance (so we can stop them together)
  private ambianceSlotIds = new Set<string>()

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Start a single effect slot (replaces any existing slot with same id). */
  startSlot(effect: AmbianceEffect) {
    this.stopSlot(effect.id)
    const preset = EFFECT_PRESET_MAP[effect.presetId]
    if (!preset) return

    const periodMs = 60000 / effect.bpm
    const periodFrames = Math.max(1, Math.round(periodMs / FRAME_MS))
    const flashFrames  = Math.max(1, Math.round(periodFrames * preset.flashRatio))
    const totalFrames  = Math.max(1, Math.round(effect.durationMs / FRAME_MS))

    const slot: Slot = {
      id: effect.id,
      targetLightIds: effect.targetLightIds,
      frame: 0,
      repeat: effect.repeat,
      config: {
        kind: preset.kind,
        periodFrames,
        flashFrames,
        totalFrames,
        color: effect.fromColor ?? preset.color,
        colorB: preset.colorB,
        maxIntensity: effect.maxIntensity,
        toColor: effect.toColor ?? preset.defaultToColor,
      },
    }

    this.slots.set(effect.id, slot)
    this.ensureTicker()
  }

  stopSlot(id: string) {
    if (this.slots.delete(id)) {
      this.mergeSend(new Map())
      if (this.slots.size === 0) this.stopTicker()
    }
  }

  /** Start all effects for the active ambiance. */
  startAmbianceEffects(effects: AmbianceEffect[]) {
    this.stopAmbianceEffects()
    for (const eff of effects) {
      this.ambianceSlotIds.add(eff.id)
      this.startSlot(eff)
    }
  }

  /** Stop only the effects that were started for the active ambiance. */
  stopAmbianceEffects() {
    for (const id of this.ambianceSlotIds) {
      this.slots.delete(id)
    }
    this.ambianceSlotIds.clear()
    if (this.slots.size === 0) {
      this.stopTicker()
      this.restoreAmbiance()
    }
  }

  /** Stop everything (ambiance effects + any manual effects). */
  stopAll() {
    this.slots.clear()
    this.ambianceSlotIds.clear()
    this.stopTicker()
    this.restoreAmbiance()
  }

  get activeIds(): string[] {
    return [...this.slots.keys()]
  }

  isSlotRunning(id: string) {
    return this.slots.has(id)
  }

  // ── Ticker ──────────────────────────────────────────────────────────────────

  private ensureTicker() {
    if (this.ticker) return
    this.ticker = setInterval(() => this.tick(), FRAME_MS)
  }

  private stopTicker() {
    if (this.ticker) { clearInterval(this.ticker); this.ticker = null }
  }

  private tick() {
    if (this.slots.size === 0) { this.stopTicker(); return }

    const outputs = new Map<string, FrameOutput>()
    const toRemove: string[] = []

    for (const [slotId, slot] of this.slots) {
      slot.frame++
      const out = this.computeFrame(slot)
      if (out === null) {
        toRemove.push(slotId)
        continue
      }
      const lightIds = this.resolveLightIds(slot.targetLightIds)
      for (const id of lightIds) outputs.set(id, out)
    }

    for (const id of toRemove) {
      this.ambianceSlotIds.delete(id)
      this.slots.delete(id)
    }

    this.mergeSend(outputs)

    if (this.slots.size === 0) this.stopTicker()
  }

  // ── Frame computation ────────────────────────────────────────────────────────

  private computeFrame(slot: Slot): FrameOutput | null {
    const { config, frame, repeat } = slot
    const { kind, periodFrames, flashFrames, totalFrames, color, colorB, maxIntensity, toColor } = config
    const OFF: FrameOutput = { r: 0, g: 0, b: 0, w: 0, intensity: 0, isOn: false }

    switch (kind) {
      case 'flash': {
        if (frame <= flashFrames) return { ...color, intensity: maxIntensity, isOn: true }
        if (!repeat) { slot.repeat = false; return null }
        return OFF
      }

      case 'strobe':
      case 'beat': {
        const phase = frame % periodFrames
        if (phase < flashFrames) return { ...color, intensity: maxIntensity, isOn: true }
        return OFF
      }

      case 'heartbeat': {
        const phase = frame % periodFrames
        const beat2 = Math.round(periodFrames * 0.35)
        const beat2End = beat2 + Math.round(flashFrames * 0.7)
        if (phase < flashFrames) return { ...color, intensity: maxIntensity, isOn: true }
        if (phase >= beat2 && phase < beat2End) return { ...color, intensity: Math.round(maxIntensity * 0.65), isOn: true }
        return OFF
      }

      case 'alternate': {
        const phase = frame % periodFrames
        const half = Math.round(periodFrames / 2)
        const inFirst = phase < half
        const posInHalf = inFirst ? phase : phase - half
        const halfFlash = Math.round(half * 0.7)
        const col = inFirst ? color : (colorB ?? color)
        if (posInHalf < halfFlash) return { ...col, intensity: maxIntensity, isOn: true }
        return OFF
      }

      case 'ramp_up': {
        const t = Math.min(1, frame / totalFrames)
        if (frame > totalFrames) {
          if (!repeat) return null
          slot.frame = 0
          return OFF
        }
        return { ...color, intensity: t * maxIntensity, isOn: true }
      }

      case 'ramp_down': {
        const t = Math.max(0, 1 - frame / totalFrames)
        if (frame > totalFrames) {
          if (!repeat) return null
          slot.frame = 0
          return { ...color, intensity: maxIntensity, isOn: true }
        }
        return { ...color, intensity: t * maxIntensity, isOn: t > 0 }
      }

      case 'breathe': {
        const phase = frame % periodFrames
        const t = phase / periodFrames
        const intensity = Math.sin(Math.PI * t) * maxIntensity
        return { ...color, intensity: Math.max(0, intensity), isOn: intensity > 0 }
      }

      case 'color_transition': {
        if (frame > totalFrames) {
          if (!repeat) return null
          slot.frame = 0
          return { ...color, intensity: maxIntensity, isOn: true }
        }
        const t = frame / totalFrames
        const to = toColor ?? color
        return {
          r: Math.round(color.r + (to.r - color.r) * t),
          g: Math.round(color.g + (to.g - color.g) * t),
          b: Math.round(color.b + (to.b - color.b) * t),
          w: Math.round((color.w ?? 0) + ((to.w ?? 0) - (color.w ?? 0)) * t),
          intensity: maxIntensity,
          isOn: true,
        }
      }

      default: return null
    }
  }

  // ── DMX merge + send ─────────────────────────────────────────────────────────

  private mergeSend(outputs: Map<string, FrameOutput>) {
    const lights = useLightsStore.getState().lights
    const { receiverIp, receiverPort, universe } = useSettingsStore.getState()
    const { activeAmbianceId, ambiances, blackout } = useAmbiancesStore.getState()
    const active = ambiances.find((a) => a.id === activeAmbianceId)

    const fixtures = lights.map((l) => ({
      id: l.id, dmxAddress: l.dmxAddress, channelMode: l.channelMode,
    }))

    const scene: Record<string, FrameOutput> = {}
    for (const l of lights) {
      const override = outputs.get(l.id)
      if (override) {
        scene[l.id] = override
      } else if (active?.lightStates[l.id]) {
        scene[l.id] = active.lightStates[l.id] as FrameOutput
      }
    }

    dmxService
      .sync(fixtures, scene, blackout, receiverIp, receiverPort, universe)
      .catch(() => {})
  }

  private restoreAmbiance() {
    this.mergeSend(new Map())
  }

  private resolveLightIds(target: string[] | 'all'): string[] {
    if (target === 'all') return useLightsStore.getState().lights.map((l) => l.id)
    return target
  }
}

export const effectsRunner = new EffectsRunner()
