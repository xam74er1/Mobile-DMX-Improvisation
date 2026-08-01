import { Buffer } from 'buffer'
import type { IDMXClient, DiscoveredArtNetNode } from './types'
import { useDebugLogStore, summarizeChannels, hexDump } from './debugLog'

// react-native-udp is only available on native (not web).
// The factory in index.ts ensures this class is never instantiated on web.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const UdpSocket = require('react-native-udp').default ?? require('react-native-udp')

const ARTNET_PORT = 6454
const KEEP_ALIVE_MS = 1000 // Art-Net receivers expect a periodic refresh even when nothing changed

export class ArtNetClient implements IDMXClient {
  private socket: ReturnType<typeof UdpSocket.createSocket> | null = null
  private bindingPromise: Promise<void> | null = null
  private boundPort: number | null = null
  private broadcastEnabled = false

  // Sequence: 1–255 incrementing (0 = "sequence disabled" per spec, never sent
  // once a stream has started). Lets receivers discard out-of-order UDP packets.
  private sequence = 0

  // Keep-alive: resend the last frame verbatim every KEEP_ALIVE_MS so a
  // receiver's "signal lost" timeout never trips during a static scene.
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null
  private lastSend: { host: string; port: number; universe: number; channels: Uint8Array } | null = null

  private ensureSocket(): Promise<void> {
    if (this.bindingPromise) return this.bindingPromise
    this.socket = UdpSocket.createSocket({ type: 'udp4', debug: false })
    this.socket!.on('error', (err: Error) => {
      console.warn('[ArtNet] socket error:', err.message)
    })
    this.bindingPromise = new Promise<void>((resolve) => {
      this.socket!.once('listening', () => {
        try { this.boundPort = this.socket!.address().port } catch { this.boundPort = null }
        console.log('[ArtNet] bound to port', this.boundPort ?? '(unknown)')
        resolve()
      })
      this.socket!.once('error', () => {
        // Bind failed (e.g. port already in use) — still usable with ephemeral port
        console.warn('[ArtNet] could not bind to port 6454, using ephemeral port')
        resolve()
      })
      this.socket!.bind(ARTNET_PORT)
    })
    return this.bindingPromise
  }

  async sendUniverse(
    host: string,
    port: number,
    universe: number,
    channels: Uint8Array,
  ): Promise<void> {
    await this.ensureSocket()
    this.lastSend = { host, port, universe, channels }
    this.ensureKeepAlive()
    return this.rawSend(host, port, universe, channels)
  }

  private rawSend(host: string, port: number, universe: number, channels: Uint8Array): Promise<void> {
    this.sequence = this.sequence >= 255 ? 1 : this.sequence + 1
    const packet = buildArtNetPacket(universe, channels, this.sequence)
    const summary = summarizeChannels(channels)
    const startedAt = Date.now()

    return new Promise<void>((resolve) => {
      this.socket!.send(packet, 0, packet.length, port, host, (err: Error | null) => {
        if (err) console.warn('[ArtNet] send error:', err.message)
        useDebugLogStore.getState().log({
          transport: 'udp', host, port, universe, summary,
          ok: !err, error: err?.message,
          raw: hexDump(packet),
          byteLength: packet.length,
          durationMs: Date.now() - startedAt,
        })
        resolve()
      })
    })
  }

  private ensureKeepAlive() {
    if (this.keepAliveTimer) return
    this.keepAliveTimer = setInterval(() => {
      if (!this.lastSend) return
      const { host, port, universe, channels } = this.lastSend
      this.rawSend(host, port, universe, channels).catch(() => {})
    }, KEEP_ALIVE_MS)
  }

