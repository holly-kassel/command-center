/**
 * Village layout: every repository gets a yard cell with a cottage; the
 * centre cell is the town square where Katya hangs out. All coordinates are
 * in unscaled "world" pixels — the canvas multiplies by an integer scale.
 */
import type { Yard } from '../../../../shared/types/menagerie'
import { houseLevel } from '../../../../shared/types/menagerie'

export const CELL_W = 112
export const CELL_H = 88
export const HOUSE_W = 32
export const HOUSE_H = 28

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface YardLayout {
  repository: string
  cell: Rect
  /** Where the cottage sprite is drawn */
  house: { x: number; y: number }
  /** Doorway (bottom-centre of the house) */
  door: { x: number; y: number }
  /** Area critters are allowed to roam */
  roam: Rect
  /** Trees / flowers for decoration, deterministic per repo */
  trees: { x: number; y: number }[]
  flowers: { x: number; y: number }[]
  /** Upgrade tier 0..6 derived from completed tasks in the repo */
  level: number
  completedTasks: number
  /** Consecutive active days; ≥3 lights a flame by the sign */
  streak: number
  /** Multi-repo project this yard belongs to, if any */
  neighborhood: string | null
  /** Index into NEIGHBORHOOD_TINTS, shared by every yard in the neighborhood */
  tint: number
}

/** Grass tints that mark the yards of one neighborhood; cycles when exhausted */
export const NEIGHBORHOOD_TINTS = [
  { grass: '#4a8f5f', dark: '#3d7a50' }, // sage
  { grass: '#6f9448', dark: '#5c7d3b' }, // olive
  { grass: '#3f8d7a', dark: '#357666' }, // teal
  { grass: '#8a9244', dark: '#747b38' }, // mustard
  { grass: '#4f8a94', dark: '#42757e' }, // slate
  { grass: '#7f8f55', dark: '#6b7947' } // moss
] as const

export interface NeighborhoodLayout {
  name: string
  tint: number
  /** Banner anchored above the first yard in the group */
  banner: { x: number; y: number }
  cells: Rect[]
}

export interface VillageLayout {
  cols: number
  rows: number
  world: { w: number; h: number }
  square: Rect
  fountain: { x: number; y: number }
  yards: YardLayout[]
  neighborhoods: NeighborhoodLayout[]
}

function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Pick a column count so the village roughly matches the viewport's aspect
 * ratio (width / height) — a wide window gets a wide village instead of a
 * tall one that has to be scrolled.
 */
export function gridFor(total: number, aspect = 1): { cols: number; rows: number } {
  const cellAspect = CELL_W / CELL_H
  const ideal = Math.sqrt((total * aspect) / cellAspect)
  const cols = Math.max(2, Math.round(ideal) || 2)
  const rows = Math.max(2, Math.ceil(total / cols))
  return { cols, rows }
}

/**
 * Largest whole-number zoom that fits the village in the canvas. Whole numbers
 * keep the pixel art crisp, and there's no upper cap, so a big window gets a
 * big village. Never below 2×; smaller canvases scroll instead.
 */
export function villageScale(world: { w: number; h: number }, cssW: number, cssH: number): number {
  const s = Math.floor(Math.min(cssW / world.w, cssH / world.h))
  return Math.max(2, s || 2)
}

