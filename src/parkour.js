// On foot, at the pace of the glide it leads to: speed is what a run-up is for. A run gives
// 20 m/s and no more; everything over that is made by moving well — a slide begun on landing,
// a jump timed to the touch of the ground, a wall taken at an angle, a ledge gone over
// without stopping, a slope slid down, a lit strip run across — and it is kept until
// something spends it: a wall met head on, a fall landed upright, standing still. What he
// has at a cliff's lip is what the suit opens with (`game.js`), so the run-up decides how far
// he flies. The moves are VHOLUME's (run, jump, slide, wall, climb), which are Mirror's Edge's
// and Titanfall's before it; the speeds are this game's.
// Knows nothing about the scene: the caller describes what stands about him (`site`) and
// gets back a moved runner and what happened this step.

import { Vector3 } from 'three'

export const TUNING = {
  gravity: 28, // m/s²
  runSpeed: 20, // m/s, what holding a key comes to
  runAccel: 90, // m/s² toward it: a quick start, with enough travel to feel the build
  stopAccel: 80, // m/s² when no direction is asked for
  reverseBrake: 120, // m/s² spent first when turning boosted speed back on itself
  runTax: 0.2, // of the speed over `runSpeed`, the share a second that is lost upright
  topSpeed: Infinity, // m/s along the ground he is held to. None: what is made is kept, and flown with. A place may ask for one (`paceFor`)
  topTax: 6, // of the speed over it, the share a second that is lost: a boost is still felt, and gone in half a second
  groundTurn: 4.7, // rad/s at most when steering speed over `runSpeed`
  groundGrip: 115, // m/s² of lateral acceleration: fast corrections, wider turns at high speed
  airAccel: 30, // m/s², only up to `runSpeed`: a jump from standing can still be placed
  airTurn: 1.8, // rad/s the path follows the view in the air, forward held: air control is the camera's
  jumpSpeed: 12.5, // m/s up: a rise of 2.8 m, 0.9 s in the air on the level
  coyoteSeconds: 0.14, // after running off an edge or a wall's end, a jump still counts
  bufferSeconds: 0.16, // a jump asked for this long before landing is made on landing: a hop
  hopBoost: 2, // m/s a hop timed that way adds
  jumpCut: 18, // m/s up, at most, once jump is let go while he still rises: at 5 a tap is a short hop of 1.4 m; at 18, the tuner's top, nothing is cut. Off since the owner liked the pass that brought it in less (2026-10-15)
  stepUp: 0.5, // metres of kerb run up without a jump
  height: 1.8,
  crouchHeight: 0.9, // sliding: what he fits under
  radius: 0.45,

  slideFrom: 8, // m/s at least to begin one
  slideBoost: 5, // m/s a slide begins with, standing still at
  slideBoostGone: 70, // m/s, where that has faded to nothing
  slideFriction: 2.2, // m/s² it loses on the level
  slideCap: 75, // m/s; over this a slide loses more
  slideCapTax: 0.6, // of the speed over the cap, the share a second
  slideTurn: 1.5, // rad/s at most while a movement key is held
  slideGrip: 36, // m/s² of lateral acceleration: a slide keeps its entry line at speed
  slideEnds: 6, // m/s it ends at by itself
  landingHolds: 24, // m/s; a wing's landing slides by itself until it is slower than this

  slopeSliding: 1, // of gravity along a slope that a slide down it gains
  slopeRunning: 0.5, // and a run down it; up it, both lose all of it
  stripCoolSeconds: 0.5, // between two boosts off strips

  softFall: 12, // m/s down that costs nothing on landing upright
  hardFall: 32, // m/s down that costs `fallTax` of the speed along the ground; a slide pays none
  fallTax: 0.6,

  wallFrom: 10, // m/s along the ground to take a wall
  wallAlong: 0.45, // of his speed, at least, has to be along it: met more squarely it is a wall
  wallFalling: 18, // m/s down, at most, to still take it
  wallOverFloor: 1.2, // metres of air under his feet, at least
  wallSeconds: 1.7,
  wallGravity: 4, // m/s² on a wall
  wallRise: 3, // m/s up it begins with, at least
  wallBoost: 4, // m/s along it for taking it
  wallJumpOut: 7, // m/s off it
  wallJumpUp: 10.5, // m/s up
  wallJumpAlong: 3, // m/s more along it
  wallReach: 0.3, // metres beyond his own radius that a wall is still held

  mantleReach: 2.8, // metres over his feet that a ledge is pulled onto
  mantleIn: 0.8, // metres past the edge he is put
  mantleSideAssist: 0.25, // metres either way along a face to find a clear landing near a corner
  mantleSeconds: [0.28, 0.52], // a grab and pull-up, from a low ledge to a full-height one
  vaultSeconds: [0.12, 0.2], // a running vault keeps its short interruption
  mantleHeadroom: 0.25, // space above his standing head before a narrow landing is taken upright
  vaultBoost: 2.5, // m/s for going over one at a run or faster: slower, he only keeps what he had
  strideSeconds: 0.3, // between footfalls at speed: the owner asked for bigger, rarer steps at the same speed (2026-10-16), a guess. VHOLUME's flat out is 0.21, heard in the owner's clip of a straight run; over the nine minutes at every pace, 0.235
  strideMetres: 3, // and the shortest a stride is. Only the feet go by these: the sound and the eye's gait, never his speed
  maxStepTravel: 0.25, // metres a step is cut to: thinner than anything stood in the city
}

