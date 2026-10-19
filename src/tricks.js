// Tricks done with the lit cigarette while standing around: what the right hand does, beat
// by beat, and where the cigarette is whenever it is out of the hand. Each trick is data; the
// one function works out a moment of it. Knows nothing of the scene: `viewmodel.js` acts it out.
//
// A flight is given by where it leaves the hand, where it comes back to it and how long it
// lasts, never by a velocity, so the cigarette arrives on the pose that is waiting for it.

import { GRIPS } from './hands.js'

const GRAVITY = 9.8

// The right hand's poses, as `viewmodel.js` writes them: where the grip is in the rig's space,
// the forearm's pitch and inward yaw, the wrist's roll (negative turns the thumb up, -PI the
// palm up).
// Sunk and drawn back, the wrist cocked: the moment before every release.
const WOUND = { at: [0.18, -0.46, -0.6], pitch: 0.15, yaw: 0.4, roll: -1.2 }
const WOUND_OVER = { ...WOUND, roll: -0.1 } // the same with the knuckles up, a fist round it
const LET_GO = { at: [0.18, -0.33, -0.64], pitch: 0.6, yaw: 0.4, roll: -1.2 }
const FLUNG = { at: [0.16, -0.02, -0.7], pitch: 1.1, yaw: 0.3, roll: -1.3 } // the arm thrown up after it
const PALM = { at: [0.12, -0.42, -0.66], pitch: 0.25, yaw: 0.35, roll: -2.7 } // open, to bat it back up
const BATTED = { ...PALM, at: [0.12, -0.33, -0.66] }
const KNUCKLES = { at: [0.15, -0.4, -0.66], pitch: 0.3, yaw: 0.35, roll: -0.1 } // the back of the hand, to bounce it off
const KNOCKED = { ...KNUCKLES, at: [0.15, -0.33, -0.66] }
const WAITING = { at: [0.17, -0.4, -0.64], pitch: 0.55, yaw: 0.4, roll: -1.5 }
const REACH = { at: [0.15, -0.2, -0.68], pitch: 0.8, yaw: 0.35, roll: -1.3 }
const HIGH_REACH = { at: [0.14, -0.08, -0.72], pitch: 1.0, yaw: 0.3, roll: -1.3 }
const ACROSS = { at: [-0.16, -0.3, -0.7], pitch: 0.55, yaw: 0.95, roll: -1.6 } // the arm right across the view
const SWEPT = { at: [0.08, -0.32, -0.66], pitch: 0.5, yaw: 0.65, roll: -1.4 } // on its way there
const OVER = { at: [0.15, 0.02, -0.7], pitch: 0.5, yaw: 0.35, roll: -0.1 } // palm down, above where it peaks

// What a cigarette in the air spins about, in the rig's space: the line of sight, so that it
// turns face on to the eye like a propeller, or the line across the view, end over end.
const PROPELLER = [0, 0, 1]
const TUMBLE = [1, 0, 0]

// Every trick opens the same way: wound up, then let go in a short toss onto whatever waits.
const TOSS_AT = 0.4
const TOSS_SECONDS = 0.6
const LANDS_AT = TOSS_AT + TOSS_SECONDS
const opening = (waiting) => [
  { until: TOSS_AT, pose: WOUND, grip: GRIPS.pinch },
  { until: TOSS_AT + 0.15, pose: LET_GO, grip: GRIPS.open },
  { until: LANDS_AT, pose: waiting, grip: GRIPS.open },
]
const toss = (waiting) => ({ at: TOSS_AT, seconds: TOSS_SECONDS, from: WOUND.at, to: waiting.at, turns: 2, about: PROPELLER })

/**
 * `beats`: the hand's pose and grip, each held until its time, in seconds from the start; the
 * arm's spring makes the move between two. `flights`: the cigarette out of the hand, from
 * `at` for `seconds`, between two points of the rig's space, spinning `turns` times `about` a line; `struck` is one begun by a blow, `shedding` one that drops sparks all the way.
 * A flight must end on the `at` of the pose the hand has by then, and a little before the
 * trick does.
 */
