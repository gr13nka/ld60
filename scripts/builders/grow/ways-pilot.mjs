// Runs each way's par line (written by grow-ways.mjs, `line` the way's id) with the pilot over the
// real runner and suit (`scripts/moves/`), from the way's first stop on the grown copy, and says how
// far each got: the par point it reached, and why it stopped. A check of the grown copy, not a layer.
//
//   node scripts/builders/grow/ways-pilot.mjs [way-id …]
import { Vector3 } from 'three'
import { Player, siteOf, STEP } from '../../moves/sim.mjs'
import { Pilot, lineOf } from '../../moves/pilot.mjs'
import { loadCopy } from '../world.mjs'

const LIMIT = 900 // seconds of run a way is given
const place = loadCopy(null).place
const site = siteOf(place)
const only = process.argv.slice(2)
const ways = [...new Set(place.par.map((q) => q.line))].filter((id) => !only.length || only.includes(id))
for (const id of ways) {
  const par = lineOf(place.par, id)
  const first = par[0]
  const second = par[1]
  const yaw = Math.atan2(second.x - first.x, second.z - first.z)
  const player = new Player(site, { pos: new Vector3(first.x, first.y + 0.1, first.z), yaw })
  const pilot = new Pilot(par)
  pilot.yaw = yaw
  let why = 'finished'
  let t = 0
  for (; t < LIMIT; t += STEP) {
    if (pilot.i >= par.length) break
    const { controls } = pilot.step(player, t)
    player.step(controls)
    if (player.state === 'crashed') {
      why = 'crashed'
      break
    }
    if (player.body.pos.y < -860) {
      why = 'fell'
      break
    }
  }
  if (t >= LIMIT) why = 'timed out'
  const at = player.body.pos
  const next = par[Math.min(pilot.i, par.length - 1)]
  console.log(`${id}: ${why} at par ${pilot.i}/${par.length} (${next.do}${next.wall ? ' wall' : ''}) pos ${at.x.toFixed(0)}, ${at.y.toFixed(0)}, ${at.z.toFixed(0)} after ${t.toFixed(0)} s`)
}
