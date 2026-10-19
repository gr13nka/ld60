// Murals: pictures laid as a Soviet monumental mosaic of smalti (glass tesserae) in the manner
// of Mikhail Vrubel (1856-1910): lilac, deep blue, violet, gold and bronze, angular monumental
// figures, heavy dark contours. The Soviet reading: his Demon Seated becomes a worker on a
// break among gears that were flowers, his Six-winged Seraph a cosmonaut with a lamp and a
// wrench, his Pan an old mechanic with a bundle of steel pipes where the reed pipes were.
// Pure: no DOM, no Three.js, no imports.
//
// Every part is a "region": an outline in unit coordinates (0..1 across a square, v down like
// the canvas) filled with dark grout and then covered with tesserae, each coloured by its
// distance from the region's light point. Palettes run LIT -> SHADE: the first colour is what
// the light point gets, and it is a saturated mid-tone, never a pastel. Each region ends in a
// contour row, a line of dark tesserae along its edge, as in opus vermiculatum. No red and no
// green anywhere: the game keeps those for "it blows up" and "a gate".

export const SUBJECTS = ['demon', 'seraph', 'pan', 'frieze']

const TILE = 1 / 120 // a tessera's side, in units of the square; a region may ask for smaller, never over 1/80
const GROUT = '#15102a'
const INK = '#0e0a1e' // the thin contour line over the row of dark tesserae
const GOLD_SMALT = 0xf2cc58 // gold-backed glass: a sixth of the tiles in a gold palette

// ---------------------------------------------------------------- colour and noise

/** A linear congruential generator, so a seed always paints the same wall. */
function lcg(seed) {
  let s = (seed >>> 0) % 2147483648 || 1
  const next = () => {
    // (s * 1103515245 + 12345) mod 2^31, exact in 32-bit integers
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff
    return s / 2147483648
  }
  next()
  next()
  return next
}

const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]
const mix = (a, b, t) => rgb(a).map((x, i) => x + (rgb(b)[i] - x) * t)
const toCss = (c) => `rgb(${c.map(Math.round)})`
const clamp01 = (x) => Math.min(1, Math.max(0, x))
const lum = (c) => rgb(c).reduce((a, b) => a + b, 0)
const darkest = (pal) => pal.reduce((a, b) => (lum(b) < lum(a) ? b : a))

function paletteAt(pal, t) {
  return t < 0.5 ? mix(pal[0], pal[1], t * 2) : mix(pal[1], pal[2], t * 2 - 1)
}

/**
 * Fills `out` with random numbers in [0, 1) that depend only on the tile's column and row (and
 * the region's seed), not on drawing order: that is what lets the frieze's background repeat
 * exactly at its edges and a gear drawn twice come out the same.
 */
function tileRandom(seed, i, j, out) {
  let h = seed ^ Math.imul(i, 0x85ebca6b) ^ Math.imul(j, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  h ^= h >>> 16
  let s = h || 1
  for (let k = 0; k < out.length; k++) {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    out[k] = (s >>> 0) / 4294967296
  }
}

function inside(poly, u, v) {
  let hit = false
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [ua, va] = poly[a]
    const [ub, vb] = poly[b]
    if (va > v !== vb > v && u < ((ub - ua) * (v - va)) / (vb - va) + ua) hit = !hit
  }
  return hit
}

// ---------------------------------------------------------------- regions

const GOLDS = new Set() // palettes whose tiles may be gold smalti; filled with the palettes below
const BUF = new Float64Array(11)

/**
 * Paints one region through `P` = { ctx, rng, map, px }: `map` takes unit coordinates to
 * pixels (a slot of the frieze is only another map) and `px` is the pixel size of one unit.
 *
 * region: { poly | circle: [u, v, r], palette, light } plus optional
 *   tile    the tessera's side in units, at most 1/80 (a face or a hand takes smaller)
 *   flow    the angle the tile rows run at, about `origin` or the light point
 *   flat    one colour of glass instead of a palette (the light point is then unused)
 *   axis    'v' measures the light's distance vertically only (a sky)
 *   period  the tile columns repeat every `period` units (the frieze's wrap): flow is 0
 *   origin  the point the tile grid is laid around, so two copies of a gear match
 *   seed    fixes the random tiles, for the same reason
 *   ow      0 for no contour row
 */
