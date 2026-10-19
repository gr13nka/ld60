// One first-person arm: a black three-stripe sleeve and a cartoon hand, carried between poses
// on a spring so it eases in and out of every move. The hand is one smooth skin grown over a
// skeleton, so the fingers bend without seams and the palm webs into them. It knows the
// shapes a smoker's hand makes (`GRIPS`) but not when: viewmodel.js and tricks.js say where
// the hand should be and which of them its fingers are in.

import * as THREE from 'three'
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js'
import { materials } from './models.js'

const SCALE = 1.18
const FOREARM = 0.34
// Shoulders live below the camera frame. The upper sleeve joins them to the moving elbow,
// so a raised or rolled hand never reveals a floating, flat-ended forearm.
const SHOULDER_X = 0.42
const SHOULDER_Y = -0.72
const SHOULDER_Z = 0.08
const HAND_Z = -(FOREARM + 0.015) // the wrist, along the forearm from the elbow
const STIFFNESS = 130
const DAMPING = 22 // just short of critical: the hand arrives without bouncing
const TURN_RATE = 11
const CURL_RATE = 18
const STRIPES_AT = 1.15 // radians round the sleeve from its outer side toward its top

/**
 * Finger curls from 0 (straight) to 1 (closed), in the order thumb, index, middle, ring, little.
 * A digit may instead give its three joints one by one, from the palm outward. A sixth entry,
 * where there is one, spreads the thumb out from the fingers, in radians, so that it can close
 * on something as wide as the palm. `Arm.closeOn` makes a grip that fits a thing held.
 */
export const GRIPS = {
  shield: [0.28, 0.56, 0.62, 0.68, 0.72], // curved fingers form a windbreak; thumb leaves room for the lighter
  relaxed: [0.3, 0.25, 0.3, 0.38, 0.45],
  pinch: [0.6, 0.1, 0.16, 0.7, 0.78], // a cigarette between index and middle
  cigar: [0.5, 0.02, 0.32, 0.7, 0.78], // the same hold opened for a cigar: index over it, middle under
  flickLoaded: [0.8, 0.78, 0.16, 0.7, 0.78], // index loaded against the thumb
  flicked: [0.25, 0, 0.08, 0.7, 0.78], // index snaps out; the wrist barely moves
  lighter: [0.1, 0.9, 0.9, 0.9, 0.9], // a fist with the thumb standing over it
  strike: [0.7, 0.9, 0.9, 0.9, 0.9],
  wing: [0.1, 0.05, 0.03, 0.05, 0.1],
  open: [0.05, 0.02, 0, 0.03, 0.06, 0.5], // flat and spread, to bat with or to catch in
  horns: [0.7, 0.02, 0.85, 0.85, 0.05], // index and little finger out straight
  fist: [0.6, 0.85, 0.85, 0.88, 0.9],
}

// The hand at rest lies palm down, fingers forward (-Z). `x` is measured toward the thumb and
// `fan` turns a finger toward it. Each digit: where it leaves the palm, the lengths of its
// three bones, and its radius at the root and at the tip.
const KNUCKLE_Z = -0.1
const DIGITS = [
  { x: 0.04, y: -0.008, z: -0.02, fan: 0.9, drop: -0.28, bones: [0.04, 0.03, 0.026], radius: [0.0175, 0.0122] }, // thumb
  { x: 0.039, y: 0, z: KNUCKLE_Z + 0.002, fan: 0.07, drop: 0, bones: [0.04, 0.026, 0.022], radius: [0.0122, 0.0104] },
  { x: 0.013, y: 0, z: KNUCKLE_Z - 0.004, fan: 0.02, drop: 0, bones: [0.044, 0.03, 0.023], radius: [0.0126, 0.0106] },
  { x: -0.013, y: 0, z: KNUCKLE_Z + 0.002, fan: -0.04, drop: 0, bones: [0.04, 0.027, 0.022], radius: [0.012, 0.0102] },
  { x: -0.038, y: -0.001, z: KNUCKLE_Z + 0.014, fan: -0.11, drop: 0, bones: [0.031, 0.02, 0.019], radius: [0.0108, 0.0094] },
]
const PALM_RADIUS = 0.0165
const SKIN_CELL = 0.0033 // the grid the skin is grown on; smaller is smoother and slower to build
const JOINT_BLEND = 0.007 // how far either side of a joint the skin shares two bones
const FAR = 0.03 // a distance from the skin beyond which nothing needs to be exact
const FLEX_COUNT = 16 // three joints for each of five digits, then the thumb's spread
const CLOSE_STEPS = 48 // how finely a joint closes on something held
const PRESS = 0.002 // how far the skin gives where it holds on

