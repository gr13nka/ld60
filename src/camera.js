// The player's view, through his eyes. It looks along the player's aim; speed is felt as a
// widening field of view (the number is the HUD's, in its gas dial); and what it draws nearest
// is never inside anything solid: the eye is brought back toward a point his body keeps clear
// (`keep-clear.js`) as far as that needs, which is how a game's camera keeps out of its walls.

import * as THREE from 'three'
import { clearAlong } from './keep-clear.js'

const BASE_FOV = 72
const FOV_KICK = 30 // extra degrees at full rush
const RUSH_FROM = 28 // m/s where the sense of speed starts
const RUSH_TO = 95 // m/s where it saturates
// Metres from the eye that the picture begins, its middle; its corners are further out
// (`_keepClear`), a metre at full rush in the widest frame. Nearer is coarser far off: the
// ink, the creases and the mist are drawn from depth, and at `NEAR_CLOSE` a band laid a few
// centimetres proud of a wall flickered through it a few hundred metres away.
const NEAR = 0.3
const NEAR_CLOSE = 0.08 // the same while anything solid is within `NEAR`'s corners: a wall at his shoulder, a roof over his head, a wall grazed in flight
const SKIN = 0.02 // metres kept clear beyond the corners
const RELEASE_RATE = 12 // 1/s the eye goes back out once what held it in is passed; it comes in at once. A guess
const CLOSE_HOLD = 0.12 // seconds: a rung or ramp seam cannot switch the near plane every frame
const ROLL_SHARE = 0.5 // how much of the body's bank the view takes on
const BUFFET_REACH = 0.06 // metres the wind knocks the view about at full rush
const BUFFET_ROLL = 0.007 // radians it rocks it
const BUFFET_RATE = 34 // how fast, in radians per second
const JOLT_REACH = 0.35 // metres a jolt of 1 knocks the eye about by
const JOLT_ROLL = 0.05 // radians a jolt rocks the horizon either way, at its hardest
const JOLT_FULL = 2 // the shake that rocks it that far; a station underfoot is 1.8

const _aim = new THREE.Vector3()
const _from = new THREE.Vector3()
const _probe = new THREE.Vector3()
const _normal = new THREE.Vector3()

const ease = (rate, dt) => 1 - Math.exp(-rate * dt)

/** How fast `speed` should feel, 0 to 1. Shared by the FOV kick and the speed lines. */
export function rushOf(speed) {
  return THREE.MathUtils.clamp((speed - RUSH_FROM) / (RUSH_TO - RUSH_FROM), 0, 1)
}

export class PlayerCamera {
  /** `pushOut(point, radius, normal)` is the world's `eyeOutOfSolids`: what the eye keeps out of. */
  constructor(pushOut) {
    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, NEAR, 5000)
    this._pushOut = pushOut
    this._shake = 0
    /**
     * Whether a jolt rocks the horizon as well as knocking the view about. About the line of
     * sight only, so what the crosshair is on stays under it.
     */
    this.rolls = true
    this._fov = BASE_FOV // as speed has it, before any kick
    this._buffet = 0 // the wind's clock
    this._out = 1 // how far the eye is out from the point kept clear toward where it was asked to be, 0 to 1
    this._closeFor = 0
    this._snap = true
  }

  resize(aspect) {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  /** Adds a jolt; 1 is a station exploding underfoot. */
  shake(amount) {
    this._shake = Math.max(this._shake, amount)
  }

  /** Makes the next update jump straight to its view instead of easing into it. */
  snap() {
    this._snap = true
  }

  /**
   * Looks from `eye` along the unit vector `aim`, with the unit vector `up` toward the top of
   * the picture (the world's, but for a view gone over the top). `speed` drives the FOV kick and `bank`
   * (-1..1, + = right wing down) tilts the horizon. `kick` is degrees of view
   * added on top for the moment, unsmoothed: a blast's (`impact.js`). `nod` is radians the view
   * is tipped down from `aim`, which a runner's step does (`foot-view.js`) and a flight never.
   * `from` is a point his body keeps clear of solids, which the eye is brought back toward as
   * far as it must be; null for a scene's eye (a crash, a walk away), placed as it is given.
   */
  update(dt, eye, aim, up, speed, bank, kick = 0, nod = 0, from = null) {
    const { camera } = this
    this._fov = THREE.MathUtils.lerp(this._fov, BASE_FOV + FOV_KICK * rushOf(speed), ease(5, dt))
    const fov = this._fov + kick

    camera.position.copy(eye)
    let jolt = 0
    if (this._shake > 0.001) {
      const reach = this._shake * JOLT_REACH
      camera.position.x += (Math.random() - 0.5) * reach
      camera.position.y += (Math.random() - 0.5) * reach
      camera.position.z += (Math.random() - 0.5) * reach
      // Squared, so that a landing barely tips the horizon and a blast throws it.
      const hard = Math.min(1, this._shake / JOLT_FULL)
      if (this.rolls) jolt = (Math.random() - 0.5) * 2 * JOLT_ROLL * hard * hard
      this._shake *= Math.exp(-5 * dt)
    }
    // Wind buffeting: nothing until the rush starts, then growing fast. Smooth, unlike a blast's jolt.
    const rush = rushOf(speed)
    const wind = rush * rush
    this._buffet += dt * BUFFET_RATE
    const t = this._buffet
    camera.position.x += Math.sin(t) * Math.sin(t * 0.37 + 1) * BUFFET_REACH * wind
    camera.position.y += Math.sin(t * 1.31 + 2) * Math.sin(t * 0.53) * BUFFET_REACH * wind
    const near = this._keepClear(camera.position, from, fov, dt)
    this._snap = false

    camera.up.copy(up)
    camera.lookAt(_aim.copy(eye).addScaledVector(aim, 30))
    // A camera looks down its own -Z, so rolling the right side down is a negative turn about it.
    const roll = -bank * ROLL_SHARE + Math.sin(t * 0.83 + 4) * BUFFET_ROLL * wind
    if (nod !== 0) camera.rotateX(-nod)
    camera.rotateZ(roll + jolt)

    if (Math.abs(fov - camera.fov) > 0.01 || camera.near !== near) {
      camera.near = near
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    // What is placed on screen this frame (a lesson's ring, the goal pointer) is projected
    // through the camera before the renderer would bring its matrices up to date; `lookAt`
    // leaves them a turn behind.
    camera.updateMatrixWorld()
  }

  // Brings the eye at `position` back toward `from` as far as keeps the picture's nearest
  // corners out of anything solid, and says where the picture begins: nearer the eye while
  // anything is within reach of the corners it would otherwise have. Seen with a view `fov`
  // degrees high.
  _keepClear(position, from, fov, dt) {
    if (from === null) {
      this._out = 1
      this._closeFor = 0
      return NEAR
    }
    // The corners of a picture that begins `near` from the eye are this many times as far.
    const tan = Math.tan(THREE.MathUtils.degToRad(fov) / 2)
    const corner = Math.sqrt(1 + tan * tan * (1 + this.camera.aspect ** 2))
    const close = this._pushOut(_probe.copy(position), NEAR * corner + SKIN, _normal)
    this._closeFor = close ? CLOSE_HOLD : Math.max(0, this._closeFor - dt)
    const near = this._closeFor > 0 ? NEAR_CLOSE : NEAR
    const out = clearAlong(this._pushOut, _from.copy(from), position, near * corner + SKIN)
    this._out = this._snap || out < this._out ? out : this._out + (out - this._out) * ease(RELEASE_RATE, dt)
    position.lerpVectors(_from, position, this._out)
    return near
  }
}