const EVERYWHERE = { ...TUNING }

/**
 * A place may ask for a runner of its own: `pace` is the numbers of `TUNING` it wants
 * otherwise, and with none he is as he is everywhere. Asked once, as a place is entered.
 * One place does (`parkour-start.js`), to be VHOLUME's own ground at VHOLUME's own pace; a
 * man's pace over a place of ours was tried and turned down (`docs/internals/parkour.md`).
 */
export function paceFor(pace = {}) {
  Object.assign(TUNING, EVERYWHERE, pace)
}

const _wish = new Vector3()
const _normal = new Vector3()
const _face = new Vector3()
const _probe = new Vector3()
const _flat = new Vector3()
const _grade = new Vector3()
const _next = new Vector3()
const _events = {}
const KERB = 0.02 // metres: a change of floor under this, beyond what the slope gives, is the slope's and not a step

// Rising from rest and coming to rest at the top.
const smooth = (t) => t * t * (3 - 2 * t)

/**
 * A runner on `body`, a flight body (`flight.createBody`), whose `pos` is his feet here and
 * whose `vel` is shared with the glide, so that neither is copied on taking off or landing.
 * For reading: `mode` — 'run', 'slide', 'air', 'wall', 'climb', 'sit' or 'squat'; `wallSide` — which side the
 * wall he is on stands, +1 his right, -1 his left, 0 for none; `crouched` — whether he is as
 * low as a slide; `strides` — strides run on his feet, which count his footfalls.
 */
export function createRunner(body) {
  return {
    body,
    mode: 'run',
    wallSide: 0,
    crouched: false,
    strides: 0,
    _wallNormal: new Vector3(),
    _lastWall: new Vector3(), // the wall last left: not taken again until his feet have been down
    _wallFor: 0,
    _coyote: 0,
    _buffer: 0,
    _jumpWas: false,
    _boosted: false, // this time on the ground has had its slide's boost
    _holds: false, // a landing from the glide: it slides whether asked or not
    _rising: 0, // m/s the ground under him carries him up at, by its slope: his when he leaves it
    _stripCool: 0,
    _cutTo: Infinity, // m/s up a jump of his own is cut to if jump is let go while he rises: Infinity once cut, or for a rise he did not jump into
    _climb: null, // the ledge path, its exit pace, and whether its landing needs a crouch
    _steps: 0,
  }
}

/** Puts him on his feet where the body is, as fast as it is going along the ground. */
export function reset(runner) {
  Object.assign(runner, { mode: 'run', wallSide: 0, crouched: false, strides: 0, _wallFor: 0, _coyote: 0, _buffer: 0, _jumpWas: true, _boosted: false, _holds: false, _rising: 0, _stripCool: 0, _cutTo: Infinity, _climb: null, _steps: 0 })
  runner._lastWall.set(0, 0, 0)
  runner.body.vel.y = 0
}

/**
 * The suit closed in the air: he is in the air as he was going, all of it kept, to land,
 * slide, take a wall or reach a ledge as from any jump.
 */
export function fold(runner) {
  const { y } = runner.body.vel
  reset(runner)
  runner.body.vel.y = y
  runner.mode = 'air'
}

/** Whether a press of jump now would be a jump: on his feet, on a wall, or just off an edge. */
export function canJump(runner) {
  return runner.mode !== 'air' || runner._coyote > 0
}

