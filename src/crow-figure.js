// The crow on screen, or whichever bird of `birds.js` plays it (`crow.js` says what it does;
// `crow-body.js` and `gull-body.js` are the bodies, `crow-poses.js` and `gull-poses.js` the poses): its poses mixed by what it is doing, the wingbeat over them, and the small things a crow
// does that make it a character and not a prop, after `docs/research/crow.md`. It sees with one eye
// at a time, as a crow does: to watch the runner it turns its head side-on to him, quick turns
// with holds between, its head rolled to tip the eye toward his face, and now and then flips to
// the other eye; straight ahead of its bill it hardly sees. Before it comes for the cigarette it
// looks him over, one eye and then the other, a bob of the head, and only then crouches. On a
// perch it breathes, glances away, cocks its head, flicks its tail, ruffles and shifts its feet;
// it crouches before it goes, beats hard as it leaves, glides with a burst of beats now and then, stands up in the air to brake with its legs swung
// forward, reaches for the cigarette with its bill open, and shakes its wings settling when it
// lands. It caws with its whole body. It smokes the cigarette it has stolen: now and then a drag,
// its head tipped back, and a puff out of the beak. Look only.

import * as THREE from 'three'
import { CIGARETTE_ASPECT, createCigarette, materials } from './models.js'
import { BIRDS } from './birds.js'
import { ASH_SECONDS, BURN_SECONDS } from './crow.js'
import { createCrowBody } from './crow-body.js'
import { POSES as CROW_POSES, STROKE as CROW_STROKE, beat, mixPoses } from './crow-poses.js'
import { createGullBody } from './gull-body.js'
import { POSES as GULL_POSES, STROKE as GULL_STROKE } from './gull-poses.js'

// Each bird's body, poses and stroke, and how it flies and calls. Its wingbeat's tempi, in radians
// of its cycle a second, level, climbing, gliding and braking (a real crow beats 2.2 times a second
// level and 2.7 climbing; one 4.4 times a crow beats slower, as a big bird does); `soars`, how much
// of an easy glide it holds its wings still, 0 a crow's bursts of beats to nearly always; `call`,
// the seconds its call takes, in `notes`, the bill opening once for each; `settle`, the seconds of
// its landing: the crow shakes its wings into place, a bird with a `land` pose holds that and folds.
const FIGURES = {
  crow: { body: createCrowBody, poses: CROW_POSES, stroke: CROW_STROKE, beat: 14, climb: 17, glide: 11, flare: 19, soars: 0, call: 0.5, notes: 1, settle: 0.6 },
  // A gull flaps slower and shallower than a crow and glides most of the way; its long call
  // (`gull.mp3`) is a long cry and four yelps, the head thrown back; landed, it holds its wings up
  // over its back a moment.
  gull: { body: createGullBody, poses: GULL_POSES, stroke: GULL_STROKE, beat: 11, climb: 14, glide: 8, flare: 16, soars: 0.6, call: 1.8, notes: 5, settle: 0.9 },
}
const TAKE_OFF = 0.6 // seconds of the hardest beats off a perch
const NECK_TURN = 2.3 // radians the head turns either way at most; past it, the other eye is used
const LOOK_ROLL = 0.9 // of how far he is above or below, the head rolled to tip the eye at him
const HOLD = [0.5, 1.4] // seconds a look is held before the head goes to the next
// How quickly the head goes to where it looks next: the stiffness of a spring that brings it
// there (per second), quick as a bird's but starting and stopping smoothly, where an ease that
// starts at full speed read as choppy (the owner, 2026-10-16: "too chopy, birds move fast and
// chopy but its still too much").
const TURN = 20
const SWAP_EVERY = [2.5, 5] // seconds between changes of eye
// Looking him over before the swoop (`crow.js`'s `eyeing`): seconds into it at which the head flips
// to the other eye, and at which it bobs, lining him up.
const EYEING_SWAP = 0.5
const EYEING_BOB = [0.85, 1.05]
// Its timing, quickened once it had been slowed (the owner, 2026-10-16, after "too chopy": "make
// her animations faster"): quick, but each turn still on a spring and each tempo still eased.
const IDLE_EVERY = [2, 4.5] // seconds between a perched crow's small things
// Each small thing: how long it takes and how likely it is.
const IDLES = { tilt: [1.2, 0.3], glance: [1.1, 0.25], flick: [0.4, 0.2], ruffle: [0.75, 0.1], shift: [0.55, 0.15] }
const RATE_EASE = 6 // per second: how fast the wingbeat's tempo goes from one to the next, never at a jump
const DRAG_EVERY = [18, 28] // a normal smoking cadence while perched
const FLIGHT_DRAG_EVERY = [20, 35]
const DEMO_DRAG_EVERY = [4, 7]
const DRAG_SECONDS = 2.2
const DRAG_TILT = 0.5 // radians the head tips back over a drag
const DRAG_EXHALE = 1.5 // seconds into a drag at which it blows the smoke out
const EXHALE_SECONDS = 0.55
const CIGARETTE = { length: 0.15, radius: 0.15 / CIGARETTE_ASPECT, grown: 2 }
const PUFF = 1.5 // the size of its breath of smoke, as `effects.exhale` takes it

