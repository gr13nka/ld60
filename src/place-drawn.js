// How a parkour place is drawn (`parkour-world.js` stands it up): the paints of its forms and
// its looks, a box, a piece of dressing, the floor's inlays, the ramps, a sign's lettering, a
// mural, a form's mesh, a rotor and a cut's outline. Look only: nothing here is met, and what
// is met is the world's (`ParkourWorld`), which hands each of these the record it draws.

import * as THREE from 'three'
import { buildForm } from './forms.js'
import { asCutter } from './form-cut.js'
import { bake, box, canvasTexture, indexedForDrawing, materials, neon, neonPaint } from './models.js'
import { paintMural } from './murals.js'
import { celMaterial, GRAIN, grainedMaterial } from './shading.js'

// The floor's inlays: dark, see-through, and pulled over the street in the depth test.
const INLAY_PAINT = new THREE.MeshBasicMaterial({ color: 0x30362f, transparent: true, opacity: 0.38,
  depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })

// A form's paints, by `look`: lit by the normals the form gives (flat or smooth), not by the face.
// These are every place's; a place's own `paints` change any of them or add looks besides
// (`places.js`), which is how a place gets a style of its own. The greys are the city's and the
// sample's; the rest is the palace's (`scripts/places/palace.mjs`), a painted works: limewash,
// turquoise half-walls, light-blue oil paint on pipes, mustard trims, brick-orange vaults. None is
// red or green (`blastRed`, a gate's light), and the whitewash stays under its theme's glow.
const FORM_COLORS = {
  concrete: 0x6e746e,
  pale: 0x9aa094,
  dark: 0x3f4442,
  curb: 0x8a919c,
  steel: 0x9aa3b0,
  rust: 0x8a5a44,
  whitewash: 0xe4ddcc,
  plaster: 0xd6c4a2,
  turquoise: 0x4aa39b,
  sky: 0x7ab3d8,
  ochre: 0xd9a63a,
  cobalt: 0x1f4fa3, // the brutalist keyboard's blue (`docs/research/brutalism.md`), in loggias
  terracotta: 0xbf6238,
  brass: 0xc9a24e,
  wood: 0x9a6a3c,
  earth: 0xa08a62, // a dry hillside: the mountain the palace is cut into
  rose: 0xc49c86, // Torre Velasca's pinkish concrete (`assets.js`)
  pozzolan: 0xb0a79a, // the Salk Institute's warm grey concrete (`assets.js`)
  travertine: 0xd9cfb8, // its plaza's stone
  water: 0x3d7f9e, // its channel and pool
  board: 0xa9adae, // SESC Pompéia's board-marked concrete, a cool light grey: a warmer one read as beige (`asset-sesc.js`)
  brick: 0xb0704a, // its old sheds' brick, turned toward orange so that it never reads as `blastRed`
  orange: 0xc4672c, // Lina Bo Bardi's red on its rails, ducts, frames and lattices, made orange for the same reason, and dulled: a bright one shouted
  deck: 0x8a8177, // its deck's weathered boards, gone grey in the sun
  cast: 0xa9adae, // its concrete cast smooth, for what slopes or curves: formwork's lines are level and cut across them
  dim: 0x5a564d, // concrete out of the sun: the gate's labyrinth, its piers left `concrete` so that they stand out
}
// What each paint lies on, for its grain (`shading.js`): limewash and plaster on lime, the oil
// paints on plaster, concrete and brick on concrete; metal and wood bare. The grain is the
// place's theme's to turn up (`shade.grain`), and none unless it does.
const FORM_GRAIN = {
  concrete: 'concrete', pale: 'concrete', dark: 'concrete', curb: 'concrete', dim: 'concrete', earth: 'concrete',
  rust: 'concrete', terracotta: 'concrete', rose: 'concrete', pozzolan: 'concrete', board: 'formwork', cast: 'concrete', brick: 'concrete', deck: 'concrete',
  whitewash: 'lime', plaster: 'lime', travertine: 'lime',
  turquoise: 'paint', sky: 'paint', ochre: 'paint', cobalt: 'paint', orange: 'paint',
}
// The same paint for a form that is `over` another, laid a few centimetres proud of it (a room's
// floor lapping a deck, a strip on a room's wall): pulled a little toward the eye in the depth
// test, so it wins where the two are nearer than the depths can tell apart. By a few steps of
// the depth only, with nothing for the slope: with the slope's share, a band seen along a wall
// was pulled so far forward at a glance that it showed through the floor and what stood before it.
const OVER = { polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -2 }
const _paints = new Map() // every form paint made, by colour, grain and whether it is over: shared by every place
export function formPaint(color, grain, over) {
  const key = `${color}|${grain}|${over}`
  if (!_paints.has(key)) _paints.set(key, grainedMaterial({ color, ...(over ? OVER : {}) }, GRAIN[grain]))
  return _paints.get(key)
}
// Each look a place's forms may wear, `{ color, grain }`: every place's, with the place's own
// `paints` (`'#rrggbb'`, or `{ color, grain }`) over them.
export function looksOf(own = {}) {
  const looks = Object.fromEntries(Object.entries(FORM_COLORS).map(([look, color]) => [look, { color, grain: FORM_GRAIN[look] ?? 'bare' }]))
  for (const [look, paint] of Object.entries(own)) {
    const { color, grain } = typeof paint === 'object' ? paint : { color: paint }
    looks[look] = { color: new THREE.Color(color ?? looks[look]?.color ?? FORM_COLORS.concrete).getHex(), grain: grain ?? looks[look]?.grain ?? 'bare' }
  }
  return looks
}
// A box's paint by its `look` ('far' is a tower, painted by the theme: `createTowers`): the
// city's own colours (`models.js`), grained and worn as a form's paint is, so that a box takes a
// look's wear as the forms around it do.
const boxPaint = (material, grain) => grainedMaterial({ color: material.color.getHex() }, GRAIN[grain])
const PAINT = { ground: boxPaint(materials.concrete, 'concrete'), slab: boxPaint(materials.concrete, 'concrete'), kicker: boxPaint(materials.curb, 'concrete'), prop: boxPaint(materials.steel, 'bare'), lamp: neon.amber, joint: boxPaint(materials.asphalt, 'bare') }
// A ramp's two paints, one stretch and the next: the joints going by are how fast he is seen
// to go. Seen from under too, a ramp being a tent with no floor.
const RAMP_PAINT = [0xd9dde6, 0x8a919c].map((color) => grainedMaterial({ color, flatShading: true, side: THREE.DoubleSide }, GRAIN.concrete))
/** Whether a box of `look` is painted by the boxes' own paints; any other look is a place's paint, handed to `meshOf`. */
export const boxesPaint = (look) => look in PAINT
// A box as drawn, its top sloping if it does. `paint`, for a look the boxes have none of their own for (`boxesPaint`).
export function meshOf({ x0, x1, y0, y1, z0, z1, look, slope }, paint = PAINT[look]) {
  const mesh = box(x1 - x0, y1 - y0, z1 - z0, paint, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  if (!slope) return mesh
  const at = mesh.geometry.attributes.position
  // The top's corners are let down to the slope: the box was made as tall as its higher end.
  for (let i = 0; i < at.count; i++) {
    if (at.getY(i) > 0) at.setY(i, (at.getZ(i) < 0 ? slope.from : slope.to) - (y0 + y1) / 2)
  }
  mesh.geometry.computeVertexNormals()
  return mesh
}

// A piece of a place's `dressing` as drawn (`parkour-city.js` says what one holds). Three
// shapes: a box, whose top may be another size and out of line with its foot, so that its
// sides lean; a round, a column whose top may be wider or narrower than its foot; and a ring,
// stood across the way unless turned, all the way round or `arc` of it from its right-hand side up.
export function dressed({ x, y, z, w, h, d, turn = [0, 0, 0], look = 'slab', shape = 'box', top, radius, tube, arc = Math.PI * 2 }) {
  let geometry
  if (shape === 'round') geometry = new THREE.CylinderGeometry(top ?? radius, radius, h, 24)
  else if (shape === 'ring') geometry = new THREE.TorusGeometry(radius, tube, 8, 48, arc)
  else {
    geometry = new THREE.BoxGeometry(w, h, d)
    if (top) {
      const at = geometry.attributes.position
      for (let i = 0; i < at.count; i++) {
        if (at.getY(i) > 0) at.setXYZ(i, (at.getX(i) / w) * top.w + (top.dx ?? 0), at.getY(i), (at.getZ(i) / d) * top.d + (top.dz ?? 0))
      }
      geometry.computeVertexNormals()
    }
  }
  const mesh = new THREE.Mesh(geometry, PAINT[look])
  mesh.position.set(x, y, z)
  mesh.rotation.set(...turn)
  return mesh
}

export function inlaid(quads) {
  const corners = quads.flatMap(([a, b, c, d]) => [...a, ...b, ...c, ...a, ...c, ...d])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners, 3))
  return new THREE.Mesh(geometry, INLAY_PAINT)
}

