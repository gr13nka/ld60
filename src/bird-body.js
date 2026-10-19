// A bird's body built in code: one skinned mesh over eighteen bones, from a build that gives a
// bird's numbers and paint (`crow-body.js`, `gull-body.js`). Every bird has the same bones, so one
// set of pose numbers (`crow-poses.js`'s `PARAMS`) poses any of them; a build says where they sit,
// what hangs on them and how it is painted.
//
// How it is made, after how games make birds (`docs/research/crow.md`): the body, neck, head and
// upper bill are one loft of rings, skinned across the spine, neck and head bones so that it bends
// and turns as one surface with no seam; the lower bill hangs on a jaw; the tail is one solid fan;
// the legs are feathered trousers, a bare leg and its toes. Each wing is three solid plates that
// overlap (the arm with its coverts and tertials, the secondaries, the primaries), each on a bone
// of its own: spread, they lie where an arm, forearm and hand put them; folded, each lies where it
// was drawn to lie along the flank (the build's `fold`). Everything is closed and solid; the
// feathers are only painted, on one 128 px texture drawn pixel by pixel. Look only.
//
// A build (every place in metres from the body's middle in the bind pose, wings spread and the body
// level, facing +Z, +X the bird's left):
// - `joints`: `tail`, `neck1`, `neck2`, `head`, `jaw`, and the left `shoulder`, `elbow`, `wrist`
//   and `hip`, where those bones sit; `shin`, from the hip to the top of the bare leg, and `foot`,
//   from there down it to the foot;
// - `loft`: the body's rings, as `loft` takes them; `loftSkin`: `[z, { bone: weight }]`, which bones
//   its rings hang on along Z, eased between; `loftPaint(centre)`: `[region, at]` for a face
//   of it, as `paintFaces` takes it; `loftRound(centre)`: true where it shades round;
// - `jaw`: `{ rings, at }`, the lower bill as a loft and its paint in the region `jaw`;
// - `tail`: a `vane` along its length (and `shift`, metres it is set back from the tail bone);
// - `wing`: `{ arm, secondaries, primaries }`, each a `vane` of the left wing out along +X in its
//   bone's own frame; `fold`: each folded, `{ at, runs, chord }` in the body's frame (its root, the
//   way its span runs, how much of its chord is left showing); `foldLean`: how far they lean out
//   at the top, hugging the flank;
// - `legs`: `{ trousers, shank, toes, toe }`: the trousers' rings from the hip, the bare leg's one
//   ring, each toe `[turn, length]`, and `toe(length)` its rings;
// - `extras(kit)`: `[geometry, bone]` for the parts only this bird has, in the body's frame
//   (`kit.placed(bone, geometry)` moves one made about its bone to where that bone sits);
// - `regions`: where each part's paint lies in the texture, `[x, y, w, h]`, y down; `paint(brush)`
//   paints them (`brush.paint(name, colorOf)`, `brush.random`);
// - `mouth`, where a cigarette is held, and `beakTip` (along its +Z), both in the head bone's
//   frame; `eyeForward`, how far forward of square to the side each eye looks, in radians.
// - `ramp`, if given: how it takes light, as `shading.js`'s `setShade` takes it, in place of the
//   look's ramp.

import * as THREE from 'three'
import { celMaterial } from './shading.js'

// ---------------------------------------------------------------- the skeleton

// Every bird's bones, in the order they are made, a parent before its children.
const BONES = [
  ['root', null], ['tail', 'root'], ['neck1', 'root'], ['neck2', 'neck1'], ['head', 'neck2'], ['jaw', 'head'],
  ['armL', 'root'], ['secondariesL', 'root'], ['primariesL', 'root'],
  ['armR', 'root'], ['secondariesR', 'root'], ['primariesR', 'root'],
  ['hipL', 'root'], ['shinL', 'hipL'], ['footL', 'shinL'],
  ['hipR', 'root'], ['shinR', 'hipR'], ['footR', 'shinR'],
]
const INDEX = Object.fromEntries(BONES.map(([name], i) => [name, i]))
const mirror = ([x, y, z]) => [-x, y, z]
const plus = (a, b) => a.map((v, i) => v + b[i])