const between = ([low, high]) => low + Math.random() * (high - low)
// `state` (`{ x, v }`, where it is and how fast it goes) pulled toward `to` for `dt` seconds by a
// critically damped spring of `rate` per second; its new place.
function spring(state, to, rate, dt) {
  for (let left = dt; left > 1e-6; left -= 1 / 120) {
    const step = Math.min(left, 1 / 120)
    state.v += (rate * rate * (to - state.x) - 2 * rate * state.v) * step
    state.x += state.v * step
  }
  return state.x
}
// A rise and fall over `t` from 0 to 1: 0 at both ends, 1 in the middle.
const hump = (t) => (t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t))
const _at = new THREE.Vector3()
const _ahead = new THREE.Vector3()

export class CrowFigure {
  /** `bird`: the name in `BIRDS` of the bird to show. */
  constructor(bird = 'crow') {
    this._bird = FIGURES[bird]
    this._size = BIRDS[bird].size
    this.body = this._bird.body()
    this.group = this.body.group
    this.head = this.body.head
    this.group.scale.setScalar(this._size)
    this._cigarette = createCigarette(CIGARETTE.length, CIGARETTE.radius)
    // Out of the side of the bill, to the crow's left, drooping; not as big as the bird is.
    this._cigarette.group.rotation.set(0.25, 1.0, 0, 'YXZ')
    this._cigarette.group.scale.setScalar(CIGARETTE.grown / this._size)
    this.body.mouth.add(this._cigarette.group)
    // The ember's own materials, to brighten on a drag without brightening every fire.
    this._glow = this._cigarette.ember.children
      .filter((piece) => piece.material === materials.ember || piece.material === materials.flame)
      .map((piece) => {
        piece.material = piece.material.clone()
        return { material: piece.material, color: piece.material.color.clone() }
      })
    this._pose = {}
    this._was = null // the mode last shown
    this._sit = 1 // eased from 0 in the air to 1 on a perch
    this._crouch = 0
    this._strength = 0 // of the wingbeat
    this._phase = 0
    this._clock = Math.random() * 10
    this._lookYaw = { x: 0, v: 0 } // the head's turn and roll as shown, each on its spring
    this._lookRoll = { x: 0, v: 0 }
    this._rate = this._bird.beat // the wingbeat's tempo, eased
    this._eye = Math.random() < 0.5 ? 1 : -1 // which eye is on him: 1 its left, -1 its right
    this._gazeYaw = 0 // where the head is to turn to, and its roll
    this._gazeRoll = 0
    this._holdFor = 0
    this._swapFor = between(SWAP_EVERY)
    this._eyeingFor = 0 // seconds of looking him over
    this._caws = 0
    this._caw = Infinity // seconds since it last cawed
    this._settle = Infinity // since it landed
    this._takeOff = Infinity // since it left a perch
    this._idle = null // `{ kind, for, side }`: a small thing it is doing on its perch
    this._untilIdle = between(IDLE_EVERY)
    this._tipped = 0 // how far back its head was tipped for a drag, as last shown
    this._drag = -1 // seconds into a drag, or -1
    this._untilDrag = between(DRAG_EVERY)
    this._coal = 0 // how bright the ember is drawn on, 0 to 1
    this._demoBegun = false
    this._ashSeen = 0
    // How far its feet are below its middle, sitting: `crow.js` puts the middle its bird's `legs`
    // over the perch, and the body is drawn up or down by the difference so that the feet are on it.
    this._legs = BIRDS[bird].legs
    this.body.pose(mixPoses({ perch: 1 }, this._pose, this._bird.poses))
    this.group.updateMatrixWorld(true)
    this._feetBelow = -this.body.feet[0].getWorldPosition(_at).y / this._size
  }

