import React, { useState } from 'react'
import { ScrollView, StyleSheet, View, Alert } from 'react-native'
import { Text, TextInput, Button, IconButton, Portal, Dialog } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FixtureChannelEditor } from '../../src/components/FixtureChannelEditor'
import { useFixturesStore } from '../../src/store/fixturesStore'
import { useSettingsStore } from '../../src/store/settingsStore'
import { dmxService } from '../../src/dmx'

export default function SettingsScreen() {
  const fixtures = useFixturesStore((s) => s.fixtures)
  const categories = useFixturesStore((s) => s.categories)
  const removeFixture = useFixturesStore((s) => s.removeFixture)
  const addFixture = useFixturesStore((s) => s.addFixture)

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
  const [addDialog, setAddDialog] = useState(false)
  const [newFixtureName, setNewFixtureName] = useState('')

  function commitIp() {
    setReceiverIp(ipInput.trim() || receiverIp)
  }

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
    try {
      const testFixtures = fixtures.map((f) => ({ id: f.id, dmxAddress: f.dmxAddress, channelMode: f.channelMode }))
      const testScene: Record<string, { r: number; g: number; b: number; w: number; intensity: number; isOn: boolean }> = {}
      for (const f of fixtures) {
        testScene[f.id] = { r: 255, g: 255, b: 255, w: 255, intensity: 100, isOn: true }
      }
      await dmxService.sync(testFixtures, testScene, false, receiverIp, receiverPort, universe)
      await new Promise((r) => setTimeout(r, 500))
      await dmxService.sync(testFixtures, testScene, true, receiverIp, receiverPort, universe)
      await new Promise((r) => setTimeout(r, 300))
      await dmxService.sync(testFixtures, testScene, false, receiverIp, receiverPort, universe)
      await new Promise((r) => setTimeout(r, 500))
      await dmxService.sync(testFixtures, testScene, true, receiverIp, receiverPort, universe)
      Alert.alert('Test Sent', 'Blink sequence sent to ' + receiverIp + '. If lights blinked, the connection works!')
    } catch (e: any) {
      Alert.alert('Connection Error', e?.message ?? 'Unknown error')
    } finally {
      setTesting(false)
    }
  }

  function confirmAddFixture() {
    if (!newFixtureName.trim()) return
    const nextAddr = fixtures.length > 0
      ? Math.max(...fixtures.map((f) => f.dmxAddress + 3))
      : 1
    addFixture(newFixtureName.trim(), nextAddr, 'RGB', categories[0]?.id ?? '')
    setNewFixtureName('')
    setAddDialog(false)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineSmall" style={styles.pageTitle}>Settings</Text>

        {/* ── Fixtures ── */}
        <Text style={styles.sectionTitle}>FIXTURES</Text>
        <View style={styles.card}>
          {fixtures.map((fixture) => (
            <View key={fixture.id}>
              <View style={styles.fixtureHeader}>
                <Text style={styles.fixtureName}>{fixture.name}</Text>
                <IconButton
                  icon="delete-outline"
                  iconColor="#e74c3c"
                  size={18}
                  onPress={() =>
                    Alert.alert('Remove Fixture', `Remove "${fixture.name}"?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => removeFixture(fixture.id) },
                    ])
                  }
                />
              </View>
              <FixtureChannelEditor fixture={fixture} />
            </View>
          ))}

          <Button
            mode="text"
            icon="plus"
            onPress={() => {
              setNewFixtureName('')
              setAddDialog(true)
            }}
            style={styles.addBtn}
          >
            Add Fixture
          </Button>
        </View>

        <View style={{ height: 16 }} />

        {/* ── Network / DMX Receiver ── */}
        <Text style={styles.sectionTitle}>DMX RECEIVER (Eurolite FreeDMX AP)</Text>
        <View style={styles.card}>
          <TextInput
            label="Receiver IP"
            value={ipInput}
            onChangeText={setIpInput}
            onBlur={commitIp}
            keyboardType="numeric"
            mode="outlined"
            style={styles.input}
            dense
          />
          <TextInput
            label="UDP Port"
            value={portInput}
            onChangeText={setPortInput}
            onBlur={commitPort}
            keyboardType="numeric"
            mode="outlined"
            style={styles.input}
            dense
          />
          <TextInput
            label="Art-Net Universe (0–255)"
            value={universeInput}
            onChangeText={setUniverseInput}
            onBlur={commitUniverse}
            keyboardType="numeric"
            mode="outlined"
            style={styles.input}
            dense
          />

          <View style={styles.helpRow}>
            <Text style={styles.help}>
              Default Eurolite AP IP: 2.0.0.1  · Port: 6454  · Universe: 0
            </Text>
          </View>

          <Button
            mode="contained"
            onPress={testConnection}
            loading={testing}
            disabled={testing}
            icon="wifi"
            style={styles.testBtn}
          >
            Test Connection (Blink)
          </Button>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Portal>
        <Dialog visible={addDialog} onDismiss={() => setAddDialog(false)}>
          <Dialog.Title>Add Fixture</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Fixture Name"
              value={newFixtureName}
              onChangeText={setNewFixtureName}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddDialog(false)}>Cancel</Button>
            <Button onPress={confirmAddFixture} disabled={!newFixtureName.trim()}>
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 16,
  },
  pageTitle: {
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#141414',
    borderRadius: 14,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  fixtureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  fixtureName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  addBtn: {
    margin: 8,
  },
  input: {
    marginHorizontal: 16,
    marginVertical: 4,
    backgroundColor: 'transparent',
  },
  helpRow: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  help: {
    fontSize: 11,
    color: '#555',
  },
  testBtn: {
    margin: 16,
    backgroundColor: '#ff6b35',
  },
})