// What `grip` asks of one of the hand's FLEX_COUNT joints.
function gripFlex(grip, i) {
  if (i === FLEX_COUNT - 1) return grip[5] ?? 0
  const digit = grip[Math.floor(i / 3)]
  return typeof digit === 'number' ? digit : digit[i % 3]
}

const FORWARD = new THREE.Vector3(0, 0, -1)
const _euler = new THREE.Euler()
const _pull = new THREE.Vector3()
const _upperTo = new THREE.Vector3()
const _inverseForearm = new THREE.Quaternion()
const UP = new THREE.Vector3(0, 1, 0)
const _roll = new THREE.Quaternion()
const _bend = new THREE.Quaternion()
const _probe = new THREE.Vector3()

// Skin drawn in three flat tones under a light fixed to the eye, so the hands keep their warm
// cartoon look whatever the level's sky is doing. `warm` is firelight on them, 0 to 1.
const SKIN = new THREE.ShaderMaterial({
  uniforms: {
    lit: { value: new THREE.Color(0xf0a36c) },
    mid: { value: new THREE.Color(0xd4814f) },
    shade: { value: new THREE.Color(0x9f5538) },
    rim: { value: new THREE.Color(0x56688c) },
    warm: { value: 0 },
  },
  vertexShader: /* glsl */ `
    #include <common>
    #include <skinning_pars_vertex>
    varying vec3 vNormal;
    varying vec3 vToEye;
    void main() {
      #include <beginnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <defaultnormal_vertex>
      #include <begin_vertex>
      #include <skinning_vertex>
      #include <project_vertex>
      vNormal = transformedNormal;
      vToEye = -mvPosition.xyz;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 lit;
    uniform vec3 mid;
    uniform vec3 shade;
    uniform vec3 rim;
    uniform float warm;
    varying vec3 vNormal;
    varying vec3 vToEye;
    void main() {
      vec3 normal = normalize(vNormal);
      float facing = dot(normal, normalize(vec3(-0.35, 0.8, 0.5)));
      vec3 color = mix(shade, mid, smoothstep(-0.22, -0.14, facing));
      color = mix(color, lit, smoothstep(0.3, 0.38, facing));
      // Clamped both ways: rounding can put the dot a hair over 1, and the power of a negative
      // number is no colour at all, which the bloom then spreads over the whole picture.
      color += rim * pow(1.0 - clamp(dot(normal, normalize(vToEye)), 0.0, 1.0), 3.0);
      color = mix(color, color * vec3(1.3, 1.08, 0.8) + vec3(0.06, 0.03, 0.0), warm);
      gl_FragColor = vec4(color, 1.0);
      #include <colorspace_fragment>
    }`,
})

/** Lights both hands as if by a flame held near them; `warmth` 0 to 1. */
export function warmHands(warmth) {
  SKIN.uniforms.warm.value = warmth
}

/**
 * The orientation of the hand in a pose `{ at, pitch, yaw, roll }` on the arm of the given
 * side: the forearm's pitch and inward yaw, then the wrist's roll about it. Poses are written
 * for the right arm (side 1); the left mirrors them.
 */
