// The crow's body as `bird-body.js` builds it: its numbers and its paint, to a real crow's
// proportions (`docs/research/crow.md`), half a metre from beak to tail (`birds.js` says how many
// times that it is drawn). `crow-figure.js` says what it does with it; `crow-poses.js` holds its
// poses as numbers. The primaries fold into the long spike over the tail that makes a crow's
// sitting outline; a beard of hackles hangs under its throat. Look only.

import { around, createBirdBody, quill, scallop } from './bird-body.js'

// Where each bone sits in the bind pose (wings spread, body level), in metres from the body's
// middle, facing +Z, +X the crow's left.
const JOINTS = {
  tail: [0, 0.012, -0.11],
  neck1: [0, 0.03, 0.085],
  neck2: [0, 0.04, 0.11],
  head: [0, 0.045, 0.135],
  jaw: [0, 0.044, 0.165],
  shoulder: [0.03, 0.035, 0.065],
  elbow: [0.105, 0.035, 0.06],
  wrist: [0.195, 0.035, 0.066],
  hip: [0.02, -0.03, 0.005],
  shin: [0, -0.036, 0.004], // from the hip to the top of the bare leg, below the trousers
  foot: [0, -0.045, 0], // and down it to the foot
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
  tail: [0, 80, 48, 48],
  trousers: [48, 80, 24, 24],
  leg: [72, 80, 16, 24],
  toes: [88, 80, 16, 16],
  beard: [104, 80, 24, 48],
}
// Dark Souls' crow: black gone purple, feather edges a grey violet, the beak bone-pale and silver
// over a dark lower half, the legs and toes banded. Lifted enough for the feathers to read in a lit
// place; the sheen, as a crow's in the sun, is a scatter of violet and blue.
const INK = {
  base: 0x231f2c,
  edge: 0x48425c,
  belly: 0x27232f,
  dark: 0x100e14,
  shaft: 0x4a4560,
  sheen: [0x4e3b70, 0x384a78, 0x3a2f5e],
  gloss: [0x6f7fb8, 0x8b95c9, 0x5d6aa8, 0xa9b2dc], // the hackles' shine in the sun, blue going white
  silver: 0xd2d5db,
  shine: 0xeef0f4,
  bone: 0xa6abb5,
  jaw: 0x4a4e58,
  gape: 0x0d0c10,
  leg: 0x2c2c33,
  scute: 0x8d8f97,
  claw: 0x0f0f12,
  ring: 0x6a6475,
  iris: 0x1c1216,
  pupil: 0x050506,
  glint: 0xffffff,
}

