// What the gorge's machines (`machine-props.js`) are painted in: small textures drawn unfiltered,
// the way the room's props and the NPCs are (`npc-kit.js`'s `paint`), so their texels show.
// Each is a worn surface rather than a colour: rust in blotches and flakes with runs of it down
// the face, riveted plate with weeping rivets, paint peeling off to the rust under it, copper gone
// green, tarnished brass, sooty iron, chipped enamel, wood lagging, a rag, a grating, oily
// concrete. Each is made once and its material shared by every machine (`skin`), since `bake`
// draws each textured material as one mesh more; `tile` repeats one over a large part.
//
// A texture's u runs round a cylinder, a lathe or a torus and across a box's face; its v up it.
// Runs of rust and grime go down v. No red and no green light: what blows up and a gate. Look only.

import * as THREE from 'three'
import { celMaterial } from './shading.js'
import { paint } from './npc-kit.js'

// Lines straight down from somewhere in `from` (v), `length` long, as rust and grime run down a face.
function runs(b, color, { count = 10, alpha = 0.35, from = [0.2, 1], length = [0.1, 0.5], width = 1 } = {}) {
  for (let i = 0; i < count; i++) {
    const u = b.random()
    const v = from[0] + b.random() * (from[1] - from[0])
    const run = length[0] + b.random() * (length[1] - length[0])
    b.line([[u, v], [u + (b.random() - 0.5) * 0.02, v - run]], color, width, alpha * (0.5 + 0.5 * b.random()))
  }
}

// A row of rivets along `v`, one every `every` of the way round, each weeping rust under it now
// and then; one in `missing` is gone, its hole left.
function rivetRow(b, v, every, { missing = 0.1, weep = 0.4 } = {}) {
  for (let u = every / 2; u < 1; u += every) {
    if (b.random() < missing) {
      b.dot(u, v, 0.8, '#1e1410')
      continue
    }
    b.dot(u, v, 1.3, '#3a2216')
    b.dot(u - 0.006, v + 0.01, 0.6, '#b07a48')
    if (b.random() < weep) b.line([[u, v - 0.02], [u, v - 0.06 - b.random() * 0.12]], '#8a4a24', 1, 0.6)
  }
}

// Rust come through whatever lies over it, in patches with flakes at their edges.
function rustThrough(b, { count = 8, size = 7, alpha = 0.85 } = {}) {
  b.blotches('#6e4128', { count, size, alpha })
  b.blotches('#4a2a1a', { count: Math.ceil(count / 2), size: size * 0.6, alpha: alpha * 0.8 })
  for (let i = 0; i < count * 5; i++) b.dot(b.random(), b.random(), 0.6, b.random() < 0.5 ? '#8a5030' : '#3a2216', 0.8)
}

