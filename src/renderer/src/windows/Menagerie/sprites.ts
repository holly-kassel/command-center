/**
 * Hand-authored pixel sprites for Katya's Menagerie.
 *
 * Every sprite is a list of equal-length strings; each character indexes a
 * palette entry. '.' is transparent. Sprites face RIGHT; the renderer flips
 * them horizontally when a critter walks left.
 *
 * Palette keys:
 *   b  base coat         d  dark coat (shading)     l  light coat (highlight)
 *   w  white (muzzle)    e  eye                     n  nose
 *   p  pink (ear, yarn)  c  collar                  x  accent (dirt, zzz)
 *
 * Critters are 12×12 in a Stardew-style 3/4 chibi view (big round head,
 * tucked body, stubby legs) with no hard outline — shading comes from the
 * dark coat tone and a ground shadow drawn by the canvas.
 */

export type Grid = readonly string[]
export type Palette = Record<string, string>

export interface SpriteSet {
  idle: Grid[]
  walk: Grid[]
  chore: Grid[]
  sit: Grid[]
  sleep: Grid[]
}

// ── Puppy (12×12, 3/4 chibi view) ───────────────────────────────

export const CRITTER_SIZE = { w: 12, h: 12 } as const
export const KATYA_SIZE = { w: 16, h: 14 } as const

const PUPPY_STAND: Grid = [
  '............',
  '....lllbb...',
  '..dbbbbbbbbd',
  '.ddbbbbbbbbd',
  '.ddbbebbbebd',
  '..dbbbwnwbb.',
  '...bbbwwwb..',
  '...dcccccd..',
  '..dbbbbbbbb.',
  '.dbbbbbbbbd.',
  '...bb..bb...',
  '...dd..dd...'
]

const PUPPY_WALK_2: Grid = [
  '....lllbb...',
  '..dbbbbbbbbd',
  '.ddbbbbbbbbd',
  '.ddbbebbbebd',
  '..dbbbwnwbb.',
  '...bbbwwwb..',
  '...dcccccd..',
  '..dbbbbbbbb.',
  '.dbbbbbbbbd.',
  '..bb....bb..',
  '..bb....bb..',
  '..dd....dd..'
]

// Digging: rump up on the left, nose down on the right, dirt flying behind
const PUPPY_DIG_1: Grid = [
  '............',
  '.d..........',
  '.dbbbbbb....',
  '.bbbbbbbbbd.',
  '.bbbccbbbbbd',
  '..bbbbbbebbd',
  '..bb.dbbbbbd',
  '..bb.dbbwnwd',
  '..dd.dbbwwd.',
  '.x...dd.dd..',
  'x.x.........',
  '............'
]

const PUPPY_DIG_2: Grid = [
  '............',
  '..d.........',
  '.dbbbbbb....',
  '.bbbbbbbbbd.',
  '.bbbccbbbbbd',
  '..bbbbbbebbd',
  '..bb.dbbbbbd',
  '..bb.dbbwnwd',
  '..dd.dbbwwd.',
  '...x.dd.dd..',
  '.x.x........',
  'x...........'
]

const PUPPY_SIT: Grid = [
  '............',
  '....lllbb...',
  '..dbbbbbbbbd',
  '.ddbbbbbbbbd',
  '.ddbbebbbebd',
  '..dbbbwnwbb.',
  '...bbbwwwb..',
  '...dcccccd..',
  '..bbbbwwbbb.',
  '.dbbbbwwbbbb',
  '.dbbbbbbbbbb',
  '..dd..dd.dd.'
]

const PUPPY_SLEEP: Grid = [
  '............',
  '............',
  '............',
  '............',
  '............',
  '....bbbbb...',
  '..bbbbbbbbd.',
  '.bbbbbbbbbbd',
  '.bbcccbbbddd',
  '.bbbbbbbbdbd',
  '.dbbbbbbbwnd',
  '..ddddddddd.'
]

export const PUPPY: SpriteSet = {
  idle: [PUPPY_STAND, PUPPY_STAND, PUPPY_STAND, PUPPY_WALK_2],
  walk: [PUPPY_STAND, PUPPY_WALK_2],
  chore: [PUPPY_DIG_1, PUPPY_DIG_2],
  sit: [PUPPY_SIT],
  sleep: [PUPPY_SLEEP]
}

// ── Kitten (12×12, 3/4 chibi view) ──────────────────────────────

