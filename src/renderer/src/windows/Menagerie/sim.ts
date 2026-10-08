/**
 * Tiny behaviour sim for the critters roaming the yards. Only sessions that
 * are working or waiting on you roam; everyone else naps in the yard's dog
 * house or cat tree, which the canvas draws straight from the snapshot. A
 * critter whose session just went idle walks home before it disappears.
 * The sim is deterministic-ish (seeded per session id) so critters don't
 * teleport when the snapshot refreshes.
 */
import type { Critter, MenagerieSnapshot } from '../../../../shared/types/menagerie'
import { isNapping } from '../../../../shared/types/menagerie'
import { napEntrance, type Rect, type VillageLayout, type YardLayout } from './layout'
import { CRITTER_SIZE, KATYA_SIZE } from './sprites'

export type Action = 'idle' | 'walk' | 'chore' | 'sit'

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
    katya: { x: 0, y: 0, facingLeft: false, action: 'idle', timer: 2, target: null },
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

  // Keep Katya inside the world after a relayout
  const sq = layout.square
  if (sim.katya.x === 0 && sim.katya.y === 0) {
    sim.katya.x = sq.x + sq.w / 2 - KATYA_SIZE.w / 2
    sim.katya.y = sq.y + 8
  }
  sim.katya.x = Math.min(Math.max(sim.katya.x, 0), layout.world.w - KATYA_SIZE.w)
  sim.katya.y = Math.min(Math.max(sim.katya.y, 0), layout.world.h - KATYA_SIZE.h)
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
