// A form: a shape that is not an upright box, as numbers. Two generators make every one of
// them. A `sweep` carries a section polygon along a path of points: a slab is a rectangle
// along two points, a curved deck a rectangle along an arc, a corridor with walls that lean
// in a hollow trapezoid, a vault a hollow arch, a pipe a ring, a buttress or a ramp a
// triangle, a banked curve a rectangle rolled at each point. A `lathe` turns a profile
// about an upright axis: a pylon that flares into a cup, a silo, a bowl to slide, a ring,
// a dome, and the inside wall of a void. Every form becomes triangles (`faces.js`), and the
// same triangles are what is drawn and what a body meets.
//
// A form's record: `kind` ('sweep' or 'lathe'), `at` (`{ x, y, z }`, where its own origin
// stands), `yaw` (radians about up, 0 unless said), `scale` (a number or `[sx, sy, sz]`, 1
// unless said), `look` (a paint: a name in `place-drawn.js`'s `FORM_COLORS`, or one of the
// place's own `paints`), `smooth` (true shades what is round
// as round; otherwise every face is flat), `over` (true for one laid a few centimetres proud
// of another, a painted band or a lapping floor: drawn as winning where the two are nearer than
// the depths can tell apart), `open` (true leaves the ends uncapped; for a sweep it may also be
// 'start' or 'end', the one end left uncapped: a room with a mouth), `id` and `asset`, and the
// generator's own fields. `id` is unique among a place's forms, an integer (an asset instance's
// forms are '<tag>:<n>', `assets.js`), and the key `FaceGrid` takes the form's triangles away
// by; `place-file.js`'s `nextFormId` is the one issuer. `asset` is the tag of the baked asset
// the form is part of (`assets.js`), picked with the rest of it in the editor.
//   sweep: `section` (a polygon `[[u, v], …]` wound counter-clockwise with u to the right
//     and v up as seen looking along the path, or `{ outer, inner }` with the inner wound
//     clockwise, for a hollow), `path` (`[{ x, y, z, scale?: [su, sv], roll? }, …]`, two at
//     least, relative to `at`); the path runs through the section's (0, 0). `bevel`
//     (`{ size, segments }`, none unless said) takes every edge off: each corner of the section
//     rounded along the path, and the rim of each capped end rounded into the cap, `size` metres
//     back along each face, in `segments` (1 to 8; 1 is a straight chamfer). A corner turning
//     less than `BEVEL_CORNER` is left, so a pipe's round is as it was; the size is cut down where
//     a face is too short to take it.
//   lathe: `profile` (`[[r, y], …]`, the solid's outline in the half plane, wound
//     counter-clockwise with the solid on its left: up the outside, in across the top, down
//     the inside; closed by itself unless both ends are on the axis), `sides` (24 unless
//     said), `arc` (`[from, to]` radians, the whole turn unless said).
// Pure: no scene.

import { ShapeUtils, Vector2, Vector3 } from 'three'
import { triangle } from './faces.js'

const SIDES = 24
const BEVEL_CORNER = (40 * Math.PI) / 180 // a section's corner turning less than this is not rounded: a 12-sided pipe and anything rounder keeps its round
const BEVEL_SHARE = 0.45 // of the shorter edge at a corner, or of an end stretch of the path, the most a bevel takes
const BEVEL_SEGMENTS = 8 // the most a round is cut into
const UP = new Vector3(0, 1, 0)
const AHEAD = new Vector3(0, 0, 1)
const TAU = Math.PI * 2

// --- Sections for a sweep. The path runs through (0, 0) of each. ---

