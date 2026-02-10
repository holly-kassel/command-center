/**
 * Application Menu
 *
 * Native macOS/Windows menu bar with File, View, Window, Help menus.
 * Includes About dialog and Settings shortcut.
 */
import { app, Menu, BrowserWindow, dialog, shell } from 'electron'

const isMac = process.platform === 'darwin'

export function buildAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    // ── App menu (macOS only) ──
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              {
                label: 'About Command Center',
                click: (): void => showAboutDialog(),
              },
              { type: 'separator' as const },
              {
                label: 'Settings…',
                accelerator: 'Cmd+,' as const,
                click: (): void => sendToFocusedWindow('menu:openSettings'),
              },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          } as Electron.MenuItemConstructorOptions,
        ]
      : []),

    // ── File ──
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings…',
          accelerator: isMac ? 'Cmd+,' : 'Ctrl+,',
          click: (): void => sendToFocusedWindow('menu:openSettings'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },

    // ── Edit ──
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },

    // ── View ──
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // ── Window ──
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },

    // ── Help ──
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Command Center',
          click: (): void => showAboutDialog(),
        },
        { type: 'separator' },
        {
          label: 'View on GitHub',
          click: (): void => {
            shell.openExternal('https://github.com/holly-kassel/command-center')
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function showAboutDialog(): void {
  dialog.showMessageBox({
    type: 'info',
    title: 'About Command Center',
    message: "Holly's Command Center",
    detail: [
      `Version: ${app.getVersion()}`,
      '',
      'Personal productivity dashboard — calendar, Obsidian notes, GitHub notifications, and quick capture in one place.',
      '',
      'Built with Electron, React, and Claude Code.',
      '© 2026 Holly Kassel',
    ].join('\n'),
    buttons: ['OK'],
  })
}

function sendToFocusedWindow(channel: string): void {
  const win = BrowserWindow.getFocusedWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel)
  }
}
