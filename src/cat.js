// A stray ginger cat after Stray's, standing on a ledge or parapet of a parkour place, side-on to
// the runner, which is what reads as a cat (from the front it is a column). It watches the runner
// with its head; when he comes close it hops a few metres away along whatever it sits on, turns
// round and watches him again (and only with nowhere to land does it go over the edge and is
// gone); once he is far off it is back on its perch, so the place keeps it for the next lap.
// Look only: it has no solid, and nothing it does decides anything.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { celMaterial } from './shading.js'

const SIZE = 1.3 // times a real cat: a big tom, or at 0.3 m tall it is a speck in a place this size
const MEOW_WITHIN = 7 // metres from the runner's feet at which a perched cat calls, once
const LEAP_WITHIN = 5 // metres at which it goes
const HOP = 4 // metres a hop clears, away from him
const HOP_UP = 1 // metres higher it may land
const HOP_DOWN = 3 // metres lower it may land
const HOP_TURNS = [0, 0.6, -0.6, 1.2, -1.2, Math.PI / 2, -Math.PI / 2, 1.8, -1.8] // radians off straight away from him, tried in turn for a floor
const HOP_LEVEL = 0.3 // metres up or down that count as the same ledge: a hop along it is tried before one off it
const LEAP_OUT = 3 // with no floor in reach: metres it clears over the edge
const LEAP_DROP = 4 // and metres lower it is gone
const LEAP_PEAK = 0.7 // metres over the straight line between the two, at the top of the arc
const LEAP_TIME = 0.75 // seconds
const BACK_BEYOND = 60 // metres from the perch he must be for the cat to be back on it
const EYE = 1.7 // metres over his feet, where the head looks
const LOOK_YAW = THREE.MathUtils.degToRad(100) // the head turns this far either way: over its shoulder
const LOOK_PITCH = THREE.MathUtils.degToRad(30)
const LOOK_EASE = 4 // per second: how quickly the head follows
const TAIL_SWAY = 0.35 // radians either way
const TAIL_PERIOD = 3.2 // seconds
const TAIL_NOD = 0.1 // radians the hook nods forward and back

// A ginger tabby after Stray's cat: orange, darker bands across the back and round the tail,
// cream under the chin, down the chest and along the belly. Each face takes one colour, chosen
// from where it is, so the stripes are facets like the rest of the game.
const GINGER = new THREE.Color(0xd9822b)
const STRIPE = new THREE.Color(0x9e5418)
const CREAM = new THREE.Color(0xf2ddb8)
const PINK = new THREE.Color(0xe79aa0)
const EYE_AMBER = new THREE.Color(0xc9cf3c)
const PUPIL = new THREE.Color(0x1d1a16)
const FUR = celMaterial({ vertexColors: true, flatShading: true })
const STRIPE_EVERY = 0.025 // metres along the back from one band's start to the next

// The torso's girth along the spine, rump (−) to chest (+): [metres along, radius].
const GIRTH = [[-0.19, 0], [-0.18, 0.035], [-0.15, 0.055], [-0.1, 0.065], [-0.03, 0.057], [0.03, 0.058], [0.09, 0.068], [0.13, 0.068], [0.17, 0.05], [0.2, 0]]
const BACK = 0.2 // metres up to the spine's line

/**
 * `geometry` as faces of one colour each, `colorOf(centre, corners)` choosing it from the face's
 * middle (and, for an indexed geometry, the indices its corners had), or one colour for all.
 */
function paint(geometry, colorOf) {
  const corners = geometry.index ? geometry.index.array : null
  const flat = geometry.index ? geometry.toNonIndexed() : geometry
  flat.deleteAttribute('uv')
  flat.deleteAttribute('normal')
  const position = flat.attributes.position
  const colors = new Float32Array(position.count * 3)
  const centre = new THREE.Vector3()
  for (let t = 0; t < position.count; t += 3) {
    centre.set(0, 0, 0)
    for (let k = 0; k < 3; k++) centre.x += position.getX(t + k) / 3, centre.y += position.getY(t + k) / 3, centre.z += position.getZ(t + k) / 3
    const color = colorOf.isColor ? colorOf : colorOf(centre, corners && corners.subarray(t, t + 3))
    for (let k = 0; k < 3; k++) color.toArray(colors, (t + k) * 3)
  }
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return flat
}

/** Painted parts as one mesh in the cat's fur. */
function piece(parts) {
  const geometry = mergeGeometries(parts)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, FUR)
  mesh.castShadow = true
  return mesh
}

