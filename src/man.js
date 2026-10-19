// The man's body: a CC0 human mesh in our tracksuit, hung on whatever parts the caller moves.
//
// The mesh (`models/man.glb`, see `models/SOURCES.md`) is skinned to a 62-joint skeleton in a
// T-pose. The game never plays an animation on it. Its callers already own a few rigid pieces
// they move themselves (the first-person legs, the player's arms and legs, the ragdoll's limbs),
// so each joint is hung on whichever of those pieces it belongs to, and the skin follows. A
// piece is called a part and is described by the "hang" convention of `ragdoll.js`: its origin
// is the joint it hangs from, its length runs down its own -Y, +Z is its front, and standing is
// no rotation at all. The arms of the mesh are held out and the parts hang them down, which is
// the one thing `R` in the frames below undoes.
//
// Added to the mesh, which does not have them: the three white stripes down each sleeve and
// trouser leg, and the trainers' soles, caps, tabs and stripes, all cut out of the mesh's own
// triangles and skinned with them; and the shoes' eyelets and laces, fitted to the
// leather and riding rigidly on the shin.
//
// Nothing here is usable until `loadMan` has resolved.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { celMaterial } from './shading.js'

const NECK_Y = 1.5 // metres from the soles to the neck joint: the one number the fit is made to
const HEAD_HEIGHT = 0.18 // from the neck joint to the middle of the head the caller draws (its skull, scaled as `playerHead` scales it)
const HAND_JOINT = 'Middle2' // the palm's middle: where the ragdoll's forearm ends

// Rounded, not faceted: the cel steps band over the mesh's own curves.
const smooth = (color, options) => celMaterial({ color, ...options })

/**
 * How the man is painted. The head the caller draws wears the same skin, suit and ink, so the
 * colours are owned here and nowhere else.
 */