export function drawRegion(P, region) {
  const { ctx, map, px } = P
  const poly = region.circle ? ngon(...region.circle, 24) : region.poly
  const flat = region.flat !== undefined
  const palette = flat ? [region.flat, region.flat, region.flat] : region.palette
  const light = flat ? poly[0] : region.light
  const period = region.period || 0
  let tile = Math.min(region.tile || (flat ? TILE / 2 : TILE), 1 / 80)
  let nx = 0
  if (period) {
    nx = Math.max(1, Math.round(period / tile))
    tile = period / nx
  }
  const flow = period ? 0 : region.flow || 0
  const [ox, oy] = period ? [0, 0] : region.origin || light
  const cs = Math.cos(flow)
  const sn = Math.sin(flow)
  const toWorld = (x, y) => [ox + x * cs - y * sn, oy + x * sn + y * cs]
  const seed = region.seed || (P.rng() * 2147483647) | 0
  const gold = GOLDS.has(palette)

  const trace = (pts) => {
    ctx.beginPath()
    pts.forEach(([u, v], i) => {
      const [x, y] = map(u, v)
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.closePath()
  }

  ctx.save()
  trace(poly)
  ctx.clip()
  ctx.fillStyle = GROUT
  ctx.fill()

  const local = poly.map(([u, v]) => [(u - ox) * cs + (v - oy) * sn, -(u - ox) * sn + (v - oy) * cs])
  const xs = local.map((p) => p[0])
  const ys = local.map((p) => p[1])
  const i0 = Math.floor(Math.min(...xs) / tile + 1e-9)
  const i1 = Math.ceil(Math.max(...xs) / tile - 1e-9)
  const j0 = Math.floor(Math.min(...ys) / tile)
  const j1 = Math.ceil(Math.max(...ys) / tile)
  const [lu, lv] = light
  const dist = (u, v) => (region.axis === 'v' ? Math.abs(v - lv) : Math.hypot(u - lu, v - lv))
  const reach = Math.max(1e-6, ...poly.map(([u, v]) => dist(u, v)))
  const half = tile / 2
  const body = half * 0.86 // the grout gap is 14% of the tile
  const SIGN = [[-1, -1], [1, -1], [1, 1], [-1, 1]]

  for (let i = i0; i < i1; i++) {
    const col = period ? ((i % nx) + nx) % nx : i
    for (let j = j0; j < j1; j++) {
      const xc = (i + 0.5) * tile
      const yc = (j + 0.5) * tile
      const [cu, cv] = toWorld(xc, yc)
      if (!inside(poly, cu, cv) && !SIGN.some(([a, b]) => inside(poly, ...toWorld(xc + a * half, yc + b * half)))) continue
      tileRandom(seed, col, j, BUF)
      let c = paletteAt(palette, clamp01(dist(cu, cv) / reach + (BUF[0] - 0.5) * 0.24))
      if (gold && BUF[2] < 0.15) c = rgb(GOLD_SMALT)
      else if (BUF[1] < 0.1) c = c.map((x) => Math.min(255, x * 1.25))
      ctx.fillStyle = toCss(c)
      ctx.beginPath()
      SIGN.forEach(([a, b], k) => {
        const [u, v] = toWorld(xc + a * body + (BUF[3 + 2 * k] * 2 - 1) * 0.12 * tile, yc + b * body + (BUF[4 + 2 * k] * 2 - 1) * 0.12 * tile)
        const [x, y] = map(u, v)
        if (k) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      })
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.restore()

  if (region.ow === 0 || flat) return
  // The contour row: grout, a dashed line of the palette's darkest tesserae on it, a thin ink line over.
  const t = tile * px
  trace(poly)
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  ctx.setLineDash([])
  ctx.lineWidth = t * 1.05
  ctx.strokeStyle = GROUT
  ctx.stroke()
  ctx.setLineDash([t * 0.82, t * 0.18])
  ctx.strokeStyle = toCss(rgb(darkest(palette)))
  ctx.stroke()
  ctx.setLineDash([])
  ctx.lineJoin = 'miter'
  ctx.miterLimit = 3
  ctx.lineWidth = t * 0.4
  ctx.strokeStyle = INK
  ctx.stroke()
}

// ---------------------------------------------------------------- polygon helpers

export function ngon(cu, cv, r, n, rot = 0) {
  return Array.from({ length: n }, (_, k) => {
    const a = rot + (k * Math.PI * 2) / n
    return [cu + Math.cos(a) * r, cv + Math.sin(a) * r]
  })
}

/** A gear (or, `pointed`, a flower of petals): `root` is the tooth root radius over `r`. */
export function gear(cu, cv, r, teeth, root = 0.78, pointed = false, rot = 0) {
  const shape = pointed ? [[0, root], [0.5, 1]] : [[0.05, root], [0.2, 1], [0.45, 1], [0.6, root]]
  const step = (Math.PI * 2) / teeth
  const pts = []
  for (let k = 0; k < teeth; k++) {
    for (const [f, rad] of shape) {
      const a = rot + (k + f) * step
      pts.push([cu + Math.cos(a) * r * rad, cv + Math.sin(a) * r * rad])
    }
  }
  return pts
}

/** A four-point sparkle. */
export function star4(cu, cv, r) {
  return Array.from({ length: 8 }, (_, k) => {
    const a = (k * Math.PI) / 4
    const rad = k % 2 ? r * 0.22 : r
    return [cu + Math.cos(a) * rad, cv + Math.sin(a) * rad]
  })
}

/** A five-point star, point up: the Soviet badge, in gold. */
function star5(cu, cv, r) {
  return Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5
    const rad = k % 2 ? r * 0.42 : r
    return [cu + Math.cos(a) * rad, cv + Math.sin(a) * rad]
  })
}

// Open-jaw spanner in units of its length: shaft along +x, jaw at x = 1, y across.
const SPANNER = [
  [0, -0.035], [0.78, -0.035], [0.86, -0.12], [1, -0.12], [1, -0.045], [0.92, -0.045],
  [0.92, 0.045], [1, 0.045], [1, 0.12], [0.86, 0.12], [0.78, 0.035], [0, 0.035],
]

/** A wrench whose handle end is at (cu, cv) and whose jaw points `angle` radians (v down). */
export function wrench(cu, cv, len, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return SPANNER.map(([x, y]) => [cu + (x * c - y * s) * len, cv + (x * s + y * c) * len])
}

const mirror = (poly) => poly.map(([u, v]) => [1 - u, v])
const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]

/** A limb: a polyline thickened to `w`. */
function limb(path, w) {
  const left = []
  const right = []
  path.forEach((p, i) => {
    const a = path[Math.max(0, i - 1)]
    const b = path[Math.min(path.length - 1, i + 1)]
    const n = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const nx = ((-(b[1] - a[1])) / n) * (w / 2)
    const ny = ((b[0] - a[0]) / n) * (w / 2)
    left.push([p[0] + nx, p[1] + ny])
    right.unshift([p[0] - nx, p[1] - ny])
  })
  return [...left, ...right]
}

// A feather: ragged on its upper side, in units of length (x) and half-width (y).
const PETAL = [
  [0, 0], [0.12, -0.5], [0.38, -0.9], [0.68, -0.85], [0.92, -0.4],
  [1, 0], [0.86, 0.3], [0.6, 0.55], [0.3, 0.5], [0.1, 0.28],
]

/** One wing rooted at (ou, ov), `upDeg` above horizontal, outward to the left or the right. */
function wing(ou, ov, upDeg, len, wid, toLeft) {
  const a = (upDeg * Math.PI) / 180
  const dx = (toLeft ? -1 : 1) * Math.cos(a)
  const dy = -Math.sin(a)
  const s = toLeft ? -1 : 1
  return PETAL.map(([x, y]) => [
    ou + dx * x * len + -dy * y * wid * s,
    ov + dy * x * len + dx * y * wid * s,
  ])
}

const R = (poly, palette, light, extra) => ({ poly, palette, light, ...extra })
const flat = (poly, colour) => ({ poly, flat: colour, ow: 0 })

// ---------------------------------------------------------------- palettes (lit -> shade)

const PAL = {
  skin: [0x9a7ab8, 0x6a4fa0, 0x2f2a6e],
  overall: [0x3a5ab8, 0x2a3a8e, 0x16205e],
  hair: [0x4a3a70, 0x2a1a4e, 0x120e26],
  gold: [0xd4a020, 0xa07020, 0x6a4a20],
  bronze: [0x8a5a20, 0x6a4a20, 0x3a2810],
  sun: [0xd4a020, 0xc09020, 0xb08020],
  wing: [0xd4a020, 0x9a6a20, 0x6a3a7a],
  lamp: [0xf2cc58, 0xe0b030, 0xd4a020],
  robe: [0x6a4fa0, 0x3a2e6e, 0x1b1640],
  helmet: [0xc9bfe3, 0x8a7ac0, 0x4a3a90],
  visor: [0x2f4fa8, 0x23388a, 0x16205e],
  panSkin: [0x8a9ac0, 0x5a6a9a, 0x2a3a6e],
  panShade: [0x5a6a9a, 0x2a3a6e, 0x1b2450],
  beard: [0xc9bfe3, 0x8a7ac0, 0x4a3a90],
  ochre: [0xb8863a, 0x7a5a2a, 0x4a3a20],
  jacket: [0x3a5ab8, 0x2a3a8e, 0x16205e],
  moon: [0xe8e4d0, 0xc4bdb6, 0xb0a8a0],
}
for (const p of [PAL.gold, PAL.sun, PAL.wing, PAL.lamp]) GOLDS.add(p)

// Lit end at the bottom of the sunset and the night, at the top of the dusk behind Pan.
const SKY = {
  demon: { palette: [0xc0702a, 0x6a2a60, 0x2a1850], light: [0.5, 1] },
  seraph: { palette: [0x2f4fa8, 0x16205e, 0x0c0e2e], light: [0.5, 1] },
  pan: { palette: [0x4a5aa0, 0x2a2a6e, 0x16143a], light: [0.5, 0] },
  frieze: { palette: [0x3a2a7a, 0x6a3a60, 0x2a1850], light: [1.5, 1] },
}

// ---------------------------------------------------------------- the three figures

/** A gear and its hub; as a `flower`, petals round a dark seed head. */
function gearParts(cu, cv, r, teeth, flower = false, rot = 0) {
  return [
    R(gear(cu, cv, r, teeth, flower ? 0.6 : 0.78, flower, rot), PAL.gold, [cu - r / 2, cv - r / 2], {
      origin: [cu, cv],
    }),
    { circle: [cu, cv, r * (flower ? 0.5 : 0.32)], palette: PAL.bronze, light: [cu - r / 4, cv - r / 4], origin: [cu, cv] },
  ]
}

// Demon Seated, a worker off shift: knees up, hands clasped, head bowed, the wrench across his
// knees; sunflowers that turned to gears bank up behind him, a low sun silhouettes his hair.
const DEMON_LEGS = [
  [0.84, 0.95], [0.86, 0.8], [0.78, 0.64], [0.6, 0.54], [0.4, 0.44], [0.27, 0.4], [0.19, 0.46], [0.16, 0.58],
  [0.15, 0.72], [0.08, 0.88], [0.09, 0.95], [0.3, 0.95], [0.31, 0.84], [0.34, 0.68], [0.42, 0.66], [0.56, 0.76], [0.64, 0.95],
]
const DEMON_TORSO = [
  [0.86, 0.82], [0.84, 0.6], [0.78, 0.44], [0.7, 0.3], [0.6, 0.24], [0.48, 0.26], [0.42, 0.34], [0.46, 0.46],
  [0.52, 0.58], [0.58, 0.7], [0.66, 0.8],
]
const DEMON_HAIR = [
  [0.4, 0.06], [0.52, 0.07], [0.64, 0.12], [0.76, 0.22], [0.84, 0.38], [0.9, 0.56], [0.92, 0.7], [0.84, 0.62],
  [0.76, 0.46], [0.66, 0.38], [0.56, 0.38], [0.46, 0.34], [0.34, 0.31], [0.27, 0.22], [0.29, 0.12],
]
const DEMON_LOCK = [[0.4, 0.07], [0.5, 0.1], [0.56, 0.2], [0.64, 0.3], [0.7, 0.42], [0.64, 0.44], [0.58, 0.36], [0.5, 0.26], [0.46, 0.18]]
const DEMON_HEAD = [
  [0.3, 0.1], [0.38, 0.08], [0.46, 0.11], [0.5, 0.19], [0.49, 0.28], [0.44, 0.33], [0.38, 0.31], [0.33, 0.34],
  [0.28, 0.3], [0.27, 0.22], [0.29, 0.16],
]

function demonParts() {
  const gears = [
    [0.9, 0.86, 0.12, 12], [0.95, 0.64, 0.07, 8], [0.06, 0.78, 0.1, 10], [0.05, 0.58, 0.06, 8],
    [0.46, 0.88, 0.07, 12, true], [0.92, 0.4, 0.08, 12, true], [0.1, 0.2, 0.08, 12, true],
  ]
  return [
    { circle: [0.52, 0.24, 0.3], palette: PAL.sun, light: [0.52, 0.24] },
    ...gears.flatMap(([u, v, r, n, flower]) => gearParts(u, v, r, n, flower)),
    R(DEMON_HAIR, PAL.hair, [0.55, 0.12]),
    R(DEMON_LEGS, PAL.overall, [0.22, 0.42]),
    R(DEMON_TORSO, PAL.skin, [0.55, 0.26]),
    R([[0.44, 0.62], [0.48, 0.7], [0.36, 0.72], [0.22, 0.64], [0.18, 0.56], [0.26, 0.56], [0.34, 0.62]], PAL.skin, [0.2, 0.56]),
    R([[0.62, 0.26], [0.66, 0.36], [0.6, 0.5], [0.5, 0.6], [0.38, 0.56], [0.28, 0.5], [0.24, 0.44], [0.3, 0.4], [0.4, 0.46], [0.48, 0.46], [0.52, 0.38], [0.5, 0.28]], PAL.skin, [0.6, 0.28], { flow: 2.2 }),
    R([[0.22, 0.4], [0.3, 0.37], [0.37, 0.42], [0.36, 0.5], [0.28, 0.54], [0.22, 0.49]], PAL.skin, [0.26, 0.4], { tile: 1 / 200 }),
    R(DEMON_HEAD, PAL.skin, [0.44, 0.12], { tile: 1 / 170 }),
    R([[0.29, 0.19], [0.35, 0.18], [0.36, 0.21], [0.3, 0.22]], PAL.hair, [0.3, 0.2], { tile: 1 / 260 }),
    R([[0.27, 0.15], [0.37, 0.15], [0.4, 0.18], [0.3, 0.17]], PAL.hair, [0.3, 0.15], { tile: 1 / 260 }),
    R(DEMON_LOCK, PAL.hair, [0.5, 0.1]),
    R(wrench(0.58, 0.52, 0.42, Math.PI + 0.18), PAL.gold, [0.2, 0.44], { flow: Math.PI + 0.18 }),
  ]
}

// Six-winged Seraph, a cosmonaut: three pairs of wings from the shoulders, a gear for a halo,
// a lamp raised in one hand and a wrench in the other, on a night full of sparks.
function seraphParts(rng) {
  // [shoulder offset from the axis, root v, degrees above horizontal, length]: lower, middle, upper
  const wings = [[0.07, 0.42, -38, 0.31], [0.09, 0.4, 12, 0.38], [0.08, 0.37, 58, 0.36]].flatMap(([off, ov, deg, len]) =>
    [true, false].map((left) => {
      const ou = left ? 0.5 - off : 0.5 + off
      const a = (deg * Math.PI) / 180
      return R(wing(ou, ov, deg, len, 0.095, left), PAL.wing, [ou, ov], { flow: Math.atan2(-Math.sin(a), (left ? -1 : 1) * Math.cos(a)) })
    }),
  )
  const stars = Array.from({ length: 26 }, () => {
    const u = 0.04 + rng() * 0.92
    const v = 0.03 + rng() * 0.9
    return flat(star4(u, v, 0.008 + rng() * 0.014), 0xf2ecd8)
  })
  return [
    ...stars,
    ...wings,
    R(gear(0.5, 0.22, 0.16, 16), PAL.gold, [0.4, 0.12], { origin: [0.5, 0.22] }),
    R([[0.44, 0.31], [0.56, 0.31], [0.62, 0.35], [0.66, 0.48], [0.69, 0.65], [0.73, 0.82], [0.77, 0.95], [0.23, 0.95], [0.27, 0.82], [0.31, 0.65], [0.34, 0.48], [0.38, 0.35]], PAL.robe, [0.5, 0.5]),
    R([[0.43, 0.33], [0.57, 0.33], [0.59, 0.47], [0.55, 0.52], [0.45, 0.52], [0.41, 0.47]], PAL.helmet, [0.45, 0.34], { tile: 1 / 160 }),
    R(star5(0.5, 0.42, 0.03), PAL.gold, [0.48, 0.4], { tile: 1 / 220 }),
    R(rect(0.39, 0.54, 0.61, 0.58), PAL.gold, [0.4, 0.54], { tile: 1 / 200 }),
    R(limb([[0.41, 0.37], [0.31, 0.43], [0.27, 0.33], [0.26, 0.27]], 0.045), PAL.robe, [0.41, 0.37], { flow: Math.atan2(-0.1, -0.15), tile: 1 / 160 }),
    R(limb([[0.59, 0.37], [0.68, 0.45], [0.69, 0.55]], 0.045), PAL.robe, [0.59, 0.37], { flow: Math.atan2(0.18, 0.1), tile: 1 / 160 }),
    R(ngon(0.26, 0.255, 0.03, 6), PAL.helmet, [0.25, 0.24], { tile: 1 / 220 }),
    R(ngon(0.69, 0.56, 0.03, 6), PAL.helmet, [0.68, 0.55], { tile: 1 / 220 }),
    R(wrench(0.69, 0.55, 0.28, -1.2), PAL.helmet, [0.7, 0.5], { flow: -1.2 }),
    flat(star4(0.26, 0.2, 0.075), 0xf2ecd8),
    R(ngon(0.26, 0.2, 0.04, 8, Math.PI / 8), PAL.lamp, [0.24, 0.18], { tile: 1 / 240 }),
    flat(ngon(0.26, 0.2, 0.018, 8, Math.PI / 8), 0xf2ecd8),
    R([[0.43, 0.295], [0.57, 0.295], [0.58, 0.32], [0.42, 0.32]], PAL.gold, [0.43, 0.3], { tile: 1 / 240 }),
    { circle: [0.5, 0.22, 0.085], palette: PAL.helmet, light: [0.46, 0.18], tile: 1 / 170 },
    R([[0.43, 0.19], [0.5, 0.175], [0.57, 0.19], [0.58, 0.25], [0.5, 0.265], [0.42, 0.25]], PAL.visor, [0.5, 0.18], { tile: 1 / 220 }),
    flat(star4(0.54, 0.205, 0.02), 0xf2ecd8),
  ]
}

// Pan, the old mechanic: a bald head with horns, a beard of shards, a quilted work jacket with
// a badge, a wrench in one fist, a bundle of steel pipes in the other, the moon behind.
const PAN_HORN = [[0.43, 0.24], [0.37, 0.23], [0.31, 0.19], [0.27, 0.13], [0.26, 0.06], [0.3, 0.03], [0.31, 0.1], [0.35, 0.15], [0.41, 0.17], [0.46, 0.19]]
const PAN_EAR = [[0.34, 0.34], [0.27, 0.27], [0.22, 0.2], [0.26, 0.33], [0.3, 0.43], [0.35, 0.46]]
const PAN_BROW = [[0.36, 0.35], [0.44, 0.37], [0.48, 0.4], [0.45, 0.41], [0.4, 0.395], [0.36, 0.38]]
const PAN_EYE = [[0.385, 0.425], [0.45, 0.425], [0.44, 0.445], [0.39, 0.44]]
const PAN_BEARD = [[0.33, 0.45], [0.36, 0.56], [0.31, 0.66], [0.35, 0.77], [0.41, 0.88], [0.47, 0.93], [0.49, 0.72], [0.44, 0.58], [0.38, 0.52]]

function panParts() {
  const pipes = [0, 1, 2, 3, 4].flatMap((k) => {
    const u = 0.69 + k * 0.05
    const top = 0.48 + k * 0.06
    return [R(rect(u, top, u + 0.046, 0.94), PAL.ochre, [u, top], { flow: Math.PI / 2 }), flat(rect(u + 0.006, top, u + 0.04, top + 0.014), 0x14102a)]
  })
  return [
    { circle: [0.2, 0.2, 0.12], palette: PAL.moon, light: [0.16, 0.16] },
    R([[0.04, 0.95], [0.06, 0.84], [0.14, 0.74], [0.28, 0.66], [0.4, 0.62], [0.6, 0.62], [0.72, 0.66], [0.86, 0.74], [0.94, 0.84], [0.96, 0.95]], PAL.jacket, [0.5, 0.62]),
    R(star5(0.17, 0.8, 0.045), PAL.gold, [0.15, 0.78], { tile: 1 / 200 }),
    R(PAN_EAR, PAL.panSkin, [0.25, 0.25], { tile: 1 / 200 }),
    R(mirror(PAN_EAR), PAL.panSkin, [0.75, 0.25], { tile: 1 / 200 }),
    R(PAN_HORN, PAL.ochre, [0.3, 0.05]),
    R(mirror(PAN_HORN), PAL.ochre, [0.7, 0.05]),
    R([[0.5, 0.2], [0.58, 0.21], [0.65, 0.27], [0.68, 0.37], [0.66, 0.47], [0.62, 0.56], [0.56, 0.62], [0.5, 0.64], [0.44, 0.62], [0.38, 0.56], [0.34, 0.47], [0.32, 0.37], [0.35, 0.27], [0.42, 0.21]], PAL.panSkin, [0.44, 0.28], { tile: 1 / 170 }),
    R([[0.48, 0.41], [0.52, 0.41], [0.55, 0.5], [0.58, 0.54], [0.5, 0.56], [0.42, 0.54], [0.45, 0.5]], PAL.panShade, [0.4, 0.42], { tile: 1 / 220 }),
    R(PAN_BROW, PAL.beard, [0.36, 0.35], { tile: 1 / 260 }),
    R(mirror(PAN_BROW), PAL.beard, [0.64, 0.35], { tile: 1 / 260 }),
    R(PAN_EYE, PAL.hair, [0.4, 0.42], { tile: 1 / 260 }),
    R(mirror(PAN_EYE), PAL.hair, [0.6, 0.42], { tile: 1 / 260 }),
    R(PAN_BEARD, PAL.beard, [0.4, 0.5]),
    R(mirror(PAN_BEARD), PAL.beard, [0.6, 0.5]),
    R([[0.44, 0.58], [0.5, 0.62], [0.56, 0.58], [0.62, 0.7], [0.57, 0.84], [0.5, 0.95], [0.43, 0.84], [0.38, 0.7]], PAL.beard, [0.5, 0.6]),
    R([[0.5, 0.5], [0.57, 0.48], [0.65, 0.5], [0.7, 0.55], [0.62, 0.58], [0.55, 0.56], [0.5, 0.58], [0.45, 0.56], [0.38, 0.58], [0.3, 0.55], [0.35, 0.5], [0.43, 0.48]], PAL.beard, [0.5, 0.48]),
    ...pipes,
    R([[0.66, 0.78], [0.74, 0.74], [0.82, 0.77], [0.82, 0.88], [0.72, 0.92], [0.65, 0.88]], PAL.panSkin, [0.68, 0.76], { tile: 1 / 200 }),
    R([[0.8, 0.8], [0.88, 0.78], [0.95, 0.83], [0.94, 0.92], [0.85, 0.94], [0.8, 0.9]], PAL.panSkin, [0.82, 0.8], { tile: 1 / 200 }),
    R([[0.04, 0.84], [0.12, 0.8], [0.18, 0.85], [0.16, 0.93], [0.08, 0.95], [0.03, 0.91]], PAL.panSkin, [0.06, 0.82], { tile: 1 / 200 }),
    R(wrench(0.1, 0.88, 0.36, -0.4), PAL.gold, [0.4, 0.75], { flow: -0.4 }),
  ]
}

const PAINTERS = { demon: demonParts, seraph: seraphParts, pan: panParts }

// ---------------------------------------------------------------- the picture

/**
 * Paints `subject` over the whole canvas on `ctx`. The frieze is three square slots, demon,
 * seraph, pan, on one background that repeats exactly at the edges, with a gear on each seam
 * and one on each edge; those two are the same gear cut by the wrap, so it joins whole.
 */
export function paintMural(ctx, width, height, subject, seed = 1) {
  if (!SUBJECTS.includes(subject)) throw new Error(`unknown mural subject: ${subject}`)
  const rng = lcg(seed)
  const paint = (P, parts) => parts.forEach((part) => drawRegion(P, part))
  const sky = (box, extra) => ({ poly: box, tile: 1 / 100, axis: 'v', ow: 0, ...SKY[subject], ...extra })

  if (subject !== 'frieze') {
    const P = { ctx, rng, map: (u, v) => [u * width, v * height], px: Math.min(width, height) }
    drawRegion(P, sky(rect(0, 0, 1, 1)))
    paint(P, PAINTERS[subject](rng))
    return
  }

  const sx = width / 3
  const sy = height
  const px = Math.min(sx, sy)
  const whole = { ctx, rng, map: (u, v) => [u * sx, v * sy], px } // u runs 0..3, one per slot
  drawRegion(whole, sky(rect(0, 0, 3, 1), { period: 3 }))
  ;['demon', 'seraph', 'pan'].forEach((name, k) => {
    const P = { ctx, rng, map: (u, v) => [(k + u) * sx, v * sy], px }
    ctx.save()
    ctx.beginPath()
    ctx.rect(k * sx, 0, sx, sy)
    ctx.clip()
    paint(P, PAINTERS[name](rng))
    ctx.restore()
  })
  for (const u of [0, 1, 2, 3]) {
    // the same seed and origin: the gear at 0 and the gear at 3 are one gear
    const seam = gearParts(u, 0.5, 0.08, 12)
    seam[0].seed = 77
    seam[1].seed = 78
    paint(whole, seam)
  }
}