/** Where each bone sits in the bind pose, by name, from a build's `joints`. */
function bonePlaces({ tail, neck1, neck2, head, jaw, shoulder, elbow, wrist, hip, shin, foot }) {
  return {
    root: [0, 0, 0], tail, neck1, neck2, head, jaw,
    armL: shoulder, secondariesL: elbow, primariesL: wrist,
    armR: mirror(shoulder), secondariesR: mirror(elbow), primariesR: mirror(wrist),
    hipL: hip, shinL: plus(hip, shin), footL: plus(plus(hip, shin), foot),
    hipR: mirror(hip), shinR: mirror(plus(hip, shin)), footR: mirror(plus(plus(hip, shin), foot)),
  }
}

// ---------------------------------------------------------------- the paint

const ATLAS = 128 // the texture, this many pixels square

/** A generator of numbers in [0, 1), the same ones from the same seed. */
function seeded(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

const frac = (x) => x - Math.floor(x)

/**
 * Rows of overlapping feathers, `cols` across and `rows` down: the rounded lower edge of each is a
 * lighter line, and under it the next feather's dark root. True on that line.
 */
export function scallop(s, t, cols, rows) {
  const row = Math.floor(t * rows)
  const fx = frac(s * cols + (row % 2) * 0.5) - 0.5
  const fy = frac(t * rows)
  const arc = 0.8 - 1.6 * fx * fx
  return fy > arc - 0.2 && fy < arc + 0.05
}

/**
 * Long feathers side by side, `count` of them across `across` (0 to 1): which part of one a point
 * is on, 'edge', 'shaft' or 'vane'.
 */
export function quill(across, count) {
  const f = frac(across * count)
  if (f < 0.1 || f > 0.93) return 'edge'
  return Math.abs(f - 0.5) < 0.07 ? 'shaft' : 'vane'
}

/** A build's texture, painted once. */
function paintAtlas({ regions, paint: painter }) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = ATLAS
  const context = canvas.getContext('2d')
  const image = context.createImageData(ATLAS, ATLAS)
  // Each region is painted by `colorOf(s, t, x, y)`: s across it left to right, t down it, 0 to 1
  // (x and y the same in pixels).
  const paint = (name, colorOf) => {
    const [x0, y0, w, h] = regions[name]
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const color = colorOf((x + 0.5) / w, (y + 0.5) / h, x, y)
        const i = ((y0 + y) * ATLAS + x0 + x) * 4
        image.data[i] = (color >> 16) & 255
        image.data[i + 1] = (color >> 8) & 255
        image.data[i + 2] = color & 255
        image.data[i + 3] = 255
      }
    }
  }
  painter({ paint, random: seeded(11) })
  context.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  return texture
}

// ---------------------------------------------------------------- the shapes

// Triangles as `[x, y, z]` corners into `positions`, each wound to face away from a point
// `inside` the solid it is part of; none where two corners have run together.
function facer(positions) {
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const out = new THREE.Vector3()
  return (p, q, r, inside) => {
    a.fromArray(p)
    b.fromArray(q)
    c.fromArray(r)
    normal.subVectors(b, a).cross(out.subVectors(c, a))
    if (normal.lengthSq() < 1e-14) return
    out.copy(a).add(b).add(c).divideScalar(3).sub(inside)
    for (const point of normal.dot(out) >= 0 ? [p, q, r] : [p, r, q]) positions.push(...point)
  }
}

const geometryOf = (positions) => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

/**
 * A closed solid through `rings` along Z, each `[z, side]`: `side` the ring's outline down its
 * left (+X) half, `[x, y]` from the top to the bottom, the first and last on the middle line; the
 * right half is its mirror. A ring whose points are all one is a point. Closed at both ends.
 */
