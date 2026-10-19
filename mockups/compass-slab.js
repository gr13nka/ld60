// The slab compass, turned four ways: a lump of the megastructure broken off and carried, a
// dial set into it. Each has the same three parts: a bent bit of rebar with an ember at its end
// for the route (always the brightest thing on it), a hook of rusted wire that ticks toward a
// matchbox, a grimy gull feather wired to a bar's end that turns toward a feather.
import * as THREE from 'three'
import {
  EMBER, M, ball, blend, concretePaint, cyl, dial, fbm, feather, look, mesh, needleSpring, noise, rgb, ring, runSheet, smooth, ticker, tube,
} from './grim-kit.js'

// --- Broken concrete.
const BIG = 100000 // a noise period too long to repeat on anything this size
const n3 = (x, y, z) => (noise(x, y, BIG) + noise(y + 31.7, z, BIG) + noise(z + 17.3, x + 5.1, BIG)) / 3

// The broken faces: coarser than the cast face, stones torn out, darker in the hollows.
const brokenPaint = (x, y, p) => {
  const n = fbm(x * 3, y * 3, p * 3, 5)
  const stones = smooth(0.6, 0.66, fbm(x * 6, y * 6, p * 6, 3))
  const holes = smooth(0.32, 0.24, fbm(x * 8 + 2, y * 8, p * 8, 3))
  const h = n * 0.4 + stones * 0.5 - holes * 0.4 + 0.2
  let c = blend(rgb(0x4e4a44), rgb(0x8a8478), smooth(0.2, 0.8, n))
  c = blend(c, blend(rgb(0x9d9585), rgb(0x6f6253), fbm(x * 12, y * 12, p * 12, 2)), stones * 0.8)
  c = blend(c, rgb(0x161412), holes)
  return [h, c, 0.97]
}
const SIDE = look(brokenPaint, { repeat: 6, metal: 0, relief: 12 })

/**
 * A slab broken out of a floor: `points` its outline in XY, `depth` thick toward the eye.
 * The outline is cut into short steps and every corner pushed about by noise, so its edges are
 * torn and its sides crumble. `holes` are circles `[x, y, r]` or outlines. The face takes
 * `face`, the broken sides `side`.
 */
function broken(points, depth, face, side = SIDE, { jag = 0.0035, holes = [] } = {}) {
  const torn = (outline) => {
    const out = []
    for (let i = 0; i < outline.length; i++) {
      const [x0, y0] = outline[i], [x1, y1] = outline[(i + 1) % outline.length]
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.004))
      for (let k = 0; k < steps; k++) {
        const x = x0 + ((x1 - x0) * k) / steps, y = y0 + ((y1 - y0) * k) / steps
        const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny)
        const j = (noise(x * 300 + 7, y * 300, BIG) - 0.5) * jag * 2
        out.push(new THREE.Vector2(x + (nx / l) * j, y + (ny / l) * j))
      }
    }
    return out
  }
  const shape = new THREE.Shape(torn(points))
  for (const hole of holes) {
    if (hole.length === 3 && typeof hole[0] === 'number') {
      const [x, y, r] = hole
      const circle = []
      for (let i = 0; i < 40; i++) circle.push([x + Math.cos((i / 40) * Math.PI * 2) * r, y + Math.sin((i / 40) * Math.PI * 2) * r])
      shape.holes.push(new THREE.Path(circle.reverse().map(([a, b]) => new THREE.Vector2(a, b))))
    } else shape.holes.push(new THREE.Path(torn([...hole].reverse())))
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 5, bevelEnabled: false })
  const pos = geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const k = 160
    pos.setXYZ(i, x + (n3(x * k, y * k, z * k) - 0.5) * jag * 1.6, y + (n3(y * k + 9, z * k, x * k) - 0.5) * jag * 1.6, z + (n3(z * k + 3, x * k, y * k) - 0.5) * jag * 0.8)
  }
  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, [face, side])
}

// A ribbed bar along `points`, its ribs every few millimetres.
function rebar(points, radius = 0.0026) {
  const group = new THREE.Group()
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, radius, 8, false), M.rust))
  const ribs = Math.floor(curve.getLength() / 0.0045)
  const rib = new THREE.TorusGeometry(radius * 1.05, radius * 0.28, 4, 10)
  const along = new THREE.Vector3(), z = new THREE.Vector3(0, 0, 1)
  for (let i = 1; i < ribs; i++) {
    const t = i / ribs
    const part = new THREE.Mesh(rib, M.rust)
    part.position.copy(curve.getPointAt(t))
    part.quaternion.setFromUnitVectors(z, curve.getTangentAt(t, along))
    part.rotateX(0.35) // ribs run at a slant
    group.add(part)
  }
  return group
}

