import { useEffect, useRef, useState } from 'react'
import type { Critter, Yard } from '../../../../shared/types/menagerie'
import {
  ACTIVITY_DAYS,
  dayKey,
  HOUSE_UPGRADE_THRESHOLDS,
  houseLevel,
  shiftDay,
  STREAK_FLAME_DAYS
} from '../../../../shared/types/menagerie'
import { drawHouseUpgrades, drawNight, drawStreakFlame, housePalette } from './houseUpgrades'
import { HOUSE_H, HOUSE_W, type YardLayout } from './layout'
import { FONT, INK, PAPER, STATUS_COLOR, STATUS_LABEL, relativeTime, timeOfDay } from './format'
import { Btn, Row, Section } from './panel'
import { PermissionCard } from './PermissionCard'
import {
  COLLAR_COLORS,
  drawGrid,
  drawShadow,
  FLOWER,
  HOUSE,
  KITTEN_COATS,
  KITTEN_PORTRAIT,
  PORTRAIT_SIZE,
  PROP_PALETTE,
  PUPPY_COATS,
  PUPPY_PORTRAIT,
  QUESTION,
  TREE,
  ZZZ,
  gridSize,
  type Palette
} from './sprites'

interface Props {
  yard: Yard
  onClose: () => void
}

const UPGRADE_NAMES = [
  'Bare cottage',
  'Flower boxes',
  'Chimney & smoke',
  'Picket fence',
  'Side annex & lantern',
  'Fresh paint & lit windows',
  'Gable star'
]

// World-space scene for the close-up: a wide yard with the cottage centred
const SCENE_W = 120
const SCENE_H = 78
const HOUSE_X = Math.floor((SCENE_W - HOUSE_W) / 2)
const HOUSE_Y = 6

function sceneLayout(yard: Yard): YardLayout {
  return {
    repository: yard.repository,
    cell: { x: 0, y: 0, w: SCENE_W, h: SCENE_H },
    house: { x: HOUSE_X, y: HOUSE_Y },
    door: { x: HOUSE_X + HOUSE_W / 2, y: HOUSE_Y + HOUSE_H },
    roam: { x: 0, y: HOUSE_Y + HOUSE_H, w: SCENE_W, h: SCENE_H - HOUSE_Y - HOUSE_H },
    trees: [
      { x: 6, y: 14 },
      { x: SCENE_W - 18, y: 12 }
    ],
    flowers: [
      { x: 22, y: 60 },
      { x: SCENE_W - 28, y: 62 },
      { x: HOUSE_X - 10, y: 40 }
    ],
    neighborhood: yard.neighborhood ?? null,
    tint: -1,
    level: houseLevel(yard.completedTasks),
    completedTasks: yard.completedTasks,
    streak: yard.streak ?? 0
  }
}

function portraitPalette(c: Critter): Palette {
  const coats = c.species === 'puppy' ? PUPPY_COATS : KITTEN_COATS
  return { ...PROP_PALETTE, ...coats[c.coat % coats.length], c: COLLAR_COLORS[c.client] }
}

