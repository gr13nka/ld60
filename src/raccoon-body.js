// The raccoon's body, made the PlayStation way: a few rigid, closed solids, each on a joint of its
// own, each wrapped in a small painted texture drawn without filtering (`npc-kit.js`). No skin:
// where two parts meet at a joint they overlap, and a ball sits at each shoulder, elbow, hip and
// knee, so nothing opens when it bends. `raccoon-poses.js` holds his poses as numbers and
// `raccoon-figure.js` what he does with them; this file turns a set of those numbers into joints.
//
// He is a raccoon's real shape, stood up: a pear for a body with a pot belly, a head wider than it
// is tall with a pointed snout, a black mask across the eyes with white over them and round the
// muzzle, round ears with pale rims, black hand-like paws, stocky legs on black feet, and a thick
// tail ringed in dark. He wears a tweed flat cap and a knitted scarf. The eyes, the nose and the
// cap are solids, never paint, because they have to read from across a corridor. Built to
// `HEIGHT` (0.9 m, `raccoon.js`) to the top of the ears, facing +Z, +X his left, his feet on the
// floor at the origin. Look only.

import * as THREE from 'three'
import { CIGARETTE_ASPECT } from './models.js'
import { ball, loft, paint } from './npc-kit.js'
import { celMaterial } from './shading.js'

/** The length of his cigarette, metres: a man's whole, though he is half a man, so that it reads. */
export const CIGARETTE_LENGTH = 0.085
export const CIGARETTE_RADIUS = (CIGARETTE_LENGTH / CIGARETTE_ASPECT) * 1.7 // thicker than a man's, to read against his dark paws

// ---------------------------------------------------------------- the skeleton

// The joints, parent first, each with its offset from the parent in the stood-up rest (metres).
// `root` is the pelvis, which the legs and the tail hang from; the `waist` leans the body from
// there, the `chest` bows it, and the head, the arms and the scarf are on the chest.
const SHOULDER = [0.14, 0.09, 0.015]
const HIP = [0.085, -0.03, 0]
const mirror = ([x, y, z]) => [-x, y, z]
const JOINTS = [
  ['root', null, [0, 0.3, 0]],
  ['waist', 'root', [0, 0.03, 0]],
  ['chest', 'waist', [0, 0.14, 0.015]],
  ['head', 'chest', [0, 0.2, 0.045]],
  ['cap', 'head', [0, 0.125, 0]],
  ['earL', 'head', [0.095, 0.115, -0.012]],
  ['earR', 'head', [-0.095, 0.115, -0.012]],
  ['shoulderL', 'chest', SHOULDER],
  ['elbowL', 'shoulderL', [0, -0.14, 0]],
  ['wristL', 'elbowL', [0, -0.12, 0]],
  ['shoulderR', 'chest', mirror(SHOULDER)],
  ['elbowR', 'shoulderR', [0, -0.14, 0]],
  ['wristR', 'elbowR', [0, -0.12, 0]],
  ['hipL', 'root', HIP],
  ['kneeL', 'hipL', [0, -0.13, 0.005]],
  ['ankleL', 'kneeL', [0, -0.13, 0]],
  ['hipR', 'root', mirror(HIP)],
  ['kneeR', 'hipR', [0, -0.13, 0.005]],
  ['ankleR', 'kneeR', [0, -0.13, 0]],
  ['tail1', 'root', [0, -0.02, -0.1]],
  ['tail2', 'tail1', [0, 0, -0.12]],
  ['tail3', 'tail2', [0, 0, -0.12]],
]

// ---------------------------------------------------------------- the paint

// Grizzled grey-brown fur, warm enough to read as brown in a shadow, and the few other colours.
const FUR = { base: '#97836a', dark: '#4e4033', light: '#cdbb9c' }
const BELLY = { base: '#bba98a', dark: '#6a5b48', light: '#e0d3b8' }
const PALE = '#ece3cf' // the white of the face, the ear rims
const BLACK = '#17120f' // the mask, the paws, the feet
const RING = '#2b2119' // the tail's rings
const TWEED = { base: '#80522e', dark: '#4a2c16', light: '#b07c4c' }
const RED = '#d4202b'
const CREAM = '#f2e5c2'

/** Grizzled fur: soft dark and pale patches over `colors.base`, and grain. */
const grizzle = (colors, seed, size = 4) => paint(32, 32, (b) => {
  b.fill(colors.base)
  b.blotches(colors.dark, { count: 16, size, alpha: 0.5 })
  b.blotches(colors.light, { count: 12, size, alpha: 0.45 })
  b.grain(0.12)
}, seed)

