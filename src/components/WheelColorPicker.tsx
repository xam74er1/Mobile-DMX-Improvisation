import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import { ColorPicker, fromHsv } from 'react-native-color-picker'

interface Props {
  currentHex: string
  onColorChange: (r: number, g: number, b: number) => void
}

export function WheelColorPicker({ currentHex, onColorChange }: Props) {
  function handleColorChange(hsv: { h: number; s: number; v: number }) {
    const hex = fromHsv(hsv)
    const { r, g, b } = hexToRgb(hex)
    onColorChange(r, g, b)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Color Wheel</Text>
      <ColorPicker
        color={currentHex}
        onColorChange={handleColorChange}
        style={styles.picker}
        hideSliders
      />
    </View>
  )
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { r: 255, g: 0, b: 0 }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 8,
  },
  label: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
    alignSelf: 'flex-start',
    marginLeft: 16,
  },
  picker: {
    width: 220,
    height: 220,
  },
})
