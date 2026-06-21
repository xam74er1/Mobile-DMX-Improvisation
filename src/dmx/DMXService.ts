import type { IDMXClient } from './types'
import type { ChannelMode } from '../constants/channelModes'

export interface FixtureConfig {
  id: string
  dmxAddress: number   // 1-based (1–512)
  channelMode: ChannelMode
}

export interface FixtureState {
  r: number          // 0–255
  g: number          // 0–255
  b: number          // 0–255
  w: number          // 0–255
  intensity: number  // 0–100
  isOn: boolean
}

export class DMXService {
  private universe = new Uint8Array(512)

  constructor(private readonly client: IDMXClient) {}

  async sync(
    fixtures: FixtureConfig[],
    scene: Record<string, FixtureState>,
    blackout: boolean,
    host: string,
    port: number,
    universeIndex: number,
  ): Promise<void> {
    this.universe.fill(0)

    if (!blackout) {
      for (const fixture of fixtures) {
        const state = scene[fixture.id]
        if (!state?.isOn) continue
        this.writeFixture(fixture, state)
      }
    }

    await this.client.sendUniverse(host, port, universeIndex, this.universe)
  }

  private writeFixture(fixture: FixtureConfig, state: FixtureState) {
    const addr = fixture.dmxAddress - 1  // convert to 0-indexed
    if (addr < 0 || addr >= 512) return

    const ratio = state.intensity / 100
    const r = Math.round(state.r * ratio)
    const g = Math.round(state.g * ratio)
    const b = Math.round(state.b * ratio)
    const w = Math.round(state.w * ratio)
    const dim = Math.round(255 * ratio)

    switch (fixture.channelMode) {
      case 'RGB':
        this.universe[addr]     = r
        this.universe[addr + 1] = g
        this.universe[addr + 2] = b
        break
      case 'RGBW':
        this.universe[addr]     = r
        this.universe[addr + 1] = g
        this.universe[addr + 2] = b
        this.universe[addr + 3] = w
        break
      case 'DIM_RGB':
        this.universe[addr]     = dim
        this.universe[addr + 1] = r
        this.universe[addr + 2] = g
        this.universe[addr + 3] = b
        break
      case 'DIM_RGBW':
        this.universe[addr]     = dim
        this.universe[addr + 1] = r
        this.universe[addr + 2] = g
        this.universe[addr + 3] = b
        this.universe[addr + 4] = w
        break
    }
  }

  dispose() {
    this.client.dispose()
  }
}
