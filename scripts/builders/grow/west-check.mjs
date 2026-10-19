// Dev check for the west set pieces: which of the stops layer's records gravity (`support.mjs`) leaves
// floating in the copy as it stands now. `node scripts/builders/grow/west-check.mjs` after `grow.mjs`.
import { loadCopy, propSolids, solidRecords, standSite } from '../world.mjs'
import { scanSupport } from '../support.mjs'

const copy = loadCopy(null)
const solids = await propSolids()
const site = standSite(copy.place, solids)
const recs = solidRecords(copy.place, solids)
const scan = scanSupport(site, recs)
const mine = recs.filter((r) => r.owner === 'builders-grow-stops')
const near = (r, [x, y, z], d) => r.bounds.min.x < x + d && r.bounds.max.x > x - d && r.bounds.min.z < z + d && r.bounds.max.z > z - d
const floating = mine.filter((r) => !scan.grounded.has(r.key))
console.log(JSON.stringify({ stops: mine.length, floating: floating.length }))
for (const r of floating.slice(0, 30)) console.log(r.key, JSON.stringify(r.bounds, (k, v) => (typeof v === 'number' ? Math.round(v) : v)))
void near
