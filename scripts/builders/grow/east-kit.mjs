// Shared makers for the east set pieces (stops-east.mjs): place-file records for bars, lattices,
// combs of cells and domed drums, each one record standing for a great many parts. Pure.
import { circle, prism, rect } from '../../../src/forms.js'
import { round } from '../world.mjs'

export const r2 = (v) => round(v, 100)
export const P = (x, y, z) => ({ x: r2(x), y: r2(y), z: r2(z) })
const rel = (a, b) => P(b.x - a.x, b.y - a.y, b.z - a.z)

/** A round bar or cable a → b, `r` thick. */
export const bar = (a, b, r, look, role = 'support', sides = 8) => ({ kind: 'sweep', at: P(a.x, a.y, a.z), look, smooth: sides > 8, section: circle(r, sides), path: [P(0, 0, 0), rel(a, b)], role })

/** A square beam a → b, `w` across, `h` deep (its top on the line). */
export const beam = (a, b, w, h, look, role = 'support') => ({ kind: 'sweep', at: P(a.x, a.y, a.z), look, section: rect(w, h, -h), bevel: { size: r2(Math.min(0.5, w * 0.1)), segments: 1 }, path: [P(0, 0, 0), rel(a, b)], role })

/** A cable hung from a to b sagging `sag` metres in the middle. */
export function hung(a, b, r, sag, look, steps = 10) {
  const path = Array.from({ length: steps + 1 }, (_, k) => {
    const t = k / steps
    return P((b.x - a.x) * t, (b.y - a.y) * t - sag * 4 * t * (1 - t), (b.z - a.z) * t)
  })
  return { kind: 'sweep', at: P(a.x, a.y, a.z), look, smooth: true, section: circle(r, 6), path, role: 'service' }
}

/** A column of `r` from y0 to y1 at (x, z), flaring `flare` times at the top. */
export function pillar(x, z, y0, y1, r, look, flare = 1) {
  const h = y1 - y0
  const path = [P(0, 0, 0)]
  if (flare > 1) path.push({ ...P(0, h - 18, 0), scale: [1, 1] }, { ...P(0, h - 4, 0), scale: [flare, flare] })
  path.push({ ...P(0, h, 0), scale: [flare, flare] })
  return { kind: 'sweep', at: P(x, y0, z), look, smooth: true, section: circle(r, 14), path, role: 'support' }
}

/** A lathe solid of revolution: `profile` is [[r, y], …] up the outside, over the top, down the axis. */
export const turned = (x, y, z, profile, look, sides = 20) => ({ kind: 'lathe', at: P(x, y, z), look, smooth: true, sides, profile: profile.map(([r, h]) => [r2(r), r2(h)]), role: 'mass' })

/** A dish (a shallow bowl, mouth up) of radius `r`: a lathe, thin shell. */
export const dish = (x, y, z, r, look) => turned(x, y, z, [[0, 0], [r * 0.18, -r * 0.06], [r, r * 0.22], [r, r * 0.26], [r * 0.2, -r * 0.02], [0, 0]], look, 24)

/**
 * A square lattice mast: four legs tapering from `half0` at y0 to `half1` at y1 and a zigzag of
 * diagonals on each face, one record per member, so five on a face-and-leg basis: 4 legs + 4 zigzags.
 * `bays` diagonals; a ring (a square frame as one sweep) every `ringEvery` bays.
 */
