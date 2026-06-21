import React from 'react'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { PaperProvider, MD3DarkTheme } from 'react-native-paper'
import { StatusBar } from 'expo-status-bar'

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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </PaperProvider>
    </GestureHandlerRootView>
  )
}