const ball = (radius, [sx, sy, sz], [x, y, z]) => new THREE.IcosahedronGeometry(radius, 0).scale(sx, sy, sz).translate(x, y, z)

/** The body, standing, facing +Z, its origin on the floor under its middle. Head and tail are made apart to turn and sway. */
function standing() {
  const profile = []
  for (let i = 0; i <= 18; i++) {
    const along = -0.19 + (0.39 * i) / 18
    const found = GIRTH.findIndex(([at]) => at >= along - 1e-9)
    const after = found < 0 ? GIRTH.length - 1 : found
    const [a0, r0] = GIRTH[Math.max(0, after - 1)]
    const [a1, r1] = GIRTH[after]
    profile.push(new THREE.Vector2(a1 === a0 ? r1 : r0 + ((r1 - r0) * (along - a0)) / (a1 - a0), along))
  }
  // Lathed round its spine, the spine laid along +Z; a little narrower than it is deep.
  const torso = new THREE.LatheGeometry(profile, 7).rotateX(Math.PI / 2).scale(0.85, 1.05, 1).translate(0, BACK, 0)
  const parts = [
    paint(torso, (c) => {
      if (c.y < BACK - 0.03 || (c.z > 0.1 && c.y < BACK + 0.02)) return CREAM // belly, and the chest
      const band = Math.floor((c.z + 0.2) / STRIPE_EVERY) % 2 === 0
      return band && c.y > BACK + 0.015 && c.z > -0.16 && c.z < 0.12 ? STRIPE : GINGER // bands over the back, stopping at the flanks
    }),
    // The neck, up and forward to the head.
    paint(new THREE.CylinderGeometry(0.034, 0.046, 0.09, 6).rotateX(0.6).translate(0, 0.26, 0.16), (c) => (c.z > 0.17 && c.y < 0.27 ? CREAM : GINGER)),
  ]
  for (const [x, z, front] of [[0.034, 0.1, true], [-0.034, 0.1, true], [0.04, -0.11, false], [-0.04, -0.11, false]]) {
    parts.push(paint(new THREE.CylinderGeometry(0.019, 0.013, 0.17, 5).translate(x, 0.085, z), GINGER))
    parts.push(paint(ball(0.018, [1, 0.6, 1.4], [x, 0.008, z + 0.01]), CREAM)) // a paw
    if (!front) parts.push(paint(new THREE.IcosahedronGeometry(0.045, 1).scale(0.7, 1.1, 1).translate(x, 0.17, z), (c) => (c.y > 0.19 && Math.floor((c.z + 0.2) / STRIPE_EVERY) % 2 === 0 ? STRIPE : GINGER))) // a thigh
  }
  return piece(parts)
}

/** The head, its origin at the neck, facing +Z. */
function head() {
  const parts = [
    // The skull, wide at the cheeks; cream under the chin.
    paint(new THREE.IcosahedronGeometry(0.052, 1).scale(1.1, 0.9, 1).translate(0, 0.035, 0.03), (c) => (c.y < 0.02 && c.z > 0.03 ? CREAM : GINGER)),
    paint(ball(0.026, [1.25, 0.8, 1], [0, 0.017, 0.072]), CREAM), // the muzzle
    paint(new THREE.BoxGeometry(0.013, 0.009, 0.008).translate(0, 0.031, 0.096), PINK), // the nose
  ]
  for (const side of [1, -1]) {
    // The ears: tall four-sided cones, splayed, with a flat pink face toward the front.
    const ear = (radius, height, depth) => new THREE.ConeGeometry(radius, height, 4).rotateY(Math.PI / 4).scale(1, 1, depth).rotateZ(-0.3 * side).rotateX(-0.12)
    parts.push(paint(ear(0.026, 0.055, 1).translate(0.031 * side, 0.088, 0.018), GINGER))
    parts.push(paint(ear(0.017, 0.04, 0.35).translate(0.03 * side, 0.082, 0.032), PINK))
    // The eyes: amber almonds, a slit of pupil in each.
    parts.push(paint(new THREE.IcosahedronGeometry(0.011, 0).scale(1.25, 0.75, 0.5).rotateZ(0.2 * side).translate(0.023 * side, 0.046, 0.071), EYE_AMBER))
    parts.push(paint(new THREE.BoxGeometry(0.003, 0.012, 0.004).translate(0.023 * side, 0.046, 0.077), PUPIL))
    parts.push(paint(new THREE.BoxGeometry(0.007, 0.004, 0.035).rotateY(0.25 * side).translate(0.017 * side, 0.077, 0.03), STRIPE)) // the tabby's M, either side
  }
  parts.push(paint(new THREE.BoxGeometry(0.007, 0.004, 0.04).translate(0, 0.081, 0.028), STRIPE)) // and down its middle
  return piece(parts)
}

