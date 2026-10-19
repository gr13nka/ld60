// Which records of the grown copy stand about a point: `node ways-near.mjs x y z [r]`, with their owners.
import { loadCopy, solidRecords, propSolids } from '../world.mjs'
const [x, y, z, r = 3] = process.argv.slice(2).map(Number)
const place = loadCopy(null).place
for (const rec of solidRecords(place, await propSolids())) {
  const b = rec.bounds
  if (x < b.min.x - r || x > b.max.x + r || y < b.min.y - r || y > b.max.y + r || z < b.min.z - r || z > b.max.z + r) continue
  const rc = rec.record
  console.log(rec.key, rc.planOwner ?? 'old', rc.label ?? '', rc.look ?? '', JSON.stringify([b.min, b.max].map((p) => [p.x, p.y, p.z].map(Math.round))))
}
