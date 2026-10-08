/**
 * Tiny behaviour sim for the critters roaming the yards. Only sessions that
 * are working or waiting on you roam; everyone else naps in the yard's dog
 * house or cat tree, which the canvas draws straight from the snapshot. A
 * critter whose session just went idle walks home before it disappears.
 * Two managers walk the village too: Katya, the mayor, and Lulu, who looks
 * after the cats. The sim is deterministic-ish (seeded per session id) so
 * critters don't teleport when the snapshot refreshes.
 */
import type { Critter, MenagerieSnapshot } from '../../../../shared/types/menagerie'
import { isNapping } from '../../../../shared/types/menagerie'
import { napEntrance, type Point, type Rect, type VillageLayout, type YardLayout } from './layout'
import { CRITTER_SIZE, KATYA_SIZE, LULU_SIZE } from './sprites'

export type Action = 'idle' | 'walk' | 'chore' | 'sit' | 'sleep'

export interface Actor {
  id: string
  critter: Critter
  yard: YardLayout
  x: number
  y: number
  facingLeft: boolean
  action: Action
  /** seconds until the actor picks a new action; while heading home, until it stops walking */
  timer: number
  target: { x: number; y: number } | null
  /** Its session went idle: walking to the dog house or cat tree, then gone */
  headingHome: boolean
}

/** Katya or Lulu */
export interface ManagerActor {
  x: number
  y: number
  facingLeft: boolean
  action: Action
  /** Seconds until she picks somewhere new to go; counts down once she arrives */
  timer: number
  target: { x: number; y: number } | null
  /** What she does when she gets there */
  settle: Action
}

/** A yard with kittens in it, for Lulu's rounds */
export interface CatYard {
  yard: YardLayout
  /** Kittens asleep in its cat tree */
  napping: number
  /** Kittens up and about: working, or waiting on you */
  awake: number
}

export interface SimState {
  actors: Map<string, Actor>
  /** Mayor of the Menagerie: potters about the square and drops in on yards */
  katya: ManagerActor
  /** Manager of the cats: does the rounds of every yard with kittens */
  lulu: ManagerActor
  /** Yards with kittens, refreshed with every snapshot */
  cats: CatYard[]
  /** The kitten that has been waiting on you longest, which Lulu sits with */
  waitingKitten: string | null
  /** advances 4×/sec; sprites index frames from this */
  frame: number
  frameAcc: number
}

const SPRITE = CRITTER_SIZE.w
const SPEED = { puppy: 12, kitten: 14, katya: 10, lulu: 11 }
/** Give up walking home after this long and just pop into the nap spot */
const HOMEWARD_TIMEOUT_S = 8

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

export function createSim(): SimState {
  return {
    actors: new Map(),
    katya: {
      x: 0,
      y: 0,
      facingLeft: false,
      action: 'idle',
      timer: 2,
      target: null,
      settle: 'idle'
    },
    lulu: { x: 0, y: 0, facingLeft: true, action: 'idle', timer: 1, target: null, settle: 'idle' },
    cats: [],
    waitingKitten: null,
    frame: 0,
    frameAcc: 0
  }
}

/** Reconcile actors with a fresh snapshot/layout without resetting positions. */
export function syncSim(sim: SimState, snapshot: MenagerieSnapshot, layout: VillageLayout): void {
  const seen = new Set<string>()
  const yardByRepo = new Map(layout.yards.map((y) => [y.repository, y]))

  for (const yard of snapshot.yards) {
    const yl = yardByRepo.get(yard.repository)
    if (!yl) continue
    for (const critter of yard.critters) {
      const existing = sim.actors.get(critter.id)
      if (isNapping(critter.status)) {
        // Already asleep: the nap spot draws it. Just went idle: walk home first.
        if (!existing) continue
        seen.add(critter.id)
        if (!existing.headingHome) {
          existing.headingHome = true
          existing.timer = HOMEWARD_TIMEOUT_S
        }
        existing.critter = critter
        existing.yard = yl
        existing.target = napEntrance(yl, critter.species)
        existing.action = 'walk'
        continue
      }

      seen.add(critter.id)
      if (existing) {
        const statusChanged = existing.critter.status !== critter.status || existing.headingHome
        const yardChanged = existing.yard.repository !== yl.repository
        existing.critter = critter
        existing.yard = yl
        existing.headingHome = false
        if (statusChanged || yardChanged) {
          existing.timer = 0
          existing.target = null
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
        headingHome: false
      })
    }
  }

  for (const id of [...sim.actors.keys()]) {
    if (!seen.has(id)) sim.actors.delete(id)
  }

  sim.cats = []
  for (const yard of snapshot.yards) {
    const yl = yardByRepo.get(yard.repository)
    const kittens = yard.critters.filter((c) => c.species === 'kitten')
    if (!yl || kittens.length === 0) continue
    const napping = kittens.filter((c) => isNapping(c.status)).length
    sim.cats.push({ yard: yl, napping, awake: kittens.length - napping })
  }

  // A kitten that starts waiting on you gets Lulu straight away
  const waiting = longestWaitingKitten(sim)?.id ?? null
  if (waiting && waiting !== sim.waitingKitten) {
    sim.lulu.target = null
    sim.lulu.action = 'idle'
    sim.lulu.timer = 0
  }
  sim.waitingKitten = waiting

  // Place the managers in the square on first sight; keep them inside the world after a relayout
  const sq = layout.square
  if (sim.katya.x === 0 && sim.katya.y === 0) {
    sim.katya.x = sq.x + sq.w / 2 - KATYA_SIZE.w / 2
    sim.katya.y = sq.y + 8
  }
  if (sim.lulu.x === 0 && sim.lulu.y === 0) {
    sim.lulu.x = sq.x + sq.w / 2 + 8
    sim.lulu.y = sq.y + sq.h / 2 + 6
  }
  keepInside(sim.katya, KATYA_SIZE, layout)
  keepInside(sim.lulu, LULU_SIZE, layout)
}

