import { useState } from 'react'
import type { Critter, MenagerieSnapshot, Yard } from '../../../../shared/types/menagerie'
import { isNapping } from '../../../../shared/types/menagerie'
import { FONT, INK, PAPER, STATUS_COLOR, byLongestWait, relativeTime, truncate } from './format'
import { Btn, Row, Section } from './panel'
import { NeedsYouRow } from './NeedsYouRow'
import { PetScene, SCENE_H, SCENE_W, type SceneView } from './PetScene'
import {
  CAT_TREE,
  CAT_TREE_PALETTE,
  FLOWER,
  LULU_PALETTE,
  LULU_PORTRAIT,
  LULU_PORTRAIT_HAPPY,
  LULU_PORTRAIT_SIZE,
  PROP_PALETTE,
  TREE,
  YARN,
  drawGrid,
  drawShadow,
  gridSize
} from './sprites'

interface Props {
  snapshot: MenagerieSnapshot
  onClose: () => void
  onOpenSession: (id: string) => void
  /** Opens a yard's Nap time list */
  onOpenNap: (repository: string) => void
}

const PALETTE = { ...PROP_PALETTE, ...LULU_PALETTE }
const MEOWS = ['Meow!', 'Mrrp?', 'Prrt!', 'Mew!', 'Mrrow!']
const CAT_TREE_SIZE = gridSize(CAT_TREE)

/** Lulu's corner of a yard: a picket fence, a cat tree twice the usual size, her yarn */
function drawCatCorner(ctx: CanvasRenderingContext2D, v: SceneView): void {
  const { s, offX, offY, cssW, cssH } = v
  ctx.fillStyle = '#7ec8f0'
  ctx.fillRect(0, 0, cssW, cssH)
  ctx.fillStyle = '#a9ddf7'
  ctx.fillRect(0, offY + 12 * s, cssW, 12 * s)
  ctx.fillStyle = '#3f8f4a'
  ctx.fillRect(0, offY + 28 * s, cssW, cssH)

  ctx.save()
  ctx.translate(offX, offY)
  ctx.fillStyle = '#357a3f'
  for (let ty = 30; ty < SCENE_H; ty += 6) {
    for (let tx = (ty / 6) % 2 === 0 ? 0 : 3; tx < SCENE_W; tx += 6) {
      ctx.fillRect((tx + 2) * s, (ty + 2) * s, s, s)
    }
  }
  ctx.fillStyle = '#d9c9a0'
  ctx.fillRect(-offX, 26 * s, cssW, s)
  ctx.fillRect(-offX, 29 * s, cssW, s)
  for (let fx = -Math.ceil(offX / s / 6) * 6; fx < SCENE_W + offX / s; fx += 6) {
    ctx.fillRect(fx * s, 24 * s, s, 7 * s)
  }
  drawGrid(ctx, TREE, PROP_PALETTE, (SCENE_W - 16) * s, 10 * s, s)
  drawGrid(ctx, FLOWER, PROP_PALETTE, 40 * s, 34 * s, s)
  drawGrid(ctx, FLOWER, PROP_PALETTE, 98 * s, 58 * s, s)
  const treeX = 10
  const treeY = SCENE_H - 6 - CAT_TREE_SIZE.h * 2
  drawShadow(ctx, treeX * s, treeY * s, CAT_TREE_SIZE.w, CAT_TREE_SIZE.h, 2 * s)
  drawGrid(ctx, CAT_TREE, { ...PROP_PALETTE, ...CAT_TREE_PALETTE }, treeX * s, treeY * s, 2 * s)
  drawGrid(ctx, YARN, PROP_PALETTE, 84 * s, 63 * s, s)
  ctx.restore()
}

/**
 * Lulu, a black long-haired cat with white mittens and whiskers and a pink
 * bow, manages the cats: her report lists every kitten that needs you, what
 * the working ones are doing, and where the rest are napping.
 */
