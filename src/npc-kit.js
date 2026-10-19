// What the NPCs are made of, the way people were made on the PlayStation (Arctic Eggs' are):
// few polygons, smooth shading, and each part wrapped in a small painted texture drawn without
// filtering, so its texels show. Every part comes from one generator. `loft` carries rings
// along a path (a torso, a head, a limb, a stalk), and `ball` is a loft around a point. `paint`
// draws a texture with a brush in the part's own (u, v), and `part` joins the two, lit the way
// every lit surface is (`celMaterial`), so the light of a look falls on it. `head` is a loft of a
// man's head, so a painted face lands where `Brush.face` puts it, and `cigarette` puts one in a
// hand or a mouth.
//
// A loft's texture wraps once around it. Its front (the side `front` names, +Z unless said) is
// at u = 0.5 and the seam is behind. It runs up the loft from v = 0 at the path's first point to
// v = 1 at its last, by length along the path, so a head lofted from chin to crown has its eyes
// about halfway up.

import * as THREE from 'three'
import { celMaterial } from './shading.js'
import { bake, createCigarette } from './models.js'

/** +X is a figure's left (it faces +Z): a pair is built once for each of these. */
export const SIDES = [1, -1]
const RING_SIDES = 8
const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)

/**
 * A shape of rings carried along a path. `points` are `{ at: [x, y, z], w, d }`, each ring an
 * ellipse reaching `w` to either side and `d` (`w` unless said) to front and back, square to
 * the path at that point. A ring of no size closes the shape there. `front` is the way the
 * rings' front faces, as far as the path allows.
 */
export function loft(points, { sides = RING_SIDES, front = Z } = {}) {
  const facing = Array.isArray(front) ? new THREE.Vector3(...front) : front
  const centres = points.map(({ at }) => new THREE.Vector3(...at))
  const n = centres.length
  const along = [0]
  for (let i = 1; i < n; i++) along.push(along[i - 1] + centres[i].distanceTo(centres[i - 1]))
  const total = along[n - 1]

  const positions = []
  const uvs = []
  const middles = [] // each vertex's ring's middle, by which a rig holds the ring (`npc-rig.js`)
  const tangent = new THREE.Vector3()
  const lastTangent = Y.clone()
  const side = new THREE.Vector3()
  const point = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    tangent.subVectors(centres[Math.min(n - 1, i + 1)], centres[Math.max(0, i - 1)])
    if (tangent.lengthSq() < 1e-12) tangent.copy(lastTangent) // two rings at one place: a flat cap
    tangent.normalize()
    lastTangent.copy(tangent)
    const ahead = squareTo(tangent, facing)
    side.crossVectors(tangent, ahead)
    const { w, d = w } = points[i]
    for (let j = 0; j <= sides; j++) {
      const angle = -Math.PI + (2 * Math.PI * j) / sides // the seam behind, the front at j = sides / 2
      point.copy(centres[i]).addScaledVector(side, Math.sin(angle) * w).addScaledVector(ahead, Math.cos(angle) * d)
      positions.push(point.x, point.y, point.z)
      middles.push(centres[i].x, centres[i].y, centres[i].z)
      uvs.push(j / sides, total > 0 ? along[i] / total : i / (n - 1))
    }
  }

  const row = sides + 1
  const indices = []
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * row + j
      indices.push(a, a + 1, a + row, a + 1, a + row + 1, a + row)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('centre', new THREE.Float32BufferAttribute(middles, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  // The seam's two columns are one edge of the shape: give them one normal, or the seam shows in the light.
  const normals = geometry.attributes.normal
  const sum = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    const first = i * row
    const last = first + sides
    sum.fromBufferAttribute(normals, first).add(point.fromBufferAttribute(normals, last)).normalize()
    normals.setXYZ(first, sum.x, sum.y, sum.z)
    normals.setXYZ(last, sum.x, sum.y, sum.z)
  }
  return geometry
}

// `front` with what lies along the path taken out. Where the path runs along it, up instead, then +X.
function squareTo(tangent, front) {
  for (const axis of [front, Y, X]) {
    const square = axis.clone().addScaledVector(tangent, -axis.dot(tangent))
    if (square.lengthSq() > 0.01) return square.normalize()
  }
}

/** An ellipsoid at `at`, `w`, `h` and `d` from its middle to its side, top and front: a loft from its foot to its crown. */
export function ball(at, [w, h, d], { sides = RING_SIDES, rings = 6 } = {}) {
  const points = []
  for (let k = 0; k <= rings; k++) {
    const turn = (Math.PI * k) / rings
    points.push({ at: [at[0], at[1] - h * Math.cos(turn), at[2]], w: w * Math.sin(turn), d: d * Math.sin(turn) })
  }
  const geometry = loft(points, { sides })
  const centre = geometry.attributes.centre
  for (let i = 0; i < centre.count; i++) centre.setXYZ(i, ...at) // held whole, by its own middle
  return geometry
}

