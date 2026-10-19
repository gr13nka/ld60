// A crow that takes the runner's last cigarette and makes him run after it. It waits on the
// first of its perches until he stands still near it with a lit cigarette, swoops down, takes the
// cigarette out of his fingers (or his lips), and flies off to the next perch, where it sits and
// smokes it until he comes near again; from the last perch it flies off for good. Pure: `game.js`
// steps it with where he is and where his cigarette is, and does what it answers
// (`crow-figure.js` shows it). Nothing of it is kept: a new attempt puts it back home.

import * as THREE from 'three'
import { BIRDS } from './birds.js'

const SWOOP_WITHIN = 14 // metres from the crow at which a runner standing still is worth a swoop
const SWOOP_AFTER = 1.5 // seconds he has to stand still first
const STILL = 0.5 // m/s along the ground under which he is standing still
const SWOOP_GIVE_UP = 4 // seconds of swooping after which, the cigarette not reached, it goes back
const SWOOP_SPEED = 14 // m/s down to where the last of the swoop begins
const APPROACH_OUT = 4 // metres out from the cigarette, on the crow's side, where that is
const APPROACH_RISE = 1 // and metres above it
const FLARE_SPEED = 2.5 // m/s with the beak at the cigarette
const SNATCH_REACH = 0.35 // metres from the beak's tip to the cigarette that count as having it
// The chase never makes him stop (the owner, 2026-10-16: "make it not stop while I run, it should
// start flying as I approach, so I can just continue running"). With the cigarette it leaves a
// perch while he is still FLEE_AHEAD seconds off at his pace (never nearer than FLEE_WITHIN), does
// not come down on one he is that near, and keeps ahead of him at his own pace: LEAD metres in
// front, faster when he gains, slower when he falls back, and only waiting on a perch when he is
// well behind.
const FLEE_WITHIN = 24 // metres
const FLEE_AHEAD = 1.6 // seconds
const LEAD = 25 // metres ahead of him that it keeps
const LEAD_PULL = 0.6 // m/s more (or less) for each metre nearer (or farther) than that
const PEEL = 0.35 // seconds of climbing away from him on a take-off, before it heads anywhere
const PEEL_CLIMB = 6 // m/s up while peeling off
const PEEL_AWAY = 16 // m/s away from him meanwhile
// m/s between perches, at the most and the least: up to faster than he runs (20), so that it pulls
// away and he has to keep after it (the owner: "make it fly fast").
const CRUISE = 30
const DAWDLE = 12
const ROUTE_REACH = 6 // metres from a waypoint of a flown route at which it counts as passed: it is steered through, never landed on
const ARRIVE_OVER = 4 // metres over a perch that it makes for, so as to come down on it
const LAND_FROM = 13 // metres from a perch at which it starts to slow and flare: room to brake from full speed
const LAND_REACH = 0.2 // metres from its spot on the perch at which it is down
const GONE_AFTER = 8 // seconds flying off from the last perch, after which it is out of the place
const STEER = 5 // per second: how fast its velocity follows what it wants
const CROUCH = 0.3 // seconds it crouches on its perch before it swoops: the anticipation that says it is about to
const CROUCH_FLEE = 0.12 // and before it flies on: a flinch, it is in a hurry
// Before it comes for the cigarette it looks him over, as a crow does, with one eye and then the
// other (its eyes are on the sides of its head: it cannot see what is straight ahead of its bill),
// for this long; if he walks off or the cigarette goes meanwhile, it thinks better of it.
const EYE_FOR = 1.2
const EYE_LOST = 4 // metres past SWOOP_WITHIN at which he has walked off
const TAUNT_WITHIN = 45 // metres: perched with the cigarette, it caws at him now and then while he is this near, and not yet near enough to make it go
const TAUNT_EVERY = [3, 6] // seconds between those caws
export const BURN_SECONDS = 300 // a typical smoked cigarette lasts several minutes
export const ASH_SECONDS = 45
const SMOKE_DEMO_RATE = 6

const _want = new THREE.Vector3()
// How near he may come, at `speed` m/s, before it goes: FLEE_AHEAD seconds of his running.
const fleeWithin = (speed) => Math.max(FLEE_WITHIN, speed * FLEE_AHEAD)
const _to = new THREE.Vector3()

