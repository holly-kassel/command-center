import { useEffect, useRef, useState } from 'react'
import type { Automation, Critter, MenagerieSnapshot } from '../../../../shared/types/menagerie'
import {
  allCritters,
  automationState,
  HOUSE_UPGRADE_THRESHOLDS,
  houseLevel
} from '../../../../shared/types/menagerie'
import {
  AUTOMATION_STATE_COLOR,
  FONT,
  INK,
  PAPER,
  STATUS_COLOR,
  STATUS_LABEL,
  automationStatusShort,
  relativeTime,
  timeOfDay
} from './format'
import { drawNight } from './houseUpgrades'
import { Btn, Row, Section } from './panel'
import { PermissionCard } from './PermissionCard'
import {
  FLOWER,
  FOUNTAIN,
  HEART,
  KATYA_PALETTE,
  KATYA_PORTRAIT,
  KATYA_PORTRAIT_HAPPY,
  KATYA_PORTRAIT_SIZE,
  PROP_PALETTE,
  TREE,
  decorationFor,
  drawGrid,
  drawShadow,
  gridSize
} from './sprites'

interface Props {
  snapshot: MenagerieSnapshot
  onClose: () => void
  onOpenSession: (id: string) => void
}

// World-space scene: the town square with Katya front and centre
const SCENE_W = 120
const SCENE_H = 78
const KATYA_X = Math.floor((SCENE_W - KATYA_PORTRAIT_SIZE.w) / 2)
const KATYA_Y = SCENE_H - KATYA_PORTRAIT_SIZE.h - 6
const PALETTE = { ...PROP_PALETTE, ...KATYA_PALETTE, c: '#f2a7b5' }
const BARKS = ['Woof!', 'Arf!', 'Boof!', 'Awoo!', 'Yip!']

interface Heart {
  x: number
  y: number
  vx: number
  born: number
}

interface Bark {
  text: string
  born: number
}

