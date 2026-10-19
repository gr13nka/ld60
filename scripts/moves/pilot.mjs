// The pilot of a par line (`par` in a place's record, `places.js`): what a good player holds at
// each step to run it, given where he is and what he is doing. Played over the runner and suit
// in Node (`par.mjs`) and over the real game on the stage page (`itch/runner.js`'s `par`), so a
// line proved in one is the line run in the other. Pure.

const TURN_PER_STEP = 0.03 // radians the view is brought round by in a step, at most: `itch/runner.js`'s
// The pilot's flying: how hard the view leads the path toward where it is going, and how far it
// may stand off the path before the wing would stall (`stallAngle` 0.5); slower than `SLOW` it
// pulls up no more than `SLOW_PULL` over the path, as a player who feels the wing go soft does.
const LEAD = 0.6
const OFF_PITCH = 0.42
const OFF_YAW = 0.35
const SLOW = 32 // m/s
const SLOW_PULL = 0.12
const SLIDE_OVER = 23 // m/s: faster than this on the ground, the pilot slides (a slide loses less than a run)
// `game.js`'s: how high over the feet (or the flyer) a flick leaves the hand, to aim it from.
const STANDING_EYE = 1.65
const FLYING_EYE = 0.3
// A flick's look is held on what it is thrown at this long: the cigarette leaves the hand
// `viewmodel.js`'s `RELEASE_AT` (0.18 s) after the press, thrown along the view as it is then.
const AIM_HOLD = 0.3 // seconds
const STEP = 1 / 120
// Going for a wall (a point's `wall`), the look leans this far toward its side past the point,
// so that the path is turned across in time at any pace; a canyon's measured runs turned 0.5 to 1.
const WALL_LEAN = 0.6

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const toward = (from, to, most) => from + Math.max(-most, Math.min(most, wrap(to - from)))

/**
 * Holds what the par line says, a step at a time. Each point `{ x, y, z, do }` is gone for in
 * turn and passed once he is past it along the way from the point before (or within `near`);
 * `do` is what is done on passing it: 'jump' (a press), 'wing' (a fresh press, then held: the
 * suit), 'fold' (let go), 'slide' and 'run' (crouch held or not; a jump lands into a slide while
 * one is held, and the suit always does; a point's `crouch` says the same alongside its `do`, and
 * a jump at a wall lets it go, or the wall is let go of as soon as it is taken), 'flick' (the
 * cigarette, at `at`), 'circle' (round a fan's axis at `x`, `z` until he is as high as `top`).
 * A point's `beat` ('gate', 'turn') says only what is decided there in the air, for the audit
 * (`audit.mjs`); the pilot goes for it as for any other.
 * He flies toward each point as a player would, the view leading the path and never off it by
 * enough to stall. A point on a wall says which (`wall`, +1 on his left, -1 on his right), and is
 * gone for leaning that way; a jump off a wall may say `after`, the seconds on it it is made at,
 * and is pressed only while he is on a wall.
 * `player` is `{ body, state, mode }`: the state 'flying' or 'running',
 * the mode the runner's ('air', 'wall', 'slide'…) or 'flying'.
 */
/**
 * The points of `par` one line runs: where a place forks, a point says which line it is on
 * (`line` 'low', the slow line anyone finishes, or 'high', the fast one), and a line runs the
 * points on no line and its own. The low line is the one a place is fitted by.
 */
export function lineOf(par, line = 'low') {
  return par.filter((point) => !point.line || point.line === line)
}

/**
 * The index of the par point to go for first from `spot` (`{ x, y, z }`): the far end of the
 * stretch of the line nearest it, so that a run begun anywhere on the line takes it up there.
 */
export function pickUp(par, spot) {
  let best = 0
  let nearest = Infinity
  for (let i = 1; i < par.length; i++) {
    const a = par[i - 1]
    const b = par[i]
    const along = [b.x - a.x, b.y - a.y, b.z - a.z]
    const length2 = along[0] ** 2 + along[1] ** 2 + along[2] ** 2 || 1
    const t = Math.max(0, Math.min(1, ((spot.x - a.x) * along[0] + (spot.y - a.y) * along[1] + (spot.z - a.z) * along[2]) / length2))
    const gap = Math.hypot(a.x + along[0] * t - spot.x, a.y + along[1] * t - spot.y, a.z + along[2] * t - spot.z)
    if (gap < nearest) {
      nearest = gap
      best = i
    }
  }
  return best
}

