import { useEffect, useRef, useState } from 'react'
import type { Critter, CritterStatus, Yard } from '../../../../shared/types/menagerie'
import { isNapping } from '../../../../shared/types/menagerie'
import { CritterDetails } from './CritterDetails'
import { FONT, INK, PAPER, relativeTime, timeOfDay } from './format'
import { drawNight } from './houseUpgrades'
import { Section } from './panel'
import { critterPalette } from './townProps'
import {
  CAT_TREE,
  CAT_TREE_PALETTE,
  DOG_HOUSE,
  FLOWER,
  KITTEN,
  PROP_PALETTE,
  PUPPY,
  TREE,
  ZZZ,
  drawGrid,
  drawShadow,
  gridSize
} from './sprites'

interface Props {
  yard: Yard
  onClose: () => void
}

// World-space scene: the back of the yard, cat tree and dog house side by side
// (same order as in the village, cat tree nearest the cottage)
const SCENE_W = 120
const SCENE_H = 78
const GROUND = 41
const CAT = gridSize(CAT_TREE)
const DOG = gridSize(DOG_HOUSE)
const CAT_POS = { x: 22, y: GROUND - CAT.h }
const DOG_POS = { x: 74, y: GROUND - DOG.h }
/** Sleeping sprites are 12×12 with their body in rows 5–11 */
const SLEEPER = 12
const GRASS_COLS = 4
const GRASS_ROWS = [42, 53, 64]

const GROUPS: { status: CritterStatus; title: string }[] = [
  { status: 'idle', title: 'Idle · waiting on your next message' },
  { status: 'recent', title: 'Closed · no process running' },
  { status: 'done', title: 'Finished' }
]

/** Where the i-th napping kitten or puppy sleeps: the perch / doorway first, then the grass */
function sleeperSpot(species: Critter['species'], i: number): { x: number; y: number } | null {
  if (i === 0) {
    return species === 'kitten'
      ? { x: CAT_POS.x, y: CAT_POS.y - 11 }
      : { x: DOG_POS.x + 2, y: DOG_POS.y + 4 }
  }
  const slot = i - 1
  const row = Math.floor(slot / GRASS_COLS)
  if (row >= GRASS_ROWS.length) return null
  const x0 = species === 'kitten' ? 4 : 62
  return { x: x0 + (slot % GRASS_COLS) * 14, y: GRASS_ROWS[row] }
}

