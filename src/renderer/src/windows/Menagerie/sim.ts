/**
 * Tiny behaviour sim: each critter has a position, facing, and an "action"
 * chosen from its status. The sim is deterministic-ish (seeded per session id)
 * so critters don't teleport when the snapshot refreshes.
 */
import type { Critter, MenagerieSnapshot } from '../../../../shared/types/menagerie'
import { MENAGERIE_RETENTION_HOURS } from '../../../../shared/types/menagerie'
import type { Rect, VillageLayout, YardLayout } from './layout'
import { CRITTER_SIZE, KATYA_SIZE } from './sprites'

export type Action = 'idle' | 'walk' | 'chore' | 'sit' | 'sleep' | 'play'

export interface Actor {
  id: string
  critter: Critter
  yard: YardLayout
  x: number
  y: number
  facingLeft: boolean
  action: Action
  /** seconds until the actor picks a new action */
  timer: number
  target: { x: number; y: number } | null
  /** 0..1 — fades out `recent` critters as they age */
  alpha: number
  /** position in the yard's porch queue for recent/done critters */
  porchSlot: number
  /** id of the critter this one is playing with, if any */
  playmate: string | null
  /** where the pair is playing (a yard's roam rect or the square) */
  playArea: Rect | null
  /** true for the actor that picks the chase targets */
  playLeader: boolean
}

export interface KatyaActor {
  x: number
  y: number
  facingLeft: boolean
  action: Action
  timer: number
  target: { x: number; y: number } | null
}

export interface SimState {
  actors: Map<string, Actor>
  katya: KatyaActor
  /** advances 4×/sec; sprites index frames from this */
  frame: number
  frameAcc: number
}

const SPRITE = CRITTER_SIZE.w
const SPEED = { puppy: 12, kitten: 14, katya: 10 }

