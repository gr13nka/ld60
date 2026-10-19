// A herring gull's body as `bird-body.js` builds it, to play the crow's part (`&bird=gull`,
// `birds.js`): its numbers and its paint, at a real gull's size, 0.6 m from beak to tail
// (`docs/research/crow.md`, A gull in its place). Heavier and deeper in the body than the crow,
// a round white head on a neck it sinks or stretches, a stout yellow bill with a hooked tip and a
// red spot on the angle of the lower bill, a pale eye ringed orange; long narrow pointed wings
// with no fingers, grey with black ends, that fold to cross over a short white tail and run on
// past it; bare pink legs longer than a crow's, and webbed feet. `gull-poses.js` holds its poses.
// Look only.

import { around, createBirdBody, quill, scallop } from './bird-body.js'

// Where each bone sits in the bind pose (wings spread, body level), in metres from the body's
// middle, facing +Z, +X the gull's left.
const JOINTS = {
  tail: [0, 0.016, -0.16],
  neck1: [0, 0.036, 0.09],
  neck2: [0, 0.046, 0.12],
  head: [0, 0.056, 0.15],
  jaw: [0, 0.05, 0.205],
  shoulder: [0.035, 0.04, 0.07],
  elbow: [0.16, 0.04, 0.062],
  wrist: [0.31, 0.04, 0.068],
  hip: [0.022, -0.035, 0],
  shin: [0, -0.03, 0.004], // from the hip to the top of the bare leg, below the white thigh
  foot: [0, -0.07, 0], // and down it to the foot: a longer bare leg than a crow's
}

// ---------------------------------------------------------------- the paint

// Where each part's paint lies in the texture: [x, y, w, h], y down.
const REGIONS = {
  body: [0, 0, 64, 48],
  head: [64, 0, 40, 48],
  beak: [104, 0, 24, 32],
  jaw: [104, 32, 24, 16],
  arm: [0, 48, 40, 32],
  secondaries: [40, 48, 40, 32],
  primaries: [80, 48, 48, 32],
  tail: [0, 80, 32, 24],
  trousers: [32, 80, 16, 16],
  leg: [48, 80, 8, 16],
  toes: [56, 80, 16, 16],
  web: [72, 80, 16, 16],
}
// A herring gull in summer: the back and the upper wing a pale blue-grey, the rest white, the ends
// of the wings black with white spots, the bill yellow and its spot red, the legs pink. The white
// is held off pure white: anything brighter than `picture.js`'s bloom threshold glows.
const INK = {
  white: 0xdedcd5,
  shade: 0xcdcbc4, // feather edges on the white
  grey: 0x8f9cab,
  edge: 0x7c8999, // feather edges on the grey
  pale: 0xa8b3bf, // the grey's lighter coverts
  black: 0x1b1b20,
  ink: 0x2c2c33, // a black feather's shaft
  yellow: 0xe3ae26,
  ridge: 0xedc54a,
  tip: 0xecd486,
  cut: 0xb98a1c, // the bill's cutting edge
  red: 0xc5302a,
  iris: 0xeadc8e,
  pupil: 0x0e0e10,
  ring: 0xe28a2a,
  glint: 0xffffff,
  pink: 0xd5948e,
  scute: 0xbf817c,
  claw: 0x3a3030,
  web: 0xc98680,
}

