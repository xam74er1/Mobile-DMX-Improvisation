import { Buffer } from 'buffer'
import type { IDMXClient } from './types'
import { useDebugLogStore, summarizeChannels, hexDump } from './debugLog'

// react-native-udp is only available on native (not web).
// The factory in MultiTransportClient ensures this class is never instantiated on web.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const UdpSocket = require('react-native-udp').default ?? require('react-native-udp')

// Reverse-engineered from the Eurolite freeDMX AP's own original app
// (Steinigke Light'J) and the QLC+ "freedmx" plugin that documented it —
// this is a completely different wire protocol from Art-Net, not a variant
// of it. Some units may only implement this original protocol and never
// respond to Art-Net at all, even though they're the same physical device
// on the same IP/port. See docs/DMX_PACKET_PROTOCOL.md §11.3 for the
// research this is based on, and the original plugin source at
// https://github.com/rdejeun/qlcplus/tree/freedmx/plugins/freedmx
// (freedmxcontroller.cpp / freedmxcontroller.h / freedmxprotocol.txt).
const FRAME_MAX_CHANNEL = 512
const FRAME_BYTES_PER_CHANNEL = 3
const DATAGRAM_MAX_SIZE = 250 // matches the reference plugin's slicing exactly, not just "under some MTU"
const KEEP_ALIVE_MS = 1000 // this app's own convention (see ArtNetClient) — the device doesn't require it, but a static scene should still survive a dropped frame

// "Be polite! Say hello" / "Bye bye" — sent once per destination, not once
// per frame. The reference implementation never waits for or parses the
// device's A7/AA acks or its once-a-second F0 64 heartbeat: UDP reception
// was found "unreliable" and disabled to avoid blocking transmission, so
// this client is fire-and-forget the same way.
const HELLO = Buffer.from([0xe5, 0x39, 0x60, 0x00])
const BYE = Buffer.from([0xac, 0x00])

export class FreeDMXNativeClient implements IDMXClient {
  private socket: ReturnType<typeof UdpSocket.createSocket> | null = null
  private bindingPromise: Promise<void> | null = null

  private keepAliveTimer: ReturnType<typeof setInterval> | null = null
  private lastSend: { host: string; port: number; channels: Uint8Array } | null = null
  private helloSentTo = ''

  private ensureSocket(): Promise<void> {
    if (this.bindingPromise) return this.bindingPromise
    this.socket = UdpSocket.createSocket({ type: 'udp4', debug: false })
    this.socket!.on('error', (err: Error) => {
      console.warn('[FreeDMXNative] socket error:', err.message)
    })
    this.bindingPromise = new Promise<void>((resolve) => {
      // No fixed local port needed — unlike ArtNetClient's discovery bind,
      // this protocol has no reply this client ever listens for.
      this.socket!.once('listening', () => resolve())
      this.socket!.once('error', () => resolve())
      this.socket!.bind(0)
    })
    return this.bindingPromise
  }

  async sendUniverse(
    host: string,
    port: number,
    _universe: number,
    channels: Uint8Array,
  ): Promise<void> {
    await this.ensureSocket()
    this.lastSend = { host, port, channels }
    this.ensureKeepAlive()
    return this.rawSend(host, port, channels)
  }

  private async rawSend(host: string, port: number, channels: Uint8Array): Promise<void> {
    const dest = `${host}:${port}`
    if (this.helloSentTo !== dest) {
      this.helloSentTo = dest
      try {
        await this.write(host, port, HELLO)
      } catch {
        // Best-effort, same as the data frames below — a dropped hello
        // doesn't block data (fire-and-forget, per the protocol notes above).
      }
    }

    const frame = buildChannelFrame(channels)
    const summary = summarizeChannels(channels)
    const startedAt = Date.now()
    let ok = true
    let error: string | undefined

    for (let offset = 0; offset < frame.length; offset += DATAGRAM_MAX_SIZE) {
      const chunk = frame.subarray(offset, Math.min(offset + DATAGRAM_MAX_SIZE, frame.length))
      try {
        await this.write(host, port, chunk)
      } catch (e) {
        ok = false
        error = (e as Error).message
        break
      }
    }

    useDebugLogStore.getState().log({
      transport: 'freedmx', host, port, universe: 0, summary,
      ok, error,
      raw: hexDump(frame),
      byteLength: frame.length,
      durationMs: Date.now() - startedAt,
    })
  }

  private write(host: string, port: number, data: Buffer): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.socket!.send(data, 0, data.length, port, host, (err: Error | null) => {
        if (err) {
          console.warn('[FreeDMXNative] send error:', err.message)
          reject(err)
          return
        }
        resolve()
      })
    })
  }

  private ensureKeepAlive() {
    if (this.keepAliveTimer) return
    this.keepAliveTimer = setInterval(() => {
      if (!this.lastSend) return
      const { host, port, channels } = this.lastSend
      this.rawSend(host, port, channels).catch(() => {})
    }, KEEP_ALIVE_MS)
  }

  dispose(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }
    if (this.socket && this.lastSend) {
      try {
        this.socket.send(BYE, 0, BYE.length, this.lastSend.port, this.lastSend.host, () => {})
      } catch {}
    }
    this.lastSend = null
    this.helloSentTo = ''
    if (this.socket) {
      try {
        this.socket.close()
      } catch {}
      this.socket = null
    }
    this.bindingPromise = null
  }
}

/**
 * Builds the reverse-engineered 1536-byte (512 channels × 3 bytes) frame the
 * Eurolite freeDMX AP's original protocol expects — NOT raw DMX bytes like
 * Art-Net. Each channel is packed as:
 *   byte 0: command code for this channel's 128-channel block, with the
 *           DMX value's MSB folded into its low bit
 *   byte 1: channel index within that block (0–127)
 *   byte 2: DMX value's low 7 bits
 * Command codes: 0xC0 (channels 0–127), 0xC2 (128–255), 0xC4 (256–383),
 * 0xC6 (384–510), and a single special case, 0x86, for the very last
 * channel (index 511) instead of the 0xC6 its block would otherwise use.
 */
function buildChannelFrame(channels: Uint8Array): Buffer {
  const frame = Buffer.alloc(FRAME_MAX_CHANNEL * FRAME_BYTES_PER_CHANNEL)
  for (let i = 0; i < FRAME_MAX_CHANNEL; i++) {
    const value = i < channels.length ? channels[i] : 0
    const baseCode = i < 128 ? 0xc0 : i < 256 ? 0xc2 : i < 384 ? 0xc4 : i < 511 ? 0xc6 : 0x86
    const offset = i * FRAME_BYTES_PER_CHANNEL
    frame[offset] = baseCode | ((value >> 7) & 0x01)
    frame[offset + 1] = i & 0x7f
    frame[offset + 2] = value & 0x7f
  }
  return frame
}
