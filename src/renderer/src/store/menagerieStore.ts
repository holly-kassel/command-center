// Zustand store — Katya's Menagerie snapshot + UI selection
import { create } from 'zustand'
import type { Critter, MenagerieSnapshot, Yard } from '../../../shared/types/menagerie'
import { allCritters } from '../../../shared/types/menagerie'

interface MenagerieState {
  snapshot: MenagerieSnapshot | null
  loading: boolean
  error: string | null
  selectedId: string | null
  /** Automation whose town-square decoration shows its bubble */
  focusedAutomationId: string | null
  /** Repository whose yard is open in the close-up view */
  zoomedRepo: string | null
  /** Repository whose dog house / cat tree is open in the nap-time view */
  napRepo: string | null
  /** Whether Katya's town-square close-up is open */
  katyaOpen: boolean
  setSnapshot: (snapshot: MenagerieSnapshot) => void
  setError: (error: string | null) => void
  /** Select a critter (or nothing); clears any automation bubble */
  select: (id: string | null) => void
  focusAutomation: (id: string | null) => void
  zoom: (repo: string | null) => void
  openNap: (repo: string | null) => void
  openKatya: (open: boolean) => void
  /** Load the initial snapshot and subscribe to pushes. Returns an unsubscribe fn. */
  connect: () => () => void
  refresh: () => Promise<void>
}

const NO_OVERLAYS = {
  selectedId: null,
  focusedAutomationId: null,
  zoomedRepo: null,
  napRepo: null,
  katyaOpen: false
}

export const useMenagerieStore = create<MenagerieState>((set, get) => ({
  snapshot: null,
  loading: true,
  error: null,
  ...NO_OVERLAYS,

  setSnapshot: (snapshot) => {
    const { selectedId: selected, focusedAutomationId, zoomedRepo, napRepo } = get()
    const hasYard = (repo: string | null): boolean =>
      repo != null && snapshot.yards.some((y) => y.repository === repo)
    set({
      snapshot,
      loading: false,
      error: null,
      selectedId:
        selected != null && allCritters(snapshot).some((c) => c.id === selected) ? selected : null,
      focusedAutomationId: snapshot.automations.some((a) => a.id === focusedAutomationId)
        ? focusedAutomationId
        : null,
      zoomedRepo: hasYard(zoomedRepo) ? zoomedRepo : null,
      napRepo: hasYard(napRepo) ? napRepo : null
    })
  },
  setError: (error) => set({ error, loading: false }),
  select: (id) => set({ selectedId: id, focusedAutomationId: null }),
  focusAutomation: (id) => set({ focusedAutomationId: id, selectedId: null }),
  zoom: (repo) => set({ ...NO_OVERLAYS, zoomedRepo: repo }),
  openNap: (repo) => set({ ...NO_OVERLAYS, napRepo: repo }),
  openKatya: (open) => set({ ...NO_OVERLAYS, katyaOpen: open }),

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
  return allCritters(state.snapshot).find((c) => c.id === state.selectedId) ?? null
}

export function selectZoomedYard(state: MenagerieState): Yard | null {
  if (!state.snapshot || !state.zoomedRepo) return null
  return state.snapshot.yards.find((y) => y.repository === state.zoomedRepo) ?? null
}

export function selectNapYard(state: MenagerieState): Yard | null {
  if (!state.snapshot || !state.napRepo) return null
  return state.snapshot.yards.find((y) => y.repository === state.napRepo) ?? null
}