export class Crow {
  /**
   * `perches`: `[{ x, y, z, yaw, stay }]` on the floor, the first its home; `stay`, a perch it
   * comes down on and keeps however near he is (for a staged scene); `yaw` the way it sits facing.
   * `bird`: the name in `BIRDS` of the bird that plays it.
   */
  constructor(perches, bird = 'crow') {
    this.perches = perches
    /** Its bird's name, and what its flight needs of that bird's body, as it is drawn. */
    this.bird = bird
    const { size, beakAhead, legs, beakUp } = BIRDS[bird]
    this._beak = beakAhead * size // metres from its middle to the tip of its beak
    this._stands = legs * size // and from its middle down to a perch
    this._beakUp = beakUp * size // and the beak over its middle at a full flare
    /** Its middle, and how it moves, in m/s. */
    this.pos = new THREE.Vector3()
    this.vel = new THREE.Vector3()
    /** Heading as a runner's yaw is turned; pitch nose down positive; bank to the right positive. */
    this.yaw = 0
    this.pitch = 0
    this.bank = 0
    /**
     * 'perched', 'eyeing' (looking him over before it swoops), 'crouching' (about to leave its
     * perch), 'swooping', 'flying', 'landing' or 'gone'.
     */
    this.mode = 'perched'
    /** Whether the cigarette is in its beak. */
    this.carrying = false
    /** 0 to 1: how hard it is braking with its wings, coming down on a perch or at the cigarette. */
    this.flare = 0
    /** How many times it has cawed: one more at each 'caw' `step` answers, for its body to caw with. */
    this.caws = 0
    this.reset()
  }

  /** At home with nothing in its beak, as at the start of an attempt. */
  reset() {
    this.carrying = false
    this.burnAge = 0
    this.ashAge = 0
    this.ashFalls = 0
    this._at = 0 // the perch it is on, or making for
    this._stillFor = 0
    this._for = 0 // seconds in the mode it is in
    this._leaving = false // flying off from the last perch, never to land
    this._next = null // crouching, what it goes to: 'swoop', or the perch it flies for
    this._route = [] // waypoints still to pass, from `fly`, before it heads for its perch
    this._untilTaunt = TAUNT_EVERY[0]
    this._settle(0)
  }

  _settle(index) {
    const perch = this.perches[index]
    this._at = index
    this.mode = 'perched'
    this._for = 0
    this.pos.set(perch.x, perch.y + this._stands, perch.z)
    this.vel.set(0, 0, 0)
    this.yaw = perch.yaw ?? 0
    this.pitch = this.bank = this.flare = 0
  }

