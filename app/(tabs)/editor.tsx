import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Text, Button, Switch, Divider, Chip } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { SimpleColorPicker } from '../../src/components/SimpleColorPicker'
import { WheelColorPicker } from '../../src/components/WheelColorPicker'
import { IntensitySlider } from '../../src/components/IntensitySlider'
import { useSceneStore } from '../../src/store/sceneStore'
import { useFixturesStore } from '../../src/store/fixturesStore'
import { DEFAULT_COLORS } from '../../src/constants/defaultColors'

export default function EditorScreen() {
  const fixtures = useFixturesStore((s) => s.fixtures)
  const selectedFixtureId = useSceneStore((s) => s.selectedFixtureId)
  const selectFixture = useSceneStore((s) => s.selectFixture)
  const setFixtureState = useSceneStore((s) => s.setFixtureState)
  const setAllColor = useSceneStore((s) => s.setAllColor)
  const copyColor = useSceneStore((s) => s.copyColor)
  const pasteColor = useSceneStore((s) => s.pasteColor)
  const copiedColor = useSceneStore((s) => s.copiedColor)
  const channels = useSceneStore((s) => s.channels)
  const { ensureFixture } = useSceneStore()

  const [allMode, setAllMode] = useState(false)

  const activeFixtureId = selectedFixtureId ?? fixtures[0]?.id ?? null
  const activeState = activeFixtureId ? channels[activeFixtureId] : null

  useEffect(() => {
    if (activeFixtureId) ensureFixture(activeFixtureId)
  }, [activeFixtureId])

  const r = activeState?.r ?? 255
  const g = activeState?.g ?? 0
  const b = activeState?.b ?? 0
  const w = activeState?.w ?? 0
  const intensity = activeState?.intensity ?? 100

  const currentHex = rgbToHex(r, g, b)

  function applyColor(nr: number, ng: number, nb: number, nw: number) {
    if (allMode) {
      setAllColor({ r: nr, g: ng, b: nb, w: nw })
    } else if (activeFixtureId) {
      setFixtureState(activeFixtureId, { r: nr, g: ng, b: nb, w: nw })
    }
  }

  function applyIntensity(v: number) {
    if (allMode) {
      setAllColor({ r, g, b, w }, v)
    } else if (activeFixtureId) {
      setFixtureState(activeFixtureId, { intensity: v })
    }
  }

  function handleWheelColor(nr: number, ng: number, nb: number) {
    applyColor(nr, ng, nb, w)
  }

  function handleSwatchColor(nr: number, ng: number, nb: number, nw: number) {
    applyColor(nr, ng, nb, nw)
  }

  const selectedPreset = DEFAULT_COLORS.find(
    (c) => c.r === r && c.g === g && c.b === b && c.w === w,
  )

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.title}>
            Light Editor
          </Text>
          <View style={styles.allModeRow}>
            <Text style={styles.allModeLabel}>All Lights</Text>
            <Switch value={allMode} onValueChange={setAllMode} color="#ff6b35" />
          </View>
        </View>

        {/* Fixture selector */}
        {!allMode && fixtures.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.fixtureRow}
          >
            {fixtures.map((f) => (
              <Chip
                key={f.id}
                selected={f.id === activeFixtureId}
                onPress={() => selectFixture(f.id)}
                style={styles.fixtureChip}
                selectedColor="#ff6b35"
                compact
              >
                {f.name}
              </Chip>
            ))}
          </ScrollView>
        )}

        {allMode && (
          <View style={styles.allModeBanner}>
            <MaterialIcons name="info-outline" size={16} color="#ff6b35" />
            <Text style={styles.allModeBannerText}>
              Changes apply to all lights simultaneously
            </Text>
          </View>
        )}

        <Divider style={styles.divider} />

        {/* Color swatches */}
        <Text style={styles.sectionLabel}>QUICK COLORS</Text>
        <SimpleColorPicker
          onSelectColor={handleSwatchColor}
          selectedHex={selectedPreset?.hex}
        />

        <Divider style={styles.divider} />

        {/* Chromatic wheel */}
        <Text style={styles.sectionLabel}>COLOR WHEEL</Text>
        <WheelColorPicker currentHex={currentHex} onColorChange={handleWheelColor} />

        {/* White channel slider */}
        <IntensitySlider
          value={w / 2.55}
          onChange={(v) => applyColor(r, g, b, Math.round(v * 2.55))}
          label="White Channel"
        />

        <Divider style={styles.divider} />

        {/* Intensity */}
        <Text style={styles.sectionLabel}>INTENSITY</Text>
        <IntensitySlider value={intensity} onChange={applyIntensity} />

        <Divider style={styles.divider} />

        {/* Copy / Paste */}
        {!allMode && activeFixtureId && (
          <View style={styles.copyRow}>
            <Button
              mode="outlined"
              icon="content-copy"
              onPress={() => copyColor(activeFixtureId)}
              style={styles.copyBtn}
            >
              Copy Color
            </Button>
            <Button
              mode="outlined"
              icon="content-paste"
              onPress={() => pasteColor(activeFixtureId)}
              disabled={!copiedColor}
              style={styles.copyBtn}
            >
              Paste Color
            </Button>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
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
  safe: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    color: '#ffffff',
    fontWeight: '700',
  },
  allModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allModeLabel: {
    color: '#aaaaaa',
    fontSize: 13,
  },
  fixtureRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  fixtureChip: {
    backgroundColor: '#1a1a1a',
  },
  allModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  allModeBannerText: {
    color: '#ff6b35',
    fontSize: 12,
  },
  divider: {
    backgroundColor: '#1e1e1e',
    marginVertical: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 1.5,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  copyRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  copyBtn: {
    flex: 1,
  },
})