export function YardCloseUp({ yard, onClose }: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const yardRef = useRef(yard)
  const [focus, setFocus] = useState<string | null>(yard.critters[0]?.id ?? null)
  const focusRef = useRef(focus)
  useEffect(() => {
    yardRef.current = yard
    focusRef.current = focus
    if (focus && !yard.critters.some((c) => c.id === focus)) {
      setFocus(yard.critters[0]?.id ?? null)
    }
  }, [yard, focus])

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
      for (const sl of slots) {
        if (cx >= sl.x && cx <= sl.x + sl.w && cy >= sl.y && cy <= sl.y + sl.h) {
          setFocus(sl.id)
          return
        }
      }
    }
    canvas.addEventListener('click', onClick)

    const draw = (now: number): void => {
      if (now - lastTick > 450) {
        frame++
        lastTick = now
      }
      const y = yardRef.current
      const layout = sceneLayout(y)
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas.width / dpr
      const cssH = canvas.height / dpr

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = false

      view.scale = Math.max(3, Math.min(8, Math.floor(Math.min(cssW / SCENE_W, cssH / SCENE_H))))
      const s = view.scale
      view.offX = Math.floor((cssW - SCENE_W * s) / 2)
      view.offY = Math.floor((cssH - SCENE_H * s) / 2)

      // Sky gradient + grass
      ctx.fillStyle = '#7ec8f0'
      ctx.fillRect(0, 0, cssW, cssH)
      ctx.fillStyle = '#a9ddf7'
      ctx.fillRect(0, view.offY + 20 * s, cssW, 14 * s)
      ctx.fillStyle = '#3f8f4a'
      ctx.fillRect(0, view.offY + (HOUSE_Y + HOUSE_H - 2) * s, cssW, cssH)

      ctx.save()
      ctx.translate(view.offX, view.offY)

      ctx.fillStyle = '#357a3f'
      for (let ty = HOUSE_Y + HOUSE_H; ty < SCENE_H; ty += 6) {
        for (let tx = (ty / 6) % 2 === 0 ? 0 : 3; tx < SCENE_W; tx += 6) {
          ctx.fillRect((tx + 2) * s, (ty + 2) * s, s, s)
        }
      }
      // Path from the door
      ctx.fillStyle = '#c7b58a'
      ctx.fillRect((layout.door.x - 4) * s, layout.door.y * s, 8 * s, (SCENE_H - layout.door.y) * s)

      for (const t of layout.trees) drawGrid(ctx, TREE, PROP_PALETTE, t.x * s, t.y * s, s)
      drawGrid(ctx, HOUSE, housePalette(layout.level), HOUSE_X * s, HOUSE_Y * s, s)
      drawHouseUpgrades(ctx, layout, s, frame)
      drawStreakFlame(ctx, HOUSE_X, HOUSE_Y, layout.streak, s, frame)
      for (const f of layout.flowers) drawGrid(ctx, FLOWER, PROP_PALETTE, f.x * s, f.y * s, s)

      // Portraits lined up in front of the cottage
      slots.length = 0
      const critters = y.critters
      const { w: pw, h: ph } = PORTRAIT_SIZE
      const gap = 6
      const totalW = critters.length * pw + Math.max(0, critters.length - 1) * gap
      let px = Math.floor((SCENE_W - totalW) / 2)
      const py = SCENE_H - ph - 6
      critters.forEach((c, i) => {
        const frames = c.species === 'puppy' ? PUPPY_PORTRAIT : KITTEN_PORTRAIT
        const grid = frames[(frame + i) % frames.length]
        const bob = c.status === 'working' && (frame + i) % 2 === 0 ? 1 : 0
        const focused = c.id === focusRef.current
        const sx = px * s
        const sy = (py - bob) * s
        if (focused) {
          ctx.fillStyle = 'rgba(255,255,255,0.4)'
          ctx.beginPath()
          ctx.ellipse(sx + (pw / 2) * s, (py + ph - 1) * s, (pw / 2) * s, 3 * s, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        drawShadow(ctx, sx, py * s, pw, ph, s)
        drawGrid(ctx, grid, portraitPalette(c), sx, sy, s, i % 2 === 1)
        if (c.status === 'waiting' && frame % 4 < 3) {
          const q = gridSize(QUESTION)
          drawGrid(ctx, QUESTION, PROP_PALETTE, sx + ((pw - q.w) / 2) * s, sy - (q.h + 1) * s, s)
        } else if ((c.status === 'idle' || c.status === 'done') && frame % 6 < 4) {
          const zz = gridSize(ZZZ)
          drawGrid(ctx, ZZZ, PROP_PALETTE, sx + (pw - zz.w + 2) * s, sy - (zz.h + 1) * s, s)
        }
        slots.push({
          id: c.id,
          x: view.offX + sx,
          y: view.offY + sy,
          w: pw * s,
          h: ph * s
        })
        px += pw + gap
      })

      drawNight(
        ctx,
        timeOfDay().dark,
        [{ x: HOUSE_X, y: HOUSE_Y, level: layout.level }],
        SCENE_W,
        SCENE_H,
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
    }
  }, [])

  const level = houseLevel(yard.completedTasks)
  const next = HOUSE_UPGRADE_THRESHOLDS[level]
  const prev = level === 0 ? 0 : HOUSE_UPGRADE_THRESHOLDS[level - 1]
  const progress = next ? (yard.completedTasks - prev) / (next - prev) : 1
  const repoShort = yard.repository.split('/').pop() ?? yard.repository
  const focused = yard.critters.find((c) => c.id === focus) ?? null

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
          {yard.critters.length} critter{yard.critters.length === 1 ? '' : 's'} · click one for
          details
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
        <div style={{ fontSize: 14, fontWeight: 700 }} title={yard.repository}>
          🏠 {repoShort}
        </div>
        <div style={{ opacity: 0.6, fontSize: 10, wordBreak: 'break-all' }}>{yard.repository}</div>
        {yard.neighborhood && (
          <div style={{ fontSize: 10, marginTop: 2 }} title="Part of a multi-repo project">
            ⌂ {yard.neighborhood} neighborhood
          </div>
        )}

        <Section title="Cottage">
          <div>
            Tier {level}/{HOUSE_UPGRADE_THRESHOLDS.length} · {UPGRADE_NAMES[level]}
          </div>
          <div
            style={{ marginTop: 4, height: 8, border: `2px solid ${INK}`, background: '#e8dfcc' }}
          >
            <div
              style={{
                width: `${Math.round(Math.min(1, progress) * 100)}%`,
                height: '100%',
                background: '#43c466'
              }}
            />
          </div>
          <div style={{ opacity: 0.7, marginTop: 2 }}>
            {yard.completedTasks} task{yard.completedTasks === 1 ? '' : 's'} finished
            {next
              ? ` · ${next - yard.completedTasks} more for ${UPGRADE_NAMES[level + 1].toLowerCase()}`
              : ' · fully upgraded!'}
          </div>
        </Section>

        <Section title="Activity">
          <Heatmap activity={yard.activity ?? {}} />
          <div style={{ opacity: 0.8, marginTop: 4 }}>
            {(yard.streak ?? 0) >= STREAK_FLAME_DAYS ? '🔥 ' : ''}
            {yard.streak ?? 0}-day streak · last 8 weeks
          </div>
        </Section>

        <Section title="Residents">
          {yard.critters.map((c) => (
            <button
              key={c.id}
              onClick={() => setFocus(c.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                textAlign: 'left',
                background: c.id === focus ? '#ffe066' : 'transparent',
                border: `2px solid ${c.id === focus ? INK : 'transparent'}`,
                padding: '3px 6px',
                fontFamily: FONT,
                fontSize: 11,
                color: INK,
                cursor: 'pointer'
              }}
            >
              <span>{c.species === 'puppy' ? '🐶' : '🐱'}</span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: STATUS_COLOR[c.status],
                  border: `1px solid ${INK}`,
                  flexShrink: 0
                }}
              />
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {c.name}
              </span>
            </button>
          ))}
        </Section>

        {focused && <CritterDetails critter={focused} />}
      </aside>
    </div>
  )
}

