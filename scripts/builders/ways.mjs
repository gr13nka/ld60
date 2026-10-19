// The order as geometry: the story's ways, drawn by the owner (plans/balcony-routes.json, read
// only through `routes.mjs`), each leg at the height its move asks, and whether the copy's own
// floors and solids make each leg yet. The only reader of the routes for the builders.
//
// A leg is made, here, when the copy has what its move needs: floors at both ends (within 6 m on
// the plan and 4 m of the height asked), and then by move: a jump, glide or drop has clear air
// between and, for a jump, no floor bridging the gap; a run has a way over the floors; a climb has
// a way up or a face rising; a wall run has a wall alongside. This is judged on the solids and
// floors, not run by the ghost: `docs/known-gaps.md`. Pure but for the one file it reads.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ceilingHit, floorHit, floorsUnder, inSolid, ROOT, round } from './world.mjs'
import { drawn, heightsOf, isLine, legOf, legsAtHeight, pointsAtHeight } from './routes.mjs'
import { corridor, findWay, toSegment } from './route.mjs'
import { toTriangle } from './zones.mjs'

export const ROUTES_FILE = join(ROOT, 'plans/balcony-routes.json')

const REACH = 6 // metres on the plan a floor may be from a leg's end
const HEIGHT = 4 // metres of height it may differ
const HEAD = 2 // metres of head room over a floor
const CORRIDOR = 20 // metres either side of a run leg its way may wander

let _loaded = null

/**
 * `{ file, heights, stops: [{ id, name, x, y, z, zone }], ways: [{ id, from, to, fromName, toName,
 * branch, secret, points, legs: [{ n, a, b, move, suit, length, rise, ok, said }] }] }`, the stops'
 * and points' heights the inferred targets. Read once a process.
 */
export function loadWays() {
  if (_loaded) return _loaded
  const file = JSON.parse(readFileSync(ROUTES_FILE, 'utf8'))
  const heights = heightsOf(file)
  const stops = file.stops
    .filter((stop) => stop.at && heights.stops[stop.id] !== undefined)
    .map((stop) => ({ id: stop.id, name: stop.name, x: stop.at.x, y: heights.stops[stop.id], z: stop.at.z, zone: stop.zone }))
  const nameOf = (id) => stops.find((stop) => stop.id === id)?.name ?? id
  const p3 = ({ x, y, z }) => ({ x: round(x, 10), y: round(y, 10), z: round(z, 10) })
  const ways = []
  for (const route of file.routes) {
    if (isLine(route) || !drawn(route)) continue
    const points = pointsAtHeight(file, route, heights)
    if (!points) continue
    ways.push({
      id: route.id,
      from: route.from,
      to: route.to,
      fromName: nameOf(route.from),
      toName: nameOf(route.to),
      branch: !!route.branch,
      secret: !!route.secret,
      points: points.map(p3),
      legs: legsAtHeight(file, route, heights).map((leg, i) => ({ n: i + 1, a: p3(leg.a), b: p3(leg.b), move: leg.move, suit: leg.suit, length: leg.length, rise: leg.rise, ok: leg.ok, said: leg.said })),
    })
  }
  _loaded = { file, heights, stops, ways }
  return _loaded
}

/** Distance on the plan from (x, z) to the nearest leg of `way`. */
export const offWay = (way, x, z) => way.legs.reduce((least, leg) => Math.min(least, toSegment(leg.a, leg.b, x, z)), Infinity)

/** Points along every leg of the order, one every `step` metres, each `{ x, y, z, way, n }` (the leg's number): what the mystery keeps off and what a build is asked of. */
let _legPoints = null
export function legPoints(order, step = 5) {
  if (_legPoints?.order !== order) {
    const points = []
    for (const way of order.ways) {
      for (const leg of way.legs) {
        const count = Math.max(1, Math.ceil(Math.hypot(leg.b.x - leg.a.x, leg.b.y - leg.a.y, leg.b.z - leg.a.z) / step))
        for (let k = 0; k <= count; k++) points.push({ ...lerp(leg.a, leg.b, k / count), way: way.id, n: leg.n })
      }
    }
    _legPoints = { order, points }
  }
  return _legPoints.points
}

/** The first point of a leg of any way within `d` metres of the box `{ min, max }`, or null. */
export function legNear(order, { min, max }, d) {
  for (const p of legPoints(order)) {
    const dx = Math.max(min.x - p.x, 0, p.x - max.x)
    const dy = Math.max(min.y - p.y, 0, p.y - max.y)
    const dz = Math.max(min.z - p.z, 0, p.z - max.z)
    if (Math.hypot(dx, dy, dz) <= d) return p
  }
  return null
}