/** The gull's texture: every region of `REGIONS` painted by `brush`. */
function paint({ paint, random }) {
  const flecked = (color, fleck, share) => (random() < share ? fleck : color)
  const feathers = (s, edges, count) => {
    const part = quill(s, count)
    return part === 'edge' ? edges[0] : part === 'shaft' ? edges[1] : edges[2]
  }

  // The body, rump on the left and the neck on the right, the back at the top round to the belly:
  // the grey mantle over the back as far as the neck, white below and on the neck, small contour
  // feathers on both.
  paint('body', (s, t) => {
    const mantle = s < 0.86 && (t < 0.3 || (t < 0.36 && random() < (0.36 - t) / 0.06))
    if (scallop(s, t, 14, 10)) return mantle ? INK.edge : flecked(INK.white, INK.shade, 0.5)
    return mantle ? INK.grey : INK.white
  })
  // The head, nape on the left and the face on the right, the crown at the top round to the
  // throat: white, the eye pale with a black pupil and an orange ring, where the side of the head
  // looks forward, the same on both sides.
  paint('head', (s, t, x, y) => {
    const [, , w, h] = REGIONS.head
    const dx = x + 0.5 - 0.76 * w
    const dy = y + 0.5 - 0.42 * h
    const d = Math.hypot(dx, dy)
    if (Math.round(dx) === 1 && Math.round(dy) === -1) return INK.glint
    if (d < 1) return INK.pupil
    if (d < 2.1) return INK.iris
    if (d < 3) return INK.ring
    return scallop(s, t, 9, 8) && random() < 0.4 ? INK.shade : INK.white
  })
  // The upper bill, its root on the left and the tip on the right, the ridge at the top: yellow,
  // lighter along the ridge and at the hooked tip, its cutting edge darker along the bottom.
  paint('beak', (s, t) => {
    if (t > 0.88) return INK.cut
    if (s > 0.9) return INK.tip
    return t < 0.14 ? INK.ridge : INK.yellow
  })
  // The lower bill, from the hinge to the tip, its gape at the top: yellow, the red spot on the
  // angle near its tip.
  paint('jaw', (s, t) => {
    if (t < 0.12) return INK.cut
    if (s > 0.6 && s < 0.9 && t > 0.3) return INK.red
    return s > 0.93 ? INK.tip : INK.yellow
  })
  // The arm from above, from the body on the left out to the elbow, the leading edge at the top:
  // coverts in scallops, the tertials behind in long feathers, their ends white.
  paint('arm', (s, t) => {
    if (t > 0.84) return INK.white
    if (t < 0.4) return scallop(s, t, 6, 3) ? INK.edge : INK.pale
    return feathers(s, [INK.edge, INK.edge, INK.grey], 5)
  })
  // The forearm's secondaries: coverts over the front, the long grey feathers behind, their ends a
  // white band, the gull's trailing edge.
  paint('secondaries', (s, t) => {
    if (t > 0.8) return INK.white
    if (t < 0.22) return scallop(s, t, 7, 2) ? INK.edge : INK.pale
    return feathers(s, [INK.edge, INK.edge, INK.grey], 7)
  })
  // The hand's primaries, from the wrist out to the tip: grey to halfway, then black, a white
  // mirror near the end and a white tip.
  paint('primaries', (s, t) => {
    if (s > 0.965) return INK.white
    const mirror = Math.hypot((s - 0.88) / 0.05, (t - 0.45) / 0.22) < 1
    if (mirror) return INK.white
    if (s < 0.52) return t < 0.18 ? (scallop(s, t, 8, 1) ? INK.edge : INK.pale) : feathers((t - 0.18) / 0.82, [INK.edge, INK.edge, INK.grey], 6)
    if (s < 0.58) return random() < (s - 0.52) / 0.06 ? INK.black : INK.grey
    return feathers((t - 0.18) / 0.82, [INK.black, INK.ink, INK.black], 6)
  })
  // The tail, across it left to right, the rump at the top: white, faint lines between its feathers.
  paint('tail', (s) => (quill(s, 8) === 'edge' ? INK.shade : INK.white))
  // The thighs: white, feathers hanging in strokes.
  paint('trousers', (s, t, x, y) => ((x + Math.floor(y / 3)) % 4 === 0 ? INK.shade : INK.white))
  // The bare leg, the toes and the webs between them: pink, scales in bands, the claws dark.
  paint('leg', (s, t, x, y) => (Math.floor(y / 2) % 3 === 0 ? INK.scute : INK.pink))
  paint('toes', (s, t, x) => (s > 0.86 ? INK.claw : Math.floor(x / 2) % 3 === 0 ? INK.scute : INK.pink))
  paint('web', (s, t, x, y) => ((x + y) % 5 === 0 ? INK.scute : INK.web))
}

// ---------------------------------------------------------------- the shapes

