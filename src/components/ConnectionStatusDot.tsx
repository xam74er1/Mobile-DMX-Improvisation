import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Text } from 'react-native-paper'
import { useDMXStatusStore } from '../store/dmxStatusStore'

// Small, unobtrusive indicator for otherwise-silent UDP send failures
// (DMXService swallows network errors so a single dropped packet doesn't
// interrupt a show — but repeated failures should be visible somewhere).
export function ConnectionStatusDot() {
  const ok = useDMXStatusStore((s) => s.ok)
  const lastErrorMessage = useDMXStatusStore((s) => s.lastErrorMessage)

  if (ok === null) return null

  return (
    <View style={styles.row}>
      <View style={[styles.dot, ok ? styles.dotOk : styles.dotFail]} />
      <Text style={[styles.label, ok ? styles.labelOk : styles.labelFail]} numberOfLines={1}>
        {ok ? 'Sending to receiver' : `Send failed${lastErrorMessage ? `: ${lastErrorMessage}` : ''}`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 2,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dotOk: { backgroundColor: '#2ecc71' },
  dotFail: { backgroundColor: '#e74c3c' },
  label: { fontSize: 10, flex: 1 },
  labelOk: { color: '#3a5' },
  labelFail: { color: '#e74c3c', fontWeight: '600' },
})
