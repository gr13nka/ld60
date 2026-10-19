// The routes' own air, as grow.mjs guards it against every layer after the ways (a copy of its
// `routeAir` and `fills`, so that this layer can leave the air alone before it is refused): every
// pad's head room and every leg's line but a climb's. Pure.
import { meetsMesh } from '../zones.mjs'
import { positionsOf } from '../world.mjs'

const overlaps = (a, b) => a.min.x <= b.max.x && a.max.x >= b.min.x && a.min.y <= b.max.y && a.max.y >= b.min.y && a.min.z <= b.max.z && a.max.z >= b.min.z

/** The air of `order` and its `pads`: tubes with their bounds. */
export function routeAir(order, pads) {
  const air = []
  for (const p of pads) {
    const f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }
    const r = { x: f.z, z: -f.x }
    const hw = Math.max(0, (p.w ?? 10) / 2 - 0.5)
    const hl = Math.max(0, (p.l ?? 10) / 2 - 0.5)
    const rows = Math.max(1, Math.ceil((2 * hl) / 2.5))
    const tube = []
    for (let i = 0; i <= rows; i++) {
      const v = -hl + (2 * hl * i) / rows
      for (const u of i % 2 ? [hw, -hw] : [-hw, hw]) tube.push([p.x + r.x * u + f.x * v, p.y + 2.4, p.z + r.z * u + f.z * v])
    }
    air.push({ tube, r: 2.6, what: `pad ${p.way} ${p.n}` }) // a little wider than the guard's 2
  }
  for (const way of order.ways) {
    for (const leg of way.legs) {
      if (leg.move === 'climb') continue
      const [up, r] = leg.move === 'wallrun' ? [1.5, 1.8] : [2.5, 2.6]
      air.push({ tube: [[leg.a.x, leg.a.y + up, leg.a.z], [leg.b.x, leg.b.y + up, leg.b.z]], r, what: `leg ${way.id} ${leg.n}` })
    }
  }
  for (const a of air) {
    const lo = [0, 1, 2].map((k) => Math.min(...a.tube.map((q) => q[k])) - a.r)
    const hi = [0, 1, 2].map((k) => Math.max(...a.tube.map((q) => q[k])) + a.r)
    a.bounds = { min: { x: lo[0], y: lo[1], z: lo[2] }, max: { x: hi[0], y: hi[1], z: hi[2] } }
  }
  return air
}

/** Whether the form `record` fills any of `air`. */
export function fillsForm(air, record) {
  const positions = positionsOf('forms', record)
  const min = { x: Infinity, y: Infinity, z: Infinity }
  const max = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (let i = 0; i < positions.length; i += 3) {
    min.x = Math.min(min.x, positions[i])
    max.x = Math.max(max.x, positions[i])
    min.y = Math.min(min.y, positions[i + 1])
    max.y = Math.max(max.y, positions[i + 1])
    min.z = Math.min(min.z, positions[i + 2])
    max.z = Math.max(max.z, positions[i + 2])
  }
  const bounds = { min, max }
  return air.some((a) => overlaps(a.bounds, bounds) && meetsMesh(a, positions))
}
