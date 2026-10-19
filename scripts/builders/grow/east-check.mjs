// Dev check: which of the stops layer's records gravity leaves floating, by piece. After a full grow.mjs.
import { loadCopy, propSolids, solidRecords, standSite } from '../world.mjs'
import { scanSupport } from '../support.mjs'
const copy = loadCopy(null)
const solids = await propSolids()
const site = standSite(copy.place, solids)
const recs = solidRecords(copy.place, solids)
const scan = scanSupport(site, recs)
const mine = recs.filter((r) => r.owner === 'builders-grow-stops')
const floating = mine.filter((r) => !scan.grounded.has(r.key))
console.log(JSON.stringify({ mine: mine.length, floating: floating.length }))
for (const r of floating) console.log(r.key, r.list, r.record.role ?? '', r.record.kind, JSON.stringify(r.bounds, (k, v) => (typeof v === 'number' ? Math.round(v) : v)))
