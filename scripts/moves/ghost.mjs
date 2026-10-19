// A ghost run of a place's main route: the game's own runner (`sim.mjs`'s `Player` on the place's
// own solids) run along a line drawn on the plan (`itch/plan.html`'s Route layer, `[x, z]` points
// in order), as a fair player would run it. He holds forward toward a point a little ahead on the
// line, lands with Shift held so the landing keeps his speed, and jumps at each edge. Where a
// plain jump would not land him back on the line, the approach is run again from a moment before
// it with Shift held (a slide, its boost carried into the jump); where neither lands, the run ends
// there. What is kept is where he was every `GHOST.every` seconds and how fast he went, and each
// jump, for the editor's J and the plan page to draw as spheres. Runs in Node too.
import { Vector3 } from 'three'
import { Player, siteOf, STEP } from './sim.mjs'

export const GHOST = {
  ahead: 6, // metres along the line the runner steers for
  edge: 1, // metres ahead a floor more than `drop` lower is an edge, jumped from
  drop: 1,
  every: 0.1, // seconds between the points kept
  back: 0.6, // seconds before an edge a Shift approach is run again from
  wide: 10, // metres off the line a landing may be and still count as back on it
  seconds: 180, // the longest a run is let go
  flight: 5, // the longest a jump is flown before it is given up
  shiftAfter: 0.25, // seconds a landing's slide is held before he runs again
}

// The line as segments with their lengths along it.
function lineOf(points) {
  const segments = []
  let along = 0
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, az] = points[i]
    const [bx, bz] = points[i + 1]
    const length = Math.hypot(bx - ax, bz - az)
    if (length < 1e-6) continue
    segments.push({ ax, az, dx: (bx - ax) / length, dz: (bz - az) / length, length, from: along })
    along += length
  }
  return { segments, length: along }
}

// How far along the line the point nearest (x, z) is, looking only near `near` (so that a line
// that comes back on itself is followed in order), and how far off the line it is.
function placeOn(line, x, z, near) {
  let best = null
  for (const s of line.segments) {
    if (s.from + s.length < near - 40 || s.from > near + 80) continue
    const t = Math.max(0, Math.min(s.length, (x - s.ax) * s.dx + (z - s.az) * s.dz))
    const off = Math.hypot(s.ax + s.dx * t - x, s.az + s.dz * t - z)
    if (!best || off < best.off) best = { along: s.from + t, off }
  }
  return best ?? { along: near, off: Infinity }
}

function pointAt(line, along) {
  const s = line.segments.find((each) => along <= each.from + each.length) ?? line.segments.at(-1)
  const t = Math.min(s.length, Math.max(0, along - s.from))
  return [s.ax + s.dx * t, s.az + s.dz * t]
}

// The runner's controls for a step: toward a point `GHOST.ahead` on along the line.
function steer(line, pos, along) {
  const [tx, tz] = pointAt(line, Math.min(line.length, along + GHOST.ahead))
  return Math.atan2(tx - pos.x, tz - pos.z)
}

const flat = (vel) => Math.hypot(vel.x, vel.z)

/**
 * The ghost run of `route` (`[x, z]` points, at least two) in `place`. Begins on the top under the
 * first point, going the `speed` of a checkpoint within 10 m of it (`checkpoints`), or standing.
 * Returns `{ points, jumps, end }`: `points` `{ x, y, z, speed }` every `GHOST.every` s; `jumps`
 * `{ x, y, z, shift }` where he jumped, `shift` when only a Shift approach landed it; `end`
 * `{ x, y, z, done, why, along, time }`, where the run ended and why ('done', 'fell', 'stuck',
 * 'missed': no jump landed), how far along the line and after how long; `length` the line's.
 * `startY`: the height the floor under the first point is looked for from, for a start under a
 * roof (the builders' route check begins on the balcony, under its own).
 */
