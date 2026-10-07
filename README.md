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
- `/triage` hands a pasted message or link to the billing-projects triage agent. It runs in the background, and the agent saves any draft reply to your vault.
- Global hotkey overlay (⌘⇧Space) for fast capture from anywhere
- Appends directly to today's section in the weekly note

### Voice Transcription

- Click-to-record voice capture in the dashboard
- Local Whisper transcription (runs in main process via `@huggingface/transformers` + `onnxruntime-node` — no data leaves your machine)
- Edit transcript before saving, then pipe through `/transcript` slash command for LLM summarization

### Rituals & Streaks

- **Morning ritual**: Set a required intention and an optional focus commitment
- **Evening ritual**: Review completed tasks and scheduled meetings, reflect, and preview tomorrow's calendar. Writing, focus outcome, and energy are optional. Unanswered values stay unknown.
- **Touch Grass**: Pause, resume, or skip 4-7-8 breathing, then confirm hydration to record a reset. A reset does not claim time outdoors.
- Morning and evening are available all day. The card recommends a ritual by time or offers to resume a saved draft.
- Drafts save locally with Back, Save and pause, and confirmed discard. Escape saves and pauses. Failed saves retain answers for retry.
- History shows saved answers and lets you edit completed rituals without adding another completion.
- Dates use local calendar days. Streaks count Monday through Friday. Weekends neither advance nor break them. A focus streak requires an explicit achieved-focus answer in the evening.
- Weekly status distinguishes one ritual, both rituals, missed days, and upcoming days.

Legacy records are backed up before migration. Saved timestamps recover dates in the device's current timezone. Historical timezone changes cannot be reconstructed. Ambiguous dates and reset counts keep their original date keys. Historical focus commitments are retained, but focus outcomes remain unknown.

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

### Katya's Menagerie

