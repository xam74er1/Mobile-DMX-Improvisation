import { Platform } from 'react-native'
import { WebSocketDMXClient } from './WebSocketDMXClient'
import { DMXService } from './DMXService'
import type { IDMXClient } from './types'

function createClient(): IDMXClient {
  if (Platform.OS === 'web') {
    // Browser has no UDP — use WebSocket to reach the Python visualizer server
    return new WebSocketDMXClient()
  }
  // Dynamic require keeps react-native-udp out of the web bundle
  const { ArtNetClient } = require('./ArtNetClient') as typeof import('./ArtNetClient')
  return new ArtNetClient()
}

export const dmxService = new DMXService(createClient())

export type { IDMXClient } from './types'
export { DMXService } from './DMXService'
export type { FixtureConfig, FixtureState } from './DMXService'