/** A rectangle `w` across and `h` tall, its foot at `v0`: a slab or a beam. */
export const rect = (w, h, v0 = 0) => [
  [-w / 2, v0],
  [w / 2, v0],
  [w / 2, v0 + h],
  [-w / 2, v0 + h],
]
/** A rectangle whose top is another width than its foot: walls that lean in (or out). */
export const trapezoid = (wFoot, wTop, h, v0 = 0) => [
  [-wFoot / 2, v0],
  [wFoot / 2, v0],
  [wTop / 2, v0 + h],
  [-wTop / 2, v0 + h],
]
/** A slab with its top rounded, `r` the rounding, after the slabs with rounded ends in VHOLUME. */
export function roundedTop(w, h, r, v0 = 0, sides = 6) {
  const points = [
    [-w / 2, v0],
    [w / 2, v0],
  ]
  const arc = (cx, cy, from, to) => {
    for (let i = 0; i <= sides; i++) {
      const angle = from + ((to - from) * i) / sides
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
    }
  }
  arc(w / 2 - r, v0 + h - r, 0, Math.PI / 2)
  arc(-w / 2 + r, v0 + h - r, Math.PI / 2, Math.PI)
  return points
}
// A rectangle `w` across and `h` up from `v0`, its four corners rounded by `r`. Swept up an
// upright path it is a plan: u is +X and v is +Z, so a building with soft corners.
export function roundedRect(w, h, r, v0 = -h / 2, sides = 4) {
  const radius = Math.min(r, w / 2, h / 2)
  const points = []
  const corner = (cu, cv, from) => {
    for (let i = 0; i <= sides; i++) {
      const angle = from + (Math.PI / 2) * (i / sides)
      points.push([cu + radius * Math.cos(angle), cv + radius * Math.sin(angle)])
    }
  }
  corner(w / 2 - radius, v0 + radius, -Math.PI / 2)
  corner(w / 2 - radius, v0 + h - radius, 0)
  corner(-w / 2 + radius, v0 + h - radius, Math.PI / 2)
  corner(-w / 2 + radius, v0 + radius, Math.PI)
  return points
}
/** A circle of `radius`: a solid pipe or a beam. */
export const circle = (radius, sides = SIDES, cu = 0, cv = 0) => Array.from({ length: sides }, (_, i) => [cu + radius * Math.cos((TAU * i) / sides), cv + radius * Math.sin((TAU * i) / sides)])
/** A hollow pipe of `radius`, its wall `thick`: the path runs along its axis. */
export const ring = (radius, thick, sides = SIDES) => ({ outer: circle(radius, sides), inner: circle(radius - thick, sides).reverse() })
/**
 * A vaulted tunnel: `inner` wide at the floor and as tall as its half round, in a wall
 * `thick`, with a floor `floor` thick under it. The path runs along the floor's middle.
 */
export function arch(inner, thick, floor = 1, sides = 12) {
  const r = inner / 2
  const half = (radius, cv, from, to) => Array.from({ length: sides + 1 }, (_, i) => [radius * Math.cos(from + ((to - from) * i) / sides), cv + radius * Math.sin(from + ((to - from) * i) / sides)])
  return {
    outer: [[-r - thick, -floor], [r + thick, -floor], ...half(r + thick, 0, 0, Math.PI)],
    inner: half(r, 0, Math.PI, 0),
  }
}
/** A ramp as `ramp.js` has them: a ridge with a face either side, `reach` out and `drop` down. */
export const tent = (reach, drop) => [
  [0, 0],
  [-reach, -drop],
  [reach, -drop],
]

const hundredths = (v) => Math.round(v * 100) / 100
const signedArea = (c) => c.reduce((s, [x, z], i) => s + x * c[(i + 1) % c.length][1] - c[(i + 1) % c.length][0] * z, 0) / 2
const meanOf = (c) => [c.reduce((s, [x]) => s + x, 0) / c.length, c.reduce((s, [, z]) => s + z, 0) / c.length]

/**
 * A sweep record standing the outline `corners` (`[[x, z], …]`, in the world, either way round)
 * from the height `y0` up to `y1`: its section the outline about the corners' middle, wound so
 * that it is counter-clockwise, its `at` that middle at `y0`, its path straight up. A building
 * on a plan, a platform drawn in the editor. To the centimetre.
 */
