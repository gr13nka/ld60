// How an NPC stands. A figure is built upright, as `npc-kit.js` makes it, with bones laid through
// it where its joints are; a stance then turns the bones, and the figure is bent once, as it is
// built. Nothing moves afterwards: these are stills, not animation.
//
// A bone is a segment with a radius, a capsule. Every ring of a part (`loft` records each
// vertex's ring middle) is held by the bones near that middle, by how far the middle lies outside
// each capsule: inside one, wholly; between two, by both. So a ring moves whole, never torn, and
// a sleeve bends smoothly round its elbow, a coat's hem follows both thighs halfway. A part with
// no rings, or one bound to a bone (`bind`: a beard, a bucket), moves whole with the bone that
// holds it.
//
// Legs are not turned but placed. The stance says where each foot stands, and the thigh and shin
// are solved to reach it from wherever the turned hips have put the hip, so the feet stay on the
// floor while the hips shift, tilt and drop.

import * as THREE from 'three'

const REACH = 0.025 // metres outside a bone over which its hold halves and halves again
// How thick a man's bones are, by kind, in metres: a ring this near a bone's line is all its.
const RADIUS = { pelvis: 0.17, chest: 0.19, neck: 0.05, head: 0.1, thigh: 0.08, shin: 0.06, foot: 0.05, upperArm: 0.06, forearm: 0.05 }

const bound = new WeakMap()

/** Makes `object`, a part or a group of parts, move whole with the bone `bone`. Returns it. */
export function bind(object, bone) {
  bound.set(object, bone)
  return object
}

/**
 * A man's rig from where his joints are as he is built. `joints`: `pelvis`, `waist`, `neck`,
 * `head` (the top of the neck) and `crown` down his middle; `hip`, `knee`, `ankle`, `toe`,
 * `shoulder`, `elbow` and `hand` (the end of the hand) for his left (+X), mirrored for his right,
 * or as `{ L, R }` where the two differ. `radius` thickens or thins bones by kind (`RADIUS`).
 */
export function humanRig(joints, radius = {}) {
  const r = { ...RADIUS, ...radius }
  const at = (name, side) => {
    const joint = joints[name]
    if (!Array.isArray(joint)) return joint[side]
    return side === 'L' ? joint : [-joint[0], joint[1], joint[2]]
  }
  const bones = [
    { name: 'pelvis', from: joints.pelvis, to: joints.waist, radius: r.pelvis },
    { name: 'chest', from: joints.waist, to: joints.neck, parent: 'pelvis', radius: r.chest },
    { name: 'neck', from: joints.neck, to: joints.head, parent: 'chest', radius: r.neck },
    { name: 'head', from: joints.head, to: joints.crown, parent: 'neck', radius: r.head },
  ]
  const legs = []
  for (const side of ['L', 'R']) {
    bones.push({ name: `upperArm${side}`, from: at('shoulder', side), to: at('elbow', side), parent: 'chest', radius: r.upperArm })
    bones.push({ name: `forearm${side}`, from: at('elbow', side), to: at('hand', side), parent: `upperArm${side}`, radius: r.forearm })
    legs.push({ side, parent: 'pelvis', hip: at('hip', side), knee: at('knee', side), ankle: at('ankle', side), toe: at('toe', side), radius: r })
  }
  return new Rig(bones, legs)
}

/**
 * Bones `{ name, from, to, parent, radius }`, parents before children, each turned about its
 * `from`; and legs `{ side, parent, hip, knee, ankle, toe, radius }`, solved to their feet, whose
 * segments are named `thigh`, `shin` and `foot` with the side.
 */
