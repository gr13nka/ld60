// Dev check for the blame layer: which of its records gravity (`support.mjs`) leaves floating in the
// copy as it stands now. `node scripts/builders/grow/blame-check.mjs` after `grow.mjs --layers=ways,blame`.
import { loadCopy, propSolids, solidRecords, standSite } from '../world.mjs'
import { scanSupport } from '../support.mjs'

const copy = loadCopy(null)
const solids = await propSolids()
const site = standSite(copy.place, solids)
const recs = solidRecords(copy.place, solids)
const scan = scanSupport(site, recs)
const mine = recs.filter((r) => /^builders-grow-(blame|ways)$/.test(r.owner))
const floating = mine.filter((r) => !scan.grounded.has(r.key))
const shape = (r) => (r.record.kind === 'lathe' ? 'lathe' : (r.record.path?.length ?? 0) > 3 ? 'column/tower' : 'slab/girder')
const by = {}
for (const r of floating) by[shape(r)] = (by[shape(r)] ?? 0) + 1
console.log(JSON.stringify({ mine: mine.length, floating: floating.length, by }))
for (const r of floating.filter((r) => shape(r) !== 'slab/girder').concat(floating.slice(0, 4))) console.log(r.key, shape(r), JSON.stringify(r.bounds, (k, v) => (typeof v === 'number' ? Math.round(v) : v)))
