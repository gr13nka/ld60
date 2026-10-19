// Triangles a body meets. A form (`forms.js`) and a ramp (`ramp.js`) are their triangles,
// and the same triangles are drawn and met, so the two cannot come apart. A body is a ball
// to them (Source's box catches on the seam of two pieces; a ball goes over a seam and a
// ridge alike), and a runner is three balls one over another (`pushOutLevel`).
// `FaceGrid` keeps them by the ground cell they lie over, so that a question about one spot
// reads one cell and not every triangle of a megastructure.
// Pure: no scene.

import { Vector3 } from 'three'

/** A face rising at least this much is ground to a runner: up to 60° from level. Steeper is a wall. */
export const WALKABLE = 0.5
const CEILING = -0.05 // and one facing down at least this much is a ceiling
const WALL_FLAT = 0.2 // how much of a wall's normal must lie level for a runner to be pushed off it
const CELL = 8 // metres across a cell of the grid

const _ab = new Vector3()
const _ac = new Vector3()
const _ap = new Vector3()
const _bp = new Vector3()
const _cp = new Vector3()
const _nearest = new Vector3()
const _away = new Vector3()
const _ball = new Vector3()
const _push = new Vector3()

/**
 * One triangle: its corners (`Vector3`s, kept, not copied), the normal its winding gives
 * (`a` to `b` to `c`, the right-hand way), the box it lies in, the form it belongs to (`id`)
 * and the strip of that form it is a part of (`strip`), for shading. Null for a triangle
 * with no area.
 */
export function triangle(a, b, c, id = -1, strip = 0) {
  const normal = new Vector3().subVectors(b, a).cross(_ac.subVectors(c, a))
  if (normal.lengthSq() < 1e-12) return null
  normal.normalize()
  return { a, b, c, normal, id, strip, min: a.clone().min(b).min(c), max: a.clone().max(b).max(c), _seen: 0 }
}

/**
 * Moves a ball of `radius` at `centre` out of whichever of `faces` it is in, and writes to
 * `normal` the way it was moved out of the last of them. True if it was moved.
 */
export function pushOut(faces, centre, radius, normal) {
  let moved = false
  for (const face of faces) moved = pushOutOfFace(face, centre, radius, normal) || moved
  return moved
}

// `pushOut` for one face.
function pushOutOfFace(face, centre, radius, normal) {
  const { min, max } = face
  if (centre.x < min.x - radius || centre.x > max.x + radius || centre.y < min.y - radius || centre.y > max.y + radius || centre.z < min.z - radius || centre.z > max.z + radius) return false
  nearestOn(face, centre, _nearest)
  _away.subVectors(centre, _nearest)
  const off = _away.length()
  if (off >= radius) return false
  // A centre that has got behind the face, or is on it, is put out through its front.
  if (off < 1e-6 || _away.dot(face.normal) < 0) {
    normal.copy(face.normal)
    centre.copy(_nearest).addScaledVector(normal, radius)
  } else {
    normal.copy(_away).divideScalar(off)
    centre.addScaledVector(normal, radius - off)
  }
  return true
}

/** The point of a triangle nearest `p`, written to `out`: Ericson's, by the region `p` is over. */
export function nearestOn({ a, b, c }, p, out) {
  _ab.subVectors(b, a)
  _ac.subVectors(c, a)
  _ap.subVectors(p, a)
  const d1 = _ab.dot(_ap)
  const d2 = _ac.dot(_ap)
  if (d1 <= 0 && d2 <= 0) return out.copy(a)
  _bp.subVectors(p, b)
  const d3 = _ab.dot(_bp)
  const d4 = _ac.dot(_bp)
  if (d3 >= 0 && d4 <= d3) return out.copy(b)
  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return out.copy(a).addScaledVector(_ab, d1 / (d1 - d3))
  _cp.subVectors(p, c)
  const d5 = _ab.dot(_cp)
  const d6 = _ac.dot(_cp)
  if (d6 >= 0 && d5 <= d6) return out.copy(c)
  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return out.copy(a).addScaledVector(_ac, d2 / (d2 - d6))
  const va = d3 * d6 - d5 * d4
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return out.copy(b).addScaledVector(_cp.subVectors(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6)))
  const all = va + vb + vc
  return out.copy(a).addScaledVector(_ab, vb / all).addScaledVector(_ac, vc / all)
}

// The height of `face` over the point (x, z), or null where the point is not over it.
function heightOver({ a, b, c, normal }, x, z) {
  const v0x = c.x - a.x
  const v0z = c.z - a.z
  const v1x = b.x - a.x
  const v1z = b.z - a.z
  const v2x = x - a.x
  const v2z = z - a.z
  const d00 = v0x * v0x + v0z * v0z
  const d01 = v0x * v1x + v0z * v1z
  const d11 = v1x * v1x + v1z * v1z
  const d02 = v0x * v2x + v0z * v2z
  const d12 = v1x * v2x + v1z * v2z
  const det = d00 * d11 - d01 * d01
  if (Math.abs(det) < 1e-12) return null
  const u = (d11 * d02 - d01 * d12) / det
  const v = (d00 * d12 - d01 * d02) / det
  if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) return null
  // On the face's plane: normal · (p − a) = 0.
  return a.y - (normal.x * (x - a.x) + normal.z * (z - a.z)) / normal.y
}

