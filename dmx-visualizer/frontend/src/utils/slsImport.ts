import type { ChannelOffsets, FixtureMode } from './dmxParse'

// Parses the Myriad "Acam" text format used by SmartLightShow's own
// .SLS_Fixture and .SLS_Scene files — same `XxxBegin / key value / XxxEnd`
// serialization confirmed against real sample files shipped with
// SmartLightShow (see SLS_008/Fixtures/*.SLS_Fixture and
// SLS_008/Scenes/*.SLS_Scene). This lets the desktop visualizer load a
// user's actual SmartLightShow fixture rig instead of manually re-entering
// each fixture's DMX address and channel layout by hand.
//
// entryMode -> channel role mapping, read directly off real .SLS_Fixture
// files (e.g. the Cameo ROOTPAR 6 11CH fixture, which uses every role below):
//   dimm = dimmer, red_ = red, gree = green, blue = blue, whit = white,
//   ambe = amber, uv__ = UV. Everything else (othr, stro, xaxe, yaxe, xyve,
//   rest, ...) isn't a color/dimmer channel this visualizer renders, so it's
//   ignored — pan/tilt and strobe don't affect the simulated light's color.
const ENTRY_MODE_TO_ROLE: Record<string, keyof ChannelOffsets> = {
  dimm: 'dim',
  red_: 'r',
  gree: 'g',
  blue: 'b',
  whit: 'w',
  ambe: 'a',
  uv__: 'uv',
}

export interface ParsedSLSFixture {
  manufacturer: string
  model: string
  totalChannels: number
  offsets: ChannelOffsets
  /** Closest built-in preset, purely so the fixture-list dropdown shows something sensible if hand-edited afterwards — actual rendering always uses `offsets`. */
  mode: FixtureMode
}

export interface ParsedSLSDevice extends ParsedSLSFixture {
  name: string
  address: number
}

function closestMode(offsets: ChannelOffsets): FixtureMode {
  const has = (k: keyof ChannelOffsets) => offsets[k] !== undefined
  if (has('uv')) return has('dim') ? 'Dim16+RGBWA+UV' : 'RGBWA+UV'
  if (has('a'))  return has('dim') ? 'Dim+RGBWA' : 'RGBWA'
  if (has('w'))  return has('dim') ? 'Dim+RGBW' : 'RGBW'
  return has('dim') ? 'Dim+RGB' : 'RGB'
}

/** Parses one `FixtureBegin ... FixtureEnd` block starting at `lines[startIdx]` (which must be the `FixtureBegin` line itself). Returns the parsed fixture and the index of its `FixtureEnd` line. */
function parseFixtureBlock(lines: string[], startIdx: number): { fixture: ParsedSLSFixture; endIdx: number } {
  let manufacturer = ''
  let model = ''
  let totalChannels = 0
  const offsets: ChannelOffsets = {}
  let curChannel: number | null = null
  let i = startIdx + 1
  for (; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === 'FixtureEnd') break

    let m: RegExpMatchArray | null
    if ((m = line.match(/^fixtureManufacturer\s+"([^"]*)"/)))      { manufacturer = m[1]; continue }
    if ((m = line.match(/^fixtureModel\s+"([^"]*)"/)))             { model = m[1]; continue }
    if ((m = line.match(/^nbChannelsFixture\s+(\d+)/)))            { totalChannels = parseInt(m[1], 10); continue }
    if ((m = line.match(/^entryChannel1\s+(\d+)/)))                { curChannel = parseInt(m[1], 10); continue }
    if ((m = line.match(/^entryMode\s+(\S+)/))) {
      const role = ENTRY_MODE_TO_ROLE[m[1]]
      // First match wins if a channel is listed under multiple entries
      // (e.g. a selector channel with both a "dimm" range and an "othr"
      // range) — only the recognized color/dimmer role is ever recorded.
      if (role && curChannel !== null && offsets[role] === undefined) {
        offsets[role] = curChannel - 1 // store 0-based, relative to the fixture's own start
      }
      continue
    }
    if (line === 'FixtureEntryEnd') { curChannel = null; continue }
  }
  return { fixture: { manufacturer, model, totalChannels, offsets, mode: closestMode(offsets) }, endIdx: i }
}

/** Parses a standalone .SLS_Fixture file (a single FixtureBegin block, no DMX address of its own). */
export function parseSLSFixtureFile(text: string): ParsedSLSFixture | null {
  const lines = text.split('\n')
  const startIdx = lines.findIndex((l) => l.trim() === 'FixtureBegin')
  if (startIdx === -1) return null
  return parseFixtureBlock(lines, startIdx).fixture
}

/** Parses a .SLS_Scene file's device list: each DeviceBegin block's name, DMX start address, and nested fixture definition. */
export function parseSLSSceneFile(text: string): ParsedSLSDevice[] {
  const lines = text.split('\n')
  const devices: ParsedSLSDevice[] = []

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== 'DeviceBegin') continue

    let name = 'Unnamed'
    let address = 1
    let fixture: ParsedSLSFixture | null = null
    let j = i + 1
    for (; j < lines.length; j++) {
      const line = lines[j].trim()
      if (line === 'DeviceEnd') break

      let m: RegExpMatchArray | null
      if ((m = line.match(/^deviceName\s+"([^"]*)"/))) { name = m[1]; continue }
      if ((m = line.match(/^firstChannel\s+(\d+)/)))   { address = parseInt(m[1], 10); continue }
      if (line === 'FixtureBegin') {
        const res = parseFixtureBlock(lines, j)
        fixture = res.fixture
        j = res.endIdx
        continue
      }
    }

    if (fixture) devices.push({ ...fixture, name, address })
    i = j
  }

  return devices
}

export function looksLikeSLSFixture(text: string): boolean {
  return /\bFixtureBegin\b/.test(text) && !/\bSceneBegin\b/.test(text)
}

export function looksLikeSLSScene(text: string): boolean {
  return /\bSceneBegin\b/.test(text) && /\bDeviceBegin\b/.test(text)
}
