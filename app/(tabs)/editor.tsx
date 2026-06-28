import React, { useState, useEffect } from 'react'
import { ScrollView, StyleSheet, View, Pressable } from 'react-native'
import {
  Text, Button, Switch, Divider, Chip, Portal, Dialog,
  TextInput, IconButton, Checkbox,
} from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { useLocalSearchParams, useFocusEffect } from 'expo-router'
import Slider from '@react-native-community/slider'
import { SimpleColorPicker } from '../../src/components/SimpleColorPicker'
import { WheelColorPicker } from '../../src/components/WheelColorPicker'
import { IntensitySlider } from '../../src/components/IntensitySlider'
import { useAmbiancesStore, defaultLightState, type AmbianceEffect } from '../../src/store/ambiancesStore'
import { useLightsStore } from '../../src/store/lightsStore'
import { EFFECT_PRESETS, EFFECT_PRESET_MAP } from '../../src/effects/presets'
import { effectsRunner } from '../../src/effects/runner'
import { DEFAULT_COLORS } from '../../src/constants/defaultColors'

export default function EditorScreen() {
  const params = useLocalSearchParams<{ ambianceId?: string }>()
  const ambiances = useAmbiancesStore((s) => s.ambiances)
  const setLightState = useAmbiancesStore((s) => s.setLightState)
  const getLightState = useAmbiancesStore((s) => s.getLightState)
  const renameAmbiance = useAmbiancesStore((s) => s.renameAmbiance)
  const addEffect = useAmbiancesStore((s) => s.addEffect)
  const updateEffect = useAmbiancesStore((s) => s.updateEffect)
  const removeEffect = useAmbiancesStore((s) => s.removeEffect)
  const activeAmbianceId = useAmbiancesStore((s) => s.activeAmbianceId)
  const lights = useLightsStore((s) => s.lights)

  const initialAmbianceId = params.ambianceId ?? activeAmbianceId ?? ambiances[0]?.id ?? ''

  const [editingId, setEditingId] = useState<string>(initialAmbianceId)
  const [selectedLightId, setSelectedLightId] = useState<string>(() =>
    pickBestLight(initialAmbianceId, ambiances, lights),
  )
  const [allLights, setAllLights] = useState(false)
  const [renameDialog, setRenameDialog] = useState(false)
  const [renameInput, setRenameInput] = useState('')

  // Effect dialog state
  const [effectDialog, setEffectDialog] = useState<'add' | 'edit' | null>(null)
  const [editingEffect, setEditingEffect] = useState<AmbianceEffect | null>(null)

  // Every time the Editor tab gains focus, sync to the active ambiance and its best light.
  // useFocusEffect is needed because this is a persistent tab (useState init only runs once).
  useFocusEffect(
    React.useCallback(() => {
      const { activeAmbianceId: activeId, ambiances: ambs } = useAmbiancesStore.getState()
      const { lights: ls } = useLightsStore.getState()
      const id = params.ambianceId ?? activeId ?? ambs[0]?.id ?? ''
      setEditingId(id)
      setSelectedLightId(pickBestLight(id, ambs, ls))
    }, [params.ambianceId]),
  )

  useEffect(() => {
    if (lights.length > 0 && !lights.find((l) => l.id === selectedLightId)) {
      setSelectedLightId(pickBestLight(editingId, ambiances, lights))
    }
  }, [lights])

  const editingAmbiance = ambiances.find((a) => a.id === editingId)
  const activeState = editingId && selectedLightId
    ? getLightState(editingId, selectedLightId)
    : defaultLightState()

  const { r, g, b, w, intensity, isOn } = activeState

  function applyPatch(patch: Partial<typeof activeState>) {
    if (allLights) {
      for (const light of lights) setLightState(editingId, light.id, patch)
    } else if (selectedLightId) {
      setLightState(editingId, selectedLightId, patch)
    }
  }

  function openAddEffect() {
    setEditingEffect({
      id: `eff-${Math.random().toString(36).slice(2, 8)}`,
      presetId: EFFECT_PRESETS[0].id,
      targetLightIds: 'all',
      bpm: EFFECT_PRESETS[0].defaultBpm,
      repeat: EFFECT_PRESETS[0].defaultRepeat,
      durationMs: EFFECT_PRESETS[0].defaultDurationMs,
      maxIntensity: 100,
      fromColor: undefined,
      colorB: undefined,
      toColor: undefined,
    })
    setEffectDialog('add')
  }

  function openEditEffect(eff: AmbianceEffect) {
    setEditingEffect({ ...eff })
    setEffectDialog('edit')
  }

  function saveEffect() {
    if (!editingEffect) return
    if (effectDialog === 'add') {
      addEffect(editingId, editingEffect)
    } else {
      updateEffect(editingId, editingEffect)
    }
    // Restart ambiance effects if this is the active ambiance
    if (activeAmbianceId === editingId) {
      const updatedAmb = ambiances.find(a => a.id === editingId)
      if (updatedAmb) {
        const newEffects = effectDialog === 'add'
          ? [...(updatedAmb.effects ?? []), editingEffect]
          : (updatedAmb.effects ?? []).map(e => e.id === editingEffect.id ? editingEffect : e)
        effectsRunner.startAmbianceEffects(newEffects)
      }
    }
    setEffectDialog(null)
  }

  const currentHex = rgbToHex(r, g, b)

  if (ambiances.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No ambiances yet.</Text>
          <Text style={styles.emptyHint}>Go to the Control tab and tap + to create one.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Ambiance selector ── */}
        <View style={styles.ambHeader}>
          <Text style={styles.sectionLabel}>EDITING AMBIANCE</Text>
          <IconButton icon="pencil" size={16} iconColor="#ff6b35"
            onPress={() => { setRenameInput(editingAmbiance?.name ?? ''); setRenameDialog(true) }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {ambiances.map((a) => (
            <Chip key={a.id} selected={a.id === editingId} onPress={() => setEditingId(a.id)}
              selectedColor="#ff6b35" style={styles.chip} compact>
              {a.name}
            </Chip>
          ))}
        </ScrollView>

        <Divider style={styles.divider} />

        {/* ── Light selector ── */}
        <View style={styles.lightSelectorHeader}>
          <Text style={styles.sectionLabel}>SELECT LIGHT</Text>
          <View style={styles.allLightsRow}>
            <Text style={styles.allLightsLabel}>All Lights</Text>
            <Switch value={allLights} onValueChange={setAllLights} color="#ff6b35" />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lightTileRow}>
          {lights.map((light) => {
            const state = getLightState(editingId, light.id)
            const tileColor = getStateColor(state)
            const isSelected = light.id === selectedLightId && !allLights
            return (
              <Pressable key={light.id}
                onPress={() => { setSelectedLightId(light.id); setAllLights(false) }}
                style={[styles.lightTile, { backgroundColor: tileColor }, isSelected && styles.lightTileSelected]}>
                <View style={[styles.lightOnDot, { backgroundColor: state.isOn ? '#fff' : '#444' }]} />
                <Text style={styles.lightTileName} numberOfLines={2}>{light.name}</Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {lights.length === 0 && <Text style={styles.noLightsHint}>Add lights in Settings → Lights tab.</Text>}

        <Divider style={styles.divider} />

        {/* ── On/Off ── */}
        {!allLights && selectedLightId && (
          <View style={styles.onOffRow}>
            <Text style={styles.sectionLabel}>{lights.find((l) => l.id === selectedLightId)?.name ?? 'Light'}</Text>
            <View style={styles.onOffToggle}>
              <Text style={styles.onOffLabel}>{isOn ? 'ON' : 'OFF'}</Text>
              <Switch value={isOn} onValueChange={(v) => applyPatch({ isOn: v })} color="#ff6b35" />
            </View>
          </View>
        )}

        {/* ── Quick colors ── */}
        <Text style={styles.sectionLabel2}>QUICK COLORS</Text>
        <SimpleColorPicker
          onSelectColor={(nr, ng, nb, nw) => applyPatch({ r: nr, g: ng, b: nb, w: nw, isOn: true })}
          selectedHex={undefined}
        />

        <Divider style={styles.divider} />

        {/* ── Color wheel ── */}
        <Text style={styles.sectionLabel2}>COLOR WHEEL</Text>
        <WheelColorPicker currentHex={currentHex}
          onColorChange={(nr, ng, nb) => applyPatch({ r: nr, g: ng, b: nb, isOn: true })} />
        <IntensitySlider value={(w / 255) * 100}
          onChange={(v) => applyPatch({ w: Math.round(v * 2.55) })} label="White Channel" />

        <Divider style={styles.divider} />

        {/* ── Intensity ── */}
        <Text style={styles.sectionLabel2}>INTENSITY</Text>
        <IntensitySlider value={intensity} onChange={(v) => applyPatch({ intensity: v })} />

        <Divider style={styles.divider} />

        {/* ── Effects for this ambiance ── */}
        <View style={styles.effectsHeader}>
          <Text style={styles.sectionLabel2}>EFFECTS IN THIS AMBIANCE</Text>
          <Button icon="plus" mode="text" compact onPress={openAddEffect}>Add</Button>
        </View>

        {(editingAmbiance?.effects ?? []).length === 0 && (
          <Text style={styles.noEffectsHint}>
            No effects — tap Add to create one.{'\n'}
            Examples: Strobe Party, Heartbeat, Ocean Breathe have effects pre-configured.
          </Text>
        )}

        {(editingAmbiance?.effects ?? []).map((eff) => {
          const preset = EFFECT_PRESET_MAP[eff.presetId]
          if (!preset) return null
          const targetLabel = eff.targetLightIds === 'all'
            ? 'All lights'
            : lights.filter((l) => (eff.targetLightIds as string[]).includes(l.id)).map((l) => l.name).join(', ') || '—'
          const paramLabel = ['ramp_up','ramp_down','breathe','color_transition'].includes(preset.kind)
            ? `${(eff.durationMs / 1000).toFixed(1)}s`
            : `${eff.bpm} BPM`
          return (
            <View key={eff.id} style={styles.effectRow}>
              <MaterialIcons name={preset.icon as any} size={18} color="#ff6b35" />
              <View style={styles.effectRowInfo}>
                <Text style={styles.effectRowName}>{preset.name}</Text>
                <Text style={styles.effectRowMeta}>
                  {targetLabel} · {paramLabel} {eff.repeat ? '· Repeat' : '· Once'}
                </Text>
              </View>
              <IconButton icon="pencil" size={16} iconColor="#888" onPress={() => openEditEffect(eff)} />
              <IconButton icon="delete-outline" size={16} iconColor="#e74c3c"
                onPress={() => removeEffect(editingId, eff.id)} />
            </View>
          )
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Rename dialog ── */}
      <Portal>
        <Dialog visible={renameDialog} onDismiss={() => setRenameDialog(false)}>
          <Dialog.Title>Rename Ambiance</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Name" value={renameInput} onChangeText={setRenameInput} mode="outlined" autoFocus />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameDialog(false)}>Cancel</Button>
            <Button onPress={() => { if (renameInput.trim()) renameAmbiance(editingId, renameInput.trim()); setRenameDialog(false) }}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Add / Edit effect dialog ── */}
      <Portal>
        <Dialog visible={!!effectDialog} onDismiss={() => setEffectDialog(null)}>
          <Dialog.Title>{effectDialog === 'add' ? 'Add Effect' : 'Edit Effect'}</Dialog.Title>
          {editingEffect && (
            <Dialog.ScrollArea style={styles.effectScrollArea}>
              <ScrollView>
                {/* ── Preset picker (wrapped, not horizontal scroll) ── */}
                <Text style={styles.dialogLabel}>Effect Type</Text>
                <View style={styles.presetPickerWrap}>
                  {EFFECT_PRESETS.map((p) => {
                    const isActive = editingEffect.presetId === p.id
                    return (
                      <Pressable key={p.id}
                        onPress={() =>
                          setEditingEffect({
                            ...editingEffect,
                            presetId: p.id,
                            bpm: p.defaultBpm,
                            durationMs: p.defaultDurationMs,
                            repeat: p.defaultRepeat,
                            toColor: p.defaultToColor,
                            fromColor: undefined,
                            colorB: undefined,
                          })
                        }
                        style={[styles.presetPickBtn, isActive && styles.presetPickBtnActive]}
                      >
                        <MaterialIcons name={p.icon as any} size={18} color={isActive ? '#fff' : '#aaa'} />
                        <Text style={[styles.presetPickName, isActive && { color: '#fff' }]}>{p.name}</Text>
                      </Pressable>
                    )
                  })}
                </View>

                {/* ── Target lights ── */}
                <Text style={[styles.dialogLabel, { marginTop: 14 }]}>Target Lights</Text>

                {/* "All Lights" master toggle */}
                <Pressable
                  style={styles.allToggleRow}
                  onPress={() => {
                    if (editingEffect.targetLightIds === 'all') {
                      // Switch to individual mode — start with ALL selected
                      setEditingEffect({ ...editingEffect, targetLightIds: lights.map((l) => l.id) })
                    } else {
                      setEditingEffect({ ...editingEffect, targetLightIds: 'all' })
                    }
                  }}
                >
                  <Checkbox
                    status={editingEffect.targetLightIds === 'all' ? 'checked' : 'unchecked'}
                    color="#ff6b35"
                  />
                  <Text style={styles.allToggleLabel}>All Lights</Text>
                </Pressable>

                {/* Individual lights — always visible; tapping deselects when "all" */}
                {lights.map((light) => {
                  const isAll = editingEffect.targetLightIds === 'all'
                  const ids = isAll ? lights.map((l) => l.id) : (editingEffect.targetLightIds as string[])
                  const checked = ids.includes(light.id)
                  return (
                    <Pressable
                      key={light.id}
                      style={[styles.allToggleRow, { paddingLeft: 16 }]}
                      onPress={() => {
                        if (isAll) {
                          // Deselect just this one, switch to individual mode
                          setEditingEffect({
                            ...editingEffect,
                            targetLightIds: lights.filter((l) => l.id !== light.id).map((l) => l.id),
                          })
                        } else {
                          const newIds = checked
                            ? (editingEffect.targetLightIds as string[]).filter((id) => id !== light.id)
                            : [...(editingEffect.targetLightIds as string[]), light.id]
                          setEditingEffect({ ...editingEffect, targetLightIds: newIds })
                        }
                      }}
                    >
                      <Checkbox status={checked ? 'checked' : 'unchecked'} color="#ff6b35" />
                      <Text style={styles.allToggleLabel}>{light.name}</Text>
                    </Pressable>
                  )
                })}

                {/* BPM or Duration param */}
                {(() => {
                  const preset = EFFECT_PRESET_MAP[editingEffect.presetId]
                  if (!preset) return null
                  const isSmooth = ['ramp_up','ramp_down','breathe','color_transition'].includes(preset.kind)
                  if (isSmooth) {
                    const sec = editingEffect.durationMs / 1000
                    return (
                      <>
                        <Text style={[styles.dialogLabel, { marginTop: 12 }]}>
                          Duration: {sec.toFixed(1)} s
                        </Text>
                        <Slider value={sec}
                          onValueChange={(v) => setEditingEffect({ ...editingEffect, durationMs: Math.round(v * 1000) })}
                          minimumValue={0.5} maximumValue={30} step={0.5}
                          minimumTrackTintColor="#ff6b35" maximumTrackTintColor="#333" thumbTintColor="#ff6b35"
                          style={styles.slider} />
                      </>
                    )
                  }
                  return (
                    <>
                      <Text style={[styles.dialogLabel, { marginTop: 12 }]}>
                        Speed: {editingEffect.bpm} BPM
                      </Text>
                      <Slider value={editingEffect.bpm}
                        onValueChange={(v) => setEditingEffect({ ...editingEffect, bpm: Math.round(v) })}
                        minimumValue={preset.minBpm} maximumValue={preset.maxBpm} step={1}
                        minimumTrackTintColor="#ff6b35" maximumTrackTintColor="#333" thumbTintColor="#ff6b35"
                        style={styles.slider} />
                    </>
                  )
                })()}

                {/* Max intensity */}
                <Text style={[styles.dialogLabel, { marginTop: 10 }]}>
                  Max Intensity: {editingEffect.maxIntensity}%
                </Text>
                <Slider value={editingEffect.maxIntensity}
                  onValueChange={(v) => setEditingEffect({ ...editingEffect, maxIntensity: Math.round(v) })}
                  minimumValue={10} maximumValue={100} step={1}
                  minimumTrackTintColor="#ff6b35" maximumTrackTintColor="#333" thumbTintColor="#ff6b35"
                  style={styles.slider} />

                {/* Color pickers — shown only for effects that change color */}
                {(() => {
                  const preset = EFFECT_PRESET_MAP[editingEffect.presetId]
                  if (!preset) return null

                  if (preset.intensityOnly) {
                    return (
                      <View style={styles.intensityOnlyNote}>
                        <MaterialIcons name="palette" size={14} color="#555" />
                        <Text style={styles.intensityOnlyText}>
                          Uses each light's own color — only intensity changes
                        </Text>
                      </View>
                    )
                  }

                  if (preset.kind === 'color_transition') {
                    const fc = editingEffect.fromColor ?? preset.color
                    const tc = editingEffect.toColor ?? preset.defaultToColor
                    return (
                      <>
                        <Text style={[styles.dialogLabel, { marginTop: 10 }]}>From Color</Text>
                        <View style={styles.colorSwatchRow}>
                          {DEFAULT_COLORS.map((c) => {
                            const sel = fc && fc.r === c.r && fc.g === c.g && fc.b === c.b
                            return (
                              <Pressable key={`from-${c.hex}`}
                                onPress={() => setEditingEffect({ ...editingEffect, fromColor: { r: c.r, g: c.g, b: c.b, w: c.w } })}
                                style={[styles.colorSwatch, { backgroundColor: c.hex }, sel && styles.colorSwatchSel]} />
                            )
                          })}
                        </View>
                        <Text style={[styles.dialogLabel, { marginTop: 10 }]}>To Color</Text>
                        <View style={styles.colorSwatchRow}>
                          {DEFAULT_COLORS.map((c) => {
                            const sel = tc && tc.r === c.r && tc.g === c.g && tc.b === c.b
                            return (
                              <Pressable key={`to-${c.hex}`}
                                onPress={() => setEditingEffect({ ...editingEffect, toColor: { r: c.r, g: c.g, b: c.b, w: c.w } })}
                                style={[styles.colorSwatch, { backgroundColor: c.hex }, sel && styles.colorSwatchSel]} />
                            )
                          })}
                        </View>
                      </>
                    )
                  }

                  if (preset.kind === 'alternate') {
                    const ca = editingEffect.fromColor ?? preset.color
                    const cb = editingEffect.colorB ?? preset.colorB ?? preset.color
                    return (
                      <>
                        <Text style={[styles.dialogLabel, { marginTop: 10 }]}>Color A</Text>
                        <View style={styles.colorSwatchRow}>
                          {DEFAULT_COLORS.map((c) => {
                            const sel = ca && ca.r === c.r && ca.g === c.g && ca.b === c.b
                            return (
                              <Pressable key={`ca-${c.hex}`}
                                onPress={() => setEditingEffect({ ...editingEffect, fromColor: { r: c.r, g: c.g, b: c.b, w: c.w } })}
                                style={[styles.colorSwatch, { backgroundColor: c.hex }, sel && styles.colorSwatchSel]} />
                            )
                          })}
                        </View>
                        <Text style={[styles.dialogLabel, { marginTop: 10 }]}>Color B</Text>
                        <View style={styles.colorSwatchRow}>
                          {DEFAULT_COLORS.map((c) => {
                            const sel = cb && cb.r === c.r && cb.g === c.g && cb.b === c.b
                            return (
                              <Pressable key={`cb-${c.hex}`}
                                onPress={() => setEditingEffect({ ...editingEffect, colorB: { r: c.r, g: c.g, b: c.b, w: c.w } })}
                                style={[styles.colorSwatch, { backgroundColor: c.hex }, sel && styles.colorSwatchSel]} />
                            )
                          })}
                        </View>
                      </>
                    )
                  }

                  // heartbeat and any other single-color effect
                  const fc = editingEffect.fromColor ?? preset.color
                  return (
                    <>
                      <Text style={[styles.dialogLabel, { marginTop: 10 }]}>Flash Color</Text>
                      <View style={styles.colorSwatchRow}>
                        {DEFAULT_COLORS.map((c) => {
                          const sel = fc && fc.r === c.r && fc.g === c.g && fc.b === c.b
                          return (
                            <Pressable key={`fc-${c.hex}`}
                              onPress={() => setEditingEffect({ ...editingEffect, fromColor: { r: c.r, g: c.g, b: c.b, w: c.w } })}
                              style={[styles.colorSwatch, { backgroundColor: c.hex }, sel && styles.colorSwatchSel]} />
                          )
                        })}
                      </View>
                    </>
                  )
                })()}

                {/* Repeat */}
                {EFFECT_PRESET_MAP[editingEffect.presetId]?.defaultRepeat !== undefined && (
                  <Pressable style={styles.allToggleRow}
                    onPress={() => setEditingEffect({ ...editingEffect, repeat: !editingEffect.repeat })}>
                    <Checkbox status={editingEffect.repeat ? 'checked' : 'unchecked'} color="#ff6b35" />
                    <Text style={styles.allToggleLabel}>Repeat</Text>
                  </Pressable>
                )}

                <View style={{ height: 12 }} />
              </ScrollView>
            </Dialog.ScrollArea>
          )}
          <Dialog.Actions>
            <Button onPress={() => setEffectDialog(null)}>Cancel</Button>
            <Button onPress={saveEffect}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  )
}

function pickBestLight(
  ambianceId: string,
  ambiances: { id: string; lightStates: Record<string, { isOn?: boolean; r?: number; g?: number; b?: number; w?: number }> }[],
  lights: { id: string }[],
): string {
  if (lights.length === 0) return ''
  const ambiance = ambiances.find((a) => a.id === ambianceId)
  if (ambiance) {
    // Priority 1: first light with explicitly stored state that is ON and has color
    for (const light of lights) {
      const s = ambiance.lightStates[light.id]
      if (s && s.isOn && ((s.r ?? 0) > 0 || (s.g ?? 0) > 0 || (s.b ?? 0) > 0 || (s.w ?? 0) > 0)) return light.id
    }
    // Priority 2: first light with any explicitly stored state
    for (const light of lights) {
      if (ambiance.lightStates[light.id]) return light.id
    }
  }
  return lights[0].id
}

function getStateColor(state: ReturnType<typeof defaultLightState>): string {
  if (!state.isOn) return '#1c1c1c'
  const ratio = state.intensity / 100
  const r = Math.min(255, Math.round((state.r + state.w) * ratio))
  const g = Math.min(255, Math.round((state.g + state.w) * ratio))
  const b = Math.min(255, Math.round((state.b + state.w) * ratio))
  if (r === 0 && g === 0 && b === 0) return '#1c1c1c'
  return `rgb(${r},${g},${b})`
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { paddingTop: 8 },
  ambHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 4, paddingTop: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 1.5 },
  sectionLabel2: { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 1.5, marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  chipRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  chip: { backgroundColor: '#1a1a1a' },
  divider: { backgroundColor: '#1e1e1e', marginVertical: 8 },
  lightSelectorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4 },
  allLightsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  allLightsLabel: { fontSize: 13, color: '#aaa' },
  lightTileRow: { paddingHorizontal: 16, gap: 10, paddingVertical: 12 },
  lightTile: { width: 80, height: 80, borderRadius: 12, padding: 8, justifyContent: 'flex-end', borderWidth: 2, borderColor: 'transparent' },
  lightTileSelected: { borderColor: '#ffffff' },
  lightOnDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  lightTileName: { fontSize: 11, fontWeight: '600', color: '#ffffff' },
  noLightsHint: { color: '#555', fontSize: 13, textAlign: 'center', marginVertical: 16, paddingHorizontal: 16 },
  onOffRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 4 },
  onOffToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onOffLabel: { color: '#aaa', fontSize: 13 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: '#fff', fontSize: 16, marginBottom: 8 },
  emptyHint: { color: '#666', fontSize: 13, textAlign: 'center' },

  // Effects section
  effectsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 },
  noEffectsHint: { color: '#444', fontSize: 12, marginHorizontal: 16, marginBottom: 8, lineHeight: 18 },
  effectRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414', borderRadius: 10, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  effectRowInfo: { flex: 1 },
  effectRowName: { fontSize: 13, fontWeight: '600', color: '#fff' },
  effectRowMeta: { fontSize: 10, color: '#666', marginTop: 2 },

  // Effect dialog
  effectScrollArea: { maxHeight: 500 },
  dialogLabel: { fontSize: 12, color: '#888', marginBottom: 4, marginTop: 4 },
  // Presets wrap to multiple lines instead of horizontal scroll
  presetPickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  presetPickBtn: { width: 74, alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 4, gap: 4, borderWidth: 1, borderColor: '#2a2a2a' },
  presetPickBtnActive: { backgroundColor: '#ff6b35', borderColor: '#ff6b35' },
  presetPickName: { fontSize: 9, fontWeight: '700', color: '#aaa', textAlign: 'center' },
  allToggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  allToggleLabel: { fontSize: 14, color: '#ccc', marginLeft: 4 },
  slider: { width: '100%', height: 36 },
  colorSwatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  colorSwatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchSel: { borderColor: '#fff' },
  intensityOnlyNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, padding: 8, backgroundColor: '#1a1a1a', borderRadius: 8,
  },
  intensityOnlyText: { fontSize: 11, color: '#555', flex: 1 },
})