export const bodyPaint = {
  suit: smooth(0x2457d6),
  skin: smooth(0xe2b08b),
  shoe: smooth(0xf4f4f4),
  outsole: smooth(0x2a2a30), // dark rubber under the white midsole
  toecap: smooth(0xd8d8dc),
  stripe: smooth(0xf4f4f4, { emissive: 0x6a6a6a, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  shoeStripe: smooth(0x2457d6, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  ink: smooth(0x16161b),
}

// What each of the mesh's materials is made of here.
const PAINT_OF = { Purple: 'suit', LightBlue: 'suit', Skin: 'skin', White: 'shoe', Red_Dark: 'canvas' }

const LIMBS = ['upperArm', 'forearm', 'thigh', 'shin']
const SIDES = [0, 1] // +X first, as everywhere

// Which part a joint hangs from, by the joint's name without its side (`UpperArm` of `UpperArm.L`).
function limbOf(base) {
  if (/^(Root|Body|Hips|Abdomen|Torso|Chest|Shoulder|PT)$/.test(base)) return 'torso'
  if (/^(Neck|Head)$/.test(base)) return 'head'
  if (base === 'UpperArm') return 'upperArm'
  if (/^(LowerArm|Wrist|Index|Middle|Ring|Pinky|Thumb)/.test(base)) return 'forearm'
  if (base === 'UpperLeg') return 'thigh'
  if (/^(LowerLeg|Foot|Toe)/.test(base)) return 'shin'
  throw new Error(`man.glb has a joint called ${base} that hangs from no part`)
}

const partKey = (limb, side) => (side === undefined || limb === 'torso' || limb === 'head' ? limb : `${limb}${side}`)

let man = null // the template `loadMan` makes, once

const loaded = () => {
  if (!man) throw new Error('man.js: loadMan() has not resolved yet')
  return man
}

/**
 * Reads the mesh: from `buffer` where a script has the file in hand, else fetched. Resolves once,
 * after which the rest of this file may be used.
 */
export async function loadMan(buffer) {
  if (man) return
  if (!buffer) {
    const response = await fetch(new URL('./models/man.glb', import.meta.url))
    // An error page is not a mesh, and parsed as one it fails in words nobody could act on.
    if (!response.ok) throw new Error(`The body's mesh did not arrive (${response.status})`)
    buffer = await response.arrayBuffer()
  }
  const gltf = await new GLTFLoader().parseAsync(buffer, '')
  gltf.scene.updateMatrixWorld(true)
  man = prepare(gltf.scene)
}

// ---------------------------------------------------------------------------------------------
// Reading the mesh. Everything past this section works in metres, with him standing on the
// origin facing +Z, his neck joint at `NECK_Y` and his soles at 0 ("fitted space").

function prepare(scene) {
  const skinned = []
  scene.traverse((object) => object.isSkinnedMesh && skinned.push(object))
  const { skeleton } = skinned[0]
  const names = skeleton.bones.map((bone) => bone.name)
  const indexOf = (name) => names.indexOf(name)

  // The file's units are 1/100 of a metre and its up is Z; the mesh nodes say how to undo that.
  // All the meshes share one skin space, so one matrix serves them all (the nodes differ only by
  // a few millimetres of offset the exporter left in, which skinning ignores).
  const fromFile = skinned[0].matrixWorld.clone().setPosition(0, 0, 0)
  const inverseBind = skeleton.boneInverses.map((m) => m.clone().invert())
  const pointOf = (matrix, i) => new THREE.Vector3().setFromMatrixPosition(matrix.clone().multiply(inverseBind[i]))

  // Turn him to face +Z if he does not: the toes reach further from the ankle than the heel does.
  const feet = skinned.filter((mesh) => PAINT_OF[mesh.material.name] === 'canvas')
  const ankle = pointOf(fromFile, indexOf('FootL'))
  let front = 0
  let back = 0
  for (const mesh of feet) {
    const p = new THREE.Vector3()
    const at = mesh.geometry.attributes.position
    for (let i = 0; i < at.count; i++) {
      p.fromBufferAttribute(at, i).applyMatrix4(fromFile)
      front = Math.max(front, p.z - ankle.z)
      back = Math.max(back, ankle.z - p.z)
    }
  }
  const turn = new THREE.Matrix4().makeRotationY(front >= back ? 0 : Math.PI)

  // Scale so neck-to-sole is NECK_Y, stand the soles on 0 and the neck on the vertical axis.
  const upright = turn.clone().multiply(fromFile)
  const soles = Math.min(
    ...feet.map((mesh) => {
      mesh.geometry.computeBoundingBox()
      return mesh.geometry.boundingBox.clone().applyMatrix4(upright).min.y
    }),
    ...skinned.filter((mesh) => PAINT_OF[mesh.material.name] === 'shoe').map((mesh) => {
      mesh.geometry.computeBoundingBox()
      return mesh.geometry.boundingBox.clone().applyMatrix4(upright).min.y
    }),
  )
  const neckAt = pointOf(upright, indexOf('Neck'))
  const size = NECK_Y / (neckAt.y - soles)
  const fit = new THREE.Matrix4().makeScale(size, size, size).multiply(turn).multiply(fromFile)
  fit.premultiply(new THREE.Matrix4().makeTranslation(-neckAt.x * size, -soles * size, -neckAt.z * size))

  // Each joint's bind pose in fitted space: where it is, and how it is turned (the file's own
  // turn of the joint, seen through the change of units and axes), at unit scale.
  const linear = fit.clone().setPosition(0, 0, 0)
  const linearInverse = linear.clone().invert()
  const bind = inverseBind.map((m) => {
    const p = new THREE.Vector3().setFromMatrixPosition(m).applyMatrix4(fit)
    const q = new THREE.Quaternion()
    linear.clone().multiply(m).multiply(linearInverse).decompose(new THREE.Vector3(), q, new THREE.Vector3())
    return new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1))
  })
  const at = (name) => new THREE.Vector3().setFromMatrixPosition(bind[indexOf(name)])

  // Which of the file's two sides is +X.
  const sideLetter = at('UpperArmL').x > 0 ? ['L', 'R'] : ['R', 'L']
  const sided = (base, side) => at(`${base}${sideLetter[side]}`) // the file's names lose their dots on loading: `UpperArm.L` is `UpperArmL`
  const partOfBone = names.map((name) => {
    const m = /^(.+?)([LR])$/.exec(name)
    const limb = limbOf(m ? m[1] : name)
    return partKey(limb, m ? sideLetter.indexOf(m[2]) : undefined)
  })

  const geometries = collect(skinned, fit)
  const joints = standingJoints(sided)
  const frames = partFrames(at, sided, joints)
  const mesh = geometries.map((entry) => ({ ...entry, part: Uint8Array.from(entry.dominant, (bone) => PARTS.indexOf(partOfBone[bone])) }))

  chunkyFeet(mesh, frames, joints)
  const shoes = cutShoes(mesh, frames)
  const body = mesh.filter((entry) => entry.key !== 'shoe' && entry.key !== 'canvas')
  return {
    names,
    bind,
    boneInverses: bind.map((m) => m.clone().invert()),
    partOfBone,
    joints,
    frames,
    meshes: [...body, cutStripes(mesh, frames, joints), ...shoes.meshes],
    loose: shoes.loose,
  }
}

const PARTS = ['torso', 'head', ...SIDES.flatMap((side) => LIMBS.map((limb) => partKey(limb, side)))]

// An attribute the loader may have interleaved, as one of its own.
function plain(attribute) {
  const array = new Float32Array(attribute.count * attribute.itemSize)
  for (let i = 0; i < attribute.count; i++) for (let k = 0; k < attribute.itemSize; k++) array[i * attribute.itemSize + k] = attribute.getComponent(i, k)
  return new THREE.BufferAttribute(array, attribute.itemSize)
}

// The skinned geometry of each paint, in fitted space, with the bone that has the most say over
// each vertex. Meshes of one paint (the hoodie and the jeans are both the suit) are one mesh.
function collect(skinned, fit) {
  const byPaint = new Map()
  for (const mesh of skinned) {
    const key = PAINT_OF[mesh.material.name]
    if (!key) throw new Error(`man.glb has a material called ${mesh.material.name}`)
    const g = new THREE.BufferGeometry()
    const a = mesh.geometry.attributes
    g.setAttribute('position', plain(a.position))
    g.setAttribute('normal', plain(a.normal))
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from({ length: a.skinIndex.count * 4 }, (_, n) => a.skinIndex.getComponent(Math.floor(n / 4), n % 4)), 4))
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Float32Array.from({ length: a.skinWeight.count * 4 }, (_, n) => a.skinWeight.getComponent(Math.floor(n / 4), n % 4)), 4))
    g.setIndex(mesh.geometry.index.clone())
    g.applyMatrix4(fit)
    if (!byPaint.has(key)) byPaint.set(key, [])
    byPaint.get(key).push(g)
  }
  return [...byPaint].map(([key, list]) => {
    const geometry = list.length > 1 ? mergeGeometries(list) : list[0]
    const { skinIndex, skinWeight } = geometry.attributes
    const dominant = new Uint8Array(skinIndex.count)
    for (let v = 0; v < dominant.length; v++) {
      let best = 0
      for (let k = 1; k < 4; k++) if (skinWeight.getComponent(v, k) > skinWeight.getComponent(v, best)) best = k
      dominant[v] = skinIndex.getComponent(v, best)
    }
    return { key, geometry, dominant }
  })
}

