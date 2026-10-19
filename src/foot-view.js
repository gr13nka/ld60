// How being on foot is seen: where the eye is over his feet, how far the horizon leans, how
// far the view nods, how much wider it is opened, and what the lens does to the picture. A
// runner's state changes in a step; the eye is brought to it over a few frames, which is most
// of what a wall or a slide feels like. Look only: it decides nothing, and `game.js` gives
// what it says to the camera and the picture. A nod is of the view alone: `Game.aim`, and a
// throw with it, is not moved.
//
// Measured from VHOLUME's demo as the owner played it for nine minutes, 2026-10-13
// (`docs/research/vholume-camera.md`, with what each number is good to): the view, the lean
// in a turn, off a wall and in a slide, the dark toward the picture's edges, the smear at a
// run; and from two clips of theirs the owner sent on 2026-10-15, the lean along a wall and how
// it comes and goes. Theirs does next to nothing in time with the feet, nothing along a wall but
// hold its lean, and nothing on landing that turns the view.
// What moves the eye in time with his feet is ours, and how is a feel (`FEELS`) the owner picks
// in the movement lab: the shake they asked for over their camera (2026-10-13), a gait that
// rides each stride, or both. The eye's sink on landing is ours too, and a kerb or a stair,
// which the feet take at once and the eye over a moment. Guesses, each said so below, as is
// the tip of the view on starting and stopping.

import { rushOf } from './camera.js'
import { TUNING } from './parkour.js'

// Metres over his feet. Standing, a little over the head of a runner 1.8 m tall: it was 1.65,
// a man's own eye, until the owner found the camera too low (2026-10-15). A guess, set by hand
// in the movement lab (`FootView.standing`); `Game` keeps it under anything over him.
// Sitting: over a bench's seat, where his feet are put, so 1.2 m over the ground. Squatting, on
// his heels: about a crouching man's eye, a little over a raccoon's (`raccoon.js`). A guess.
export const EYE = { standing: 1.85, sliding: 0.72, climbing: 1.25, sitting: 0.75, squatting: 1 }
const EYE_RATE = 14 // 1/s the eye is brought to its height

// How a run is felt, one of these at a time (`FootView.feel`), tried side by side in the
// movement lab (`&tune`, G while running, or each part by hand) until the owner picks one;
// the first is what plays outside the lab. What the owner said of them, all 2026-10-15: of the
// shake (asked for on 2026-10-13), a gait, both, and a heavier gait with some shake, the gait
// alone, "still weird"; of it with the horizon level or nothing turned at all, nothing; then by
// hand, half its drop, nod and sway and most of its rock, "better, but I still don't quite like
// the feel, it should be not too subtle and not too heavy"; of that and two softer, larger
// ones, "smth between" theirs and the first of those; of that, "the in between is best. But I
// still want to tune it closer to vholume", with a clip of theirs running straight and one along
// a wall. Read on the Mac mini (`docs/research/vholume-camera.md`), theirs nods by nothing that
// stands out, rocks about ±0.25° over each foot, drops the eye a centimetre or two at most, and
// along a wall holds its lean with nothing in time with the feet: that is the third here, and
// halfway to it from Between the second. Of the three, "between is good". Then, on 2026-10-16,
// "make character steps bigger and more rare but keep the speed and controls": the steps came
// further apart (`TUNING.strideSeconds`), and Bigger, Between with each step larger, is first,
// what the game plays, with Between beside it to compare.
//   shake  of the old jolt (`SHAKE`): `Camera.shake`, the eye somewhere new every frame
//   thud   of the knocks on springs (`KNOCKS`) and a slide's rumble, which never turn the view
//   bob    metres the eye drops through a stride, at its lowest over the foot he stands on…
//   nod    …radians the view tips down as it does…
//   snap   …how hard: 0 a wave, 1 sunk on the foot and thrown up as from a spring (`sunk`)…
//   sway   …metres the eye goes over the foot he stands on, one side and then the other…
//   roll   …and how far the horizon leans with it, as `bank` is (twice the radians)
//   wall   …and how much of all that goes on along a wall: 0 none, the lean alone, as theirs
const DEG = Math.PI / 180
export const FEELS = [
  { id: 'bigger', name: 'Bigger', note: 'Between with each step larger, for the longer stride: what the game plays.', shake: 0, thud: 1, bob: 0.03, nod: 0.5 * DEG, snap: 0.75, sway: 0.015, roll: 2 * 0.6 * DEG, wall: 1 },
  { id: 'between', name: 'Between', note: 'Your pick: between your own and a softer, larger step, and all of it along a wall.', shake: 0, thud: 1, bob: 0.0175, nod: 0.3 * DEG, snap: 0.75, sway: 0.011, roll: 2 * 0.45 * DEG, wall: 1 },
  { id: 'closer', name: 'Closer', note: 'Between moved halfway to VHOLUME: calmer, and half of it along a wall.', shake: 0, thud: 1, bob: 0.015, nod: 0.2 * DEG, snap: 0.5, sway: 0.01, roll: 2 * 0.35 * DEG, wall: 0.5 },
  { id: 'vholume', name: 'VHOLUME', note: 'As read off their clips: hardly a nod or a rock, and along a wall one steady lean.', shake: 0, thud: 1, bob: 0.01, nod: 0.1 * DEG, snap: 0.25, sway: 0.01, roll: 2 * 0.25 * DEG, wall: 0 },
]