export const TRICKS = {
  // A short toss, batted back up off the open palm, then picked out of the air.
  bat: {
    seconds: 2.25,
    beats: [
      ...opening(PALM),
      { until: 1.15, pose: BATTED, grip: GRIPS.open },
      { until: 1.75, pose: REACH, grip: GRIPS.open },
      { until: 2.25, pose: REACH, grip: GRIPS.pinch },
    ],
    flights: [
      toss(PALM),
      { at: LANDS_AT, seconds: 0.75, from: PALM.at, to: REACH.at, turns: 3, about: PROPELLER, struck: true },
    ],
  },
  // Kept up on quick low hops, the hand turned over under each: palm, knuckles, palm, knuckles.
  taps: {
    seconds: 3.2,
    beats: [
      ...opening(PALM),
      { until: 1.35, pose: KNUCKLES, grip: GRIPS.open },
      { until: 1.7, pose: PALM, grip: GRIPS.open },
      { until: 2.05, pose: KNUCKLES, grip: GRIPS.open },
      { until: 2.2, pose: KNOCKED, grip: GRIPS.open },
      { until: 2.75, pose: REACH, grip: GRIPS.open },
      { until: 3.2, pose: REACH, grip: GRIPS.pinch },
    ],
    flights: [
      toss(PALM),
      { at: LANDS_AT, seconds: 0.35, from: PALM.at, to: KNUCKLES.at, turns: 1, about: TUMBLE, struck: true },
      { at: 1.35, seconds: 0.35, from: KNUCKLES.at, to: PALM.at, turns: 1, about: TUMBLE, struck: true },
      { at: 1.7, seconds: 0.35, from: PALM.at, to: KNUCKLES.at, turns: 1, about: TUMBLE, struck: true },
      { at: 2.05, seconds: 0.7, from: KNUCKLES.at, to: REACH.at, turns: 3, about: PROPELLER, struck: true },
    ],
  },
  // Lobbed right across the view, caught at the far side by the arm swept under it, flicked back.
  cross: {
    seconds: 2.6,
    beats: [
      { until: TOSS_AT, pose: WOUND, grip: GRIPS.pinch },
      { until: 0.6, pose: SWEPT, grip: GRIPS.open },
      { until: 1.15, pose: ACROSS, grip: GRIPS.open },
      { until: 1.45, pose: ACROSS, grip: GRIPS.pinch },
      { until: 2.15, pose: REACH, grip: GRIPS.open },
      { until: 2.6, pose: REACH, grip: GRIPS.pinch },
    ],
    flights: [
      { at: TOSS_AT, seconds: 0.75, from: WOUND.at, to: ACROSS.at, turns: 3, about: PROPELLER },
      { at: 1.45, seconds: 0.7, from: ACROSS.at, to: REACH.at, turns: 3, about: TUMBLE },
    ],
  },
  // Tossed end over end and taken from above, palm down, as it tops out.
  overhand: {
    seconds: 1.4,
    beats: [
      { until: TOSS_AT, pose: WOUND, grip: GRIPS.pinch },
      { until: 0.55, pose: LET_GO, grip: GRIPS.open },
      { until: 0.9, pose: OVER, grip: GRIPS.open },
      { until: 1.4, pose: OVER, grip: GRIPS.pinch },
    ],
    flights: [{ at: TOSS_AT, seconds: 0.5, from: WOUND.at, to: OVER.at, turns: 3, about: TUMBLE }],
  },
  // One toss spun fast, straight back into the fingers.
  flip: {
    seconds: 1.6,
    beats: [
      { until: 0.35, pose: WOUND, grip: GRIPS.pinch },
      { until: 0.5, pose: LET_GO, grip: GRIPS.open },
      { until: 1.1, pose: REACH, grip: GRIPS.open },
      { until: 1.6, pose: REACH, grip: GRIPS.pinch },
    ],
    flights: [{ at: 0.35, seconds: 0.75, from: WOUND.at, to: REACH.at, turns: 5, about: PROPELLER }],
  },
  // Thrown out of sight overhead, waited for with two fingers up, caught at full stretch.
  high: {
    seconds: 2.6,
    beats: [
      { until: 0.5, pose: WOUND_OVER, grip: GRIPS.fist },
      { until: 0.75, pose: FLUNG, grip: GRIPS.open },
      { until: 1.75, pose: WAITING, grip: GRIPS.horns },
      { until: 2.1, pose: HIGH_REACH, grip: GRIPS.open },
      { until: 2.6, pose: HIGH_REACH, grip: GRIPS.pinch },
    ],
    flights: [
      { at: 0.5, seconds: 1.6, from: WOUND.at, to: HIGH_REACH.at, turns: 8, about: TUMBLE, shedding: true },
    ],
  },
}

const _moment = { pose: null, grip: null, flight: null, at: [0, 0, 0], turn: 0 }

/**
 * `trick` at `seconds` into it: the hand's `pose` and `grip`, and the `flight` the cigarette is
 * on, or null while it is held; in flight, `at` is where it is in the rig's space and `turn`
 * how far it has spun, in radians. The object returned is reused by the next call.
 */
export function trickAt(trick, seconds) {
  const moment = _moment
  const beat = trick.beats.find((each) => seconds < each.until) ?? trick.beats[trick.beats.length - 1]
  moment.pose = beat.pose
  moment.grip = beat.grip
  moment.flight = null
  for (const flight of trick.flights) {
    const flown = seconds - flight.at
    if (flown < 0 || flown >= flight.seconds) continue
    const along = flown / flight.seconds
    for (let i = 0; i < 3; i++) moment.at[i] = flight.from[i] + (flight.to[i] - flight.from[i]) * along
    moment.at[1] += 0.5 * GRAVITY * flown * (flight.seconds - flown)
    moment.turn = 2 * Math.PI * flight.turns * along
    moment.flight = flight
  }
  return moment
}