// A man's head from the chin up, as shares of its height (`up`), its half width (`w`) and half
// depth (`d`), and how far forward its middle lies (`ahead`, of the depth): the jaw narrower and
// forward of the skull. Painted, its eyes are at v = 0.48, its nose at 0.35, its mouth at 0.18.
const HEAD = [
  { up: 0, w: 0, d: 0, ahead: 0.25 },
  { up: 0.02, w: 0.575, d: 0.55, ahead: 0.25 },
  { up: 0.146, w: 0.83, d: 0.85, ahead: 0.15 },
  { up: 0.354, w: 0.95, d: 0.95, ahead: 0.05 },
  { up: 0.604, w: 1, d: 1, ahead: 0 },
  { up: 0.813, w: 0.92, d: 0.92, ahead: -0.05 },
  { up: 0.938, w: 0.63, d: 0.65, ahead: -0.1 },
  { up: 1, w: 0, d: 0, ahead: -0.1 },
]

/** A head standing with its chin's foot at `at`, `h` tall, reaching `w` to either side and `d` to front and back. */
export function head(at, [w, h, d], { sides = 10 } = {}) {
  return loft(HEAD.map((ring) => ({ at: [at[0], at[1] + ring.up * h, at[2] + ring.ahead * d], w: ring.w * w, d: ring.d * d })), { sides })
}

/** A cigarette in `group` with its filter at `at`, turned by `[pitch, yaw]` (pitch down from level, yaw to the figure's left). Returns it. */
export function cigarette(group, at, [pitch, yaw]) {
  const { group: smoke } = createCigarette(0.075, 0.005)
  smoke.position.set(...at)
  smoke.rotation.set(pitch, yaw, 0, 'YXZ')
  group.add(smoke)
  return smoke
}

/** Bare skin: `base` with soft patches of `shade`. */
export const skinPaint = (base, shade, seed = 3) => paint(32, 32, (b) => {
  b.fill(base)
  b.blotches(shade, { count: 10, size: 8, alpha: 0.35 })
  b.grain(0.08)
}, seed)

/**
 * A mesh of `geometry` painted with `paint`: a texture from `paint`, or a colour.
 * `glow`, for a texture, lights it from within by that much: a lamp of an eye.
 */
