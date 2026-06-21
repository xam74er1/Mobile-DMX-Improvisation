import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import type { Light } from '../store/lightsStore'
import type { LightState } from '../store/ambiancesStore'

export const STAGE_HEIGHT = 220
const LIGHT_W = 72
const LIGHT_H = 50
const GRID_COLS = 4
const GRID_ROWS = 3

interface Props {
  lights: Light[]
  /** Light states from the currently active ambiance, or null if none */
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
        {/* Subtle grid */}
        {stageW > 1 && <GridOverlay stageW={stageW} />}

        {/* Stage front bar */}
        <View style={styles.frontBar}>
          <Text style={styles.frontLabel}>▼  STAGE FRONT — AUDIENCE  ▼</Text>
        </View>

        {/* Draggable light nodes */}
        {stageW > 1 &&
          lights.map((light) => {
            const state = activeLightStates?.[light.id] ?? null
            const color = state?.isOn ? computeColor(state) : '#252525'
            return (
              <DraggableLight
                key={light.id}
                light={light}
                color={color}
                stageW={stageW}
                onMove={(x, y) => onLightMove(light.id, x, y)}
                onTap={() => onLightTap(light)}
              />
            )
          })}

        {lights.length === 0 && (
          <View style={styles.emptyStage}>
            <Text style={styles.emptyStageText}>No lights — add one below</Text>
          </View>
        )}
      </View>
      <Text style={styles.dragHint}>Hold & drag to reposition · Tap to configure</Text>
    </View>
  )
}

// ── Grid overlay ──────────────────────────────────────────────────────────────
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
        <View key={`v${x}`} style={[styles.gridLineV, { left: x }]} />
      ))}
      {hLines.map((y) => (
        <View key={`h${y}`} style={[styles.gridLineH, { top: y }]} />
      ))}
    </>
  )
}

// ── Draggable light node ──────────────────────────────────────────────────────
interface DLProps {
  light: Light
  color: string
  stageW: number
  onMove: (x: number, y: number) => void
  onTap: () => void
}

function DraggableLight({ light, color, stageW, onMove, onTap }: DLProps) {
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const sc = useSharedValue(1)
  const dragging = useSharedValue(false)

  // Absolute pixel position of the light's top-left corner
  const absX = light.sceneX * stageW - LIGHT_W / 2
  const absY = light.sceneY * STAGE_HEIGHT - LIGHT_H / 2

  const isDark = isColorDark(color)

  const pan = Gesture.Pan()
    .onStart(() => {
      dragging.value = true
      sc.value = withTiming(1.12, { duration: 120 })
    })
    .onUpdate((e) => {
      tx.value = e.translationX
      ty.value = e.translationY
    })
    .onEnd((e) => {
      const moved = Math.abs(e.translationX) > 6 || Math.abs(e.translationY) > 6
      if (moved) {
        const newCX = absX + LIGHT_W / 2 + tx.value
        const newCY = absY + LIGHT_H / 2 + ty.value
        const nx = Math.max(0.04, Math.min(0.96, newCX / stageW))
        const ny = Math.max(0.04, Math.min(0.96, newCY / STAGE_HEIGHT))
        runOnJS(onMove)(nx, ny)
      } else {
        runOnJS(onTap)()
      }
      tx.value = withSpring(0, { damping: 20 })
      ty.value = withSpring(0, { damping: 20 })
      sc.value = withSpring(1)
      dragging.value = false
    })

  const animStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: absX + tx.value,
    top: absY + ty.value,
    width: LIGHT_W,
    height: LIGHT_H,
    transform: [{ scale: sc.value }],
    zIndex: dragging.value ? 20 : 1,
    elevation: dragging.value ? 12 : 3,
  }))

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.lightNode,
          animStyle,
          {
            backgroundColor: color,
            shadowColor: color === '#252525' ? '#000' : color,
          },
        ]}
      >
        {/* Glow indicator dot */}
        <View
          style={[
            styles.glowDot,
            { backgroundColor: color === '#252525' ? '#444' : '#fff' },
          ]}
        />
        <Text
          style={[styles.lightName, { color: isDark ? '#ffffff' : '#000000' }]}
          numberOfLines={1}
        >
          {light.name}
        </Text>
        <Text
          style={[
            styles.lightMeta,
            { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' },
          ]}
        >
          ch{light.dmxAddress} · {light.channelMode}
        </Text>
      </Animated.View>
    </GestureDetector>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function computeColor(state: LightState): string {
  const ratio = state.intensity / 100
  const r = Math.min(255, Math.round((state.r + state.w) * ratio))
  const g = Math.min(255, Math.round((state.g + state.w) * ratio))
  const b = Math.min(255, Math.round((state.b + state.w) * ratio))
  if (r === 0 && g === 0 && b === 0) return '#252525'
  return `rgb(${r},${g},${b})`
}

function isColorDark(rgb: string): boolean {
  const m = rgb.match(/\d+/g)
  if (!m || m.length < 3) return true
  return parseInt(m[0]) * 0.299 + parseInt(m[1]) * 0.587 + parseInt(m[2]) * 0.114 < 140
}

const styles = StyleSheet.create({
  stage: {
    height: STAGE_HEIGHT,
    backgroundColor: '#060c15',
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#152030',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    width: 1,
    height: STAGE_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  frontBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frontLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 2,
    fontWeight: '700',
  },
  emptyStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStageText: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 13,
  },
  dragHint: {
    fontSize: 11,
    color: '#3a3a3a',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  lightNode: {
    borderRadius: 9,
    padding: 7,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
  },
  glowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
    opacity: 0.8,
  },
  lightName: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  lightMeta: {
    fontSize: 8,
    marginTop: 1,
    lineHeight: 10,
  },
})
