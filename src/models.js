// Shared low-poly materials and the courier's body and smoking props. Models face +Z.

import * as THREE from 'three'
import { celMaterial } from './shading.js'
import { bodyPaint, dressMan, manJoints } from './man.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const lambert = (color) => celMaterial({ color, flatShading: true })
const glow = (color) => new THREE.MeshBasicMaterial({ color })

/** Materials shared by the place, the courier and its inhabitants. */
export const materials = {
  suit: lambert(0x2457d6),
  stripe: celMaterial({ color: 0xf4f4f4, emissive: 0x6a6a6a, flatShading: true }),
  skin: lambert(0xe2b08b),
  cap: lambert(0x2b2b33),
  gold: lambert(0xd8b040),
  membrane: celMaterial({ color: 0x163a9a, flatShading: true, side: THREE.DoubleSide }),
  // The cigarette reads off-white in the megastructure's changing light.
  paper: celMaterial({ color: 0x403e3a, emissive: 0xa09c94, flatShading: true }),
  filter: celMaterial({ color: 0x3a2814, emissive: 0x8a5c30, flatShading: true }),
  ash: lambert(0x8d8a86),
  // A cigar's leaf, band and case.
  wrapper: celMaterial({ color: 0x4a2b1a, emissive: 0x2e1a0f, flatShading: true }),
  lacquer: celMaterial({ color: 0x14110f, emissive: 0x0b0908, flatShading: true }),
  ember: glow(0xff7a1a),
  flame: glow(0xffc24a),
  lighter: lambert(0xd03a3a),
  steel: lambert(0x9aa3b0),
  concrete: lambert(0x5d6470),
  curb: lambert(0x8a919c),
  // The matches: pale wood, a red-brown head, the box's card and the black strip it is struck on.
  matchWood: lambert(0xd9c08a),
  matchHead: lambert(0xa8321e),
  matchCard: lambert(0x8a5a2e),
  matchDrawer: lambert(0xd9c08a),
  matchLabel: lambert(0xe8dcc0),
  matchStrip: lambert(0x2a2220),
  asphalt: lambert(0x23272f),
  rust: lambert(0x8a5a44),
  warmLight: glow(0xffe2a0),
  amberLight: glow(0xffa320),
  gateLight: glow(0x7dffb0),
}
// Nearly every line below names a material, so in this file the palette goes by one letter.
const M = materials

// A saturated colour is dim by the bloom's measure, so a neon lamp's is pushed this far past
// full to clear the threshold as a white lamp does. On screen it only clips to the pure colour.
const NEON_BRIGHTNESS = 2.2
/**
 * The lamps that trace the city's paths, by name.
 */
export const neon = Object.fromEntries(
  Object.entries({ blue: 0x2a9cff, magenta: 0xe040ff, violet: 0x8a7cff, amber: 0xffc840, orange: 0xff5a10, ice: 0xbfe4ff }).map(([name, hex]) => [name, neonPaint(hex)]),
)
/** A lamp's glow in any colour, as bright past full as the neon's: a place's light's fitting (`place-drawn.js`). */
export function neonPaint(hex) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(NEON_BRIGHTNESS) })
}
/** All of them, for whatever takes its pick. */
export const neonLights = Object.values(neon)

// What baked models are drawn with: each vertex carries the colour of the material it was built in.
const PAINTED = celMaterial({ vertexColors: true, flatShading: true })
const LIT = new THREE.MeshBasicMaterial({ vertexColors: true })

/**
 * Collapses a freshly built, unplaced group into as few meshes as it can be drawn with: one
 * for everything painted, one for everything that glows (kept apart so it can go dark when
 * the model burns), and one for each texture, so that a model's signs are drawn together.
 * See-through meshes pass through as they are. Hundreds of little boxes are cheap to describe
 * but each costs a draw call; this keeps the first and drops the second.
 *
 * `source` is used up: its geometries are disposed, so it cannot be baked or shown again. Of
 * a baked part's material only the colour survives, as paint: all painted parts are drawn
 * with one shared material and all glowing parts with another, so emissive and the like are
 * lost. A part joins the glowing mesh only if it was marked with `asLight`.
 */
