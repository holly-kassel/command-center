/**
 * Props the village draws straight from the snapshot instead of the sim:
 * each yard's nap spot (cat tree + dog house, with the newest sleeper on top)
 * and one decoration per automation around the town square.
 */
import type { Automation, Critter, MenagerieSnapshot } from '../../../../shared/types/menagerie'
import { automationState, isNapping } from '../../../../shared/types/menagerie'
import type { Point, Rect, YardLayout } from './layout'
import {
  BANG,
  BANG_PALETTE,
  CAT_TREE,
  CAT_TREE_PALETTE,
  COLLAR_COLORS,
  DECORATION_SIZE,
  DOG_HOUSE,
  KITTEN,
  KITTEN_COATS,
  LAMP_LIT,
  LAMP_UNLIT,
  PROP_PALETTE,
  PUPPY,
  PUPPY_COATS,
  QUESTION,
  ZZZ,
  decorationFor,
  drawGrid,
  drawShadow,
  gridSize,
  type Palette
} from './sprites'

const FONT = 'ui-monospace, Menlo, monospace'
const DOG = gridSize(DOG_HOUSE)
const CAT = gridSize(CAT_TREE)
const Z = gridSize(ZZZ)

export interface NapResidents {
  puppies: Critter[]
  kittens: Critter[]
}

/** Napping critters per yard, by species; keeps the yard's order (idle sessions first) */
export function napResidents(snapshot: MenagerieSnapshot): Map<string, NapResidents> {
  const out = new Map<string, NapResidents>()
  for (const yard of snapshot.yards) {
    const puppies = yard.critters.filter((c) => isNapping(c.status) && c.species === 'puppy')
    const kittens = yard.critters.filter((c) => isNapping(c.status) && c.species === 'kitten')
    if (puppies.length || kittens.length) out.set(yard.repository, { puppies, kittens })
  }
  return out
}

export function critterPalette(c: Critter): Palette {
  const coats = c.species === 'puppy' ? PUPPY_COATS : KITTEN_COATS
  return { ...PROP_PALETTE, ...coats[c.coat % coats.length], c: COLLAR_COLORS[c.client] }
}

/** Sleepers and their Zs, in world px. Sleeping sprites leave their top 5 rows empty. */
function napGeometry(yard: YardLayout): Record<'pup' | 'pupZ' | 'kit' | 'kitZ', Point> {
  const d = yard.nap.dogHouse
  const c = yard.nap.catTree
  return {
    // Lies across the doorway, nose poking out onto the grass
    pup: { x: d.x + 2, y: d.y + 4 },
    pupZ: { x: d.x + 11, y: d.y - 7 },
    // Curled up on the top perch
    kit: { x: c.x, y: c.y - 11 },
    kitZ: { x: c.x + 8, y: c.y - 12 }
  }
}

/** Dark pill with cream text whose bottom-centre sits at (cx, bottom) in world px */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  bottom: number,
  s: number
): void {
  ctx.save()
  ctx.font = `${Math.max(9, 3 * s)}px ${FONT}`
  ctx.textBaseline = 'top'
  const tw = ctx.measureText(text).width
  const h = 3 * s + 4
  const x = Math.round(cx * s - tw / 2 - 3)
  const y = Math.round(bottom * s - h)
  ctx.fillStyle = 'rgba(20,16,10,0.82)'
  ctx.fillRect(x, y, tw + 6, h)
  ctx.fillStyle = '#fff4d6'
  ctx.fillText(text, x + 3, y + 2)
  ctx.restore()
}

/** Bobbing "z", with a ×N tag when more than one critter sleeps there */
function drawZ(
  ctx: CanvasRenderingContext2D,
  at: Point,
  count: number,
  s: number,
  frame: number
): void {
  const y = at.y - (frame % 4 < 2 ? 0 : 1)
  drawGrid(ctx, ZZZ, PROP_PALETTE, at.x * s, y * s, s)
  if (count < 2) return
  ctx.save()
  ctx.font = `700 ${Math.max(8, 2.5 * s)}px ${FONT}`
  ctx.textBaseline = 'top'
  const text = `×${count}`
  const tw = ctx.measureText(text).width
  const x = (at.x + Z.w + 1) * s
  ctx.fillStyle = 'rgba(20,16,10,0.7)'
  ctx.fillRect(x - 2, y * s - 1, tw + 4, 3 * s + 2)
  ctx.fillStyle = '#fff4d6'
  ctx.fillText(text, x, y * s)
  ctx.restore()
}

