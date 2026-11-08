export type FixtureMode =
  | 'RGB' | 'RGBW' | 'Dim+RGB' | 'Dim+RGBW'
  | 'RGBA' | 'RGBWA' | 'Dim+RGBA' | 'Dim+RGBWA'
  | 'RGBWA+UV' | 'Dim+RGBWA+UV' | 'Dim16+RGBWA+UV'

/** 0-based channel offsets (relative to a fixture's DMX start address) for each color/dimmer role. */
export interface ChannelOffsets {
  dim?: number; r?: number; g?: number; b?: number; w?: number; a?: number; uv?: number
}

// Same layouts as the switch below, expressed as offset tables — also the
// shape a fixture imported from a real SmartLightShow .SLS_Fixture/.SLS_Scene
// file provides (see ../utils/slsImport.ts), since those don't always match
// one of these eleven fixed presets (e.g. moving heads with pan/tilt channels).
export const MODE_OFFSETS: Record<FixtureMode, ChannelOffsets> = {
  'RGB':              { r: 0, g: 1, b: 2 },
  'RGBW':             { r: 0, g: 1, b: 2, w: 3 },
  'Dim+RGB':          { dim: 0, r: 1, g: 2, b: 3 },
  'Dim+RGBW':         { dim: 0, r: 1, g: 2, b: 3, w: 4 },
  'RGBA':             { r: 0, g: 1, b: 2, a: 3 },
  'RGBWA':            { r: 0, g: 1, b: 2, w: 3, a: 4 },
  'Dim+RGBA':         { dim: 0, r: 1, g: 2, b: 3, a: 4 },
  'Dim+RGBWA':        { dim: 0, r: 1, g: 2, b: 3, w: 4, a: 5 },
  // CAMEO ROOT PAR 6: 6CH — R,G,B,W,A,UV
  'RGBWA+UV':         { r: 0, g: 1, b: 2, w: 3, a: 4, uv: 5 },
  // CAMEO ROOT PAR 6: 8CH — Dim,Strobe(skip),R,G,B,W,A,UV
  'Dim+RGBWA+UV':     { dim: 0, r: 2, g: 3, b: 4, w: 5, a: 6, uv: 7 },
  // CAMEO ROOT PAR 6: 11CH — Dim(coarse),Dim(fine),Strobe,R,G,B,W,A,UV,Macro,MacroSpeed
  'Dim16+RGBWA+UV':   { dim: 0, r: 3, g: 4, b: 5, w: 6, a: 7, uv: 8 },
}

/** Parse raw DMX channels using explicit per-role offsets and return final RGB display values (0-255 each). */
export function parseDMXOffsets(offsets: ChannelOffsets, universe: number[], start: number) {
  const at = (offset: number | undefined, fallback = 0) =>
    offset === undefined ? fallback : universe[start + offset] || 0

  const dim = at(offsets.dim, 255)
  const r = at(offsets.r)
  const g = at(offsets.g)
  const b = at(offsets.b)
  const w = at(offsets.w)
  const a = at(offsets.a)
  const uv = at(offsets.uv)

  // Amber: warm orange (R=full, G=50%, B=0). UV: violet glow (R=50%, G=0, B=full)
  const dimScale = dim / 255
  const finalR = Math.min(255, r + w + a + Math.round(uv * 0.5)) * dimScale
  const finalG = Math.min(255, g + w + Math.round(a * 0.5)) * dimScale
  const finalB = Math.min(255, b + w + uv) * dimScale

  return { finalR, finalG, finalB, raw: { r, g, b, w, a, uv, dim } }
}

/** Parse raw DMX channels for a fixture using one of the built-in presets, and return final RGB display values (0-255 each). */
export function parseDMX(mode: FixtureMode, universe: number[], start: number) {
  return parseDMXOffsets(MODE_OFFSETS[mode], universe, start)
}

/** Parse a fixture's color, preferring its imported `customOffsets` (from an SLS file) over its preset `mode` when present. */
export function resolveFixtureColor(
  fixture: { mode: FixtureMode; address: number; customOffsets?: ChannelOffsets },
  universe: number[],
) {
  const offsets = fixture.customOffsets ?? MODE_OFFSETS[fixture.mode]
  return parseDMXOffsets(offsets, universe, fixture.address - 1)
}
