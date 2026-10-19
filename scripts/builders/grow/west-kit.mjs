// Shapes and placing for the west set pieces (stops-west.mjs): boxes, leaning plates, beams, tubes
// and discs as place-file records, and `Placer`, which lays them into a list only if they keep the
// story's clear zones, stand off every leg's line and, where asked, off the stop's own ground.
// Pure but for what the placer is given.
import { circle, prism, rect, ring } from '../../../src/forms.js'
import { boundsOf, positionsOf, round } from '../world.mjs'

const r2 = (v) => round(v, 100)
const P = (x, y, z) => ({ x: r2(x), y: r2(y), z: r2(z) })

/** An upright box over (x0..x1, z0..z1) from y0 to y1. */
export const box = (x0, x1, y0, y1, z0, z1, look) => ({ ...prism([[r2(x0), r2(z0)], [r2(x1), r2(z0)], [r2(x1), r2(z1)], [r2(x0), r2(z1)]], y0, y1, look), role: 'mass' })

/**
 * A plate `w` wide and `t` thick standing from `y0` up `h`, turned `yaw` about its foot's middle
 * (x, z), its top shifted `lean` = [dx, dz] metres: a slab that leans on its neighbours.
 */
export function plate({ x, z, y0, h, w, t, yaw = 0, lean = [0, 0], look }) {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const form = prism([[-w / 2, -t / 2], [w / 2, -t / 2], [w / 2, t / 2], [-w / 2, t / 2]].map(([u, v]) => [r2(x + u * c + v * s), r2(z - u * s + v * c)]), y0, y0 + h, look)
  const len = Math.hypot(lean[0], lean[1])
  if (len > 1e-3) {
    // `forms.js` lays a leaning path's section back against the lean: turned first, it stands where the upright one would.
    const [Lx, Lz] = [lean[0] / len, lean[1] / len]
    form.section = form.section.map(([u, v]) => [r2(u * -Lz + v * Lx), r2(u * -Lx + v * -Lz)])
    form.path[1] = { ...form.path[1], x: r2(lean[0]), z: r2(lean[1]) }
  }
  return { ...form, role: 'mass' }
}

/** Where the plate's middle is at height `up` over its foot: a point inside it for a beam to end in. */
export const inPlate = ({ x, z, y0, h, lean = [0, 0] }, up) => ({ x: x + (lean[0] * up) / h, y: y0 + up, z: z + (lean[1] * up) / h })

/** A square beam `w` by `h` from a to b. */
export const beam = (a, b, w, h, look) => ({ kind: 'sweep', at: P(a.x, a.y, a.z), look, section: rect(w, h, -h / 2), path: [P(0, 0, 0), P(b.x - a.x, b.y - a.y, b.z - a.z)], role: 'mass' })

/** A round bar or rope of radius `r` from a to b. */
export const rod = (a, b, r, look, sides = 8) => ({ kind: 'sweep', at: P(a.x, a.y, a.z), look, smooth: true, section: circle(r, sides), path: [P(0, 0, 0), P(b.x - a.x, b.y - a.y, b.z - a.z)], role: 'mass' })

/** A hollow tube of outer radius `r`, its wall `wall`, from a to b. */
export const tube = (a, b, r, wall, look, sides = 24) => ({ kind: 'sweep', at: P(a.x, a.y, a.z), look, smooth: true, section: ring(r, wall, sides), path: [P(0, 0, 0), P(b.x - a.x, b.y - a.y, b.z - a.z)], role: 'mass' })

/** A hollow rectangular tube (outer `w` across, `h` up, wall `wall`), lying along a → b with both ends open: a cabin on its side. */
export function hollowBox(a, b, w, h, wall, look) {
  return { kind: 'sweep', at: P(a.x, a.y, a.z), look, open: true, section: { outer: rect(w, h, -h / 2), inner: rect(w - 2 * wall, h - 2 * wall, -h / 2 + wall).reverse() }, path: [P(0, 0, 0), P(b.x - a.x, b.y - a.y, b.z - a.z)], role: 'mass' }
}

