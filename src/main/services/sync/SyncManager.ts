/**
 * SyncManager
 *
 * Manages automatic data refresh intervals and pushes updates
 * to the renderer via IPC. Integrates with CacheManager for
 * offline fallback.
 */
import { BrowserWindow } from 'electron'
import logger from '../../utils/logger'
import { getCacheManager } from '../cache/CacheManager'
import { getCalendarService } from '../calendar/CalendarService'
import { getGitHubService } from '../github/GitHubService'
import { getObsidianService } from '../obsidian/ObsidianService'
import { getRitualService } from '../ritual/RitualService'
import { getGoalService } from '../goal/GoalService'
import { settings } from '../../config/settings'
import type { CalendarEvent } from '../../../shared/types/calendar'
import type { GitHubNotification } from '../../../shared/types/github'
import type { TodaySection } from '../../../shared/types/obsidian'

export class SyncManager {
  private intervals = new Map<string, ReturnType<typeof setInterval>>()
  private mainWindow: BrowserWindow | null = null
  private cache = getCacheManager()

  /**
   * Start all auto-sync intervals.
   */
  startAutoSync(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow
    const calendarInterval = settings.get('calendarRefreshInterval') * 60 * 1000
    const githubInterval = settings.get('githubRefreshInterval') * 60 * 1000

    logger.info(
      `[SyncManager] Starting auto-sync (calendar: ${calendarInterval / 1000}s, github: ${githubInterval / 1000}s)`
    )

    // Calendar sync
    this.setInterval('calendar', () => this.syncCalendar(), calendarInterval)

    // GitHub sync
    this.setInterval('github', () => this.syncGitHub(), githubInterval)

    // Next meeting countdown — every 30 seconds
    this.setInterval('nextMeeting', () => this.syncNextMeeting(), 30 * 1000)

    // Obsidian is already handled by FileWatcher (chokidar) from Epic 2.
    // We just add a periodic re-sync as a safety net (every 60s).
    this.setInterval('obsidian', () => this.syncObsidian(), 60 * 1000)

    // Ritual sync — every 60 seconds
    this.setInterval('ritual', () => this.syncRitual(), 60 * 1000)

    // Goal sync — every 2 minutes
    this.setInterval('goal', () => this.syncGoal(), 2 * 60 * 1000)
  }

  /**
   * Stop all intervals.
   */
  stopAutoSync(): void {
    for (const [name, interval] of this.intervals) {
      clearInterval(interval)
      logger.debug(`[SyncManager] Stopped interval: ${name}`)
    }
    this.intervals.clear()
    this.mainWindow = null
    logger.info('[SyncManager] Auto-sync stopped')
  }

  /**
   * Get cached data for offline fallback.
   */
  getCachedData<T>(key: string): T | null {
    return this.cache.getStale<T>(key)
  }

  // ── Sync routines ──────────────────────────────────────────────

  private async syncCalendar(): Promise<void> {
    try {
      const calendar = getCalendarService()
      const events = await calendar.getTodayEvents()
      this.cache.set<CalendarEvent[]>('calendar', events)
      this.sendToRenderer('sync:calendar', events)
      logger.debug(`[SyncManager] Calendar synced: ${events.length} events`)
    } catch (err) {
      logger.warn('[SyncManager] Calendar sync failed:', err)
      // Don't send stale data on error — renderer keeps its current state
    }
  }

  private async syncGitHub(): Promise<void> {
    try {
      const github = getGitHubService()
      if (!github.isConfigured()) return

      const notifications = await github.getNotifications()
      this.cache.set<GitHubNotification[]>('github', notifications)
      this.sendToRenderer('sync:github', notifications)
      logger.debug(`[SyncManager] GitHub synced: ${notifications.length} notifications`)
    } catch (err) {
      logger.warn('[SyncManager] GitHub sync failed:', err)
    }
  }

  private async syncNextMeeting(): Promise<void> {
    try {
      const calendar = getCalendarService()
      const meeting = await calendar.getNextMeeting()
      this.sendToRenderer('sync:nextMeeting', meeting)
    } catch {
      // Silent — countdown is non-critical
    }
  }

  private async syncObsidian(): Promise<void> {
    try {
      const obsidian = getObsidianService()
      const todaySection = await obsidian.getTodaySection()
      const currentFocus = await obsidian.getCurrentFocus()

      if (todaySection) {
        this.cache.set<TodaySection>('obsidian', todaySection)
      }

      this.sendToRenderer('sync:obsidian', { todaySection, currentFocus })
      logger.debug('[SyncManager] Obsidian synced')
    } catch {
      // Silent — file watcher is the primary mechanism
    }
  }

  private async syncRitual(): Promise<void> {
    try {
      const ritual = getRitualService()
      const todayLog = ritual.getTodayLog()
      const streaks = ritual.getAllStreaks()
      this.sendToRenderer('sync:ritual', { todayLog, streaks })
      logger.debug('[SyncManager] Ritual synced')
    } catch {
      // Silent — ritual data is non-critical
    }
  }

  private async syncGoal(): Promise<void> {
    try {
      const goalService = getGoalService()
      const goals = goalService.getActiveGoals()
      const summary = goalService.getSummary()
      this.sendToRenderer('sync:goal', { goals, summary: { totalActive: summary.totalActive, completedThisWeek: summary.completedThisWeek } })
      logger.debug(`[SyncManager] Goals synced: ${goals.length} active`)
    } catch {
      // Silent — goal data is non-critical
    }
  }

  // ── Helpers ────────────────────────────────────────────────────

  private setInterval(name: string, fn: () => void, ms: number): void {
    // Clear existing if re-registering
    const existing = this.intervals.get(name)
    if (existing) clearInterval(existing)

    const id = setInterval(fn, ms)
    this.intervals.set(name, id)
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }
}

// Singleton
let instance: SyncManager | null = null

export function getSyncManager(): SyncManager {
  if (!instance) {
    instance = new SyncManager()
  }
  return instance
}
