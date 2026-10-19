// What the cast and concrete compass mockups share: noise that tiles, surfaces painted from it
// into colour, relief (a normal map) and roughness, the paints, the shapes parts are made of, the
// demo readings the parts follow, and the sheet that draws each variant in its own cell. Every
// variant faces the eye (+Z) as held up in the palm; "ahead" is up (+Y), so a part pointing at a
// bearing turns about Z.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// --- Noise that tiles over `period` cells, and its sum over octaves.
export function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
export function noise(x, y, period) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const m = (n) => ((n % period) + period) % period
  const a = hash(m(xi), m(yi)), b = hash(m(xi + 1), m(yi)), c = hash(m(xi), m(yi + 1)), d = hash(m(xi + 1), m(yi + 1))
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
export function fbm(x, y, period, octaves = 5) {
  let sum = 0, amp = 0.5, freq = 1
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq, period * freq)
    amp *= 0.5
    freq *= 2
  }
  return sum
}
export const mix = (a, b, t) => a + (b - a) * t
export const clamp01 = (t) => Math.max(0, Math.min(1, t))
export const smooth = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x) }
export const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
export const blend = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)]

/**
 * A surface: `paint(x, y)` over a `period`-wide tiling square gives `[height 0..1, [r, g, b],
 * roughness 0..1]`. Returns the three textures, the relief turned into a normal map.
 */
export function surface(paint, { size = 512, period = 8, relief = 6 } = {}) {
  const heights = new Float32Array(size * size)
  const color = new ImageData(size, size), rough = new ImageData(size, size), normal = new ImageData(size, size)
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const [h, c, r] = paint((i / size) * period, (j / size) * period, period)
    const k = j * size + i
    heights[k] = h
    color.data.set([c[0], c[1], c[2], 255], k * 4)
    const g = Math.round(r * 255)
    rough.data.set([g, g, g, 255], k * 4)
  }
  const at = (i, j) => heights[((j + size) % size) * size + ((i + size) % size)]
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const dx = (at(i + 1, j) - at(i - 1, j)) * relief, dy = (at(i, j + 1) - at(i, j - 1)) * relief
    const len = Math.hypot(dx, dy, 1)
    normal.data.set([(-dx / len * 0.5 + 0.5) * 255, (dy / len * 0.5 + 0.5) * 255, (1 / len * 0.5 + 0.5) * 255, 255], (j * size + i) * 4)
  }
  const texture = (data, srgb) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    canvas.getContext('2d').putImageData(data, 0, 0)
    const t = new THREE.CanvasTexture(canvas)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }
  return { map: texture(color, true), normalMap: texture(normal, false), roughnessMap: texture(rough, false) }
}

