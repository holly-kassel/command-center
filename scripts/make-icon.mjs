// Generates resources/icon.svg + icon.png + build/icon.{png,icns,ico} from the Menagerie Katya portrait.
// Usage: node scripts/make-icon.mjs   (macOS: uses qlmanage/sips/iconutil)
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

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
  V: '#14857c'
}

const S = 1024,
  PX = 28,
  OFF = (S - PX * 28) / 2,
  Y_OFF = 160
let rects = ''
grid.forEach((row, y) =>
  [...row].forEach((ch, x) => {
    if (ch === '.') return
    rects += `<rect x="${OFF + x * PX}" y="${Y_OFF + y * PX}" width="${PX}" height="${PX}" fill="${pal[ch]}"/>`
  })
)
const stars = [
  [120, 140],
  [260, 90],
  [900, 120],
  [820, 230],
  [180, 330],
  [940, 360],
  [700, 70],
  [80, 480]
]
  .map(([x, y]) => `<rect x="${x}" y="${y}" width="14" height="14" fill="#f3eee4" opacity=".85"/>`)
  .join('')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" shape-rendering="crispEdges">
<defs><clipPath id="r"><rect x="40" y="40" width="944" height="944" rx="200"/></clipPath></defs>
<g clip-path="url(#r)">
  <rect width="${S}" height="${S}" fill="#1b1a2e"/>
  ${stars}
  <rect x="0" y="${S - 240}" width="${S}" height="240" fill="#2f7d3f"/>
  <rect x="0" y="${S - 240}" width="${S}" height="28" fill="#43c466"/>
  ${rects}
</g>
<rect x="40" y="40" width="944" height="944" rx="200" fill="none" stroke="#0f0e1c" stroke-width="40"/>
</svg>`
writeFileSync('resources/icon.svg', svg)

// Rasterize via Quick Look, then build icns/ico
rmSync('/tmp/cc-icon', { recursive: true, force: true })
mkdirSync('/tmp/cc-icon')
execSync('qlmanage -t -s 1024 -o /tmp/cc-icon resources/icon.svg >/dev/null 2>&1')
const png1024 = '/tmp/cc-icon/icon.svg.png'
if (!existsSync(png1024)) throw new Error('qlmanage failed')
execSync(`sips -z 512 512 ${png1024} --out resources/icon.png >/dev/null`)
copyFileSync('resources/icon.png', 'build/icon.png')
mkdirSync('/tmp/cc-icon/icon.iconset')
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
  execSync(
    `sips -z ${s} ${s} ${png1024} --out /tmp/cc-icon/icon.iconset/icon_${n}x${n}.png >/dev/null`
  )
execSync('iconutil -c icns /tmp/cc-icon/icon.iconset -o build/icon.icns')
// ICO: single 256px PNG-compressed entry
const p256 = readFileSync('/tmp/cc-icon/icon.iconset/icon_256x256.png')
const hdr = Buffer.alloc(22)
hdr.writeUInt16LE(0, 0)
hdr.writeUInt16LE(1, 2)
hdr.writeUInt16LE(1, 4)
hdr[6] = 0
hdr[7] = 0
hdr[8] = 0
hdr[9] = 0
hdr.writeUInt16LE(1, 10)
hdr.writeUInt16LE(32, 12)
hdr.writeUInt32LE(p256.length, 14)
hdr.writeUInt32LE(22, 18)
writeFileSync('build/icon.ico', Buffer.concat([hdr, p256]))
console.log('icons written')
