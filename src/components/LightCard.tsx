import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, TouchableRipple } from 'react-native-paper'
import { useSceneStore } from '../store/sceneStore'
import type { Fixture } from '../store/fixturesStore'

interface Props {
  fixture: Fixture
  onLongPress: () => void
}

export function LightCard({ fixture, onLongPress }: Props) {
  const { ensureFixture } = useSceneStore()
  const state = useSceneStore((s) => s.channels[fixture.id])
  const toggleFixture = useSceneStore((s) => s.toggleFixture)
  const blackout = useSceneStore((s) => s.blackout)

  useEffect(() => {
    ensureFixture(fixture.id)
  }, [fixture.id])

  const r = state?.r ?? 255
  const g = state?.g ?? 0
  const b = state?.b ?? 0
  const w = state?.w ?? 0
  const intensity = state?.intensity ?? 100
  const isOn = state?.isOn ?? false

  const effectiveOn = isOn && !blackout

  // Compute displayed color (mix white into RGB)
  const ratio = effectiveOn ? intensity / 100 : 0
  const dr = Math.round(Math.min(255, r + w) * ratio)
  const dg = Math.round(Math.min(255, g + w) * ratio)
  const db = Math.round(Math.min(255, b + w) * ratio)

  const bgColor = effectiveOn
    ? `rgb(${dr},${dg},${db})`
    : '#1c1c1c'

  const isDark = (dr * 0.299 + dg * 0.587 + db * 0.114) < 128 || !effectiveOn
  const textColor = isDark ? '#ffffff' : '#000000'

  return (
    <TouchableRipple
      onPress={() => toggleFixture(fixture.id)}
      onLongPress={onLongPress}
      style={[styles.card, { backgroundColor: bgColor }]}
      borderless
    >
      <View style={styles.content}>
        <View style={[styles.indicator, effectiveOn ? styles.indicatorOn : styles.indicatorOff]} />
        <Text style={[styles.name, { color: textColor }]} numberOfLines={2}>
          {fixture.name}
        </Text>
        <Text style={[styles.addr, { color: isDark ? '#888' : '#333' }]}>
          ch{fixture.dmxAddress} · {fixture.channelMode}
        </Text>
      </View>
    </TouchableRipple>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 12,
    margin: 6,
    flex: 1,
    minHeight: 100,
    justifyContent: 'flex-end',
    elevation: 3,
    overflow: 'hidden',
  },
  content: {
    gap: 4,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  indicatorOn: {
    backgroundColor: '#ffffff',
  },
  indicatorOff: {
    backgroundColor: '#444444',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  addr: {
    fontSize: 10,
  },
})