export function drawNapSpot(
  ctx: CanvasRenderingContext2D,
  yard: YardLayout,
  residents: NapResidents,
  s: number,
  frame: number
): void {
  const g = napGeometry(yard)
  if (residents.kittens.length) {
    const c = yard.nap.catTree
    drawShadow(ctx, c.x * s, c.y * s, CAT.w, CAT.h, s)
    drawGrid(ctx, CAT_TREE, { ...PROP_PALETTE, ...CAT_TREE_PALETTE }, c.x * s, c.y * s, s)
    const kitten = residents.kittens[0]
    drawGrid(ctx, KITTEN.sleep[0], critterPalette(kitten), g.kit.x * s, g.kit.y * s, s)
    drawZ(ctx, g.kitZ, residents.kittens.length, s, frame + 2)
  }
  if (residents.puppies.length) {
    const d = yard.nap.dogHouse
    drawShadow(ctx, d.x * s, d.y * s, DOG.w, DOG.h, s)
    drawGrid(ctx, DOG_HOUSE, PROP_PALETTE, d.x * s, d.y * s, s)
    const puppy = residents.puppies[0]
    drawGrid(ctx, PUPPY.sleep[0], critterPalette(puppy), g.pup.x * s, g.pup.y * s, s)
    drawZ(ctx, g.pupZ, residents.puppies.length, s, frame)
  }
}

/** Clickable areas of a nap spot: each structure with its sleeper and Z */
export function napHitRects(yard: YardLayout, residents: NapResidents): Rect[] {
  const rects: Rect[] = []
  const c = yard.nap.catTree
  const d = yard.nap.dogHouse
  if (residents.kittens.length) rects.push({ x: c.x, y: c.y - 12, w: CAT.w, h: CAT.h + 12 })
  if (residents.puppies.length) rects.push({ x: d.x, y: d.y - 7, w: DOG.w, h: DOG.h + 11 })
  return rects
}

/** Top-centre of the nap spot, where its hover label goes */
export function napLabelAnchor(yard: YardLayout): Point {
  const c = yard.nap.catTree
  const d = yard.nap.dogHouse
  return { x: (c.x + d.x + DOG.w) / 2, y: c.y - 13 }
}

/**
 * One automation's decoration: animated while a run works, "?" while a run
 * waits on you, "!" after a failed run, and faded while paused.
 */
export function drawDecoration(
  ctx: CanvasRenderingContext2D,
  slot: Point,
  automation: Automation,
  index: number,
  s: number,
  frame: number,
  highlighted: boolean
): void {
  const { sprite, accent } = decorationFor(index)
  const state = automationState(automation)
  const running = state === 'running'
  const grid = running ? sprite.running[frame % sprite.running.length] : sprite.idle
  const alpha = state === 'paused' ? 0.5 : 1
  const { w, h } = DECORATION_SIZE

  if (highlighted) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.ellipse(
      (slot.x + w / 2) * s,
      (slot.y + h - 1) * s,
      (w / 2 + 1) * s,
      2 * s,
      0,
      0,
      Math.PI * 2
    )
    ctx.fill()
  }
  drawShadow(ctx, slot.x * s, slot.y * s, w, h, s, alpha)
  drawLampGlow(ctx, slot, automation, index, s, frame, false)
  drawGrid(
    ctx,
    grid,
    { ...PROP_PALETTE, ...accent, u: running ? LAMP_LIT : LAMP_UNLIT },
    slot.x * s,
    slot.y * s,
    s,
    false,
    alpha
  )

  if (state === 'waiting' && frame % 4 < 3) {
    drawGrid(ctx, QUESTION, PROP_PALETTE, (slot.x + 1) * s, (slot.y - 8) * s, s)
  } else if (state === 'failed' && frame % 6 < 4) {
    drawGrid(ctx, BANG, BANG_PALETTE, (slot.x + 4) * s, (slot.y - 7) * s, s)
  }
}

/**
 * A running lamp's halo. Drawn under the sprite, and again (with its glass)
 * after the night tint so lit lamps shine through the dark.
 */
export function drawLampGlow(
  ctx: CanvasRenderingContext2D,
  slot: Point,
  automation: Automation,
  index: number,
  s: number,
  frame: number,
  withGlass: boolean
): void {
  const { sprite } = decorationFor(index)
  if (!sprite.glow || automationState(automation) !== 'running') return
  ctx.fillStyle = `rgba(255,200,90,${frame % 3 === 0 ? 0.16 : 0.26})`
  ctx.beginPath()
  ctx.arc((slot.x + sprite.glow.x) * s, (slot.y + sprite.glow.y) * s, 6 * s, 0, Math.PI * 2)
  ctx.fill()
  if (withGlass) {
    ctx.fillStyle = LAMP_LIT
    ctx.fillRect((slot.x + 3) * s, (slot.y + 2) * s, 3 * s, 3 * s)
  }
}
