// A player in Node: the runner (`src/parkour.js`) and the suit (`src/wingsuit.js`) stepped as
// `Game` steps them in a parkour place, over a place's boxes, forms and assets met as
// `ParkourWorld` meets them. For measuring the moves (`measure.mjs`) and for running a place's
// par line (`par.mjs`) a thousand times faster than a browser can. It is a copy of `Game`'s glue
// (`_run`, `_fly`, `_openWings`, `_closeWings`, `_touchDown`, `_graze`, `_flewInto`), not the game: what it
// says is checked on the stage page with the real runner (`itch/runner.js`) before it is trusted.

import { Vector3 } from 'three'
import { FaceGrid } from '../../src/faces.js'
import { buildForm } from '../../src/forms.js'
import { cutForm, cuttersFor } from '../../src/form-cut.js'
import { buildAsset } from '../../src/assets.js'
import * as foot from '../../src/parkour.js'
import * as wingsuit from '../../src/wingsuit.js'
import * as flight from '../../src/flight.js'

export const STEP = 1 / 120 // `main.js`'s fixed step

const _cameFrom = new Vector3()

// `game.js`'s, as they stood on 2026-10-17.
const WINGS_CLEARANCE = 4
const WINGS_LIFT = 1
const MAX_STEP_TRAVEL = 3
const CRASH_CLEARANCE = 0.9
const TOUCH_REACH = 2.5
const TOUCH_RISING = 3
const GRAZE_CLEAR = 0.5
const SURROUNDINGS_INTERVAL = 0.1
// `parkour-world.js`'s.
const UNDERFOOT = 0.6
const FLYER_RADIUS = 0.35
const ABYSS_FLOOR = -10000
const FAN_FADE = 60
const FAN_DIVE = { from: -0.15, gone: -0.5 }

const smoothstep = (x, a, b) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function topAt(solid, z) {
  if (!solid.slope) return solid.top
  const along = Math.min(1, Math.max(0, (z - (solid.z - solid.halfDepth)) / (solid.halfDepth * 2)))
  return solid.slope.from + (solid.slope.to - solid.slope.from) * along
}
const over = (solid, x, z) => Math.abs(x - solid.x) < solid.halfWidth && Math.abs(z - solid.z) < solid.halfDepth
const asSolid = ({ x0, x1, y0, y1, z0, z1, slope }) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, halfWidth: (x1 - x0) / 2, halfDepth: (z1 - z0) / 2, bottom: y0, top: y1, slope })
const inColumn = (fan, pos) => {
  const away = Math.hypot(pos.x - fan.x, pos.z - fan.z)
  return away <= fan.radius && away >= (fan.hole ?? 0)
}

const _ground = { y: 0, normal: new Vector3() }
const _probe = new Vector3()

/**
 * What a place's record (`places.js`'s shape: `boxes`, `forms`, `assets`, `pads`, `strips`,
 * `fans`, `abyss`) gives a body to meet, as `ParkourWorld` answers it. `skip(form)` leaves
 * forms out, for a place whose copies are only to be seen.
 */