export class Pilot {
  constructor(par) {
    this.par = par
    this.i = 0
    this.yaw = 0
    this.pitch = 0
    this.hold = false
    this.crouch = false
    this.circle = null
    this.release = 0
    this.aiming = null // `{ at, left }`: what a flick is thrown at, and the seconds the look stays on it
    this.onWall = 0 // seconds on the wall he is on
    this._flown = false
    this.climbing = null // the height a climb is to reach: jump pressed at the wall, again and again, until he stands there
    this._tick = 0
    this.pace = null // m/s a short jump is run up to and flown at: forward is let go above it, and in the air (a runner does not brake, he times it)
  }

  get next() {
    return this.par[this.i] ?? null
  }

  // Whether `pos` has gone past the point `i`.
  _past(pos, i) {
    const point = this.par[i]
    const before = this.par[i - 1]
    if (Math.hypot(pos.x - point.x, pos.z - point.z) < (point.near ?? 1.5)) return true
    if (!before) return false
    let dx = point.x - before.x
    let dz = point.z - before.z
    let length = Math.hypot(dx, dz)
    // A take-off on the point he has just landed at: past it along the jump's own line.
    if (length < 1e-3 && point.heading !== undefined) [dx, dz, length] = [Math.sin(point.heading), Math.cos(point.heading), 1]
    if (length < 1e-3) return false
    return ((pos.x - point.x) * dx + (pos.z - point.z) * dz) / length >= 0
  }