function loft(rings) {
  const loops = rings.map(([z, side]) => [...side, ...side.slice(1, -1).reverse().map(([x, y]) => [-x, y])].map(([x, y]) => [x, y, z]))
  const centre = (i) => loops[i].reduce((sum, p) => sum.add(new THREE.Vector3(...p)), new THREE.Vector3()).divideScalar(loops[i].length)
  const positions = []
  const face = facer(positions)
  for (let i = 0; i + 1 < loops.length; i++) {
    const inside = centre(i).add(centre(i + 1)).multiplyScalar(0.5)
    const n = loops[i].length
    for (let k = 0; k < n; k++) {
      const [p, q] = [loops[i][k], loops[i][(k + 1) % n]]
      const [r, s] = [loops[i + 1][k], loops[i + 1][(k + 1) % n]]
      face(p, q, r, inside)
      face(q, s, r, inside)
    }
  }
  const last = loops.length - 1
  for (const [end, next] of [[0, 1], [last, last - 1]]) {
    const loop = loops[end]
    const inside = centre(next)
    for (let k = 1; k + 1 < loop.length; k++) face(loop[0], loop[k], loop[k + 1], inside)
  }
  return geometryOf(positions)
}

// `points` (lists of numbers) with `steps - 1` more between each two, on a Catmull-Rom curve through them.
function smoothed(points, steps) {
  const curve = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t)
  const out = []
  for (let i = 0; i + 1 < points.length; i++) {
    const [p0, p1, p2, p3] = [points[Math.max(0, i - 1)], points[i], points[i + 1], points[Math.min(points.length - 1, i + 2)]]
    for (let step = 0; step < steps; step++) out.push(p1.map((_, k) => curve(p0[k], p1[k], p2[k], p3[k], step / steps)))
  }
  out.push(points[points.length - 1].slice())
  return out
}

/** `geometry` mirrored across X, its faces wound again to face the way they did. */
function mirrored(geometry) {
  const copy = geometry.clone().scale(-1, 1, 1)
  for (const name of ['position', 'uv']) {
    const attribute = copy.attributes[name]
    if (!attribute) continue
    const { itemSize, array } = attribute
    for (let t = 0; t < attribute.count; t += 3) {
      for (let k = 0; k < itemSize; k++) {
        const one = (t + 1) * itemSize + k
        const two = (t + 2) * itemSize + k
        ;[array[one], array[two]] = [array[two], array[one]]
      }
    }
  }
  return copy
}

/**
 * Normals for `geometry`: each face's own, and where `smoothOf(centre)` gives two faces meeting at
 * a point the same group, averaged there, so a round part shades round and keeps its painted faces.
 */
function shade(geometry, smoothOf = () => null) {
  geometry.computeVertexNormals()
  const position = geometry.attributes.position
  const normal = geometry.attributes.normal
  const groups = []
  const corner = new THREE.Vector3()
  const centre = new THREE.Vector3()
  for (let f = 0; f < position.count; f += 3) {
    centre.set(0, 0, 0)
    for (let k = 0; k < 3; k++) centre.add(corner.fromBufferAttribute(position, f + k))
    groups.push(smoothOf(centre.divideScalar(3)))
  }
  const key = (i) => `${groups[Math.floor(i / 3)]}:${Math.round(position.getX(i) * 1e5)},${Math.round(position.getY(i) * 1e5)},${Math.round(position.getZ(i) * 1e5)}`
  const sums = new Map()
  const n = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) {
    if (groups[Math.floor(i / 3)] === null) continue
    const k = key(i)
    const sum = sums.get(k) ?? sums.set(k, new THREE.Vector3()).get(k)
    sum.add(n.fromBufferAttribute(normal, i))
  }
  for (let i = 0; i < position.count; i++) {
    if (groups[Math.floor(i / 3)] === null) continue
    n.copy(sums.get(key(i))).normalize()
    normal.setXYZ(i, n.x, n.y, n.z)
  }
  return geometry
}

/** A solid standing down from its bone, made along Z and turned to hang along −Y. */
const hanging = (geometry) => geometry.rotateX(Math.PI / 2)

/**
 * Painted round a part lying along Z from `from` to `to`: s along it, t from its top round either
 * side to its underside (the two sides take the same paint), about the line at `[x, y]`.
 */
export const around = (from, to, [x, y] = [0, 0]) => (p) => [(p.z - from) / (to - from), Math.atan2(Math.abs(p.x - x), p.y - y) / Math.PI]

const VANE_CHORD = 6 // the faces across a vane, from its leading edge to its trailing

