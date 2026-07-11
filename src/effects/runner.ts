/**
 * Frame-based effects runner — 50 ms tick (20 fps).
 * All effect types (discrete + smooth) run through the same frame loop.
 * Multiple slots can run simultaneously, targeting different sets of lights.
 */
import { dmxService } from '../dmx'
import { useLightsStore } from '../store/lightsStore'
import { useSettingsStore } from '../store/settingsStore'
import { useAmbiancesStore } from '../store/ambiancesStore'
import { useDMXStatusStore } from '../store/dmxStatusStore'
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
  // Color overrides for color effects (ignored when preset.intensityOnly = true)
  fromColor?: RGBW        // primary color (heartbeat flash color, alternate color A, transition start)
  colorB?: RGBW           // secondary color (alternate color B only)
  toColor?: RGBW          // color transition end color
  onComplete?: () => void // fired when a non-repeating effect finishes naturally
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
  intensityOnly: boolean // if true, only override intensity; preserve light's own color
}

interface Slot {
  id: string
  targetLightIds: string[] | 'all'
  config: SlotConfig
  frame: number
  repeat: boolean
  onComplete?: () => void
}

type FrameOutput = {
  r: number; g: number; b: number; w: number; a: number; uv: number
  intensity: number; isOn: boolean
  intensityOnly?: boolean
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
      onComplete: effect.onComplete,
      config: {
        kind: preset.kind,
        periodFrames,
        flashFrames,
        totalFrames,
        color: effect.fromColor ?? preset.color,
        colorB: effect.colorB ?? preset.colorB,
        maxIntensity: effect.maxIntensity,
        toColor: effect.toColor ?? preset.defaultToColor,
        intensityOnly: preset.intensityOnly,
      },
    }

    this.slots.set(effect.id, slot)
    this.ensureTicker()
  }

  stopSlot(id: string) {
    if (this.slots.delete(id)) {
      // Re-merge the REMAINING running slots' current frame instead of a blank
      // map — otherwise any other still-running effect blinks off for one
      // frame (~50ms) whenever an unrelated slot is stopped.
      this.mergeSend(this.currentOutputs())
      if (this.slots.size === 0) this.stopTicker()
    }
  }

  /** Stop the manual Fade In / Fade Out slots from Panel 1 (no-op if not running). */
  stopManualFades() {
    this.stopSlot('fade-in-manual')
    this.stopSlot('fade-out-manual')
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
    const completed: Slot[] = []

    for (const [, slot] of this.slots) {
      slot.frame++
      const out = this.computeFrame(slot)
      if (out === null) {
        completed.push(slot)
        continue
      }
      const lightIds = this.resolveLightIds(slot.targetLightIds)
      for (const id of lightIds) outputs.set(id, out)
    }

    // Fire completion callbacks BEFORE the merge-send so they can update state
    // (e.g. fade-out engages blackout) that the send below will respect.
    for (const slot of completed) {
      this.ambianceSlotIds.delete(slot.id)
      this.slots.delete(slot.id)
      slot.onComplete?.()
    }

    this.mergeSend(outputs)

    if (this.slots.size === 0) this.stopTicker()
  }

  // ── Frame computation ────────────────────────────────────────────────────────

  private computeFrame(slot: Slot): FrameOutput | null {
    const { config, frame, repeat } = slot
    const { kind, periodFrames, flashFrames, totalFrames, color, colorB, maxIntensity, toColor, intensityOnly } = config
    const OFF: FrameOutput = { r: 0, g: 0, b: 0, w: 0, a: 0, uv: 0, intensity: 0, isOn: false, intensityOnly }

    switch (kind) {
      case 'flash': {
        if (!repeat) {
          // One-shot: fixed short flash from the preset's own duration (e.g.
          // Gunshot's 70ms) — NOT the BPM-derived flashFrames used below,
          // which would stretch the flash to a full beat period.
          if (frame <= totalFrames) return { ...color, a: color.a ?? 0, uv: color.uv ?? 0, intensity: maxIntensity, isOn: true, intensityOnly }
          return null
        }
        // Repeating: re-flash every period (mirrors strobe/beat).
        const phase = frame % periodFrames
        if (phase < flashFrames) return { ...color, a: color.a ?? 0, uv: color.uv ?? 0, intensity: maxIntensity, isOn: true, intensityOnly }
        return OFF
      }

      case 'strobe':
      case 'beat': {
        const phase = frame % periodFrames
        if (phase < flashFrames) return { ...color, a: color.a ?? 0, uv: color.uv ?? 0, intensity: maxIntensity, isOn: true, intensityOnly }
        return OFF
      }

      case 'heartbeat': {
        const phase = frame % periodFrames
        const beat2 = Math.round(periodFrames * 0.35)
        const beat2End = beat2 + Math.round(flashFrames * 0.7)
        if (phase < flashFrames) return { ...color, a: color.a ?? 0, uv: color.uv ?? 0, intensity: maxIntensity, isOn: true, intensityOnly }
        if (phase >= beat2 && phase < beat2End) return { ...color, a: color.a ?? 0, uv: color.uv ?? 0, intensity: Math.round(maxIntensity * 0.65), isOn: true, intensityOnly }
        return OFF
      }

      case 'clap': {
        // 3 rapid bursts in the first 40% of the period, then darkness
        const phase = frame % periodFrames
        const burstZone = Math.round(periodFrames * 0.4)
        const spacing = Math.round(burstZone / 3)
        for (let i = 0; i < 3; i++) {
          const start = i * spacing
          if (phase >= start && phase < start + flashFrames) {
            return { ...color, a: color.a ?? 0, uv: color.uv ?? 0, intensity: maxIntensity, isOn: true, intensityOnly }
          }
        }
        return OFF
      }

      case 'alternate': {
        // Hard switch between color A and B with no black gap
        const phase = frame % periodFrames
        const half = Math.round(periodFrames / 2)
        const col = phase < half ? color : (colorB ?? color)
        return { r: col.r, g: col.g, b: col.b, w: col.w, a: col.a ?? 0, uv: col.uv ?? 0, intensity: maxIntensity, isOn: true, intensityOnly }
      }

      case 'ramp_up': {
        if (frame > totalFrames) {
          if (repeat) { slot.frame = 0; return OFF }
          // Hold at full brightness — a completed fade-in stays on until
          // something else (blackout, fade-out, new ambiance) replaces it,
          // instead of instantly reverting to whatever scene is behind it.
          return { ...color, a: color.a ?? 0, uv: color.uv ?? 0, intensity: maxIntensity, isOn: true, intensityOnly }
        }
        const t = Math.min(1, frame / totalFrames)
        return { ...color, a: color.a ?? 0, uv: color.uv ?? 0, intensity: t * maxIntensity, isOn: true, intensityOnly }
      }

      case 'ramp_down': {
        const t = Math.max(0, 1 - frame / totalFrames)
        if (frame > totalFrames) {
          if (!repeat) return null
          slot.frame = 0
          return { ...color, a: color.a ?? 0, uv: color.uv ?? 0, intensity: maxIntensity, isOn: true, intensityOnly }
        }
        return { ...color, a: color.a ?? 0, uv: color.uv ?? 0, intensity: t * maxIntensity, isOn: t > 0, intensityOnly }
      }

      case 'breathe': {
        const phase = frame % periodFrames
        const t = phase / periodFrames
        const intensity = Math.sin(Math.PI * t) * maxIntensity
        return { ...color, a: color.a ?? 0, uv: color.uv ?? 0, intensity: Math.max(0, intensity), isOn: intensity > 0, intensityOnly }
      }

      case 'color_transition': {
        if (frame > totalFrames) {
          if (!repeat) return null
          slot.frame = 0
          return { ...color, a: color.a ?? 0, uv: color.uv ?? 0, intensity: maxIntensity, isOn: true, intensityOnly }
        }
        const t = frame / totalFrames
        const to = toColor ?? color
        return {
          r: Math.round(color.r + (to.r - color.r) * t),
          g: Math.round(color.g + (to.g - color.g) * t),
          b: Math.round(color.b + (to.b - color.b) * t),
          w: Math.round((color.w ?? 0) + ((to.w ?? 0) - (color.w ?? 0)) * t),
          a: Math.round((color.a ?? 0) + ((to.a ?? 0) - (color.a ?? 0)) * t),
          uv: Math.round((color.uv ?? 0) + ((to.uv ?? 0) - (color.uv ?? 0)) * t),
          intensity: maxIntensity,
          isOn: true,
          intensityOnly,
        }
      }

      default: return null
    }
  }

  // ── DMX merge + send ─────────────────────────────────────────────────────────

  private mergeSend(outputs: Map<string, FrameOutput>) {
    const lights = useLightsStore.getState().lights
    const { receiverIp, receiverPort, universe, masterIntensity } = useSettingsStore.getState()
    const { activeAmbianceId, ambiances, blackout } = useAmbiancesStore.getState()
    const active = ambiances.find((a) => a.id === activeAmbianceId)

    const fixtures = lights.map((l) => ({
      id: l.id, dmxAddress: l.dmxAddress, channelMode: l.channelMode, maxIntensity: l.maxIntensity,
    }))

    const scene: Record<string, FrameOutput> = {}
    for (const l of lights) {
      const override = outputs.get(l.id)
      if (override) {
        if (override.intensityOnly) {
          // Preserve the light's own color from the active ambiance (or its default color),
          // only apply the effect's intensity and isOn state.
          const base = active?.lightStates[l.id]
          const baseColor = base
            ? { r: base.r, g: base.g, b: base.b, w: base.w, a: base.a ?? 0, uv: base.uv ?? 0 }
            : { r: l.defaultColor?.r ?? 255, g: l.defaultColor?.g ?? 255, b: l.defaultColor?.b ?? 255, w: l.defaultColor?.w ?? 0, a: l.defaultColor?.a ?? 0, uv: l.defaultColor?.uv ?? 0 }
          scene[l.id] = { ...baseColor, intensity: override.intensity, isOn: override.isOn }
        } else {
          scene[l.id] = override
        }
      } else if (active?.lightStates[l.id]) {
        scene[l.id] = active.lightStates[l.id] as FrameOutput
      }
    }

    dmxService
      .sync(fixtures, scene, blackout, receiverIp, receiverPort, universe, masterIntensity)
      .then(() => useDMXStatusStore.getState().reportSuccess())
      .catch((e) => useDMXStatusStore.getState().reportError(e?.message ?? 'Send failed'))
  }

  private restoreAmbiance() {
    this.mergeSend(this.currentOutputs())
  }

  /** Recompute the current frame for every running slot without advancing time. */
  private currentOutputs(): Map<string, FrameOutput> {
    const outputs = new Map<string, FrameOutput>()
    for (const [, slot] of this.slots) {
      const out = this.computeFrame(slot)
      if (out === null) continue
      const lightIds = this.resolveLightIds(slot.targetLightIds)
      for (const id of lightIds) outputs.set(id, out)
    }
    return outputs
  }

  private resolveLightIds(target: string[] | 'all'): string[] {
    if (target === 'all') return useLightsStore.getState().lights.map((l) => l.id)
    return target
  }
}

export const effectsRunner = new EffectsRunner()
