// What the runner and the suit can do, measured in Node over the game's own `parkour.js` and
// `wingsuit.js` (`sim.mjs`), before a place is sized: how far a jump carries at each speed and
// drop, what a slope gives, how long a wall lasts and how wide a canyon a wall jump crosses, how
// high a ledge is reached, the wing's glide and turn, what a blast's throw and lift come to,
// and a fan's climb. Then the owner's own runs on the gauge (`scripts/gauge/measure.mjs`) set
// the margins: the simulation is a perfect player, and a place is sized for a person.
//
//   node scripts/moves/measure.mjs          prints the table, writes scripts/moves/moves.json
//
// Every controller here is a simple held input: a player does better with a mouse.

import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { Vector3 } from 'three'
import { Player, siteOf, STEP } from './sim.mjs'
import { TUNING as RUN } from '../../src/parkour.js'
import { TUNING as WING } from '../../src/wingsuit.js'

const OUT = new URL('./moves.json', import.meta.url)
const HIGH = 2000 // metres: where a flight is begun, far over anything

// Margins, from the owner's gauge runs: a gap he made at most 0.8 of the time (`RUN_GAP`), a
// hop at 2 forward for 1 down at the lower quartile (`HOP_RATIO`).
const HARD = 0.85 // of what the perfect player reaches: a jump asked of the owner as difficult
const FAIR = 0.7 // and as a jump that is made without thinking

const round = (x, places = 1) => Math.round(x * 10 ** places) / 10 ** places
const flat = (v) => Math.hypot(v.x, v.z)
const box = (x0, x1, y0, y1, z0, z1, slope) => ({ x0, x1, y0, y1, z0, z1, ...(slope && { slope }) })

function play(player, controls, seconds, until = () => false) {
  for (let t = 0; t < seconds; t += STEP) {
    player.step(controls(player))
    if (player.state === 'crashed' || until(player)) break
  }
  return player
}

// --- On foot ---

function runUp() {
  const p = new Player(siteOf({ boxes: [box(-50, 50, -1, 0, -10, 2000)] }), { pos: new Vector3(0, 0, 0) })
  let at95 = null
  play(p, () => ({ moveZ: 1 }), 5, (q) => {
    if (!at95 && flat(q.body.vel) >= RUN.runSpeed * 0.95) at95 = { seconds: q.time, metres: q.body.pos.z }
    return flat(q.body.vel) >= RUN.runSpeed * 0.999
  })
  return { toRun: { seconds: round(p.time, 2), metres: round(p.body.pos.z) }, to95: { seconds: round(at95.seconds, 2), metres: round(at95.metres) } }
}

// A jump off a deck's edge at `speed`, onto floor `drop` metres lower: where it comes down.
function jump(speed, drop) {
  const top = 500
  const site = siteOf({ abyss: { lost: 0 }, boxes: [box(-60, 60, 0, top, -100, 0), box(-60, 60, 0, top - drop, drop > 0 ? 0.01 : 0, 600)] })
  const p = new Player(site, { pos: new Vector3(0, top, -1.5), vel: new Vector3(0, 0, speed) })
  let jumped = false
  play(
    p,
    (q) => {
      const press = !jumped && q.body.pos.z >= -(speed * STEP + 0.05)
      if (press) jumped = true
      return { moveZ: 1, jump: press }
    },
    6,
    (q) => q.log.some((e) => e.kind === 'landed'),
  )
  const off = p.log.find((e) => e.kind === 'jumped')
  const down = p.log.find((e) => e.kind === 'landed')
  return { speed: round(off.speed), reach: round(down.z - off.z), seconds: round(down.t - off.t, 2) }
}

function jumps() {
  const speeds = [20, 22, 25, 28, 30, 35, 40, 45, 50, 60, 70]
  const drops = [0, 3, 6, 9, 12, 18, 24, 30, 40]
  const reach = speeds.map((v) => drops.map((d) => jump(v, d).reach))
  const level = jump(RUN.runSpeed, 0)
  return { speeds, drops, reach, airtime: level.seconds, rise: round(RUN.jumpSpeed ** 2 / (2 * RUN.gravity), 2) }
}