// A place's ramps as drawn: the triangles a surfer meets, in two meshes by their paint.
export function rampsDrawn(faces) {
  return RAMP_PAINT.map((paint, tone) => {
    const corners = faces.filter((face) => (face.stretch & 1) === tone).flatMap(({ a, b, c }) => [a, b, c].flatMap((corner) => corner.toArray()))
    const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(corners, 3))
    geometry.computeVertexNormals()
    const mesh = new THREE.Mesh(indexedForDrawing(geometry), paint)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  })
}

const STENCIL = '#b9a982' // a sign's paint: pale enough to read on concrete, never bright enough to glow
const SIGN_PIXELS = 512 // across a sign's own texture, whatever its size

// A sign of a place's `signs` as drawn: stencilled lettering on whatever wall is behind it,
// nothing but the letters. It is unlit paint, so that it reads the same in a dim corridor and
// across a chasm, and the haze takes it as it takes the wall. `paint` (a CSS colour) is the
// stencil's own, where a place's words are not all one colour; it is paint, never a light.
export function painted({ x, y, z, w, h, yaw, text, under, paint = STENCIL }) {
  const height = Math.round((SIGN_PIXELS * h) / w)
  const map = canvasTexture(SIGN_PIXELS, height, (ctx) => {
    ctx.fillStyle = paint
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const tall = under ? height * 0.62 : height * 0.9
    ctx.font = `900 ${tall}px Arial, sans-serif`
    ctx.fillText(text, SIGN_PIXELS / 2, under ? height * 0.36 : height / 2, SIGN_PIXELS * 0.96)
    if (!under) return
    ctx.font = `700 ${height * 0.2}px Arial, sans-serif`
    ctx.fillText(under, SIGN_PIXELS / 2, height * 0.84, SIGN_PIXELS * 0.96)
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }))
  mesh.position.set(x, y, z)
  mesh.rotation.y = yaw
  return mesh
}

