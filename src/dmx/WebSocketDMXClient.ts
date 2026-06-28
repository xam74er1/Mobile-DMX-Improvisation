import type { IDMXClient } from './types'

/**
 * Web-only DMX client: sends DMX universe snapshots to the Python visualizer
 * server via WebSocket (ws://<host>:8080) using the SEND_DMX JSON protocol.
 * Used instead of ArtNetClient on web, where UDP is unavailable.
 */
export class WebSocketDMXClient implements IDMXClient {
  private ws: WebSocket | null = null
  private currentUrl = ''

  private connect(host: string): WebSocket {
    const url = `ws://${host}:8080`
    // Reuse existing open/connecting socket for the same host
    if (
      this.ws &&
      this.currentUrl === url &&
      this.ws.readyState !== WebSocket.CLOSING &&
      this.ws.readyState !== WebSocket.CLOSED
    ) {
      return this.ws
    }
    if (this.ws) {
      try { this.ws.close() } catch {}
    }
    this.currentUrl = url
    this.ws = new WebSocket(url)
    this.ws.addEventListener('open', () =>
      console.log(`[WSDmx] connected to ${url}`),
    )
    this.ws.addEventListener('close', () =>
      console.log('[WSDmx] disconnected'),
    )
    return this.ws
  }

  async sendUniverse(
    host: string,
    port: number,
    universe: number,
    channels: Uint8Array,
  ): Promise<void> {
    const ws = this.connect(host)
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
          reject(new Error(`Cannot reach DMX server at ${this.currentUrl}`)),
        { once: true })
      })
      return
    }

    throw new Error(`DMX server connection closed (${this.currentUrl})`)
  }

  dispose(): void {
    if (this.ws) {
      try { this.ws.close() } catch {}
      this.ws = null
    }
  }
}
