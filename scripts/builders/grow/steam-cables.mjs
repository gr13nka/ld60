// Cables and pipe bundles for the steam layer (grow-steam.mjs): the BLAME! look of a plumbed
// megastructure. Both are the place's `cables` records (look only, no solid, so they can neither
// float nor block a leg): a bundle of round strands run along a curve (`place-drawn.js`'s
// `cablesDrawn`). Cables hang in catenaries between wall faces and strata undersides found in the
// copy as it stands (the blame layer's and the balcony's forms), some loose from an underside,
// some snapped and dangling; pipe bundles run along wall faces, level or upright, in brackets.
// Every one is kept off every leg's line by its own thickness plus a margin, and out of the story's
// clear zones (`ctx.clearOf` on a sweep of its width).
import { buildForm, circle } from '../../../src/forms.js'
import { round } from '../world.mjs'

const r1 = (v) => round(v, 10)
const LEG_GAP = 4
const UP = [0, 1, 0]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit = (a) => {
  const l = Math.hypot(...a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/**
 * The masses stood in the copy, as places to hang things from: `walls` and `unders` (face centres,
 * normals level / down, of big forms), and `planes`: each flat wall `{ n, rec, owner, ux, u0, u1, v0, v1,
 * origin, area }`, a plane of one form (its faces all one way and one depth) with its extent across
 * (`ux`, level and along it) and up. A megawall is a plane tens of metres each way.
 */
export function harvest(ctx, rng) {
  const recs = ctx.recs.filter((r) => r.list === 'forms' && r.owner !== 'builders-grow-steam' && Math.max(r.bounds.max.x - r.bounds.min.x, r.bounds.max.z - r.bounds.min.z, r.bounds.max.y - r.bounds.min.y) >= 30)
  const walls = []
  const unders = []
  const planes = []
  for (const rec of recs.map((v) => [rng(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v)) {
    const mine = { wall: 0, under: 0 }
    const groups = new Map()
    for (const f of buildForm(rec.record).faces) {
      const n = [f.normal.x, f.normal.y, f.normal.z]
      const area = new f.a.constructor().subVectors(f.b, f.a).cross(new f.a.constructor().subVectors(f.c, f.a)).length() / 2
      const kind = Math.abs(n[1]) < 0.15 ? 'wall' : n[1] < -0.85 ? 'under' : null
      if (!kind) continue
      const p = [(f.a.x + f.b.x + f.c.x) / 3, (f.a.y + f.b.y + f.c.y) / 3, (f.a.z + f.b.z + f.c.z) / 3]
      if (kind === 'wall') {
        const h = unit([n[0], 0, n[2]])
        const key = `${Math.round(h[0] * 40)},${Math.round(h[2] * 40)},${Math.round((h[0] * p[0] + h[2] * p[2]) / 1.5)}`
        let g = groups.get(key)
        if (!g) groups.set(key, (g = { n: h, d: h[0] * p[0] + h[2] * p[2], u0: Infinity, u1: -Infinity, v0: Infinity, v1: -Infinity, area: 0 }))
        const ux = [h[2], 0, -h[0]]
        for (const q of [f.a, f.b, f.c]) {
          const u = q.x * ux[0] + q.z * ux[2]
          g.u0 = Math.min(g.u0, u)
          g.u1 = Math.max(g.u1, u)
          g.v0 = Math.min(g.v0, q.y)
          g.v1 = Math.max(g.v1, q.y)
        }
        g.area += area
      }
      if (area < 40 || mine[kind] >= 4) continue
      mine[kind]++
      ;(kind === 'wall' ? walls : unders).push({ p, n, rec: rec.key, area })
    }
    for (const g of groups.values()) {
      const W = g.u1 - g.u0
      const H = g.v1 - g.v0
      if (W >= 50 && H >= 40 && g.area >= 0.6 * W * H) planes.push({ ...g, ux: [g.n[2], 0, -g.n[0]], rec: rec.key, owner: rec.owner, W, H })
    }
  }
  return { walls, unders, planes }
}

/** Whether a polyline keeps every sample `gap` (less its own `r`) away. */
export function offLegsOf(samples, gap = LEG_GAP) {
  return (path, r) => {
    const lo = [0, 1, 2].map((k) => Math.min(...path.map((p) => p[k])) - r - gap)
    const hi = [0, 1, 2].map((k) => Math.max(...path.map((p) => p[k])) + r + gap)
    for (const s of samples) {
      if (s[0] < lo[0] || s[0] > hi[0] || s[1] < lo[1] || s[1] > hi[1] || s[2] < lo[2] || s[2] > hi[2]) continue
      for (let i = 0; i + 1 < path.length; i++) {
        const [a, b] = [path[i], path[i + 1]]
        const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
        const t = Math.min(1, Math.max(0, ((s[0] - a[0]) * ab[0] + (s[1] - a[1]) * ab[1] + (s[2] - a[2]) * ab[2]) / (dot(ab, ab) || 1)))
        if (Math.hypot(s[0] - a[0] - ab[0] * t, s[1] - a[1] - ab[1] * t, s[2] - a[2] - ab[2] * t) - r < gap) return false
      }
    }
    return true
  }
}

/** `{ cables, vents, count }`: the bundles to add to the place and the steam at some pipe joints. */
export function growCables({ ctx, samples, isCold, anchors = null, wanted = { cables: 70, pipes: 40 } }) {
  const { rng, site } = ctx
  const between = (a, b) => a + (b - a) * rng()
  const pick = (list) => list[Math.floor(rng() * list.length)]
  const cables = []
  const vents = []
  const count = { catenary: 0, loose: 0, snapped: 0, pipes: 0 }
  const why = {}
  const no = (k) => { why[k] = (why[k] ?? 0) + 1 }

  const { walls, unders } = anchors ?? harvest(ctx, rng)

  const offLegs = offLegsOf(samples)
  // Whether the strands' sweep meets a story clear zone: a ring of the bundle's width along the path.
  const clearZones = (path, r) => ctx.clearOf('forms', { kind: 'sweep', at: { x: path[0][0], y: path[0][1], z: path[0][2] }, section: circle(r, 6), path: path.map((p) => ({ x: p[0] - path[0][0], y: p[1] - path[0][1], z: p[2] - path[0][2] })) })
  const free = (path, r, skip = 1) => path.every((p, i) => i < skip || i >= path.length - skip || !site.hitsSolid({ x: p[0], y: p[1], z: p[2] }, r + 0.5))
  const coldPath = (path) => path.some((p) => isCold(p[0], p[1], p[2], 40))

  // --- Cables ---
  const strandsOf = (n, bundleR) => {
    const r = bundleR / (1 + 1 / Math.sin(Math.PI / n))
    const ring = r / Math.sin(Math.PI / n)
    return { r, strands: Array.from({ length: n }, (_, i) => [r1(ring * Math.cos((2 * Math.PI * i) / n) * 100) / 100, r1(ring * Math.sin((2 * Math.PI * i) / n) * 100) / 100, r1(r * 100) / 100]) }
  }
  const catenary = (A, B, sag, steps) => Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t - 4 * sag * t * (1 - t), A[2] + (B[2] - A[2]) * t]
  })
  for (let tries = 0; tries < 3000 && cables.length < wanted.cables; tries++) {
    const kind = rng() < 0.25 ? 'loose' : rng() < 0.3 ? 'snapped' : 'catenary'
    const from = pick(kind === 'loose' ? unders : walls)
    if (!from) continue
    const A = from.p
    const [lo, hi] = kind === 'loose' ? [40, 200] : [60, 500]
    const faceTo = (a, b) => {
      const d = [b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]]
      const span = Math.hypot(...d)
      return span >= lo && span <= hi && (kind === 'loose' || (dot(d, a.n) > 0.25 * span && -dot(d, b.n) > 0.25 * span && a.rec !== b.rec))
    }
    const options = (kind === 'loose' ? unders : walls).filter((b) => faceTo(from, b))
    if (!options.length) { no('pair'); continue }
    const to = pick(options)
    const B = to.p
    const span = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2])
    if (span < (kind === 'loose' ? 40 : 60) || span > (kind === 'loose' ? 200 : 500)) continue
    if (kind !== 'loose') {
      // Each face looks toward the other.
      const d = unit([B[0] - A[0], B[1] - A[1], B[2] - A[2]])
      if (dot(d, from.n) < 0.25 || -dot(d, to.n) < 0.25) continue
    }
    const sag = span * (kind === 'loose' ? between(0.2, 0.45) : between(0.08, 0.2))
    const bundleR = between(0.3, 1.5)
    const steps = Math.max(8, Math.min(40, Math.round(span / 12)))
    let path = catenary(A, B, sag, steps)
    if (kind === 'snapped') {
      // It parts part-way along and dangles, swaying a little off the plumb.
      const keep = Math.round(steps * between(0.5, 0.8))
      path = path.slice(0, keep + 1)
      const end = path[keep]
      const drop = between(15, 50)
      const lean = [between(-4, 4), 0, between(-4, 4)]
      for (let k = 1; k <= 3; k++) path.push([end[0] + (lean[0] * k) / 3, end[1] - (drop * k) / 3, end[2] + (lean[2] * k) / 3])
    }
    if (coldPath(path)) { no('cold'); continue }
    if (!free(path, bundleR, 2)) { no('solid'); continue }
    if (!offLegs(path, bundleR)) { no('leg'); continue }
    if (!clearZones(path, bundleR)) { no('zone'); continue }
    const n = 3 + Math.floor(rng() * 10)
    const { strands } = strandsOf(n, bundleR)
    cables.push({ path: path.map((p) => p.map(r1)), strands, look: pick(['dark', 'dark', 'rust']) })
    count[kind]++
  }

  // --- Pipe bundles along wall faces ---
  const made = () => count.pipes
  for (let tries = 0; tries < 2500 && made() < wanted.pipes; tries++) {
    const from = pick(walls)
    if (!from) break
    const upright = rng() < 0.35
    const n = unit([from.n[0], 0, from.n[2]])
    const t = upright ? UP : unit(cross(UP, n)) // level along the wall, or straight up it
    const length = upright ? between(16, 50) : between(20, 60)
    const pipes = 4 + Math.floor(rng() * 17)
    const r = between(0.5, 2)
    const layers = pipes > 8 && rng() < 0.6 ? 2 : 1
    const perLayer = Math.ceil(pipes / layers)
    const gap = 2 * r * 1.05
    const side = unit(cross(t, n)) // along the wall, across the run
    const wide = (perLayer * gap) / 2
    const deep = r + 0.6 + ((layers - 1) * gap) / 2 // the bundle's middle, out from the wall
    const start = [from.p[0] + n[0] * deep + (upright ? 0 : -t[0] * length / 2), from.p[1] + n[1] * deep + (upright ? -length / 2 : 0), from.p[2] + n[2] * deep + (upright ? 0 : -t[2] * length / 2)]
    const steps = Math.max(2, Math.round(length / 30))
    const path = Array.from({ length: steps + 1 }, (_, i) => start.map((v, k) => v + t[k] * length * (i / steps)))
    const reach = Math.hypot(wide, deep) + r
    // A wall behind it all the way along, clear air in front, off every leg.
    const along = Array.from({ length: Math.ceil(length / 6) + 1 }, (_, i) => start.map((v, k) => v + t[k] * length * (i / Math.ceil(length / 6))))
    const backed = along.filter((p) => site.hitsSolid({ x: p[0] - n[0] * deep, y: p[1], z: p[2] - n[2] * deep }, 1)).length
    if (backed < along.length * 0.8) { no('wall'); continue }
    if (coldPath(path)) { no('cold'); continue }
    const outer = deep + ((layers - 1) * gap) / 2 + r + 1.5
    if (path.some((p) => site.hitsSolid({ x: p[0] + n[0] * (outer - deep), y: p[1], z: p[2] + n[2] * (outer - deep) }, 1))) { no('front'); continue }
    if (!offLegs(path, reach)) { no('leg'); continue }
    if (!clearZones(path, reach)) { no('zone'); continue }
    // Strands in the frame `cablesDrawn` lays across the path: u = ref × t, v = t × u.
    const u = unit(cross(Math.abs(t[1]) > 0.95 ? [1, 0, 0] : UP, t))
    const v = cross(t, u)
    const strands = []
    for (let i = 0; i < pipes; i++) {
      const layer = i % layers
      const k = Math.floor(i / layers)
      const out = (layer - (layers - 1) / 2) * gap
      const along = (k - (perLayer - 1) / 2) * gap
      const d = [n[0] * out + side[0] * along, n[1] * out + side[1] * along, n[2] * out + side[2] * along]
      strands.push([Math.round(dot(d, u) * 100) / 100, Math.round(dot(d, v) * 100) / 100, Math.round(r * 100) / 100])
    }
    cables.push({ path: path.map((p) => p.map(r1)), strands, look: pick(['rust', 'rust', 'b1Ochre']), band: { every: r1(between(15, 25)), r: 0.4 } })
    count.pipes++
    // A joint leaks: steam off the bundle's face.
    if (rng() < 0.4) {
      const p = path[Math.floor(rng() * path.length)]
      vents.push({ x: r1(p[0] + n[0] * (deep + reach)), y: r1(p[1]), z: r1(p[2] + n[2] * (deep + reach)), size: 3, reach: 180 })
    }
  }
  return { cables, vents, count, why, anchors: { walls: walls.length, unders: unders.length } }
}