// Down a slope of `degrees` for `length` metres along the ground, come onto at `speed`,
// sliding (crouch held) or running: the pace at its foot.
function slope(degrees, length, speed, sliding) {
  const top = 500
  const drop = length * Math.tan((degrees * Math.PI) / 180)
  const site = siteOf({ boxes: [box(-60, 60, 0, top, -60, 0), box(-60, 60, 0, top, 0, length, { from: top, to: top - drop }), box(-60, 60, 0, top - drop, length, length + 400)] })
  const p = new Player(site, { pos: new Vector3(0, top, -2), vel: new Vector3(0, 0, speed) })
  play(p, () => ({ moveZ: 1, crouch: sliding }), 20, (q) => q.body.pos.z >= length)
  return round(flat(p.body.vel))
}

function slopes() {
  const degrees = [10, 15, 20, 25, 30, 35]
  const lengths = [40, 80, 120, 200]
  const from = [20, 30]
  return {
    degrees,
    lengths,
    from,
    sliding: from.map((v) => degrees.map((d) => lengths.map((l) => slope(d, l, v, true)))),
    running: from.map((v) => degrees.map((d) => lengths.map((l) => slope(d, l, v, false)))),
  }
}

// One wall on his left beyond a deck's edge, met at `angle` radians off it at `speed`: how long
// and far it carries him and what it costs in height.
function wall(speed, angle) {
  const top = 500
  const site = siteOf({ abyss: { lost: 0 }, boxes: [box(-40, 40, 0, top, -100, 0), box(8, 12, 0, top + 40, -5, 600)] })
  const p = new Player(site, { pos: new Vector3(0, top, -1.5), vel: new Vector3(Math.sin(angle) * speed, 0, Math.cos(angle) * speed), yaw: angle })
  let jumped = false
  let on = null
  let off = null
  play(
    p,
    (q) => {
      const press = !jumped && q.body.pos.z >= -0.5
      if (press) jumped = true
      if (q.mode === 'wall' && !on) on = { z: q.body.pos.z, y: q.body.pos.y, t: q.time, speed: flat(q.body.vel) }
      if (on && !off && q.mode !== 'wall') off = { z: q.body.pos.z, y: q.body.pos.y, t: q.time, speed: flat(q.body.vel) }
      return { moveZ: 1, jump: press, yaw: q.mode === 'wall' || on ? 0 : angle }
    },
    5,
    () => off,
  )
  if (!on) return null
  return { speed, angle, seconds: round(off.t - on.t, 2), along: round(off.z - on.z), height: round(off.y - on.y, 2), leaving: round(off.speed) }
}

// Two walls `width` apart with a deck between them, the first met at `open` radians off it:
// wall to wall, jumping off each after `after` seconds and looking `turn` radians toward the
// next, for six walls at most. Each wall adds `wallBoost` and each push off `wallJumpAlong`, so
// a canyon is a way to make speed, and a narrow one a way up.
function canyon(width, speed, open, turn, after) {
  const top = 500
  const half = width / 2
  const site = siteOf({ abyss: { lost: 0 }, boxes: [box(-half, half, 0, top, -100, 0), box(half, half + 4, 0, top + 60, -5, 3000), box(-half - 4, -half, 0, top + 60, -5, 3000)] })
  const p = new Player(site, { pos: new Vector3(0, top, -1.5), vel: new Vector3(Math.sin(open) * speed, 0, Math.cos(open) * speed), yaw: open })
  let jumped = false
  let yaw = open
  const walls = []
  let leap = 0
  play(
    p,
    (q) => {
      let press = false
      if (!jumped && q.body.pos.z >= -0.5) press = jumped = true
      if (q.mode === 'wall') {
        const side = q.runner._wallNormal.x < 0 ? 1 : -1 // +1: the wall is on +X, his left
        if (!walls.length || walls.at(-1).side !== side) walls.push({ side, z: q.body.pos.z, y: q.body.pos.y, speed: flat(q.body.vel), t: q.time })
        yaw = 0
        if (q.runner._wallFor >= after && !leap) {
          press = true
          leap = 1
          yaw = -side * turn
        }
      } else leap = 0
      return { moveZ: 1, jump: press, yaw }
    },
    30,
    (q) => q.body.pos.y < top - 80 || walls.length >= 6,
  )
  const legs = walls.slice(1).map((w, i) => ({ along: w.z - walls[i].z, height: w.y - walls[i].y, gained: w.speed - walls[i].speed, seconds: w.t - walls[i].t }))
  const mean = (key, places = 1) => (legs.length ? round(legs.reduce((s, l) => s + l[key], 0) / legs.length, places) : 0)
  return { walls: walls.length, along: mean('along'), height: mean('height', 2), gained: mean('gained'), seconds: mean('seconds', 2) }
}

