// The raccoon on screen (`raccoon.js` says what he does; `raccoon-body.js` is his body,
// `raccoon-poses.js` his poses): the poses mixed by what he is doing and eased between, so that
// nothing snaps, with the waddle laid over them by how far he has walked, and the small things an
// animal does that make it somebody: his head follows the runner's eye, his ears go back, he
// sniffs, he glances away, he settles his tail. He asks for a light as a courtier would, and when
// he has it he takes his first drag with his eyes shut, puffs, and bows with his cap in his paw.
// At home he sits and smokes, and now and then takes a drag. The cigarette is always in his right
// paw, unlit until `raccoon.lit`. Look only.

import * as THREE from 'three'
import { createCigarette, materials } from './models.js'
import { ASH_SECONDS, BURN_SECONDS, GREET_SECONDS, OFFER_SECONDS, SIZE, THANK_SECONDS, WAVE_SECONDS } from './raccoon.js'
import { CIGARETTE_LENGTH, CIGARETTE_RADIUS, createRaccoonBody } from './raccoon-body.js'
import { POSES, mixPoses, overlay, stride, swing } from './raccoon-poses.js'

const STRIDE_LENGTH = 0.8 * SIZE // metres walked in a whole cycle of two steps: his legs are short
const WALK_PACE = 2 // m/s at which the waddle is at full strength (`raccoon.js`'s WALK)
const EASE = 7 // per second: how quickly the poses go one into the next
const LOOK_WITHIN = 20 // metres from him within which the runner is watched
const HEAD_HEIGHT = 0.72 * SIZE // and from his feet to his head, stood up
const NECK_TURN = 1.1 // radians the head turns either way before the body has to
const GAZE_UP = 0.4 // of how far above his head the runner's eye is, how far his nose goes up to it
const TURN = 9 // the stiffness of the spring that brings the head to where it looks, per second
const IDLE_EVERY = [2.5, 6] // seconds between his small things
// Each small thing: how long it takes and how likely it is.
const IDLES = { glance: [1.1, 0.35], sniff: [0.9, 0.25], ears: [0.35, 0.2], tail: [0.8, 0.2] }
const GREET_LIFT = 0.4 // seconds the cap takes to go up, and to come down again
const GREET_NOD = [0.55, 1.05] // seconds into the greeting over which he nods
const WAVE_EASE = 0.25 // seconds his arm takes to go up, and to come down
const WAVE_RATE = 15.7 // radians a second the wave swings at: two and a half swings
const NOD_SECONDS = 0.4 // of the nod with each chirr
const DRAG_EVERY = [18, 28] // seconds between drags at home
const DRAG_SECONDS = 2.2
const DRAG_EXHALE = 1.5 // seconds into a drag at which the smoke goes out
const EXHALE_SECONDS = 0.55
const THANK_PUFF = [1.35, 1.8] // seconds into his thanks over which he puffs
const PUFF = 1.2 * SIZE // the size of his breath of smoke, as `effects.exhale` takes it
const ASH_SCALE = 1.2 // and of the ash that falls from his cigarette
const NAMES = Object.keys(POSES)

const between = ([low, high]) => low + Math.random() * (high - low)
// `state` (`{ x, v }`, where it is and how fast it goes) pulled toward `to` for `dt` seconds by a
// critically damped spring of `rate` per second; its new place. As the crow's head is.
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
const ramp = (t, from, to) => THREE.MathUtils.smoothstep(t, from, to)
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))
// His shadow, as the PlayStation's characters had theirs: a soft dark patch on the ground under
// him, in place of the sun's (`raccoon-body.js` says why). Metres across and along him, how dark
// at its middle, and how far over the ground it lies, so as not to flicker into it.
const SHADOW_SIZE = [0.8, 1]
const SHADOW_DARK = 0.45
const SHADOW_LIFT = 0.01

const _at = new THREE.Vector3()
const _ahead = new THREE.Vector3()
const _vel = new THREE.Vector3()

// The patch his shadow is drawn as, made once: black, fading from SHADOW_DARK at its middle to
// nothing at its edge. It writes no depth, so the ink draws no line round it.
function shadowPatch() {
  return (shadowPatch.made ??= (() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const draw = canvas.getContext('2d')
    const fade = draw.createRadialGradient(32, 32, 0, 32, 32, 32)
    fade.addColorStop(0, `rgba(0, 0, 0, ${SHADOW_DARK})`)
    fade.addColorStop(0.55, `rgba(0, 0, 0, ${SHADOW_DARK * 0.7})`)
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)')
    draw.fillStyle = fade
    draw.fillRect(0, 0, 64, 64)
    const geometry = new THREE.PlaneGeometry(SHADOW_SIZE[0], SHADOW_SIZE[1]).rotateX(-Math.PI / 2)
    const material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false })
    return { geometry, material }
  })())
}