/**
 * The glide has touched a floor at `floor` metres: he is on his feet on it, in a slide that
 * keeps what he came in with along the ground and holds until that is run off.
 */
export function touchDown(runner, floor) {
  reset(runner)
  runner.body.pos.y = floor
  if (Math.hypot(runner.body.vel.x, runner.body.vel.z) < TUNING.slideFrom) return
  runner.mode = 'slide'
  runner.crouched = true
  runner._boosted = true // what he brought is the boost
  runner._holds = true
}

/**
 * Advances the runner by `dt`.
 * `input`: `yaw` — the heading he looks along (0 = +Z); `moveX`, `moveZ` — -1 to 1 each, to
 *   his right and forward; `jump` and `crouch` — whether each is held.
 * `site` answers for what stands about him:
 *   `floorAt(x, y, z)` — the height of the highest footing at that point no higher than `y`;
 *   `gradeAt(feet, out)` — how the footing under `feet` slopes, written to `out` as metres
 *     up for each metre along +X and along +Z (`out.x`, `out.z`); nothing on the level;
 *   `ceilingAt(x, y, z)` — the lowest underside there at or above `y`, or Infinity;
 *   `wallAt(feet, low, high, radius, normal)` — moves `feet` level out of whatever stands
 *     within `radius` of it between the heights `low` and `high`, writes the face's outward
 *     normal and returns true, or false in the clear;
 *   `padAt(feet)` — m/s a pad underfoot throws him up at, or 0;
 *   `stripAt(feet)` — m/s a strip underfoot adds along his way, or 0.
 * Returns what happened, an object that is the same one every call: `jumped`, `hopped` (a jump
 * made on landing, timed), `landed` (m/s he came down at, 0 for none), `slid` (a slide began),
 * `walled` (a wall was taken), `wallJumped`, `climbed` (a ledge was reached for), `vaulted` (and gone
 * over at a run, which gives `vaultBoost`), `sprung`
 * (a pad threw him), `boosted` (a strip was crossed), `footfalls` (how many feet came down),
 * `stepped` (metres a kerb or a stair put his feet up, or down if less than 0, beyond what the
 * slope under him did: the feet are on it at once and the eye comes after) and `gained` (m/s
 * that moving well added: a timed hop, a slide's boost, a wall, a push off one, a vault, a strip).
 */
/**
 * Sits him on a seat (a bench, for a perekur), his feet at `seat` on it: held there, still, until
 * a step is asked to move or jump, which stands him up and is not also a jump.
 */
export function sit(runner, seat) {
  reset(runner)
  runner.mode = 'sit'
  runner.body.pos.copy(seat)
  runner.body.vel.set(0, 0, 0)
}

/**
 * Down on his heels where he stands, to be at the height of someone small (`raccoon.js`), until
 * he moves or jumps, as from a seat, or `rise` stands him up.
 */
export function squat(runner) {
  runner.mode = 'squat'
  runner.body.vel.set(0, 0, 0)
}

/** Up from a squat, if he is in one. */
export function rise(runner) {
  if (runner.mode === 'squat') runner.mode = 'run'
}

export function step(runner, input, site, dt) {
  Object.assign(_events, { jumped: false, hopped: false, landed: 0, slid: false, walled: false, wallJumped: false, climbed: false, vaulted: false, sprung: false, boosted: false, footfalls: 0, stepped: 0, gained: 0 })
  if (runner.mode === 'sit' || runner.mode === 'squat') {
    const rising = input.jump && !runner._jumpWas
    runner._jumpWas = input.jump
    if (!rising && input.moveX === 0 && input.moveZ === 0) return _events
    runner.mode = 'run'
  }
  const parts = Math.max(1, Math.ceil((runner.body.vel.length() * dt) / TUNING.maxStepTravel))
  // A press is one press, whatever the step was cut into.
  const pressed = input.jump && !runner._jumpWas
  runner._jumpWas = input.jump
  if (pressed) runner._buffer = TUNING.bufferSeconds
  for (let part = 0; part < parts; part++) stepOnce(runner, input, site, dt / parts)
  const { vel } = runner.body
  const speed = Math.hypot(vel.x, vel.z)
  if (speed > TUNING.topSpeed) scaleFlat(vel, TUNING.topSpeed + (speed - TUNING.topSpeed) * Math.exp(-TUNING.topTax * dt))
  return _events
}

