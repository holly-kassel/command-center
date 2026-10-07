// Shared pixel-panel building blocks for the close-up side panels
import { INK } from './format'

export function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 1,
          textTransform: 'uppercase',
          opacity: 0.55,
          borderBottom: `2px solid ${INK}`,
          marginBottom: 6,
          paddingBottom: 2
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

export function Row({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
      <span style={{ width: 70, flexShrink: 0, opacity: 0.6 }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  )
}

export function Btn({
  children,
  onClick,
  disabled
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        background: disabled ? '#d8d0c0' : '#ffe066',
        color: INK,
        border: `2px solid ${INK}`,
        boxShadow: disabled ? 'none' : `2px 2px 0 ${INK}`,
        padding: '4px 6px',
        fontFamily: 'inherit',
        fontSize: 10,
        cursor: disabled ? 'default' : 'pointer',
        whiteSpace: 'nowrap'
      }}
    >
      {children}
    </button>
  )
}