// The old jolt, as `Camera.shake` was given it on foot until 2026-10-15: at each footfall and
// through a slide (both by pace), a timed hop, a wall or a ledge, a pad, and a landing, from
// `land[0]` soft to `land[1]` at `landFull` m/s down.
const SHAKE = { step: 0.22, slide: 0.12, hop: 0.3, wall: 0.35, climb: 0.35, pad: 0.4, land: [0.08, 0.58], landFull: 30 }

// A stride, one footfall to the next (`runner.strides`): his foot is down for the first
// `STANCE` of it, a sprinter's 0.08 s of 0.23, and he flies the rest. Struck hard (`snap` 1),
// through the flight the eye rises and falls as a thrown thing does, and through the stance it
// sinks on the leg and is pushed up again, leaving at the pace it came down at, so the two are
// one motion with no kink. Soft (0), it goes down and up as a wave. Either way it is lowest
// and the view tipped furthest halfway through the stance, the foot under him.
const STANCE = 0.35
const SINK = (4 * STANCE) / (Math.PI * (1 - STANCE)) // how far a stance sinks under the touch, of how far a flight rises over it
const GAIT_RATE = 10 // 1/s a gait comes as he runs, and goes once he is off his feet

/** How low the eye is `p` of the way through a stride struck hard: 0 at the top of his flight, 1 at the bottom of the stance. */
function sunk(p) {
  const flown = (p - STANCE) / (1 - STANCE)
  const over = p < STANCE ? -SINK * Math.sin((Math.PI * p) / STANCE) : 4 * flown * (1 - flown)
  return (1 - over) / (1 + SINK)
}

/** How far down the view is tipped `p` of the way through a stride struck hard: only while the foot is down. */
const pressed = (p) => (p < STANCE ? Math.sin((Math.PI * p) / STANCE) ** 2 : 0)

/** The same struck soft: one wave a stride, 1 with the foot under him. */
const wave = (p) => (1 + Math.cos(2 * Math.PI * (p - STANCE / 2))) / 2

// The knocks (`felt`), each the most it puts the eye out by, in metres, at a feel's `thud` of 1.
const KNOCK_RATE = 32 // 1/s: down in a thirtieth of a second, mostly back in a sixth
const KNOCKS = { hop: 0.04, wall: 0.05, climb: 0.05, pad: 0.06 } // down, on a timed hop, taking a wall, reaching a ledge, a pad's throw
const WALL_ASIDE = 0.03 // toward a wall he takes
const LAND_DOWN = [0.02, 0.08] // a landing, soft and at `DIP_FULL_FALL`: the thud over the sink
const LAND_ASIDE = 0.02 // at `DIP_FULL_FALL`, toward the foot he lands on
// A slide's rumble: two shakes on each side whose periods never line up, so it never repeats.
const RUMBLE = { down: 0.012, aside: 0.008, hz: [17, 23.3, 19.1, 13.7] } // metres flat out; the first two are down, the last two aside

