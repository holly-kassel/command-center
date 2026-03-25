// eslint-disable-next-line @typescript-eslint/no-require-imports
const ElectronStore = require('electron-store')
import log from 'electron-log'
import type {
  NotificationTriageData,
  TriagePriority,
  TriageStatus
} from '../../../shared/types/github'

interface TriageStoreSchema {
  triageData: Record<string, NotificationTriageData>
  sortOrder: string[]
}

const STORE_DEFAULTS: TriageStoreSchema = {
  triageData: {},
  sortOrder: []
}

export class TriageService {
  private store: InstanceType<typeof ElectronStore>

  constructor() {
    this.store = new (ElectronStore.default || ElectronStore)({
      name: 'github-triage',
      defaults: STORE_DEFAULTS
    })
  }

  /** Get all triage data */
  getAllTriageData(): Record<string, NotificationTriageData> {
    return this.store.get('triageData') as Record<string, NotificationTriageData>
  }

  /** Set triage status for a notification */
  setTriageStatus(notificationId: string, status: TriageStatus): NotificationTriageData {
    const all = this.getAllTriageData()
    const existing = all[notificationId] ?? this.createDefault(notificationId)
    existing.status = status
    existing.updatedAt = new Date().toISOString()
    all[notificationId] = existing
    this.store.set('triageData', all)
    log.info(`[Triage] Set status ${status} for ${notificationId}`)
    return existing
  }

  /** Set triage priority for a notification */
  setTriagePriority(notificationId: string, priority: TriagePriority): NotificationTriageData {
    const all = this.getAllTriageData()
    const existing = all[notificationId] ?? this.createDefault(notificationId)
    existing.priority = priority
    existing.updatedAt = new Date().toISOString()
    all[notificationId] = existing
    this.store.set('triageData', all)
    log.info(`[Triage] Set priority ${priority} for ${notificationId}`)
    return existing
  }

  /** Set triage notes for a notification */
  setTriageNotes(notificationId: string, notes: string): NotificationTriageData {
    const all = this.getAllTriageData()
    const existing = all[notificationId] ?? this.createDefault(notificationId)
    existing.notes = notes
    existing.updatedAt = new Date().toISOString()
    all[notificationId] = existing
    this.store.set('triageData', all)
    return existing
  }

  /** Get the manual sort order */
  getSortOrder(): string[] {
    return this.store.get('sortOrder') as string[]
  }

  /** Set the manual sort order */
  setSortOrder(order: string[]): void {
    this.store.set('sortOrder', order)
  }

  private createDefault(notificationId: string): NotificationTriageData {
    return {
      notificationId,
      status: 'needs_triage',
      priority: 0,
      notes: '',
      updatedAt: new Date().toISOString()
    }
  }
}

let instance: TriageService | null = null

export function getTriageService(): TriageService {
  if (!instance) {
    instance = new TriageService()
  }
  return instance
}