// A mural of a place's `murals`: a painting drawn in code (`murals.js`, Vrubel's shard style)
// on a plane `{ subject, x, y, z, w, h, yaw, pitch }` or once round a band `{ subject, wrap:
// { x, z, radius, y0, y1 } }`. Unlit paint as a sign is, taken by the haze as the wall is, and
// no solid. One canvas a subject, kept: the halls share three pictures. `pitch` tilts a plane
// to a leaning wall, so that it stays a hand proud top and bottom.
const MURAL_PIXELS = { square: 2048, frieze: [3072, 1024] }
const _murals = new Map()
function muralTexture(subject) {
  if (!_murals.has(subject)) {
    const [w, h] = subject === 'frieze' ? MURAL_PIXELS.frieze : [MURAL_PIXELS.square, MURAL_PIXELS.square]
    const map = canvasTexture(w, h, (ctx) => paintMural(ctx, w, h, subject))
    map.wrapS = THREE.RepeatWrapping
    _murals.set(subject, map)
  }
  return _murals.get(subject)
}
export function mural({ subject, x, y, z, w, h, yaw = 0, pitch = 0, wrap }) {
  const material = new THREE.MeshBasicMaterial({ map: muralTexture(subject) })
  if (wrap) {
    const geometry = new THREE.CylinderGeometry(wrap.radius, wrap.radius, wrap.y1 - wrap.y0, 48, 1, true)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(wrap.x, (wrap.y0 + wrap.y1) / 2, wrap.z)
    return mesh
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
  mesh.position.set(x, y, z)
  mesh.rotation.order = 'YXZ'
  mesh.rotation.y = yaw
  mesh.rotation.x = pitch
  return mesh
}

/** A form's mesh from its built `positions` and `normals` (`buildForm`), in `paint`, casting and taking shadows. */
export function formMesh(positions, normals, paint) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  const mesh = new THREE.Mesh(indexedForDrawing(geometry), paint)
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}