export function part(geometry, paint, { glow = 0 } = {}) {
  const material = paint?.isTexture
    ? celMaterial({ map: paint, ...(glow ? { emissive: 0xffffff, emissiveMap: paint, emissiveIntensity: glow } : {}) })
    : celMaterial({ color: paint })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

const _paints = new Map() // a plain paint by colour, shared: `bake` keeps only its colour anyway
/** A plain lit paint of `hex`, one per colour, for what is baked (`baked`). */
export const plain = (hex) => {
  if (!_paints.has(hex)) _paints.set(hex, celMaterial({ color: hex }))
  return _paints.get(hex)
}

/**
 * `bake`, and every mesh it makes in the sun's shadows: what a prop is made of (`room-props.js`,
 * `machine-props.js`). A loft's ring middles (`centre`) are only a rig's, and a box has none:
 * merged with them, the two would not join.
 */
export function baked(parts) {
  parts.traverse((mesh) => mesh.geometry?.deleteAttribute('centre'))
  const group = bake(parts)
  group.traverse((mesh) => {
    if (mesh.isMesh) mesh.castShadow = mesh.receiveShadow = true
  })
  return group
}

/**
 * A texture `width` by `height` texels, painted by `draw`, which is handed a `Brush`. Drawn
 * without filtering or mipmaps, so it stays as blocky up close as far away, and wrapped around,
 * as a loft wraps it.
 */
export function paint(width, height, draw, seed = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const brush = new Brush(canvas.getContext('2d', { willReadFrequently: true }), width, height, seed)
  draw(brush)
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.wrapS = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * Paints a texture in the part's own (u, v), each from 0 to 1, with v up. Sizes are in texels,
 * so a blotch is as many texels wide whatever the texture's size. Colours are CSS colours.
 */
class Brush {
  constructor(context, width, height, seed) {
    this.context = context
    this.width = width
    this.height = height
    this.random = seeded(seed)
  }

  fill(color) {
    this.context.fillStyle = color
    this.context.fillRect(0, 0, this.width, this.height)
  }

  rect(u0, v0, u1, v1, color, alpha = 1) {
    const c = this.context
    c.globalAlpha = alpha
    c.fillStyle = color
    c.fillRect(Math.round(u0 * this.width), Math.round((1 - v1) * this.height), Math.max(1, Math.round((u1 - u0) * this.width)), Math.max(1, Math.round((v1 - v0) * this.height)))
    c.globalAlpha = 1
  }

  /** Soft blobs of `color` scattered over `u` × `v`, `size` texels across: paint laid on unevenly, damp, worn. */
  blotches(color, { count = 8, size = 6, alpha = 0.3, u = [0, 1], v = [0, 1] } = {}) {
    for (let i = 0; i < count; i++) {
      const x = (u[0] + this.random() * (u[1] - u[0])) * this.width
      const y = (1 - (v[0] + this.random() * (v[1] - v[0]))) * this.height
      const r = size * (0.5 + this.random() * 0.7)
      for (const shift of [-this.width, 0, this.width]) this._blob(x + shift, y, r, color, alpha) // across the seam too
    }
  }

  _blob(x, y, r, color, alpha) {
    const c = this.context
    const gradient = c.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, 'transparent')
    c.globalAlpha = alpha
    c.fillStyle = gradient
    c.fillRect(x - r, y - r, r * 2, r * 2)
    c.globalAlpha = 1
  }

  /** A round spot `r` texels across its middle; under one texel, a single texel. */
  dot(u, v, r, color, alpha = 1) {
    const c = this.context
    c.globalAlpha = alpha
    c.fillStyle = color
    const x = u * this.width
    const y = (1 - v) * this.height
    if (r < 1) c.fillRect(Math.floor(x), Math.floor(y), 1, 1)
    else {
      c.beginPath()
      c.ellipse(x, y, r, r, 0, 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1
  }

  /** A line through `points` (`[[u, v], …]`), `width` texels wide. */
  line(points, color, width = 1, alpha = 1) {
    const c = this.context
    c.globalAlpha = alpha
    c.strokeStyle = color
    c.lineWidth = width
    c.lineCap = 'round'
    c.beginPath()
    points.forEach(([u, v], i) => c[i ? 'lineTo' : 'moveTo'](u * this.width, (1 - v) * this.height))
    c.stroke()
    c.globalAlpha = 1
  }

  /** A line across the whole width every `every` texels up: quilting, ribs, the joints of a segmented body. */
  rows(every, color, alpha = 1, { v = [0, 1], width = 1 } = {}) {
    for (let y = (1 - v[1]) * this.height; y <= (1 - v[0]) * this.height; y += every) {
      this.rect(0, 1 - (y + width) / this.height, 1, 1 - y / this.height, color, alpha)
    }
  }

  /** `count` wandering lines over `u` × `v`, each `steps` texels long: veins. */
  veins(color, { count = 5, steps = 12, alpha = 0.6, u = [0, 1], v = [0, 1] } = {}) {
    for (let i = 0; i < count; i++) {
      let x = u[0] + this.random() * (u[1] - u[0])
      let y = v[0] + this.random() * (v[1] - v[0])
      let heading = this.random() * Math.PI * 2
      const points = [[x, y]]
      for (let s = 0; s < steps; s++) {
        heading += (this.random() - 0.5) * 1.2
        x += Math.cos(heading) / this.width
        y += Math.sin(heading) / this.height
        points.push([x, y])
      }
      this.line(points, color, 1, alpha)
    }
  }

  /**
   * A compound eye over the ellipse at (u, v) reaching `ru` and `rv`: facets two texels across in
   * `dark` and `light`, a few lit at the upper edge.
   */
  facets(u, v, ru, rv, dark, light, shine) {
    const c = this.context
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const du = ((x + 0.5) / this.width - u) / ru
        const dv = (1 - (y + 0.5) / this.height - v) / rv
        if (du * du + dv * dv > 1) continue
        const odd = (Math.floor(x / 2) + Math.floor(y / 2) + (Math.floor(y / 2) % 2)) % 2
        c.fillStyle = dv > 0.45 && du < 0 && this.random() < 0.5 ? shine : odd ? light : dark
        c.fillRect(x, y, 1, 1)
      }
    }
  }

  /**
   * A plain face on a head lofted chin to crown (`head`): `eyes` `[apart, v, size]`, `apart` each
   * side of the middle in u; `brows` their colour, if any; `mouth` `[v, half width]`.
   */
  face({ eyes: [apart, eyeV, size], eyeColor = '#24201e', brows, mouth, mouthColor }) {
    for (const s of SIDES) {
      this.dot(0.5 + s * apart, eyeV, size, eyeColor)
      if (brows) this.line([[0.5 + s * (apart - 0.03), eyeV + 0.08], [0.5 + s * (apart + 0.035), eyeV + 0.06]], brows, 1)
    }
    if (mouth) this.line([[0.5 - mouth[1], mouth[0]], [0.5 + mouth[1], mouth[0]]], mouthColor, 1)
  }

  /** Every texel lightened or darkened at random by up to `amount`: the noise of a scanned or hand-painted texture. */
  grain(amount) {
    const image = this.context.getImageData(0, 0, this.width, this.height)
    const data = image.data
    for (let i = 0; i < data.length; i += 4) {
      const k = 1 + (this.random() - 0.5) * 2 * amount
      data[i] = Math.min(255, data[i] * k)
      data[i + 1] = Math.min(255, data[i + 1] * k)
      data[i + 2] = Math.min(255, data[i + 2] * k)
    }
    this.context.putImageData(image, 0, 0)
  }
}

// The same numbers on every load: a mockup must look the same each time it is opened.
function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