/**
 * The shapes a build is made of, painted from its `regions`: `loft`, `vane`, `paintFaces`,
 * `painted`, `around`, `shade`, `mirrored`, `hanging`.
 */
function kitFor(regions) {
  /** The texture coordinates of `[s, t]` across and down the region `name`, half a pixel in from its edges so that the next region's paint never bleeds in. */
  const uvIn = (name, s, t) => {
    const [x0, y0, w, h] = regions[name]
    const clamp = (v) => Math.min(1, Math.max(0, v))
    return [(x0 + 0.5 + clamp(s) * (w - 1)) / ATLAS, 1 - (y0 + 0.5 + clamp(t) * (h - 1)) / ATLAS]
  }

  /**
   * Texture coordinates for `geometry` (a face to each three vertices), each face painted whole
   * from one region: `pick(centre)` gives `[region, at]` for the face's middle, and `at(point)`
   * the `[s, t]` of each corner in it.
   */
  function paintFaces(geometry, pick) {
    const position = geometry.attributes.position
    const uv = new Float32Array(position.count * 2)
    const corner = new THREE.Vector3()
    const centre = new THREE.Vector3()
    for (let f = 0; f < position.count; f += 3) {
      centre.set(0, 0, 0)
      for (let k = 0; k < 3; k++) centre.add(corner.fromBufferAttribute(position, f + k))
      const [name, at] = pick(centre.divideScalar(3))
      for (let k = 0; k < 3; k++) uv.set(uvIn(name, ...at(corner.fromBufferAttribute(position, f + k))), (f + k) * 2)
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    return geometry
  }

  /** The same, the whole of `geometry` from one region. */
  const painted = (geometry, name, at) => paintFaces(geometry, () => [name, at])

  /**
   * A feathered surface (a wing's plate, the tail) as a solid round in section, not a board:
   * through `stations` along its span, each `[x, lead, trail]` (at x, its leading edge at z = lead
   * and its trailing edge at trail), eased into a smooth outline between them; thickest a third of
   * the way back from its leading edge and coming to an edge at both, `thick` through at the most;
   * arched by `camber`, and bending down by `droop` toward its far end. Painted from the region
   * `name`, s along the span and t back across it, or the other way about if `across`. Both its
   * faces take the same paint: folded along the flank, it is a plate's underside that faces out.
   */
  function vane(stations, { thick, camber = 0, droop = 0, name, across = false }) {
    const rows = smoothed(stations, 3)
    const x0 = rows[0][0]
    const span = rows[rows.length - 1][0] - x0
    const chord = Array.from({ length: VANE_CHORD + 1 }, (_, k) => (k / VANE_CHORD) ** 1.3) // closer at the leading edge, where it rounds
    const surface = (sign) => rows.map(([x, lead, trail]) => {
      const along = (x - x0) / span
      return chord.map((u) => {
        const half = thick * 1.3 * Math.sqrt(u) * (1 - u)
        const y = camber * Math.sin(Math.PI * u) - droop * along * along + sign * half
        return { at: [x, y, lead + (trail - lead) * u], uv: across ? uvIn(name, u, along) : uvIn(name, along, u) }
      })
    })
    const top = surface(1)
    const bottom = surface(-1)
    const positions = []
    const uvs = []
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    const normal = new THREE.Vector3()
    const out = new THREE.Vector3()
    const mean = (corners) => corners.reduce((sum, { at }) => sum.add(a.fromArray(at)), new THREE.Vector3()).divideScalar(corners.length)
    // A triangle wound to face away from `inside`; none where two corners have run together.
    const face = (p, q, r, inside) => {
      a.fromArray(p.at)
      b.fromArray(q.at)
      c.fromArray(r.at)
      normal.subVectors(b, a).cross(out.subVectors(c, a))
      if (normal.lengthSq() < 1e-14) return
      out.copy(a).add(b).add(c).divideScalar(3).sub(inside)
      for (const corner of normal.dot(out) >= 0 ? [p, q, r] : [p, r, q]) {
        positions.push(...corner.at)
        uvs.push(...corner.uv)
      }
    }
    for (let i = 0; i + 1 < rows.length; i++) {
      for (let k = 0; k < VANE_CHORD; k++) {
        const quad = (side) => [side[i][k], side[i][k + 1], side[i + 1][k], side[i + 1][k + 1]]
        for (const [skin, under] of [[quad(top), quad(bottom)], [quad(bottom), quad(top)]]) {
          const inside = mean(under)
          face(skin[0], skin[1], skin[2], inside)
          face(skin[1], skin[3], skin[2], inside)
        }
      }
    }
    // Its two ends closed, each round its section.
    for (const [end, next] of [[0, 1], [rows.length - 1, rows.length - 2]]) {
      const ring = [...top[end], ...bottom[end].slice(1, -1).reverse()]
      const inside = mean([...top[next], ...bottom[next]])
      for (let k = 1; k + 1 < ring.length; k++) face(ring[0], ring[k], ring[k + 1], inside)
    }
    const geometry = geometryOf(positions)
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    return geometry
  }

  return { loft, vane, paintFaces, painted, around, shade, mirrored, hanging }
}

const PLATES = ['arm', 'secondaries', 'primaries']

/** Every part's geometry, painted, with the bones its vertices hang on, made one: the bird's skinned geometry. */
function makeGeometry(build, at) {
  const kit = kitFor(build.regions)
  const { loft, vane, paintFaces, painted, around, shade, mirrored, hanging } = kit
  const parts = [] // [geometry (positions, uvs, normals, a face to each three), skinOf(point) → [[bone, weight], …]]
  const rigid = (bone) => () => [[INDEX[bone], 1]]
  const placed = (bone, geometry) => geometry.translate(...at[bone])

  const body = paintFaces(loft(build.loft), build.loftPaint)
  parts.push([shade(body, (c) => (build.loftRound(c) ? 'round' : null)), loftSkin(build.loftSkin)])
  parts.push([shade(painted(loft(build.jaw.rings), 'jaw', build.jaw.at)), rigid('jaw')])
  for (const [geometry, bone] of build.extras?.({ ...kit, placed }) ?? []) parts.push([geometry, rigid(bone)])
  const round = () => 'round'
  const tail = vane(build.tail.stations, { ...build.tail, name: 'tail', across: true }).rotateY(Math.PI / 2).translate(0, 0, build.tail.shift)
  parts.push([shade(placed('tail', tail), round), rigid('tail')])

  for (const name of PLATES) {
    const plate = build.wing[name]
    const left = vane(plate.stations, { ...plate, name })
    parts.push([shade(placed(`${name}L`, left.clone()), round), rigid(`${name}L`)])
    parts.push([shade(placed(`${name}R`, mirrored(left)), round), rigid(`${name}R`)])
  }

  const { trousers: rings, shank: ring, toes, toe } = build.legs
  const footDown = -build.joints.foot[1]
  for (const side of ['L', 'R']) {
    const flip = (geometry) => (side === 'R' ? mirrored(geometry) : geometry)
    const trousers = hanging(painted(loft(rings), 'trousers', around(rings[0][0], rings[rings.length - 1][0])))
    parts.push([shade(placed(`hip${side}`, flip(trousers))), rigid(`hip${side}`)])
    const shank = hanging(painted(loft([ring, [footDown, ring[1]]]), 'leg', (p) => [0.5, p.z / footDown]))
    parts.push([shade(placed(`shin${side}`, flip(shank))), rigid(`shin${side}`)])
    for (const [turn, length] of toes) {
      const painting = painted(loft(toe(length)), 'toes', (p) => [p.z / length, 0.5]).rotateY(turn).translate(0, 0.003, 0)
      parts.push([shade(placed(`foot${side}`, flip(painting))), rigid(`foot${side}`)])
    }
  }

  // Made one, each vertex carrying its two bones and their weights.
  const positions = []
  const normals = []
  const uvs = []
  const skinIndex = []
  const skinWeight = []
  const point = new THREE.Vector3()
  for (const [geometry, skinOf] of parts) {
    const { position, normal, uv } = geometry.attributes
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i)
      positions.push(point.x, point.y, point.z)
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i))
      uvs.push(uv.getX(i), uv.getY(i))
      const weights = skinOf(point)
      skinIndex.push(weights[0][0], weights[1]?.[0] ?? 0, 0, 0)
      skinWeight.push(weights[0][1], weights[1]?.[1] ?? 0, 0, 0)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4))
  return geometry
}