- Pixel-art village (⌘⇧M or View → Katya's Menagerie) where every local Copilot CLI session is a tiny Stardew-style chibi puppy (digs holes) or kitten (bats a yarn ball) in its repo's yard, while Katya the Samoyed wanders the town square
- Reads only local data: `~/.copilot/session-store.db` plus each session's `workspace.yaml` / `events.jsonl` in `~/.copilot/session-state` — no network, no new dependencies
- Collar colour = status: **working** (walking/doing a chore), **waiting** (sitting with a `?` bubble — needs your permission), **idle** (wandering/napping), **recent** (sitting on the porch, process gone), **done** (asleep on the porch)
- Click a critter to jump to its session in the GitHub Copilot app (`ghapp://sessions/<id>`) and open a speech bubble with session name, branch, last activity, Open session, Reveal in Finder, and Copy session ID
- The village lays itself out to match the window's shape; if it still doesn't fit, scroll or drag to pan around
- Click a cottage to zoom into its yard: larger close-up portraits of each critter, the cottage at its current upgrade tier with progress to the next one, and full session details (status, branch, client, cwd, session ID). Escape or "Back to village" returns to the map
- Click Katya in the town square for her town report — pet her (drag over her) and she'll wag; click her and she barks
- Idle critters pair up and play together — chasing around their yard (or meeting in the town square if they live in different repos) with hearts and music notes
- Completed agent turns in a repo (counted only from when the Menagerie first saw each session) upgrade its cottage one step at a time at 5 / 15 / 30 / 50 / 80 / 120 turns: flower boxes → smoking chimney → white picket fence → side-room annex with a lantern → fresh teal roof paint and lit windows → gable star (progress persists in `menagerie-progress.json` under the app's userData folder)
- Working critters show a thought bubble with the tool they're actually running (from `tool.execution_start` titles), and any sub-agents they've spawned trail behind them as tiny kittens
- The village follows your clock: dusk tints the sky from 18:00, night falls at 20:00 with lit windows (and the lantern, once built) glowing until dawn
- When a critter starts waiting on you, a silent macOS notification fires (click it to jump to the session) and the dock badge shows how many need attention — toggle with "🔔 nudges" in the footer
- Waiting critters carry a "Needs approval" card (in the speech bubble, yard close-up, and Katya's "Needs you" queue, longest-waiting first) showing what the agent wants — shell command, file write, URL, MCP tool, extension access — with its stated intention and a read-only/writes badge, plus "Open to approve ↗". Approving still happens in the session itself: Copilot CLI exposes no control channel for another process to answer a permission prompt
- Projects that span several repos become a **neighborhood**: those yards sit together on a shared grass tint under a named banner, show up in the yard close-up and Katya's town report. Neighborhoods come from Collection projects in the GitHub Copilot app automatically, or from `menagerie-neighborhoods.json` in the app's user-data folder (`{ "Billing": ["github/billing-product", "github/billing-platform"] }`); the footer's "⌂ neighborhoods" button opens that file, and it wins over collections
- Each cottage tracks activity: a GitHub-style 8-week heatmap in the yard close-up, and a 🔥 flame by the sign for repos with a 3+ day streak
- Sessions archived in the GitHub Copilot app (read from `~/.copilot/data.db`) are hidden; live sessions always shown; finished sessions fade out and disappear after 24 hours
- Run `npm run test:menagerie` for the status/retention/grouping unit tests

### Other

- Dark/light/system theme with smooth transitions
- Samoyed mascot
- Slack thread parser (paste raw thread → structured markdown saved to vault)
- Auto-refresh sync (5-minute interval) with push updates
- Offline detection banner

## Tech Stack

| Layer         | Tech                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------- |
| Framework     | Electron 39 + electron-vite 5                                                             |
| Frontend      | React 19, TypeScript 5.9, Tailwind CSS 4                                                  |
| State         | Zustand 5                                                                                 |
| Markdown      | react-markdown + remark-gfm + rehype-raw                                                  |
| LLM           | Any OpenAI-compatible provider — OpenAI (default), Microsoft Foundry, or a local endpoint |
| Transcription | Whisper (local, via @huggingface/transformers + onnxruntime-node)                         |
| Auth          | MSAL (Microsoft), GitHub PAT                                                              |
| Storage       | electron-store, Obsidian vault (markdown files)                                           |

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
│   │   ├── llm/        # Provider-agnostic chat completions client
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
- GitHub PAT (for notifications)
- OpenAI API key (for transcription + meeting summaries)
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

### Ritual Checks

```bash
npm run test:rituals
npm run build
```

The regression suite uses mock persistence and APIs, not saved user data. It covers local dates and daylight saving, weekday streaks, migration collisions, draft recovery, and completion retries.

Use test data for these UI acceptance checks:

| Check                                                           | Expected behavior                                                                  |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Write a morning intention, go Back, press Escape, then reopen   | Writing and progress are retained. Focus returns to the card                       |
| Reload after pausing, resume, and finish                        | The draft survives reload. Completion removes it                                   |
| Complete an evening with optional answers blank                 | Energy and focus outcome remain unanswered. Tomorrow shows a separate calendar day |
| Open History and edit a completed ritual                        | Saved answers are restored. Saving does not add another completion                 |
| Begin breathing, pause or leave the window, then resume or skip | Breathing pauses instead of claiming time passed in the background                 |
| Try saving a reset before and after confirming water            | Hydration is required. A successful save adds one reset                            |
| Navigate with Tab and use a narrow window                       | Background controls cannot receive focus. The dialog scrolls                       |
| Interrupt a save and retry                                      | Answers remain available. Completion is not counted twice                          |

### Environment Variables

Create a `.env` file in the project root:

```env
# GitHub PAT — needed for notifications
GITHUB_TOKEN=ghp_...

# Microsoft auth (optional, for calendar)
MSAL_CLIENT_ID=...
MSAL_TENANT_ID=...

# /triage (optional): where billing-projects lives. The default is ~/.copilot/repos/billing-projects.
BILLING_PROJECTS_PATH=~/.copilot/repos/billing-projects

# /triage (optional): the vault triage.sh uses, such as a test vault. The default is Command Center's vault.
# OBSIDIAN_VAULT_PATH=...

# /triage passes COPILOT_COMMAND through to triage.sh unchanged.
```

## Custom Sounds

Drop audio files into `resources/sounds/` for use in the app:

- `howie-scream.mp3` — played when you scream into the void (falls back to a synthesized version if not present)