// Where each joint is on him standing: the two sides averaged, so that he is symmetrical, and
// each limb let down straight from its top. The pieces keep their bind lengths.
function standingJoints(sided) {
  const mirrored = (base, side) => {
    const a = sided(base, side)
    const b = sided(base, 1 - side)
    return new THREE.Vector3((side === 0 ? 1 : -1) * (Math.abs(a.x) + Math.abs(b.x)) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
  }
  const down = (from, length) => from.clone().setY(from.y - length)
  const lengths = {
    upperArm: sided('UpperArm', 0).distanceTo(sided('LowerArm', 0)),
    forearm: sided('LowerArm', 0).distanceTo(sided(HAND_JOINT, 0)),
    thigh: sided('UpperLeg', 0).distanceTo(sided('LowerLeg', 0)),
    shin: sided('LowerLeg', 0).distanceTo(sided('Foot', 0)),
  }
  const sides = SIDES.map((side) => {
    const shoulder = mirrored('UpperArm', side)
    const hip = mirrored('UpperLeg', side)
    const elbow = down(shoulder, lengths.upperArm)
    const knee = down(hip, lengths.thigh)
    return { shoulder, elbow, hand: down(elbow, lengths.forearm), hip, knee, foot: down(knee, lengths.shin) }
  })
  const neck = new THREE.Vector3(0, NECK_Y, 0)
  return { neck, head: neck.clone().setY(NECK_Y + HEAD_HEIGHT), sides, lengths }
}

// For each part: `bind`, the joint it hangs from in the mesh's own pose; `turn`, what takes the
// limb's direction there to straight down; and `stands`, where the part's origin is on him standing.
function partFrames(at, sided, joints) {
  const frames = {}
  const down = new THREE.Vector3(0, -1, 0)
  const limb = (from, to) => new THREE.Quaternion().setFromUnitVectors(to.clone().sub(from).normalize(), down)
  const mid = (a, b) => a.clone().add(b).multiplyScalar(0.5)
  const shoulders = mid(sided('UpperArm', 0), sided('UpperArm', 1))
  frames.torso = { bind: shoulders, turn: new THREE.Quaternion(), stands: mid(joints.sides[0].shoulder, joints.sides[1].shoulder) }
  frames.head = { bind: at('Neck'), turn: new THREE.Quaternion(), stands: joints.neck }
  for (const side of SIDES) {
    const stands = joints.sides[side]
    const hang = (name, from, to, standsAt) => (frames[partKey(name, side)] = { bind: sided(from, side), turn: limb(sided(from, side), sided(to, side)), stands: standsAt })
    hang('upperArm', 'UpperArm', 'LowerArm', stands.shoulder)
    hang('forearm', 'LowerArm', HAND_JOINT, stands.elbow)
    hang('thigh', 'UpperLeg', 'LowerLeg', stands.hip)
    hang('shin', 'LowerLeg', 'Foot', stands.knee)
  }
  return frames
}

// ---------------------------------------------------------------------------------------------
// What the mesh lacks, cut out of its own triangles so that it is skinned with them and cannot
// part from them: the stripes of the suit, and the trainers' soles, caps, tabs and stripes.
// Triangles are measured in the standing pose (`at`) and cut straight there, whatever their layout.

const STRIPE_CENTRES = [-0.019, 0, 0.019] // metres from the limb's centre line, front to back
const STRIPE_WIDTH = 0.011
const LIFT = 0.002 // stripes stand this far out along the normal, with the material's polygon offset, so they never fight the cloth

const FOOT_SCALE = 1.12 // the trainers are chunkier than the mesh made them, about the ground under each ankle
const SOLE_SPLIT = 0.4 // of the sole's height: the outsole is below it
const TOE_CAP = 0.3 // of the shoe's length, from the toe
const HEEL_TAB = 0.12 // of its length, from the heel, and above half the upper's height
const SIDE_STRIPES = { width: 0.007, thick: 0.003, gap: 0.006, slope: (60 * Math.PI) / 180, middle: 0.46, margin: 0.002 } // slabs on each flank, up and back at `slope` from the sole
const EYELET_AT = [0.33, 0.43, 0.53, 0.63] // of the shoe's length: four pairs
const EYELET_RADIUS = 0.003
const EYELET_APART = 0.03 // across the lace opening
const LACE_RADIUS = 0.003

// One bone's say over a vertex, to a Map from bone to weight.
const influenceOf = (skinIndex, skinWeight, v) => {
  const map = new Map()
  for (let k = 0; k < 4; k++) if (skinWeight.getComponent(v, k) > 0) map.set(skinIndex.getComponent(v, k), skinWeight.getComponent(v, k))
  return map
}
const mixInfluence = (a, b, t) => {
  const out = new Map()
  for (const bone of new Set([...a.keys(), ...b.keys()])) out.set(bone, (a.get(bone) ?? 0) * (1 - t) + (b.get(bone) ?? 0) * t)
  return out
}

// A corner of a triangle being cut: its place in the mesh as made (`p`), its normal, its bones, and its place standing (`at`).
const corner = (attributes, v, standing) => {
  const p = new THREE.Vector3().fromBufferAttribute(attributes.position, v)
  return {
    p,
    n: new THREE.Vector3().fromBufferAttribute(attributes.normal, v),
    influence: influenceOf(attributes.skinIndex, attributes.skinWeight, v),
    at: p.clone().applyMatrix4(standing),
  }
}

// Keeps the part of the convex `polygon` where `inside(corner) >= 0`. (Sutherland-Hodgman.)
function clip(polygon, inside) {
  const out = []
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length]
    const da = inside(a)
    const db = inside(b)
    if (da >= 0) out.push(a)
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db)
      out.push({
        p: a.p.clone().lerp(b.p, t),
        n: a.n.clone().lerp(b.n, t).normalize(),
        influence: mixInfluence(a.influence, b.influence, t),
        at: a.at.clone().lerp(b.at, t),
      })
    }
  })
  return out
}
const clipAll = (polygon, ...planes) => planes.reduce((rest, plane) => (rest.length ? clip(rest, plane) : rest), polygon)