export function mast({ x, z, y0, y1, half0, half1, bays, leg = 1, diag = 0.45, look = 'rust', diagLook = 'dim', yaw = 0, ringEvery = 0 }) {
  const out = []
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const at = (u, v, y) => ({ x: x + u * c + v * s, y, z: z - u * s + v * c })
  const halfAt = (t) => half0 + (half1 - half0) * t
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  for (const [su, sv] of corners) out.push(bar(at(su * half0, sv * half0, y0), at(su * half1, sv * half1, y1), leg * 1, look, 'support', 6))
  for (let f = 0; f < 4; f++) {
    const [a, b] = [corners[f], corners[(f + 1) % 4]]
    const pts = []
    for (let k = 0; k <= bays; k++) {
      const t = k / bays
      const h = halfAt(t)
      const side = k % 2 ? 1 : 0 // the zigzag alternates between the face's two legs
      const [u, v] = [(side ? b : a)[0] * h, (side ? b : a)[1] * h]
      pts.push(at(u, v, y0 + (y1 - y0) * t))
    }
    out.push({ kind: 'sweep', at: P(pts[0].x, pts[0].y, pts[0].z), look: diagLook, section: circle(diag, 6), path: pts.map((p) => rel(pts[0], p)), role: 'support' })
  }
  if (ringEvery) {
    for (let k = ringEvery; k < bays; k += ringEvery) {
      const t = k / bays
      const h = halfAt(t)
      const y = y0 + (y1 - y0) * t
      const ring = [...corners, corners[0]].map(([u, v]) => at(u * h, v * h, y))
      out.push({ kind: 'sweep', at: P(ring[0].x, ring[0].y, ring[0].z), look: diagLook, section: circle(diag * 1.2, 6), path: ring.map((p) => rel(ring[0], p)), role: 'support' })
    }
  }
  return out
}

/** The plan of `n` dividers `tooth` thick at `pitch`, each `depth` deep off a spine `spine` thick: a comb as one polygon [[u, v], …]. */
export function comb(n, pitch, tooth, depth, spine) {
  const length = (n - 1) * pitch + tooth
  const poly = [[0, 0], [length, 0]]
  for (let k = n - 1; k >= 0; k--) {
    const u = k * pitch
    poly.push([u + tooth, spine], [u + tooth, depth], [u, depth], [u, spine])
  }
  return { poly, length }
}

/**
 * A wall of cells open toward `f`, as three records (so a thousand cells cost three): vertical
 * dividers, shelves and a back plate. `o` is the wall's start on its back face, `t` the unit
 * direction it runs, `f` the unit direction it faces (square to `t`); `cell` metres square, `nx`
 * along, `ny` high from `y0`, dividers `depth` deep. The back plate runs 2.5 m behind the face,
 * so that it is fused into whatever the wall is hung on.
 */
export function cellWall({ o, t, f, y0, cell, nx, ny, depth, thick = 0.7, look, backLook = 'dark' }) {
  const out = []
  const width = nx * cell + thick
  const height = ny * cell + thick
  const world = (u, w) => [r2(o.x + t.x * u + f.x * w), r2(o.z + t.z * u + f.z * w)]
  const { poly } = comb(nx + 1, cell, thick, depth, 0.01)
  out.push({ ...prism(poly.map(([u, w]) => world(u, w)), y0, y0 + height, look), role: 'mass' })
  // The shelves: a comb in section along the wall. A sweep's u is t × up, so its sign toward f is s.
  const s = -t.z * f.x + t.x * f.z > 0 ? 1 : -1
  const sec = [[0, 0]]
  for (let k = 0; k <= ny; k++) {
    const v = k * cell
    sec.push([s * depth, v], [s * depth, v + thick], [s * 0.05, v + thick], [s * 0.05, v + cell])
  }
  sec.pop()
  sec.push([0, ny * cell + thick])
  out.push({ kind: 'sweep', at: P(o.x, y0, o.z), look, section: windCcw(sec), path: [P(0, 0, 0), P(t.x * width, 0, t.z * width)], role: 'mass' })
  out.push({ ...prism([world(-3, 0), world(width + 3, 0), world(width + 3, -2.5), world(-3, -2.5)], y0 - 3, y0 + height + 3, backLook), role: 'mass' })
  return out
}

/** A section wound counter-clockwise (u right, v up). */
export function windCcw(points) {
  let area = 0
  points.forEach(([u, v], i) => {
    const [u2, v2] = points[(i + 1) % points.length]
    area += u * v2 - u2 * v
  })
  return area < 0 ? [...points].reverse() : points
}
