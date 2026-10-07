// Zustand store — Katya's Menagerie snapshot + UI selection
import { create } from 'zustand'
import type { Critter, MenagerieSnapshot, Yard } from '../../../shared/types/menagerie'

interface MenagerieState {
  snapshot: MenagerieSnapshot | null
  loading: boolean
  error: string | null
  selectedId: string | null
  /** Repository whose yard is open in the close-up view */
  zoomedRepo: string | null
  /** Whether Katya's town-square close-up is open */
  katyaOpen: boolean
  setSnapshot: (snapshot: MenagerieSnapshot) => void
  setError: (error: string | null) => void
  select: (id: string | null) => void
  zoom: (repo: string | null) => void
  openKatya: (open: boolean) => void
  /** Load the initial snapshot and subscribe to pushes. Returns an unsubscribe fn. */
  connect: () => () => void
  refresh: () => Promise<void>
}

export const useMenagerieStore = create<MenagerieState>((set, get) => ({
  snapshot: null,
  loading: true,
  error: null,
  selectedId: null,
  zoomedRepo: null,
  katyaOpen: false,

  setSnapshot: (snapshot) => {
    const { selectedId: selected, zoomedRepo } = get()
    const stillExists =
      selected != null && snapshot.yards.some((y) => y.critters.some((c) => c.id === selected))
    const yardExists = zoomedRepo != null && snapshot.yards.some((y) => y.repository === zoomedRepo)
    set({
      snapshot,
      loading: false,
      error: null,
      selectedId: stillExists ? selected : null,
      zoomedRepo: yardExists ? zoomedRepo : null
    })
  },
  setError: (error) => set({ error, loading: false }),
  select: (id) => set({ selectedId: id }),
  zoom: (repo) => set({ zoomedRepo: repo, selectedId: null, katyaOpen: false }),
  openKatya: (open) => set({ katyaOpen: open, zoomedRepo: null, selectedId: null }),

  connect: () => {
    const unsubscribe = window.api.menagerie.onUpdate((s) => get().setSnapshot(s))
    window.api.menagerie
      .getSnapshot()
      .then((s) => get().setSnapshot(s))
      .catch((e) => get().setError(e instanceof Error ? e.message : String(e)))
    return unsubscribe
  },

  refresh: async () => {
    try {
      const s = await window.api.menagerie.refresh()
      get().setSnapshot(s)
    } catch (e) {
      get().setError(e instanceof Error ? e.message : String(e))
    }
  }
}))

export function selectCritter(state: MenagerieState): Critter | null {
  if (!state.snapshot || !state.selectedId) return null
  for (const yard of state.snapshot.yards) {
    const c = yard.critters.find((cr) => cr.id === state.selectedId)
    if (c) return c
  }
  return null
}

export function selectZoomedYard(state: MenagerieState): Yard | null {
  if (!state.snapshot || !state.zoomedRepo) return null
  return state.snapshot.yards.find((y) => y.repository === state.zoomedRepo) ?? null
}