// Cut pieces collected into one skinned geometry: each corner keeps its four heaviest bones.
class Pieces {
  constructor() {
    this.positions = []
    this.normals = []
    this.bones = []
    this.weights = []
    this.owners = []
  }

  add(polygon, owner, lift = 0) {
    for (let i = 1; i + 1 < polygon.length; i++) {
      for (const c of [polygon[0], polygon[i], polygon[i + 1]]) {
        const out = c.p.clone().addScaledVector(c.n, lift)
        this.positions.push(out.x, out.y, out.z)
        this.normals.push(c.n.x, c.n.y, c.n.z)
        const heaviest = [...c.influence].sort((x, y) => y[1] - x[1]).slice(0, 4)
        const total = heaviest.reduce((sum, [, w]) => sum + w, 0)
        for (let k = 0; k < 4; k++) {
          this.bones.push(heaviest[k]?.[0] ?? 0)
          this.weights.push(heaviest[k] ? heaviest[k][1] / total : 0)
        }
        this.owners.push(owner)
      }
    }
  }

  entry(key) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3))
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.bones, 4))
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.weights, 4))
    geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from({ length: this.owners.length }, (_, i) => i), 1))
    return { key, geometry, part: Uint8Array.from(this.owners) }
  }
}

// The triangles of `entry` as polygons of corners, each with the part that has most say over it.
function* trianglesOf(entry, stands) {
  const index = entry.geometry.index.array
  for (let t = 0; t < index.length; t += 3) {
    const v = [index[t], index[t + 1], index[t + 2]]
    const owners = v.map((i) => entry.part[i])
    const owner = owners[0] === owners[1] || owners[0] === owners[2] ? owners[0] : owners[1] === owners[2] ? owners[1] : owners[0]
    yield { owner, polygon: v.map((i) => corner(entry.geometry.attributes, i, stands[PARTS[owner]])) }
  }
}

