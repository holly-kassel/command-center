import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { localDate } from '@shared/ritualLogic'
import { useRitualStore } from '../../store/ritualStore'

interface RitualDialogProps {
  title: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
}

export function RitualDialog({
  title,
  children,
  onClose,
  busy = false
}: RitualDialogProps): React.ReactElement {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const previous = document.activeElement
    const dialog = ref.current
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      className="ritual-dialog bg-background text-text-primary rounded-xl border border-surface-border p-0 w-[calc(100%_-_2rem)] max-w-lg"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <div className="p-5 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            aria-label={`Close ${title}`}
            onClick={onClose}
            disabled={busy}
            className="text-text-secondary disabled:opacity-50"
          >
            ✕
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}

export function RitualFlowShell({
  title,
  steps,
  children,
  canProceed = true,
  completeLabel = 'Save ritual'
}: {
  title: string
  steps: Array<{ title: string }>
  children: ReactNode
  canProceed?: boolean
  completeLabel?: string
}): React.ReactElement | null {
  const draft = useRitualStore((s) => s.draft)
  const busy = useRitualStore((s) => s.isSaving)
  const status = useRitualStore((s) => s.draftStatus)
  const error = useRitualStore((s) => s.error)
  const { pauseRitual, discardDraft, completeRitual, updateDraft } = useRitualStore.getState()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  if (!draft) return null
  const last = draft.step === steps.length - 1
  return (
    <RitualDialog title={title} busy={busy} onClose={() => void pauseRitual()}>
      <div className="text-xs text-text-secondary flex justify-between gap-3">
        <span>
          {draft.date} · Step {draft.step + 1} of {steps.length}
        </span>
        <span role="status">
          {status === 'saved'
            ? 'Draft saved'
            : status === 'saving'
              ? 'Saving draft…'
              : 'Unsaved changes'}
        </span>
      </div>
      {draft.date !== localDate() && (
        <p className="text-xs text-warning">
          You are continuing a ritual for {draft.date}. Saving will not count toward today.
        </p>
      )}
      <ol aria-label="Ritual progress" className="flex gap-1">
        {steps.map((step, index) => (
          <li
            key={step.title}
            aria-current={index === draft.step ? 'step' : undefined}
            className={`flex-1 text-[11px] py-2 border-b-2 ${index === draft.step ? 'border-focus text-focus' : 'border-surface-border text-text-secondary'}`}
          >
            {step.title}
          </li>
        ))}
      </ol>
      {error && (
        <div role="alert" className="text-sm text-urgent">
          <p>{error}</p>
          <button
            disabled={busy}
            className="text-xs underline mt-1"
            onClick={() => {
              void useRitualStore
                .getState()
                .saveDraft()
                .catch((reason) => console.error('[Ritual] Draft retry failed:', reason))
            }}
          >
            Retry saving draft
          </button>
        </div>
      )}
      <fieldset disabled={busy} className="space-y-4">
        {children}
      </fieldset>
      <nav aria-label="Ritual navigation" className="flex justify-between gap-2">
        <button
          disabled={busy || draft.step === 0}
          onClick={() => updateDraft({ step: draft.step - 1 })}
          className="px-3 py-2 text-sm text-text-secondary disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          disabled={busy || !canProceed}
          onClick={() => (last ? void completeRitual() : updateDraft({ step: draft.step + 1 }))}
          className="px-4 py-2 rounded-lg bg-focus/20 text-focus text-sm font-medium disabled:opacity-40"
        >
          {busy ? 'Saving…' : last ? completeLabel : 'Next →'}
        </button>
      </nav>
      <div className="border-t border-surface-border pt-3 flex flex-wrap items-center gap-3 text-xs">
        <button disabled={busy} onClick={() => void pauseRitual()} className="text-text-secondary">
          Save and pause
        </button>
        <button
          disabled={busy}
          onClick={() => setConfirmDiscard(!confirmDiscard)}
          className="text-text-secondary"
        >
          Discard draft
        </button>
        {confirmDiscard && (
          <div
            role="group"
            aria-label="Confirm discarding draft"
            className="flex items-center gap-3"
          >
            <span>Discard unsaved ritual answers?</span>
            <button disabled={busy} className="text-urgent" onClick={() => void discardDraft()}>
              Yes, discard
            </button>
            <button onClick={() => setConfirmDiscard(false)}>Keep draft</button>
          </div>
        )}
      </div>
    </RitualDialog>
  )
}