// A landing: the eye sinks, slower than a knock, and comes back. A guess: theirs nods by 0.2°
// at most (311 landings) and does not shake, and how far its eye sinks could not be read.
const DIP = 0.32 // metres the eye sinks on the hardest landing
const DIP_FULL_FALL = 24 // m/s down that is
const DIP_RATE = 13 // 1/s: at the bottom in three quarters of a tenth of a second, and back over a third

// A kerb or a stair (`parkour.js`'s `stepped`). Up a stair flat out, 16 risers of 0.45 m a
// second, the eye climbs evenly, 7.2 m/s give or take 1.2, about 0.4 m behind his feet and never
// over them: worked out, not seen. Quicker is a stair felt step by step, slower an eye left low.
const KERB_RATE = 35

// Starting, the view tips back; stopping, forward. A guess: he is never still in their film.
const SURGE_NOD = 0.014 // radians back at `SURGE_FULL` of speeding up, forward for as much slowing
const SURGE_FULL = 40 // m/s²
const SURGE_RATE = 6

// The horizon, as the camera takes a bank: `camera.js` gives half a radian at 1 (`ROLL_SHARE`).
// It leans into a turn of the view, as a rider does, and no further however fast he turns: theirs is 1.3° at
// 44° a second, 2.0° at 81, 2.6° at 121, 3.1° at 212, a fifth of a second behind, and two
// thirds of that when he is hardly moving.
const TURN_LEAN_MOST = 0.122 // 3.5°
const TURN_LEAN_AT = 1.92 // rad/s (110° a second) at which three quarters of it is there
const TURN_LEAN_AT_REST = 0.65 // of it, standing
const TURN_RATE = 5 // 1/s: the fifth of a second
const WALL_LEAN = 0.52 // 15° away from the wall: theirs held 14° to 15.3° along the clear wall of the owner's clip; 54 leans of the nine minutes, half between 11° and 15.5°
const WALL_LEAN_ON = 7.5 // 1/s: nine tenths there in 0.3 s. The clip's took 0.4 s with a turn's lean in it; the nine minutes' 0.21
const WALL_LEAN_OFF = 15 // 1/s: and gone in 0.15 s, as off that wall
const SURF_LEAN = 0.14 // 8° away from a ramp's face: a guess, Source has none
const SLIDE_LEAN = 0.28 // 8°: theirs went from 6° to 12° through the one slide that could be read
const STRAFE_LEAN = 0.035 // 1° toward a step to the side: a guess, kept small
const LEAN_RATE = 11 // 1/s: nine tenths there in a fifth of a second, as theirs came off a wall over the nine minutes: a slide, a ramp, a step aside

// On foot the view is 78° top to bottom, wider than a glide's at rest. Theirs is 68°, give or
// take 2, and within a degree of that at every pace, and ours was that until the owner found
// it too narrow for places this size (2026-10-13): the 78 is a guess. It gives way to the
// camera's own rush (`rushOf`, from 28 m/s) as that comes up: the two are one widening, not
// two added. On a wall theirs read 4° wider, loosely (58° to 78° fitted as well).
const FOOT_VIEW = 6 // degrees over `camera.js`'s 72
const WALL_KICK = 3
const KICK_RATE = 5

// The lens. Theirs is dark toward its edges in a circle about the middle: of the middle's
// light, nine tenths at four tenths of the picture's half height out, six tenths at one, a
// quarter at the sides, a fifth in the corners. And at a run the picture is drawn out along
// lines through its middle, the middle left sharp, by about 4% of its height two thirds of
// the way to a side: as hard as `picture.js` smears a flight flat out, give or take half.
// How dark is the place's to say (a theme's `lens.tunnel`): theirs is right for grey concrete and dirties a painted place.
export const TUNNEL = 0.7 // of the light, what is taken at the far corners, unless the theme says. With the smear's own darkening and a level's, a film of ours then reads as theirs; at 0.8 it read 0.17 at the sides and 0.09 in the corners
const TUNNEL_RATE = 3 // 1/s it comes and goes with being on foot
const SMEAR = 0.8 // of `picture.js`'s hardest, at a full run
const SMEAR_FROM = 0.5 // of a run's pace, where it begins
const SMEAR_RATE = 4

