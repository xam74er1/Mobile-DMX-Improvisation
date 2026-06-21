import React, { useState } from 'react'
import { ScrollView, StyleSheet, View, Alert } from 'react-native'
import {
  Text, TextInput, Button, IconButton, Portal, Dialog,
  SegmentedButtons, Menu,
} from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLightsStore, type Light } from '../../src/store/lightsStore'
import { useSettingsStore } from '../../src/store/settingsStore'
import { dmxService } from '../../src/dmx'
import { CHANNEL_MODE_OPTIONS, type ChannelMode } from '../../src/constants/channelModes'

type Tab = 'connection' | 'lights'

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
          ]}
          style={styles.segmented}
        />
      </View>

      {tab === 'connection' ? <ConnectionTab /> : <LightsTab />}
    </SafeAreaView>
  )
}

// ─────────────────────────────────────────────────────────────
// CONNECTION TAB
// ─────────────────────────────────────────────────────────────
function ConnectionTab() {
  const receiverIp = useSettingsStore((s) => s.receiverIp)
  const receiverPort = useSettingsStore((s) => s.receiverPort)
  const universe = useSettingsStore((s) => s.universe)
  const setReceiverIp = useSettingsStore((s) => s.setReceiverIp)
  const setReceiverPort = useSettingsStore((s) => s.setReceiverPort)
  const setUniverse = useSettingsStore((s) => s.setUniverse)

  const [ipInput, setIpInput] = useState(receiverIp)
  const [portInput, setPortInput] = useState(String(receiverPort))
  const [universeInput, setUniverseInput] = useState(String(universe))
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'none' | 'ok' | 'fail'>('none')

  const lights = useLightsStore((s) => s.lights)

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
      const allOn: Record<string, { r: number; g: number; b: number; w: number; intensity: number; isOn: boolean }> = {}
      for (const f of fixtures) allOn[f.id] = { r: 255, g: 255, b: 255, w: 255, intensity: 100, isOn: true }

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
      <Text style={styles.hint}>Eurolite FreeDMX AP defaults: IP 2.0.0.1 · Port 6454 · Universe 0</Text>

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
          Test Connection (Blink All Lights)
        </Button>
      </View>
    </ScrollView>
  )
}

