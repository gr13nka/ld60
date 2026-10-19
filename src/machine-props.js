// The machines of the gorge, after the owner's painting of it (2026-10-17): clocks on brackets
// and walls, riveted boilers with their gauges, a steam engine, a wall of gears, pipes run up a
// wall with a valve wheel, a lattice radio mast with its dishes, horn loudspeakers. Props, as the
// room's are (`room-props.js`, whose `PROPS` takes these in, so each is in the editor's add menu):
// `build(record)` makes one in its own frame, facing +Z, its origin at its foot's middle or, for
// what hangs on a wall, on the wall's face; every part that moves is baked on its own, its pivot
// at its axle, and returned by its name.
//
// The owner, on the first of them: "too simple and generic, make them a bit more grunge and
// detailed, a bit rusty and maybe broken, or textures". So each is painted in worn surfaces
// (`machine-paint.js`), its round parts beaten out of true, kept going with rags, wire and
// patches, and each has something broken on it: a sprung board, a spoke gone, a snapped riser left
// hanging, a dish knocked askew, a horn hanging by its cable.
//
// What a kind does is in its `traits`, read by `ParkourWorld`, never by asking its kind:
// - `moves`, worked each frame by `work`: `turns` (`{ part: [rad/s, axis = 'z'] }`, on from where
//   it was built), `sways` (`{ part: [radians, seconds, axis = 'y'] }`, either side of its rest),
//   `trembles` (`{ part: radians }`, about Z, a gauge's needle), `drives` (a crank's piston and
//   rod, from the shaft's turn) and `keepsTime` (the hands of `built.clocks` at the hour now);
// - `vents`, `[[x, y, z, size], …]`, where steam blows out (`Effects.steam`, the nearest few);
// - `hums`, `{ name, at, near, reach }`, a recording of `sound.js` looped where it says (the
//   loudspeakers' voice, `speaker-voice.js`).
// Real sizes, a record's `scale` making a mast of a toy. Every size, speed and colour is a first
// guess, unseen. Red is what blows up and green a gate: nothing here is either. Look only.

import * as THREE from 'three'
import { cogStep } from './cog-motion.js'
import { asLight, box, cylinder, pipe } from './models.js'
import { celMaterial } from './shading.js'
import { baked, plain } from './npc-kit.js'
import { batter, clockDial, dishFace, gaugeDial, grille, skin, tile } from './machine-paint.js'

// The plain paints, for what is too small to show a texture.
const C = {
  iron: 0x3c3836,
  soot: 0x262220,
  steel: 0x8a8a84, // a polished rod, the one bright thing on a machine
  wood: 0x5a4030,
  ash: 0x3a3632,
  oil: 0x120e0a,
  glass: 0x6a7a70,
  twig: 0x5a4a30,
  glow: 0xffa84a, // a firebox's slot and a mast's beacon: amber, never red
  wires: [0x6a3a1a, 0x1a1a1a, 0xa08030], // brown, black, ochre: no red
}
const TAU = Math.PI * 2
const v = (x, y, z) => ({ x, y, z })
const length = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])

// A round bar from the point `a` to `b` (`[x, y, z]`), `r` thick, in `material`; a texture is
// repeated once a metre along it.
function rod(a, b, r, material, sides = 8) {
  const mesh = pipe(v(...a), v(...b), r, material, sides)
  return material.map ? tile(mesh, 1, Math.max(1, Math.round(length(a, b)))) : mesh
}
// A ring `radius` across of a bar `tube` thick, square to Z (turned as it is placed), `arc` of it.
function hoop(radius, tube, material, x = 0, y = 0, z = 0, sides = 20, arc = TAU) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 5, sides, arc), material)
  mesh.position.set(x, y, z)
  return mesh
}
// A cylinder whose axis runs along X ('x') or Z ('z').
function lying(radius, long, material, x, y, z, along, sides = 16) {
  const mesh = cylinder(radius, long, material, x, y, z, sides)
  if (along === 'x') mesh.rotation.z = Math.PI / 2
  else mesh.rotation.x = Math.PI / 2
  return mesh
}
const ball = (r, material, x, y, z, sides = 8) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, sides, Math.max(4, sides - 2)), material)
  mesh.position.set(x, y, z)
  return mesh
}
// A piece of a round shell `radius` across, `tall`, from `from` radians round (0 at +Z, toward +X)
// for `round` of a turn, its middle `y` up: a patch, a wrap of lagging, a band.
function shell(radius, tall, from, round, material, y, sides = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, tall, sides, 1, true, from, round), material)
  mesh.position.y = y
  return mesh
}
// A group placed at `[x, y, z]` and turned by `[rx, ry, rz]` (in that order of axes, Y first):
// what a face, a holder or a pivot hangs from.
function frame([x, y, z], [rx, ry, rz] = [0, 0, 0]) {
  const group = new THREE.Group()
  group.position.set(x, y, z)
  group.rotation.set(rx, ry, rz, 'YXZ')
  return group
}
// A frame at `at` whose Z runs along the axis `axis` ('x', 'y' or 'z'): round what lies along it.
const along = (at, axis) => frame(at, axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [-Math.PI / 2, 0, 0] : [0, 0, 0])

// A cable or a wire hung from `a` to `b`, sagging `droop` at its middle.
function sag(parts, a, b, droop, r, material, segments = 6) {
  let last = a
  for (let i = 1; i <= segments; i++) {
    const t = i / segments
    const at = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - droop * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]
    parts.add(rod(last, at, r, material, 4))
    last = at
  }
}
// A ring of `count` bolt heads `radius` from the middle of a face at `at`, the face looking along
// `axis`; the one at `missing`, if any, is gone.
function boltRing(parts, at, axis, radius, count, size = 0.025, missing = -1) {
  const ring = along(at, axis)
  for (let i = 0; i < count; i++) {
    if (i === missing) continue
    const a = (i / count) * TAU
    ring.add(lying(size, size * 1.2, plain(C.iron), Math.cos(a) * radius, Math.sin(a) * radius, 0, 'z', 6))
  }
  parts.add(ring)
}
// A rag wound round a pipe `radius` thick at `at` along `axis`, where it leaks: turns of cloth
// askew, and an end hanging down.
function bandage(parts, at, axis, radius, long = 0.32) {
  const wound = along(at, axis)
  for (let i = 0; i < 4; i++) {
    const turn = hoop(radius + 0.025, 0.028, skin('rag'), 0, 0, -long / 2 + (i * long) / 3, 10)
    turn.rotation.x = (i % 2 ? 0.25 : -0.2)
    wound.add(turn)
  }
  parts.add(wound)
  parts.add(box(0.07, 0.28, 0.012, skin('rag'), at[0] + 0.03, at[1] - radius - 0.14, at[2] + radius * 0.7).rotateZ(0.2))
}
// A rag hung from `at`, `long`, folded over at its top.
function rag(parts, [x, y, z], long = 0.4, turn = 0) {
  parts.add(box(0.16, 0.04, 0.03, skin('rag'), x, y, z).rotateY(turn))
  parts.add(box(0.13, long, 0.012, skin('rag'), x + 0.02, y - long / 2, z).rotateZ(0.12).rotateY(turn))
}

// --- Dials ---

// A dial `radius` across facing +Z at the holder's middle, into `still`.
function dial(still, radius, texture) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), celMaterial({ map: texture }))
  mesh.position.z = 0.002
  still.add(mesh)
}

// Hour, minute and second hands for a dial `radius` across, each a pivot at its middle turning
// about Z (made pointing at twelve, turned clockwise as seen), hung on `moving`.
function hands(moving, radius) {
  const hand = (long, width, color, z) => {
    const pivot = new THREE.Group()
    pivot.position.z = z
    pivot.add(box(width, long, radius * 0.03, plain(color), 0, long / 2 - radius * 0.1, 0))
    moving.add(pivot)
    return pivot
  }
  const hour = hand(radius * 0.55, radius * 0.08, C.soot, radius * 0.02)
  const minute = hand(radius * 0.82, radius * 0.055, C.soot, radius * 0.05)
  const second = hand(radius * 0.88, radius * 0.02, 0x8c5c38, radius * 0.08)
  moving.add(cylinder(radius * 0.06, radius * 0.06, skin('brass'), 0, 0, radius * 0.1, 8).rotateX(Math.PI / 2))
  return { hour, minute, second }
}