export function prism(corners, y0, y1, look, id) {
  const wound = signedArea(corners) > 0 ? corners : [...corners].reverse()
  const [cx, cz] = meanOf(wound)
  return { id, kind: 'sweep', at: { x: hundredths(cx), y: hundredths(y0), z: hundredths(cz) }, look, section: wound.map(([x, z]) => [hundredths(x - cx), hundredths(z - cz)]), path: [{ x: 0, y: 0, z: 0 }, { x: 0, y: hundredths(y1 - y0), z: 0 }] }
}

// --- Profiles for a lathe: the outline of the solid in the half plane, (r, y). ---

/** A band `thick` metres thick with its inside face at `radius`, from `y0` to `y1`: the wall of a void seen from within. */
export const band = (radius, thick, y0, y1) => [
  [radius, y1],
  [radius, y0],
  [radius + thick, y0],
  [radius + thick, y1],
]
/** A deck from `inner` to `outer` out from the axis, `thick` deep under its top at `y`, the inner lip rounded. */
export const ringDeck = (inner, outer, y, thick = 8) => [
  [inner + thick * 0.4, y - thick],
  [outer, y - thick],
  [outer, y],
  [inner, y],
  [inner - thick * 0.15, y - thick * 0.3],
]

const _t = new Vector3()
const _u = new Vector3()
const _r = new Vector3()
const _o = new Vector3()
const _expected = new Vector3()

// Presets the editor offers under Shift+A: each a form stood at `at`, to be shaped from there.
export const PRESETS = {
  slab: (at) => ({ kind: 'sweep', at, section: rect(6, 1.5, -1.5), path: [{ x: 0, y: 0, z: -15 }, { x: 0, y: 0, z: 15 }] }),
  // A platform 4 m square to stand a route on, its top where it is put; and a wall 8 m long and
  // 6 tall to run along, its foot there.
  platform: (at) => ({ kind: 'sweep', at, section: rect(4, 0.5, -0.5), path: [{ x: 0, y: 0, z: -2 }, { x: 0, y: 0, z: 2 }] }),
  wall: (at) => ({ kind: 'sweep', at, section: rect(0.6, 6), path: [{ x: 0, y: 0, z: -4 }, { x: 0, y: 0, z: 4 }] }),
  deck: (at) => ({ kind: 'sweep', at, section: rect(5, 1.2, -1.2), smooth: true, path: [-60, -30, 0, 30, 60].map((z) => ({ x: (z * z) / 120, y: 0, z })) }),
  vault: (at) => ({ kind: 'sweep', at, section: arch(8, 1.2), smooth: true, path: [{ x: 0, y: 0, z: -30 }, { x: 0, y: 0, z: 30 }] }),
  corridor: (at) => ({ kind: 'sweep', at, section: { outer: trapezoid(10, 7, 9, -1), inner: trapezoid(6, 4, 7).reverse() }, path: [{ x: 0, y: 0, z: -30 }, { x: 0, y: 0, z: 30 }] }),
  pipe: (at) => ({ kind: 'sweep', at, section: ring(4, 0.5), smooth: true, path: [{ x: 0, y: 0, z: -30 }, { x: 0, y: 0, z: 30 }] }),
  ramp: (at) => ({ kind: 'sweep', at, section: tent(7, 10), path: [{ x: 0, y: 0, z: -40 }, { x: 0, y: 0, z: 40 }] }),
  pylon: (at) => ({ kind: 'lathe', at, smooth: true, profile: [[0, 0], [6, 0], [4, 40], [12, 48], [10, 52], [0, 52]] }),
  bowl: (at) => ({ kind: 'lathe', at, smooth: true, profile: [[0, 0], [60, 0], [60, 25], [50, 24], [40, 12], [20, 3], [0, 2]] }),
  ring: (at) => ({ kind: 'lathe', at, smooth: true, profile: circle(3, 12, 20, 0) }),
  silo: (at) => ({ kind: 'lathe', at, smooth: true, profile: [[0, 0], [12, 0], [12, 50], [8, 56], [0, 56]] }),
}

