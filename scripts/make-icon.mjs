// Generates resources/icon.svg + icon.png + build/icon.{png,icns,ico} from the Menagerie Katya portrait.
// Rasterizes in pure Node (real alpha, no white corners). Usage: node scripts/make-icon.mjs
// macOS only for the .icns step (iconutil).
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { deflateSync } from 'node:zlib'

const src = readFileSync('src/renderer/src/windows/Menagerie/sprites.ts', 'utf8')
const grab = (name) => {
  const m = src.match(new RegExp(`const ${name}: Grid = \\[([\\s\\S]*?)\\]`))
  return m[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1))
}
const grid = grab('KATYA_PORTRAIT_1')
const pal = {
  b: '#f7f7fb',
  d: '#c9ccd9',
  l: '#ffffff',
  w: '#f3ece0',
  e: '#1b1b1f',
  n: '#1b1b1f',
  p: '#f4a4b0',
  v: '#2ec4b6',
  V: '#14857c',
  c: '#f2a7b5'
}

const S = 1024
const PX = 28
const OFF = (S - PX * 28) / 2
const Y_OFF = 160
const RADIUS = 230 // ~22.4% — matches the macOS squircle closely
const STARS = [
  [120, 140],
  [260, 90],
  [900, 120],
  [820, 230],
  [180, 330],
  [940, 360],
  [700, 70],
  [80, 480]
]

// Scene as a list of axis-aligned rects, painted in order.
const rects = [
  [0, 0, S, S, '#1b1a2e'],
  ...STARS.map(([x, y]) => [x, y, 14, 14, '#f3eee4', 0.85]),
  [0, S - 240, S, 240, '#2f7d3f'],
  [0, S - 240, S, 28, '#43c466']
]
grid.forEach((row, y) =>
  [...row].forEach((ch, x) => {
    if (ch !== '.') rects.push([OFF + x * PX, Y_OFF + y * PX, PX, PX, pal[ch]])
  })
)

// SVG (for reference / other tooling)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" shape-rendering="crispEdges">
<defs><clipPath id="r"><rect width="${S}" height="${S}" rx="${RADIUS}"/></clipPath></defs>
<g clip-path="url(#r)">
${rects.map(([x, y, w, h, f, o]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"${o ? ` opacity="${o}"` : ''}/>`).join('\n')}
</g>
</svg>`
writeFileSync('resources/icon.svg', svg)

// --- rasterizer ---
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const rgb = new Uint8Array(S * S * 3)
for (const [x, y, w, h, f, o = 1] of rects) {
  const [r, g, b] = hex(f)
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      const i = (yy * S + xx) * 3
      rgb[i] = rgb[i] * (1 - o) + r * o
      rgb[i + 1] = rgb[i + 1] * (1 - o) + g * o
      rgb[i + 2] = rgb[i + 2] * (1 - o) + b * o
    }
}
// Rounded-rect coverage with 4x4 supersampling for smooth corners
const SS = 4
const inside = (px, py) => {
  const cx = px < RADIUS ? RADIUS : px > S - RADIUS ? S - RADIUS : px
  const cy = py < RADIUS ? RADIUS : py > S - RADIUS ? S - RADIUS : py
  const dx = px - cx,
    dy = py - cy
  return dx * dx + dy * dy <= RADIUS * RADIUS
}
const alpha = new Uint8Array(S * S)
for (let y = 0; y < S; y++)
  for (let x = 0; x < S; x++) {
    if (x >= RADIUS && x < S - RADIUS) {
      alpha[y * S + x] = 255
      continue
    }
    if (y >= RADIUS && y < S - RADIUS) {
      alpha[y * S + x] = 255
      continue
    }
    let hit = 0
    for (let sy = 0; sy < SS; sy++)
      for (let sx = 0; sx < SS; sx++) if (inside(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)) hit++
    alpha[y * S + x] = Math.round((hit / (SS * SS)) * 255)
  }

// --- PNG encoder (RGBA, filter 0) with box downsampling ---
const crcTable = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
const crc32 = (buf) => {
  let c = -1
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size) {
  const f = S / size
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0
      for (let sy = 0; sy < f; sy++)
        for (let sx = 0; sx < f; sx++) {
          const i = (y * f + sy) * S + (x * f + sx)
          const al = alpha[i] / 255
          r += rgb[i * 3] * al
          g += rgb[i * 3 + 1] * al
          b += rgb[i * 3 + 2] * al
          a += al
        }
      const o = y * (size * 4 + 1) + 1 + x * 4
      if (a > 0) {
        raw[o] = Math.round(r / a)
        raw[o + 1] = Math.round(g / a)
        raw[o + 2] = Math.round(b / a)
      }
      raw[o + 3] = Math.round((a / (f * f)) * 255)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

rmSync('/tmp/cc-icon', { recursive: true, force: true })
mkdirSync('/tmp/cc-icon/icon.iconset', { recursive: true })
const cache = {}
const get = (s) => (cache[s] ??= png(s))
writeFileSync('resources/icon.png', get(512))
copyFileSync('resources/icon.png', 'build/icon.png')
for (const [n, s] of [
  ['16', 16],
  ['16@2x', 32],
  ['32', 32],
  ['32@2x', 64],
  ['128', 128],
  ['128@2x', 256],
  ['256', 256],
  ['256@2x', 512],
  ['512', 512],
  ['512@2x', 1024]
])
  writeFileSync(`/tmp/cc-icon/icon.iconset/icon_${n}x${n}.png`, get(s))
if (process.platform === 'darwin')
  execSync('iconutil -c icns /tmp/cc-icon/icon.iconset -o build/icon.icns')
// ICO: single 256px PNG-compressed entry
const p256 = get(256)
const hdr = Buffer.alloc(22)
hdr.writeUInt16LE(1, 2)
hdr.writeUInt16LE(1, 4)
hdr.writeUInt16LE(1, 10)
hdr.writeUInt16LE(32, 12)
hdr.writeUInt32LE(p256.length, 14)
hdr.writeUInt32LE(22, 18)
writeFileSync('build/icon.ico', Buffer.concat([hdr, p256]))
console.log('icons written')
