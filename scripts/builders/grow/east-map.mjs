// Dev probe: a floor map round a stop (height of the first floor under y+UP, relative to the stop; '.' none).
// node scripts/builders/grow/east-map.mjs <stop id> [half=60] [step=5] [up=6]
import { loadCopy, propSolids, standSite, floorHit } from '../world.mjs'
import { loadWays } from '../ways.mjs'
const [id, half = 60, step = 5, up = 6] = [process.argv[2], ...process.argv.slice(3).map(Number)]
const copy = loadCopy(null)
const site = standSite(copy.place, await propSolids())
const s = loadWays().stops.find((x) => x.id === id)
console.log('stop', s.x, s.y, s.z, ' rows z (down = +z), cols x (right = +x)')
for (let dz = -half; dz <= half; dz += step) {
  let line = String(Math.round(s.z + dz)).padStart(6) + ' '
  for (let dx = -half; dx <= half; dx += step) {
    const h = floorHit(site, s.x + dx, s.y + up, s.z + dz)
    const v = h ? Math.round(h.y - s.y) : null
    line += v === null ? '   .' : String(v).padStart(4)
  }
  console.log(line)
}