// ---- The body, neck, head and upper bill: one loft. Each ring `[z, side]`, side from the back down
// to the belly. A broad, nearly flat back; the breast deep and full a little ahead of the middle;
// the neck thick with feathers; the head round, its crown high, the forehead sloping gently into
// the bill with no bristles; the bill stout and as deep at its end as at its root, the upper half
// hooked down over the tip.
const LOFT = [
  [-0.2, [[0, 0.022], [0.01, 0.021], [0.015, 0.014], [0.01, 0.008], [0, 0.006]]],
  [-0.15, [[0, 0.032], [0.022, 0.03], [0.032, 0.014], [0.022, -0.004], [0, -0.012]]],
  [-0.1, [[0, 0.046], [0.038, 0.044], [0.052, 0.012], [0.04, -0.032], [0, -0.044]]],
  [-0.04, [[0, 0.056], [0.046, 0.053], [0.062, 0.01], [0.05, -0.05], [0, -0.066]]],
  [0.02, [[0, 0.058], [0.047, 0.055], [0.063, 0.01], [0.052, -0.054], [0, -0.072]]],
  [0.07, [[0, 0.058], [0.042, 0.055], [0.055, 0.014], [0.045, -0.04], [0, -0.056]]],
  [0.105, [[0, 0.06], [0.032, 0.057], [0.042, 0.028], [0.034, -0.006], [0, -0.026]]],
  [0.13, [[0, 0.066], [0.026, 0.063], [0.032, 0.044], [0.026, 0.022], [0, 0.008]]],
  [0.155, [[0, 0.077], [0.024, 0.074], [0.03, 0.056], [0.025, 0.038], [0, 0.028]]],
  [0.178, [[0, 0.081], [0.024, 0.078], [0.029, 0.06], [0.024, 0.043], [0, 0.036]]],
  [0.198, [[0, 0.075], [0.019, 0.072], [0.023, 0.058], [0.019, 0.046], [0, 0.041]]],
  [0.214, [[0, 0.066], [0.011, 0.064], [0.013, 0.056], [0.011, 0.049], [0, 0.047]]],
  [0.235, [[0, 0.062], [0.008, 0.061], [0.0095, 0.056], [0.008, 0.051], [0, 0.05]]],
  [0.255, [[0, 0.061], [0.0065, 0.06], [0.0075, 0.056], [0.0065, 0.052], [0, 0.051]]],
  [0.265, [[0, 0.0595], [0.005, 0.0585], [0.006, 0.0545], [0.005, 0.05], [0, 0.0485]]],
  [0.272, [[0, 0.0545], [0.0025, 0.054], [0.003, 0.051], [0.0025, 0.048], [0, 0.0465]]],
  [0.275, [[0, 0.047], [0, 0.047], [0, 0.047], [0, 0.047], [0, 0.047]]],
]
const NECK_FROM = 0.115 // where the body's paint gives way to the head's, along Z
const BILL_FROM = 0.21 // and the head's to the bill's
// The lower bill, from the jaw's hinge under the face to its tip, closing under the upper; the
// angle of its underside (the gonys) near the tip, where the red spot is.
const JAW = [
  [0.205, [[0, 0.05], [0.014, 0.049], [0.015, 0.044], [0.011, 0.039], [0, 0.037]]],
  [0.23, [[0, 0.0495], [0.008, 0.049], [0.009, 0.046], [0.007, 0.042], [0, 0.04]]],
  [0.25, [[0, 0.05], [0.006, 0.0495], [0.0065, 0.047], [0.005, 0.0435], [0, 0.0405]]],
  [0.264, [[0, 0.049], [0, 0.049], [0, 0.049], [0, 0.049], [0, 0.049]]],
]

// Which bones the loft's rings hang on, by where along Z: `[z, { bone: weight }]`, eased between.
const LOFT_SKIN = [
  [-0.2, { tail: 1 }],
  [-0.16, { tail: 0.65, root: 0.35 }],
  [-0.08, { root: 1 }],
  [0.075, { root: 1 }],
  [0.105, { root: 0.45, neck1: 0.55 }],
  [0.13, { neck1: 0.25, neck2: 0.75 }],
  [0.155, { neck2: 0.2, head: 0.8 }],
  [0.168, { head: 1 }],
]

// ---- The wing, left, out along +X, its leading edge at +Z, each plate in its bone's own frame, as
// `vane` takes it: stations `[x, lead, trail]` along its span, and how it is rounded. Long and
// narrow: the span 2.3 times the length, against the crow's 1.9.
// The arm: coverts over the humerus, the long tertials behind it next to the body.
const ARM = {
  stations: [[-0.02, 0.022, -0.12], [0.02, 0.026, -0.125], [0.06, 0.026, -0.115], [0.1, 0.022, -0.1], [0.125, 0.016, -0.07], [0.135, 0.01, -0.03]],
  thick: 0.03, camber: 0.005,
}
// The forearm: the secondaries, many and long on a gull, their white ends in a straight line.
const SECONDARIES = {
  stations: [[-0.015, 0.024, -0.13], [0.03, 0.027, -0.135], [0.08, 0.026, -0.13], [0.12, 0.022, -0.12], [0.15, 0.016, -0.09], [0.16, 0.01, -0.04]],
  thick: 0.024, camber: 0.006, droop: 0.004,
}
// The hand: the primaries, sweeping back and narrowing to a point, with none of a crow's fingers.
const PRIMARIES = {
  stations: [
    [-0.015, 0.026, -0.13], [0.06, 0.024, -0.13], [0.14, 0.016, -0.125], [0.22, 0.004, -0.11],
    [0.29, -0.012, -0.09], [0.34, -0.03, -0.07], [0.372, -0.046, -0.06], [0.39, -0.056, -0.058],
  ],
  thick: 0.016, camber: 0.004, droop: 0.015,
}
// The tail, along its length from its root inside the rump (and turned to lie back along −Z), its
// half-width at each station: short and square, its corners a little rounded.
const TAIL = {
  stations: [[0, 0.022, -0.022], [0.045, 0.035, -0.035], [0.095, 0.044, -0.044], [0.13, 0.047, -0.047], [0.145, 0.042, -0.042], [0.15, 0.02, -0.02]],
  thick: 0.02, camber: 0.003, shift: 0.03,
}