// A decal drawn on a canvas, laid flat on a face at `z`, `w` by `h` metres.
function decal(draw, w, h, x, y, z, pixels = [512, 256]) {
  const canvas = document.createElement('canvas')
  ;[canvas.width, canvas.height] = pixels
  draw(canvas.getContext('2d'), canvas.width, canvas.height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false })
  return mesh(new THREE.PlaneGeometry(w, h), material, x, y, z)
}
// Paint worn off in blotches: what is left of anything stencilled or painted years ago.
function wear(c, w, h, share) {
  c.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 900 * share; i++) {
    c.globalAlpha = 0.25 + Math.random() * 0.6
    c.beginPath()
    c.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * (w / 40), 0, Math.PI * 2)
    c.fill()
  }
  c.globalAlpha = 1
  c.globalCompositeOperation = 'source-over'
}
const stencil = (text, color = '#8e2a18') => (c, w, h) => {
  c.fillStyle = color
  c.font = `bold ${Math.round(h * 0.62)}px "DIN Condensed", "Arial Narrow", system-ui, sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(text, w / 2, h / 2)
  wear(c, w, h, 0.12)
}
// A rust run down from a bar: brown, streaky, fading downward.
const streak = (c, w, h) => {
  for (let x = 0; x < w; x++) {
    const strength = Math.max(0, 1 - Math.abs(x - w / 2) / (w / 2)) * (0.5 + Math.random() * 0.5)
    const fall = h * (0.4 + Math.random() * 0.6)
    const g = c.createLinearGradient(0, 0, 0, fall)
    g.addColorStop(0, `rgba(110,52,20,${0.75 * strength})`)
    g.addColorStop(1, 'rgba(110,52,20,0)')
    c.fillStyle = g
    c.fillRect(x, 0, 1, fall)
  }
}

// A hex bolt head facing the eye.
const bolt = (x, y, z) => mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.003, 6).rotateX(Math.PI / 2), M.iron, x, y, z)

// --- The three parts, the same on every variant.
// The route: a bent rebar end with an ember on it and a ring of red paint, on a pin.
function routeBar(length = 0.028) {
  const bar = new THREE.Group()
  bar.add(tube([[0, -0.008, 0], [0, length * 0.45, 0.001], [0.004, length * 0.95, 0.002]], 0.0018, M.rust))
  bar.add(mesh(new THREE.TorusGeometry(0.002, 0.0009, 4, 10), new THREE.MeshStandardMaterial({ color: 0xb02a14, roughness: 0.8 }), 0.0008, length * 0.6, 0.0012).rotateX(Math.PI / 2))
  bar.add(mesh(new THREE.SphereGeometry(0.0042, 12, 10), EMBER, 0.004, length, 0.002))
  bar.add(cyl(0.0042, 0.0042, 0.004, M.iron, 0, 0, 0, 6).rotateX(Math.PI / 2))
  return bar
}
// The matchbox's: a hook of rusted wire on a bolt.
function wireHook() {
  const hook = new THREE.Group()
  hook.add(tube([[0, 0, 0], [0, 0.016, 0.002], [0.006, 0.027, 0.003], [0.013, 0.023, 0.003], [0.012, 0.015, 0.002]], 0.0012, M.rust), bolt(0, 0, 0))
  return hook
}
// The feather's: a feather wired on, turning on the bar's end.
function wiredFeather(length = 0.05) {
  const tie = new THREE.Group()
  tie.add(feather(length, M.feather))
  for (let i = 0; i < 3; i++) tie.add(mesh(new THREE.TorusGeometry(0.0028, 0.0006, 4, 8), M.iron, 0, 0.003 + i * 0.0018, 0.001).rotateX(Math.PI / 2))
  return tie
}
// Moves the three parts as the readings say.
function driver(bar, hook, tie, { featherRest = -0.4 } = {}) {
  const turn = needleSpring(26, 6), tick = ticker(), wave = needleSpring(20, 4)
  return (t, dt, d) => {
    bar.rotation.z = turn(d.route, dt)
    hook.rotation.z = tick(d.matchbox, d.matchNear, dt) + 0.05 * d.matchNear * d.matchNear * Math.sin(t * 60)
    tie.rotation.z = wave(d.feather * 0.7, dt) + featherRest + 0.12 * d.featherNear * Math.sin(t * 15)
  }
}

// 1 · The slab, worked over: torn edges, four ribbed bars bursting out, the dial sunk in a hole
// behind a cast iron ring of six bolts, the slab's mark stencilled on it, rust run from the steel.
function plate() {
  const root = new THREE.Group()
  const outline = [[-0.078, -0.03], [-0.064, -0.056], [-0.03, -0.05], [0.002, -0.064], [0.04, -0.052], [0.07, -0.03], [0.064, -0.004], [0.08, 0.024], [0.056, 0.05], [0.02, 0.044], [-0.012, 0.06], [-0.046, 0.048], [-0.08, 0.022], [-0.07, -0.004]]
  root.add(broken(outline, 0.03, M.concrete, SIDE, { holes: [[0.004, 0, 0.034]] }).translateZ(-0.024))
  const face = dial(0.034, M.dial, M.char)
  face.position.set(0.004, 0, -0.008)
  root.add(face)
  root.add(ring(0.033, 0.042, 0.005, M.iron).translateX(0.004).translateZ(0.004))
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3
    root.add(bolt(0.004 + Math.cos(a) * 0.0375, Math.sin(a) * 0.0375, 0.0105))
  }
  root.add(rebar([[-0.06, -0.042, -0.012], [-0.085, -0.05, -0.01], [-0.1, -0.036, -0.004]]))
  root.add(rebar([[0.058, 0.04, -0.012], [0.08, 0.052, -0.008], [0.088, 0.072, 0]]))
  root.add(rebar([[0.064, -0.028, -0.014], [0.09, -0.034, -0.012], [0.098, -0.052, -0.006]]))
  root.add(rebar([[-0.066, 0.03, -0.014], [-0.09, 0.044, -0.01], [-0.094, 0.062, -0.006]]))
  root.add(decal(stencil('ПК 63·15'), 0.062, 0.018, 0.03, -0.044, 0.0095, [512, 144]))
  root.add(decal(streak, 0.014, 0.05, 0.062, 0.022, 0.0095, [64, 256]), decal(streak, 0.012, 0.04, -0.064, -0.048, 0.0095, [64, 256]))
  const bar = routeBar()
  bar.position.set(0.004, 0, -0.004)
  const hook = wireHook()
  hook.position.set(-0.05, -0.036, 0.008)
  const tie = wiredFeather()
  tie.position.set(0.088, 0.072, 0)
  root.add(bar, hook, tie)
  return { root, distance: 0.44, animate: driver(bar, hook, tie) }
}

// A broken-off piece of a wall mosaic: tesserae of a sun's rays, its disc and a sky, grout
// between, whole patches of them gone to the concrete.
const mosaicPaint = (x, y, p) => {
  const u = x / p, v = y / p
  const rows = 52
  const wobble = (fbm(u * 8, v * 8, 8, 2) - 0.5) * 0.9 // the rows are laid by hand: they wander
  const row = Math.floor(v * rows + wobble)
  const shift = rgbHash(row, 7) // each row starts where it starts
  const col = Math.floor(u * rows + shift + wobble * 0.6)
  const fu = u * rows + shift + wobble * 0.6 - col, fv = v * rows + wobble - row
  const cu = (col + 0.5 - shift) / rows, cv = (row + 0.5) / rows
  const gap = 0.08 + rgbHash(col, row + 3) * 0.1
  const grout = Math.min(fu, 1 - fu, fv, 1 - fv) < gap
  const gone = smooth(0.56, 0.6, fbm(u * 6, v * 6, 6, 5))
  if (gone > 0.5) return concretePaint(x * 4, y * 4, p * 4).map((value, i) => (i === 0 ? value * 0.4 : value))
  const dx = cu - 0.36, dy = cv - 0.62, r = Math.hypot(dx, dy)
  const a = Math.atan2(dy, dx)
  let tile
  if (r < 0.16) tile = blend(rgb(0xf3c12a), rgb(0xffe07a), smooth(0.16, 0.02, r))
  else if (r < 0.62 && Math.floor(((a + Math.PI) / (Math.PI * 2)) * 18) % 2 === 0) tile = r < 0.4 ? rgb(0xe0581c) : rgb(0xc8321e)
  else tile = blend(rgb(0x2f6fb8), rgb(0x9fc6e0), smooth(0.9, 0.2, cv))
  const jitter = (rgbHash(col, row) - 0.5) * 50
  tile = tile.map((value) => Math.max(0, Math.min(255, value + jitter)))
  const dirt = fbm(u * 12, v * 12, 12, 3)
  if (grout) return [0.15, blend(rgb(0x3a3631), rgb(0x6a645a), dirt), 0.95]
  return [0.7 + rgbHash(row, col) * 0.2, blend(tile, rgb(0x3a2a1a), smooth(0.55, 0.8, dirt) * 0.35), 0.35]
}
function rgbHash(x, y) {
  let h = (x * 73856093) ^ (y * 19349663)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

// 2 · A piece of a wall mosaic: the sun's rays in smalt, half its tesserae fallen out, the dial
// set into the hole in a thin brass bezel, a bar sticking out of the top for the feather.
function mosaic() {
  const root = new THREE.Group()
  const face = look(mosaicPaint, { metal: 0.15, relief: 5, period: 8, size: 1024 })
  for (const t of [face.map, face.normalMap, face.roughnessMap]) {
    t.repeat.set(1 / 0.18, 1 / 0.18)
    t.offset.set(0.5, 0.5)
  }
  const outline = [[-0.07, -0.04], [-0.05, -0.058], [-0.01, -0.05], [0.03, -0.06], [0.064, -0.042], [0.074, -0.01], [0.06, 0.02], [0.07, 0.046], [0.03, 0.058], [-0.004, 0.05], [-0.04, 0.062], [-0.074, 0.04], [-0.062, 0.008]]
  root.add(broken(outline, 0.024, face, SIDE, { holes: [[0.0, -0.004, 0.032]] }).translateZ(-0.018))
  const d = dial(0.032, M.dial, M.char)
  d.position.set(0, -0.004, -0.006)
  root.add(d, ring(0.031, 0.035, 0.004, M.gold).translateY(-0.004).translateZ(0.004))
  root.add(rebar([[0.04, 0.05, -0.01], [0.044, 0.07, -0.008], [0.06, 0.084, -0.002]]), rebar([[-0.06, -0.044, -0.01], [-0.082, -0.06, -0.006]]))
  const bar = routeBar()
  bar.position.set(0, -0.004, -0.002)
  const hook = wireHook()
  hook.position.set(-0.048, -0.04, 0.007)
  const tie = wiredFeather()
  tie.position.set(0.06, 0.084, -0.002)
  root.add(bar, hook, tie)
  return { root, distance: 0.43, animate: driver(bar, hook, tie) }
}

// 3 · A length of broken concrete pipe, seen end on: a thick arc torn open at the top right, its
// rebar hoops sprung out of both broken ends; the dial hangs in its hollow on three rusted wires.
function pipe() {
  const root = new THREE.Group()
  const outer = 0.07, inner = 0.048, from = -0.25, to = Math.PI * 1.55
  const outline = []
  for (let i = 0; i <= 28; i++) {
    const a = from + ((to - from) * i) / 28
    outline.push([Math.cos(a) * outer, Math.sin(a) * outer])
  }
  for (let i = 28; i >= 0; i--) {
    const a = from + ((to - from) * i) / 28
    outline.push([Math.cos(a) * inner, Math.sin(a) * inner])
  }
  root.add(broken(outline, 0.034, M.concrete, SIDE, { jag: 0.004 }).translateZ(-0.03))
  const middle = (outer + inner) / 2
  for (const [a, out] of [[from, -1], [to, 1]]) {
    const end = [Math.cos(a) * middle, Math.sin(a) * middle]
    const past = a + out * 0.3
    root.add(rebar([[...end, -0.012], [Math.cos(past) * (middle + 0.004), Math.sin(past) * (middle + 0.004), -0.01], [Math.cos(past + out * 0.2) * (middle + 0.016), Math.sin(past + out * 0.2) * (middle + 0.016), -0.004]]))
  }
  const hung = new THREE.Group()
  hung.position.set(0, -0.004, -0.006)
  const d = dial(0.03, M.dial, M.char)
  hung.add(d, ring(0.029, 0.034, 0.004, M.iron).translateZ(-0.001))
  for (const a of [Math.PI * 0.85, Math.PI * 1.25, Math.PI * 1.75]) {
    hung.add(tube([[Math.cos(a) * 0.033, Math.sin(a) * 0.033, 0], [Math.cos(a) * 0.042, Math.sin(a) * 0.042, -0.004], [Math.cos(a) * 0.05, Math.sin(a) * 0.05, -0.008]], 0.0008, M.rust))
  }
  root.add(hung)
  root.add(decal(stencil('Д-150'), 0.04, 0.012, -0.03, -0.06, 0.0075, [512, 144]))
  const bar = routeBar(0.026)
  bar.position.set(0, -0.004, -0.002)
  const hook = wireHook()
  hook.position.set(-0.058, 0.0, 0.006)
  const tie = wiredFeather()
  const tip = to + 0.5
  tie.position.set(Math.cos(tip) * (middle + 0.016), Math.sin(tip) * (middle + 0.016), -0.004)
  root.add(bar, hook, tie)
  return { root, distance: 0.38, animate: driver(bar, hook, tie, { featherRest: -0.9 }) }
}

// 4 · A piece of a facade, a window still in it: the steel frame and its cross bar, the dial in
// the lower pane behind cracked glass, a flat's number painted beside it, a stub of balcony rail
// in rebar under the sill, rust run down from it.
function windowPiece() {
  const root = new THREE.Group()
  const outline = [[-0.07, -0.05], [-0.04, -0.066], [0.01, -0.058], [0.05, -0.066], [0.076, -0.04], [0.07, 0.0], [0.08, 0.04], [0.05, 0.066], [0.0, 0.056], [-0.04, 0.068], [-0.078, 0.04], [-0.066, 0.0]]
  const opening = [[-0.03, -0.042], [0.03, -0.042], [0.03, 0.046], [-0.03, 0.046]]
  root.add(broken(outline, 0.026, M.concrete, SIDE, { holes: [opening], jag: 0.003 }).translateZ(-0.022))
  for (const [w, h, x, y] of [[0.064, 0.004, 0, -0.042], [0.064, 0.004, 0, 0.046], [0.004, 0.092, -0.031, 0.002], [0.004, 0.092, 0.031, 0.002], [0.06, 0.003, 0, 0.012]]) {
    root.add(mesh(new THREE.BoxGeometry(w, h, 0.006), M.iron, x, y, -0.006))
  }
  const d = dial(0.026, M.dial, M.char)
  d.position.set(0, -0.015, -0.012)
  root.add(d)
  const crack = decal((c, w, h) => {
    c.fillStyle = 'rgba(200,215,215,0.12)'
    c.fillRect(0, 0, w, h)
    c.strokeStyle = 'rgba(240,245,245,0.95)'
    c.lineWidth = 4
    const from = [w * 0.7, h * 0.3]
    for (let i = 0; i < 7; i++) {
      c.beginPath()
      c.moveTo(...from)
      let [x, y] = from
      const a = (i / 7) * Math.PI * 2
      for (let k = 0; k < 6; k++) { x += Math.cos(a + (Math.random() - 0.5)) * w * 0.08; y += Math.sin(a + (Math.random() - 0.5)) * h * 0.08; c.lineTo(x, y) }
      c.stroke()
    }
  }, 0.058, 0.05, 0, -0.016, -0.003, [256, 256])
  root.add(crack)
  root.add(decal(stencil('17', '#e6e0d2'), 0.03, 0.024, 0.052, 0.03, 0.0075, [256, 196]))
  root.add(rebar([[-0.05, -0.054, 0.004], [-0.05, -0.062, 0.016], [0.05, -0.062, 0.016], [0.05, -0.054, 0.004]], 0.0022))
  for (const x of [-0.025, 0, 0.025]) root.add(rebar([[x, -0.062, 0.016], [x, -0.05, 0.02]], 0.0016))
  root.add(decal(streak, 0.016, 0.04, 0.04, -0.07, 0.0075, [64, 256]))
  root.add(rebar([[0.06, 0.05, -0.01], [0.074, 0.07, -0.006], [0.07, 0.088, 0]]))
  const bar = routeBar(0.022)
  bar.position.set(0, -0.015, -0.008)
  const hook = wireHook()
  hook.position.set(-0.05, -0.02, 0.006)
  const tie = wiredFeather()
  tie.position.set(0.07, 0.088, 0)
  root.add(bar, hook, tie)
  return { root, distance: 0.44, animate: driver(bar, hook, tie) }
}

runSheet({ plate, mosaic, pipe, windowPiece })
