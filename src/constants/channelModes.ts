export type ChannelMode =
  | 'RGB' | 'RGBW' | 'DIM_RGB' | 'DIM_RGBW'
  | 'RGBA' | 'RGBWA' | 'DIM_RGBA' | 'DIM_RGBWA'
  | 'RGBWAUV' | 'DIM_RGBWAUV' | 'DIM16_RGBWAUV'

export interface ChannelModeConfig {
  mode: ChannelMode
  label: string
  channelCount: number
}

export const CHANNEL_MODE_CONFIGS: Record<ChannelMode, ChannelModeConfig> = {
  RGB: {
    mode: 'RGB',
    label: 'RGB (3ch)',
    channelCount: 3,
  },
  RGBW: {
    mode: 'RGBW',
    label: 'RGBW (4ch)',
    channelCount: 4,
  },
  DIM_RGB: {
    mode: 'DIM_RGB',
    label: 'Dim + RGB (4ch)',
    channelCount: 4,
  },
  DIM_RGBW: {
    mode: 'DIM_RGBW',
    label: 'Dim + RGBW (5ch)',
    channelCount: 5,
  },
  RGBA: {
    mode: 'RGBA',
    label: 'RGBA (4ch)',
    channelCount: 4,
  },
  RGBWA: {
    mode: 'RGBWA',
    label: 'RGBWA (5ch)',
    channelCount: 5,
  },
  DIM_RGBA: {
    mode: 'DIM_RGBA',
    label: 'Dim + RGBA (5ch)',
    channelCount: 5,
  },
  DIM_RGBWA: {
    mode: 'DIM_RGBWA',
    label: 'Dim + RGBWA (6ch)',
    channelCount: 6,
  },
  RGBWAUV: {
    mode: 'RGBWAUV',
    label: 'RGBWA+UV (6ch)',
    channelCount: 6,
  },
  DIM_RGBWAUV: {
    mode: 'DIM_RGBWAUV',
    label: 'Dim + RGBWA+UV (8ch)',
    channelCount: 8,
  },
  DIM16_RGBWAUV: {
    mode: 'DIM16_RGBWAUV',
    label: 'Dim16 + RGBWA+UV (11ch)',
    channelCount: 11,
  },
}

export const CHANNEL_MODE_OPTIONS = Object.values(CHANNEL_MODE_CONFIGS)
