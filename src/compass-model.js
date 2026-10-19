// The courier's compass as it is seen and heard: a piece of a wall mosaic broken out of the
// megastructure, a dial set into the hole in it, carried in the left palm (`Smoker.carry`). Look
// and sound only; what each part points at and when it is held up are `compass.js`'s.
//
// Each part has its own shape and its own way of moving, so it is learnt without a label:
// - the bent bit of rebar on the dial, an ember at its end: the route, to whoever the story sends
//   him to. Swings on a spring and settles with a little lag after a turn; its tip comes out of
//   the dial for a goal above and sinks for one below. With no route it wanders, its ember dull.
// - the hook of rusted wire on a bolt at the lower left: the nearest match. It moves in dry
//   ticks, quicker and with a tremor as the box nears; with none left it hangs down.
// - the grimy gull feather wired to the bar out of the top: the nearest feather. It turns
//   smoothly, flutters as one nears; with none left it droops and is still.
//
// Built as the mockup was drawn (`mockups/compass-slab.html`, 3.2): facing +Z, ahead up (+Y).
// `root` turns that to what the hand expects, face up and ahead toward -Z.

import * as THREE from 'three'
import { brokenPaint, ironPaint, mosaicPaint, noise, painted, paperPaint, rustPaint } from './painted.js'

const SIZE = 1.4 // the whole piece, over its modelled 0.15 m: a fifth of the view's height when held up
// The route bar: a spring with a little overshoot, so a turn of the head is seen to settle.
const NEEDLE_STIFFNESS = 26
const NEEDLE_DAMPING = 6
const WANDER = [1.3, 0.31, 0.6, 0.83] // with no route: two slow swings, amplitude and rate each
// The hook's ticks: seconds between them far off and close by, and the most a tick turns.
const TICK_FAR = 0.5
const TICK_NEAR = 0.08
const TICK_TURN = 0.22
const TREMOR = 0.05 // radians of shiver at its closest
const HOOK_REST = Math.PI // hanging down
// The feather: how fast it follows, how much it flutters, where it rests with nothing to follow.
const FEATHER_STIFFNESS = 20
const FEATHER_DAMPING = 4
const FLUTTER = 0.12
const FEATHER_LEAN = -0.4 // it leans out over the slab's corner
const NEAR = 40 // metres at which a part begins to quicken
const RISE_SPAN = 15 // metres up or down at which a height cue is full
const RISE_TILT = 0.45 // radians the route bar leans out of the dial at a full height cue

const BIG = 100000 // a noise period too long to repeat on anything this size
const n3 = (x, y, z) => (noise(x, y, BIG) + noise(y + 31.7, z, BIG) + noise(z + 17.3, x + 5.1, BIG)) / 3

// Painted once, the first time a compass is made.
let paints = null
function paint() {
  if (paints) return paints
  const mosaic = painted(mosaicPaint, { size: 512, relief: 5, metal: 0.1, glow: 0.3 })
  for (const t of [mosaic.map, mosaic.normalMap, mosaic.roughnessMap]) {
    t.repeat.set(1 / 0.18, 1 / 0.18) // once across the piece's face
    t.offset.set(0.5, 0.5)
  }
  paints = {
    mosaic,
    broken: painted(brokenPaint, { size: 512, relief: 12, repeat: 6, glow: 0.2 }),
    rust: painted(rustPaint, { relief: 6, repeat: 30, metal: 0.2, glow: 0.15 }),
    iron: painted(ironPaint, { relief: 6, repeat: 10, metal: 0.3, glow: 0.12 }),
    paper: painted(paperPaint, { relief: 2, repeat: 12, glow: 0.35 }),
    feather: painted(paperPaint, { relief: 3, repeat: 20, glow: 0.35, side: THREE.DoubleSide }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a050, metalness: 0.45, roughness: 0.35, emissive: 0x3a2a10, emissiveIntensity: 0.6 }),
    ink: new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 0.95 }),
    paint: new THREE.MeshStandardMaterial({ color: 0xb02a14, roughness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false }),
    ember: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff6a1a).multiplyScalar(1.4) }),
  }
  return paints
}
const EMBER_LIT = new THREE.Color(0xff6a1a).multiplyScalar(1.4)
const EMBER_DULL = new THREE.Color(0x5a2410)