export function KatyaCloseUp({ snapshot, onClose, onOpenSession }: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pets, setPets] = useState(0)
  const [barks, setBarks] = useState(0)

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
    let bark: Bark | null = null
    let lastPetAt = 0
    let lastHeartAt = 0
    let hop = 0
    let strokeDistance = 0
    let lastStroke: { x: number; y: number } | null = null
    let pressed = false

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const overKatya = (e: MouseEvent): boolean => {
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const s = view.scale
      const x0 = view.offX + KATYA_X * s
      const y0 = view.offY + KATYA_Y * s
      return (
        cx >= x0 &&
        cx <= x0 + KATYA_PORTRAIT_SIZE.w * s &&
        cy >= y0 &&
        cy <= y0 + KATYA_PORTRAIT_SIZE.h * s
      )
    }

    const spawnHeart = (now: number): void => {
      if (now - lastHeartAt < 160) return
      lastHeartAt = now
      hearts.push({
        x: KATYA_X + 4 + Math.random() * (KATYA_PORTRAIT_SIZE.w - 8),
        y: KATYA_Y - 2,
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
      // A click with hardly any movement is a bark; a stroke is a pet.
      if (strokeDistance < 6 && overKatya(e)) {
        bark = { text: BARKS[Math.floor(Math.random() * BARKS.length)], born: performance.now() }
        hop = 3
        setBarks((n) => n + 1)
      }
      lastStroke = null
    }
    const onMove = (e: MouseEvent): void => {
      const over = overKatya(e)
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
          setPets((n) => n + 1)
        }
      }
    }
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    canvas.addEventListener('mousemove', onMove)

    const draw = (now: number): void => {
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

      // Sky + cobbled square
      ctx.fillStyle = '#7ec8f0'
      ctx.fillRect(0, 0, cssW, cssH)
      ctx.fillStyle = '#a9ddf7'
      ctx.fillRect(0, view.offY + 18 * s, cssW, 12 * s)
      ctx.fillStyle = '#3f8f4a'
      ctx.fillRect(0, view.offY + 30 * s, cssW, cssH)
      ctx.fillStyle = '#c7b58a'
      ctx.fillRect(0, view.offY + 40 * s, cssW, (SCENE_H - 40) * s)

      ctx.save()
      ctx.translate(view.offX, view.offY)

      ctx.fillStyle = '#b5a37a'
      for (let ty = 40; ty < SCENE_H; ty += 5) {
        for (let tx = (ty / 5) % 2 === 0 ? 0 : 3; tx < SCENE_W; tx += 6) {
          ctx.fillRect((tx + 1) * s, (ty + 2) * s, 2 * s, s)
        }
      }

      drawGrid(ctx, TREE, PROP_PALETTE, 6 * s, 14 * s, s)
      drawGrid(ctx, TREE, PROP_PALETTE, (SCENE_W - 18) * s, 12 * s, s)
      const fs = gridSize(FOUNTAIN)
      drawGrid(ctx, FOUNTAIN, PROP_PALETTE, ((SCENE_W - fs.w) / 2) * s, 28 * s, s)
      drawGrid(ctx, FLOWER, PROP_PALETTE, 22 * s, 34 * s, s)
      drawGrid(ctx, FLOWER, PROP_PALETTE, (SCENE_W - 28) * s, 36 * s, s)

      // Katya
      const frames = petting ? KATYA_PORTRAIT_HAPPY : KATYA_PORTRAIT
      const wag = petting ? frame % 2 : frame % 6 < 3 ? 0 : 1
      const grid = frames[wag]
      const ky = KATYA_Y - (hop > 0 ? 2 : 0)
      drawShadow(ctx, KATYA_X * s, KATYA_Y * s, KATYA_PORTRAIT_SIZE.w, KATYA_PORTRAIT_SIZE.h, s)
      drawGrid(ctx, grid, PALETTE, KATYA_X * s, ky * s, s)

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

      // Bark bubble
      if (bark) {
        const age = now - bark.born
        if (age > 900) bark = null
        else {
          ctx.font = `700 ${Math.max(10, 3 * s)}px ${FONT}`
          ctx.textBaseline = 'middle'
          const text = bark.text
          const tw = ctx.measureText(text).width
          const bx = (KATYA_X + KATYA_PORTRAIT_SIZE.w + 2) * s
          const by = (KATYA_Y + 4) * s
          const pad = s
          ctx.fillStyle = '#0f0e1c'
          ctx.fillRect(bx - 1, by - 1, tw + pad * 2 + 2, 5 * s + 2)
          ctx.fillStyle = '#fffaf0'
          ctx.fillRect(bx, by, tw + pad * 2, 5 * s)
          ctx.fillStyle = INK
          ctx.fillText(text, bx + pad, by + 2.5 * s)
        }
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

  const { counts, yards, warnings, neighborhoods, automations } = snapshot
  const totalTasks = yards.reduce((n, y) => n + y.completedTasks, 0)
  const upgraded = yards.filter((y) => houseLevel(y.completedTasks) >= 1).length
  const maxed = yards.filter(
    (y) => houseLevel(y.completedTasks) >= HOUSE_UPGRADE_THRESHOLDS.length
  ).length
  // Automation runs live in the square, but they still wait on you like anyone else
  const critters = allCritters(snapshot)
  // Longest-waiting first — Katya herds you to whoever has been patient the longest.
  const needsYou = critters
    .filter((c) => c.status === 'waiting')
    .sort(
      (a, b) =>
        Date.parse(a.pendingPermission?.requestedAt ?? a.lastActivityAt) -
        Date.parse(b.pendingPermission?.requestedAt ?? b.lastActivityAt)
    )
  const busiest = [...yards].sort((a, b) => b.critters.length - a.critters.length)[0]
  const mood =
    needsYou.length > 0
      ? `${needsYou.length} critter${needsYou.length === 1 ? ' is' : 's are'} waiting on you — Katya is herding you that way.`
      : counts.working > 0
        ? 'Everyone is busy. Katya is keeping watch from the square.'
        : 'Quiet village. Katya is napping by the fountain.'

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
          click Katya to make her bark · drag over her to pet
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
        <div style={{ fontSize: 14, fontWeight: 700 }}>🐾 Katya&apos;s town report</div>
        <div style={{ opacity: 0.6, fontSize: 10 }}>as of {relativeTime(snapshot.generatedAt)}</div>
        <div style={{ marginTop: 6, fontStyle: 'italic' }}>{mood}</div>

        <Section title="Critters">
          {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((st) => (
            <Row key={st} label={STATUS_LABEL[st]}>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  background: STATUS_COLOR[st],
                  border: `1px solid ${INK}`,
                  marginRight: 4
                }}
              />
              <strong>{counts[st]}</strong>
            </Row>
          ))}
        </Section>

        <Section title="Village">
          <Row label="Yards">{yards.length}</Row>
          <Row label="Tasks done">{totalTasks} since you started watching</Row>
          <Row label="Cottages">
            {upgraded} upgraded · {maxed} fully built
          </Row>
          {busiest && (
            <Row label="Busiest">
              {busiest.repository.split('/').pop()} ({busiest.critters.length})
            </Row>
          )}
        </Section>

        {neighborhoods.length > 0 && (
          <Section title="Neighborhoods">
            {neighborhoods.map((n) => {
              const members = yards.filter((y) => y.neighborhood === n.name)
              const live = members.reduce((acc, y) => acc + y.critters.length, 0)
              return (
                <Row key={n.name} label={`⌂ ${n.name}`}>
                  {members.length} yard{members.length === 1 ? '' : 's'} · {live} critter
                  {live === 1 ? '' : 's'}
                  {n.source === 'collection' ? ' · from a Copilot collection' : ''}
                </Row>
              )
            })}
          </Section>
        )}

        {needsYou.length > 0 && (
          <Section title="Needs you">
            {needsYou.map((c) => (
              <NeedsYouRow key={c.id} critter={c} onOpen={() => onOpenSession(c.id)} />
            ))}
          </Section>
        )}

        {automations.length > 0 && (
          <Section title="Town square automations">
            {automations.map((a, i) => (
              <AutomationRow
                key={a.id}
                automation={a}
                index={i}
                onOpen={(id) => onOpenSession(id)}
              />
            ))}
          </Section>
        )}

        {warnings.length > 0 && (
          <Section title="Warnings">
            {warnings.map((w, i) => (
              <div key={i} style={{ color: '#8a5a00' }}>
                ⚠ {w}
              </div>
            ))}
          </Section>
        )}

        <Section title="Katya">
          <Row label="Pets">{pets === 0 ? 'none yet — she\u2019s waiting' : pets}</Row>
          <Row label="Barks">{barks}</Row>
          <div style={{ marginTop: 6, opacity: 0.7 }}>
            Samoyed · Mayor of the Menagerie · likes belly rubs and finished tasks
          </div>
        </Section>
      </aside>
    </div>
  )
}

