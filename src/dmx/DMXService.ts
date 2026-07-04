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
  a: number          // 0–255 (amber)
  uv: number         // 0–255 (ultraviolet)
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
    const r   = Math.round(state.r           * ratio)
    const g   = Math.round(state.g           * ratio)
    const b   = Math.round(state.b           * ratio)
    const w   = Math.round(state.w           * ratio)
    const a   = Math.round((state.a  ?? 0)  * ratio)
    const uv  = Math.round((state.uv ?? 0)  * ratio)
    const dim = Math.round(255               * ratio)

    // Amber → RGB fallback: fixtures without a dedicated amber LED.
    // Amber LED spectrum ≈ R:100% G:60% B:0 (warm orange).
    const rA = Math.min(255, r + a)
    const gA = Math.min(255, g + Math.round(a * 0.6))

    switch (fixture.channelMode) {
      case 'RGB':
        this.universe[addr]     = rA
        this.universe[addr + 1] = gA
        this.universe[addr + 2] = b
        break
      case 'RGBW':
        this.universe[addr]     = rA
        this.universe[addr + 1] = gA
        this.universe[addr + 2] = b
        this.universe[addr + 3] = w
        break
      case 'DIM_RGB':
        this.universe[addr]     = dim
        this.universe[addr + 1] = rA
        this.universe[addr + 2] = gA
        this.universe[addr + 3] = b
        break
      case 'DIM_RGBW':
        this.universe[addr]     = dim
        this.universe[addr + 1] = rA
        this.universe[addr + 2] = gA
        this.universe[addr + 3] = b
        this.universe[addr + 4] = w
        break
      // Modes with native A channel — use amber directly, no conversion needed
      case 'RGBA':
        this.universe[addr]     = r
        this.universe[addr + 1] = g
        this.universe[addr + 2] = b
        this.universe[addr + 3] = a
        break
      case 'RGBWA':
        this.universe[addr]     = r
        this.universe[addr + 1] = g
        this.universe[addr + 2] = b
        this.universe[addr + 3] = w
        this.universe[addr + 4] = a
        break
      case 'DIM_RGBA':
        this.universe[addr]     = dim
        this.universe[addr + 1] = r
        this.universe[addr + 2] = g
        this.universe[addr + 3] = b
        this.universe[addr + 4] = a
        break
      case 'DIM_RGBWA':
        this.universe[addr]     = dim
        this.universe[addr + 1] = r
        this.universe[addr + 2] = g
        this.universe[addr + 3] = b
        this.universe[addr + 4] = w
        this.universe[addr + 5] = a
        break
      // CAMEO ROOT PAR 6: 6CH mode — R,G,B,W,A,UV
      case 'RGBWAUV':
        this.universe[addr]     = r
        this.universe[addr + 1] = g
        this.universe[addr + 2] = b
        this.universe[addr + 3] = w
        this.universe[addr + 4] = a
        this.universe[addr + 5] = uv
        break
      // CAMEO ROOT PAR 6: 8CH mode — Dim,Strobe(0=open),R,G,B,W,A,UV
      case 'DIM_RGBWAUV':
        this.universe[addr]     = dim
        this.universe[addr + 1] = 0   // strobe off (0-5 = strobe open per manual)
        this.universe[addr + 2] = r
        this.universe[addr + 3] = g
        this.universe[addr + 4] = b
        this.universe[addr + 5] = w
        this.universe[addr + 6] = a
        this.universe[addr + 7] = uv
        break
    }
  }

  dispose() {
    this.client.dispose()
  }
}
