// How far a jump carries from a run off a pad (20 m/s), over a drop: the pilot jumps at the edge and holds the line.
//
//   node scripts/builders/grow/ways-jump.mjs
import { Vector3 } from 'three'
import { Player, siteOf, STEP } from '../../moves/sim.mjs'
import { Pilot } from '../../moves/pilot.mjs'

const site = siteOf({ boxes: [{ x0: -20, x1: 20, y0: -30, y1: 0, z0: -80, z1: 0 }], forms: [], assets: [], cuts: [], abyss: { lost: null } })
for (const lead of [12, 25, 40]) {
  const out = []
  for (const drop of [0, 3, 6, 10, 15, 20, 30]) {
    const par = [{ x: 0, y: 0, z: -80 + lead, do: 'run' }, { x: 0, y: 0, z: -0.5, do: 'jump' }, { x: 0, y: -drop, z: 100, do: 'run' }]
    const player = new Player(site, { pos: new Vector3(0, 0.1, -80), yaw: 0 })
    const pilot = new Pilot(par)
    let reach = null
    for (let t = 0; t < 10; t += STEP) {
      const { controls } = pilot.step(player, t)
      player.step(controls)
      if (player.body.pos.y <= -drop - 0.01 && player.body.pos.z > 1) { reach = player.body.pos.z; break }
    }
    out.push(`${drop}:${reach?.toFixed(1)}`)
  }
  console.log(`run-up ${lead} m (drop:reach) ${out.join(' ')}`)
}