export function bake(source) {
  source.updateMatrixWorld(true)
  const painted = []
  const lit = []
  const textured = new Map() // material → its parts, the lights among them kept apart
  const baked = new THREE.Group()
  source.traverse((object) => {
    if (!object.isMesh) return
    const { geometry, material } = object
    if (material.transparent) {
      const kept = new THREE.Mesh(geometry, material)
      kept.applyMatrix4(object.matrixWorld)
      kept.userData = object.userData
      baked.add(kept)
      return
    }
    const part = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    geometry.dispose()
    part.applyMatrix4(object.matrixWorld)
    if (material.map) {
      if (!textured.has(material)) textured.set(material, { plain: [], light: [] })
      textured.get(material)[object.userData.light ? 'light' : 'plain'].push(part)
      return
    }
    const colors = new Float32Array(part.attributes.position.count * 3)
    for (let i = 0; i < colors.length; i += 3) material.color.toArray(colors, i)
    part.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    ;(object.userData.light ? lit : painted).push(part)
  })
  if (painted.length > 0) {
    // Only the painted mesh takes part in the sun's shadows; lamps, signs and beams do not.
    const mesh = new THREE.Mesh(indexedForDrawing(mergeGeometries(painted)), PAINTED)
    mesh.castShadow = mesh.receiveShadow = true
    baked.add(mesh)
  }
  if (lit.length > 0) baked.add(asLight(new THREE.Mesh(indexedForDrawing(mergeGeometries(lit)), LIT)))
  for (const [material, { plain, light }] of textured) {
    if (plain.length > 0) baked.add(new THREE.Mesh(indexedForDrawing(mergeGeometries(plain)), material))
    if (light.length > 0) baked.add(asLight(new THREE.Mesh(indexedForDrawing(mergeGeometries(light)), material)))
    for (const part of [...plain, ...light]) part.dispose()
  }
  for (const part of [...painted, ...lit]) part.dispose()
  return baked
}

// Gives a geometry built as loose triangles an index that names each corner in turn. Nothing
// is shared, but where Chrome draws through OpenGL (a Mac without Metal for it) loose triangles
// came to the card about 150 times slower than indexed ones. Returns the geometry.
export function indexedForDrawing(geometry) {
  if (geometry.index) return geometry
  const count = geometry.attributes.position.count
  const index = count > 65535 ? new Uint32Array(count) : new Uint16Array(count)
  for (let i = 0; i < count; i++) index[i] = i
  geometry.setIndex(new THREE.BufferAttribute(index, 1))
  return geometry
}

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  return mesh
}

export function cylinder(radius, height, material, x = 0, y = 0, z = 0, sides = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), material)
  mesh.position.set(x, y, z)
  return mesh
}

/** A cylinder of `radius` whose axis runs from the point `a` to the point `b` (each `{ x, y, z }`), any way up. */
export function pipe(a, b, radius, material, sides = 8) {
  const along = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, along.length(), sides), material)
  mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
  if (along.lengthSq() > 1e-12) mesh.quaternion.setFromUnitVectors(UP, along.normalize())
  return mesh
}

/** A square-section box, `size` by `size`, along the line from the point `a` to the point `b`. */
export function beam(a, b, size, material) {
  const along = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z)
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, along.length(), size), material)
  mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
  if (along.lengthSq() > 1e-12) mesh.quaternion.setFromUnitVectors(UP, along.normalize())
  return mesh
}

/**
 * Marks a mesh as a light, and returns it. `bake` gathers the marked meshes into the glowing
 * mesh, which keeps the mark; `charStructure` switches marked meshes off where it chars the
 * rest. The mark is `userData.light`, which nothing outside this file reads.
 */
export function asLight(mesh) {
  mesh.userData.light = true
  return mesh
}

// A length of something round lying along +Z, from `from` to `to`, `r` across at its near end
// and `rTo` at its far one.
function lengthOf(r, from, to, material, rTo = r) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTo, r, to - from, 10), material)
  mesh.rotation.x = Math.PI / 2
  mesh.position.z = (from + to) / 2
  return mesh
}

/**
 * A cigarette lying along +Z from its filter at the origin; returns `{ group, ember }`.
 * `ember` is the burning end, ash ring included: hide it for an unlit one.
 * Keep its size fixed; clone its glow materials for any per-cigarette brightness changes.
 */
