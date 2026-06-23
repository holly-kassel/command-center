import { useCallback } from 'react'
import type * as React from 'react'

interface EditorActionResult {
  text: string
  selectionStart: number
  selectionEnd: number
}

type ToolbarAction = (textarea: HTMLTextAreaElement) => EditorActionResult

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onApplyAction: (result: EditorActionResult) => void
}

interface ToolbarButtonProps {
  label: string
  title: string
  onClick: () => void
  children: React.ReactNode
}

const buttonClasses =
  'p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-muted transition-colors'
const placeholderText = 'text'
const placeholderUrl = 'url'

function replaceRange(text: string, start: number, end: number, replacement: string): string {
  return text.slice(0, start) + replacement + text.slice(end)
}

function getSelectedLineRange(
  text: string,
  selectionStart: number,
  selectionEnd: number
): { start: number; end: number } {
  const start = text.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1
  const effectiveEnd =
    selectionEnd > selectionStart && text[selectionEnd - 1] === '\n'
      ? selectionEnd - 1
      : selectionEnd
  const nextLineBreak = text.indexOf('\n', effectiveEnd)
  const end = nextLineBreak === -1 ? text.length : nextLineBreak

  return { start, end }
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string
): EditorActionResult {
  const { value, selectionStart, selectionEnd } = textarea
  const selectedText = value.slice(selectionStart, selectionEnd)
  const replacement = selectedText
    ? `${before}${selectedText}${after}`
    : `${before}${placeholderText}${after}`
  const nextSelectionStart = selectionStart + before.length
  const nextSelectionEnd = nextSelectionStart + (selectedText || placeholderText).length

  return {
    text: replaceRange(value, selectionStart, selectionEnd, replacement),
    selectionStart: nextSelectionStart,
    selectionEnd: nextSelectionEnd
  }
}

function toggleLinePrefix(textarea: HTMLTextAreaElement, prefix: string): EditorActionResult {
  const { value, selectionStart, selectionEnd } = textarea
  const { start, end } = getSelectedLineRange(value, selectionStart, selectionEnd)
  const block = value.slice(start, end)
  const updatedBlock = block
    .split('\n')
    .map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : `${prefix}${line}`))
    .join('\n')

  return {
    text: replaceRange(value, start, end, updatedBlock),
    selectionStart: start,
    selectionEnd: start + updatedBlock.length
  }
}

function insertLink(textarea: HTMLTextAreaElement): EditorActionResult {
  const { value, selectionStart, selectionEnd } = textarea
  const selectedText = value.slice(selectionStart, selectionEnd)

  if (selectedText) {
    const replacement = `[${selectedText}](${placeholderUrl})`
    const urlStart = selectionStart + selectedText.length + 3

    return {
      text: replaceRange(value, selectionStart, selectionEnd, replacement),
      selectionStart: urlStart,
      selectionEnd: urlStart + placeholderUrl.length
    }
  }

  const replacement = `[${placeholderText}](${placeholderUrl})`

  return {
    text: replaceRange(value, selectionStart, selectionEnd, replacement),
    selectionStart: selectionStart + 1,
    selectionEnd: selectionStart + 1 + placeholderText.length
  }
}

function toggleCodeBlock(textarea: HTMLTextAreaElement): EditorActionResult {
  const { value, selectionStart, selectionEnd } = textarea
  const selectedText = value.slice(selectionStart, selectionEnd)

  if (selectedText.includes('\n')) {
    const before = '```\n'
    const after = '\n```'

    return {
      text: replaceRange(value, selectionStart, selectionEnd, `${before}${selectedText}${after}`),
      selectionStart: selectionStart + before.length,
      selectionEnd: selectionStart + before.length + selectedText.length
    }
  }

  return wrapSelection(textarea, '`', '`')
}

function ToolbarButton({ label, title, onClick, children }: ToolbarButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={buttonClasses}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={label}
    >
      {children}
    </button>
  )
}

function BoldIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <text x="4" y="12" fontSize="11" fontWeight="700" fill="currentColor">
        B
      </text>
    </svg>
  )
}

function ItalicIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <text x="6" y="12" fontSize="11" fontStyle="italic" fontWeight="700" fill="currentColor">
        I
      </text>
    </svg>
  )
}

function HeadingIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <text x="3" y="12" fontSize="11" fontWeight="700" fill="currentColor">
        H
      </text>
    </svg>
  )
}

function UnorderedListIcon(): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="3" cy="4" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M6 4h7" />
      <path d="M6 8h7" />
      <path d="M6 12h7" />
    </svg>
  )
}

function OrderedListIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <text x="1.5" y="6" fontSize="5" fontWeight="700" fill="currentColor">
        1.
      </text>
      <text x="1.5" y="14" fontSize="5" fontWeight="700" fill="currentColor">
        2.
      </text>
      <path d="M7 4h7M7 8h7M7 12h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CheckboxIcon(): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1.75" y="2.25" width="4.5" height="4.5" rx="1" />
      <path d="M8.5 4.5H14" />
      <rect x="1.75" y="9.25" width="4.5" height="4.5" rx="1" />
      <path d="M3.25 11.5l1 1 1.75-2" />
      <path d="M8.5 11.5H14" />
    </svg>
  )
}

function LinkIcon(): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.25 9.75 9.75 6.25" />
      <path d="M5.25 11.75H4a2.75 2.75 0 1 1 0-5.5h1.25" />
      <path d="M10.75 4.25H12a2.75 2.75 0 1 1 0 5.5h-1.25" />
    </svg>
  )
}

function CodeIcon(): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5.5 12.5-3-4 3-4" />
      <path d="m10.5 3.5 3 4-3 4" />
      <path d="m9.5 2.5-3 11" />
    </svg>
  )
}

function QuoteIcon(): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 4H3.75A1.75 1.75 0 0 0 2 5.75V8h3V4Zm0 7H3.75A1.75 1.75 0 0 1 2 9.25V8" />
      <path d="M14 4h-2.25A1.75 1.75 0 0 0 10 5.75V8h3V4Zm0 7h-2.25A1.75 1.75 0 0 1 10 9.25V8" />
    </svg>
  )
}

export function MarkdownToolbar({
  textareaRef,
  onApplyAction
}: MarkdownToolbarProps): React.JSX.Element {
  const applyAction = useCallback(
    (action: ToolbarAction): void => {
      const textarea = textareaRef.current

      if (!textarea) {
        return
      }

      onApplyAction(action(textarea))
      textarea.focus()
    },
    [onApplyAction, textareaRef]
  )

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-surface-muted/30">
      <ToolbarButton
        label="Bold"
        title="Bold (⌘B)"
        onClick={() => applyAction((textarea) => wrapSelection(textarea, '**', '**'))}
      >
        <BoldIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        title="Italic (⌘I)"
        onClick={() => applyAction((textarea) => wrapSelection(textarea, '_', '_'))}
      >
        <ItalicIcon />
      </ToolbarButton>

      <div className="w-px h-4 bg-border mx-1" aria-hidden="true" />

      <ToolbarButton
        label="Heading"
        title="Heading"
        onClick={() => applyAction((textarea) => toggleLinePrefix(textarea, '### '))}
      >
        <HeadingIcon />
      </ToolbarButton>

      <div className="w-px h-4 bg-border mx-1" aria-hidden="true" />

      <ToolbarButton
        label="Unordered list"
        title="Unordered list"
        onClick={() => applyAction((textarea) => toggleLinePrefix(textarea, '- '))}
      >
        <UnorderedListIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Ordered list"
        title="Ordered list"
        onClick={() => applyAction((textarea) => toggleLinePrefix(textarea, '1. '))}
      >
        <OrderedListIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Checkbox"
        title="Checkbox list"
        onClick={() => applyAction((textarea) => toggleLinePrefix(textarea, '- [ ] '))}
      >
        <CheckboxIcon />
      </ToolbarButton>

      <div className="w-px h-4 bg-border mx-1" aria-hidden="true" />

      <ToolbarButton label="Link" title="Insert link (⌘K)" onClick={() => applyAction(insertLink)}>
        <LinkIcon />
      </ToolbarButton>
      <ToolbarButton label="Code" title="Code" onClick={() => applyAction(toggleCodeBlock)}>
        <CodeIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        title="Quote"
        onClick={() => applyAction((textarea) => toggleLinePrefix(textarea, '> '))}
      >
        <QuoteIcon />
      </ToolbarButton>
    </div>
  )
}
