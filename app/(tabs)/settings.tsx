import React, { useState, useRef } from 'react'
import { ScrollView, StyleSheet, View, Alert, Pressable } from 'react-native'
import Slider from '../../src/components/AppSlider'
import {
  Text, TextInput, Button, IconButton, Portal, Dialog,
  SegmentedButtons, Menu, Switch, Chip, RadioButton,
} from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { SceneStage } from '../../src/components/SceneStage'
import { HelpButton, type HelpSection } from '../../src/components/HelpButton'
import { useLightsStore, DEFAULT_LIGHTS, type Light, type LightColor } from '../../src/store/lightsStore'
import { useZonesStore } from '../../src/store/zonesStore'
import { useSettingsStore, type AppLanguage } from '../../src/store/settingsStore'
import {
  useAmbiancesStore, type LightState,
  DEFAULT_AMBIANCES, DEFAULT_CATEGORIES,
  DEFAULT_AMBIANCE_IDS, DEFAULT_CATEGORY_IDS,
} from '../../src/store/ambiancesStore'
import { dmxService, type DiscoveredArtNetNode } from '../../src/dmx'
import { CHANNEL_MODE_OPTIONS, CHANNEL_MODE_CONFIGS, type ChannelMode } from '../../src/constants/channelModes'
import { DEFAULT_COLORS } from '../../src/constants/defaultColors'
import {
  buildConfig, applyConfig, parseConfig,
  exportToFile, copyToClipboard, pickFile, pasteFromClipboard,
  importSLS, exportSLSToFile, exportSLSToClipboard,
} from '../../src/utils/configIO'

type Tab = 'connection' | 'lights' | 'data' | 'tutorial'

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
  const { t } = useTranslation()

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.tabBar}>
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          buttons={[
            { value: 'connection', label: t('settings.tabs.connection'), icon: 'wifi' },
            { value: 'lights', label: t('settings.tabs.lights'), icon: 'lightbulb-outline' },
            { value: 'data', label: t('settings.tabs.data'), icon: 'archive' },
            { value: 'tutorial', label: t('settings.tabs.tutorial'), icon: 'school-outline' },
          ]}
          style={styles.segmented}
        />
      </View>

      {tab === 'connection' && <ConnectionTab />}
      {tab === 'lights' && <LightsTab />}
      {tab === 'data' && <DataTab />}
      {tab === 'tutorial' && <TutorialTab />}
    </SafeAreaView>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTION TAB
