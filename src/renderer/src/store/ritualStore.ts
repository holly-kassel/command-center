import { create } from 'zustand'
import { answersFromLog, emptyLog, localDate } from '@shared/ritualLogic'
import type {
  DailyLog,
  RitualAnswers,
  RitualDraft,
  RitualSnapshot,
  RitualType,
  Streak,
  StreakType,
  WeeklyRitualMetrics
} from '@shared/types/ritual'

interface RitualState {
  todayLog: DailyLog | null
  streaks: Record<StreakType, Streak> | null
  weeklyMetrics: WeeklyRitualMetrics | null
  drafts: RitualDraft[]
  revision: number
  legacyNotice: string | null
  activeRitual: RitualType | null
  draft: RitualDraft | null
  isLoading: boolean
  isSaving: boolean
  draftStatus: 'saved' | 'saving' | 'unsaved'
  error: string | null
  notice: string | null
  initialize: () => Promise<void>
  refreshAll: () => Promise<void>
  startRitual: (type: RitualType, date?: string, draftId?: string) => Promise<void>
  updateDraft: (change: { step?: number; answers?: Partial<RitualAnswers> }) => void
  saveDraft: () => Promise<void>
  pauseRitual: () => Promise<void>
  discardDraft: () => Promise<void>
  completeRitual: () => Promise<void>
  applySnapshot: (snapshot: RitualSnapshot) => void
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
let pendingSave: Promise<void> = Promise.resolve()

export const useRitualStore = create<RitualState>((set, get) => ({
  todayLog: null,
  streaks: null,
  weeklyMetrics: null,
  drafts: [],
  revision: -1,
  legacyNotice: null,
  activeRitual: null,
  draft: null,
  isLoading: false,
  isSaving: false,
  draftStatus: 'saved',
  error: null,
  notice: null,

  applySnapshot: (snapshot) => {
    if (snapshot.revision < get().revision) return
    set({
      todayLog: snapshot.todayLog,
      streaks: snapshot.streaks,
      weeklyMetrics: snapshot.weeklyMetrics,
      drafts: snapshot.drafts,
      revision: snapshot.revision,
      legacyNotice: snapshot.legacyNotice
    })
  },

  initialize: async () => {
    if (!get().todayLog) set({ isLoading: true })
    await get().refreshAll()
    set({ isLoading: false })
  },

  refreshAll: async () => {
    try {
      get().applySnapshot(await window.api.ritual.getSnapshot())
      // Never clear an unsaved-draft error with an unrelated refresh.
      if (!get().activeRitual) set({ error: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Could not load rituals.' })
    }
  },

  startRitual: async (type, date = localDate(), draftId) => {
    if (get().activeRitual || get().isSaving) return
    set({ isSaving: true })
    try {
      const saved = get().drafts.find((draft) =>
        draftId ? draft.id === draftId : draft.type === type && draft.date === date
      )
      const log = saved ? emptyLog(saved.date) : await window.api.ritual.getDailyLog(date)
      const draft: RitualDraft = saved ?? {
        id: crypto.randomUUID(),
        type,
        date,
        step: 0,
        answers: answersFromLog(log),
        updatedAt: new Date().toISOString()
      }
      set({
        activeRitual: type,
        draft,
        error: null,
        notice: null,
        draftStatus: saved ? 'saved' : 'unsaved'
      })
      await get().saveDraft()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Could not start ritual.' })
    } finally {
      set({ isSaving: false })
    }
  },

  updateDraft: (change) => {
    const draft = get().draft
    if (!draft || get().isSaving) return
    set({
      draft: {
        ...draft,
        step: change.step ?? draft.step,
        answers: { ...draft.answers, ...change.answers },
        updatedAt: new Date().toISOString()
      },
      draftStatus: 'unsaved'
    })
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void get()
        .saveDraft()
        .catch((error) => console.error('[Ritual] Draft save failed:', error))
    }, 400)
  },

  saveDraft: async () => {
    clearTimeout(saveTimer)
    const draft = get().draft
    if (!draft) return
    set({ draftStatus: 'saving' })
    const save = pendingSave
      .catch(() => undefined)
      .then(async () => {
        get().applySnapshot(await window.api.ritual.saveDraft(draft))
        if (get().draft === draft) set({ draftStatus: 'saved', error: null })
      })
    pendingSave = save
    try {
      await save
    } catch (error) {
      set({
        draftStatus: 'unsaved',
        error: error instanceof Error ? error.message : 'Draft was not saved.'
      })
      throw error
    }
  },

  pauseRitual: async () => {
    if (get().isSaving) return
    set({ isSaving: true })
    try {
      await get().saveDraft()
      set({ activeRitual: null, draft: null, notice: 'Ritual paused. Your draft is saved.' })
    } catch (error) {
      console.error('[Ritual] Could not pause:', error)
    } finally {
      set({ isSaving: false })
    }
  },

  discardDraft: async () => {
    const draft = get().draft
    if (!draft || get().isSaving) return
    clearTimeout(saveTimer)
    set({ isSaving: true })
    try {
      await pendingSave.catch(() => undefined)
      get().applySnapshot(await window.api.ritual.discardDraft(draft.id))
      set({
        activeRitual: null,
        draft: null,
        error: null,
        notice: 'Draft discarded. Saved rituals are unchanged.'
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Could not discard draft.' })
    } finally {
      set({ isSaving: false })
    }
  },

  completeRitual: async () => {
    const draft = get().draft
    if (!draft || get().isSaving) return
    clearTimeout(saveTimer)
    set({ isSaving: true, error: null })
    try {
      await get().saveDraft()
      get().applySnapshot(
        await window.api.ritual.complete({ draft, operationId: `complete:${draft.id}` })
      )
      set({
        activeRitual: null,
        draft: null,
        notice: `Saved for ${draft.date}.`,
        draftStatus: 'saved'
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Ritual was not saved. Try again.' })
    } finally {
      set({ isSaving: false })
    }
  }
}))

window.api.ritual.onSyncUpdate((snapshot) => useRitualStore.getState().applySnapshot(snapshot))

window.addEventListener('beforeunload', (event) => {
  const state = useRitualStore.getState()
  if (state.draft && (state.draftStatus !== 'saved' || state.isSaving)) {
    event.preventDefault()
    event.returnValue = ''
    void state
      .saveDraft()
      .catch((error) => console.error('[Ritual] Draft save before close failed:', error))
  }
})