// A little fuller than measured stock so the paper survives the low-resolution picture.
export const CIGARETTE_ASPECT = 18.5 // length divided by radius
export function createCigarette(length = 0.2, radius = length / CIGARETTE_ASPECT) {
  const group = new THREE.Group()
  const paperFrom = length * 0.27 // a shorter 23–27 mm filter on an 84 mm cigarette
  const paperLength = length - paperFrom
  const paper = lengthOf(radius, paperFrom, length, M.paper)
  group.add(
    lengthOf(radius, 0, length * 0.26, M.filter),
    lengthOf(radius * 1.03, length * 0.26, paperFrom, M.gold),
    paper,
  )

  const ember = new THREE.Group()
  ember.position.z = length
  const ash = lengthOf(radius * 1.04, 0, radius * 1.2, M.ash)
  ember.add(
    ash,
    lengthOf(radius * 1.02, -radius * 0.9, radius * 0.5, M.ember),
    lengthOf(radius * 0.7, radius * 0.5, radius * 0.8, M.flame),
  )
  group.add(ember)
  return {
    group, ember,
    // Keep the filter fixed in the lips or fingers; only the paper, coal and ash recede.
    setBurn(used, ashGrown = 0) {
      const left = Math.max(0, 1 - used)
      const paperLeft = paperLength * left
      paper.scale.y = Math.max(0.001, left)
      paper.position.z = paperFrom + paperLeft / 2
      ember.position.z = paperFrom + paperLeft
      ash.scale.y = Math.max(0.001, ashGrown)
      ash.position.z = radius * 0.6 * ashGrown
    },
  }
}

// Where a cigar's band lies, as fractions of its length from the head: clear of the fingers,
// which hold it nearer the head.
const BAND = [0.34, 0.5]
const ASH_RADII = 2.2 // how long the ash stands on a cigar, in its own radii

/**
 * A cigar, the cigarette of whoever has nothing left to earn, to the same contract as
 * `createCigarette`: along +Z from its head (the end in the mouth) at the origin, the leaf
 * ending at `length`, and `ember` the coal there with the long ash beyond it. A maduro with a
 * rounded head and one wide black band edged in gold, a gold crest on it: the owner's pick
 * from mockups.
 */
export function createCigar(length = 0.26, radius = 0.023) {
  const group = new THREE.Group()
  const [bandFrom, bandTo] = BAND.map((at) => at * length)
  const edge = (bandTo - bandFrom) * 0.12
  const crestAt = (bandFrom + bandTo) / 2
  group.add(
    lengthOf(radius * 0.55, 0, radius * 0.5, M.wrapper, radius * 0.9),
    lengthOf(radius * 0.9, radius * 0.5, radius * 1.1, M.wrapper, radius),
    lengthOf(radius, radius * 1.1, length, M.wrapper),
    lengthOf(radius * 1.05, bandFrom, bandTo, M.lacquer),
    lengthOf(radius * 1.08, bandFrom, bandFrom + edge, M.gold),
    lengthOf(radius * 1.08, bandTo - edge, bandTo, M.gold),
  )
  // The crest is on four sides, so that one faces the eye however the cigar is turned.
  for (const turn of [0, Math.PI / 2]) {
    const crest = cylinder(radius * 0.5, radius * 2.2, M.gold, 0, 0, crestAt, 8)
    crest.rotation.z = turn
    group.add(crest)
  }

  const ember = new THREE.Group()
  ember.position.z = length
  ember.add(
    lengthOf(radius * 1.02, -radius * 0.5, radius * 0.1, M.ember),
    lengthOf(radius * 0.8, radius * 0.1, radius * 0.25, M.flame),
    lengthOf(radius * 0.97, radius * 0.1, radius * ASH_RADII * 0.8, M.ash, radius * 0.92),
    lengthOf(radius * 0.92, radius * ASH_RADII * 0.8, radius * ASH_RADII, M.ash, radius * 0.6),
  )
  group.add(ember)
  return { group, ember }
}

const CIGAR_LONGER = 1.3 // a cigar's length and girth beside the cigarette whose place it takes
const CIGAR_FATTER = 1.45

/**
 * What he smokes, wherever one is held, thrown or dropped: a cigarette of the size given and,
 * in the same place and hidden until `setCigars(true)`, the cigar that takes its place. Returns
 * `{ group, cigarette, cigar, ember, setCigars }`: `cigarette` and `cigar` are each as their
 * builder returns them (an ember's `position.z` is how long that one is), and `ember` is the
 * burning end of whichever is shown.
 */
