// What the suit really carries from a standing run off a pad (20 m/s), flown by the par pilot toward a point
// `ratio` metres forward for one down: the drop it has spent at each distance. Sets `LIMITS.glide` and the entry loss.
//
//   node scripts/builders/grow/ways-glide.mjs
import { Vector3 } from 'three'
import { Player, siteOf, STEP } from '../../moves/sim.mjs'
import { Pilot } from '../../moves/pilot.mjs'

const site = siteOf({ boxes: [{ x0: -20, x1: 20, y0: -30, y1: 0, z0: -80, z1: 0 }], forms: [], assets: [], cuts: [], abyss: { lost: null } })
for (const ratio of [2.0, 2.4, 2.8, 3.2, 3.6]) {
  const far = 800
  const par = [
    { x: 0, y: 0, z: -40, do: 'run' },
    { x: 0, y: 0, z: -1, do: 'jump' },
    { x: 0, y: -2, z: 8, do: 'wing' },
    { x: 0, y: -far / ratio, z: far, do: 'fold' },
  ]
  const player = new Player(site, { pos: new Vector3(0, 0.1, -78), yaw: 0 })
  const pilot = new Pilot(par)
  const out = []
  let next = 50
  for (let t = 0; t < 120; t += STEP) {
    const { controls } = pilot.step(player, t)
    player.step(controls)
    const p = player.body.pos
    if (p.z > next) { out.push(`${next}:${(-p.y).toFixed(0)}`); next += 50 }
    if (player.state === 'crashed' || p.y < -400 || p.z > far) break
  }
  console.log(`target ${ratio}:1  (distance:drop) ${out.join(' ')}`)
}