export function LuluCloseUp({
  snapshot,
  onClose,
  onOpenSession,
  onOpenNap
}: Props): React.JSX.Element {
  const [pets, setPets] = useState(0)
  const [meows, setMeows] = useState(0)

  // Automation runs live in the square as decorations rather than cats, so Lulu leaves them to Katya
  const cats = snapshot.yards.flatMap((y) => y.critters).filter((c) => c.species === 'kitten')
  const waiting = cats.filter((c) => c.status === 'waiting').sort(byLongestWait)
  const working = cats.filter((c) => c.status === 'working')
  const napping = cats.filter((c) => isNapping(c.status))
  const napYards = snapshot.yards
    .map((yard) => ({
      yard,
      count: yard.critters.filter((c) => c.species === 'kitten' && isNapping(c.status)).length
    }))
    .filter((y) => y.count > 0)
    .sort((a, b) => b.count - a.count)

  const mood =
    waiting.length > 0
      ? `${waiting.length === 1 ? 'A cat is' : `${waiting.length} cats are`} waiting on you. Lulu is sitting with ${waiting.length === 1 ? 'it' : 'the one who has waited longest'} until you come.`
      : working.length > 0
        ? `${working.length === 1 ? 'One cat is' : `${working.length} cats are`} hard at work. Lulu is supervising from the cat trees.`
        : napping.length > 0
          ? 'Every cat is napping, so Lulu is taking it easy too.'
          : 'No cats in the village right now. Lulu has the cat trees to herself.'

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
      <PetScene
        frames={LULU_PORTRAIT}
        happyFrames={LULU_PORTRAIT_HAPPY}
        palette={PALETTE}
        size={LULU_PORTRAIT_SIZE}
        sounds={MEOWS}
        purr="prrr…"
        drawBackdrop={drawCatCorner}
        hint="click Lulu to make her meow · drag over her to pet"
        onClose={onClose}
        onPet={() => setPets((n) => n + 1)}
        onSound={() => setMeows((n) => n + 1)}
      />

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
        <div style={{ fontSize: 14, fontWeight: 700 }}>🐈‍⬛ Lulu&apos;s cat report</div>
        <div style={{ opacity: 0.6, fontSize: 10 }}>as of {relativeTime(snapshot.generatedAt)}</div>
        <div style={{ marginTop: 6, fontStyle: 'italic' }}>{mood}</div>

        <Section title="Cats">
          <CountRow label="Needs you" color={STATUS_COLOR.waiting} count={waiting.length} />
          <CountRow label="Working" color={STATUS_COLOR.working} count={working.length} />
          <CountRow label="Napping" color={STATUS_COLOR.idle} count={napping.length} />
        </Section>

        {waiting.length > 0 && (
          <Section title="Needs you">
            {waiting.map((c) => (
              <NeedsYouRow key={c.id} critter={c} onOpen={() => onOpenSession(c.id)} />
            ))}
          </Section>
        )}

        {working.length > 0 && (
          <Section title="Hard at work">
            {working.map((c) => (
              <WorkingRow key={c.id} critter={c} onOpen={() => onOpenSession(c.id)} />
            ))}
          </Section>
        )}

        {napYards.length > 0 && (
          <Section title="Napping">
            {napYards.map(({ yard, count }) => (
              <NapRow
                key={yard.repository}
                yard={yard}
                count={count}
                onOpen={() => onOpenNap(yard.repository)}
              />
            ))}
          </Section>
        )}

        <Section title="Lulu">
          <Row label="Pets">{pets === 0 ? 'none yet — she pretends not to mind' : pets}</Row>
          <Row label="Meows">{meows}</Row>
          <div style={{ marginTop: 6, opacity: 0.7 }}>
            Black long-haired cat · Manager of the cats · white mittens and whiskers · pink bow ·
            likes sunbeams and quiet terminals
          </div>
        </Section>
      </aside>
    </div>
  )
}

function CountRow({
  label,
  color,
  count
}: {
  label: string
  color: string
  count: number
}): React.JSX.Element {
  return (
    <Row label={label}>
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          background: color,
          border: `1px solid ${INK}`,
          marginRight: 4
        }}
      />
      <strong>{count}</strong>
    </Row>
  )
}

const ELLIPSIS: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
}

function WorkingRow({
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
        <span>🐱</span>
        <span style={ELLIPSIS} title={critter.name}>
          {critter.name} <span style={{ opacity: 0.6 }}>· {repoShort}</span>
        </span>
        <span style={{ flexShrink: 0 }}>
          <Btn onClick={onOpen}>Open</Btn>
        </span>
      </div>
      {critter.currentTool && (
        <div style={{ ...ELLIPSIS, marginLeft: 20, opacity: 0.7, fontStyle: 'italic' }}>
          “{truncate(critter.currentTool, 40)}”
        </div>
      )}
    </div>
  )
}

function NapRow({
  yard,
  count,
  onOpen
}: {
  yard: Yard
  count: number
  onOpen: () => void
}): React.JSX.Element {
  const repoShort = yard.repository.split('/').pop() ?? yard.repository
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
      <span>🏠</span>
      <span style={ELLIPSIS} title={yard.repository}>
        {repoShort}{' '}
        <span style={{ opacity: 0.6 }}>
          · {count} cat{count === 1 ? '' : 's'} napping
        </span>
      </span>
      <span style={{ flexShrink: 0 }}>
        <Btn onClick={onOpen}>Nap list</Btn>
      </span>
    </div>
  )
}
