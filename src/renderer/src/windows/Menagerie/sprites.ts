/**
 * Hand-authored pixel sprites for Katya's Menagerie.
 *
 * Every sprite is a list of equal-length strings; each character indexes a
 * palette entry. '.' is transparent. Sprites face RIGHT; the renderer flips
 * them horizontally when a critter walks left.
 *
 * Palette keys:
 *   D  outline           b  base coat               d  dark coat (ears, markings)
 *   l  light coat        w  white (muzzle, chest)   e  eye
 *   n  nose              p  pink (ears, tongue)     c  collar
 *   x  accent (dirt)
 *
 * Critters are 12×12 front-facing chibis drawn like Katya: a 1px outline in
 * the coat's darkest tone around the whole silhouette, a big head with wide-set
 * eyes, and a ground shadow drawn by the canvas. Puppies have floppy ears and
 * their tongue out; kittens have pink-lined ears, a pink nose and rosy cheeks.
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

// ── Puppy (12×12, front-facing chibi) ───────────────────────────

export const CRITTER_SIZE = { w: 12, h: 12 } as const
export const KATYA_SIZE = { w: 16, h: 14 } as const

/** Floppy-eared head shared by every upright puppy frame, tongue out */
const PUPPY_HEAD: Grid = [
  '...DDDDDD...',
  '..DbbllbbD..',
  '.DdbbbbbbdD.',
  'DddbebbebddD',
  'DddbbwwbbddD',
  '.DdbwnnwbdD.',
  '..DbwppwbD..'
]

const PUPPY_STAND: Grid = [
  ...PUPPY_HEAD,
  'DD.DccccD...',
  'DbDbbwwbbD..',
  '.DbbbwwbbbD.',
  '..DbbDDbbD..',
  '..DwwDDwwD..'
]

// Waddle: legs splay and the tail swings down
const PUPPY_WALK_2: Grid = [
  ...PUPPY_HEAD,
  '...DccccD...',
  'DDDbbwwbbD..',
  'DbbbbwwbbbD.',
  '.DbbDDDDbbD.',
  '.DwwD..DwwD.'
]

// Digging: paws take turns scraping a hole while dirt flies out to the side
const PUPPY_DIG_1: Grid = [
  ...PUPPY_HEAD,
  'DD.DccccD..x',
  'DbDbbwwbbDx.',
  '.DbbbwwbbbD.',
  '..DbDwwDbD..',
  '..DwDxxDDD..'
]

const PUPPY_DIG_2: Grid = [
  ...PUPPY_HEAD,
  'x..DccccD...',
  'DxDbbwwbbD..',
  '.DbbbwwbbbD.',
  '..DbDwwDbD..',
  '..DDDxxDwD..'
]

const PUPPY_SIT: Grid = [
  ...PUPPY_HEAD,
  '...DccccD...',
  '..DbbwwbbD..',
  '.DbbbwwbbbD.',
  'DdbbDwwDbbbD',
  '.DDDDwwDDDD.'
]

// Curled up asleep facing right: ear draped over the head, eyes shut, chin on paws
const PUPPY_SLEEP: Grid = [
  '............',
  '............',
  '............',
  '............',
  '......DDDD..',
  '..DDDDbbbbD.',
  '.DbbbDddbbbD',
  'DbbbbDddbbbD',
  'DbbbbcDdDbbD',
  'DbbbbcbbbwwD',
  'DddbbcbwwwnD',
  '.DDDDDDDDDD.'
]

export const PUPPY: SpriteSet = {
  idle: [PUPPY_STAND, PUPPY_STAND, PUPPY_STAND, PUPPY_WALK_2],
  walk: [PUPPY_STAND, PUPPY_WALK_2],
  chore: [PUPPY_DIG_1, PUPPY_DIG_2],
  sit: [PUPPY_SIT],
  sleep: [PUPPY_SLEEP]
}

// ── Kitten (12×12, front-facing chibi) ──────────────────────────

