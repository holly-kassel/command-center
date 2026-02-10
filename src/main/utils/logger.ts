/**
 * Logger
 *
 * Centralized logging via electron-log.
 * Writes to console + file (~Library/Logs/command-center/).
 */
import log from 'electron-log'

// Configure log levels & file transport
log.transports.file.level = 'info'
log.transports.console.level = 'debug'
log.transports.file.maxSize = 5 * 1024 * 1024 // 5 MB

// Export namespaced logger
export const logger = {
  info: (...args: unknown[]): void => log.info(...args),
  warn: (...args: unknown[]): void => log.warn(...args),
  error: (...args: unknown[]): void => log.error(...args),
  debug: (...args: unknown[]): void => log.debug(...args),
}

export default logger