// A needle for a gauge `radius` across: a pivot that trembles, holding it at its working pressure.
function needle(moving, radius) {
  const pivot = new THREE.Group()
  pivot.position.z = radius * 0.08
  const rest = new THREE.Group()
  rest.rotation.z = -0.9 // two thirds round the scale: working hard
  rest.add(box(radius * 0.06, radius * 0.75, radius * 0.04, plain(C.soot), 0, radius * 0.3, 0))
  pivot.add(rest)
  moving.add(pivot)
  return pivot
}

// A gauge `radius` across at `at` facing +Z, in a brass case: its still parts into `parts`, its
// needle on a pivot into `group`, returned.
function gauge(parts, group, at, radius) {
  const still = frame(at)
  still.add(lying(radius * 1.15, radius * 0.45, skin('brass'), 0, 0, -radius * 0.22, 'z', 14))
  still.add(hoop(radius * 1.1, radius * 0.08, skin('brass'), 0, 0, 0.004, 14))
  dial(still, radius, gaugeDial())
  parts.add(still)
  const moving = frame(at)
  group.add(moving)
  return needle(moving, radius)
}

// --- Clocks ---

// A station clock on a bracket out of a wall: a drum with a face to each side, along the street,
// its paint gone to rust, both glasses cracked, a cable run along the arm to it.
function stationClock() {
  const group = new THREE.Group()
  const parts = new THREE.Group()
  parts.add(box(0.3, 0.42, 0.04, skin('rust'), 0, -0.12, 0.02)) // the plate on the wall
  boltRing(parts, [0, -0.12, 0.04], 'z', 0.13, 4, 0.02, 2)
  parts.add(box(0.08, 0.1, 1.05, skin('rust'), 0, 0, 0.53)) // the arm
  parts.add(rod([0, -0.4, 0.04], [0, -0.02, 0.72], 0.025, skin('rust'))) // its stay
  parts.add(hoop(0.12, 0.018, skin('rust'), 0, 0.12, 0.62).rotateY(Math.PI / 2)) // a scroll on it
  parts.add(hoop(0.07, 0.015, skin('rust'), 0, 0.2, 0.42, 10, Math.PI * 1.4).rotateY(Math.PI / 2))
  parts.add(rod([0, 0, 0.95], [0, -0.14, 0.95], 0.03, skin('rust'))) // what it hangs by
  sag(parts, [0.06, -0.06, 0.04], [0.06, -0.08, 0.9], 0.12, 0.012, plain(C.soot), 5) // its cable
  parts.add(rod([0.06, -0.08, 0.9], [0.05, -0.15, 0.95], 0.012, plain(C.soot), 4))
  const middle = [0, -0.56, 0.95]
  parts.add(tile(lying(0.42, 0.24, skin('painted'), ...middle, 'x', 20), 3, 1))
  parts.add(ball(0.06, skin('brass'), 0, -1.04, 0.95)) // its finial
  const clocks = []
  for (const side of [1, -1]) {
    const at = [side * 0.121, middle[1], middle[2]]
    const turn = [0, (side * Math.PI) / 2, 0]
    const still = frame(at, turn)
    still.add(hoop(0.42, 0.035, skin('brass'), 0, 0, 0.01))
    dial(still, 0.39, clockDial(side > 0 ? 41 : 47))
    parts.add(still)
    const moving = frame(at, turn)
    clocks.push(hands(moving, 0.39))
    group.add(moving)
  }
  group.add(baked(parts))
  return { group, clocks }
}

// A clock face flat on a wall, an iron rim round it, a hood over it that the rain runs off: as
// large as its `scale`, a tower's. One of its hour blocks is gone, another hangs by a bolt.
function clockFace() {
  const group = new THREE.Group()
  const parts = new THREE.Group()
  parts.add(tile(lying(1.18, 0.12, skin('soot'), 0, 0, 0.06, 'z', 28), 4, 1))
  parts.add(tile(hoop(1.12, 0.07, skin('rust'), 0, 0, 0.13, 28), 8, 1))
  for (let i = 0; i < 12; i++) {
    if (i === 7) continue
    const angle = (i / 12) * TAU + (i === 4 ? 0.12 : 0)
    parts.add(box(0.05, 0.12, 0.04, skin('brass'), Math.sin(angle) * 1.24, Math.cos(angle) * 1.24, 0.06).rotateZ(-angle - (i === 4 ? 0.6 : 0)))
  }
  boltRing(parts, [0, 0, 0.13], 'z', 1.02, 24, 0.018, 9)
  parts.add(tile(box(2.7, 0.18, 0.55, skin('painted'), 0, 1.42, 0.27), 3, 1)) // the hood
  for (const x of [-1.2, 1.2]) parts.add(rod([x, 1.33, 0.04], [x, 1.33, 0.5], 0.03, skin('rust'))) // its brackets
  parts.add(box(0.1, 0.08, 0.01, skin('rust'), 0.4, 1.32, 0.55).rotateZ(0.5)) // a bit of its flashing come loose
  const still = frame([0, 0, 0.12])
  dial(still, 1.08, clockDial(53, 128))
  parts.add(still)
  const moving = frame([0, 0, 0.12])
  const clock = hands(moving, 1.08)
  group.add(moving)
  group.add(baked(parts))
  return { group, clocks: [clock] }
}

// --- Steam ---

