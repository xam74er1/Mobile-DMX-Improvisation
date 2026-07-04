import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import Slider from './AppSlider'

interface Props {
  value: number  // 0–100
  onChange: (value: number) => void
  label?: string
}

export function IntensitySlider({ value, onChange, label = 'Intensity' }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{Math.round(value)}%</Text>
      </View>
      <Slider
        value={value}
        onValueChange={onChange}
        minimumValue={0}
        maximumValue={100}
        step={1}
        style={styles.slider}
        minimumTrackTintColor="#ff6b35"
        maximumTrackTintColor="#333333"
        thumbTintColor="#ff6b35"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    color: '#aaaaaa',
  },
  value: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
})