export function createSmoke(length, radius) {
  const cigarette = createCigarette(length, radius)
  const cigar = createCigar(length * CIGAR_LONGER, radius * CIGAR_FATTER)
  const group = new THREE.Group()
  group.add(cigarette.group, cigar.group)
  const smoke = {
    group,
    cigarette,
    cigar,
    ember: cigarette.ember,
    setBurn(used, ashGrown = 0) { cigarette.setBurn(used, ashGrown) },
    setCigars(on) {
      cigar.group.visible = on
      cigarette.group.visible = !on
      smoke.ember = on ? cigar.ember : cigarette.ember
    },
  }
  smoke.setCigars(false)
  return smoke
}

// The rounded head. Smooth twins of the palette (same colours, no facets) so the cel steps band
// over his curves. The skin, the suit and the ink are the body's too, and are owned by `man.js`.
const smooth = (color, options) => celMaterial({ color, ...options })
const S = {
  skin: bodyPaint.skin,
  suit: bodyPaint.suit,
  ink: bodyPaint.ink, // brows, pupils and the lines of the grin: black whatever the suit
  hair: smooth(0x1c1512),
  white: smooth(0xe8e8e8, { emissive: 0x181818 }), // eye glints: a broad white kept under the bloom
  teeth: smooth(0x707070, { emissive: 0xb4b4b4 }), // mostly its own light, or the cel steps turn it grey
  mouth: smooth(0x4a201c),
  nose: smooth(0xe0452f), // not the game's blast red: that means "blows up"
  cheek: smooth(0xe8907a),
  sclera: smooth(0xe0e0e0),
}

const UP = new THREE.Vector3(0, 1, 0)
const FORWARD_AXIS = new THREE.Vector3(0, 0, 1)

/** An ellipsoid of `radius`, stretched by `(sx, sy, sz)`, centred on `(x, y, z)`. */
function blob(radius, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), material)
  mesh.position.set(x, y, z)
  mesh.scale.set(sx, sy, sz)
  return mesh
}

/** A capsule whose two end-cap centres are `a` and `b`. */
function rod(a, b, radius, material) {
  const along = new THREE.Vector3().subVectors(b, a)
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(along.length(), 1e-4), 3, 8), material)
  mesh.position.addVectors(a, b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(UP, along.normalize())
  return mesh
}

const HEAD_CENTER = new THREE.Vector3(0, 0.2, 0)
const HEAD_RADIUS = 0.2
const HEAD_WIDTH = 1.08 // the skull is a touch wider than it is tall

/** The way the face looks out at `(x, y, z)`. */
function faceNormal(point) {
  return new THREE.Vector3(point.x / HEAD_WIDTH ** 2, point.y - HEAD_CENTER.y, point.z).normalize()
}

/** The point of the face at `(x, y)` seen from the front, `lift` proud of the skin. */
function onHead(x, y, lift = 0) {
  const z = Math.sqrt(Math.max(HEAD_RADIUS ** 2 - (x / HEAD_WIDTH) ** 2 - (y - HEAD_CENTER.y) ** 2, 0))
  const point = new THREE.Vector3(x, y, z)
  return point.addScaledVector(faceNormal(point), lift)
}

/** A line of capsules laid along the face through the `[x, y]` points, so it follows the curve of the head. */
function strokeOnHead(points, radius, material, lift = 0) {
  const group = new THREE.Group()
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.03)
    let previous = onHead(x0, y0, lift)
    for (let s = 1; s <= steps; s++) {
      const next = onHead(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps, lift)
      group.add(rod(previous, next, radius, material))
      previous = next
    }
  }
  return group
}

/** A smooth tube of `radius` laid along the face through the `[x, y]` points, `lift` proud of the skin. */
function lineOnHead(points, radius, material, lift = 0) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => onHead(x, y, lift)))
  return new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 3, radius, 6, false), material)
}

// Thin things lying on the skin that must not shade themselves: a shadow across them jags the line.
const unshadowed = new WeakSet()
const withoutShadow = (part) => {
  part.traverse((mesh) => unshadowed.add(mesh))
  return part
}
const castsShadow = (root) =>
  root.traverse((part) => {
    if (part.isMesh) part.castShadow = part.receiveShadow = !unshadowed.has(part)
  })

