import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Path, Ellipse, Rect, Circle, Defs,
  RadialGradient, Stop, G,
} from 'react-native-svg'
import type { Light } from '../store/lightsStore'
import type { LightState } from '../store/ambiancesStore'

// ── Layout constants ──────────────────────────────────────────
export const STAGE_HEIGHT = 240
const ICON_W = 48    // total icon width  (SVG viewBox width)
const ICON_H = 96    // total icon height (SVG viewBox height)
// The "head" of the fixture sits at ~28% down the icon
const HEAD_Y_FRAC = 0.28
const GRID_COLS = 4
const GRID_ROWS = 3

// ── Public interface ──────────────────────────────────────────
interface Props {
  lights: Light[]
  /** Color to display — from active ambiance or test mode. null = show defaultColor */
  activeLightStates: Record<string, LightState> | null
  onLightMove: (lightId: string, x: number, y: number) => void
  onLightTap: (light: Light) => void
}

export function SceneStage({ lights, activeLightStates, onLightMove, onLightTap }: Props) {
  const [stageW, setStageW] = useState(1)

  return (
    <View>
      <View
        style={styles.stage}
        onLayout={(e) => setStageW(e.nativeEvent.layout.width)}
      >
        {stageW > 1 && <GridOverlay stageW={stageW} />}

        {/* Audience bar at bottom */}
        <View style={styles.audienceBar}>
          <Text style={styles.audienceLabel}>▼  AUDIENCE  ▼</Text>
        </View>

        {lights.length === 0 && (
          <View style={styles.emptyMsg}>
            <Text style={styles.emptyText}>Add lights below to see them here</Text>
          </View>
        )}

        {stageW > 1 &&
          lights.map((light) => {
            // Resolve color: active ambiance > default color > dim fallback
            const amb = activeLightStates?.[light.id] ?? null
            let r = light.defaultColor.r
            let g = light.defaultColor.g
            let b = light.defaultColor.b
            let w = light.defaultColor.w
            let intensity = 100
            let isOn = false  // off when no ambiance

            if (amb) {
              r = amb.r; g = amb.g; b = amb.b; w = amb.w
              intensity = amb.intensity
              isOn = amb.isOn
            }

            return (
              <DraggableLight
                key={light.id}
                light={light}
                r={r} g={g} b={b} w={w}
                intensity={intensity}
                isOn={isOn}
                stageW={stageW}
                onMove={(x, y) => onLightMove(light.id, x, y)}
                onTap={() => onLightTap(light)}
              />
            )
          })}
      </View>
      <Text style={styles.hint}>Drag lights to reposition · Tap to configure</Text>
    </View>
  )
}

// ── Grid ──────────────────────────────────────────────────────
function GridOverlay({ stageW }: { stageW: number }) {
  const vLines = Array.from({ length: GRID_COLS - 1 }, (_, i) =>
    Math.round((stageW / GRID_COLS) * (i + 1)),
  )
  const hLines = Array.from({ length: GRID_ROWS - 1 }, (_, i) =>
    Math.round((STAGE_HEIGHT / GRID_ROWS) * (i + 1)),
  )
  return (
    <>
      {vLines.map((x) => (
        <View key={`v${x}`} style={[styles.gridV, { left: x }]} />
      ))}
      {hLines.map((y) => (
        <View key={`h${y}`} style={[styles.gridH, { top: y }]} />
      ))}
    </>
  )
}

// ── Stage light SVG icon ──────────────────────────────────────
interface LightIconProps {
  r: number; g: number; b: number; w: number
  intensity: number
  isOn: boolean
  width: number
  height: number
}

function StageLightIcon({ r, g, b, w, intensity, isOn, width, height }: LightIconProps) {
  const ratio = intensity / 100
  const dr = Math.min(255, Math.round((r + w) * ratio))
  const dg = Math.min(255, Math.round((g + w) * ratio))
  const db = Math.min(255, Math.round((b + w) * ratio))
  const colorStr = `rgb(${dr},${dg},${db})`
  const dimColor = `rgba(${dr},${dg},${db},0.12)`

  // SVG coordinate system: 48 × 96
  return (
    <Svg width={width} height={height} viewBox="0 0 48 96">
      <Defs>
        <RadialGradient id="beamGrad" cx="50%" cy="0%" r="100%">
          <Stop offset="0%" stopColor={colorStr} stopOpacity={isOn ? 0.55 : 0.06} />
          <Stop offset="100%" stopColor={colorStr} stopOpacity={isOn ? 0.05 : 0} />
        </RadialGradient>
        <RadialGradient id="lensGrad" cx="40%" cy="35%" r="65%">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity={isOn ? 0.7 : 0.1} />
          <Stop offset="100%" stopColor={colorStr} stopOpacity={isOn ? 0.9 : 0.25} />
        </RadialGradient>
      </Defs>

      {/* ── Beam cone (behind everything else) ── */}
      <Path
        d="M16,32 L32,32 L46,92 L2,92 Z"
        fill="url(#beamGrad)"
      />
      {/* Soft beam center line */}
      {isOn && (
        <Path
          d="M24,32 L24,92"
          stroke={colorStr}
          strokeWidth={isOn ? 1.5 : 0}
          strokeOpacity={0.18}
        />
      )}

      {/* ── Rigging bar / truss ── */}
      <Rect x="4" y="2" width="40" height="5" rx="2.5" fill="#2a2a2a" />

      {/* ── Fixture body (trapezoid) ── */}
      <Path d="M13,7 L35,7 L37,26 L11,26 Z" fill="#3c3c3c" />

      {/* ── Knuckle / pan-tilt joint ── */}
      <Rect x="20" y="24" width="8" height="5" rx="2" fill="#555" />

      {/* ── Lens housing ring ── */}
      <Ellipse cx="24" cy="30" rx="11" ry="5" fill="#2a2a2a" />

      {/* ── Lens face ── */}
      <Ellipse cx="24" cy="30" rx="9" ry="4" fill="url(#lensGrad)" />

      {/* ── Name label position marker ── (not rendered, used for layout reference) */}
    </Svg>
  )
}

