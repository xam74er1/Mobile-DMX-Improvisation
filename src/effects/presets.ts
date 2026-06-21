export type EffectKind =
  | 'flash' | 'beat' | 'strobe' | 'heartbeat' | 'alternate'
  | 'ramp_up' | 'ramp_down' | 'breathe' | 'color_transition'

export interface RGBW { r: number; g: number; b: number; w: number }

export interface EffectPreset {
  id: string
  name: string
  icon: string
  description: string
  kind: EffectKind

  // Periodic effects — timing scaled from BPM
  defaultBpm: number
  minBpm: number
  maxBpm: number
  flashRatio: number   // fraction of period that's "on"

  // Colors
  color: RGBW           // primary flash/ramp color
  colorB?: RGBW         // secondary color for alternate type

  // Smooth effects (ramp / breathe / color_transition) — duration in ms
  defaultDurationMs: number

  // Color transition end color
  defaultToColor?: RGBW

  defaultMaxIntensity: number  // 0–100
  defaultRepeat: boolean
}

const WHITE = { r: 255, g: 255, b: 255, w: 255 }
const RED   = { r: 255, g: 0,   b: 0,   w: 0   }
const BLUE  = { r: 0,   g: 30,  b: 255, w: 0   }
const GREEN = { r: 0,   g: 200, b: 0,   w: 0   }

export const EFFECT_PRESETS: EffectPreset[] = [
  // ── One-shot ──────────────────────────────────────────────
  {
    id: 'flash',
    name: 'Gunshot',
    icon: 'flash-on',
    description: 'Single ultra-bright white flash (70 ms)',
    kind: 'flash',
    defaultBpm: 120, minBpm: 60, maxBpm: 240,
    flashRatio: 1,
    color: WHITE,
    defaultDurationMs: 70,
    defaultMaxIntensity: 100,
    defaultRepeat: false,
  },

  // ── Rhythmic ──────────────────────────────────────────────
  {
    id: 'strobe',
    name: 'Strobe',
    icon: 'highlight',
    description: 'Classic stroboscope',
    kind: 'strobe',
    defaultBpm: 600, minBpm: 60, maxBpm: 1200,
    flashRatio: 0.4,
    color: WHITE,
    defaultDurationMs: 2000,
    defaultMaxIntensity: 100,
    defaultRepeat: true,
  },
  {
    id: 'beat',
    name: 'Clap Beat',
    icon: 'music-note',
    description: 'Pulse on the beat — encourage clapping!',
    kind: 'beat',
    defaultBpm: 120, minBpm: 40, maxBpm: 300,
    flashRatio: 0.3,
    color: WHITE,
    defaultDurationMs: 4000,
    defaultMaxIntensity: 100,
    defaultRepeat: true,
  },
  {
    id: 'heartbeat',
    name: 'Heartbeat',
    icon: 'favorite',
    description: 'Red lub-dub double pulse',
    kind: 'heartbeat',
    defaultBpm: 72, minBpm: 30, maxBpm: 160,
    flashRatio: 0.12,
    color: RED,
    defaultDurationMs: 2000,
    defaultMaxIntensity: 100,
    defaultRepeat: true,
  },
  {
    id: 'police',
    name: 'Police',
    icon: 'warning',
    description: 'Red / Blue alternating alert',
    kind: 'alternate',
    defaultBpm: 240, minBpm: 60, maxBpm: 600,
    flashRatio: 0.45,
    color: RED,
    colorB: BLUE,
    defaultDurationMs: 2000,
    defaultMaxIntensity: 100,
    defaultRepeat: true,
  },

  // ── Smooth / interpolated ─────────────────────────────────
  {
    id: 'ramp_up',
    name: 'Ramp Up',
    icon: 'trending-up',
    description: 'Intensity rises from 0 to max over duration',
    kind: 'ramp_up',
    defaultBpm: 60, minBpm: 10, maxBpm: 300,
    flashRatio: 1,
    color: WHITE,
    defaultDurationMs: 2000,
    defaultMaxIntensity: 100,
    defaultRepeat: false,
  },
  {
    id: 'ramp_down',
    name: 'Ramp Down',
    icon: 'trending-down',
    description: 'Intensity falls from max to 0 over duration',
    kind: 'ramp_down',
    defaultBpm: 60, minBpm: 10, maxBpm: 300,
    flashRatio: 1,
    color: WHITE,
    defaultDurationMs: 2000,
    defaultMaxIntensity: 100,
    defaultRepeat: false,
  },
  {
    id: 'breathe',
    name: 'Breathe',
    icon: 'waves',
    description: 'Smooth sine-wave brightness oscillation',
    kind: 'breathe',
    defaultBpm: 12, minBpm: 3, maxBpm: 120,
    flashRatio: 1,
    color: { r: 0, g: 68, b: 255, w: 0 },
    defaultDurationMs: 5000,
    defaultMaxIntensity: 100,
    defaultRepeat: true,
  },
  {
    id: 'color_transition',
    name: 'Color Fade',
    icon: 'gradient',
    description: 'Smooth cross-fade from current color to target',
    kind: 'color_transition',
    defaultBpm: 60, minBpm: 6, maxBpm: 300,
    flashRatio: 1,
    color: RED,
    defaultToColor: BLUE,
    defaultDurationMs: 3000,
    defaultMaxIntensity: 100,
    defaultRepeat: false,
  },
]

export const EFFECT_PRESET_MAP = Object.fromEntries(
  EFFECT_PRESETS.map((p) => [p.id, p]),
) as Record<string, EffectPreset>