// A vertical riveted boiler on its plinth: a domed drum beaten out of true, a newer plate bolted
// over a split, its lagging torn and hanging, the firebox door left ajar over a heap of ash and a
// shovel, a gauge and a sight glass, a valve wheel with a rag on it, its outlet down to the
// ground bound with rags where it leaks, a leaning stack, and a wrench hung on the safety valve's
// lever to hold it down.
const BOILER = { r: 1.1, top: 3.3, lean: 0.05, stack: 2.5 }
const STACK_TOP = [-Math.sin(BOILER.lean) * BOILER.stack, BOILER.top + 0.8 + Math.cos(BOILER.lean) * BOILER.stack + 0.22, 0]
function boiler() {
  const { r, top, lean, stack } = BOILER
  const group = new THREE.Group()
  const parts = new THREE.Group()
  parts.add(tile(box(2.8, 0.3, 2.8, skin('floor'), 0, 0.15, 0), 2, 0.3))
  parts.add(tile(batter(cylinder(r, top - 0.3, skin('riveted'), 0, (top + 0.3) / 2, 0, 24), 0.015), 3, 1))
  const dome = new THREE.LatheGeometry([[r, top], [r * 0.96, top + 0.3], [r * 0.78, top + 0.6], [r * 0.45, top + 0.8], [0, top + 0.86]].map(([x, y]) => new THREE.Vector2(x, y)), 24)
  parts.add(tile(batter(new THREE.Mesh(dome, skin('rust')), 0.02), 3, 1))
  for (const y of [0.6, 1.8, 3.0]) parts.add(tile(hoop(r + 0.01, 0.03, skin('rust'), 0, y, 0, 24), 8, 1).rotateX(Math.PI / 2))
  // The plate over the split, painted when it was new, its bolts round it.
  const [from, round] = [-2.1, 0.7]
  parts.add(shell(r + 0.018, 0.75, from, round, skin('painted'), 2.25, 5))
  for (const y of [1.92, 2.58]) {
    for (let i = 0; i <= 4; i++) {
      const a = from + 0.06 + (i / 4) * (round - 0.12)
      parts.add(box(0.045, 0.045, 0.045, plain(C.iron), Math.sin(a) * (r + 0.03), y, Math.cos(a) * (r + 0.03)))
    }
  }
  // The lagging round its foot, its bands, and a flap of it torn off and hanging.
  parts.add(tile(shell(r + 0.07, 1.1, 0.6, 2.4, skin('rag'), 1.2, 12), 4, 1))
  for (const y of [0.72, 1.68]) parts.add(shell(r + 0.09, 0.04, 0.6, 2.2, skin('soot'), y, 12))
  const flap = box(0.55, 0.5, 0.02, skin('rag'), Math.sin(3.05) * (r + 0.14), 0.95, Math.cos(3.05) * (r + 0.14))
  flap.rotation.set(0.15, 3.05 + Math.PI / 2, 0.35, 'YXZ')
  parts.add(flap)
  const manhole = lying(0.3, 0.06, skin('soot'), 0, 1.2, r + 0.02, 'z', 14)
  manhole.scale.set(1, 1, 1.3) // taller than wide, turned up
  parts.add(manhole)
  boltRing(parts, [0, 1.2, r + 0.05], 'z', 0.25, 8, 0.022, 5)
  parts.add(box(0.36, 0.16, 0.015, skin('brass'), 0, 1.86, r + 0.012)) // its maker's plate
  // The firebox: its frame, the fire through the gap, the door swung half open, the ash, a shovel.
  parts.add(box(0.8, 0.6, 0.06, skin('soot'), 0, 0.65, r + 0.02))
  parts.add(asLight(box(0.48, 0.34, 0.02, plain(C.glow), 0, 0.65, r + 0.05)))
  const door = frame([-0.25, 0.65, r + 0.08], [0, -0.7, 0])
  door.add(box(0.5, 0.38, 0.04, skin('soot'), 0.25, 0, 0))
  door.add(rod([0.4, 0, 0.03], [0.46, 0, 0.03], 0.015, plain(C.iron), 4)) // its latch
  parts.add(door)
  const ash = ball(0.4, plain(C.ash), 0.05, 0.3, r + 0.35, 10)
  ash.scale.set(1, 0.22, 0.7)
  parts.add(ash)
  parts.add(rod([0.95, 0.05, 1.62], [0.72, 1.35, 1.32], 0.02, plain(C.wood), 6))
  parts.add(box(0.24, 0.3, 0.025, skin('rust'), 0.97, 0.18, 1.66).rotateX(-0.25))
  // The outlet: out of the dome's side, along and down to the ground, its flanges and their
  // bolts, a bracket back to the drum, and rags round the joint that leaks.
  parts.add(rod([0.8, top + 0.2, 0], [1.75, top + 0.2, 0], 0.12, skin('rust')))
  parts.add(ball(0.16, skin('rust'), 1.75, top + 0.2, 0, 10))
  parts.add(rod([1.75, top + 0.2, 0], [1.75, 0, 0], 0.12, skin('rust')))
  for (const [x, y, axis] of [[1.3, top + 0.2, 'x'], [1.75, 2.2, 'y'], [1.75, 0.9, 'y']]) {
    parts.add(axis === 'x' ? lying(0.18, 0.06, skin('soot'), x, y, 0, 'x', 10) : cylinder(0.18, 0.06, skin('soot'), x, y, 0, 10))
    boltRing(parts, [x, y + (axis === 'y' ? 0.035 : 0), 0], axis, 0.15, 6, 0.018, 4)
  }
  bandage(parts, [1.75, 1.55, 0], 'y', 0.12)
  parts.add(box(1.75 - r - 0.1, 0.08, 0.08, skin('soot'), (r + 1.75 - 0.1) / 2, 2.7, 0))
  // The valve wheel on its stem, with a rag tied to it.
  parts.add(rod([r - 0.05, 2.0, 0.35], [r + 0.3, 2.0, 0.35], 0.03, plain(C.iron)))
  const wheel = frame([r + 0.3, 2.0, 0.35], [0, Math.PI / 2, 0])
  wheel.add(hoop(0.24, 0.03, skin('brass'), 0, 0, 0, 14))
  for (let i = 0; i < 3; i++) wheel.add(box(0.03, 0.46, 0.03, skin('brass')).rotateZ((i / 3) * Math.PI))
  parts.add(wheel)
  rag(parts, [r + 0.32, 1.78, 0.42], 0.35, Math.PI / 2)
  // The stack, leaning, beaten, flared at its lip.
  const chimney = frame([0, top + 0.8, 0], [0, 0, lean])
  chimney.add(tile(batter(cylinder(0.2, stack, skin('soot'), 0, stack / 2, 0, 12), 0.04), 2, 3))
  chimney.add(new THREE.Mesh(new THREE.LatheGeometry([[0.2, stack], [0.32, stack + 0.18], [0.3, stack + 0.22], [0.2, stack + 0.12]].map(([x, y]) => new THREE.Vector2(x, y)), 12), skin('soot')))
  chimney.add(hoop(0.23, 0.03, skin('rust'), 0, 1.2, 0, 12).rotateX(Math.PI / 2))
  parts.add(chimney)
  // The safety valve, its lever run out past the drum and a wrench hung on it to hold it shut.
  parts.add(cylinder(0.08, 0.3, skin('brass'), 0.5, top + 0.75, 0.3, 8))
  const leverEnd = [0.95, top + 0.85, 0.75]
  parts.add(rod([0.5, top + 0.9, 0.3], leverEnd, 0.022, plain(C.iron), 6))
  parts.add(ball(0.08, plain(C.iron), ...leverEnd))
  parts.add(rod(leverEnd, [0.95, top + 0.45, 0.75], 0.006, plain(C.iron), 4))
  parts.add(box(0.07, 0.42, 0.025, skin('rust'), 0.95, top + 0.25, 0.75).rotateZ(0.08))
  // The sight glass, and the gauge on its stem out of the drum's front.
  for (const y of [2.15, 2.95]) parts.add(rod([-0.45, y, r - 0.02], [-0.45, y, r + 0.14], 0.025, skin('brass'), 6))
  parts.add(rod([-0.45, 2.15, r + 0.14], [-0.45, 2.95, r + 0.14], 0.03, plain(C.glass), 6))
  parts.add(rod([0.45, 2.6, r - 0.05], [0.45, 2.6, r + 0.22], 0.025, skin('brass')))
  const shaking = gauge(parts, group, [0.45, 2.6, r + 0.28], 0.17)
  group.add(baked(parts))
  return { group, needle: shaking, phase: Math.random() * TAU }
}