const standings = (frames) => Object.fromEntries(PARTS.map((key) => [key, standingOf(frames[key])]))

// Scales the trainers up about the ground under each ankle, where he stands: his feet stay on the floor.
function chunkyFeet(meshes, frames, joints) {
  const stands = standings(frames)
  for (const side of SIDES) {
    const key = partKey('shin', side)
    const ground = new THREE.Vector3(joints.sides[side].foot.x, 0, joints.sides[side].foot.z).applyMatrix4(stands[key].clone().invert())
    for (const entry of meshes.filter(({ key: paintKey }) => paintKey === 'shoe' || paintKey === 'canvas')) {
      const at = entry.geometry.attributes.position
      const p = new THREE.Vector3()
      for (let v = 0; v < at.count; v++) {
        if (PARTS[entry.part[v]] === key) at.setXYZ(v, ...p.fromBufferAttribute(at, v).sub(ground).multiplyScalar(FOOT_SCALE).add(ground).toArray())
      }
    }
  }
}

// Three white stripes down the outer side of each sleeve and trouser leg: the pieces of cloth inside
// a band across the limb (measured from its centre line, standing) on the half that faces away
// from the body.
function cutStripes(meshes, frames, joints) {
  const suit = meshes.find((entry) => entry.key === 'suit')
  const pieces = new Pieces()
  for (const { owner, polygon } of trianglesOf(suit, standings(frames))) {
    const key = PARTS[owner]
    const limb = LIMBS.find((name) => key.startsWith(name))
    if (!limb) continue
    const side = Number(key.slice(-1))
    const outward = side === 0 ? 1 : -1
    const top = joints.sides[side][limb === 'upperArm' || limb === 'forearm' ? 'shoulder' : 'hip']
    const outer = clip(polygon, ({ at }) => outward * (at.x - top.x))
    for (const centre of STRIPE_CENTRES) {
      const across = ({ at }) => outward * (at.z - top.z)
      pieces.add(clipAll(outer, (c) => across(c) - (centre - STRIPE_WIDTH / 2), (c) => centre + STRIPE_WIDTH / 2 - across(c)), owner, LIFT)
    }
  }
  return pieces.entry('stripe')
}

// A cylinder from `a` to `b`.
function rodBetween(a, b, radius) {
  const length = a.distanceTo(b)
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 5)
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()))
  return geometry.translate(...a.clone().add(b).multiplyScalar(0.5).toArray())
}

/**
 * The trainers, remade from the mesh's two shoe meshes. The sole is cut into a dark outsole and a
 * white midsole, the upper into white leather with a pale toe cap, a blue heel tab and three blue
 * stripes down each side; all by planes, in the standing pose. Returns the cut meshes, and for each
 * shin the loose parts that ride on it in its own frame (eyelets and laces).
 */
