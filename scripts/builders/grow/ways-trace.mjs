// Traces one way's pilot run: prints the body every second and each par point passed.
import { Vector3 } from 'three'
import { Player, siteOf, STEP } from '../../moves/sim.mjs'
import { Pilot, lineOf } from '../../moves/pilot.mjs'
import { loadCopy } from '../world.mjs'
const place = loadCopy(null).place
const site = siteOf(place)
const id = process.argv[2]
const par = lineOf(place.par, id)
const yaw = Math.atan2(par[1].x - par[0].x, par[1].z - par[0].z)
const player = new Player(site, { pos: new Vector3(par[0].x, par[0].y + 0.1, par[0].z), yaw })
const pilot = new Pilot(par)
pilot.yaw = yaw
let last = 0, lastI = 0, k = 0
const lines = []
const log = (l) => lines.push(l)
for (let t = 0; t < Number(process.argv[3] ?? 60); t += STEP) {
  const { controls } = pilot.step(player, t)
  player.step(controls)
  const p = player.body.pos
  if (pilot.i !== lastI) { log(`  passed ${lastI} -> ${pilot.i} at t=${t.toFixed(1)}`); lastI = pilot.i }
  const [w0, w1] = [Number(process.argv[5] ?? 0), Number(process.argv[6] ?? 0)]
  if (t - last >= (t >= w0 && t <= w1 ? 0.05 : 0.5)) { last = t; log(`t=${t.toFixed(1)} ${player.state}/${player.mode} pos ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} v ${player.speed.toFixed(1)} vel ${player.body.vel.x.toFixed(1)},${player.body.vel.y.toFixed(1)},${player.body.vel.z.toFixed(1)} yaw ${pilot.yaw.toFixed(2)} next#${pilot.i} ${JSON.stringify(par[pilot.i] && [par[pilot.i].x, par[pilot.i].y, par[pilot.i].z, par[pilot.i].do].map(v=>typeof v==='number'?Math.round(v):v))}`) }
  if (p.y < -860 || player.state === 'crashed') { log('END ' + player.state + ' ' + p.y); break }
}

console.log(lines.slice(-Number(process.argv[4] ?? 16)).join('\n'))
