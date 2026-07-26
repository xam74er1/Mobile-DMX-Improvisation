import type { IDMXClient } from './types'
import { useSettingsStore } from '../store/settingsStore'

/**
 * WS/HTTP DMX client: sends DMX universe snapshots to the desktop
 * visualizer's Python server over WebSocket or HTTP, per
 * `settingsStore.transport`, against the host/port configured in Settings —
 * never a hardcoded port. Used on Web (which has no raw UDP socket at all)
 * and optionally on native too, e.g. to test against the bridge instead of
 * real hardware — react-native's WebSocket/fetch globals make this work on
 * any platform, unlike ArtNetClient's UDP which is native-only.
 */
export class WebDMXClient implements IDMXClient {
  private ws: WebSocket | null = null
  private currentWsUrl = ''

  async sendUniverse(
    host: string,
    port: number,
    universe: number,
    channels: Uint8Array,
  ): Promise<void> {
    const transport = useSettingsStore.getState().transport
    if (transport === 'http') {
      return this.sendHttp(host, port, universe, channels)
    }
    return this.sendWs(host, port, universe, channels)
  }

  private async sendHttp(
    host: string,
    port: number,
    universe: number,
    channels: Uint8Array,
  ): Promise<void> {
    const url = `http://${host}:${port}/dmx`
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'SEND_DMX', universe, data: Array.from(channels) }),
      })
    } catch (e) {
      throw new Error(`Cannot reach DMX server at ${url}`)
    }
    if (!res.ok) throw new Error(`DMX server at ${url} responded ${res.status}`)
  }

  private connectWs(host: string, port: number): WebSocket {
    const url = `ws://${host}:${port}`
    // Reuse existing open/connecting socket for the same host:port
    if (
      this.ws &&
      this.currentWsUrl === url &&
      this.ws.readyState !== WebSocket.CLOSING &&
      this.ws.readyState !== WebSocket.CLOSED
    ) {
      return this.ws
    }
    if (this.ws) {
      try { this.ws.close() } catch {}
    }
    this.currentWsUrl = url
    this.ws = new WebSocket(url)
    this.ws.addEventListener('open', () =>
      console.log(`[WebDmx] connected to ${url}`),
    )
    this.ws.addEventListener('close', () =>
      console.log('[WebDmx] disconnected'),
    )
    return this.ws
  }

  private async sendWs(
    host: string,
    port: number,
    universe: number,
    channels: Uint8Array,
  ): Promise<void> {
    const ws = this.connectWs(host, port)
    const msg = JSON.stringify({
      type: 'SEND_DMX',
      universe,
      data: Array.from(channels),
    })

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg)
      return
    }

    if (ws.readyState === WebSocket.CONNECTING) {
      await new Promise<void>((resolve, reject) => {
        ws.addEventListener('open', () => { ws.send(msg); resolve() }, { once: true })
        ws.addEventListener('error', () =>
          reject(new Error(`Cannot reach DMX server at ${this.currentWsUrl}`)),
        { once: true })
      })
      return
    }

    throw new Error(`DMX server connection closed (${this.currentWsUrl})`)
  }

  dispose(): void {
    if (this.ws) {
      try { this.ws.close() } catch {}
      this.ws = null
    }
  }
}