const KITTEN_STAND: Grid = [
  '............',
  '...d...d....',
  '...dpbbpd...',
  '...blbbbbb..',
  '...bebbebb..',
  '...bbbwnwb..',
  '....bbwwb...',
  '....cccc....',
  '.d.bbbbbbb..',
  '.dbbbbbbbbd.',
  '...bb...bb..',
  '...dd...dd..'
]

const KITTEN_WALK_2: Grid = [
  '...d...d....',
  '...dpbbpd...',
  '...blbbbbb..',
  '...bebbebb..',
  '...bbbwnwb..',
  '....bbwwb...',
  '....cccc....',
  '..d.bbbbbbb.',
  '.dbbbbbbbbd.',
  '..bb....bb..',
  '..bb....bb..',
  '..dd....dd..'
]

// Batting a pink ball of yarn
const KITTEN_PLAY_1: Grid = [
  '............',
  '...d...d....',
  '...dpbbpd...',
  '...blbbbbb..',
  '...bebbebb..',
  '...bbbwnwb..',
  '....bbwwb...',
  '....cccc....',
  '.d.bbbbbbb..',
  '.dbbbbbbbbbb',
  '...bb..bb.pp',
  '...dd..dd.pp'
]

const KITTEN_PLAY_2: Grid = [
  '............',
  '...d...d....',
  '...dpbbpd...',
  '...blbbbbb..',
  '...bebbebb..',
  '...bbbwnwb..',
  '....bbwwb...',
  '....cccc....',
  '.d.bbbbbbb..',
  '.dbbbbbbbbbb',
  '...bb..bb..b',
  '...dd..ddpp.'
]

const KITTEN_SIT: Grid = [
  '............',
  '...d...d....',
  '...dpbbpd...',
  '...blbbbbb..',
  '...bebbebb..',
  '...bbbwnwb..',
  '....bbwwb...',
  '....cccc....',
  '...bbbwwbb..',
  '..bbbbwwbbb.',
  '.dbbbbbbbbb.',
  'dd.dd...dd..'
]

const KITTEN_SLEEP: Grid = [
  '............',
  '............',
  '............',
  '............',
  '............',
  '.........d.d',
  '....bbbbbdpd',
  '..bbbbbbbbbb',
  '.bbcccbbbbbb',
  '.bbbbbbbbdbd',
  '.dbbbbbbbwnb',
  '..dddddddddd'
]

export const KITTEN: SpriteSet = {
  idle: [KITTEN_STAND, KITTEN_STAND, KITTEN_WALK_2, KITTEN_STAND],
  walk: [KITTEN_STAND, KITTEN_WALK_2],
  chore: [KITTEN_PLAY_1, KITTEN_PLAY_2],
  sit: [KITTEN_SIT],
  sleep: [KITTEN_SLEEP]
}

// ── Portraits (24×24) — close-up view, bigger head, sparkly eyes ──

export const PORTRAIT_SIZE = { w: 24, h: 24 } as const

const PUPPY_PORTRAIT_1: Grid = [
  '........................',
  '........................',
  '......llllbbbb..........',
  '....ddbbbbbbbbbbd.......',
  '...ddbbbbbbbbbbbbbd.....',
  '..dddbbbbbbbbbbbbbbd....',
  '..dddbbbbbbbbbbbbbbbd...',
  '..ddbbbbbbbbbbbbbbbbd...',
  '..ddbbbbeebbbbbbeebbd...',
  '..ddbbbbewbbbbbbewbbd...',
  '...dbbbbeebbbbbbeebbd...',
  '...dbbbbbbbbwwwwbbbbd...',
  '....bbbbbbbwwnnwwbbb....',
  '....dbbbbbbwwwwwwbb.....',
  '.....dbbbbbbwwwwbbb.....',
  '......dbbccccccccbd.....',
  '.....dbbbbbbbbbbbbbd....',
  '....dbbbbbbbbbbbbbbbd...',
  '...dbbbbbbbbbbbbbbbbbd..',
  '...dbbbbbbbbbbbbbbbbbd..',
  '....bbbbbbbbbbbbbbbbb...',
  '.....bbbb......bbbb.....',
  '.....bbbb......bbbb.....',
  '.....dddd......dddd.....'
]