// --- The paints.
// Cast bronze carved in close-set scrolls: narrow raised ridges that wander and curl, worn gold
// on their crests, black grime between, verdigris crusted in the low places. Every noise scale
// here is a whole number over the period, so the texture tiles.
export const bronzePaint = (x, y, p) => {
  const wx = fbm(x * 0.5 + 3, y * 0.5, p * 0.5, 4), wy = fbm(x * 0.5, y * 0.5 + 7, p * 0.5, 4)
  const flow = fbm(x + wx * 3, y + wy * 3, p, 4)
  const ridge = smooth(0.5, 0.92, Math.abs(Math.sin(flow * 16 * Math.PI)))
  const grain = fbm(x * 8, y * 8, p * 8, 3)
  const h = ridge * 0.8 + grain * 0.2
  let c = blend(rgb(0x0b0805), rgb(0x4d3a1f), smooth(0.08, 0.5, h))
  c = blend(c, rgb(0xc9994a), smooth(0.72, 0.98, h + (grain - 0.5) * 0.2))
  const crust = smooth(0.58, 0.7, fbm(x * 1.5 + 9, y * 1.5, p * 1.5, 4)) * (1 - ridge)
  c = blend(c, rgb(0x3b725c), crust * 0.75)
  return [h, c, mix(0.85, 0.3, smooth(0.6, 0.95, h)) + crust * 0.1]
}
// Verdigris: a green crust, darker in its pits, gold showing through where it is rubbed.
export const verdigrisPaint = (x, y, p) => {
  const n = fbm(x * 2, y * 2, p * 2, 5)
  const pits = smooth(0.35, 0.2, fbm(x * 7, y * 7, p * 7, 3))
  const h = n * 0.7 + (1 - pits) * 0.3
  let c = blend(rgb(0x1d3f35), rgb(0x4f9a7e), smooth(0.3, 0.7, n))
  c = blend(c, rgb(0x0d1a15), pits * 0.8)
  c = blend(c, rgb(0xb89048), smooth(0.68, 0.8, n) * 0.7)
  return [h, c, 0.8]
}
// Blackened iron: hammer dents, soot, rust bleeding from the low places.
export const ironPaint = (x, y, p) => {
  const dents = fbm(x * 1.5, y * 1.5, p * 1.5, 4)
  const grain = fbm(x * 8, y * 8, p * 8, 2)
  const h = dents * 0.8 + grain * 0.2
  let c = blend(rgb(0x0e0d0c), rgb(0x3a3633), smooth(0.35, 0.75, h))
  c = blend(c, rgb(0x8a8378), smooth(0.8, 0.95, h) * 0.6)
  const rust = smooth(0.58, 0.72, fbm(x + 5, y + 2, p, 5)) * (1 - smooth(0.5, 0.8, h))
  c = blend(c, blend(rgb(0x4a1e0e), rgb(0x8a4a1c), grain), rust * 0.85)
  return [h, c, mix(0.9, 0.45, smooth(0.7, 0.95, h))]
}
// Rust, all over, flaking.
export const rustPaint = (x, y, p) => {
  const n = fbm(x * 2, y * 2, p * 2, 5)
  const flakes = smooth(0.55, 0.6, fbm(x * 6 + 1, y * 6, p * 6, 3))
  const h = n * 0.6 + flakes * 0.4
  let c = blend(rgb(0x2e1208), rgb(0x7a3a16), smooth(0.25, 0.75, n))
  c = blend(c, rgb(0xa8642e), flakes * 0.5)
  return [h, c, 0.92]
}
// Concrete: warm grey, fine sand in it, a few pale stones, pits, rust stains run from the steel.
export const concretePaint = (x, y, p) => {
  const n = fbm(x * 2, y * 2, p * 2, 5)
  const sand = fbm(x * 16, y * 16, p * 16, 2)
  const stones = smooth(0.74, 0.77, fbm(x * 6, y * 6, p * 6, 2))
  const pits = smooth(0.2, 0.14, fbm(x * 12 + 4, y * 12, p * 12, 2))
  const h = n * 0.5 + sand * 0.2 + stones * 0.2 - pits * 0.3 + 0.3
  let c = blend(rgb(0x6c675e), rgb(0x9b958a), smooth(0.25, 0.75, n))
  c = blend(c, rgb(0x857f74), (sand - 0.5) * 0.6 + 0.3)
  c = blend(c, rgb(0xb3ab9b), stones * 0.5)
  c = blend(c, rgb(0x24211d), pits)
  c = blend(c, rgb(0x6b4024), smooth(0.55, 0.8, fbm(x + 2, y, p, 4)) * 0.55)
  return [h, c, 0.95]
}
// Red enamel on tin, worn dull, chipped through to rust in big flakes.
export const enamelPaint = (x, y, p) => {
  const n = fbm(x * 1.5, y * 1.5, p * 1.5, 5)
  const chip = smooth(0.6, 0.62, n)
  const wear = fbm(x, y, p, 3)
  const h = 1 - chip * 0.7 - wear * 0.1
  let c = blend(rgb(0x5e1810), rgb(0x9a2c1a), wear)
  c = blend(c, blend(rgb(0x3e180a), rgb(0x7a4a2a), fbm(x * 8, y * 8, p * 8, 2)), chip)
  return [h, c, mix(0.45, 0.9, chip)]
}
// The marbled orb: black stone with teal and pale veins, swirled. It wraps a sphere, so its
// stripes are whole turns over the period.
export const marblePaint = (x, y, p) => {
  const q = fbm(x * 0.5, y * 0.5, p * 0.5, 4)
  const v = Math.sin((x / 3 + q * 4.5 + fbm(x * 1.5 + 7, y * 1.5, p * 1.5, 4) * 3) * Math.PI)
  const vein = smooth(0.94, 0.995, Math.abs(v))
  const halo = smooth(0.7, 0.95, Math.abs(v))
  let c = blend(rgb(0x050809), rgb(0x1a4f58), halo * 0.85)
  c = blend(c, rgb(0x9fd2cf), vein * 0.9)
  return [halo * 0.4, c, 0.18]
}
// Old dial paper on a card: yellowed, foxed, a ring of grime at its edge.
export const dialPaint = (x, y, p) => {
  const n = fbm(x * 3, y * 3, p * 3, 5)
  const fox = smooth(0.62, 0.7, fbm(x * 4 + 3, y * 4, p * 4, 3))
  let c = blend(rgb(0xb9a476), rgb(0xe0d2a8), n)
  c = blend(c, rgb(0x6a4a24), fox * 0.6)
  return [n * 0.3, c, 0.9]
}