/**
 * The triangles of `form`, in the world: `{ positions, normals, faces }`. `positions` and
 * `normals` are three numbers a corner, three corners a triangle, for drawing; `faces` are
 * `faces.js`'s, each with the form's `id`, for meeting. Each face's normal points out of the
 * solid whichever way it was wound.
 */
export function buildForm(form) {
  const made = form.kind === 'lathe' ? lathe(form) : sweep(form)
  const faces = []
  for (const { a, b, c, expected, strip } of made) {
    let face = triangle(a, b, c, form.id ?? -1, strip)
    if (!face) continue
    if (face.normal.dot(expected) < 0) face = triangle(a, c, b, form.id ?? -1, strip)
    faces.push(face)
  }
  return { faces, ...drawn(faces, form.smooth === true) }
}

// Everything of a form in the world: its `at`, `yaw` and `scale` laid on a point of its own.
// This and `unplacePoint` are the one reading of a transform: an asset (`assets.js`) and the
// editor (`editor-things.js`) place and unplace points through them.
function placer({ at = { x: 0, y: 0, z: 0 }, yaw = 0, scale = 1 }) {
  const [sx, sy, sz] = Array.isArray(scale) ? scale : [scale, scale, scale]
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return (x, y, z) => {
    const px = x * sx
    const pz = z * sz
    return new Vector3(px * cos + pz * sin + at.x, y * sy + at.y, -px * sin + pz * cos + at.z)
  }
}

/**
 * A point `{ x, y, z }` of something's own frame as it stands in the world by the transform
 * `{ at, yaw, scale }` (each optional): sized by `scale` (a number, or one for each axis), turned
 * `yaw` radians about up (a rising yaw turns +Z toward +X), then moved to `at`.
 */
export const placePoint = (transform, { x, y, z }) => placer(transform)(x, y, z)

/** The point of something's own frame that `placePoint` puts at `world`: the transform taken off. */
export function unplacePoint({ at = { x: 0, y: 0, z: 0 }, yaw = 0, scale = 1 }, world) {
  const [sx, sy, sz] = Array.isArray(scale) ? scale : [scale, scale, scale]
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const dx = world.x - at.x
  const dz = world.z - at.z
  return { x: (dx * cos - dz * sin) / sx, y: (world.y - at.y) / sy, z: (dx * sin + dz * cos) / sz }
}

// A normal's direction as the form is placed: divided by its scale (as a normal is carried
// through a stretch), then turned. Only its sign against a face's normal is used, so a negative
// scale, which mirrors the form, must turn it round with the faces.
function turner({ yaw = 0, scale = 1 }) {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const [sx, sy, sz] = Array.isArray(scale) ? scale : [scale, scale, scale]
  return (v) => {
    v.set(v.x / sx, v.y / sy, v.z / sz)
    return v.set(v.x * cos + v.z * sin, v.y, -v.x * sin + v.z * cos)
  }
}

const loopsOf = (section) => (Array.isArray(section) ? [section] : [section.outer, section.inner])

