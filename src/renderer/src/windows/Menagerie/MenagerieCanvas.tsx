import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Automation, MenagerieSnapshot } from '../../../../shared/types/menagerie'
import {
  buildLayout,
  decorationRect,
  HOUSE_H,
  HOUSE_W,
  NEIGHBORHOOD_TINTS,
  villageScale,
  wildScenery,
  type Rect,
  type VillageLayout,
  type WildScenery
} from './layout'
import { drawHouseUpgrades, drawNight, drawStreakFlame, housePalette } from './houseUpgrades'
import { automationStatusShort, timeOfDay, truncate } from './format'
import { createSim, syncSim, tickSim, type SimState } from './sim'
import {
  critterPalette,
  drawDecoration,
  drawLabel,
  drawLampGlow,
  drawNapSpot,
  napHitRects,
  napLabelAnchor,
  napResidents,
  type NapResidents
} from './townProps'
import {
  drawGrid,
  CRITTER_SIZE,
  DECORATION_SIZE,
  drawShadow,
  FLOWER,
  FOUNTAIN,
  gridSize,
  HOUSE,
  KATYA,
  KATYA_PALETTE,
  KATYA_SIZE,
  KITTEN,
  LULU,
  LULU_PALETTE,
  LULU_SIZE,
  MINI_KITTEN,
  PROP_PALETTE,
  PUPPY,
  QUESTION,
  TREE,
  ZZZ,
  type Grid
} from './sprites'

export interface ScreenAnchor {
  /** CSS-pixel position of the critter's head centre within the canvas element */
  x: number
  y: number
}

interface Props {
  snapshot: MenagerieSnapshot | null
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Fired when a critter is clicked; opens its session */
  onOpen?: (id: string) => void
  /** Reports where the selected critter is on screen (for the speech bubble) */
  onAnchor: (anchor: ScreenAnchor | null) => void
  /** Fired when a cottage is clicked; opens the yard close-up */
  onZoom?: (repository: string) => void
  /** Called when Katya herself is clicked */
  onKatya?: () => void
  /** Called when Lulu, manager of the cats, is clicked */
  onLulu?: () => void
  /** Fired when a yard's dog house or cat tree is clicked; opens its nap list */
  onNap?: (repository: string) => void
  /** Automation whose decoration is selected (shows its bubble) */
  selectedAutomationId?: string | null
  /** Fired when a town-square decoration is clicked */
  onSelectAutomation?: (id: string) => void
  /** Reports where the selected decoration is on screen (for its bubble) */
  onAutomationAnchor?: (anchor: ScreenAnchor | null) => void
}

const SKY = '#1b1a2e'
const GRASS = '#3f8f4a'
const GRASS_DARK = '#357a3f'
const PATH = '#c7b58a'
const SQUARE = '#b9a67a'

function frameOf(frames: Grid[], frame: number): Grid {
  return frames[frame % frames.length]
}

function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
}

function decorationLabel(a: Automation): string {
  return `${truncate(a.name, 28)} · ${automationStatusShort(a)}`
}