// ── Draggable light node ──────────────────────────────────────
interface DLProps {
  light: Light
  r: number; g: number; b: number; w: number
  intensity: number
  isOn: boolean
  stageW: number
  onMove: (x: number, y: number) => void
  onTap: () => void
}

function DraggableLight({ light, r, g, b, w, intensity, isOn, stageW, onMove, onTap }: DLProps) {
  // Absolute pixel position of the icon's top-left, so the HEAD is at (sceneX, sceneY)
  const initX = () => light.sceneX * stageW - ICON_W / 2
  const initY = () => light.sceneY * STAGE_HEIGHT - ICON_H * HEAD_Y_FRAC

  // Shared values own the position — never go through JS bridge during drag
  const posX = useSharedValue(initX())
  const posY = useSharedValue(initY())
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const sc = useSharedValue(1)
  const dragging = useSharedValue(false)

  // Sync when store position changes (e.g. after first mount or external reset)
  useEffect(() => {
    posX.value = initX()
    posY.value = initY()
  }, [light.sceneX, light.sceneY, stageW])

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = posX.value
      startY.value = posY.value
      dragging.value = true
      sc.value = withTiming(1.12, { duration: 100 })
    })
    .onUpdate((e) => {
      posX.value = startX.value + e.translationX
      posY.value = startY.value + e.translationY
    })
    .onEnd((e) => {
      const moved = Math.abs(e.translationX) > 6 || Math.abs(e.translationY) > 6

      if (moved) {
        // Convert back to normalised coords using the HEAD point
        const headCX = posX.value + ICON_W / 2
        const headCY = posY.value + ICON_H * HEAD_Y_FRAC

        const nx = Math.max(0.04, Math.min(0.96, headCX / stageW))
        const ny = Math.max(0.04, Math.min(0.88, headCY / STAGE_HEIGHT))

        // Snap icon to clamped position immediately
        posX.value = nx * stageW - ICON_W / 2
        posY.value = ny * STAGE_HEIGHT - ICON_H * HEAD_Y_FRAC

        runOnJS(onMove)(nx, ny)
      } else {
        // Short tap — restore position & open config
        posX.value = withSpring(startX.value, { damping: 20 })
        posY.value = withSpring(startY.value, { damping: 20 })
        runOnJS(onTap)()
      }

      sc.value = withSpring(1, { damping: 18 })
      dragging.value = false
    })

  const animStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: posX.value,
    top: posY.value,
    width: ICON_W,
    height: ICON_H,
    transform: [{ scale: sc.value }],
    zIndex: dragging.value ? 20 : 1,
  }))

  const ratio = intensity / 100
  const dr = Math.min(255, Math.round((r + w) * ratio))
  const dg = Math.min(255, Math.round((g + w) * ratio))
  const db = Math.min(255, Math.round((b + w) * ratio))
  const isDark = dr * 0.299 + dg * 0.587 + db * 0.114 < 130

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={animStyle}>
        <StageLightIcon
          r={r} g={g} b={b} w={w}
          intensity={intensity}
          isOn={isOn}
          width={ICON_W}
          height={ICON_H}
        />
        {/* Name badge below icon */}
        <View
          style={[
            styles.nameBadge,
            {
              backgroundColor: isOn
                ? `rgba(${dr},${dg},${db},0.25)`
                : 'rgba(40,40,40,0.85)',
            },
          ]}
        >
          <Text
            style={[styles.nameBadgeText, { color: isOn && !isDark ? '#000' : '#fff' }]}
            numberOfLines={1}
          >
            {light.name}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  stage: {
    height: STAGE_HEIGHT,
    backgroundColor: '#060c15',
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#12213a',
  },
  gridV: {
    position: 'absolute',
    top: 0,
    width: 1,
    height: STAGE_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  gridH: {
    position: 'absolute',
    left: 0,
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  audienceBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audienceLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.18)',
    letterSpacing: 2.5,
    fontWeight: '700',
  },
  emptyMsg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.12)',
    fontSize: 13,
  },
  hint: {
    fontSize: 11,
    color: '#333',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  nameBadge: {
    marginTop: -4,
    alignSelf: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: ICON_W + 20,
  },
  nameBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
})
