import React, { useState, useRef } from 'react'
import { ScrollView, StyleSheet, View, Alert, Pressable } from 'react-native'
import {
  Text, TextInput, Button, IconButton, Portal, Dialog,
  SegmentedButtons, Menu, Switch, Chip,
} from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SceneStage } from '../../src/components/SceneStage'
import { useLightsStore, type Light, type LightColor } from '../../src/store/lightsStore'
import { useSettingsStore } from '../../src/store/settingsStore'
import { useAmbiancesStore, type LightState } from '../../src/store/ambiancesStore'
import { dmxService } from '../../src/dmx'
import { CHANNEL_MODE_OPTIONS, type ChannelMode } from '../../src/constants/channelModes'
import { DEFAULT_COLORS } from '../../src/constants/defaultColors'

type Tab = 'connection' | 'lights'

// Distinct bright colors for test mode, one per light
const TEST_PALETTE: LightColor[] = [
  { r: 255, g: 0,   b: 0,   w: 0 },
  { r: 0,   g: 68,  b: 255, w: 0 },
  { r: 0,   g: 210, b: 0,   w: 0 },
  { r: 255, g: 120, b: 0,   w: 0 },
  { r: 200, g: 0,   b: 220, w: 0 },
  { r: 0,   g: 210, b: 210, w: 0 },
  { r: 255, g: 220, b: 0,   w: 0 },
  { r: 255, g: 0,   b: 130, w: 0 },
]

export default function SettingsScreen() {
  const [tab, setTab] = useState<Tab>('connection')

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.tabBar}>
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          buttons={[
            { value: 'connection', label: 'Connection', icon: 'wifi' },
            { value: 'lights', label: 'Lights / Scene', icon: 'lightbulb-outline' },
          ]}
          style={styles.segmented}
        />
      </View>

      {tab === 'connection' ? <ConnectionTab /> : <LightsTab />}
    </SafeAreaView>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTION TAB
