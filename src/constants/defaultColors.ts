export interface PresetColor {
  label: string
  hex: string
  r: number
  g: number
  b: number
  w: number
}

export const DEFAULT_COLORS: PresetColor[] = [
  { label: 'Red',    hex: '#ff0000', r: 255, g: 0,   b: 0,   w: 0 },
  { label: 'Green',  hex: '#00cc00', r: 0,   g: 204, b: 0,   w: 0 },
  { label: 'Blue',   hex: '#0044ff', r: 0,   g: 68,  b: 255, w: 0 },
  { label: 'White',  hex: '#ffffff', r: 0,   g: 0,   b: 0,   w: 255 },
  { label: 'Warm',   hex: '#ff8c00', r: 255, g: 140, b: 0,   w: 0 },
  { label: 'Pink',   hex: '#ff1493', r: 255, g: 20,  b: 147, w: 0 },
  { label: 'Cyan',   hex: '#00e5ff', r: 0,   g: 229, b: 255, w: 0 },
  { label: 'Purple', hex: '#8b00ff', r: 139, g: 0,   b: 255, w: 0 },
]

export const DEFAULT_COLOR = DEFAULT_COLORS[0]
