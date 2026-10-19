// Wingsuit glide physics: you fly where you look. Height and speed are one currency —
// looking down buys speed, looking up spends it, and turning hard costs a little, less for
// pulling up or pushing over than for a turn to the side: the view may go over the top, and a
// loop has to be flyable. Passing low
// over the ground or close by something solid buys a little more. Gas, while
// the caller has any to give, pushes along the flight path. That is a level's suit, thrown by
// blasts; the parkour's is given nothing and is a wing (`wingsuit.js`). Nothing caps the speed: past
// `dragTopSpeed` the air holds back no harder, so pushes kept chained go on adding to it.
// Knows nothing about the scene; callers describe the surroundings and get back a mutated body.

import { MathUtils, Vector3 } from 'three'

export const TUNING = {
  gravity: 25, // m/s²
  drag: 0.003, // quadratic; sets top dive speed and the glide slope
  dragTopSpeed: 100, // m/s, over a dive's own top speed; drag grows no further past it, so pushes kept chained go on gaining
  glideSpeed: 32, // m/s; at or above this the suit carries its own weight
  stallSpeed: 16, // m/s; at or below this looking around steers nothing
  turnRate: 2.4, // rad/s the flight path can swing toward the view at full authority
  turnDrag: 0.1, // fraction of speed lost per radian turned to the side
  pitchDrag: 0.03, // the same per radian pitched up or down: what a loop is charged
  noseDrop: 3.2, // rad/s the path falls away at when the suit carries nothing
  gasAccel: 24, // m/s² along the flight path at full gas
  minSpeed: 3, // m/s
  skimHeight: 9, // flying lower than this over terrain accelerates you
  skimMinSpeed: 30, // m/s
  skimAccel: 14, // m/s² at the lowest skim
  brushAccel: 8, // m/s² right against something solid: the same rush, sideways
  grazeAngle: 0.35, // radians; a path meeting a surface more squarely than this is a crash
  grazeCost: 0.1, // fraction of speed a graze takes
  grazeSeconds: 0.25, // steering is dulled this long after one, or the path turns straight back in
  bankPerYawRate: 0.7, // visual roll per rad/s of turn
  tumbleSeconds: 0.9, // after a blast you are a projectile before you are a pilot
  liftTumbleSeconds: 0.55, // shorter for a blast you were only flying over
}

const _dir = new Vector3()
const _axis = new Vector3()

/**
 * A flight body. `bank` is the visual roll in [-1, 1] (+ = right wing down), `skim` the
 * ground-rush strength in [0, 1], `brush` the same for passing close to something solid,
 * `tumble` the seconds left before steering fully returns.
 */
export function createBody() {
  return { pos: new Vector3(), vel: new Vector3(), bank: 0, skim: 0, brush: 0, tumble: 0 }
}

/** Throws the body along heading `yaw` (0 = +Z) climbing at `pitch` radians, at `power` m/s. */
export function launch(body, yaw, pitch, power) {
  const flat = Math.cos(pitch) * power
  body.vel.set(Math.sin(yaw) * flat, Math.sin(pitch) * power, Math.cos(yaw) * flat)
  body.bank = 0
  body.skim = 0
  body.brush = 0
  body.tumble = TUNING.tumbleSeconds
}

/**
 * Throws an already flying body upward by `up` m/s and onward by `push` m/s, as a blast
 * below it does. Steering is briefly dulled so the lift becomes height rather than just speed.
 */
export function lift(body, up, push) {
  const { vel } = body
  const flat = Math.hypot(vel.x, vel.z) || 1
  vel.x += (vel.x / flat) * push
  vel.z += (vel.z / flat) * push
  vel.y = Math.max(vel.y, 0) + up
  body.tumble = Math.max(body.tumble, TUNING.liftTumbleSeconds)
}

/**
 * A body that has touched a surface facing along the unit vector `normal`: if its path meets
 * the surface at a glancing angle it is turned along it, at a cost in speed, and true is
 * returned. Met more squarely the body is left alone and false returned: that is a crash.
 */
export function graze(body, normal) {
  const T = TUNING
  const { vel } = body
  const into = -vel.dot(normal)
  if (into <= 0) return true // already leaving it
  if (into > vel.length() * Math.sin(T.grazeAngle)) return false
  vel.addScaledVector(normal, into).multiplyScalar(1 - T.grazeCost)
  body.tumble = Math.max(body.tumble, T.grazeSeconds)
  return true
}

