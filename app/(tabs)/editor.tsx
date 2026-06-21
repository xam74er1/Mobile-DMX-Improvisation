import React, { useState, useEffect } from 'react'
import { ScrollView, StyleSheet, View, Pressable } from 'react-native'
import { Text, Button, Switch, Divider, Chip, Portal, Dialog, TextInput, IconButton } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { SimpleColorPicker } from '../../src/components/SimpleColorPicker'
import { WheelColorPicker } from '../../src/components/WheelColorPicker'
import { IntensitySlider } from '../../src/components/IntensitySlider'
import { useAmbiancesStore, defaultLightState } from '../../src/store/ambiancesStore'
import { useLightsStore } from '../../src/store/lightsStore'

export default function EditorScreen() {
  const params = useLocalSearchParams<{ ambianceId?: string }>()

  const ambiances = useAmbiancesStore((s) => s.ambiances)
  const setLightState = useAmbiancesStore((s) => s.setLightState)
  const getLightState = useAmbiancesStore((s) => s.getLightState)
  const renameAmbiance = useAmbiancesStore((s) => s.renameAmbiance)

  const lights = useLightsStore((s) => s.lights)

  // Which ambiance is being edited
  const [editingId, setEditingId] = useState<string>(
    params.ambianceId ?? ambiances[0]?.id ?? '',
  )
  // Which light is currently selected for color editing
  const [selectedLightId, setSelectedLightId] = useState<string>(lights[0]?.id ?? '')
  // All-lights toggle
  const [allLights, setAllLights] = useState(false)
  // Rename dialog
  const [renameDialog, setRenameDialog] = useState(false)
  const [renameInput, setRenameInput] = useState('')

  // Sync if params change (navigated from Panel 1)
  useEffect(() => {
    if (params.ambianceId) setEditingId(params.ambianceId)
  }, [params.ambianceId])

  // Auto-select first light when lights change
  useEffect(() => {
    if (lights.length > 0 && !lights.find((l) => l.id === selectedLightId)) {
      setSelectedLightId(lights[0].id)
    }
  }, [lights])

  const editingAmbiance = ambiances.find((a) => a.id === editingId)

  const activeState = editingId && selectedLightId
    ? getLightState(editingId, selectedLightId)
    : defaultLightState()

  const { r, g, b, w, intensity, isOn } = activeState

  function applyPatch(patch: Partial<typeof activeState>) {
    if (allLights) {
      for (const light of lights) {
        setLightState(editingId, light.id, patch)
      }
    } else if (selectedLightId) {
      setLightState(editingId, selectedLightId, patch)
    }
  }

  function handleSwatchColor(nr: number, ng: number, nb: number, nw: number) {
    applyPatch({ r: nr, g: ng, b: nb, w: nw, isOn: true })
  }

  function handleWheelColor(nr: number, ng: number, nb: number) {
    applyPatch({ r: nr, g: ng, b: nb, isOn: true })
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
          <IconButton
            icon="pencil"
            size={16}
            iconColor="#ff6b35"
            onPress={() => {
              setRenameInput(editingAmbiance?.name ?? '')
              setRenameDialog(true)
            }}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {ambiances.map((a) => (
            <Chip
              key={a.id}
              selected={a.id === editingId}
              onPress={() => setEditingId(a.id)}
              selectedColor="#ff6b35"
              style={styles.chip}
              compact
            >
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
              <Pressable
                key={light.id}
                onPress={() => {
                  setSelectedLightId(light.id)
                  setAllLights(false)
                }}
                style={[
                  styles.lightTile,
                  { backgroundColor: tileColor },
                  isSelected && styles.lightTileSelected,
                ]}
              >
                <View style={[styles.lightOnDot, { backgroundColor: state.isOn ? '#fff' : '#444' }]} />
                <Text style={styles.lightTileName} numberOfLines={2}>
                  {light.name}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {lights.length === 0 && (
          <Text style={styles.noLightsHint}>Add lights in Settings → Lights tab first.</Text>
        )}

        <Divider style={styles.divider} />

        {/* ── On/Off for selected light ── */}
        {!allLights && selectedLightId && (
          <View style={styles.onOffRow}>
            <Text style={styles.sectionLabel}>
              {lights.find((l) => l.id === selectedLightId)?.name ?? 'Light'}
            </Text>
            <View style={styles.onOffToggle}>
              <Text style={styles.onOffLabel}>{isOn ? 'ON' : 'OFF'}</Text>
              <Switch
                value={isOn}
                onValueChange={(v) => applyPatch({ isOn: v })}
                color="#ff6b35"
              />
            </View>
          </View>
        )}

        {/* ── Quick colors ── */}
        <Text style={styles.sectionLabel2}>QUICK COLORS</Text>
        <SimpleColorPicker onSelectColor={handleSwatchColor} selectedHex={undefined} />

        <Divider style={styles.divider} />

        {/* ── Wheel ── */}
        <Text style={styles.sectionLabel2}>COLOR WHEEL</Text>
        <WheelColorPicker currentHex={currentHex} onColorChange={handleWheelColor} />

        {/* White channel */}
        <IntensitySlider
          value={(w / 255) * 100}
          onChange={(v) => applyPatch({ w: Math.round(v * 2.55) })}
          label="White Channel"
        />

        <Divider style={styles.divider} />

        {/* ── Intensity ── */}
        <Text style={styles.sectionLabel2}>INTENSITY</Text>
        <IntensitySlider value={intensity} onChange={(v) => applyPatch({ intensity: v })} />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Rename dialog */}
      <Portal>
        <Dialog visible={renameDialog} onDismiss={() => setRenameDialog(false)}>
          <Dialog.Title>Rename Ambiance</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name"
              value={renameInput}
              onChangeText={setRenameInput}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameDialog(false)}>Cancel</Button>
            <Button
              onPress={() => {
                if (renameInput.trim()) renameAmbiance(editingId, renameInput.trim())
                setRenameDialog(false)
              }}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  )
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
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
      .join('')
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { paddingTop: 8 },
  ambHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 4,
    paddingTop: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 1.5,
  },
  sectionLabel2: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 1.5,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  chipRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 8,
  },
  chip: { backgroundColor: '#1a1a1a' },
  divider: { backgroundColor: '#1e1e1e', marginVertical: 8 },
  lightSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  allLightsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  allLightsLabel: { fontSize: 13, color: '#aaa' },
  lightTileRow: {
    paddingHorizontal: 16,
    gap: 10,
    paddingVertical: 12,
  },
  lightTile: {
    width: 80,
    height: 80,
    borderRadius: 12,
    padding: 8,
    justifyContent: 'flex-end',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  lightTileSelected: {
    borderColor: '#ffffff',
  },
  lightOnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  lightTileName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  noLightsHint: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  onOffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  onOffToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onOffLabel: { color: '#aaa', fontSize: 13 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: '#fff', fontSize: 16, marginBottom: 8 },
  emptyHint: { color: '#666', fontSize: 13, textAlign: 'center' },
})