// A horizontal mill engine on its bed: the cylinder in wooden lagging, one board sprung, its steam
// chest, the piston rod and crosshead running in guides over a drip tray, the connecting rod, the
// crank and a flywheel with a spoke gone on one shaft, a ball governor spinning on top, the exhaust
// bound with rags, an oil can left on the bed and a bent rail before it. `ENGINE` is what `drives` reads.
const ENGINE = { axle: [1.2, 1.5], throw: 0.35, length: 1.25, flywheel: 1.25 }
function steamEngine() {
  const { axle: [ax, ay], throw: crank, length: rodLong, flywheel } = ENGINE
  const group = new THREE.Group()
  const parts = new THREE.Group()
  parts.add(tile(box(4.3, 0.5, 1.3, skin('soot'), -0.25, 0.25, 0), 4, 0.5)) // the bed
  for (let x = -2.2; x < 1.9; x += 0.55) for (const z of [-0.58, 0.58]) parts.add(cylinder(0.035, 0.05, plain(C.iron), x, 0.52, z, 6))
  parts.add(box(1.0, 0.04, 0.35, skin('rust'), -0.2, 0.52, 0.45)) // the drip tray
  parts.add(cylinder(0.28, 0.006, plain(C.oil), -0.3, 0.545, 0.47, 12))
  // The cylinder on its saddle, lagged in boards under brass bands, its covers and their bolts,
  // the gland, and the steam chest over it.
  parts.add(tile(box(1.0, 0.6, 0.7, skin('painted'), -1.6, 0.8, 0), 1, 0.6))
  parts.add(lying(0.45, 1.3, skin('lagging'), -1.6, ay, 0, 'x', 18))
  for (const x of [-2.15, -1.05]) parts.add(hoop(0.46, 0.022, skin('brass'), x, ay, 0, 18).rotateY(Math.PI / 2))
  parts.add(box(0.6, 0.02, 0.1, skin('lagging'), -1.35, ay + 0.52, 0.22).rotateZ(0.45).rotateX(0.3)) // a board sprung off
  for (const x of [-2.27, -0.93]) {
    parts.add(lying(0.5, 0.06, skin('brass'), x, ay, 0, 'x', 18))
    boltRing(parts, [x + (x < -1.6 ? -0.035 : 0.035), ay, 0], 'x', 0.42, 10, 0.022, x < -1.6 ? 3 : -1)
  }
  parts.add(lying(0.12, 0.15, skin('brass'), -0.85, ay, 0, 'x', 10))
  parts.add(tile(box(1.0, 0.35, 0.6, skin('painted'), -1.6, ay + 0.6, 0), 1, 0.4))
  parts.add(rod([-1.1, ay + 0.6, 0], [-0.7, ay + 0.6, 0], 0.025, plain(C.steel), 6)) // the valve's spindle
  // The guides the crosshead runs in, on their stand, a rag left over them.
  for (const dy of [-0.2, 0.2]) parts.add(box(1.3, 0.05, 0.14, skin('soot'), -0.2, ay + dy, 0))
  parts.add(box(0.8, ay - 0.2 - 0.5, 0.3, skin('painted'), -0.2, (ay - 0.2 + 0.5) / 2, 0))
  rag(parts, [-0.75, ay + 0.24, 0.07], 0.32)
  // The shaft's bearings either side of the crank, their caps and oil cups.
  for (const z of [-0.35, 0.55]) {
    parts.add(box(0.4, ay - 0.4, 0.2, skin('painted'), ax, (ay + 0.5 - 0.1) / 2 + 0.05, z))
    parts.add(lying(0.16, 0.22, skin('brass'), ax, ay, z, 'z', 10))
    parts.add(cylinder(0.04, 0.12, skin('brass'), ax, ay + 0.22, z, 6))
  }
  // The governor's column, the exhaust with its bracket and rags, the oil can.
  parts.add(rod([-1.6, ay + 0.78, 0], [-1.6, ay + 1.4, 0], 0.04, skin('brass')))
  parts.add(rod([-2.0, ay + 0.6, -0.2], [-2.0, ay + 2.6, -0.2], 0.1, skin('soot')))
  parts.add(hoop(0.12, 0.025, skin('rust'), -2.0, ay + 2.2, -0.2, 10).rotateX(Math.PI / 2))
  bandage(parts, [-2.0, ay + 1.5, -0.2], 'y', 0.1, 0.26)
  parts.add(cylinder(0.07, 0.16, plain(0x4a5a4e), -2.0, 0.58, 0.42, 8))
  parts.add(rod([-2.0, 0.64, 0.42], [-1.85, 0.74, 0.5], 0.01, plain(0x4a5a4e), 4))
  // A rail before it on posts, one post knocked crooked and its rail sagging.
  const posts = [[-2.3, 0, 1.35], [-0.8, 0, 1.35], [0.7, 0, 1.35], [2.2, 0, 1.35]]
  const tops = [[-2.3, 1.0, 1.35], [-0.8, 1.0, 1.35], [0.95, 0.88, 1.52], [2.2, 1.0, 1.35]]
  posts.forEach((foot, i) => parts.add(rod(foot, tops[i], 0.03, skin('rust'), 6)))
  parts.add(rod(tops[0], tops[1], 0.025, skin('rust'), 6))
  sag(parts, tops[1], tops[2], 0.12, 0.025, skin('rust'), 4)
  parts.add(rod(tops[2], tops[3], 0.025, skin('rust'), 6))
  // The shaft: crank, pin and flywheel turning as one about its axle, a spoke of five gone.
  const shaft = frame([ax, ay, 0])
  const shaftParts = new THREE.Group()
  shaftParts.add(lying(0.08, 1.5, plain(C.steel), 0, 0, 0.25, 'z', 8))
  shaftParts.add(box(crank + 0.3, 0.3, 0.1, skin('soot'), crank / 2, 0, 0.25))
  shaftParts.add(lying(0.05, 0.2, skin('brass'), crank, 0, 0.15, 'z', 8))
  shaftParts.add(tile(hoop(flywheel, 0.12, skin('rust'), 0, 0, 0.85, 28), 8, 1))
  shaftParts.add(lying(0.2, 0.22, skin('soot'), 0, 0, 0.85, 'z', 10))
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU
    const [inner, outer] = i === 4 ? [0.18, 0.45] : [0.18, flywheel - 0.05] // the fourth broken off short
    const spoke = box(0.08, outer - inner, 0.06, skin('rust'), Math.cos(a) * (inner + outer) / 2, Math.sin(a) * (inner + outer) / 2, 0.85)
    spoke.rotation.z = a - Math.PI / 2
    shaftParts.add(spoke)
  }
  shaft.add(baked(shaftParts))
  group.add(shaft)
  // The piston rod and crosshead, sliding along X.
  const rest = ax + crank - rodLong // where the crosshead is with the crank at its rest
  const piston = new THREE.Group()
  const pistonParts = new THREE.Group()
  pistonParts.add(rod([-1.5, ay, 0], [rest, ay, 0], 0.04, plain(C.steel)))
  pistonParts.add(box(0.25, 0.32, 0.2, skin('brass'), rest, ay, 0))
  piston.add(baked(pistonParts))
  group.add(piston)
  // The connecting rod, from the crosshead's pin to the crank's.
  const conrod = frame([rest, ay, 0.15])
  const rodParts = new THREE.Group()
  rodParts.add(box(rodLong, 0.09, 0.06, skin('soot'), rodLong / 2, 0, 0))
  for (const x of [0, rodLong]) rodParts.add(lying(0.08, 0.08, skin('soot'), x, 0, 0, 'z', 8))
  conrod.add(baked(rodParts))
  group.add(conrod)
  // The governor: two balls on arms, spinning about its spindle.
  const governor = frame([-1.6, ay + 1.4, 0])
  const governorParts = new THREE.Group()
  governorParts.add(rod([0, 0, 0], [0, 0.5, 0], 0.025, skin('brass')))
  for (const side of [1, -1]) {
    governorParts.add(rod([0, 0.5, 0], [side * 0.3, 0.18, 0], 0.015, skin('brass')))
    governorParts.add(ball(0.08, skin('brass'), side * 0.3, 0.15, 0))
  }
  governor.add(baked(governorParts))
  group.add(governor)
  group.add(baked(parts))
  return { group, shaft, piston, rod: conrod, governor, phase: Math.random() * TAU }
}

// --- Gears ---

// A wall of meshed gears, the first driven and each after it turned by the one it meshes with:
// `teeth`, which gear it meshes and in what direction (radians, from +X anticlockwise) it stands
// from it, and a tooth `broken` off if one is. The tooth is `MODULE` metres of a gear's diameter.
const MODULE = 0.06
const DRIVEN = 0.45 // rad/s, the first gear's
const GEARS = [
  { name: 'gearA', teeth: 24 },
  { name: 'gearB', teeth: 12, from: 'gearA', toward: 0.35 },
  { name: 'gearC', teeth: 30, from: 'gearB', toward: -0.6, broken: 7 },
  { name: 'gearD', teeth: 16, from: 'gearA', toward: 2.6 },
]
// Where each gear stands, its turn at rest (a tooth of one in a gap of the next) and its speed.
function gearLayout(spec) {
  const laid = {}
  for (const gear of spec) {
    if (!gear.from) {
      laid[gear.name] = { ...gear, x: 0, y: 0, rest: 0, speed: DRIVEN }
      continue
    }
    const by = laid[gear.from]
    const apart = ((by.teeth + gear.teeth) * MODULE) / 2
    const offset = ((((gear.toward - by.rest) * by.teeth) / TAU) % 1 + 1) % 1 // its teeth's at the line, in teeth
    laid[gear.name] = {
      ...gear,
      x: by.x + Math.cos(gear.toward) * apart,
      y: by.y + Math.sin(gear.toward) * apart,
      rest: gear.toward + Math.PI - (TAU / gear.teeth) * (0.5 - offset),
      speed: (-by.speed * by.teeth) / gear.teeth,
    }
  }
  // Set about the middle of them all.
  const all = Object.values(laid)
  const reach = (gear) => (gear.teeth * MODULE) / 2 + MODULE
  const [x0, x1] = [Math.min(...all.map((g) => g.x - reach(g))), Math.max(...all.map((g) => g.x + reach(g)))]
  const [y0, y1] = [Math.min(...all.map((g) => g.y - reach(g))), Math.max(...all.map((g) => g.y + reach(g)))]
  for (const gear of all) {
    gear.x -= (x0 + x1) / 2
    gear.y -= (y0 + y1) / 2
  }
  return { gears: all, width: x1 - x0, height: y1 - y0 }
}
const GEAR_LAYOUT = gearLayout(GEARS)
const COG_LAYOUTS = {
  largeCog: gearLayout([{ name: 'gearA', teeth: 48 }]),
  cogPair: gearLayout([{ name: 'gearA', teeth: 24 }, { name: 'gearB', teeth: 16, from: 'gearA', toward: 0 }]),
  largeGearTrain: gearLayout([
    { name: 'gearA', teeth: 36 },
    { name: 'gearB', teeth: 18, from: 'gearA', toward: 0 },
    { name: 'gearC', teeth: 30, from: 'gearB', toward: 0.7, broken: 7 },
    { name: 'gearD', teeth: 24, from: 'gearA', toward: Math.PI },
    { name: 'gearE', teeth: 16, from: 'gearD', toward: 2.2 },
    { name: 'gearF', teeth: 20, from: 'gearC', toward: 0 },
  ]),
}
const cogTraits = (layout) => ({ cogs: true, moves: { turns: Object.fromEntries(layout.gears.map(({ name, speed }) => [name, [speed]])) } })