  /**
   * One step of `dt` seconds. `feet`: his feet; `speed`: his m/s along the ground; `cigarette`:
   * where his lit cigarette is, or null. Returns 'snatch' in the step the beak takes it, 'caw' in
   * the step it makes to leave a perch with it and now and then as it taunts him from one, and
   * null otherwise.
   */
  step(dt, { feet, speed, cigarette }) {
    if (this.mode === 'gone') return null
    if (this.carrying) {
      const burnDt = dt * (this.smokeDemo ? SMOKE_DEMO_RATE : 1)
      this.burnAge += burnDt
      this.ashAge += burnDt
      if (this.ashAge >= ASH_SECONDS) {
        this.ashAge -= ASH_SECONDS
        this.ashFalls++
      }
      if (this.burnAge >= BURN_SECONDS) this.carrying = false
    }
    // The smoke showroom keeps the bird on its perch while its burn and ash clocks run.
    if (this.smokeDemo) {
      if (this.mode !== 'perched') this._settle(0)
      return null
    }
    this._for += dt
    this._stillFor = speed < STILL ? this._stillFor + dt : 0
    const away = (point) => Math.hypot(point.x - this.pos.x, point.y - this.pos.y, point.z - this.pos.z)
    if (this.mode === 'perched') {
      if (!this.carrying && cigarette && this._stillFor >= SWOOP_AFTER && away(feet) < SWOOP_WITHIN) {
        this.mode = 'eyeing'
        this._for = 0
        return null
      }
      // A `stay` perch (a staged one, beside him for the words) it sits on whatever he does, until told to `fly`.
      if (this.carrying && !this.perches[this._at].stay && (away(feet) < fleeWithin(speed) || this._passed(feet))) {
        this._crouch(this._at + 1)
        return this._caw()
      }
      if (this.carrying && away(feet) < TAUNT_WITHIN && (this._untilTaunt -= dt) <= 0) {
        this._untilTaunt = TAUNT_EVERY[0] + Math.random() * (TAUNT_EVERY[1] - TAUNT_EVERY[0])
        return this._caw()
      }
      return null
    }
    if (this.mode === 'eyeing') {
      if (!cigarette || away(feet) > SWOOP_WITHIN + EYE_LOST) this._settle(this._at)
      else if (this._for >= EYE_FOR) this._crouch('swoop')
      return null
    }
    if (this.mode === 'crouching') {
      if (this._for < (this._next === 'swoop' ? CROUCH : CROUCH_FLEE)) return null
      if (this._next !== 'swoop') this._takeOff(this._next)
      else {
        this.mode = 'swooping'
        this._for = 0
      }
      return null
    }
    if (this.mode === 'swooping') return this._swoop(dt, feet, cigarette)
    // Flying or landing: off from him a moment, then to the perch it makes for.
    if (this._for < PEEL) {
      _want.set(this.pos.x - feet.x, 0, this.pos.z - feet.z)
      _want.setLength(PEEL_AWAY).setY(PEEL_CLIMB)
      this._steer(dt, _want)
      return null
    }
    // A told route is flown at full cruise whatever he does: it is for a staged flight, not a chase.
    if (this._route.length) {
      const point = this._route[0]
      _to.set(point.x, point.y, point.z)
      if (away(_to) < ROUTE_REACH) this._route.shift()
      else {
        this._steer(dt, _want.subVectors(_to, this.pos).setLength(CRUISE))
        return null
      }
    }
    // Its pace: kept LEAD metres ahead of him at his own.
    const lead = Math.hypot(this.pos.x - feet.x, this.pos.z - feet.z)
    const cruise = THREE.MathUtils.clamp(speed + (LEAD - lead) * LEAD_PULL, DAWDLE, CRUISE)
    if (this._leaving) {
      _want.set(this.vel.x, 0, this.vel.z).setLength(CRUISE).setY(PEEL_CLIMB * 0.5)
      this._steer(dt, _want)
      if (this._for > GONE_AFTER) this.mode = 'gone'
      return null
    }
    let perch = this.perches[this._at]
    _to.set(perch.x, perch.y + this._stands, perch.z)
    // Coming to a perch he would be near enough to make it leave again by the time it was down:
    // decided before it brakes, on to the next without landing, or, past the last, away.
    if (!perch.stay && away(_to) < 2 * LAND_FROM && Math.hypot(perch.x - feet.x, perch.z - feet.z) < fleeWithin(speed) + LAND_FROM) {
      if (this._at + 1 >= this.perches.length) {
        this._leaving = true
        this._for = PEEL // no climb away: it is already going, and GONE_AFTER counts from here
        this.mode = 'flying'
        this.flare = 0
        return null
      }
      perch = this.perches[++this._at]
      _to.set(perch.x, perch.y + this._stands, perch.z)
    }
    const left = away(_to)
    if (left < LAND_REACH) {
      this._settle(this._at)
      return null
    }
    this.mode = left < LAND_FROM ? 'landing' : 'flying'
    // From afar it makes for a point over the perch, and comes down on it from there.
    if (this.mode === 'flying') _to.y += ARRIVE_OVER * Math.min(1, (left - LAND_FROM) / LAND_FROM)
    const pace = this.mode === 'landing' ? Math.min(cruise, 0.8 + left * 1.9) : cruise
    this.flare = this.mode === 'landing' ? 1 - left / LAND_FROM : 0
    this._steer(dt, _want.subVectors(_to, this.pos).setLength(pace), this.mode === 'landing' ? 3 : 1)
    return null
  }

