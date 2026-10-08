import { useEffect, useLayoutEffect, useRef } from 'react'
import { FONT, INK, timeOfDay } from './format'
import { drawNight } from './houseUpgrades'
import {
  HEART,
  PROP_PALETTE,
  drawGrid,
  drawShadow,
  gridSize,
  type Grid,
  type Palette
} from './sprites'

/** Scene the managers' close-ups are drawn in, in scene pixels; the pet stands front and centre */
export const SCENE_W = 120
export const SCENE_H = 78

/** Maps scene pixels onto the canvas: x_canvas = offX + x_scene * s */
export interface SceneView {
  s: number
  offX: number
  offY: number
  cssW: number
  cssH: number
}

interface Props {
  /** Idle animation (tail up, tail down): sways slowly, and quickly while petted */
  frames: Grid[]
  /** The same frames with happy eyes, shown while being petted */
  happyFrames: Grid[]
  palette: Palette
  size: { w: number; h: number }
  /** What a click makes her say, one picked at random */
  sounds: readonly string[]
  /** Little bubble beside her while she's being stroked, e.g. a purr */
  purr?: string
  /** Paints everything behind the pet, in canvas pixels; leave the context as you found it */
  drawBackdrop: (ctx: CanvasRenderingContext2D, view: SceneView) => void
  /** Tip shown in the top-right corner */
  hint: string
  onClose: () => void
  /** Called for every stroke's worth of petting */
  onPet: () => void
  /** Called when a click makes her speak */
  onSound: () => void
}

interface Heart {
  x: number
  y: number
  vx: number
  born: number
}

interface Bubble {
  text: string
  born: number
}

/**
 * The picture half of a manager's close-up. Drag over her to pet her (hearts
 * float up and her tail goes faster); click her and she speaks with a hop.
 * The parent supplies the backdrop and its own side panel.
 */
