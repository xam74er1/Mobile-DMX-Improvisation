import type { IDMXClient } from './types'

/** Used on Web (no UDP) and in tests. Logs packets to console. */
export class MockClient implements IDMXClient {
  async sendUniverse(
    host: string,
    port: number,
    universe: number,
    channels: Uint8Array,
  ): Promise<void> {
    const nonZero = Array.from(channels)
      .map((v, i) => (v > 0 ? `ch${i + 1}=${v}` : null))
      .filter(Boolean)
      .slice(0, 10)
    console.log(`[MockDMX] → ${host}:${port} universe=${universe}`, nonZero.join(' '))
  }

  dispose(): void {}
}