const ease = (rate, dt) => 1 - Math.exp(-rate * dt)
const clamp = (x, most) => Math.max(-most, Math.min(most, x))

// A critically damped spring, at rest at 0: put out or knocked, it comes back without going
// past, at the same pace at any frame rate. `at` is how far out it is.
class Settling {
  constructor(rate) {
    this.rate = rate
    this.rest()
  }

  rest() {
    this.at = 0
    this.speed = 0
  }

  /** Knocked so as to go out by `peak` at most, from rest. */
  knock(peak) {
    this.speed += peak * this.rate * Math.E
  }

  /** Put out by `by` at once, to come back from. */
  move(by) {
    this.at += by
  }

  step(dt) {
    const { rate, at, speed } = this
    const decay = Math.exp(-rate * dt)
    const carried = (speed + rate * at) * dt
    this.at = (at + carried) * decay
    this.speed = (speed - rate * carried) * decay
  }
}

export class FootView {
  constructor() {
    /** Metres over his feet the eye is. */
    this.eye = EYE.standing
    /** Metres to his right the eye is put by a jolt or a slide's rumble. */
    this.sway = 0
    /** The horizon's lean as the camera takes a bank: -1 to 1, + his right side down. */
    this.bank = 0
    /** Radians the view is tipped down by. */
    this.nod = 0
    /** Degrees the view is opened by. */
    this.kick = 0
    /** How far the lens on foot has come over the picture, 0 to 1: the share of the theme's `lens.tunnel` (or `TUNNEL`) its edges are darkened by. */
    this.tunnel = 0
    /** How hard the picture is smeared toward its edges, 0 to 1 (`picture.js`'s `blur`). */
    this.smear = 0
    this._kerb = new Settling(KERB_RATE) // metres the eye is still below where a kerb or a stair put his feet
    this._sink = new Settling(DIP_RATE) // metres down a landing has it
    this._down = new Settling(KNOCK_RATE) // metres down a knock has it
    this._aside = new Settling(KNOCK_RATE) // metres to his right a knock has it
    /** How a run is felt: one of `FEELS`, kept through a reset. */
    this.feel = FEELS[0]
    /** Metres over his feet the eye stands at, kept through a reset: `EYE.standing` unless the lab says. */
    this.standing = EYE.standing
    this.reset()
  }

  /** Standing still, looking level. */
  reset() {
    Object.assign(this, { eye: this.standing, sway: 0, bank: 0, nod: 0, kick: 0, tunnel: 0, smear: 0 })
    for (const spring of [this._kerb, this._sink, this._down, this._aside]) spring.rest()
    this._height = this.standing
    this._gait = 0 // how much of a run's gait there is, 0 to 1
    this._jolted = 0 // the old jolt asked for since `takeJolt` was last asked
    this._foot = 1 // the side of the foot he landed on last: +1 his right
    this._rumble = 0 // seconds of the rumble's clock
    this._sliding = 0 // how much of a slide's rumble there is, 0 to 1
    this._wallLean = 0 // the lean off a wall
    this._lean = 0 // the lean of anything else he is doing, without the turn's
    this._turn = 0 // radians a second the view turns to his left, as the lean has caught up with it
    this._yaw = null // where he looked last frame
    this._surge = 0 // m/s² he is speeding up by
    this._speed = 0
  }

  /** He came down at `fall` m/s. `from` is where the eye was over his body until now, if not where this had it: the glide's. */
  landed(fall, from = null) {
    const hard = Math.min(1, fall / DIP_FULL_FALL)
    const { thud } = this.feel
    this._foot = -this._foot
    this._sink.knock(DIP * hard)
    this._down.knock((LAND_DOWN[0] + (LAND_DOWN[1] - LAND_DOWN[0]) * hard) * thud)
    this._aside.knock(LAND_ASIDE * hard * this._foot * thud)
    this._jolt(SHAKE.land[0] + (SHAKE.land[1] - SHAKE.land[0]) * Math.min(1, fall / SHAKE.landFull))
    if (from !== null) this._height = from
  }