// A gear's outline: `teeth` teeth of `MODULE` on a disc, the tooth `broken` ground down to its
// root, a ring of holes in a large one. With `upTo` short of `teeth`, only that many teeth of it
// are left, the rest sheared off along a jagged line near its middle: a gear broken in two.
function gearShape(teeth, { broken = -1, upTo = teeth } = {}) {
  const r = (teeth * MODULE) / 2
  const [tip, root] = [r + MODULE, r - 1.25 * MODULE]
  const step = TAU / teeth
  const shape = new THREE.Shape()
  const at = (radius, angle) => [Math.cos(angle) * radius, Math.sin(angle) * radius]
  for (let k = 0; k < upTo; k++) {
    const a = k * step
    const out = k === broken ? root : tip
    const points = [at(root, a - step * 0.25), at(out, a - step * 0.12), at(out, a + step * 0.12), at(root, a + step * 0.25)]
    points.forEach(([x, y], i) => (k === 0 && i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)))
  }
  if (upTo < teeth) {
    // The break, from the last tooth back to the first through the middle, never straight.
    const end = (upTo - 0.25) * step
    const jags = 6
    for (let i = 1; i < jags; i++) {
      const t = i / jags
      const angle = end + (TAU - 0.25 * step - end) * t
      const radius = root * (0.15 + 0.5 * Math.abs(Math.sin(t * Math.PI))) * (i % 2 ? 0.7 : 1.1)
      shape.lineTo(...at(radius, angle))
    }
  }
  shape.closePath()
  if (r > 0.4 && upTo === teeth) {
    for (let i = 0; i < 5; i++) {
      const [x, y] = at(r * 0.55, (i / 5) * TAU)
      const hole = new THREE.Path()
      hole.absarc(x, y, r * 0.2, 0, TAU, true)
      shape.holes.push(hole)
    }
  }
  return shape
}

// A gear as a mesh, `skinName` repeated three times a metre over its faces.
const gearMesh = (shape, skinName) =>
  tile(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false, curveSegments: 4 }), skin(skinName)), 3, 3)

// One gear on a shaft, as large as the record's `scale` makes it (its tooth is `MODULE` metres at
// scale 1): `teeth` of it, turned `turn` radians at rest (a train is laid so that each tooth of one
// falls in a gap of the next), `thick` metres through, its axle `[back, front]` metres long from
// the wheel's middle: back into the wall, front (+Z) out across the void. The axle and hub stand still; only the wheel turns, so a seized
// gear is the same record with no rpm. Look only: whatever a runner may land on is stood beside it.
function bigCog(record) {
  const s = typeof record.scale === 'number' ? record.scale : 1
  const { teeth = 24, turn = 0, thick = 0.12 * s, axle = [0, 0], look = 'brass' } = record
  const r = (teeth * MODULE) / 2
  const depth = thick / s
  const group = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(teeth), { depth, bevelEnabled: false, curveSegments: 4 }), skin(look))
  tile(mesh, Math.max(3, s / 6))
  mesh.position.z = -depth / 2
  const wheel = new THREE.Group()
  wheel.add(mesh)
  wheel.add(lying(r * 0.16, depth * 1.5, skin('soot'), 0, 0, 0, 'z', 14)) // the hub it turns on
  const pivot = frame([0, 0, 0], [0, 0, turn])
  pivot.add(baked(wheel))
  group.add(pivot)
  const [back, front] = axle
  if (back + front > 0) group.add(baked(lying(r * 0.07, (back + front) / s, skin('rust'), 0, 0, (front - back) / 2 / s, 'z', 10))) // the shaft: static
  return { group, gearA: pivot, radius: r + MODULE }
}

// The gears on their plate, the plate's rivets round its edge (a few gone), grease run down it,
// one gear with a tooth broken, and in a corner half of another gear, sheared, jammed on a bent
// axle and still.
function gearTrain(layout = GEAR_LAYOUT, brokenCorner = true) {
  const { gears, width, height } = layout
  const group = new THREE.Group()
  const parts = new THREE.Group()
  const [w, h] = [width + 0.6, height + 0.4]
  parts.add(tile(box(w, h, 0.08, skin('painted'), 0.1, 0, 0.04), 3, 2)) // the plate they turn on
  let n = 0
  for (let x = -w / 2 + 0.2; x < w / 2; x += 0.3) for (const y of [-h / 2 + 0.08, h / 2 - 0.08]) if (n++ % 7 !== 3) parts.add(lying(0.025, 0.03, plain(C.iron), x + 0.1, y, 0.09, 'z', 6))
  for (let y = -h / 2 + 0.3; y < h / 2 - 0.2; y += 0.3) for (const x of [-w / 2 + 0.18, w / 2 + 0.02]) parts.add(lying(0.025, 0.03, plain(C.iron), x, y, 0.09, 'z', 6))
  const built = { group }
  gears.forEach((gear, i) => {
    parts.add(lying(0.05, 0.2, plain(C.steel), gear.x, gear.y, 0.18, 'z', 8)) // its axle
    const pivot = frame([gear.x, gear.y, 0.12], [0, 0, gear.rest])
    const wheel = new THREE.Group()
    wheel.add(gearMesh(gearShape(gear.teeth, { broken: gear.broken ?? -1 }), i % 2 ? 'brass' : 'rust'))
    wheel.add(lying(0.1, 0.12, skin('soot'), 0, 0, 0.06, 'z', 10)) // its hub
    pivot.add(baked(wheel))
    group.add(pivot)
    built[gear.name] = pivot
  })
  // The broken one, jammed in the plate's free corner.
  if (brokenCorner) {
    const jammed = frame([w / 2 - 0.35, -h / 2 + 0.45, 0.1], [0.12, 0.2, 2.4])
    jammed.add(gearMesh(gearShape(14, { upTo: 8 }), 'rust'))
    jammed.add(rod([0, 0, -0.04], [0.04, 0.03, 0.22], 0.04, plain(C.steel), 6))
    parts.add(jammed)
  }
  group.add(baked(parts))
  return built
}

// --- Pipes ---

