import { Platform } from 'react-native'
import type { IDMXClient, DiscoveredArtNetNode } from './types'
import { WebDMXClient } from './WebDMXClient'
import { useSettingsStore } from '../store/settingsStore'

/**
 * Picks the actual wire protocol per `settingsStore.transport` on every
 * send: 'udp' uses real Art-Net UDP (native only — react-native-udp isn't
 * bundled on web), 'ws'/'http' relay through the desktop visualizer bridge
 * via WebDMXClient (works on any platform, since RN's WebSocket/fetch are
 * not native-only). ArtPoll network discovery is always routed to the real
 * UDP client when one exists, regardless of which transport is currently
 * selected for sending — it's a distinct capability, not a send mode.
 */
export class MultiTransportClient implements IDMXClient {
  private webClient = new WebDMXClient()
  private artNetClient: IDMXClient | null = null
  discoverNodes?: (durationMs: number, onNode: (node: DiscoveredArtNetNode) => void) => Promise<void>

  constructor() {
    if (Platform.OS !== 'web') {
      // Dynamic require keeps react-native-udp out of the web bundle
      const { ArtNetClient } = require('./ArtNetClient') as typeof import('./ArtNetClient')
      this.artNetClient = new ArtNetClient()
      this.discoverNodes = (durationMs, onNode) => this.artNetClient!.discoverNodes!(durationMs, onNode)
    }
  }

  sendUniverse(
    host: string,
    port: number,
    universe: number,
    channels: Uint8Array,
  ): Promise<void> {
    const transport = useSettingsStore.getState().transport
    if (transport === 'udp' && this.artNetClient) {
      return this.artNetClient.sendUniverse(host, port, universe, channels)
    }
    return this.webClient.sendUniverse(host, port, universe, channels)
  }

  dispose(): void {
    this.webClient.dispose()
    this.artNetClient?.dispose()
  }
}
