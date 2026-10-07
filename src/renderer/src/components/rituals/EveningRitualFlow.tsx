import { addDays } from '@shared/ritualLogic'
import { EVENING_RITUAL_STEPS } from '@shared/types/ritual'
import { useRitualStore } from '../../store/ritualStore'
import { RitualFlowShell } from './RitualDialog'
import { RitualCalendar, RitualTasks } from './RitualContext'

export function EveningRitualFlow(): React.ReactElement | null {
  const draft = useRitualStore((s) => s.draft)
  const update = useRitualStore((s) => s.updateDraft)
  if (!draft) return null
  const answers = draft.answers
  return (
    <RitualFlowShell
      title="Evening ritual"
      steps={EVENING_RITUAL_STEPS}
      completeLabel="Save and close the day"
    >
      {draft.step === 0 && (
        <>
          <RitualTasks date={draft.date} />
          <RitualCalendar date={draft.date} pastOnly />
          <label className="block text-sm">
            Any other wins? <span className="text-text-secondary">(optional)</span>
            <textarea
              className="ritual-input mt-2"
              value={answers.untrackedWins}
              onChange={(e) => update({ answers: { untrackedWins: e.target.value } })}
              maxLength={20000}
              rows={2}
            />
          </label>
        </>
      )}
      {draft.step === 1 && (
        <>
          <label className="block text-sm">
            What went well? (optional)
            <textarea
              className="ritual-input mt-2"
              value={answers.wentWell}
              onChange={(e) => update({ answers: { wentWell: e.target.value } })}
              maxLength={20000}
              rows={2}
            />
          </label>
          <label className="block text-sm">
            What could improve? (optional)
            <textarea
              className="ritual-input mt-2"
              value={answers.couldImprove}
              onChange={(e) => update({ answers: { couldImprove: e.target.value } })}
              maxLength={20000}
              rows={2}
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm">Did you achieve the focus you wanted? (optional)</legend>
            <div className="flex gap-2">
              {(
                [
                  { label: 'Yes', value: true },
                  { label: 'Not today', value: false },
                  { label: 'Unanswered', value: null }
                ] as const
              ).map(({ label, value }) => (
                <button
                  key={label}
                  aria-pressed={answers.focusAchieved === value}
                  onClick={() => update({ answers: { focusAchieved: value } })}
                  className={`px-3 py-2 rounded-lg text-xs ${answers.focusAchieved === value ? 'bg-focus/20 text-focus' : 'bg-surface-muted/30 text-text-secondary'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}
      {draft.step === 2 && (
        <>
          <label className="block text-sm">
            What are you grateful for? (optional)
            <textarea
              className="ritual-input mt-2"
              value={answers.gratitude}
              onChange={(e) => update({ answers: { gratitude: e.target.value } })}
              maxLength={20000}
              rows={3}
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm">Energy today (optional)</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  aria-label={`Energy ${level} of 5`}
                  aria-pressed={answers.energyLevel === level}
                  onClick={() => update({ answers: { energyLevel: level } })}
                  className={`w-10 h-10 rounded-lg text-sm ${answers.energyLevel === level ? 'bg-focus/20 text-focus' : 'bg-surface-muted/30 text-text-secondary'}`}
                >
                  {level}
                </button>
              ))}
              <button
                onClick={() => update({ answers: { energyLevel: null } })}
                aria-pressed={answers.energyLevel === null}
                className="text-xs px-2 text-text-secondary"
              >
                Unanswered
              </button>
            </div>
            <p className="text-xs text-text-secondary">
              1 = drained · 5 = energized. Nothing is recorded unless you choose.
            </p>
          </fieldset>
        </>
      )}
      {draft.step === 3 && (
        <>
          <RitualCalendar date={addDays(draft.date, 1)} />
          <RitualTasks date={draft.date} pending />
          <p className="text-sm text-text-secondary">
            Ready to rest? Your reflection is yours to keep.
          </p>
        </>
      )}
      {draft.step < 3 && (
        <p className="text-xs text-text-secondary">
          Leave any optional answer blank and select Next to skip.
        </p>
      )}
    </RitualFlowShell>
  )
}
