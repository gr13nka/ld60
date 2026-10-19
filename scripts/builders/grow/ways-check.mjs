// Dev check for the blame layer: which of its records gravity (`support.mjs`) leaves floating in the
// copy as it stands now. `node scripts/builders/grow/blame-check.mjs` after `grow.mjs --layers=ways,blame`.
import { loadCopy, propSolids, solidRecords, standSite } from '../world.mjs'
import { scanSupport } from '../support.mjs'

const copy = loadCopy(null)
const solids = await propSolids()
const site = standSite(copy.place, solids)
const recs = solidRecords(copy.place, solids)
const scan = scanSupport(site, recs)
const mine = recs.filter((r) => /^builders-grow-ways$/.test(r.owner))
const floating = mine.filter((r) => !scan.grounded.has(r.key))
const shape = (r) => (r.record.kind === 'lathe' ? 'lathe' : (r.record.path?.length ?? 0) > 3 ? 'column/tower' : 'slab/girder')
const by = {}
for (const r of floating) by[shape(r)] = (by[shape(r)] ?? 0) + 1
console.log(JSON.stringify({ mine: mine.length, floating: floating.length, by }))
for (const r of floating.filter((r) => shape(r) !== 'slab/girder').concat(floating.slice(0, 4))) console.log(r.key, shape(r), JSON.stringify(r.bounds, (k, v) => (typeof v === 'number' ? Math.round(v) : v)))
const kinds = {}
for (const r of floating) {
  const f = r.record
  const k = `${f.role} ${f.look} ${f.path?.[1]?.y < 1 ? 'thin' : ''} ${f.path?.[1]?.y > 0 && f.path[1].y < 3 ? 'plate' : 'tall'}`
  kinds[k] = (kinds[k] ?? 0) + 1
}
console.log(JSON.stringify(kinds))
const sizes = {}
for (const r of floating) {
  const b = r.bounds
  const k = `${Math.max(b.max.x - b.min.x, b.max.z - b.min.z) < 6 ? 'ledge' : 'slab'}`
  sizes[k] = (sizes[k] ?? 0) + 1
}
console.log(JSON.stringify(sizes))
const small = floating.filter((r) => Math.max(r.bounds.max.x - r.bounds.min.x, r.bounds.max.z - r.bounds.min.z) < 6).slice(0, 3)
for (const r of small) {
  console.log('ledge?', r.key, JSON.stringify(r.bounds, (k, v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v)))
  for (const o of recs) { const b = o.bounds, c = r.bounds; if (o !== r && b.min.x < c.max.x + 1 && b.max.x > c.min.x - 1 && b.min.z < c.max.z + 1 && b.max.z > c.min.z - 1 && b.min.y < c.max.y + 1 && b.max.y > c.min.y - 1) console.log('  near', o.key, o.owner, scan.grounded.get(o.key), JSON.stringify(b, (k, v) => (typeof v === 'number' ? Math.round(v) : v))) }
}
const cells = {}
for (const r of floating) { const b = r.bounds; const k = `${Math.round((b.min.x + b.max.x) / 2 / 30) * 30},${Math.round((b.min.z + b.max.z) / 2 / 30) * 30} y${Math.round(b.min.y / 50) * 50}`; cells[k] = (cells[k] ?? 0) + 1 }
console.log(JSON.stringify(cells))