function seeded(id: string): () => number {
  let a = 0
  for (let i = 0; i < id.length; i++) a = (a * 31 + id.charCodeAt(i)) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomPoint(rect: Rect, rnd: () => number): { x: number; y: number } {
  return {
    x: rect.x + rnd() * Math.max(1, rect.w - SPRITE),
    y: rect.y + rnd() * Math.max(1, rect.h - SPRITE)
  }
}

export function ageAlpha(critter: Critter, now: number): number {
  if (critter.status !== 'recent' && critter.status !== 'done') return 1
  const ageMs = now - Date.parse(critter.lastActivityAt)
  const span = MENAGERIE_RETENTION_HOURS * 3_600_000
  const t = Math.min(1, Math.max(0, ageMs / span))
  return 1 - t * 0.65
}

export function createSim(): SimState {
  return {
    actors: new Map(),
    katya: { x: 0, y: 0, facingLeft: false, action: 'idle', timer: 2, target: null },
    frame: 0,
    frameAcc: 0
  }
}

/** Reconcile actors with a fresh snapshot/layout without resetting positions. */
export function syncSim(
  sim: SimState,
  snapshot: MenagerieSnapshot,
  layout: VillageLayout,
  now: number
): void {
  const seen = new Set<string>()
  const yardByRepo = new Map(layout.yards.map((y) => [y.repository, y]))

  for (const yard of snapshot.yards) {
    const yl = yardByRepo.get(yard.repository)
    if (!yl) continue
    let porch = 0
    for (const critter of yard.critters) {
      seen.add(critter.id)
      const existing = sim.actors.get(critter.id)
      const isPorch = critter.status === 'recent' || critter.status === 'done'
      const slot = isPorch ? porch++ : -1
      if (existing) {
        const statusChanged = existing.critter.status !== critter.status
        const yardChanged = existing.yard.repository !== yl.repository
        existing.critter = critter
        existing.yard = yl
        existing.alpha = ageAlpha(critter, now)
        existing.porchSlot = slot
        if (statusChanged || yardChanged) {
          existing.timer = 0
          existing.target = null
          if (existing.playmate) breakPlay(sim, existing)
          if (yardChanged) {
            const p = randomPoint(yl.roam, seeded(critter.id))
            existing.x = p.x
            existing.y = p.y
          }
        }
        continue
      }
      const rnd = seeded(critter.id)
      const p = randomPoint(yl.roam, rnd)
      sim.actors.set(critter.id, {
        id: critter.id,
        critter,
        yard: yl,
        x: p.x,
        y: p.y,
        facingLeft: rnd() < 0.5,
        action: 'idle',
        timer: 0,
        target: null,
        alpha: ageAlpha(critter, now),
        porchSlot: slot,
        playmate: null,
        playArea: null,
        playLeader: false
      })
    }
  }

  for (const id of [...sim.actors.keys()]) {
    if (seen.has(id)) continue
    const gone = sim.actors.get(id)
    if (gone?.playmate) breakPlay(sim, gone)
    sim.actors.delete(id)
  }

  // Keep Katya inside the world after a relayout
  const sq = layout.square
  if (sim.katya.x === 0 && sim.katya.y === 0) {
    sim.katya.x = sq.x + sq.w / 2 - KATYA_SIZE.w / 2
    sim.katya.y = sq.y + 8
  }
  sim.katya.x = Math.min(Math.max(sim.katya.x, 0), layout.world.w - KATYA_SIZE.w)
  sim.katya.y = Math.min(Math.max(sim.katya.y, 0), layout.world.h - KATYA_SIZE.h)
}

function porchSpot(yard: YardLayout, slot: number): { x: number; y: number } {
  // Alternate left/right of the door, stepping outward
  const side = slot % 2 === 0 ? 1 : -1
  const step = Math.floor(slot / 2) + (slot === 0 ? 0 : 1)
  return { x: yard.door.x - SPRITE / 2 + side * step * (SPRITE + 2), y: yard.door.y - 4 }
}

function stepTowards(
  a: { x: number; y: number },
  target: { x: number; y: number },
  dist: number
): boolean {
  const dx = target.x - a.x
  const dy = target.y - a.y
  const len = Math.hypot(dx, dy)
  if (len <= dist || len === 0) {
    a.x = target.x
    a.y = target.y
    return true
  }
  a.x += (dx / len) * dist
  a.y += (dy / len) * dist
  return false
}

export function tickSim(sim: SimState, layout: VillageLayout, dt: number): void {
  sim.frameAcc += dt
  while (sim.frameAcc >= 0.25) {
    sim.frameAcc -= 0.25
    sim.frame++
  }

  pairIdlePlaymates(sim, layout)
  for (const actor of sim.actors.values()) tickActor(sim, actor, dt)
  tickKatya(sim.katya, layout, dt)
}

// ── Playtime ──────────────────────────────────────────────────────

const PLAY_PAIR_CHANCE_PER_SEC = 0.35
const PLAY_RADIUS = SPRITE * 0.9

function inset(r: Rect, by: number): Rect {
  return {
    x: r.x + by,
    y: r.y + by,
    w: Math.max(SPRITE, r.w - by * 2),
    h: Math.max(SPRITE, r.h - by * 2)
  }
}

function startPlay(a: Actor, b: Actor, area: Rect): void {
  const leader = a.id < b.id ? a : b
  const follower = leader === a ? b : a
  for (const actor of [a, b]) {
    actor.playmate = actor === a ? b.id : a.id
    actor.playArea = area
    actor.playLeader = actor === leader
    actor.action = 'walk'
    actor.timer = 8 + Math.random() * 8
    actor.target = null
  }
  leader.target = randomPoint(area, Math.random)
  follower.target = { ...leader.target }
}

function breakPlay(sim: SimState, a: Actor): void {
  const mate = a.playmate ? sim.actors.get(a.playmate) : null
  for (const actor of [a, mate]) {
    if (!actor) continue
    actor.playmate = null
    actor.playArea = null
    actor.playLeader = false
    if (actor.action === 'play') actor.action = 'idle'
    actor.target = null
    actor.timer = 1 + Math.random() * 2
  }
}

/** Occasionally match up two idle, unpaired critters and send them off to play. */
function pairIdlePlaymates(sim: SimState, layout: VillageLayout): void {
  const free: Actor[] = []
  for (const a of sim.actors.values()) {
    if (a.critter.status === 'idle' && !a.playmate && a.action !== 'sleep') free.push(a)
  }
  if (free.length < 2) return
  // One pairing attempt per tick at most; dt is ~1/60 so scale the chance.
  if (Math.random() > PLAY_PAIR_CHANCE_PER_SEC / 60) return

  const i = Math.floor(Math.random() * free.length)
  let j = Math.floor(Math.random() * (free.length - 1))
  if (j >= i) j++
  const a = free[i]
  const b = free[j]
  const sameYard = a.yard.repository === b.yard.repository
  const area = sameYard ? a.yard.roam : inset(layout.square, 6)
  startPlay(a, b, area)
}

function tickPlay(sim: SimState, a: Actor, dt: number): void {
  const mate = a.playmate ? sim.actors.get(a.playmate) : null
  if (!mate || mate.playmate !== a.id || mate.critter.status !== 'idle' || !a.playArea) {
    breakPlay(sim, a)
    return
  }
  const speed = SPEED[a.critter.species] * 1.25
  a.timer -= dt
  if (a.timer <= 0) {
    breakPlay(sim, a)
    return
  }

  if (a.playLeader) {
    // Leader scampers between random points; pauses briefly when it arrives.
    if (!a.target) a.target = randomPoint(a.playArea, Math.random)
    a.facingLeft = a.target.x < a.x
    if (stepTowards(a, a.target, speed * dt)) a.target = null
  } else {
    // Follower chases the leader and hops around it once close.
    const dx = mate.x - a.x
    const dy = mate.y - a.y
    const dist = Math.hypot(dx, dy)
    a.facingLeft = dx < 0
    if (dist > PLAY_RADIUS) {
      stepTowards(a, { x: mate.x - Math.sign(dx || 1) * SPRITE * 0.6, y: mate.y }, speed * dt)
    }
  }
  a.action = 'play'
}

function tickActor(sim: SimState, a: Actor, dt: number): void {
  const status = a.critter.status
  const rnd = Math.random
  const speed = SPEED[a.critter.species]

  if (a.playmate) {
    if (status === 'idle') {
      tickPlay(sim, a, dt)
      return
    }
    breakPlay(sim, a)
  }

  // Porch dwellers go straight to their spot and stay put.
  if (status === 'recent' || status === 'done') {
    const spot = porchSpot(a.yard, Math.max(0, a.porchSlot))
    if (Math.hypot(spot.x - a.x, spot.y - a.y) > 0.5) {
      a.facingLeft = spot.x < a.x
      a.action = 'walk'
      stepTowards(a, spot, speed * dt)
      return
    }
    a.action = status === 'done' ? 'sleep' : 'sit'
    a.facingLeft = a.porchSlot % 2 === 1
    return
  }

  if (status === 'waiting') {
    a.action = 'sit'
    return
  }

  if (a.action === 'walk' && a.target) {
    a.facingLeft = a.target.x < a.x
    if (stepTowards(a, a.target, speed * dt)) {
      a.target = null
      a.action = status === 'working' ? 'chore' : 'idle'
      a.timer = status === 'working' ? 6 + rnd() * 8 : 2 + rnd() * 4
    }
    return
  }

  a.timer -= dt
  if (a.timer > 0) return

  if (status === 'working') {
    // Mostly keep doing the chore; wander occasionally.
    if (a.action !== 'chore' || rnd() < 0.3) {
      a.target = randomPoint(a.yard.roam, rnd)
      a.action = 'walk'
    } else {
      a.timer = 5 + rnd() * 6
    }
    return
  }

  // idle: wander, pause, sometimes nap
  const roll = rnd()
  if (roll < 0.5) {
    a.target = randomPoint(a.yard.roam, rnd)
    a.action = 'walk'
  } else if (roll < 0.8) {
    a.action = 'idle'
    a.timer = 2 + rnd() * 4
  } else {
    a.action = 'sleep'
    a.timer = 6 + rnd() * 8
  }
}

function tickKatya(k: KatyaActor, layout: VillageLayout, dt: number): void {
  if (k.action === 'walk' && k.target) {
    k.facingLeft = k.target.x < k.x
    if (stepTowards(k, k.target, SPEED.katya * dt)) {
      k.target = null
      k.action = 'idle'
      k.timer = 3 + Math.random() * 5
    }
    return
  }
  k.timer -= dt
  if (k.timer > 0) return

  // Visit a random yard 40% of the time, otherwise potter around the square.
  const yards = layout.yards
  if (yards.length && Math.random() < 0.4) {
    const y = yards[Math.floor(Math.random() * yards.length)]
    k.target = {
      x: y.roam.x + Math.random() * Math.max(1, y.roam.w - KATYA_SIZE.w),
      y: y.roam.y + Math.random() * Math.max(1, y.roam.h - KATYA_SIZE.h)
    }
  } else {
    const sq = layout.square
    k.target = {
      x: sq.x + 4 + Math.random() * (sq.w - KATYA_SIZE.w - 8),
      y: sq.y + 4 + Math.random() * (sq.h - KATYA_SIZE.h - 8)
    }
  }
  k.action = 'walk'
}