export class RaccoonFigure {
  constructor() {
    this.body = createRaccoonBody()
    this.group = this.body.group
    this.group.scale.setScalar(SIZE) // the body is built at the size he was made as
    this.head = this.body.head
    this._cigarette = createCigarette(CIGARETTE_LENGTH, CIGARETTE_RADIUS)
    this.body.paw.add(this._cigarette.group)
    // The ember's own materials, to brighten on a drag without brightening every fire.
    this._glow = this._cigarette.ember.children
      .filter((piece) => piece.material === materials.ember || piece.material === materials.flame)
      .map((piece) => {
        piece.material = piece.material.clone()
        return { material: piece.material, color: piece.material.color.clone() }
      })
    this._pose = {}
    this._w = Object.fromEntries(NAMES.map((name) => [name, name === 'sit' ? 1 : 0])) // the poses as shown
    this._strength = 0 // of the waddle, as shown
    this._clock = Math.random() * 10
    this._yaw = { x: 0, v: 0 } // the head's turn and nod as shown, each on its spring
    this._pitch = { x: 0, v: 0 }
    this._chirrs = 0
    this._nod = Infinity // seconds since the last chirr
    this._idle = null // `{ kind, for, side }`: a small thing he is doing
    this._untilIdle = between(IDLE_EVERY)
    this._drag = -1 // seconds into a drag at home, or -1
    this._untilDrag = between(DRAG_EVERY)
    this._coal = 0 // how bright the ember is drawn on, 0 to 1
    this._ashSeen = 0
    this._cigarette.ember.visible = false
    const { geometry, material } = shadowPatch()
    this._shadow = new THREE.Mesh(geometry, material)
    this._shadow.position.y = SHADOW_LIFT
    this.group.add(this._shadow)
  }

  /**
   * Shows `raccoon` (a `Raccoon`) as he now is, drawn on along his heading by `ahead` seconds past
   * his last step; `focus` is the runner's eye, smoke goes to `effects`.
   */
  show(raccoon, dt, ahead, focus, effects) {
    const { mode } = raccoon
    this._clock += dt
    this._nod += dt
    if (raccoon.chirrs !== this._chirrs) {
      this._chirrs = raccoon.chirrs
      this._nod = 0
    }
    if (mode !== 'smoking') this._drag = -1

    // What he is doing, as weights of his poses, eased so that a change is a movement.
    const want = this._wanted(raccoon)
    for (const name of NAMES) this._w[name] += ((want[name] ?? 0) - this._w[name]) * Math.min(1, EASE * dt)
    const p = mixPoses(this._w, this._pose)

    // The waddle by how far he has walked, easing in and out with his pace.
    this._strength += (Math.min(1, raccoon.pace / WALK_PACE) - this._strength) * Math.min(1, 8 * dt)
    stride(p, (raccoon.walked / STRIDE_LENGTH) * Math.PI * 2, this._strength)

    // His wave before he sets off, eased in and out at the ends.
    if (raccoon.mode === 'waving') {
      const w = ramp(raccoon.modeFor, 0, WAVE_EASE) * (1 - ramp(raccoon.modeFor, WAVE_SECONDS - WAVE_EASE, WAVE_SECONDS))
      overlay(p, 'wave', w)
      swing(p, raccoon.modeFor * WAVE_RATE, w)
    }

    // His greeting, laid over the legs and the rest: the cap up in the left paw, a warm nod in the
    // middle of it, the cap back on his head by the end.
    if (raccoon.greetFor >= 0) {
      const g = raccoon.greetFor
      overlay(p, 'greet', ramp(g, 0, GREET_LIFT) * (1 - ramp(g, GREET_SECONDS - GREET_LIFT, GREET_SECONDS)))
      this._greet(p, (g - GREET_NOD[0]) / (GREET_NOD[1] - GREET_NOD[0]))
    }

    // Breathing, a nod with each chirr, the tail's settling.
    p.lean += 0.012 * Math.sin(this._clock * 1.9)
    p.bend += 0.01 * Math.sin(this._clock * 1.9 + 1)
    const nod = hump(this._nod / NOD_SECONDS)
    p.headPitch += 0.25 * nod
    p.bend += 0.06 * nod
    p.ears -= 0.25 * nod

    // After an exhale his head goes back, as the smoke is blown up and away.
    const breath = this._exhaling(raccoon)
    p.headPitch -= 0.35 * hump(breath)
    const glance = this._idleOver(p, dt)
    this._watch(raccoon, focus, dt, glance, p)

    this.group.position.copy(raccoon.pos)
    this.group.position.x += Math.sin(raccoon.yaw) * raccoon.pace * ahead
    this.group.position.z += Math.cos(raccoon.yaw) * raccoon.pace * ahead
    this.group.rotation.y = raccoon.yaw
    this.body.pose(p)
    this._smoke(raccoon, dt, effects)
  }

