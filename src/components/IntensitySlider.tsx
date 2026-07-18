import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import { useTranslation } from 'react-i18next'
import Slider from './AppSlider'

interface Props {
  value: number  // 0–100
  onChange: (value: number) => void
  label?: string
}

export function IntensitySlider({ value, onChange, label }: Props) {
  const { t } = useTranslation()
  const resolvedLabel = label ?? t('components.intensitySlider.defaultLabel')
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>{resolvedLabel}</Text>
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
