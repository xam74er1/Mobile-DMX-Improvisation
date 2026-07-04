import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import * as Clipboard from 'expo-clipboard'
import { useLightsStore, type Light } from '../store/lightsStore'
import { useAmbiancesStore, type Ambiance, type AmbianceCategory } from '../store/ambiancesStore'
import { useSettingsStore } from '../store/settingsStore'
import type { ChannelMode } from '../constants/channelModes'

// ── Export format ─────────────────────────────────────────────────────────────

export interface AppConfig {
  version: 1
  app: 'dmx-improvisator'
  exportedAt: string
  lights: Light[]
  ambiances: Ambiance[]
  categories: AmbianceCategory[]
  settings: { receiverIp: string; receiverPort: number; universe: number }
}

export function buildConfig(): AppConfig {
  const { lights } = useLightsStore.getState()
  const { ambiances, categories } = useAmbiancesStore.getState()
  const { receiverIp, receiverPort, universe } = useSettingsStore.getState()
  return {
    version: 1,
    app: 'dmx-improvisator',
    exportedAt: new Date().toISOString(),
    lights,
    ambiances,
    categories,
    settings: { receiverIp, receiverPort, universe },
  }
}

export function applyConfig(config: AppConfig, mode: 'replace' | 'merge') {
  if (mode === 'replace') {
    useLightsStore.setState({ lights: config.lights })
    useAmbiancesStore.setState({
      ambiances: config.ambiances,
      categories: config.categories,
      activeAmbianceId: null,
    })
  } else {
    const { lights } = useLightsStore.getState()
    const { ambiances, categories } = useAmbiancesStore.getState()
    const existingLightIds = new Set(lights.map((l) => l.id))
    const existingAmbIds  = new Set(ambiances.map((a) => a.id))
    const existingCatIds  = new Set(categories.map((c) => c.id))
    useLightsStore.setState({
      lights: [...lights, ...config.lights.filter((l) => !existingLightIds.has(l.id))],
    })
    useAmbiancesStore.setState({
      ambiances: [...ambiances, ...config.ambiances.filter((a) => !existingAmbIds.has(a.id))],
      categories: [...categories, ...config.categories.filter((c) => !existingCatIds.has(c.id))],
    })
  }
  if (config.settings) {
    const { setReceiverIp, setReceiverPort, setUniverse } = useSettingsStore.getState()
    setReceiverIp(config.settings.receiverIp)
    setReceiverPort(config.settings.receiverPort)
    setUniverse(config.settings.universe)
  }
}

export function parseConfig(json: string): AppConfig | null {
  try {
    const parsed = JSON.parse(json)
    if (parsed?.app !== 'dmx-improvisator' || !Array.isArray(parsed.ambiances)) return null
    return parsed as AppConfig
  } catch {
    return null
  }
}

// ── Myriad SLS import ─────────────────────────────────────────────────────────

function channelLayout(mode: ChannelMode): {
  dim?: number; r: number; g: number; b: number
  w?: number; a?: number; uv?: number
} {
  switch (mode) {
    case 'RGB':          return { r: 0, g: 1, b: 2 }
    case 'RGBW':         return { r: 0, g: 1, b: 2, w: 3 }
    case 'DIM_RGB':      return { dim: 0, r: 1, g: 2, b: 3 }
    case 'DIM_RGBW':     return { dim: 0, r: 1, g: 2, b: 3, w: 4 }
    case 'RGBA':         return { r: 0, g: 1, b: 2, a: 3 }
    case 'RGBWA':        return { r: 0, g: 1, b: 2, w: 3, a: 4 }
    case 'DIM_RGBA':     return { dim: 0, r: 1, g: 2, b: 3, a: 4 }
    case 'DIM_RGBWA':    return { dim: 0, r: 1, g: 2, b: 3, w: 4, a: 5 }
    case 'RGBWAUV':      return { r: 0, g: 1, b: 2, w: 3, a: 4, uv: 5 }
    // offset 1 is the strobe channel (DMXService always writes 0/open there)
    case 'DIM_RGBWAUV':  return { dim: 0, r: 2, g: 3, b: 4, w: 5, a: 6, uv: 7 }
    default:             return { r: 0, g: 1, b: 2 }
  }
}

interface SLSAmbiance { name: string; channels: Record<number, number> }

function parseSLSText(text: string): SLSAmbiance[] {
  const result: SLSAmbiance[] = []
  let current: SLSAmbiance | null = null
  let inEntry = false
  let pendingChannel: number | null = null

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue

    if (line === 'AmbianceBegin') {
      current = { name: 'Unnamed', channels: {} }
      continue
    }
    if (line === 'AmbianceEnd') {
      if (current) result.push(current)
      current = null; continue
    }
    if (!current) continue

    const nameMatch = line.match(/^ambianceName\s+"([^"]+)"/)
    if (nameMatch) { current.name = nameMatch[1]; continue }

    if (line === 'AmbianceEntryBegin') { inEntry = true; pendingChannel = null; continue }
    if (line === 'AmbianceEntryEnd')   { inEntry = false; continue }

    if (inEntry) {
      const chMatch  = line.match(/^Channel\s+(\d+)/)
      if (chMatch) { pendingChannel = parseInt(chMatch[1], 10); continue }
      const valMatch = line.match(/^Value\s+(\d+)/)
      if (valMatch && pendingChannel !== null) {
        // keep first write — Myriad can emit duplicate channel entries
        if (!(pendingChannel in current.channels)) {
          current.channels[pendingChannel] = parseInt(valMatch[1], 10)
        }
        pendingChannel = null
      }
    }
  }
  return result
}