  /** What to hold this step: `player` is the `Player`, `lap` the lap's clock. Returns `{ controls, flick }`. */
  step(player, lap) {
    const { pos, vel } = player.body
    let press = false
    let flick = null
    this.onWall = player.mode === 'wall' ? this.onWall + STEP : 0
    // A jump off a wall is made after `after` seconds on it, by feel, if its point is not passed first.
    const timed = this.next?.do === 'jump' && this.next.after !== undefined && player.mode === 'wall' && this.onWall >= this.next.after
    while (this.next && !this.circle && this.climbing === null && (this._past(pos, this.i) || (timed && this.next.after !== undefined))) {
      const point = this.next
      switch (point.do) {
        // A jump off a wall (`after`) is pressed only on the wall: passed without one, a press in
        // the air would open the suit.
        case 'jump': press = point.after === undefined || player.mode === 'wall'; this.pace = point.pace ?? null; this._flown = point.pace !== undefined; break
        case 'wing': this.release = 2; this.hold = true; break
        case 'fold': this.hold = false; break
        case 'slide': this.crouch = true; break
        case 'run': this.crouch = false; break
        case 'flick':
          flick = point.at
          this.aiming = { at: point.at, left: AIM_HOLD }
          break
        case 'circle': this.circle = point; break
        // A wall met head on is run up, 3.9 m a jump, and kicked off for the next (docs/internals/parkour.md): jump on and on.
        case 'climb': this.climbing = point.top; break
      }
      if (point.crouch !== undefined) this.crouch = point.crouch
      this.i++
    }
    if (this.circle && pos.y >= this.circle.top) this.circle = null
    // Down on his feet out of the suit, jump is let go: the next press is a press.
    if (this.hold && player.state === 'running' && player.mode !== 'air') this.hold = false

    if (this.climbing !== null && pos.y >= this.climbing - 0.5 && player.mode !== 'scale' && player.mode !== 'air') this.climbing = null
    // At the foot of the wall a press is made; on it, once the rise is spent (never in the air: a press there opens the suit).
    if (this.climbing !== null) {
      const slow = Math.hypot(vel.x, vel.z) < 3
      if ((player.mode === 'scale' && vel.y < 1) || (player.mode === 'run' && slow && this._tick++ % 12 === 0)) press = true
    }
    let jump = press
    if (this.release > 0) {
      jump = this.release === 1
      this.release--
    } else if (this.hold) jump = true

    let yaw = this.yaw
    let pitch = 0
    const target = this.circle ? null : this.next
    if (this.circle) {
      // Round the column, the view on its far side, a level look: as a rider climbs one.
      const { x, z } = this.circle
      yaw = Math.atan2(x - pos.x, z - pos.z) + 1.2
      pitch = 0
    } else if (target) {
      const dx = target.x - pos.x
      const dz = target.z - pos.z
      // A point close by has a bearing that swings as he nears it: within 6 m the look is toward the point after it.
      const after = this.par[this.i + 1]
      const near = Math.hypot(dx, dz) < 6 && after && target.do !== 'jump' && !target.wall
      const bearing = near ? Math.atan2(after.x - pos.x, after.z - pos.z) : Math.atan2(dx, dz)
      if (player.state === 'flying') {
        const flat = Math.hypot(vel.x, vel.z)
        const pathPitch = Math.atan2(vel.y, flat)
        const pathYaw = Math.atan2(vel.x, vel.z)
        const wantedPitch = Math.atan2(target.y - pos.y, Math.hypot(dx, dz))
        const pull = Math.hypot(vel.x, vel.y, vel.z) < SLOW ? SLOW_PULL : OFF_PITCH
        pitch = Math.max(pathPitch - OFF_PITCH, Math.min(pathPitch + pull, wantedPitch + LEAD * (wantedPitch - pathPitch)))
        yaw = pathYaw + Math.max(-OFF_YAW, Math.min(OFF_YAW, wrap(bearing - pathYaw) * (1 + LEAD)))
      } else if (target.heading !== undefined && Math.hypot(dx, dz) >= 14) {
        // far from a take-off: toward the point 10 m back along its line, so as to come onto the line before it
        yaw = Math.atan2(dx - Math.sin(target.heading) * 10, dz - Math.cos(target.heading) * 10)
      } else if (target.heading !== undefined) yaw = target.heading // the last 14 m to a take-off are run along the jump's own line, not at the point (whose bearing swings as he nears it)
      else yaw = bearing + (target.wall && player.mode === 'air' ? target.wall * WALL_LEAN : 0)
    }
    const aimed = this.aiming
    if (aimed) {
      const { at } = aimed
      yaw = Math.atan2(at.x - pos.x, at.z - pos.z)
      pitch = Math.atan2(at.y - (pos.y + (player.state === 'flying' ? FLYING_EYE : STANDING_EYE)), Math.hypot(at.x - pos.x, at.z - pos.z))
      aimed.left -= STEP
      if (aimed.left <= 0) this.aiming = null
    }
    this.yaw = aimed ? yaw : toward(this.yaw, yaw, TURN_PER_STEP)
    this.pitch = aimed ? pitch : toward(this.pitch, pitch, TURN_PER_STEP * 2)

    const speed = Math.hypot(vel.x, vel.z)
    let crouch = this.crouch && player.mode !== 'wall' && speed > SLIDE_OVER - 2
    if (this.crouch && player.mode === 'slide' && speed <= SLIDE_OVER - 2) this.crouch = false
    // `flick` is the press, on its one step; `aiming`, whether the look is held on a throw's mark (snapped to it, not turned).
    // A short gap is run up to at the pace that lands on its pad (`pace` on the jump's point, which governs the run to it too), and flown with forward let go.
    let governed = this.next?.do === 'jump' && this.next.pace !== undefined ? this.next.pace : this.pace
    if (this._flown && player.mode !== 'air' && player.mode !== 'scale' && !press && this.pace !== null) {
      this.pace = null
      this._flown = false
      governed = this.next?.do === 'jump' && this.next.pace !== undefined ? this.next.pace : null
    }
    let moveZ = player.state === 'flying' ? 0 : 1
    // (forward is let go only in the last 7 m to the take-off, once the line is taken: steering needs forward held)
    const toJump = this.next?.do === 'jump' ? Math.hypot(this.next.x - pos.x, this.next.z - pos.z) : 0
    if (governed !== null && player.state !== 'flying') moveZ = player.mode === 'air' ? 0 : this.pace === null && toJump > 7 ? 1 : Math.hypot(vel.x, vel.z) < governed ? 1 : 0
    return { controls: { yaw: this.yaw, pitch: this.pitch, moveZ, jump, crouch }, flick: flick ? { yaw: this.yaw, pitch: this.pitch } : null, aiming: !!aimed }
  }
}