// The quads and caps of a sweep, each as two triangles with the way it should face.
function sweep(form) {
  const { section, path } = form
  const place = placer(form)
  const turn = turner(form)
  const loops = loopsOf(section)
  const points = path.map(({ x, y, z }) => new Vector3(x, y, z))
  const last = points.length - 1
  const tangents = points.slice(0, -1).map((p, i) => new Vector3().subVectors(points[i + 1], p).normalize())
  const capped = [form.open !== true && form.open !== 'start', form.open !== true && form.open !== 'end']
  const { stations, base, strips, bevelled } = stationsOf(form, loops, points, tangents, capped)
  // Each station's section, once, shared by the stretch before and the one after so there is
  // no crack: the section of the stretch coming in, carried along it onto the plane that
  // halves the bend (`ramp.js` does the same for a ridge).
  const rings = stations.map(({ point, tIn, mid, roll, scale: [su, sv], loops: shape }) => {
    const [right, up] = frame(tIn, roll)
    const along = tIn.dot(mid)
    return shape.map((loop) =>
      loop.map(([u, v]) => {
        _o.copy(right).multiplyScalar(u * su).addScaledVector(up, v * sv)
        _o.addScaledVector(tIn, -_o.dot(mid) / along)
        return place(point.x + _o.x, point.y + _o.y, point.z + _o.z)
      }),
    )
  })
  const ends = [turn(tangents[0].clone().negate()).normalize(), turn(tangents[last - 1].clone()).normalize()]
  const out = []
  base.forEach((loop, l) => {
    for (let k = 0; k < loop.length; k++) {
      const next = (k + 1) % loop.length
      const du = loop[next][0] - loop[k][0]
      const dv = loop[next][1] - loop[k][1]
      for (let i = 0; i < stations.length - 1; i++) {
        const { stretch, roll, rim } = stations[i]
        const [right, up] = frame(tangents[stretch], roll)
        const expected = turn(new Vector3().copy(right).multiplyScalar(dv).addScaledVector(up, -du))
        // A stretch of a rounded rim faces between the side and the end, as far round as it is.
        const round = rim && stations[i + 1].rim?.end === rim.end ? (rim.theta + stations[i + 1].rim.theta) / 2 : null
        if (round !== null) expected.normalize().multiplyScalar(Math.sin(round)).addScaledVector(ends[rim.end], Math.cos(round))
        const a = rings[i][l][k]
        const b = rings[i][l][next]
        const c = rings[i + 1][l][next]
        const d = rings[i + 1][l][k]
        const strip = round === null ? strips[l][k] : (rim.end + 1) * 1e6 + strips[l][k]
        out.push({ a, b, c, expected, strip }, { a, b: c, c: d, expected, strip })
      }
    }
  })
  for (const [end, s] of [[0, 0], [1, stations.length - 1]]) {
    if (!capped[end]) continue
    const [outer, ...inner] = stations[s].loops
    const contour = outer.map(([u, v]) => new Vector2(u, v))
    const holes = inner.map((loop) => loop.map(([u, v]) => new Vector2(u, v)))
    const ring = rings[s].flat()
    const strip = bevelled ? 3e6 + end : 2000 + (end === 0 ? 0 : last)
    for (const [p, q, r] of ShapeUtils.triangulateShape(contour, holes)) out.push({ a: ring[p], b: ring[q], c: ring[r], expected: ends[end], strip })
  }
  return out
}