export function importSLS(text: string, lights: Light[]): Ambiance[] {
  const slsAmbiances = parseSLSText(text)
  const makeId = () => Math.random().toString(36).slice(2, 10)

  return slsAmbiances.map((sls) => {
    const lightStates: Ambiance['lightStates'] = {}
    for (const light of lights) {
      const layout = channelLayout(light.channelMode)
      // dmxAddress is 1-based; SLS channels are also 1-based
      const ch = (offset: number) => sls.channels[light.dmxAddress + offset] ?? 0
      const dimRaw = layout.dim !== undefined ? ch(layout.dim) : 255
      const hasColor = ch(layout.r) > 0 || ch(layout.g) > 0 || ch(layout.b) > 0
      lightStates[light.id] = {
        r: ch(layout.r),
        g: ch(layout.g),
        b: ch(layout.b),
        w:  layout.w  !== undefined ? ch(layout.w)  : 0,
        a:  layout.a  !== undefined ? ch(layout.a)  : 0,
        uv: layout.uv !== undefined ? ch(layout.uv) : 0,
        intensity: Math.round((dimRaw / 255) * 100),
        isOn: layout.dim !== undefined ? dimRaw > 0 : hasColor,
      }
    }
    return { id: `amb-${makeId()}`, name: sls.name, lightStates, effects: [] }
  })
}

// ── File / clipboard I/O ──────────────────────────────────────────────────────

export async function exportToFile(config: AppConfig): Promise<void> {
  const json = JSON.stringify(config, null, 2)
  const filename = `dmx-show-${new Date().toISOString().slice(0, 10)}.dmximp.json`
  const file = new File(Paths.cache, filename)
  if (file.exists) file.delete()
  file.create()
  file.write(json)
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save show config' })
}

export async function copyToClipboard(config: AppConfig): Promise<void> {
  await Clipboard.setStringAsync(JSON.stringify(config, null, 2))
}

export type ImportedFile = { type: 'json' | 'sls'; content: string; name: string }

export async function pickFile(): Promise<ImportedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  })
  if (result.canceled || !result.assets?.[0]) return null
  const asset = result.assets[0]
  const srcFile = new File(asset.uri)
  const content = await srcFile.text()
  const name = asset.name ?? ''
  const lname = name.toLowerCase()
  const isSLS = lname.endsWith('.sls_ambiancesdigest') || lname.includes('sls_ambiance')
  return { type: isSLS ? 'sls' : 'json', content, name }
}

export async function pasteFromClipboard(): Promise<string> {
  return Clipboard.getStringAsync()
}

// ── Myriad SLS export ─────────────────────────────────────────────────────────

export function exportSLS(ambiances: Ambiance[], lights: Light[]): string {
  const lines: string[] = [
    '#*************************************************************************',
    '#* Ambiances digest',
    '#* Version 0.0.5',
    '#*',
    '#* (c) Mobile DMX Improvisator',
    '#*************************************************************************',
    '',
  ]

  for (const amb of ambiances) {
    interface E { channel: number; value: number }
    const entries: E[] = []

    for (const light of lights) {
      const state = amb.lightStates[light.id]
      if (!state) continue
      const layout = channelLayout(light.channelMode)
      const intf = (state.intensity ?? 100) / 100
      const base = light.dmxAddress
      const hasDim = layout.dim !== undefined

      const add = (offset: number, raw: number) => {
        entries.push({ channel: base + offset, value: Math.max(0, Math.min(255, Math.round(raw))) })
      }

      if (hasDim) {
        add(layout.dim!, intf * 255)
        add(layout.r, state.r)
        add(layout.g, state.g)
        add(layout.b, state.b)
      } else {
        add(layout.r, state.r * intf)
        add(layout.g, state.g * intf)
        add(layout.b, state.b * intf)
      }
      if (layout.w  !== undefined) add(layout.w,  hasDim ? state.w         : state.w         * intf)
      if (layout.a  !== undefined) add(layout.a,  hasDim ? (state.a  ?? 0) : (state.a  ?? 0) * intf)
      if (layout.uv !== undefined) add(layout.uv, hasDim ? (state.uv ?? 0) : (state.uv ?? 0) * intf)
    }

    lines.push('AmbianceBegin ')
    lines.push(`\t ambianceName "${amb.name}" `)
    lines.push(`\t nbEntries ${entries.length} `)
    for (const e of entries) {
      lines.push('\t AmbianceEntryBegin ')
      lines.push(`\t \t Channel ${e.channel} `)
      lines.push(`\t \t Value ${e.value} `)
      lines.push('\t AmbianceEntryEnd ')
    }
    lines.push('AmbianceEnd ')
    lines.push('')
  }

  lines.push('#EOF ')
  return lines.join('\n')
}

export async function exportSLSToFile(ambiances: Ambiance[], lights: Light[]): Promise<void> {
  const text = exportSLS(ambiances, lights)
  const filename = `custom-ambiances-${new Date().toISOString().slice(0, 10)}.SLS_AmbiancesDigest`
  const file = new File(Paths.cache, filename)
  if (file.exists) file.delete()
  file.create()
  file.write(text)
  await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: 'Save Myriad ambiances' })
}

export async function exportSLSToClipboard(ambiances: Ambiance[], lights: Light[]): Promise<void> {
  await Clipboard.setStringAsync(exportSLS(ambiances, lights))
}
