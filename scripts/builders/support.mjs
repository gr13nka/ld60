// Gravity, as the builders are held to it: every solid carries its load down to the gorge's mist,
// on something that does, or fused to something that does (built into it, bolted to it, hung
// from it). What does not is a floater. A record's load is read off its triangles: points under
// it (its undersides, sampled) bear on the floor met within `BEAR` below, and its corners inside
// or against another solid fuse it to that one. Grounding spreads from what reaches the mist,
// through bearing and fusing, until nothing more is grounded.
// For a new piece, also how far it reaches out past what holds it (`overhang`, a cantilever) and
// the longest stretch between two holds (`span`).
import { buildForm } from '../../src/forms.js'
import { buildAsset } from '../../src/assets.js'
import { nearestOn } from '../../src/faces.js'
import { Vector3 } from 'three'
import { floorHit, formKey, MIST } from './world.mjs'

const BEAR = 1 // metres below an underside a floor still carries it
const FUSE = 0.4 // metres from another's surface a corner is fused to it
const SAMPLE = 4 // metres between points sampled on a large underside
const MOST_UNDER = 60 // points sampled under one record, at most
const MOST_CORNERS = 90 // corners tried for fusing, at most
const CELL = 8
const cellKey = (x, z) => (Math.floor(x / CELL) + 32768) * 65536 + (Math.floor(z / CELL) + 32768)

// Every `n`th of a list, so that at most `most` are kept, the ends among them.
function thin(points, most) {
  if (points.length <= most) return points
  const step = points.length / most
  return Array.from({ length: most }, (_, i) => points[Math.floor(i * step)])
}

// The faces of a record (forms and assets), kept while its record reads as it did.
const _faces = new WeakMap()
function facesOf(rec) {
  const sign = JSON.stringify(rec.record)
  const kept = _faces.get(rec.record)
  if (kept?.sign === sign) return kept.faces
  let faces = []
  if (rec.list === 'forms') faces = buildForm(rec.record).faces
  else if (rec.list === 'assets') for (const form of buildAsset(rec.record).forms) faces.push(...buildForm(form).faces)
  _faces.set(rec.record, { sign, faces })
  return faces
}

// What is worked out of a record once, while it is not changed: its points under and its corners.
const _under = new WeakMap()
const _corners = new WeakMap()

/** Points under `rec`: on its downward faces, or its box's foot. */
export function underside(rec) {
  if (!_under.has(rec)) _under.set(rec, undersideOf(rec))
  return _under.get(rec)
}

/** Corners of `rec`, for telling whether it is fused to another. */
export function corners(rec) {
  if (!_corners.has(rec)) _corners.set(rec, cornersOf(rec))
  return _corners.get(rec)
}

function undersideOf(rec) {
  const pts = []
  if (rec.list === 'boxes' || rec.list === 'props') {
    const b = rec.box ?? rec.record
    const nx = Math.max(1, Math.ceil((b.x1 - b.x0) / SAMPLE))
    const nz = Math.max(1, Math.ceil((b.z1 - b.z0) / SAMPLE))
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) pts.push([b.x0 + ((b.x1 - b.x0) * (0.02 + 0.96 * i / nx)), b.y0, b.z0 + ((b.z1 - b.z0) * (0.02 + 0.96 * j / nz))])
    return thin(pts, MOST_UNDER)
  }
  for (const f of facesOf(rec)) {
    if (f.normal.y > -0.3) continue
    const { a, b, c } = f
    const area = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).length() / 2
    const n = Math.max(1, Math.min(6, Math.round(Math.sqrt(area) / SAMPLE)))
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n - i; j++) {
        const u = (i + 0.33) / (n + 1)
        const v = (j + 0.33) / (n + 1)
        if (u + v > 1) continue
        pts.push([a.x + (b.x - a.x) * u + (c.x - a.x) * v, a.y + (b.y - a.y) * u + (c.y - a.y) * v, a.z + (b.z - a.z) * u + (c.z - a.z) * v])
      }
    }
  }
  return thin(pts, MOST_UNDER)
}