/** Pointy-eared head shared by every upright kitten frame: pink ears and nose, rosy cheeks */
const KITTEN_HEAD: Grid = [
  '..D......D..',
  '.DpD....DpD.',
  '.DppDDDDppD.',
  '.DbbbllbbbD.',
  '.DbebbbbebD.',
  '.DpbbnnbbpD.',
  '..DbbwwbbD..'
]

const KITTEN_STAND: Grid = [
  ...KITTEN_HEAD,
  'DD.DccccD...',
  'DdDbbwwbbD..',
  '.DDbbwwbbD..',
  '..DbDDDDbD..',
  '..DwD..DwD..'
]

const KITTEN_WALK_2: Grid = [
  ...KITTEN_HEAD,
  'DD.DccccD...',
  'DdDbbwwbbD..',
  'DDDbbwwbbD..',
  '.DbDDDDDDbD.',
  '.DwD....DwD.'
]

// Batting a pink ball of yarn (with a loose thread) back and forth
const KITTEN_PLAY_1: Grid = [
  ...KITTEN_HEAD,
  'DD.DccccD...',
  'DdDbbwwbbDD.',
  '.DDbbwwbbDwD',
  '..DbDDDDbDDp',
  '..DwD..DwDpp'
]

const KITTEN_PLAY_2: Grid = [
  ...KITTEN_HEAD,
  'DD.DccccD...',
  'DdDbbwwbbD..',
  '.DDbbwwbbbD.',
  '..DbDDDDbDwD',
  '..DwD..DwDpp'
]

const KITTEN_SIT: Grid = [
  ...KITTEN_HEAD,
  '...DccccD...',
  '..DbbwwbbD..',
  '.DbbbwwbbbD.',
  'DdDbbwwbbbD.',
  'DddDwwDwwDD.'
]

// Curled into a loaf facing right: ears up, eyes shut, tail tucked round the front
const KITTEN_SLEEP: Grid = [
  '............',
  '............',
  '............',
  '............',
  '.......D..D.',
  '......DpDDpD',
  '..DDDDDbbbbD',
  '.DbbbbcbDbDD',
  'DbbbbbcbbnbD',
  'DdbbbbcbbbbD',
  'DddDDDDDDDD.',
  '.DD.........'
]

export const KITTEN: SpriteSet = {
  idle: [KITTEN_STAND, KITTEN_STAND, KITTEN_WALK_2, KITTEN_STAND],
  walk: [KITTEN_STAND, KITTEN_WALK_2],
  chore: [KITTEN_PLAY_1, KITTEN_PLAY_2],
  sit: [KITTEN_SIT],
  sleep: [KITTEN_SLEEP]
}

// ── Portraits (24×24) — close-up view, bigger head, shiny eyes ──

export const PORTRAIT_SIZE = { w: 24, h: 24 } as const

const PUPPY_PORTRAIT_1: Grid = [
  '........................',
  '........DDDDDDDD........',
  '......DDbbbllbbbDD......',
  '.....DdbbbbbbbbbbdD.....',
  '....DdddbbbbbbbbdddD....',
  '...DddddbbbbbbbbddddD...',
  '...DddddbewbbbewbddddD..',
  '...DddddbeebbbeebddddD..',
  '...DddddbbbwwwbbbddddD..',
  '...DddddbpwwnnwwpbdddD..',
  '....DdddbbwwwwwwbbddD...',
  '.....DDDbbDwppwDbbDD....',
  '.......DbbbDppDbbbD.....',
  '..D.....DccccccccD......',
  '.DbD...DbbbwwwwbbbD.....',
  '.DbbD.DbbbbwwwwbbbbD....',
  '..DbbDbbbbbwwwwbbbbbD...',
  '...DbbbbbbbwwwwbbbbbD...',
  '....DbbbbbbbbbbbbbbbD...',
  '.....DbbbbbbbbbbbbbD....',
  '.....DbbbDDDDDDbbbD.....',
  '.....DbbbD....DbbbD.....',
  '.....DwwwD....DwwwD.....',
  '.....DDDDD....DDDDD.....'
]

