import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, TouchableRipple } from 'react-native-paper'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { useAmbiancesStore } from '../store/ambiancesStore'

export function BlackoutButton() {
  const { t } = useTranslation()
  const blackout = useAmbiancesStore((s) => s.blackout)
  const toggleBlackout = useAmbiancesStore((s) => s.toggleBlackout)
  const scale = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  function handlePress() {
    scale.value = withSpring(0.95, {}, () => {
      scale.value = withSpring(1)
    })
    toggleBlackout()
  }

  return (
    <Animated.View style={[styles.wrapper, animStyle]}>
      <TouchableRipple
        onPress={handlePress}
        style={[styles.button, blackout ? styles.blackoutActive : styles.blackoutOff]}
        borderless
      >
        <View style={styles.inner}>
          <Text style={styles.icon}>{blackout ? '⚫' : '💡'}</Text>
          <Text style={styles.label}>{blackout ? t('components.blackout.blackoutLabel') : t('components.blackout.allOnLabel')}</Text>
          <Text style={styles.sub}>{blackout ? t('components.blackout.tapToRestore') : t('components.blackout.tapForBlackout')}</Text>
        </View>
      </TouchableRipple>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
  },
  button: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  blackoutOff: {
    backgroundColor: '#1e3a2f',
    borderWidth: 2,
    borderColor: '#2ecc71',
  },
  blackoutActive: {
    backgroundColor: '#3a1e1e',
    borderWidth: 2,
    borderColor: '#e74c3c',
  },
  inner: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 28,
    marginBottom: 4,
  },
  label: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
  },
  sub: {
    fontSize: 12,
    color: '#aaaaaa',
    marginTop: 4,
  },
})
