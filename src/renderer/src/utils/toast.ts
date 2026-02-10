/**
 * Toast Utility
 *
 * Thin wrapper around react-hot-toast with styled defaults
 * matching the Aurora Dark theme.
 */
import hotToast from 'react-hot-toast'

export const toast = {
  success: (message: string): void => {
    hotToast.success(message, {
      style: {
        background: 'rgba(30, 32, 44, 0.95)',
        color: '#e8eaf0',
        border: '1px solid rgba(52, 211, 153, 0.3)',
        backdropFilter: 'blur(12px)',
        fontSize: '13px',
      },
      iconTheme: {
        primary: '#34d399',
        secondary: '#0f1117',
      },
    })
  },

  error: (message: string): void => {
    hotToast.error(message, {
      style: {
        background: 'rgba(30, 32, 44, 0.95)',
        color: '#e8eaf0',
        border: '1px solid rgba(251, 113, 133, 0.3)',
        backdropFilter: 'blur(12px)',
        fontSize: '13px',
      },
      iconTheme: {
        primary: '#fb7185',
        secondary: '#0f1117',
      },
    })
  },

  info: (message: string): void => {
    hotToast(message, {
      icon: 'ℹ️',
      style: {
        background: 'rgba(30, 32, 44, 0.95)',
        color: '#e8eaf0',
        border: '1px solid rgba(96, 165, 250, 0.3)',
        backdropFilter: 'blur(12px)',
        fontSize: '13px',
      },
    })
  },

  dismiss: (): void => {
    hotToast.dismiss()
  },
}
