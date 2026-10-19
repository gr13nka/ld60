// The story's places in the generated world: where the courier is met (`place.courier.spots`), the
// homes of the people he meets (crows, raccoons), the lit masts that show where each of them is
// (`beacons`), and the things left along the way (finds), all read off the order's stops and ways,
// so they move when the routes do. The Quitters game reads
// these from the world record (`courier.js`, `parkour-world.js`); the words stay in the story files.
//
// `placeStory(place, order, site)` only writes the place's records. It runs last in `grow()`, and alone
// on the grown world: `node scripts/builders/grow/story.mjs` (the owner's edits put back after, `hand.mjs`).

import { floorHit, MIST } from '../world.mjs'
import { nextFormId } from '../../../src/place-file.js'
import { box } from './west-kit.mjs'

const SPOT = { radius: 5 }
const HIDDEN = { radius: 7 } // the hidden branch's two spots are wider, as in the Quitters file
const BESIDE = 2.5 // metres a figure stands to the side of its stop's middle, off the runner's line

// The story's spot, by the stop it is met at.
const SPOT_STOP = { roof: 'gull', sorting: 'voron', tamara: 'tamara', pipe: 'pipeman', raccoon: 'raccoon', grille: 'gavrilov', works: 'tabachnaya' }

// The finds Quitters keeps by id (the save knows them), each at a landing of a way: way id, point.
// `-1` is the way's last point, a stop's own pad. Point `n` ends leg `n`; each is chosen where a
// run leg ends, a floor the courier crosses on his feet anyway, so that none asks a detour. The
// ten feathers lie on the first four ways, so the hook they open comes by the pipe, not at the end.
const FINDS = [
  { id: 'match-yard', kind: 'match', way: 'gull-voron', n: 1 },
  { id: 'feather-yard-steps', kind: 'feather', way: 'gull-voron', n: 3 },
  { id: 'feather-yard-landing', kind: 'feather', way: 'gull-voron', n: 8 },
  { id: 'feather-yard-ledge', kind: 'feather', way: 'gull-voron', n: 20 },
  { id: 'match-yard-run', kind: 'match', way: 'gull-voron', n: 25 },
  { id: 'feather-yard-far', kind: 'feather', way: 'gull-voron', n: 38 },
  { id: 'match-yard-long', kind: 'match', way: 'gull-voron', n: 41 },
  { id: 'match-bridge-start', kind: 'match', way: 'voron-tamara', n: 2 },
  { id: 'feather-bridge', kind: 'feather', way: 'voron-tamara', n: 'middle' },
  { id: 'feather-bridge-run', kind: 'feather', way: 'voron-tamara', n: 16 },
  { id: 'feather-tamara', kind: 'feather', way: 'voron-tamara', n: -1 },
  { id: 'match-bridge-end', kind: 'match', way: 'tamara-raccoon', n: 1 },
  { id: 'feather-raccoon-run', kind: 'feather', way: 'tamara-raccoon', n: 7 },
  { id: 'match-raccoon-run', kind: 'match', way: 'tamara-raccoon', n: 15 },
  { id: 'feather-pipe-shelf', kind: 'feather', way: 'raccoon-pipeman', n: 9 },
  { id: 'match-pipe-run', kind: 'match', way: 'raccoon-pipeman', n: 17 },
  { id: 'match-pipe-far', kind: 'match', way: 'raccoon-pipeman', n: 24 },
  { id: 'feather-pipe', kind: 'feather', way: 'raccoon-pipeman', n: -1 },
  { id: 'match-grille-run', kind: 'match', way: 'voron-gavrilov', n: 12 },
  { id: 'match-grille', kind: 'match', way: 'voron-gavrilov', n: -1 },
]

