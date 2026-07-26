import { MultiTransportClient } from './MultiTransportClient'
import { DMXService } from './DMXService'

export const dmxService = new DMXService(new MultiTransportClient())

export type { IDMXClient, DiscoveredArtNetNode } from './types'
export { DMXService } from './DMXService'
export type { FixtureConfig, FixtureState } from './DMXService'
