/**
 * File Watcher
 *
 * Uses chokidar to watch the weekly-notes directory for changes.
 * When a file changes, notifies the renderer via IPC.
 */
import { watch, type FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import log from 'electron-log'

export class FileWatcher {
  private watcher: FSWatcher | null = null

  /**
   * Start watching a directory for .md file changes.
   * Sends 'obsidian:file-changed' to all renderer windows on change.
   */
  start(weeklyNotesDir: string): void {
    if (this.watcher) {
      this.stop()
    }

    log.info(`[FileWatcher] Watching: ${weeklyNotesDir}`)

    this.watcher = watch(weeklyNotesDir, {
      ignoreInitial: true,
      // Only watch .md files
      ignored: (path) => !path.endsWith('.md') && !path.endsWith('/'),
      // Debounce rapid changes (Obsidian writes frequently)
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    })

    this.watcher.on('change', (filePath) => {
      log.info(`[FileWatcher] File changed: ${filePath}`)
      this.notifyRenderers('obsidian:file-changed', { filePath })
    })

    this.watcher.on('error', (error) => {
      log.error('[FileWatcher] Error:', error)
    })
  }

  /** Stop watching */
  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
      log.info('[FileWatcher] Stopped')
    }
  }

  /** Send an event to all renderer windows */
  private notifyRenderers(channel: string, data: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }
  }
}

let instance: FileWatcher | null = null

export function getFileWatcher(): FileWatcher {
  if (!instance) {
    instance = new FileWatcher()
  }
  return instance
}
