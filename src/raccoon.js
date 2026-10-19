// A raccoon three quarters of a man's height, in a flat cap and a scarf, who has a cigarette and nothing to
// light it with. He waits by his home spot until the runner, near and on his level and not running
// past, looks at him; then he gets up, waves to him with a chirr, and waddles over, greeting him
// when he is close with his cap lifted off his head, a nod and a chirr. He asks for a light the
// only way he can: he stops at arm's length and holds the cigarette out in both paws, with a nod
// and a chirr now and then while he is kept waiting. A runner who watches him come squats to his height
// (`meets`, `game.js`). Lent a flame long enough (`Smoker.lend`), his
// cigarette catches; he takes a drag, bows his thanks and goes home to smoke it. Walked away
// from, he follows a while and then gives up. Pure: `game.js` steps him with where the runner is
// and whether a lent flame is out, and does what he answers (`raccoon-figure.js` shows him).
// He meets no solids: he walks straight over whatever floor `floorAt` finds. Nothing of him is
// kept: a new attempt puts him back home with his cigarette unlit.

import * as THREE from 'three'

/**
 * How much bigger he is than the half-a-man raccoon he was made as (the owner, 2026-10-19: "make
 * the racoon 1.5 times bigger", so that he is found). Every length of him below is of that one.
 */
export const SIZE = 1.5
/** Metres from his feet to the tops of his ears, stood up. */
export const HEIGHT = 0.9 * SIZE
/**
 * Where the tip of his cigarette is held out to be lit, from his feet: metres ahead along his
 * heading, and up. The body's `ask` pose is built to put it there (`raccoon-poses.js`, judged on
 * `itch/raccoon-sheet.html`), and the runner's lighter is aimed at it.
 */
export const OFFER_AHEAD = 0.43 * SIZE
export const OFFER_UP = 0.67 * SIZE

const NOTICE_WITHIN = 20 // metres from him at which the runner is someone to ask
// How far off the middle of the runner's view he may be and still be seen: looked at, not merely
// at the edge of the picture. Nothing in between is asked about: a wall would not hide him.
const SEEN_CONE = THREE.MathUtils.degToRad(25)
const MIDDLE = 0.45 * SIZE // metres over his feet that is looked at
const LEVEL = 1.2 // metres up or down from his floor that count as on his level
const PASSING = 4 // m/s along the ground at which the runner is running past, and not to be bothered
export const RISE_SECONDS = 0.7 // up off his haunches before he sets off: the anticipation
/** Seconds he waves to the runner, stood up at home, before he sets off. */
export const WAVE_SECONDS = 1.5
const WALK = 2 // m/s at his waddle
const SLOW_WITHIN = 0.6 // metres short of where he stops over which he slows
const TURN = 6 // per second: how fast his heading follows where he goes
const ASK_AT = 1.1 * SIZE // metres from the runner's feet to his, where he stops to ask
const FOLLOW_SLACK = 0.8 // metres farther than ASK_AT the runner may step before he follows
const GIVE_UP = 18 // metres away at which he stops following and goes home
const STEP_UP = 0.5 // metres over his feet from which the floor under the next step is looked for
const HOME_REACH = 0.1 // metres from home at which he is back
// Close to the runner, this many metres short of where he stops (2.6 m from his feet), he greets
// him: his cap lifted right off his head, a nod and a chirr, over his last steps and the moment
// after he stops; only then is the cigarette held out (the owner, 2026-10-16: "make him lift up
// his cap as he approaches and nods as if greeting me", then "make him greet taking hat up when he
// is close to the player").
const GREET_WITHIN = 1.5
/** Seconds of the greeting, from the cap lifted to the cap back on his head. */
export const GREET_SECONDS = 1.6
/** Seconds after he stops before the cigarette is held out to be lit: his paws bringing it up. */
export const OFFER_SECONDS = 0.5
const CHIRR_EVERY = [4, 7] // seconds between the nods, each with a chirr, while he is kept waiting
const REACH = 1.6 * SIZE // metres from the runner's feet to his within which a light can be given
// Metres between their feet within which a runner who watches him come squats to his height (the
// owner, 2026-10-16: "the player squats to match the racoons level").
const MEET_WITHIN = 3
const CONE = THREE.MathUtils.degToRad(35) // and how far off where the runner looks he may stand
/** Seconds of a flame held to the tip before it catches. */
export const CATCH_SECONDS = 0.6
/** Seconds of the first drag, the puff and the bow of thanks, after it catches. */
export const THANK_SECONDS = 3.2
const THANK_CHIRR_AT = 1.9 // seconds into the thanks: the chirr goes with the bow
export const BURN_SECONDS = 300 // as the runner's own: a smoked cigarette lasts several minutes
export const ASH_SECONDS = 45