  /**
   * For the pose sheet (`itch/raccoon-sheet.html`): drawn at the origin facing +Z in pose `name`
   * of `raccoon-poses.js`, his waddle `phase` of the way round at `strength` (none unless given), the arm waving if `wave`, the cap raised by `greet` (0 to 1) and at the bottom of his nod if `nod`,
   * his head turned and cocked by `lookYaw` and `tilt`, the cigarette in his paw if `cigarette`,
   * lit if `lit`.
   */
  showPose(name, { phase = 0, strength = 0, lookYaw = 0, tilt = 0, cigarette = true, lit = false, greet = 0, nod = 0, wave = 0 } = {}) {
    this._cigarette.group.visible = cigarette
    this._cigarette.ember.visible = lit
    this._cigarette.setBurn(0, 0)
    const p = stride(mixPoses({ [name]: 1 }, this._pose), phase, strength)
    if (wave > 0) swing(overlay(p, 'wave', wave), 0.8, wave)
    if (greet > 0) overlay(p, 'greet', greet)
    if (nod > 0) this._greet(p, 0.5)
    p.lookYaw += lookYaw
    p.tilt += tilt
    this.group.position.set(0, 0, 0)
    this.group.rotation.set(0, 0, 0)
    this.body.pose(p)
  }

  // The weights he is working toward in each mode. He holds the cigarette out as he arrives; thanked, he takes a drag, puffs, and bows
  // with the cap lifted.
  _wanted(raccoon) {
    const { mode, modeFor } = raccoon
    switch (mode) {
      case 'rising':
      case 'waving':
        return { stand: 1 }
      case 'walking':
      case 'leaving':
        return { walk: 1 }
      case 'asking': {
        if (raccoon.greetFor >= 0) return { stand: 1 } // still greeting, his cap up
        const ask = ramp(modeFor, 0, OFFER_SECONDS)
        return { walk: 1 - ask, ask }
      }
      case 'catching':
        return { catch: 1 }
      case 'thanking': {
        const drag = ramp(modeFor, 0, 0.35) * (1 - ramp(modeFor, 1.1, 1.4))
        const bow = ramp(modeFor, 1.5, 1.95) * (1 - ramp(modeFor, 2.55, THANK_SECONDS - 0.1))
        return { stand: Math.max(0, 1 - drag - bow), drag, bow }
      }
      case 'smoking': {
        const drag = this._drag < 0 ? 0 : ramp(this._drag, 0, 0.45) * (1 - ramp(this._drag, 1.3, 1.7))
        return { sit: 1 - drag, sitDrag: drag }
      }
      default: // waiting
        return { sit: 1 }
    }
  }

  // The greeting's nod, `t` of the way through it (0 to 1): the head and chest dip and come back.
  _greet(p, t) {
    const nod = hump(t)
    p.headPitch += 0.3 * nod
    p.bend += 0.15 * nod
  }

  // How far into an exhale he is, 0 to 1, or -1 when he is not blowing smoke.
  _exhaling(raccoon) {
    if (raccoon.mode === 'thanking') return (raccoon.modeFor - THANK_PUFF[0]) / (THANK_PUFF[1] - THANK_PUFF[0])
    if (this._drag >= DRAG_EXHALE - 0.1) return (this._drag - DRAG_EXHALE + 0.1) / (EXHALE_SECONDS + 0.4)
    return -1
  }