function cornersOf(rec) {
  if (rec.list === 'boxes' || rec.list === 'props') {
    const b = rec.box ?? rec.record
    const pts = []
    for (const x of [b.x0, (b.x0 + b.x1) / 2, b.x1]) for (const y of [b.y0, (b.y0 + b.y1) / 2, b.y1]) for (const z of [b.z0, (b.z0 + b.z1) / 2, b.z1]) pts.push([x, y, z])
    return pts
  }
  const seen = new Set()
  const pts = []
  for (const f of facesOf(rec)) {
    for (const v of [f.a, f.b, f.c]) {
      const k = `${Math.round(v.x * 4)},${Math.round(v.y * 4)},${Math.round(v.z * 4)}`
      if (seen.has(k)) continue
      seen.add(k)
      pts.push([v.x, v.y, v.z])
    }
  }
  return thin(pts, MOST_CORNERS)
}

const overlap = (a, b, m) =>
  a.min.x - m <= b.max.x && a.max.x + m >= b.min.x && a.min.y - m <= b.max.y && a.max.y + m >= b.min.y && a.min.z - m <= b.max.z && a.max.z + m >= b.min.z
const within = ([x, y, z], b, m) => x >= b.min.x - m && x <= b.max.x + m && y >= b.min.y - m && y <= b.max.y + m && z >= b.min.z - m && z <= b.max.z + m

const _near = new Vector3()
const _p = new Vector3()

// Whether the point is inside `rec` or within `FUSE` of its surface.
function touches(site, rec, [x, y, z]) {
  if (rec.list === 'boxes' || rec.list === 'props') return within([x, y, z], rec.bounds, FUSE)
  if (!within([x, y, z], rec.bounds, FUSE)) return false
  _p.set(x, y, z)
  let above = 0
  for (const dx of [-FUSE, FUSE]) {
    for (const dz of [-FUSE, FUSE]) {
      const cell = site.faces._cells.get(cellKey(x + dx, z + dz))
      if (!cell) continue
      for (const face of cell) {
        if (formKey(face.id) !== rec.key) continue
        if (face.max.x < x - FUSE || face.min.x > x + FUSE || face.max.z < z - FUSE || face.min.z > z + FUSE || face.max.y < y - FUSE || face.min.y > y + FUSE) continue
        nearestOn(face, _p, _near)
        if (_near.distanceTo(_p) <= FUSE) return true
      }
    }
  }
  // Inside: an odd number of its faces over the point.
  const cell = site.faces._cells.get(cellKey(x, z))
  if (!cell) return false
  for (const face of cell) {
    if (formKey(face.id) !== rec.key || Math.abs(face.normal.y) < 1e-3) continue
    if (face.min.x > x || face.max.x < x || face.min.z > z || face.max.z < z || face.max.y < y) continue
    const h = heightOverAny(face, x, z)
    if (h !== null && h > y) above++
  }
  return above % 2 === 1
}
function heightOverAny({ a, b, c }, x, z) {
  const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z)
  if (Math.abs(d) < 1e-12) return null
  const l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d
  const l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d
  const l3 = 1 - l1 - l2
  if (l1 < 0 || l2 < 0 || l3 < 0) return null
  return l1 * a.y + l2 * b.y + l3 * c.y
}

/** The points of `a` that touch `b`, and of `b` that touch `a`. Empty if they are not fused. */
export function fusedAt(site, a, b) {
  if (!overlap(a.bounds, b.bounds, FUSE)) return []
  const out = []
  for (const p of corners(a)) if (within(p, b.bounds, FUSE) && touches(site, b, p)) out.push(p)
  if (out.length) return out
  for (const p of corners(b)) if (within(p, a.bounds, FUSE) && touches(site, a, p)) out.push(p)
  return out
}

/**
 * Who is grounded among `recs` (`world.mjs`' `solidRecords`) on `site`. Returns
 * `{ grounded: Map(key → how), bears: Map(key → [{ p, on }]) , byKey }`: `how` is 'mist', 'on <key>'
 * or 'fused <key>'.
 */