// Where a sweep's section stands along its path, and what it is there: `stations`, each
// `{ point, tIn, mid, roll, scale, loops, stretch, rim }` (the section `loops` stands at
// `point`, square to `tIn`, carried onto the plane square to `mid`; the stretch on to the next
// station is along the path's `stretch`; `rim` is `{ end, theta }` on a rounded rim, 0 the start
// and 1 the end, `theta` how far round from the end it is); `base`, the section as the sides
// have it; `strips`, each edge of it its strip; `bevelled`. With no bevel the stations are the
// path's points and the section is the record's.
function stationsOf(form, loops, points, tangents, capped) {
  const { path } = form
  const last = points.length - 1
  const joint = (i) => {
    const tIn = tangents[Math.max(0, i - 1)]
    const tOut = tangents[Math.min(last - 1, i)]
    const mid = new Vector3().addVectors(tIn, tOut)
    if (mid.lengthSq() < 1e-6) mid.copy(tOut)
    mid.normalize()
    return { point: points[i], tIn, mid, roll: path[i].roll ?? 0, scale: path[i].scale ?? [1, 1], stretch: Math.min(last - 1, i), rim: null }
  }
  const bevel = bevelOf(form)
  if (!bevel) {
    return { stations: points.map((_, i) => ({ ...joint(i), loops })), base: loops, strips: loops.map((loop, l) => loop.map((_, k) => l * 1000 + k)), bevelled: false }
  }
  const { size, segments } = bevel
  const corners = loops.map((loop) => cornersOf(loop, size))
  const base = corners.map((loop) => insetLoop(loop, segments, 0))
  // The edges of one corner's round are one strip, so that `smooth` shades it round; every flat edge is its own.
  const strips = corners.map((loop, l) => {
    const ids = []
    for (const corner of loop) {
      if (corner.radius !== undefined) {
        const id = l * 100000 + ids.length
        for (let s = 0; s < segments; s++) ids.push(id)
      }
      ids.push(l * 100000 + ids.length)
    }
    return ids
  })
  // The rims: as deep as the end stretches let them be, and no deeper than the section can be
  // taken in without turning inside out.
  const lengths = tangents.map((_, i) => points[i + 1].distanceTo(points[i]))
  let rim = capped.some(Boolean) ? Math.min(size, BEVEL_SHARE * lengths[0], BEVEL_SHARE * lengths[last - 1]) : 0
  for (let tries = 0; rim > 1e-4 && !insetFits(corners, segments, rim); tries++) rim = tries < 12 ? rim * 0.8 : 0
  if (!(rim > 1e-4)) rim = 0
  const stations = []
  // A station `back` metres in from the end `end` along its stretch, the section taken in by `inset`.
  const onRim = (end, back, theta) => {
    const i = end === 0 ? 0 : last - 1
    const t = tangents[i]
    const share = end === 0 ? back / lengths[i] : 1 - back / lengths[i]
    const [a, b] = [path[i], path[i + 1]]
    const [sa, sb] = [a.scale ?? [1, 1], b.scale ?? [1, 1]]
    const inset = rim * (1 - Math.sin(theta))
    return {
      point: new Vector3().lerpVectors(points[i], points[i + 1], share),
      tIn: t,
      mid: t,
      roll: (a.roll ?? 0) + ((b.roll ?? 0) - (a.roll ?? 0)) * share,
      scale: [sa[0] + (sb[0] - sa[0]) * share, sa[1] + (sb[1] - sa[1]) * share],
      stretch: i,
      rim: { end, theta },
      loops: inset > 0 ? corners.map((loop) => insetLoop(loop, segments, inset)) : base,
    }
  }
  const quarter = (k) => (Math.PI / 2) * (k / segments)
  if (rim > 0 && capped[0]) for (let k = 0; k <= segments; k++) stations.push(onRim(0, rim * (1 - Math.cos(quarter(k))), quarter(k)))
  else stations.push({ ...joint(0), loops: base })
  for (let i = 1; i < last; i++) stations.push({ ...joint(i), loops: base })
  if (rim > 0 && capped[1]) for (let k = segments; k >= 0; k--) stations.push(onRim(1, rim * (1 - Math.cos(quarter(k))), quarter(k)))
  else stations.push({ ...joint(last), loops: base })
  return { stations, base, strips, bevelled: true }
}

// A form's bevel, `{ size, segments }` as it can be cut, or null for none (a lathe's is none).
function bevelOf(form) {
  const size = form.bevel?.size ?? 0
  if (form.kind === 'lathe' || !(size > 0)) return null
  const segments = Math.min(BEVEL_SEGMENTS, Math.max(1, Math.round(form.bevel.segments ?? 1)))
  return { size, segments }
}