function walls() {
  const single = []
  for (const speed of [20, 25, 30, 40]) for (const angle of [0.25, 0.4, 0.6]) single.push(wall(speed, angle))
  const canyons = []
  for (const width of [8, 12, 16, 20, 25, 30, 40]) {
    for (const speed of [22, 28, 35]) {
      let best = null
      for (const open of [0.35, 0.6, 0.85]) {
        for (const turn of [0.3, 0.5, 0.75, 1.0]) {
          for (const after of [0.2, 0.6, 1.0, 1.5]) {
            const run = canyon(width, speed, open, turn, after)
            const score = run.walls * 100 + run.height
            if (!best || score > best.score) best = { score, open, turn, after, ...run }
          }
        }
      }
      delete best.score
      canyons.push({ width, entry: speed, ...best })
    }
  }
  return { seconds: RUN.wallSeconds, single: single.filter(Boolean), canyons }
}

// A block `height` tall ahead of a run at 20 m/s, jumped at from `from` metres short of it: is
// he on top? The tallest made over every take-off.
function ledges() {
  const tallest = {}
  for (const speed of [8, 20]) {
    let best = 0
    for (const height of [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]) {
      for (let from = 0.5; from < 16; from += 0.25) {
        const site = siteOf({ boxes: [box(-40, 40, -1, 0, -100, 200), box(-40, 40, 0, height, 30, 80)] })
        const p = new Player(site, { pos: new Vector3(0, 0, 0), vel: new Vector3(0, 0, speed) })
        let jumped = false
        play(p, (q) => {
          const press = !jumped && q.body.pos.z >= 30 - from
          if (press) jumped = true
          return { moveZ: 1, jump: press }
        }, 4)
        if (p.body.pos.y >= height - 0.01 && p.body.pos.z > 30) {
          best = Math.max(best, height)
          break
        }
      }
    }
    tallest[speed] = best
  }
  return { reach: RUN.mantleReach, tallestAtWalk: tallest[8], tallestAtRun: tallest[20] }
}

// A wall 40 m tall met head on in a jump, from standing at its foot and from a run: the height
// his feet have reached by the end of each climb up it, a jump off it at the top of each rise
// and forward held bringing him back in to climb it again.
function scales(climbs = 4) {
  const rows = []
  for (const speed of [0, 20]) {
    const from = speed > 0 ? 0 : 29.4
    const site = siteOf({ boxes: [box(-40, 40, -1, 0, -100, 200), box(-40, 40, 0, 40, 30, 80)] })
    const p = new Player(site, { pos: new Vector3(0, 0, from), vel: new Vector3(0, 0, speed) })
    const tops = []
    let jumped = false
    play(p, (q) => {
      let press = !jumped && q.time > 0.02 && q.body.pos.z >= 30 - Math.max(1, speed * 0.075) // a press on the first step is not one: he begins with jump down
      if (press) jumped = true
      if (q.mode === 'scale' && q.body.vel.y <= 0) {
        tops.push(round(q.body.pos.y, 2))
        press = true
      }
      return { moveZ: 1, jump: press }
    }, 8, () => tops.length >= climbs)
    rows.push({ speed, tops })
  }
  return { rise: round(RUN.scaleUp ** 2 / (2 * RUN.scaleGravity), 2), rows }
}

