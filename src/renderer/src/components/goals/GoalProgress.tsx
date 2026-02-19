/**
 * GoalProgress Component
 *
 * Circular progress ring (SVG donut) showing goal completion percentage.
 */
interface GoalProgressProps {
  progress: number
  size?: number
  strokeWidth?: number
  className?: string
}

export function GoalProgress({
  progress,
  size = 40,
  strokeWidth = 4,
  className = '',
}: GoalProgressProps): React.ReactElement {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const filled = (progress / 100) * circumference
  const remaining = circumference - filled
  const clamped = Math.min(100, Math.max(0, progress))

  // Color based on progress
  const color =
    clamped >= 100
      ? 'stroke-green-400'
      : clamped >= 60
        ? 'stroke-focus'
        : clamped >= 30
          ? 'stroke-warning'
          : 'stroke-text-muted'

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-surface-muted/30"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filled} ${remaining}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      </svg>
      <span className="absolute text-[10px] font-semibold text-text-secondary">
        {Math.round(clamped)}
      </span>
    </div>
  )
}
