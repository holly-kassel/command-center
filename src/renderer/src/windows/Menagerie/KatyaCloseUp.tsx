import { useState } from 'react'
import type { Automation, MenagerieSnapshot } from '../../../../shared/types/menagerie'
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
  byLongestWait,
  relativeTime
} from './format'
import { Btn, Row, Section } from './panel'
import { NeedsYouRow } from './NeedsYouRow'
import { PetScene, SCENE_H, SCENE_W, type SceneView } from './PetScene'
import {
  FLOWER,
  FOUNTAIN,
  KATYA_PALETTE,
  KATYA_PORTRAIT,
  KATYA_PORTRAIT_HAPPY,
  KATYA_PORTRAIT_SIZE,
  PROP_PALETTE,
  TREE,
  decorationFor,
  drawGrid,
  gridSize
} from './sprites'

interface Props {
  snapshot: MenagerieSnapshot
  onClose: () => void
  onOpenSession: (id: string) => void
}

const PALETTE = { ...PROP_PALETTE, ...KATYA_PALETTE, c: '#f2a7b5' }
const BARKS = ['Woof!', 'Arf!', 'Boof!', 'Awoo!', 'Yip!']

/** The town square behind Katya: sky, cobbles, the fountain, trees and flowers */
function drawTownSquare(ctx: CanvasRenderingContext2D, v: SceneView): void {
  const { s, offX, offY, cssW, cssH } = v
  ctx.fillStyle = '#7ec8f0'
  ctx.fillRect(0, 0, cssW, cssH)
  ctx.fillStyle = '#a9ddf7'
  ctx.fillRect(0, offY + 18 * s, cssW, 12 * s)
  ctx.fillStyle = '#3f8f4a'
  ctx.fillRect(0, offY + 30 * s, cssW, cssH)
  ctx.fillStyle = '#c7b58a'
  ctx.fillRect(0, offY + 40 * s, cssW, (SCENE_H - 40) * s)

  ctx.save()
  ctx.translate(offX, offY)
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
  ctx.restore()
}

export function KatyaCloseUp({ snapshot, onClose, onOpenSession }: Props): React.JSX.Element {
  const [pets, setPets] = useState(0)
  const [barks, setBarks] = useState(0)

  const { counts, yards, warnings, neighborhoods, automations } = snapshot
  const totalTasks = yards.reduce((n, y) => n + y.completedTasks, 0)
  const upgraded = yards.filter((y) => houseLevel(y.completedTasks) >= 1).length
  const maxed = yards.filter(
    (y) => houseLevel(y.completedTasks) >= HOUSE_UPGRADE_THRESHOLDS.length
  ).length
  // Automation runs live in the square, but they still wait on you like anyone else
  const critters = allCritters(snapshot)
  // Longest-waiting first — Katya herds you to whoever has been patient the longest.
  const needsYou = critters.filter((c) => c.status === 'waiting').sort(byLongestWait)
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
      <PetScene
        frames={KATYA_PORTRAIT}
        happyFrames={KATYA_PORTRAIT_HAPPY}
        palette={PALETTE}
        size={KATYA_PORTRAIT_SIZE}
        sounds={BARKS}
        drawBackdrop={drawTownSquare}
        hint="click Katya to make her bark · drag over her to pet"
        onClose={onClose}
        onPet={() => setPets((n) => n + 1)}
        onSound={() => setBarks((n) => n + 1)}
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
            Samoyed · Mayor of the Menagerie · minds the puppies while Lulu manages the cats · likes
            belly rubs and finished tasks
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
