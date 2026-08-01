import type { IDMXClient } from './types'
import { useSettingsStore } from '../store/settingsStore'
import { useDebugLogStore, summarizeChannels } from './debugLog'

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
    // No path is forced by default — a bare host:port lets you probe any
    // arbitrary IP/port with a plain POST. The desktop visualizer bridge
    // (dmx-visualizer/server/server.py) specifically requires POST /dmx,
    // so set Settings → Connection → HTTP Path to "/dmx" when targeting it.
    const rawPath = useSettingsStore.getState().httpPath.trim()
    const path = rawPath && !rawPath.startsWith('/') ? `/${rawPath}` : rawPath
    const url = `http://${host}:${port}${path}`
    const summary = summarizeChannels(channels)
    const body = JSON.stringify({ type: 'SEND_DMX', universe, data: Array.from(channels) })
    const startedAt = Date.now()

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    } catch {
      const msg = `Cannot reach DMX server at ${url}`
      useDebugLogStore.getState().log({
        transport: 'http', host, port, universe, summary, ok: false, error: msg,
        raw: body, byteLength: body.length, durationMs: Date.now() - startedAt,
      })
      throw new Error(msg)
    }

    if (!res.ok) {
      const msg = `DMX server at ${url} responded ${res.status}`
      useDebugLogStore.getState().log({
        transport: 'http', host, port, universe, summary, ok: false, error: msg,
        raw: body, byteLength: body.length, durationMs: Date.now() - startedAt,
      })
      throw new Error(msg)
    }
    useDebugLogStore.getState().log({
      transport: 'http', host, port, universe, summary, ok: true,
      raw: body, byteLength: body.length, durationMs: Date.now() - startedAt,
    })
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
    const summary = summarizeChannels(channels)
    const msg = JSON.stringify({
      type: 'SEND_DMX',
      universe,
      data: Array.from(channels),
    })
    const startedAt = Date.now()
    const logBase = { transport: 'ws' as const, host, port, universe, summary, raw: msg, byteLength: msg.length }

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg)
      useDebugLogStore.getState().log({ ...logBase, ok: true, durationMs: Date.now() - startedAt })
      return
    }

    if (ws.readyState === WebSocket.CONNECTING) {
      try {
        await new Promise<void>((resolve, reject) => {
          ws.addEventListener('open', () => { ws.send(msg); resolve() }, { once: true })
          ws.addEventListener('error', () =>
            reject(new Error(`Cannot reach DMX server at ${this.currentWsUrl}`)),
          { once: true })
        })
        useDebugLogStore.getState().log({ ...logBase, ok: true, durationMs: Date.now() - startedAt })
      } catch (e) {
        useDebugLogStore.getState().log({ ...logBase, ok: false, error: (e as Error).message, durationMs: Date.now() - startedAt })
        throw e
      }
      return
    }

    const msgErr = `DMX server connection closed (${this.currentWsUrl})`
    useDebugLogStore.getState().log({ ...logBase, ok: false, error: msgErr, durationMs: Date.now() - startedAt })
    throw new Error(msgErr)
  }

  dispose(): void {
    if (this.ws) {
      try { this.ws.close() } catch {}
      this.ws = null
    }
  }
}
