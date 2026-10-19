// The parkour's suit: a wing, not a ride. He flies where he looks, as a level's suit does,
// but the turn toward the view is lift, and lift is bought: it grows with the square of his
// speed and with how far the view is off the path, it costs speed as it is drawn
// (`induced`), and past `stallAngle` it lets go. So a level look sinks, by more the slower he
// is; a dive is paid back as a flare that really climbs, once; a hard turn is paid for in
// speed; asked for more than the air under it can give, it stalls. Nothing is given it: what
// it opens with is what was made on foot (`parkour.js`), and height is all it has to spend.
// The bank is only seen: the lean of the turn, gone in a dive. A level's suit, thrown by
// blasts, is `flight.js` and none of this.
// Knows nothing about the scene; callers describe the surroundings and get back a mutated body.

import { MathUtils, Vector3 } from 'three'

// Guesses on paper (2026-10-13), meant to come to: best glide 3 forward for 1 down near
// 42 m/s, a stall under 27 m/s, a dive that tops out near 104 m/s. The owner flew them and
// found the speeds "fine".
export const TUNING = {
  gravity: 25, // m/s²
  lift: 0.069, // m/s² of lift for each (m/s)² and radian of attack: at 42 m/s, 0.2 rad carries him
  drag: 0.0023, // the same of drag with no attack at all: what a dive tops out against
  induced: 0.0575, // and more for each radian² of attack: what a pull costs
  stallAngle: 0.5, // radians of attack past which the wing gives less, not more
  stallFade: 0.12, // radians over which it lets go
  stallLift: 0.6, // of its most, what a stalled wing still gives
  alphaMax: 0.7, // radians of attack at most, however far off the path he looks
  bankPerG: 0.06, // of a full bank, for each m/s² of the lift's pull to the side
  bankRate: 6, // 1/s the seen bank follows it at
  dulledSeconds: 0.9, // of `body.tumble` that take all the wing's say (`flight.js`'s `tumbleSeconds`)
  skimHeight: 9, // metres over a floor under which `skim` is told
  skimMinSpeed: 30, // m/s
}

const WORLD_UP = new Vector3(0, 1, 0)
const _path = new Vector3()
const _pull = new Vector3()
const _right = new Vector3()

/**
 * A suit on `body`, a flight body (`flight.createBody`). For reading: `alpha` — radians of
 * attack it flies at; `over` — how far it is stalled, 0 flying clean to 1 let go (`stallFade`);
 * `stalled` — whether it is asked for more than it gives, `over` past a half.
 */
export function createSuit(body) {
  return { body, alpha: 0, over: 0, stalled: false }
}

/** The suit opened, flying whatever the body is doing. */
export function open(suit) {
  Object.assign(suit, { alpha: 0, over: 0, stalled: false })
  Object.assign(suit.body, { bank: 0, skim: 0, brush: 0, tumble: 0 })
}

/**
 * Advances the suit by `dt`.
 * `controls.aim`: unit vector the player looks along.
 * `air.clearance`: metres to the floor below; `air.updraft`: upward acceleration, in m/s²,
 * of whatever air rises here; `air.brush`: how near something solid is passing, 0 to 1.
 * `body.skim` and `body.brush` are told as `flight.step` tells them and push nothing;
 * `body.bank` is the lean of the turn in [-1, 1], + for the right wing down, none in a dive;
 * `body.tumble` dulls the wing as it dulls a level's suit.
 */
export function step(suit, controls, air, dt) {
  const T = TUNING
  const { body } = suit
  const { vel } = body
  const { aim } = controls

  const speed = vel.length()
  if (speed > 1e-3) _path.copy(vel).divideScalar(speed)
  else _path.copy(aim)

  // The lift lies square to the path, toward the view.
  _pull.copy(aim).addScaledVector(_path, -aim.dot(_path))
  const off = _pull.length()
  if (off > 1e-6) _pull.divideScalar(off)

  body.tumble = Math.max(0, body.tumble - dt)
  const say = 1 - Math.min(1, body.tumble / T.dulledSeconds)
  const alpha = Math.min(Math.atan2(off, aim.dot(_path)), T.alphaMax) * say
  const over = MathUtils.smoothstep(alpha, T.stallAngle, T.stallAngle + T.stallFade)
  const bite = Math.min(alpha, T.stallAngle) * MathUtils.lerp(1, T.stallLift, over)
  suit.alpha = alpha
  suit.over = over
  suit.stalled = over > 0.5

  const q = speed * speed
  const lift = T.lift * q * bite
  vel.addScaledVector(_pull, lift * dt)
  vel.addScaledVector(_path, -q * (T.drag + T.induced * alpha * alpha) * dt)
  vel.y += (air.updraft - T.gravity) * dt
  body.pos.addScaledVector(vel, dt)

  const fast = speed > T.skimMinSpeed
  body.skim = fast && air.clearance < T.skimHeight ? 1 - Math.max(air.clearance, 0) / T.skimHeight : 0
  body.brush = fast ? air.brush ?? 0 : 0

  // Looking down +Z, world +X is on the left: his right is path × up. The lean fades as the
  // path nears the vertical, where nothing is to the side.
  _right.crossVectors(_path, WORLD_UP)
  const level = _right.length()
  const side = level > 1e-6 ? (_pull.dot(_right) / level) * lift : 0
  const bank = MathUtils.clamp(side * T.bankPerG, -1, 1) * level
  body.bank += (bank - body.bank) * Math.min(1, T.bankRate * dt)
}