/** A flat oval lying on the face at `(x, y)`, `w` by `h`, turned `tilt` radians in its own plane. */
function ovalOnHead(x, y, w, h, tilt, material, lift = -0.002) {
  const at = onHead(x, y, lift)
  const mesh = blob(1, material, at.x, at.y, at.z, w, h, 0.012)
  mesh.quaternion.setFromUnitVectors(FORWARD_AXIS, faceNormal(at))
  mesh.rotateZ(tilt)
  return mesh
}

// The grin's U, as heights up the face at a fraction `t` of the way from cheek to cheek. Where the
// cigarette is clamped, at `BITE`, both edges bend away from it.
const grinAcross = (t) => -0.18 + 0.36 * t
const grinTop = (t) => 0.14 + 0.05 * (2 * t - 1) ** 2
const grinBottom = (t) => grinTop(t) - (0.04 + 0.035 * Math.sin(Math.PI * t) ** 0.5)
const BITE = 0.9
const biteAt = (t) => 0.006 * Math.exp(-(((t - BITE) / 0.05) ** 2))
const CIGARETTE_LEAN = new THREE.Vector3(0.78, 0.22, 0.58) // mostly out toward +X, a little up: it has to read in silhouette
const CIGARETTE_IN = 0.03 // how far behind the teeth its butt end is

/** Clamps a cigarette (lying along its +Z from its butt) between the teeth at the grin's +X corner, in the head's space. */
export function clampCigarette(group) {
  const through = onHead(grinAcross(BITE), (grinTop(BITE) + grinBottom(BITE)) / 2, 0.004)
  const lean = CIGARETTE_LEAN.clone().normalize()
  group.position.copy(through).addScaledVector(lean, -CIGARETTE_IN)
  group.quaternion.setFromUnitVectors(FORWARD_AXIS, lean) // a cigarette lies along its +Z
}

// The ways he can have his eyes, each as what to lay on one side of the face (+1 his left, +X) and how far
// to move that side's brow, which every style keeps. All sit where the slits do, under the brows.
const EYE_LOOKS = {
  slits: {
    brow: () => 0,
    eye: (side) => [
      ovalOnHead(side * 0.115, 0.242, 0.075, 0.026, side * 0.1, S.sclera, 0),
      ovalOnHead(side * 0.115 + 0.014, 0.241, 0.02, 0.022, 0, S.ink, 0.006),
    ],
  },
  ovals: {
    brow: () => 0,
    eye: (side) => {
      const tall = side > 0 ? 0.0247 : 0.029
      const wide = side > 0 ? 0.0195 : 0.0225
      const y = 0.264 - tall
      return [
        ovalOnHead(side * 0.115, y, wide, tall, 0, S.ink, 0.004),
        ovalOnHead(side * 0.115 - 0.007, y + tall * 0.45, 0.0065, 0.0065, 0, S.white, 0.012),
      ]
    },
  },
  dots: {
    brow: () => -0.009,
    eye: (side) => [ovalOnHead(side * 0.115, 0.24, 0.024, 0.024, 0, S.ink, 0.004)],
  },
  arcs: {
    brow: () => 0.006,
    eye: (side) => {
      const points = Array.from({ length: 9 }, (_, i) => {
        const u = (i - 4) / 4
        return [side * 0.115 + 0.035 * u, 0.228 + 0.022 * (1 - u * u)]
      })
      return [withoutShadow(lineOnHead(points, 0.009, S.ink, 0.006))]
    },
  },
  wide: {
    brow: (side) => (side > 0 ? -0.006 : 0.004), // lower over the squinting +X eye, higher over the other
    eye: (side) => {
      const ex = side * 0.105
      const parts = [ovalOnHead(ex, 0.233, 0.057, 0.033, 0, S.sclera, 0), ovalOnHead(ex + 0.014, 0.229, 0.02, 0.022, 0, S.ink, 0.006)]
      if (side > 0) {
        // half closed: skin over the top third of the white, and the lid a flat dark line along it
        parts.push(ovalOnHead(ex, 0.255, 0.06, 0.013, 0, S.skin, 0.008))
        parts.push(withoutShadow(lineOnHead([[ex - 0.056, 0.243], [ex - 0.02, 0.2435], [ex + 0.02, 0.2435], [ex + 0.056, 0.243]], 0.0035, S.ink, 0.012)))
      } else {
        const lid = Array.from({ length: 9 }, (_, i) => {
          const a = Math.PI * (1 - i / 8)
          return [ex + 0.057 * Math.cos(a), 0.233 + 0.033 * Math.sin(a)]
        })
        parts.push(withoutShadow(lineOnHead(lid, 0.003, S.ink, 0.008)))
      }
      return parts
    },
  },
}
export const EYE_STYLES = Object.keys(EYE_LOOKS)