// Blink + tail wag
const PUPPY_PORTRAIT_2: Grid = [
  '........................',
  '........................',
  '......llllbbbb..........',
  '....ddbbbbbbbbbbd.......',
  '...ddbbbbbbbbbbbbbd.....',
  '..dddbbbbbbbbbbbbbbd....',
  '..dddbbbbbbbbbbbbbbbd...',
  '..ddbbbbbbbbbbbbbbbbd...',
  '..ddbbbbbbbbbbbbbbbbd...',
  '..ddbbbbeebbbbbbeebbd...',
  '...dbbbbbbbbbbbbbbbbd...',
  '...dbbbbbbbbwwwwbbbbd...',
  '....bbbbbbbwwnnwwbbb....',
  '....dbbbbbbwwwwwwbb.....',
  '.....dbbbbbbwwwwbbb.....',
  '......dbbccccccccbd.....',
  '.....dbbbbbbbbbbbbbd....',
  '....dbbbbbbbbbbbbbbbddb.',
  '...dbbbbbbbbbbbbbbbbbdb.',
  '...dbbbbbbbbbbbbbbbbbd..',
  '....bbbbbbbbbbbbbbbbb...',
  '.....bbbb......bbbb.....',
  '.....bbbb......bbbb.....',
  '.....dddd......dddd.....'
]

const KITTEN_PORTRAIT_1: Grid = [
  '........................',
  '....d..........d........',
  '....dd........dd........',
  '....dpd......dpd........',
  '....dppd....dppd........',
  '....dbppbbbbppbbd.......',
  '...dbbbbbbbbbbbbbd......',
  '..dbbbbbbbbbbbbbbbd.....',
  '..dbbbbbbbbbbbbbbbbd....',
  '..dbbbeebbbbbbeebbbd....',
  '..dbbbewbbbbbbewbbbd....',
  '..dbbbeebbbbbbeebbbd....',
  '..dbbbbbbbwwwwbbbbbd....',
  '...dbbbbbwwpnwwbbbd.....',
  '...dbbbbbwwwwwwbbbd.....',
  '....dbbbbbwwwwbbbd......',
  '.....dbccccccccbd.......',
  '....dbbbbbbbbbbbbd......',
  '...dbbbbbbbbbbbbbbd.....',
  '...dbbbbbbbbbbbbbbd.d...',
  '...dbbbbbbbbbbbbbbddb...',
  '....bbbb......bbbbbbd...',
  '....bbbb......bbbb......',
  '....dddd......dddd......'
]

// Blink + tail curl
const KITTEN_PORTRAIT_2: Grid = [
  '........................',
  '....d..........d........',
  '....dd........dd........',
  '....dpd......dpd........',
  '....dppd....dppd........',
  '....dbppbbbbppbbd.......',
  '...dbbbbbbbbbbbbbd......',
  '..dbbbbbbbbbbbbbbbd.....',
  '..dbbbbbbbbbbbbbbbbd....',
  '..dbbbbbbbbbbbbbbbbd....',
  '..dbbbeebbbbbbeebbbd....',
  '..dbbbbbbbbbbbbbbbbd....',
  '..dbbbbbbbwwwwbbbbbd....',
  '...dbbbbbwwpnwwbbbd.....',
  '...dbbbbbwwwwwwbbbd.....',
  '....dbbbbbwwwwbbbd......',
  '.....dbccccccccbd.......',
  '....dbbbbbbbbbbbbd......',
  '...dbbbbbbbbbbbbbbd.....',
  '...dbbbbbbbbbbbbbbd.....',
  '...dbbbbbbbbbbbbbbbdd...',
  '....bbbb......bbbbbbd...',
  '....bbbb......bbbbd.....',
  '....dddd......dddd......'
]

export const PUPPY_PORTRAIT: Grid[] = [
  PUPPY_PORTRAIT_1,
  PUPPY_PORTRAIT_1,
  PUPPY_PORTRAIT_1,
  PUPPY_PORTRAIT_2
]
export const KITTEN_PORTRAIT: Grid[] = [
  KITTEN_PORTRAIT_1,
  KITTEN_PORTRAIT_1,
  KITTEN_PORTRAIT_1,
  KITTEN_PORTRAIT_2
]

// ── Katya (Samoyed, 16×14) — still the big fluffy boss ───────────