const DRAWN = {
  // Bare rusted steel: brown, flaking orange, dark pits, runs down it.
  rust: () => paint(64, 64, (b) => {
    b.fill('#6a3e26')
    b.blotches('#4a2a1a', { count: 16, size: 8, alpha: 0.55 })
    b.blotches('#94562c', { count: 12, size: 5, alpha: 0.5 })
    b.blotches('#b8763a', { count: 8, size: 2.5, alpha: 0.45 })
    for (let i = 0; i < 60; i++) b.dot(b.random(), b.random(), 0.6, '#2e1a10', 0.7)
    runs(b, '#3a2216', { count: 14, alpha: 0.4 })
    runs(b, '#a8622e', { count: 6, alpha: 0.3, width: 2 })
    b.grain(0.12)
  }, 101),
  // A boiler's plates: courses and staggered butt joints, their rivets weeping, runs of rust.
  riveted: () => paint(64, 64, (b) => {
    b.fill('#70432a')
    b.blotches('#4a2a1a', { count: 12, size: 9, alpha: 0.45 })
    b.blotches('#9a5a2e', { count: 10, size: 4, alpha: 0.4 })
    for (const v of [1 / 3, 2 / 3, 0.995]) {
      b.rect(0, v - 0.012, 1, v + 0.012, '#3a2216', 0.8)
      rivetRow(b, v - 0.04, 1 / 16)
    }
    for (const [v0, v1, at] of [[0, 1 / 3, 0.2], [1 / 3, 2 / 3, 0.7], [2 / 3, 1, 0.45]]) {
      b.rect(at - 0.006, v0, at + 0.006, v1, '#3a2216', 0.8)
      for (let v = v0 + 0.04; v < v1 - 0.02; v += 0.05) b.dot(at + 0.03, v, 1.1, '#3a2216')
    }
    runs(b, '#2e1a10', { count: 12, alpha: 0.35 })
    runs(b, '#a05e30', { count: 5, alpha: 0.3, width: 2 })
    b.grain(0.1)
  }, 103),
  // Teal paint, as on the painting's walls, peeling off to the rust under it.
  painted: () => paint(64, 64, (b) => {
    b.fill('#3c5752')
    b.blotches('#56766c', { count: 10, size: 9, alpha: 0.4 })
    b.blotches('#2a3e3a', { count: 8, size: 6, alpha: 0.4 })
    rustThrough(b, { count: 9, size: 7 })
    runs(b, '#4a2a1a', { count: 12, alpha: 0.45 })
    b.grain(0.1)
  }, 107),
  // Copper gone green, the copper showing where it is rubbed, runs of verdigris down it.
  verdigris: () => paint(64, 64, (b) => {
    b.fill('#4c7466')
    b.blotches('#6c9682', { count: 12, size: 7, alpha: 0.45 })
    b.blotches('#2e4c44', { count: 8, size: 6, alpha: 0.45 })
    b.blotches('#8c5c38', { count: 6, size: 4, alpha: 0.6 })
    rustThrough(b, { count: 4, size: 4, alpha: 0.6 })
    runs(b, '#86b098', { count: 8, alpha: 0.35 })
    runs(b, '#22362f', { count: 8, alpha: 0.35 })
    b.grain(0.1)
  }, 109),
  // Iron black with soot, lighter where it is rubbed, a little rust in the pits.
  soot: () => paint(64, 64, (b) => {
    b.fill('#2a2522')
    b.blotches('#3e3630', { count: 12, size: 8, alpha: 0.5 })
    b.blotches('#161210', { count: 10, size: 6, alpha: 0.5 })
    for (let i = 0; i < 40; i++) b.dot(b.random(), b.random(), 0.6, '#5a3020', 0.7)
    runs(b, '#100c0a', { count: 10, alpha: 0.5 })
    b.grain(0.14)
  }, 113),
  // Brass, tarnished dark, green in its corners, bright where hands have been.
  brass: () => paint(32, 32, (b) => {
    b.fill('#94763a')
    b.blotches('#5a4a24', { count: 8, size: 5, alpha: 0.55 })
    b.blotches('#5a7a5a', { count: 4, size: 3, alpha: 0.4 })
    b.blotches('#c8a456', { count: 4, size: 2, alpha: 0.5 })
    b.grain(0.1)
  }, 127),
  // Off-white enamel, grimy, chipped to black, rust weeping from the chips.
  enamel: () => paint(64, 64, (b) => {
    b.fill('#beb49a')
    b.blotches('#857a62', { count: 10, size: 9, alpha: 0.4 })
    b.blotches('#a29778', { count: 8, size: 5, alpha: 0.4 })
    for (let i = 0; i < 14; i++) {
      const [u, v] = [b.random(), b.random()]
      b.dot(u, v, 1 + b.random() * 1.5, '#2e2a26')
      b.line([[u, v - 0.02], [u, v - 0.08 - b.random() * 0.2]], '#7a4a2a', 1, 0.6)
    }
    runs(b, '#5e5646', { count: 10, alpha: 0.35 })
    b.grain(0.08)
  }, 131),
  // Boards round a cylinder, as a mill engine's is lagged: grey-brown, split, one gone dark.
  lagging: () => paint(64, 64, (b) => {
    b.fill('#6a5038')
    for (let i = 0; i < 12; i++) {
      const u = i / 12
      b.rect(u, 0, u + 1 / 12, 1, b.random() < 0.15 ? '#3a2c20' : b.random() < 0.5 ? '#7a5c40' : '#5e4630', 0.7)
      b.rect(u, 0, u + 0.008, 1, '#2a1e14', 0.9)
    }
    b.veins('#2a1e14', { count: 10, steps: 14, alpha: 0.5 })
    b.blotches('#3a2c20', { count: 8, size: 6, alpha: 0.4 })
    b.grain(0.12)
  }, 137),
  // A rag, a bandage of one round a leak: grey cloth, oil-dark, frayed.
  rag: () => paint(32, 32, (b) => {
    b.fill('#86806e')
    b.rows(3, '#6a6454', 0.6)
    b.blotches('#3e3a30', { count: 6, size: 5, alpha: 0.6 })
    b.blotches('#6e4128', { count: 3, size: 3, alpha: 0.5 })
    b.grain(0.15)
  }, 139),
  // A grating to stand on: bars both ways over the dark, rust in the crossings.
  grating: () => paint(32, 32, (b) => {
    b.fill('#14100e')
    for (let i = 0; i < 32; i += 4) {
      b.rect(i / 32, 0, (i + 1.5) / 32, 1, '#4a3a30')
      b.rect(0, i / 32, 1, (i + 1.5) / 32, '#5a4636')
    }
    b.blotches('#6e4128', { count: 6, size: 4, alpha: 0.5 })
    b.grain(0.1)
  }, 149),
  // Concrete a machine is bolted down to, oil spilt and trodden into it.
  floor: () => paint(64, 64, (b) => {
    b.fill('#55514a')
    b.blotches('#6a665e', { count: 10, size: 9, alpha: 0.4 })
    b.blotches('#221e1a', { count: 6, size: 10, alpha: 0.65 })
    b.veins('#2e2a26', { count: 6, steps: 20, alpha: 0.6 })
    b.grain(0.15)
  }, 151),
}