export class Rig {
  constructor(bones, legs = []) {
    const point = (p) => new THREE.Vector3(...p)
    this.bones = bones.map((bone) => ({ ...bone, from: point(bone.from), to: point(bone.to) }))
    this.legs = legs.map((leg) => {
      const [hip, knee, ankle] = [point(leg.hip), point(leg.knee), point(leg.ankle)]
      // The way the knee bends as built, out from the line hip to ankle: ahead for most, out for bowed legs.
      const line = ankle.clone().sub(hip).normalize()
      const out = knee.clone().sub(hip).addScaledVector(line, -knee.clone().sub(hip).dot(line))
      const bend = out.length() > 0.005 ? out.normalize() : new THREE.Vector3(0, 0, 1)
      return { ...leg, hip, knee, ankle, toe: point(leg.toe), bend }
    })
    this.segments = this.bones.map(({ name, from, to, radius }) => ({ name, from, to, radius }))
    for (const { side, hip, knee, ankle, toe, radius } of this.legs) {
      this.segments.push(
        { name: `thigh${side}`, from: hip, to: knee, radius: radius.thigh },
        { name: `shin${side}`, from: knee, to: ankle, radius: radius.shin },
        { name: `foot${side}`, from: ankle, to: toe, radius: radius.foot },
      )
    }
  }

  /**
   * Each segment's move from the pose it was built in to `stance`'s, by name. A stance:
   * `shift`, `[x, y, z]` metres the hips move (down bends the knees); `turn`, by bone name,
   * `[pitch, yaw, roll]` radians, turned in that order about the bone's `from` on top of its
   * parent's turn (pitch tips an upright bone forward, yaw turns it to the figure's left, roll
   * leans it to his right); `feet`, by side, `[x, z, yaw]`, where the foot stands from where it
   * was built and how far it turns out to the left.
   */
  moves({ shift = [0, 0, 0], turn = {}, feet = {} }) {
    const moves = new Map()
    for (const bone of this.bones) {
      const parent = bone.parent ? moves.get(bone.parent) : new THREE.Matrix4().makeTranslation(...shift)
      moves.set(bone.name, parent.clone().multiply(turnAbout(bone.from, turn[bone.name] ?? [0, 0, 0])))
    }
    for (const leg of this.legs) {
      const [x = 0, z = 0, yaw = 0] = feet[leg.side] ?? []
      const hip = leg.hip.clone().applyMatrix4(moves.get(leg.parent))
      const ankle = leg.ankle.clone().add(new THREE.Vector3(x, 0, z))
      const ahead = leg.bend.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
      const knee = bend(hip, ankle, leg.hip.distanceTo(leg.knee), leg.knee.distanceTo(leg.ankle), ahead)
      moves.set(`thigh${leg.side}`, swing(leg.hip, leg.knee, hip, knee))
      moves.set(`shin${leg.side}`, swing(leg.knee, leg.ankle, knee, ankle))
      moves.set(`foot${leg.side}`, new THREE.Matrix4().makeTranslation(ankle.x, ankle.y, ankle.z)
        .multiply(new THREE.Matrix4().makeRotationY(yaw))
        .multiply(new THREE.Matrix4().makeTranslation(-leg.ankle.x, -leg.ankle.y, -leg.ankle.z)))
    }
    return moves
  }

  /** The segments that hold `point`, `[name, share]`, the shares summing to 1. */
  hold(point) {
    const outside = this.segments.map((s) => Math.max(0, distanceToSegment(point, s.from, s.to) - s.radius))
    const nearest = Math.min(...outside)
    const holds = this.segments.map((s, i) => [s.name, Math.exp(-(outside[i] - nearest) / REACH)]).filter(([, w]) => w > 0.002)
    const sum = holds.reduce((total, [, w]) => total + w, 0)
    return holds.map(([name, w]) => [name, w / sum])
  }
}

/**
 * Bends `group`, built in the pose its `rig`'s joints describe, into `stance` (`Rig.moves`).
 * Works on the group's own children. Returns a function that carries a point of the figure as
 * built to where it now is: its face, say.
 */