export function NapCloseUp({ yard, onClose }: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nappers = yard.critters.filter((c) => isNapping(c.status))
  const awake = yard.critters.length - nappers.length
  const nappersRef = useRef(nappers)
  const [picked, setFocus] = useState<string | null>(null)
  // Fall back to the first napper when nothing (or someone who woke up) is picked
  const focus = nappers.some((c) => c.id === picked) ? picked : (nappers[0]?.id ?? null)
  const focusRef = useRef(focus)
  useEffect(() => {
    nappersRef.current = nappers
    focusRef.current = focus
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let frame = 0
    let lastTick = 0
    const slots: { id: string; x: number; y: number; w: number; h: number }[] = []
    const view = { scale: 4, offX: 0, offY: 0 }

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const onClick = (e: MouseEvent): void => {
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const hit = slots.find(
        (sl) => cx >= sl.x && cx <= sl.x + sl.w && cy >= sl.y && cy <= sl.y + sl.h
      )
      if (hit) setFocus(hit.id)
    }
    const onMove = (e: MouseEvent): void => {
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const over = slots.some(
        (sl) => cx >= sl.x && cx <= sl.x + sl.w && cy >= sl.y && cy <= sl.y + sl.h
      )
      canvas.style.cursor = over ? 'pointer' : 'default'
    }
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('mousemove', onMove)

    const draw = (now: number): void => {
      if (now - lastTick > 450) {
        frame++
        lastTick = now
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

      // Sky, then grass running behind a low back fence
      ctx.fillStyle = '#7ec8f0'
      ctx.fillRect(0, 0, cssW, cssH)
      ctx.fillStyle = '#a9ddf7'
      ctx.fillRect(0, view.offY + 12 * s, cssW, 12 * s)
      ctx.fillStyle = '#3f8f4a'
      ctx.fillRect(0, view.offY + 28 * s, cssW, cssH)

      ctx.save()
      ctx.translate(view.offX, view.offY)

      ctx.fillStyle = '#357a3f'
      for (let ty = 30; ty < SCENE_H; ty += 6) {
        for (let tx = (ty / 6) % 2 === 0 ? 0 : 3; tx < SCENE_W; tx += 6) {
          ctx.fillRect((tx + 2) * s, (ty + 2) * s, s, s)
        }
      }
      ctx.fillStyle = '#d9c9a0'
      ctx.fillRect(-view.offX, 26 * s, cssW, s)
      ctx.fillRect(-view.offX, 29 * s, cssW, s)
      for (let fx = -Math.ceil(view.offX / s / 6) * 6; fx < SCENE_W + view.offX / s; fx += 6) {
        ctx.fillRect(fx * s, 24 * s, s, 7 * s)
      }

      drawGrid(ctx, TREE, PROP_PALETTE, 2 * s, 12 * s, s)
      drawGrid(ctx, TREE, PROP_PALETTE, (SCENE_W - 14) * s, 10 * s, s)
      drawGrid(ctx, FLOWER, PROP_PALETTE, 50 * s, 34 * s, s)
      drawGrid(ctx, FLOWER, PROP_PALETTE, 60 * s, 37 * s, s)

      drawShadow(ctx, CAT_POS.x * s, CAT_POS.y * s, CAT.w, CAT.h, s)
      drawGrid(
        ctx,
        CAT_TREE,
        { ...PROP_PALETTE, ...CAT_TREE_PALETTE },
        CAT_POS.x * s,
        CAT_POS.y * s,
        s
      )
      drawShadow(ctx, DOG_POS.x * s, DOG_POS.y * s, DOG.w, DOG.h, s)
      drawGrid(ctx, DOG_HOUSE, PROP_PALETTE, DOG_POS.x * s, DOG_POS.y * s, s)

      // Everyone napping, curled up with a z each
      slots.length = 0
      const zs: { x: number; y: number; i: number }[] = []
      const overflow = { kitten: 0, puppy: 0 }
      const seen = { kitten: 0, puppy: 0 }
      nappersRef.current.forEach((c, i) => {
        const spot = sleeperSpot(c.species, seen[c.species]++)
        if (!spot) {
          overflow[c.species]++
          return
        }
        if (c.id === focusRef.current) {
          ctx.fillStyle = 'rgba(255,255,255,0.45)'
          ctx.beginPath()
          ctx.ellipse((spot.x + 6.5) * s, (spot.y + 11) * s, 7 * s, 2.5 * s, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        const sprite = c.species === 'puppy' ? PUPPY.sleep[0] : KITTEN.sleep[0]
        drawGrid(ctx, sprite, critterPalette(c), spot.x * s, spot.y * s, s, i % 2 === 1)
        zs.push({ x: spot.x + 8, y: spot.y - 1, i })
        slots.push({
          id: c.id,
          x: view.offX + (spot.x + 1) * s,
          y: view.offY + (spot.y + 4) * s,
          w: (SLEEPER - 1) * s,
          h: 8 * s
        })
      })
      for (const z of zs) {
        if ((frame + z.i) % 6 >= 4) continue
        const bob = (frame + z.i) % 4 < 2 ? 0 : 1
        drawGrid(ctx, ZZZ, PROP_PALETTE, z.x * s, (z.y - bob) * s, s)
      }
      ctx.font = `700 ${Math.max(10, 3 * s)}px ${FONT}`
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#fff4d6'
      if (overflow.kitten) ctx.fillText(`+${overflow.kitten} more`, 4 * s, (SCENE_H - 4) * s)
      if (overflow.puppy) ctx.fillText(`+${overflow.puppy} more`, 62 * s, (SCENE_H - 4) * s)

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
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('mousemove', onMove)
    }
  }, [])

  const repoShort = yard.repository.split('/').pop() ?? yard.repository
  const focused = nappers.find((c) => c.id === focus) ?? null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        background: '#1b1a2e',
        zIndex: 20
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }}
        />
        <button
          onClick={onClose}
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
          {nappers.length} napping · click one for details
        </div>
      </div>

      <aside
        style={{
          width: 300,
          flexShrink: 0,
          overflowY: 'auto',
          background: PAPER,
          color: INK,
          borderLeft: '3px solid #0f0e1c',
          padding: 12,
          fontFamily: FONT,
          fontSize: 11,
          lineHeight: 1.4
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700 }}>💤 Nap time</div>
        <div style={{ fontSize: 12, marginTop: 2 }} title={yard.repository}>
          🏠 {repoShort}
        </div>
        <div style={{ opacity: 0.7, fontSize: 10 }}>
          {nappers.length} napping
          {awake > 0 ? ` · ${awake} awake in the yard` : ''}
        </div>

        {nappers.length === 0 && (
          <div style={{ marginTop: 14, fontStyle: 'italic' }}>
            Everyone&apos;s awake. Nobody is napping in this yard right now.
          </div>
        )}

        {GROUPS.map(({ status, title }) => {
          const list = nappers.filter((c) => c.status === status)
          if (list.length === 0) return null
          return (
            <Section key={status} title={`${title} (${list.length})`}>
              {list.map((c) => (
                <NapperRow
                  key={c.id}
                  critter={c}
                  focused={c.id === focus}
                  onFocus={() => setFocus(c.id)}
                />
              ))}
            </Section>
          )
        })}

        {focused && <CritterDetails critter={focused} />}
      </aside>
    </div>
  )
}

function NapperRow({
  critter,
  focused,
  onFocus
}: {
  critter: Critter
  focused: boolean
  onFocus: () => void
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
      <button
        onClick={onFocus}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          textAlign: 'left',
          background: focused ? '#ffe066' : 'transparent',
          border: `2px solid ${focused ? INK : 'transparent'}`,
          padding: '3px 6px',
          fontFamily: FONT,
          fontSize: 11,
          color: INK,
          cursor: 'pointer'
        }}
      >
        <span>{critter.species === 'puppy' ? '🐶' : '🐱'}</span>
        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={critter.name}
        >
          {critter.name}
        </span>
        <span style={{ opacity: 0.6, flexShrink: 0 }}>{relativeTime(critter.lastActivityAt)}</span>
      </button>
      <button
        title="Open session"
        aria-label={`Open ${critter.name}`}
        onClick={() => void window.api.menagerie.openSession(critter.id)}
        style={{
          flexShrink: 0,
          background: '#ffe066',
          color: INK,
          border: `2px solid ${INK}`,
          boxShadow: `2px 2px 0 ${INK}`,
          padding: '1px 6px',
          fontFamily: FONT,
          fontSize: 11,
          cursor: 'pointer'
        }}
      >
        ↗
      </button>
    </div>
  )
}
