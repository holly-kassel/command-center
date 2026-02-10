/**
 * HotkeyManager
 *
 * Registers global hotkeys that work from any application.
 * Creates and manages lightweight overlay windows for:
 *  - Quick Capture  (Cmd+Shift+Space)
 *  - What's Next     (Cmd+Shift+N)
 */
import { globalShortcut, BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export class HotkeyManager {
  private quickCaptureWindow: BrowserWindow | null = null
  private whatsNextWindow: BrowserWindow | null = null
  private mainWindow: BrowserWindow | null = null

  /**
   * Register all global shortcuts. Call after mainWindow is created.
   */
  registerHotkeys(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow

    const captureOk = globalShortcut.register('CommandOrControl+Option+Space', () => {
      this.toggleQuickCapture()
    })
    console.log('[HotkeyManager] Cmd+Option+Space (quick capture) registered:', captureOk)

    const nextOk = globalShortcut.register('CommandOrControl+Shift+N', () => {
      this.showWhatsNext()
    })
    console.log('[HotkeyManager] Cmd+Shift+N (whats next) registered:', nextOk)

    const focusOk = globalShortcut.register('CommandOrControl+Shift+F', () => {
      this.toggleFocusMode()
    })
    console.log('[HotkeyManager] Cmd+Shift+F (focus mode) registered:', focusOk)

    // Listen for overlay close requests from renderer
    ipcMain.on('overlay:close', (_event) => {
      this.hideAll()
    })
  }

  // ── Focus Mode ─────────────────────────────────────────────

  private toggleFocusMode(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('app:toggleFocusMode')
      this.mainWindow.show()
      this.mainWindow.focus()
    }
  }

  // ── Quick Capture ──────────────────────────────────────────────

  private toggleQuickCapture(): void {
    if (this.quickCaptureWindow && !this.quickCaptureWindow.isDestroyed()) {
      if (this.quickCaptureWindow.isVisible()) {
        this.quickCaptureWindow.hide()
        return
      }
      this.positionQuickCapture(this.quickCaptureWindow)
      this.quickCaptureWindow.show()
      this.quickCaptureWindow.focus()
      return
    }

    const win = this.createOverlayWindow(600, 160)
    this.quickCaptureWindow = win

    this.loadOverlayRoute(win, 'quick-capture')
    this.positionQuickCapture(win)

    win.once('ready-to-show', () => {
      win.show()
      win.focus()
    })

    win.on('blur', () => {
      // Small delay so click-to-submit works before blur hides
      setTimeout(() => {
        if (win && !win.isDestroyed() && !win.isFocused()) {
          win.hide()
        }
      }, 150)
    })

    win.on('closed', () => {
      this.quickCaptureWindow = null
    })
  }

  private positionQuickCapture(win: BrowserWindow): void {
    const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize
    const [winW] = win.getSize()
    const x = Math.round((screenW - winW) / 2)
    const y = Math.round(screenH / 3)
    win.setPosition(x, y)
  }

  // ── What's Next ────────────────────────────────────────────────

  private showWhatsNext(): void {
    if (this.whatsNextWindow && !this.whatsNextWindow.isDestroyed()) {
      if (this.whatsNextWindow.isVisible()) {
        this.whatsNextWindow.hide()
        return
      }
      this.positionWhatsNext(this.whatsNextWindow)
      this.whatsNextWindow.show()
      return
    }

    const win = this.createOverlayWindow(420, 260)
    this.whatsNextWindow = win

    this.loadOverlayRoute(win, 'whats-next')
    this.positionWhatsNext(win)

    win.once('ready-to-show', () => {
      win.show()
    })

    win.on('blur', () => {
      // Auto-hide after losing focus
      setTimeout(() => {
        if (win && !win.isDestroyed() && !win.isFocused()) {
          win.hide()
        }
      }, 200)
    })

    win.on('closed', () => {
      this.whatsNextWindow = null
    })
  }

  private positionWhatsNext(win: BrowserWindow): void {
    const { width: screenW } = screen.getPrimaryDisplay().workAreaSize
    const [winW] = win.getSize()
    const x = screenW - winW - 20
    const y = 20
    win.setPosition(x, y)
  }

  // ── Helpers ────────────────────────────────────────────────────

  private createOverlayWindow(width: number, height: number): BrowserWindow {
    return new BrowserWindow({
      width,
      height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      show: false,
      hasShadow: true,
      vibrancy: 'under-window',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })
  }

  private loadOverlayRoute(win: BrowserWindow, route: string): void {
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/${route}`)
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: `/${route}`
      })
    }
  }

  hideAll(): void {
    if (this.quickCaptureWindow && !this.quickCaptureWindow.isDestroyed()) {
      this.quickCaptureWindow.hide()
    }
    if (this.whatsNextWindow && !this.whatsNextWindow.isDestroyed()) {
      this.whatsNextWindow.hide()
    }
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
    ipcMain.removeAllListeners('overlay:close')
    if (this.quickCaptureWindow && !this.quickCaptureWindow.isDestroyed()) {
      this.quickCaptureWindow.close()
    }
    if (this.whatsNextWindow && !this.whatsNextWindow.isDestroyed()) {
      this.whatsNextWindow.close()
    }
  }
}
