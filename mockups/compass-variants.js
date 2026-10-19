// Four compass concepts side by side, one each, in the game's cel paint under amber light.
// Each lies as it would in the left palm: face up (+Y), "ahead" toward -Z, tilted to the eye.
// The demo targets turn slowly so every part is seen to point and to react to nearness.
import * as THREE from 'three'
import { celMaterial } from '../src/shading.js'

const paint = (color, emissive = 0x000000, extra = {}) => celMaterial({ color, emissive, flatShading: true, ...extra })
const glow = (color) => new THREE.MeshBasicMaterial({ color })
const P = {
  red: paint(0xd0321f, 0x3a0a04),
  redDark: paint(0x8e1d12, 0x1e0503),
  brass: paint(0xd8a838, 0x3a2808),
  brassDark: paint(0x8a6420, 0x1a1204),
  cream: paint(0xf2e6c8, 0x4a4434),
  bone: paint(0xe8dcc0, 0x3a3428),
  ink: paint(0x1b1612),
  blue: paint(0x2f6fd0, 0x0a1a38),
  sky: paint(0x7fb6e6, 0x1a2a3a),
  wood: paint(0xe2c48a, 0x3a2c14),
  char: paint(0x221b17),
  white: paint(0xf6f4ee, 0x5a5850, { side: THREE.DoubleSide }),
  grey: paint(0x7a8492, 0x1a1c20),
  concrete: paint(0xd9cdb4, 0x2e2a22),
  rubber: paint(0x3b6b3a, 0x0c180c),
  strike: paint(0x6b3a22, 0x140a06),
}
const FLAME_OUT = glow(0xffb02a)
const FLAME_IN = glow(0xfff2c0)
const EMBER = glow(0xff5a1a)

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const part = new THREE.Mesh(geometry, material)
  part.position.set(x, y, z)
  return part
}
const box = (w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z)
const cyl = (r0, r1, h, m, x, y, z, seg = 12) => mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m, x, y, z)
const ball = (r, m, x, y, z) => mesh(new THREE.SphereGeometry(r, 10, 8), m, x, y, z)
// A flat outline lying in the XZ plane, `thick` up, from points (x, ahead) where ahead is -Z.
function plate(points, thick, m) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))
  return new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false }).rotateX(-Math.PI / 2), m)
}
// A feather lying along -Z from its quill at the origin, `length` long.
function feather(length, m = P.white) {
  const s = length
  const group = new THREE.Group()
  group.add(plate([[0, 0], [0.12 * s, 0.25 * s], [0.16 * s, 0.6 * s], [0.08 * s, 0.92 * s], [0, s], [-0.1 * s, 0.75 * s], [-0.12 * s, 0.35 * s]], 0.002, m))
  group.add(box(0.0018, 0.003, s, P.ink, 0, 0.002, -s / 2))
  return group
}
// A flame on its wick: an outer glow round a hot core, standing up +Y.
function flame(height) {
  const profile = (scale) => {
    const points = []
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      points.push(new THREE.Vector2(Math.sin(Math.PI * Math.pow(t, 0.7)) * 0.28 * height * scale * (1 - t * 0.35), t * height * scale))
    }
    return new THREE.LatheGeometry(points, 10)
  }
  const group = new THREE.Group()
  group.add(new THREE.Mesh(profile(1), FLAME_OUT), new THREE.Mesh(profile(0.6), FLAME_IN))
  return group
}
// A brass ring with a scalloped outer edge and a round hole between each two scallops: the
// fretwork that makes the instrument look made by hand rather than assembled.
function fretRing(inner, outer, petals, thick, m) {
  const shape = new THREE.Shape()
  const steps = petals * 12
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const r = outer - (outer - inner) * 0.28 * (1 - Math.abs(Math.sin((a * petals) / 2)))
    const x = Math.cos(a) * r, y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  const hole = new THREE.Path()
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const middle = inner + (outer - inner) * 0.5
  for (let i = 0; i < petals; i++) {
    const a = ((i + 0.5) / petals) * Math.PI * 2
    const pin = new THREE.Path()
    pin.absarc(Math.cos(a) * middle, Math.sin(a) * middle, (outer - inner) * 0.16, 0, Math.PI * 2, true)
    shape.holes.push(pin)
  }
  return new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 6 }).rotateX(-Math.PI / 2), m)
}
// A gear: `teeth` square teeth, spokes cut through, lying flat.
function gear(radius, teeth, thick, m) {
  const shape = new THREE.Shape()
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2
    const r = i % 4 < 2 ? radius : radius * 0.84
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4
    const cut = new THREE.Path()
    cut.absarc(Math.cos(a) * radius * 0.5, Math.sin(a) * radius * 0.5, radius * 0.2, 0, Math.PI * 2, true)
    shape.holes.push(cut)
  }
  return new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2), m)
}
const GLASS = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false })
// A glass over a dial: a shallow dome, and the streak of light that says it is glass.
function glass(radius, y) {
  const group = new THREE.Group()
  group.add(mesh(new THREE.SphereGeometry(radius, 24, 8, 0, Math.PI * 2, 0, 0.5), GLASS, 0, y - radius * Math.cos(0.5), 0))
  const streak = mesh(new THREE.TorusGeometry(radius * 0.62, radius * 0.035, 3, 16, 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }), 0, y + radius * 0.02, 0)
  streak.rotation.set(Math.PI / 2, 0, 2.2)
  group.add(streak)
  return group
}
// An engraved dial: a disc, uneven ticks round it and a spiral wound into it.
function dial(radius, m = P.cream) {
  const group = new THREE.Group()
  group.add(cyl(radius, radius, 0.002, m, 0, 0, 0, 32))
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const long = i % 6 === 0
    group.add(box(0.0012, 0.0008, long ? radius * 0.22 : radius * 0.1, P.ink, Math.sin(a) * radius * (long ? 0.84 : 0.88), 0.0012, -Math.cos(a) * radius * (long ? 0.84 : 0.88)).rotateY(-a))
  }
  const points = []
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, a = t * Math.PI * 6, r = radius * (0.08 + t * 0.55)
    points.push(new THREE.Vector3(Math.cos(a) * r, 0.0012, Math.sin(a) * r))
  }
  group.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 90, 0.0006, 3, false), P.ink))
  return group
}

