import { Platform } from 'react-native'
import { MockClient } from './MockClient'
import { DMXService } from './DMXService'
import type { IDMXClient } from './types'

function createClient(): IDMXClient {
  if (Platform.OS === 'web') {
    return new MockClient()
  }
  // Dynamic require keeps this module out of the web bundle
  const { ArtNetClient } = require('./ArtNetClient') as typeof import('./ArtNetClient')
  return new ArtNetClient()
}

export const dmxService = new DMXService(createClient())

export type { IDMXClient } from './types'
export { DMXService } from './DMXService'
export type { FixtureConfig, FixtureState } from './DMXService'