/** The crow's texture: every region of `REGIONS` painted by `brush`. */
function paint({ paint, random }) {
  const sheen = (color, share) => (random() < share ? INK.sheen[Math.floor(random() * INK.sheen.length)] : color)
  const feathers = (s, t, edge, base, share) => {
    const part = quill(s, edge)
    return part === 'edge' ? INK.dark : part === 'shaft' ? INK.shaft : sheen(base, share)
  }

  // Long hackles running down, dark between, a streak of blue-white shine along some: a raven's
  // throat and upper breast in the sun.
  const gloss = () => INK.gloss[Math.floor(random() * INK.gloss.length)]
  const hackles = (x, y, share) => {
    const lane = (x + Math.floor(y / 5)) % 4
    if (lane === 0) return INK.dark
    if (lane === 2 && random() < share) return gloss()
    return sheen(INK.base, 0.12)
  }
  // The body, rump on the left and the neck on the right, the back at the top round to the belly:
  // small contour feathers, glossier on the back; on the upper breast, hackles.
  paint('body', (s, t, x, y) => {
    if (s > 0.68 && t > 0.42) return hackles(x, y, 0.35 * (s - 0.68) / 0.32 + 0.1)
    const back = t < 0.5
    if (scallop(s, t, 14, 10)) return back ? INK.edge : 0x3a3548
    return back ? sheen(INK.base, 0.1) : INK.belly
  })
  // The head, nape on the left and the face on the right, the crown at the top round to the
  // throat. The eye, small and dark with a pale ring and a glint, is where the side of the head
  // looks forward, the same on both sides; the bristles lie over the bill's root; the throat is
  // shaggy with hackles.
  paint('head', (s, t, x, y) => {
    const [, , w, h] = REGIONS.head
    const ex = 0.7 * w
    const ey = 0.43 * h
    const dx = x + 0.5 - ex
    const dy = y + 0.5 - ey
    const d = Math.hypot(dx, dy)
    if (Math.round(dx) === 1 && Math.round(dy) === -1) return INK.glint
    if (d < 1.3) return INK.pupil
    if (d < 2.2) return INK.iris
    if (d < 3) return INK.ring
    if (s > 0.84 && t < 0.62) return (x + y) % 3 === 0 ? INK.edge : INK.dark // the bristles
    if (t > 0.68) return hackles(x, y, 0.3) // the throat's hackles
    return scallop(s, t, 9, 8) ? INK.edge : sheen(INK.base, 0.06)
  })
  // The upper bill, its root on the left and the tip on the right, the ridge at the top: silver
  // along the ridge with a line of shine, bone down its sides, the gape a dark line at the bottom.
  paint('beak', (s, t, x) => {
    if (s < 0.12 && t < 0.7) return random() < 0.6 ? INK.dark : INK.edge
    if (t > 0.88) return INK.gape
    if (t < 0.1 && s > 0.2 && s < 0.8) return INK.shine
    if (t < 0.3) return s > 0.92 ? INK.bone : INK.silver
    return x % 7 === 3 && t > 0.5 ? 0x9399a3 : INK.bone
  })
  // The lower bill: dark, pale along its lower edge.
  paint('jaw', (s, t) => (t > 0.75 ? 0x6a6f7a : t < 0.15 ? INK.gape : INK.jaw))
  // The arm from above, from the body on the left out to the elbow, the leading edge at the top:
  // coverts in scallops, the tertials behind in long feathers.
  paint('arm', (s, t) => (t < 0.4 ? (scallop(s, t, 6, 3) ? INK.edge : sheen(INK.base, 0.1)) : feathers(s, t, 5, INK.base, 0.06)))
  // The forearm's secondaries: coverts over the front, the long feathers behind lying back, each
  // with its shaft, a pale fringe at their ends.
  paint('secondaries', (s, t) => {
    if (t < 0.22) return scallop(s, t, 7, 2) ? INK.edge : sheen(INK.base, 0.08)
    if (t > 0.92) return INK.edge
    return feathers(s, t, 7, INK.base, 0.05)
  })
  // The hand's primaries, from the wrist out to the fingers: coverts over the front, then the long
  // feathers running out along it one behind another, their ends fringed.
  paint('primaries', (s, t) => {
    if (t < 0.18) return scallop(s, t, 8, 1) ? INK.edge : INK.base
    if (s > 0.9) return INK.edge
    return feathers((t - 0.18) / 0.82, s, 6, INK.base, 0.05)
  })
  // The tail from above, across it left to right, the rump at the top: twelve feathers side by side.
  paint('tail', (s, t) => {
    if (t < 0.12) return scallop(s, t, 6, 1) ? INK.edge : INK.base // the coverts over its root
    if (t > 0.94) return INK.edge
    return feathers(s, t, 8, INK.base, 0.05)
  })
  // The trousers: feathers hanging in strokes.
  paint('trousers', (s, t, x, y) => ((x + Math.floor(y / 3)) % 4 === 0 ? INK.dark : t > 0.8 ? INK.edge : sheen(INK.base, 0.05)))
  // The bare leg and the toes: scales in bands, the claws black.
  paint('leg', (s, t, x, y) => (Math.floor(y / 2) % 2 === 0 ? INK.scute : INK.leg))
  paint('toes', (s, t, x) => (s > 0.8 ? INK.claw : Math.floor(x / 2) % 2 === 0 ? INK.scute : INK.leg))
  // The beard of hackles under the throat, its root at the top, hanging in long pointed strokes.
  paint('beard', (s, t, x, y) => hackles(x, y, 0.4))
}

// ---------------------------------------------------------------- the shapes