export function MenagerieCanvas({
  snapshot,
  selectedId,
  onSelect,
  onOpen,
  onAnchor,
  onZoom,
  onKatya,
  onLulu,
  onNap,
  selectedAutomationId = null,
  onSelectAutomation,
  onAutomationAnchor
}: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<SimState>(createSim())
  const layoutRef = useRef<VillageLayout | null>(null)
  const selectedRef = useRef<string | null>(selectedId)
  const selectedAutomationRef = useRef<string | null>(selectedAutomationId)
  const onAnchorRef = useRef(onAnchor)
  const onOpenRef = useRef(onOpen)
  const onZoomRef = useRef(onZoom)
  const onKatyaRef = useRef(onKatya)
  const onLuluRef = useRef(onLulu)
  const onNapRef = useRef(onNap)
  const onSelectAutomationRef = useRef(onSelectAutomation)
  const onAutomationAnchorRef = useRef(onAutomationAnchor)
  useLayoutEffect(() => {
    selectedRef.current = selectedId
    selectedAutomationRef.current = selectedAutomationId
    onAnchorRef.current = onAnchor
    onOpenRef.current = onOpen
    onZoomRef.current = onZoom
    onKatyaRef.current = onKatya
    onLuluRef.current = onLulu
    onNapRef.current = onNap
    onSelectAutomationRef.current = onSelectAutomation
    onAutomationAnchorRef.current = onAutomationAnchor
  })

  const snapshotRef = useRef(snapshot)
  const aspectRef = useRef(1)
  const napsRef = useRef(new Map<string, NapResidents>())

  useEffect(() => {
    snapshotRef.current = snapshot
    if (!snapshot) return
    napsRef.current = napResidents(snapshot)
    const layout = buildLayout(snapshot.yards, aspectRef.current)
    layoutRef.current = layout
    syncSim(simRef.current, snapshot, layout)
  }, [snapshot])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let last = performance.now()
    let hover: string | null = null
    let hoverAutomation: string | null = null
    let hoverNap: string | null = null
    let hoverManager: 'katya' | 'lulu' | null = null
    let wild: { layout: VillageLayout; key: string; scenery: WildScenery } | null = null

    // offX/offY are the applied offsets; panX/panY are the user's scroll
    // position, only used when the village is bigger than the canvas.
    const view = { scale: 3, offX: 0, offY: 0, panX: 0, panY: 0 }

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      const aspect = rect.height > 0 ? rect.width / rect.height : 1
      aspectRef.current = aspect
      const snap = snapshotRef.current
      const current = layoutRef.current
      if (snap && current) {
        const next = buildLayout(snap.yards, aspect)
        if (next.cols !== current.cols) {
          layoutRef.current = next
          syncSim(simRef.current, snap, next)
        }
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const worldToScreen = (wx: number, wy: number): { x: number; y: number } => ({
      x: view.offX + wx * view.scale,
      y: view.offY + wy * view.scale
    })

    const hitTest = (cssX: number, cssY: number): string | null => {
      const sim = simRef.current
      let best: string | null = null
      for (const a of sim.actors.values()) {
        const p = worldToScreen(a.x, a.y)
        const w = CRITTER_SIZE.w * view.scale
        const h = CRITTER_SIZE.h * view.scale
        if (cssX >= p.x && cssX <= p.x + w && cssY >= p.y && cssY <= p.y + h) best = a.id
      }
      return best
    }

    const hitKatya = (cssX: number, cssY: number): boolean => {
      const k = simRef.current.katya
      const p = worldToScreen(k.x, k.y)
      const w = KATYA_SIZE.w * view.scale
      const h = KATYA_SIZE.h * view.scale
      return cssX >= p.x && cssX <= p.x + w && cssY >= p.y && cssY <= p.y + h
    }

    const hitLulu = (cssX: number, cssY: number): boolean => {
      const l = simRef.current.lulu
      const p = worldToScreen(l.x, l.y)
      const w = LULU_SIZE.w * view.scale
      const h = LULU_SIZE.h * view.scale
      return cssX >= p.x && cssX <= p.x + w && cssY >= p.y && cssY <= p.y + h
    }

    const hitHouse = (cssX: number, cssY: number): string | null => {
      const layout = layoutRef.current
      if (!layout) return null
      for (const yard of layout.yards) {
        const p = worldToScreen(yard.house.x, yard.house.y)
        const w = HOUSE_W * view.scale
        const h = (HOUSE_H + 4) * view.scale // include the sign
        if (cssX >= p.x && cssX <= p.x + w && cssY >= p.y && cssY <= p.y + h) return yard.repository
      }
      return null
    }

    const toWorld = (cssX: number, cssY: number): { x: number; y: number } => ({
      x: (cssX - view.offX) / view.scale,
      y: (cssY - view.offY) / view.scale
    })

    const hitNap = (cssX: number, cssY: number): string | null => {
      const layout = layoutRef.current
      if (!layout) return null
      const w = toWorld(cssX, cssY)
      for (const yard of layout.yards) {
        const residents = napsRef.current.get(yard.repository)
        if (residents && napHitRects(yard, residents).some((r) => inRect(r, w.x, w.y)))
          return yard.repository
      }
      return null
    }

    const hitAutomation = (cssX: number, cssY: number): string | null => {
      const layout = layoutRef.current
      const automations = snapshotRef.current?.automations ?? []
      if (!layout) return null
      const w = toWorld(cssX, cssY)
      const shown = Math.min(automations.length, layout.decorations.length)
      for (let i = 0; i < shown; i++) {
        if (inRect(decorationRect(layout.decorations[i]), w.x, w.y)) return automations[i].id
      }
      return null
    }

    // Drag-to-pan when the village overflows the canvas.
    let drag: { x: number; y: number; moved: boolean } | null = null
    const onDown = (e: MouseEvent): void => {
      if (e.button !== 0) return
      drag = { x: e.clientX, y: e.clientY, moved: false }
    }
    const onUp = (): void => {
      if (drag?.moved) canvas.style.cursor = 'default'
      // Keep `moved` visible to the click handler that fires right after.
      setTimeout(() => (drag = null), 0)
    }
    const onWheel = (e: WheelEvent): void => {
      view.panX -= e.deltaX
      view.panY -= e.deltaY
      e.preventDefault()
    }

    // Anything that's hit handles the click and stops it, so the window's
    // "click empty space to deselect" handler doesn't undo the selection.
    const onClick = (e: MouseEvent): void => {
      if (drag?.moved) return
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const id = hitTest(cx, cy)
      if (id) {
        e.stopPropagation()
        onSelect(id)
        onOpenRef.current?.(id)
        return
      }
      if (hitKatya(cx, cy)) {
        e.stopPropagation()
        onKatyaRef.current?.()
        return
      }
      if (hitLulu(cx, cy)) {
        e.stopPropagation()
        onLuluRef.current?.()
        return
      }
      const automation = hitAutomation(cx, cy)
      if (automation) {
        e.stopPropagation()
        onSelectAutomationRef.current?.(automation)
        return
      }
      const napRepo = hitNap(cx, cy)
      if (napRepo) {
        e.stopPropagation()
        onNapRef.current?.(napRepo)
        return
      }
      const repo = hitHouse(cx, cy)
      if (repo) {
        e.stopPropagation()
        onZoomRef.current?.(repo)
        return
      }
      onSelect(null)
    }
    const onMove = (e: MouseEvent): void => {
      if (drag && e.buttons & 1) {
        const dx = e.clientX - drag.x
        const dy = e.clientY - drag.y
        if (drag.moved || Math.hypot(dx, dy) > 4) {
          drag.moved = true
          view.panX += dx
          view.panY += dy
          drag.x = e.clientX
          drag.y = e.clientY
          canvas.style.cursor = 'grabbing'
          return
        }
      }
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      hover = hitTest(cx, cy)
      hoverManager = hover ? null : hitKatya(cx, cy) ? 'katya' : hitLulu(cx, cy) ? 'lulu' : null
      hoverAutomation = hover || hoverManager ? null : hitAutomation(cx, cy)
      hoverNap = hover || hoverManager || hoverAutomation ? null : hitNap(cx, cy)
      canvas.style.cursor =
        hover || hoverManager || hoverAutomation || hoverNap || hitHouse(cx, cy)
          ? 'pointer'
          : 'default'
    }
    const onLeave = (): void => {
      hover = null
      hoverAutomation = null
      hoverNap = null
      hoverManager = null
    }
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    const draw = (now: number): void => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const sim = simRef.current
      const layout = layoutRef.current
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas.width / dpr
      const cssH = canvas.height / dpr

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.fillStyle = SKY
      ctx.fillRect(0, 0, cssW, cssH)

      if (!layout) {
        raf = requestAnimationFrame(draw)
        return
      }

      tickSim(sim, layout, dt)

      view.scale = villageScale(layout.world, cssW, cssH)
      const worldW = layout.world.w * view.scale
      const worldH = layout.world.h * view.scale
      if (worldW <= cssW) {
        view.panX = 0
        view.offX = Math.floor((cssW - worldW) / 2)
      } else {
        view.panX = Math.min(0, Math.max(cssW - worldW, view.panX))
        view.offX = Math.floor(view.panX)
      }
      if (worldH <= cssH) {
        view.panY = 0
        view.offY = Math.floor((cssH - worldH) / 2)
      } else {
        view.panY = Math.min(0, Math.max(cssH - worldH, view.panY))
        view.offY = Math.floor(view.panY)
      }
      const s = view.scale

      ctx.save()
      ctx.translate(view.offX, view.offY)

      // The whole canvas, in world pixels and in (translated) canvas pixels. The
      // village rarely matches the canvas's shape, so ground and roads run to the edges.
      const visible = { x: -view.offX / s, y: -view.offY / s, w: cssW / s, h: cssH / s }
      const cover = { x: -view.offX, y: -view.offY, w: cssW, h: cssH }

      // Ground
      ctx.fillStyle = GRASS
      ctx.fillRect(cover.x, cover.y, cover.w, cover.h)
      // Checker tufts for texture, on the same 8px lattice inside and outside the village
      ctx.fillStyle = GRASS_DARK
      const tx0 = Math.floor(visible.x / 8) * 8 - 8
      const ty0 = Math.floor(visible.y / 8) * 8 - 8
      for (let ty = ty0; ty < visible.y + visible.h; ty += 8) {
        const shift = Math.abs(ty / 8) % 2 === 0 ? 0 : 4
        for (let tx = tx0 + shift; tx < visible.x + visible.w; tx += 8) {
          ctx.fillRect((tx + 3) * s, (ty + 3) * s, s, s)
        }
      }

      // Neighborhood yards get their own grass shade so a multi-repo project reads as one block
      for (const yard of layout.yards) {
        if (yard.tint < 0) continue
        const tint = NEIGHBORHOOD_TINTS[yard.tint]
        ctx.fillStyle = tint.grass
        ctx.fillRect(yard.cell.x * s, yard.cell.y * s, yard.cell.w * s, yard.cell.h * s)
        ctx.fillStyle = tint.dark
        for (let ty = yard.cell.y; ty < yard.cell.y + yard.cell.h; ty += 8) {
          for (
            let tx = yard.cell.x + ((ty / 8) % 2 === 0 ? 0 : 4);
            tx < yard.cell.x + yard.cell.w;
            tx += 8
          ) {
            ctx.fillRect((tx + 3) * s, (ty + 3) * s, s, s)
          }
        }
      }

      // Paths: horizontal/vertical through the square, out to the canvas edges
      ctx.fillStyle = PATH
      const sq = layout.square
      ctx.fillRect(cover.x, (sq.y + sq.h / 2 - 4) * s, cover.w, 8 * s)
      ctx.fillRect((sq.x + sq.w / 2 - 4) * s, cover.y, 8 * s, cover.h)

      // Town square
      ctx.fillStyle = SQUARE
      ctx.fillRect((sq.x + 6) * s, (sq.y + 6) * s, (sq.w - 12) * s, (sq.h - 12) * s)
      drawGrid(ctx, FOUNTAIN, PROP_PALETTE, layout.fountain.x * s, layout.fountain.y * s, s)
      // Fountain sparkle
      if (sim.frame % 2 === 0) {
        ctx.fillStyle = '#e8f7ff'
        ctx.fillRect((layout.fountain.x + 3) * s, (layout.fountain.y - 1) * s, s, s)
      }

      // Automations decorate the plaza, one lamp, bell, flag or pinwheel each
      const automations = (snapshotRef.current?.automations ?? []).slice(
        0,
        layout.decorations.length
      )
      automations.forEach((a, i) =>
        drawDecoration(
          ctx,
          layout.decorations[i],
          a,
          i,
          s,
          sim.frame,
          a.id === selectedAutomationRef.current || a.id === hoverAutomation
        )
      )

      // Wild meadow around and between the yards; recomputed only when the view changes
      const wildKey = `${visible.x},${visible.y},${visible.w},${visible.h}`
      if (wild?.layout !== layout || wild.key !== wildKey) {
        wild = { layout, key: wildKey, scenery: wildScenery(layout, visible) }
      }
      for (const f of wild.scenery.flowers) drawGrid(ctx, FLOWER, PROP_PALETTE, f.x * s, f.y * s, s)
      for (const t of wild.scenery.trees) drawGrid(ctx, TREE, PROP_PALETTE, t.x * s, t.y * s, s)

      // Yards
      ctx.font = `${Math.max(9, 3 * s)}px ui-monospace, Menlo, monospace`
      ctx.textBaseline = 'top'
      for (const yard of layout.yards) {
        // Fence
        ctx.fillStyle = '#d9c9a0'
        ctx.fillRect(
          (yard.cell.x + 2) * s,
          (yard.cell.y + yard.cell.h - 3) * s,
          (yard.cell.w - 4) * s,
          s
        )
        for (let fx = yard.cell.x + 2; fx < yard.cell.x + yard.cell.w - 2; fx += 4) {
          ctx.fillRect(fx * s, (yard.cell.y + yard.cell.h - 5) * s, s, 3 * s)
        }
        for (const t of yard.trees) drawGrid(ctx, TREE, PROP_PALETTE, t.x * s, t.y * s, s)
        drawGrid(ctx, HOUSE, housePalette(yard.level), yard.house.x * s, yard.house.y * s, s)
        drawHouseUpgrades(ctx, yard, s, sim.frame)
        drawStreakFlame(ctx, yard.house.x, yard.house.y, yard.streak, s, sim.frame)
        for (const f of yard.flowers) drawGrid(ctx, FLOWER, PROP_PALETTE, f.x * s, f.y * s, s)

        // Idle and finished critters sleep in the cat tree / dog house out back
        const residents = napsRef.current.get(yard.repository)
        if (residents) drawNapSpot(ctx, yard, residents, s, sim.frame)

        // Yard label on a sign under the house
        const label = yard.repository.split('/').pop() ?? yard.repository
        const lx = (yard.house.x + HOUSE_W / 2) * s
        const ly = (yard.house.y + HOUSE_H + 1) * s
        const tw = ctx.measureText(label).width
        ctx.fillStyle = 'rgba(20,16,10,0.65)'
        ctx.fillRect(lx - tw / 2 - 3, ly - 1, tw + 6, 3 * s + 2)
        ctx.fillStyle = '#fff4d6'
        ctx.fillText(label, lx - tw / 2, ly)
      }

      // Neighborhood banners: a little flag over the first yard of each group
      for (const n of layout.neighborhoods) {
        const bx = n.banner.x * s
        const by = n.banner.y * s
        const text = `⌂ ${n.name}`
        const tw = ctx.measureText(text).width
        ctx.fillStyle = '#4a3b2a'
        ctx.fillRect(bx, by, s, 6 * s)
        ctx.fillStyle = NEIGHBORHOOD_TINTS[n.tint].dark
        ctx.fillRect(bx + s, by, tw + 4 * s, 3 * s + 2)
        ctx.fillStyle = '#fff4d6'
        ctx.fillText(text, bx + 3 * s, by + 1)
      }

      // Critters (y-sorted so lower ones draw in front)
      const actors = [...sim.actors.values()].sort((a, b) => a.y - b.y)
      for (const a of actors) {
        const set = a.critter.species === 'puppy' ? PUPPY : KITTEN
        const grid = frameOf(set[a.action], sim.frame)
        const pal = critterPalette(a.critter)
        const px = Math.round(a.x) * s
        const py = Math.round(a.y) * s
        const selected = a.id === selectedRef.current
        const { w: cw, h: ch } = CRITTER_SIZE
        if (selected || a.id === hover) {
          ctx.fillStyle = selected ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)'
          ctx.beginPath()
          ctx.ellipse(
            px + (cw / 2) * s,
            py + (ch - 1) * s,
            (cw / 2 - 1) * s,
            2 * s,
            0,
            0,
            Math.PI * 2
          )
          ctx.fill()
        }
        drawShadow(ctx, px, py, cw, ch, s)
        drawGrid(ctx, grid, pal, px, py, s, a.facingLeft)

        // Sub-agents trail behind as tiny kittens
        const minis = Math.min(a.critter.subagents, 4)
        for (let i = 0; i < minis; i++) {
          const mg = MINI_KITTEN[(sim.frame + i) % MINI_KITTEN.length]
          const back = (i + 1) * 7
          const mx = px + (a.facingLeft ? back : -back + cw - 6) * s
          const bob = (sim.frame + i) % 2
          drawGrid(ctx, mg, PROP_PALETTE, mx, py + (ch - 5 - bob) * s, s, a.facingLeft)
        }

        if (a.headingHome) continue
        if (a.critter.status === 'working' && a.critter.currentTool) {
          // Thought bubble with what the critter is actually doing
          const text = truncate(a.critter.currentTool)
          ctx.font = `${Math.max(8, 2.5 * s)}px ui-monospace, Menlo, monospace`
          const tw = ctx.measureText(text).width
          const bw = tw + 4 * s
          const bh = 4 * s
          const bx = px + (cw / 2) * s - bw / 2
          const by = py - bh - 3 * s
          ctx.fillStyle = 'rgba(255,250,240,0.92)'
          ctx.fillRect(bx, by, bw, bh)
          ctx.fillRect(px + (cw / 2 - 1) * s, by + bh, 2 * s, s)
          ctx.fillRect(px + (cw / 2) * s, by + bh + s, s, s)
          ctx.fillStyle = '#2a2320'
          ctx.fillText(text, bx + 2 * s, by + 0.75 * s)
          ctx.font = `${Math.max(9, 3 * s)}px ui-monospace, Menlo, monospace`
        } else if (a.critter.status === 'waiting' && sim.frame % 4 < 3) {
          const q = gridSize(QUESTION)
          drawGrid(
            ctx,
            QUESTION,
            PROP_PALETTE,
            px + Math.round((cw - q.w) / 2) * s,
            py - (q.h + 1) * s,
            s
          )
        }
      }

      // The managers, lower one in front: Katya the mayor, and Lulu who looks after the cats
      const managers = [
        {
          m: sim.katya,
          sprites: KATYA,
          palette: { ...PROP_PALETTE, ...KATYA_PALETTE, c: '#f2a7b5' },
          size: KATYA_SIZE
        },
        {
          m: sim.lulu,
          sprites: LULU,
          palette: { ...PROP_PALETTE, ...LULU_PALETTE },
          size: LULU_SIZE
        }
      ].sort((a, b) => a.m.y - b.m.y)
      for (const { m, sprites, palette, size } of managers) {
        const mx = Math.round(m.x) * s
        const my = Math.round(m.y) * s
        drawShadow(ctx, mx, my, size.w, size.h, s)
        drawGrid(ctx, frameOf(sprites[m.action], sim.frame), palette, mx, my, s, m.facingLeft)
        if (m.action === 'sleep' && sim.frame % 6 < 4) {
          const bob = sim.frame % 4 < 2 ? 0 : 1
          drawGrid(ctx, ZZZ, PROP_PALETTE, mx + (size.w - 4) * s, my - (2 + bob) * s, s)
        }
      }

      const dark = timeOfDay().dark
      drawNight(
        ctx,
        dark,
        layout.yards.map((y) => ({ x: y.house.x, y: y.house.y, level: y.level })),
        cover,
        s,
        sim.frame
      )
      // Lamps lit by a running automation shine through the dark
      if (dark > 0) {
        automations.forEach((a, i) =>
          drawLampGlow(ctx, layout.decorations[i], a, i, s, sim.frame, true)
        )
      }
      // …and so do Lulu's eyes, unless she's asleep
      const lulu = sim.lulu
      if (dark > 0.3 && lulu.action !== 'sleep') {
        const eyes = { e: LULU_PALETTE.e }
        const grid = frameOf(LULU[lulu.action], sim.frame)
        const lx = Math.round(lulu.x) * s
        drawGrid(ctx, grid, eyes, lx, Math.round(lulu.y) * s, s, lulu.facingLeft)
      }

      // Hover labels last so nothing covers them
      const hoveredIndex = automations.findIndex((a) => a.id === hoverAutomation)
      if (hoveredIndex >= 0 && automations[hoveredIndex].id !== selectedAutomationRef.current) {
        const slot = layout.decorations[hoveredIndex]
        drawLabel(
          ctx,
          decorationLabel(automations[hoveredIndex]),
          slot.x + DECORATION_SIZE.w / 2,
          slot.y - 9,
          s
        )
      }
      if (hoverManager) {
        const m = hoverManager === 'katya' ? sim.katya : sim.lulu
        const size = hoverManager === 'katya' ? KATYA_SIZE : LULU_SIZE
        const text =
          hoverManager === 'katya'
            ? 'Katya · mayor · click for her town report'
            : 'Lulu · manager of the cats · click for her report'
        drawLabel(ctx, text, Math.round(m.x) + size.w / 2, Math.round(m.y) - 1, s)
      }
      const napYard = hoverNap ? layout.yards.find((y) => y.repository === hoverNap) : null
      const napCrowd = hoverNap ? napsRef.current.get(hoverNap) : null
      if (napYard && napCrowd) {
        const n = napCrowd.puppies.length + napCrowd.kittens.length
        const at = napLabelAnchor(napYard)
        drawLabel(ctx, `${n} napping · click for the list`, at.x, at.y, s)
      }

      ctx.restore()

      // Report the selected critter's screen anchor for the bubble overlay
      const sel = selectedRef.current ? sim.actors.get(selectedRef.current) : null
      if (sel) {
        const p = worldToScreen(Math.round(sel.x) + CRITTER_SIZE.w / 2, Math.round(sel.y))
        onAnchorRef.current({ x: p.x, y: p.y })
      } else {
        onAnchorRef.current(null)
      }

      // …and the selected decoration's, for the automation bubble
      const selIndex = automations.findIndex((a) => a.id === selectedAutomationRef.current)
      if (selIndex >= 0) {
        const slot = layout.decorations[selIndex]
        const p = worldToScreen(slot.x + DECORATION_SIZE.w / 2, slot.y - 8)
        onAutomationAnchorRef.current?.({ x: p.x, y: p.y })
      } else {
        onAutomationAnchorRef.current?.(null)
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [onSelect])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }}
    />
  )
}
