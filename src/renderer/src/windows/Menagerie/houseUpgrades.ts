import { HOUSE_H, HOUSE_W, type YardLayout } from './layout'
import {
  ANNEX,
  CHIMNEY,
  drawGrid,
  FLAME,
  FLOWER_BOX,
  gridSize,
  LANTERN,
  PROP_PALETTE,
  SMOKE,
  type Palette,
  STAR
} from './sprites'
import { STREAK_FLAME_DAYS } from '../../../../shared/types/menagerie'

/** Tier 5 repaints the roof from barn red to a fresh teal. */
export const PAINTED_ROOF = { r: '#5aa3b8', R: '#2f5e70' }

/** Palette to draw the cottage (and its annex) with at a given upgrade level. */
export function housePalette(level: number): Palette {
  return level >= 5 ? { ...PROP_PALETTE, ...PAINTED_ROOF } : PROP_PALETTE
}

/**
 * Each completed task nudges a repo's cottage toward the next tier:
 * flower box → chimney with smoke → picket fence → side annex with lantern →
 * fresh paint with lit windows → gable star.
 */
export function drawHouseUpgrades(
  ctx: CanvasRenderingContext2D,
  yard: YardLayout,
  s: number,
  frame: number
): void {
  const hx = yard.house.x
  const hy = yard.house.y
  const lvl = yard.level
  if (lvl >= 1) {
    // Flower boxes under both windows (window glass sits at cols 7-9 / 21-23, rows 14-16)
    drawGrid(ctx, FLOWER_BOX, PROP_PALETTE, (hx + 6) * s, (hy + 16) * s, s)
    drawGrid(ctx, FLOWER_BOX, PROP_PALETTE, (hx + 20) * s, (hy + 16) * s, s)
  }
  if (lvl >= 2) {
    drawGrid(ctx, CHIMNEY, PROP_PALETTE, (hx + 20) * s, (hy + 4) * s, s)
    const puff = SMOKE[Math.floor(frame / 2) % SMOKE.length]
    const rise = frame % 4
    drawGrid(ctx, puff, PROP_PALETTE, (hx + 20) * s, (hy - rise) * s, s, false, 0.85 - rise * 0.15)
  }
  if (lvl >= 3) {
    // White picket fence along the front of the yard cell
    ctx.fillStyle = '#fbf7ee'
    const cy = yard.cell.y + yard.cell.h - 6
    ctx.fillRect((yard.cell.x + 2) * s, (cy + 2) * s, (yard.cell.w - 4) * s, s)
    for (let fx = yard.cell.x + 2; fx < yard.cell.x + yard.cell.w - 2; fx += 4) {
      ctx.fillRect(fx * s, cy * s, s, 5 * s)
      ctx.fillRect(fx * s, (cy - 1) * s, s, s)
    }
  }
  if (lvl >= 4) {
    // Side room bolted onto the right wall, with a lantern hung by its door-side corner
    drawGrid(ctx, ANNEX, housePalette(lvl), (hx + 25) * s, (hy + 12) * s, s)
    drawGrid(ctx, LANTERN, PROP_PALETTE, (hx + HOUSE_W + 1) * s, (hy + HOUSE_H - 11) * s, s)
    if (frame % 3 !== 0) {
      ctx.fillStyle = 'rgba(255,200,90,0.18)'
      ctx.beginPath()
      ctx.arc((hx + HOUSE_W + 2.5) * s, (hy + HOUSE_H - 10) * s, 5 * s, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (lvl >= 5) {
    // Warm lit windows (the roof repaint happens via housePalette)
    ctx.fillStyle = '#ffd37a'
    ctx.fillRect((hx + 7) * s, (hy + 14) * s, 3 * s, 3 * s)
    ctx.fillRect((hx + 21) * s, (hy + 14) * s, 3 * s, 3 * s)
    ctx.fillRect((hx + 28) * s, (hy + 20) * s, 2 * s, 2 * s)
  }
  if (lvl >= 6) {
    const st = gridSize(STAR)
    const twinkle = frame % 6 < 5 ? 1 : 0.6
    drawGrid(
      ctx,
      STAR,
      PROP_PALETTE,
      (hx + 15 - Math.floor(st.w / 2) + 1) * s,
      (hy - 4) * s,
      s,
      false,
      twinkle
    )
  }
}

/** A little flame beside the sign for repos on a hot streak (3+ days running). */
export function drawStreakFlame(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  streak: number,
  s: number,
  frame: number
): void {
  if (streak < STREAK_FLAME_DAYS) return
  const grid = FLAME[Math.floor(frame / 2) % FLAME.length]
  const g = gridSize(grid)
  const x = hx + 1
  const y = hy + HOUSE_H - 5 - g.h
  if (frame % 4 < 3) {
    ctx.fillStyle = 'rgba(255,170,60,0.22)'
    ctx.beginPath()
    ctx.arc((x + g.w / 2) * s, (y + g.h - 2) * s, 5 * s, 0, Math.PI * 2)
    ctx.fill()
  }
  drawGrid(ctx, grid, PROP_PALETTE, x * s, y * s, s)
}

/**
 * Night falls: a cool tint over the whole canvas, then warm windows and the
 * lantern (if built) drawn back on top so cottages glow.
 */
export function drawNight(
  ctx: CanvasRenderingContext2D,
  dark: number,
  houses: { x: number; y: number; level: number }[],
  /** Canvas-pixel area to tint, in the caller's current (translated) coordinates */
  cover: { x: number; y: number; w: number; h: number },
  s: number,
  frame: number
): void {
  if (dark <= 0) return
  ctx.fillStyle = `rgba(18,20,58,${(0.5 * dark).toFixed(3)})`
  ctx.fillRect(cover.x, cover.y, cover.w, cover.h)
  const flicker = frame % 5 === 0 ? 0.8 : 1
  for (const h of houses) {
    ctx.fillStyle = `rgba(255,211,122,${(dark * flicker).toFixed(3)})`
    ctx.fillRect((h.x + 7) * s, (h.y + 14) * s, 3 * s, 3 * s)
    ctx.fillRect((h.x + 21) * s, (h.y + 14) * s, 3 * s, 3 * s)
    if (h.level >= 4) {
      ctx.fillRect((h.x + 28) * s, (h.y + 20) * s, 2 * s, 2 * s)
      ctx.fillStyle = `rgba(255,200,90,${(0.3 * dark * flicker).toFixed(3)})`
      ctx.beginPath()
      ctx.arc((h.x + HOUSE_W + 2.5) * s, (h.y + HOUSE_H - 10) * s, 7 * s, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = `rgba(255,211,122,${(0.12 * dark).toFixed(3)})`
    ctx.fillRect((h.x + 5) * s, (h.y + 12) * s, 7 * s, 7 * s)
    ctx.fillRect((h.x + 19) * s, (h.y + 12) * s, 7 * s, 7 * s)
  }
}
