/**
 * SamoyedMascot — inline SVG mascot component
 *
 * A happy little Samoyed that can appear at different sizes
 * and optionally bounce when triggered.
 */

interface SamoyedMascotProps {
  /** Width/height in px (square) */
  size?: number
  /** Add the mascot-bounce animation class */
  bounce?: boolean
  /** Extra CSS classes */
  className?: string
}

export function SamoyedMascot({
  size = 40,
  bounce = false,
  className = '',
}: SamoyedMascotProps): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="80 100 350 340"
      width={size}
      height={size}
      className={`${bounce ? 'mascot-bounce' : ''} ${className}`.trim()}
      role="img"
      aria-label="Samoyed mascot"
    >
      <defs>
        <radialGradient id="m-fur" cx="50%" cy="35%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f0f0f0" />
          <stop offset="100%" stopColor="#e0e0e5" />
        </radialGradient>
        <radialGradient id="m-nose" cx="45%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#3a3a3a" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </radialGradient>
        <radialGradient id="m-blush" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(251,191,36,0.18)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id="m-ear" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(167,139,250,0.15)" />
          <stop offset="50%" stopColor="rgba(52,211,153,0.1)" />
          <stop offset="100%" stopColor="rgba(96,165,250,0.15)" />
        </linearGradient>
      </defs>

      {/* Body / chest */}
      <ellipse cx="256" cy="410" rx="130" ry="80" fill="#f5f5f5" opacity="0.9" />

      {/* Left ear */}
      <ellipse cx="175" cy="160" rx="48" ry="62" fill="url(#m-fur)" transform="rotate(-12 175 160)" />
      <ellipse cx="175" cy="160" rx="35" ry="45" fill="url(#m-ear)" transform="rotate(-12 175 160)" />

      {/* Right ear */}
      <ellipse cx="337" cy="160" rx="48" ry="62" fill="url(#m-fur)" transform="rotate(12 337 160)" />
      <ellipse cx="337" cy="160" rx="35" ry="45" fill="url(#m-ear)" transform="rotate(12 337 160)" />

      {/* Head */}
      <circle cx="256" cy="260" r="130" fill="url(#m-fur)" />

      {/* Cheek fur */}
      <ellipse cx="160" cy="290" rx="55" ry="50" fill="#f8f8f8" />
      <ellipse cx="352" cy="290" rx="55" ry="50" fill="#f8f8f8" />

      {/* Forehead tuft */}
      <ellipse cx="256" cy="155" rx="60" ry="30" fill="#fafafa" />

      {/* Eyes */}
      <ellipse cx="215" cy="245" rx="16" ry="17" fill="#1a1a1a" />
      <circle cx="210" cy="240" r="5" fill="rgba(255,255,255,0.85)" />
      <circle cx="220" cy="248" r="2.5" fill="rgba(255,255,255,0.5)" />

      <ellipse cx="297" cy="245" rx="16" ry="17" fill="#1a1a1a" />
      <circle cx="292" cy="240" r="5" fill="rgba(255,255,255,0.85)" />
      <circle cx="302" cy="248" r="2.5" fill="rgba(255,255,255,0.5)" />

      {/* Snout */}
      <ellipse cx="256" cy="300" rx="52" ry="40" fill="#fefefe" />

      {/* Nose */}
      <ellipse cx="256" cy="286" rx="18" ry="13" fill="url(#m-nose)" />
      <ellipse cx="252" cy="283" rx="6" ry="4" fill="rgba(255,255,255,0.2)" />

      {/* Smile */}
      <path
        d="M 235 298 Q 245 316 256 308 Q 267 316 277 298"
        fill="none"
        stroke="#2a2a2a"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Tongue */}
      <ellipse cx="256" cy="314" rx="8" ry="10" fill="#f87171" opacity="0.8" />

      {/* Cheek blush */}
      <circle cx="192" cy="275" r="22" fill="url(#m-blush)" />
      <circle cx="320" cy="275" r="22" fill="url(#m-blush)" />
    </svg>
  )
}
