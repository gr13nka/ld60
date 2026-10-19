// Gavrilov's stair: a monumental stair climbing west from the stop's pad between two flank walls
// to a black portal, and across it, a third of the way up, a crude welded grate: verticals in one
// comb, three rails, patches and bent bars. Old, rust over concrete.
import { prism } from '../../../src/forms.js'
import { beam, pillar } from './east-kit.mjs'
import { stair, doorFrame, doorLeaf } from './blame-shapes.mjs'

const N = 130
const RISE = 0.5
const RUN = 1.2
const WIDTH = 52

export function gavrilovStair(stop, rng) {
  const forms = []
  const x0 = stop.x - 9 // the stair's foot, lapping the pad's edge
  const y0 = stop.y - 0.3
  const z = stop.z
  const topX = x0 - N * RUN
  const topY = y0 + N * RISE
  forms.push(stair({ x: x0, y0, z, n: N, rise: RISE, run: RUN, width: WIDTH, look: 'concrete' }))
  const surface = (x) => y0 + ((x0 - x) / RUN) * RISE // the treads' average height at x
  for (const side of [-1, 1]) {
    const zs = z + side * (WIDTH / 2 + 2)
    forms.push(beam({ x: x0, y: y0 + 30, z: zs }, { x: topX, y: topY + 30, z: zs }, 4, 36, 'dim', 'mass'))
  }
  // The grate, across the stair a third up: verticals every 2.5 m as one comb.
  const gx = x0 - N * RUN * 0.34
  const gy = surface(gx)
  const bars = Math.floor(WIDTH / 2.5)
  const t = 0.7
  const zl = z - WIDTH / 2
  for (let k = 0; k <= bars; k++) {
    const zz = zl + k * ((WIDTH - t) / bars)
    forms.push({ ...prism([[gx - 0.4, zz], [gx + 0.4, zz], [gx + 0.4, zz + t], [gx - 0.4, zz + t]], gy - 2, gy + 38 + (rng() < 0.12 ? -6 : 0), rng() < 0.2 ? 'rust' : 'dark'), role: 'dress' })
  }
  for (const h of [4, 17, 31]) forms.push(beam({ x: gx, y: gy + h, z: zl - 1 }, { x: gx, y: gy + h, z: zl + WIDTH + 1 }, 1.1, 1.1, 'rust', 'dress'))
  // Welded patches: plates over a few joints, and two bars bent in from the side.
  for (const [pz, py] of [[-14, 10], [9, 24], [-3, 33]]) forms.push({ ...prism([[gx - 0.9, z + pz - 3], [gx + 0.9, z + pz - 3], [gx + 0.9, z + pz + 3], [gx - 0.9, z + pz + 3]], gy + py - 2.5, gy + py + 2.5, 'rust'), role: 'dress' })
  forms.push(beam({ x: gx + 0.8, y: gy + 2, z: zl + 6 }, { x: gx + 0.8, y: gy + 20, z: zl + 22 }, 0.9, 0.9, 'rust', 'dress'))
  forms.push(beam({ x: gx + 0.8, y: gy + 36, z: zl + WIDTH - 5 }, { x: gx + 0.8, y: gy + 14, z: zl + WIDTH - 20 }, 0.9, 0.9, 'rust', 'dress'))
  // The portal at the top: a block, and in it a black doorway 36 by 46.
  const px = topX - 1
  forms.push({ ...prism([[px + 0.5, z - WIDTH / 2 - 8], [px - 60, z - WIDTH / 2 - 8], [px - 60, z + WIDTH / 2 + 8], [px + 0.5, z + WIDTH / 2 + 8]], topY - 2, topY + 110, 'concrete'), role: 'mass' })
  forms.push(doorFrame({ x: px, y: topY, z, w: 36, h: 46, deep: 10, yaw: Math.PI / 2, look: 'rust' }))
  forms.push(doorLeaf({ x: px - 0.6, y: topY, z, w: 36, h: 46, yaw: Math.PI / 2 }))
  // Columns under the stair, to the mist, every 45 m.
  const columns = []
  for (const u of [0.25, 0.5, 0.75, 1]) {
    const cx = x0 - N * RUN * u
    for (const side of [-1, 1]) columns.push(pillar(cx, z + side * 18, -884, surface(cx) - 0.5, 4.5, 'concrete', 1.3))
  }
  return { forms, columns }
}