const KATYA_1: Grid = [
  '...dd......dd...',
  '..dpdbbbbbbdpd..',
  '..dbbbbbbbbbbd..',
  '.dbbbebbbbbebbd.',
  '.dbbbbbbwwwbbbd.',
  '.dbbbbbwwnwwbbd.',
  'd.dbbbbdwpwdbd..',
  'dldbbccccccbbbd.',
  'dlbbbbbbbbbbbbbd',
  'dbbbbbbbbbbbbbbd',
  '.dbbbbbbbbbbbbd.',
  '..bbbbbbbbbbbb..',
  '...bbb.....bbb..',
  '...ddd.....ddd..'
]

const KATYA_2: Grid = [
  '...dd......dd...',
  '..dpdbbbbbbdpd..',
  '..dbbbbbbbbbbd..',
  '.dbbbebbbbbebbd.',
  '.dbbbbbbwwwbbbd.',
  '.dbbbbbwwnwwbbd.',
  '..dbbbbdwpwdbd..',
  'd.dbbccccccbbbd.',
  'dlbbbbbbbbbbbbbd',
  'dbbbbbbbbbbbbbbd',
  '.dbbbbbbbbbbbbd.',
  '..bbbbbbbbbbbb..',
  '..bbb.......bbb.',
  '..ddd.......ddd.'
]

const KATYA_SIT: Grid = [
  '...dd......dd...',
  '..dpdbbbbbbdpd..',
  '..dbbbbbbbbbbd..',
  '.dbbbebbbbbebbd.',
  '.dbbbbbbwwwbbbd.',
  '.dbbbbbwwnwwbbd.',
  '..dbbbbdwpwdbd..',
  '..dbbccccccbbbd.',
  '..dbbbbwwwbbbbd.',
  '.dlbbbbwwwbbbbbd',
  'dlbbbbbwwwbbbbbd',
  'dbbbbbbbbbbbbbbd',
  '.dbbbbbbbbbbbbd.',
  '..ddd..ddd..ddd.'
]

const KATYA_SLEEP: Grid = [
  '................',
  '................',
  '................',
  '................',
  '...........dp.dp',
  '.....bbbbbbdbbdb',
  '...bbbbbbbbbbbbb',
  '..bbbbbbbbbbbbbb',
  '.dbbbbccccbbdbdb',
  '.dbbbbbbbbbbbwwn',
  '.dbbbbbbbbbbbwpw',
  '..dddddddddddd..',
  '................',
  '................'
]

export const KATYA: SpriteSet = {
  idle: [KATYA_1, KATYA_1, KATYA_1, KATYA_2],
  walk: [KATYA_1, KATYA_2],
  chore: [KATYA_1, KATYA_2],
  sit: [KATYA_SIT],
  sleep: [KATYA_SLEEP]
}

// ── Katya portrait (28×24) for the town-square close-up ─────────

export const KATYA_PORTRAIT_SIZE = { w: 28, h: 24 } as const

// Tail plume up
const KATYA_PORTRAIT_1: Grid = [
  '.....dd..............dd.....',
  '....dpdbbbbbbbbbbbbbbdpd....',
  '...dbbbbbbbbbbbbbbbbbbbbd...',
  '..dbbbbbbbbbbbbbbbbbbbbbbd..',
  '..dbbbbbbbbbbbbbbbbbbbbbbd..',
  '.dbbbbbbelbbbbbbbbbelbbbbbd.',
  '.dbbbbbbeebbbbbbbbbeebbbbbd.',
  '.dbbbbbbbbbbwwwwwbbbbbbbbbd.',
  '.dbbbbbbbbbwwwnnwwwbbbbbbbd.',
  '.dbbbbbbbbbwwwwwwwwbbbbbbbd.',
  '..dbbbbbbbdwwwwwwwwdbbbbbd..',
  '..dbbbbbbbbdwwppwwdbbbbbbd..',
  '...dbbbbbbbbbbppbbbbbbbbd...',
  '.dd.dbbccccccccccccccbbd....',
  'dlbddbbbbbbbbbbbbbbbbbbbd...',
  'dlbbbbbbbbbbbbwwwwbbbbbbbd..',
  'dlbbbbbbbbbbbbwwwwwbbbbbbd..',
  '.dbbbbbbbbbbbbwwwwwbbbbbbd..',
  '..ddbbbbbbbbbbbwwwbbbbbbbd..',
  '....dbbbbbbbbbbbbbbbbbbbbd..',
  '.....dbbbbbbbbbbbbbbbbbbd...',
  '.....bbbbb.......bbbbb......',
  '.....bbbbb.......bbbbb......',
  '.....ddddd.......ddddd......'
]