  /**
   * Shows `crow` (a `Crow`) as it now is, drawn on along its way by `ahead` seconds past its last
   * step; `focus` is the runner's feet, smoke goes to `effects`.
   */
  show(crow, dt, ahead, focus, effects) {
    this.group.visible = crow.mode !== 'gone'
    if (!this.group.visible) return
    const ease = (from, to, rate) => from + (to - from) * Math.min(1, rate * dt)
    const { mode, flare } = crow
    const eyeing = mode === 'eyeing'
    const perched = mode === 'perched' || eyeing
    const crouching = mode === 'crouching'
    this._eyeingFor = eyeing ? this._eyeingFor + dt : 0
    if (perched && this._was !== null && !['perched', 'eyeing', 'crouching'].includes(this._was)) this._settle = 0
    if (!perched && !crouching && this._was === 'crouching') this._takeOff = 0
    if (crow.caws !== this._caws) {
      this._caws = crow.caws
      this._caw = 0
    }
    this._was = mode
    this._clock += dt
    this._caw += dt
    this._settle += dt
    this._takeOff += dt

    // What it is doing, as weights of its poses.
    this._sit = ease(this._sit, perched || crouching ? 1 : 0, perched || crouching ? 10 : 14)
    this._crouch = ease(this._crouch, crouching ? 1 : 0, 18)
    const air = 1 - this._sit
    const { poses, stroke, call, notes, settle, soars } = this._bird
    const cawing = hump(this._caw / call)
    const reaching = mode === 'swooping' && !crow.carrying ? 1 : 0
    // Landed, a bird with a `land` pose holds it, then folds out of it.
    const landing = poses.land && perched ? 1 - THREE.MathUtils.smoothstep(this._settle, 0.35 * settle, settle) : 0
    const sat = this._sit * (1 - landing)
    const p = mixPoses({
      perch: sat * (1 - this._crouch) * (1 - cawing) * (eyeing ? 0.3 : 1),
      alert: sat * (1 - this._crouch) * (1 - cawing) * (eyeing ? 0.7 : 0),
      crouch: sat * this._crouch,
      caw: sat * (1 - this._crouch) * cawing,
      land: this._sit * landing,
      glide: air * (1 - flare),
      flare: air * flare * (1 - reaching),
      reach: air * flare * reaching,
    }, this._pose, poses)
    // A call of several notes opens and shuts the bill once for each.
    if (notes > 1 && cawing > 0) p.jaw *= 0.35 + 0.65 * Math.abs(Math.sin(Math.PI * notes * this._caw / call))

    // The wingbeat: hard off a perch, climbing, slow or braking; going down fast, a glide with a
    // burst of beats now and then; nothing on a perch.
    const along = Math.hypot(crow.vel.x, crow.vel.z)
    const leaving = this._takeOff < TAKE_OFF
    const working = crow.vel.y > 0.5 || along < 6 || flare > 0.05 || leaving
    const burst = THREE.MathUtils.clamp((Math.sin(this._clock * 0.9) - soars) * 2, 0, 1)
    const strength = (working ? 1 : 0.15 * (1 - soars) + (1 - 0.15 * (1 - soars)) * burst) * (1 - 0.4 * flare) * air
    this._strength = ease(this._strength, strength, 8)
    const rates = this._bird
    this._rate = ease(this._rate, leaving ? rates.climb * 1.15 : flare > 0.3 ? rates.flare : crow.vel.y > 0.5 ? rates.climb : working ? rates.beat : rates.glide, RATE_EASE)
    this._phase += this._rate * dt
    beat(p, this._phase, this._strength, stroke)

    // Landed with no `land` pose: the wings shaken into place, the tail and the body bobbing to rest.
    if (!poses.land && this._settle < settle) {
      const left = 1 - this._settle / settle
      p.fold -= 0.2 * left * (0.5 + 0.5 * Math.cos(this._settle * 26))
      p.tail += 0.22 * left * Math.sin(this._settle * 14)
      p.drop += 0.01 * left * Math.sin(this._settle * 12)
    }

    // On a perch: breathing, and a small thing now and then (none while it looks him over).
    let glance = 0
    if (perched && !eyeing) {
      p.rise += 0.015 * Math.sin(this._clock * 1.7)
      glance = this._idleOver(p, dt)
    } else this._idle = null

    // On its perch it watches him with one eye; in the air its head is held straight.
    if (perched || crouching) this._watch(crow, focus, dt, glance)
    else this._gazeYaw = this._gazeRoll = 0
    const turn = perched || crouching ? TURN : 6
    p.lookYaw += spring(this._lookYaw, this._gazeYaw, turn, dt)
    p.tilt += spring(this._lookRoll, this._gazeRoll, turn, dt)
    p.headPitch -= DRAG_TILT * this._tipped
    // Looking him over, a bob of the head as it lines him up.
    if (eyeing) p.headPitch += 0.3 * hump((this._eyeingFor - EYEING_BOB[0]) / (EYEING_BOB[1] - EYEING_BOB[0]))
    if (crow.carrying) p.jaw = Math.max(p.jaw, 0.06) // the bill a little open on the cigarette

    this.group.position.copy(crow.pos).addScaledVector(crow.vel, ahead)
    this.group.position.y += (this._legs - this._feetBelow) * this._size * this._sit
    this.group.rotation.set(crow.pitch * air, crow.yaw, crow.bank * air)
    this.body.pose(p, this.group.rotation.x)
    this._tipped = this._smoke(crow, dt, effects)
  }