export const look = (paint, { repeat = 1, metal = 0.8, relief = 6, period = 8, size = 512, side = THREE.FrontSide, normalScale = 1 } = {}) => {
  const s = surface(paint, { period, relief, size })
  for (const t of [s.map, s.normalMap, s.roughnessMap]) t.repeat.set(repeat, repeat)
  return new THREE.MeshStandardMaterial({ ...s, metalness: metal, roughness: 1, side, normalScale: new THREE.Vector2(normalScale, normalScale) })
}
// A repeat of r tiles the texture r times per metre; extruded faces carry their own x, y as UVs.
// Each material is painted the first time a sheet asks for it: a sheet pays only for its own.
const LOOKS = {
  bronze: () => look(bronzePaint, { repeat: 7, metal: 0.85, relief: 8 }),
  verdigris: () => look(verdigrisPaint, { repeat: 14, metal: 0.3 }),
  iron: () => look(ironPaint, { repeat: 10, metal: 0.7 }),
  rust: () => look(rustPaint, { repeat: 30, metal: 0.3 }),
  concrete: () => look(concretePaint, { repeat: 5, metal: 0, relief: 10 }),
  enamel: () => look(enamelPaint, { repeat: 5, metal: 0.4, relief: 3 }),
  marble: () => look(marblePaint, { repeat: 1, metal: 0.1, period: 6, relief: 2 }),
  dial: () => look(dialPaint, { repeat: 12, metal: 0, relief: 2 }),
  feather: () => look(dialPaint, { repeat: 20, metal: 0, relief: 3, side: THREE.DoubleSide }),
  gold: () => new THREE.MeshStandardMaterial({ color: 0xc9a050, metalness: 1, roughness: 0.35 }),
  char: () => new THREE.MeshStandardMaterial({ color: 0x15100c, metalness: 0, roughness: 0.95 }),
  wood: () => new THREE.MeshStandardMaterial({ color: 0x9a7a4a, metalness: 0, roughness: 0.9 }),
  smoke: () => new THREE.MeshStandardMaterial({ color: 0x14181a, metalness: 0.2, roughness: 0.25 }),
  bone: () => new THREE.MeshStandardMaterial({ color: 0xd8ccae, metalness: 0, roughness: 0.6 }),
}
export const M = new Proxy({}, { get: (made, name) => (made[name] ??= LOOKS[name]()) })
export const EMBER = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff6a1a).multiplyScalar(1.4) })
export const GLASS = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false })