// Pipes up a wall, as on the painting's: three risers on brackets, their flanges bolted, the
// fattest turning out at a fitting and running along before it drops to an open flange, rags
// round it where it leaks, a valve wheel on it, a small gauge on the next. The thin one has
// snapped, its upper length hanging askew from its last bracket, steam out of the break. Two
// junction boxes, one with its lid hanging open and its wires spilling out, and their conduits.
// Wall dressing: met by nothing.
const RISERS = [
  { x: -0.55, r: 0.07, out: 0.12, skin: 'painted' },
  { x: -0.2, r: 0.12, out: 0.17, skin: 'rust' },
  { x: 0.25, r: 0.06, out: 0.11, skin: 'soot' },
]
const SNAPPED = 2.55 // where the thin riser broke
function wallPipes() {
  const group = new THREE.Group()
  const parts = new THREE.Group()
  const top = 4.2
  RISERS.forEach(({ x, r, out, skin: name }, i) => {
    const snaps = i === 2
    parts.add(rod([x, 0, out], [x, snaps ? SNAPPED : top, out], r, skin(name), 10))
    for (let y = 0.5; y < (snaps ? SNAPPED : top); y += 1.1) {
      parts.add(cylinder(r + 0.045, 0.06, skin('soot'), x, y, out, 10))
      boltRing(parts, [x, y + 0.035, out], 'y', r + 0.025, 6, 0.012, (i + Math.round(y)) % 4)
    }
    for (const y of [0.8, 2.4, 3.9]) parts.add(box(2 * r + 0.08, 0.05, out, skin('rust'), x, y, out / 2))
  })
  // The snapped one: its torn end, and its upper length hanging from the bracket at 3.9.
  const thin = RISERS[2]
  parts.add(batter(new THREE.Mesh(new THREE.CylinderGeometry(thin.r + 0.008, thin.r, 0.08, 7, 1, true), skin('rust')), 0.35).translateX(thin.x).translateY(SNAPPED + 0.04).translateZ(thin.out))
  const hanging = frame([thin.x, 3.9, thin.out], [0.08, 0, 0.16])
  hanging.add(rod([0, 3.0 - 3.9, 0], [0, top - 3.9, 0], thin.r, skin('soot'), 10))
  hanging.add(batter(new THREE.Mesh(new THREE.CylinderGeometry(thin.r, thin.r + 0.01, 0.07, 7, 1, true), skin('rust')), 0.35).translateY(3.0 - 3.9))
  hanging.add(cylinder(thin.r + 0.045, 0.06, skin('soot'), 0, 3.6 - 3.9, 0, 10))
  parts.add(hanging)
  // The fattest turns out at 3.1 m, runs along and drops to an open flange.
  const fat = RISERS[1]
  const runAt = 0.48
  parts.add(rod([fat.x, 3.1, fat.out], [fat.x, 3.1, runAt], fat.r, skin(fat.skin), 10))
  for (const x of [fat.x, 1.6]) parts.add(ball(fat.r + 0.04, skin('soot'), x, 3.1, runAt, 10))
  parts.add(rod([fat.x, 3.1, runAt], [1.6, 3.1, runAt], fat.r, skin(fat.skin), 10))
  parts.add(rod([1.6, 3.1, runAt], [1.6, 2.2, runAt], fat.r, skin(fat.skin), 10))
  parts.add(cylinder(fat.r + 0.05, 0.07, skin('soot'), 1.6, 2.2, runAt, 10))
  boltRing(parts, [1.6, 2.16, runAt], 'y', fat.r + 0.025, 6, 0.014, 2)
  parts.add(lying(fat.r + 0.045, 0.06, skin('soot'), 0.7, 3.1, runAt, 'x', 10))
  bandage(parts, [fat.x, 2.75, fat.out], 'y', fat.r)
  // The valve wheel on the fat riser, a rag tied on it.
  parts.add(rod([fat.x, 1.5, fat.out + fat.r], [fat.x, 1.5, fat.out + 0.3], 0.025, plain(C.iron)))
  const wheel = frame([fat.x, 1.5, fat.out + 0.3])
  wheel.add(hoop(0.2, 0.025, skin('brass'), 0, 0, 0, 14))
  for (let i = 0; i < 3; i++) wheel.add(box(0.025, 0.38, 0.025, skin('brass')).rotateZ((i / 3) * Math.PI))
  wheel.add(lying(0.04, 0.05, plain(C.iron), 0, 0, 0, 'z', 8))
  parts.add(wheel)
  rag(parts, [fat.x + 0.15, 1.38, fat.out + 0.32], 0.3)
  // Two junction boxes and their conduits; the upper one's lid hangs open, its wires out.
  for (const [y, w, h] of [[1.7, 0.38, 0.5], [0.95, 0.3, 0.36]]) parts.add(box(w, h, 0.16, skin('painted'), 0.8, y, 0.08))
  parts.add(box(0.33, 0.45, 0.005, plain(C.oil), 0.8, 1.7, 0.162)) // its open inside
  const lid = frame([0.8 - 0.2, 1.7, 0.17], [0, -1.25, 0])
  lid.add(box(0.41, 0.53, 0.02, skin('painted'), 0.205, -0.02, 0).rotateZ(-0.06))
  parts.add(lid)
  C.wires.forEach((color, i) => sag(parts, [0.72 + i * 0.07, 1.62, 0.15], [0.62 + i * 0.12, 1.12 - i * 0.08, 0.32 + i * 0.04], 0.12, 0.01, plain(color), 5))
  parts.add(box(0.33, 0.39, 0.02, skin('painted'), 0.8, 0.95, 0.17))
  parts.add(rod([0.8, 1.95, 0.08], [0.8, top, 0.08], 0.02, plain(C.soot), 6))
  parts.add(rod([0.8, 1.13, 0.08], [0.8, 1.45, 0.08], 0.02, plain(C.soot), 6))
  sag(parts, [0.95, 1.9, 0.1], [fat.x + 0.1, 3.4, fat.out + 0.1], 0.35, 0.012, plain(C.soot), 7)
  // The small gauge on the painted riser.
  const first = RISERS[0]
  const gaugeAt = [first.x, 1.75, first.out + first.r + 0.1]
  parts.add(rod([first.x, 1.75, first.out], gaugeAt, 0.02, skin('brass'), 6))
  const shaking = gauge(parts, group, gaugeAt, 0.09)
  group.add(baked(parts))
  return { group, needle: shaking, phase: Math.random() * TAU }
}

// --- Radio ---

// A bar from `a` to `b`, `thickness` square.
function strut(a, b, thickness, material) {
  const from = new THREE.Vector3(...a)
  const to = new THREE.Vector3(...b)
  const direction = to.clone().sub(from)
  const mesh = box(thickness, direction.length(), thickness, material)
  mesh.position.copy(from).add(to).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  return mesh
}

// A lattice mast of four legs and crossed braces, from `y0` to `y1`, about (`x`, `z`), each
// rung of it (8 m or so, counted from the foot) in the paint `paintOf` gives it.
function lattice(g, x, z, halfWidth, halfDepth, y0, y1, bar, brace, paintOf) {
  const rungs = Math.max(2, Math.round((y1 - y0) / 8))
  const step = (y1 - y0) / rungs
  for (let i = 0; i < rungs; i++) {
    const ya = y0 + i * step
    const yb = ya + step
    const paint = paintOf(i)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(bar, step, bar, paint, x + sx * halfWidth, (ya + yb) / 2, z + sz * halfDepth))
    if (i > 0) {
      for (const s of [-1, 1]) {
        g.add(box(halfWidth * 2, brace, brace, paint, x, ya, z + s * halfDepth))
        g.add(box(brace, brace, halfDepth * 2, paint, x + s * halfWidth, ya, z))
      }
    }
    for (const s of [-1, 1]) {
      g.add(strut([x - halfWidth, ya, z + s * halfDepth], [x + halfWidth, yb, z + s * halfDepth], brace, paint))
      g.add(strut([x + s * halfWidth, ya, z - halfDepth], [x + s * halfWidth, yb, z + halfDepth], brace, paint))
    }
  }
}