const between = ([low, high]) => low + Math.random() * (high - low)
const _to = new THREE.Vector3()

export class Raccoon {
  /**
   * `home`: `{ x, y, z, yaw }` on the floor, where he waits and smokes, `yaw` the way he faces
   * there. `floorAt(x, y, z)`: the height of the floor at or below `y` there (`ParkourWorld`).
   */
  constructor(home, floorAt) {
    this.home = home
    this._floorAt = floorAt
    /** His feet. */
    this.pos = new THREE.Vector3()
    /** The way he faces, as a runner's yaw is turned: +Z at 0. */
    this.yaw = 0
    /**
     * 'waiting' (at home, unlit), 'rising', 'waving', 'walking' (to the runner), 'asking',
     * 'catching' (the tip in a flame), 'thanking', 'leaving' (for home) or 'smoking' (at home, lit).
     */
    this.mode = 'waiting'
    /** Seconds he has been in this mode. */
    this.modeFor = 0
    /** Metres walked, all told: his stride's phase. */
    this.walked = 0
    /** m/s he is walking at now. */
    this.pace = 0
    /** How many times he has chirred: one more at each 'chirr' `step` answers. */
    this.chirrs = 0
    /** Seconds into his greeting as he comes close (`GREET_SECONDS` long), or -1. */
    this.greetFor = -1
    this.reset()
  }

  /** At home with his cigarette unlit, as at the start of an attempt. */
  reset() {
    this.lit = false
    this.burnAge = 0
    this.ashAge = 0
    this.ashFalls = 0
    this._untilChirr = 0
    this._settle()
  }

  /** A courier's counted match lights him at once; his thanks and walk home are the usual ones. */
  acceptMatch() {
    this.lit = true
    this.burnAge = this.ashAge = this.ashFalls = 0
    this._enter('thanking')
  }

  _settle() {
    const { x, y, z, yaw } = this.home
    this.pos.set(x, y, z)
    this.yaw = yaw ?? 0
    this.pace = 0
    this.greetFor = -1
    this._greeted = false // whether he has greeted the runner on this visit: once until he is home again
    this._enter(this.lit ? 'smoking' : 'waiting')
  }

  _enter(mode) {
    this.mode = mode
    this.modeFor = 0
  }