export function PetScene(props: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef(props)
  useLayoutEffect(() => {
    propsRef.current = props
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let frame = 0
    let lastTick = 0
    const view = { scale: 4, offX: 0, offY: 0 }
    const hearts: Heart[] = []
    let bubble: Bubble | null = null
    let lastPetAt = 0
    let lastHeartAt = 0
    let hop = 0
    let strokeDistance = 0
    let lastStroke: { x: number; y: number } | null = null
    let pressed = false

    const spot = (): { x: number; y: number; w: number; h: number } => {
      const { w, h } = propsRef.current.size
      return { x: Math.floor((SCENE_W - w) / 2), y: SCENE_H - h - 6, w, h }
    }

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const overPet = (e: MouseEvent): boolean => {
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const s = view.scale
      const p = spot()
      const x0 = view.offX + p.x * s
      const y0 = view.offY + p.y * s
      return cx >= x0 && cx <= x0 + p.w * s && cy >= y0 && cy <= y0 + p.h * s
    }

    const spawnHeart = (now: number): void => {
      if (now - lastHeartAt < 160) return
      lastHeartAt = now
      const p = spot()
      hearts.push({
        x: p.x + 4 + Math.random() * (p.w - 8),
        y: p.y - 2,
        vx: (Math.random() - 0.5) * 6,
        born: now
      })
    }

    const onDown = (e: MouseEvent): void => {
      if (e.button !== 0) return
      pressed = true
      strokeDistance = 0
      lastStroke = { x: e.clientX, y: e.clientY }
    }
    const onUp = (e: MouseEvent): void => {
      if (!pressed) return
      pressed = false
      // A click with hardly any movement makes her speak; a stroke is a pet.
      if (strokeDistance < 6 && overPet(e)) {
        const { sounds, onSound } = propsRef.current
        bubble = {
          text: sounds[Math.floor(Math.random() * sounds.length)],
          born: performance.now()
        }
        hop = 3
        onSound()
      }
      lastStroke = null
    }
    const onMove = (e: MouseEvent): void => {
      const over = overPet(e)
      canvas.style.cursor = over ? (pressed ? 'grabbing' : 'grab') : 'default'
      if (!pressed || !lastStroke) return
      const d = Math.hypot(e.clientX - lastStroke.x, e.clientY - lastStroke.y)
      strokeDistance += d
      lastStroke = { x: e.clientX, y: e.clientY }
      if (over && d > 0) {
        const now = performance.now()
        lastPetAt = now
        spawnHeart(now)
        // Count one "pet" per ~40px of stroking so the counter feels earned
        if (strokeDistance > 40) {
          strokeDistance -= 40
          propsRef.current.onPet()
        }
      }
    }
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    canvas.addEventListener('mousemove', onMove)

    const speechBubble = (text: string, bx: number, by: number, s: number): void => {
      const pad = s
      const tw = ctx.measureText(text).width
      ctx.fillStyle = '#0f0e1c'
      ctx.fillRect(bx - 1, by - 1, tw + pad * 2 + 2, 5 * s + 2)
      ctx.fillStyle = '#fffaf0'
      ctx.fillRect(bx, by, tw + pad * 2, 5 * s)
      ctx.fillStyle = INK
      ctx.fillText(text, bx + pad, by + 2.5 * s)
    }

    const draw = (now: number): void => {
      const { frames, happyFrames, palette, purr, drawBackdrop } = propsRef.current
      const petting = now - lastPetAt < 350
      const tickMs = petting ? 120 : 450
      if (now - lastTick > tickMs) {
        frame++
        lastTick = now
        if (hop > 0) hop--
      }
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas.width / dpr
      const cssH = canvas.height / dpr

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = false

      view.scale = Math.max(3, Math.min(8, Math.floor(Math.min(cssW / SCENE_W, cssH / SCENE_H))))
      const s = view.scale
      view.offX = Math.floor((cssW - SCENE_W * s) / 2)
      view.offY = Math.floor((cssH - SCENE_H * s) / 2)

      drawBackdrop(ctx, { s, offX: view.offX, offY: view.offY, cssW, cssH })

      ctx.save()
      ctx.translate(view.offX, view.offY)

      // The pet herself
      const p = spot()
      const set = petting ? happyFrames : frames
      const sway = petting ? frame % 2 : frame % 6 < 3 ? 0 : 1
      const grid = set[sway % set.length]
      const py = p.y - (hop > 0 ? 2 : 0)
      drawShadow(ctx, p.x * s, p.y * s, p.w, p.h, s)
      drawGrid(ctx, grid, palette, p.x * s, py * s, s)

      // Hearts drift up and fade
      const hs = gridSize(HEART)
      for (let i = hearts.length - 1; i >= 0; i--) {
        const h = hearts[i]
        const age = (now - h.born) / 1000
        if (age > 1.4) {
          hearts.splice(i, 1)
          continue
        }
        ctx.globalAlpha = Math.max(0, 1 - age / 1.4)
        drawGrid(
          ctx,
          HEART,
          PROP_PALETTE,
          Math.round(h.x + h.vx * age) * s,
          Math.round(h.y - age * 14) * s - hs.h * s,
          s
        )
        ctx.globalAlpha = 1
      }

      ctx.textBaseline = 'middle'
      // What she said, to her right
      if (bubble) {
        if (now - bubble.born > 900) bubble = null
        else {
          ctx.font = `700 ${Math.max(10, 3 * s)}px ${FONT}`
          speechBubble(bubble.text, (p.x + p.w + 2) * s, (p.y + 4) * s, s)
        }
      }
      // A purr to her left while she's being stroked
      if (purr && petting) {
        ctx.font = `italic ${Math.max(10, 3 * s)}px ${FONT}`
        const tw = ctx.measureText(purr).width
        speechBubble(purr, (p.x - 2) * s - tw - s * 2, (p.y + 8) * s, s)
      }

      drawNight(
        ctx,
        timeOfDay().dark,
        [],
        { x: -view.offX, y: -view.offY, w: cssW, h: cssH },
        s,
        frame
      )

      ctx.restore()
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('mousemove', onMove)
    }
  }, [])

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }}
      />
      <button
        onClick={props.onClose}
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: '#ffe066',
          color: INK,
          border: '2px solid #0f0e1c',
          boxShadow: '2px 2px 0 #0f0e1c',
          padding: '4px 10px',
          fontFamily: FONT,
          fontSize: 11,
          cursor: 'pointer'
        }}
      >
        ← Back to village
      </button>
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'rgba(20,16,10,0.65)',
          color: '#fff4d6',
          padding: '4px 8px',
          fontFamily: FONT,
          fontSize: 11
        }}
      >
        {props.hint}
      </div>
    </div>
  )
}