function stepOnce(runner, input, site, dt) {
  const T = TUNING
  const { pos, vel } = runner.body
  runner._buffer -= dt
  runner._coyote -= dt
  runner._stripCool -= dt

  // Where he asks to go: looking down +Z, world +X is on the left.
  const sin = Math.sin(input.yaw)
  const cos = Math.cos(input.yaw)
  _wish.set(input.moveZ * sin - input.moveX * cos, 0, input.moveZ * cos + input.moveX * sin)
  const asking = _wish.lengthSq() > 0
  if (asking) _wish.normalize()

  if (runner.mode === 'climb') return climb(runner, dt)
  if (runner.mode === 'wall') onWall(runner, input, site, dt)
  else if (runner.mode === 'air') inAir(runner, input, asking, dt)
  else onGround(runner, input, site, asking, dt)
  if (runner.mode === 'climb') return

  const before = pos.y
  pos.addScaledVector(vel, dt)
  const tall = runner.crouched ? T.crouchHeight : T.height

  // A head that meets an underside goes no higher.
  const ceiling = site.ceilingAt(pos.x, pos.y + T.stepUp, pos.z)
  if (pos.y + tall > ceiling) {
    pos.y = ceiling - tall
    vel.y = Math.min(vel.y, 0)
  }

  const grounded = runner.mode === 'run' || runner.mode === 'slide'
  if (site.wallAt(pos, pos.y + T.stepUp, pos.y + tall, T.radius, _normal)) meetWall(runner, input, site, grounded)
  if (runner.mode === 'climb') return

  // From where he was as well as where he is: a fall is not let past a roof between two steps.
  const floor = site.floorAt(pos.x, Math.max(before, pos.y) + T.stepUp, pos.z)
  if (grounded) {
    // Ground that falls away further than a step is an edge run off: with whatever climb
    // the ground had given him, which is what a kicker is for.
    if (floor < pos.y - T.stepUp) {
      vel.y = runner._rising
      runner.mode = 'air'
      runner.crouched = false
      runner._coyote = T.coyoteSeconds
      return
    }
    const kerb = floor - pos.y - runner._rising * dt
    if (Math.abs(kerb) > KERB) _events.stepped += kerb
    pos.y = floor
    const sprung = site.padAt(pos)
    if (sprung > 0) {
      vel.y = sprung
      runner.mode = 'air'
      runner.crouched = false
      _events.sprung = true
      return
    }
    const strip = runner._stripCool <= 0 ? site.stripAt(pos) : 0
    if (strip > 0) {
      scaleFlat(vel, Math.hypot(vel.x, vel.z) + strip)
      runner._stripCool = T.stripCoolSeconds
      _events.boosted = true
      _events.gained += strip
    }
  } else if (pos.y <= floor && vel.y <= 0) land(runner, input, floor)
}

