// The raccoon's poses as numbers (`raccoon-body.js` turns a set of them into joints), after how a
// raccoon sits up, waddles on its hind legs and handles things with its hands. `raccoon-figure.js`
// mixes them by what he is doing and lays the waddle and the small things over them. Pure.
//
// The numbers, in radians unless said (missing ones are 0):
// - `lean`: the body forward from the hips; `bend`: the chest forward from the waist (a bow);
// - `headPitch`: the nose down from the chest's line (negative looks up); `lookYaw`: turned to his
//   left; `tilt`: cocked; `ears`: laid back, 0 to 1;
// - `capLift` (metres) and `capTilt` (the brim down): the cap raised off his head by a paw;
// - `thigh`: both thighs forward from straight down; `knee`: the shin folded back; `ankle`: the
//   toes raised off a foot kept flat. The same with `L` or `R` on the end are one leg's own
//   share, laid on for the waddle. The feet are kept flat to the floor whatever the legs do;
// - `roll` the body rocked over a hip, `shift` metres it is carried to his left;
// - `tail`: the tail's root up from hanging back; `tailCurl`: the rest of it curled up; `tailSway`;
// - an arm, one each side, `L` or `R`: `armPitch` forward and up from hanging, `armOut` out from
//   the body, `elbow` bent forward, `wrist` the paw turned forward (the right paw holds the
//   cigarette, which stands out from the fist across the forearm: `wristR` turns it up).

export const PARAMS = [
  'lean', 'bend', 'headPitch', 'lookYaw', 'tilt', 'ears', 'capLift', 'capTilt',
  'thigh', 'knee', 'ankle', 'thighL', 'thighR', 'kneeL', 'kneeR',
  'roll', 'shift', 'tail', 'tailCurl', 'tailSway',
  'armPitchL', 'armPitchR', 'armOutL', 'armOutR', 'elbowL', 'elbowR', 'wristL', 'wristR',
]

export const POSES = {
  // On his haunches, as a raccoon sits to eat or to wait: rump on the floor, hind legs out in front,
  // the back straight and leaning a little against nothing, the left paw on his belly and the right
  // holding the cigarette at his chest, the tail laid out behind.
  sit: { lean: -0.1, bend: 0.3, headPitch: -0.1, ears: 0.1, thigh: 1.53, knee: 0.1, tail: -0.1, tailCurl: 0.3, armPitchL: -0.5, armOutL: -1.24, elbowL: 1.45, armPitchR: -0.04, armOutR: -0.34, elbowR: 1.52, wristR: 0.08, wristL: 0.8 },
  // A drag taken sitting: the same, the cigarette brought up to his mouth and the head bowed to it.
  sitDrag: { lean: -0.1, bend: 0.4, headPitch: 0.4, ears: 0.1, thigh: 1.53, knee: 0.1, tail: -0.1, tailCurl: 0.3, armPitchL: -0.44, armOutL: -0.96, elbowL: 1.42, wristL: 0.7, armPitchR: 1.01, armOutR: -0.79, elbowR: 1.49, wristR: -0.98 },
  // Stood up on his hind legs, hunched, the knees bent: how he gets up and how he stops.
  stand: { lean: 0.1, bend: 0.25, headPitch: -0.2, ears: 0.1, thigh: 0.36, knee: 0.66, tail: -0.55, tailCurl: 0.2, armPitchL: 0.1, armOutL: 0.2, elbowL: 0.3, armPitchR: -0.04, armOutR: -0.34, elbowR: 1.52, wristR: 0.08 },
  // The waddle's base: lower and more hunched, the head forward, the left arm free to swing.
  walk: { lean: 0.15, bend: 0.3, headPitch: -0.3, ears: 0.15, thigh: 0.52, knee: 0.9, tail: -0.55, tailCurl: 0.2, armPitchL: 0.1, armOutL: 0.25, elbowL: 0.3, armPitchR: -0.04, armOutR: -0.34, elbowR: 1.52, wristR: 0.08 },
  // Asking: the cigarette held out and up in the right paw, the left cupped under it, the head
  // tilted up at him and the ears back.
  ask: { lean: 0.1, bend: 0.1, headPitch: -0.2, ears: 0.55, thigh: 0.36, knee: 0.66, tail: -0.55, tailCurl: 0.2, armPitchL: 1.88, armOutL: -0.48, elbowL: 0.01, wristL: -0.14, armPitchR: 1.95, armOutR: -0.29, elbowR: 0.13, wristR: -0.54 },
  // The tip leaned into the flame: the same, bent in to it, the head looking at the coal.
  catch: { lean: 0.3, bend: 0.3, headPitch: 0.05, ears: 0.4, thigh: 0.36, knee: 0.66, tail: -0.55, tailCurl: 0.2, armPitchL: 2.0, armOutL: -0.64, elbowL: 0.55, wristL: -0.14, armPitchR: 2.0, armOutR: -0.31, elbowR: 1.2, wristR: -1.2 },
  // A drag: the cigarette to his mouth, the head back, the left paw resting on his belly.
  drag: { lean: 0.18, bend: 0.37, headPitch: 0.23, ears: 0.1, thigh: 0.36, knee: 0.66, tail: -0.55, tailCurl: 0.2, armPitchL: 0.5, armOutL: 0.2, elbowL: 1.0, armPitchR: 1.24, armOutR: -0.7, elbowR: 1.32, wristR: -0.8 },
  // The deep bow of thanks: bent right over, the cap held up and out in the left paw.
  bow: { lean: 0.35, bend: 0.65, headPitch: 0.1, ears: 0.2, thigh: 0.52, knee: 0.9, tail: -0.55, tailCurl: 0.2, capLift: 0.1, capTilt: 0.7, armPitchL: 1.96, armOutL: -0.42, elbowL: 0.86, armPitchR: -0.04, armOutR: -0.34, elbowR: 1.52, wristR: 0.08, wristL: 0.55 },
}

