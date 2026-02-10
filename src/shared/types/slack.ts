// Shared types for Slack thread parsing

export interface SlackMessage {
  author: string
  timestamp: string // original time string e.g. "12:34 PM"
  content: string
}

export interface ParsedSlackThread {
  title: string
  messages: SlackMessage[]
  participants: string[]
  date: string // ISO date string
  rawText: string
}
