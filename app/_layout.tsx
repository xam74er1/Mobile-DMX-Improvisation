import React, { useEffect } from 'react'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { PaperProvider, MD3DarkTheme } from 'react-native-paper'
import { StatusBar } from 'expo-status-bar'
import i18n from '../src/i18n'
import { useSettingsStore } from '../src/store/settingsStore'

const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#ff6b35',
    background: '#0a0a0a',
    surface: '#1a1a1a',
    onBackground: '#ffffff',
    onSurface: '#ffffff',
  },
}

export default function RootLayout() {
  // AsyncStorage-backed settingsStore rehydrates asynchronously — this effect
  // both applies the persisted language once it loads and keeps i18n in sync
  // whenever the user switches language from Settings → Tutorial.
  const language = useSettingsStore((s) => s.language)
  useEffect(() => {
    if (i18n.language !== language) i18n.changeLanguage(language)
  }, [language])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </PaperProvider>
    </GestureHandlerRootView>
  )
}