const _textures = new Map()
const _skins = new Map()

/** The texture `name` of `DRAWN`, made at the first asking, repeating both ways. */
export function texture(name) {
  if (!_textures.has(name)) {
    const made = DRAWN[name]()
    made.wrapS = made.wrapT = THREE.RepeatWrapping
    _textures.set(name, made)
  }
  return _textures.get(name)
}

/** A lit material painted `name`, one for every machine that wears it. */
export function skin(name) {
  if (!_skins.has(name)) _skins.set(name, celMaterial({ map: texture(name) }))
  return _skins.get(name)
}

/** `mesh` with its texture repeated `u` times round or across it and `v` times up it; returned. */
export function tile(mesh, u, v = u) {
  const uv = mesh.geometry.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v)
  return mesh
}

// A number in [-1, 1] fixed by a point, the same for every vertex there, so a part split at a seam stays shut.
const lumpAt = (x, y, z) => (Math.abs(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) % 1) * 2 - 1

/**
 * `mesh`'s round part beaten out of true: each point moved out or in from its axis (the
 * geometry's own Y) by up to `by` of its distance from it, the same at the same point. Returned.
 */
export function batter(mesh, by) {
  const position = mesh.geometry.attributes.position
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)]
    const k = 1 + by * lumpAt(Math.round(x * 50) / 50, Math.round(y * 50) / 50, Math.round(z * 50) / 50)
    position.setXYZ(i, x * k, y, z * k)
  }
  return mesh
}

/**
 * A clock's dial, `size` texels across: grimy enamel, a minute track, Roman hours, a crack across
 * its glass and a stain where the rain gets in, all from `seed`.
 */