// The two bones a ring of the loft hangs on at `point.z`, from `marks` (`[z, { bone: weight }]`),
// eased between them.
const loftSkin = (marks) => (point) => {
  const z = point.z
  let after = marks.findIndex(([at]) => at >= z)
  if (after < 0) after = marks.length - 1
  const before = Math.max(0, after - 1)
  const [z0, w0] = marks[before]
  const [z1, w1] = marks[after]
  const t = z1 === z0 ? 1 : THREE.MathUtils.clamp((z - z0) / (z1 - z0), 0, 1)
  const weights = {}
  for (const [bone, w] of Object.entries(w0)) weights[bone] = (weights[bone] ?? 0) + w * (1 - t)
  for (const [bone, w] of Object.entries(w1)) weights[bone] = (weights[bone] ?? 0) + w * t
  const best = Object.entries(weights).sort((a, b) => b[1] - a[1]).slice(0, 2)
  const total = best.reduce((sum, [, w]) => sum + w, 0)
  return best.map(([bone, w]) => [INDEX[bone], w / total])
}

// ---------------------------------------------------------------- posing

/** A transform mirrored across the body's middle plane. */
function mirroredTransform({ position, quaternion, scale }) {
  return {
    position: new THREE.Vector3(-position.x, position.y, position.z),
    quaternion: new THREE.Quaternion(quaternion.x, -quaternion.y, -quaternion.z, quaternion.w),
    scale: scale.clone(),
  }
}