/**
 * The first point of a leg of any way within `d` metres of the triangles `positions` (nine numbers a
 * triangle) whose box is `bounds`, or null: the box asks first, then the triangles (an arch over a
 * way, high enough, is not near it).
 */
export function legNearMesh(order, bounds, positions, d) {
  const { min, max } = bounds
  for (const p of legPoints(order)) {
    if (Math.hypot(Math.max(min.x - p.x, 0, p.x - max.x), Math.max(min.y - p.y, 0, p.y - max.y), Math.max(min.z - p.z, 0, p.z - max.z)) > d) continue
    for (let t = 0; t + 8 < positions.length; t += 9) {
      const a = [positions[t], positions[t + 1], positions[t + 2]]
      const b = [positions[t + 3], positions[t + 4], positions[t + 5]]
      const c = [positions[t + 6], positions[t + 7], positions[t + 8]]
      if (Math.min(a[0], b[0], c[0]) - d > p.x || Math.max(a[0], b[0], c[0]) + d < p.x || Math.min(a[2], b[2], c[2]) - d > p.z || Math.max(a[2], b[2], c[2]) + d < p.z) continue
      if (toTriangle([p.x, p.y, p.z], a, b, c) <= d) return p
    }
  }
  return null
}

/** Every leg of any way with a point within `d` metres of the box, as a Set of `way.n` keys. */
export function legsNear(order, { min, max }, d) {
  const near = new Set()
  for (const p of legPoints(order)) {
    const dx = Math.max(min.x - p.x, 0, p.x - max.x)
    const dy = Math.max(min.y - p.y, 0, p.y - max.y)
    const dz = Math.max(min.z - p.z, 0, p.z - max.z)
    if (Math.hypot(dx, dy, dz) <= d) near.add(`${p.way}.${p.n}`)
  }
  return near
}

/** The same, to the nearest of `ways`. */
export const offWays = (ways, x, z) => ways.reduce((least, way) => Math.min(least, offWay(way, x, z)), Infinity)

const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t })
const at = (list, p) => list?.find((rec) => p.x >= rec.bounds.min.x - 0.3 && p.x <= rec.bounds.max.x + 0.3 && p.y >= rec.bounds.min.y - 0.3 && p.y <= rec.bounds.max.y + 0.3 && p.z >= rec.bounds.min.z - 0.3 && p.z <= rec.bounds.max.z + 0.3)?.key

/**
 * A floor within 6 m of `p` on the plan (the point, then rings of eight at 3 and 6 m) and 4 m of
 * its height, with 2 m of head room: the nearest, `{ x, y, z, key }`, or null.
 */
export function floorAt(site, p) {
  let best = null
  for (const r of [0, 3, 6]) {
    for (let k = 0; k < (r ? 8 : 1); k++) {
      const x = p.x + Math.sin((k * Math.PI) / 4) * r
      const z = p.z + Math.cos((k * Math.PI) / 4) * r
      for (const f of floorsUnder(site, x, z, p.y + HEIGHT, 2 * HEIGHT, 1.5)) {
        if (Math.abs(f.y - p.y) > HEIGHT) continue
        const up = ceilingHit(site, x, f.y + 0.05, z)
        if (up && up.y - f.y < HEAD) continue
        const d = r + Math.abs(f.y - p.y)
        if (!best || d < best.d) best = { d, x, y: f.y, z, key: f.key }
      }
    }
  }
  return best && { x: best.x, y: best.y, z: best.z, key: best.key }
}

// The leg's plan unit vector and the one to its left (+X is on the left looking down +Z).
function heading(a, b) {
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
  const u = { x: (b.x - a.x) / len, z: (b.z - a.z) / len }
  return { u, n: { x: -u.z, z: u.x }, len }
}

// Whether a face rises from fa to fb near the leg: some plan sample along it, within 3 m of it
// either side, has 80 % of its 1 m steps from fa.y + 1 to fb.y − 0.5 inside a solid.
function faceRising(site, fa, fb) {
  const { u, n, len } = heading(fa, fb)
  const heights = []
  for (let y = fa.y + 1; y <= fb.y - 0.5; y++) heights.push(y)
  if (!heights.length) return false
  const most = Math.floor(heights.length * 0.2)
  for (let t = 0.2; t <= 0.951; t += 0.05) {
    for (const lateral of [0, -1.5, 1.5, -3, 3]) {
      const x = fa.x + u.x * len * t + n.x * lateral
      const z = fa.z + u.z * len * t + n.z * lateral
      let missed = 0
      for (const y of heights) if (!inSolid(site, x, y, z) && ++missed > most) break
      if (missed <= most) return true
    }
  }
  return false
}

