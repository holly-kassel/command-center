# Dead Code Cleanup — Main Process & Services

**Author:** Rusty (Backend Dev)
**Date:** 2025-07-18

## What Was Removed

### Console.log / Debug Statements
- `src/main/index.ts` — Removed `ipcMain.on('ping', ...)` test IPC handler with `console.log('pong')`
- `src/main/services/hotkey/HotkeyManager.ts` — Removed 3 `console.log` statements for hotkey registration status

### Unused Service Methods
- `GoalService.getRootGoals()` — never called; `getGoalTree()` builds roots internally
- `KanbanService.getTasksByStatus()` — no IPC handler exposes it; renderer filters client-side
- `KanbanService.getCompletedOnDate()` — never called from IPC or other services
- `TriageService.getTriageData(notificationId)` — single-notification getter never called; all callers use `getAllTriageData()`
- `TriageService.pruneStaleEntries()` — defined but never wired into any lifecycle
- `WeeklyNoteParser.extractAllFocusItems()` — never called; only `extractCurrentFocus()` is used
- `CredentialManager.deleteGitHubPAT()` — never called; no "remove PAT" feature exists
- `SyncManager.getCachedData()` — never called from outside the class
- `CacheManager.remove()` — never called by any consumer
- `CacheManager.clear()` — never called by any consumer

### Dead Barrel Exports (index files)
- `auth/index.ts` — Removed `GraphAuthService` class re-export (consumers import `getGraphAuthService` directly)
- `github/index.ts` — Removed `McpClient` and `GitHubService` class re-exports (consumers import singletons directly)
- `commands/index.ts` — Removed `SlashCommandResult` type re-export (preload imports from shared types)
- `transcription/index.ts` — Removed `isWhisperReady` re-export (never imported by any consumer)
- `llm/index.ts` — Removed `loadVaultFile` re-export (only used internally by `loadVaultFiles`)
- `obsidian/index.ts` — Removed `ObsidianService` class, `FileWatcher` class, and `export *` from WeeklyNoteParser (all consumers import directly from source files)

## What Was Left Alone

- `src/main/config/index.ts` — Defines `AppConfigSchema`, `AppConfig`, and `defaultConfig` which are never imported. Left in place as it appears to be a prepared Zod schema for future config validation.
- `loadVaultFile` function in `contextLoader.ts` — Still used internally by `loadVaultFiles`; only the re-export was removed.
- `isWhisperReady` function in `TranscriptionService.ts` — Still defined; only the re-export was removed.
- `parseCommand` in `SlashCommandRegistry` — Used internally by `execute()`.
- Logger utility (`src/main/utils/logger.ts`) — Kept intact per instructions.
- `src/preload/index.ts` line 343 `console.error(error)` — Part of context bridge setup error handling, intentional.

## Verification

- TypeScript compilation passes: `npx tsc --noEmit -p tsconfig.node.json --composite false`
- No logic changes — only dead code removal