// Each wing plate folded, as a transform in the body's frame, left and right.
function foldedOf({ fold, foldLean }) {
  const folded = {}
  const up = new THREE.Vector3(foldLean, 1, 0).normalize()
  for (const name of PLATES) {
    const { at, runs, chord } = fold[name]
    const x = new THREE.Vector3(...runs).normalize()
    const z = up.clone().addScaledVector(x, -up.dot(x)).normalize()
    const y = new THREE.Vector3().crossVectors(z, x)
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
    const left = { position: new THREE.Vector3(...at), quaternion, scale: new THREE.Vector3(1, 1, chord) }
    folded[`${name}L`] = left
    folded[`${name}R`] = mirroredTransform(left)
  }
  return folded
}

// The left wing as an arm, for where its plates lie spread: shoulder, elbow, wrist.
function chainOf({ shoulder: S, elbow: E, wrist: W }) {
  const shoulder = new THREE.Object3D()
  shoulder.position.fromArray(S)
  shoulder.rotation.order = 'YZX'
  const elbow = new THREE.Object3D()
  elbow.position.set(E[0] - S[0], E[1] - S[1], E[2] - S[2])
  elbow.rotation.order = 'YZX'
  const wrist = new THREE.Object3D()
  wrist.position.set(W[0] - E[0], W[1] - E[1], W[2] - E[2])
  wrist.rotation.order = 'YZX'
  shoulder.add(elbow)
  elbow.add(wrist)
  return { shoulder, elbow, wrist }
}

const _spread = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1) }
const _scale = new THREE.Vector3()
const MADE = new Map() // each build's geometry, material, fold and arm, made once

