import React, { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Path, Ellipse, Rect, Circle, Defs, RadialGradient, Stop, G,
} from 'react-native-svg'
import type { Light } from '../store/lightsStore'
import type { LightState } from '../store/ambiancesStore'
import { useZonesStore } from '../store/zonesStore'

// ─────────────────────────────────────────────────────────────
// Layout constants
// ─────────────────────────────────────────────────────────────
export const STAGE_HEIGHT = 240
const ICON_W = 48
const ICON_H = 96
// The lens/pivot sits this far down the icon (SVG y=30 / viewBox height=96 ≈ 0.31)
const LENS_Y_FRAC = 0.31
const LENS_SVG_X = 24   // lens centre in SVG coords
const LENS_SVG_Y = 30

// Minimum pixel distance between two lens centres (no overlap)
const MIN_DIST = ICON_W * 1.15

// Pixel padding so icons don't go outside stage bounds
const PAD_X = ICON_W / 2 + 2
const PAD_TOP = 28      // audience bar at top (height 24 + small gap)
const PAD_BOTTOM = 8    // small floor margin at the stage bottom

// ─────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────
interface Props {
  lights: Light[]
  activeLightStates: Record<string, LightState> | null
  onLightMove: (lightId: string, x: number, y: number) => void
  onLightTap: (light: Light) => void
}

