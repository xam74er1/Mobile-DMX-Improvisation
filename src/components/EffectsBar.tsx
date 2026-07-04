import React, { useState, useEffect, useRef } from 'react'
import { View, StyleSheet, ScrollView, Pressable } from 'react-native'
import { Text, Switch } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import Slider from './AppSlider'
import { EFFECT_PRESETS, type RGBW } from '../effects/presets'
import { effectsRunner, type AmbianceEffect } from '../effects/runner'
import { DEFAULT_COLORS } from '../constants/defaultColors'

const GLOBAL_PREFIX = 'global-'

interface EffectColors {
  fromColor?: RGBW
  colorB?: RGBW
  toColor?: RGBW
}

export function EffectsBar() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [bpm, setBpm] = useState(120)
  const [repeat, setRepeat] = useState(true)
  // Per-preset color overrides — persisted across preset switches
  const [effectColors, setEffectColors] = useState<Record<string, EffectColors>>({})
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    tickRef.current = setInterval(() => {
      const running = EFFECT_PRESETS.find((p) =>
        effectsRunner.isSlotRunning(`${GLOBAL_PREFIX}${p.id}`),
      )
      setActiveId(running?.id ?? null)
    }, 150)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  function buildEffect(presetId: string, colors: EffectColors): AmbianceEffect {
    const preset = EFFECT_PRESETS.find((p) => p.id === presetId)!
    return {
      id: `${GLOBAL_PREFIX}${presetId}`,
      presetId,
      targetLightIds: 'all',
      bpm: preset.bpmScaled ? bpm : preset.defaultBpm,
      repeat: preset.defaultRepeat ? repeat : false,
      durationMs: preset.defaultDurationMs,
      maxIntensity: 100,
      fromColor: colors.fromColor,
      colorB: colors.colorB,
      toColor: colors.toColor,
    }
  }

  function handlePress(presetId: string) {
    const slotId = `${GLOBAL_PREFIX}${presetId}`
    if (effectsRunner.isSlotRunning(slotId)) {
      effectsRunner.stopSlot(slotId)
      setActiveId(null)
      return
    }
    effectsRunner.startSlot(buildEffect(presetId, effectColors[presetId] ?? {}))
    setActiveId(presetId)
  }

  function setColor(key: keyof EffectColors, color: RGBW) {
    if (!activeId) return
    const next: EffectColors = { ...(effectColors[activeId] ?? {}), [key]: color }
    setEffectColors((prev) => ({ ...prev, [activeId]: next }))
    // Restart slot immediately so the color takes effect live
    effectsRunner.startSlot(buildEffect(activeId, next))
  }

  const selectedPreset = EFFECT_PRESETS.find((p) => p.id === activeId)
  const activeColors: EffectColors = activeId ? (effectColors[activeId] ?? {}) : {}

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>EFFECTS</Text>
        {activeId && (
          <Pressable
            onPress={() => {
              effectsRunner.stopSlot(`${GLOBAL_PREFIX}${activeId}`)
              setActiveId(null)
            }}
            style={styles.stopBtn}
          >
            <MaterialIcons name="stop" size={14} color="#fff" />
            <Text style={styles.stopBtnText}>STOP</Text>
          </Pressable>
        )}
      </View>

      {/* Preset buttons */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
        {EFFECT_PRESETS.map((preset) => {
          const isActive = activeId === preset.id
          return (
            <Pressable
              key={preset.id}
              onPress={() => handlePress(preset.id)}
              style={[styles.presetBtn, isActive && styles.presetBtnActive]}
            >
              <MaterialIcons name={preset.icon as any} size={22} color={isActive ? '#fff' : '#aaa'} />
              <Text style={[styles.presetName, isActive && styles.presetNameActive]}>{preset.name}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Color pickers — shown for active color effects only */}
      {selectedPreset && !selectedPreset.intensityOnly && (
        <View style={styles.colorSection}>
          {selectedPreset.kind === 'alternate' ? (
            <>
              <ColorRow
                label="A"
                current={activeColors.fromColor ?? selectedPreset.color}
                onSelect={(c) => setColor('fromColor', c)}
              />
              <ColorRow
                label="B"
                current={activeColors.colorB ?? selectedPreset.colorB ?? selectedPreset.color}
                onSelect={(c) => setColor('colorB', c)}
              />
            </>
          ) : selectedPreset.kind === 'color_transition' ? (
            <>
              <ColorRow
                label="From"
                current={activeColors.fromColor ?? selectedPreset.color}
                onSelect={(c) => setColor('fromColor', c)}
              />
              <ColorRow
                label="To"
                current={activeColors.toColor ?? selectedPreset.defaultToColor ?? selectedPreset.color}
                onSelect={(c) => setColor('toColor', c)}
              />
            </>
          ) : (
            <ColorRow
              label="Color"
              current={activeColors.fromColor ?? selectedPreset.color}
              onSelect={(c) => setColor('fromColor', c)}
            />
          )}
        </View>
      )}

      {/* BPM + Repeat controls */}
      <View style={styles.controls}>
        <View style={styles.repeatRow}>
          <Text style={styles.controlLabel}>Repeat</Text>
          <Switch value={repeat} onValueChange={setRepeat} color="#ff6b35" />
        </View>

        {(!selectedPreset || selectedPreset.bpmScaled) && (
          <View style={styles.bpmRow}>
            <Text style={styles.controlLabel}>BPM</Text>
            <Text style={styles.bpmValue}>{bpm}</Text>
            <Slider
              value={bpm}
              onValueChange={setBpm}
              minimumValue={selectedPreset?.minBpm ?? 20}
              maximumValue={selectedPreset?.maxBpm ?? 1200}
              step={1}
              minimumTrackTintColor="#ff6b35"
              maximumTrackTintColor="#333"
              thumbTintColor="#ff6b35"
              style={styles.bpmSlider}
            />
          </View>
        )}
      </View>
    </View>
  )
}

// ── Color row component ────────────────────────────────────────────────────────

function ColorRow({
  label, current, onSelect,
}: {
  label: string
  current: RGBW
  onSelect: (c: RGBW) => void
}) {
  return (
    <View style={colorRowStyles.row}>
      <Text style={colorRowStyles.label}>{label}</Text>
      {DEFAULT_COLORS.map((c) => {
        const sel = c.r === current.r && c.g === current.g && c.b === current.b && c.w === current.w
        return (
          <Pressable
            key={c.hex}
            onPress={() => onSelect({ r: c.r, g: c.g, b: c.b, w: c.w })}
            style={[
              colorRowStyles.dot,
              { backgroundColor: c.w > 0 ? '#ffffff' : c.hex },
              sel && colorRowStyles.dotSel,
            ]}
          />
        )
      })}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#101010',
    borderTopWidth: 1,
    borderTopColor: '#1e1e1e',
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  title: { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 1.5 },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#e74c3c', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  stopBtnText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  presetRow: { paddingHorizontal: 12, gap: 8, paddingBottom: 8 },
  presetBtn: {
    width: 76, alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 6,
    borderWidth: 1, borderColor: '#2a2a2a', gap: 4,
  },
  presetBtnActive: { backgroundColor: '#ff6b35', borderColor: '#ff6b35' },
  presetName: { fontSize: 10, fontWeight: '700', color: '#ccc', textAlign: 'center' },
  presetNameActive: { color: '#fff' },
  colorSection: {
    paddingHorizontal: 16, paddingBottom: 6, gap: 4,
    borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingTop: 6,
  },
  controls: { paddingHorizontal: 16, gap: 4 },
  repeatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlLabel: { fontSize: 12, color: '#888' },
  bpmRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bpmValue: { fontSize: 13, fontWeight: '700', color: '#ff6b35', width: 38, textAlign: 'right' },
  bpmSlider: { flex: 1, height: 36 },
})

const colorRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 10, fontWeight: '700', color: '#666', width: 30 },
  dot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: 'transparent',
  },
  dotSel: { borderColor: '#ffffff' },
})