// The tail: five dark rings round three pieces, and a dark tip. Each piece's v runs along its
// length, so a ring is a band across the whole width.
const tailPaint = (rings, seed, tip = false) => paint(8, 32, (b) => {
  b.fill(FUR.base)
  b.blotches(FUR.dark, { count: 8, size: 3, alpha: 0.4 })
  b.blotches(FUR.light, { count: 8, size: 3, alpha: 0.45 })
  for (const [from, to] of rings) b.rect(0, from, 1, to, RING)
  if (tip) b.rect(0, 0, 1, 0.14, RING)
  b.grain(0.1)
}, seed)

/**
 * His textures, painted once. The skull's wraps once round it from chin to crown, its front at
 * u = 0.5: a black band across the eyes with a white brow over each, a dark stripe up the
 * forehead, and white on the cheeks under the band.
 */
function paints() {
  return {
    fur: grizzle(FUR, 3),
    belly: grizzle(BELLY, 5),
    skull: paint(32, 32, (b) => {
      b.fill(FUR.base)
      b.blotches(FUR.dark, { count: 14, size: 3, alpha: 0.5 })
      b.blotches(FUR.light, { count: 10, size: 3, alpha: 0.4 })
      b.rect(0.26, 0.66, 0.74, 0.76, PALE) // the white over the eyes
      b.rect(0.46, 0.66, 0.54, 1, '#3a2e24') // the stripe up the forehead
      b.rect(0.27, 0.46, 0.73, 0.65, BLACK) // the mask, across the eyes
      b.rect(0.3, 0.36, 0.42, 0.47, BLACK) // and down the cheek, a tear under each eye
      b.rect(0.58, 0.36, 0.7, 0.47, BLACK)
      b.grain(0.1)
    }, 7),
    cheek: paint(16, 16, (b) => {
      b.fill(PALE)
      b.blotches(FUR.light, { count: 6, size: 3, alpha: 0.5 })
      b.rect(0, 0.78, 1, 1, FUR.base)
      b.grain(0.08)
    }, 9),
    // The muzzle is lofted along its length, so its u runs round it and its top is u = 0.5.
    muzzle: paint(16, 16, (b) => {
      b.fill(PALE)
      b.rect(0.38, 0, 0.62, 1, '#4a3c30') // the dark of the nose bridge
      b.rect(0.44, 0, 0.56, 1, BLACK)
      b.grain(0.08)
    }, 11),
    ear: paint(8, 8, (b) => {
      b.fill(PALE)
      b.grain(0.08)
    }, 13),
    earIn: paint(8, 8, (b) => {
      b.fill('#3c2f27')
      b.grain(0.1)
    }, 15),
    jet: paint(4, 4, (b) => b.fill('#060403'), 19),
    paw: paint(8, 8, (b) => {
      b.fill(BLACK)
      b.blotches('#33291f', { count: 3, size: 2, alpha: 0.5 })
      b.grain(0.1)
    }, 17),
    tail1: tailPaint([[0.5, 0.64], [0.14, 0.28]], 21),
    tail2: tailPaint([[0.56, 0.7], [0.2, 0.34]], 23),
    tail3: tailPaint([[0.6, 0.76], [0.28, 0.44]], 25, true),
    tweed: paint(32, 32, (b) => {
      b.fill(TWEED.base)
      b.blotches(TWEED.dark, { count: 22, size: 2, alpha: 0.7 })
      b.blotches(TWEED.light, { count: 22, size: 2, alpha: 0.7 })
      b.grain(0.2)
    }, 27),
    brim: paint(8, 8, (b) => {
      b.fill('#5a3720')
      b.grain(0.12)
    }, 29),
    // The scarf is lofted round the neck, so v runs along it: a cream pair of stripes every so far.
    scarf: paint(8, 32, (b) => {
      b.fill(RED)
      for (let y = 0.1; y < 1; y += 0.25) b.rect(0, y, 1, y + 0.06, CREAM)
      b.blotches('#8e1219', { count: 6, size: 3, alpha: 0.4 })
      b.grain(0.12)
    }, 31),
  }
}

// ---------------------------------------------------------------- the shapes

// Rings of a shape at `at`, `w` to either side and `d` to front and back, in a list.
const ring = (x, y, z, w, d = w) => ({ at: [x, y, z], w, d })
const joint = (r, at = [0, 0, 0]) => ball(at, [r, r, r], { sides: 6, rings: 3 })