// ─────────────────────────────────────────────────────────────────────────────
function ConnectionTab() {
  const receiverIp = useSettingsStore((s) => s.receiverIp)
  const receiverPort = useSettingsStore((s) => s.receiverPort)
  const universe = useSettingsStore((s) => s.universe)
  const setReceiverIp = useSettingsStore((s) => s.setReceiverIp)
  const setReceiverPort = useSettingsStore((s) => s.setReceiverPort)
  const setUniverse = useSettingsStore((s) => s.setUniverse)
  const lights = useLightsStore((s) => s.lights)

  const [ipInput, setIpInput] = useState(receiverIp)
  const [portInput, setPortInput] = useState(String(receiverPort))
  const [universeInput, setUniverseInput] = useState(String(universe))
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'none' | 'ok' | 'fail'>('none')

  function commitIp() { setReceiverIp(ipInput.trim() || receiverIp) }
  function commitPort() {
    const n = parseInt(portInput, 10)
    if (n > 0 && n < 65536) setReceiverPort(n)
    else setPortInput(String(receiverPort))
  }
  function commitUniverse() {
    const n = parseInt(universeInput, 10)
    if (n >= 0 && n <= 255) setUniverse(n)
    else setUniverseInput(String(universe))
  }

  async function testConnection() {
    setTesting(true)
    setTestResult('none')
    try {
      const fixtures = lights.map((l) => ({
        id: l.id, dmxAddress: l.dmxAddress, channelMode: l.channelMode,
      }))
      const allOn: Record<string, LightState> = {}
      for (const f of fixtures) {
        allOn[f.id] = { r: 255, g: 255, b: 255, w: 255, intensity: 100, isOn: true }
      }
      await dmxService.sync(fixtures, allOn, false, receiverIp, receiverPort, universe)
      await delay(500)
      await dmxService.sync(fixtures, allOn, true, receiverIp, receiverPort, universe)
      await delay(300)
      await dmxService.sync(fixtures, allOn, false, receiverIp, receiverPort, universe)
      await delay(500)
      await dmxService.sync(fixtures, allOn, true, receiverIp, receiverPort, universe)
      setTestResult('ok')
    } catch (e: any) {
      setTestResult('fail')
      Alert.alert('Connection Error', e?.message ?? 'Failed to send')
    } finally {
      setTesting(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Text style={styles.sectionTitle}>DMX RECEIVER</Text>
      <Text style={styles.hint}>
        Eurolite FreeDMX AP defaults: IP 2.0.0.1 · Port 6454 · Universe 0
      </Text>

      <View style={styles.card}>
        <TextInput
          label="Receiver IP Address"
          value={ipInput}
          onChangeText={setIpInput}
          onBlur={commitIp}
          keyboardType="numeric"
          mode="outlined"
          style={styles.input}
          left={<TextInput.Icon icon="wifi" />}
        />
        <TextInput
          label="UDP Port"
          value={portInput}
          onChangeText={setPortInput}
          onBlur={commitPort}
          keyboardType="numeric"
          mode="outlined"
          style={styles.input}
          left={<TextInput.Icon icon="numeric" />}
        />
        <TextInput
          label="Art-Net Universe (0–255)"
          value={universeInput}
          onChangeText={setUniverseInput}
          onBlur={commitUniverse}
          keyboardType="numeric"
          mode="outlined"
          style={styles.input}
          left={<TextInput.Icon icon="layers" />}
        />

        {testResult === 'ok' && (
          <Text style={styles.successMsg}>✓ Blink sent — lights should have flashed twice</Text>
        )}
        {testResult === 'fail' && (
          <Text style={styles.errorMsg}>✗ Send failed — check IP and WiFi connection</Text>
        )}

        <Button
          mode="contained"
          onPress={testConnection}
          loading={testing}
          disabled={testing}
          icon="access-point"
          style={styles.testBtn}
          contentStyle={styles.testBtnContent}
        >
          Test Connection (Blink)
        </Button>
      </View>
    </ScrollView>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTS TAB
// Stage is outside ScrollView to avoid gesture conflicts with drag
// ─────────────────────────────────────────────────────────────────────────────
function LightsTab() {
  const lights = useLightsStore((s) => s.lights)
  const addLight = useLightsStore((s) => s.addLight)
  const removeLight = useLightsStore((s) => s.removeLight)
  const updateLight = useLightsStore((s) => s.updateLight)
  const updateLightPosition = useLightsStore((s) => s.updateLightPosition)

  const activeAmbianceId = useAmbiancesStore((s) => s.activeAmbianceId)
  const ambiances = useAmbiancesStore((s) => s.ambiances)
  const activeAmbiance = ambiances.find((a) => a.id === activeAmbianceId) ?? null

  const receiverIp = useSettingsStore((s) => s.receiverIp)
  const receiverPort = useSettingsStore((s) => s.receiverPort)
  const universe = useSettingsStore((s) => s.universe)

  // ── Test mode ──────────────────────────────────────────────
  const [testMode, setTestMode] = useState(false)
  const [testStates, setTestStates] = useState<Record<string, LightState> | null>(null)
  const stopTestRef = useRef(false)

  async function startTestMode() {
    stopTestRef.current = false
    setTestMode(true)

    const fixtures = lights.map((l) => ({
      id: l.id, dmxAddress: l.dmxAddress, channelMode: l.channelMode,
    }))
    const scene: Record<string, LightState> = {}
    lights.forEach((l, i) => {
      const c = TEST_PALETTE[i % TEST_PALETTE.length]
      scene[l.id] = { ...c, intensity: 100, isOn: true }
    })
    setTestStates(scene)
    try {
      await dmxService.sync(fixtures, scene, false, receiverIp, receiverPort, universe)
    } catch {}
  }

  async function stopTestMode() {
    stopTestRef.current = true
    setTestMode(false)
    setTestStates(null)
    // Restore active ambiance or blackout
    const fixtures = lights.map((l) => ({
      id: l.id, dmxAddress: l.dmxAddress, channelMode: l.channelMode,
    }))
    try {
      const restoreScene = activeAmbiance?.lightStates ?? {}
      await dmxService.sync(fixtures, restoreScene, !activeAmbiance, receiverIp, receiverPort, universe)
    } catch {}
  }

  // Stage shows: test mode colors > active ambiance colors > null (default colors from light config)
  const stageStates = testStates ?? activeAmbiance?.lightStates ?? null

  // ── Light config dialog ────────────────────────────────────
  const [addDialog, setAddDialog] = useState(false)
  const [editDialog, setEditDialog] = useState<Light | null>(null)

  const [newName, setNewName] = useState('')
  const [newAddr, setNewAddr] = useState('')
  const [newMode, setNewMode] = useState<ChannelMode>('RGB')
  const [addModeMenuVisible, setAddModeMenuVisible] = useState(false)

  const [editName, setEditName] = useState('')
  const [editAddr, setEditAddr] = useState('')
  const [editMode, setEditMode] = useState<ChannelMode>('RGB')
  const [editModeMenuVisible, setEditModeMenuVisible] = useState(false)
  const [editDefaultColor, setEditDefaultColor] = useState<LightColor>({ r: 255, g: 255, b: 255, w: 0 })

  function openEdit(light: Light) {
    setEditDialog(light)
    setEditName(light.name)
    setEditAddr(String(light.dmxAddress))
    setEditMode(light.channelMode)
    setEditDefaultColor(light.defaultColor)
  }

  function confirmEdit() {
    if (!editDialog) return
    const addr = parseInt(editAddr, 10)
    updateLight(editDialog.id, {
      name: editName.trim() || editDialog.name,
      dmxAddress: addr >= 1 && addr <= 512 ? addr : editDialog.dmxAddress,
      channelMode: editMode,
      defaultColor: editDefaultColor,
    })
    setEditDialog(null)
  }

  function confirmAdd() {
    const addr = parseInt(newAddr, 10)
    const nextAddr = lights.length > 0
      ? Math.max(...lights.map((l) => l.dmxAddress + 5))
      : 1
    addLight(
      newName.trim() || `Light ${lights.length + 1}`,
      addr >= 1 && addr <= 512 ? addr : nextAddr,
      newMode,
    )
    setNewName(''); setNewAddr(''); setNewMode('RGB')
    setAddDialog(false)
  }

  return (
    <View style={styles.lightsRoot}>

      {/* ── Virtual scene (outside scroll — gesture-safe) ── */}
      <View style={styles.sceneArea}>
        <View style={styles.sceneHeader}>
          <Text style={styles.sectionTitle}>VIRTUAL SCENE</Text>
          <View style={styles.sceneHeaderRight}>
            {testMode
              ? <Chip icon="palette" onPress={stopTestMode} style={styles.testChipActive} textStyle={styles.testChipTextActive}>Stop Test</Chip>
              : <Chip icon="lightbulb-on-outline" onPress={startTestMode} style={styles.testChip} textStyle={styles.testChipText}>Test Mode</Chip>
            }
          </View>
        </View>

        {testMode && (
          <View style={styles.testBanner}>
            <Text style={styles.testBannerText}>
              🎨 Test mode — each light shows a distinct color
            </Text>
          </View>
        )}

        {!testMode && activeAmbiance && (
          <Text style={styles.sceneSubtitle}>
            Showing: <Text style={{ color: '#ff6b35' }}>{activeAmbiance.name}</Text>
          </Text>
        )}
        {!testMode && !activeAmbiance && (
          <Text style={styles.sceneSubtitle}>Showing default colors · activate an ambiance to preview</Text>
        )}

        <SceneStage
          lights={lights}
          activeLightStates={stageStates}
          onLightMove={updateLightPosition}
          onLightTap={openEdit}
        />
      </View>

      {/* ── Scrollable light list ── */}
      <ScrollView contentContainerStyle={styles.listContent}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>CONFIGURED LIGHTS</Text>
          <Button icon="plus" mode="text" compact onPress={() => { setNewName(''); setNewAddr(''); setAddDialog(true) }}>
            Add
          </Button>
        </View>

        {lights.map((light) => {
          const dc = light.defaultColor ?? { r: 255, g: 255, b: 255, w: 0 }
          const defColorStr = `rgb(${Math.min(255, dc.r + dc.w)},${Math.min(255, dc.g + dc.w)},${Math.min(255, dc.b + dc.w)})`
          return (
            <View key={light.id} style={styles.lightRow}>
              <View style={[styles.colorDot, { backgroundColor: defColorStr }]} />
              <View style={styles.lightRowInfo}>
                <Text style={styles.lightRowName}>{light.name}</Text>
                <Text style={styles.lightRowMeta}>ch{light.dmxAddress} · {light.channelMode}</Text>
              </View>
              <IconButton icon="pencil" size={18} iconColor="#ff6b35" onPress={() => openEdit(light)} />
              <IconButton
                icon="delete-outline" size={18} iconColor="#e74c3c"
                onPress={() =>
                  Alert.alert('Remove', `Remove "${light.name}"?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => removeLight(light.id) },
                  ])
                }
              />
            </View>
          )
        })}
        {lights.length === 0 && (
          <Text style={styles.emptyHint}>No lights yet. Tap Add to create your first fixture.</Text>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Add dialog ── */}
      <Portal>
        <Dialog visible={addDialog} onDismiss={() => setAddDialog(false)}>
          <Dialog.Title>Add Light</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Name" value={newName} onChangeText={setNewName} mode="outlined" style={styles.dialogInput} autoFocus placeholder={`Light ${lights.length + 1}`} />
            <TextInput label="DMX Start Address (1–512)" value={newAddr} onChangeText={setNewAddr} keyboardType="numeric" mode="outlined" style={styles.dialogInput} />
            <Text style={styles.dialogLabel}>Channel Mode</Text>
            <Menu
              visible={addModeMenuVisible}
              onDismiss={() => setAddModeMenuVisible(false)}
              anchor={<Button mode="outlined" onPress={() => setAddModeMenuVisible(true)} style={styles.modeBtn}>{CHANNEL_MODE_OPTIONS.find((m) => m.mode === newMode)?.label ?? newMode}</Button>}
            >
              {CHANNEL_MODE_OPTIONS.map((opt) => (
                <Menu.Item key={opt.mode} title={opt.label} onPress={() => { setNewMode(opt.mode); setAddModeMenuVisible(false) }} />
              ))}
            </Menu>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddDialog(false)}>Cancel</Button>
            <Button onPress={confirmAdd}>Add</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Edit / configure dialog ── */}
      <Portal>
        <Dialog visible={!!editDialog} onDismiss={() => setEditDialog(null)}>
          <Dialog.Title>Configure Light</Dialog.Title>
          <Dialog.ScrollArea style={styles.editScrollArea}>
            <ScrollView>
              <TextInput label="Name" value={editName} onChangeText={setEditName} mode="outlined" style={styles.dialogInput} autoFocus />
              <TextInput label="DMX Start Address (1–512)" value={editAddr} onChangeText={setEditAddr} keyboardType="numeric" mode="outlined" style={styles.dialogInput} />

              <Text style={styles.dialogLabel}>Channel Mode</Text>
              <Menu
                visible={editModeMenuVisible}
                onDismiss={() => setEditModeMenuVisible(false)}
                anchor={<Button mode="outlined" onPress={() => setEditModeMenuVisible(true)} style={styles.modeBtn}>{CHANNEL_MODE_OPTIONS.find((m) => m.mode === editMode)?.label ?? editMode}</Button>}
              >
                {CHANNEL_MODE_OPTIONS.map((opt) => (
                  <Menu.Item key={opt.mode} title={opt.label} onPress={() => { setEditMode(opt.mode); setEditModeMenuVisible(false) }} />
                ))}
              </Menu>

              {/* ── Default color picker ── */}
              <Text style={[styles.dialogLabel, { marginTop: 14 }]}>Default Color (shown when no ambiance active)</Text>
              <View style={styles.colorSwatches}>
                {DEFAULT_COLORS.map((c) => {
                  const col: LightColor = { r: c.r, g: c.g, b: c.b, w: c.w }
                  const isSelected = editDefaultColor.r === c.r && editDefaultColor.g === c.g && editDefaultColor.b === c.b && editDefaultColor.w === c.w
                  return (
                    <Pressable
                      key={c.hex}
                      onPress={() => setEditDefaultColor(col)}
                      style={[styles.colorSwatch, { backgroundColor: c.hex }, isSelected && styles.colorSwatchSelected]}
                    />
                  )
                })}
              </View>
              {/* Extra test-palette colors */}
              <View style={styles.colorSwatches}>
                {TEST_PALETTE.map((c, i) => {
                  const hex = `rgb(${c.r},${c.g},${c.b})`
                  const isSelected = editDefaultColor.r === c.r && editDefaultColor.g === c.g && editDefaultColor.b === c.b
                  return (
                    <Pressable
                      key={i}
                      onPress={() => setEditDefaultColor(c)}
                      style={[styles.colorSwatch, { backgroundColor: hex }, isSelected && styles.colorSwatchSelected]}
                    />
                  )
                })}
              </View>

              <View style={{ height: 8 }} />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setEditDialog(null)}>Cancel</Button>
            <Button onPress={confirmEdit}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  )
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  tabBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  segmented: { backgroundColor: '#1a1a1a' },
  tabContent: { padding: 16 },

  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 1.5 },
  hint: { fontSize: 12, color: '#444', marginBottom: 12 },

  card: { backgroundColor: '#141414', borderRadius: 14, padding: 16, gap: 10 },
  input: { backgroundColor: 'transparent' },
  testBtn: { backgroundColor: '#ff6b35', marginTop: 8 },
  testBtnContent: { paddingVertical: 4 },
  successMsg: { color: '#2ecc71', fontSize: 13, textAlign: 'center' },
  errorMsg: { color: '#e74c3c', fontSize: 13, textAlign: 'center' },

  // ── Lights tab ──
  lightsRoot: { flex: 1 },

  sceneArea: { paddingTop: 10, paddingBottom: 2 },
  sceneHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 4,
  },
  sceneHeaderRight: { flexDirection: 'row', gap: 8 },
  sceneSubtitle: { fontSize: 11, color: '#444', paddingHorizontal: 16, marginBottom: 6 },

  testChip: { backgroundColor: '#1a2535', height: 28 },
  testChipText: { fontSize: 11, color: '#aaa' },
  testChipActive: { backgroundColor: '#ff6b35', height: 28 },
  testChipTextActive: { fontSize: 11, color: '#fff' },
  testBanner: {
    marginHorizontal: 16, marginBottom: 6,
    backgroundColor: 'rgba(255,107,53,0.12)',
    borderRadius: 8, padding: 8,
    borderLeftWidth: 3, borderLeftColor: '#ff6b35',
  },
  testBannerText: { color: '#ff6b35', fontSize: 12 },

  listContent: { paddingHorizontal: 16, paddingTop: 8 },
  listHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  lightRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#141414', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 6,
  },
  colorDot: {
    width: 14, height: 14, borderRadius: 7, marginRight: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  lightRowInfo: { flex: 1 },
  lightRowName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  lightRowMeta: { fontSize: 11, color: '#555', marginTop: 2 },
  emptyHint: { color: '#444', fontSize: 13, textAlign: 'center', marginTop: 16 },

  editScrollArea: { maxHeight: 420 },
  dialogInput: { backgroundColor: 'transparent', marginBottom: 8 },
  dialogLabel: { fontSize: 12, color: '#888', marginBottom: 6 },
  modeBtn: { marginBottom: 4 },
  colorSwatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  colorSwatch: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 2, borderColor: 'transparent',
  },
  colorSwatchSelected: { borderColor: '#ffffff' },
})
