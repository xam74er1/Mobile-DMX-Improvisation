import React from 'react'
import { View } from 'react-native'

type Props = {
  value: number
  onValueChange: (v: number) => void
  minimumValue?: number
  maximumValue?: number
  step?: number
  minimumTrackTintColor?: string
  style?: any
}

export default function AppSlider({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 1,
  step = 1,
  minimumTrackTintColor = '#007AFF',
  style,
}: Props) {
  return (
    <View style={[{ flex: 1, justifyContent: 'center' }, style]}>
      <input
        type="range"
        value={value}
        min={minimumValue}
        max={maximumValue}
        step={step}
        onChange={(e) => onValueChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: minimumTrackTintColor, cursor: 'pointer' }}
      />
    </View>
  )
}