/**
 * Forms drawn as one mesh in `paint`: each part `[positions, normals]` as `buildForm` gives
 * them, laid end to end. One draw for many forms; a mesh of its own for each was as many draws.
 */
export function mergedMesh(parts, paint) {
  let length = 0
  for (const [positions] of parts) length += positions.length
  const position = new Float32Array(length)
  const normal = new Float32Array(length)
  let at = 0
  for (const [positions, normals] of parts) {
    position.set(positions, at)
    normal.set(normals, at)
    at += positions.length
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
  geometry.computeBoundingSphere()
  const mesh = new THREE.Mesh(indexedForDrawing(geometry), paint)
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}

/**
 * A rotor of a place's `rotors`, `{ x, y, z, inner, outer, blades, chord, thick, pitch, twist,
 * taper }`, as a group of blades in `paint`, about its upright axis at its point: turned by the
 * world each frame, and never met (a solid that turned would be the one moving solid; a fan's air
 * is `fans`). Each blade is a sweep out along the arm: a lens `chord` wide and `thick` deep, rolled
 * `pitch` at the root and `pitch - twist` at the tip, the tip's chord `taper` of the root's. The
 * roll is negative so that the trailing edge rides high: turned by a positive `speed`
 * (widdershins seen from above, so a blade advances toward its own -Z), a leading edge that is
 * low pushes the air up, the way the column it stands in goes.
 */
export function rotorDrawn({ x, y, z, inner, outer, blades, chord, thick, pitch, twist = 0, taper = 1 }, paint) {
  const group = new THREE.Group()
  const section = [[-chord / 2, 0], [0, -thick / 2], [chord / 2, 0], [0, thick / 2]]
  const path = [
    { x: inner, y: 0, z: 0, roll: -pitch },
    { x: (inner + outer) / 2, y: 0, z: 0, roll: -(pitch - twist / 2), scale: [(1 + taper) / 2, 1] },
    { x: outer, y: 0, z: 0, roll: -(pitch - twist), scale: [taper, 1] },
  ]
  const { positions, normals } = buildForm({ kind: 'sweep', section, path, smooth: true })
  const blade = formMesh(positions, normals, paint)
  for (let i = 0; i < blades; i++) {
    const turned = i === 0 ? blade : new THREE.Mesh(blade.geometry, paint)
    turned.castShadow = turned.receiveShadow = true
    turned.rotation.y = (Math.PI * 2 * i) / blades
    group.add(turned)
  }
  group.position.set(x, y, z)
  return group
}

/**
 * The place's `cables`, look only and never met: each `{ path: [[x, y, z], …], strands: [[a, b, r], …],
 * look, band }`, a bundle of round strands (each `r` thick, `a` and `b` out from the path's line in
 * the plane across it) run along a curve through `path`; `band` (`{ every, r }`), if given, a collar
 * round the bundle `r` thick each `every` metres, a bracket. Cables hang, sag and dangle; pipes run
 * along walls: the same thing drawn. One baked mesh for the lot, each look in its own paint
 * (`paintOf(look)`).
 */
export function cablesDrawn(cables, paintOf) {
  const group = new THREE.Group()
  const _t = new THREE.Vector3()
  const _u = new THREE.Vector3()
  const _v = new THREE.Vector3()
  const UP = new THREE.Vector3(0, 1, 0)
  const SIDE = new THREE.Vector3(1, 0, 0)
  for (const { path, strands, look, band } of cables) {
    if (!path || path.length < 2) continue
    const paint = paintOf(look)
    const points = path.map(([x, y, z]) => new THREE.Vector3(x, y, z))
    // The frame across the path at each point: u level and across it (or X where it runs upright), v the rest.
    const frames = points.map((p, i) => {
      _t.subVectors(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]).normalize()
      _u.crossVectors(Math.abs(_t.y) > 0.95 ? SIDE : UP, _t).normalize()
      _v.crossVectors(_t, _u)
      return { u: _u.clone(), v: _v.clone(), t: _t.clone() }
    })
    for (const [a, b, r] of strands) {
      const line = points.map((p, i) => p.clone().addScaledVector(frames[i].u, a).addScaledVector(frames[i].v, b))
      const curve = new THREE.CatmullRomCurve3(line)
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(240, points.length * 2), r, 6, false), paint)
      mesh.castShadow = mesh.receiveShadow = true
      group.add(mesh)
    }
    if (band) {
      const reach = Math.max(...strands.map(([a, b, r]) => Math.hypot(a, b) + r))
      let along = band.every / 2
      for (let i = 1; i < points.length; i++) {
        const seg = points[i].distanceTo(points[i - 1])
        for (; along <= seg; along += band.every) {
          const f = frames[i]
          const ring = new THREE.Mesh(new THREE.TorusGeometry(reach + band.r, band.r, 5, 12), paint)
          ring.position.lerpVectors(points[i - 1], points[i], along / seg)
          ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.t)
          ring.castShadow = ring.receiveShadow = true
          group.add(ring)
        }
        along -= seg
      }
    }
  }
  return bake(group)
}

