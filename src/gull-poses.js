// The herring gull's poses as numbers, in `crow-poses.js`'s terms (its `PARAMS`, `mixPoses` and
// `beat` take these in place of the crow's), after how a gull stands, calls, flies and comes down
// (`docs/research/crow.md`, A gull in its place). `crow-figure.js` mixes them by what it is doing.
// Pure.

export const POSES = {
  // At rest: nearly level on straight legs, the round head carried upright on a short thick neck,
  // the bill level, the tail tucked under the wingtips crossed over it.
  perch: { rise: 0.3, tail: 0.08, crane: 0.85, headPitch: 0.05, knee: 0.05, fold: 1 },
  // Alert, looking something over: the neck stretched up long, the head high.
  alert: { rise: 0.45, tail: 0.08, crane: 1.2, reach: -0.1, headPitch: 0.02, knee: 0.04, fold: 1 },
  // About to go: low on bent legs, the body level, the head drawn forward, the wings loosened.
  crouch: { rise: 0.12, drop: 0.035, tail: -0.1, reach: 0.3, crane: -0.1, headPitch: 0.15, knee: 0.75, legs: 0.1, toes: 0.05, fold: 0.85, lift: 0.2 },
  // The long call, in the crow's caw's place: the neck stretched, the head thrown back with the
  // bill pointing up and wide open, the wings loosened at the shoulders.
  caw: { rise: 0.45, tail: -0.1, crane: 0.7, headPitch: -1, jaw: 0.65, knee: 0.1, fold: 0.88, lift: 0.18 },
  // Landed: the wings held straight up over the back a moment, bent at the wrists, before they fold.
  land: { rise: 0.35, tail: 0.1, crane: 0.25, headPitch: 0.05, knee: 0.08, fold: 0, lift: 1.25, sweep: -0.15, twist: 0.2, elbow: 0.5, wrist: 0.9 },
  // Gliding, as a gull does most of the way: the arm raised, the hand swept back and angled down at
  // the wrist (the gull's M from in front), the legs tucked back with the feet curled.
  glide: { legs: 1.35, knee: -0.3, toes: 0.6, fold: 0, lift: 0.28, elbow: 0.12, wrist: 0.45, cup: 0.45 },
  // Braking: stood up in the air, the wings swung up and forward and turned to the air, the tail
  // fanned and down, the webbed feet let down and forward.
  flare: { rise: 1, tail: 0.4, fan: 1, crane: 0.1, legs: -0.8, knee: 0.1, toes: -0.2, fold: 0, lift: 0.55, sweep: 0.4, twist: 0.6, cup: 0.15 },
  // Braking at the cigarette: the same, the neck stretched toward it and the bill open.
  reach: { rise: 1, tail: 0.35, fan: 0.9, crane: -0.1, reach: 0.4, jaw: 0.4, legs: -0.65, knee: 0.1, toes: -0.2, fold: 0, lift: 0.55, sweep: 0.4, twist: 0.6, cup: 0.15 },
}

// Its stroke, as `beat` takes it: shallower and stiffer than a crow's, the hand doing more of it.
export const STROKE = { swing: 0.6, below: 0.05, sweep: 0.1, twist: 0.15, elbow: 0.2, wrist: 0.5, ride: 0.004 }
