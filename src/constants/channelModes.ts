export type ChannelMode = 'RGB' | 'RGBW' | 'DIM_RGB' | 'DIM_RGBW'

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
}

export const CHANNEL_MODE_OPTIONS = Object.values(CHANNEL_MODE_CONFIGS)
