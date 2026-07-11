/** A single Art-Net node found by an ArtPoll network scan. */
export interface DiscoveredArtNetNode {
  ip: string
  shortName: string
  longName: string
}

export interface IDMXClient {
  /** Send a full 512-channel universe snapshot to the receiver. */
  sendUniverse(
    host: string,
    port: number,
    universe: number,
    channels: Uint8Array,
  ): Promise<void>

  /** Release socket resources. */
  dispose(): void

  /**
   * Optional: broadcast an ArtPoll and report each ArtPollReply for
   * `durationMs`. Only implemented by transports that speak real Art-Net
   * UDP (native) — the web WebSocket transport has no such capability.
   */
  discoverNodes?(
    durationMs: number,
    onNode: (node: DiscoveredArtNetNode) => void,
  ): Promise<void>
}
