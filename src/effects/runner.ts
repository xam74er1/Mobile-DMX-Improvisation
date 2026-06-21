import { dmxService } from '../dmx'
import { useLightsStore } from '../store/lightsStore'
import { useSettingsStore } from '../store/settingsStore'
import { useAmbiancesStore } from '../store/ambiancesStore'
import { EFFECT_PRESETS, resolveSteps, type EffectPreset } from './presets'

class EffectsRunner {
  private timers: ReturnType<typeof setTimeout>[] = []
  private _activeId: string | null = null
  private _running = false

  get activeId() { return this._activeId }
  get isRunning() { return this._running }

  start(preset: EffectPreset, bpm: number, repeat: boolean) {
    this.stop()
    this._activeId = preset.id
    this._running = true
    this.scheduleSequence(preset, bpm, repeat, 0)
  }

  startById(id: string, bpm?: number, repeat?: boolean) {
    const preset = EFFECT_PRESETS.find((p) => p.id === id)
    if (!preset) return
    this.start(
      preset,
      bpm ?? preset.defaultBpm,
      repeat ?? preset.defaultRepeat,
    )
  }

  stop() {
    this._running = false
    this._activeId = null
    for (const t of this.timers) clearTimeout(t)
    this.timers = []
    this.restoreAmbiance()
  }

  private scheduleSequence(preset: EffectPreset, bpm: number, repeat: boolean, _cycle: number) {
    const periodMs = preset.bpmScaled ? 60000 / bpm : preset.defaultPeriodMs
    const steps = resolveSteps(preset, periodMs)

    // Schedule each step
    for (const step of steps) {
      const t = setTimeout(() => {
        if (!this._running) return
        this.sendColor(step.r, step.g, step.b, step.w, step.intensity)
      }, step.atMs)
      this.timers.push(t)
    }

    if (repeat) {
      const next = setTimeout(() => {
        if (!this._running) return
        this.scheduleSequence(preset, bpm, true, _cycle + 1)
      }, periodMs)
      this.timers.push(next)
    } else {
      // One-shot: restore after the period ends
      const done = setTimeout(() => {
        if (this._running) this.restoreAmbiance()
        this._running = false
        this._activeId = null
      }, periodMs + 20)
      this.timers.push(done)
    }
  }

  private sendColor(r: number, g: number, b: number, w: number, intensity: number) {
    const lights = useLightsStore.getState().lights
    const { receiverIp, receiverPort, universe } = useSettingsStore.getState()
    const fixtures = lights.map((l) => ({
      id: l.id, dmxAddress: l.dmxAddress, channelMode: l.channelMode,
    }))
    const scene: Record<string, { r: number; g: number; b: number; w: number; intensity: number; isOn: boolean }> = {}
    for (const l of lights) {
      scene[l.id] = { r, g, b, w, intensity, isOn: intensity > 0 }
    }
    dmxService
      .sync(fixtures, scene, false, receiverIp, receiverPort, universe)
      .catch(() => {})
  }

  private restoreAmbiance() {
    const lights = useLightsStore.getState().lights
    const { receiverIp, receiverPort, universe } = useSettingsStore.getState()
    const { activeAmbianceId, ambiances, blackout } = useAmbiancesStore.getState()
    const fixtures = lights.map((l) => ({
      id: l.id, dmxAddress: l.dmxAddress, channelMode: l.channelMode,
    }))
    const active = ambiances.find((a) => a.id === activeAmbianceId)
    dmxService
      .sync(fixtures, active?.lightStates ?? {}, blackout || !active, receiverIp, receiverPort, universe)
      .catch(() => {})
  }
}

export const effectsRunner = new EffectsRunner()