// His head, facing +Z, from the neck at the origin up: drawn like an old cartoon. A round head
// with a cap of hair and tufts poking up, a big red ball nose, rosy cheeks, narrow eyes under
// heavy brows, and an enormous grin of teeth with the cigarette stuck in one corner of it (`createPlayer`
// mounts it there). Built to the skull's own measure, then scaled down a little on the body:
// the owner found it big on the man from the mesh.
const HEAD_SCALE = 0.88
function playerHead(eyes = 'dots') {
  const head = new THREE.Group()
  head.scale.setScalar(HEAD_SCALE)
  head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.075, 0.22, 14), S.skin).translateY(-0.01))
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.024, 8, 20), S.suit)
  collar.rotation.x = Math.PI / 2
  collar.position.y = -0.045
  head.add(collar)

  // A zone of the skull's sphere between two polar angles, a little proud of it: the cap of hair, the band, its stripes.
  const zone = (thickness, from, to, material) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(HEAD_RADIUS * thickness, 40, 6, 0, Math.PI * 2, from, to - from), material)
    mesh.position.copy(HEAD_CENTER)
    mesh.scale.x = HEAD_WIDTH
    return mesh
  }
  const skull = new THREE.Mesh(new THREE.SphereGeometry(HEAD_RADIUS, 40, 24), S.skin)
  skull.position.copy(HEAD_CENTER)
  skull.scale.x = HEAD_WIDTH
  head.add(skull)
  for (const side of [1, -1]) head.add(blob(0.045, S.skin, side * 0.215, 0.2, -0.01, 0.6, 1.2, 1))

  // Hair: a cap down to the hairline, with a few tufts poking up.
  head.add(zone(1.04, 0, 0.84, S.hair))
  for (const [x, z, lean, length] of [[-0.06, 0.03, -0.45, 0.1], [0.0, -0.03, 0, 0.07], [0.07, 0.0, 0.5, 0.11], [-0.03, -0.1, -0.2, 0.065]]) {
    const root = new THREE.Vector3(x, 0.385, z)
    const tilt = 0.44 // tipped back about 25 degrees
    head.add(rod(root, root.clone().add(new THREE.Vector3(lean * 0.06, length * Math.cos(tilt), -length * Math.sin(tilt))), 0.02, S.hair))
  }

  // Eyes tucked right under heavy straight brows that slant toward the nose.
  const look = EYE_LOOKS[eyes] ?? EYE_LOOKS.slits
  for (const side of [1, -1]) {
    for (const part of look.eye(side)) head.add(part)
    const lift = look.brow(side) + 0.012
    head.add(strokeOnHead([[side * 0.175, 0.277 + lift], [side * 0.065, 0.263 + lift]], 0.0112, S.ink, 0.008))
  }

  // Rosy cheeks, bulging beside the nose; and the nose itself, a big red ball pushed well out.
  for (const side of [1, -1]) {
    const at = onHead(side * 0.155, 0.19)
    const cheek = blob(0.03, S.cheek, at.x, at.y, at.z, 1, 1, 0.45)
    cheek.quaternion.setFromUnitVectors(FORWARD_AXIS, faceNormal(at))
    head.add(cheek)
  }
  const nose = onHead(0, 0.2, 0.045)
  head.add(blob(0.061, S.nose, nose.x, nose.y, nose.z))

  // The grin: one U of teeth from cheek to cheek, its corners up at the cheeks' outer sides and its bottom
  // well clear of the chin; edged in black above and, finer, below, and divided by fine lines in the middle.
  const across = grinAcross
  const top = (t) => grinTop(t) + biteAt(t)
  const bottom = (t) => grinBottom(t) - biteAt(t)
  const curve = (f, steps = 20) => Array.from({ length: steps + 1 }, (_, i) => [across(i / steps), f(i / steps)])
  // The teeth are one ribbon laid on the skull between the two edge curves: smooth edges, no ribs.
  const columns = 48
  const rows = 4
  const positions = []
  for (let i = 0; i <= columns; i++) {
    const t = i / columns
    for (let j = 0; j <= rows; j++) {
      const at = onHead(across(t), top(t) + ((bottom(t) - top(t)) * j) / rows, 0.004)
      positions.push(at.x, at.y, at.z)
    }
  }
  const indices = []
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j
      const b = (i + 1) * (rows + 1) + j
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const ribbon = new THREE.BufferGeometry()
  ribbon.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  ribbon.setIndex(indices)
  ribbon.computeVertexNormals()
  head.add(withoutShadow(new THREE.Mesh(ribbon, S.teeth)))
  const bite = withoutShadow(blob(1, S.mouth, 0, 0, 0, 0.016, 0.014, 0.004)) // the lips closing round the cigarette
  const through = onHead(across(BITE), (grinTop(BITE) + grinBottom(BITE)) / 2, 0.005)
  bite.position.copy(through)
  bite.quaternion.setFromUnitVectors(FORWARD_AXIS, faceNormal(through))
  head.add(bite)
  head.add(withoutShadow(lineOnHead(curve(top), 0.004, S.ink, 0.006)))
  head.add(withoutShadow(lineOnHead(curve(bottom), 0.002, S.ink, 0.006)))
  for (const t of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    head.add(withoutShadow(lineOnHead(Array.from({ length: 6 }, (_, i) => [across(t), bottom(t) + ((top(t) - bottom(t)) * i) / 5]), 0.0016, S.ink, 0.0105)))
  }
  return head
}

