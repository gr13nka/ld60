// The floors of the grown copy along a plan line: `node ways-floors.mjs x0 z0 x1 z1 [y] [step]`, each with its record's owner.
import { loadCopy, propSolids, standSite, floorsUnder, keyOf } from '../world.mjs'
const [x0, z0, x1, z1, y = 500, step = 2] = process.argv.slice(2).map(Number)
const place = loadCopy(null).place
const site = standSite(place, await propSolids())
const owner = new Map()
for (const f of place.forms) owner.set(`f${f.id}`, f.planOwner ?? 'old')
const L = Math.hypot(x1 - x0, z1 - z0)
for (let s = 0; s <= L; s += step) {
  const x = x0 + ((x1 - x0) * s) / L
  const z = z0 + ((z1 - z0) * s) / L
  console.log(s.toFixed(0), x.toFixed(1), z.toFixed(1), floorsUnder(site, x, z, y, 700, 0.5).slice(0, 4).map((f) => `${f.y.toFixed(1)}:${f.key}(${(owner.get(f.key) ?? 'box/asset').replace('builders-grow-', '')})`).join(' '))
}
