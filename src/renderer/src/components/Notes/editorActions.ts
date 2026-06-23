/** Result of an editor action — apply to textarea after calling */
export interface EditorActionResult {
  text: string
  selectionStart: number
  selectionEnd: number
}

/** Input for all editor actions */
interface EditorInput {
  text: string
  selectionStart: number
  selectionEnd: number
}

type HeadingLevel = 1 | 2 | 3

const DEFAULT_PLACEHOLDER = 'text'
const LINK_PLACEHOLDER = 'text'
const LINK_URL_PLACEHOLDER = 'url'
const ORDERED_LIST_PREFIX = /^(\d+)\. /

function replaceRange(text: string, start: number, end: number, replacement: string): string {
  return text.slice(0, start) + replacement + text.slice(end)
}

function replaceSelection(
  input: EditorInput,
  replacement: string,
  nextSelectionStart: number,
  nextSelectionEnd: number
): EditorActionResult {
  return {
    text: replaceRange(input.text, input.selectionStart, input.selectionEnd, replacement),
    selectionStart: nextSelectionStart,
    selectionEnd: nextSelectionEnd
  }
}

function getSelectedLines(input: EditorInput): {
  start: number
  end: number
  lines: string[]
  lineStarts: number[]
} {
  const start = input.text.lastIndexOf('\n', Math.max(0, input.selectionStart - 1)) + 1
  const effectiveSelectionEnd =
    input.selectionEnd > input.selectionStart && input.text[input.selectionEnd - 1] === '\n'
      ? input.selectionEnd - 1
      : input.selectionEnd
  const nextLineBreak = input.text.indexOf('\n', effectiveSelectionEnd)
  const end = nextLineBreak === -1 ? input.text.length : nextLineBreak
  const lines = input.text.slice(start, end).split('\n')
  const lineStarts: number[] = []

  for (let index = 0; index < lines.length; index++) {
    if (index === 0) {
      lineStarts.push(start)
      continue
    }

    lineStarts.push(lineStarts[index - 1] + lines[index - 1].length + 1)
  }

  return { start, end, lines, lineStarts }
}

function adjustPositionForPrefixChange(
  position: number,
  blockStart: number,
  blockEnd: number,
  lineStarts: number[],
  oldPrefixLengths: number[],
  newPrefixLengths: number[]
): number {
  const totalDelta = newPrefixLengths.reduce(
    (sum, prefixLength, index) => sum + prefixLength - oldPrefixLengths[index],
    0
  )

  if (position < blockStart) {
    return position
  }

  if (position >= blockEnd) {
    return position + totalDelta
  }

  let deltaBeforeLine = 0

  for (let index = 0; index < lineStarts.length; index++) {
    const lineStart = lineStarts[index]
    const nextLineStart =
      index < lineStarts.length - 1 ? lineStarts[index + 1] : Number.POSITIVE_INFINITY

    if (position < nextLineStart) {
      const oldPrefixLength = oldPrefixLengths[index]
      const newPrefixLength = newPrefixLengths[index]
      const prefixBoundary = lineStart + oldPrefixLength

      if (position <= prefixBoundary) {
        return lineStart + deltaBeforeLine + newPrefixLength
      }

      return position + deltaBeforeLine + newPrefixLength - oldPrefixLength
    }

    deltaBeforeLine += newPrefixLengths[index] - oldPrefixLengths[index]
  }

  return position + totalDelta
}

function applyPrefixEdit(
  input: EditorInput,
  blockStart: number,
  blockEnd: number,
  lineStarts: number[],
  updatedLines: string[],
  oldPrefixLengths: number[],
  newPrefixLengths: number[]
): EditorActionResult {
  const nextText = replaceRange(input.text, blockStart, blockEnd, updatedLines.join('\n'))

  return {
    text: nextText,
    selectionStart: adjustPositionForPrefixChange(
      input.selectionStart,
      blockStart,
      blockEnd,
      lineStarts,
      oldPrefixLengths,
      newPrefixLengths
    ),
    selectionEnd: adjustPositionForPrefixChange(
      input.selectionEnd,
      blockStart,
      blockEnd,
      lineStarts,
      oldPrefixLengths,
      newPrefixLengths
    )
  }
}

function getOrderedListPrefixLength(line: string): number {
  return line.match(ORDERED_LIST_PREFIX)?.[0].length ?? 0
}

export function wrapSelection(
  input: EditorInput,
  before: string,
  after: string
): EditorActionResult {
  const selectedText = input.text.slice(input.selectionStart, input.selectionEnd)
  const selectionIsWrapped =
    input.selectionStart !== input.selectionEnd &&
    selectedText.startsWith(before) &&
    selectedText.endsWith(after)

  if (selectionIsWrapped) {
    const unwrapped = selectedText.slice(before.length, selectedText.length - after.length)
    return replaceSelection(
      input,
      unwrapped,
      input.selectionStart,
      input.selectionStart + unwrapped.length
    )
  }

  const hasWrappingAroundSelection =
    input.selectionStart >= before.length &&
    input.text.slice(input.selectionStart - before.length, input.selectionStart) === before &&
    input.text.slice(input.selectionEnd, input.selectionEnd + after.length) === after

  if (hasWrappingAroundSelection) {
    const nextText =
      input.text.slice(0, input.selectionStart - before.length) +
      selectedText +
      input.text.slice(input.selectionEnd + after.length)

    return {
      text: nextText,
      selectionStart: input.selectionStart - before.length,
      selectionEnd: input.selectionEnd - before.length
    }
  }

  if (input.selectionStart === input.selectionEnd) {
    const replacement = `${before}${DEFAULT_PLACEHOLDER}${after}`
    const placeholderStart = input.selectionStart + before.length

    return replaceSelection(
      input,
      replacement,
      placeholderStart,
      placeholderStart + DEFAULT_PLACEHOLDER.length
    )
  }

  const replacement = `${before}${selectedText}${after}`
  const nextSelectionStart = input.selectionStart + before.length

  return replaceSelection(
    input,
    replacement,
    nextSelectionStart,
    nextSelectionStart + selectedText.length
  )
}