/**
 * The drag, in m/s², that a body at `speed` m/s (in its own time: a caller with a `pace`
 * divides by it) is spared by drag levelling off at `dragTopSpeed`: 0 below it. A push that
 * is meant to carry a body up to a speed and no further gives this much less.
 */
export function dragSpared(speed) {
  const T = TUNING
  return T.drag * (speed * speed - Math.min(speed, T.dragTopSpeed) ** 2)
}

/**
 * Advances the body by `dt`.
 * `controls.aim`: unit vector the player is looking along; `gasStrength` is how much thrust there is
 * to be had, 0 to 1.
 * `air.clearance`: metres to the terrain below; `air.updraft`: upward acceleration, in m/s², from
 * whatever air is rising here: burning trees, a flare stack, a stairway; `air.brush`: how near
 * something solid is passing, 0 to 1.
 * `pace` is how many times as fast the body lives as the tuning was written for: it flies
 * the same paths through the air in that part of the time, so its speeds are `pace` times a
 * level's and whatever pushes it pushes `pace` squared as hard. A turn costs speed by its plane
 * (`turnDrag` to the side, `pitchDrag` up or down). Only the turn of the path
 * toward the view keeps the clock's time: turning as fast as it flies, it answered every
 * twitch of the hand. Speeds given to it from outside (`launch`, `lift`) are the caller's to
 * multiply.
 */
export function step(body, controls, air, dt, pace = 1) {
  const T = TUNING
  const { vel } = body
  // Everything below is in the body's own time, where the tuning's numbers hold as written.
  vel.divideScalar(pace)
  dt *= pace
  let speed = Math.max(vel.length(), 0.001)
  _dir.copy(vel).divideScalar(speed)
  const yawBefore = Math.atan2(_dir.x, _dir.z)

  body.tumble = Math.max(0, body.tumble - dt)
  const control = 1 - body.tumble / T.tumbleSeconds
  const authority = control * MathUtils.clamp((speed - T.stallSpeed) / (T.glideSpeed - T.stallSpeed), 0, 1) ** 2
  const carry = Math.min(1, (speed / T.glideSpeed) ** 2)

  const offAim = _dir.angleTo(controls.aim)
  let turned = 0
  let turnDrag = T.turnDrag
  if (offAim > 1e-4) {
    turned = Math.min(offAim, (T.turnRate * authority * dt) / pace)
    _axis.crossVectors(_dir, controls.aim)
    if (_axis.lengthSq() < 1e-8) _axis.set(0, 1, 0)
    _dir.applyAxisAngle(_axis.normalize(), turned)
    // A turn to the side is about the vertical, a pull up about a level axis.
    turnDrag = MathUtils.lerp(T.pitchDrag, T.turnDrag, Math.abs(_axis.y))
  }

  _dir.y -= T.noseDrop * (1 - carry) * dt
  _dir.normalize()

  let accel = -T.gravity * _dir.y - T.drag * Math.min(speed, T.dragTopSpeed) ** 2 - turnDrag * (turned / dt) * speed
  accel += T.gasAccel * controls.gasStrength

  body.skim = 0
  if (air.clearance < T.skimHeight && speed > T.skimMinSpeed) {
    body.skim = 1 - Math.max(air.clearance, 0) / T.skimHeight
    accel += T.skimAccel * body.skim
  }
  body.brush = speed > T.skimMinSpeed ? air.brush ?? 0 : 0
  accel += T.brushAccel * body.brush

  speed = Math.max(T.minSpeed, speed + accel * dt)
  vel.copy(_dir).multiplyScalar(speed)
  // Below glide speed the suit stops carrying you: the shortfall is plain falling.
  vel.y += (air.updraft - T.gravity * (1 - carry)) * dt
  body.pos.addScaledVector(vel, dt)
  vel.multiplyScalar(pace)

  // Looking down +Z, world +X is on the left, so a right turn is a falling yaw.
  let yawRate = (Math.atan2(_dir.x, _dir.z) - yawBefore) / dt
  if (Math.abs(yawRate) > Math.PI / dt) yawRate = 0 // wrapped past ±π this step
  // A path going over the top swings its heading half a turn while turning nowhere: the nearer
  // the vertical, the less the heading says.
  yawRate *= Math.hypot(_dir.x, _dir.z)
  const bank = MathUtils.clamp(-yawRate * T.bankPerYawRate, -1, 1)
  body.bank += (bank - body.bank) * Math.min(1, 6 * dt)
}