export function SceneStage({ lights, activeLightStates, onLightMove, onLightTap }: Props) {
  const { t } = useTranslation()
  const [stageW, setStageW] = useState(1)
  const { zones, zonesEnabled } = useZonesStore()

  function handleMove(lightId: string, pxX: number, pxY: number) {
    // Clamp to stage bounds
    let cx = clamp(pxX, PAD_X, stageW - PAD_X)
    let cy = clamp(pxY, PAD_TOP, STAGE_HEIGHT - PAD_BOTTOM)

    // Repel from other lights (iterative)
    for (let iter = 0; iter < 8; iter++) {
      let moved = false
      for (const other of lights) {
        if (other.id === lightId) continue
        const ox = other.sceneX * stageW
        const oy = other.sceneY * STAGE_HEIGHT
        const dx = cx - ox
        const dy = cy - oy
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < MIN_DIST) {
          if (dist < 0.5) {
            cy -= MIN_DIST   // exactly same spot – push up
          } else {
            const angle = Math.atan2(dy, dx)
            cx = ox + Math.cos(angle) * MIN_DIST
            cy = oy + Math.sin(angle) * MIN_DIST
          }
          // Re-clamp after repulsion
          cx = clamp(cx, PAD_X, stageW - PAD_X)
          cy = clamp(cy, PAD_TOP, STAGE_HEIGHT - PAD_BOTTOM)
          moved = true
        }
      }
      if (!moved) break
    }

    onLightMove(lightId, cx / stageW, cy / STAGE_HEIGHT)
  }

  return (
    <View>
      <View
        style={styles.stage}
        onLayout={(e) => setStageW(e.nativeEvent.layout.width)}
      >
        {/* Zones (behind everything) */}
        {stageW > 1 && zonesEnabled &&
          zones.map((z) => (
            <View
              key={z.id}
              style={{
                position: 'absolute',
                left: z.x * stageW,
                top: z.y * STAGE_HEIGHT,
                width: z.w * stageW,
                height: z.h * (STAGE_HEIGHT - PAD_BOTTOM),
                backgroundColor: z.tint,
                borderRightWidth: 1,
                borderColor: z.border,
                justifyContent: 'flex-start',
                alignItems: 'center',
                paddingTop: 6,
              }}
            >
              <Text style={[styles.zoneLabel, { color: z.border }]}>{z.name}</Text>
            </View>
          ))}

        {stageW > 1 && <GridOverlay stageW={stageW} />}

        <View style={styles.audienceBar}>
          <Text style={styles.audienceLabel}>{t('components.sceneStage.audience')}</Text>
        </View>

        {lights.length === 0 && (
          <View style={styles.emptyMsg}>
            <Text style={styles.emptyText}>{t('components.sceneStage.emptyHint')}</Text>
          </View>
        )}

        {stageW > 1 &&
          lights.map((light) => {
            const amb = activeLightStates?.[light.id] ?? null
            const dc = light.defaultColor ?? { r: 255, g: 255, b: 255, w: 0 }
            const r = amb ? amb.r : dc.r
            const g = amb ? amb.g : dc.g
            const b = amb ? amb.b : dc.b
            const w = amb ? amb.w : dc.w
            const intensity = amb ? amb.intensity : (amb ? 100 : 60)
            const isOn = amb ? amb.isOn : false

            return (
              <DraggableLight
                key={light.id}
                light={light}
                r={r} g={g} b={b} w={w}
                intensity={intensity}
                isOn={isOn}
                stageW={stageW}
                allLights={lights}
                onMovePixel={(px, py) => handleMove(light.id, px, py)}
                onTap={() => onLightTap(light)}
              />
            )
          })}
      </View>
      <Text style={styles.hint}>{t('components.sceneStage.dragHint')}</Text>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────
// Grid
// ─────────────────────────────────────────────────────────────
function GridOverlay({ stageW }: { stageW: number }) {
  const vLines = [0.25, 0.5, 0.75].map((f) => Math.round(f * stageW))
  const hLines = [0.33, 0.66].map((f) => Math.round(f * STAGE_HEIGHT))
  return (
    <>
      {vLines.map((x) => <View key={`v${x}`} style={[styles.gridV, { left: x }]} />)}
      {hLines.map((y) => <View key={`h${y}`} style={[styles.gridH, { top: y }]} />)}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Stage light SVG icon — rotated around the lens pivot via <G>
// ─────────────────────────────────────────────────────────────
interface IconProps {
  r: number; g: number; b: number; w: number
  intensity: number
  isOn: boolean
  rotation: number    // degrees
  beamWidth: number
  width: number; height: number
}

function StageLightIcon({ r, g, b, w, intensity, isOn, rotation, beamWidth, width, height }: IconProps) {
  const ratio = intensity / 100
  const dr = Math.min(255, Math.round((r + w) * ratio))
  const dg = Math.min(255, Math.round((g + w) * ratio))
  const db = Math.min(255, Math.round((b + w) * ratio))
  const colorStr = `rgb(${dr},${dg},${db})`

  // Beam trapezoid path — spreads from just below lens (y=32) to bottom (y=90)
  const bw = clamp(beamWidth ?? 1.0, 0.3, 2.5)
  const halfBot = Math.round(8 + bw * 16)   // half-width at the wide end
  const beamPath =
    `M${LENS_SVG_X - 8},${LENS_SVG_Y + 2} ` +
    `L${LENS_SVG_X + 8},${LENS_SVG_Y + 2} ` +
    `L${LENS_SVG_X + halfBot},90 ` +
    `L${LENS_SVG_X - halfBot},90 Z`

  const rotateStr = `rotate(${rotation ?? 0}, ${LENS_SVG_X}, ${LENS_SVG_Y})`

  return (
    // overflow: visible lets the rotated beam spill beyond the SVG box
    <Svg width={width} height={height} viewBox="0 0 48 96" style={{ overflow: 'visible' }}>
      <Defs>
        <RadialGradient id={`bg${dr}${dg}${db}`} cx="50%" cy="5%" r="95%">
          <Stop offset="0%"   stopColor={colorStr} stopOpacity={isOn ? 0.60 : 0.05} />
          <Stop offset="100%" stopColor={colorStr} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`lg${dr}${dg}${db}`} cx="38%" cy="32%" r="65%">
          <Stop offset="0%"   stopColor="#ffffff"  stopOpacity={isOn ? 0.75 : 0.08} />
          <Stop offset="100%" stopColor={colorStr} stopOpacity={isOn ? 0.92 : 0.22} />
        </RadialGradient>
      </Defs>

      {/* Everything rotates together around the lens centre */}
      <G transform={rotateStr}>
        {/* ── Beam ── */}
        <Path d={beamPath} fill={`url(#bg${dr}${dg}${db})`} />

        {/* ── Truss / rigging bar ── */}
        <Rect x="4" y="2" width="40" height="5" rx="2.5" fill="#222222" />

        {/* ── Fixture body (trapezoid) ── */}
        <Path d="M13,6 L35,6 L37,25 L11,25 Z" fill="#3b3b3b" />

        {/* ── Yoke stub ── */}
        <Rect x="20" y="23" width="8" height="5" rx="2" fill="#505050" />

        {/* ── Lens housing ring ── */}
        <Ellipse cx={LENS_SVG_X} cy={LENS_SVG_Y} rx="11" ry="5" fill="#1e1e1e" />

        {/* ── Lens face ── */}
        <Ellipse
          cx={LENS_SVG_X} cy={LENS_SVG_Y} rx="9" ry="4"
          fill={`url(#lg${dr}${dg}${db})`}
        />

        {/* ── Lens specular dot ── */}
        {isOn && (
          <Circle cx={LENS_SVG_X - 3} cy={LENS_SVG_Y - 1} r="2.5"
            fill="rgba(255,255,255,0.45)" />
        )}
      </G>
    </Svg>
  )
}

// ─────────────────────────────────────────────────────────────
// Draggable wrapper
// ─────────────────────────────────────────────────────────────
interface DLProps {
  light: Light
  r: number; g: number; b: number; w: number
  intensity: number; isOn: boolean
  stageW: number
  allLights: Light[]
  onMovePixel: (pxX: number, pxY: number) => void
  onTap: () => void
}

function DraggableLight({ light, r, g, b, w, intensity, isOn, stageW, onMovePixel, onTap }: DLProps) {
  // icon top-left so lens is at (sceneX * stageW, sceneY * STAGE_H)
  const initLeft = () => light.sceneX * stageW - ICON_W / 2
  const initTop  = () => light.sceneY * STAGE_HEIGHT - ICON_H * LENS_Y_FRAC

  const posX   = useSharedValue(initLeft())
  const posY   = useSharedValue(initTop())
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const sc     = useSharedValue(1)
  const active = useSharedValue(false)
  const firstRender = useRef(true)

  useEffect(() => {
    const tx = initLeft()
    const ty = initTop()
    if (firstRender.current) {
      posX.value = tx
      posY.value = ty
      firstRender.current = false
    } else if (!active.value) {
      posX.value = withSpring(tx, { damping: 22 })
      posY.value = withSpring(ty, { damping: 22 })
    }
  }, [light.sceneX, light.sceneY, stageW])

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = posX.value
      startY.value = posY.value
      active.value = true
      sc.value = withTiming(1.12, { duration: 110 })
    })
    .onUpdate((e) => {
      posX.value = startX.value + e.translationX
      posY.value = startY.value + e.translationY
    })
    .onEnd((e) => {
      const moved = Math.abs(e.translationX) > 6 || Math.abs(e.translationY) > 6
      if (moved) {
        // Lens centre in pixels
        const lx = posX.value + ICON_W / 2
        const ly = posY.value + ICON_H * LENS_Y_FRAC
        // Pass to JS for clamping + overlap resolution → store update → useEffect re-positions
        runOnJS(onMovePixel)(lx, ly)
      } else {
        // Restore position (snap back) then open config
        posX.value = withSpring(startX.value, { damping: 20 })
        posY.value = withSpring(startY.value, { damping: 20 })
        runOnJS(onTap)()
      }
      sc.value = withSpring(1, { damping: 18 })
      active.value = false
    })

  const animStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: posX.value,
    top:  posY.value,
    width: ICON_W,
    zIndex: active.value ? 20 : 1,
    transform: [{ scale: sc.value }],
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
          intensity={intensity} isOn={isOn}
          rotation={light.rotation ?? 0}
          beamWidth={light.beamWidth ?? 1.0}
          width={ICON_W} height={ICON_H}
        />
        {/* Name badge — always horizontal, even when fixture is rotated */}
        <View style={[
          styles.badge,
          { backgroundColor: isOn ? `rgba(${dr},${dg},${db},0.22)` : 'rgba(30,30,30,0.85)' },
        ]}>
          <Text style={[styles.badgeText, { color: isOn && !isDark ? '#000' : '#fff' }]} numberOfLines={1}>
            {light.name}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  )
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
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
    position: 'absolute', top: 0,
    width: 1, height: STAGE_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  gridH: {
    position: 'absolute', left: 0,
    height: 1, width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  audienceBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center', alignItems: 'center',
  },
  audienceLabel: {
    fontSize: 8, color: 'rgba(255,255,255,0.18)',
    letterSpacing: 2.5, fontWeight: '700',
  },
  emptyMsg: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: 'rgba(255,255,255,0.12)', fontSize: 13 },
  hint: { fontSize: 11, color: '#333', textAlign: 'center', marginTop: 6, marginBottom: 4 },
  zoneLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1, opacity: 0.8 },
  badge: {
    alignSelf: 'center',
    marginTop: -2,
    paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 4,
    maxWidth: ICON_W + 20,
  },
  badgeText: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
})