// --- In the suit ---

function flyer(speed, { vy = 0 } = {}) {
  const site = siteOf({ abyss: { lost: -1e9 } })
  const p = new Player(site, { pos: new Vector3(0, HIGH, 0), vel: new Vector3(0, vy, speed) })
  p._openWings()
  return p
}

// Held at `pitch` (the look's, over the horizon) from `speed`: where the glide settles.
function settled(pitch, speed = 45) {
  const p = flyer(speed)
  play(p, () => ({ jump: true, pitch }), 40)
  const at = p.body.pos.clone()
  const was = p.time
  play(p, () => ({ jump: true, pitch }), 10)
  const run = Math.hypot(p.body.pos.x - at.x, p.body.pos.z - at.z)
  const sink = at.y - p.body.pos.y
  return { pitch, speed: round(p.speed), sink: round(sink / (p.time - was)), ratio: round(run / Math.max(sink, 1e-3), 2), stalled: p.suit.stalled }
}

function polar() {
  const rows = []
  for (let pitch = -0.6; pitch <= 0.21; pitch += 0.05) rows.push(settled(round(pitch, 2)))
  return rows
}

// Opened at `speed` level, `drop` metres to spend: the farthest held pitch, and where it gets.
function reach(speed, drop) {
  let best = null
  for (let pitch = -0.5; pitch <= 0.2; pitch += 0.04) {
    const p = flyer(speed)
    play(p, () => ({ jump: true, pitch }), 120, (q) => q.body.pos.y <= HIGH - drop)
    const distance = Math.hypot(p.body.pos.x, p.body.pos.z)
    if (!best || distance > best.distance) best = { pitch: round(pitch, 2), distance: round(distance), seconds: round(p.time, 1), speed: round(p.speed) }
  }
  return best
}

function reaches() {
  const speeds = [20, 27, 30, 35, 40, 45, 50, 60]
  const drops = [20, 40, 80, 150, 300, 600]
  const table = speeds.map((v) => drops.map((d) => reach(v, d)))
  return { speeds, drops, distance: table.map((row) => row.map((r) => r.distance)), seconds: table.map((row) => row.map((r) => r.seconds)), pitch: table.map((row) => row.map((r) => r.pitch)), arrives: table.map((row) => row.map((r) => r.speed)) }
}

// A turn held `off` radians of the view to one side of the path, from a glide at `speed`: how
// fast the heading comes round, the radius, and what it costs.
function turn(speed, off, pitch = -0.12) {
  const p = flyer(speed)
  const heading = () => Math.atan2(p.body.vel.x, p.body.vel.z)
  play(p, () => ({ jump: true, pitch, yaw: heading() + off }), 3)
  const h0 = heading()
  const t0 = p.time
  const v0 = p.speed
  const y0 = p.body.pos.y
  let turned = 0
  let last = h0
  play(p, () => ({ jump: true, pitch, yaw: heading() + off }), 3, () => {
    let d = heading() - last
    if (d > Math.PI) d -= 2 * Math.PI
    if (d < -Math.PI) d += 2 * Math.PI
    turned += d
    last = heading()
    return false
  })
  const seconds = p.time - t0
  const rate = turned / seconds
  return { speed, off, rate: round(rate, 3), radius: round(Math.abs(((v0 + p.speed) / 2) / rate)), slowing: round((v0 - p.speed) / seconds, 1), sink: round((y0 - p.body.pos.y) / seconds, 1) }
}

function turns() {
  const rows = []
  for (const speed of [30, 40, 50, 60]) for (const off of [0.15, 0.3, 0.45]) rows.push(turn(speed, off))
  return rows
}