/** A round disc (a cap, a hatch, a collar) of radius `r` and thickness `t` standing at (x, y0, z), its axis up. */
export const disc = (x, y0, z, r, t, look, sides = 24) => ({ kind: 'lathe', at: P(x, y0, z), look, sides, smooth: true, profile: [[0, 0], [r2(r), 0], [r2(r), r2(t)], [0, r2(t)]], role: 'mass' })

const distToBox = ([x, y, z], b) => Math.hypot(Math.max(b.min.x - x, 0, x - b.max.x), Math.max(b.min.y - y, 0, y - b.max.y), Math.max(b.min.z - z, 0, z - b.max.z))

/**
 * Lays records into `add`. A record is refused (and counted by reason in `refused`) when it
 * meets a clear zone, comes within `gap` of a leg's line, or comes within `keep` of `stop`
 * (the NPC's ground stays walkable; a record meant to touch it passes `keep: 0`).
 */
export class Placer {
  constructor(ctx, stop, { gap = 5, keep = 27 } = {}) {
    this.ctx = ctx
    this.stop = stop
    this.gap = gap
    this.keep = keep
    this.add = {}
    this.refused = {}
    this.samples = []
    for (const way of ctx.order.ways) {
      for (const leg of way.legs) {
        const n = Math.max(1, Math.ceil(leg.length / 3))
        for (let i = 0; i <= n; i++) {
          const t = i / n
          this.samples.push([leg.a.x + (leg.b.x - leg.a.x) * t, leg.a.y + (leg.b.y - leg.a.y) * t, leg.a.z + (leg.b.z - leg.a.z) * t])
        }
      }
    }
  }

  /** Lays `record` into `list`; true if it stands. */
  put(list, record, { gap = this.gap, keep = this.keep } = {}) {
    const bounds = boundsOf(positionsOf(list, record))
    const no = (why) => { this.refused[why] = (this.refused[why] ?? 0) + 1; return false }
    if (keep && distToBox([this.stop.x, this.stop.y, this.stop.z], bounds) < keep) return no('stop')
    if (this.samples.some((p) => distToBox(p, bounds) < gap)) return no('leg')
    if (!this.ctx.clearOf(list, record)) return no('clear')
    ;(this.add[list] ??= []).push(record)
    return true
  }

  /** The records laid so far, counted by list. */
  get count() {
    return Object.fromEntries(Object.entries(this.add).map(([k, v]) => [k, v.length]))
  }

  /** How far along a → b (metres, from a) a sphere of radius `r` runs before it meets a solid or a leg's line, up to the whole way; the first `skip` metres are not looked at. */
  runFree(a, b, r, step = 4, skip = 0) {
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    for (let d = skip; d <= len; d += step) {
      const t = d / len
      const at = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
      if (this.samples.some(([x, y, z]) => Math.hypot(x - at.x, y - at.y, z - at.z) < r + 3) || this.ctx.site.hitsSolid(at, r)) {
        if (process.env.WEST_REPORT) console.error('runFree stopped at', JSON.stringify(at, (k, v) => (typeof v === 'number' ? Math.round(v) : v)), 'r', r, this.ctx.recs.filter((q) => q.bounds.min.x < at.x + r && q.bounds.max.x > at.x - r && q.bounds.min.y < at.y + r && q.bounds.max.y > at.y - r && q.bounds.min.z < at.z + r && q.bounds.max.z > at.z - r).map((q) => q.key + ':' + q.owner + ':' + [q.bounds.min.x, q.bounds.min.y, q.bounds.min.z, q.bounds.max.x, q.bounds.max.y, q.bounds.max.z].map(Math.round)).join(' | '))
        return Math.max(0, d - step)
      }
    }
    return len
  }
}
