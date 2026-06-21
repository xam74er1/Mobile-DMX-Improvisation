import type { IDMXClient } from './types'

// react-native-udp is only available on native (not web).
// The factory in index.ts ensures this class is never instantiated on web.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const UdpSocket = require('react-native-udp').default ?? require('react-native-udp')

export class ArtNetClient implements IDMXClient {
  private socket: ReturnType<typeof UdpSocket.createSocket> | null = null

  private ensureSocket() {
    if (this.socket) return
    this.socket = UdpSocket.createSocket({ type: 'udp4', debug: false })
    this.socket!.on('error', (err: Error) => {
      console.warn('[ArtNet] socket error:', err.message)
    })
  }

  async sendUniverse(
    host: string,
    port: number,
    universe: number,
    channels: Uint8Array,
  ): Promise<void> {
    this.ensureSocket()
    const packet = buildArtNetPacket(universe, channels)

    return new Promise<void>((resolve) => {
      this.socket!.send(packet, 0, packet.length, port, host, (err: Error | null) => {
        if (err) console.warn('[ArtNet] send error:', err.message)
        resolve()
      })
    })
  }

  dispose(): void {
    if (this.socket) {
      try {
        this.socket.close()
      } catch {}
      this.socket = null
    }
  }
}

function buildArtNetPacket(universe: number, channels: Uint8Array): Buffer {
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

  // Sequence=0 (disabled), Physical=0
  packet[12] = 0x00
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
