/**
 * Skeleton
 *
 * Animated loading placeholder for content that's still fetching.
 * Use to prevent layout shift while data loads.
 */

interface SkeletonProps {
  /** Number of skeleton rows */
  lines?: number
  /** Additional class names */
  className?: string
}

export function Skeleton({ lines = 3, className = '' }: SkeletonProps): React.ReactElement {
  return (
    <div className={`space-y-2.5 animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-full bg-surface-muted/60"
          style={{ width: `${75 + Math.random() * 25}%` }}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }: { className?: string }): React.ReactElement {
  return (
    <div className={`card animate-pulse space-y-3 ${className}`}>
      <div className="h-4 w-32 rounded bg-surface-muted/60" />
      <Skeleton lines={3} />
    </div>
  )
}