export const clockDial = (seed = 41, size = 96) => paint(size, size, (b) => {
  const c = b.context
  b.fill('#2a2622')
  b.dot(0.5, 0.5, size * 0.49, '#cfc4a6')
  b.blotches('#8a7c5c', { count: 8, size: size / 8, alpha: 0.35 })
  b.blotches('#6e5a3a', { count: 3, size: size / 5, alpha: 0.3, v: [0.55, 1] })
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2
    const [r0, width] = i % 5 === 0 ? [0.4, 2.5] : [0.43, 1]
    b.line([[0.5 + Math.sin(angle) * r0, 0.5 + Math.cos(angle) * r0], [0.5 + Math.sin(angle) * 0.47, 0.5 + Math.cos(angle) * 0.47]], '#221e1a', width)
  }
  const HOURS = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
  c.fillStyle = '#221e1a'
  c.font = `bold ${Math.round(size * 0.09)}px serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  HOURS.forEach((hour, i) => {
    const angle = (i / 12) * Math.PI * 2
    c.fillText(hour, size * (0.5 + Math.sin(angle) * 0.33), size * (0.5 - Math.cos(angle) * 0.33))
  })
  // The crack, and the dirt that has run in along it.
  const from = [0.15 + b.random() * 0.2, 0.7 + b.random() * 0.2]
  const crack = [from, [0.45, 0.55], [0.62, 0.42], [0.85, 0.3 + b.random() * 0.1]]
  b.line(crack, '#5a5040', 2, 0.5)
  b.line(crack, '#f0ead8', 1, 0.7)
  b.line([[0.45, 0.55], [0.4, 0.3]], '#f0ead8', 1, 0.6)
  b.grain(0.08)
}, seed)

/** A pressure gauge's dial: its scale a three-quarter arc, the last of it amber, the glass cracked and filmed. */
export const gaugeDial = () => paint(32, 32, (b) => {
  b.fill('#2a2622')
  b.dot(0.5, 0.5, 15, '#c8bea0')
  for (let i = 0; i <= 12; i++) {
    const angle = -0.75 * Math.PI + (i / 12) * 1.5 * Math.PI
    b.line([[0.5 + Math.sin(angle) * 0.3, 0.5 + Math.cos(angle) * 0.3], [0.5 + Math.sin(angle) * 0.42, 0.5 + Math.cos(angle) * 0.42]], i >= 10 ? '#d88a2a' : '#221e1a', i % 3 === 0 ? 2 : 1)
  }
  b.blotches('#7a6e54', { count: 4, size: 6, alpha: 0.45 })
  b.line([[0.2, 0.75], [0.55, 0.45], [0.8, 0.35]], '#f0ead8', 1, 0.6)
  b.grain(0.1)
}, 43)

/** The face of a dish: panels in rings and spokes, grimy, one panel gone to the dark behind it. */
export const dishFace = (seed = 157) => paint(64, 64, (b) => {
  b.fill('#a69c84')
  b.blotches('#7a705a', { count: 10, size: 8, alpha: 0.45 })
  for (const r of [0.18, 0.32, 0.46]) {
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2
      b.dot(0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r, 0.5, '#5a5242', 0.8)
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    b.line([[0.5, 0.5], [0.5 + Math.cos(a) * 0.48, 0.5 + Math.sin(a) * 0.48]], '#5a5242', 1, 0.8)
  }
  const a = b.random() * Math.PI * 2 // the panel gone: a wedge of the dark between two spokes
  for (let r = 0.33; r < 0.46; r += 0.01) b.line([[0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r], [0.5 + Math.cos(a + 0.7) * r, 0.5 + Math.sin(a + 0.7) * r]], '#1a1612', 2)
  runs(b, '#6e4128', { count: 8, alpha: 0.4 })
  b.grain(0.08)
}, seed)

/** A horn's mouth: the dark of its throat behind a rusted grille, a hole punched through it. */
export const grille = () => paint(32, 32, (b) => {
  b.fill('#141210')
  for (let i = 1; i < 32; i += 3) {
    b.rect(i / 32, 0, (i + 1) / 32, 1, '#4a3428', 0.9)
    b.rect(0, i / 32, 1, (i + 1) / 32, '#4a3428', 0.9)
  }
  b.dot(0.62, 0.38, 4, '#0a0808')
  b.blotches('#6e4128', { count: 5, size: 4, alpha: 0.6 })
}, 163)