export function buildLayout(yards: Yard[], aspect = 1): VillageLayout {
  const n = yards.length
  // Reserve one cell for the square.
  const total = n + 1
  const { cols, rows } = gridFor(total, aspect)
  const squareIndex = Math.floor(rows / 2) * cols + Math.floor(cols / 2)

  const world = { w: cols * CELL_W, h: rows * CELL_H }
  const sqCol = squareIndex % cols
  const sqRow = Math.floor(squareIndex / cols)
  const square: Rect = { x: sqCol * CELL_W, y: sqRow * CELL_H, w: CELL_W, h: CELL_H }
  const fountain = { x: square.x + CELL_W / 2 - 4, y: square.y + CELL_H / 2 - 3 }

  const tintFor = new Map<string, number>()
  for (const yard of yards) {
    if (yard.neighborhood && !tintFor.has(yard.neighborhood))
      tintFor.set(yard.neighborhood, tintFor.size % NEIGHBORHOOD_TINTS.length)
  }

  const layouts: YardLayout[] = []
  let idx = 0
  for (const yard of yards) {
    if (idx === squareIndex) idx++
    const col = idx % cols
    const row = Math.floor(idx / cols)
    idx++

    const cell: Rect = { x: col * CELL_W, y: row * CELL_H, w: CELL_W, h: CELL_H }
    const rnd = mulberry(hash(yard.repository))
    const houseX = cell.x + 8 + Math.floor(rnd() * 16)
    const houseY = cell.y + 4
    const door = { x: houseX + HOUSE_W / 2, y: houseY + HOUSE_H - 5 }
    const roam: Rect = {
      x: cell.x + 4,
      y: houseY + HOUSE_H - 2,
      w: CELL_W - 8,
      h: cell.y + CELL_H - (houseY + HOUSE_H - 2) - 4
    }

    const trees: { x: number; y: number }[] = []
    const treeCount = 1 + Math.floor(rnd() * 2)
    for (let i = 0; i < treeCount; i++) {
      trees.push({
        x: cell.x + CELL_W - 20 - Math.floor(rnd() * 24),
        y: cell.y + 2 + Math.floor(rnd() * 8)
      })
    }
    const flowers: { x: number; y: number }[] = []
    const flowerCount = 2 + Math.floor(rnd() * 3)
    for (let i = 0; i < flowerCount; i++) {
      flowers.push({
        x: roam.x + Math.floor(rnd() * (roam.w - 6)),
        y: roam.y + Math.floor(rnd() * (roam.h - 8))
      })
    }

    layouts.push({
      repository: yard.repository,
      cell,
      house: { x: houseX, y: houseY },
      door,
      roam,
      trees,
      flowers,
      level: houseLevel(yard.completedTasks ?? 0),
      completedTasks: yard.completedTasks ?? 0,
      streak: yard.streak ?? 0,
      neighborhood: yard.neighborhood ?? null,
      tint: yard.neighborhood ? (tintFor.get(yard.neighborhood) ?? 0) : -1
    })
  }

  const neighborhoods: NeighborhoodLayout[] = []
  for (const l of layouts) {
    if (!l.neighborhood) continue
    let n = neighborhoods.find((x) => x.name === l.neighborhood)
    if (!n) {
      n = {
        name: l.neighborhood,
        tint: l.tint,
        banner: { x: l.cell.x + 4, y: l.cell.y + 1 },
        cells: []
      }
      neighborhoods.push(n)
    }
    n.cells.push(l.cell)
  }

  return { cols, rows, world, square, fountain, yards: layouts, neighborhoods }
}

/** Footprints of TREE and FLOWER in sprites.ts */
const WILD_TREE = { w: 12, h: 16 }
const WILD_FLOWER = { w: 5, h: 6 }

export interface WildScenery {
  trees: { x: number; y: number }[]
  flowers: { x: number; y: number }[]
}

/**
 * Meadow around and between the yards. The canvas rarely matches the
 * village's shape, so every cell-sized plot without a yard or the square
 * (beyond the grid or an unused slot in it) gets a few trees and flowers.
 * Plots are seeded by grid position, so scenery stays put between frames, and
 * nothing is placed on the roads out of the town square.
 * `area` is the visible region in world pixels.
 */
export function wildScenery(layout: VillageLayout, area: Rect): WildScenery {
  const trees: { x: number; y: number }[] = []
  const flowers: { x: number; y: number }[] = []
  const sq = layout.square
  const taken = new Set(
    [sq, ...layout.yards.map((y) => y.cell)].map((c) => `${c.x / CELL_W},${c.y / CELL_H}`)
  )
  const roadY = sq.y + sq.h / 2 - 4
  const roadX = sq.x + sq.w / 2 - 4
  const onRoad = (x: number, y: number, w: number, h: number): boolean =>
    (y < roadY + 10 && y + h > roadY - 2) || (x < roadX + 10 && x + w > roadX - 2)

  const c0 = Math.floor(area.x / CELL_W)
  const c1 = Math.ceil((area.x + area.w) / CELL_W)
  const r0 = Math.floor(area.y / CELL_H)
  const r1 = Math.ceil((area.y + area.h) / CELL_H)
  for (let row = r0; row < r1; row++) {
    for (let col = c0; col < c1; col++) {
      if (taken.has(`${col},${row}`)) continue
      const rnd = mulberry(hash(`wild:${col},${row}`))
      const x0 = col * CELL_W
      const y0 = row * CELL_H
      const treeCount = 1 + Math.floor(rnd() * 3)
      for (let i = 0; i < treeCount; i++) {
        const x = x0 + 4 + Math.floor(rnd() * (CELL_W - WILD_TREE.w - 8))
        const y = y0 + 2 + Math.floor(rnd() * (CELL_H - WILD_TREE.h - 4))
        if (!onRoad(x, y, WILD_TREE.w, WILD_TREE.h)) trees.push({ x, y })
      }
      const flowerCount = 2 + Math.floor(rnd() * 3)
      for (let i = 0; i < flowerCount; i++) {
        const x = x0 + 4 + Math.floor(rnd() * (CELL_W - WILD_FLOWER.w - 8))
        const y = y0 + 4 + Math.floor(rnd() * (CELL_H - WILD_FLOWER.h - 8))
        if (!onRoad(x, y, WILD_FLOWER.w, WILD_FLOWER.h)) flowers.push({ x, y })
      }
    }
  }
  // Lower trees draw last so they overlap the ones behind them.
  trees.sort((a, b) => a.y - b.y)
  return { trees, flowers }
}