// Dived at -0.7 for `seconds` from a glide at `speed`, then flared: the view held `pull`
// radians over the path, just short of a stall (`stallAngle` 0.5). The height spent, the speed
// it bought, and what the flare gives back before it sinks again.
function swoop(speed, seconds, pull = 0.45) {
  const p = flyer(speed)
  play(p, () => ({ jump: true, pitch: -0.7 }), seconds)
  const fastest = p.speed
  let low = p.body.pos.y
  let top = -Infinity
  let climbed = false
  const flare = (q) => ({ jump: true, pitch: Math.min(1.4, Math.atan2(q.body.vel.y, flat(q.body.vel)) + pull) })
  play(p, flare, 12, (q) => {
    low = Math.min(low, q.body.pos.y)
    if (q.body.vel.y > 0) climbed = true
    if (climbed) top = Math.max(top, q.body.pos.y)
    return climbed && q.body.vel.y < 0
  })
  return { speed, seconds, spent: round(HIGH - low), fastest: round(fastest), regained: climbed ? round(top - low) : 0, leaving: round(p.speed), stalled: p.suit.stalled }
}

// --- Thrown ---

// A barrel's blast under a runner going `speed`: thrown `up` and `push`, the suit opened
// `after` seconds on, then the best held glide. Its top, what the suit opened with, and how
// far it carries over drops of 100 and 300 m.
function throwOf(up, push, speed = 25, after = 0.35) {
  const results = {}
  for (const drop of [0, 100, 300]) {
    let best = null
    for (let pitch = -0.4; pitch <= 0.15; pitch += 0.05) {
      const site = siteOf({ abyss: { lost: -1e9 }, boxes: [box(-40, 40, 0, HIGH, -100, 0)] })
      const p = new Player(site, { pos: new Vector3(0, HIGH, -1), vel: new Vector3(0, 0, speed) })
      p.thrown({ up, push })
      let apex = HIGH
      let opened = null
      play(p, (q) => {
        apex = Math.max(apex, q.body.pos.y)
        if (q.state === 'flying' && !opened) opened = q.speed
        return { moveZ: 1, jump: q.time >= after, pitch: q.state === 'flying' ? pitch : 0 }
      }, 120, (q) => q.time > 1 && q.body.pos.y <= HIGH - drop)
      const distance = p.body.pos.z
      if (!best || distance > best.distance) best = { distance: round(distance), apex: round(apex - HIGH), opened: round(opened ?? 0), seconds: round(p.time, 1) }
    }
    results[drop] = best
  }
  return { up, push, speed, apex: results[0].apex, opened: results[0].opened, over100: results[100].distance, over300: results[300].distance }
}

function throws() {
  const rows = []
  for (const up of [15, 20, 25, 30, 35]) for (const push of [10, 15, 20, 25]) rows.push(throwOf(up, push))
  return rows
}

// A blast under the suit (`flight.lift`) in a glide at 40 m/s: the height it is worth, and
// the distance it adds over a 200 m drop.
function lifts() {
  const rows = []
  const base = reachAfter(null)
  for (const up of [15, 25, 35]) for (const push of [5, 10, 15]) {
    const r = reachAfter({ up, push })
    rows.push({ up, push, top: r.top, more: round(r.distance - base.distance) })
  }
  return rows
}

function reachAfter(blast, speed = 40, drop = 200, pitch = -0.1) {
  const p = flyer(speed)
  play(p, () => ({ jump: true, pitch }), 2)
  if (blast) p.thrown(blast)
  const from = p.body.pos.y
  let top = from
  play(p, () => ({ jump: true, pitch }), 60, (q) => {
    top = Math.max(top, q.body.pos.y)
    return q.body.pos.y <= HIGH - drop
  })
  return { distance: Math.hypot(p.body.pos.x, p.body.pos.z), top: round(top - from) }
}