// A label for the matchbox, drawn as a Soviet match label: one bold picture, two colours and a band.
function labelTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 360
  const c = canvas.getContext('2d')
  c.fillStyle = '#f3c21c'
  c.fillRect(0, 0, 512, 360)
  c.fillStyle = '#d0321f'
  for (let i = 0; i < 16; i++) {
    c.beginPath()
    c.moveTo(256, 230)
    c.arc(256, 230, 420, (i / 16) * Math.PI * 2, (i / 16 + 1 / 32) * Math.PI * 2)
    c.fill()
  }
  c.fillStyle = '#f3c21c'
  c.beginPath(); c.arc(256, 230, 70, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#ffffff'
  c.beginPath() // a gull, wings up
  c.moveTo(150, 170); c.quadraticCurveTo(210, 110, 256, 175); c.quadraticCurveTo(302, 110, 362, 170)
  c.quadraticCurveTo(300, 140, 256, 200); c.quadraticCurveTo(212, 140, 150, 170); c.fill()
  c.fillStyle = '#1c3f8a'
  c.fillRect(0, 300, 512, 60)
  c.fillStyle = '#ffffff'
  c.font = 'bold 44px system-ui, sans-serif'
  c.textAlign = 'center'
  c.fillText('СПИЧКИ', 256, 346)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Whatever the variant, the same three readings: a bearing relative to the view (radians,
// left positive) and a nearness 0 to 1 for the matchbox and the feather.
function demo(t) {
  return {
    route: 1.1 * Math.sin(t * 0.4),
    matchbox: -0.8 + 1.5 * Math.sin(t * 0.27), matchNear: 0.5 + 0.5 * Math.sin(t * 0.5),
    feather: 2 * Math.sin(t * 0.21), featherNear: 0.5 + 0.5 * Math.sin(t * 0.33 + 1),
  }
}
const ahead = (rel, out = new THREE.Vector3()) => out.set(-Math.sin(rel), 0, -Math.cos(rel))
const UP = new THREE.Vector3(0, 1, 0)
const _lean = new THREE.Vector3()

// 1 · A red enamel table lighter worn as a compass. On its face a dial under glass in a fretted
// brass bezel, a small flame-shaped hand on it; on top the real flame leans toward the route.
// A train of three gears down its side turns in ticks toward a matchbox, quicker when near; a
// feather on a post at the lid's corner turns to a feather.
function lighter() {
  const root = new THREE.Group()
  root.add(box(0.07, 0.03, 0.1, P.red, 0, 0, 0)) // lying on its back, its top ahead
  root.add(box(0.072, 0.032, 0.01, P.brass, 0, 0, 0.046), box(0.072, 0.032, 0.006, P.brass, 0, 0, -0.03))
  const face = new THREE.Group()
  face.position.set(0, 0.016, 0.012)
  face.add(fretRing(0.024, 0.034, 10, 0.003, P.brass), dial(0.024))
  const hand = plate([[0, 0.02], [0.004, 0.008], [0.003, -0.002], [0, -0.005], [-0.003, -0.002], [-0.004, 0.008]], 0.0015, P.red)
  hand.position.y = 0.0022
  face.add(hand, cyl(0.0025, 0.0025, 0.004, P.brass, 0, 0.003, 0), glass(0.024, 0.004))
  root.add(face)
  const chimney = new THREE.Group()
  chimney.position.set(0, 0, -0.064)
  chimney.add(box(0.046, 0.028, 0.03, P.brass, 0, 0, 0))
  for (const x of [-0.014, 0, 0.014]) for (const z of [-0.008, 0.004]) chimney.add(cyl(0.0034, 0.0034, 0.002, P.ink, x, 0.0141, z))
  root.add(chimney)
  const gears = []
  for (const [x, z, r, n] of [[0.04, -0.06, 0.011, 12], [0.044, -0.04, 0.008, 9], [0.042, -0.024, 0.006, 7]]) {
    const g = gear(r, n, 0.003, P.brassDark)
    g.rotation.z = Math.PI / 2
    g.position.set(x, 0, z)
    root.add(g)
    gears.push({ g, r })
  }
  const lid = new THREE.Group() // hinged at the right, flipped open behind the top
  lid.position.set(0.035, 0, -0.08)
  lid.rotation.y = -0.9
  lid.add(box(0.07, 0.03, 0.04, P.red, -0.035, 0, -0.02), box(0.072, 0.032, 0.006, P.brass, -0.035, 0, 0.0))
  const vane = new THREE.Group()
  vane.position.set(-0.066, 0.015, -0.036)
  vane.add(cyl(0.002, 0.003, 0.03, P.brass, 0, 0.015, 0, 8), ball(0.004, P.brass, 0, 0.03, 0))
  const quill = new THREE.Group()
  quill.position.y = 0.032
  quill.add(feather(0.055))
  vane.add(quill)
  lid.add(vane)
  root.add(lid)
  const fire = flame(0.075)
  fire.position.set(0, 0.008, -0.068)
  root.add(fire)
  let turn = 0, shown = 0, tick = 0
  return {
    root, tilt: 0.9, distance: 0.47, shift: 0.02, drop: 0.04,
    animate(t, dt, d) {
      _lean.copy(ahead(d.route)).multiplyScalar(0.9).add(UP).normalize()
      fire.quaternion.setFromUnitVectors(UP, _lean)
      fire.scale.setScalar(1 + 0.06 * Math.sin(t * 23) + 0.04 * Math.sin(t * 9))
      hand.rotation.y = d.route
      tick -= dt
      if (tick <= 0) { tick = 0.5 - 0.42 * d.matchNear; turn += Math.sign(Math.sin(d.matchbox)) * 0.5 }
      shown += (turn - shown) * Math.min(1, dt * 30)
      gears.forEach(({ g, r }, i) => { g.rotation.x = (i % 2 ? -1 : 1) * shown * (0.011 / r) })
      quill.rotation.y = d.feather + 0.15 * d.featherNear * Math.sin(t * 15)
    },
  }
}

// 2 · A big matchbox, its drawer pulled out. In the drawer, under glass in a fretted brass ring,
// a burnt match is the route needle, its ember lit; a brass trident with three red heads ticks on
// the label toward a matchbox; a gull feather pushed under the rubber band turns toward a feather.
function matchbox() {
  const root = new THREE.Group()
  const label = new THREE.MeshToonMaterial({ map: labelTexture() })
  label.map.rotation = Math.PI / 2
  label.map.center.set(0.5, 0.5)
  const sleeve = new THREE.Group()
  sleeve.position.x = -0.032
  sleeve.add(box(0.08, 0.024, 0.11, P.cream, 0, 0, 0))
  sleeve.add(mesh(new THREE.PlaneGeometry(0.078, 0.108).rotateX(-Math.PI / 2), label, 0, 0.0125, 0))
  sleeve.add(box(0.003, 0.02, 0.1, P.strike, -0.041, 0, 0))
  sleeve.add(box(0.082, 0.026, 0.008, P.rubber, 0, 0, 0.034))
  root.add(sleeve)
  const drawer = new THREE.Group()
  drawer.position.x = 0.042
  drawer.add(box(0.074, 0.003, 0.104, P.wood, 0, -0.01, 0))
  drawer.add(box(0.003, 0.018, 0.104, P.wood, 0.036, -0.002, 0))
  drawer.add(box(0.074, 0.018, 0.003, P.wood, 0, -0.002, 0.051), box(0.074, 0.018, 0.003, P.wood, 0, -0.002, -0.051))
  const face = new THREE.Group()
  face.position.y = -0.008
  face.add(dial(0.03), fretRing(0.03, 0.036, 12, 0.003, P.brass))
  const needle = new THREE.Group()
  needle.position.y = 0.004
  needle.add(box(0.004, 0.004, 0.05, P.wood, 0, 0, -0.006))
  const head = ball(0.0055, P.char, 0, 0, -0.033)
  head.scale.set(1, 1, 1.5)
  const ember = ball(0.0034, EMBER, 0, 0.001, -0.038)
  needle.add(head, ember, cyl(0.004, 0.004, 0.004, P.brass, 0, 0, 0))
  face.add(needle, glass(0.03, 0.009))
  drawer.add(face)
  const spare = gear(0.01, 10, 0.003, P.brassDark) // a spare wheel lying in the corner, turning
  spare.position.set(0.024, -0.008, 0.04)
  drawer.add(spare)
  root.add(drawer)
  const trident = new THREE.Group()
  trident.position.set(-0.034, 0.013, -0.01)
  trident.add(fretRing(0.003, 0.009, 6, 0.002, P.brass))
  const fork = new THREE.Group()
  fork.add(box(0.003, 0.003, 0.028, P.brass, 0, 0.003, -0.014))
  fork.add(box(0.024, 0.003, 0.003, P.brass, 0, 0.003, -0.028))
  for (const x of [-0.011, 0, 0.011]) fork.add(box(0.0022, 0.0022, 0.014, P.wood, x, 0.003, -0.036), ball(0.0036, P.red, x, 0.003, -0.044))
  trident.add(fork)
  root.add(trident)
  const tucked = new THREE.Group()
  tucked.position.set(-0.064, 0.014, 0.034)
  tucked.add(feather(0.07))
  root.add(tucked)
  let aim = 0, tick = 0
  return {
    root, tilt: 0.95, distance: 0.36, shift: 0,
    animate(t, dt, d) {
      needle.rotation.y += (d.route - needle.rotation.y) * Math.min(1, dt * 4)
      ember.material.color.setHex(Math.sin(t * 7) > 0.3 ? 0xff7a2a : 0xff4a10)
      tick -= dt
      if (tick <= 0) { tick = 0.5 - 0.42 * d.matchNear; aim += THREE.MathUtils.clamp(d.matchbox - aim, -0.25, 0.25) }
      fork.rotation.y = aim + 0.04 * d.matchNear * d.matchNear * Math.sin(t * 60)
      spare.rotation.y = aim * 2
      tucked.rotation.y = d.feather * 0.6 + 0.6 + 0.12 * d.featherNear * Math.sin(t * 15)
    },
  }
}

// 3 · A white enamel gull on a brass column over a blue enamel dial in a fretted brass ring,
// wings spread. Its beak turns to the route; the matchbox it carries in its beak on a string
// swings toward a matchbox; its one long tail feather turns toward a feather.
function gull() {
  const root = new THREE.Group()
  const base = new THREE.Group()
  base.position.y = -0.03
  base.add(cyl(0.05, 0.052, 0.008, P.blue, 0, 0, 0, 32), fretRing(0.05, 0.062, 14, 0.004, P.brass).translateY(-0.002))
  base.add(cyl(0.022, 0.03, 0.01, P.brass, 0, -0.008, 0, 16))
  for (let i = 0; i < 8; i++) base.add(plate([[0, 0.046], [0.0035, 0.034], [-0.0035, 0.034]], 0.002, i % 2 ? P.brass : P.white).rotateY(i * Math.PI / 4).translateY(0.004))
  const turning = gear(0.016, 14, 0.003, P.brass)
  turning.position.y = 0.004
  base.add(turning)
  root.add(base, cyl(0.0025, 0.0025, 0.04, P.brass, 0, -0.008, 0))
  const bird = new THREE.Group()
  bird.position.y = 0.016
  const body = ball(0.016, P.white, 0, 0, 0.004)
  body.scale.set(0.8, 0.75, 1.6)
  bird.add(body, ball(0.011, P.white, 0, 0.008, -0.026))
  bird.add(mesh(new THREE.ConeGeometry(0.004, 0.016, 6).rotateX(-Math.PI / 2), P.brass, 0, 0.006, -0.042), ball(0.002, P.red, 0, 0.004, -0.044))
  bird.add(ball(0.0018, P.ink, 0.008, 0.011, -0.03), ball(0.0018, P.ink, -0.008, 0.011, -0.03))
  for (const side of [-1, 1]) {
    const w = new THREE.Group()
    w.position.set(side * 0.01, 0.006, 0)
    w.add(plate([[0, 0.012], [side * 0.03, 0.016], [side * 0.062, 0.004], [side * 0.08, -0.008], [side * 0.05, -0.012], [side * 0.02, -0.014], [0, -0.012]], 0.003, P.white))
    w.add(plate([[side * 0.062, 0.004], [side * 0.08, -0.008], [side * 0.06, -0.01]], 0.0035, P.ink))
    w.rotation.z = side * 0.12
    bird.add(w)
  }
  const tail = new THREE.Group()
  tail.position.set(0, 0.004, 0.026)
  const plume = feather(0.05)
  plume.rotation.y = Math.PI // it trails behind
  tail.add(plume)
  bird.add(tail)
  const hang = new THREE.Group()
  hang.position.set(0, 0.004, -0.048)
  hang.add(box(0.0008, 0.024, 0.0008, P.ink, 0, -0.012, 0))
  const carried = new THREE.Group()
  carried.position.y = -0.026
  carried.add(box(0.016, 0.008, 0.011, P.brass, 0, 0, 0), box(0.0165, 0.0085, 0.004, P.red, 0, 0, 0))
  hang.add(carried)
  bird.add(hang)
  root.add(bird)
  let angle = 0, spin = 0, swing = 0, swingRate = 0
  return {
    root, tilt: 0.6, distance: 0.32, shift: 0,
    animate(t, dt, d) {
      spin += ((d.route - angle) * 30 - spin * 6) * dt
      angle += spin * dt
      bird.rotation.y = angle
      turning.rotation.y = -angle * 3
      bird.position.y = 0.016 + 0.002 * Math.sin(t * 2)
      tail.rotation.y = d.feather - angle + Math.PI + 0.15 * d.featherNear * Math.sin(t * 15)
      const want = 0.35 * Math.sin(d.matchbox - angle) * (0.4 + d.matchNear)
      swingRate += ((want - swing) * 40 - swingRate * 3) * dt
      swing += swingRate * dt
      hang.rotation.z = swing
      hang.rotation.x = 0.2 * Math.cos(d.matchbox - angle) * d.matchNear
    },
  }
}

// 4 · A stepped monument: three square tiers set corner-on, cream concrete with red and sky-blue
// cornices, over a fretted brass sunburst. A red star on a gold arm turns on the spire for the
// route; a striker lever on the lowest tier's corner ticks toward a matchbox; a feather pennant
// flies from a mast on another; under it all a lead weight hangs from a chain.
function ziggurat() {
  const root = new THREE.Group()
  root.add(fretRing(0.06, 0.085, 16, 0.003, P.brass).translateY(-0.034))
  const tiers = [[0.08, 0.014, P.red], [0.058, 0.014, P.sky], [0.036, 0.016, P.red]]
  let y = -0.031
  for (const [size, height, cornice] of tiers) {
    const tier = new THREE.Group()
    tier.add(box(size, height, size, P.concrete, 0, 0, 0), box(size + 0.004, 0.003, size + 0.004, cornice, 0, height / 2 + 0.0015, 0))
    for (let i = 0; i < 4; i++) { // slit windows down each face
      const along = (i - 1.5) * size * 0.2
      tier.add(box(0.002, height * 0.5, 0.0005, P.ink, along, 0, size / 2 + 0.0003), box(0.0005, height * 0.5, 0.002, P.ink, size / 2 + 0.0003, 0, along))
    }
    tier.position.y = y + height / 2
    tier.rotation.y = Math.PI / 4
    root.add(tier)
    y += height + 0.003
  }
  root.add(cyl(0.004, 0.006, 0.02, P.brass, 0, y + 0.01, 0, 8))
  const arm = new THREE.Group()
  arm.position.y = y + 0.022
  arm.add(box(0.004, 0.003, 0.07, P.brass, 0, 0, -0.01))
  const star = []
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    const r = i % 2 ? 0.006 : 0.015
    star.push([Math.sin(a) * r, Math.cos(a) * r])
  }
  arm.add(plate(star, 0.004, P.red).translateZ(-0.05).translateY(-0.002))
  arm.add(ball(0.006, P.brass, 0, 0, 0.026), ball(0.004, P.brass, 0, 0, 0))
  root.add(arm)
  const lever = new THREE.Group()
  lever.position.set(0.058, -0.026, 0)
  lever.add(gear(0.007, 8, 0.004, P.brassDark))
  const striker = new THREE.Group()
  striker.add(box(0.004, 0.004, 0.034, P.brass, 0, 0.004, -0.017))
  for (let i = 0; i < 5; i++) striker.add(box(0.004, 0.003, 0.002, P.brass, 0.004, 0.004, -0.006 - i * 0.006))
  striker.add(ball(0.005, P.red, 0, 0.004, -0.036))
  lever.add(striker)
  root.add(lever)
  const mast = new THREE.Group()
  mast.position.set(-0.058, -0.028, 0)
  mast.add(cyl(0.0015, 0.0015, 0.06, P.brassDark, 0, 0.03, 0, 6), ball(0.003, P.brass, 0, 0.061, 0))
  const pennant = new THREE.Group()
  pennant.position.y = 0.056
  pennant.add(feather(0.045))
  mast.add(pennant)
  root.add(mast)
  const weight = new THREE.Group()
  weight.position.y = -0.034
  for (let i = 0; i < 3; i++) {
    const link = mesh(new THREE.TorusGeometry(0.003, 0.0009, 4, 8), P.ink, 0, -0.003 - i * 0.005, 0)
    link.rotation.y = i * Math.PI / 2
    weight.add(link)
  }
  weight.add(mesh(new THREE.ConeGeometry(0.009, 0.02, 4).rotateX(Math.PI), P.grey, 0, -0.026, 0))
  root.add(weight)
  let angle = 0, rate = 0, aim = 0, tick = 0
  return {
    root, tilt: 0.75, distance: 0.33, shift: 0,
    animate(t, dt, d) {
      rate += ((d.route - angle) * 30 - rate * 7) * dt
      angle += rate * dt
      arm.rotation.y = angle
      tick -= dt
      if (tick <= 0) { tick = 0.5 - 0.42 * d.matchNear; aim += THREE.MathUtils.clamp(d.matchbox - aim, -0.25, 0.25) }
      striker.rotation.y = aim + 0.05 * d.matchNear * d.matchNear * Math.sin(t * 60)
      lever.children[0].rotation.y = aim * 2
      pennant.rotation.y = d.feather + 0.2 * d.featherNear * Math.sin(t * 13)
      pennant.rotation.z = 0.15 * Math.sin(t * 5)
      weight.rotation.z = 0.12 * Math.sin(t * 1.3)
    },
  }
}

const MAKERS = { lighter, matchbox, gull, ziggurat }
const canvas = document.getElementById('c')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
renderer.setScissorTest(true)
const views = [...document.querySelectorAll('[data-variant]')].map((element) => {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xb7a68a)
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x5a4630, 1.6))
  const sun = new THREE.DirectionalLight(0xffd29a, 2.6)
  sun.position.set(-0.6, 1, 0.8)
  scene.add(sun)
  const variant = MAKERS[element.dataset.variant]()
  const holder = new THREE.Group()
  variant.root.position.z = variant.shift
  holder.add(variant.root)
  holder.rotation.x = variant.tilt
  holder.position.y = -(variant.drop ?? 0)
  scene.add(holder)
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 10)
  camera.position.set(0, 0, variant.distance)
  return { element, scene, camera, variant, holder }
})

let last = performance.now()
// `?t=` freezes the demo at that second, for a still.
const frozen = Number(new URLSearchParams(location.search).get('t'))
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  const t = frozen || now / 1000
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  const d = demo(t)
  for (const { element, scene, camera, variant, holder } of views) {
    const r = element.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    camera.aspect = r.width / r.height
    camera.updateProjectionMatrix()
    holder.rotation.y = 0.35 * Math.sin(t * 0.3)
    variant.animate(t, frozen ? 0.016 : dt, d)
    const bottom = window.innerHeight - r.bottom
    renderer.setViewport(r.left, bottom, r.width, r.height)
    renderer.setScissor(r.left, bottom, r.width, r.height)
    renderer.render(scene, camera)
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