export function siteOf(place) {
  const boxes = (place.boxes ?? []).map(asSolid)
  const faces = new FaceGrid()
  for (const form of place.forms ?? []) faces.add(cutForm(buildForm(form), cuttersFor(form, place.cuts)).faces)
  for (const instance of place.assets ?? []) for (const form of buildAsset(instance).forms) faces.add(buildForm(form).faces)
  const pads = place.pads ?? []
  const strips = place.strips ?? []
  const fans = place.fans ?? []
  const street = place.abyss ? ABYSS_FLOOR : 0

  const boxAround = (pos, margin) =>
    boxes.find((s) => Math.abs(pos.x - s.x) < s.halfWidth + margin && Math.abs(pos.z - s.z) < s.halfDepth + margin && pos.y > s.bottom - margin && pos.y < topAt(s, pos.z) + margin)

  const site = {
    faces,
    heightAt: () => street,
    floorAt(x, y, z, normal = null) {
      let floor = street
      normal?.set(0, 1, 0)
      for (const s of boxes) {
        if (!over(s, x, z)) continue
        const top = topAt(s, z)
        if (top <= y && top > floor) floor = top
      }
      if (faces.castDown(x, y, z, _ground) && _ground.y > floor) {
        floor = _ground.y
        normal?.copy(_ground.normal)
      }
      return floor
    },
    ceilingAt(x, y, z) {
      let ceiling = faces.castUp(x, y, z)
      for (const s of boxes) {
        if (s.bottom < y || s.bottom >= ceiling) continue
        if (over(s, x, z)) ceiling = s.bottom
      }
      return ceiling
    },
    wallAt(feet, low, high, radius, normal) {
      let moved = false
      for (const s of boxes) {
        if (s.bottom >= high) continue
        const dx = feet.x - s.x
        const dz = feet.z - s.z
        const toSide = s.halfWidth + radius - Math.abs(dx)
        const toEnd = s.halfDepth + radius - Math.abs(dz)
        if (toSide <= 0 || toEnd <= 0 || topAt(s, feet.z) <= low) continue
        if (toSide <= toEnd) {
          const side = dx < 0 ? -1 : 1
          feet.x = s.x + side * (s.halfWidth + radius)
          normal.set(side, 0, 0)
        } else {
          const end = dz < 0 ? -1 : 1
          feet.z = s.z + end * (s.halfDepth + radius)
          normal.set(0, 0, end)
        }
        moved = true
      }
      return faces.pushOutLevel(feet, low, high, radius, normal) || moved
    },
    gradeAt(feet, out) {
      out.set(0, 0, 0)
      for (const s of boxes) {
        if (!s.slope || !over(s, feet.x, feet.z) || Math.abs(topAt(s, feet.z) - feet.y) > UNDERFOOT) continue
        out.z = (s.slope.to - s.slope.from) / (s.halfDepth * 2)
      }
      if (faces.castDown(feet.x, feet.y + UNDERFOOT, feet.z, _ground) && Math.abs(_ground.y - feet.y) <= UNDERFOOT) {
        out.x = -_ground.normal.x / _ground.normal.y
        out.z = -_ground.normal.z / _ground.normal.y
      }
      return out
    },
    padAt(feet) {
      for (const pad of pads) if (Math.abs(feet.y - pad.y) < UNDERFOOT && Math.hypot(feet.x - pad.x, feet.z - pad.z) < pad.radius) return pad.up
      for (const fan of fans) if (fan.throw && Math.abs(feet.y - fan.floor) < UNDERFOOT && inColumn(fan, feet)) return fan.throw
      return 0
    },
    stripAt(feet) {
      for (const s of strips) if (Math.abs(feet.y - s.y) < UNDERFOOT && feet.x > s.x0 && feet.x < s.x1 && feet.z > s.z0 && feet.z < s.z1) return s.boost
      return 0
    },
    updraftAt(pos, clearance = 0, aim = null) {
      let rising = 0
      for (const fan of fans) {
        if (!inColumn(fan, pos) || pos.y < fan.y0 || pos.y > fan.y1) continue
        rising = Math.max(rising, fan.up * (1 - smoothstep(pos.y, fan.y1 - FAN_FADE, fan.y1)))
      }
      if (aim) rising *= smoothstep(aim.y, FAN_DIVE.gone, FAN_DIVE.from)
      return rising
    },
    hitsSolid(pos, margin = 0) {
      return boxAround(pos, margin) !== undefined || faces.pushOut(_probe.copy(pos), Math.max(margin, FLYER_RADIUS), new Vector3())
    },
    pushOutOfSolids(point, radius, normal) {
      const s = boxAround(point, radius)
      if (s) {
        const dx = point.x - s.x
        const dz = point.z - s.z
        const ways = [
          [topAt(s, point.z) + radius - point.y, 0, 1, 0],
          [point.y - (s.bottom - radius), 0, -1, 0],
          [s.halfWidth + radius - Math.abs(dx), dx < 0 ? -1 : 1, 0, 0],
          [s.halfDepth + radius - Math.abs(dz), 0, 0, dz < 0 ? -1 : 1],
        ]
        const [away, x, y, z] = ways.reduce((nearest, way) => (way[0] < nearest[0] ? way : nearest))
        normal.set(x, y, z)
        point.addScaledVector(normal, away)
        return true
      }
      return faces.pushOut(point, radius, normal)
    },
  }
  return site
}

/** `game.js`'s `aimOf`: the unit vector looked along at `yaw` (0 is +Z, rising toward +X) and `pitch`. */
export function aimOf(yaw, pitch, out = new Vector3()) {
  return out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
}

/**
 * One player on `site`, on his feet at `pos` going `vel`. `step(controls)` takes what a player
 * holds and where he looks, `{ yaw, pitch, moveX, moveZ, jump, crouch }`, for one fixed step.
 * `state` is 'running' or 'flying': nothing he meets kills (`_flewInto`); `mode` the runner's while running; `time` the
 * seconds stepped; `log` what happened, `{ t, kind, x, y, z, speed, vy }`, as the gauge notes it.
 */
export class Player {
  constructor(site, { pos, vel = new Vector3(), yaw = 0 } = {}) {
    this.site = site
    this.body = flight.createBody()
    this.body.pos.copy(pos)
    this.body.vel.copy(vel)
    this.runner = foot.createRunner(this.body)
    foot.reset(this.runner)
    this.body.vel.y = vel.y
    this.suit = wingsuit.createSuit(this.body)
    this.aim = aimOf(yaw, 0)
    this.state = 'running'
    this.time = 0
    this.updraft = 0
    this.log = []
    this._jumpWas = false
    this._sense = 0
    this._floorNormal = new Vector3()
    this._clear = new Vector3()
    this._normal = new Vector3()
  }

  get mode() {
    return this.state === 'running' ? this.runner.mode : this.state
  }

