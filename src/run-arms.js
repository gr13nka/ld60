// How a runner's arms go, as he sees them: where each hand is and how its forearm lies, for
// what he is doing. Pure: `viewmodel.js` asks, and reaches the arms to what this says.
//
// They are VHOLUME's way (docs/research/first-person-arms.md): **at a run, in a jump, in a
// slide, no arm is in the picture.** (Of a level look, that is: theirs has a whole body
// under the eye, and looking down at a run he sees his boots and his fists.
// docs/research/vholume-camera.md, "The owner's recording".) An arm comes in only where it
// has something to say:
//
//   on a wall     the hand on the wall's side goes out to it and rides along it
//   in a climb    both palms are down in front of him, pushing him up over the edge
//   in a long fall  both arms come up and out, more the faster he falls: a drop, not a hop
//
// Everything else that was tried was turned down by the owner as it came: a fist pumped with
// the cigarette in it ("very weird"), runner's arms in full ("it moves wrong"), a fist
// glimpsed at each stride ("bad"), arms flung up in every jump and a hand trailed in every
// slide ("too noisy"). What is left is quiet on purpose.
//
// Poses are `viewmodel.js`'s: `{ at, pitch, yaw, roll }` in the hands' rig, metres and
// radians, written for the right arm (x to his right, y up, z behind him). Every number is a
// guess looked at in stills of a filmed run.

import { GRIPS } from './hands.js'

// Out of the picture, under it.
const GONE = { at: [0.42, -0.9, -0.3], pitch: 0.2, yaw: 0.2, roll: -0.9 }
// The hand laid on a wall beside him, ahead of his shoulder: fingers forward along it, the
// palm turned to it, the forearm running back to the picture's lower corner. (Reached out
// sideways instead, the elbow came under the eye and the sleeve filled a third of the
// picture.) No further out than he can be from a wall he holds (`TUNING.radius`), or it
// would be drawn inside it. `rides` is how far it is carried up or down by his own rise, in metres.
const WALL = { at: [0.4, -0.12, -0.7], pitch: 0.25, yaw: -0.15, roll: 0.6, rides: 0.05 }
const RIDE_FULL = 10 // m/s up or down that carries it that far
// The hands catch the lip high, then stay on it as the eye rises past them.
const CLIMB_GRAB = { at: [0.31, 0.08, -0.55], pitch: 0.4, yaw: 0.3, roll: -0.1 }
const CLIMB_PULL = { at: [0.3, -0.42, -0.46], pitch: 0.12, yaw: 0.3, roll: -0.1 }
// Up and out in a fall, the hands in the upper half of the picture.
const FALL = { at: [0.62, 0.1, -0.62], pitch: 0.95, yaw: -0.25, roll: -0.6 }
const FALL_FROM = 13 // m/s down before the arms come up at all: a jump on the level lands at 11
const FALL_FULL = 22 // and where they are all the way up
const FLAT = [0.2, 0.08, 0.05, 0.08, 0.14] // a hand laid on something: fingers together and nearly straight
const LOOSE = GRIPS.relaxed

const _arms = {
  right: { pose: { at: [0, 0, 0], pitch: 0, yaw: 0, roll: 0 }, grip: LOOSE },
  left: { pose: { at: [0, 0, 0], pitch: 0, yaw: 0, roll: 0 }, grip: LOOSE },
}

// `arm` put `share` of the way from out of the picture to `pose`, `lift` metres higher.
function put(arm, pose, grip, share = 1, lift = 0) {
  for (let i = 0; i < 3; i++) arm.pose.at[i] = GONE.at[i] + (pose.at[i] - GONE.at[i]) * share
  arm.pose.at[1] += lift
  arm.pose.pitch = pose.pitch
  arm.pose.yaw = pose.yaw
  arm.pose.roll = pose.roll
  arm.grip = grip
}

function putClimb(arm, gone) {
  put(arm, CLIMB_GRAB, FLAT)
  const pull = Math.max(0, Math.min(1, (gone - 0.18) / 0.67))
  for (let i = 0; i < 3; i++) arm.pose.at[i] += (CLIMB_PULL.at[i] - CLIMB_GRAB.at[i]) * pull
  arm.pose.pitch += (CLIMB_PULL.pitch - CLIMB_GRAB.pitch) * pull
}

/**
 * Where his arms are. `body` is what he is doing: `mode` (the runner's, `parkour.js`),
 * `wallSide` (1 with the wall on his right, -1 on his left), `rise` (m/s up), and
 * `climb` (the share of a ledge pull-up already done). Returns
 * `{ right, left }`, each `{ pose, grip }`: the same objects every call, so they are read
 * at once and not kept.
 */
export function armsFor({ mode, wallSide, rise, climb = 0 }) {
  const { right, left } = _arms
  put(right, GONE, LOOSE)
  put(left, GONE, LOOSE)
  if (mode === 'wall') {
    const ride = WALL.rides * Math.max(-1, Math.min(1, rise / RIDE_FULL))
    put(wallSide > 0 ? right : left, WALL, FLAT, 1, ride)
  } else if (mode === 'climb') {
    putClimb(right, climb)
    putClimb(left, climb)
  } else if (mode === 'air' && -rise > FALL_FROM) {
    const share = Math.min(1, (-rise - FALL_FROM) / (FALL_FULL - FALL_FROM))
    put(right, FALL, LOOSE, share)
    put(left, FALL, LOOSE, share)
  }
  return _arms
}
