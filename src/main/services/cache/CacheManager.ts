/**
 * CacheManager
 *
 * Persistent cache using electron-store.
 * Provides offline fallback data and reduces API calls.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ElectronStore = require('electron-store')
import logger from '../../utils/logger'

interface CacheEntry<T = unknown> {
  data: T
  timestamp: number
}

const DEFAULT_MAX_AGE = 5 * 60 * 1000 // 5 minutes

const cacheStore = new (ElectronStore.default || ElectronStore)({
  name: 'cache',
  defaults: {},
})

export class CacheManager {
  /**
   * Store data in the cache.
   */
  set<T>(key: string, data: T): void {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() }
    cacheStore.set(key, entry)
    logger.debug(`[Cache] Set: ${key}`)
  }

  /**
   * Retrieve cached data if not expired.
   * @param key Cache key
   * @param maxAge Max age in ms (default 5 min)
   * @returns Cached data or null if expired/missing
   */
  get<T>(key: string, maxAge: number = DEFAULT_MAX_AGE): T | null {
    const entry = cacheStore.get(key) as CacheEntry<T> | undefined
    if (!entry) return null

    if (Date.now() - entry.timestamp > maxAge) {
      logger.debug(`[Cache] Expired: ${key}`)
      return null
    }

    logger.debug(`[Cache] Hit: ${key}`)
    return entry.data
  }

  /**
   * Get cached data regardless of age (for offline fallback).
   */
  getStale<T>(key: string): T | null {
    const entry = cacheStore.get(key) as CacheEntry<T> | undefined
    return entry?.data ?? null
  }

  /**
   * Remove a cache entry.
   */
  remove(key: string): void {
    cacheStore.delete(key)
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    cacheStore.clear()
    logger.info('[Cache] Cleared')
  }
}

// Singleton
let instance: CacheManager | null = null

export function getCacheManager(): CacheManager {
  if (!instance) {
    instance = new CacheManager()
  }
  return instance
}