export function toggleBold(input: EditorInput): EditorActionResult {
  return wrapSelection(input, '**', '**')
}

export function toggleItalic(input: EditorInput): EditorActionResult {
  return wrapSelection(input, '_', '_')
}

export function toggleInlineCode(input: EditorInput): EditorActionResult {
  return wrapSelection(input, '`', '`')
}

export function toggleHeading(input: EditorInput, level: HeadingLevel): EditorActionResult {
  const lineStart = input.text.lastIndexOf('\n', Math.max(0, input.selectionStart - 1)) + 1
  const nextLineBreak = input.text.indexOf('\n', input.selectionStart)
  const lineEnd = nextLineBreak === -1 ? input.text.length : nextLineBreak
  const line = input.text.slice(lineStart, lineEnd)
  const existingPrefix = line.match(/^(#{1,3}) /)?.[0] ?? ''
  const nextPrefix = existingPrefix === `${'#'.repeat(level)} ` ? '' : `${'#'.repeat(level)} `
  const content = existingPrefix ? line.slice(existingPrefix.length) : line
  const updatedLine = `${nextPrefix}${content}`

  return applyPrefixEdit(
    input,
    lineStart,
    lineEnd,
    [lineStart],
    [updatedLine],
    [existingPrefix.length],
    [nextPrefix.length]
  )
}

export function toggleLinePrefix(input: EditorInput, prefix: string): EditorActionResult {
  const { start, end, lines, lineStarts } = getSelectedLines(input)
  const allHavePrefix = lines.every((line) => line.startsWith(prefix))
  const oldPrefixLengths = lines.map((line) => (line.startsWith(prefix) ? prefix.length : 0))
  const newPrefixLengths = lines.map(() => (allHavePrefix ? 0 : prefix.length))
  const updatedLines = allHavePrefix
    ? lines.map((line) => line.slice(prefix.length))
    : lines.map((line) => `${prefix}${line}`)

  return applyPrefixEdit(
    input,
    start,
    end,
    lineStarts,
    updatedLines,
    oldPrefixLengths,
    newPrefixLengths
  )
}

export function toggleUnorderedList(input: EditorInput): EditorActionResult {
  return toggleLinePrefix(input, '- ')
}

export function toggleOrderedList(input: EditorInput): EditorActionResult {
  const { start, end, lines, lineStarts } = getSelectedLines(input)
  const allHaveOrderedPrefix = lines.every((line) => ORDERED_LIST_PREFIX.test(line))
  const oldPrefixLengths = lines.map(getOrderedListPrefixLength)
  const newPrefixLengths = lines.map((_, index) =>
    allHaveOrderedPrefix ? 0 : `${index + 1}. `.length
  )
  const updatedLines = allHaveOrderedPrefix
    ? lines.map((line) => line.replace(ORDERED_LIST_PREFIX, ''))
    : lines.map((line, index) => `${index + 1}. ${line.replace(ORDERED_LIST_PREFIX, '')}`)

  return applyPrefixEdit(
    input,
    start,
    end,
    lineStarts,
    updatedLines,
    oldPrefixLengths,
    newPrefixLengths
  )
}

export function toggleCheckbox(input: EditorInput): EditorActionResult {
  return toggleLinePrefix(input, '- [ ] ')
}

export function toggleBlockquote(input: EditorInput): EditorActionResult {
  return toggleLinePrefix(input, '> ')
}

export function insertLink(input: EditorInput): EditorActionResult {
  const selectedText = input.text.slice(input.selectionStart, input.selectionEnd)

  if (selectedText) {
    const replacement = `[${selectedText}](${LINK_URL_PLACEHOLDER})`
    const urlStart = input.selectionStart + selectedText.length + 3

    return replaceSelection(input, replacement, urlStart, urlStart + LINK_URL_PLACEHOLDER.length)
  }

  const replacement = `[${LINK_PLACEHOLDER}](${LINK_URL_PLACEHOLDER})`
  const textStart = input.selectionStart + 1

  return replaceSelection(input, replacement, textStart, textStart + LINK_PLACEHOLDER.length)
}

export function toggleCodeBlock(input: EditorInput): EditorActionResult {
  const selectedText = input.text.slice(input.selectionStart, input.selectionEnd)
  const fenceBefore = '```\n'
  const fenceAfter = '\n```'
  const isFencedSelection =
    selectedText.startsWith(fenceBefore) && selectedText.endsWith(fenceAfter)
  const hasFencesAroundSelection =
    input.selectionStart >= fenceBefore.length &&
    input.text.slice(input.selectionStart - fenceBefore.length, input.selectionStart) ===
      fenceBefore &&
    input.text.slice(input.selectionEnd, input.selectionEnd + fenceAfter.length) === fenceAfter

  if (selectedText.includes('\n') || isFencedSelection || hasFencesAroundSelection) {
    return wrapSelection(input, fenceBefore, fenceAfter)
  }

  return toggleInlineCode(input)
}
