# Holly's Command Center

A personal productivity dashboard built with Electron, React, and TypeScript. Pulls together Obsidian notes, calendar, GitHub notifications, rituals, goals, and quick-capture tools into one always-open window.

## Features

### Daily Notes & Navigation
- Renders today's section from Obsidian weekly notes with full markdown support (GFM, checkboxes, raw HTML)
- Interactive checkboxes that write back to the vault file
- Inline markdown editor (⌘S to save, Esc to cancel)
- Day-by-day navigation arrows to reflect on previous weekdays' notes
- Current focus badge pulled from `### Current Focus` subsection

### Calendar
- Microsoft 365 calendar integration via MSAL
- Today's meetings with countdown timer to next meeting
- Configurable meeting filters to hide noise (recurring 1:1s, all-hands, etc.)

### GitHub
- Notification inbox with read/unread management
- Pull request dashboard
- PAT-based auth with credential storage

### Quick Capture
- Slash command system (`/transcript`, `/standup`, `/retro`, etc.) powered by LLM summarization
- Global hotkey overlay (⌘⇧Space) for fast capture from anywhere
- Appends directly to today's section in the weekly note

### Voice Transcription
- Click-to-record voice capture in the dashboard
- Local Whisper transcription (runs in main process via `@huggingface/transformers` + `onnxruntime-node` — no data leaves your machine)
- Edit transcript before saving, then pipe through `/transcript` slash command for LLM summarization

### Rituals & Streaks
- **Morning ritual**: Guided flow to set daily intentions
- **Evening ritual**: Reflection and end-of-day review
- **Touch Grass**: Breathing exercise (4-7-8 pattern) + hydration check
- Streak tracking across ritual types with fire/snowflake indicators
- Weekly metrics dashboard with completion rates

### Goals
- Hierarchical goal system (vision → yearly → quarterly → weekly → daily)
- Category tagging (career, health, learning, personal, financial, social)
- Task linking — checkbox completions in daily notes auto-update goal progress
- Tree view with progress bars and suggested parent goals

### Focus Mode
- Distraction-free overlay (⌘⇧F) showing only current focus + next meeting countdown

### Scream Into The Void
- Type whatever you need to get off your chest — it is **never saved anywhere**
- Hit scream and your words dissolve into nothing, accompanied by a Howie scream
- Pure catharsis, zero consequences

### Other
- Dark/light/system theme with smooth transitions
- Samoyed mascot
- Slack thread parser (paste raw thread → structured markdown saved to vault)
- Auto-refresh sync (5-minute interval) with push updates
- Offline detection banner

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Electron 39 + electron-vite 5 |
| Frontend | React 19, TypeScript 5.9, Tailwind CSS 4 |
| State | Zustand 5 |
| Markdown | react-markdown + remark-gfm + rehype-raw |
| LLM | GitHub Models API (GPT-4.1) |
| Transcription | Whisper (local, via @huggingface/transformers + onnxruntime-node) |
| Auth | MSAL (Microsoft), GitHub PAT |
| Storage | electron-store, Obsidian vault (markdown files) |

## Project Structure

```
src/
├── main/               # Electron main process
│   ├── ipc/            # IPC handlers (obsidian, calendar, github, etc.)
│   ├── services/       # Business logic
│   │   ├── auth/       # Microsoft MSAL auth
│   │   ├── calendar/   # Microsoft Graph calendar
│   │   ├── commands/   # Slash command registry + LLM
│   │   ├── github/     # GitHub API client
│   │   ├── goal/       # Goal tracking service
│   │   ├── hotkey/     # Global hotkey management
│   │   ├── llm/        # GitHub Models API client
│   │   ├── obsidian/   # Vault operations + weekly note parsing
│   │   ├── ritual/     # Ritual & streak tracking
│   │   ├── slack/      # Slack thread parser
│   │   ├── sync/       # Auto-refresh sync manager
│   │   └── transcription/ # Local Whisper transcription
│   └── config/         # App settings schema
├── preload/            # Context bridge (main ↔ renderer)
├── renderer/src/       # React frontend
│   ├── components/     # UI components (rituals, goals, voice recorder, etc.)
│   ├── store/          # Zustand stores
│   ├── windows/        # Top-level views (Dashboard, FocusMode, Settings, etc.)
│   ├── hooks/          # Custom React hooks
│   └── utils/          # Toast, helpers
├── shared/types/       # Shared TypeScript interfaces
└── resources/
    └── sounds/         # Audio assets (e.g., howie-scream.mp3)
```

## Setup

### Prerequisites
- Node.js 20+
- An Obsidian vault at `~/Documents/obsidian-notes/` with weekly notes
- GitHub PAT (for notifications + GitHub Models API)
- Microsoft 365 account (for calendar, optional)

### Install & Run

```bash
npm install
npm run dev
```

### Build

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

### Environment Variables

Create a `.env` file in the project root:

```env
# GitHub PAT — needed for notifications + LLM (GitHub Models)
GITHUB_TOKEN=ghp_...

# Microsoft auth (optional, for calendar)
MSAL_CLIENT_ID=...
MSAL_TENANT_ID=...
```

## Custom Sounds

Drop audio files into `resources/sounds/` for use in the app:
- `howie-scream.mp3` — played when you scream into the void (falls back to a synthesized version if not present)
