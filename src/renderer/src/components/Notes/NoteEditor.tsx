import { useMemo, useState } from 'react'
import { MarkdownPreview } from './MarkdownPreview'

interface NoteEditorProps {
  content: string
  dayOfWeek: string
  dateStr: string
  currentFocus: string | null
}

export function NoteEditor({
  content,
  dayOfWeek,
  dateStr,
  currentFocus
}: NoteEditorProps): React.JSX.Element {
  const [isOpening, setIsOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formattedDate = useMemo(() => {
    const date = new Date(dateStr + 'T12:00:00')
    if (Number.isNaN(date.getTime())) return dayOfWeek + ' · ' + dateStr
    return (
      dayOfWeek +
      ' · ' +
      date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    )
  }, [dateStr, dayOfWeek])

  const openInObsidian = async (): Promise<void> => {
    setIsOpening(true)
    setError(null)
    try {
      await window.api.obsidian.openWeekNote(dateStr)
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : String(openError))
    } finally {
      setIsOpening(false)
    }
  }

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{formattedDate}</h2>
          {currentFocus && <p className="mt-1 text-xs text-warning">🔔 {currentFocus}</p>}
        </div>
        <button
          type="button"
          onClick={() => void openInObsidian()}
          disabled={isOpening}
          className="rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/30 disabled:opacity-50"
        >
          {isOpening ? 'Opening…' : 'Open in Obsidian'}
        </button>
      </div>
      {error && <p className="border-b border-urgent/20 px-4 py-2 text-xs text-urgent">{error}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <MarkdownPreview content={content} />
      </div>
    </section>
  )
}
