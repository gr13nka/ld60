// The story's ground in the copy, which no builder may take: each zone a `keep` (nothing in it is
// cut or taken away) and a `clear` (nothing solid is built in it). Shapes are a ball
// `{ ball: [x, y, z], r, y? }` (`y` a height range it is cut to), a box `{ box: [x0, y0, z0, x1,
// y1, z1] }` or a tube `{ tube: [[x, y, z], …], r }` along points. Written at `keeper init` to
// plans/builders/protected.json and read by every hand. Pure.
//
// The zones are the order's (`ways.mjs`), all the ways' at once, so that a builder on one way
// cannot block another: each stop keeps its ground; the air over a jump, glide or drop is clear,
// and so is the gap under it (so that nothing bridges it); a run keeps its head room.

const along = (a, b, t, up = 0) => [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + up, a.z + (b.z - a.z) * t]

/** The zones of the order `order` (`loadWays()`), every way's. */
export function zonesOf(order) {
  const zones = []
  for (const stop of order.stops) {
    // Its clear ball stands over the point, not on it: a stop is on a floor, and the floor is for building.
    zones.push({ name: stop.name, keep: { ball: [stop.x, stop.y, stop.z], r: stop.zone.keep }, clear: { ball: [stop.x, stop.y + stop.zone.clear + 0.5, stop.z], r: stop.zone.clear } })
  }
  for (const way of order.ways) {
    for (const leg of way.legs) {
      const { a, b, n } = leg
      const L = Math.max(leg.length, 1)
      const name = (what) => `the ${what} of ${way.id} leg ${n}`
      if (leg.move === 'jump' || leg.move === 'glide' || leg.move === 'drop') {
        const t0 = Math.min(0.25, 6 / L)
        zones.push({ name: name('air'), clear: { tube: [along(a, b, t0, 2.5), along(a, b, Math.max(0.75, 1 - 6 / L), 2.5)], r: 2 } })
        // The gap: a leg too short to have one between its pads has none zoned.
        const g0 = Math.max(0.25, 4 / L)
        if (g0 < 0.5) zones.push({ name: name('gap'), clear: { tube: [along(a, b, g0, -2), along(a, b, 1 - g0, -2)], r: 2 } })
      } else if (leg.move === 'run') {
        const trim = Math.min(0.5, 3 / L)
        zones.push({ name: name('head room'), clear: { tube: [along(a, b, trim, 2.5), along(a, b, 1 - trim, 2.5)], r: 1.5 } })
      }
    }
  }
  return zones
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
// Distance from a point to a box `{ min, max }`.
function toBox([x, y, z], { min, max }) {
  return Math.hypot(x - clamp(x, min.x, max.x), y - clamp(y, min.y, max.y), z - clamp(z, min.z, max.z))
}

/** Whether the shape meets the bounds `{ min, max }`. */
export function meets(shape, bounds) {
  if (!shape) return false
  if (shape.box) {
    const [x0, y0, z0, x1, y1, z1] = shape.box
    return bounds.min.x <= x1 && bounds.max.x >= x0 && bounds.min.y <= y1 && bounds.max.y >= y0 && bounds.min.z <= z1 && bounds.max.z >= z0
  }
  if (shape.ball) {
    if (shape.y && (bounds.max.y < shape.y[0] || bounds.min.y > shape.y[1])) return false
    return toBox(shape.ball, bounds) <= shape.r
  }
  if (shape.tube) {
    const pts = shape.tube
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b] = [pts[i], pts[i + 1]]
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 3))
      for (let k = 0; k <= n; k++) {
        const t = k / n
        if (toBox([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], bounds) <= shape.r) return true
      }
    }
    return false
  }
  return false
}

// Distance from p to the triangle a, b, c (the closest point on it, after Ericson's Real-Time Collision Detection).
export function toTriangle(p, a, b, c) {
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]]
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  const at = (o, u, k) => [o[0] + u[0] * k, o[1] + u[1] * k, o[2] + u[2] * k]
  const ab = sub(b, a)
  const ac = sub(c, a)
  const ap = sub(p, a)
  const d1 = dot(ab, ap)
  const d2 = dot(ac, ap)
  let q
  if (d1 <= 0 && d2 <= 0) q = a
  else {
    const bp = sub(p, b)
    const d3 = dot(ab, bp)
    const d4 = dot(ac, bp)
    const cp = sub(p, c)
    const d5 = dot(ab, cp)
    const d6 = dot(ac, cp)
    const vc = d1 * d4 - d3 * d2
    const vb = d5 * d2 - d1 * d6
    const va = d3 * d6 - d5 * d4
    if (d3 >= 0 && d4 <= d3) q = b
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) q = at(a, ab, d1 / (d1 - d3))
    else if (d6 >= 0 && d5 <= d6) q = c
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) q = at(a, ac, d2 / (d2 - d6))
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) q = at(b, sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6)))
    else {
      const sum = va + vb + vc
      q = at(at(a, ab, vb / sum), ac, vc / sum)
    }
  }
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

/**
 * Whether a ball or a tube comes within its radius of the triangles `positions` (nine numbers a
 * triangle). A slanting deck's box fills the air over its low end, which a leg's head room runs
 * through; its triangles do not. A box zone is the box's alone.
 */
export function meetsMesh(shape, positions) {
  if (!shape?.ball && !shape?.tube) return true
  const points = []
  if (shape.ball) points.push(shape.ball)
  else {
    for (let i = 0; i + 1 < shape.tube.length; i++) {
      const [a, b] = [shape.tube[i], shape.tube[i + 1]]
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 1.5))
      for (let k = 0; k <= n; k++) points.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, a[2] + ((b[2] - a[2]) * k) / n])
    }
  }
  const r = shape.r
  for (let t = 0; t + 8 < positions.length; t += 9) {
    const [a, b, c] = [[positions[t], positions[t + 1], positions[t + 2]], [positions[t + 3], positions[t + 4], positions[t + 5]], [positions[t + 6], positions[t + 7], positions[t + 8]]]
    const lo = [Math.min(a[0], b[0], c[0]) - r, Math.min(a[1], b[1], c[1]) - r, Math.min(a[2], b[2], c[2]) - r]
    const hi = [Math.max(a[0], b[0], c[0]) + r, Math.max(a[1], b[1], c[1]) + r, Math.max(a[2], b[2], c[2]) + r]
    for (const p of points) {
      if (p[0] < lo[0] || p[0] > hi[0] || p[1] < lo[1] || p[1] > hi[1] || p[2] < lo[2] || p[2] > hi[2]) continue
      if (toTriangle(p, a, b, c) <= r) return true
    }
  }
  return false
}

/** Whether the point lies in the shape. */
export const holds = (shape, [x, y, z]) => meets(shape, { min: { x, y, z }, max: { x, y, z } })

/** A zone as a builder of generation `gen` knows it: by name, by number, or not at all. */
export function zoneName(zones, zone, gen) {
  if (gen <= 1) return zone.name
  if (gen === 2) return `zone ${zones.indexOf(zone) + 1}`
  return 'a forbidden volume'
}