function AutomationRow({
  automation: a,
  index,
  onOpen
}: {
  automation: Automation
  index: number
  onOpen: (sessionId: string) => void
}): React.JSX.Element {
  const latest = a.lastRun?.sessionId ?? a.runs[0]?.id ?? null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
      <span>{decorationFor(index).sprite.icon}</span>
      <span
        style={{
          width: 8,
          height: 8,
          flexShrink: 0,
          background: AUTOMATION_STATE_COLOR[automationState(a)],
          border: `1px solid ${INK}`
        }}
      />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        title={`${a.name} · ${a.schedule}`}
      >
        {a.name} <span style={{ opacity: 0.6 }}>· {automationStatusShort(a)}</span>
      </span>
      {latest && (
        <span style={{ flexShrink: 0 }}>
          <Btn onClick={() => onOpen(latest)}>Last run</Btn>
        </span>
      )}
    </div>
  )
}

function NeedsYouRow({
  critter,
  onOpen
}: {
  critter: Critter
  onOpen: () => void
}): React.JSX.Element {
  const repoShort = critter.repository.split('/').pop() ?? critter.repository
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{critter.species === 'puppy' ? '🐶' : '🐱'}</span>
        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={critter.name}
        >
          {critter.name} <span style={{ opacity: 0.6 }}>· {repoShort}</span>
        </span>
        {!critter.pendingPermission && <Btn onClick={onOpen}>Open</Btn>}
      </div>
      {critter.pendingPermission && (
        <PermissionCard permission={critter.pendingPermission} compact onOpen={onOpen} />
      )}
    </div>
  )
}
