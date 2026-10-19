// The Табачная: a cold boiler hall 95 m under the stop, with the Главный Центр (the palace) hung
// over it and touching nothing. Five boilers as big as houses, each a drum lying in its
// concrete trough, a dark fire door at one end and a dead stack at the other; a manifold across them,
// a colonnade down one side. Blue-grey, still, lit only by a few cold lamps, no steam: the steam layer keeps 300 m off.
import { prism } from '../../../src/forms.js'
import { P, bar, beam, pillar, r2, cellWall } from './east-kit.mjs'
import { doorFrame, doorLeaf } from './blame-shapes.mjs'

export function boilerHall(stop) {
  const forms = []
  const deckTop = stop.y - 95
  const x0 = stop.x - 10
  const x1 = stop.x + 270
  const z0 = stop.z - 130
  const z1 = stop.z + 150
  forms.push({ ...prism([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], deckTop - 9, deckTop, 'concrete'), bevel: { size: 0.8, segments: 1 }, role: 'mass' })
  for (const fx of [0.12, 0.5, 0.88]) for (const fz of [0.12, 0.5, 0.88]) forms.push(pillar(x0 + (x1 - x0) * fx, z0 + (z1 - z0) * fz, -884, deckTop - 7, 7, 'concrete', 1.2))
  // The boilers: row A south of the east tower (long axis along x), row B east of it.
  const rows = [
    { z: stop.z + 50, x: stop.x + 12, n: 3, pitch: 40 },
    { z: stop.z - 105, x: stop.x + 150, n: 2, pitch: 40 },
  ]
  const R = 14
  const L = 108
  for (const row of rows) {
    for (let k = 0; k < row.n; k++) {
      const z = row.z + k * row.pitch
      const xa = row.x
      const xb = row.x + L
      const yc = deckTop + 19
      forms.push({ ...prism([[xa - 4, z - R - 4], [xb + 4, z - R - 4], [xb + 4, z + R + 4], [xa - 4, z + R + 4]], deckTop - 0.5, yc, 'concrete'), bevel: { size: 0.6, segments: 1 }, role: 'mass' })
      forms.push({ kind: 'sweep', at: P(xa, yc, z), look: 'curb', smooth: true, section: circleOf(R), bevel: { size: 3, segments: 3 }, path: [P(0, 0, 0), P(L, 0, 0)], role: 'mass' })
      // The fire door in the brick at the east end, black, with a grey frame.
      forms.push(doorFrame({ x: xb + 4, y: deckTop, z, w: 12, h: 13, deep: 1.2, yaw: Math.PI / 2, look: 'dim' }))
      forms.push(doorLeaf({ x: xb + 4.5, y: deckTop, z, w: 12, h: 13, yaw: Math.PI / 2 }))
      // The stack at the west end: round, battered, cap on top, stopping well short of the palace.
      forms.push(pillar(xa + 6, z, deckTop - 0.5, deckTop + 62, 5.2, 'dark', 0.8))
    }
  }
  // The manifold: one pipe across row A's drums, on posts.
  const my = deckTop + 40
  const mz0 = stop.z + 30
  const mz1 = stop.z + 112
  const mx = stop.x + 14 + 55
  forms.push({ ...bar({ x: mx, y: my, z: mz0 }, { x: mx, y: my, z: mz1 }, 3, 'curb', 'service', 12) })
  for (const z of [mz0 + 4, (mz0 + mz1) / 2, mz1 - 4]) forms.push(pillar(mx, z, deckTop - 0.5, my - 2, 1.6, 'dark'))
  // The colonnade down the south edge, with a lintel.
  const cz = z1 - 12
  for (let k = 0; k < 6; k++) forms.push(pillar(x0 + 20 + k * 48, cz, deckTop - 0.5, deckTop + 74, 5, 'concrete', 1.15))
  forms.push(beam({ x: x0 + 14, y: deckTop + 76, z: cz }, { x: x0 + 20 + 5 * 48 + 6, y: deckTop + 76, z: cz }, 9, 6, 'dim', 'mass'))
  // The only light is cold: grey-blue pools high over the hall, none near a boiler's door, so that the palace's underside and the empty air round it read as still.
  const lights = [[0.2, 0.3], [0.55, 0.3], [0.2, 0.75], [0.55, 0.75], [0.85, 0.5]].map(([fx, fz]) => ({ kind: 'point', x: r2(x0 + (x1 - x0) * fx), y: r2(deckTop + 70), z: r2(z0 + (z1 - z0) * fz), color: '#8fb4d0', power: 260, reach: 150, head: { w: 1.6, h: 0.8, d: 1.6 } }))
  // The back wall behind the colonnade: concrete with a window grid, openings 1.5 m at a 4 m pitch, 80 m high.
  forms.push(...cellWall({ o: { x: x0 + 4, z: z1 + 6 }, t: { x: 1, z: 0 }, f: { x: 0, z: -1 }, y0: deckTop, cell: 4, thick: 2.5, nx: Math.floor((x1 - x0 - 12) / 4), ny: 20, depth: 3, look: 'concrete', backLook: 'dark' }))
  return { forms, lights }
}

function circleOf(r) {
  return Array.from({ length: 24 }, (_, i) => [r2(Math.cos((i / 24) * Math.PI * 2) * r), r2(Math.sin((i / 24) * Math.PI * 2) * r)])
}