export function poseQuaternion(pose, side, out) {
  return out.setFromEuler(_euler.set(pose.pitch, side * pose.yaw, side * pose.roll, 'YXZ'))
}

// Distance from (x, y, z) to a capsule from a to b whose radius runs from ra to rb. Also
// leaves how far along it the nearest point is, unclamped, in `capsule.along`.
function capsule(x, y, z, a, b, ra, rb) {
  const bx = b.x - a.x
  const by = b.y - a.y
  const bz = b.z - a.z
  const along = ((x - a.x) * bx + (y - a.y) * by + (z - a.z) * bz) / (bx * bx + by * by + bz * bz)
  capsule.along = along
  const t = along < 0 ? 0 : along > 1 ? 1 : along
  const dx = x - a.x - bx * t
  const dy = y - a.y - by * t
  const dz = z - a.z - bz * t
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * t)
}

// The smaller of two distances, rounded off where they meet so the surfaces flow together.
function blend(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

// Where the bones of one hand lie at rest, in `hand` space: per digit its four joints and the
// radius at each, plus the palm's own bones from wrist to knuckles.
function layOut(side) {
  const digits = DIGITS.map(({ x, y, z, fan, drop, bones, radius }) => {
    const heading = new THREE.Vector3(-side * Math.sin(fan), drop, -Math.cos(fan)).normalize()
    const joints = [new THREE.Vector3(-side * x, y, z)]
    for (const length of bones) joints.push(joints[joints.length - 1].clone().addScaledVector(heading, length))
    const total = bones[0] + bones[1] + bones[2]
    let run = 0
    const radii = [radius[0], ...bones.map((length) => radius[0] + (radius[1] - radius[0]) * ((run += length) / total))]
    // Beyond this box the digit is too far to matter, which saves measuring it.
    const reach = radius[0] + FAR
    const box = new THREE.Box3().setFromPoints(joints).expandByScalar(reach)
    return { heading, joints, radii, bones, box }
  })
  const palm = digits.slice(1).map(({ joints }) => ({
    from: new THREE.Vector3(joints[0].x * 0.62, -0.002, -0.012),
    to: joints[0],
  }))
  return { digits, palm }
}

// Distance to one digit, leaving the bone nearest and how far along it in `digitDistance`.
// Anywhere well clear of the digit it just answers FAR.
function digitDistance(x, y, z, { joints, radii, box: { min, max } }) {
  if (x < min.x || x > max.x || y < min.y || y > max.y || z < min.z || z > max.z) return FAR
  let best = Infinity
  for (let i = 0; i < 3; i++) {
    const d = capsule(x, y, z, joints[i], joints[i + 1], radii[i], radii[i + 1])
    if (d < best) {
      best = d
      digitDistance.bone = i
      digitDistance.along = capsule.along
    }
  }
  return best
}

const WRIST_FROM = new THREE.Vector3(0, 0, 0.03)
const WRIST_TO = new THREE.Vector3(0, 0, -0.02)
const PAD_FROM = new THREE.Vector3(0, -0.008, -0.03)
const PAD_TO = new THREE.Vector3(0, -0.008, -0.075)

function palmDistance(x, y, z, { palm }, side) {
  let d = capsule(x, y, z, WRIST_FROM, WRIST_TO, 0.026, 0.026)
  for (const { from, to } of palm) d = blend(d, capsule(x, y, z, from, to, PALM_RADIUS, PALM_RADIUS - 0.002), 0.016)
  PAD_FROM.x = PAD_TO.x = -side * 0.004
  return blend(d, capsule(x, y, z, PAD_FROM, PAD_TO, 0.019, 0.017), 0.014)
}

// Each finger flows into the palm but not into its neighbours, so the webbing stops at the knuckles.
function handDistance(x, y, z, layout, side) {
  const palm = palmDistance(x, y, z, layout, side)
  let d = palm
  for (let i = 0; i < 5; i++) {
    const digit = digitDistance(x, y, z, layout.digits[i])
    if (digit < FAR) d = Math.min(d, blend(palm, digit, i === 0 ? 0.014 : 0.009))
  }
  return d
}

const CORNERS = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]