// A rusted lattice mast with a ladder up a face and a cable taped down a leg, a grated platform near
// its head (a rail of it broken and hanging), cross-arms of aerials on insulators and whips
// above, a rag of a pennant, an amber beacon in a cage, and two dishes on arms that swing slowly
// round: the upper one knocked askew on its mount, a panel of it gone, a stay snapped, its feed
// hanging on its cable. A brace has come away halfway up and hangs from one end.
const MAST = { height: 26, half: 1.1 }
function radioTower() {
  const { height, half } = MAST
  const group = new THREE.Group()
  const parts = new THREE.Group()
  // Laid 4 m at a time, `lattice` braces every 2; its legs and braces heavier than a real mast's,
  // or across the gorge they thin to nothing.
  for (let y = 0; y < height; y += 4) lattice(parts, 0, 0, half, half, y, Math.min(height, y + 4), 0.26, 0.12, () => skin('rust'))
  parts.add(rod([half, 12, half], [half + 0.5, 9.6, half + 0.35], 0.06, skin('rust'), 4)) // the brace come away
  // The ladder up the +Z face, and the cable down the −X −Z leg, tied every 4 m and looping between.
  for (const x of [-0.25, 0.25]) parts.add(rod([x, 0, half + 0.3], [x, height, half + 0.3], 0.025, plain(C.iron), 4))
  for (let y = 0.3; y < height; y += 0.35) parts.add(box(0.5, 0.025, 0.025, plain(C.iron), 0, y, half + 0.3))
  for (let y = 2; y < height; y += 2) parts.add(box(0.04, 0.04, 0.3, plain(C.iron), 0.25, y, half + 0.15))
  parts.add(rod([-half - 0.14, 0, -half - 0.14], [-half - 0.14, height, -half - 0.14], 0.035, plain(C.soot), 5))
  for (let y = 1; y < height; y += 4) parts.add(box(0.12, 0.05, 0.12, skin('rag'), -half - 0.1, y, -half - 0.1))
  // The platform, its rail on posts, one length of rail broken and hanging.
  parts.add(tile(box(2 * half + 0.6, 0.1, 2 * half + 0.6, skin('grating'), 0, height, 0), 6, 6))
  const edge = half + 0.3
  for (const s of [-1, 1]) {
    parts.add(box(2 * edge, 0.05, 0.05, skin('rust'), 0, height + 1, s * edge))
    if (s > 0) parts.add(box(0.05, 0.05, 2 * edge, skin('rust'), s * edge, height + 1, 0))
    for (const t of [-1, 1]) parts.add(box(0.05, 1, 0.05, skin('rust'), s * edge, height + 0.5, t * edge))
  }
  parts.add(rod([-edge, height + 1, edge], [-edge - 0.1, height + 0.05, -0.2], 0.025, skin('rust'), 4))
  // The mast above, its cross-arms of aerials on brass insulators, whips, the pennant, the beacon.
  parts.add(rod([0, height, 0], [0, height + 9, 0], 0.09, skin('rust'), 6))
  for (const [y, span] of [[height + 3, 3.4], [height + 5.5, 2.4], [height + 7.5, 1.4]]) {
    parts.add(box(span, 0.07, 0.07, skin('rust'), 0, y, 0))
    for (const s of [-1, 1]) {
      parts.add(cylinder(0.05, 0.16, skin('brass'), (s * span) / 2, y + 0.1, 0, 6))
      parts.add(rod([(s * span) / 2, y + 0.18, 0], [(s * span) / 2 + s * 0.06, y + 1.3, 0], 0.02, plain(C.iron), 4))
    }
  }
  parts.add(box(0.5, 0.18, 0.012, skin('rag'), 0.28, height + 8.6, 0).rotateZ(-0.25))
  parts.add(asLight(ball(0.18, plain(C.glow), 0, height + 9.2, 0)))
  for (const y of [9.05, 9.35]) parts.add(hoop(0.22, 0.015, plain(C.iron), 0, height + y, 0, 8).rotateX(Math.PI / 2))
  const built = { group, phase: Math.random() * TAU }
  for (const [name, y, sx, sz, askew] of [['dishA', 15, 1, 1, false], ['dishB', 20, -1, 1, true]]) {
    const pivot = frame([sx * half, y, sz * half])
    const holder = frame([0, 0, 0], askew ? [0.45, Math.atan2(sx, sz), 0.35] : [0, Math.atan2(sx, sz), 0])
    const dish = new THREE.Group()
    // Its arm out of the corner, long enough that the bowl swings clear of the mast.
    dish.add(rod([0, 0, 0], [0, 0, 1.4], 0.06, skin('rust'), 6))
    const bowl = batter(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.18, 0.4, 18), skin('enamel')), 0.04)
    bowl.rotation.x = Math.PI / 2
    bowl.position.z = 1.6
    dish.add(bowl)
    dish.add(new THREE.Mesh(new THREE.CircleGeometry(0.98, 18), celMaterial({ map: dishFace(askew ? 159 : 157) })).translateZ(1.805))
    dish.add(hoop(1.08, 0.03, skin('rust'), 0, 0, 1.8, 18))
    if (askew) {
      // Its feed fallen, hanging off the rim on its cable; one stay left, bent.
      sag(dish, [0, 0.9, 1.8], [0.25, -0.6, 2.4], 0.3, 0.015, plain(C.soot), 5)
      dish.add(cylinder(0.08, 0.15, skin('soot'), 0.25, -0.68, 2.4, 8))
      dish.add(rod([Math.cos(2.1) * 1.05, Math.sin(2.1) * 1.05, 1.8], [-0.2, 0.1, 2.3], 0.015, plain(C.iron), 4))
    } else {
      dish.add(rod([0, 0, 1.8], [0, 0, 2.6], 0.03, plain(C.iron), 4))
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * TAU
        dish.add(rod([Math.cos(angle) * 1.05, Math.sin(angle) * 1.05, 1.8], [0, 0, 2.6], 0.015, plain(C.iron), 4))
      }
      dish.add(cylinder(0.08, 0.15, skin('soot'), 0, 0, 2.65, 8).rotateX(Math.PI / 2))
    }
    holder.add(baked(dish))
    pivot.add(holder)
    group.add(pivot)
    built[name] = pivot
    sag(parts, [sx * half, y - 0.1, sz * half], [-half - 0.14, y - 2, -half - 0.14], 0.6, 0.02, plain(C.soot), 6) // its cable to the bundle
  }
  group.add(baked(parts))
  return built
}

// --- Loudspeakers ---

// A horn speaker into `holder`, its mouth toward +Z: the driver's can, the flare beaten and gone
// green, its rusted lip, the grille over its throat (a hole punched in it).
function horn(holder) {
  holder.add(lying(0.13, 0.24, skin('soot'), 0, 0, -0.1, 'z', 12))
  holder.add(lying(0.15, 0.03, skin('rust'), 0, 0, 0.02, 'z', 12))
  const flare = batter(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.07, 0.85, 16), skin('verdigris')), 0.05)
  flare.rotation.x = Math.PI / 2
  flare.position.z = 0.42
  holder.add(tile(flare, 2, 1))
  holder.add(hoop(0.38, 0.022, skin('rust'), 0, 0, 0.85, 16))
  holder.add(new THREE.Mesh(new THREE.CircleGeometry(0.34, 16), celMaterial({ map: grille() })).translateZ(0.852))
}

// A horn on a bracket out of a wall, tipped down at the street, its cable taped and looped back to
// the wall.
function loudspeaker() {
  const group = new THREE.Group()
  const parts = new THREE.Group()
  parts.add(box(0.2, 0.3, 0.04, skin('rust'), 0, 0, 0.02))
  boltRing(parts, [0, 0, 0.04], 'z', 0.1, 4, 0.016, 1)
  parts.add(box(0.06, 0.06, 0.5, skin('rust'), 0, 0, 0.27))
  parts.add(rod([0, -0.13, 0.03], [0, -0.03, 0.4], 0.018, skin('rust'), 4))
  parts.add(rod([0, 0, 0.5], [0, -0.12, 0.5], 0.025, plain(C.iron), 6))
  const holder = frame([0, -0.2, 0.55], [0.25, 0, 0])
  horn(holder)
  parts.add(holder)
  sag(parts, [0, -0.26, 0.42], [0.05, -0.1, 0.03], 0.25, 0.012, plain(C.soot), 6)
  for (const [x, y, z] of [[0.02, -0.38, 0.27], [0.04, -0.3, 0.12]]) parts.add(cylinder(0.022, 0.05, skin('rag'), x, y, z, 6).rotateX(0.6))
  group.add(baked(parts))
  return { group }
}