function cutShoes(meshes, frames) {
  const stands = standings(frames)
  const sole = meshes.find((entry) => entry.key === 'shoe')
  const upper = meshes.find((entry) => entry.key === 'canvas')
  const made = { shoe: new Pieces(), outsole: new Pieces(), toecap: new Pieces(), suit: new Pieces() }
  const loose = {}

  for (const side of SIDES) {
    const key = partKey('shin', side)
    const owner = PARTS.indexOf(key)
    const mine = (entry) => [...trianglesOf(entry, stands)].filter((t) => t.owner === owner)
    const soleTriangles = mine(sole)
    const upperTriangles = mine(upper)
    const all = [...soleTriangles, ...upperTriangles].flatMap((t) => t.polygon.map((c) => c.at))
    const box = new THREE.Box3().setFromPoints(all)
    const length = box.max.z - box.min.z
    const heel = box.min.z
    const upperBox = new THREE.Box3().setFromPoints(upperTriangles.flatMap((t) => t.polygon.map((c) => c.at)))
    const centre = (upperBox.min.x + upperBox.max.x) / 2
    const floor = box.min.y
    const soleTop = Math.max(...soleTriangles.flatMap((t) => t.polygon.map((c) => c.at.y)).filter((y) => y < floor + 0.045))
    const split = floor + SOLE_SPLIT * (soleTop - floor)

    for (const { polygon } of soleTriangles) {
      made.outsole.add(clip(polygon, ({ at }) => split - at.y), owner)
      made.shoe.add(clip(polygon, ({ at }) => at.y - split), owner)
    }

    const capFrom = heel + (1 - TOE_CAP) * length
    const tabTo = heel + HEEL_TAB * length
    const tabFrom = upperBox.min.y + 0.5 * (upperBox.max.y - upperBox.min.y)
    for (const { polygon } of upperTriangles) {
      made.toecap.add(clip(polygon, ({ at }) => at.z - capFrom), owner)
      const body = clip(polygon, ({ at }) => capFrom - at.z)
      if (!body.length) continue
      const behind = clip(body, ({ at }) => tabTo - at.z)
      made.suit.add(clip(behind, ({ at }) => at.y - tabFrom), owner)
      made.shoe.add(clip(behind, ({ at }) => tabFrom - at.y), owner)
      const rest = clip(body, ({ at }) => at.z - tabTo)
      made.shoe.add(rest, owner)
    }
    // The lace opening: pairs of eyelets down the instep, laces crossing between them.
    // The leather's surface straight above `(x, z)`: a ray down through its triangles, the highest hit.
    const topAt = (x, z) => {
      let top = -Infinity
      for (const { polygon: [a, b, c] } of upperTriangles) {
        const d = (b.at.z - c.at.z) * (a.at.x - c.at.x) + (c.at.x - b.at.x) * (a.at.z - c.at.z)
        if (Math.abs(d) < 1e-9) continue
        const wa = ((b.at.z - c.at.z) * (x - c.at.x) + (c.at.x - b.at.x) * (z - c.at.z)) / d
        const wb = ((c.at.z - a.at.z) * (x - c.at.x) + (a.at.x - c.at.x) * (z - c.at.z)) / d
        const wc = 1 - wa - wb
        if (wa >= 0 && wb >= 0 && wc >= 0) top = Math.max(top, wa * a.at.y + wb * b.at.y + wc * c.at.y)
      }
      return top
    }
    // The side stripes: slabs lying on each flank, found by rays through the leather from the side.
    const wallAt = (flank, y, z) => {
      let wall = null
      for (const { polygon: [a, b, c] } of upperTriangles) {
        const d = (b.at.z - c.at.z) * (a.at.y - c.at.y) + (c.at.y - b.at.y) * (a.at.z - c.at.z)
        if (Math.abs(d) < 1e-9) continue
        const wa = ((b.at.z - c.at.z) * (y - c.at.y) + (c.at.y - b.at.y) * (z - c.at.z)) / d
        const wb = ((c.at.z - a.at.z) * (y - c.at.y) + (a.at.y - c.at.y) * (z - c.at.z)) / d
        const wc = 1 - wa - wb
        if (wa < 0 || wb < 0 || wc < 0) continue
        const x = wa * a.at.x + wb * b.at.x + wc * c.at.x
        if (wall === null || flank * x > flank * wall) wall = x
      }
      return wall
    }
    const sideStripes = []
    const sin = Math.sin(SIDE_STRIPES.slope)
    const cos = Math.cos(SIDE_STRIPES.slope)
    const pitch = SIDE_STRIPES.width + SIDE_STRIPES.gap
    const bottom = soleTop + SIDE_STRIPES.margin + SIDE_STRIPES.width
    for (const flank of [1, -1]) {
      for (let k = -1; k <= 1; k++) {
        // The line up and back from the sole, `k` stripes aside along the shoe's length.
        const zAt = (y) => heel + SIDE_STRIPES.middle * length + k * pitch / cos + (bottom - y) * (cos / sin)
        const reach = []
        for (let y = bottom; y < bottom + 0.15; y += 0.002) {
          const z = zAt(y)
          const wall = wallAt(flank, y, z)
          if (wall === null || flank * (wall - centre) < EYELET_APART / 2 + 0.008) break // short of the laces
          reach.push(new THREE.Vector3(wall, y, z))
        }
        if (reach.length < 3) continue
        for (const [from, to] of [[0, reach.length >> 1], [reach.length >> 1, reach.length - 1]]) {
          const a = reach[from]
          const b = reach[to]
          const along = b.clone().sub(a)
          const hint = new THREE.Vector3(flank, 0, 0)
          const width = new THREE.Vector3().crossVectors(along, hint).normalize()
          const normal = new THREE.Vector3().crossVectors(width, along).normalize()
          const box = new THREE.BoxGeometry(SIDE_STRIPES.width, along.length(), SIDE_STRIPES.thick)
          const basis = new THREE.Matrix4().makeBasis(width, along.clone().normalize(), normal)
          box.applyMatrix4(basis)
          box.translate(...a.clone().add(b).multiplyScalar(0.5).addScaledVector(normal, SIDE_STRIPES.thick / 2 - 0.0005).toArray())
          sideStripes.push(box)
        }
      }
    }

    const pairs = EYELET_AT.map((fraction) => {
      const z = heel + fraction * length
      const at = (flank) => new THREE.Vector3(centre + (flank * EYELET_APART) / 2, topAt(centre + (flank * EYELET_APART) / 2, z) + 0.002, z)
      return [at(1), at(-1)]
      // Past the leather (the shoe's mouth) there is no surface to stand an eyelet on, and its
      // height comes back infinite: laced, that is a mesh of NaNs.
    }).filter((pair) => pair.every((eyelet) => Number.isFinite(eyelet.y)))
    const lift = new THREE.Vector3(0, 0.004, 0)
    const eyelets = []
    const laces = []
    pairs.forEach(([left, right], i) => {
      for (const eyelet of [left, right]) eyelets.push(new THREE.SphereGeometry(EYELET_RADIUS, 6, 4).translate(...eyelet.toArray()))
      if (i + 1 < pairs.length) {
        const [nextLeft, nextRight] = pairs[i + 1]
        laces.push(rodBetween(left.clone().add(lift), nextRight.clone().add(lift), LACE_RADIUS), rodBetween(right.clone().add(lift), nextLeft.clone().add(lift), LACE_RADIUS))
      }
    })
    const standingAtShin = frames[key].stands
    const inShin = (geometry) => geometry.translate(-standingAtShin.x, -standingAtShin.y, -standingAtShin.z)
    loose[key] = [
      ['ink', inShin(mergeGeometries(eyelets))],
      ['suit', inShin(mergeGeometries(laces))],
      ['shoeStripe', inShin(mergeGeometries(sideStripes))],
    ]
  }
  return { meshes: Object.entries(made).map(([key, pieces]) => pieces.entry(key)), loose }
}

