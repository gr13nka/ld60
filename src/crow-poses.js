// The crow's poses as numbers (`crow-body.js` turns a set of them into bones), after how a crow
// sits, crouches, calls, flies and comes down (`docs/research/crow.md`). `crow-figure.js` mixes
// them by what the crow is doing and lays the wingbeat and the small things over them. Pure.
//
// The numbers, in radians unless said (missing ones are 0):
// - `rise`: the body's nose up from level; `drop`: metres the body is lowered (a crouch);
// - `tail`: the tail down from the body's line; `fan`: how far it is spread, 0 to 1;
// - `crane`: the neck raised; `reach`: pushed forward and down; `headPitch`: the head's nose down
//   from level in the world, held there whatever the body does; `lookYaw`, `tilt`: turned and
//   cocked (one eye on something); `jaw`: the bill open;
// - `legs`: back from straight down in the world; `knee`: the bare leg leaning forward; `toes`:
//   curled from level;
// - `fold`: 0 spread to 1 folded; spread, the wing as an arm: `lift` at the shoulder (up), `sweep`
//   (forward), `twist` (leading edge up), `elbow` and `wrist` bent back, `cup` the hand turned down.

export const PARAMS = ['rise', 'drop', 'tail', 'fan', 'crane', 'reach', 'headPitch', 'lookYaw', 'tilt', 'jaw', 'legs', 'knee', 'toes', 'fold', 'lift', 'sweep', 'twist', 'elbow', 'wrist', 'cup']

export const POSES = {
  // At rest on a perch, as a raven sits (the owner's photograph, 2026-10-16): stood up tall, the
  // body 55° up and hunched, the head carried forward over a shaggy throat with the bill a little
  // down, the folded wings hanging along the sides, the tail raised a little off the body's line
  // so that it clears a flat perch.
  perch: { rise: 0.95, tail: -0.3, reach: 0.45, crane: -0.05, headPitch: 0.15, knee: 0.12, fold: 1 },
  // Alert, looking something over: taller still, the neck shown, the head up.
  alert: { rise: 1.1, tail: -0.3, reach: 0.15, crane: 0.3, headPitch: 0.05, knee: 0.08, fold: 1 },
  // About to go: low on bent legs, the body nearer level, the tail up, the head drawn in and
  // aimed, the wings loosened.
  crouch: { rise: 0.35, drop: 0.03, tail: -0.3, reach: 0.25, crane: -0.15, headPitch: 0.1, knee: 0.75, legs: 0.1, toes: 0.1, fold: 0.85, lift: 0.2 },
  // A caw: bowing, the shoulders raised, the head thrust forward and down with the bill wide, the
  // tail flicked up.
  caw: { rise: 0.55, tail: -0.4, reach: 0.6, headPitch: 0.2, jaw: 0.5, knee: 0.25, fold: 0.85, lift: 0.3 },
  // Flying straight: level, the tail closed, the legs tucked back with the toes curled, the wings
  // spread in a slight V, the hand a little bent.
  glide: { tail: 0.05, legs: 1.3, knee: -0.3, toes: 0.8, fold: 0, lift: 0.12, elbow: 0.05, wrist: 0.15 },
  // Braking: stood up in the air, the wings swung forward, cupped and turned to the air, the tail
  // fanned and down, the legs swung forward with the toes spread, the head level.
  flare: { rise: 1.1, tail: 0.45, fan: 1, legs: -0.9, knee: 0.1, toes: -0.3, fold: 0, lift: 0.45, sweep: 0.45, twist: 0.6, cup: 0.25 },
  // Braking at the cigarette: the same, the neck stretched toward it and the bill open.
  reach: { rise: 1.1, tail: 0.4, fan: 0.9, legs: -0.7, knee: 0.1, toes: -0.3, fold: 0, lift: 0.45, sweep: 0.45, twist: 0.6, cup: 0.25, crane: -0.1, reach: 0.4, jaw: 0.35 },
}

/**
 * `poses` (a bird's table, the crow's unless given) mixed by `weights` (`{ name: weight }`, any
 * that add up to more than 0), into `out`.
 */
export function mixPoses(weights, out = {}, poses = POSES) {
  let total = 0
  for (const name of PARAMS) out[name] = 0
  for (const [name, weight] of Object.entries(weights)) {
    if (weight <= 0) continue
    total += weight
    const pose = poses[name]
    for (const param of PARAMS) out[param] += (pose[param] ?? 0) * weight
  }
  if (total > 0) for (const name of PARAMS) out[name] /= total
  return out
}

// The crow's stroke, as `beat` takes it: how far the wing swings up and down at the shoulder (and
// how much lower its middle is than the pose's), sweeps and twists with the stroke, how far the
// elbow and the wrist bend on the way up, and metres the body rides down as the wings go up.
export const STROKE = { swing: 0.85, below: 0.1, sweep: 0.15, twist: 0.2, elbow: 0.35, wrist: 0.6, ride: 0.004 }

/**
 * One wingbeat laid over pose `p`, at `phase` (radians; 0 the top of the stroke) and `strength`
 * (0 a held wing, 1 a full beat), in a bird's `stroke` (the crow's unless given). The downstroke
 * is broad, the wing straight and a little forward; the upstroke comes back with the elbow and the
 * wrist bent, the hand drawn in.
 */
export function beat(p, phase, strength, stroke = STROKE) {
  const up = Math.max(0, -Math.sin(phase)) // 0 through the downstroke, rising to 1 mid-upstroke
  p.lift += strength * (stroke.swing * Math.cos(phase) - stroke.below)
  p.sweep += strength * stroke.sweep * Math.sin(phase)
  p.twist += strength * stroke.twist * Math.sin(phase)
  p.elbow += strength * stroke.elbow * up
  p.wrist += strength * stroke.wrist * up
  p.drop += strength * stroke.ride * Math.cos(phase)
  return p
}
