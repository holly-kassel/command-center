/**
 * SettingsPanel Component
 *
 * Full settings configuration UI with sections for Obsidian, Calendar,
 * GitHub, Hotkeys, and Appearance. Persists via electron-store.
 */
import { useState, useEffect } from 'react'
import type { AppSettings } from '@shared/types/settings'
import { toast } from '../../utils/toast'

const REFRESH_OPTIONS = [
  { label: '1 minute', value: 1 },
  { label: '5 minutes', value: 5 },
  { label: '10 minutes', value: 10 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
]

const HOTKEYS = [
  { label: 'Quick Capture', shortcut: '⌘ + ⌥ + Space' },
  { label: "What's Next", shortcut: '⌘ + ⇧ + N' },
]

export function SettingsPanel({ onClose }: { onClose: () => void }): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Microsoft auth state
  const [msftAuthed, setMsftAuthed] = useState(false)
  // GitHub config state
  const [ghConfigured, setGhConfigured] = useState(false)
  const [ghPat, setGhPat] = useState('')
  const [ghTesting, setGhTesting] = useState(false)

  // Meeting filter state
  const [newFilterPattern, setNewFilterPattern] = useState('')

  // Load settings
  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const [s, authed, configured] = await Promise.all([
          window.api.settings.getAll(),
          window.api.auth.isAuthenticated(),
          window.api.github.isConfigured(),
        ])
        setSettings(s)
        setMsftAuthed(authed)
        setGhConfigured(configured)
      } catch (err) {
        toast.error('Failed to load settings')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Update local draft
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
    setDirty(true)
  }

  // Save changes
  const save = async (): Promise<void> => {
    if (!settings || !dirty) return
    setSaving(true)
    try {
      const saved = await window.api.settings.update({
        obsidianVaultPath: settings.obsidianVaultPath,
        calendarRefreshInterval: settings.calendarRefreshInterval,
        githubRefreshInterval: settings.githubRefreshInterval,
        theme: settings.theme,
        userName: settings.userName,
        meetingFilterPatterns: settings.meetingFilterPatterns,
      })
      setSettings(saved)
      setDirty(false)
      toast.success('Settings saved')
    } catch (err) {
      toast.error('Failed to save settings')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Browse vault
  const browseVault = async (): Promise<void> => {
    try {
      const path = await window.api.settings.browseVaultPath()
      if (path) {
        update('obsidianVaultPath', path)
        toast.success('Vault path updated')
      }
    } catch (err) {
      toast.error('Failed to browse')
      console.error(err)
    }
  }

  // Detect vault
  const detectVault = async (): Promise<void> => {
    try {
      const path = await window.api.obsidian.findVault()
      if (path) {
        update('obsidianVaultPath', path)
        toast.success(`Found vault: ${path}`)
      } else {
        toast.error('No vault found')
      }
    } catch (err) {
      toast.error('Detection failed')
      console.error(err)
    }
  }

  // Microsoft sign in / out
  const toggleMsft = async (): Promise<void> => {
    try {
      if (msftAuthed) {
        await window.api.auth.logout()
        setMsftAuthed(false)
        toast.success('Signed out')
      } else {
        const result = await window.api.auth.loginMicrosoft()
        if (result.success) {
          setMsftAuthed(true)
          toast.success('Signed in')
        } else {
          toast.error(result.error || 'Sign in failed')
        }
      }
    } catch (err) {
      toast.error('Auth error')
      console.error(err)
    }
  }

  // GitHub PAT save
  const saveGhPat = async (): Promise<void> => {
    if (!ghPat.trim()) return
    try {
      const result = await window.api.github.setPAT(ghPat)
      if (result.success) {
        setGhConfigured(true)
        setGhPat('')
        toast.success('GitHub PAT saved')
      } else {
        toast.error(result.error || 'Failed to save PAT')
      }
    } catch (err) {
      toast.error('Failed to save PAT')
      console.error(err)
    }
  }

  // Test GitHub connection
  const testGhConnection = async (): Promise<void> => {
    setGhTesting(true)
    try {
      const notifications = await window.api.github.getNotifications()
      toast.success(`Connected! ${notifications.length} notifications`)
    } catch (err) {
      toast.error('Connection test failed')
      console.error(err)
    } finally {
      setGhTesting(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-text-muted">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary text-lg transition-colors"
          title="Close settings"
        >
          ✕
        </button>
      </div>

      {/* ── Obsidian ────────────────────────── */}
      <Section title="Obsidian" icon="📝">
        <Label text="Vault Path">
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.obsidianVaultPath}
              onChange={(e) => update('obsidianVaultPath', e.target.value)}
              placeholder="/path/to/vault"
              className="settings-input flex-1"
            />
            <button onClick={browseVault} className="settings-btn-secondary">
              Browse
            </button>
          </div>
          <button onClick={detectVault} className="settings-btn-ghost mt-2 text-xs">
            🔍 Detect Automatically
          </button>
        </Label>
      </Section>

      {/* ── Calendar ────────────────────────── */}
      <Section title="Calendar" icon="📅">
        <Label text="Microsoft 365">
          <div className="flex items-center gap-3">
            <StatusDot connected={msftAuthed} />
            <span className="text-sm text-text-secondary">
              {msftAuthed ? 'Connected' : 'Not connected'}
            </span>
            <button onClick={toggleMsft} className="settings-btn-secondary ml-auto">
              {msftAuthed ? 'Sign Out' : 'Sign In'}
            </button>
          </div>
        </Label>
        <Label text="Refresh Interval">
          <select
            value={settings.calendarRefreshInterval}
            onChange={(e) => update('calendarRefreshInterval', Number(e.target.value))}
            className="settings-select"
          >
            {REFRESH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Meeting Filters">
          <p className="text-xs text-text-muted mb-2">
            Events matching these patterns are hidden from the calendar.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(settings.meetingFilterPatterns || []).map((pattern) => (
              <span
                key={pattern}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-muted text-text-secondary text-xs border border-surface-border"
              >
                {pattern}
                <button
                  onClick={() => {
                    update('meetingFilterPatterns', (settings.meetingFilterPatterns || []).filter((p) => p !== pattern))
                  }}
                  className="text-text-muted hover:text-urgent ml-0.5 transition-colors"
                  title="Remove filter"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newFilterPattern}
              onChange={(e) => setNewFilterPattern(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFilterPattern.trim()) {
                  const patterns = settings.meetingFilterPatterns || []
                  if (!patterns.includes(newFilterPattern.trim())) {
                    update('meetingFilterPatterns', [...patterns, newFilterPattern.trim()])
                  }
                  setNewFilterPattern('')
                }
              }}
              placeholder="e.g. Standup, 1:1..."
              className="settings-input flex-1"
            />
            <button
              onClick={() => {
                if (newFilterPattern.trim()) {
                  const patterns = settings.meetingFilterPatterns || []
                  if (!patterns.includes(newFilterPattern.trim())) {
                    update('meetingFilterPatterns', [...patterns, newFilterPattern.trim()])
                  }
                  setNewFilterPattern('')
                }
              }}
              disabled={!newFilterPattern.trim()}
              className="settings-btn-secondary"
            >
              Add
            </button>
          </div>
        </Label>
      </Section>

      {/* ── GitHub ──────────────────────────── */}
      <Section title="GitHub" icon="🐙">
        <Label text="Status">
          <div className="flex items-center gap-3">
            <StatusDot connected={ghConfigured} />
            <span className="text-sm text-text-secondary">
              {ghConfigured ? 'PAT configured' : 'Not configured'}
            </span>
            {ghConfigured && (
              <button
                onClick={testGhConnection}
                disabled={ghTesting}
                className="settings-btn-secondary ml-auto"
              >
                {ghTesting ? 'Testing...' : 'Test Connection'}
              </button>
            )}
          </div>
        </Label>
        <Label text="Personal Access Token">
          <div className="flex gap-2">
            <input
              type="password"
              value={ghPat}
              onChange={(e) => setGhPat(e.target.value)}
              placeholder={ghConfigured ? '••••••••' : 'ghp_...'}
              className="settings-input flex-1"
            />
            <button
              onClick={saveGhPat}
              disabled={!ghPat.trim()}
              className="settings-btn-secondary"
            >
              Save
            </button>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Requires a classic PAT with <code className="text-accent">notifications</code> scope
          </p>
        </Label>
        <Label text="Refresh Interval">
          <select
            value={settings.githubRefreshInterval}
            onChange={(e) => update('githubRefreshInterval', Number(e.target.value))}
            className="settings-select"
          >
            {REFRESH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Label>
      </Section>

      {/* ── Hotkeys ─────────────────────────── */}
      <Section title="Hotkeys" icon="⌨️">
        <div className="space-y-2">
          {HOTKEYS.map((h) => (
            <div key={h.label} className="flex items-center justify-between py-1">
              <span className="text-sm text-text-secondary">{h.label}</span>
              <kbd className="px-2 py-0.5 text-xs rounded bg-surface-muted text-text-secondary border border-surface-border font-mono">
                {h.shortcut}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-2 italic">
          Customizable hotkeys coming soon
        </p>
      </Section>

      {/* ── Appearance ──────────────────────── */}
      <Section title="Appearance" icon="🎨">
        <Label text="Display Name">
          <input
            type="text"
            value={settings.userName}
            onChange={(e) => update('userName', e.target.value)}
            placeholder="Holly"
            className="settings-input w-48"
          />
        </Label>
        <Label text="Theme">
          <div className="flex gap-2">
            {(['dark', 'light', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => update('theme', t)}
                className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-all ${
                  settings.theme === t
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'bg-surface-muted/50 text-text-muted border border-transparent hover:text-text-secondary'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Label>
      </Section>

      {/* ── Save bar ────────────────────────── */}
      {dirty && (
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-border/40">
          <span className="text-xs text-warning">Unsaved changes</span>
          <button
            onClick={save}
            disabled={saving}
            className="settings-btn-primary"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <section className="card space-y-3">
      <h3 className="text-sm font-semibold text-text-primary tracking-wide flex items-center gap-2">
        <span>{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function Label({
  text,
  children,
}: {
  text: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
        {text}
      </label>
      {children}
    </div>
  )
}

function StatusDot({ connected }: { connected: boolean }): React.ReactElement {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${
        connected ? 'bg-focus' : 'bg-text-muted'
      }`}
    />
  )
}