// Joints of the courier's visible body.
const part = (at) => {
  const group = new THREE.Group()
  group.position.copy(at)
  return group
}
const middle = (a, b) => a.clone().add(b).multiplyScalar(0.5)

const ARM_SPREAD = 1.3
const LEG_SPREAD = 0.3

/**
 * The same man cut at the joints, for throwing about: every part is a group with its origin at
 * the joint it hangs from and its length down its own -Y, left where it was built for whoever
 * owns it to place and turn. `torso` hangs from the middle of the shoulders and faces +Z;
 * `head` rises from the neck. `limbs` is one `{ upperArm, forearm, thigh, shin }` per side,
 * +X first. `joints` is where each joint is on him standing, feet at the origin: `head` (its
 * middle), `neck`, and per side `shoulder`, `elbow`, `hand`, `hip`, `knee`, `foot`. The lengths
 * of the parts are the distances between them.
 */
export function createRagdollDoll() {
  const joints = manJoints()
  const root = new THREE.Group()
  const torso = new THREE.Group()
  const head = playerHead()
  const limbs = joints.sides.map(() => ({ upperArm: new THREE.Group(), forearm: new THREE.Group(), thigh: new THREE.Group(), shin: new THREE.Group() }))
  root.add(torso, head, ...limbs.flatMap((limb) => Object.values(limb)))
  castsShadow(root)
  root.add(dressMan({ torso, head, sides: limbs }))
  return { root, torso, head, limbs, joints }
}

/**
 * The player as seen from outside: a man in a blue three-stripe tracksuit with wingsuit
 * membranes and a cigarette in his mouth.
 * `eyes` is one of `EYE_STYLES`.
 * `setPose(t)` blends from standing (0) to spread-eagled flight along +Z (1).
 * `setHands(t)` brings both hands up to the mouth, t in [0, 1] — lighting up, or taking the cigarette.
 * `setCigarette(visible, lit)` shows what is in his mouth.
 * `setCigars(on)` makes that a cigar, or a cigarette again.
 * `emberWorld(out)` writes the cigarette tip's world position.
 */
