// Dev measure: the open air round each east stop. For 36 headings and heights 0.5, 3 and 6 m up,
// how far a ray runs before it meets a face or box. Prints, per stop, the shortest run, the
// headings with 40+ m and with 300+ m clear, and the longest. node scripts/builders/grow/east-air.mjs after a full grow.
import { Vector3 } from 'three'
import { floorHit, loadCopy, propSolids, standSite } from '../world.mjs'
import { loadWays } from '../ways.mjs'
const copy = loadCopy(null)
const site = standSite(copy.place, await propSolids())
const faces = [...new Set([...site.faces._cells.values()].flat())]
const MAX = 400
function tri(o, d, f) {
  const e1 = new Vector3().subVectors(f.b, f.a)
  const e2 = new Vector3().subVectors(f.c, f.a)
  const p = new Vector3().crossVectors(d, e2)
  const det = e1.dot(p)
  if (Math.abs(det) < 1e-9) return Infinity
  const t0 = new Vector3().subVectors(o, f.a)
  const u = t0.dot(p) / det
  if (u < 0 || u > 1) return Infinity
  const q = new Vector3().crossVectors(t0, e1)
  const v = d.dot(q) / det
  if (v < 0 || u + v > 1) return Infinity
  const t = e2.dot(q) / det
  return t > 0.05 ? t : Infinity
}
function run(o, d) {
  let best = MAX
  for (const f of faces) {
    if (f.normal.y > 0.5) continue // a ramp the route climbs or falls along is floor, not a wall
    if (Math.max(f.min.x, f.max.x) < Math.min(o.x, o.x + d.x * best) - 1 || Math.min(f.min.x, f.max.x) > Math.max(o.x, o.x + d.x * best) + 1) continue
    if (f.max.z < Math.min(o.z, o.z + d.z * best) - 1 || f.min.z > Math.max(o.z, o.z + d.z * best) + 1) continue
    const t = tri(o, d, f)
    if (t < best) best = t
  }
  for (const b of site.keyedBoxes) {
    let t0 = 0
    let t1 = best
    for (const [a, lo, hi, dd] of [[o.x, b.x0, b.x1, d.x], [o.y, b.y0, b.y1, d.y], [o.z, b.z0, b.z1, d.z]]) {
      if (Math.abs(dd) < 1e-9) { if (a < lo || a > hi) { t1 = -1; break } continue }
      const s = (lo - a) / dd
      const e = (hi - a) / dd
      t0 = Math.max(t0, Math.min(s, e))
      t1 = Math.min(t1, Math.max(s, e))
    }
    if (t1 >= t0 && t0 < best) best = t0
  }
  return best
}
for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ['gull', 'voron', 'gavrilov', 'tabachnaya']) {
  const s = loadWays().stops.find((x) => x.id === id)
  const floor = floorHit(site, s.x, s.y + 4, s.z)?.y ?? s.y // the pad the stop stands on can stand a little off the stop's own height
  const per = []
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2
    const d = new Vector3(Math.sin(a), 0, Math.cos(a))
    per.push(Math.min(...[0.5, 3, 6].map((h) => run(new Vector3(s.x, floor + h, s.z), d))))
  }
  const r = (v) => Math.round(v)
  console.log(id, JSON.stringify({ min: r(Math.min(...per)), over40: per.filter((v) => v >= 40).length, over300: per.filter((v) => v >= 300).length, max: r(Math.max(...per)), runs: per.map(r).join(' ') }))
}