  /** Broadcast an ArtPoll and report each responding node for `durationMs`. */
  async discoverNodes(
    durationMs: number,
    onNode: (node: DiscoveredArtNetNode) => void,
  ): Promise<void> {
    await this.ensureSocket()
    if (this.boundPort !== ARTNET_PORT) {
      throw new Error(`Can't listen for replies — UDP port ${ARTNET_PORT} is already in use on this device.`)
    }
    if (!this.broadcastEnabled) {
      try {
        this.socket!.setBroadcast(true)
        this.broadcastEnabled = true
      } catch (e) {
        throw new Error(`Couldn't enable broadcast: ${(e as Error)?.message ?? e}`)
      }
    }

    const seen = new Set<string>()
    const handler = (buf: Buffer, rinfo: { address: string }) => {
      const node = parseArtPollReply(buf, rinfo.address)
      if (node && !seen.has(node.ip)) {
        seen.add(node.ip)
        onNode(node)
      }
    }
    this.socket!.on('message', handler)

    try {
      const poll = buildArtPollPacket()
      await new Promise<void>((resolve) => {
        this.socket!.send(poll, 0, poll.length, ARTNET_PORT, '255.255.255.255', (err: Error | null) => {
          if (err) console.warn('[ArtNet] poll send error:', err.message)
          resolve()
        })
      })
      await new Promise((resolve) => setTimeout(resolve, durationMs))
    } finally {
      this.socket!.removeListener('message', handler)
    }
  }

  dispose(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }
    this.lastSend = null
    if (this.socket) {
      try {
        this.socket.close()
      } catch {}
      this.socket = null
    }
    this.bindingPromise = null
    this.boundPort = null
    this.broadcastEnabled = false
  }
}

function buildArtNetPacket(universe: number, channels: Uint8Array, sequence: number): Buffer {
  const dmxLen = Math.min(512, channels.length)
  // Length field must be even
  const padded = dmxLen % 2 === 0 ? dmxLen : dmxLen + 1
  const packet = Buffer.alloc(18 + padded, 0)

  // "Art-Net\0"
  packet.write('Art-Net', 0, 'ascii')
  packet[7] = 0x00

  // OpCode: ArtDMX = 0x5000 (little-endian)
  packet[8] = 0x00
  packet[9] = 0x50

  // Protocol version 14 (big-endian)
  packet[10] = 0x00
  packet[11] = 0x0e

  // Sequence (1–255, wraps) lets receivers detect out-of-order UDP packets.
  // Physical=0 (unused).
  packet[12] = sequence & 0xff
  packet[13] = 0x00

  // Universe (15-bit, little-endian)
  packet[14] = universe & 0xff
  packet[15] = (universe >> 8) & 0x7f

  // DMX length (big-endian)
  packet[16] = (padded >> 8) & 0xff
  packet[17] = padded & 0xff

  // DMX data
  for (let i = 0; i < dmxLen; i++) {
    packet[18 + i] = channels[i]
  }

  return packet
}

/** 14-byte ArtPoll (OpCode 0x2000) — broadcast to discover Art-Net nodes. */
function buildArtPollPacket(): Buffer {
  const packet = Buffer.alloc(14, 0)
  packet.write('Art-Net', 0, 'ascii')
  packet[7] = 0x00

  // OpCode: ArtPoll = 0x2000 (little-endian)
  packet[8] = 0x00
  packet[9] = 0x20

  // Protocol version 14 (big-endian)
  packet[10] = 0x00
  packet[11] = 0x0e

  // TalkToMe=0 (reply only to this poll, no unsolicited diagnostics), Priority=0 (DpAll)
  packet[12] = 0x00
  packet[13] = 0x00

  return packet
}

/**
 * Parses an ArtPollReply (OpCode 0x2100); returns null if `buf` isn't one.
 * Only requires the 10-byte header + opcode — some budget Art-Net-over-WiFi
 * nodes (including the Eurolite FreeDMX AP) send a reply shorter than the
 * spec's full 239-byte body. The IP comes from the UDP sender address, not
 * the packet body, so a short/truncated reply still identifies the node;
 * readNullTerminatedAscii below is bounds-checked and just yields '' for
 * name fields past the end of a short buffer.
 */
function parseArtPollReply(buf: Buffer, sourceIp: string): DiscoveredArtNetNode | null {
  if (buf.length < 10) return null
  if (buf.toString('ascii', 0, 7) !== 'Art-Net') return null
  const opcode = buf[8] | (buf[9] << 8)
  if (opcode !== 0x2100) return null

  return {
    ip: sourceIp,
    shortName: readNullTerminatedAscii(buf, 26, 18),
    longName: readNullTerminatedAscii(buf, 44, 64),
  }
}

function readNullTerminatedAscii(buf: Buffer, offset: number, maxLen: number): string {
  let end = offset
  const limit = Math.min(buf.length, offset + maxLen)
  while (end < limit && buf[end] !== 0) end++
  return buf.toString('ascii', offset, end).trim()
}