/** A tail piece, a sausage along -Z from its joint, `r` thick, closed at both ends. */
function tailPiece(r, length, tipped) {
  return loft([
    ring(0, 0, 0.025, 0.001),
    ring(0, 0, 0, r),
    ring(0, 0, -length * 0.6, r * 1.05),
    ring(0, 0, -length, r * (tipped ? 0.6 : 0.85)),
    ring(0, 0, -length - (tipped ? 0.045 : 0.03), 0.001),
  ], { sides: 6 })
}

/** A foot, black, along +Z from the ankle: the heel behind it, the toes a hand's length before. */
function foot() {
  return loft([
    ring(0, -0.024, -0.03, 0.001, 0.001),
    ring(0, -0.026, -0.02, 0.022, 0.014),
    ring(0, -0.026, 0.02, 0.032, 0.016),
    ring(0, -0.026, 0.07, 0.034, 0.014),
    ring(0, -0.026, 0.108, 0.022, 0.01),
    ring(0, -0.026, 0.12, 0.001, 0.001),
  ], { sides: 6 })
}

/** The cap's crown: a low wide drum, rounded at the top, its bottom closed. */
const crown = () => loft([
  ring(0, -0.01, 0.004, 0.001),
  ring(0, -0.004, 0.004, 0.102, 0.108),
  ring(0, 0.016, 0.01, 0.116, 0.122),
  ring(0, 0.04, 0.016, 0.108, 0.116),
  ring(0, 0.058, 0.024, 0.082, 0.088),
  ring(0, 0.067, 0.028, 0.04, 0.044),
  ring(0, 0.069, 0.029, 0.001),
], { sides: 8 })

/** And its brim, short, a thin slab out to the front and a little down. */
const brim = () => loft([
  ring(0, 0, 0.06, 0.001, 0.001),
  ring(0, -0.004, 0.075, 0.074, 0.009),
  ring(0, -0.012, 0.115, 0.068, 0.008),
  ring(0, -0.02, 0.15, 0.04, 0.007),
  ring(0, -0.022, 0.158, 0.001, 0.001),
], { sides: 6 })

/** The scarf round his neck, a thick closed ring, lofted along a circle. */
function scarfRing() {
  const steps = 10
  const points = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    points.push(ring(Math.sin(a) * 0.11, 0.12, 0.012 + Math.cos(a) * 0.1, 0.036, 0.036))
  }
  return loft(points, { sides: 6, front: new THREE.Vector3(0, 1, 0) })
}

/** The end hanging on his chest, flat, from the knot down. */
const scarfEnd = () => loft([
  ring(0.06, 0.1, 0.11, 0.035, 0.016),
  ring(0.062, 0.04, 0.125, 0.037, 0.016),
  ring(0.065, -0.03, 0.155, 0.037, 0.016),
  ring(0.066, -0.075, 0.167, 0.03, 0.014),
  ring(0.066, -0.09, 0.168, 0.001, 0.001),
], { sides: 6 })

// Each part: the joint it is on, how it is shaped and with what it is covered. `SHAPES` builds a
// shape's geometry once; `PARTS` lists what is on which joint. A pair is two joints sharing one.
const limb = (from, to, [w0, w1]) => loft([
  ring(from[0], from[1], from[2], w0),
  ring(to[0], to[1], to[2], w1),
], { sides: 6 })