// How each plate of the left wing lies folded, in the body's frame: its root, the way its span
// runs, and how much of its chord is left showing. Nearer level than the crow's, as the gull sits
// nearer level; the primaries outermost and highest, crossing over the tail and running on past
// its tip, black.
const FOLD = {
  arm: { at: [0.06, 0.036, 0.04], runs: [-0.07, -0.16, -1], chord: 0.48 },
  secondaries: { at: [0.06, 0.04, 0.02], runs: [-0.06, -0.12, -1], chord: 0.42 },
  primaries: { at: [0.056, 0.052, 0.045], runs: [-0.13, -0.06, -1], chord: 0.34 },
}
// Folded, the plates stand upright against the widest of the flank, where the crow's lean out at the
// top: so that from in front the wings lie behind the breast rather than standing off it.
const FOLD_LEAN = 0

// ---- The leg, left, from the hip down: a short white thigh, the bare pink leg, three toes forward
// joined by webs and a small one behind.
const TROUSERS = [
  [0, [[0, 0.02], [0.016, 0.016], [0.02, 0], [0.016, -0.016], [0, -0.02]]],
  [0.018, [[0, 0.014], [0.012, 0.011], [0.014, 0], [0.011, -0.011], [0, -0.014]]],
  [0.03, [[0, 0.006], [0.005, 0.004], [0.006, 0], [0.005, -0.004], [0, -0.006]]],
]
const SHANK = [0, [[0, 0.0065], [0.005, 0.0045], [0.0065, 0], [0.005, -0.0045], [0, -0.0065]]]
// Each toe: its turn off straight ahead, and its length; the last, small, points back.
const SPREAD = 0.42
const TOES = [[-SPREAD, 0.05], [0, 0.055], [SPREAD, 0.05], [Math.PI, 0.012]]
const toe = (length) => [
  [0, [[0, 0.0045], [0.004, 0.003], [0.005, 0], [0.004, -0.0025], [0, -0.0035]]],
  [length * 0.8, [[0, 0.0032], [0.0028, 0.0022], [0.0034, 0], [0.0028, -0.0018], [0, -0.0025]]],
  [length, [[0, -0.002], [0, -0.002], [0, -0.002], [0, -0.002], [0, -0.002]]],
]
// The web between the three front toes: a thin plate lying flat on them, forward from the foot,
// its half-width at each station, reaching almost to their tips.
const WEB = { stations: [[0, 0.004, -0.004], [0.015, 0.008, -0.008], [0.03, 0.013, -0.013], [0.044, 0.018, -0.018]], thick: 0.002 }

const GULL = {
  joints: JOINTS,
  loft: LOFT,
  loftSkin: LOFT_SKIN,
  loftPaint: (c) =>
    c.z < NECK_FROM ? ['body', around(-0.2, NECK_FROM)] : c.z < BILL_FROM ? ['head', around(0.105, BILL_FROM, [0, 0.058])] : ['beak', around(BILL_FROM - 0.004, 0.275, [0, 0.056])],
  loftRound: (c) => c.z < BILL_FROM,
  jaw: { rings: JAW, at: around(0.205, 0.264, [0, 0.045]) },
  tail: TAIL,
  wing: { arm: ARM, secondaries: SECONDARIES, primaries: PRIMARIES },
  fold: FOLD,
  foldLean: FOLD_LEAN,
  legs: { trousers: TROUSERS, shank: SHANK, toes: TOES, toe },
  extras: ({ vane, shade, mirrored, placed }) => ['L', 'R'].map((side) => {
    const web = vane(WEB.stations, { ...WEB, name: 'web' }).rotateY(-Math.PI / 2).translate(0, 0.0025, 0)
    return [shade(placed(`foot${side}`, side === 'R' ? mirrored(web) : web)), `foot${side}`]
  }),
  regions: REGIONS,
  paint,
  mouth: [0.009, -0.005, 0.085], // at the gape, on the gull's left
  beakTip: 0.275 - JOINTS.head[2],
  // A gull's eyes are on the sides of its head as a crow's are, set a little more forward.
  eyeForward: 0.4,
  // Smooth light, no cels: in flight its faces crossed the cel's edges every wingbeat, and its
  // colours flickered (the owner, 2026-10-16). The shadow side is kept about as light as the
  // brut ramp's, the edge-on near its middle step.
  ramp: { wrap: 0.3, lift: 0.22 },
}

/** The gull's body: `{ group, head, mouth, feet, beakTip, eyeForward, pose(p, base) }` (`bird-body.js`). */
export const createGullBody = () => createBirdBody(GULL)