// ─────────────────────────────────────────────────────────────
// LIGHTS TAB — virtual scene
// ─────────────────────────────────────────────────────────────
function LightsTab() {
  const lights = useLightsStore((s) => s.lights)
  const addLight = useLightsStore((s) => s.addLight)
  const removeLight = useLightsStore((s) => s.removeLight)
  const updateLight = useLightsStore((s) => s.updateLight)
  const moveLight = useLightsStore((s) => s.moveLight)

  const [addDialog, setAddDialog] = useState(false)
  const [editDialog, setEditDialog] = useState<Light | null>(null)
  const [newName, setNewName] = useState('')
  const [newAddr, setNewAddr] = useState('1')
  const [newMode, setNewMode] = useState<ChannelMode>('RGB')
  const [modeMenuId, setModeMenuId] = useState<string | null>(null)

  // local edit state
  const [editName, setEditName] = useState('')
  const [editAddr, setEditAddr] = useState('')
  const [editMode, setEditMode] = useState<ChannelMode>('RGB')
  const [editModeMenuVisible, setEditModeMenuVisible] = useState(false)

  function openEdit(light: Light) {
    setEditDialog(light)
    setEditName(light.name)
    setEditAddr(String(light.dmxAddress))
    setEditMode(light.channelMode)
  }

  function confirmEdit() {
    if (!editDialog) return
    const addr = parseInt(editAddr, 10)
    updateLight(editDialog.id, {
      name: editName.trim() || editDialog.name,
      dmxAddress: addr >= 1 && addr <= 512 ? addr : editDialog.dmxAddress,
      channelMode: editMode,
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
    setNewName('')
    setNewAddr('')
    setNewMode('RGB')
    setAddDialog(false)
  }

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <View style={styles.lightsHeader}>
        <Text style={styles.sectionTitle}>SCENE LIGHTS</Text>
        <Button icon="plus" mode="text" onPress={() => { setNewName(''); setNewAddr(''); setAddDialog(true) }}>
          Add Light
        </Button>
      </View>
      <Text style={styles.hint}>Each rectangle = one physical light. Tap ✏ to configure.</Text>

      {/* Virtual scene grid */}
      <View style={styles.sceneGrid}>
        {lights.map((light, idx) => (
          <View key={light.id} style={styles.lightRect}>
            {/* Reorder arrows */}
            <View style={styles.lightRectArrows}>
              <IconButton
                icon="chevron-left"
                size={14}
                iconColor="#666"
                onPress={() => idx > 0 && moveLight(idx, idx - 1)}
                style={styles.arrowBtn}
              />
              <IconButton
                icon="chevron-right"
                size={14}
                iconColor="#666"
                onPress={() => idx < lights.length - 1 && moveLight(idx, idx + 1)}
                style={styles.arrowBtn}
              />
            </View>

            <Text style={styles.lightRectName} numberOfLines={2}>{light.name}</Text>
            <Text style={styles.lightRectMeta}>ch{light.dmxAddress} · {light.channelMode}</Text>

            <View style={styles.lightRectActions}>
              <IconButton
                icon="pencil"
                size={16}
                iconColor="#ff6b35"
                onPress={() => openEdit(light)}
                style={styles.lightActionBtn}
              />
              <IconButton
                icon="delete-outline"
                size={16}
                iconColor="#e74c3c"
                onPress={() =>
                  Alert.alert('Remove Light', `Remove "${light.name}"?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => removeLight(light.id) },
                  ])
                }
                style={styles.lightActionBtn}
              />
            </View>
          </View>
        ))}

        {lights.length === 0 && (
          <View style={styles.emptyScene}>
            <Text style={styles.emptySceneText}>No lights yet.</Text>
            <Text style={styles.hint}>Tap "Add Light" to add your first fixture.</Text>
          </View>
        )}
      </View>

      {/* ── Add dialog ── */}
      <Portal>
        <Dialog visible={addDialog} onDismiss={() => setAddDialog(false)}>
          <Dialog.Title>Add Light</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name"
              value={newName}
              onChangeText={setNewName}
              mode="outlined"
              style={styles.dialogInput}
              autoFocus
              placeholder={`Light ${lights.length + 1}`}
            />
            <TextInput
              label="DMX Start Address (1–512)"
              value={newAddr}
              onChangeText={setNewAddr}
              keyboardType="numeric"
              mode="outlined"
              style={styles.dialogInput}
            />
            <Text style={styles.dialogLabel}>Channel Mode</Text>
            <Menu
              visible={modeMenuId === 'add'}
              onDismiss={() => setModeMenuId(null)}
              anchor={
                <Button mode="outlined" onPress={() => setModeMenuId('add')} style={styles.modeBtn}>
                  {CHANNEL_MODE_OPTIONS.find((m) => m.mode === newMode)?.label ?? newMode}
                </Button>
              }
            >
              {CHANNEL_MODE_OPTIONS.map((opt) => (
                <Menu.Item
                  key={opt.mode}
                  title={opt.label}
                  onPress={() => { setNewMode(opt.mode); setModeMenuId(null) }}
                />
              ))}
            </Menu>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddDialog(false)}>Cancel</Button>
            <Button onPress={confirmAdd}>Add</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Edit dialog ── */}
      <Portal>
        <Dialog visible={!!editDialog} onDismiss={() => setEditDialog(null)}>
          <Dialog.Title>Configure Light</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name"
              value={editName}
              onChangeText={setEditName}
              mode="outlined"
              style={styles.dialogInput}
              autoFocus
            />
            <TextInput
              label="DMX Start Address (1–512)"
              value={editAddr}
              onChangeText={setEditAddr}
              keyboardType="numeric"
              mode="outlined"
              style={styles.dialogInput}
            />
            <Text style={styles.dialogLabel}>Channel Mode</Text>
            <Menu
              visible={editModeMenuVisible}
              onDismiss={() => setEditModeMenuVisible(false)}
              anchor={
                <Button mode="outlined" onPress={() => setEditModeMenuVisible(true)} style={styles.modeBtn}>
                  {CHANNEL_MODE_OPTIONS.find((m) => m.mode === editMode)?.label ?? editMode}
                </Button>
              }
            >
              {CHANNEL_MODE_OPTIONS.map((opt) => (
                <Menu.Item
                  key={opt.mode}
                  title={opt.label}
                  onPress={() => { setEditMode(opt.mode); setEditModeMenuVisible(false) }}
                />
              ))}
            </Menu>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditDialog(null)}>Cancel</Button>
            <Button onPress={confirmEdit}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
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

  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 1.5, marginBottom: 4,
  },
  hint: { fontSize: 12, color: '#444', marginBottom: 12 },

  card: { backgroundColor: '#141414', borderRadius: 14, padding: 16, gap: 10 },
  input: { backgroundColor: 'transparent' },
  testBtn: { backgroundColor: '#ff6b35', marginTop: 8 },
  testBtnContent: { paddingVertical: 4 },
  successMsg: { color: '#2ecc71', fontSize: 13, textAlign: 'center' },
  errorMsg: { color: '#e74c3c', fontSize: 13, textAlign: 'center' },

  lightsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
  },
  sceneGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8,
  },
  lightRect: {
    width: '47%',
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    minHeight: 120,
  },
  lightRectArrows: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  arrowBtn: { margin: 0, width: 24, height: 24 },
  lightRectName: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 4 },
  lightRectMeta: { fontSize: 11, color: '#666' },
  lightRectActions: { flexDirection: 'row', marginTop: 8 },
  lightActionBtn: { margin: 0 },
  emptyScene: { width: '100%', alignItems: 'center', paddingVertical: 40 },
  emptySceneText: { color: '#555', fontSize: 15, marginBottom: 8 },

  dialogInput: { backgroundColor: 'transparent', marginBottom: 8 },
  dialogLabel: { fontSize: 12, color: '#888', marginBottom: 4, marginTop: 4 },
  modeBtn: { marginBottom: 4 },
})
