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
}