  get speed() {
    return this.body.vel.length()
  }

  note(kind) {
    const { pos, vel } = this.body
    this.log.push({ t: this.time, kind, x: pos.x, y: pos.y, z: pos.z, speed: Math.hypot(vel.x, vel.z), vy: vel.y })
  }

  step(controls, dt = STEP) {
    if (this.state === 'crashed') return
    aimOf(controls.yaw ?? 0, controls.pitch ?? 0, this.aim)
    if (this.state === 'running') this._run(controls, dt)
    else this._fly(controls, dt)
    this.time += dt
  }

  _run(controls, dt) {
    const { body, runner, site } = this
    const jump = !!controls.jump
    const pressed = jump && !this._jumpWas
    this._jumpWas = jump
    const under = body.pos.y - site.floorAt(body.pos.x, body.pos.y, body.pos.z)
    if (pressed && !foot.canJump(runner) && under > WINGS_CLEARANCE) return this._openWings()
    const wasAfoot = runner.mode !== 'air'
    const did = foot.step(runner, { yaw: controls.yaw ?? 0, moveX: controls.moveX ?? 0, moveZ: controls.moveZ ?? 0, jump, crouch: !!controls.crouch }, site, dt)
    if (did.jumped) this.note(did.wallJumped ? 'wallJumped' : 'jumped')
    else if (wasAfoot && runner.mode === 'air') this.note('fell')
    if (did.landed > 0) this.note('landed')
    if (did.walled) this.note('walled')
    if (did.scaled) this.note('scaled')
    if (did.climbed) this.note('climbed')
    if (did.sprung) this.note('sprung')
  }

  _openWings() {
    wingsuit.open(this.suit)
    this.body.pos.y += WINGS_LIFT
    this.state = 'flying'
    this._sense = 0
    this.note('wings')
  }

  _closeWings() {
    const { body, site } = this
    body.pos.y = Math.max(body.pos.y - WINGS_LIFT, site.floorAt(body.pos.x, body.pos.y, body.pos.z))
    foot.fold(this.runner)
    this.state = 'running'
    this.updraft = 0
    this.note('folded')
  }

  _fly(controls, dt) {
    this._jumpWas = !!controls.jump
    if (!controls.jump) return this._closeWings()
    const parts = Math.max(1, Math.ceil((this.body.vel.length() * dt) / MAX_STEP_TRAVEL))
    for (let part = 0; part < parts && this.state === 'flying'; part++) this._flyStep(dt / parts)
  }

  _flyStep(dt) {
    const { body, site } = this
    const clearance = body.pos.y - site.floorAt(body.pos.x, body.pos.y, body.pos.z)
    const cameFrom = _cameFrom.copy(body.pos)
    this._sense -= dt
    if (this._sense <= 0) {
      this._sense = SURROUNDINGS_INTERVAL
      this.updraft = site.updraftAt(body.pos, clearance, this.aim)
    }
    wingsuit.step(this.suit, { aim: this.aim }, { clearance, updraft: this.updraft, brush: 0 }, dt)
    const floor = site.floorAt(body.pos.x, body.pos.y + TOUCH_REACH, body.pos.z, this._floorNormal)
    if (body.pos.y - floor < CRASH_CLEARANCE && body.vel.y < TOUCH_RISING) return this._touchDown(floor)
    if (site.hitsSolid(body.pos)) {
      const faced = site.pushOutOfSolids(this._clear.copy(body.pos), GRAZE_CLEAR, this._normal)
      if (faced && flight.graze(body, this._normal)) {
        body.pos.copy(this._clear)
        this.note('grazed')
      } else this._flewInto(faced, cameFrom)
    }
  }

  // Too squarely to graze: no crash, he catches it on foot (`Game._flewInto`).
  _flewInto(faced, cameFrom) {
    const { body, site } = this
    body.pos.copy(faced ? this._clear : cameFrom)
    this._closeWings()
    this._jumpWas = true
    if (faced && foot.catchWall(this.runner, site, this._normal)) this.note('caught')
  }

  _touchDown(floor) {
    this.note('touched')
    foot.touchDown(this.runner, floor)
    this._jumpWas = true
    this.state = 'running'
    this.updraft = 0
  }

  /**
   * A blast's throw, as `Game` gives a barrel's (`barrels` in a place): on his feet or in a jump,
   * `up` m/s up and `push` m/s more along the way he looks, by `share` of its full strength; in
   * the suit, `flight.lift`'s up and onward.
   */
  thrown({ up, push }, share = 1, yaw = Math.atan2(this.aim.x, this.aim.z)) {
    const { body } = this
    if (this.state === 'flying') return flight.lift(body, up * share, push * share)
    const flat = Math.hypot(body.vel.x, body.vel.z) + push * share
    body.vel.set(Math.sin(yaw) * flat, up * share, Math.cos(yaw) * flat)
    foot.fold(this.runner)
    this.note('thrown')
  }
}
