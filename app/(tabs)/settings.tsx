import React, { useState, useRef } from 'react'
import { ScrollView, StyleSheet, View, Alert, Pressable } from 'react-native'
import Slider from '../../src/components/AppSlider'
import {
  Text, TextInput, Button, IconButton, Portal, Dialog,
  SegmentedButtons, Menu, Switch, Chip, RadioButton,
} from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SceneStage } from '../../src/components/SceneStage'
import { useLightsStore, type Light, type LightColor } from '../../src/store/lightsStore'
import { useZonesStore } from '../../src/store/zonesStore'
import { useSettingsStore } from '../../src/store/settingsStore'
import {
  useAmbiancesStore, type LightState,
  DEFAULT_AMBIANCES, DEFAULT_CATEGORIES,
  DEFAULT_AMBIANCE_IDS, DEFAULT_CATEGORY_IDS,
} from '../../src/store/ambiancesStore'
import { dmxService } from '../../src/dmx'
import { CHANNEL_MODE_OPTIONS, type ChannelMode } from '../../src/constants/channelModes'
import { DEFAULT_COLORS } from '../../src/constants/defaultColors'
import {
  buildConfig, applyConfig, parseConfig,
  exportToFile, copyToClipboard, pickFile, pasteFromClipboard,
  importSLS, exportSLSToFile, exportSLSToClipboard,
} from '../../src/utils/configIO'

type Tab = 'connection' | 'lights' | 'data'

