import { create } from 'zustand'

// Tracks the outcome of the most recent DMX send so the UI can surface
// otherwise-silent UDP failures (sendUniverse errors are normally swallowed
// with .catch(() => {}) so a single dropped packet doesn't spam the user).
interface DMXStatusState {
  ok: boolean | null   // null = nothing sent yet this session
  lastErrorMessage: string | null
  lastUpdatedAt: number | null
  reportSuccess: () => void
  reportError: (message: string) => void
}

export const useDMXStatusStore = create<DMXStatusState>((set, get) => ({
  ok: null,
  lastErrorMessage: null,
  lastUpdatedAt: null,
  // Only actually update (and trigger subscriber re-renders) on a state
  // transition — the effects runner calls this up to 20x/sec while an
  // effect is active, and re-rendering the status dot that often is wasted.
  reportSuccess: () => {
    if (get().ok !== true) set({ ok: true, lastErrorMessage: null, lastUpdatedAt: Date.now() })
  },
  reportError: (message) => {
    if (get().ok !== false || get().lastErrorMessage !== message) {
      set({ ok: false, lastErrorMessage: message, lastUpdatedAt: Date.now() })
    }
  },
}))