// A canyon met in the suit: walls `width` apart, flown into at `speed` heading `open` radians
// toward the left one, the suit folded `foldAt` metres short of it (after a flare of `flare`
// seconds, the view held just short of a stall, to stop the sink, or none). Then wall to wall,
// off each after `after` seconds and turned `turn` toward the next, and after `walls` of them a
// press in the air opens the suit again. Whether the first wall is taken (`wallFalling` caps the
// sink it may be met with), the speed each wall is left at, and what the suit opens with.
function foldIn(width, speed, { open = 0.25, foldAt = 3, flare = 0, after = 0.5, turn = 0.5, walls = 3 } = {}) {
  const half = width / 2
  const site = siteOf({ abyss: { lost: -1e9 }, boxes: [box(half, half + 4, 0, HIGH + 60, 100, 3000), box(-half - 4, -half, 0, HIGH + 60, 100, 3000)] })
  // Begun 100 m short of the canyon's mouth, on a line that enters it near the right wall and
  // meets the left one across it.
  const x0 = -0.6 * half - Math.tan(open) * 100
  const p = new Player(site, { pos: new Vector3(x0, HIGH, 0), vel: new Vector3(Math.sin(open) * speed, 0, Math.cos(open) * speed), yaw: open })
  p._openWings()
  let phase = 'gliding'
  let flareLeft = flare
  let leap = 0
  let yaw = open
  let reopened = null
  const taken = []
  play(
    p,
    (q) => {
      if (phase === 'gliding') {
        const toWall = half - q.body.pos.x
        if (q.body.pos.z > 100 && toWall < foldAt + Math.sin(open) * speed * flare) {
          if (flareLeft > 0) {
            flareLeft -= STEP
            return { jump: true, yaw: open, pitch: Math.atan2(q.body.vel.y, flat(q.body.vel)) + 0.45 }
          }
          phase = 'folded'
          return { jump: false, yaw: open, moveZ: 1 }
        }
        return { jump: true, yaw: open, pitch: -0.1 }
      }
      if (phase === 'open') return { jump: true, yaw, pitch: -0.1 }
      let press = false
      if (q.mode === 'wall') {
        const side = q.runner._wallNormal.x < 0 ? 1 : -1
        if (!taken.length || taken.at(-1).side !== side) taken.push({ side, speed: round(flat(q.body.vel)), vy: round(q.body.vel.y) })
        yaw = 0
        if (q.runner._wallFor >= after && !leap) {
          press = true
          leap = 1
          yaw = -side * turn
        }
      } else {
        leap = 0
        // Off the last wall and clear of it: the press that opens the suit.
        if (taken.length >= walls && Math.abs(q.body.pos.x) < half - 4) {
          phase = 'open'
          press = true
        }
      }
      if (phase === 'open' && q.state === 'running') return { moveZ: 1, jump: true, yaw }
      return { moveZ: 1, jump: press, yaw }
    },
    20,
    (q) => {
      if (q.state === 'flying' && phase === 'open' && !reopened) reopened = { speed: round(q.speed), lost: round(HIGH - q.body.pos.y) }
      return reopened || q.body.pos.y < HIGH - 150
    },
  )
  return { width, speed, flare, caught: taken.length > 0, walls: taken.length, taken, reopened }
}

function foldIns() {
  const rows = []
  for (const width of [20, 25]) {
    for (const speed of [35, 45, 55]) {
      for (const flare of [0, 0.4, 0.8]) {
        let best = null
        for (const open of [0.15, 0.25, 0.35]) {
          for (const foldAt of [1.5, 3, 5]) {
            const r = foldIn(width, speed, { open, foldAt, flare })
            const score = r.walls * 100 + (r.reopened ? 50 + r.reopened.speed : 0)
            if (!best || score > best.score) best = { score, open, foldAt, ...r }
          }
        }
        delete best.score
        rows.push(best)
      }
    }
  }
  return rows
}