// ---- The body, neck, head and upper bill: one loft. Each ring `[z, side]`, side from the back down
// to the belly. Its back is one line from the rump over the shoulders and the nape to the crown,
// with no step; the breast is deepest a little ahead of the middle; the neck is all feathers, so
// barely narrower than the head; the forehead runs down steeply into the bill, the bristles over
// its root; the bill is as long as the head, heavy at its root and hooked a little at the tip.
const LOFT = [
  [-0.17, [[0, 0.018], [0.008, 0.017], [0.012, 0.012], [0.008, 0.007], [0, 0.005]]],
  [-0.125, [[0, 0.026], [0.016, 0.024], [0.024, 0.012], [0.016, -0.002], [0, -0.008]]],
  [-0.085, [[0, 0.04], [0.03, 0.037], [0.043, 0.012], [0.032, -0.027], [0, -0.036]]],
  [-0.03, [[0, 0.05], [0.037, 0.046], [0.05, 0.012], [0.039, -0.042], [0, -0.054]]],
  [0.025, [[0, 0.053], [0.038, 0.049], [0.051, 0.012], [0.04, -0.046], [0, -0.06]]],
  [0.07, [[0, 0.055], [0.034, 0.051], [0.045, 0.016], [0.034, -0.03], [0, -0.042]]],
  [0.1, [[0, 0.06], [0.029, 0.056], [0.038, 0.03], [0.031, -0.002], [0, -0.024]]],
  [0.122, [[0, 0.068], [0.026, 0.064], [0.033, 0.042], [0.027, 0.016], [0, -0.004]]],
  [0.14, [[0, 0.077], [0.022, 0.074], [0.026, 0.054], [0.022, 0.03], [0, 0.014]]],
  [0.158, [[0, 0.075], [0.019, 0.072], [0.022, 0.055], [0.018, 0.038], [0, 0.031]]],
  [0.174, [[0, 0.066], [0.013, 0.064], [0.015, 0.054], [0.013, 0.046], [0, 0.043]]],
  [0.19, [[0, 0.058], [0.008, 0.056], [0.0105, 0.05], [0.008, 0.046], [0, 0.045]]],
  [0.205, [[0, 0.051], [0.005, 0.05], [0.0065, 0.047], [0.005, 0.044], [0, 0.043]]],
  [0.218, [[0, 0.041], [0, 0.041], [0, 0.041], [0, 0.041], [0, 0.041]]],
]
const NECK_FROM = 0.105 // where the body's paint gives way to the head's, along Z
const BILL_FROM = 0.174 // and the head's to the bill's
// The lower bill, from the jaw's hinge under the face to its tip, closing under the upper.
const JAW = [
  [0.165, [[0, 0.046], [0.013, 0.045], [0.014, 0.04], [0.01, 0.035], [0, 0.033]]],
  [0.192, [[0, 0.0445], [0.007, 0.044], [0.008, 0.041], [0.006, 0.038], [0, 0.037]]],
  [0.212, [[0, 0.041], [0, 0.041], [0, 0.041], [0, 0.041], [0, 0.041]]],
]

// The beard: hackles hanging in three points under the throat, the middle one longest, on the
// neck. Each `[x, length]`, hanging down and back from the throat in the bind pose, so that down
// the breast it hangs as the body sits up and the head is held level.
const BEARD = [[-0.014, 0.066], [0, 0.088], [0.014, 0.066]]
const BEARD_ROOT = [0.0, 0.004, 0.13]
const BEARD_HANG = Math.PI / 2 + 0.3

// Which bones the loft's rings hang on, by where along Z: `[z, { bone: weight }]`, eased between.
// The rump goes with the tail, the neck shares the turn of the head down its length.
const LOFT_SKIN = [
  [-0.17, { tail: 1 }],
  [-0.13, { tail: 0.65, root: 0.35 }],
  [-0.06, { root: 1 }],
  [0.07, { root: 1 }],
  [0.1, { root: 0.45, neck1: 0.55 }],
  [0.12, { neck1: 0.25, neck2: 0.75 }],
  [0.142, { neck2: 0.2, head: 0.8 }],
  [0.155, { head: 1 }],
]

// ---- The wing, left, out along +X, its leading edge at +Z, each plate in its bone's own frame, as
// `vane` takes it: stations `[x, lead, trail]` along its span, and how it is rounded.
// The arm: coverts over the humerus, the long tertials behind it next to the body.
const ARM = {
  stations: [[-0.02, 0.022, -0.115], [0.015, 0.025, -0.12], [0.045, 0.024, -0.105], [0.07, 0.021, -0.075], [0.088, 0.016, -0.04], [0.095, 0.01, -0.01]],
  thick: 0.03, camber: 0.005,
}
// The forearm: the secondaries, their ends in a long curve.
const SECONDARIES = {
  stations: [[-0.015, 0.024, -0.122], [0.02, 0.027, -0.128], [0.055, 0.027, -0.126], [0.085, 0.024, -0.118], [0.1, 0.018, -0.09], [0.106, 0.01, -0.04]],
  thick: 0.024, camber: 0.006, droop: 0.004,
}
// The hand: the primaries, sweeping back to a rounded tip, their ends standing apart in soft
// scallops toward it as a crow's fingers do, the whole bending down a little to the tip.
const PRIMARIES = {
  stations: [
    [-0.015, 0.026, -0.126], [0.04, 0.025, -0.132], [0.1, 0.019, -0.142], [0.15, 0.008, -0.145], [0.185, -0.004, -0.128],
    [0.205, -0.012, -0.138], [0.225, -0.022, -0.112], [0.243, -0.03, -0.116], [0.258, -0.04, -0.088], [0.27, -0.05, -0.075], [0.278, -0.058, -0.064],
  ],
  thick: 0.018, camber: 0.004, droop: 0.02,
}
// The tail, along its length from its root inside the rump (and turned to lie back along −Z), its
// half-width at each station: widening to a square end with rounded corners.
const TAIL = {
  stations: [[0, 0.02, -0.02], [0.06, 0.032, -0.032], [0.12, 0.04, -0.04], [0.165, 0.045, -0.045], [0.188, 0.036, -0.036], [0.197, 0.014, -0.014]],
  thick: 0.024, camber: 0.003, shift: 0.03,
}

