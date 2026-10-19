// Dev probe: what stands and what runs within R of each east stop. node scripts/builders/grow/east-probe.mjs [R] after a grow without stops.
import { loadCopy, propSolids, solidRecords } from '../world.mjs'
import { loadWays } from '../ways.mjs'
const R = Number(process.argv[2] ?? 120)
const copy = loadCopy(null)
const recs = solidRecords(copy.place, await propSolids())
const order = loadWays()
const q = (v) => Math.round(v)
for (const id of ['gull', 'voron', 'gavrilov', 'tabachnaya']) {
  const s = order.stops.find((x) => x.id === id)
  console.log('==', id, q(s.x), q(s.y), q(s.z))
  for (const way of order.ways) for (const leg of way.legs) {
    const near = [leg.a, leg.b].some((p) => Math.hypot(p.x - s.x, p.z - s.z) < R && Math.abs(p.y - s.y) < R)
    if (near) console.log(' leg', way.id, leg.n, leg.move, [leg.a, leg.b].map((p) => `${q(p.x)},${q(p.y)},${q(p.z)}`).join(' -> '))
  }
  for (const r of recs) {
    const b = r.bounds
    if (!b) continue
    const dx = Math.max(b.min.x - s.x, 0, s.x - b.max.x), dz = Math.max(b.min.z - s.z, 0, s.z - b.max.z), dy = Math.max(b.min.y - s.y, 0, s.y - b.max.y)
    if (Math.hypot(dx, dy, dz) < R) console.log(' rec', r.key, r.owner, r.record.role ?? r.record.name ?? '', `x ${q(b.min.x)}..${q(b.max.x)} y ${q(b.min.y)}..${q(b.max.y)} z ${q(b.min.z)}..${q(b.max.z)}`)
  }
}