/** The tail, its origin at its root: back off the rump, up, and hooked forward at the tip, as Stray's cat holds it. */
function tail() {
  const curve = new THREE.CatmullRomCurve3([[0, 0, 0], [0, 0.03, -0.05], [0, 0.11, -0.09], [0, 0.2, -0.1], [0, 0.27, -0.07], [0, 0.295, -0.03]].map(([x, y, z]) => new THREE.Vector3(x, y, z)))
  const SEGMENTS = 14
  const SIDES = 5
  const tube = new THREE.TubeGeometry(curve, SEGMENTS, 0.017, SIDES, false)
  // Thinner toward the tip: each ring drawn in about its point on the curve.
  const position = tube.attributes.position
  const at = new THREE.Vector3()
  const point = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) {
    const ring = Math.floor(i / (SIDES + 1))
    curve.getPointAt(ring / SEGMENTS, point)
    at.fromBufferAttribute(position, i).sub(point).multiplyScalar(1 - 0.55 * (ring / SEGMENTS)).add(point)
    position.setXYZ(i, at.x, at.y, at.z)
  }
  // Ringed: two segments of ginger, one dark, from the root out.
  const ringed = paint(tube, (_, corners) => (Math.floor(Math.min(...corners) / (SIDES + 1)) % 3 === 2 ? STRIPE : GINGER))
  const tip = paint(ball(0.009, [1, 1, 1], curve.getPointAt(1, point).toArray()), STRIPE)
  return piece([ringed, tip])
}

const _away = new THREE.Vector3()

export class Cat {
  /**
   * `perch`: `{ at: Vector3 on the ledge, yaw }` — the way it faces, as a runner's yaw is turned.
   * `floorAt(x, y, z)`: the height of the floor under a point, as the place answers it: where a hop may land.
   */
  constructor(perch, floorAt) {
    this._home = perch.at.clone()
    this._homeYaw = perch.yaw
    this._at = this._home.clone() // where it sits now: home, or where a hop took it
    this._yaw = perch.yaw
    this._floorAt = floorAt
    this._state = 'perched' // perched, leaping, gone
    this._leapT = 0
    this._leapFrom = new THREE.Vector3()
    this._leapTo = new THREE.Vector3()
    this._lands = false // whether the leap under way ends on a floor, or over the edge
    this._landYaw = 0 // the way it faces once landed: side-on to him
    this._meowed = false
    this._lookYaw = 0
    this._lookPitch = 0
    this._clock = Math.random() * 10
    this.group = new THREE.Group()
    this.body = standing()
    this.head = head()
    this.head.position.set(0, 0.29, 0.185)
    this.head.rotation.order = 'YXZ'
    this.tail = tail()
    this.tail.position.set(0, 0.235, -0.17)
    this.group.add(this.body, this.head, this.tail)
    this.group.scale.setScalar(SIZE)
    this._settle()
  }

  // Stands where it is now, facing `_yaw`.
  _settle() {
    this._state = 'perched'
    this.group.visible = true
    this.group.position.copy(this._at)
    this.group.rotation.set(0, this._yaw, 0)
  }

  // Back on its own perch, as it was, while he is far off.
  _goHome() {
    this._at.copy(this._home)
    this._yaw = this._homeYaw
    this._meowed = false
    this._settle()
  }

  /** Steps the cat; `focus` is the runner's feet. Returns `'meow'` the first time he nears it perched, else null. */
  present(dt, focus) {
    const fromHome = Math.hypot(focus.x - this._home.x, focus.y - this._home.y, focus.z - this._home.z)
    const moved = this._state === 'gone' || !this._at.equals(this._home)
    if (moved && this._state !== 'leaping' && fromHome > BACK_BEYOND) this._goHome()
    if (this._state === 'gone') return null
    const dx = focus.x - this._at.x
    const dy = focus.y - this._at.y
    const dz = focus.z - this._at.z
    const away = Math.hypot(dx, dy, dz)
    if (dt <= 0) return null
    this._clock += dt
    this.tail.rotation.y = Math.sin((this._clock * Math.PI * 2) / TAIL_PERIOD) * TAIL_SWAY
    this.tail.rotation.x = Math.sin((this._clock * Math.PI * 2) / (TAIL_PERIOD * 0.7)) * TAIL_NOD
    if (this._state === 'leaping') {
      this._leap(dt)
      return null
    }
    if (away < LEAP_WITHIN) {
      this._leapAway(dx, dz, focus)
      return null
    }
    this._look(dt, dx, dy + EYE, dz)
    if (!this._meowed && away < MEOW_WITHIN) {
      this._meowed = true
      return 'meow'
    }
    return null
  }