  // Where his head is to be: on the runner's eye when he is within LOOK_WITHIN and not behind
  // him, a glance away (an angle off him, from `_idleOver`) when he has one, otherwise straight
  // ahead. His head turns by `p.lookYaw` and nods by `p.headPitch`, each on a spring.
  _watch(raccoon, focus, dt, glance, p) {
    const dx = focus.x - raccoon.pos.x
    const dz = focus.z - raccoon.pos.z
    const apart = Math.hypot(dx, dz)
    const bearing = wrap(Math.atan2(dx, dz) - raccoon.yaw) // positive to his left
    const seeing = apart < LOOK_WITHIN && Math.abs(bearing) < 2.4
    const headAt = raccoon.pos.y + (raccoon.mode === 'smoking' || raccoon.mode === 'waiting' ? 0.55 * SIZE : HEAD_HEIGHT)
    const elevation = Math.atan2(focus.y - headAt, Math.max(apart, 0.3))
    let yaw = 0
    let pitch = 0
    if (seeing) {
      yaw = THREE.MathUtils.clamp(bearing, -NECK_TURN, NECK_TURN)
      pitch = -THREE.MathUtils.clamp(elevation, -0.3, 1) * GAZE_UP
    }
    if (glance !== 0) yaw = THREE.MathUtils.clamp(yaw + glance, -NECK_TURN, NECK_TURN)
    p.lookYaw += spring(this._yaw, yaw, TURN, dt)
    p.headPitch += spring(this._pitch, pitch, TURN, dt)
  }

  // A small thing he does now and then, laid over pose `p`: a glance away (the angle returned, for
  // the look), a sniff of the air, a flick of his ears, a twitch of his tail.
  _idleOver(p, dt) {
    if (!this._idle) {
      if ((this._untilIdle -= dt) > 0) return 0
      let pick = Math.random() * Object.values(IDLES).reduce((sum, [, odds]) => sum + odds, 0)
      const kind = Object.keys(IDLES).find((name) => (pick -= IDLES[name][1]) <= 0) ?? 'glance'
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
    if (idle.kind === 'sniff') p.headPitch -= 0.25 * on * (0.5 + 0.5 * Math.sin(idle.for * 22))
    if (idle.kind === 'ears') p.ears += 0.6 * on * Math.abs(Math.sin(idle.for * 18))
    if (idle.kind === 'tail') p.tailSway += 0.7 * on * Math.sin(idle.for * 9)
    return idle.kind === 'glance' ? 0.8 * idle.side * on : 0
  }

  // His cigarette: the coal and ash drawn once it is lit, smoke off it all the while, a drag at
  // home now and then with a puff out of his mouth, and the same in his thanks.
  _smoke(raccoon, dt, effects) {
    const cigarette = this._cigarette
    cigarette.group.visible = true
    cigarette.ember.visible = raccoon.lit
    cigarette.setBurn(raccoon.burnAge / BURN_SECONDS, raccoon.ashAge / ASH_SECONDS)
    if (!raccoon.lit) {
      this._ashSeen = 0
      this._coal = 0
      return
    }
    _vel.set(Math.sin(raccoon.yaw) * raccoon.pace, 0, Math.cos(raccoon.yaw) * raccoon.pace)
    this.group.updateMatrixWorld(true)
    if (raccoon.ashFalls < this._ashSeen) this._ashSeen = 0
    if (raccoon.ashFalls > this._ashSeen) {
      effects.cigaretteAsh(cigarette.ember.getWorldPosition(_at), _vel, ASH_SCALE)
      this._ashSeen = raccoon.ashFalls
    }

    // The drags: his thanks holds the first, at home the next come every so often.
    if (raccoon.mode === 'smoking') {
      if (this._drag < 0 && (this._untilDrag -= dt) <= 0) this._drag = 0
      if (this._drag >= 0) {
        this._drag += dt
        if (this._drag >= DRAG_SECONDS) {
          this._drag = -1
          this._untilDrag = between(DRAG_EVERY)
        }
      }
    }
    const thanks = raccoon.mode === 'thanking'
    const inhaling = thanks ? raccoon.modeFor < 1.2 : this._drag >= 0 && this._drag < 1
    const breathing = thanks
      ? raccoon.modeFor >= THANK_PUFF[0] && raccoon.modeFor < THANK_PUFF[1]
      : this._drag >= DRAG_EXHALE && this._drag < DRAG_EXHALE + EXHALE_SECONDS
    if (breathing) {
      this.body.mouth.getWorldPosition(_at)
      this.head.getWorldDirection(_ahead)
      effects.exhale(_at, _ahead, _vel, PUFF, raccoon)
    }
    this._coal = inhaling ? Math.min(1, this._coal + 3 * dt) : this._coal * Math.exp(-4 * dt)
    const glow = 0.8 + 0.2 * this._coal + 0.02 * Math.sin(this._clock * 7)
    for (const { material, color } of this._glow) material.color.copy(color).multiplyScalar(glow)
    effects.ribbon(cigarette.ember.getWorldPosition(_at), _vel, raccoon)
  }
}