// Grows the skin of one hand over its bones: the surface where `handDistance` is zero, cut
// from a grid by marching cubes, each vertex bound to the bone or two it should follow.
// Bone 0 is the hand itself; digit d owns bones 1 + 3d to 3 + 3d.
function growSkin(layout, side) {
  const field = (x, y, z) => handDistance(x, y, z, layout, side)
  const min = [-0.13, -0.06, -0.222]
  const size = [0.26, 0.1, 0.262].map((extent) => Math.ceil(extent / SKIN_CELL) + 1)
  const [nx, ny] = size
  const at = (i, axis) => min[axis] + i * SKIN_CELL
  const values = new Float32Array(size[0] * size[1] * size[2])
  for (let k = 0, n = 0; k < size[2]; k++)
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) values[n++] = field(at(i, 0), at(j, 1), at(k, 2))

  const positions = []
  const indices = []
  const made = new Map() // grid edge -> vertex already cut on it
  const cornerAt = (i, j, k, c) => i + CORNERS[c][0] + nx * (j + CORNERS[c][1] + ny * (k + CORNERS[c][2]))
  const point = (n, axis) => at(axis === 0 ? n % nx : axis === 1 ? Math.floor(n / nx) % ny : Math.floor(n / (nx * ny)), axis)
  const cut = (a, b) => {
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    const key = lo * 3 + (hi - lo === 1 ? 0 : hi - lo === nx ? 1 : 2)
    let vertex = made.get(key)
    if (vertex === undefined) {
      const t = values[a] / (values[a] - values[b])
      vertex = positions.length / 3
      for (let axis = 0; axis < 3; axis++) positions.push(point(a, axis) + (point(b, axis) - point(a, axis)) * t)
      made.set(key, vertex)
    }
    return vertex
  }
  for (let k = 0; k < size[2] - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let cube = 0
        for (let c = 0; c < 8; c++) if (values[cornerAt(i, j, k, c)] < 0) cube |= 1 << c
        if (edgeTable[cube] === 0) continue
        for (let t = cube * 16; triTable[t] !== -1; t++) {
          const [a, b] = EDGES[triTable[t]]
          indices.push(cut(cornerAt(i, j, k, a), cornerAt(i, j, k, b)))
        }
      }

  const count = positions.length / 3
  const normals = new Float32Array(count * 3)
  const skinIndex = new Uint16Array(count * 4)
  const skinWeight = new Float32Array(count * 4)
  const e = SKIN_CELL / 2
  const ramp = (edge, x) => THREE.MathUtils.smoothstep(x, edge - JOINT_BLEND, edge + JOINT_BLEND)
  for (let v = 0; v < count; v++) {
    const x = positions[v * 3]
    const y = positions[v * 3 + 1]
    const z = positions[v * 3 + 2]
    // The surface faces up the slope of the distance.
    const nxv = field(x + e, y, z) - field(x - e, y, z)
    const nyv = field(x, y + e, z) - field(x, y - e, z)
    const nzv = field(x, y, z + e) - field(x, y, z - e)
    const length = Math.hypot(nxv, nyv, nzv) || 1
    normals.set([nxv / length, nyv / length, nzv / length], v * 3)

    // Bind to the nearest digit if it is nearer than the palm, sharing weight across its joints.
    let nearest = -1
    let best = palmDistance(x, y, z, layout, side) + 0.004
    let bone = 0
    let along = 0
    layout.digits.forEach((digit, d) => {
      const distance = digitDistance(x, y, z, digit)
      if (distance < best) {
        best = distance
        nearest = d
        bone = digitDistance.bone
        along = digitDistance.along
      }
    })
    skinWeight[v * 4] = 1
    if (nearest < 0) continue
    const { bones } = layout.digits[nearest]
    const run = (bone > 0 ? bones[0] : 0) + (bone > 1 ? bones[1] : 0) + along * bones[bone]
    const onDigit = ramp(0, run)
    const pastFirst = ramp(bones[0], run)
    const pastSecond = ramp(bones[0] + bones[1], run)
    skinIndex.set([0, 1 + nearest * 3, 2 + nearest * 3, 3 + nearest * 3], v * 4)
    skinWeight.set([1 - onDigit, onDigit * (1 - pastFirst), onDigit * pastFirst * (1 - pastSecond), onDigit * pastFirst * pastSecond], v * 4)
  }

  // The tables do not promise which way a triangle winds; turn each to face along its normals.
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let t = 0; t < indices.length; t += 3) {
    a.fromArray(positions, indices[t] * 3)
    b.fromArray(positions, indices[t + 1] * 3).sub(a)
    c.fromArray(positions, indices[t + 2] * 3).sub(a)
    if (b.cross(c).dot(a.fromArray(normals, indices[t] * 3)) < 0) {
      const swap = indices[t + 1]
      indices[t + 1] = indices[t + 2]
      indices[t + 2] = swap
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4))
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4))
  geometry.setIndex(indices)
  return geometry
}

