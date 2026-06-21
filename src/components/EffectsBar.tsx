import React, { useState, useEffect, useRef } from 'react'
import { View, StyleSheet, ScrollView, Pressable } from 'react-native'
import { Text, Switch, Divider } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import Slider from '@react-native-community/slider'
import { EFFECT_PRESETS } from '../effects/presets'
import { effectsRunner } from '../effects/runner'

export function EffectsBar() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [bpm, setBpm] = useState(120)
  const [repeat, setRepeat] = useState(true)
  // Poll runner state (runner is not a Zustand store)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    tickRef.current = setInterval(() => {
      setActiveId(effectsRunner.activeId)
    }, 150)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  function handlePress(id: string) {
    const preset = EFFECT_PRESETS.find((p) => p.id === id)!
    if (activeId === id) {
      effectsRunner.stop()
      setActiveId(null)
    } else {
      const effectiveBpm = preset.bpmScaled ? bpm : preset.defaultBpm
      effectsRunner.start(preset, effectiveBpm, preset.defaultRepeat ? repeat : false)
      setActiveId(id)
    }
  }

  const selectedPreset = EFFECT_PRESETS.find((p) => p.id === activeId)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>EFFECTS</Text>
        {activeId && (
          <Pressable onPress={() => { effectsRunner.stop(); setActiveId(null) }} style={styles.stopBtn}>
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
              <MaterialIcons
                name={preset.icon as any}
                size={22}
                color={isActive ? '#fff' : '#aaa'}
              />
              <Text style={[styles.presetName, isActive && styles.presetNameActive]}>
                {preset.name}
              </Text>
              <Text style={styles.presetDesc} numberOfLines={1}>
                {preset.description.split(' — ')[0]}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Repeat toggle */}
        <View style={styles.repeatRow}>
          <Text style={styles.controlLabel}>Repeat</Text>
          <Switch value={repeat} onValueChange={setRepeat} color="#ff6b35" />
        </View>

        {/* BPM slider — only show for BPM-scaled presets or when nothing selected */}
        {(!selectedPreset || selectedPreset.bpmScaled) && (
          <View style={styles.bpmRow}>
            <Text style={styles.controlLabel}>BPM</Text>
            <Text style={styles.bpmValue}>{bpm}</Text>
            <Slider
              value={bpm}
              onValueChange={setBpm}
              minimumValue={selectedPreset?.minBpm ?? 30}
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
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 1.5,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e74c3c',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stopBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  presetRow: {
    paddingHorizontal: 12,
    gap: 8,
    paddingBottom: 8,
  },
  presetBtn: {
    width: 82,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 4,
  },
  presetBtnActive: {
    backgroundColor: '#ff6b35',
    borderColor: '#ff6b35',
  },
  presetName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ccc',
    textAlign: 'center',
  },
  presetNameActive: {
    color: '#fff',
  },
  presetDesc: {
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
  },
  controls: {
    paddingHorizontal: 16,
    gap: 4,
  },
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlLabel: {
    fontSize: 12,
    color: '#888',
  },
  bpmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bpmValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff6b35',
    width: 38,
    textAlign: 'right',
  },
  bpmSlider: {
    flex: 1,
    height: 36,
  },
})
