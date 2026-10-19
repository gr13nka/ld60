// Dev probe: what blocks a hung wall (face 25 m off the route, margin 10). node scripts/builders/grow/blame-probe.mjs after `grow.mjs --layers=ways`
import { loadCopy, propSolids, solidRecords } from '../world.mjs'
import { loadWays } from '../ways.mjs'
import { fieldOf } from './blame-field.mjs'
import { stubPads } from '../grow.mjs'
const copy = loadCopy(null)
const recs = solidRecords(copy.place, await propSolids())
const order = loadWays()
const keep = recs.filter((r) => !(r.owner === 'builders-grow-ways' && r.record.role === 'support'))
const sets = { all: keep, routesOnly: [], old: keep.filter((r) => r.owner === 'old'), ways: keep.filter((r) => r.owner !== 'old') }
const Fs = Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, fieldOf(order, stubPads(order), v)]))
const hit = Object.fromEntries(Object.keys(sets).map((k) => [k, 0]))
let n = 0
const roles = {}
for (const r of keep.filter((r) => r.owner !== 'old')) roles[r.record.role ?? '?'] = (roles[r.record.role ?? '?'] ?? 0) + 1
for (const way of order.ways) for (const leg of way.legs) {
  const dx = leg.b.x - leg.a.x, dz = leg.b.z - leg.a.z, l = Math.hypot(dx, dz)
  if (l < 40) continue
  for (const s of [1, -1]) {
    const x = leg.a.x + dx / 2 - (dz / l) * s * 45, z = leg.a.z + dz / 2 + (dx / l) * s * 45
    n++
    for (const k of Object.keys(sets)) if (Fs[k].hitAxis(x, z, 18, -644, 300, 10)) hit[k]++
  }
}
console.log(n, hit, roles)
