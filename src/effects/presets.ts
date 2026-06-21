export interface EffectStep {
  /** ms from the START of this sequence period */
  atMs: number
  r: number; g: number; b: number; w: number
  intensity: number
}

export interface EffectPreset {
  id: string
  name: string
  icon: string          // MaterialIcons name
  description: string
  /** Steps within one period. null color = silence (blackout that period slot) */
  steps: EffectStep[]
  /** Default total period length in ms (overridden by bpm when applicable) */
  defaultPeriodMs: number
  /** If true, period = 60000/bpm. If false, period is fixed. */
  bpmScaled: boolean
  defaultBpm: number
  minBpm: number
  maxBpm: number
  /** One-shot effects stop after one period. Repeating ones loop. */
  defaultRepeat: boolean
}

const WHITE  = { r: 255, g: 255, b: 255, w: 255 }
const RED    = { r: 255, g: 0,   b: 0,   w: 0   }
const BLUE   = { r: 0,   g: 30,  b: 255, w: 0   }
const OFF    = { r: 0,   g: 0,   b: 0,   w: 0   }

export const EFFECT_PRESETS: EffectPreset[] = [
  // ── One-shot effects ────────────────────────────────────────────────────────
  {
    id: 'gunshot',
    name: 'Gunshot',
    icon: 'flash-on',
    description: 'Single ultra-bright white flash — 70ms',
    steps: [
      { atMs: 0,  ...WHITE, intensity: 100 },
      { atMs: 70, ...OFF,   intensity: 0   },
    ],
    defaultPeriodMs: 70,
    bpmScaled: false,
    defaultBpm: 120,
    minBpm: 60,
    maxBpm: 240,
    defaultRepeat: false,
  },
  {
    id: 'double_shot',
    name: 'Double Shot',
    icon: 'flash-on',
    description: 'Two quick flashes — like a camera burst',
    steps: [
      { atMs: 0,   ...WHITE, intensity: 100 },
      { atMs: 60,  ...OFF,   intensity: 0   },
      { atMs: 120, ...WHITE, intensity: 100 },
      { atMs: 180, ...OFF,   intensity: 0   },
    ],
    defaultPeriodMs: 180,
    bpmScaled: false,
    defaultBpm: 120,
    minBpm: 60,
    maxBpm: 240,
    defaultRepeat: false,
  },

  // ── Repeating effects ────────────────────────────────────────────────────────
  {
    id: 'strobe',
    name: 'Strobe',
    icon: 'highlight',
    description: 'Stroboscopic — adjust BPM for speed',
    // Flash = 40% of each period, dark = 60%
    steps: [
      { atMs: 0,   ...WHITE, intensity: 100 },
      { atMs: -1,  ...OFF,   intensity: 0   },  // atMs=-1 means "at flashRatio×period"
    ],
    defaultPeriodMs: 100,    // 600 BPM ≈ 10 Hz
    bpmScaled: true,
    defaultBpm: 600,
    minBpm: 60,
    maxBpm: 1200,
    defaultRepeat: true,
  },
  {
    id: 'clap',
    name: 'Clap Beat',
    icon: 'music-note',
    description: 'Rhythmic pulse — encourage clapping!',
    steps: [
      { atMs: 0,   ...WHITE, intensity: 100 },
      { atMs: -1,  ...OFF,   intensity: 0   },
    ],
    defaultPeriodMs: 500,    // 120 BPM
    bpmScaled: true,
    defaultBpm: 120,
    minBpm: 40,
    maxBpm: 300,
    defaultRepeat: true,
  },
  {
    id: 'heartbeat',
    name: 'Heartbeat',
    icon: 'favorite',
    description: 'Double-pulse red — lub-dub rhythm',
    // Two flashes at 35% / 55% of period, each 8% long
    steps: [
      { atMs: 0,   ...RED,  intensity: 100 },
      { atMs: -2,  ...OFF,  intensity: 0   },  // atMs=-2 means "at beat2start"
      { atMs: -3,  ...RED,  intensity: 70  },  // atMs=-3 means "at beat3start"
      { atMs: -4,  ...OFF,  intensity: 0   },
    ],
    defaultPeriodMs: 857,    // ~70 BPM
    bpmScaled: true,
    defaultBpm: 70,
    minBpm: 30,
    maxBpm: 150,
    defaultRepeat: true,
  },
  {
    id: 'police',
    name: 'Police',
    icon: 'warning',
    description: 'Red / Blue alternating — alert!',
    // First half RED, second half BLUE
    steps: [
      { atMs: 0,  ...RED,  intensity: 100 },
      { atMs: -5, ...OFF,  intensity: 0   },
      { atMs: -6, ...BLUE, intensity: 100 },
      { atMs: -7, ...OFF,  intensity: 0   },
    ],
    defaultPeriodMs: 250,    // 240 BPM
    bpmScaled: true,
    defaultBpm: 240,
    minBpm: 60,
    maxBpm: 600,
    defaultRepeat: true,
  },
]

/**
 * Resolve the special negative atMs markers to real milliseconds.
 * Negative values are coded as:
 *  -1 = flash-off (at flashRatio × period)
 *  -2 = heartbeat beat-2 start  (35% of period)
 *  -3 = heartbeat beat-3 start  (43% of period)
 *  -4 = heartbeat beat-4 end    (51% of period)
 *  -5 = police half-A end        (flashRatio × half period)
 *  -6 = police half-B start      (50% of period)
 *  -7 = police half-B end        (50% + flashRatio × half period)
 */
export function resolveSteps(preset: EffectPreset, periodMs: number, flashRatio = 0.35): EffectStep[] {
  const flashMs = periodMs * flashRatio
  return preset.steps.map((step) => {
    if (step.atMs >= 0) return step
    switch (step.atMs) {
      case -1: return { ...step, atMs: flashMs }
      case -2: return { ...step, atMs: periodMs * 0.35 }
      case -3: return { ...step, atMs: periodMs * 0.35 + flashMs * 0.7 }
      case -4: return { ...step, atMs: periodMs * 0.43 }
      case -5: return { ...step, atMs: periodMs * 0.5 * flashRatio }
      case -6: return { ...step, atMs: periodMs * 0.5 }
      case -7: return { ...step, atMs: periodMs * 0.5 + periodMs * 0.5 * flashRatio }
      default:  return step
    }
  })
}
