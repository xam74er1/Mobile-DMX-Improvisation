import { dmxService } from './index'

export interface SweepProgress {
  port: number
  portIndex: number
  portCount: number
  address: number
}

export interface SweepOptions {
  host: string
  ports: number[]
  universe: number
  startAddress?: number   // default 1
  endAddress?: number     // default 512
  windowSize?: number     // consecutive channels lit per step, default 12 (covers up to the 11ch Cameo mode regardless of its dimmer/RGB offset)
  onDurationMs?: number   // default 350
  offDurationMs?: number  // default 150
  onProgress?: (p: SweepProgress) => void
  shouldStop?: () => boolean
}

const BLACKOUT = new Uint8Array(512)

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Sweeps every DMX address in range across every candidate port, one at a
 * time: sets a window of `windowSize` consecutive channels starting at that
 * address to full (255) for `onDurationMs`, then blacks out for
 * `offDurationMs`, then moves on. Lighting a whole window (not just one
 * channel) means something visibly lights up regardless of the fixture's
 * channel mode or where its RGB/dimmer channels sit within it — you're
 * watching for the fixture to react at all, not for a specific color.
 *
 * Intended for physically watching the fixture while it's out of reach of
 * the app's own address entry — e.g. confirming which of several candidate
 * ports (10100 vs 6454 vs a changed value) the receiver is actually
 * listening on, or finding a fixture's configured DMX address by eye.
 */
export async function runAddressSweep(opts: SweepOptions): Promise<void> {
  const {
    host, ports, universe,
    startAddress = 1, endAddress = 512, windowSize = 12,
    onDurationMs = 350, offDurationMs = 150,
    onProgress, shouldStop,
  } = opts

  for (let portIndex = 0; portIndex < ports.length; portIndex++) {
    const port = ports[portIndex]
    for (let addr = startAddress; addr <= endAddress; addr++) {
      if (shouldStop?.()) return
      onProgress?.({ port, portIndex, portCount: ports.length, address: addr })

      const frame = new Uint8Array(512)
      for (let i = 0; i < windowSize && addr - 1 + i < 512; i++) frame[addr - 1 + i] = 255

      await dmxService.sendRaw(host, port, universe, frame)
      await delay(onDurationMs)
      if (shouldStop?.()) return
      await dmxService.sendRaw(host, port, universe, BLACKOUT)
      await delay(offDurationMs)
    }
  }
}