// The post's mast at each person he is sent to: a concrete column standing near them, a lantern
// on top seen from far off across the gorge, a lit strip down the face that looks at them, and a
// light over the spot itself (the owner, 2026-10-19: "around all characters add some structures
// and lights that grab players attention ... you can find them without any problems"). Amber,
// as all the light is; one look for all, so that the first one found teaches the rest.
const BEACON = {
  spots: ['sorting', 'tamara', 'raccoon', 'pipe', 'grille'],
  out: [12, 16, 20, 26], // metres from the stop's middle the mast is tried at, nearest first
  turns: 16, // directions round the stop tried at each
  clear: 6, // metres the mast, lantern and cap keep from every leg of every way
  half: 1.5, // half the column's width
  up: 45, // metres the lantern's foot stands over the stop
  lantern: { half: 3.5, h: 5 },
  cap: { half: 5, h: 2 }, // the slab over the lantern, wider than it: the mast's hanging mass
  strip: 0.5, // half the lit strip's width, down the face toward the spot
  light: { color: '#ffc27a', power: 220, reach: 160 },
  pool: { over: 6, color: '#ffb36b', power: 70, reach: 22 }, // over the spot, on the person
  owner: 'builders-grow-story',
}
const FOOT = MIST - 4 // a mast with no floor under it goes down into the mist

const at = (p, dy = 0) => ({ x: p.x, y: p.y + dy, z: p.z })
const yawOf = (from, to) => Math.atan2(to.x - from.x, to.z - from.z)
const r1 = (v) => Math.round(v * 10) / 10

/**
 * `site` (`standSite(place)`), when given, sets every point the story names on the floor a runner
 * would stand on there (within 2 m of the height the route asked): the way's height is an aim, the
 * built floor is what is met.
 */
export function placeStory(place, order, site = null, report = []) {
  const onFloor = (p) => {
    const hit = site && floorHit(site, p.x, p.y + 2, p.z)
    return hit && Math.abs(hit.y - p.y) < 2 ? { ...p, y: r1(hit.y) } : p
  }
  const stop = (id) => {
    const found = order.stops.find((s) => s.id === id)
    if (!found) throw new Error(`the story has no stop "${id}" in the order`)
    return found
  }
  const way = (id) => {
    const found = order.ways.find((w) => w.id === id)
    if (!found) throw new Error(`the story has no way "${id}" in the order`)
    return found
  }
  // Where the runner comes from into a stop: the point before the last of a way that ends there.
  const arrival = (id) => {
    const w = order.ways.find((o) => o.to === id)
    return w.points[Math.max(0, w.points.length - 2)]
  }
  // A point `BESIDE` metres to the side of the stop, facing back along the arriving route.
  const stand = (id, side = 1) => {
    const s = stop(id)
    const yaw = yawOf(s, arrival(id))
    return onFloor({ x: r1(s.x + Math.cos(yaw) * BESIDE * side), y: r1(s.y), z: r1(s.z - Math.sin(yaw) * BESIDE * side), yaw: Math.round(yaw * 1000) / 1000 })
  }
  const spot = (id, wide = SPOT) => onFloor({ x: r1(stop(id).x), y: r1(stop(id).y), z: r1(stop(id).z), radius: wide.radius })

  const spots = {}
  for (const [name, id] of Object.entries(SPOT_STOP)) spots[name] = spot(id, name === 'works' ? HIDDEN : SPOT)
  // The hidden branch's way in: the first landing of the Gavrilov to Табачная way, off the route.
  const hidden = way('gavrilov-tabachnaya').points[1]
  spots.offRoute = onFloor({ x: r1(hidden.x), y: r1(hidden.y), z: r1(hidden.z), radius: HIDDEN.radius })
  // The Quitters file's one crossing joined two decks over a drop that the courier is let across
  // unseen; the generated world has no such place named, so there is none.
  place.courier = { spots, crossings: [] }

  place.crows = [{ perches: ['gull', 'voron', 'tamara'].map((id) => stand(id, -1)) }]
  place.raccoons = [stand('raccoon', 1)]
  place.pigeons ??= []
  place.cats ??= []
  place.benches ??= []
  place.finds = FINDS.map(({ id, kind, way: wayId, n }) => {
    const w = way(wayId)
    const p = w.points[n === 'middle' ? Math.floor(w.points.length / 2) : n < 0 ? w.points.length + n : n]
    return { id, kind, ...onFloor({ x: r1(p.x), y: r1(p.y), z: r1(p.z) }) }
  })
  report.push(...placeBeacons(place, order, site))
  place.start = { ...place.starts.gull } // the story begins on the roof
  return place
}