  /** The head follows the runner's head, within what a neck does. */
  _look(dt, dx, dy, dz) {
    const cos = Math.cos(this._yaw)
    const sin = Math.sin(this._yaw)
    const across = dx * cos - dz * sin
    const ahead = dx * sin + dz * cos
    const yaw = THREE.MathUtils.clamp(Math.atan2(across, ahead), -LOOK_YAW, LOOK_YAW)
    // A positive turn about X is nose down.
    const pitch = THREE.MathUtils.clamp(-Math.atan2(dy, Math.hypot(across, ahead)), -LOOK_PITCH, LOOK_PITCH)
    const k = Math.min(1, LOOK_EASE * dt)
    this._lookYaw += (yaw - this._lookYaw) * k
    this._lookPitch += (pitch - this._lookPitch) * k
    this.head.rotation.set(this._lookPitch, this._lookYaw, 0)
  }

  // Off, away from him at (`dx`, `dz`) from it, to the floor in reach of a hop that turns least
  // from straight away, its midway floored too: along the ledge it sits on if it can (a cat on a
  // parapet stays on the parapet, in view), else down off it, never over a void.
  _leapAway(dx, dz, focus) {
    const straight = dx * dx + dz * dz < 1e-6 ? this._yaw : Math.atan2(-dx, -dz)
    this._lands = false
    for (const [up, down] of [[HOP_LEVEL, HOP_LEVEL], [HOP_UP, HOP_DOWN]]) {
      for (const turn of HOP_TURNS) {
        const yaw = straight + turn
        const x = this._at.x + Math.sin(yaw) * HOP
        const z = this._at.z + Math.cos(yaw) * HOP
        const floor = this._floorAt(x, this._at.y + up, z)
        const midway = this._floorAt(this._at.x + Math.sin(yaw) * HOP * 0.5, this._at.y + up, this._at.z + Math.cos(yaw) * HOP * 0.5)
        if (this._at.y - floor > down || this._at.y - midway > down) continue
        this._leapTo.set(x, floor, z)
        // Side-on to him, of the two ways the one nearer the way it hopped.
        const toHim = Math.atan2(focus.x - x, focus.z - z)
        const off = (a) => Math.abs(Math.atan2(Math.sin(a - yaw), Math.cos(a - yaw)))
        this._landYaw = off(toHim + Math.PI / 2) < off(toHim - Math.PI / 2) ? toHim + Math.PI / 2 : toHim - Math.PI / 2
        this._lands = true
        break
      }
      if (this._lands) break
    }
    if (!this._lands) {
      this._leapTo.set(this._at.x - (dx / Math.hypot(dx, dz) || 0) * LEAP_OUT, this._at.y - LEAP_DROP, this._at.z - (dz / Math.hypot(dx, dz) || 0) * LEAP_OUT)
    }
    this._state = 'leaping'
    this._leapT = 0
    this._leapFrom.copy(this._at)
    _away.subVectors(this._leapTo, this._leapFrom)
    this.group.rotation.y = Math.atan2(_away.x, _away.z)
    this.head.rotation.set(0, 0, 0)
  }

  _leap(dt) {
    this._leapT = Math.min(1, this._leapT + dt / LEAP_TIME)
    const t = this._leapT
    this.group.position.lerpVectors(this._leapFrom, this._leapTo, t)
    this.group.position.y += LEAP_PEAK * Math.sin(Math.PI * t)
    this.group.rotation.x = -0.5 * Math.cos(Math.PI * t) // up through the jump, nose down at the end
    if (t < 1) return
    if (!this._lands) {
      this._state = 'gone'
      this.group.visible = false
      this.group.rotation.x = 0
      return
    }
    // Landed: side-on to him, it looks round and watches him again, from a little further off.
    this._at.copy(this._leapTo)
    this._yaw = this._landYaw
    this._lookYaw = this._lookPitch = 0
    this._settle()
  }
}