// Into a fan's column (`fans`) at 40 m/s, a level look: the climb it gives.
function fan(up = 60) {
  const site = siteOf({ abyss: { lost: -1e9 }, fans: [{ x: 0, z: 300, radius: 40, hole: 0, y0: 0, y1: HIGH + 600, up }] })
  const p = new Player(site, { pos: new Vector3(0, HIGH, 0), vel: new Vector3(0, 0, 40) })
  p._openWings()
  let entered = null
  const rows = []
  play(p, (q) => {
    const inside = Math.hypot(q.body.pos.x, q.body.pos.z - 300) < 40
    if (inside && !entered) entered = { t: q.time, y: q.body.pos.y }
    // Round and round the column, as a rider does: the view kept on its axis's far side.
    const yaw = Math.atan2(0 - q.body.pos.x, 300 - q.body.pos.z) + (inside ? 1.2 : 0)
    return { jump: true, pitch: 0, yaw }
  }, 30, (q) => {
    if (entered && rows.length < 6 && q.time - entered.t >= (rows.length + 1) * 2) rows.push({ seconds: (rows.length + 1) * 2, climb: round(q.body.pos.y - entered.y), speed: round(q.speed) })
    return rows.length >= 6
  })
  return { up, rows }
}

// --- The owner's own numbers, from the gauge ---

function gauge() {
  try {
    const text = execFileSync('node', ['scripts/gauge/measure.mjs'], { encoding: 'utf8', cwd: new URL('../../', import.meta.url).pathname })
    const number = (name) => Number(text.match(new RegExp(`${name}\\s*=\\s*([\\d.]+)`))?.[1])
    return { RUN_GAP: number('RUN_GAP'), HOP_RATIO: number('HOP_RATIO'), FAN_REACH: number('FAN_REACH') }
  } catch {
    return null
  }
}

// --- The table ---

// `--only=<name>`: one measure of the table printed, nothing written (for trying one out).
const only = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length)
if (only) {
  const measures = { foldIns, jumps, slopes, walls, reaches, turns, throws, lifts }
  console.log(JSON.stringify(measures[only](), null, 1))
  process.exit(0)
}

const started = Date.now()
const moves = {
  measured: new Date().toISOString().slice(0, 10),
  margins: { hard: HARD, fair: FAIR },
  tuning: { run: { ...RUN, topSpeed: null }, wing: WING },
  run: runUp(),
  jumps: jumps(),
  slopes: slopes(),
  walls: walls(),
  ledges: ledges(),
  scales: scales(),
  polar: polar(),
  reach: reaches(),
  turns: turns(),
  swoops: [swoop(40, 2), swoop(40, 4), swoop(50, 2), swoop(50, 4)],
  throws: throws(),
  lifts: lifts(),
  fan: fan(),
  foldIns: foldIns(),
  gauge: gauge(),
}
writeFileSync(OUT, JSON.stringify(moves, null, 1) + '\n')

const pad = (s, n = 7) => String(s).padStart(n)
const line = (cells, n) => cells.map((c) => pad(c, n)).join('')
const { jumps: J, slopes: S, reach: R } = moves