// ---------------------------------------------------------------------------------------------

/**
 * Where each joint is on him standing, feet on the origin, +X side first, the two sides mirrored:
 * `{ neck, head (the middle of the head), sides: [{ shoulder, elbow, hand, hip, knee, foot }],
 * lengths: { upperArm, forearm, thigh, shin } }`. The hand is the middle of the palm. A limb hangs
 * straight down from its top, so the joints below it are its length under it.
 */
export function manJoints() {
  const { joints } = loaded()
  const copy = (v) => v.clone()
  return {
    neck: copy(joints.neck),
    head: copy(joints.head),
    sides: joints.sides.map((side) => Object.fromEntries(Object.entries(side).map(([name, v]) => [name, copy(v)]))),
    lengths: { ...joints.lengths },
  }
}

/**
 * Puts the body on the parts the caller moves, and returns the group of skinned meshes to add
 * under the same root, with no transform of its own. `parts` is `{ torso, head, sides: [{ upperArm,
 * forearm, thigh, shin }] }` of objects in the hang convention (see the top of this file), each
 * standing at `manJoints()` when not turned, and the torso at the middle of the shoulders. A part
 * left out is a part the caller does not show: whatever it would have moved is not drawn.
 * `below` cuts him off level at that height where he stands and closes the suit over the cut,
 * for the first-person view of the legs.
 */