// Each corner of a section's loop as a bevel takes it: `at`, the left normals of the edges in
// and out (`n1`, `n2`), how far it `turn`s and which way (`side`, 1 to the left), and, if it is
// rounded, its round's `centre` and `radius`, tangent to both edges `size` back along each (or
// less, on a short edge).
function cornersOf(loop, size) {
  const n = loop.length
  return loop.map(([u, v], i) => {
    const [pu, pv] = loop[(i + n - 1) % n]
    const [nu, nv] = loop[(i + 1) % n]
    const inLength = Math.hypot(u - pu, v - pv)
    const outLength = Math.hypot(nu - u, nv - v)
    const e1 = inLength > 1e-9 ? [(u - pu) / inLength, (v - pv) / inLength] : null
    const e2 = outLength > 1e-9 ? [(nu - u) / outLength, (nv - v) / outLength] : null
    const [d1, d2] = [e1 ?? e2 ?? [1, 0], e2 ?? e1 ?? [1, 0]]
    const n1 = [-d1[1], d1[0]]
    const n2 = [-d2[1], d2[0]]
    const cross = d1[0] * d2[1] - d1[1] * d2[0]
    const turn = Math.atan2(Math.abs(cross), d1[0] * d2[0] + d1[1] * d2[1])
    const corner = { at: [u, v], n1, n2, turn, side: cross >= 0 ? 1 : -1 }
    if (!e1 || !e2 || turn < BEVEL_CORNER || turn > Math.PI - 1e-3) return corner
    const back = Math.min(size, BEVEL_SHARE * inLength, BEVEL_SHARE * outLength)
    corner.radius = back / Math.tan(turn / 2)
    corner.centre = [u - d1[0] * back + corner.side * n1[0] * corner.radius, v - d1[1] * back + corner.side * n1[1] * corner.radius]
    return corner
  })
}

// A loop of `cornersOf` taken in by `inset` (to the left of each edge: an outer loop shrinks, a
// hole grows), each rounded corner as `segments` + 1 points on its round about the same centre:
// the edges mitred, the rounds smaller where the corner turns inward and larger where it turns
// out, and a round taken in to nothing is that many points on the mitred corner. Every inset has
// as many points, so the rings of a rim join edge to edge.
function insetLoop(corners, segments, inset) {
  const out = []
  for (const { at, n1, n2, turn, side, centre, radius } of corners) {
    const mitre = inset / Math.max(0.1, 1 + n1[0] * n2[0] + n1[1] * n2[1])
    const mitred = [at[0] + (n1[0] + n2[0]) * mitre, at[1] + (n1[1] + n2[1]) * mitre]
    if (radius === undefined) {
      out.push(mitred)
      continue
    }
    const r = radius - side * inset
    const from = Math.atan2(-side * n1[1], -side * n1[0])
    for (let s = 0; s <= segments; s++) {
      if (r <= 0) out.push([...mitred])
      else {
        const angle = from + (side * turn * s) / segments
        out.push([centre[0] + r * Math.cos(angle), centre[1] + r * Math.sin(angle)])
      }
    }
  }
  return out
}

// Whether a section's loops (`cornersOf` each) can be taken in by `inset` and stay the shape they
// are: no edge turned back on itself, the outer loop wound as it was, every hole still inside it.
function insetFits(corners, segments, inset) {
  const loops = corners.map((loop) => insetLoop(loop, segments, inset))
  const bases = corners.map((loop) => insetLoop(loop, segments, 0))
  for (let l = 0; l < loops.length; l++) {
    const [loop, was] = [loops[l], bases[l]]
    for (let k = 0; k < loop.length; k++) {
      const next = (k + 1) % loop.length
      const du = was[next][0] - was[k][0]
      const dv = was[next][1] - was[k][1]
      if ((loop[next][0] - loop[k][0]) * du + (loop[next][1] - loop[k][1]) * dv < -1e-9 * (du * du + dv * dv + 1)) return false
    }
  }
  if (Math.sign(signedArea(loops[0])) !== Math.sign(signedArea(bases[0]))) return false
  return loops.slice(1).every((hole) => hole.every((p) => insidePolygon(loops[0], p)))
}

function insidePolygon(c, [x, z]) {
  let hit = false
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const [xi, zi] = c[i]
    const [xj, zj] = c[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit
  }
  return hit
}

