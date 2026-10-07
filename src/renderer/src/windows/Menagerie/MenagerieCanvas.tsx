import { useEffect, useLayoutEffect, useRef } from 'react'
import type { MenagerieSnapshot } from '../../../../shared/types/menagerie'
import {
  buildLayout,
  HOUSE_H,
  HOUSE_W,
  NEIGHBORHOOD_TINTS,
  villageScale,
  wildScenery,
  type VillageLayout,
  type WildScenery
} from './layout'
import { drawHouseUpgrades, drawNight, drawStreakFlame, housePalette } from './houseUpgrades'
import { timeOfDay, truncate } from './format'
import { createSim, syncSim, tickSim, type Actor, type SimState } from './sim'
import {
  COLLAR_COLORS,
  drawGrid,
  CRITTER_SIZE,
  drawShadow,
  FLOWER,
  FOUNTAIN,
  gridSize,
  HEART,
  HOUSE,
  NOTE,
  KATYA,
  KATYA_PALETTE,
  KATYA_SIZE,
  KITTEN,
  KITTEN_COATS,
  MINI_KITTEN,
  PROP_PALETTE,
  PUPPY,
  PUPPY_COATS,
  QUESTION,
  TREE,
  ZZZ,
  type Grid,
  type Palette
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
}

const SKY = '#1b1a2e'
const GRASS = '#3f8f4a'
const GRASS_DARK = '#357a3f'
const PATH = '#c7b58a'
const SQUARE = '#b9a67a'

function frameOf(frames: Grid[], frame: number): Grid {
  return frames[frame % frames.length]
}

function paletteFor(actor: Actor): Palette {
  const coats = actor.critter.species === 'puppy' ? PUPPY_COATS : KITTEN_COATS
  const coat = coats[actor.critter.coat % coats.length]
  return { ...PROP_PALETTE, ...coat, c: COLLAR_COLORS[actor.critter.client] }
}

export function MenagerieCanvas({
  snapshot,
  selectedId,
  onSelect,
  onOpen,
  onAnchor,
  onZoom,
  onKatya
}: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<SimState>(createSim())
  const layoutRef = useRef<VillageLayout | null>(null)
  const selectedRef = useRef<string | null>(selectedId)
  const onAnchorRef = useRef(onAnchor)
  const onOpenRef = useRef(onOpen)
  const onZoomRef = useRef(onZoom)
  const onKatyaRef = useRef(onKatya)
  useLayoutEffect(() => {
    selectedRef.current = selectedId
    onAnchorRef.current = onAnchor
    onOpenRef.current = onOpen
    onZoomRef.current = onZoom
    onKatyaRef.current = onKatya
  })

  const snapshotRef = useRef(snapshot)
  const aspectRef = useRef(1)

  useEffect(() => {
    snapshotRef.current = snapshot
    if (!snapshot) return
    const layout = buildLayout(snapshot.yards, aspectRef.current)
    layoutRef.current = layout
    syncSim(simRef.current, snapshot, layout, Date.now())
  }, [snapshot])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let last = performance.now()
    let hover: string | null = null
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
          syncSim(simRef.current, snap, next, Date.now())
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

    const onClick = (e: MouseEvent): void => {
      if (drag?.moved) return
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const id = hitTest(cx, cy)
      if (id) {
        onSelect(id)
        onOpenRef.current?.(id)
        return
      }
      if (hitKatya(cx, cy)) {
        onKatyaRef.current?.()
        return
      }
      const repo = hitHouse(cx, cy)
      if (repo) {
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
      canvas.style.cursor = hover || hitKatya(cx, cy) || hitHouse(cx, cy) ? 'pointer' : 'default'
    }
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('mousemove', onMove)
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

      // Wild meadow beyond the village; recomputed only when the view changes
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
        const playing = a.action === 'play'
        const grid = frameOf(set[playing ? 'walk' : a.action], sim.frame)
        const pal = paletteFor(a)
        const px = Math.round(a.x) * s
        // Playing critters bounce: alternate frames lift them a pixel off the ground
        const hop = playing && (sim.frame + (a.playLeader ? 0 : 1)) % 2 === 0 ? 1 : 0
        const py = (Math.round(a.y) - hop) * s
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
        drawShadow(ctx, px, py + hop * s, cw, ch, s, a.alpha)
        drawGrid(ctx, grid, pal, px, py, s, a.facingLeft, a.alpha)

        // Sub-agents trail behind as tiny kittens
        const minis = Math.min(a.critter.subagents, 4)
        for (let i = 0; i < minis; i++) {
          const mg = MINI_KITTEN[(sim.frame + i) % MINI_KITTEN.length]
          const back = (i + 1) * 7
          const mx = px + (a.facingLeft ? back : -back + cw - 6) * s
          const bob = (sim.frame + i) % 2
          drawGrid(ctx, mg, PROP_PALETTE, mx, py + (ch - 5 - bob) * s, s, a.facingLeft, a.alpha)
        }

        if (playing && sim.frame % 8 < 5) {
          // Leader hums a note, follower floats a heart
          const icon = a.playLeader ? NOTE : HEART
          const g = gridSize(icon)
          const bob = sim.frame % 4 < 2 ? 0 : 1
          drawGrid(
            ctx,
            icon,
            PROP_PALETTE,
            px + Math.round((cw - g.w) / 2) * s,
            py - (g.h + 1 + bob) * s,
            s
          )
        }

        if (a.critter.status === 'working' && a.critter.currentTool && !playing) {
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
        } else if (a.action === 'sleep' && sim.frame % 6 < 4) {
          const zz = gridSize(ZZZ)
          drawGrid(
            ctx,
            ZZZ,
            PROP_PALETTE,
            px + (cw - zz.w + 2) * s,
            py - (zz.h + 1) * s,
            s,
            false,
            a.alpha
          )
        }
      }

      // Katya
      const k = sim.katya
      const kGrid = frameOf(KATYA[k.action], sim.frame)
      const kx = Math.round(k.x) * s
      const ky = Math.round(k.y) * s
      drawShadow(ctx, kx, ky, KATYA_SIZE.w, KATYA_SIZE.h, s)
      drawGrid(
        ctx,
        kGrid,
        { ...PROP_PALETTE, ...KATYA_PALETTE, c: '#f2a7b5' },
        kx,
        ky,
        s,
        k.facingLeft
      )

      drawNight(
        ctx,
        timeOfDay().dark,
        layout.yards.map((y) => ({ x: y.house.x, y: y.house.y, level: y.level })),
        cover,
        s,
        sim.frame
      )

      ctx.restore()

      // Report the selected critter's screen anchor for the bubble overlay
      const sel = selectedRef.current ? sim.actors.get(selectedRef.current) : null
      if (sel) {
        const p = worldToScreen(Math.round(sel.x) + CRITTER_SIZE.w / 2, Math.round(sel.y))
        onAnchorRef.current({ x: p.x, y: p.y })
      } else {
        onAnchorRef.current(null)
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('mousemove', onMove)
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