const SHAPES = {
  hips: () => ball([0, -0.015, -0.015], [0.18, 0.115, 0.16], { sides: 8, rings: 4 }),
  belly: () => ball([0, 0.07, 0.05], [0.165, 0.115, 0.15], { sides: 8, rings: 4 }),
  chest: () => ball([0, 0, 0.005], [0.155, 0.105, 0.125], { sides: 8, rings: 4 }),
  neck: () => limb([0, 0.03, -0.015], [0, -0.1, -0.035], [0.08, 0.1]),
  skull: () => ball([0, 0.085, 0], [0.108, 0.087, 0.094], { sides: 8, rings: 4 }),
  cheek: () => ball([0, 0.04, 0.015], [0.066, 0.056, 0.062], { sides: 8, rings: 4 }),
  muzzle: () => loft([
    ring(0, 0.055, 0.04, 0.062, 0.05),
    ring(0, 0.05, 0.09, 0.05, 0.043),
    ring(0, 0.044, 0.135, 0.036, 0.034),
    ring(0, 0.04, 0.165, 0.022, 0.022),
    ring(0, 0.039, 0.178, 0.001, 0.001),
  ], { sides: 8, front: new THREE.Vector3(0, 1, 0) }),
  nose: () => ball([0, 0.044, 0.171], [0.021, 0.016, 0.017], { sides: 6, rings: 3 }),
  eye: () => ball([0, 0, 0], [0.016, 0.017, 0.016], { sides: 6, rings: 3 }),
  glint: () => ball([0, 0, 0], [0.005, 0.005, 0.005], { sides: 4, rings: 2 }),
  earBack: () => ball([0, 0.04, 0], [0.037, 0.048, 0.016], { sides: 6, rings: 4 }),
  earFront: () => ball([0, 0.038, 0.009], [0.028, 0.037, 0.013], { sides: 6, rings: 4 }),
  crown, brim, scarfRing, scarfEnd,
  shoulder: () => joint(0.056),
  upperArm: () => limb([0, 0, 0], [0, -0.14, 0], [0.05, 0.04]),
  elbow: () => joint(0.042),
  // Its far end narrows to a point inside the palm, so that it is closed however the wrist bends.
  foreArm: () => loft([ring(0, 0, 0, 0.04), ring(0, -0.12, 0, 0.03), ring(0, -0.134, 0.004, 0.001)], { sides: 6 }),
  palm: () => ball([0, -0.03, 0.008], [0.032, 0.04, 0.025], { sides: 6, rings: 4 }),
  fingers: () => ball([0, -0.068, 0.012], [0.027, 0.026, 0.02], { sides: 6, rings: 3 }),
  hip: () => joint(0.075),
  thigh: () => limb([0, 0, 0], [0, -0.13, 0.005], [0.072, 0.054]),
  knee: () => joint(0.056),
  shin: () => limb([0, 0, 0], [0, -0.13, 0], [0.052, 0.036]),
  ankle: () => joint(0.04),
  foot,
  tail1: () => tailPiece(0.058, 0.12, false),
  tail2: () => tailPiece(0.066, 0.12, false),
  tail3: () => tailPiece(0.068, 0.12, true),
}

const EYE_AT = [0.05, 0.1, 0.072]
const PARTS = {
  root: [['hips', 'fur']],
  waist: [['belly', 'belly']],
  chest: [['chest', 'fur'], ['scarfRing', 'scarf'], ['scarfEnd', 'scarf']],
  head: [['neck', 'fur'], ['skull', 'skull'], ['muzzle', 'muzzle'], ['nose', 'jet'], ['cheek', 'cheek', [0.078, 0, 0]], ['cheek', 'cheek', [-0.078, 0, 0]],
    ['eye', 'jet', EYE_AT], ['eye', 'jet', mirror(EYE_AT)],
    ['glint', 'ear', [0.057, 0.108, 0.085]], ['glint', 'ear', [-0.045, 0.108, 0.085]]],
  cap: [['crown', 'tweed'], ['brim', 'brim']],
  earL: [['earBack', 'ear'], ['earFront', 'earIn']],
  earR: [['earBack', 'ear'], ['earFront', 'earIn']],
  tail1: [['tail1', 'tail1']],
  tail2: [['tail2', 'tail2']],
  tail3: [['tail3', 'tail3']],
}
for (const side of ['L', 'R']) {
  PARTS[`shoulder${side}`] = [['shoulder', 'fur'], ['upperArm', 'fur']]
  PARTS[`elbow${side}`] = [['elbow', 'fur'], ['foreArm', 'fur']]
  PARTS[`wrist${side}`] = [['palm', 'paw'], ['fingers', 'paw']]
  PARTS[`hip${side}`] = [['hip', 'fur'], ['thigh', 'fur']]
  PARTS[`knee${side}`] = [['knee', 'fur'], ['shin', 'fur']]
  PARTS[`ankle${side}`] = [['ankle', 'fur'], ['foot', 'paw']]
}

/** The geometry and materials of every part, made once and shared by every raccoon. */
function shared() {
  const textures = paints()
  const geometry = {}
  const material = {}
  for (const [name, map] of Object.entries(textures)) material[name] = celMaterial({ map })
  for (const [name, build] of Object.entries(SHAPES)) geometry[name] = build()
  return { geometry, material }
}

// ---------------------------------------------------------------- the pose

// Where the cigarette sits in the right paw: at the fingers, standing out from the fist across
// the forearm (a quarter turn from it), turned a little to point down the finger.
const PAW_AT = [0, -0.062, 0.012]
const PAW_TURN = 0.7
const FEET = [[0, -0.04, -0.018], [0, -0.04, 0.112]] // heel and toe, in the ankle's frame
const RUMP = [0, -0.11, -0.09] // the lowest of the hips, in the root's frame