// Blink + tail wag
const PUPPY_PORTRAIT_2: Grid = [
  ...PUPPY_PORTRAIT_1.slice(0, 6),
  '...DddddbbbbbbbbbddddD..',
  '...DddddbDDbbbDDbddddD..',
  ...PUPPY_PORTRAIT_1.slice(8, 13),
  '........DccccccccD......',
  'DD.....DbbbwwwwbbbD.....',
  'DbDD..DbbbbwwwwbbbbD....',
  '.DbbDDbbbbbwwwwbbbbbD...',
  '..DDbbbbbbbwwwwbbbbbD...',
  ...PUPPY_PORTRAIT_1.slice(18)
]

const KITTEN_PORTRAIT_1: Grid = [
  '....D............D......',
  '....DD..........DD......',
  '....DpD........DpD......',
  '....DppD......DppD......',
  '....DpppDDDDDDpppD......',
  '...DbbppbbllbbppbbD.....',
  '..DbbbbbbbbbbbbbbbbD....',
  '..DbbbbbbbbbbbbbbbbD....',
  '..DbbbewbbbbbbewbbbD....',
  '..DbbbeebbbbbbeebbbD....',
  'DD.DbbeebbbbbbeebbD.DD..',
  '..DbpbbbbbnnbbbbpbbD....',
  'DDDDbpbbbwDDwbbbpbDDDD..',
  '....DbbbbbwwbbbbbD......',
  '.....DDccccccccDD.....D.',
  '....DbbbbwwwwbbbbD...DdD',
  '...DbbbbbwwwwbbbbbD..DdD',
  '...DbbbbbwwwwbbbbbD.DdD.',
  '...DbbbbbbbbbbbbbbbDDdD.',
  '...DbbbbbbbbbbbbbbbbddD.',
  '....DbbbbbbbbbbbbbbbDD..',
  '....DbbbDDDDDDDDbbbD....',
  '....DwwwD......DwwwD....',
  '....DDDDD......DDDDD....'
]

