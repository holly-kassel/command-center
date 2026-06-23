/**
 * Chat IPC Handlers — bridges ChatService ↔ renderer
 *
 * Handles chat:send-message, chat:get-conversation, chat:clear-conversation,
 * and nudge config. Streaming chunks are pushed via webContents.send().
 */
import { ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log'
import { getChatService } from '../services/chat'

export function registerChatIpc(mainWindow: BrowserWindow): void {
  const chat = getChatService()

  // Set the main window so ChatService can push stream events
  chat.setMainWindow(mainWindow)

  // Send a message — streaming response delivered via chat:stream-chunk events
  ipcMain.handle('chat:send-message', async (_event, text: string) => {
    log.info(`[ChatIPC] send-message: "${text.slice(0, 80)}..."`)
    const result = await chat.sendMessage(text)
    return result
  })

  // Get today's conversation (or a specific date)
  ipcMain.handle('chat:get-conversation', async (_event, date?: string) => {
    return chat.getConversation(date)
  })

  // Clear current conversation
  ipcMain.handle('chat:clear-conversation', async () => {
    chat.clearConversation()
    return { success: true }
  })

  // Nudge config
  ipcMain.handle('chat:get-nudge-config', async () => {
    return chat.getNudgeConfig()
  })

  ipcMain.handle('chat:set-nudge-config', async (_event, config: Record<string, unknown>) => {
    return chat.setNudgeConfig(config)
  })

  log.info('[ChatIPC] Handlers registered')
}