// ─────────────────────────────────────────────────────────────────────────────
function ConnectionTab() {
  const { t } = useTranslation()
  const receiverIp = useSettingsStore((s) => s.receiverIp)
  const receiverPort = useSettingsStore((s) => s.receiverPort)
  const universe = useSettingsStore((s) => s.universe)
  const masterIntensity = useSettingsStore((s) => s.masterIntensity)
  const setReceiverIp = useSettingsStore((s) => s.setReceiverIp)
  const setReceiverPort = useSettingsStore((s) => s.setReceiverPort)
  const setUniverse = useSettingsStore((s) => s.setUniverse)
  const lights = useLightsStore((s) => s.lights)

  const [ipInput, setIpInput] = useState(receiverIp)
  const [portInput, setPortInput] = useState(String(receiverPort))
  const [universeInput, setUniverseInput] = useState(String(universe))
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'none' | 'ok' | 'fail'>('none')

  // ── Network discovery (ArtPoll scan — native only) ──────────
  const [scanning, setScanning] = useState(false)
  const [foundNodes, setFoundNodes] = useState<DiscoveredArtNetNode[]>([])
  const [scanError, setScanError] = useState<string | null>(null)

  async function scanNetwork() {
    setScanning(true)
    setScanError(null)
    setFoundNodes([])
    try {
      await dmxService.discoverNodes(2500, (node) => {
        setFoundNodes((prev) => (prev.some((n) => n.ip === node.ip) ? prev : [...prev, node]))
      })
    } catch (e: any) {
      setScanError(e?.message ?? 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

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
        id: l.id, dmxAddress: l.dmxAddress, channelMode: l.channelMode, maxIntensity: l.maxIntensity,
      }))
      const allOn: Record<string, LightState> = {}
      for (const f of fixtures) {
        allOn[f.id] = { r: 255, g: 255, b: 255, w: 255, a: 0, uv: 0, intensity: 100, isOn: true }
      }
      await dmxService.sync(fixtures, allOn, false, receiverIp, receiverPort, universe, masterIntensity)
      await delay(500)
      await dmxService.sync(fixtures, allOn, true, receiverIp, receiverPort, universe, masterIntensity)
      await delay(300)
      await dmxService.sync(fixtures, allOn, false, receiverIp, receiverPort, universe, masterIntensity)
      await delay(500)
      await dmxService.sync(fixtures, allOn, true, receiverIp, receiverPort, universe, masterIntensity)
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
      <View style={styles.tabHeaderRow}>
        <Text style={styles.sectionTitle}>{t('settings.connection.sectionTitle')}</Text>
        <HelpButton section="network" />
      </View>
      <Text style={styles.hint}>
        {t('settings.connection.defaultsHint')}
      </Text>

      <View style={styles.card}>
        <Text style={styles.dialogLabel}>{t('settings.connection.quickPreset')}</Text>
        <View style={styles.presetRow}>
          <Pressable
            style={[styles.presetChip, ipInput === '192.168.4.1' && styles.presetChipActive]}
            onPress={() => { setIpInput('192.168.4.1'); setReceiverIp('192.168.4.1') }}
          >
            <Text style={[styles.presetChipLabel, ipInput === '192.168.4.1' && styles.presetChipLabelActive]}>
              {t('settings.connection.presetShow')}
            </Text>
            <Text style={styles.presetChipSub}>192.168.4.1</Text>
          </Pressable>
          <Pressable
            style={[styles.presetChip, ipInput === '127.0.0.1' && styles.presetChipActive]}
            onPress={() => { setIpInput('127.0.0.1'); setReceiverIp('127.0.0.1') }}
          >
            <Text style={[styles.presetChipLabel, ipInput === '127.0.0.1' && styles.presetChipLabelActive]}>
              {t('settings.connection.presetLocal')}
            </Text>
            <Text style={styles.presetChipSub}>127.0.0.1</Text>
          </Pressable>
        </View>

        <TextInput
          label={t('settings.connection.ipLabel')}
          value={ipInput}
          onChangeText={setIpInput}
          onBlur={commitIp}
          keyboardType="numeric"
          mode="outlined"
          style={styles.input}
          left={<TextInput.Icon icon="wifi" />}
        />
        <TextInput
          label={t('settings.connection.portLabel')}
          value={portInput}
          onChangeText={setPortInput}
          onBlur={commitPort}
          keyboardType="numeric"
          mode="outlined"
          style={styles.input}
          left={<TextInput.Icon icon="numeric" />}
        />
        <TextInput
          label={t('settings.connection.universeLabel')}
          value={universeInput}
          onChangeText={setUniverseInput}
          onBlur={commitUniverse}
          keyboardType="numeric"
          mode="outlined"
          style={styles.input}
          left={<TextInput.Icon icon="layers" />}
        />

        {testResult === 'ok' && (
          <Text style={styles.successMsg}>{t('settings.connection.successMsg')}</Text>
        )}
        {testResult === 'fail' && (
          <Text style={styles.errorMsg}>{t('settings.connection.errorMsg')}</Text>
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
          {t('settings.connection.testButton')}
        </Button>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{t('settings.connection.discoveryTitle')}</Text>
      <View style={styles.card}>
        <Text style={styles.hint}>
          {t('settings.connection.discoveryHint')}
        </Text>
        <Button
          mode="outlined"
          onPress={scanNetwork}
          loading={scanning}
          disabled={scanning || !dmxService.supportsDiscovery()}
          icon="radar"
          style={styles.dataBtnOutline}
          contentStyle={styles.testBtnContent}
        >
          {t('settings.connection.scanButton')}
        </Button>

        {!dmxService.supportsDiscovery() && (
          <Text style={styles.hint}>{t('settings.connection.webNotSupported')}</Text>
        )}
        {scanError && <Text style={styles.errorMsg}>✗ {scanError}</Text>}
        {scanning && foundNodes.length === 0 && (
          <Text style={styles.hint}>{t('settings.connection.scanning')}</Text>
        )}
        {!scanning && !scanError && foundNodes.length === 0 && dmxService.supportsDiscovery() && (
          <Text style={styles.hint}>{t('settings.connection.noNodesFound')}</Text>
        )}

        {foundNodes.length > 0 && (
          <View style={styles.presetRow}>
            {foundNodes.map((node) => (
              <Pressable
                key={node.ip}
                style={[styles.presetChip, ipInput === node.ip && styles.presetChipActive]}
                onPress={() => { setIpInput(node.ip); setReceiverIp(node.ip) }}
              >
                <Text style={[styles.presetChipLabel, ipInput === node.ip && styles.presetChipLabelActive]}>
                  {node.shortName || t('settings.connection.nodeFallbackName')}
                </Text>
                <Text style={styles.presetChipSub}>{node.ip}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTS TAB
// Stage is outside ScrollView to avoid gesture conflicts with drag
// ─────────────────────────────────────────────────────────────────────────────
function LightsTab() {
  const { t } = useTranslation()
  const lights = useLightsStore((s) => s.lights)
  const addLight = useLightsStore((s) => s.addLight)
  const removeLight = useLightsStore((s) => s.removeLight)
  const updateLight = useLightsStore((s) => s.updateLight)
  const updateLightPosition = useLightsStore((s) => s.updateLightPosition)
  const setAllChannelMode = useLightsStore((s) => s.setAllChannelMode)
  const renumberSequential = useLightsStore((s) => s.renumberSequential)

  const activeAmbianceId = useAmbiancesStore((s) => s.activeAmbianceId)
  const ambiances = useAmbiancesStore((s) => s.ambiances)
  const activeAmbiance = ambiances.find((a) => a.id === activeAmbianceId) ?? null

  const receiverIp = useSettingsStore((s) => s.receiverIp)
  const receiverPort = useSettingsStore((s) => s.receiverPort)
  const universe = useSettingsStore((s) => s.universe)
  const masterIntensity = useSettingsStore((s) => s.masterIntensity)

  // ── Test mode ──────────────────────────────────────────────
  const [testMode, setTestMode] = useState(false)
  const [testStates, setTestStates] = useState<Record<string, LightState> | null>(null)
  const stopTestRef = useRef(false)

  async function startTestMode() {
    stopTestRef.current = false
    setTestMode(true)

    const fixtures = lights.map((l) => ({
      id: l.id, dmxAddress: l.dmxAddress, channelMode: l.channelMode, maxIntensity: l.maxIntensity,
    }))
    const scene: Record<string, LightState> = {}
    lights.forEach((l, i) => {
      const c = TEST_PALETTE[i % TEST_PALETTE.length]
      scene[l.id] = { ...c, intensity: 100, isOn: true }
    })
    setTestStates(scene)
    try {
      await dmxService.sync(fixtures, scene, false, receiverIp, receiverPort, universe, masterIntensity)
    } catch {}
  }

  async function stopTestMode() {
    stopTestRef.current = true
    setTestMode(false)
    setTestStates(null)
    // Restore active ambiance or blackout
    const fixtures = lights.map((l) => ({
      id: l.id, dmxAddress: l.dmxAddress, channelMode: l.channelMode, maxIntensity: l.maxIntensity,
    }))
    try {
      const restoreScene = activeAmbiance?.lightStates ?? {}
      await dmxService.sync(fixtures, restoreScene, !activeAmbiance, receiverIp, receiverPort, universe, masterIntensity)
    } catch {}
  }

  // Stage shows: test mode colors > active ambiance colors > null (default colors from light config)
  const stageStates = testStates ?? activeAmbiance?.lightStates ?? null

  // ── Light config dialog ────────────────────────────────────
  const [addDialog, setAddDialog] = useState(false)
  const [editDialog, setEditDialog] = useState<Light | null>(null)

  const [newName, setNewName] = useState('')
  const [newAddr, setNewAddr] = useState('')
  const [newMode, setNewMode] = useState<ChannelMode>('DIM16_RGBWAUV')
  const [addModeMenuVisible, setAddModeMenuVisible] = useState(false)

  const [editName, setEditName] = useState('')
  const [editAddr, setEditAddr] = useState('')
  const [editMode, setEditMode] = useState<ChannelMode>('RGB')
  const [editModeMenuVisible, setEditModeMenuVisible] = useState(false)
  const [editDefaultColor, setEditDefaultColor] = useState<LightColor>({ r: 255, g: 255, b: 255, w: 0, a: 0, uv: 0 })
  const [editRotation, setEditRotation] = useState(0)
  const [editBeamWidth, setEditBeamWidth] = useState(1.0)
  const [editMaxIntensity, setEditMaxIntensity] = useState(100)

  // ── Bulk setup (all-lights format + auto-numbering) ──────────
  const [bulkDialog, setBulkDialog] = useState(false)
  const [bulkMode, setBulkMode] = useState<ChannelMode>('DIM16_RGBWAUV')
  const [bulkModeMenuVisible, setBulkModeMenuVisible] = useState(false)
  const [renumberStart, setRenumberStart] = useState('1')

  function applyBulkMode() {
    if (lights.length === 0) return
    Alert.alert(
      t('settings.lights.bulkConfirmTitle'),
      t('settings.lights.bulkConfirmMessage', {
        count: lights.length,
        mode: CHANNEL_MODE_OPTIONS.find((m) => m.mode === bulkMode)?.label ?? bulkMode,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.apply'), onPress: () => setAllChannelMode(bulkMode) },
      ],
    )
  }

  function applyRenumber() {
    const start = parseInt(renumberStart, 10)
    renumberSequential(Number.isFinite(start) ? start : 1)
  }

  function openEdit(light: Light) {
    setEditDialog(light)
    setEditName(light.name)
    setEditAddr(String(light.dmxAddress))
    setEditMode(light.channelMode)
    setEditDefaultColor(light.defaultColor ?? { r: 255, g: 255, b: 255, w: 0 })
    setEditRotation(light.rotation ?? 0)
    setEditBeamWidth(light.beamWidth ?? 1.0)
    setEditMaxIntensity(light.maxIntensity ?? 100)
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
      maxIntensity: Math.round(editMaxIntensity),
    })
    setEditDialog(null)
  }

  function confirmAdd() {
    const addr = parseInt(newAddr, 10)
    const nextAddr = lights.length > 0
      ? Math.max(...lights.map((l) => l.dmxAddress + CHANNEL_MODE_CONFIGS[l.channelMode].channelCount))
      : 1
    addLight(
      newName.trim() || `Light ${lights.length + 1}`,
      addr >= 1 && addr <= 512 ? addr : nextAddr,
      newMode,
    )
    setNewName(''); setNewAddr(''); setNewMode('DIM16_RGBWAUV')
    setAddDialog(false)
  }

  return (
    <View style={styles.lightsRoot}>

      {/* ── Virtual scene (outside scroll — gesture-safe) ── */}
      <View style={styles.sceneArea}>
        <View style={styles.sceneHeader}>
          <Text style={styles.sectionTitle}>{t('settings.lights.virtualScene')}</Text>
          <View style={styles.sceneHeaderRight}>
            <HelpButton section="lights" />
            {testMode
              ? <Chip icon="palette" onPress={stopTestMode} style={styles.testChipActive} textStyle={styles.testChipTextActive}>{t('settings.lights.stopTest')}</Chip>
              : <Chip icon="lightbulb-on-outline" onPress={startTestMode} style={styles.testChip} textStyle={styles.testChipText}>{t('settings.lights.testMode')}</Chip>
            }
          </View>
        </View>

        {testMode && (
          <View style={styles.testBanner}>
            <Text style={styles.testBannerText}>
              {t('settings.lights.testBanner')}
            </Text>
          </View>
        )}

        {!testMode && activeAmbiance && (
          <Text style={styles.sceneSubtitle}>
            {t('settings.lights.showing')}<Text style={{ color: '#ff6b35' }}>{activeAmbiance.name}</Text>
          </Text>
        )}
        {!testMode && !activeAmbiance && (
          <Text style={styles.sceneSubtitle}>{t('settings.lights.showingDefault')}</Text>
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
          <Text style={styles.sectionTitle}>{t('settings.lights.configuredLights')}</Text>
          <View style={{ flexDirection: 'row' }}>
            <Button icon="tune" mode="text" compact onPress={() => setBulkDialog(true)} disabled={lights.length === 0}>
              {t('settings.lights.bulkSetup')}
            </Button>
            <Button icon="plus" mode="text" compact onPress={() => { setNewName(''); setNewAddr(''); setAddDialog(true) }}>
              {t('common.add')}
            </Button>
          </View>
        </View>

        {(() => {
          const overlapping = findOverlappingLightIds(lights)
          return lights.map((light) => {
            const dc = light.defaultColor ?? { r: 255, g: 255, b: 255, w: 0 }
            const defColorStr = `rgb(${Math.min(255, dc.r + dc.w)},${Math.min(255, dc.g + dc.w)},${Math.min(255, dc.b + dc.w)})`
            const [chStart, chEnd] = getChannelRange(light)
            const hasOverlap = overlapping.has(light.id)
            return (
              <View key={light.id} style={styles.lightRow}>
                <View style={[styles.colorDot, { backgroundColor: defColorStr }]} />
                <View style={styles.lightRowInfo}>
                  <Text style={styles.lightRowName}>{light.name}</Text>
                  <Text style={[styles.lightRowMeta, hasOverlap && styles.lightRowMetaWarn]}>
                    {t('settings.lights.channelRange', {
                      range: chStart === chEnd ? chStart : `${chStart}–${chEnd}`,
                      mode: light.channelMode,
                    })}
                    {hasOverlap ? t('settings.lights.overlapWarning') : ''}
                  </Text>
                </View>
                <IconButton icon="pencil" size={18} iconColor="#ff6b35" onPress={() => openEdit(light)} />
                <IconButton
                  icon="delete-outline" size={18} iconColor="#e74c3c"
                  onPress={() =>
                    Alert.alert(t('settings.lights.removeTitle'), t('settings.lights.removeMessage', { name: light.name }), [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('common.remove'), style: 'destructive', onPress: () => removeLight(light.id) },
                    ])
                  }
                />
              </View>
            )
          })
        })()}
        {lights.length === 0 && (
          <Text style={styles.emptyHint}>{t('settings.lights.emptyHint')}</Text>
        )}

        {/* ── Stage zones ── */}
        <ZoneEditor />

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Bulk setup dialog: same format for all lights + auto-numbering ── */}
      <Portal>
        <Dialog visible={bulkDialog} onDismiss={() => setBulkDialog(false)}>
          <Dialog.Title>{t('settings.lights.bulkSetupTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogLabel}>{t('settings.lights.bulkFormatLabel')}</Text>
            <Text style={styles.hint}>
              {t('settings.lights.bulkFormatHint')}
            </Text>
            <Menu
              visible={bulkModeMenuVisible}
              onDismiss={() => setBulkModeMenuVisible(false)}
              anchor={
                <Button mode="outlined" onPress={() => setBulkModeMenuVisible(true)} style={styles.modeBtn}>
                  {CHANNEL_MODE_OPTIONS.find((m) => m.mode === bulkMode)?.label ?? bulkMode}
                </Button>
              }
            >
              {CHANNEL_MODE_OPTIONS.map((opt) => (
                <Menu.Item key={opt.mode} title={opt.label} onPress={() => { setBulkMode(opt.mode); setBulkModeMenuVisible(false) }} />
              ))}
            </Menu>
            <Button mode="contained" onPress={applyBulkMode} style={[styles.testBtn, { marginTop: 8 }]} contentStyle={styles.testBtnContent}>
              {t('settings.lights.bulkApplyButton', { count: lights.length })}
            </Button>

            <View style={styles.bulkDivider} />

            <Text style={styles.dialogLabel}>{t('settings.lights.bulkRenumberLabel')}</Text>
            <Text style={styles.hint}>
              {t('settings.lights.bulkRenumberHint')}
            </Text>
            <TextInput
              label={t('settings.lights.startAddressLabel')}
              value={renumberStart}
              onChangeText={setRenumberStart}
              keyboardType="numeric"
              mode="outlined"
              style={styles.dialogInput}
            />
            <Button mode="contained" onPress={applyRenumber} style={styles.testBtn} contentStyle={styles.testBtnContent}>
              {t('settings.lights.bulkRenumberButton', { count: lights.length })}
            </Button>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setBulkDialog(false)}>{t('common.done')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Add dialog ── */}
      <Portal>
        <Dialog visible={addDialog} onDismiss={() => setAddDialog(false)}>
          <Dialog.Title>{t('settings.lights.addLightTitle')}</Dialog.Title>
          <Dialog.Content>
            <TextInput label={t('settings.lights.nameLabel')} value={newName} onChangeText={setNewName} mode="outlined" style={styles.dialogInput} autoFocus placeholder={`Light ${lights.length + 1}`} />
            <TextInput label={t('settings.lights.addressLabel')} value={newAddr} onChangeText={setNewAddr} keyboardType="numeric" mode="outlined" style={styles.dialogInput} />
            <Text style={styles.dialogLabel}>{t('settings.lights.channelModeLabel')}</Text>
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
            <Button onPress={() => setAddDialog(false)}>{t('common.cancel')}</Button>
            <Button onPress={confirmAdd}>{t('common.add')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Edit / configure dialog ── */}
      <Portal>
        <Dialog visible={!!editDialog} onDismiss={() => setEditDialog(null)}>
          <Dialog.Title>{t('settings.lights.configureLightTitle')}</Dialog.Title>
          <Dialog.ScrollArea style={styles.editScrollArea}>
            <ScrollView>
              <TextInput label={t('settings.lights.nameLabel')} value={editName} onChangeText={setEditName} mode="outlined" style={styles.dialogInput} autoFocus />
              <TextInput label={t('settings.lights.addressLabel')} value={editAddr} onChangeText={setEditAddr} keyboardType="numeric" mode="outlined" style={styles.dialogInput} />

              <Text style={styles.dialogLabel}>{t('settings.lights.channelModeLabel')}</Text>
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
                {t('settings.lights.beamDirection', { deg: Math.round(editRotation), label: rotationLabel(editRotation, t) })}
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
                {t('settings.lights.beamWidth', { label: beamWidthLabel(editBeamWidth, t) })}
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

              {/* ── Max intensity cap ── */}
              <Text style={[styles.dialogLabel, { marginTop: 10 }]}>
                {t('settings.lights.maxIntensity', { pct: Math.round(editMaxIntensity) })}
              </Text>
              <Slider
                value={editMaxIntensity}
                onValueChange={setEditMaxIntensity}
                minimumValue={5}
                maximumValue={100}
                step={5}
                minimumTrackTintColor="#ff6b35"
                maximumTrackTintColor="#333"
                thumbTintColor="#ff6b35"
                style={styles.slider}
              />
              <Text style={styles.hint}>{t('settings.lights.maxIntensityHint')}</Text>

              {/* ── Default color picker ── */}
              <Text style={[styles.dialogLabel, { marginTop: 14 }]}>{t('settings.lights.defaultColorLabel')}</Text>
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
            <Button onPress={() => setEditDialog(null)}>{t('common.cancel')}</Button>
            <Button onPress={confirmEdit}>{t('common.save')}</Button>
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
  const { t } = useTranslation()
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
    if (!config) { showErr(t('settings.data.notValidFile')); return }
    if (importMode === 'replace') {
      Alert.alert(
        t('settings.data.replaceConfirmTitle'),
        t('settings.data.replaceConfirmMessage'),
        [
          { text: t('common.cancel'), style: 'cancel', onPress: () => setBusy(false) },
          { text: t('settings.data.replace'), style: 'destructive', onPress: () => {
            applyConfig(config, 'replace')
            showOk(t('settings.data.loadedMessage', { ambCount: config.ambiances.length, lightCount: config.lights.length }))
          }},
        ],
      )
    } else {
      applyConfig(config, 'merge')
      showOk(t('settings.data.mergedMessage', { ambCount: config.ambiances.length, lightCount: config.lights.length }))
    }
  }

  function applySLSImport(text: string, filename: string) {
    if (lights.length === 0) {
      showErr(t('settings.data.addLightsFirstError'))
      return
    }
    const imported = importSLS(text, lights)
    if (imported.length === 0) { showErr(t('settings.data.noAmbiancesInSls')); return }
    const catName = filename.replace(/\.[^.]+$/, '').slice(0, 40) || 'Myriad Import'
    const catId = addCategory(catName)
    for (const amb of imported) {
      const newId = addAmbiance(amb.name, catId)
      for (const [lightId, state] of Object.entries(amb.lightStates)) {
        setLightState(newId, lightId, state)
      }
    }
    showOk(t('settings.data.importedSlsMessage', { count: imported.length, category: catName }))
  }

  function handleFactoryReset() {
    Alert.alert(
      t('settings.data.factoryReset'),
      t('settings.data.factoryResetConfirmMessage', { ambCount: customAmbiances.length, lightCount: lights.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.reset'),
          style: 'destructive',
          onPress: () => {
            useAmbiancesStore.setState({
              ambiances: DEFAULT_AMBIANCES,
              categories: DEFAULT_CATEGORIES,
              activeAmbianceId: null,
            })
            useLightsStore.setState({ lights: DEFAULT_LIGHTS })
            showOk(t('settings.data.restoredDefaults'))
          },
        },
      ],
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>

      {/* ── EXPORT ── */}
      <View style={styles.tabHeaderRow}>
        <Text style={styles.sectionTitle}>{t('settings.data.exportTitle')}</Text>
        <HelpButton section="backup" />
      </View>
      <View style={styles.card}>
        <View style={styles.exportHeaderRow}>
          <Text style={styles.cardLabel}>{t('settings.data.customOnly')}</Text>
          <Text style={styles.cardCount}>
            {t('settings.data.ambianceCount', { count: customAmbiances.length })}
          </Text>
        </View>
        <Text style={styles.hint}>{t('settings.data.excludedHint')}</Text>

        <Text style={[styles.dialogLabel, { marginTop: 2 }]}>{t('settings.data.formatLabel')}</Text>
        <View style={styles.formatRow}>
          <Pressable
            style={[styles.formatChip, exportFormat === 'sls' && styles.formatChipActive]}
            onPress={() => setExportFormat('sls')}
          >
            <Text style={[styles.formatChipLabel, exportFormat === 'sls' && styles.formatChipLabelActive]}>
              {t('settings.data.formatSls')}
            </Text>
            <Text style={styles.formatChipExt}>.SLS_AmbiancesDigest</Text>
          </Pressable>
          <Pressable
            style={[styles.formatChip, exportFormat === 'json' && styles.formatChipActive]}
            onPress={() => setExportFormat('json')}
          >
            <Text style={[styles.formatChipLabel, exportFormat === 'json' && styles.formatChipLabelActive]}>
              {t('settings.data.formatJson')}
            </Text>
            <Text style={styles.formatChipExt}>.dmximp.json</Text>
          </Pressable>
        </View>

        <Button
          icon="share" mode="contained" onPress={handleExportFile} loading={busy}
          disabled={busy || customAmbiances.length === 0}
          style={styles.dataBtn} contentStyle={styles.dataBtnContent}
        >
          {t('settings.data.exportToFile')}
        </Button>
        <Button
          icon="content-copy" mode="outlined" onPress={handleCopyClipboard} loading={busy}
          disabled={busy || customAmbiances.length === 0}
          style={styles.dataBtnOutline} contentStyle={styles.dataBtnContent}
        >
          {t('settings.data.copyToClipboard')}
        </Button>
        {customAmbiances.length === 0 && (
          <Text style={[styles.hint, { textAlign: 'center', marginTop: 4 }]}>
            {t('settings.data.noCustomAmbiances')}
          </Text>
        )}
      </View>

      {/* ── IMPORT ── */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{t('settings.data.importTitle')}</Text>
      <Text style={styles.hint}>
        {t('settings.data.importHint')}
      </Text>
      <View style={styles.card}>
        <Text style={styles.dialogLabel}>{t('settings.data.importMode')}</Text>
        <View style={styles.radioRow}>
          <Pressable style={styles.radioOption} onPress={() => setImportMode('merge')}>
            <RadioButton value="merge" status={importMode === 'merge' ? 'checked' : 'unchecked'} color="#ff6b35" onPress={() => setImportMode('merge')} />
            <View>
              <Text style={styles.radioLabel}>{t('settings.data.merge')}</Text>
              <Text style={styles.radioHint}>{t('settings.data.mergeHint')}</Text>
            </View>
          </Pressable>
          <Pressable style={styles.radioOption} onPress={() => setImportMode('replace')}>
            <RadioButton value="replace" status={importMode === 'replace' ? 'checked' : 'unchecked'} color="#ff6b35" onPress={() => setImportMode('replace')} />
            <View>
              <Text style={styles.radioLabel}>{t('settings.data.replaceAll')}</Text>
              <Text style={styles.radioHint}>{t('settings.data.replaceAllHint')}</Text>
            </View>
          </Pressable>
        </View>
        <Button
          icon="folder-open" mode="contained" onPress={handleImportFile} loading={busy}
          disabled={busy} style={styles.dataBtn} contentStyle={styles.dataBtnContent}
        >
          {t('settings.data.importFromFile')}
        </Button>
        <Button
          icon="clipboard-text" mode="outlined" onPress={handlePasteClipboard} loading={busy}
          disabled={busy} style={styles.dataBtnOutline} contentStyle={styles.dataBtnContent}
        >
          {t('settings.data.pasteFromClipboard')}
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
      <Text style={[styles.sectionTitle, { marginTop: 24, color: '#7a2020' }]}>{t('settings.data.dangerZone')}</Text>
      <View style={[styles.card, styles.dangerCard]}>
        <Text style={styles.dialogLabel}>{t('settings.data.factoryReset')}</Text>
        <Text style={styles.hint}>
          {t('settings.data.factoryResetHint')}
        </Text>
        <Button
          icon="restore"
          mode="outlined"
          onPress={handleFactoryReset}
          style={styles.dangerBtn}
          contentStyle={styles.dataBtnContent}
          textColor="#e74c3c"
        >
          {t('settings.data.factoryResetButton')}
        </Button>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TUTORIAL TAB — static illustrated how-to-use guide + language switcher
// ─────────────────────────────────────────────────────────────────────────────
const TUTORIAL_SECTIONS: Array<{ key: HelpSection; icon: string }> = [
  { key: 'control', icon: 'lightbulb-on-outline' },
  { key: 'editor', icon: 'palette-outline' },
  { key: 'network', icon: 'wifi' },
  { key: 'lights', icon: 'lightbulb-group-outline' },
  { key: 'backup', icon: 'archive-outline' },
  { key: 'troubleshooting', icon: 'lifebuoy' },
]

function TutorialTab() {
  const { t, i18n: i18next } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const [expanded, setExpanded] = useState<HelpSection | null>('network')

  function selectLanguage(lang: AppLanguage) {
    setLanguage(lang)
    i18next.changeLanguage(lang)
  }

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Text style={styles.sectionTitle}>{t('settings.tutorial.language')}</Text>
      <View style={styles.langRow}>
        <Pressable
          style={[styles.langChip, language === 'fr' && styles.langChipActive]}
          onPress={() => selectLanguage('fr')}
        >
          <Text style={[styles.langChipLabel, language === 'fr' && styles.langChipLabelActive]}>🇫🇷 Français</Text>
        </Pressable>
        <Pressable
          style={[styles.langChip, language === 'en' && styles.langChipActive]}
          onPress={() => selectLanguage('en')}
        >
          <Text style={[styles.langChipLabel, language === 'en' && styles.langChipLabelActive]}>🇬🇧 English</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{t('settings.tutorial.title')}</Text>
      <Text style={styles.hint}>{t('settings.tutorial.intro')}</Text>

      {/* ── Quick start checklist ── */}
      <View style={styles.card}>
        <Text style={styles.dialogLabel}>{t('settings.tutorial.quickStart.title')}</Text>
        {(t('settings.tutorial.quickStart.items', { returnObjects: true }) as unknown as string[]).map((item, i) => (
          <View key={i} style={styles.checklistRow}>
            <View style={styles.checklistNum}><Text style={styles.checklistNumText}>{i + 1}</Text></View>
            <Text style={styles.checklistText}>{item}</Text>
          </View>
        ))}
      </View>

      {/* ── Full guide, one accordion section per screen ── */}
      <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 8 }]}>{t('settings.tabs.tutorial').toUpperCase()}</Text>
      {TUTORIAL_SECTIONS.map(({ key, icon }) => {
        const isOpen = expanded === key
        const points = t(`settings.tutorial.sections.${key}.points`, { returnObjects: true }) as unknown as string[]
        return (
          <View key={key} style={[styles.card, styles.tutorialCard]}>
            <Pressable style={styles.tutorialAccordionHeader} onPress={() => setExpanded(isOpen ? null : key)}>
              <IconButton icon={icon} size={20} iconColor="#ff6b35" style={{ margin: 0 }} />
              <Text style={styles.tutorialStepTitle}>{t(`settings.tutorial.sections.${key}.title`)}</Text>
              <IconButton icon={isOpen ? 'chevron-up' : 'chevron-down'} size={20} iconColor="#666" style={{ margin: 0 }} />
            </Pressable>
            {isOpen && (
              <View style={styles.tutorialAccordionBody}>
                <Text style={styles.tutorialStepBody}>{t(`settings.tutorial.sections.${key}.intro`)}</Text>
                {Array.isArray(points) && points.map((p, i) => (
                  <View key={i} style={styles.pointRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.pointText}>{p}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )
      })}

      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ZONE EDITOR (inside Lights tab scroll)
// ─────────────────────────────────────────────────────────────────────────────
function ZoneEditor() {
  const { t } = useTranslation()
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
        <Text style={styles.sectionTitle}>{t('settings.lights.stageZones')}</Text>
        <View style={styles.zoneSectionRight}>
          <Switch value={zonesEnabled} onValueChange={setZonesEnabled} color="#ff6b35" />
          <Button mode="text" compact onPress={resetZones} style={{ marginLeft: 4 }}>{t('common.reset')}</Button>
        </View>
      </View>
      <Text style={styles.hint}>{t('settings.lights.stageZonesHint')}</Text>
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

function getChannelRange(light: Light): [number, number] {
  const count = CHANNEL_MODE_CONFIGS[light.channelMode].channelCount
  return [light.dmxAddress, light.dmxAddress + count - 1]
}

function findOverlappingLightIds(lights: Light[]): Set<string> {
  const overlapping = new Set<string>()
  for (let i = 0; i < lights.length; i++) {
    const [aStart, aEnd] = getChannelRange(lights[i])
    for (let j = i + 1; j < lights.length; j++) {
      const [bStart, bEnd] = getChannelRange(lights[j])
      if (aStart <= bEnd && bStart <= aEnd) {
        overlapping.add(lights[i].id)
        overlapping.add(lights[j].id)
      }
    }
  }
  return overlapping
}

function rotationLabel(deg: number, t: (key: string, opts?: any) => string): string {
  // -180..180 range: 0 = audience, ±180 = back
  const a = Math.abs(deg)
  if (a < 22)  return t('settings.lights.rotation.audience')
  if (deg > 0) {
    if (deg < 67)  return '↙'
    if (deg < 112) return t('settings.lights.rotation.left')
    if (deg < 157) return '↖'
    return t('settings.lights.rotation.back')
  } else {
    if (deg > -67)  return '↘'
    if (deg > -112) return t('settings.lights.rotation.right')
    if (deg > -157) return '↗'
    return t('settings.lights.rotation.back')
  }
}

function beamWidthLabel(v: number, t: (key: string, opts?: any) => string): string {
  if (v < 0.65) return t('settings.lights.beamWidthLabel.tight', { v: v.toFixed(1) })
  if (v < 1.15) return t('settings.lights.beamWidthLabel.medium', { v: v.toFixed(1) })
  if (v < 1.75) return t('settings.lights.beamWidthLabel.wide', { v: v.toFixed(1) })
  return t('settings.lights.beamWidthLabel.full', { v: v.toFixed(1) })
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
  tabHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

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
  lightRowMetaWarn: { color: '#e74c3c' },
  emptyHint: { color: '#444', fontSize: 13, textAlign: 'center', marginTop: 16 },

  bulkDivider: { height: 1, backgroundColor: '#262626', marginVertical: 16 },
  editScrollArea: { maxHeight: 420 },

  // ── Tutorial tab ──
  langRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  langChip: {
    flex: 1, backgroundColor: '#1e1e1e', borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#333',
  },
  langChipActive: { borderColor: '#ff6b35', backgroundColor: 'rgba(255,107,53,0.1)' },
  langChipLabel: { fontSize: 14, fontWeight: '700', color: '#888' },
  langChipLabelActive: { color: '#ff6b35' },
  tutorialStepHeader: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 4 },
  tutorialStepTitle: { fontSize: 14, fontWeight: '700', color: '#fff', flex: 1 },
  tutorialStepBody: { fontSize: 13, color: '#aaa', lineHeight: 19, marginBottom: 8 },
  tutorialExampleBox: {
    marginTop: 10, padding: 10, borderRadius: 8,
    backgroundColor: 'rgba(255,107,53,0.08)',
    borderLeftWidth: 3, borderLeftColor: '#ff6b35',
  },
  tutorialExampleText: { fontSize: 12, color: '#ff6b35', lineHeight: 17 },
  tutorialCard: { padding: 0, marginBottom: 10, overflow: 'hidden' },
  tutorialAccordionHeader: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 2 },
  tutorialAccordionBody: { paddingHorizontal: 14, paddingBottom: 12 },
  pointRow: { flexDirection: 'row', gap: 8, marginBottom: 6, paddingRight: 4 },
  bullet: { color: '#ff6b35', fontSize: 13, lineHeight: 18 },
  pointText: { flex: 1, fontSize: 12.5, color: '#ccc', lineHeight: 18 },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  checklistNum: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#ff6b35',
    alignItems: 'center', justifyContent: 'center',
  },
  checklistNumText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  checklistText: { flex: 1, fontSize: 13, color: '#ddd' },
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