const mesh = (geometry, material, x = 0, y = 0, z = 0) => {
  const part = new THREE.Mesh(geometry, material)
  part.position.set(x, y, z)
  return part
}
const tube = (points, radius, material) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), 24, radius, 6, false), material)
const bolt = (material, x, y, z) => mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.003, 6).rotateX(Math.PI / 2), material, x, y, z)

/**
 * A slab broken out of a wall: `points` its outline in XY, `depth` thick toward +Z. The outline is
 * cut into short steps and every corner pushed about by noise, so the edges are torn and the
 * sides crumble. `hole` is a circle `[x, y, r]` through it. The face takes `face`, the sides `side`.
 */
function broken(points, depth, face, side, hole, jag = 0.0035) {
  const torn = []
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % points.length]
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.004))
    for (let k = 0; k < steps; k++) {
      const x = x0 + ((x1 - x0) * k) / steps, y = y0 + ((y1 - y0) * k) / steps
      const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny)
      const j = (noise(x * 300 + 7, y * 300, BIG) - 0.5) * jag * 2
      torn.push(new THREE.Vector2(x + (nx / l) * j, y + (ny / l) * j))
    }
  }
  const shape = new THREE.Shape(torn)
  const [hx, hy, hr] = hole
  const circle = new THREE.Path()
  circle.absarc(hx, hy, hr, 0, Math.PI * 2, true)
  shape.holes.push(circle)
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 5, bevelEnabled: false, curveSegments: 20 })
  const pos = geometry.attributes.position
  const k = 160
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    if (Math.hypot(x - hx, y - hy) < hr + 0.002) continue // the hole was cut clean for the dial
    pos.setXYZ(i, x + (n3(x * k, y * k, z * k) - 0.5) * jag * 1.6, y + (n3(y * k + 9, z * k, x * k) - 0.5) * jag * 1.6, z + (n3(z * k + 3, x * k, y * k) - 0.5) * jag * 0.8)
  }
  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, [face, side])
}

// A ribbed bar along `points`, its ribs at a slant every few millimetres.
function rebar(points, material, radius = 0.0026) {
  const group = new THREE.Group()
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 8, false), material))
  const ribs = Math.floor(curve.getLength() / 0.0045)
  const rib = new THREE.TorusGeometry(radius * 1.05, radius * 0.28, 4, 10)
  const along = new THREE.Vector3(), z = new THREE.Vector3(0, 0, 1)
  for (let i = 1; i < ribs; i++) {
    const t = i / ribs
    const part = new THREE.Mesh(rib, material)
    part.position.copy(curve.getPointAt(t))
    part.quaternion.setFromUnitVectors(z, curve.getTangentAt(t, along))
    part.rotateX(0.35)
    group.add(part)
  }
  return group
}

// The dial: foxed paper, uneven ticks, a shallow glass over it, facing +Z.
function dial(radius, P) {
  const group = new THREE.Group()
  group.add(mesh(new THREE.CylinderGeometry(radius, radius, 0.002, 40).rotateX(Math.PI / 2), P.paper))
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, long = i % 6 === 0, r = radius * (long ? 0.83 : 0.88)
    const tick = mesh(new THREE.BoxGeometry(0.0012, long ? radius * 0.22 : radius * 0.1, 0.0008), P.ink, Math.sin(a) * r, Math.cos(a) * r, 0.0012)
    tick.rotation.z = -a
    group.add(tick)
  }
  const dome = mesh(new THREE.SphereGeometry(radius * 1.6, 32, 8, 0, Math.PI * 2, 0, 0.66), P.glass, 0, 0, -radius * 1.6 * Math.cos(0.66) + 0.008)
  dome.rotation.x = Math.PI / 2
  group.add(dome)
  return group
}