/**
 * Triangles by the ground cell they lie over, and the questions a body asks of them.
 * Every query reads only the cells about the point it is asked of.
 */
export class FaceGrid {
  constructor() {
    this._cells = new Map() // cell key → faces over it
    this._cellsOf = new Map() // a form's id → the keys of the cells its faces are in, so that taking it out reads only those
    this._stamp = 0 // a face in several cells is read once a query (`_seen`)
    /** How many faces there are. */
    this.count = 0
  }

  /** Puts `faces` (from `triangle`) in. */
  add(faces) {
    for (const face of faces) {
      if (!face) continue
      this.count++
      let keys = this._cellsOf.get(face.id)
      if (!keys) this._cellsOf.set(face.id, (keys = new Set()))
      this._eachCell(face.min, face.max, (key) => {
        let cell = this._cells.get(key)
        if (!cell) this._cells.set(key, (cell = []))
        cell.push(face)
        keys.add(key)
      })
    }
  }

  /**
   * Takes out every face of the form `id`, or of each form in a list of ids (an asset's, all at
   * once). Only the cells those forms' faces are in are read.
   */
  remove(ids) {
    const gone = new Set(Array.isArray(ids) ? ids : [ids])
    const touched = new Set()
    for (const id of gone) {
      for (const key of this._cellsOf.get(id) ?? []) touched.add(key)
      this._cellsOf.delete(id)
    }
    const removed = new Set()
    for (const key of touched) {
      const cell = this._cells.get(key)
      if (!cell) continue
      const kept = cell.filter((face) => !gone.has(face.id) || (removed.add(face), false))
      if (kept.length === 0) this._cells.delete(key)
      else if (kept.length !== cell.length) this._cells.set(key, kept)
    }
    this.count -= removed.size
  }

  /** Takes everything out. */
  clear() {
    this._cells.clear()
    this._cellsOf.clear()
    this.count = 0
  }

  /**
   * The highest ground (a face rising at least `WALKABLE`) over the point (x, z) at or below
   * the height `y`: its height is written to `out.y` and its normal to `out.normal`. True if
   * there is one.
   */
  castDown(x, y, z, out) {
    const cell = this._cells.get(keyOf(x, z))
    if (!cell) return false
    let best = -Infinity
    for (const face of cell) {
      if (face.normal.y < WALKABLE || face.min.y > y || face.min.x > x || face.max.x < x || face.min.z > z || face.max.z < z) continue
      const height = heightOver(face, x, z)
      if (height === null || height > y + 1e-3 || height <= best) continue
      best = height
      out.normal.copy(face.normal)
    }
    out.y = best
    return best > -Infinity
  }

  /** The lowest underside (a face facing down) over the point (x, z) at or above `y`, or Infinity. */
  castUp(x, y, z) {
    const cell = this._cells.get(keyOf(x, z))
    if (!cell) return Infinity
    let best = Infinity
    for (const face of cell) {
      if (face.normal.y > CEILING || face.max.y < y || face.min.x > x || face.max.x < x || face.min.z > z || face.max.z < z) continue
      const height = heightOver(face, x, z)
      if (height === null || height < y - 1e-3 || height >= best) continue
      best = height
    }
    return best
  }

  /** As `pushOut` above, over the faces about `centre`. */
  pushOut(centre, radius, normal) {
    let moved = false
    this._about(centre.x - radius, centre.z - radius, centre.x + radius, centre.z + radius, (face) => {
      moved = pushOutOfFace(face, centre, radius, normal) || moved
    })
    return moved
  }

  /**
   * A runner's wall: moves `feet` level out of whatever stands within `radius` of it between
   * the heights `low` and `high` and is too steep to stand on, and writes that face's
   * outward normal, laid level. True if it was moved.
   */
  pushOutLevel(feet, low, high, radius, normal) {
    const heights = high - low > 2 * radius ? [low + radius, (low + high) / 2, high - radius] : [(low + high) / 2]
    let moved = false
    this._about(feet.x - radius, feet.z - radius, feet.x + radius, feet.z + radius, (face) => {
      if (face.normal.y >= WALKABLE || Math.hypot(face.normal.x, face.normal.z) < WALL_FLAT || face.min.y > high || face.max.y < low) return
      for (const y of heights) {
        _ball.set(feet.x, y, feet.z)
        if (!pushOutOfFace(face, _ball, radius, _push)) continue
        _push.y = 0
        if (_push.lengthSq() < 1e-6) continue
        feet.x = _ball.x
        feet.z = _ball.z
        normal.copy(_push).normalize()
        moved = true
      }
    })
    return moved
  }

  // Calls `visit` once for each face over any cell of the rectangle, each face once.
  _about(x0, z0, x1, z1, visit) {
    const stamp = ++this._stamp
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
        const cell = this._cells.get(key(cx, cz))
        if (!cell) continue
        for (const face of cell) {
          if (face._seen === stamp) continue
          face._seen = stamp
          visit(face)
        }
      }
    }
  }

  _eachCell(min, max, visit) {
    for (let cx = Math.floor(min.x / CELL); cx <= Math.floor(max.x / CELL); cx++) {
      for (let cz = Math.floor(min.z / CELL); cz <= Math.floor(max.z / CELL); cz++) visit(key(cx, cz))
    }
  }
}

const key = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768)
const keyOf = (x, z) => key(Math.floor(x / CELL), Math.floor(z / CELL))