function keepInside(m: ManagerActor, size: { w: number; h: number }, layout: VillageLayout): void {
  m.x = Math.min(Math.max(m.x, 0), layout.world.w - size.w)
  m.y = Math.min(Math.max(m.y, 0), layout.world.h - size.h)
}

/** The roaming kitten that has been waiting on you longest, if any */
function longestWaitingKitten(sim: SimState): Actor | null {
  let best: Actor | null = null
  let bestAt = Infinity
  for (const a of sim.actors.values()) {
    const c = a.critter
    if (a.headingHome || c.species !== 'kitten' || c.status !== 'waiting') continue
    const at = Date.parse(c.pendingPermission?.requestedAt ?? c.lastActivityAt)
    if (best === null || at < bestAt) {
      best = a
      bestAt = at
    }
  }
  return best
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

  for (const actor of sim.actors.values()) tickActor(sim, actor, dt)
  tickKatya(sim.katya, layout, dt)
  tickLulu(sim, layout, dt)
}

function tickActor(sim: SimState, a: Actor, dt: number): void {
  const rnd = Math.random
  const speed = SPEED[a.critter.species]

  if (a.headingHome) {
    a.timer -= dt
    const home = a.target ?? napEntrance(a.yard, a.critter.species)
    a.facingLeft = home.x < a.x
    a.action = 'walk'
    if (stepTowards(a, home, speed * dt) || a.timer <= 0) sim.actors.delete(a.id)
    return
  }

  if (a.critter.status === 'waiting') {
    a.action = 'sit'
    return
  }

  // Working: mostly keep doing the chore, wander to a new spot now and then.
  if (a.action === 'walk' && a.target) {
    a.facingLeft = a.target.x < a.x
    if (stepTowards(a, a.target, speed * dt)) {
      a.target = null
      a.action = 'chore'
      a.timer = 6 + rnd() * 8
    }
    return
  }

  a.timer -= dt
  if (a.timer > 0) return
  if (a.action !== 'chore' || rnd() < 0.3) {
    a.target = randomPoint(a.yard.roam, rnd)
    a.action = 'walk'
  } else {
    a.timer = 5 + rnd() * 6
  }
}

function tickKatya(k: ManagerActor, layout: VillageLayout, dt: number): void {
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

// ── Lulu's rounds ─────────────────────────────────────────────────

function sendLulu(l: ManagerActor, target: Point, settle: Action, stay: number): void {
  l.target = target
  l.action = 'walk'
  l.settle = settle
  l.timer = stay
}

function spotIn(rect: Rect, rnd: () => number): Point {
  return {
    x: rect.x + rnd() * Math.max(1, rect.w - LULU_SIZE.w),
    y: rect.y + rnd() * Math.max(1, rect.h - LULU_SIZE.h)
  }
}

/** Sit right next to a kitten, feet level with its paws, without leaving its yard */
function besideKitten(a: Actor): Point {
  const cell = a.yard.cell
  const right = a.x + CRITTER_SIZE.w + 1
  const x = right + LULU_SIZE.w <= cell.x + cell.w ? right : a.x - LULU_SIZE.w - 1
  return {
    x: Math.max(cell.x, x),
    y: Math.max(cell.y, a.y + CRITTER_SIZE.h - LULU_SIZE.h)
  }
}

/** On the grass at the foot of the yard's cat tree, keeping an eye on the nappers */
function besideCatTree(yard: YardLayout): Point {
  return { x: yard.nap.catTree.x - 2, y: yard.roam.y }
}

/**
 * Lulu manages the cats. A kitten waiting on you comes first: she goes and
 * sits with the one that has waited longest. Otherwise she does the rounds of
 * the yards with kittens (by the cat tree when some are napping), or heads
 * back to the square, where she curls up when no cat is up and about.
 */
function tickLulu(sim: SimState, layout: VillageLayout, dt: number): void {
  const l = sim.lulu
  if (l.action === 'walk' && l.target) {
    l.facingLeft = l.target.x < l.x
    if (stepTowards(l, l.target, SPEED.lulu * dt)) {
      l.target = null
      l.action = l.settle
    }
    return
  }
  l.timer -= dt
  if (l.timer > 0) return

  const rnd = Math.random
  const kitten = longestWaitingKitten(sim)
  if (kitten) {
    sendLulu(l, besideKitten(kitten), 'sit', 5 + rnd() * 4)
    return
  }
  if (sim.cats.length && rnd() < 0.55) {
    const cat = sim.cats[Math.floor(rnd() * sim.cats.length)]
    const byTree = cat.napping > 0 && (cat.awake === 0 || rnd() < 0.5)
    sendLulu(l, byTree ? besideCatTree(cat.yard) : spotIn(cat.yard.roam, rnd), 'sit', 4 + rnd() * 4)
    return
  }
  const sq = layout.square
  const nap = !sim.cats.some((c) => c.awake > 0) && rnd() < 0.4
  const spot = spotIn({ x: sq.x + 4, y: sq.y + 4, w: sq.w - 8, h: sq.h - 8 }, rnd)
  sendLulu(l, spot, nap ? 'sleep' : 'idle', nap ? 10 + rnd() * 8 : 3 + rnd() * 4)
}