function onGround(runner, input, site, asking, dt) {
  const T = TUNING
  const { pos, vel } = runner.body
  vel.y = 0
  runner._cutTo = Infinity // what leaves the ground now without a jump is not cut
  let speed = Math.hypot(vel.x, vel.z)
  const sliding = runner.mode === 'slide'

  // The slope under him, along the way he is going: down it gravity is his, up it gravity's.
  let grade = 0
  if (speed > 0.5) {
    site.gradeAt(pos, _grade)
    grade = (_grade.x * vel.x + _grade.z * vel.z) / speed
  }
  const pull = (-T.gravity * grade) / Math.hypot(1, grade)
  const gained = pull * (grade > 0 ? 1 : sliding ? T.slopeSliding : T.slopeRunning) * dt

  if (sliding) {
    const over = Math.max(0, speed - T.slideCap)
    speed = Math.max(0, speed + gained - (T.slideFriction + over * T.slideCapTax) * dt)
    if (asking) turnToward(vel, _wish.x, _wish.z, Math.min(T.slideTurn, T.slideGrip / Math.max(speed, 1)) * dt, speed)
    else scaleFlat(vel, speed)
    if (speed < T.landingHolds) runner._holds = false
    // Under something too low to stand up beneath he stays down, and can creep out.
    const headroom = site.ceilingAt(pos.x, pos.y + T.stepUp, pos.z) >= pos.y + T.height
    if (!headroom && asking && speed < T.slideEnds) vel.set(_wish.x * T.slideEnds, 0, _wish.z * T.slideEnds)
    else if (headroom && (speed < T.slideEnds || !(input.crouch || runner._holds))) {
      runner.mode = 'run'
      runner.crouched = false
    }
  } else {
    if (speed > T.runSpeed) {
      // Speed that was made is his to steer and, slowly, to lose.
      speed = Math.max(T.runSpeed, speed + gained - (speed - T.runSpeed) * T.runTax * dt)
      if (asking && T.reverseBrake > 0 && (vel.x * _wish.x + vel.z * _wish.z) < -Math.hypot(vel.x, vel.z) * 0.5) {
        scaleFlat(vel, speed - T.reverseBrake * dt)
      } else if (asking) {
        turnToward(vel, _wish.x, _wish.z, Math.min(T.groundTurn, T.groundGrip / speed) * dt, speed)
      }
      else scaleFlat(vel, speed - T.stopAccel * dt)
    } else if (asking) {
      _flat.set(_wish.x * T.runSpeed - vel.x, 0, _wish.z * T.runSpeed - vel.z)
      const short = _flat.length()
      if (short > 0) vel.addScaledVector(_flat, Math.min(1, (T.runAccel * dt) / short))
      if (gained > 0) scaleFlat(vel, Math.hypot(vel.x, vel.z) + gained)
    } else scaleFlat(vel, speed - T.stopAccel * dt)
    speed = Math.hypot(vel.x, vel.z)
    stride(runner, speed, dt)
    if (input.crouch && speed >= T.slideFrom) beginSlide(runner)
  }
  runner._rising = Math.hypot(vel.x, vel.z) * grade

  if (runner._buffer > 0) jump(runner, false, input.jump)
}

// `dt` more run on his feet at `speed`, and the feet that came down in it.
function stride(runner, speed, dt) {
  const T = TUNING
  runner.strides += (speed * dt) / Math.max(T.strideMetres, speed * T.strideSeconds)
  const steps = Math.floor(runner.strides)
  _events.footfalls += Math.max(0, steps - runner._steps)
  runner._steps = steps
}

function beginSlide(runner) {
  const T = TUNING
  const { vel } = runner.body
  const speed = Math.hypot(vel.x, vel.z)
  runner.mode = 'slide'
  runner.crouched = true
  _events.slid = true
  if (runner._boosted) return
  runner._boosted = true
  const boost = T.slideBoost * Math.max(0, 1 - speed / T.slideBoostGone)
  scaleFlat(vel, speed + boost)
  _events.gained += boost
}

// `held`: whether jump is still down as he leaves the ground. If it is, letting it go before
// the top cuts the rise short (`inAir`); a press made before landing and already let go is a
// full jump, so a timed hop is never cut.
function jump(runner, hopped, held) {
  const T = TUNING
  const { vel } = runner.body
  // Off rising ground the jump is on top of the rise, and the rise is never cut.
  const rise = Math.max(0, runner._rising)
  vel.y = T.jumpSpeed + rise
  runner._cutTo = held ? T.jumpCut + rise : Infinity
  if (hopped) {
    scaleFlat(vel, Math.hypot(vel.x, vel.z) + T.hopBoost)
    _events.gained += T.hopBoost
  }
  runner.mode = 'air'
  runner.crouched = false
  runner._holds = false
  runner._rising = 0
  runner._buffer = 0
  runner._coyote = 0
  _events.jumped = true
  _events.hopped = hopped
}

function inAir(runner, input, asking, dt) {
  const T = TUNING
  const { vel } = runner.body
  if (runner._coyote > 0 && runner._buffer > 0) return jump(runner, false, input.jump)
  // Jump let go on the way up: the rest of the rise goes, once.
  if (!input.jump && runner._cutTo < Infinity) {
    vel.y = Math.min(vel.y, runner._cutTo)
    runner._cutTo = Infinity
  }
  vel.y -= T.gravity * dt
  if (!asking) return
  const speed = Math.hypot(vel.x, vel.z)
  if (speed < T.runSpeed) {
    vel.x += _wish.x * T.airAccel * dt
    vel.z += _wish.z * T.airAccel * dt
    if (Math.hypot(vel.x, vel.z) > T.runSpeed) scaleFlat(vel, T.runSpeed)
  } else if (input.moveZ > 0) turnToward(vel, Math.sin(input.yaw), Math.cos(input.yaw), T.airTurn * dt, speed)
}

