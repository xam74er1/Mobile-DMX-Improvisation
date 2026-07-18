import React from 'react'
import { StyleSheet, View, Pressable, ScrollView } from 'react-native'
import { Text } from 'react-native-paper'
import { useTranslation } from 'react-i18next'
import { DEFAULT_COLORS } from '../constants/defaultColors'

interface Props {
  onSelectColor: (r: number, g: number, b: number, w: number, a: number, uv: number) => void
  selectedHex?: string
}

export function SimpleColorPicker({ onSelectColor, selectedHex }: Props) {
  const { t } = useTranslation()
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {DEFAULT_COLORS.map((color) => {
          const isSelected = selectedHex === color.hex
          return (
            <Pressable
              key={color.hex}
              onPress={() => onSelectColor(color.r, color.g, color.b, color.w, color.a, color.uv)}
              style={[
                styles.swatch,
                { backgroundColor: color.hex },
                isSelected && styles.selected,
              ]}
            >
              {isSelected && <View style={styles.dot} />}
            </Pressable>
          )
        })}
      </ScrollView>
      <View style={styles.labels}>
        {DEFAULT_COLORS.map((color) => (
          <Text key={color.hex} style={styles.label} numberOfLines={1}>
            {t(`colors.${color.label}`, color.label)}
          </Text>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    paddingVertical: 4,
  },
  labels: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 4,
  },
  label: {
    width: 48,
    fontSize: 9,
    color: '#888',
    textAlign: 'center',
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selected: {
    borderColor: '#ffffff',
    borderWidth: 3,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
})
