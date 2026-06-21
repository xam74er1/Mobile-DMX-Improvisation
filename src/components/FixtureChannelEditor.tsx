import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, TextInput, Menu, Button, Divider } from 'react-native-paper'
import { CHANNEL_MODE_OPTIONS, type ChannelMode } from '../constants/channelModes'
import { useFixturesStore, type Fixture } from '../store/fixturesStore'

interface Props {
  fixture: Fixture
}

export function FixtureChannelEditor({ fixture }: Props) {
  const updateFixture = useFixturesStore((s) => s.updateFixture)
  const [menuVisible, setMenuVisible] = useState(false)
  const [nameInput, setNameInput] = useState(fixture.name)
  const [addrInput, setAddrInput] = useState(String(fixture.dmxAddress))

  function commitName() {
    const trimmed = nameInput.trim()
    if (trimmed) updateFixture(fixture.id, { name: trimmed })
    else setNameInput(fixture.name)
  }

  function commitAddr() {
    const n = parseInt(addrInput, 10)
    if (n >= 1 && n <= 512) {
      updateFixture(fixture.id, { dmxAddress: n })
    } else {
      setAddrInput(String(fixture.dmxAddress))
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        label="Name"
        value={nameInput}
        onChangeText={setNameInput}
        onBlur={commitName}
        mode="outlined"
        style={styles.input}
        dense
      />

      <TextInput
        label="DMX Start Address (1–512)"
        value={addrInput}
        onChangeText={setAddrInput}
        onBlur={commitAddr}
        keyboardType="numeric"
        mode="outlined"
        style={styles.input}
        dense
      />

      <View style={styles.modeRow}>
        <Text style={styles.modeLabel}>Channel Mode</Text>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setMenuVisible(true)}
              style={styles.modeButton}
              compact
            >
              {CHANNEL_MODE_OPTIONS.find((m) => m.mode === fixture.channelMode)?.label ?? fixture.channelMode}
            </Button>
          }
        >
          {CHANNEL_MODE_OPTIONS.map((opt) => (
            <Menu.Item
              key={opt.mode}
              title={opt.label}
              onPress={() => {
                updateFixture(fixture.id, { channelMode: opt.mode as ChannelMode })
                setMenuVisible(false)
              }}
            />
          ))}
        </Menu>
      </View>

      <Divider style={styles.divider} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    backgroundColor: 'transparent',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  modeLabel: {
    fontSize: 14,
    color: '#aaaaaa',
  },
  modeButton: {
    minWidth: 160,
  },
  divider: {
    marginTop: 12,
    backgroundColor: '#2a2a2a',
  },
})
