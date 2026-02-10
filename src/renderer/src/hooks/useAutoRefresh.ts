/**
 * useAutoRefresh Hook
 *
 * Calls a callback immediately, then on a recurring interval.
 * Cleans up on unmount.
 */
import { useEffect, useRef } from 'react'

export function useAutoRefresh(callback: () => void, intervalMs: number): void {
  const savedCallback = useRef(callback)

  // Keep the latest callback ref fresh
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    // Call immediately
    savedCallback.current()

    const id = setInterval(() => {
      savedCallback.current()
    }, intervalMs)

    return () => clearInterval(id)
  }, [intervalMs])
}