// --- Shapes.
export function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const part = new THREE.Mesh(geometry, material)
  part.position.set(x, y, z)
  return part
}
export const cyl = (r0, r1, h, m, x, y, z, seg = 16) => mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m, x, y, z)
export const ball = (r, m, x, y, z) => mesh(new THREE.SphereGeometry(r, 16, 12), m, x, y, z)
// A shape in the XY plane facing +Z, `depth` thick from z = 0 toward the viewer, edges bevelled.
export function slab(points, depth, m, holes = [], bevel = 0.0025) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))
  for (const [x, y, r] of holes) {
    const hole = new THREE.Path()
    hole.absarc(x, y, r, 0, Math.PI * 2, true)
    shape.holes.push(hole)
  }
  return new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 10 }), m)
}
// A ring in the XY plane: `teeth` gives it square teeth; `gap` (radians from, to) leaves a bite out.
export function ring(inner, outer, depth, m, { teeth = 0, gap = null } = {}) {
  const shape = new THREE.Shape()
  const steps = teeth ? teeth * 4 : 64
  const from = gap ? gap[1] : 0, to = gap ? gap[0] + Math.PI * 2 : Math.PI * 2
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps
    const r = teeth && i % 4 >= 2 ? outer * 0.9 : outer
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  for (let i = steps; i >= 0; i--) {
    const a = from + ((to - from) * i) / steps
    shape.lineTo(Math.cos(a) * inner, Math.sin(a) * inner)
  }
  return new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 4 }), m)
}
// A feather pointing up (+Y) from its quill at the origin, `length` long, flat toward the eye.
export function feather(length, m) {
  const s = length
  const group = new THREE.Group()
  const shape = [[0, 0], [0.13 * s, 0.22 * s], [0.17 * s, 0.55 * s], [0.1 * s, 0.85 * s], [0.02 * s, s], [-0.08 * s, 0.86 * s], [-0.11 * s, 0.6 * s], [-0.07 * s, 0.4 * s], [-0.12 * s, 0.3 * s], [-0.09 * s, 0.15 * s]]
  group.add(slab(shape, 0.0015, m, [], 0.0006))
  group.add(cyl(0.0012, 0.0006, s, M.char, 0, s / 2, 0.002, 5))
  return group
}
// A chain of `links` hanging down from the origin, and what it ends at.
export function chain(links, m) {
  const group = new THREE.Group()
  for (let i = 0; i < links; i++) {
    const link = mesh(new THREE.TorusGeometry(0.003, 0.0009, 6, 10), m, 0, -0.004 - i * 0.0052, 0)
    link.rotation.y = i % 2 ? Math.PI / 2 : 0
    group.add(link)
  }
  return group
}
export const tube = (points, radius, m) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), 24, radius, 6, false), m)
// A dial: a disc with ticks, under a glass, facing +Z.
export function dial(radius, faceM, inkM) {
  const group = new THREE.Group()
  group.add(cyl(radius, radius, 0.002, faceM, 0, 0, 0, 40).rotateX(Math.PI / 2))
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, long = i % 6 === 0, r = radius * (long ? 0.83 : 0.88)
    const tick = mesh(new THREE.BoxGeometry(0.0012, long ? radius * 0.22 : radius * 0.1, 0.0008), inkM, Math.sin(a) * r, Math.cos(a) * r, 0.0012)
    tick.rotation.z = -a
    group.add(tick)
  }
  const dome = mesh(new THREE.SphereGeometry(radius * 1.6, 32, 8, 0, Math.PI * 2, 0, 0.66), GLASS, 0, 0, -radius * 1.6 * Math.cos(0.66) + 0.008)
  dome.rotation.x = Math.PI / 2
  group.add(dome)
  return group
}

// The demo's readings: a bearing relative to the view (radians, left positive) and a nearness.
export function demo(t) {
  return {
    route: 1.1 * Math.sin(t * 0.4),
    matchbox: -0.6 + 1.2 * Math.sin(t * 0.27), matchNear: 0.5 + 0.5 * Math.sin(t * 0.5),
    feather: 1.2 * Math.sin(t * 0.21), featherNear: 0.5 + 0.5 * Math.sin(t * 0.33 + 1),
  }
}
// A spring toward a target angle: the settling lag every needle shares.
export function needleSpring(stiffness = 30, damping = 6) {
  let angle = 0, rate = 0
  return (target, dt) => {
    rate += ((target - angle) * stiffness - rate * damping) * dt
    angle += rate * dt
    return angle
  }
}
// Ticks toward a target: `step` radians at most, quicker as `near` goes to 1.
export function ticker(step = 0.22) {
  let angle = 0, wait = 0
  return (target, near, dt) => {
    wait -= dt
    if (wait <= 0) { wait = 0.5 - 0.42 * near; angle += Math.max(-step, Math.min(step, target - angle)) }
    return angle
  }
}

/** Draws each `[data-variant]` cell of the page with `makers[name]()`; `?t=` freezes the demo for a still. */
export function runSheet(makers) {
  const canvas = document.getElementById('c')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.setScissorTest(true)
  const reflections = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
  const views = [...document.querySelectorAll('[data-variant]')].map((element) => {
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x8e4a30)
    scene.environment = reflections
    scene.environmentIntensity = 0.55
    const sun = new THREE.DirectionalLight(0xffc98a, 3.2)
    sun.position.set(-0.5, 0.9, 0.7)
    const rim = new THREE.DirectionalLight(0xff7a4a, 1.6)
    rim.position.set(0.8, -0.2, -0.6)
    scene.add(sun, rim)
    const variant = makers[element.dataset.variant]()
    const holder = new THREE.Group()
    holder.add(variant.root)
    scene.add(holder)
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10)
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
      holder.rotation.set(-0.25 + 0.06 * Math.sin(t * 0.5), 0.4 * Math.sin(t * 0.3), 0)
    holder.position.y = -0.008 // a little low in the cell: the parts stand up above it
      variant.animate(t, frozen ? 0.016 : dt, d)
      const bottom = window.innerHeight - r.bottom
      renderer.setViewport(r.left, bottom, r.width, r.height)
      renderer.setScissor(r.left, bottom, r.width, r.height)
      renderer.render(scene, camera)
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
