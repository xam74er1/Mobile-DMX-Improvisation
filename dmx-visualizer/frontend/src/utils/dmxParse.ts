export type FixtureMode =
  | 'RGB' | 'RGBW' | 'Dim+RGB' | 'Dim+RGBW'
  | 'RGBA' | 'RGBWA' | 'Dim+RGBA' | 'Dim+RGBWA'
  | 'RGBWA+UV' | 'Dim+RGBWA+UV' | 'Dim16+RGBWA+UV'

/** Parse raw DMX channels for a fixture and return final RGB display values (0-255 each). */
export function parseDMX(mode: FixtureMode, universe: number[], start: number) {
  let r = 0, g = 0, b = 0, w = 0, a = 0, uv = 0, dim = 255

  switch (mode) {
    case 'RGB':
      r = universe[start] || 0
      g = universe[start + 1] || 0
      b = universe[start + 2] || 0
      break
    case 'RGBW':
      r = universe[start] || 0
      g = universe[start + 1] || 0
      b = universe[start + 2] || 0
      w = universe[start + 3] || 0
      break
    case 'Dim+RGB':
      dim = universe[start] || 0
      r = universe[start + 1] || 0
      g = universe[start + 2] || 0
      b = universe[start + 3] || 0
      break
    case 'Dim+RGBW':
      dim = universe[start] || 0
      r = universe[start + 1] || 0
      g = universe[start + 2] || 0
      b = universe[start + 3] || 0
      w = universe[start + 4] || 0
      break
    case 'RGBA':
      r = universe[start] || 0
      g = universe[start + 1] || 0
      b = universe[start + 2] || 0
      a = universe[start + 3] || 0
      break
    case 'RGBWA':
      r = universe[start] || 0
      g = universe[start + 1] || 0
      b = universe[start + 2] || 0
      w = universe[start + 3] || 0
      a = universe[start + 4] || 0
      break
    case 'Dim+RGBA':
      dim = universe[start] || 0
      r = universe[start + 1] || 0
      g = universe[start + 2] || 0
      b = universe[start + 3] || 0
      a = universe[start + 4] || 0
      break
    case 'Dim+RGBWA':
      dim = universe[start] || 0
      r = universe[start + 1] || 0
      g = universe[start + 2] || 0
      b = universe[start + 3] || 0
      w = universe[start + 4] || 0
      a = universe[start + 5] || 0
      break
    // CAMEO ROOT PAR 6: 6CH — R,G,B,W,A,UV
    case 'RGBWA+UV':
      r = universe[start] || 0
      g = universe[start + 1] || 0
      b = universe[start + 2] || 0
      w = universe[start + 3] || 0
      a = universe[start + 4] || 0
      uv = universe[start + 5] || 0
      break
    // CAMEO ROOT PAR 6: 8CH — Dim,Strobe(skip),R,G,B,W,A,UV
    case 'Dim+RGBWA+UV':
      dim = universe[start] || 0
      // universe[start+1] is strobe — skip for display
      r = universe[start + 2] || 0
      g = universe[start + 3] || 0
      b = universe[start + 4] || 0
      w = universe[start + 5] || 0
      a = universe[start + 6] || 0
      uv = universe[start + 7] || 0
      break
    // CAMEO ROOT PAR 6: 11CH — Dim(coarse),Dim(fine),Strobe,R,G,B,W,A,UV,Macro,MacroSpeed
    case 'Dim16+RGBWA+UV':
      dim = universe[start] || 0
      // universe[start+1] is dim fine, universe[start+2] is strobe — skip for display
      r = universe[start + 3] || 0
      g = universe[start + 4] || 0
      b = universe[start + 5] || 0
      w = universe[start + 6] || 0
      a = universe[start + 7] || 0
      uv = universe[start + 8] || 0
      // universe[start+9] macro, universe[start+10] macro speed — skip for display
      break
  }

  // Amber: warm orange (R=full, G=50%, B=0). UV: violet glow (R=50%, G=0, B=full)
  const dimScale = dim / 255
  const finalR = Math.min(255, r + w + a + Math.round(uv * 0.5)) * dimScale
  const finalG = Math.min(255, g + w + Math.round(a * 0.5)) * dimScale
  const finalB = Math.min(255, b + w + uv) * dimScale

  return { finalR, finalG, finalB, raw: { r, g, b, w, a, uv, dim } }
}