  /**
   * What one step of his did to the eye: `did` is what `parkour.js`'s `step` (or `surf.js`'s)
   * said happened, `runner` who did it. A landing sinks the eye; a footfall, a slide, a timed
   * hop, a wall, a ledge or a pad jolts or knocks it, as the feel has it; a kerb or a stair is
   * caught up with. Called from the step; seen in `present`, and the jolt in `takeJolt`.
   */
  felt(did, runner) {
    const { vel } = runner.body
    const { thud } = this.feel
    const pace = Math.min(1, Math.hypot(vel.x, vel.z) / TUNING.runSpeed)
    if (did.footfalls > 0) this._jolt(SHAKE.step * pace)
    if (runner.mode === 'slide') this._jolt(SHAKE.slide * pace)
    if (did.landed > 0) this.landed(did.landed)
    if (did.hopped) {
      this._down.knock(KNOCKS.hop * thud)
      this._jolt(SHAKE.hop)
    }
    if (did.climbed) {
      this._down.knock(KNOCKS.climb * thud)
      this._jolt(SHAKE.climb)
    }
    if (did.sprung) {
      this._down.knock(KNOCKS.pad * thud)
      this._jolt(SHAKE.pad)
    }
    if (did.walled) {
      this._down.knock(KNOCKS.wall * thud)
      this._aside.knock(WALL_ASIDE * runner.wallSide * thud)
      this._jolt(SHAKE.wall)
    }
    if (did.stepped) this._kerb.move(did.stepped)
  }

  _jolt(amount) {
    this._jolted = Math.max(this._jolted, amount * this.feel.shake)
  }

  /** The old jolt asked for since this was last asked, for `Camera.shake` (its scale); 0 for none. */
  takeJolt() {
    const jolted = this._jolted
    this._jolted = 0
    return jolted
  }

