/**
 * Toast Utility
 *
 * Thin wrapper around react-hot-toast with styled defaults
 * matching the Aurora Dark theme.
 */
import hotToast from 'react-hot-toast'

/** Shared toast style using CSS variables for theme compatibility */
const baseStyle = {
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  backdropFilter: 'blur(12px)',
  fontSize: '13px',
}

export const toast = {
  success: (message: string): void => {
    hotToast.success(message, {
      style: {
        ...baseStyle,
        border: '1px solid var(--color-focus)',
      },
      iconTheme: {
        primary: 'var(--color-focus)',
        secondary: 'var(--color-background)',
      },
    })
  },

  error: (message: string): void => {
    hotToast.error(message, {
      style: {
        ...baseStyle,
        border: '1px solid var(--color-urgent)',
      },
      iconTheme: {
        primary: 'var(--color-urgent)',
        secondary: 'var(--color-background)',
      },
    })
  },

  info: (message: string): void => {
    hotToast(message, {
      icon: 'ℹ️',
      style: {
        ...baseStyle,
        border: '1px solid var(--color-primary)',
      },
    })
  },

  dismiss: (): void => {
    hotToast.dismiss()
  },
}