export function ghostRun(place, route, site = siteOf(place), { startY = 1000 } = {}) {
  const line = lineOf(route)
  const result = { points: [], jumps: [], end: null, length: line.length }
  if (line.segments.length === 0) return result
  const [sx, sz] = route[0]
  const sy = site.floorAt(sx, startY, sz)
  const first = line.segments[0]
  const startPoint = (place.checkpoints ?? []).find((point) => Math.hypot(point.x - sx, point.z - sz) < 10)
  const speed = startPoint?.speed ?? 0
  const lost = place.abyss?.lost ?? -Infinity

  // One leg of the run: from `state`, run on until an edge is met (returns at it, not jumped), the
  // line's end, a fall, or time. With `shift`, Shift is held on the ground too (a slide).
  const leg = (state, { shift = false, jumpAtEdge = false } = {}) => {
    const player = new Player(site, { pos: new Vector3(state.x, state.y, state.z), yaw: state.yaw })
    player.body.vel.set(state.vx, 0, state.vz) // set after: a new runner is reset standing (`foot.reset`)
    let { along, time, kept } = state
    let sinceLanding = Infinity
    let jumpedAt = null
    let pressed = 0
    let still = 0
    const points = []
    const trail = [] // where he was on foot, every `every`, to begin a Shift approach again from
    const ended = (how, yaw) => ({ at: snapshot(player, yaw, along, time, kept), points, trail, ...how })
    for (;;) {
      const { pos, vel } = player.body
      along = Math.max(along, placeOn(line, pos.x, pos.z, along).along)
      const yaw = steer(line, pos, along)
      const afoot = player.state === 'running' && player.runner.mode !== 'air'
      if (afoot && jumpedAt === null && time > state.time) {
        const ahead = site.floorAt(pos.x + Math.sin(yaw) * GHOST.edge, pos.y + 0.5, pos.z + Math.cos(yaw) * GHOST.edge)
        if (ahead < pos.y - GHOST.drop) {
          if (!jumpAtEdge) return ended({ edge: true }, yaw)
          pressed = 2
        }
      }
      const air = !afoot
      const crouch = (air && jumpedAt !== null) || shift || sinceLanding < GHOST.shiftAfter // lands with Shift held, and slides a moment
      const before = player.log.length
      player.step({ yaw, pitch: 0, moveX: 0, moveZ: 1, jump: pressed > 0, crouch })
      if (pressed > 0) pressed--
      let landed = false
      for (const event of player.log.slice(before)) {
        if (event.kind === 'jumped' && jumpedAt === null) jumpedAt = time
        if (event.kind === 'fell' && jumpAtEdge && jumpedAt === null) pressed = 2 // run off the edge: pressed within the jump's grace
        if (event.kind === 'landed' || event.kind === 'touched') {
          sinceLanding = 0
          landed = true
        }
      }
      sinceLanding += STEP
      time += STEP
      if (time >= kept + GHOST.every) {
        kept = time
        points.push({ x: round(pos.x), y: round(pos.y), z: round(pos.z), speed: round(flat(vel)) })
        if (afoot) trail.push(snapshot(player, yaw, along, time, kept))
      }
      still = flat(vel) < 1 ? still + STEP : 0
      if (pos.y < lost) return ended({ fell: true }, yaw)
      if (along >= line.length - 1) return ended({ done: true }, yaw)
      if (jumpedAt !== null && landed) return ended({ landed: true, onLine: placeOn(line, pos.x, pos.z, along).off <= GHOST.wide }, yaw)
      if ((jumpedAt !== null && time - jumpedAt > GHOST.flight) || still > 2 || time > GHOST.seconds) return ended({ stuck: true }, yaw)
    }
  }

  let state = { x: sx, y: sy, z: sz, vx: first.dx * speed, vz: first.dz * speed, yaw: Math.atan2(first.dx, first.dz), along: 0, time: 0, kept: -GHOST.every }
  let trail = []
  while (state.time < GHOST.seconds) {
    const run = leg(state)
    result.points.push(...run.points)
    trail.push(...run.trail)
    if (run.done || run.fell || run.stuck) {
      result.end = { x: run.at.x, y: run.at.y, z: run.at.z, done: !!run.done, why: run.done ? 'done' : run.fell ? 'fell' : 'stuck', along: run.at.along, time: run.at.time }
      return result
    }
    // At an edge: a plain jump first, then the approach again with Shift, from a moment before.
    const plain = leg(run.at, { jumpAtEdge: true })
    if (plain.landed && plain.onLine) {
      result.jumps.push({ x: run.at.x, y: run.at.y, z: run.at.z, shift: false })
      result.points.push(...plain.points)
      state = plain.at
      trail = []
      continue
    }
    const from = trail.find((each) => each.time >= run.at.time - GHOST.back) ?? run.at
    const approach = leg(from, { shift: true, jumpAtEdge: true })
    if (approach.landed && approach.onLine) {
      // The points from where the approach began are its own: those kept after it are dropped.
      result.points = result.points.filter((p, i) => i < result.points.length - Math.round((run.at.time - from.time) / GHOST.every))
      result.jumps.push({ x: run.at.x, y: run.at.y, z: run.at.z, shift: true })
      result.points.push(...approach.points)
      state = approach.at
      trail = []
      continue
    }
    // Neither: the plain try is shown as it fell, and the run ends where it went wrong.
    result.points.push(...plain.points)
    result.jumps.push({ x: run.at.x, y: run.at.y, z: run.at.z, shift: false })
    result.end = { x: plain.at.x, y: plain.at.y, z: plain.at.z, done: false, why: 'missed', along: run.at.along, time: plain.at.time }
    return result
  }
  result.end = { x: state.x, y: state.y, z: state.z, done: false, why: 'stuck', along: state.along, time: state.time }
  return result
}

function snapshot(player, yaw, along, time, kept) {
  const { pos, vel } = player.body
  return { x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vz: vel.z, yaw, along, time, kept }
}

const round = (v) => Math.round(v * 100) / 100

/** What a ghost run came to, in a few words for a panel. */
export function ghostSaid({ points, jumps, end, length }) {
  if (!end) return 'No route to run.'
  const top = Math.max(0, ...points.map((p) => p.speed))
  const shifted = jumps.filter((jump) => jump.shift).length
  const how = {
    done: `Ran it all, ${Math.round(length)} m in ${end.time.toFixed(1)} s.`,
    fell: `Fell after ${Math.round(end.along)} of ${Math.round(length)} m (red cross).`,
    stuck: `Stopped after ${Math.round(end.along)} of ${Math.round(length)} m: something in the way (red cross).`,
    missed: `No jump landed after ${Math.round(end.along)} of ${Math.round(length)} m, not even with Shift (red cross).`,
  }[end.why]
  return `${how}
${jumps.length} jumps, ${shifted} only with Shift (magenta rings) · top speed ${Math.round(top)} m/s
Spheres: blue standing · teal 20 · yellow 30 · orange 40+ m/s`
}

/** The colour of a speed, m/s: blue standing, through teal at a run (20), yellow (30), to orange from 40. */
export function speedColor(speed) {
  const stops = [
    [0, [90, 140, 255]],
    [20, [60, 200, 170]],
    [30, [240, 210, 60]],
    [40, [255, 130, 40]],
  ]
  const i = stops.findIndex(([at]) => speed < at)
  if (i === 0) return stops[0][1]
  if (i === -1) return stops.at(-1)[1]
  const [a, ca] = stops[i - 1]
  const [b, cb] = stops[i]
  const t = (speed - a) / (b - a)
  return ca.map((c, k) => Math.round(c + (cb[k] - c) * t))
}