// Tail plume down (wag)
const KATYA_PORTRAIT_2: Grid = [
  '.....dd..............dd.....',
  '....dpdbbbbbbbbbbbbbbdpd....',
  '...dbbbbbbbbbbbbbbbbbbbbd...',
  '..dbbbbbbbbbbbbbbbbbbbbbbd..',
  '..dbbbbbbbbbbbbbbbbbbbbbbd..',
  '.dbbbbbbelbbbbbbbbbelbbbbbd.',
  '.dbbbbbbeebbbbbbbbbeebbbbbd.',
  '.dbbbbbbbbbbwwwwwbbbbbbbbbd.',
  '.dbbbbbbbbbwwwnnwwwbbbbbbbd.',
  '.dbbbbbbbbbwwwwwwwwbbbbbbbd.',
  '..dbbbbbbbdwwwwwwwwdbbbbbd..',
  '..dbbbbbbbbdwwppwwdbbbbbbd..',
  '...dbbbbbbbbbbppbbbbbbbbd...',
  '....dbbccccccccccccccbbd....',
  '....dbbbbbbbbbbbbbbbbbbbd...',
  '...dbbbbbbbbbbwwwwbbbbbbbd..',
  '.ddbbbbbbbbbbbwwwwwbbbbbbd..',
  'dlbbbbbbbbbbbbwwwwwbbbbbbd..',
  'dlbbbbbbbbbbbbbwwwbbbbbbbd..',
  'dlbddbbbbbbbbbbbbbbbbbbbbd..',
  '.dd..dbbbbbbbbbbbbbbbbbbd...',
  '.....bbbbb.......bbbbb......',
  '.....bbbbb.......bbbbb......',
  '.....ddddd.......ddddd......'
]

/** Happy squint (^‿^) for when she's being petted */
function happyEyes(grid: Grid): Grid {
  return grid.map((row, i) => {
    if (i === 5) return row.replace('el', 'ee').replace('el', 'ee')
    if (i === 6) return row.replace('bbeebb', 'bebbeb').replace('bbeebb', 'bebbeb')
    return row
  })
}

export const KATYA_PORTRAIT: Grid[] = [KATYA_PORTRAIT_1, KATYA_PORTRAIT_2]
export const KATYA_PORTRAIT_HAPPY: Grid[] = KATYA_PORTRAIT.map(happyEyes)

// ── Props ────────────────────────────────────────────────────────

/** 32×28 cottage; palette: r roof, R roof dark, l wall, L wall dark, o door, g glass, s step */
export const HOUSE: Grid = [
  '..............RR................',
  '.............RrrR...............',
  '............RrrrrR..............',
  '...........RrrrrrrR.............',
  '..........RrrrrrrrrR............',
  '.........RrrrrrrrrrrR...........',
  '........RrrrrrrrrrrrrR..........',
  '.......RrrrrrrrrrrrrrrR.........',
  '......RrrrrrrrrrrrrrrrrR........',
  '.....RrrrrrrrrrrrrrrrrrrR.......',
  '....RrrrrrrrrrrrrrrrrrrrrR......',
  '...RRRRRRRRRRRRRRRRRRRRRRRR.....',
  '....LllllllllllllllllllllL......',
  '....LllllllllllllllllllllL......',
  '....LlLgggLlllllllllLgggLL......',
  '....LlLgggLllllLooLlLgggLL......',
  '....LlLgggLllllLooLlLgggLL......',
  '....LlLLLLLllllLooLlLLLLLL......',
  '....LllllllllllLooLllllllL......',
  '....LllllllllllLooLllllllL......',
  '....LllllllllllLooLllllllL......',
  '....LllllllllllLooLllllllL......',
  '....LLLLLLLLLLLLooLLLLLLLL......',
  '...ssssssssssssssssssssssss.....',
  '................................',
  '................................',
  '................................',
  '................................'
]

/** 12×16 tree; palette: t leaf, T leaf dark, k trunk */
export const TREE: Grid = [
  '....TTTT....',
  '...TttttT...',
  '..TttttttT..',
  '.TttttttttT.',
  '.TttttttttT.',
  'TttttttttttT',
  'TttttttttttT',
  'TttttttttttT',
  '.TttttttttT.',
  '.TttttttttT.',
  '..TttttttT..',
  '...TTkkTT...',
  '.....kk.....',
  '.....kk.....',
  '.....kk.....',
  '....kkkk....'
]