// A pole with horns at its head, a rooftop's: leaning a little, its foot plate short of a bolt,
// steps up it, a junction box with its door open, a rag tied on it; of its three horns, one has a
// nest in its mouth and one has come off its clamp and hangs by its cable.
function speakerPole() {
  const group = new THREE.Group()
  const parts = new THREE.Group()
  const head = 5.6
  parts.add(box(0.5, 0.05, 0.5, skin('rust'), 0, 0.025, 0))
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2]]) parts.add(cylinder(0.025, 0.05, plain(C.iron), x, 0.07, z, 6))
  const pole = frame([0, 0, 0], [0, 0, 0.025])
  pole.add(rod([0, 0, 0], [0, head + 0.4, 0], 0.07, skin('rust'), 8))
  for (let y = 2.4, s = 1; y < head - 0.3; y += 0.4, s = -s) pole.add(rod([0, y, 0], [s * 0.22, y, 0], 0.015, plain(C.iron), 4))
  pole.add(hoop(0.18, 0.03, skin('rust'), 0, head, 0, 10).rotateX(Math.PI / 2))
  for (let i = 0; i < 3; i++) {
    const yaw = (i / 3) * TAU
    const ring = [Math.sin(yaw) * 0.2, head, Math.cos(yaw) * 0.2]
    const fallen = i === 2
    const holder = fallen ? frame([ring[0] * 2.2, head - 0.95, ring[2] * 2.2], [1.25, yaw, 0.3]) : frame(ring, [0.2, yaw, 0])
    horn(holder)
    if (i === 0) {
      // A nest in its mouth, twigs every way.
      for (let t = 0; t < 16; t++) {
        const [a, b] = [(t * 2.4) % TAU, ((t * 3.7) % TAU)]
        const [ra, rb] = [0.12 + ((t * 7) % 5) * 0.035, 0.1 + ((t * 3) % 5) * 0.04]
        holder.add(rod([Math.cos(a) * ra, Math.sin(a) * ra - 0.1, 0.72], [Math.cos(b) * rb, Math.sin(b) * rb - 0.12, 0.86], 0.008, plain(C.twig), 3))
      }
    }
    pole.add(holder)
    if (fallen) sag(pole, ring, [ring[0] * 2.2, head - 0.95, ring[2] * 2.2], 0.15, 0.012, plain(C.soot), 5)
  }
  pole.add(box(0.3, 0.4, 0.18, skin('painted'), 0, 2, 0.16))
  pole.add(box(0.3, 0.4, 0.015, skin('painted'), 0.24, 2, 0.32).rotateY(-1.1))
  C.wires.forEach((color, i) => sag(pole, [-0.08 + i * 0.07, 1.9, 0.24], [-0.05 + i * 0.1, 1.45, 0.3 + i * 0.03], 0.08, 0.009, plain(color), 4))
  pole.add(rod([0.03, 2.2, 0.09], [0.03, head - 0.2, 0.09], 0.015, plain(C.soot), 4))
  rag(pole, [0.08, 3.2, 0.02], 0.45, 0.3)
  parts.add(pole)
  group.add(baked(parts))
  return { group }
}

// --- What moves ---

const _keep = { t: -1, h: 0, m: 0, s: 0 }
// The hour now, read once a frame however many clocks there are: hours and minutes swept, the
// second hand stepping, quick at the start of each second.
function hourNow(t) {
  if (_keep.t === t) return _keep
  const now = new Date()
  const seconds = now.getSeconds() + now.getMilliseconds() / 1000
  _keep.t = t
  _keep.s = Math.floor(seconds) + Math.min(1, (seconds % 1) / 0.12)
  _keep.m = now.getMinutes() + seconds / 60
  _keep.h = (now.getHours() % 12) + _keep.m / 60
  return _keep
}

/**
 * A machine as its kind's `moves` has it, `t` seconds into the place and `dt` on from the last
 * frame. Look only.
 */
export function work(built, moves, t, dt) {
  const { turns, sways, trembles, drives, keepsTime } = moves
  if (turns) for (const name in turns) built[name].rotation[turns[name][1] ?? 'z'] += turns[name][0] * dt
  if (sways) {
    for (const name in sways) {
      const [by, every, axis = 'y'] = sways[name]
      built[name].rotation[axis] = by * Math.sin((TAU * t) / every + built.phase)
    }
  }
  if (trembles) for (const name in trembles) built[name].rotation.z = trembles[name] * (0.6 * Math.sin(t * 23 + built.phase) + 0.4 * Math.sin(t * 37.7))
  if (drives) {
    // The crosshead on the axle's line, as far behind the crank's pin as the rod is long.
    const { shaft, piston, rod: conrod, axle: [ax], throw: crank, length: rodLong } = drives
    const angle = built[shaft].rotation.z
    const [px, py] = [crank * Math.cos(angle), crank * Math.sin(angle)]
    const head = ax + px - Math.sqrt(rodLong * rodLong - py * py)
    built[piston].position.x = head - (ax + crank - rodLong)
    built[conrod].position.x = head
    built[conrod].rotation.z = Math.atan2(py, ax + px - head)
  }
  if (keepsTime) {
    const { h, m, s } = hourNow(t)
    for (const { hour, minute, second } of built.clocks) {
      hour.rotation.z = -(h / 12) * TAU
      minute.rotation.z = -(m / 60) * TAU
      second.rotation.z = -(s / 60) * TAU
    }
  }
}

const SPEAKER = { name: 'speaker', near: 6, reach: 110 } // metres, at scale 1

/** The machines, as `room-props.js`'s `PROPS` are: `build`, `solid` if met, and `traits` (see above). */
export const MACHINES = {
  stationClock: { build: stationClock, traits: { moves: { keepsTime: true } } },
  clockFace: { build: clockFace, traits: { moves: { keepsTime: true } } },
  boiler: {
    build: boiler,
    solid: [2.8, BOILER.top + 0.86, 2.8],
    traits: { moves: { trembles: { needle: 0.05 } }, vents: [[...STACK_TOP, 1.4], [0.5, BOILER.top + 0.95, 0.3, 0.5], [1.75, 1.55, 0.1, 0.2]] },
  },
  steamEngine: {
    build: steamEngine,
    solid: [5.2, ENGINE.axle[1] + ENGINE.flywheel + 0.12, 2.7],
    traits: {
      moves: { turns: { shaft: [2], governor: [4.5, 'y'] }, drives: { shaft: 'shaft', piston: 'piston', rod: 'rod', axle: ENGINE.axle, throw: ENGINE.throw, length: ENGINE.length } },
      vents: [[-2.0, ENGINE.axle[1] + 2.6, -0.2, 0.8], [-2.0, ENGINE.axle[1] + 1.5, -0.1, 0.2]],
    },
  },
  gearTrain: { build: () => gearTrain(), traits: cogTraits(GEAR_LAYOUT) },
  cog: { build: bigCog, traits: cogTraits({ gears: [{ name: 'gearA', speed: DRIVEN }] }) },
  ...Object.fromEntries(Object.entries(COG_LAYOUTS).map(([name, layout]) => [name, { build: () => gearTrain(layout, false), traits: cogTraits(layout) }])),
  wallPipes: { build: wallPipes, traits: { moves: { trembles: { needle: 0.08 } }, vents: [[RISERS[2].x, SNAPPED + 0.08, RISERS[2].out, 0.3], [RISERS[1].x, 2.75, RISERS[1].out + 0.15, 0.2]] } },
  radioTower: { build: radioTower, solid: [2 * MAST.half + 0.2, MAST.height, 2 * MAST.half + 0.2], traits: { moves: { sways: { dishA: [0.5, 16], dishB: [0.12, 5] } } } },
  loudspeaker: { build: loudspeaker, traits: { hums: { ...SPEAKER, at: [0, -0.43, 1.35] } } },
  speakerPole: { build: speakerPole, traits: { hums: { ...SPEAKER, near: 8, reach: 140, at: [0, 5.6, 0] } } },
}

/** Advance one cog assembly without changing geometry or its mechanical ratios. */
export function workCogs(built, moves, animation, dt, timing) {
  const state = built.cogMotion ??= {}
  const radians = cogStep(state, animation, dt, timing)
  for (const [name, [speed]] of Object.entries(moves.turns)) built[name].rotation.z += radians * speed / DRIVEN
}
