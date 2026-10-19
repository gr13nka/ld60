// Surfaces painted from noise, for things seen up close in the hand: a colour, a relief (as a
// normal map) and a roughness texture from one function of a point. Painted once, at load.
import * as THREE from 'three'

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** Smooth noise, 0 to 1, that repeats every `period` cells. */
export function noise(x, y, period) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const m = (n) => ((n % period) + period) % period
  const a = hash(m(xi), m(yi)), b = hash(m(xi + 1), m(yi)), c = hash(m(xi), m(yi + 1)), d = hash(m(xi + 1), m(yi + 1))
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/** `octaves` of `noise`, each twice as fine and half as strong. A scale times `period` must be whole for it to tile. */
export function fbm(x, y, period, octaves = 5) {
  let sum = 0, amp = 0.5, freq = 1
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq, period * freq)
    amp *= 0.5
    freq *= 2
  }
  return sum
}

/** A whole-number hash of a cell, 0 to 1: what makes each tile of a mosaic its own. */
export function cellHash(x, y) {
  let h = (x * 73856093) ^ (y * 19349663)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

const mix = (a, b, t) => a + (b - a) * t
const smooth = (a, b, t) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x) }
const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
const blend = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)]

/**
 * A material painted by `paint(x, y, period)`, which gives `[height 0..1, [r, g, b], roughness
 * 0..1]` over a `period`-wide square, `size` pixels across, tiled `repeat` times a metre (an
 * extruded face's UVs are its x and y in metres). `glow` lights the paint from within that much,
 * so it still reads in a dark room.
 */
export function painted(paint, { size = 256, period = 8, relief = 6, repeat = 1, metal = 0, glow = 0.25, side = THREE.FrontSide } = {}) {
  const heights = new Float32Array(size * size)
  const color = new ImageData(size, size), rough = new ImageData(size, size), normal = new ImageData(size, size)
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const [h, c, r] = paint((i / size) * period, (j / size) * period, period)
    const k = j * size + i
    heights[k] = h
    color.data.set([c[0], c[1], c[2], 255], k * 4)
    const g = Math.round(r * 255)
    rough.data.set([g, g, g, 255], k * 4)
  }
  const at = (i, j) => heights[((j + size) % size) * size + ((i + size) % size)]
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const dx = (at(i + 1, j) - at(i - 1, j)) * relief, dy = (at(i, j + 1) - at(i, j - 1)) * relief
    const len = Math.hypot(dx, dy, 1)
    normal.data.set([(-dx / len * 0.5 + 0.5) * 255, (dy / len * 0.5 + 0.5) * 255, (1 / len * 0.5 + 0.5) * 255, 255], (j * size + i) * 4)
  }
  const texture = (data, srgb) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    canvas.getContext('2d').putImageData(data, 0, 0)
    const t = new THREE.CanvasTexture(canvas)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeat, repeat)
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const map = texture(color, true)
  return new THREE.MeshStandardMaterial({
    map, normalMap: texture(normal, false), roughnessMap: texture(rough, false), roughness: 1, metalness: metal,
    emissive: 0xffffff, emissiveMap: map, emissiveIntensity: glow, side,
  })
}