// Blink + tail curl
const KITTEN_PORTRAIT_2: Grid = [
  ...KITTEN_PORTRAIT_1.slice(0, 8),
  '..DbbbbbbbbbbbbbbbbD....',
  '..DbbbDDbbbbbbDDbbbD....',
  'DD.DbbbbbbbbbbbbbbD.DD..',
  ...KITTEN_PORTRAIT_1.slice(11, 14),
  '.....DDccccccccDD.......',
  '....DbbbbwwwwbbbbD...DD.',
  '...DbbbbbwwwwbbbbbD.DddD',
  ...KITTEN_PORTRAIT_1.slice(17)
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

// ── Lulu (black long-haired cat, 16×14) — manager of the cats ────

export const LULU_SIZE = { w: 16, h: 14 } as const

/**
 * Lulu: D outline, b black fur, l/s long-hair sheen, w white mittens and
 * whiskers, e amber eyes, n nose, p ears, c collar, q/G bell
 */
export const LULU_PALETTE: Palette = {
  D: '#0b0a10',
  b: '#2b2833',
  l: '#5b5570',
  s: '#8d86a6',
  w: '#f7f5fa',
  e: '#f5c443',
  n: '#f09ab0',
  p: '#c9708a',
  c: '#b58cff',
  q: '#ffd84d',
  G: '#f0a030'
}

// Standing: big shiny eyes, whiskers out, fluffy bib under the collar bell, plume up the right
const LULU_STAND: Grid = [
  '...D.......D....',
  '..DpD.....DpD...',
  '..DppDDDDDppD...',
  '.DbbbbbbbbbbbD..',
  '.DbbwebbbwebbD..',
  '.DbbeebbbeebbD..',
  'wwlbbbbnbbbblww.',
  'DllbbblblbbbllDD',
  '.DllcccqcccllDlD',
  '.DblllbbbllllDlD',
  '.DbbbllbllbbbDlD',
  '..DbbbblbbbbDlD.',
  '...DwwDDDwwDDD..',
  '...DDDD.DDDD....'
]

// Mid-stride: paws apart, tail tip flicked up
const LULU_STEP: Grid = [
  '...D.......D....',
  '..DpD.....DpD...',
  '..DppDDDDDppD...',
  '.DbbbbbbbbbbbD..',
  '.DbbwebbbwebbD..',
  '.DbbeebbbeebbD..',
  'wwlbbbbnbbbblwwD',
  'DllbbblblbbbllDl',
  '.DllcccqcccllDlD',
  '.DblllbbbllllDlD',
  '.DbbbllbllbbbDlD',
  '..DbbbblbbbbDDD.',
  '..DwwDDDDDwwD...',
  '..DDDD...DDDD...'
]

// Sitting with her tail wrapped round the front paws
const LULU_SIT: Grid = [
  '...D.......D....',
  '..DpD.....DpD...',
  '..DppDDDDDppD...',
  '.DbbbbbbbbbbbD..',
  '.DbbwebbbwebbD..',
  '.DbbeebbbeebbD..',
  'wwlbbbbnbbbblww.',
  'DllbbblblbbbllDD',
  '.DllcccqcccllD..',
  '.DblllbbbllllD..',
  'DbbbbllbllbbbbD.',
  'DbbbbbblbbbbbbDD',
  'DbbDwwDbDwwDbDlD',
  '.DDDDDDDDllllDD.'
]

// A loaf from the front: eyes shut, mittens tucked, tail round the side
const LULU_SLEEP: Grid = [
  '................',
  '................',
  '................',
  '...D.......D....',
  '..DpD.....DpD...',
  '..DppDDDDDppD...',
  '.DbbbbbbbbbbbD..',
  '.DbssbbbbbssbD..',
  'wwlbbbbnbbbblww.',
  'DllbbbbbbbbbllDD',
  'DlllbbbbbbbllDlD',
  'DbbbbbbbbbbbbDlD',
  'DbDwwDbbbDwwDllD',
  '.DDDDDDDDDDDDDD.'
]

export const LULU: SpriteSet = {
  idle: [LULU_STAND, LULU_STAND, LULU_STAND, LULU_STEP],
  walk: [LULU_STAND, LULU_STEP],
  chore: [LULU_STAND, LULU_STEP],
  sit: [LULU_SIT],
  sleep: [LULU_SLEEP]
}

// ── Lulu portrait (28×24) for her cat report close-up ───────────

export const LULU_PORTRAIT_SIZE = { w: 28, h: 24 } as const

// Tail plume up
const LULU_PORTRAIT_1: Grid = [
  '....l..................l....',
  '....D..................D....',
  '...DpD................DpD...',
  '...DppD..............DppD...',
  '..DpppDDDDDDDDDDDDDDDDpppD..',
  '..DbppbbbbbbbbbbbbbbbbppbD..',
  '.DbbbbbbblbbbbbbbblbbbbbbbD.',
  '.DbbbbbbbbbbbbbbbbbbbbbbbbD.',
  '.DbbbbbeebbbbbbbbbbeebbbbbD.',
  'DbbbbbewDebbbbbbbbewDebbbbbD',
  'DbbbbbeDDebbbbbbbbeDDebbbbbD',
  'DbbbbbeDDebbbbbbbbeDDebbbbbD',
  'DbbbbbbeebbbbbbbbbbeebbbbbbD',
  'wwwwwbbbbbbbnnnnbbbbbbbwwwww',
  'DbbbbbbbbbbbbnnbbbbbbbbbbbbD',
  '.wwwwbbbbbbblbblbbbbbbbwwww.',
  '.DlbbbbbbbbbbbbbbbbbbbbbbDD.',
  '..DbbbbbbccccqqccccbbbbDlsD.',
  '.DlbbbbbbblssGGsslbbbbDlssD.',
  '.DblbbbbbbssssssssbbbbDllsD.',
  '..DDbbbbbblsssssslbbbbDlllD.',
  '....DbbDwwwwDssDwwwwDDlllD..',
  '....DbbDwwwwDDDDwwwwDDDDD...',
  '.....DDDDDDDD..DDDDDDDD.....'
]

// Tail plume down (swish)
const LULU_PORTRAIT_2: Grid = [
  '....l..................l....',
  '....D..................D....',
  '...DpD................DpD...',
  '...DppD..............DppD...',
  '..DpppDDDDDDDDDDDDDDDDpppD..',
  '..DbppbbbbbbbbbbbbbbbbppbD..',
  '.DbbbbbbblbbbbbbbblbbbbbbbD.',
  '.DbbbbbbbbbbbbbbbbbbbbbbbbD.',
  '.DbbbbbeebbbbbbbbbbeebbbbbD.',
  'DbbbbbewDebbbbbbbbewDebbbbbD',
  'DbbbbbeDDebbbbbbbbeDDebbbbbD',
  'DbbbbbeDDebbbbbbbbeDDebbbbbD',
  'DbbbbbbeebbbbbbbbbbeebbbbbbD',
  'wwwwwbbbbbbbnnnnbbbbbbbwwwww',
  'DbbbbbbbbbbbbnnbbbbbbbbbbbbD',
  '.wwwwbbbbbbblbblbbbbbbbwwww.',
  '.DlbbbbbbbbbbbbbbbbbbbbbblD.',
  '..DbbbbbbccccqqccccbbbbbbD..',
  '.DlbbbbbbblssGGsslbbbbbbDDD.',
  '.DblbbbbbbssssssssbbbbbDlsD.',
  '..DDbbbbbblsssssslbbbbDllsD.',
  '....DbbDwwwwDssDwwwwDDllsD..',
  '....DbbDwwwwDDDDwwwwDDDDD...',
  '.....DDDDDDDD..DDDDDDDD.....'
]

/** Content squint (^ ^) for when she is being petted: eyes become little arcs */
function contentEyes(grid: Grid): Grid {
  const arcs: Record<number, string> = { 8: 'bbbb', 9: 'bbbb', 10: 'bssb', 11: 'sbbs', 12: 'bbbb' }
  return grid.map((row, i) =>
    arcs[i] ? row.slice(0, 6) + arcs[i] + row.slice(10, 18) + arcs[i] + row.slice(22) : row
  )
}

export const LULU_PORTRAIT: Grid[] = [LULU_PORTRAIT_1, LULU_PORTRAIT_2]
export const LULU_PORTRAIT_HAPPY: Grid[] = LULU_PORTRAIT.map(contentEyes)

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

/** 6×5 ball of pink yarn with a loose thread; palette: f yarn, h shading */
export const YARN: Grid = ['.fff..', 'fhfhf.', 'ffhff.', 'fhfhff', '.fff.f']

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

/** 7×6 heart that floats up when Katya is petted; palette: h */
export const HEART: Grid = ['.hh.hh.', 'hhhhhhh', 'hhhhhhh', '.hhhhh.', '..hhh..', '...h...']

// ── Nap spots: where idle and finished critters sleep in each yard ──

/** 16×13 dog house for napping puppies; palette: r/R roof, x wood, k dark wood, l name plate, e doorway */
export const DOG_HOUSE: Grid = [
  '.......RR.......',
  '......RrrR......',
  '.....RrrrrR.....',
  '....RrrrrrrR....',
  '...RrrrrrrrrR...',
  '..RrrrrrrrrrrR..',
  '.RRRRRRRRRRRRRR.',
  '..xxxxllllxxxx..',
  '..xkxxxeexxxkx..',
  '..xkxxeeeexxkx..',
  '..xkxxeeeexxkx..',
  '..xkxxeeeexxkx..',
  '.kkkkkkkkkkkkkk.'
]

/** 12×20 carpeted cat tree for napping kittens; palette: a/A carpet, j/J sisal post, k string, f pom-pom, e cubby */
export const CAT_TREE: Grid = [
  '..aaaaaaaa..',
  '.aaaaaaaaaa.',
  '.AAAAAAAAAA.',
  '.....jJ...k.',
  '.....Jj...k.',
  '.....jJ..fff',
  '.....Jj...f.',
  '.aaaajJ.....',
  '.AAAAJj.....',
  '.....jJ.....',
  '.....Jj.....',
  '.aaaaaaaaaa.',
  '.aaaaaaaaaa.',
  '.aaaeeeeaaa.',
  '.aaeeeeeeaa.',
  '.aaeeeeeeaa.',
  '.aaaeeeeaaa.',
  '.aaaaaaaaaa.',
  '.AAAAAAAAAA.',
  'aaaaaaaaaaaa'
]

export const CAT_TREE_PALETTE: Palette = {
  a: '#cbbfe0',
  A: '#9286ad',
  j: '#d8b27a',
  J: '#a8814e'
}

// ── Town-square decorations: one per automation ─────────────────

export const DECORATION_SIZE = { w: 9, h: 16 } as const

export interface DecorationSprite {
  /** Shown in the automation bubble and Katya's report */
  icon: string
  /** Drawn while no run is working */
  idle: Grid
  /** Cycled while a run is working */
  running: Grid[]
  /** Centre of a light that glows while running (offset in sprite pixels) */
  glow?: { x: number; y: number }
}

/** Lamp post; palette: k iron, u lamp glass (lit while running), v/V pennant, s stone base */
const LAMP: Grid = [
  '...kkk...',
  '..kkkkk..',
  '..kuuuk..',
  '..kuuuk..',
  '..kuuuk..',
  '..kkkkk..',
  '....k....',
  '....kvvv.',
  '....kvV..',
  '....kv...',
  '....k....',
  '....k....',
  '....k....',
  '....k....',
  '...sss...',
  '..sssss..'
]

/** Bell frame; palette: k wood, G/y brass, e clapper, q ring lines, v/V plaque */
const BELL: Grid = [
  'kkkkkkkkk',
  '.k.....k.',
  '.k..k..k.',
  '.k.GGG.k.',
  '.k.GyG.k.',
  '.k.GGG.k.',
  '.kGGGGGk.',
  '.k..e..k.',
  '.k.....k.',
  '.k.....k.',
  '.kvvvvvk.',
  '.kvVVVvk.',
  '.kvvvvvk.',
  '.k.....k.',
  '.k.....k.',
  'kkk...kkk'
]

function ringBell(clapperCol: number, side: 'left' | 'right'): Grid {
  return BELL.map((row, i) => {
    let out = row
    if (i === 7) out = '.k.....k.'.slice(0, clapperCol) + 'e' + '.k.....k.'.slice(clapperCol + 1)
    if (i === 3 || i === 5) {
      const col = side === 'left' ? 0 : 8
      out = out.slice(0, col) + 'q' + out.slice(col + 1)
    }
    return out
  })
}

/** Flag pole; palette: y finial, k pole, v/V flag, s stone base. The flag droops until a run works */
const FLAG_DROOP: Grid = [
  '.y.......',
  '.k.......',
  '.kvvv....',
  '.kvVv....',
  '.kvvv....',
  '.kvvv....',
  '.kvv.....',
  '.kv......',
  '.k.......',
  '.k.......',
  '.k.......',
  '.k.......',
  '.k.......',
  '.k.......',
  'sss......',
  'sss......'
]

const FLAG_WAVE_1: Grid = [
  '.y.......',
  '.k.......',
  '.kvvvvv..',
  '.kvVvvvv.',
  '.kvvvvvvv',
  '.kvvvvv..',
  '.k.......',
  '.k.......',
  ...FLAG_DROOP.slice(8)
]

const FLAG_WAVE_2: Grid = [
  '.y.......',
  '.k.......',
  '.kvvvvvv.',
  '.kvVvvvvv',
  '.kvvvvv..',
  '.kvvvv...',
  '.k.......',
  '.k.......',
  ...FLAG_DROOP.slice(8)
]

/** Pinwheel on a stick; palette: v/V blades, e hub, k stick, s stone base */
const PINWHEEL_PLUS: Grid = [
  '....v....',
  '....v....',
  '....v....',
  '.VVVeVVV.',
  '....v....',
  '....v....',
  '....v....',
  '....k....',
  '....k....',
  '....k....',
  '....k....',
  '....k....',
  '....k....',
  '....k....',
  '...sss...',
  '..sssss..'
]

const PINWHEEL_CROSS: Grid = [
  '.v.....V.',
  '..v...V..',
  '...v.V...',
  '....e....',
  '...V.v...',
  '..V...v..',
  '.V.....v.',
  ...PINWHEEL_PLUS.slice(7)
]

export const DECORATIONS: readonly DecorationSprite[] = [
  { icon: '🏮', idle: LAMP, running: [LAMP], glow: { x: 4.5, y: 3.5 } },
  { icon: '🔔', idle: BELL, running: [ringBell(3, 'left'), BELL, ringBell(5, 'right'), BELL] },
  { icon: '🚩', idle: FLAG_DROOP, running: [FLAG_WAVE_1, FLAG_WAVE_2] },
  { icon: '🌀', idle: PINWHEEL_PLUS, running: [PINWHEEL_PLUS, PINWHEEL_CROSS] }
]

/** Accent colours (pennant, plaque, flag, blades) so neighbouring decorations differ */
export const DECORATION_ACCENTS: readonly Palette[] = [
  { v: '#ff7aa2', V: '#c2456c' },
  { v: '#5ab0ff', V: '#2f6fb8' },
  { v: '#ffd84d', V: '#c99a1a' },
  { v: '#7ad67a', V: '#3f8f4a' },
  { v: '#b58cff', V: '#7650c0' },
  { v: '#ff9f50', V: '#c4621f' }
]

/** The automation at `index` (town-square order) gets this decoration and accent */
export function decorationFor(index: number): { sprite: DecorationSprite; accent: Palette } {
  return {
    sprite: DECORATIONS[index % DECORATIONS.length],
    accent: DECORATION_ACCENTS[index % DECORATION_ACCENTS.length]
  }
}

/** Lamp glass colours; palette key u */
export const LAMP_LIT = '#ffd84d'
export const LAMP_UNLIT = '#5b6573'

/** 2×6 "!" over an automation whose last run failed; palette: X */
export const BANG: Grid = ['XX', 'XX', 'XX', 'XX', '..', 'XX']
export const BANG_PALETTE: Palette = { X: '#e5484d' }

// ── Palettes ─────────────────────────────────────────────────────

export const PUPPY_COATS: Palette[] = [
  {
    D: '#5a3416',
    b: '#d4955a',
    d: '#a8682f',
    l: '#ecc08c',
    w: '#fbf0de',
    e: '#1e1410',
    n: '#2a1a12',
    p: '#f08a9a'
  }, // golden
  {
    D: '#24160e',
    b: '#7a543c',
    d: '#553826',
    l: '#9a7258',
    w: '#eadccc',
    e: '#140e0c',
    n: '#0e0a08',
    p: '#f08a9a'
  }, // chocolate
  {
    D: '#7c6a56',
    b: '#eee6da',
    d: '#c9b8a2',
    l: '#ffffff',
    w: '#ffffff',
    e: '#2a201a',
    n: '#3a2a22',
    p: '#f4a0ac'
  }, // cream
  {
    D: '#30343e',
    b: '#8e94a0',
    d: '#646a78',
    l: '#b4bac6',
    w: '#e8ebf0',
    e: '#16181c',
    n: '#1a1c22',
    p: '#f08a9a'
  } // blue-gray
]

export const KITTEN_COATS: Palette[] = [
  {
    D: '#5e2a0c',
    b: '#e8843f',
    d: '#b0571c',
    l: '#f6ae78',
    w: '#fff3e6',
    e: '#2d7d36',
    n: '#e07080',
    p: '#f6a8b4'
  }, // orange tabby
  {
    D: '#0c0c10',
    b: '#30303a',
    d: '#1c1c24',
    l: '#50505e',
    w: '#e2e2ea',
    e: '#f0d050',
    n: '#d07888',
    p: '#d890a0'
  }, // black
  {
    D: '#363846',
    b: '#a0a2b0',
    d: '#74768a',
    l: '#c8cad6',
    w: '#f4f4f8',
    e: '#4aa8dc',
    n: '#e08898',
    p: '#f6b4c0'
  }, // gray
  {
    D: '#5e4a34',
    b: '#f2e8d4',
    d: '#7a5c44',
    l: '#fffaee',
    w: '#ffffff',
    e: '#3a88d6',
    n: '#d07888',
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