export function dressMan(parts, { below } = {}) {
  const { names, bind, boneInverses, partOfBone, frames, meshes, loose } = loaded()
  const partObject = (key) => {
    const m = /^(.+?)([01])$/.exec(key)
    return m ? parts.sides?.[Number(m[2])]?.[m[1]] : parts[key]
  }
  if (!parts.torso) throw new Error('dressMan needs a torso part')

  // One bone to a joint, fixed on its part. A joint of a part that is left out rides on the torso,
  // so the skin that is still drawn and leans on it has somewhere sensible to go.
  const bones = names.map((name, i) => {
    const key = partOfBone[i]
    const owner = partObject(key) ?? parts.torso
    const frame = frames[partObject(key) ? key : 'torso']
    const local = new THREE.Matrix4()
      .makeRotationFromQuaternion(frame.turn)
      .multiply(new THREE.Matrix4().makeTranslation(-frame.bind.x, -frame.bind.y, -frame.bind.z))
      .multiply(bind[i])
    const bone = new THREE.Bone()
    bone.name = name
    local.decompose(bone.position, bone.quaternion, bone.scale)
    owner.add(bone)
    return bone
  })
  const skeleton = new THREE.Skeleton(bones, boneInverses)

  const group = new THREE.Group()
  const shown = new Set(PARTS.filter((key) => partObject(key)))
  for (const entry of meshes) {
    const geometry = visible(entry, shown, below, frames)
    if (!geometry.index.count) continue
    const mesh = new THREE.SkinnedMesh(geometry, bodyPaint[entry.key])
    mesh.bind(skeleton, new THREE.Matrix4())
    mesh.frustumCulled = false // its bounds are those of the pose it was made in
    mesh.castShadow = mesh.receiveShadow = !/tripe$/.test(entry.key) // a stripe is too thin to take a shadow without jags
    group.add(mesh)
  }

  // The eyelets and laces ride rigidly on the shin, which is where the foot is.
  for (const [key, list] of Object.entries(loose)) {
    const owner = partObject(key)
    if (!owner) continue
    for (const [paintKey, geometry] of list) {
      const mesh = new THREE.Mesh(geometry, bodyPaint[paintKey])
      mesh.castShadow = mesh.receiveShadow = false // too small to take a shadow without jags
      owner.add(mesh)
    }
  }
  return group
}

// The triangles of `entry` worth drawing: those whose vertices all hang from a part that is
// shown. Sharing the vertices, so only the index is new. With `below` it is `cutBelow`'s.
function visible(entry, shown, below, frames) {
  const { geometry, part } = entry
  const index = geometry.index.array
  const keep = Array.from(part, (p) => shown.has(PARTS[p]))
  if (below !== undefined) return cutBelow(entry, keep, below, frames)
  if (keep.every(Boolean)) return geometry
  const kept = []
  for (let i = 0; i < index.length; i += 3) if (keep[index[i]] && keep[index[i + 1]] && keep[index[i + 2]]) kept.push(index[i], index[i + 1], index[i + 2])
  const shared = new THREE.BufferGeometry()
  for (const [name, attribute] of Object.entries(geometry.attributes)) shared.setAttribute(name, attribute)
  shared.setIndex(kept)
  return shared
}

const UP = new THREE.Vector3(0, 1, 0)

// The same, cut off level at the height `below` where he stands: triangles that cross it are cut
// through, not dropped, and the suit is closed over the cut with a lid, so that an eye above it
// looks at cloth and not into him.
function cutBelow(entry, keep, below, frames) {
  const index = entry.geometry.index.array
  const pieces = new Pieces()
  const rim = [] // the edges the cut left on the trunk, each a pair of corners
  const trunk = PARTS.indexOf('torso')
  let t = 0
  for (const { owner, polygon } of trianglesOf(entry, standings(frames))) {
    const whole = keep[index[t]] && keep[index[t + 1]] && keep[index[t + 2]]
    t += 3
    if (!whole) continue
    const under = clip(polygon, ({ at }) => below - at.y)
    pieces.add(under, owner)
    const cut = under.filter((c) => !polygon.includes(c))
    if (owner === trunk && cut.length === 2) rim.push(cut)
  }
  if (entry.key === 'suit' && rim.length) {
    // A fan from the middle of the rim. Every joint of the trunk is fixed on the one part, so the
    // middle may lean on any rim corner's.
    const middle = { p: new THREE.Vector3(), n: UP, influence: rim[0][0].influence, at: new THREE.Vector3() }
    for (const c of rim.flat()) {
      middle.p.addScaledVector(c.p, 1 / (rim.length * 2))
      middle.at.addScaledVector(c.at, 1 / (rim.length * 2))
    }
    for (const [a, b] of rim) {
      const faces = (a.at.z - middle.at.z) * (b.at.x - middle.at.x) - (a.at.x - middle.at.x) * (b.at.z - middle.at.z)
      const [first, second] = faces >= 0 ? [a, b] : [b, a]
      pieces.add([middle, { ...first, n: UP }, { ...second, n: UP }], trunk)
    }
  }
  return pieces.entry(entry.key).geometry
}

// Takes a point of the mesh as it was made to where it is with its part standing.
const standingOf = ({ bind, turn, stands }) =>
  new THREE.Matrix4()
    .makeTranslation(stands.x, stands.y, stands.z)
    .multiply(new THREE.Matrix4().makeRotationFromQuaternion(turn))
    .multiply(new THREE.Matrix4().makeTranslation(-bind.x, -bind.y, -bind.z))