/**
 * Poses that are laid over another instead of mixed with it (`overlay`), each naming only the
 * numbers it changes. `greet`: the cap raised off his head in the left paw, held up beside it as
 * a man raises his hat, the rest of him left to the waddle. `wave`: the left paw high and open
 * beside his head, the head cocked (`swing` makes it wave).
 */
export const OVERLAYS = {
  wave: { armPitchL: 2.9, armOutL: 0.55, elbowL: 0.5, wristL: 0, tilt: 0.12 },
  greet: { capLift: 0.12, capTilt: 0.3, armPitchL: 2.81, armOutL: -0.21, elbowL: 0.43, wristL: -0.23 },
}

/** Pose `p` moved `weight` (0 to 1) of the way to the numbers of overlay `name`. Returns `p`. */
export function overlay(p, name, weight) {
  for (const [param, value] of Object.entries(OVERLAYS[name])) p[param] += (value - p[param]) * weight
  return p
}

/** A wave laid over a `wave` overlay at `phase` (radians, 2.5 swings a second is 15.7 rad/s) and `weight`: the whole arm swinging out and in, the paw flapping after it. Returns `p`. */
export function swing(p, phase, weight) {
  p.armOutL += weight * 0.4 * Math.sin(phase)
  p.wristL += weight * 0.3 * Math.sin(phase + 1)
  return p
}

/** `poses` mixed by `weights` (`{ name: weight }`, any that add up to more than 0), into `out`. */
export function mixPoses(weights, out = {}) {
  let total = 0
  for (const name of PARAMS) out[name] = 0
  for (const [name, weight] of Object.entries(weights)) {
    if (weight <= 0) continue
    total += weight
    const pose = POSES[name]
    for (const param of PARAMS) out[param] += (pose[param] ?? 0) * weight
  }
  if (total > 0) for (const name of PARAMS) out[name] /= total
  return out
}

/**
 * The waddle laid over pose `p`, at `phase` (radians; a whole cycle is two steps) and `strength`
 * (0 standing, 1 at his waddle). The legs swing and the swinging one folds; the body rocks over the
 * leg it stands on and is carried to that side; the free arm swings against the leg and the
 * tail sways behind it. Returns `p`.
 */
export function stride(p, phase, strength) {
  for (const [side, offset] of [['L', 0], ['R', Math.PI]]) {
    const at = phase + offset
    p[`thigh${side}`] += strength * 0.5 * Math.sin(at)
    p[`knee${side}`] += strength * 0.8 * Math.max(0, Math.cos(at))
  }
  p.roll += strength * 0.13 * Math.sin(phase)
  p.shift += strength * 0.018 * Math.sin(phase)
  p.armPitchL -= strength * 0.45 * Math.sin(phase)
  p.armPitchR += strength * 0.08 * Math.sin(phase)
  p.tailSway += strength * 0.5 * Math.sin(phase - 0.6)
  return p
}