console.log(`MOVES, measured ${moves.measured} over parkour.js and wingsuit.js (${round((Date.now() - started) / 1000)} s)\n`)
console.log(`RUN-UP  to 95%: ${moves.run.to95.seconds} s, ${moves.run.to95.metres} m; to ${RUN.runSpeed} m/s: ${moves.run.toRun.seconds} s, ${moves.run.toRun.metres} m`)
console.log(`\nJUMP REACH  (metres in plan from take-off to touch; a level jump rises ${J.rise} m and is ${J.airtime} s in the air)`)
console.log(line(['m/s', ...J.drops.map((d) => `↓${d}`)], 7))
J.speeds.forEach((v, i) => console.log(line([v, ...J.reach[i]], 7)))
console.log(`\nSLOPES  (pace at the foot, m/s; rows degrees, columns metres along)`)
for (const [k, mode] of [['sliding', 'SLIDING'], ['running', 'RUNNING']]) {
  S.from.forEach((v, i) => {
    console.log(`  ${mode} from ${v} m/s`)
    console.log(line(['deg', ...S.lengths], 7))
    S.degrees.forEach((d, j) => console.log(line([d, ...S[k][i][j]], 7)))
  })
}
console.log(`\nA WALL  (${moves.walls.seconds} s at most)`)
console.log(line(['m/s', 'rad', 's', 'along', 'Δy', 'leaves'], 8))
for (const w of moves.walls.single) console.log(line([w.speed, w.angle, w.seconds, w.along, w.height, w.leaving], 8))
console.log(`\nCANYONS  (walls taken one after another; along and Δy per wall, the best turn and timing found)`)
console.log(line(['width', 'm/s', 'walls', 'along', 'Δy', '+m/s', 's', 'open', 'turn', 'after'], 7))
for (const c of moves.walls.canyons) console.log(line([c.width, c.entry, c.walls, c.along, c.height, c.gained, c.seconds, c.open, c.turn, c.after], 7))
console.log(`\nLEDGES  reach ${moves.ledges.reach} m; tallest block got onto with a jump: ${moves.ledges.tallestAtWalk} m at a walk, ${moves.ledges.tallestAtRun} m at a run`)
console.log(`\nUP A WALL  (a climb rises ${moves.scales.rise} m; his feet at the top of each climb, a jump off and back in between)`)
for (const r of moves.scales.rows) console.log(`  from ${r.speed} m/s: ${r.tops.join(', ')} m`)
console.log(`\nTHE WING HELD AT A PITCH  (settled after 40 s from 45 m/s)`)
console.log(line(['pitch', 'm/s', 'sink', 'ratio', 'stall'], 8))
for (const r of moves.polar) console.log(line([r.pitch, r.speed, r.sink, r.ratio, r.stalled ? 'yes' : ''], 8))
console.log(`\nGLIDE REACH  (metres over each drop, opened level at each speed, the best held pitch)`)
console.log(line(['m/s', ...R.drops.map((d) => `↓${d}`)], 8))
R.speeds.forEach((v, i) => console.log(line([v, ...R.distance[i]], 8)))
console.log(`  seconds:`)
R.speeds.forEach((v, i) => console.log(line([v, ...R.seconds[i]], 8)))
console.log(`\nTURNS  (view held off the path)`)
console.log(line(['m/s', 'off', 'rad/s', 'radius', 'slows', 'sink'], 8))
for (const t of moves.turns) console.log(line([t.speed, t.off, t.rate, t.radius, t.slowing, t.sink], 8))
console.log(`\nSWOOPS  (dive at -0.7, then a flare held just short of a stall)`)
console.log(line(['m/s', 'dive s', 'spent', 'fastest', 'regained', 'leaves'], 9))
for (const s of moves.swoops) console.log(line([s.speed, s.seconds, s.spent, s.fastest, s.regained, s.leaving], 9))
console.log(`\nBLAST THROWS  (a runner at 25 m/s, the suit opened 0.35 s on)`)
console.log(line(['up', 'push', 'apex', 'opened', '↓100', '↓300'], 8))
for (const t of moves.throws) console.log(line([t.up, t.push, t.apex, t.opened, t.over100, t.over300], 8))
console.log(`\nBLAST LIFTS  (under the suit at 40 m/s; metres it rises, metres more over a 200 m drop)`)
console.log(line(['up', 'push', 'rise', 'more'], 8))
for (const l of moves.lifts) console.log(line([l.up, l.push, l.top, l.more], 8))
console.log(`\nA FAN  (${moves.fan.up} m/s², ridden round at a level look)`)
for (const r of moves.fan.rows) console.log(`  ${r.seconds} s: +${r.climb} m at ${r.speed} m/s`)
console.log(`\nA CANYON IN THE SUIT  (folded short of the first wall, wall to wall, the suit opened again after three)`)
console.log(line(['width', 'm/s', 'flare', 'walls', 'left at', 'opens', 'lost'], 8))
for (const f of moves.foldIns) console.log(line([f.width, f.speed, f.flare, f.walls, f.taken.at(-1)?.speed ?? '—', f.reopened?.speed ?? '—', f.reopened?.lost ?? '—'], 8))
console.log(`\nTHE OWNER'S GAUGE  ${moves.gauge ? `RUN_GAP ${moves.gauge.RUN_GAP} m, HOP_RATIO ${moves.gauge.HOP_RATIO}, FAN_REACH ${moves.gauge.FAN_REACH} m` : 'unread'}`)
console.log(`\nwritten ${OUT.pathname}`)