// Distinct bright colors for test mode, one per light
const TEST_PALETTE: LightColor[] = [
  { r: 255, g: 0,   b: 0,   w: 0, a: 0, uv: 0 },
  { r: 0,   g: 68,  b: 255, w: 0, a: 0, uv: 0 },
  { r: 0,   g: 210, b: 0,   w: 0, a: 0, uv: 0 },
  { r: 255, g: 120, b: 0,   w: 0, a: 0, uv: 0 },
  { r: 200, g: 0,   b: 220, w: 0, a: 0, uv: 0 },
  { r: 0,   g: 210, b: 210, w: 0, a: 0, uv: 0 },
  { r: 255, g: 220, b: 0,   w: 0, a: 0, uv: 0 },
  { r: 255, g: 0,   b: 130, w: 0, a: 0, uv: 0 },
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
            { value: 'lights', label: 'Lights', icon: 'lightbulb-outline' },
            { value: 'data', label: 'Backup', icon: 'archive' },
          ]}
          style={styles.segmented}
        />
      </View>

      {tab === 'connection' && <ConnectionTab />}
      {tab === 'lights' && <LightsTab />}
      {tab === 'data' && <DataTab />}
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
        allOn[f.id] = { r: 255, g: 255, b: 255, w: 255, a: 0, uv: 0, intensity: 100, isOn: true }
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
        <Text style={styles.dialogLabel}>Quick Preset</Text>
        <View style={styles.presetRow}>
          <Pressable
            style={[styles.presetChip, ipInput === '192.168.4.1' && styles.presetChipActive]}
            onPress={() => { setIpInput('192.168.4.1'); setReceiverIp('192.168.4.1') }}
          >
            <Text style={[styles.presetChipLabel, ipInput === '192.168.4.1' && styles.presetChipLabelActive]}>
              Show
            </Text>
            <Text style={styles.presetChipSub}>192.168.4.1</Text>
          </Pressable>
          <Pressable
            style={[styles.presetChip, ipInput === '127.0.0.1' && styles.presetChipActive]}
            onPress={() => { setIpInput('127.0.0.1'); setReceiverIp('127.0.0.1') }}
          >
            <Text style={[styles.presetChipLabel, ipInput === '127.0.0.1' && styles.presetChipLabelActive]}>
              Local
            </Text>
            <Text style={styles.presetChipSub}>127.0.0.1</Text>
          </Pressable>
        </View>

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
  const [newMode, setNewMode] = useState<ChannelMode>('RGBWAUV')
  const [addModeMenuVisible, setAddModeMenuVisible] = useState(false)

  const [editName, setEditName] = useState('')
  const [editAddr, setEditAddr] = useState('')
  const [editMode, setEditMode] = useState<ChannelMode>('RGB')
  const [editModeMenuVisible, setEditModeMenuVisible] = useState(false)
  const [editDefaultColor, setEditDefaultColor] = useState<LightColor>({ r: 255, g: 255, b: 255, w: 0, a: 0, uv: 0 })
  const [editRotation, setEditRotation] = useState(0)
  const [editBeamWidth, setEditBeamWidth] = useState(1.0)

  function openEdit(light: Light) {
    setEditDialog(light)
    setEditName(light.name)
    setEditAddr(String(light.dmxAddress))
    setEditMode(light.channelMode)
    setEditDefaultColor(light.defaultColor ?? { r: 255, g: 255, b: 255, w: 0 })
    setEditRotation(light.rotation ?? 0)
    setEditBeamWidth(light.beamWidth ?? 1.0)
  }

  function confirmEdit() {
    if (!editDialog) return
    const addr = parseInt(editAddr, 10)
    updateLight(editDialog.id, {
      name: editName.trim() || editDialog.name,
      dmxAddress: addr >= 1 && addr <= 512 ? addr : editDialog.dmxAddress,
      channelMode: editMode,
      defaultColor: editDefaultColor,
      rotation: Math.round(editRotation),
      beamWidth: Math.round(editBeamWidth * 10) / 10,
    })
    setEditDialog(null)
  }

  function confirmAdd() {
    const addr = parseInt(newAddr, 10)
    const nextAddr = lights.length > 0
      ? Math.max(...lights.map((l) => l.dmxAddress + 6))
      : 1
    addLight(
      newName.trim() || `Light ${lights.length + 1}`,
      addr >= 1 && addr <= 512 ? addr : nextAddr,
      newMode,
    )
    setNewName(''); setNewAddr(''); setNewMode('RGBWAUV')
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

        {/* ── Stage zones ── */}
        <ZoneEditor />

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

              {/* ── Rotation ── */}
              <Text style={[styles.dialogLabel, { marginTop: 14 }]}>
                Beam Direction: {Math.round(editRotation)}°
                {'  '}{rotationLabel(editRotation)}
              </Text>
              <Slider
                value={editRotation}
                onValueChange={(v) => {
                  setEditRotation(v)
                  // Live preview: update the light icon immediately
                  if (editDialog) updateLight(editDialog.id, { rotation: Math.round(v) })
                }}
                minimumValue={-180}
                maximumValue={180}
                step={1}
                minimumTrackTintColor="#ff6b35"
                maximumTrackTintColor="#333"
                thumbTintColor="#ff6b35"
                style={styles.slider}
              />

              {/* ── Beam width ── */}
              <Text style={[styles.dialogLabel, { marginTop: 10 }]}>
                Beam Width: {beamWidthLabel(editBeamWidth)}
              </Text>
              <Slider
                value={editBeamWidth}
                onValueChange={(v) => {
                  setEditBeamWidth(v)
                  if (editDialog) updateLight(editDialog.id, { beamWidth: Math.round(v * 10) / 10 })
                }}
                minimumValue={0.3}
                maximumValue={2.5}
                step={0.1}
                minimumTrackTintColor="#ff6b35"
                maximumTrackTintColor="#333"
                thumbTintColor="#ff6b35"
                style={styles.slider}
              />

              {/* ── Default color picker ── */}
              <Text style={[styles.dialogLabel, { marginTop: 14 }]}>Default Color (shown when no ambiance active)</Text>
              <View style={styles.colorSwatches}>
                {DEFAULT_COLORS.map((c) => {
                  const col: LightColor = { r: c.r, g: c.g, b: c.b, w: c.w, a: c.a ?? 0, uv: c.uv ?? 0 }
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

// ─────────────────────────────────────────────────────────────────────────────
// DATA TAB — export / import / reset
// ─────────────────────────────────────────────────────────────────────────────
function DataTab() {
  const lights = useLightsStore((s) => s.lights)
  const ambiances = useAmbiancesStore((s) => s.ambiances)
  const categories = useAmbiancesStore((s) => s.categories)
  const addCategory = useAmbiancesStore((s) => s.addCategory)
  const addAmbiance = useAmbiancesStore((s) => s.addAmbiance)
  const setLightState = useAmbiancesStore((s) => s.setLightState)

  const customAmbiances = ambiances.filter((a) => !DEFAULT_AMBIANCE_IDS.has(a.id))
  const customCategories = categories.filter((c) => !DEFAULT_CATEGORY_IDS.has(c.id))

  const [exportFormat, setExportFormat] = useState<'sls' | 'json'>('sls')
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge')
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [busy, setBusy] = useState(false)

  function showOk(msg: string) { setStatus({ kind: 'ok', msg }) }
  function showErr(msg: string) { setStatus({ kind: 'err', msg }) }

  async function handleExportFile() {
    setBusy(true); setStatus(null)
    try {
      if (exportFormat === 'sls') {
        await exportSLSToFile(customAmbiances, lights)
      } else {
        const config = buildConfig()
        await exportToFile({ ...config, ambiances: customAmbiances, categories: customCategories })
      }
      showOk('File shared — save it where you like.')
    } catch (e: any) {
      showErr(e?.message ?? 'Export failed')
    } finally { setBusy(false) }
  }

  async function handleCopyClipboard() {
    setBusy(true); setStatus(null)
    try {
      if (exportFormat === 'sls') {
        await exportSLSToClipboard(customAmbiances, lights)
      } else {
        const config = buildConfig()
        await copyToClipboard({ ...config, ambiances: customAmbiances, categories: customCategories })
      }
      showOk('Copied to clipboard.')
    } catch (e: any) {
      showErr(e?.message ?? 'Copy failed')
    } finally { setBusy(false) }
  }

  async function handleImportFile() {
    setBusy(true); setStatus(null)
    try {
      const file = await pickFile()
      if (!file) { setBusy(false); return }
      if (file.type === 'sls') {
        applySLSImport(file.content, file.name)
      } else {
        applyJSONImport(file.content)
      }
    } catch (e: any) {
      showErr(e?.message ?? 'Import failed')
    } finally { setBusy(false) }
  }

  async function handlePasteClipboard() {
    setBusy(true); setStatus(null)
    try {
      const text = await pasteFromClipboard()
      if (!text?.trim()) { showErr('Clipboard is empty.'); setBusy(false); return }
      applyJSONImport(text)
    } catch (e: any) {
      showErr(e?.message ?? 'Paste failed')
    } finally { setBusy(false) }
  }

  function applyJSONImport(text: string) {
    const config = parseConfig(text)
    if (!config) { showErr('Not a valid DMX Improvisator file.'); return }
    if (importMode === 'replace') {
      Alert.alert(
        'Replace everything?',
        'This will overwrite all your lights, ambiances and settings.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setBusy(false) },
          { text: 'Replace', style: 'destructive', onPress: () => {
            applyConfig(config, 'replace')
            showOk(`Loaded ${config.ambiances.length} ambiances, ${config.lights.length} lights.`)
          }},
        ],
      )
    } else {
      applyConfig(config, 'merge')
      showOk(`Merged ${config.ambiances.length} ambiances, ${config.lights.length} lights.`)
    }
  }

  function applySLSImport(text: string, filename: string) {
    if (lights.length === 0) {
      showErr('Add your lights in the Lights tab first so channels can be mapped correctly.')
      return
    }
    const imported = importSLS(text, lights)
    if (imported.length === 0) { showErr('No ambiances found in this SLS file.'); return }
    const catName = filename.replace(/\.[^.]+$/, '').slice(0, 40) || 'Myriad Import'
    const catId = addCategory(catName)
    for (const amb of imported) {
      const newId = addAmbiance(amb.name, catId)
      for (const [lightId, state] of Object.entries(amb.lightStates)) {
        setLightState(newId, lightId, state)
      }
    }
    showOk(`Imported ${imported.length} ambiances from SLS into category "${catName}".`)
  }

  function handleFactoryReset() {
    Alert.alert(
      'Factory Reset',
      `This will delete all ${customAmbiances.length} custom ambiances and restore the original factory presets. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            useAmbiancesStore.setState({
              ambiances: DEFAULT_AMBIANCES,
              categories: DEFAULT_CATEGORIES,
              activeAmbianceId: null,
            })
            showOk('Restored factory defaults.')
          },
        },
      ],
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>

      {/* ── EXPORT ── */}
      <Text style={styles.sectionTitle}>EXPORT</Text>
      <View style={styles.card}>
        <View style={styles.exportHeaderRow}>
          <Text style={styles.cardLabel}>Custom ambiances only</Text>
          <Text style={styles.cardCount}>
            {customAmbiances.length} ambiance{customAmbiances.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <Text style={styles.hint}>Factory presets and default colors are excluded.</Text>

        <Text style={[styles.dialogLabel, { marginTop: 2 }]}>Format</Text>
        <View style={styles.formatRow}>
          <Pressable
            style={[styles.formatChip, exportFormat === 'sls' && styles.formatChipActive]}
            onPress={() => setExportFormat('sls')}
          >
            <Text style={[styles.formatChipLabel, exportFormat === 'sls' && styles.formatChipLabelActive]}>
              Myriad SLS
            </Text>
            <Text style={styles.formatChipExt}>.SLS_AmbiancesDigest</Text>
          </Pressable>
          <Pressable
            style={[styles.formatChip, exportFormat === 'json' && styles.formatChipActive]}
            onPress={() => setExportFormat('json')}
          >
            <Text style={[styles.formatChipLabel, exportFormat === 'json' && styles.formatChipLabelActive]}>
              JSON
            </Text>
            <Text style={styles.formatChipExt}>.dmximp.json</Text>
          </Pressable>
        </View>

        <Button
          icon="share" mode="contained" onPress={handleExportFile} loading={busy}
          disabled={busy || customAmbiances.length === 0}
          style={styles.dataBtn} contentStyle={styles.dataBtnContent}
        >
          Export to File
        </Button>
        <Button
          icon="content-copy" mode="outlined" onPress={handleCopyClipboard} loading={busy}
          disabled={busy || customAmbiances.length === 0}
          style={styles.dataBtnOutline} contentStyle={styles.dataBtnContent}
        >
          Copy to Clipboard
        </Button>
        {customAmbiances.length === 0 && (
          <Text style={[styles.hint, { textAlign: 'center', marginTop: 4 }]}>
            No custom ambiances yet — create some in Panel 1.
          </Text>
        )}
      </View>

      {/* ── IMPORT ── */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>IMPORT</Text>
      <Text style={styles.hint}>
        Supports Myriad SLS (.SLS_AmbiancesDigest) and DMX Improvisator (.dmximp.json)
      </Text>
      <View style={styles.card}>
        <Text style={styles.dialogLabel}>Import mode</Text>
        <View style={styles.radioRow}>
          <Pressable style={styles.radioOption} onPress={() => setImportMode('merge')}>
            <RadioButton value="merge" status={importMode === 'merge' ? 'checked' : 'unchecked'} color="#ff6b35" onPress={() => setImportMode('merge')} />
            <View>
              <Text style={styles.radioLabel}>Merge</Text>
              <Text style={styles.radioHint}>Add new items, keep existing</Text>
            </View>
          </Pressable>
          <Pressable style={styles.radioOption} onPress={() => setImportMode('replace')}>
            <RadioButton value="replace" status={importMode === 'replace' ? 'checked' : 'unchecked'} color="#ff6b35" onPress={() => setImportMode('replace')} />
            <View>
              <Text style={styles.radioLabel}>Replace all</Text>
              <Text style={styles.radioHint}>Overwrite everything</Text>
            </View>
          </Pressable>
        </View>
        <Button
          icon="folder-open" mode="contained" onPress={handleImportFile} loading={busy}
          disabled={busy} style={styles.dataBtn} contentStyle={styles.dataBtnContent}
        >
          Import from File
        </Button>
        <Button
          icon="clipboard-text" mode="outlined" onPress={handlePasteClipboard} loading={busy}
          disabled={busy} style={styles.dataBtnOutline} contentStyle={styles.dataBtnContent}
        >
          Paste from Clipboard
        </Button>
      </View>

      {/* ── STATUS ── */}
      {status && (
        <View style={[styles.statusBox, status.kind === 'ok' ? styles.statusOk : styles.statusErr]}>
          <Text style={status.kind === 'ok' ? styles.statusOkText : styles.statusErrText}>
            {status.kind === 'ok' ? '✓ ' : '✗ '}{status.msg}
          </Text>
        </View>
      )}

      {/* ── DANGER ZONE ── */}
      <Text style={[styles.sectionTitle, { marginTop: 24, color: '#7a2020' }]}>DANGER ZONE</Text>
      <View style={[styles.card, styles.dangerCard]}>
        <Text style={styles.dialogLabel}>Factory Reset</Text>
        <Text style={styles.hint}>
          Deletes all custom ambiances and categories, then restores the original factory presets.
          Your light fixtures and network settings are kept.
        </Text>
        <Button
          icon="restore"
          mode="outlined"
          onPress={handleFactoryReset}
          style={styles.dangerBtn}
          contentStyle={styles.dataBtnContent}
          textColor="#e74c3c"
        >
          Reset to Factory Defaults
        </Button>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ZONE EDITOR (inside Lights tab scroll)
// ─────────────────────────────────────────────────────────────────────────────
function ZoneEditor() {
  const { zones, zonesEnabled, setZonesEnabled, renameZone, resetZones } = useZonesStore()
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')

  function startRename(id: string, currentName: string) {
    setEditingZoneId(id)
    setNameInput(currentName)
  }
  function commitRename(id: string) {
    if (nameInput.trim()) renameZone(id, nameInput.trim())
    setEditingZoneId(null)
  }

  return (
    <View style={styles.zoneSection}>
      <View style={styles.zoneSectionHeader}>
        <Text style={styles.sectionTitle}>STAGE ZONES</Text>
        <View style={styles.zoneSectionRight}>
          <Switch value={zonesEnabled} onValueChange={setZonesEnabled} color="#ff6b35" />
          <Button mode="text" compact onPress={resetZones} style={{ marginLeft: 4 }}>Reset</Button>
        </View>
      </View>
      <Text style={styles.hint}>Rename zones to match your stage layout.</Text>
      {zonesEnabled && zones.map((zone) => (
        <View key={zone.id} style={styles.zoneRow}>
          <View style={[styles.zoneColorBar, { backgroundColor: zone.border }]} />
          {editingZoneId === zone.id ? (
            <TextInput
              style={styles.zoneNameInput}
              value={nameInput}
              onChangeText={setNameInput}
              onBlur={() => commitRename(zone.id)}
              onSubmitEditing={() => commitRename(zone.id)}
              autoFocus
              selectTextOnFocus
            />
          ) : (
            <Text style={styles.zoneRowName}>{zone.name}</Text>
          )}
          <IconButton
            icon="pencil"
            size={16}
            iconColor="#666"
            onPress={() => startRename(zone.id, zone.name)}
          />
        </View>
      ))}
    </View>
  )
}

function rotationLabel(deg: number): string {
  // -180..180 range: 0 = audience, ±180 = back
  const a = Math.abs(deg)
  if (a < 22)  return '↓ Audience'
  if (deg > 0) {
    if (deg < 67)  return '↙'
    if (deg < 112) return '← Left'
    if (deg < 157) return '↖'
    return '↑ Back'
  } else {
    if (deg > -67)  return '↘'
    if (deg > -112) return '→ Right'
    if (deg > -157) return '↗'
    return '↑ Back'
  }
}

function beamWidthLabel(v: number): string {
  if (v < 0.65) return `Tight spot (${v.toFixed(1)}×)`
  if (v < 1.15) return `Medium (${v.toFixed(1)}×)`
  if (v < 1.75) return `Wide (${v.toFixed(1)}×)`
  return `Full wash (${v.toFixed(1)}×)`
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
  slider: { width: '100%', height: 36, marginBottom: 2 },

  // ── Connection tab presets ──
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  presetChip: {
    flex: 1, backgroundColor: '#1e1e1e', borderRadius: 10, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1, borderColor: '#333',
  },
  presetChipActive: { borderColor: '#ff6b35', backgroundColor: 'rgba(255,107,53,0.1)' },
  presetChipLabel: { fontSize: 13, fontWeight: '700', color: '#888' },
  presetChipLabelActive: { color: '#ff6b35' },
  presetChipSub: { fontSize: 10, color: '#555', marginTop: 2 },

  // ── Data tab ──
  dataBtn: { backgroundColor: '#ff6b35' },
  dataBtnOutline: { borderColor: '#ff6b35' },
  dataBtnContent: { paddingVertical: 4 },

  exportHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  cardLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  cardCount: { fontSize: 12, color: '#888' },

  formatRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  formatChip: {
    flex: 1, backgroundColor: '#1e1e1e', borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#333',
  },
  formatChipActive: { borderColor: '#ff6b35', backgroundColor: 'rgba(255,107,53,0.1)' },
  formatChipLabel: { fontSize: 13, fontWeight: '600', color: '#888' },
  formatChipLabelActive: { color: '#ff6b35' },
  formatChipExt: { fontSize: 10, color: '#555', marginTop: 2 },

  radioRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  radioOption: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 2 },
  radioLabel: { fontSize: 13, fontWeight: '600', color: '#fff' },
  radioHint: { fontSize: 11, color: '#666', marginTop: 1 },
  statusBox: { borderRadius: 10, padding: 12, marginTop: 14 },
  statusOk: { backgroundColor: 'rgba(46,204,113,0.12)', borderLeftWidth: 3, borderLeftColor: '#2ecc71' },
  statusErr: { backgroundColor: 'rgba(231,76,60,0.12)', borderLeftWidth: 3, borderLeftColor: '#e74c3c' },
  statusOkText: { color: '#2ecc71', fontSize: 13 },
  statusErrText: { color: '#e74c3c', fontSize: 13 },

  dangerCard: { borderWidth: 1, borderColor: '#5a2020' },
  dangerBtn: { borderColor: '#e74c3c' },

  zoneSection: { marginTop: 16, paddingBottom: 4 },
  zoneSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  zoneSectionRight: { flexDirection: 'row', alignItems: 'center' },
  zoneRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#141414', borderRadius: 8,
    marginBottom: 6, overflow: 'hidden',
  },
  zoneColorBar: { width: 4, height: '100%', minHeight: 44 },
  zoneRowName: { flex: 1, fontSize: 14, color: '#fff', paddingHorizontal: 12 },
  zoneNameInput: {
    flex: 1, fontSize: 14, color: '#fff',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#1a1a1a',
  },
})
