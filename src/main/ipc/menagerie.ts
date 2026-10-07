/**
 * Menagerie IPC
 *
 * Bridges the Katya's Menagerie window to the MenagerieService.
 * Snapshot updates are pushed to every renderer that subscribed via
 * 'menagerie:subscribe'; subscriptions are cleaned up when the sender
 * window is destroyed.
 */
import { ipcMain, shell, clipboard, BrowserWindow, type WebContents } from 'electron'
import { getMenagerieService } from '../services/menagerie/MenagerieService'
import logger from '../utils/logger'
import type { MenagerieSnapshot } from '../../shared/types/menagerie'

const unsubscribers = new Map<number, () => void>()

export function registerMenagerieIpc(): void {
  const service = getMenagerieService()

  ipcMain.handle('menagerie:get-snapshot', async (): Promise<MenagerieSnapshot> => {
    try {
      return await service.getSnapshot()
    } catch (error) {
      logger.error('[Menagerie IPC] get-snapshot failed:', error)
      throw error
    }
  })

  ipcMain.handle('menagerie:refresh', async (): Promise<MenagerieSnapshot> => {
    try {
      return await service.forceRefresh()
    } catch (error) {
      logger.error('[Menagerie IPC] refresh failed:', error)
      throw error
    }
  })

  ipcMain.handle('menagerie:subscribe', (event): void => {
    attach(event.sender, (snapshot) => {
      if (!event.sender.isDestroyed()) event.sender.send('menagerie:update', snapshot)
    })
  })

  ipcMain.handle('menagerie:unsubscribe', (event): void => {
    detach(event.sender.id)
  })

  ipcMain.handle('menagerie:reveal', async (_event, cwd: string): Promise<void> => {
    if (typeof cwd !== 'string' || !cwd) return
    try {
      const result = await shell.openPath(cwd)
      if (result) shell.showItemInFolder(cwd)
    } catch (error) {
      logger.error('[Menagerie IPC] reveal failed:', error)
    }
  })

  ipcMain.handle('menagerie:get-notifications', (): Promise<boolean> => service.getNotifications())

  ipcMain.handle(
    'menagerie:edit-neighborhoods',
    (): Promise<void> => service.openNeighborhoodsConfig()
  )

  ipcMain.handle(
    'menagerie:set-notifications',
    (_event, enabled: boolean): Promise<boolean> => service.setNotifications(enabled === true)
  )

  ipcMain.handle('menagerie:copy-id', (_event, id: string): void => {
    if (typeof id === 'string' && id) clipboard.writeText(id)
  })

  // Deep-link into the GitHub Copilot app, which registers the ghapp:// scheme.
  // Sessions started directly from the CLI may not resolve there; that's a no-op.
  ipcMain.handle('menagerie:open-session', async (_event, id: string): Promise<boolean> => {
    if (typeof id !== 'string' || !/^[\w-]{8,64}$/.test(id)) return false
    try {
      await shell.openExternal(`ghapp://sessions/${id}`)
      return true
    } catch (error) {
      logger.error('[Menagerie IPC] open-session failed:', error)
      return false
    }
  })
}

function attach(sender: WebContents, listener: (s: MenagerieSnapshot) => void): void {
  detach(sender.id)
  const unsub = getMenagerieService().subscribe(listener)
  unsubscribers.set(sender.id, unsub)
  const win = BrowserWindow.fromWebContents(sender)
  win?.once('closed', () => detach(sender.id))
  sender.once('destroyed', () => detach(sender.id))
}

function detach(id: number): void {
  const unsub = unsubscribers.get(id)
  if (unsub) {
    unsub()
    unsubscribers.delete(id)
  }
}