  // Down at the cigarette: first to a point out from it on the crow's own side, then straight at
  // it, slowing, until the beak is there. Not got in time, or gone out of reach, it goes home.
  _swoop(dt, feet, cigarette) {
    if (!cigarette || this._for > SWOOP_GIVE_UP) {
      this._takeOff(this._at)
      return null
    }
    const near = cigarette.distanceTo(this.pos)
    if (near < this._beak + SNATCH_REACH) {
      this.carrying = true
      this.burnAge = this.ashAge = this.ashFalls = 0
      this._takeOff(this._at + 1)
      return 'snatch'
    }
    _to.set(this.pos.x - cigarette.x, 0, this.pos.z - cigarette.z)
    if (_to.lengthSq() < 1e-6) _to.set(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    const out = Math.min(APPROACH_OUT, near * 0.7)
    _to.setLength(out).add(cigarette)
    _to.y += APPROACH_RISE * (out / APPROACH_OUT)
    // The last of it: the middle aimed short of the cigarette by the beak's length.
    const closing = near < APPROACH_OUT + 0.5
    if (closing) {
      _to.subVectors(this.pos, cigarette).setY(0).setLength(this._beak).add(cigarette)
      _to.y -= this._beakUp * this.flare
    }
    const pace = closing ? FLARE_SPEED + (SWOOP_SPEED - FLARE_SPEED) * Math.min(1, (near - this._beak) / APPROACH_OUT) : SWOOP_SPEED
    this.flare = closing ? 1 - Math.min(1, (near - this._beak) / APPROACH_OUT) : 0
    this._steer(dt, _want.subVectors(_to, this.pos).setLength(pace), closing ? 3 : 1)
    // Turning to face the cigarette as it closes, whatever way it is still drifting.
    if (closing) {
      const turn = Math.atan2(cigarette.x - this.pos.x, cigarette.z - this.pos.z) - this.yaw
      this.yaw += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, 10 * dt)
    }
    return null
  }

  /** Puts it down on perch `index` at once, whatever it was doing: for a staged beat with no flight. */
  sit(index) {
    if (index < 0 || index >= this.perches.length) return
    this._settle(index)
  }

  /**
   * Sends it off its perch now, carrying on, instead of waiting for him to come near: it crouches
   * and takes off as it does when he comes, flies through `path` (`[{ x, y, z }]`, in order)
   * without landing on any of it, then on to the next perch as usual. An empty `path` is just
   * leaving for the next perch. Ignored unless it is perched.
   */
  fly(path) {
    if (this.mode !== 'perched') return
    this._route = path.map(({ x, y, z }) => ({ x, y, z }))
    this._crouch(this._at + 1)
  }

  // Whether he has got past it on its perch: nearer the next perch than it is (or, at the last, past
  // it along the way it came), so that it never sits on while he runs on.
  _passed(feet) {
    const next = this.perches[this._at + 1]
    if (next) return Math.hypot(feet.x - next.x, feet.z - next.z) < Math.hypot(this.pos.x - next.x, this.pos.z - next.z)
    const from = this.perches[this._at - 1] ?? this.perches[this._at]
    return Math.hypot(feet.x - from.x, feet.z - from.z) > Math.hypot(this.pos.x - from.x, this.pos.z - from.z)
  }

  // Down on its legs before it goes, `next` what it goes to: 'swoop', or a perch's index.
  _crouch(next) {
    this.mode = 'crouching'
    this._next = next
    this._for = 0
  }

  _caw() {
    this.caws++
    return 'caw'
  }

  // Off its perch, to the perch `index`; past the last one, off for good.
  _takeOff(index) {
    this._leaving = index >= this.perches.length
    this._at = Math.min(index, this.perches.length - 1)
    this.mode = 'flying'
    this._for = 0
    this.flare = 0
  }

  // Eases the velocity toward `want` (`grip` times quicker than in the open air), moves along it,
  // and turns the bird to where it goes, banking into the turn.
  _steer(dt, want, grip = 1) {
    const k = Math.min(1, STEER * grip * dt)
    this.vel.lerp(want, k)
    this.pos.addScaledVector(this.vel, dt)
    const along = Math.hypot(this.vel.x, this.vel.z)
    let turn = 0
    if (along > 0.5) {
      turn = Math.atan2(this.vel.x, this.vel.z) - this.yaw
      turn = Math.atan2(Math.sin(turn), Math.cos(turn))
      this.yaw += turn * Math.min(1, 6 * dt)
    }
    // A turn to the left is a rising yaw, and banks the left wing down.
    const bank = THREE.MathUtils.clamp(-turn * 1.5, -0.9, 0.9)
    this.bank += (bank - this.bank) * Math.min(1, 5 * dt)
    this.pitch += (-Math.atan2(this.vel.y, Math.max(along, 0.5)) * 0.7 - this.pitch) * Math.min(1, 5 * dt)
  }
}
