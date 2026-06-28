/**
 * Custom SVG-based HSV color wheel.
 * Replaces react-native-color-picker which uses legacy string refs / findDOMNode.
 *
 * Layout:
 *   ┌──────────────────────────────┐
 *   │       Hue/Sat wheel          │  ← tap or drag to pick hue + saturation
 *   │    ○ (draggable indicator)   │
 *   └──────────────────────────────┘
 *   Brightness ████████░░░  80%      ← slider for Value (HSV)
 */
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { Text } from 'react-native-paper'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS } from 'react-native-reanimated'
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import Slider from '@react-native-community/slider'

// ── Constants ─────────────────────────────────────────────────────────────────
const SIZE = 220          // wheel canvas size (px)
const SECTORS = 60        // hue sectors — 6° each, smooth enough
const PAD = 10            // padding so the indicator ring isn't clipped

interface Props {
  currentHex: string
  onColorChange: (r: number, g: number, b: number) => void
}

// ── Component ──────────────────────────────────────────────────────────────────
export function WheelColorPicker({ currentHex, onColorChange }: Props) {
  const cx = SIZE / 2
  const cy = SIZE / 2
  const r  = SIZE / 2 - PAD

  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(currentHex))
  const isDragging = useRef(false)

  // Sync when parent changes the color externally (e.g. user picks a swatch)
  useEffect(() => {
    if (!isDragging.current) setHsv(hexToHsv(currentHex))
  }, [currentHex])

  // Sectors are static for these dimensions
  const sectors = useMemo(() => buildSectors(cx, cy, r, SECTORS), [cx, cy, r])

  // Indicator position
  const angleRad = (hsv.h * Math.PI) / 180
  const satDist  = hsv.s * r
  const indX = cx + satDist * Math.cos(angleRad)
  const indY = cy + satDist * Math.sin(angleRad)

  // Current output color
  const rgb        = hsvToRgb(hsv.h, hsv.s, hsv.v)
  const previewCss = `rgb(${rgb.r},${rgb.g},${rgb.b})`

  // ── Handlers ────────────────────────────────────────────────────────────────
  function touchAt(touchX: number, touchY: number) {
    isDragging.current = true
    const dx = touchX - cx
    const dy = touchY - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
    const s = Math.min(1, dist / r)
    setHsv((prev) => {
      const next = { h, s, v: prev.v }
      const out = hsvToRgb(h, s, next.v)
      onColorChange(out.r, out.g, out.b)
      return next
    })
  }

  function releaseWheel() {
    isDragging.current = false
  }

  function setBrightness(pct: number) {
    const v = pct / 100
    setHsv((prev) => {
      const next = { ...prev, v }
      const out = hsvToRgb(next.h, next.s, v)
      onColorChange(out.r, out.g, out.b)
      return next
    })
  }

  // ── Gesture ──────────────────────────────────────────────────────────────────
  // onBegin handles single taps; onUpdate handles drag
  const gesture = Gesture.Pan()
    .onBegin((e) => runOnJS(touchAt)(e.x, e.y))
    .onUpdate((e) => runOnJS(touchAt)(e.x, e.y))
    .onEnd(() => runOnJS(releaseWheel)())
    .onFinalize(() => runOnJS(releaseWheel)())

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={{ width: SIZE, height: SIZE }}>
          <Svg width={SIZE} height={SIZE}>
            <Defs>
              {/* White radial gradient — centre → edge = white → transparent (saturation axis) */}
              <RadialGradient id="wcp-sat" cx="50%" cy="50%" r="50%">
                <Stop offset="0%"   stopColor="white" stopOpacity={1} />
                <Stop offset="100%" stopColor="white" stopOpacity={0} />
              </RadialGradient>
            </Defs>

            {/* Hue sectors */}
            {sectors.map((sec, i) => (
              <Path key={i} d={sec.d} fill={sec.color} />
            ))}

            {/* Saturation overlay — makes center white */}
            <Circle cx={cx} cy={cy} r={r} fill="url(#wcp-sat)" />

            {/* Brightness overlay — darkens when v < 1 */}
            {hsv.v < 0.995 && (
              <Circle cx={cx} cy={cy} r={r} fill="black" opacity={1 - hsv.v} />
            )}

            {/* ── Indicator ── */}
            {/* Shadow ring (dark, for contrast on bright colors) */}
            <Circle cx={indX} cy={indY} r={12} fill="none"
              stroke="rgba(0,0,0,0.4)" strokeWidth={3.5} />
            {/* White outer ring */}
            <Circle cx={indX} cy={indY} r={12} fill="none"
              stroke="white" strokeWidth={2.5} />
            {/* Colored inner dot */}
            <Circle cx={indX} cy={indY} r={5} fill={previewCss} />
          </Svg>
        </Animated.View>
      </GestureDetector>

      {/* Brightness (Value) slider */}
      <View style={styles.row}>
        <Text style={styles.label}>Brightness</Text>
        <Text style={[styles.label, { color: '#fff', fontWeight: '700' }]}>
          {Math.round(hsv.v * 100)}%
        </Text>
      </View>
      <Slider
        value={hsv.v * 100}
        onValueChange={setBrightness}
        minimumValue={0}
        maximumValue={100}
        step={1}
        minimumTrackTintColor={previewCss}
        maximumTrackTintColor="#2a2a2a"
        thumbTintColor={previewCss}
        style={styles.slider}
      />
    </View>
  )
}

// ── SVG helpers ────────────────────────────────────────────────────────────────
interface Sector { d: string; color: string }

function buildSectors(cx: number, cy: number, r: number, count: number): Sector[] {
  return Array.from({ length: count }, (_, i) => {
    const a1 = ((i / count) * 360 * Math.PI) / 180
    const a2 = (((i + 1) / count) * 360 * Math.PI) / 180
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2)
    const y2 = cy + r * Math.sin(a2)
    const hue = (i / count) * 360
    return {
      d: `M${cx} ${cy}L${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}Z`,
      color: `hsl(${hue.toFixed(1)},100%,50%)`,
    }
  })
}

// ── Color math ────────────────────────────────────────────────────────────────
interface HSV { h: number; s: number; v: number }

function hexToHsv(hex: string): HSV {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return { h: 0, s: 0, v: 1 }
  let r = parseInt(m[1], 16) / 255
  let g = parseInt(m[2], 16) / 255
  let b = parseInt(m[3], 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const v = max
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (d !== 0) {
    if      (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else                h = (r - g) / d + 4
    h = h * 60
    if (h < 0) h += 360
  }
  return { h, s, v }
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if      (h <  60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) {         g = c; b = x }
  else if (h < 240) {         g = x; b = c }
  else if (h < 300) { r = x;         b = c }
  else              { r = c;         b = x }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: SIZE,
    marginTop: 10,
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    color: '#888',
  },
  slider: {
    width: SIZE,
    height: 36,
  },
})