const _inverse = new THREE.Matrix4()
const _point = new THREE.Vector3()

/** A raccoon's body: `{ group, head, paw, mouth, pose(p) }`; see the file's head. */
export function createRaccoonBody() {
  const { geometry, material } = (createRaccoonBody.shared ??= shared())
  const group = new THREE.Group()
  const joints = {}
  for (const [name, parent, at] of JOINTS) {
    joints[name] = new THREE.Object3D()
    joints[name].position.set(...at)
    ;(parent ? joints[parent] : group).add(joints[name])
  }
  for (const [name, parts] of Object.entries(PARTS)) {
    for (const [shape, paint, at] of parts) {
      const mesh = new THREE.Mesh(geometry[shape], material[paint])
      if (at) mesh.position.set(...at)
      // None of him takes part in the sun's shadows: their texels are a third of a metre across,
      // in which someone his size cast a few jagged blocks and was stained in patches by his own
      // parts. His shadow is a soft patch under him instead (`raccoon-figure.js`).
      joints[name].add(mesh)
    }
  }

  // The cigarette's place, along +Z from the filter, and his mouth where a drag is taken.
  const paw = new THREE.Object3D()
  paw.position.set(...PAW_AT)
  paw.rotation.x = PAW_TURN
  joints.wristR.add(paw)
  const mouth = new THREE.Object3D()
  mouth.position.set(0, 0.034, 0.168)
  joints.head.add(mouth)
  // What touches the floor: the heel and toe of each foot, and the rump when he sits.
  const soles = FEET.flatMap((at) => ['L', 'R'].map((side) => {
    const sole = new THREE.Object3D()
    sole.position.set(...at)
    joints[`ankle${side}`].add(sole)
    return sole
  }))
  const rump = new THREE.Object3D()
  rump.position.set(...RUMP)
  joints.root.add(rump)
  const floor = [...soles, rump]

  const rootAt = joints.root.position.y
  const { root, waist, chest, head, cap, tail1, tail2, tail3 } = joints
  const capAt = joints.cap.position.y

  /** Sets every joint to the numbers `p` (`raccoon-poses.js`), his feet on the floor at the group's origin. */
  function pose(p) {
    waist.rotation.set(p.lean, 0, p.roll)
    waist.position.x = p.shift
    chest.rotation.set(p.bend, 0, -p.roll * 0.6)
    head.rotation.set(p.headPitch, p.lookYaw, p.tilt, 'YXZ')
    cap.position.y = capAt + p.capLift
    cap.rotation.x = 0.08 + p.capTilt
    for (const [side, sign] of [['L', 1], ['R', -1]]) {
      joints[`ear${side}`].rotation.set(-p.ears * 0.9, 0, -sign * (0.3 + 0.3 * p.ears), 'ZXY')
      joints[`shoulder${side}`].rotation.set(-p[`armPitch${side}`], 0, sign * p[`armOut${side}`], 'XZY')
      joints[`elbow${side}`].rotation.x = -p[`elbow${side}`]
      joints[`wrist${side}`].rotation.x = -p[`wrist${side}`]
      // The legs: the thigh forward, the shin folded back, the foot turned to stay flat.
      const thigh = p.thigh + p[`thigh${side}`]
      const knee = p.knee + p[`knee${side}`]
      joints[`hip${side}`].rotation.x = -thigh
      joints[`knee${side}`].rotation.x = knee
      joints[`ankle${side}`].rotation.x = thigh - knee - p.ankle
    }
    tail1.rotation.set(p.tail, p.tailSway * 0.4, 0, 'YXZ')
    tail2.rotation.set(p.tailCurl * 0.8, p.tailSway * 0.7, 0, 'YXZ')
    tail3.rotation.set(p.tailCurl * 0.6, p.tailSway, 0, 'YXZ')

    // Down onto the floor: the lowest of his feet and rump is on it, so that a leg lifted in a
    // step shows as the body riding on the other, and sitting needs no height of its own.
    root.position.y = rootAt
    group.updateMatrixWorld(true)
    _inverse.copy(group.matrixWorld).invert()
    let lowest = Infinity
    for (const touch of floor) lowest = Math.min(lowest, _point.setFromMatrixPosition(touch.matrixWorld).applyMatrix4(_inverse).y)
    root.position.y = rootAt - lowest
    group.updateMatrixWorld(true)
  }

  return { group, head, paw, mouth, joints, pose }
}