  /**
   * One step of `dt` seconds. `feet`: the runner's feet; `eye`: where he looks from; `aim`: where
   * he looks; `speed`: his m/s along the ground; `flame`: true while a flame he lends is out.
   * Returns 'chirr' in the step he chirrs, 'lit' in the step his cigarette catches, and null
   * otherwise.
   */
  step(dt, { feet, eye, aim, speed, flame }) {
    this.modeFor += dt
    this.pace = 0
    if (this.greetFor >= 0 && (this.greetFor += dt) >= GREET_SECONDS) this.greetFor = -1
    if (this.lit) this._burn(dt)
    const apart = Math.hypot(feet.x - this.pos.x, feet.z - this.pos.z)
    switch (this.mode) {
      case 'waiting':
        // Unseen, he stays where he is: it is being looked at that makes him come.
        if (apart < NOTICE_WITHIN && Math.abs(feet.y - this.pos.y) < LEVEL && speed < PASSING && this.seenFrom(eye, aim)) {
          this._enter('rising')
        }
        return null
      case 'rising':
        this._face(dt, feet)
        if (this.modeFor < RISE_SECONDS) return null
        this._enter('waving')
        return this._chirr()
      case 'waving':
        this._face(dt, feet)
        if (this.modeFor < WAVE_SECONDS) return null
        this._enter('walking')
        return null
      case 'walking': {
        if (apart > GIVE_UP) {
          this._enter('leaving')
          return null
        }
        // To the point ASK_AT short of him, on the line between them.
        _to.set(this.pos.x - feet.x, 0, this.pos.z - feet.z)
        if (_to.lengthSq() < 1e-6) _to.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).negate()
        _to.setLength(ASK_AT).add(feet)
        const left = this._walkTo(dt, _to)
        if (!this._greeted && left < GREET_WITHIN) {
          this._greeted = true
          this.greetFor = 0
          return this._chirr()
        }
        if (left > 0.05) return null
        this._enter('asking')
        this._untilChirr = between(CHIRR_EVERY)
        return null
      }
      case 'asking':
        this._face(dt, feet)
        if (this.greetFor >= 0) this.modeFor = 0 // the cigarette comes up once his cap is back on
        if (apart > GIVE_UP) this._enter('leaving')
        else if (apart > ASK_AT + FOLLOW_SLACK) this._enter('walking')
        else if (flame && this.takesLight(feet, aim)) this._enter('catching')
        else if (this.modeFor >= OFFER_SECONDS && (this._untilChirr -= dt) <= 0) {
          this._untilChirr = between(CHIRR_EVERY)
          return this._chirr()
        }
        return null
      case 'catching':
        this._face(dt, feet)
        if (!flame) {
          // Out before it caught: still asking, the cigarette still held out.
          this._enter('asking')
          this.modeFor = OFFER_SECONDS
          return null
        }
        if (this.modeFor < CATCH_SECONDS) return null
        this.lit = true
        this.burnAge = this.ashAge = this.ashFalls = 0
        this._enter('thanking')
        return 'lit'
      case 'thanking': {
        this._face(dt, feet)
        const chirred = this.modeFor - dt < THANK_CHIRR_AT && this.modeFor >= THANK_CHIRR_AT
        if (this.modeFor >= THANK_SECONDS) this._enter('leaving')
        return chirred ? this._chirr() : null
      }
      case 'leaving':
        _to.set(this.home.x, this.home.y, this.home.z)
        if (this._walkTo(dt, _to) < HOME_REACH) this._settle()
        return null
      default: // smoking
        return null
    }
  }

  /**
   * True while he is asking for a light that could be given now: the cigarette held out, the
   * runner's feet within reach of his, and he not far off where the runner looks.
   */
  takesLight(feet, aim) {
    if (!(this.mode === 'catching' || (this.mode === 'asking' && this.modeFor >= OFFER_SECONDS && this.greetFor < 0))) return false
    const dx = this.pos.x - feet.x
    const dz = this.pos.z - feet.z
    const apart = Math.hypot(dx, dz)
    if (apart > REACH) return false
    const off = Math.atan2(dx, dz) - Math.atan2(aim.x, aim.z)
    return Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) < CONE
  }

  /** True if he is near the middle of the view from `eye` along `aim`, a unit vector. */
  seenFrom(eye, aim) {
    _to.set(this.pos.x - eye.x, this.pos.y + MIDDLE - eye.y, this.pos.z - eye.z)
    return _to.lengthSq() > 1e-6 && _to.angleTo(aim) < SEEN_CONE
  }

  /**
   * True while he is coming to the runner or is with him, asking or thanking, within MEET_WITHIN
   * of his feet: when a runner who watches him squats to his height.
   */
  meets(feet) {
    const visiting = this.mode === 'walking' || this.mode === 'asking' || this.mode === 'catching' || this.mode === 'thanking'
    return visiting && Math.hypot(feet.x - this.pos.x, feet.z - this.pos.z) < MEET_WITHIN
  }

  /** Where the tip of his cigarette is held out to be lit, in the world, written to `out`. */
  tipAt(out) {
    return out.set(this.pos.x + Math.sin(this.yaw) * OFFER_AHEAD, this.pos.y + OFFER_UP, this.pos.z + Math.cos(this.yaw) * OFFER_AHEAD)
  }

  // The lit cigarette burning down, its ash falling now and then; smoked to the filter, he has
  // another, unlit, and is back to waiting for someone to ask.
  _burn(dt) {
    this.burnAge += dt
    this.ashAge += dt
    if (this.ashAge >= ASH_SECONDS) {
      this.ashAge -= ASH_SECONDS
      this.ashFalls++
    }
    if (this.burnAge < BURN_SECONDS) return
    this.lit = false
    this.burnAge = this.ashAge = 0
    if (this.mode === 'smoking') this._enter('waiting')
  }

  _chirr() {
    this.chirrs++
    return 'chirr'
  }

  // Turns him toward `point`.
  _face(dt, point) {
    this._turnTo(dt, Math.atan2(point.x - this.pos.x, point.z - this.pos.z))
  }

  _turnTo(dt, yaw) {
    const turn = yaw - this.yaw
    this.yaw += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, TURN * dt)
  }

  // A step at his waddle toward `to` along the ground, slowing at the last, his feet kept on the
  // floor. Returns the metres still to go.
  _walkTo(dt, to) {
    const dx = to.x - this.pos.x
    const dz = to.z - this.pos.z
    const left = Math.hypot(dx, dz)
    if (left < 1e-4) return 0
    this._turnTo(dt, Math.atan2(dx, dz))
    this.pace = WALK * Math.min(1, 0.3 + left / SLOW_WITHIN)
    const step = Math.min(left, this.pace * dt)
    this.pos.x += (dx / left) * step
    this.pos.z += (dz / left) * step
    this.pos.y = this._floorAt(this.pos.x, this.pos.y + STEP_UP, this.pos.z)
    this.walked += step
    return left - step
  }
}