  /** The names of its bird's poses, for the pose sheet. */
  get poseNames() {
    return Object.keys(this._bird.poses)
  }

  /**
   * For the pose sheet (`itch/crow-sheet.html`): drawn level at the origin in pose `name` of its
   * bird's poses, its wings `phase` into a beat of `strength` (none unless given), its head
   * turned and cocked by `lookYaw` and `tilt`, the cigarette in its bill if `cigarette`.
   */
  showPose(name, { phase = 0, strength = 0, lookYaw = 0, tilt = 0, cigarette = false } = {}) {
    this._cigarette.group.visible = cigarette
    const p = beat(mixPoses({ [name]: 1 }, this._pose, this._bird.poses), phase, strength, this._bird.stroke)
    if (cigarette) p.jaw = Math.max(p.jaw, 0.06)
    p.lookYaw += lookYaw
    p.tilt += tilt
    this.group.position.set(0, 0, 0)
    this.group.rotation.set(0, 0, 0)
    this.body.pose(p, 0)
  }

  // Where its head is to be: turned so that one eye is on him (the one he is nearer, unless it has
  // just changed eyes), rolled to tip that eye up or down at his face, held there and then turned
  // to the next look; every few seconds, or when he goes round past what its neck can turn, the
  // other eye. Looking him over before the swoop, the near eye first and then the other. `glance`
  // is a look away of a small thing it is doing (`_idleOver`), the head turned that much off him.
  _watch(crow, focus, dt, glance) {
    const dx = focus.x - crow.pos.x
    const dy = focus.y + 1.6 - crow.pos.y
    const dz = focus.z - crow.pos.z
    const cos = Math.cos(crow.yaw)
    const sin = Math.sin(crow.yaw)
    const across = dx * cos - dz * sin
    const forward = dx * sin + dz * cos
    const bearing = Math.atan2(across, forward) // positive to its left
    const below = Math.atan2(dy, Math.hypot(across, forward)) // positive above it
    // The head's turn that puts an eye on him: the left eye looks out to the left and a little forward.
    const turnFor = (eye) => bearing - eye * (Math.PI / 2 - this.body.eyeForward)
    const eyeing = crow.mode === 'eyeing'
    let swap = false
    if (eyeing) {
      if (this._eyeingFor - dt <= 0) {
        this._eye = Math.abs(turnFor(1)) < Math.abs(turnFor(-1)) ? 1 : -1 // the near eye first
        this._holdFor = 0
      }
      swap = this._eyeingFor >= EYEING_SWAP && this._eyeingFor - dt < EYEING_SWAP
    } else if ((this._swapFor -= dt) <= 0) swap = true
    if (Math.abs(turnFor(this._eye)) > NECK_TURN) swap = true
    if (swap) {
      this._eye = -this._eye
      this._swapFor = between(SWAP_EVERY)
      this._holdFor = 0
    }
    const turn = THREE.MathUtils.clamp(turnFor(this._eye), -NECK_TURN, NECK_TURN)
    if ((this._holdFor -= dt) <= 0 || Math.abs(turn - this._gazeYaw) > 0.5) {
      const settle = eyeing ? 0 : 0.04 // a look held off him by a hair, as a bird's is
      this._gazeYaw = turn + (Math.random() - 0.5) * 2 * settle
      this._gazeRoll = this._eye * below * LOOK_ROLL + (Math.random() - 0.5) * 0.12
      this._holdFor = between(HOLD)
    }
    if (glance !== 0) this._gazeYaw = THREE.MathUtils.clamp(turn + glance, -NECK_TURN, NECK_TURN)
  }