/** 5×6 flower; palette: f petal, y center, t stem */
export const FLOWER: Grid = ['.f.f.', 'fyfyf', '.f.f.', '..t..', '..t..', '.ttt.']

/** 7×7 question mark; palette: q */
export const QUESTION: Grid = [
  '.qqqq..',
  'q....q.',
  '.....q.',
  '...qq..',
  '..q....',
  '.......',
  '..q....'
]

/** 6×5 "z"; palette: z */
export const ZZZ: Grid = ['zzzzz.', '....z.', '..z...', 'z.....', 'zzzzz.']

/** 8×6 fountain basin for the town square; palette: s stone, W water */
export const FOUNTAIN: Grid = [
  '...WW...',
  '..WWWW..',
  '.sWWWWs.',
  'ssWWWWss',
  'sWWWWWWs',
  'ssssssss'
]

// ── House upgrades (drawn over HOUSE as completed tasks accrue) ──

/** 8×6 window flower box; palette: x wood, f/y blooms, t leaves */
export const FLOWER_BOX: Grid = [
  '.f.y.f..',
  'yftftfy.',
  'xxxxxxxx',
  'xxxxxxxx',
  '........',
  '........'
]

/** 4×6 brick chimney; palette: R brick, s cap */
export const CHIMNEY: Grid = ['ssss', '.RR.', '.RR.', '.RR.', '.RR.', '.RR.']

/** 2 smoke puff frames; palette: m */
export const SMOKE: Grid[] = [
  ['..m.', '.mm.', 'm.m.', '.m..'],
  ['.m..', 'm.m.', '.mm.', '..m.']
]

/** 3×7 lantern on a post; palette: k post, q glow, G dark glow */
/** Lean-to side room bolted onto the cottage's right wall; palette: r/R roof, l/L wall, g glass, s step */
export const ANNEX: Grid = [
  'RR......',
  'RrR.....',
  'RrrR....',
  'RrrrR...',
  'RrrrrR..',
  'RrrrrrR.',
  'RRRRRRRR',
  'LlllllL.',
  'LlLggLL.',
  'LlLggLL.',
  'LlLLLLL.',
  'sssssss.'
]

export const LANTERN: Grid = ['.q.', 'qGq', 'qqq', '.k.', '.k.', '.k.', 'kkk']

/** 7×7 star for the gable; palette: q gold */
export const STAR: Grid = [
  '...q...',
  '...q...',
  'qqqqqqq',
  '.qqqqq.',
  '..qqq..',
  '.q...q.',
  '.......'
]

/** 7×6 heart that floats above playing critters; palette: h */
/** 6×5 trailing sub-agent kitten; palette: b body, B dark, e eye */
export const MINI_KITTEN: Grid[] = [
  ['b.b...', 'bbbb..', 'bebe.b', 'bbbbbb', 'b..b..'],
  ['b.b...', 'bbbb.b', 'bebebb', 'bbbbb.', '.b..b.']
]

/** 5×7 streak flame; palette: F outer, O inner, y core */
export const FLAME: Grid[] = [
  ['..F..', '..F..', '.FOF.', '.FOF.', 'FOyOF', 'FOyOF', '.FFF.'],
  ['.F...', '..F..', '.FOF.', 'FOOF.', 'FOyOF', 'FOyOF', '.FFF.']
]

export const HEART: Grid = ['.hh.hh.', 'hhhhhhh', 'hhhhhhh', '.hhhhh.', '..hhh..', '...h...']

/** 4×5 music note; palette: h */
export const NOTE: Grid = ['..hh', '..h.', '..h.', 'hhh.', 'hhh.']

// ── Palettes ─────────────────────────────────────────────────────

