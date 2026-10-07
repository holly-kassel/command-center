import { TOUCH_GRASS_STEPS } from '@shared/types/ritual'
import { useRitualStore } from '../../store/ritualStore'
import { BreathingExercise } from './BreathingExercise'
import { RitualFlowShell } from './RitualDialog'

export function TouchGrassFlow(): React.ReactElement | null {
  const draft = useRitualStore((s) => s.draft)
  const update = useRitualStore((s) => s.updateDraft)
  if (!draft) return null
  return (
    <RitualFlowShell
      title="Touch Grass"
      steps={TOUCH_GRASS_STEPS}
      canProceed={draft.step === 0 || draft.answers.waterConfirmed}
      completeLabel="Save reset"
    >
      <p className="text-sm text-text-secondary">
        Take a reset. Breathe and hydrate. This records a reset, not time outdoors.
      </p>
      {draft.step === 0 ? (
        <BreathingExercise onComplete={() => update({ step: 1 })} />
      ) : (
        <label className="flex gap-3 items-center text-sm py-6">
          <input
            type="checkbox"
            checked={draft.answers.waterConfirmed}
            onChange={(e) => update({ answers: { waterConfirmed: e.target.checked } })}
          />
          I drank some water.
        </label>
      )}
    </RitualFlowShell>
  )
}