function onWall(runner, input, site, dt) {
  const T = TUNING
  const { pos, vel } = runner.body
  const normal = runner._wallNormal
  const speed = Math.hypot(vel.x, vel.z)
  runner._wallFor += dt
  runner._cutTo = Infinity // a push off a wall is a springboard's, never cut
  vel.y -= T.wallGravity * dt
  stride(runner, speed, dt)
  // Off it: by jumping, by crouching, by its time running out or its end going by.
  if (runner._buffer > 0) {
    scaleFlat(vel, speed + T.wallJumpAlong)
    vel.addScaledVector(normal, T.wallJumpOut)
    vel.y = T.wallJumpUp
    leaveWall(runner)
    runner._buffer = 0
    _events.jumped = _events.wallJumped = true
    _events.gained += T.wallJumpAlong
    return
  }
  _probe.copy(pos).addScaledVector(normal, -T.wallReach)
  const held = site.wallAt(_probe, pos.y + T.stepUp, pos.y + T.height, T.radius, _normal)
  if (input.crouch || runner._wallFor > T.wallSeconds || !held) {
    leaveWall(runner)
    runner._coyote = T.coyoteSeconds
  }
}

function leaveWall(runner) {
  runner._lastWall.copy(runner._wallNormal)
  runner.mode = 'air'
  runner.wallSide = 0
}

// He has been moved out of something standing, whose face looks along `_normal`: a ledge
// within reach is gone over, a wall taken at an angle and fast enough is run along, and
// anything else stops what of his speed went into it.
function meetWall(runner, input, site, grounded) {
  const T = TUNING
  const { pos, vel } = runner.body
  const into = -(vel.x * _normal.x + vel.z * _normal.z)
  const pushing = -(_wish.x * _normal.x + _wish.z * _normal.z) > 0.5
  if (runner.mode !== 'wall' && (into > 1 || pushing)) {
    _face.copy(_normal)
    for (const side of [0, -T.mantleSideAssist, T.mantleSideAssist]) {
      const x = pos.x - _face.x * T.mantleIn - _face.z * side
      const z = pos.z - _face.z * T.mantleIn + _face.x * side
      const top = site.floorAt(x, pos.y + T.mantleReach, z)
      if (top <= pos.y + T.stepUp) continue
      const headroom = site.ceilingAt(x, top, z) - top
      if (headroom < T.crouchHeight + T.mantleHeadroom) continue
      const crouched = headroom < T.height + T.mantleHeadroom
      _probe.set(x, top, z)
      if (site.wallAt(_probe, top + T.stepUp, top + (crouched ? T.crouchHeight : T.height), T.radius, _normal)) continue
      _normal.copy(_face)
      return beginClimb(runner, x, top, z, crouched)
    }
    _normal.copy(_face)
  }
  if (into <= 0) return
  const speed = Math.hypot(vel.x, vel.z)
  vel.x += _normal.x * into
  vel.z += _normal.z * into
  if (grounded || runner.mode === 'wall') return
  const along = Math.hypot(vel.x, vel.z)
  const fresh = runner._lastWall.dot(_normal) < 0.9
  const clear = pos.y - site.floorAt(pos.x, pos.y, pos.z) > T.wallOverFloor
  if (!fresh || !clear || speed < T.wallFrom || along < speed * T.wallAlong || vel.y < -T.wallFalling) return
  // Taken: what he had along the ground he has along the wall, and more for taking it.
  scaleFlat(vel, speed + T.wallBoost)
  _events.gained += T.wallBoost
  vel.y = Math.max(vel.y, T.wallRise)
  runner.mode = 'wall'
  runner._wallNormal.copy(_normal)
  runner._wallFor = 0
  // The wall stands opposite its normal; his right is (-cos yaw, sin yaw).
  runner.wallSide = _normal.x * Math.cos(input.yaw) - _normal.z * Math.sin(input.yaw) > 0 ? 1 : -1
  _events.walled = true
}