// A stretch's right and up, square to its tangent `t`, turned about it by `roll`.
function frame(t, roll) {
  _u.copy(UP).addScaledVector(t, -UP.dot(t))
  if (_u.lengthSq() < 1e-6) _u.copy(AHEAD).addScaledVector(t, -AHEAD.dot(t))
  _u.normalize()
  _r.crossVectors(t, _u)
  if (roll !== 0) {
    _u.applyAxisAngle(t, roll)
    _r.applyAxisAngle(t, roll)
  }
  return [_r.clone(), _u.clone()]
}

// The quads and caps of a lathe, each as two triangles with the way it should face.
function lathe(form) {
  const { profile, sides = SIDES, arc = [0, TAU] } = form
  const place = placer(form)
  const turn = turner(form)
  const [from, to] = arc
  const whole = Math.abs(to - from - TAU) < 1e-6
  const first = profile[0]
  const end = profile[profile.length - 1]
  const onAxis = first[0] === 0 && end[0] === 0
  const same = first[0] === end[0] && first[1] === end[1]
  const outline = onAxis || same ? profile : [...profile, first]
  const angles = Array.from({ length: sides + 1 }, (_, j) => from + ((to - from) * j) / sides)
  const rings = angles.map((angle) => outline.map(([r, y]) => place(r * Math.cos(angle), y, r * Math.sin(angle))))
  const out = []
  for (let i = 0; i < outline.length - 1; i++) {
    const dr = outline[i + 1][0] - outline[i][0]
    const dy = outline[i + 1][1] - outline[i][1]
    for (let j = 0; j < sides; j++) {
      const mid = (angles[j] + angles[j + 1]) / 2
      const expected = turn(_expected.set(Math.cos(mid) * dy, -dr, Math.sin(mid) * dy).clone())
      const a = rings[j][i]
      const b = rings[j][i + 1]
      const c = rings[j + 1][i + 1]
      const d = rings[j + 1][i]
      out.push({ a, b, c, expected, strip: i }, { a, b: c, c: d, expected, strip: i })
    }
  }
  if (whole || form.open) return out
  const contour = (same ? profile.slice(0, -1) : profile).map(([r, y]) => new Vector2(r, y))
  for (const [j, sign] of [[0, -1], [sides, 1]]) {
    const angle = angles[j]
    const expected = turn(_expected.set(-Math.sin(angle) * sign, 0, Math.cos(angle) * sign).clone())
    const ring = rings[j]
    for (const [p, q, r] of ShapeUtils.triangulateShape(contour, [])) out.push({ a: ring[p], b: ring[q], c: ring[r], expected, strip: 2000 + j })
  }
  return out
}

// The corners of `faces` laid out for drawing, with a normal at each: the face's own, or,
// `smooth`, the mean of the faces of the same strip that meet at that corner, so a round
// is shaded as round and a corner between two strips stays a corner.
function drawn(faces, smooth) {
  const positions = new Float32Array(faces.length * 9)
  const normals = new Float32Array(faces.length * 9)
  const shared = smooth ? new Map() : null
  const keyOf = (face, p) => `${face.strip}|${p.x.toFixed(3)}|${p.y.toFixed(3)}|${p.z.toFixed(3)}`
  if (shared) {
    for (const face of faces) {
      for (const p of [face.a, face.b, face.c]) {
        const key = keyOf(face, p)
        const sum = shared.get(key)
        if (sum) sum.add(face.normal)
        else shared.set(key, face.normal.clone())
      }
    }
  }
  faces.forEach((face, i) => {
    ;[face.a, face.b, face.c].forEach((p, k) => {
      const at = i * 9 + k * 3
      p.toArray(positions, at)
      const normal = shared ? shared.get(keyOf(face, p)).clone().normalize() : face.normal
      normal.toArray(normals, at)
    })
  })
  return { positions, normals }
}