// Whether a wall stands alongside the leg, 1.5 to 4 m off the line on one side, at the height of
// the line + 1.5 for 80 % of samples every 3 m, and the line itself at +1 m is clear.
function wallAlong(site, fa, fb) {
  const { n, len } = heading(fa, fb)
  const ts = []
  for (let s = len * 0.1; s <= len * 0.9 + 1e-6; s += 3) ts.push(s / len)
  if (!ts.length) return false
  const line = ts.map((t) => lerp(fa, fb, t))
  if (line.filter((p) => inSolid(site, p.x, p.y + 1, p.z)).length > line.length * 0.1) return false
  for (const side of [1, -1]) {
    for (const d of [1.5, 2.5, 4]) {
      const solid = line.filter((p) => inSolid(site, p.x + n.x * side * d, p.y + 1.5, p.z + n.z * side * d)).length
      if (solid >= line.length * 0.8) return true
    }
  }
  return false
}

/**
 * Whether the copy makes `leg` yet: `{ made, why, lack, from, to }`. `from` and `to` are the floors
 * found at its ends (or null); `lack` is what is wanted — 'start', 'end', 'span' (the floors found
 * are too far or too awkward for the move), 'air', 'bridged', 'run', 'climb' or 'wall' — and `why`
 * says it in words, with `blocked`, the point and key, for 'air' and 'bridged'. `recs` (the copy's
 * solid records) lets a blocked point be named.
 */
export function legMade(site, leg, recs) {
  const { a, b, move } = leg
  const from = floorAt(site, a)
  const to = floorAt(site, b)
  const no = (lack, why, extra = {}) => ({ made: false, lack, why, from, to, ...extra })
  const word = (p) => `(${round(p.x, 10)}, ${round(p.y, 10)}, ${round(p.z, 10)})`
  if (!from) return no('start', `no floor at its start ${word(a)} within ${REACH} m and ${HEIGHT} m of height`)
  if (!to) return no('end', `no floor at its end ${word(b)} within ${REACH} m and ${HEIGHT} m of height`)
  const flat = Math.hypot(to.x - from.x, to.z - from.z)

  if (move === 'jump' || move === 'glide' || move === 'drop') {
    const found = legOf(from, to, leg.suit ? 'glide' : move)
    if (!found.ok) return no('span', `with the floors found, ${word(from)} to ${word(to)}: ${found.said}`)
    for (let s = 3; s <= flat - 3 + 1e-6; s += 2) {
      const p = lerp({ ...from, y: from.y + 2 }, { ...to, y: to.y + 2 }, s / (flat || 1))
      if (inSolid(site, p.x, p.y, p.z)) {
        const key = at(recs, p)
        return no('air', `its air is blocked at ${word(p)}${key ? ` by ${key}` : ''}`, { blocked: { ...p, key } })
      }
    }
    if (move === 'jump') {
      for (const t of [0.5, 0.35, 0.65]) {
        if (flat * Math.min(t, 1 - t) < 3) continue
        const p = lerp(from, to, t)
        const hit = floorHit(site, p.x, p.y + 0.5, p.z)
        if (hit && hit.y >= p.y - 3) return no('bridged', `bridged at ${word({ x: p.x, y: hit.y, z: p.z })} by ${hit.key}: a jump must be a gap`, { blocked: { x: p.x, y: hit.y, z: p.z, key: hit.key } })
      }
    }
    return { made: true, why: '', from, to }
  }

  if (move === 'run') {
    const found = findWay(site, { mode: 'run', from, to, near: 4, mask: corridor(from, to, CORRIDOR) })
    return found.found ? { made: true, why: '', from, to } : no('run', `no run from ${word(from)} to ${word(to)}`)
  }

  if (move === 'climb') {
    if (faceRising(site, from, to)) return { made: true, why: '', from, to }
    const found = findWay(site, { mode: 'run', from, to, near: 4, mask: corridor(from, to, CORRIDOR) })
    return found.found ? { made: true, why: '', from, to } : no('climb', `nothing to climb: no face rising from ${round(from.y, 10)} to ${round(to.y, 10)} near the leg`)
  }

  if (move === 'wallrun') return wallAlong(site, from, to) ? { made: true, why: '', from, to } : no('wall', 'no wall alongside to run')

  return no('span', `no such move as ${move}`)
}

/** Each of `ways` tried leg by leg: `[{ id, made, of, legs: [{ n, move, made, why }] }]`. */
export function testWays(site, ways, recs) {
  return ways.map((way) => {
    const legs = way.legs.map((leg) => {
      const found = legMade(site, leg, recs)
      return { n: leg.n, move: leg.move, made: found.made, why: found.why }
    })
    return { id: way.id, made: legs.filter((leg) => leg.made).length, of: legs.length, legs }
  })
}