// A feather up (+Y) from its quill, flat toward the eye, with three turns of wire round the quill.
function wiredFeather(length, P) {
  const s = length
  const tie = new THREE.Group()
  const outline = [[0, 0], [0.13, 0.22], [0.17, 0.55], [0.1, 0.85], [0.02, 1], [-0.08, 0.86], [-0.11, 0.6], [-0.07, 0.4], [-0.12, 0.3], [-0.09, 0.15]]
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x * s, y * s)))
  tie.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.0015, bevelEnabled: false }), P.feather))
  tie.add(mesh(new THREE.CylinderGeometry(0.0012, 0.0006, s, 5), P.ink, 0, s / 2, 0.002))
  for (let i = 0; i < 3; i++) tie.add(mesh(new THREE.TorusGeometry(0.0028, 0.0006, 4, 8).rotateX(Math.PI / 2), P.iron, 0, 0.003 + i * 0.0018, 0.001))
  return tie
}

const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))
const closeness = (reading) => (reading ? THREE.MathUtils.clamp(1 - reading.distance / NEAR, 0, 1) : 0)
const tilt = (reading) => (reading ? THREE.MathUtils.clamp(reading.rise / RISE_SPAN, -1, 1) : 0)

// The instrument's voice: a few dry sounds made on the spot, no files.
class CompassVoice {
  constructor(loudness) {
    this._loudness = loudness
    this._audio = null
  }

  // A burst of noise through a band: `pitch` Hz, `length` seconds, at `level` of the player's volume.
  _burst(pitch, length, level, q = 6) {
    const loud = this._loudness() * level
    if (loud <= 0) return
    try {
      this._audio ??= new AudioContext()
      if (this._audio.state === 'suspended') this._audio.resume()
      const audio = this._audio
      const samples = Math.ceil(audio.sampleRate * length)
      const buffer = audio.createBuffer(1, samples, audio.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / samples) ** 3
      const source = audio.createBufferSource()
      source.buffer = buffer
      const filter = audio.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = pitch
      filter.Q.value = q
      const gain = audio.createGain()
      gain.gain.value = loud
      source.connect(filter).connect(gain).connect(audio.destination)
      source.start()
    } catch { /* no audio here: the compass is seen all the same */ }
  }

  tick() { this._burst(3800, 0.018, 0.08) }
  flutter() { this._burst(6500, 0.12, 0.05, 1.2) }
  clack() { this._burst(1400, 0.04, 0.12, 3) }
}

export class CompassModel {
  /** `loudness`: a function giving the player's volume, 0 to 1, for its sounds. */
  constructor(loudness) {
    const P = paint()
    this.root = new THREE.Group()
    this.root.scale.setScalar(SIZE)
    const face = new THREE.Group()
    face.rotation.x = -Math.PI / 2 // facing +Z, ahead +Y, as modelled → face up, ahead -Z
    this.root.add(face)

    const outline = [[-0.07, -0.04], [-0.05, -0.058], [-0.01, -0.05], [0.03, -0.06], [0.064, -0.042], [0.074, -0.01], [0.06, 0.02], [0.07, 0.046], [0.03, 0.058], [-0.004, 0.05], [-0.04, 0.062], [-0.074, 0.04], [-0.062, 0.008]]
    face.add(broken(outline, 0.024, P.mosaic, P.broken, [0, -0.004, 0.032]).translateZ(-0.018))
    const plate = dial(0.032, P)
    plate.position.set(0, -0.004, -0.006)
    face.add(plate)
    const bezel = new THREE.Shape()
    bezel.absarc(0, 0, 0.035, 0, Math.PI * 2, false)
    const inner = new THREE.Path()
    inner.absarc(0, 0, 0.031, 0, Math.PI * 2, true)
    bezel.holes.push(inner)
    face.add(mesh(new THREE.ExtrudeGeometry(bezel, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1, curveSegments: 24 }), P.brass, 0, -0.004, 0.004))
    face.add(rebar([[0.04, 0.05, -0.01], [0.044, 0.07, -0.008], [0.06, 0.084, -0.002]], P.rust), rebar([[-0.06, -0.044, -0.01], [-0.082, -0.06, -0.006]], P.rust))

