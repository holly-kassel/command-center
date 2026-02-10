/**
 * SlackParser
 *
 * Parses raw text copied from Slack into structured messages.
 *
 * Slack's actual copy format:
 *
 *   holly-kassel  [2:14 PM]
 *   My goal is to be glue
 *   [2:15 PM]always, I think you're spot on
 *   [2:16 PM]this is SO GOOD
 *   brittanyellich  [3:20 PM]
 *   Yep I completely agree with that
 *   [3:21 PM]The world is majorly shifting
 *
 * Patterns:
 *   1. "author  [H:MM AM/PM]" — new author header (may have text after bracket)
 *   2. "[H:MM AM/PM]text" — continuation message from same author
 *   3. Plain text lines — continuation of current message content
 */

import type { ParsedSlackThread, SlackMessage } from '../../../shared/types/slack'

// "author  [H:MM PM]" or "author  [H:MM PM]text on same line"
const AUTHOR_HEADER = /^(.+?)\s{2,}\[(\d{1,2}:\d{2}(?:\s*[AP]M)?)\]\s*(.*)?$/i

// "[H:MM PM]" or "[H:MM PM]text" — continuation from same author
const CONTINUATION = /^\[(\d{1,2}:\d{2}(?:\s*[AP]M)?)\]\s*(.*)?$/i

// Slack reaction/thread noise to skip
const REACTION_PATTERN = /^:[a-z0-9_+-]+:\s*\d*$/
const THREAD_REPLY_PATTERN = /^\d+\s+repl(?:y|ies)$/i
const ATTACHMENT_PATTERN = /^\d+\s+attachment/i

export class SlackParser {
  /**
   * Parse raw copied Slack text into a structured thread.
   */
  static parseThread(rawText: string): ParsedSlackThread {
    const lines = rawText.split('\n')
    const messages: SlackMessage[] = []
    let currentAuthor = ''
    let currentTime = ''
    let contentLines: string[] = []

    const flushMessage = (): void => {
      if (currentAuthor) {
        const content = contentLines.join('\n').trim()
        if (content) {
          messages.push({
            author: currentAuthor,
            timestamp: currentTime,
            content
          })
        }
      }
      contentLines = []
    }

    for (const line of lines) {
      const trimmed = line.trim()

      // Skip empty lines (but preserve paragraph breaks within a message)
      if (!trimmed) {
        if (currentAuthor && contentLines.length > 0) {
          contentLines.push('')
        }
        continue
      }

      // Skip Slack noise
      if (REACTION_PATTERN.test(trimmed) ||
          THREAD_REPLY_PATTERN.test(trimmed) ||
          ATTACHMENT_PATTERN.test(trimmed)) {
        continue
      }

      // 1. New author header: "holly-kassel  [2:14 PM]" or "holly-kassel  [2:14 PM]some text"
      const authorMatch = trimmed.match(AUTHOR_HEADER)
      if (authorMatch) {
        flushMessage()
        currentAuthor = authorMatch[1].trim()
        currentTime = authorMatch[2].trim()
        const inlineText = (authorMatch[3] || '').trim()
        if (inlineText) {
          contentLines.push(inlineText)
        }
        continue
      }

      // 2. Continuation timestamp: "[2:15 PM]text" — new message, same author
      const contMatch = trimmed.match(CONTINUATION)
      if (contMatch && currentAuthor) {
        flushMessage()
        currentTime = contMatch[1].trim()
        const inlineText = (contMatch[2] || '').trim()
        if (inlineText) {
          contentLines.push(inlineText)
        }
        continue
      }

      // 3. Plain content line — append to current message
      if (currentAuthor) {
        contentLines.push(trimmed)
      }
    }

    // Flush last message
    flushMessage()

    // Extract metadata
    const participants = [...new Set(messages.map((m) => m.author))]
    const title =
      messages.length > 0
        ? messages[0].content.slice(0, 80).replace(/\n/g, ' ')
        : 'Untitled Thread'

    return {
      title,
      messages,
      participants,
      date: new Date().toISOString(),
      rawText
    }
  }

  /**
   * Format a parsed thread as Obsidian-flavored markdown.
   */
  static formatForObsidian(thread: ParsedSlackThread, customTitle?: string): string {
    const title = customTitle || thread.title
    const date = new Date(thread.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    const lines: string[] = [
      `# ${title}`,
      '',
      `> **Participants:** ${thread.participants.join(', ')}`,
      `> **Saved:** ${date}`,
      `> **Messages:** ${thread.messages.length}`,
      '',
      '---',
      ''
    ]

    for (const msg of thread.messages) {
      lines.push(`### ${msg.author} — ${msg.timestamp}`)
      lines.push('')
      lines.push(msg.content)
      lines.push('')
    }

    return lines.join('\n')
  }
}