export function pose(group, rig, stance) {
  const moves = rig.moves(stance)
  const blended = (point) => {
    const sum = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    for (const [name, share] of rig.hold(point)) {
      const e = moves.get(name).elements
      for (let i = 0; i < 16; i++) sum.elements[i] += e[i] * share
    }
    return sum
  }
  const strongest = (point) => moves.get(rig.hold(point).reduce((a, b) => (b[1] > a[1] ? b : a))[0])

  for (const child of [...group.children]) {
    child.updateMatrix()
    const bone = bound.get(child)
    const centres = child.isMesh && child.geometry.attributes.centre
    if (centres && !bone) bendMesh(child, blended)
    else child.applyMatrix4(bone ? moves.get(bone) : strongest(child.position))
  }
  return (point) => point.clone().applyMatrix4(blended(point))
}

// Moves each ring of `mesh` by the blend of the bones that hold its middle.
function bendMesh(mesh, blended) {
  const toGroup = mesh.matrix
  const toLocal = toGroup.clone().invert()
  const { position, normal, centre } = mesh.geometry.attributes
  const byCentre = new Map()
  const at = new THREE.Vector3()
  const facing = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) {
    at.fromBufferAttribute(centre, i)
    const key = `${at.x.toFixed(4)},${at.y.toFixed(4)},${at.z.toFixed(4)}`
    if (!byCentre.has(key)) {
      const move = toLocal.clone().multiply(blended(at.applyMatrix4(toGroup))).multiply(toGroup)
      byCentre.set(key, { move, turn: new THREE.Matrix3().getNormalMatrix(move) })
    }
    const { move, turn } = byCentre.get(key)
    at.fromBufferAttribute(position, i).applyMatrix4(move)
    position.setXYZ(i, at.x, at.y, at.z)
    facing.fromBufferAttribute(normal, i).applyMatrix3(turn).normalize()
    normal.setXYZ(i, facing.x, facing.y, facing.z)
  }
  position.needsUpdate = true
  normal.needsUpdate = true
  mesh.geometry.computeBoundingSphere()
  mesh.geometry.computeBoundingBox()
}

// A turn of `[pitch, yaw, roll]` about the point `about`.
function turnAbout(about, [pitch, yaw, roll]) {
  return new THREE.Matrix4().makeTranslation(about.x, about.y, about.z)
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')))
    .multiply(new THREE.Matrix4().makeTranslation(-about.x, -about.y, -about.z))
}

// The move that carries the segment `from`–`to` as built onto `fromNow`–`toNow`, turning it the shortest way.
function swing(from, to, fromNow, toNow) {
  const turn = new THREE.Quaternion().setFromUnitVectors(to.clone().sub(from).normalize(), toNow.clone().sub(fromNow).normalize())
  return new THREE.Matrix4().makeTranslation(fromNow.x, fromNow.y, fromNow.z)
    .multiply(new THREE.Matrix4().makeRotationFromQuaternion(turn))
    .multiply(new THREE.Matrix4().makeTranslation(-from.x, -from.y, -from.z))
}

// Where a knee goes between `hip` and `ankle`, thigh `a` and shin `b` long, bending toward `ahead`.
function bend(hip, ankle, a, b, ahead) {
  const toAnkle = ankle.clone().sub(hip)
  const d = THREE.MathUtils.clamp(toAnkle.length(), Math.abs(a - b) + 1e-4, a + b - 1e-4)
  const down = toAnkle.normalize()
  const along = (a * a - b * b + d * d) / (2 * d)
  const out = Math.sqrt(Math.max(0, a * a - along * along))
  const forward = ahead.clone().addScaledVector(down, -ahead.dot(down)).normalize()
  return hip.clone().addScaledVector(down, along).addScaledVector(forward, out)
}

function distanceToSegment(point, from, to) {
  const along = to.clone().sub(from)
  const t = THREE.MathUtils.clamp(point.clone().sub(from).dot(along) / Math.max(1e-9, along.lengthSq()), 0, 1)
  return point.distanceTo(from.clone().addScaledVector(along, t))
}