    // The route: a bent rebar end with a ring of red paint and the ember, on an iron pin.
    this._bar = new THREE.Group()
    this._bar.position.set(0, -0.004, -0.002)
    this._bar.add(tube([[0, -0.008, 0], [0, 0.0126, 0.001], [0.004, 0.0266, 0.002]], 0.0018, P.rust))
    this._bar.add(mesh(new THREE.TorusGeometry(0.002, 0.0009, 4, 10).rotateX(Math.PI / 2), P.paint, 0.0008, 0.0168, 0.0012))
    this._ember = mesh(new THREE.SphereGeometry(0.0042, 12, 10), P.ember, 0.004, 0.028, 0.002)
    this._bar.add(this._ember, mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.004, 6).rotateX(Math.PI / 2), P.iron))
    // The match's: a hook of rusted wire on a bolt.
    this._hook = new THREE.Group()
    this._hook.position.set(-0.048, -0.04, 0.007)
    this._hook.add(tube([[0, 0, 0], [0, 0.016, 0.002], [0.006, 0.027, 0.003], [0.013, 0.023, 0.003], [0.012, 0.015, 0.002]], 0.0012, P.rust), bolt(P.iron, 0, 0, 0))
    // The feather's: wired to the top bar's end.
    this._feather = wiredFeather(0.05, P)
    this._feather.position.set(0.06, 0.084, -0.002)
    face.add(this._bar, this._hook, this._feather)
    this.voice = new CompassVoice(loudness)

    this._time = 0
    this._angle = 0 // the route bar's, relative to the view; and its turn rate
    this._spin = 0
    this._hookAngle = HOOK_REST
    this._tickIn = 0
    this._featherAngle = 0
    this._featherRate = 0
  }

  /** Arrives at rest at once: taken out again, it swings to its bearings. */
  settle() {
    this._spin = this._featherRate = 0
  }

  /**
   * One frame of `dt`. `readings` has `route`, `match` and `feather`, each null or
   * `{ bearing, distance, rise }`: the world yaw toward it (as `lookYaw` turns), metres to it,
   * metres up to it. `yaw` is the view's. `shown`, 0 to 1, is how far up it is held: the hook's
   * ticks are heard only once it can be seen.
   */
  present(dt, readings, yaw, shown) {
    this._time += dt
    const t = this._time
    const { route, match, feather } = readings

    // The route bar, on its spring toward the bearing; wandering with none.
    const want = route ? wrap(route.bearing - yaw) : WANDER[0] * Math.sin(t * WANDER[1]) + WANDER[2] * Math.sin(t * WANDER[3])
    this._spin += (wrap(want - this._angle) * NEEDLE_STIFFNESS - this._spin * NEEDLE_DAMPING) * dt
    this._angle = wrap(this._angle + this._spin * dt)
    this._bar.rotation.set(tilt(route) * RISE_TILT, 0, this._angle)
    this._ember.material.color.copy(route ? EMBER_LIT : EMBER_DULL)
    this._ember.scale.setScalar(route ? 1 + 0.08 * Math.sin(t * 7) : 0.85) // it breathes while it has somewhere to point

    // The hook, in dry ticks toward the nearest match; hanging down with none.
    const near = closeness(match)
    this._tickIn -= dt
    if (this._tickIn <= 0) {
      this._tickIn = match ? THREE.MathUtils.lerp(TICK_FAR, TICK_NEAR, near) : TICK_FAR
      const aim = match ? wrap(match.bearing - yaw) : HOOK_REST
      const step = THREE.MathUtils.clamp(wrap(aim - this._hookAngle), -TICK_TURN, TICK_TURN)
      if (Math.abs(step) > 0.01 || match) {
        this._hookAngle = wrap(this._hookAngle + step)
        if (match && shown > 0.6) this.voice.tick()
      }
    }
    this._hook.rotation.z = this._hookAngle + (match ? TREMOR * near * near * Math.sin(t * 70) : 0)

    // The feather, turning smoothly toward the nearest feather and fluttering as it nears.
    const lift = closeness(feather)
    const toward = feather ? wrap(feather.bearing - yaw) * 0.7 + FEATHER_LEAN : FEATHER_LEAN
    this._featherRate += (wrap(toward - this._featherAngle) * FEATHER_STIFFNESS - this._featherRate * FEATHER_DAMPING) * dt
    this._featherAngle = wrap(this._featherAngle + this._featherRate * dt)
    const flutter = feather ? FLUTTER * (0.25 + lift) * (Math.sin(t * 17) * 0.6 + Math.sin(t * 5.3) * 0.4) : 0
    this._feather.rotation.set(feather ? 0 : 0.9, 0, this._featherAngle + flutter)
  }
}