export const PUPPY_COATS: Palette[] = [
  {
    b: '#c98b4e',
    d: '#8a5a2a',
    l: '#e0b07a',
    w: '#f6e8d3',
    e: '#1a1a1a',
    n: '#2a1a12',
    p: '#e8a0a0'
  }, // golden
  {
    b: '#4a3b35',
    d: '#2e221e',
    l: '#6a5750',
    w: '#d8cfc8',
    e: '#f2f2f2',
    n: '#000000',
    p: '#c98888'
  }, // chocolate
  {
    b: '#e9e2d8',
    d: '#b5a99a',
    l: '#ffffff',
    w: '#ffffff',
    e: '#1a1a1a',
    n: '#2a2a2a',
    p: '#f0b0b0'
  }, // cream
  {
    b: '#8a8f99',
    d: '#5a5f6b',
    l: '#aab0ba',
    w: '#e3e6ec',
    e: '#1a1a1a',
    n: '#111111',
    p: '#e0a0a8'
  } // blue-gray
]

export const KITTEN_COATS: Palette[] = [
  {
    b: '#e07a3e',
    d: '#a0501f',
    l: '#f0a070',
    w: '#fff0e0',
    e: '#2f8f3a',
    n: '#d06070',
    p: '#f0a0a0'
  }, // orange tabby
  {
    b: '#2b2b33',
    d: '#16161c',
    l: '#4a4a55',
    w: '#dcdce4',
    e: '#e6c84a',
    n: '#5a4a52',
    p: '#a07080'
  }, // black
  {
    b: '#9b9ba8',
    d: '#6a6a7a',
    l: '#c0c0cc',
    w: '#f0f0f6',
    e: '#5fb0d8',
    n: '#c48090',
    p: '#f0b0b8'
  }, // gray
  {
    b: '#f0e6d2',
    d: '#b8a888',
    l: '#fff8ea',
    w: '#ffffff',
    e: '#4a90d0',
    n: '#d08090',
    p: '#f6b8c0'
  } // cream siamese-ish
]

export const KATYA_PALETTE: Palette = {
  b: '#f7f7fb',
  d: '#c9ccd9',
  l: '#ffffff',
  w: '#f3ece0',
  e: '#1b1b1f',
  n: '#1b1b1f',
  p: '#f4a4b0'
}

export const COLLAR_COLORS = {
  cli: '#43c466',
  autopilot: '#4f8cff',
  unknown: '#c9a24f'
} as const

export const PROP_PALETTE: Palette = {
  r: '#b8574a',
  R: '#6e2f28',
  l: '#f1e2c4',
  L: '#8a7352',
  o: '#5c3b23',
  g: '#9fd3ff',
  s: '#9a9a9a',
  t: '#4caf50',
  T: '#2e6b33',
  k: '#6b4226',
  f: '#f27da6',
  y: '#ffe066',
  q: '#ffd84d',
  z: '#9fb7ff',
  W: '#6fc3ff',
  x: '#8c6239',
  m: '#d8dde6',
  G: '#f0a030',
  h: '#ff6b8a',
  F: '#ff7a2f',
  O: '#ffb347',
  b: '#c9c9d4',
  B: '#6b6b7a',
  e: '#2a2320'
}

// ── Drawing ──────────────────────────────────────────────────────

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  palette: Palette,
  x: number,
  y: number,
  scale: number,
  flip = false,
  alpha = 1
): void {
  const prevAlpha = ctx.globalAlpha
  ctx.globalAlpha = alpha
  const width = grid[0]?.length ?? 0
  for (let row = 0; row < grid.length; row++) {
    const line = grid[row]
    for (let col = 0; col < line.length; col++) {
      const ch = line[col]
      if (ch === '.') continue
      const color = palette[ch]
      if (!color) continue
      ctx.fillStyle = color
      const px = flip ? x + (width - 1 - col) * scale : x + col * scale
      ctx.fillRect(px, y + row * scale, scale, scale)
    }
  }
  ctx.globalAlpha = prevAlpha
}

export function gridSize(grid: Grid): { w: number; h: number } {
  return { w: grid[0]?.length ?? 0, h: grid.length }
}

/** Soft ground shadow under a sprite whose top-left is (x, y) and size is w×h grid cells. */
export function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number,
  alpha = 1
): void {
  const prevAlpha = ctx.globalAlpha
  ctx.globalAlpha = 0.25 * alpha
  ctx.fillStyle = '#000000'
  ctx.beginPath()
  ctx.ellipse(
    x + (w / 2) * scale,
    y + (h - 0.5) * scale,
    (w / 2 - 1) * scale,
    1.5 * scale,
    0,
    0,
    Math.PI * 2
  )
  ctx.fill()
  ctx.globalAlpha = prevAlpha
}