// The left hand's skin is the right's seen in a mirror: same bones, opposite winding.
function mirrored(skin) {
  const flipped = skin.clone()
  for (const name of ['position', 'normal']) {
    const attribute = flipped.attributes[name]
    for (let i = 0; i < attribute.count; i++) attribute.setX(i, -attribute.getX(i))
  }
  const index = flipped.index.array
  for (let t = 0; t < index.length; t += 3) {
    const swap = index[t + 1]
    index[t + 1] = index[t + 2]
    index[t + 2] = swap
  }
  return flipped
}

let rightSkin = null

// Builds the skinned hand into `parent`; returns, per digit, its three bones, their lengths,
// the radius at each of its four joints, and the turn that points it along the digit at rest.
function createHand(parent, side) {
  const layout = layOut(side)
  const root = new THREE.Bone()
  const bones = [root]
  const digits = layout.digits.map(({ heading, joints, radii, bones: lengths }) => {
    const rest = new THREE.Quaternion().setFromUnitVectors(FORWARD, heading)
    const chain = lengths.map((_, i) => {
      const bone = new THREE.Bone()
      if (i === 0) bone.position.copy(joints[0])
      else bone.position.z = -lengths[i - 1]
      return bone
    })
    chain[0].quaternion.copy(rest)
    root.add(chain[0])
    chain[0].add(chain[1])
    chain[1].add(chain[2])
    bones.push(...chain)
    return { chain, rest, lengths, radii }
  })

  rightSkin ??= growSkin(layOut(1), 1)
  const skin = new THREE.SkinnedMesh(side > 0 ? rightSkin : mirrored(rightSkin), SKIN)
  skin.frustumCulled = false // it never leaves the view, and its bounds ignore the bones
  parent.add(root, skin)
  parent.updateMatrixWorld(true)
  skin.bind(new THREE.Skeleton(bones))
  return digits
}