export function createPlayer({ eyes = 'dots' } = {}) {
  const joints = manJoints()
  const SHOULDER = joints.sides[0].shoulder
  const HIP = joints.sides[0].hip
  const ARM_LENGTH = joints.lengths.upperArm + joints.lengths.forearm
  const LEG_LENGTH = joints.lengths.thigh + joints.lengths.shin
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)

  const torso = part(middle(joints.sides[0].shoulder, joints.sides[1].shoulder))
  body.add(torso)

  const head = playerHead(eyes)
  head.position.copy(joints.neck)
  const cigarette = createSmoke(0.14, 0.14 / CIGARETTE_ASPECT)
  clampCigarette(cigarette.group)
  cigarette.group.scale.setScalar(1 / HEAD_SCALE) // a real cigarette in a head drawn smaller
  head.add(cigarette.group)
  body.add(head)

  // Each arm and leg hangs from its joint, the forearm and the shin from the end of the upper part.
  const arms = []
  const legs = []
  const sides = joints.sides.map((stands) => {
    const upperArm = part(stands.shoulder)
    const forearm = part(new THREE.Vector3(0, -joints.lengths.upperArm, 0))
    upperArm.add(forearm)
    const thigh = part(stands.hip)
    const shin = part(new THREE.Vector3(0, -joints.lengths.thigh, 0))
    thigh.add(shin)
    body.add(upperArm, thigh)
    arms.push(upperArm)
    legs.push(thigh)
    return { upperArm, forearm, thigh, shin }
  })

  // Three triangles: one under each arm, one between the legs. Rebuilt per pose.
  const membranePositions = new THREE.BufferAttribute(new Float32Array(27), 3)
  const membraneGeometry = new THREE.BufferGeometry()
  membraneGeometry.setAttribute('position', membranePositions)
  const membrane = new THREE.Mesh(membraneGeometry, M.membrane)
  membrane.frustumCulled = false
  body.add(membrane)

  let pose = -1
  let hands = 0

  function applyHands() {
    for (const arm of arms) arm.rotation.x = -hands * 2.3 * (1 - pose * 0.6)
  }

  function setPose(t) {
    if (t === pose) return
    pose = t
    const armAngle = t * ARM_SPREAD
    const legAngle = t * LEG_SPREAD

    // Pitch the body flat and slide it back so the root sits at its middle.
    body.rotation.x = (t * Math.PI) / 2
    body.position.set(0, 0, -t * 0.9)
    head.rotation.x = -t * 1.1

    const p = membranePositions
    let i = 0
    const feet = []
    arms.forEach((arm, index) => {
      const side = index === 0 ? 1 : -1
      arm.rotation.z = side * armAngle
      legs[index].rotation.z = side * legAngle
      p.setXYZ(i++, side * SHOULDER.x, SHOULDER.y, 0)
      p.setXYZ(i++, side * (SHOULDER.x + ARM_LENGTH * Math.sin(armAngle)), SHOULDER.y - ARM_LENGTH * Math.cos(armAngle), 0)
      p.setXYZ(i++, side * (HIP.x + 0.1), HIP.y - 0.25, 0)
      feet.push([side * (HIP.x + LEG_LENGTH * Math.sin(legAngle)), HIP.y - LEG_LENGTH * Math.cos(legAngle)])
    })
    p.setXYZ(i++, 0, HIP.y, 0)
    p.setXYZ(i++, feet[0][0], feet[0][1], 0)
    p.setXYZ(i++, feet[1][0], feet[1][1], 0)
    p.needsUpdate = true
    membraneGeometry.computeVertexNormals()
    membrane.visible = t > 0.05
    applyHands()
  }

  setPose(0)
  castsShadow(root)
  body.add(dressMan({ torso, head, sides })) // after the shadows: its stripes and laces take none

  return {
    root,
    setPose,
    setHands(t) {
      hands = t
      applyHands()
    },
    setCigarette(visible, lit) {
      cigarette.group.visible = visible
      cigarette.cigarette.ember.visible = cigarette.cigar.ember.visible = lit
    },
    // The head to one side (radians, to his left) and leant over. Nothing in play turns it:
    // a staged scene seen from outside does (`itch/choice.js`).
    turnHead(yaw, tilt = 0) {
      head.rotation.y = yaw
      head.rotation.z = tilt
    },
    setCigars: cigarette.setCigars,
    setBurn: cigarette.setBurn,
    mouthWorld:(out) => cigarette.group.getWorldPosition(out),
    emberWorld:(out) => cigarette.ember.getWorldPosition(out),
  }
}

export function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  paint(canvas.getContext('2d'))
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