function CritterDetails({ critter }: { critter: Critter }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = async (): Promise<void> => {
    await window.api.menagerie.copyId(critter.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <Section title="Session">
      <div style={{ fontWeight: 700, fontSize: 12 }}>{critter.name}</div>
      <Row label="Status">
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            background: STATUS_COLOR[critter.status],
            border: `1px solid ${INK}`,
            marginRight: 4
          }}
        />
        {STATUS_LABEL[critter.status]}
      </Row>
      <Row label="Last seen">
        {relativeTime(critter.lastActivityAt)} · {new Date(critter.lastActivityAt).toLocaleString()}
      </Row>
      {critter.branch && <Row label="Branch">🌿 {critter.branch}</Row>}
      <Row label="Client">
        {critter.client}
        {critter.pid ? ` (pid ${critter.pid})` : ''}
      </Row>
      {critter.cwd && (
        <Row label="Folder">
          <span style={{ wordBreak: 'break-all' }}>{critter.cwd}</span>
        </Row>
      )}
      <Row label="Session id">
        <span style={{ wordBreak: 'break-all', opacity: 0.7 }}>{critter.id}</span>
      </Row>
      {critter.pendingPermission && (
        <PermissionCard
          permission={critter.pendingPermission}
          onOpen={() => void window.api.menagerie.openSession(critter.id)}
        />
      )}
      {critter.currentTool && (
        <Row label="Doing now">
          <span>{critter.currentTool}</span>
        </Row>
      )}
      {critter.subagents > 0 && (
        <Row label="Sub-agents">
          <span>
            {'🐱'.repeat(Math.min(critter.subagents, 6))} {critter.subagents} running
          </span>
        </Row>
      )}
      {critter.lastActivity && !critter.currentTool && (
        <div style={{ marginTop: 6, fontStyle: 'italic', opacity: 0.8 }}>
          “{critter.lastActivity}”
        </div>
      )}
      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Btn onClick={() => void window.api.menagerie.openSession(critter.id)}>Open session</Btn>
        <Btn
          onClick={() => critter.cwd && void window.api.menagerie.reveal(critter.cwd)}
          disabled={!critter.cwd}
        >
          Reveal in Finder
        </Btn>
        <Btn onClick={() => void copy()}>{copied ? 'Copied!' : 'Copy session ID'}</Btn>
      </div>
    </Section>
  )
}

/** GitHub-style 8-week grid of turns per day, newest column on the right. */
function Heatmap({ activity }: { activity: Record<string, number> }): React.JSX.Element {
  const today = dayKey(new Date())
  const weeks = ACTIVITY_DAYS / 7
  const dow = new Date().getDay()
  const max = Math.max(1, ...Object.values(activity))
  const cells: { key: string; n: number }[] = []
  // Pad so columns align to weeks ending today
  for (let i = ACTIVITY_DAYS - 1 + (6 - dow); i >= -(6 - dow); i--) {
    const key = shiftDay(today, -i)
    cells.push({ key, n: i < 0 ? -1 : (activity[key] ?? 0) })
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'repeat(7, 8px)',
        gridAutoFlow: 'column',
        gridAutoColumns: '8px',
        gap: 2,
        marginTop: 2
      }}
      title={`${weeks} weeks of activity`}
    >
      {cells.map((c) => (
        <div
          key={c.key}
          title={c.n >= 0 ? `${c.key}: ${c.n} turn${c.n === 1 ? '' : 's'}` : ''}
          style={{
            width: 8,
            height: 8,
            background:
              c.n < 0
                ? 'transparent'
                : c.n === 0
                  ? '#e8dfcc'
                  : `rgba(67,196,102,${(0.35 + 0.65 * (c.n / max)).toFixed(2)})`,
            border: c.n < 0 ? 'none' : `1px solid ${INK}`
          }}
        />
      ))}
    </div>
  )
}