  // A small thing it does on its perch now and then, laid over pose `p`: its head cocked to one
  // side, a glance away (the angle returned, for the look), its tail flicked, its feathers
  // ruffled, its weight shifted.
  _idleOver(p, dt) {
    if (!this._idle) {
      if ((this._untilIdle -= dt) > 0) return 0
      let pick = Math.random() * Object.values(IDLES).reduce((sum, [, odds]) => sum + odds, 0)
      const kind = Object.keys(IDLES).find((name) => (pick -= IDLES[name][1]) <= 0) ?? 'tilt'
      this._idle = { kind, for: 0, side: Math.random() < 0.5 ? -1 : 1 }
    }
    const idle = this._idle
    idle.for += dt
    const t = idle.for / IDLES[idle.kind][0]
    if (t >= 1) {
      this._idle = null
      this._untilIdle = between(IDLE_EVERY)
      return 0
    }
    const on = hump(t)
    if (idle.kind === 'tilt') p.tilt += 0.5 * idle.side * on
    if (idle.kind === 'flick') {
      p.tail -= 0.4 * on
      p.fan += 0.4 * on
    }
    if (idle.kind === 'ruffle') {
      p.fold -= 0.12 * on
      p.lift += 0.1 * on * Math.sin(idle.for * 34)
      p.drop -= 0.004 * on
    }
    if (idle.kind === 'shift') {
      p.knee += 0.15 * on
      p.drop += 0.008 * on
    }
    return idle.kind === 'glance' ? 1.1 * idle.side * on : 0
  }

  // The stolen cigarette: in the beak while it is carried, a drag now and then on a perch, smoke
  // off it all the while. Returns how far back the head is tipped for a drag, 0 to 1.
  _smoke(crow, dt, effects) {
    const cigarette = this._cigarette.group
    cigarette.visible = crow.carrying
    if (!crow.carrying) {
      this._drag = -1
      this._demoBegun = false
      return 0
    }
    this._cigarette.setBurn(crow.burnAge / BURN_SECONDS, crow.ashAge / ASH_SECONDS)
    if (crow.ashFalls < this._ashSeen) this._ashSeen = 0
    if (crow.ashFalls > this._ashSeen) {
      this.group.updateMatrixWorld(true)
      effects.cigaretteAsh(this._cigarette.ember.getWorldPosition(_at), crow.vel, CIGARETTE.grown)
      this._ashSeen = crow.ashFalls
    }
    if (crow.smokeDemo && !this._demoBegun) {
      this._untilDrag = 0
      this._demoBegun = true
    }
    if (this._drag < 0 && (this._untilDrag -= dt) <= 0) this._drag = 0
    let tipped = 0
    let inhaling = false
    if (this._drag >= 0) {
      this._drag += dt
      tipped = THREE.MathUtils.smoothstep(this._drag, 0, 0.4) * (1 - THREE.MathUtils.smoothstep(this._drag, 1.2, 1.6))
      inhaling = this._drag < 1
      if (crow.mode === 'perched' && this._drag >= DRAG_EXHALE && this._drag < DRAG_EXHALE + EXHALE_SECONDS) {
        this.group.updateMatrixWorld(true)
        this.head.localToWorld(_at.set(0, 0, this.body.beakTip))
        this.head.getWorldDirection(_ahead)
        effects.exhale(_at, _ahead, crow.vel, PUFF, crow)
      }
      if (this._drag >= DRAG_SECONDS) {
        this._drag = -1
        this._untilDrag = between(crow.smokeDemo ? DEMO_DRAG_EVERY
          : crow.mode === 'perched' ? DRAG_EVERY : FLIGHT_DRAG_EVERY)
      }
    }
    this._coal = inhaling ? Math.min(1, this._coal + 3 * dt) : this._coal * Math.exp(-4 * dt)
    const glow = 0.8 + 0.2 * this._coal + 0.02 * Math.sin(this._clock * 7)
    for (const { material, color } of this._glow) material.color.copy(color).multiplyScalar(glow)
    this.group.updateMatrixWorld(true)
    effects.ribbon(this._cigarette.ember.getWorldPosition(_at), crow.vel, crow)
    return tipped
  }
}
