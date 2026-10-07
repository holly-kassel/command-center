import { BreathingExercise } from './BreathingExercise'
import { RitualFlowShell } from './RitualDialog'
import { RitualCalendar } from './RitualContext'
import { useObsidianStore } from '../../store/obsidianStore'
import { useRitualStore } from '../../store/ritualStore'
import { MORNING_RITUAL_STEPS } from '@shared/types/ritual'

export function MorningRitualFlow(): React.ReactElement | null {
  const draft = useRitualStore((s) => s.draft)
  const update = useRitualStore((s) => s.updateDraft)
  const currentFocus = useObsidianStore((s) => s.currentFocus)
  const obsidianError = useObsidianStore((s) => s.error)
  if (!draft) return null
  return (
    <RitualFlowShell
      title="Morning ritual"
      steps={MORNING_RITUAL_STEPS}
      canProceed={draft.step !== 2 || Boolean(draft.answers.intention.trim())}
    >
      {draft.step === 0 && <BreathingExercise onComplete={() => update({ step: 1 })} />}
      {draft.step === 1 && (
        <>
          <div className="rounded-lg bg-surface-muted/30 p-3 text-sm">
            <h3 className="font-medium">Current focus · Obsidian</h3>
            <p className="mt-1 text-text-secondary">
              {obsidianError ??
                currentFocus ??
                'No focus available. You can set an intention in the next step.'}
            </p>
          </div>
          <RitualCalendar date={draft.date} upcomingOnly />
        </>
      )}
      {draft.step === 2 && (
        <label className="block text-sm">
          What matters most for {draft.date}?{' '}
          <span className="text-text-secondary">(required)</span>
          <textarea
            value={draft.answers.intention}
            onChange={(e) => update({ answers: { intention: e.target.value } })}
            maxLength={20000}
            rows={4}
            className="ritual-input mt-2"
            placeholder="Today I will…"
          />
        </label>
      )}
      {draft.step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">{draft.answers.intention}</p>
          <label className="flex gap-3 items-start text-sm">
            <input
              type="checkbox"
              checked={draft.answers.focusCommitted}
              onChange={(e) => update({ answers: { focusCommitted: e.target.checked } })}
              className="mt-1"
            />
            I commit to focused, intentional work. This is a plan, not a completed focus day.
          </label>
        </div>
      )}
    </RitualFlowShell>
  )
}