/** A bird's body from `build`: `{ group, head, mouth, feet, beakTip, eyeForward, pose(p, base) }`. */
export function createBirdBody(build) {
  let made = MADE.get(build)
  if (!made) {
    const at = bonePlaces(build.joints)
    made = { at, geometry: makeGeometry(build, at), material: celMaterial({ map: paintAtlas(build), side: THREE.DoubleSide, ramp: build.ramp }), folded: foldedOf(build), chain: chainOf(build.joints) }
    MADE.set(build, made)
  }
  const { at, geometry, material, folded: FOLDED, chain } = made
  const bones = BONES.map(([name]) => {
    const bone = new THREE.Bone()
    bone.name = name
    bone.rotation.order = 'YXZ'
    return bone
  })
  BONES.forEach(([name, parent], i) => {
    const bone = bones[i]
    if (parent === null) return bone.position.fromArray(at[name])
    const from = at[parent]
    const to = at[name]
    bone.position.set(to[0] - from[0], to[1] - from[1], to[2] - from[2])
    bones[INDEX[parent]].add(bone)
  })
  const mesh = new THREE.SkinnedMesh(geometry, material)
  mesh.add(bones[0])
  mesh.bind(new THREE.Skeleton(bones))
  mesh.castShadow = true
  mesh.frustumCulled = false // posed far from where its geometry lies
  const group = new THREE.Group()
  group.rotation.order = 'YXZ'
  group.add(mesh)
  const bone = (name) => bones[INDEX[name]]
  // Where a cigarette is held.
  const mouth = new THREE.Object3D()
  mouth.position.fromArray(build.mouth)
  bone('head').add(mouth)
  const pitchOf = (name) => bone(name).rotation.x

  return {
    group,
    head: bone('head'),
    mouth,
    feet: [bone('footL'), bone('footR')],
    beakTip: build.beakTip,
    eyeForward: build.eyeForward,
    /**
     * Sets every bone from `p`, a pose of `crow-poses.js`'s numbers. `base` is how far the whole
     * bird is already pitched, nose down (the group's turn in flight): the head and the legs are
     * held level and down against it and the body's own pitch.
     */
    pose(p, base = 0) {
      const root = bone('root')
      root.position.set(0, -p.drop, 0)
      root.rotation.set(-p.rise, 0, 0)
      const tail = bone('tail')
      tail.rotation.set(-p.tail, 0, 0)
      tail.scale.set(1 + 0.7 * p.fan, 1, 1)

      // The neck raises the head (crane) or pushes it forward and down (reach) and shares the
      // look; the head itself is held at the pitch asked of it in the world.
      bone('neck1').rotation.set(-0.6 * p.crane + 0.55 * p.reach, 0.25 * p.lookYaw, 0)
      bone('neck2').rotation.set(-0.4 * p.crane + 0.45 * p.reach, 0.35 * p.lookYaw, 0)
      const above = base + pitchOf('root') + pitchOf('neck1') + pitchOf('neck2')
      bone('head').rotation.set(p.headPitch - above, 0.4 * p.lookYaw, p.tilt)
      bone('jaw').rotation.set(p.jaw, 0, 0)

      // The legs hang at `legs` from straight down in the world, the bare leg leans forward by
      // `knee`, and the toes are kept level, curled by `toes`.
      for (const side of ['L', 'R']) {
        const hip = bone(`hip${side}`)
        hip.rotation.set(p.legs - base - pitchOf('root'), 0, 0)
        const shin = bone(`shin${side}`)
        shin.rotation.set(-p.knee, 0, 0)
        bone(`foot${side}`).rotation.set(-(base + pitchOf('root') + hip.rotation.x + shin.rotation.x) + p.toes, 0, 0)
      }

      // The wing as an arm: lifted, swept and twisted at the shoulder, bent back at the elbow and
      // the wrist, the hand cupped down; each plate where its bone of the arm puts it, eased
      // toward where it lies folded.
      chain.shoulder.rotation.set(-p.twist, -p.sweep, p.lift)
      chain.elbow.rotation.set(0, p.elbow, 0)
      chain.wrist.rotation.set(0, p.wrist, -p.cup)
      chain.shoulder.updateMatrixWorld(true)
      const joints = { arm: chain.shoulder, secondaries: chain.elbow, primaries: chain.wrist }
      for (const name of PLATES) {
        joints[name].matrixWorld.decompose(_spread.position, _spread.quaternion, _scale)
        for (const side of ['L', 'R']) {
          const spread = side === 'L' ? _spread : mirroredTransform(_spread)
          const folded = FOLDED[`${name}${side}`]
          const plate = bone(`${name}${side}`)
          plate.position.lerpVectors(spread.position, folded.position, p.fold)
          plate.quaternion.slerpQuaternions(spread.quaternion, folded.quaternion, p.fold)
          plate.scale.lerpVectors(spread.scale, folded.scale, p.fold)
        }
      }
    },
  }
}
