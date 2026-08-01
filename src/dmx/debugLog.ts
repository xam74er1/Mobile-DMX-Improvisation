import { create } from 'zustand'

export interface DebugLogEntry {
  id: number
  time: number // Date.now()
  transport: 'udp' | 'ws' | 'http' | 'freedmx'
  host: string
  port: number
  universe: number
  summary: string
  ok: boolean
  error?: string
  /** Raw wire payload: hex bytes for UDP Art-Net packets, the literal JSON text for WS/HTTP. */
  raw?: string
  /** Payload size in bytes, as actually put on the wire. */
  byteLength?: number
  /** Wall-clock time the send call itself took, in ms — a UDP send hanging well past a few ms usually means a routing/permission problem, not a receiver problem. */
  durationMs?: number
}

interface DebugLogState {
  entries: DebugLogEntry[]
  paused: boolean
  setPaused: (p: boolean) => void
  log: (entry: Omit<DebugLogEntry, 'id' | 'time'>) => void
  clear: () => void
}

const MAX_ENTRIES = 200
let nextId = 1

// Avoids flooding the log with the keep-alive resend (same host/port/universe
// and byte-identical payload, sent verbatim every ~1s) — only the most
// recent entry is compared, so a genuine repeat frame from an active scene
// still collapses, but any real change (new blink, new sweep step) logs.
let lastKey = ''

export const useDebugLogStore = create<DebugLogState>((set, get) => ({
  entries: [],
  paused: false,
  setPaused: (p) => set({ paused: p }),
  log: (entry) => {
    if (get().paused) return
    const key = `${entry.transport}|${entry.host}|${entry.port}|${entry.universe}|${entry.summary}|${entry.ok}|${entry.error ?? ''}`
    if (key === lastKey) return
    lastKey = key
    set((s) => ({
      entries: [{ ...entry, id: nextId++, time: Date.now() }, ...s.entries].slice(0, MAX_ENTRIES),
    }))
  },
  clear: () => {
    lastKey = ''
    set({ entries: [] })
  },
}))

/** Renders the non-zero DMX channels as "addr:value" pairs, capped for readability. */
export function summarizeChannels(channels: Uint8Array): string {
  const nonZero: string[] = []
  for (let i = 0; i < channels.length; i++) {
    if (channels[i] !== 0) nonZero.push(`${i + 1}:${channels[i]}`)
  }
  if (nonZero.length === 0) return 'all channels 0 (blackout)'
  if (nonZero.length > 12) return `${nonZero.slice(0, 12).join(', ')}, +${nonZero.length - 12} more`
  return nonZero.join(', ')
}

/** Space-separated uppercase hex, wrapped at 16 bytes/line like a classic hex dump. */
export function hexDump(bytes: Uint8Array | number[]): string {
  const lines: string[] = []
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = Array.from(bytes.slice(i, i + 16))
    const hex = chunk.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
    lines.push(`${i.toString(16).padStart(4, '0')}  ${hex}`)
  }
  return lines.join('\n')
}

/** Renders every logged entry as plain text, newest first, for copy/export. */
export function formatLogForExport(entries: DebugLogEntry[]): string {
  return entries
    .map((e) => {
      const header = `[${new Date(e.time).toISOString()}] ${e.ok ? 'OK' : 'FAIL'} ${e.transport.toUpperCase()} ${e.host}:${e.port} universe=${e.universe}${e.byteLength != null ? ` bytes=${e.byteLength}` : ''}${e.durationMs != null ? ` took=${e.durationMs}ms` : ''}`
      const body = e.error ? `error: ${e.error}` : e.summary
      const raw = e.raw ? `\n${e.raw}` : ''
      return `${header}\n${body}${raw}`
    })
    .join('\n\n')
}