export class Arm {
  /** `side` is 1 for the right arm, -1 for the left. */
  constructor(side) {
    this._side = side
    /** Add this to the camera rig. */
    this.root = new THREE.Group()
    this.root.scale.setScalar(SCALE)

    // The forearm runs forward (-Z) from the elbow at the origin; the outer side is `side` along X.
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.05, FOREARM, 12), materials.suit)
    sleeve.rotation.x = Math.PI / 2
    sleeve.position.z = -FOREARM / 2
    this.root.add(sleeve)
    this._upperSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.053, 1, 12), materials.suit)
    this.root.add(this._upperSleeve)
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.054, 12, 8), materials.suit)
    this.root.add(elbow)
    // Three white stripes down the black sleeve. The sleeve does not turn with the wrist, so
    // they stay where the eye can see them.
    for (const around of [-0.32, 0, 0.32]) {
      const angle = side > 0 ? STRIPES_AT + around : Math.PI - STRIPES_AT - around
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.011, FOREARM - 0.03), materials.stripe)
      stripe.position.set(Math.cos(angle) * 0.052, Math.sin(angle) * 0.052, -FOREARM / 2 + 0.015)
      stripe.rotation.z = angle
      this.root.add(stripe)
    }
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.05, 0.03, 12), materials.cap)
    cuff.rotation.x = Math.PI / 2
    cuff.position.z = -FOREARM
    this.root.add(cuff)

    // The hand lies palm down with its fingers pointing forward and the thumb on the inner side.
    /** Parent for anything the hand carries. X toward the thumb is `-side`. */
    this.hand = new THREE.Group()
    this.hand.position.z = HAND_Z
    this.root.add(this.hand)
    this._digits = createHand(this.hand, side)

    // Wing membrane hanging under the arm, seen at the edge of the view in flight.
    const wing = new THREE.BufferGeometry()
    wing.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, -0.04, 0, 0, -0.04, -0.37, -side * 0.1, -0.6, 0.07], 3),
    )
    wing.computeVertexNormals()
    this._membrane = new THREE.Mesh(wing, materials.membrane)
    this.root.add(this._membrane)

    /**
     * The point of the hand that poses place, in `hand` space. It starts as the gap between
     * index and middle finger at their first joints, where a cigarette sits; move it when the
     * hand carries something else.
     */
    this.anchor = new THREE.Vector3(-side * 0.027, -0.002, KNUCKLE_Z - 0.044)
    /** Where the anchor is now, in the rig's space, and which way the hand is turned. Read only. */
    this.at = new THREE.Vector3()
    this.quat = new THREE.Quaternion()

    this._forearm = new THREE.Quaternion() // pitch and yaw only
    this._targetForearm = new THREE.Quaternion()
    this._roll = 0
    this._targetRoll = 0
    this._vel = new THREE.Vector3()
    this._targetAt = new THREE.Vector3()
    this._grip = GRIPS.relaxed
    this._flex = Array.from({ length: FLEX_COUNT }, (_, i) => gripFlex(GRIPS.relaxed, i))
    this._place()
  }

  /** Heads for `pose` (written for the right arm, see `poseQuaternion`) with the fingers in `grip`. */
  reach(pose, grip) {
    this._targetAt.fromArray(pose.at)
    this._targetAt.x *= this._side
    this._targetForearm.setFromEuler(_euler.set(pose.pitch, this._side * pose.yaw, 0, 'YXZ'))
    this._targetRoll = this._side * pose.roll
    this._grip = grip
  }

  /** Shoves the hand, in rig space metres per second; the spring brings it back. */
  kick(x, y, z) {
    this._vel.x += x
    this._vel.y += y
    this._vel.z += z
  }

  /** Arrives at once, for the start of a run. */
  snap() {
    this.at.copy(this._targetAt)
    this._forearm.copy(this._targetForearm)
    this._roll = this._targetRoll
    this._vel.set(0, 0, 0)
    for (let i = 0; i < FLEX_COUNT; i++) this._flex[i] = gripFlex(this._grip, i)
    this._place()
  }

  showWing(visible) {
    this._membrane.visible = visible
  }

  update(dt, curlRate = CURL_RATE) {
    // The spring is stiff enough to blow up on a long frame, so it takes several short steps.
    for (let left = dt; left > 0; left -= 1 / 120) {
      const step = Math.min(left, 1 / 120)
      _pull.subVectors(this._targetAt, this.at).multiplyScalar(STIFFNESS).addScaledVector(this._vel, -DAMPING)
      this._vel.addScaledVector(_pull, step)
      this.at.addScaledVector(this._vel, step)
    }
    const turn = 1 - Math.exp(-TURN_RATE * dt)
    this._forearm.slerp(this._targetForearm, turn)
    this._roll += (this._targetRoll - this._roll) * turn
    const ease = 1 - Math.exp(-curlRate * dt)
    for (let i = 0; i < FLEX_COUNT; i++) this._flex[i] += (gripFlex(this._grip, i) - this._flex[i]) * ease
    this._place()
  }

  _place() {
    const { root, hand, anchor } = this
    root.quaternion.copy(this._forearm)
    hand.rotation.z = this._roll
    _roll.setFromAxisAngle(FORWARD, -this._roll)
    this.quat.multiplyQuaternions(this._forearm, _roll)
    root.position.copy(anchor).applyQuaternion(_roll).add(hand.position).multiplyScalar(-SCALE)
    root.position.applyQuaternion(this._forearm).add(this.at)

    // Express the fixed shoulder in elbow space; this sleeve follows either hand pose
    // without changing the contact point or the finger skeleton.
    _inverseForearm.copy(root.quaternion).invert()
    _upperTo.set(this._side * SHOULDER_X, SHOULDER_Y, SHOULDER_Z)
      .sub(root.position).applyQuaternion(_inverseForearm).divideScalar(SCALE)
    const upperLength = _upperTo.length()
    this._upperSleeve.position.copy(_upperTo).multiplyScalar(0.5)
    this._upperSleeve.scale.y = upperLength
    this._upperSleeve.quaternion.setFromUnitVectors(UP, _upperTo.normalize())

    this._bendDigits()
  }

  _bendDigits() {
    const flex = this._flex
    this._digits.forEach(({ chain, rest }, d) => {
      const first = flex[d * 3]
      if (d === 0) {
        // The thumb swings in across the palm rather than curling under it.
        _bend.setFromEuler(_euler.set(-0.35 * first, -this._side * (0.75 * first - flex[FLEX_COUNT - 1]), 0, 'YXZ'))
        chain[0].quaternion.copy(rest).multiply(_bend)
        chain[1].rotation.y = -this._side * 0.35 * flex[1]
        chain[2].rotation.y = -this._side * 0.5 * flex[2]
        return
      }
      chain[0].quaternion.copy(rest)
      chain[0].rotateX(-1.25 * first)
      chain[1].rotation.x = -1.5 * flex[d * 3 + 1]
      chain[2].rotation.x = -1.0 * flex[d * 3 + 2]
    })
  }

  /**
   * A grip that closes the hand on a thing it holds: each joint bends, from the palm outward,
   * until its bone touches, so no finger ends up inside. `distance(point)` says how far a
   * point in `hand` space is from the thing's surface, negative within it; `spread` opens the
   * thumb first, in radians. A digit that meets nothing closes all the way.
   */
  closeOn(distance, spread = 0) {
    const shown = this._flex
    const flex = (this._flex = new Array(FLEX_COUNT).fill(0))
    flex[FLEX_COUNT - 1] = spread
    for (let i = 0; i < FLEX_COUNT - 1; i++) {
      for (let step = 1; step <= CLOSE_STEPS; step++) {
        flex[i] = step / CLOSE_STEPS
        if (!this._touches(i, distance)) continue
        flex[i] = (step - 1) / CLOSE_STEPS
        break
      }
    }
    this._flex = shown
    this._bendDigits()
    return [0, 3, 6, 9, 12].map((i) => flex.slice(i, i + 3)).concat(spread)
  }

  // Whether the bone beyond joint `i`, as the hand is bent now, reaches into the thing held.
  _touches(i, distance) {
    const { chain, lengths, radii } = this._digits[Math.floor(i / 3)]
    const j = i % 3
    this._bendDigits()
    this.hand.updateMatrixWorld(true)
    for (let along = 0; along <= 1; along += 0.25) {
      this.hand.worldToLocal(chain[j].localToWorld(_probe.set(0, 0, -lengths[j] * along)))
      if (distance(_probe) < radii[j] + (radii[j + 1] - radii[j]) * along - PRESS) return true
    }
    return false
  }
}
