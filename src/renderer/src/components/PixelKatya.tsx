/**
 * PixelKatya — the Menagerie's 28×24 Samoyed portrait as a tiny canvas,
 * for use in regular app chrome (dashboard header, overlays).
 *
 * Wags her tail every couple of seconds; squints happily on hover.
 */
import { useEffect, useRef, useState } from 'react'
import {
  KATYA_PALETTE,
  KATYA_PORTRAIT,
  KATYA_PORTRAIT_HAPPY,
  KATYA_PORTRAIT_SIZE,
  drawGrid
} from '../windows/Menagerie/sprites'

interface PixelKatyaProps {
  /** Rendered height in px; width follows the sprite aspect ratio */
  size?: number
  /** Extra CSS classes */
  className?: string
  /** Pause the tail wag (also honoured automatically for reduced motion) */
  still?: boolean
}

const SCALE = 4

export function PixelKatya({
  size = 44,
  className = '',
  still = false
}: PixelKatyaProps): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  const [frame, setFrame] = useState(0)
  const [happy, setHappy] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still || reduced) return
    const id = window.setInterval(() => setFrame((f) => (f + 1) % 2), 1800)
    return () => window.clearInterval(id)
  }, [still])

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const grid = (happy ? KATYA_PORTRAIT_HAPPY : KATYA_PORTRAIT)[frame]
    drawGrid(ctx, grid, KATYA_PALETTE, 0, 0, SCALE)
  }, [frame, happy])

  const width = Math.round((size * KATYA_PORTRAIT_SIZE.w) / KATYA_PORTRAIT_SIZE.h)

  return (
    <canvas
      ref={ref}
      width={KATYA_PORTRAIT_SIZE.w * SCALE}
      height={KATYA_PORTRAIT_SIZE.h * SCALE}
      style={{ width, height: size, imageRendering: 'pixelated' }}
      className={className}
      role="img"
      aria-label="Katya the Samoyed"
      onMouseEnter={() => setHappy(true)}
      onMouseLeave={() => setHappy(false)}
    />
  )
}
