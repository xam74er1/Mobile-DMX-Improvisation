import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, TouchableRipple } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import type { Ambiance } from '../store/ambiancesStore'

interface Props {
  ambiance: Ambiance
  isActive: boolean
  onPress: () => void
  onLongPress: () => void
}

export function AmbianceCard({ ambiance, isActive, onPress, onLongPress }: Props) {
  const previewColor = getPreviewColor(ambiance)
  const isDark = isColorDark(previewColor)

  return (
    <TouchableRipple
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.card,
        isActive ? { backgroundColor: previewColor, borderColor: '#ffffff', borderWidth: 2 } : styles.inactive,
      ]}
      borderless
    >
      <View style={styles.content}>
        {/* Color swatch */}
        <View style={[styles.swatch, { backgroundColor: previewColor }]} />

        <Text
          style={[styles.name, { color: isActive && !isDark ? '#000000' : '#ffffff' }]}
          numberOfLines={2}
        >
          {ambiance.name}
        </Text>

        {isActive && (
          <View style={styles.activeBadge}>
            <MaterialIcons name="check-circle" size={14} color={isDark ? '#ffffff' : '#000000'} />
            <Text style={[styles.activeBadgeText, { color: isDark ? '#ffffff' : '#000000' }]}>
              ACTIVE
            </Text>
          </View>
        )}

        <Text style={[styles.lightCount, { color: isActive && !isDark ? '#33333388' : '#88888888' }]}>
          {Object.keys(ambiance.lightStates).length} light
          {Object.keys(ambiance.lightStates).length !== 1 ? 's' : ''}
        </Text>
      </View>
    </TouchableRipple>
  )
}

function getPreviewColor(ambiance: Ambiance): string {
  const states = Object.values(ambiance.lightStates)
  if (states.length === 0) return '#2a2a2a'
  const s = states[0]
  if (!s.isOn) return '#2a2a2a'
  const ratio = s.intensity / 100
  const r = Math.min(255, Math.round((s.r + s.w) * ratio))
  const g = Math.min(255, Math.round((s.g + s.w) * ratio))
  const b = Math.min(255, Math.round((s.b + s.w) * ratio))
  if (r === 0 && g === 0 && b === 0) return '#2a2a2a'
  return `rgb(${r},${g},${b})`
}

function isColorDark(rgb: string): boolean {
  const m = rgb.match(/\d+/g)
  if (!m || m.length < 3) return true
  const lum = parseInt(m[0]) * 0.299 + parseInt(m[1]) * 0.587 + parseInt(m[2]) * 0.114
  return lum < 140
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    margin: 6,
    flex: 1,
    minHeight: 110,
    overflow: 'hidden',
    elevation: 3,
  },
  inactive: {
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  lightCount: {
    fontSize: 10,
  },
})
