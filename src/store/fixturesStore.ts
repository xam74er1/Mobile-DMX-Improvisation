import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ChannelMode } from '../constants/channelModes'
import { DEFAULT_COLORS } from '../constants/defaultColors'

export interface Fixture {
  id: string
  name: string
  dmxAddress: number
  channelMode: ChannelMode
  categoryId: string
}

export interface Category {
  id: string
  name: string
  isExpanded: boolean
}

const DEFAULT_CATEGORY_ID = 'cat-basic'

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

const SEED_FIXTURES: Fixture[] = DEFAULT_COLORS.slice(0, 4).map((c, i) => ({
  id: `fixture-${i + 1}`,
  name: c.label,
  dmxAddress: i * 3 + 1,
  channelMode: 'RGBWAUV',
  categoryId: DEFAULT_CATEGORY_ID,
}))

interface FixturesState {
  fixtures: Fixture[]
  categories: Category[]

  addFixture: (name: string, dmxAddress: number, channelMode: ChannelMode, categoryId: string) => string
  updateFixture: (id: string, patch: Partial<Omit<Fixture, 'id'>>) => void
  removeFixture: (id: string) => void

  addCategory: (name: string) => string
  updateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => void
  removeCategory: (id: string) => void
  toggleCategoryExpanded: (id: string) => void
}

export const useFixturesStore = create<FixturesState>()(
  persist(
    (set) => ({
      fixtures: SEED_FIXTURES,
      categories: [{ id: DEFAULT_CATEGORY_ID, name: 'Basic Colors', isExpanded: true }],

      addFixture: (name, dmxAddress, channelMode, categoryId) => {
        const id = `fixture-${makeId()}`
        set((s) => ({
          fixtures: [...s.fixtures, { id, name, dmxAddress, channelMode, categoryId }],
        }))
        return id
      },

      updateFixture: (id, patch) =>
        set((s) => ({
          fixtures: s.fixtures.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        })),

      removeFixture: (id) =>
        set((s) => ({ fixtures: s.fixtures.filter((f) => f.id !== id) })),

      addCategory: (name) => {
        const id = `cat-${makeId()}`
        set((s) => ({
          categories: [...s.categories, { id, name, isExpanded: true }],
        }))
        return id
      },

      updateCategory: (id, patch) =>
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      removeCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          fixtures: s.fixtures.filter((f) => f.categoryId !== id),
        })),

      toggleCategoryExpanded: (id) =>
        set((s) => ({
          categories: s.categories.map((c) =>
            c.id === id ? { ...c, isExpanded: !c.isExpanded } : c,
          ),
        })),
    }),
    {
      name: 'dmx-fixtures',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