// How each plate of the left wing lies folded, in the body's frame: its root, the way its span
// runs, and how much of its chord is left showing as the feathers stack. The span runs back and a
// little down along the flank, the leading edge up and the underside out. The primaries lie
// outermost and highest, running back over the rump to end on the tail short of its tip: the
// spike. The secondaries under them fall back and down, their lower edge the diagonal from the
// shoulder to the thigh. The arm covers the shoulder.
const FOLD = {
  arm: { at: [0.046, 0.026, 0.038], runs: [-0.06, -0.3, -1], chord: 0.42 },
  secondaries: { at: [0.047, 0.022, 0.03], runs: [-0.05, -0.32, -1], chord: 0.58 },
  primaries: { at: [0.049, 0.026, 0.058], runs: [-0.17, -0.05, -1], chord: 0.36 },
}
// Folded, each plate leans out at the top and in at the bottom, with the round of the flank from
// the shoulder down under the belly, so the wing hugs the body.
const FOLD_LEAN = 0.22

// ---- The leg, left, from the hip down: trousers, the bare leg, four toes.
const TROUSERS = [
  [0, [[0, 0.019], [0.014, 0.015], [0.018, 0], [0.014, -0.015], [0, -0.019]]],
  [0.022, [[0, 0.015], [0.012, 0.012], [0.014, 0], [0.011, -0.012], [0, -0.015]]],
  [0.04, [[0, 0.006], [0.005, 0.004], [0.006, 0], [0.005, -0.004], [0, -0.006]]],
]
const SHANK = [0, [[0, 0.006], [0.0045, 0.004], [0.006, 0], [0.0045, -0.004], [0, -0.006]]]
// Each toe: its turn off straight ahead, and its length; the last points back.
const TOES = [[-0.38, 0.032], [0, 0.036], [0.38, 0.032], [Math.PI, 0.024]]
const toe = (length) => [
  [0, [[0, 0.004], [0.0035, 0.0025], [0.0045, 0], [0.0035, -0.002], [0, -0.003]]],
  [length * 0.75, [[0, 0.003], [0.0025, 0.002], [0.003, 0], [0.0025, -0.0015], [0, -0.002]]],
  [length, [[0, -0.002], [0, -0.002], [0, -0.002], [0, -0.002], [0, -0.002]]],
]

const CROW = {
  joints: JOINTS,
  loft: LOFT,
  loftSkin: LOFT_SKIN,
  loftPaint: (c) =>
    c.z < NECK_FROM ? ['body', around(-0.17, NECK_FROM)] : c.z < BILL_FROM ? ['head', around(0.095, BILL_FROM, [0, 0.047])] : ['beak', around(BILL_FROM - 0.004, 0.218, [0, 0.047])],
  loftRound: (c) => c.z < BILL_FROM,
  jaw: { rings: JAW, at: around(0.165, 0.212, [0, 0.04]) },
  tail: TAIL,
  wing: { arm: ARM, secondaries: SECONDARIES, primaries: PRIMARIES },
  fold: FOLD,
  foldLean: FOLD_LEAN,
  legs: { trousers: TROUSERS, shank: SHANK, toes: TOES, toe },
  extras: ({ loft, painted, shade }) => BEARD.map(([x, length]) => {
    const point = loft([
      [0, [[0, 0.012], [0.011, 0.009], [0.014, 0], [0.011, -0.009], [0, -0.012]]],
      [length * 0.55, [[0, 0.009], [0.008, 0.007], [0.01, 0], [0.008, -0.007], [0, -0.009]]],
      [length, [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]],
    ])
    const hung = painted(point, 'beard', (p) => [Math.abs(p.x) / 0.03 + 0.25, p.z / length]).rotateX(BEARD_HANG)
    return [shade(hung.translate(BEARD_ROOT[0] + x, BEARD_ROOT[1], BEARD_ROOT[2])), 'neck2']
  }),
  regions: REGIONS,
  paint,
  mouth: [0.008, -0.001, 0.055], // at the gape, on the crow's left
  beakTip: 0.218 - JOINTS.head[2],
  // A crow's eyes are on the sides of its head: it sees a thing with one of them, its head turned
  // side-on to it, and barely at all what is straight ahead of its bill (`crow-figure.js` turns
  // the head so).
  eyeForward: 0.35,
}

/** The crow's body: `{ group, head, mouth, feet, beakTip, eyeForward, pose(p, base) }` (`bird-body.js`). */
export const createCrowBody = () => createBirdBody(CROW)