export function scanSupport(site, recs) {
  const byKey = new Map(recs.map((r) => [r.key, r]))
  const bears = new Map()
  const carries = new Map() // key → keys that bear on it
  for (const rec of recs) {
    const list = []
    for (const p of underside(rec)) {
      const hit = floorHit(site, p[0], p[1] - 0.05, p[2], rec.key)
      if (hit && p[1] - hit.y <= BEAR && byKey.has(hit.key)) list.push({ p, on: hit.key })
    }
    bears.set(rec.key, list)
    for (const { on } of list) {
      if (!carries.has(on)) carries.set(on, new Set())
      carries.get(on).add(rec.key)
    }
  }
  // Records by the plan cells their bounds cover, to find who may be fused to whom.
  const BIG = 16
  const grid = new Map()
  for (const rec of recs) {
    const { min, max } = rec.bounds
    if ((max.x - min.x) * (max.z - min.z) > 400 * 400) continue // a landmark far off: only bearing is asked of it
    for (let cx = Math.floor(min.x / BIG); cx <= Math.floor(max.x / BIG); cx++) {
      for (let cz = Math.floor(min.z / BIG); cz <= Math.floor(max.z / BIG); cz++) {
        const k = cx * 100003 + cz
        if (!grid.has(k)) grid.set(k, [])
        grid.get(k).push(rec)
      }
    }
  }
  const neighbours = (rec) => {
    const out = new Set()
    const { min, max } = rec.bounds
    for (let cx = Math.floor((min.x - 1) / BIG); cx <= Math.floor((max.x + 1) / BIG); cx++) {
      for (let cz = Math.floor((min.z - 1) / BIG); cz <= Math.floor((max.z + 1) / BIG); cz++) {
        for (const other of grid.get(cx * 100003 + cz) ?? []) if (other !== rec && overlap(rec.bounds, other.bounds, FUSE)) out.add(other)
      }
    }
    return out
  }

  const grounded = new Map()
  const queue = []
  for (const rec of recs) {
    if (rec.bounds.min.y <= MIST) {
      grounded.set(rec.key, 'mist')
      queue.push(rec)
    }
  }
  while (queue.length) {
    const rec = queue.shift()
    for (const key of carries.get(rec.key) ?? []) {
      if (grounded.has(key)) continue
      grounded.set(key, `on ${rec.key}`)
      queue.push(byKey.get(key))
    }
    for (const other of neighbours(rec)) {
      if (grounded.has(other.key)) continue
      if (fusedAt(site, other, rec).length) {
        grounded.set(other.key, `fused ${rec.key}`)
        queue.push(other)
      }
    }
  }
  return { grounded, bears, byKey, neighbours }
}

/**
 * How `rec` (grounded or not) is held: the points holding it (bearing on, or fused to, a grounded
 * record), how far it reaches past the outermost (`overhang`) and the longest stretch between two
 * (`span`), along its long way and across. What is in `exclude` (the same piece's other parts) does not hold it.
 */
export function holdOf(site, rec, scan, exclude = new Set()) {
  const holds = []
  for (const { p, on } of scan.bears.get(rec.key) ?? []) if (scan.grounded.has(on) && !exclude.has(on)) holds.push(p)
  for (const other of scan.neighbours(rec)) {
    if (!scan.grounded.has(other.key) || exclude.has(other.key)) continue
    for (const p of fusedAt(site, rec, other)) holds.push(p)
  }
  // Its underside held where it goes down into the mist, or where it is built into something solid.
  for (const p of underside(rec)) if (p[1] <= MIST + 2 || site.hitsSolid({ x: p[0], y: p[1] - 0.3, z: p[2] }, 0.05)) holds.push(p)
  if (rec.bounds.min.y <= MIST) holds.push([(rec.bounds.min.x + rec.bounds.max.x) / 2, rec.bounds.min.y, (rec.bounds.min.z + rec.bounds.max.z) / 2])
  const pts = corners(rec).concat(underside(rec))
  // Its long way on the plan.
  let mx = 0
  let mz = 0
  for (const [x, , z] of pts) {
    mx += x
    mz += z
  }
  mx /= pts.length
  mz /= pts.length
  let sxx = 0
  let szz = 0
  let sxz = 0
  for (const [x, , z] of pts) {
    sxx += (x - mx) ** 2
    szz += (z - mz) ** 2
    sxz += (x - mx) * (z - mz)
  }
  const angle = 0.5 * Math.atan2(2 * sxz, sxx - szz)
  const axes = [
    [Math.cos(angle), Math.sin(angle)],
    [-Math.sin(angle), Math.cos(angle)],
  ]
  let overhang = 0
  let span = 0
  if (!holds.length) return { holds, overhang: Infinity, span: Infinity }
  for (const [ux, uz] of axes) {
    const along = pts.map(([x, , z]) => x * ux + z * uz)
    const held = holds.map(([x, , z]) => x * ux + z * uz).sort((a, b) => a - b)
    overhang = Math.max(overhang, held[0] - Math.min(...along), Math.max(...along) - held.at(-1))
    for (let i = 1; i < held.length; i++) span = Math.max(span, held[i] - held[i - 1])
  }
  return { holds, overhang, span }
}