// --- Paints.
/** Concrete's cast face: warm grey, fine sand, a few pale stones, pits, rust stains. */
export const concretePaint = (x, y, p) => {
  const n = fbm(x * 2, y * 2, p * 2, 5)
  const sand = fbm(x * 16, y * 16, p * 16, 2)
  const stones = smooth(0.74, 0.77, fbm(x * 6, y * 6, p * 6, 2))
  const pits = smooth(0.2, 0.14, fbm(x * 12 + 4, y * 12, p * 12, 2))
  const h = n * 0.5 + sand * 0.2 + stones * 0.2 - pits * 0.3 + 0.3
  let c = blend(rgb(0x6c675e), rgb(0x9b958a), smooth(0.25, 0.75, n))
  c = blend(c, rgb(0x857f74), (sand - 0.5) * 0.6 + 0.3)
  c = blend(c, rgb(0xb3ab9b), stones * 0.5)
  c = blend(c, rgb(0x24211d), pits)
  c = blend(c, rgb(0x6b4024), smooth(0.55, 0.8, fbm(x + 2, y, p, 4)) * 0.55)
  return [h, c, 0.95]
}
/** Concrete's broken faces: coarser, stones torn out, dark in the hollows. */
export const brokenPaint = (x, y, p) => {
  const n = fbm(x * 3, y * 3, p * 3, 5)
  const stones = smooth(0.6, 0.66, fbm(x * 6, y * 6, p * 6, 3))
  const holes = smooth(0.32, 0.24, fbm(x * 8 + 2, y * 8, p * 8, 3))
  const h = n * 0.4 + stones * 0.5 - holes * 0.4 + 0.2
  let c = blend(rgb(0x4e4a44), rgb(0x8a8478), smooth(0.2, 0.8, n))
  c = blend(c, blend(rgb(0x9d9585), rgb(0x6f6253), fbm(x * 12, y * 12, p * 12, 2)), stones * 0.8)
  c = blend(c, rgb(0x161412), holes)
  return [h, c, 0.97]
}
/** Rust, all over, flaking. */
export const rustPaint = (x, y, p) => {
  const n = fbm(x * 2, y * 2, p * 2, 5)
  const flakes = smooth(0.55, 0.6, fbm(x * 6 + 1, y * 6, p * 6, 3))
  let c = blend(rgb(0x2e1208), rgb(0x7a3a16), smooth(0.25, 0.75, n))
  c = blend(c, rgb(0xa8642e), flakes * 0.5)
  return [n * 0.6 + flakes * 0.4, c, 0.92]
}
/** Blackened iron: hammer dents, soot, rust in the low places. */
export const ironPaint = (x, y, p) => {
  const dents = fbm(x * 1.5, y * 1.5, p * 1.5, 4)
  const grain = fbm(x * 8, y * 8, p * 8, 2)
  const h = dents * 0.8 + grain * 0.2
  let c = blend(rgb(0x0e0d0c), rgb(0x3a3633), smooth(0.35, 0.75, h))
  c = blend(c, rgb(0x8a8378), smooth(0.8, 0.95, h) * 0.6)
  const rust = smooth(0.58, 0.72, fbm(x + 5, y + 2, p, 5)) * (1 - smooth(0.5, 0.8, h))
  c = blend(c, blend(rgb(0x4a1e0e), rgb(0x8a4a1c), grain), rust * 0.85)
  return [h, c, mix(0.9, 0.45, smooth(0.7, 0.95, h))]
}
/** Old paper: yellowed and foxed. A dial's, or a grimy feather's. */
export const paperPaint = (x, y, p) => {
  const n = fbm(x * 3, y * 3, p * 3, 5)
  const fox = smooth(0.62, 0.7, fbm(x * 4 + 3, y * 4, p * 4, 3))
  let c = blend(rgb(0xb9a476), rgb(0xe0d2a8), n)
  c = blend(c, rgb(0x6a4a24), fox * 0.6)
  return [n * 0.3, c, 0.9]
}
/**
 * A broken-off piece of a wall mosaic, painted once over the whole square (it does not tile):
 * smalt tesserae laid by hand in wandering rows, a sun's disc and rays on a sky, grout between,
 * whole patches fallen out to the concrete.
 */
export const mosaicPaint = (x, y, p) => {
  const u = x / p, v = y / p
  const rows = 52
  const wobble = (fbm(u * 8, v * 8, 8, 2) - 0.5) * 0.9
  const row = Math.floor(v * rows + wobble)
  const shift = cellHash(row, 7)
  const col = Math.floor(u * rows + shift + wobble * 0.6)
  const fu = u * rows + shift + wobble * 0.6 - col, fv = v * rows + wobble - row
  const cu = (col + 0.5 - shift) / rows, cv = (row + 0.5) / rows
  const grout = Math.min(fu, 1 - fu, fv, 1 - fv) < 0.08 + cellHash(col, row + 3) * 0.1
  if (smooth(0.56, 0.6, fbm(u * 6, v * 6, 6, 5)) > 0.5) {
    const [h, c, r] = concretePaint(x * 4, y * 4, p * 4)
    return [h * 0.4, c, r]
  }
  const dx = cu - 0.36, dy = cv - 0.62, r = Math.hypot(dx, dy)
  const a = Math.atan2(dy, dx)
  let tile
  if (r < 0.16) tile = blend(rgb(0xf3c12a), rgb(0xffe07a), smooth(0.16, 0.02, r))
  else if (r < 0.62 && Math.floor(((a + Math.PI) / (Math.PI * 2)) * 18) % 2 === 0) tile = r < 0.4 ? rgb(0xe0581c) : rgb(0xc8321e)
  else tile = blend(rgb(0x2f6fb8), rgb(0x9fc6e0), smooth(0.9, 0.2, cv))
  const jitter = (cellHash(col, row) - 0.5) * 50
  tile = tile.map((value) => Math.max(0, Math.min(255, value + jitter)))
  const dirt = fbm(u * 12, v * 12, 12, 3)
  if (grout) return [0.15, blend(rgb(0x3a3631), rgb(0x6a645a), dirt), 0.95]
  return [0.7 + cellHash(row, col) * 0.2, blend(tile, rgb(0x3a2a1a), smooth(0.55, 0.8, dirt) * 0.35), 0.35]
}