// The masts (`BEACON`), laid again on each run: the last run's are taken away first. Returns a line
// for each spot: where its mast stands, or that there was no room for one.
function placeBeacons(place, order, site) {
  for (const list of ['forms', 'lamps', 'lights']) place[list] = (place[list] ?? []).filter((r) => r.planOwner !== BEACON.owner)
  const samples = []
  for (const way of order.ways) {
    for (const { a, b, length } of way.legs) {
      const n = Math.max(1, Math.ceil(length / 3))
      for (let i = 0; i <= n; i++) samples.push([a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n, a.z + (b.z - a.z) * i / n])
    }
  }
  const apart = ([x, y, z], q) => Math.hypot(Math.max(q.x0 - x, 0, x - q.x1), Math.max(q.y0 - y, 0, y - q.y1), Math.max(q.z0 - z, 0, z - q.z1))
  const { half, up, lantern, cap, strip, light, pool, owner } = BEACON
  const made = []
  for (const name of BEACON.spots) {
    const spot = place.courier.spots[name]
    if (!spot) continue
    const top = spot.y + up
    const capTop = top + lantern.h + cap.h
    let mast = null
    for (const out of BEACON.out) {
      for (let k = 0; k < BEACON.turns && !mast; k++) {
        const turn = (k / BEACON.turns) * Math.PI * 2
        const x = r1(spot.x + Math.sin(turn) * out)
        const z = r1(spot.z + Math.cos(turn) * out)
        const base = (site && floorHit(site, x, spot.y + 2, z)?.y) ?? FOOT
        const bounds = { x0: x - cap.half, x1: x + cap.half, y0: base, y1: capTop, z0: z - cap.half, z1: z + cap.half }
        if (samples.some((p) => apart(p, bounds) < BEACON.clear)) continue
        if (site?.hitsSolid({ x, y: top + lantern.h / 2, z }, cap.half)) continue
        mast = { x, z, base }
      }
      if (mast) break
    }
    if (!mast) { made.push(`${name}: no room`); continue }
    const { x, z, base } = mast
    const form = (record) => place.forms.push({ ...record, id: nextFormId(place), planOwner: owner })
    form(box(x - half, x + half, base, top, z - half, z + half, 'concrete'))
    form(box(x - cap.half, x + cap.half, top + lantern.h, capTop, z - cap.half, z + cap.half, 'concrete'))
    const lamp = (q) => place.lamps.push({ ...q, planOwner: owner })
    lamp({ x0: x - lantern.half, x1: x + lantern.half, y0: top, y1: top + lantern.h, z0: z - lantern.half, z1: z + lantern.half })
    // The strip on whichever side of the column looks most toward the spot, from a man's head up.
    const dx = spot.x - x
    const dz = spot.z - z
    const along = { y0: spot.y + 3, y1: top }
    if (Math.abs(dx) > Math.abs(dz)) {
      const face = x + Math.sign(dx) * half
      lamp({ x0: Math.min(face, face + Math.sign(dx) * 0.2), x1: Math.max(face, face + Math.sign(dx) * 0.2), ...along, z0: z - strip, z1: z + strip })
    } else {
      const face = z + Math.sign(dz) * half
      lamp({ x0: x - strip, x1: x + strip, ...along, z0: Math.min(face, face + Math.sign(dz) * 0.2), z1: Math.max(face, face + Math.sign(dz) * 0.2) })
    }
    place.lights.push({ kind: 'point', x, y: top + lantern.h / 2, z, color: light.color, power: light.power, reach: light.reach, head: false, planOwner: owner })
    place.lights.push({ kind: 'point', x: spot.x, y: spot.y + pool.over, z: spot.z, color: pool.color, power: pool.power, reach: pool.reach, head: false, planOwner: owner })
    made.push(`${name}: ${Math.round(Math.hypot(dx, dz))} m off, from ${Math.round(base)} to ${Math.round(capTop)}`)
  }
  return made
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { loadWays } = await import('../ways.mjs')
  const { saveCopy, standSite, propSolids } = await import('../world.mjs')
  const { grownWorld, withHand } = await import('../hand.mjs')
  const place = grownWorld() // the story goes on the world as grown, and the owner's edits over it
  const report = []
  placeStory(place, loadWays(), standSite(place, await propSolids()), report)
  console.log(JSON.stringify(withHand(place)))
  saveCopy(place, null)
  console.log(JSON.stringify(place.courier.spots, null, 1))
  console.log(report.join('\n'))
}