  /**
   * Brings the eye on by `dt`. `runner` is the runner (`parkour.js`) while he is on foot, or
   * null while he is not: the lean, the nod and the wider view are then let go, not dropped.
   * `strafe` is -1 to 1, how far he asks to go to his right; `yaw` is where he looks
   * (radians, as `Game.lookYaw`: more is to his left); `ahead` the seconds the frame is drawn
   * past the last step, which his stride is carried on by.
   */
  present(dt, runner, strafe = 0, yaw = 0, ahead = 0) {
    for (const spring of [this._kerb, this._sink, this._down, this._aside]) spring.step(dt)
    if (runner === null) {
      this._gait *= 1 - ease(GAIT_RATE, dt)
      this.bank += (0 - this.bank) * ease(LEAN_RATE, dt)
      this._wallLean *= 1 - ease(WALL_LEAN_OFF, dt)
      this._lean *= 1 - ease(LEAN_RATE, dt)
      this.nod += (0 - this.nod) * ease(LEAN_RATE, dt)
      this.kick += (0 - this.kick) * ease(KICK_RATE, dt)
      this.tunnel += (0 - this.tunnel) * ease(TUNNEL_RATE, dt)
      this.smear += (0 - this.smear) * ease(SMEAR_RATE, dt)
      this.sway = this._aside.at
      this._sliding = 0
      this._yaw = null
      return
    }
    const { mode, wallSide, crouched, body } = runner
    // Over a ledge he is lifted, not stopped (`parkour.js` holds his speed at rest meanwhile):
    // the pace he came in at is kept through it, so nothing that reads it starts or stops.
    const speed = mode === 'climb' ? this._speed : Math.hypot(body.vel.x, body.vel.z)
    const pace = Math.min(1, speed / TUNING.runSpeed)

    const height = mode === 'climb' ? EYE.climbing : mode === 'sit' ? EYE.sitting : mode === 'squat' ? EYE.squatting
      : crouched ? EYE.sliding : this.standing
    let toward = (height - this._height) * ease(EYE_RATE, dt)
    // Over a ledge the eye crouches no faster than his feet rise (`vel` is the lift's pace then):
    // it never sinks on the way up, and once he is up it stands from where it is.
    if (mode === 'climb') toward = Math.max(toward, -Math.max(0, body.vel.y) * dt)
    this._height += toward
    this._sliding += ((mode === 'slide' ? pace : 0) - this._sliding) * ease(LEAN_RATE, dt)
    this._rumble += dt
    const turn = this._rumble * Math.PI * 2
    const [down1, down2, aside1, aside2] = RUMBLE.hz
    const rumbleDown = RUMBLE.down * this._sliding * (0.6 * Math.sin(turn * down1) + 0.4 * Math.sin(turn * down2 + 2))
    const rumbleAside = RUMBLE.aside * this._sliding * (0.6 * Math.sin(turn * aside1 + 1) + 0.4 * Math.sin(turn * aside2 + 3))
    // The gait, on his stride as the frame has it: a whole stride is a footfall, and the foot
    // he stands on is his right one stride and his left the next. Along a wall he runs too, and
    // how much of the gait goes on there is the feel's: with none, as theirs, the wall is one
    // held lean; with all, as the owner first asked ("weird, no effects during wall run",
    // 2026-10-15), his stride rides it as on the ground.
    const { feel } = this
    const running = mode === 'run' || mode === 'wall'
    this._gait += ((mode === 'run' ? pace : mode === 'wall' ? pace * feel.wall : 0) - this._gait) * ease(GAIT_RATE, dt)
    const strides = runner.strides + (running ? (speed * ahead) / Math.max(TUNING.strideMetres, speed * TUNING.strideSeconds) : 0)
    const p = strides - Math.floor(strides)
    const soft = wave(p)
    const low = soft + (sunk(p) - soft) * feel.snap
    const tipped = soft + (pressed(p) - soft) * feel.snap
    const over = Math.cos(Math.PI * (strides - STANCE / 2)) // +1 over his right foot
    const gait = this._gait
    this.eye = this._height - this._kerb.at - this._sink.at - this._down.at - feel.thud * rumbleDown - feel.bob * gait * low
    this.sway = this._aside.at + feel.thud * rumbleAside + feel.sway * gait * over

    if (dt > 0) {
      this._surge += ((speed - this._speed) / dt - this._surge) * ease(SURGE_RATE, dt)
      const turned = this._yaw === null ? 0 : Math.atan2(Math.sin(yaw - this._yaw), Math.cos(yaw - this._yaw))
      this._turn += (turned / dt - this._turn) * ease(TURN_RATE, dt)
    }
    this._speed = speed
    this._yaw = yaw
    this.nod = -SURGE_NOD * clamp(this._surge / SURGE_FULL, 1) + feel.nod * gait * tipped

    // Away from a wall, coming slower than it goes; into a slide; toward a step to the side.
    const wall = mode === 'wall' ? -WALL_LEAN * wallSide : 0
    this._wallLean += (wall - this._wallLean) * ease(Math.abs(wall) > Math.abs(this._wallLean) ? WALL_LEAN_ON : WALL_LEAN_OFF, dt)
    const lean = mode === 'surf' ? -SURF_LEAN * wallSide : mode === 'slide' ? SLIDE_LEAN : mode === 'run' ? STRAFE_LEAN * strafe : 0
    this._lean += (lean - this._lean) * ease(LEAN_RATE, dt)
    // Into a turn: turning to his left, his left side goes down.
    const moving = TURN_LEAN_AT_REST + (1 - TURN_LEAN_AT_REST) * pace
    this.bank = this._wallLean + this._lean - TURN_LEAN_MOST * Math.tanh(this._turn / TURN_LEAN_AT) * moving + feel.roll * gait * over

    const kick = FOOT_VIEW * (1 - rushOf(speed)) + (mode === 'wall' ? WALL_KICK : 0)
    this.kick += (kick - this.kick) * ease(KICK_RATE, dt)
    this.tunnel += (1 - this.tunnel) * ease(TUNNEL_RATE, dt)
    const smear = SMEAR * Math.max(0, Math.min(1, (pace - SMEAR_FROM) / (1 - SMEAR_FROM)))
    this.smear += (smear - this.smear) * ease(SMEAR_RATE, dt)
  }
}