// A park bench of the kind every yard had, at a man's size: concrete feet, three slats to sit on
// and two to lean on, its seat facing its own +Z, its origin on the ground under the seat's
// middle. The world meets it as one box the seat's size (`ParkourWorld`). Its sizes, for that box
// and for where he is sat (`seat`: the height his feet are put at).
export const BENCH = { length: 1.8, depth: 0.45, seat: 0.45, back: 0.9 }
// The brass plaque on its back: dull, and lit while it is where he would come back to.
const PLAQUE = { w: 0.24, h: 0.06, dull: celMaterial({ color: 0x8a6a2e, flatShading: true }), lit: neon.amber }

/**
 * A bench drawn in `wood` with feet of `frame`, both paints. Gives `{ group, plaque }`, the plaque
 * a mesh of its own so that it alone can be lit (`lightPlaque`).
 */
export function benchDrawn(wood, frame) {
  const { length, depth, seat, back } = BENCH
  const leg = length / 2 - 0.18
  const parts = new THREE.Group()
  for (const side of [-1, 1]) {
    parts.add(box(0.14, seat - 0.04, depth, frame, side * leg, (seat - 0.04) / 2, 0))
    parts.add(box(0.07, back - seat, 0.06, frame, side * leg, (seat + back) / 2, -depth / 2 + 0.03))
  }
  for (let n = 0; n < 3; n++) parts.add(box(length, 0.04, 0.13, wood, 0, seat - 0.02, -depth / 2 + 0.075 + n * 0.15))
  for (let n = 0; n < 2; n++) parts.add(box(length, 0.11, 0.03, wood, 0, seat + 0.2 + n * 0.19, -depth / 2 + 0.075))
  const group = new THREE.Group()
  group.add(bake(parts))
  const plaque = box(PLAQUE.w, PLAQUE.h, 0.01, PLAQUE.dull, 0, seat + 0.39, -depth / 2 + 0.096)
  group.add(plaque)
  return { group, plaque }
}

/** A bench's plaque lit, or dull again. */
export function lightPlaque(plaque, lit) {
  plaque.material = lit ? PLAQUE.lit : PLAQUE.dull
}

// Where a courier's parcel is waiting, or wanted: a tall column of pale blue light, seen from far
// off across a place. Pale blue, as no red (a blast's) or green (a gate's) may be; bright enough
// at its core to bloom. Its sizes are guesses.
const BEAM = { radius: 1.4, height: 90 }
const BEAM_PAINT = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbfe4ff).multiplyScalar(0.9), transparent: true, opacity: 0.38,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })

/** A beam standing on the ground at `at`, hidden until shown. */
export function beamDrawn(at) {
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(BEAM.radius * 0.6, BEAM.radius, BEAM.height, 16, 1, true), BEAM_PAINT) // open-ended, narrowing upward
  beam.position.set(at.x, at.y + BEAM.height / 2, at.z)
  beam.visible = false
  return beam
}

// A checkpoint of a place (`checkpoints`, `speed-gates.js`), as the editor shows it: a post at its
// feet, the ring it is passed within, and an arrow the way a flying start from it goes. Unlit and
// blue (red is what blows up and green a gate); hidden in play (`ParkourWorld.markersShown`).
const CHECKPOINT_PAINT = new THREE.MeshBasicMaterial({ color: 0x4f8dff, transparent: true, opacity: 0.75, depthWrite: false })
export function checkpointDrawn({ x, y, z, yaw = 0, radius = 6 }) {
  const group = new THREE.Group()
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 8), CHECKPOINT_PAINT)
  post.position.y = 1.5
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.12, 6, 48), CHECKPOINT_PAINT)
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.1
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2, 12), CHECKPOINT_PAINT)
  arrow.rotation.x = Math.PI / 2 // its tip along +Z, turned with the group
  arrow.position.set(0, 3, 1)
  group.add(post, ring, arrow)
  group.position.set(x, y, z)
  group.rotation.y = yaw
  return group
}

// A cut of a place (`cuts`, `form-cut.js`), as the editor shows it: the sweep it takes out, see-through
// and edged. Cyan and unlit (red is what blows up and green a gate); hidden in play
// (`ParkourWorld.markersShown`), and never met.
const CUT_PAINT = new THREE.MeshBasicMaterial({ color: 0x3fd8e8, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, fog: false })
const CUT_EDGE = new THREE.LineBasicMaterial({ color: 0x8ff0ff, transparent: true, opacity: 0.9, fog: false })
export function cutDrawn(cut) {
  const { positions } = buildForm(asCutter(cut))
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const group = new THREE.Group()
  const volume = new THREE.Mesh(geometry, CUT_PAINT)
  volume.renderOrder = 2 // over what it cuts
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), CUT_EDGE)
  edges.renderOrder = 2
  group.add(volume, edges)
  return group
}

// A place's lights (`lights`, `places.js`): real light, coloured and falling off as light does,
// each with its fitting drawn glowing in its colour. None casts a shadow: the sun alone does.
// Stood once with the place (`ParkourWorld.load`) and never after, since a light added or taken
// away in play has every lit material rebuilt (`docs/internals/picture.md`).
// A light with a `role` is the place's own to turn up and down (`ParkourWorld.showRoom`), so
// it has no fitting: what it comes from is drawn by whatever plays it (a television, a door).
// Nor has one whose `head` is false: light from what is not drawn as a lamp (the dusk at a window).
const FITTING = { w: 1.2, h: 0.4, d: 1.2 }
const _fittings = new Map() // a fitting's glow by colour, shared by every place
export function lightsDrawn(lights) {
  const group = new THREE.Group()
  const byRole = {}
  for (const { kind = 'point', x, y, z, color, power, reach = 0, to, angle = 0.6, soft = 0.4, head, role } of lights) {
    const hex = new THREE.Color(color).getHex()
    const light = kind === 'spot' ? new THREE.SpotLight(hex, power, reach, angle, soft, 2) : new THREE.PointLight(hex, power, reach, 2)
    light.position.set(x, y, z)
    group.add(light)
    if (kind === 'spot') {
      light.target.position.set(to.x, to.y, to.z)
      group.add(light.target)
    }
    if (role) byRole[role] = { light, power }
    if (role || head === false) continue
    if (!_fittings.has(hex)) _fittings.set(hex, neonPaint(hex))
    const { w, h, d } = { ...FITTING, ...head }
    group.add(box(w, h, d, _fittings.get(hex), x, y, z))
  }
  return { group, byRole }
}