function beginClimb(runner, x, top, z, crouched) {
  const T = TUNING
  const { pos, vel } = runner.body
  const share = Math.min(1, Math.max(0, (top - pos.y) / T.mantleReach))
  const speed = Math.hypot(vel.x, vel.z)
  const vaulted = speed >= T.runSpeed
  const seconds = vaulted ? T.vaultSeconds : T.mantleSeconds
  runner._climb = {
    fromX: pos.x, fromY: pos.y, fromZ: pos.z, toX: x, toY: top, toZ: z, gone: 0,
    seconds: seconds[0] + (seconds[1] - seconds[0]) * share,
    speed: vaulted ? speed + T.vaultBoost : Math.max(speed, T.runSpeed * 0.5),
    gain: vaulted ? T.vaultBoost : 0, // a slow climb is given a walk's pace to leave with, not made speed
    dirX: -_normal.x, dirZ: -_normal.z, crouched,
  }
  runner.mode = 'climb'
  runner.crouched = false
  runner.wallSide = 0
  vel.set(0, 0, 0)
  _events.climbed = true
  _events.vaulted = vaulted
}

// Up first, then over: he leaves the top already moving. `vel` is meanwhile the way to where
// the next step will have him, so that what is drawn between two steps lies on the path; it is
// no speed of his (36 m/s up at its fastest), and is not to be read as one while `mode` is 'climb'.
function climb(runner, dt) {
  const { pos, vel } = runner.body
  const c = runner._climb
  c.gone = Math.min(1, c.gone + dt / c.seconds)
  climbedTo(c, c.gone, pos)
  if (c.gone < 1) {
    climbedTo(c, Math.min(1, c.gone + dt / c.seconds), _next)
    if (dt > 0) vel.subVectors(_next, pos).divideScalar(dt)
    return
  }
  vel.set(c.dirX * c.speed, 0, c.dirZ * c.speed)
  _events.gained += c.gain
  runner.mode = c.crouched ? 'slide' : 'run'
  runner.crouched = c.crouched
  runner._climb = null
  runner._boosted = false
  runner._rising = 0
  runner._lastWall.set(0, 0, 0)
}

// Where a climb `gone` of the way through has his feet, written to `out`. Up rises from rest and
// comes to rest at the top; over begins at rest and quickens to leave at the pace he runs on
// with, so neither the start nor the end of it is a kink.
function climbedTo(c, gone, out) {
  const up = smooth(Math.min(1, gone / 0.65))
  const u = Math.max(0, (gone - 0.5) / 0.5)
  // Over as a cubic from rest to `lead` path lengths a unit of `u`, its pace on leaving, held to 3 so it never goes past the end and back.
  const length = Math.hypot(c.toX - c.fromX, c.toZ - c.fromZ)
  const lead = length > 0.01 ? Math.min(3, (c.speed * c.seconds * 0.5) / length) : 0
  const over = u * u * (3 - 2 * u) + lead * u * u * (u - 1)
  out.set(c.fromX + (c.toX - c.fromX) * over, c.fromY + (c.toY - c.fromY) * up, c.fromZ + (c.toZ - c.fromZ) * over)
}

function land(runner, input, floor) {
  const T = TUNING
  const { pos, vel } = runner.body
  const fall = -vel.y
  pos.y = floor
  vel.y = 0
  runner.mode = 'run'
  runner._boosted = false
  runner._rising = 0
  runner._lastWall.set(0, 0, 0)
  runner.strides = runner._steps // a landing is a footfall: the next one is a whole stride on
  _events.landed = fall
  const speed = Math.hypot(vel.x, vel.z)
  // A jump asked for just before: made now, with everything he had and a little more.
  if (runner._buffer > 0) return jump(runner, true, input.jump)
  // Into a slide, the fall costs nothing: that is what a slide on landing is for.
  if (input.crouch && speed >= T.slideFrom) return beginSlide(runner)
  const hard = Math.min(1, Math.max(0, (fall - T.softFall) / (T.hardFall - T.softFall)))
  scaleFlat(vel, speed * (1 - T.fallTax * hard))
}

// Turns the level part of `vel` toward the level unit direction (`x`, `z`) by at most `by`
// radians, and leaves it `speed` long.
function turnToward(vel, x, z, by, speed) {
  const from = Math.atan2(vel.x, vel.z)
  let off = Math.atan2(x, z) - from
  if (off > Math.PI) off -= Math.PI * 2
  if (off < -Math.PI) off += Math.PI * 2
  const to = from + Math.max(-by, Math.min(by, off))
  vel.x = Math.sin(to) * speed
  vel.z = Math.cos(to) * speed
}

// Leaves the level part of `vel` `speed` long, the way it was going; at rest for nothing or less.
function scaleFlat(vel, speed) {
  const now = Math.hypot(vel.x, vel.z)
  const by = now > 1e-6 && speed > 0 ? speed / now : 0
  vel.x *= by
  vel.z *= by
}
