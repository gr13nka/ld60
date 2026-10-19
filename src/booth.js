// The watchman's booth Ворон will sit in, handing out matches and parts through its hatch: a
// prop as the room's are (`room-props.js`, whose `PROPS` takes it in), facing +Z, its origin
// at its floor's middle. A man's size, as a real one is: a stool behind a desk under the glass
// (`PERCH`), the hatch at a man's chest.
//
// A Soviet вахта: painted panels peeling to rust below, a band of glazing in dark frames above,
// one pane cracked and taped, one gone with its shards still in the putty, the hatch with its
// shelf outside, a lamp on a bent arm over it. Inside it is paper: stacks on the desk, a ledger
// open, a spike of slips, a wall of pigeonholes, folders, sheets pinned up and dropped on the
// floor. The lamps are only fittings: a prop carries no light, so their bulbs are the place's
// `lights`, stood at `LAMPS` (their `head`s are what glows). Its solid is the whole booth: it
// is seen into, not gone into. Every size and colour is a first guess, unseen. Red is what
// blows up and green a gate: nothing here is either. Look only.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { box, cylinder, pipe } from './models.js'
import { celMaterial } from './shading.js'
import { baked, paint, part, plain } from './npc-kit.js'
import { skin, tile } from './machine-paint.js'
import { write } from './room-props.js'

const SIZE = { w: 2.0, h: 2.8, d: 1.8 }
const WALL = 0.05
const SILL = 0.95 // the panels' top, the glazing's foot, the hatch's sill
const HEAD = 2.25 // the glazing's top
const ROOF = 2.35

/** Where whoever keeps it sits behind the desk: the top of the stool, in the booth's frame. */
export const PERCH = [0.1, 0.62, 0.05]
/** Where the bulbs are, in the booth's frame: the place's `lights` stand there. */
export const LAMPS = { hatch: [0.03, 2.22, 1.4], inside: [0.5, 1.95, -0.15] }

const C = {
  plinth: 0x4a4640,
  frame: 0x2e2c2a,
  iron: 0x3c3836,
  roof: 0x3a3430,
  wood: 0x6a4c32,
  darkWood: 0x4a3424,
  papers: [0xe6dcc0, 0xd8cca8, 0xcfc3a0, 0xe8e2d0, 0xc8bc98],
  card: 0x9a7a52,
  tape: 0xc8b88a,
  folders: [0xa8843a, 0x3a5a8a, 0x6a6a64, 0x5a4030, 0x8a7a5a],
  phone: 0x1a1a1c,
  steel: 0x8a8a84,
  ink: 0x2a3448,
}
const TAU = Math.PI * 2

// A number in [0, 1) from the booth's own sequence, so its mess is the same every visit.
function scatter(seed) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const placed = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
  mesh.position.set(x, y, z)
  mesh.rotation.set(rx, ry, rz)
  return mesh
}

// --- What is written on it, each drawn once ---

let _pages
function pages() {
  if (_pages) return _pages
  const scrawl = paint(32, 48, (b) => {
    b.fill('#e2d8bc')
    for (let v = 0.9; v > 0.08; v -= 0.06) b.rect(0.1, v, 0.15 + b.random() * 0.75, v + 0.015, '#3a4458', 0.75)
    b.blotches('#b8a47a', { count: 4, size: 8, alpha: 0.35 })
    b.grain(0.06)
  }, 61)
  const grid = paint(48, 32, (b) => {
    b.fill('#e6dcc0')
    for (let i = 0; i <= 8; i++) b.rect(0.05 + i * 0.1125, 0.08, 0.06 + i * 0.1125, 0.86, '#5a5446', 0.8)
    for (let j = 0; j <= 6; j++) b.rect(0.05, 0.08 + j * 0.13, 0.95, 0.09 + j * 0.13, '#5a5446', 0.8)
    for (let k = 0; k < 14; k++) b.dot(0.1 + (b.random() * 8 | 0) * 0.1125, 0.14 + (b.random() * 6 | 0) * 0.13, 0.6, '#2a3448')
    b.rect(0.05, 0.9, 0.7, 0.95, '#2a2620', 0.8) // the heading
    b.blotches('#b8a47a', { count: 5, size: 9, alpha: 0.3 })
    b.grain(0.06)
  }, 67)
  _pages = { scrawl, grid }
  return _pages
}

// A note in a hand, two lines, for the glass.
const note = (top, bottom, seed) => paint(48, 32, (b) => {
  b.fill('#e8dfc4')
  write(b, top, 0.5, 0.66, 10, '#26304a')
  write(b, bottom, 0.5, 0.3, 10, '#26304a')
  b.blotches('#b8a47a', { count: 3, size: 8, alpha: 0.35 })
  b.grain(0.05)
}, seed)

const sign = () => paint(96, 24, (b) => {
  b.fill('#2a3440')
  b.rect(0.02, 0.08, 0.98, 0.92, '#344050')
  write(b, 'ВАХТА', 0.5, 0.5, 17, '#d8c890')
  b.blotches('#5a3a22', { count: 5, size: 7, alpha: 0.45 }) // rust weeping from its screws
  b.grain(0.1)
}, 71)

// --- The booth ---

function booth() {
  const { w, d } = SIZE
  const [x0, x1, z0, z1] = [-w / 2, w / 2, -d / 2, d / 2]
  const random = scatter(1985)
  const group = new THREE.Group()
  const parts = new THREE.Group()
  const panel = skin('painted')
  const glass = []
  const pane = (width, height, x, y, z, turn = 0) => {
    const geometry = new THREE.PlaneGeometry(width, height)
    geometry.rotateY(turn)
    geometry.translate(x, y, z)
    glass.push(geometry)
  }

  // The plinth it stands on, and the roof with its lip.
  parts.add(box(w + 0.08, 0.12, d + 0.08, plain(C.plinth), 0, 0.06, 0))
  parts.add(box(w + 0.24, 0.12, d + 0.24, plain(C.roof), 0, ROOF + 0.06, 0))
  parts.add(box(w + 0.28, 0.05, 0.05, plain(C.iron), 0, ROOF + 0.025, z1 + 0.12)) // its drip edge, sagging at one end
  parts.children.at(-1).rotation.z = 0.015

  // The panels below the glass: front, back (full height, for what is pinned inside), two sides.
  const lower = SILL - 0.12
  parts.add(tile(box(w, lower, WALL, panel, 0, 0.12 + lower / 2, z1 - WALL / 2), 2, 1))
  parts.add(tile(box(w, ROOF - 0.12, WALL, panel, 0, 0.12 + (ROOF - 0.12) / 2, z0 + WALL / 2), 2, 2))
  parts.add(tile(box(WALL, lower, d, panel, x1 - WALL / 2, 0.12 + lower / 2, 0), 2, 1))
  // A dent kicked into the front panel, and its kick plate.
  parts.add(placed(box(0.34, 0.2, 0.025, plain(C.iron)), -0.55, 0.3, z1 + 0.01, 0.08, 0.1, 0.03))
  parts.add(box(w, 0.08, 0.02, plain(C.frame), 0, 0.16, z1 + 0.01))

  // The posts at the corners and the frames of the glazing, and the beam over it all.
  const post = (x, z) => parts.add(box(0.07, ROOF - 0.12, 0.07, plain(C.frame), x, 0.12 + (ROOF - 0.12) / 2, z))
  post(x0 + 0.035, z1 - 0.035); post(x1 - 0.035, z1 - 0.035); post(x0 + 0.035, z0 + 0.035); post(x1 - 0.035, z0 + 0.035)
  parts.add(box(w, ROOF - HEAD, 0.07, plain(C.frame), 0, (HEAD + ROOF) / 2, z1 - 0.035))
  parts.add(box(0.07, ROOF - HEAD, d, plain(C.frame), x0 + 0.035, (HEAD + ROOF) / 2, 0))
  parts.add(box(0.07, ROOF - HEAD, d, plain(C.frame), x1 - 0.035, (HEAD + ROOF) / 2, 0))
  parts.add(box(w, 0.04, 0.1, plain(C.frame), 0, SILL, z1 - 0.04)) // the sill, front
  parts.add(box(0.1, 0.04, d, plain(C.frame), x1 - 0.04, SILL, 0)) // and side

  // The front: three bays. The left one cracked and taped across, the hatch in the middle one.
  const glassY = (SILL + HEAD) / 2
  const glassH = HEAD - SILL
  const zGlass = z1 - 0.035
  const mullion = 0.35
  const bay = x1 - 0.07 - mullion
  for (const x of [-mullion, mullion]) parts.add(box(0.05, glassH, 0.05, plain(C.frame), x, glassY, zGlass))
  pane(bay, glassH, -(mullion + bay / 2), glassY, zGlass)
  for (const turn of [1.1, -1.05]) parts.add(placed(box(1.2, 0.04, 0.004, plain(C.tape)), -(mullion + bay / 2), glassY + 0.05, zGlass + 0.005, 0, 0, turn))
  pane(bay, glassH, mullion + bay / 2, glassY, zGlass)
  // The hatch: an opening at the sill, a transom over it, glass on either side and above.
  const hatch = { w: 0.45, h: 0.3 }
  const transom = SILL + 0.02 + hatch.h
  const side = (2 * mullion - hatch.w) / 2
  parts.add(box(2 * mullion, 0.04, 0.05, plain(C.frame), 0, transom + 0.02, zGlass))
  for (const s of [-1, 1]) {
    parts.add(box(0.03, hatch.h, 0.05, plain(C.frame), s * hatch.w / 2, SILL + 0.02 + hatch.h / 2, zGlass))
    pane(side, hatch.h, s * (hatch.w + side) / 2, SILL + 0.02 + hatch.h / 2, zGlass)
  }
  pane(2 * mullion, HEAD - transom - 0.04, 0, (transom + 0.04 + HEAD) / 2, zGlass)
  // Its shelf outside, worn pale in the middle where things are passed over, on two brackets.
  parts.add(box(0.6, 0.03, 0.24, plain(C.wood), 0, SILL + 0.005, z1 + 0.12))
  parts.add(box(0.3, 0.004, 0.16, plain(0x8a6a48), 0.03, SILL + 0.022, z1 + 0.13))
  for (const s of [-1, 1]) parts.add(placed(box(0.025, 0.025, 0.26, plain(C.iron)), s * 0.25, SILL - 0.09, z1 + 0.1, 0.62, 0, 0))

  // The side away from the door: two bays, the back one's glass gone, shards left in the frame.
  const zMid = 0
  parts.add(box(0.05, glassH, 0.05, plain(C.frame), x1 - 0.035, glassY, zMid))
  pane(z1 - 0.07 - zMid, glassH, x1 - 0.035, glassY, (zMid + z1 - 0.07) / 2, Math.PI / 2)
  const shard = (points) => {
    const shape = new THREE.Shape(points.map(([a, b]) => new THREE.Vector2(a, b)))
    const geometry = new THREE.ShapeGeometry(shape)
    geometry.rotateY(Math.PI / 2)
    geometry.translate(x1 - 0.035, 0, 0)
    glass.push(geometry)
  }
  const zb0 = z0 + 0.07
  const zb1 = zMid - 0.025
  // Seen from outside (+X) the shape's x runs along −Z, so a shard's first number is −z.
  shard([[-zb1, SILL + 0.02], [-zb1 + 0.32, SILL + 0.02], [-zb1 + 0.08, SILL + 0.3]])
  shard([[-zb0 - 0.26, HEAD], [-zb0, HEAD], [-zb0, HEAD - 0.42]])
  shard([[-zb0, SILL + 0.02], [-zb0 - 0.2, SILL + 0.02], [-zb0, SILL + 0.17]])

  // The door's side: a door, its glass in its upper half, and a panel beyond it.
  const door = { z0: zMid - 0.03, z1: z1 - 0.07, low: 1.05 }
  const doorD = door.z1 - door.z0
  const doorZ = (door.z0 + door.z1) / 2
  parts.add(tile(box(WALL, lower, door.z0 - z0, panel, x0 + WALL / 2, 0.12 + lower / 2, (z0 + door.z0) / 2), 1, 1))
  pane(door.z0 - z0 - 0.07, glassH, x0 + 0.035, glassY, (z0 + 0.07 + door.z0) / 2, Math.PI / 2)
  parts.add(tile(box(0.04, door.low - 0.12, doorD, panel, x0 + 0.02, 0.12 + (door.low - 0.12) / 2, doorZ), 1, 1))
  for (const z of [door.z0, door.z1]) parts.add(box(0.045, HEAD - door.low, 0.045, plain(C.frame), x0 + 0.02, (door.low + HEAD) / 2, z))
  parts.add(box(0.045, 0.045, doorD, plain(C.frame), x0 + 0.02, door.low, doorZ))
  pane(doorD - 0.045, HEAD - door.low - 0.025, x0 + 0.02, (door.low + 0.025 + HEAD) / 2, doorZ, Math.PI / 2)
  parts.add(box(0.05, 0.025, 0.12, plain(C.steel), x0 - 0.02, 0.95, door.z1 - 0.1)) // the handle, and the lock below
  parts.add(box(0.015, 0.07, 0.04, plain(C.iron), x0 - 0.005, 0.83, door.z1 - 0.1))
  parts.add(placed(box(0.3, 0.21, 0.004, plain(C.papers[0])), x0 - 0.005, 0.68, doorZ, 0, -Math.PI / 2, 0.06)) // a notice on the door

  // The sign over the front, hung a little crooked on its brackets.
  const board = new THREE.Group()
  board.add(box(1.1, 0.26, 0.06, plain(C.frame), 0, 0, 0))
  board.add(placed(part(new THREE.PlaneGeometry(1.04, 0.22), sign()), 0, 0, 0.032))
  board.position.set(0, ROOF + 0.27, z1 + 0.08)
  board.rotation.z = -0.025
  parts.add(board)
  for (const s of [-1, 1]) parts.add(box(0.03, 0.14, 0.03, plain(C.iron), s * 0.45, ROOF + 0.12, z1 + 0.06))

  // The lamp over the hatch: an arm out of the beam, bent down, a tin shade knocked askew.
  const [lx, ly, lz] = LAMPS.hatch
  parts.add(pipe({ x: lx - 0.06, y: ROOF - 0.05, z: z1 }, { x: lx - 0.06, y: ROOF - 0.02, z: lz - 0.14 }, 0.012, plain(C.iron)))
  parts.add(pipe({ x: lx - 0.06, y: ROOF - 0.02, z: lz - 0.14 }, { x: lx, y: ly + 0.08, z: lz }, 0.012, plain(C.iron)))
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.13, 0.1, 10, 1, true), celMaterial({ color: C.frame, side: THREE.DoubleSide }))
  parts.add(placed(shade, lx, ly + 0.035, lz, 0.18, 0, 0.1))
  parts.add(cylinder(0.02, 0.04, plain(C.iron), lx, ly + 0.07, lz, 8))

  // --- Inside: the desk under the glass ---
  const deskTop = SILL - 0.04
  const deskD = 0.5
  const deskZ = z1 - WALL - deskD / 2
  parts.add(box(w - 0.14, 0.03, deskD, plain(C.darkWood), 0, deskTop, deskZ))
  parts.add(box(0.4, deskTop - 0.14, deskD - 0.06, plain(C.darkWood), x1 - 0.3, 0.12 + (deskTop - 0.14) / 2, deskZ)) // its drawers
  for (const y of [0.35, 0.65]) parts.add(box(0.1, 0.015, 0.015, plain(C.steel), x1 - 0.3, y, deskZ - deskD / 2 + 0.02))
  parts.add(box(0.04, deskTop - 0.14, 0.04, plain(C.darkWood), x0 + 0.15, 0.12 + (deskTop - 0.14) / 2, deskZ - deskD / 2 + 0.06))

  // Stacks of paper, no two sheets square.
  const top = deskTop + 0.015
  const stack = (x, z, count, size = [0.3, 0.21]) => {
    let y = top
    for (let i = 0; i < count; i++) {
      const thick = 0.006 + random() * 0.01
      parts.add(placed(box(size[0], thick, size[1], plain(C.papers[(random() * C.papers.length) | 0])), x + (random() - 0.5) * 0.03, y + thick / 2, z + (random() - 0.5) * 0.03, 0, (random() - 0.5) * 0.35, 0))
      y += thick
    }
    return y
  }
  stack(-0.68, deskZ + 0.1, 10)
  const tall = stack(0.66, deskZ + 0.07, 16)
  parts.add(placed(box(0.3, 0.004, 0.21, plain(C.papers[3])), 0.76, tall + 0.03, deskZ + 0.12, 0.3, 0.5, -0.4)) // one sliding off

  // The ledger open by the hatch, its pages written, a pen across it.
  const scrawl = pages().scrawl
  parts.add(box(0.5, 0.02, 0.34, plain(C.ink), 0.08, top + 0.01, deskZ + 0.06))
  for (const s of [-1, 1]) {
    const page = part(new THREE.PlaneGeometry(0.235, 0.32), scrawl)
    parts.add(placed(page, 0.08 + s * 0.122, top + 0.025, deskZ + 0.06, -Math.PI / 2, 0, s * 0.04))
  }
  parts.add(placed(box(0.14, 0.01, 0.01, plain(C.phone)), 0.14, top + 0.035, deskZ + 0.03, 0, 0.7, 0))

  // A spike of slips, a stamp and its pad, a telephone, a desk lamp turned to the wall.
  parts.add(cylinder(0.035, 0.015, plain(C.iron), -0.38, top + 0.008, deskZ - 0.15, 8))
  parts.add(cylinder(0.003, 0.15, plain(C.steel), -0.38, top + 0.08, deskZ - 0.15, 4))
  for (let i = 0; i < 8; i++) parts.add(placed(box(0.07, 0.002, 0.1, plain(C.papers[i % 5])), -0.38, top + 0.025 + i * 0.011, deskZ - 0.15, 0, random() * TAU, (random() - 0.5) * 0.15))
  parts.add(box(0.11, 0.015, 0.07, plain(C.ink), -0.36, top + 0.008, deskZ + 0.14))
  parts.add(box(0.05, 0.025, 0.035, plain(C.darkWood), -0.24, top + 0.013, deskZ + 0.16))
  parts.add(cylinder(0.013, 0.06, plain(C.darkWood), -0.24, top + 0.055, deskZ + 0.16, 6))
  const phone = new THREE.Group()
  phone.add(box(0.2, 0.08, 0.22, plain(C.phone), 0, 0.04, 0))
  phone.add(placed(cylinder(0.06, 0.012, plain(C.frame), 0, 0, 0, 10), 0, 0.085, 0.045, 0.45, 0, 0))
  phone.add(box(0.24, 0.035, 0.05, plain(C.phone), 0, 0.105, -0.06))
  for (const s of [-1, 1]) phone.add(box(0.06, 0.04, 0.07, plain(C.phone), s * 0.1, 0.11, -0.06))
  phone.position.set(0.55, top, deskZ - 0.13)
  phone.rotation.y = -0.3
  parts.add(phone)
  const lamp = new THREE.Group()
  lamp.add(cylinder(0.07, 0.02, plain(C.frame), 0, 0.01, 0, 10))
  lamp.add(pipe({ x: 0, y: 0.02, z: 0 }, { x: 0.04, y: 0.28, z: -0.08 }, 0.008, plain(C.frame)))
  lamp.add(pipe({ x: 0.04, y: 0.28, z: -0.08 }, { x: 0.1, y: 0.26, z: -0.22 }, 0.008, plain(C.frame)))
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.08, 0.1, 8, 1, true), celMaterial({ color: C.frame, side: THREE.DoubleSide }))
  lamp.add(placed(cone, 0.1, 0.23, -0.24, -0.9, 0, 0))
  lamp.position.set(-0.75, top, deskZ - 0.12)
  lamp.rotation.y = 0.4
  parts.add(lamp)

  // The stool behind the desk, its seat worn through to the wood.
  const [px, py, pz] = PERCH
  parts.add(cylinder(0.17, 0.04, plain(C.wood), px, py - 0.02, pz, 12))
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.4
    parts.add(pipe({ x: px + Math.cos(a) * 0.1, y: py - 0.04, z: pz + Math.sin(a) * 0.1 }, { x: px + Math.cos(a) * 0.17, y: 0.12, z: pz + Math.sin(a) * 0.17 }, 0.015, plain(C.iron), 5))
  }

  // --- The back wall: pigeonholes, folders on a shelf over them, sheets pinned beside ---
  const wallZ = z0 + WALL
  const rack = { x: 0.38, y0: 1.15, cols: 5, rows: 4, cell: 0.2, depth: 0.25 }
  const rackW = rack.cols * rack.cell
  const rackH = rack.rows * rack.cell
  parts.add(box(rackW + 0.03, rackH + 0.03, 0.015, plain(C.darkWood), rack.x, rack.y0 + rackH / 2, wallZ + 0.008))
  for (let c = 0; c <= rack.cols; c++) parts.add(box(0.015, rackH, rack.depth, plain(C.wood), rack.x - rackW / 2 + c * rack.cell, rack.y0 + rackH / 2, wallZ + rack.depth / 2))
  for (let r = 0; r <= rack.rows; r++) parts.add(box(rackW, 0.015, rack.depth, plain(C.wood), rack.x, rack.y0 + r * rack.cell, wallZ + rack.depth / 2))
  // What is in the cells: sheets folded in, a roll, envelopes. Some are empty, kept for the matches.
  for (let r = 0; r < rack.rows; r++) {
    for (let c = 0; c < rack.cols; c++) {
      const odds = random()
      const cx = rack.x - rackW / 2 + (c + 0.5) * rack.cell
      const cy = rack.y0 + r * rack.cell + 0.008
      const cz = wallZ + rack.depth / 2
      if (odds < 0.3) continue
      if (odds < 0.75) {
        const n = 1 + ((random() * 4) | 0)
        for (let i = 0; i < n; i++) parts.add(placed(box(0.15, 0.005, 0.2, plain(C.papers[(random() * 5) | 0])), cx, cy + 0.005 * (i + 1), cz + 0.01, 0, (random() - 0.5) * 0.2, 0))
      } else if (odds < 0.9) {
        parts.add(placed(box(0.12, 0.08, 0.004, plain(C.papers[4])), cx, cy + 0.05, cz + 0.07, 0.25, (random() - 0.5) * 0.3, 0))
      } else {
        parts.add(placed(cylinder(0.025, 0.17, plain(C.papers[0]), 0, 0, 0, 6), cx, cy + 0.033, cz + 0.04, 0, 0, Math.PI / 2))
      }
    }
  }
  // The shelf over the rack, its folders leaning, one fallen flat.
  const shelfY = rack.y0 + rackH + 0.08
  parts.add(box(rackW + 0.12, 0.025, 0.24, plain(C.wood), rack.x, shelfY, wallZ + 0.12))
  let fx = rack.x - rackW / 2 + 0.03
  for (let i = 0; i < 10; i++) {
    const thick = 0.035 + random() * 0.04
    const tallness = 0.24 + random() * 0.06
    parts.add(placed(box(thick, tallness, 0.22, plain(C.folders[(random() * C.folders.length) | 0])), fx + thick / 2, shelfY + 0.013 + tallness / 2, wallZ + 0.12, 0, 0, i > 7 ? -0.25 : 0))
    fx += thick + 0.004
  }
  parts.add(box(0.22, 0.035, 0.3, plain(C.folders[0]), rack.x + rackW / 2 - 0.12, shelfY + 0.03, wallZ + 0.14))
  // Sheets pinned to the wall to the rack's left: a rota and the lists.
  const { grid } = pages()
  const pinned = [[grid, 0.36, 0.25, -0.5, 1.95, 0.03], [scrawl, 0.21, 0.3, -0.7, 1.5, -0.06], [scrawl, 0.21, 0.3, -0.38, 1.45, 0.09], [grid, 0.3, 0.21, -0.62, 2.2, -0.04]]
  for (const [texture, pw, ph, x, y, turn] of pinned) {
    parts.add(placed(part(new THREE.PlaneGeometry(pw, ph), texture), x, y, wallZ + 0.004 + random() * 0.004, 0, 0, turn))
    parts.add(box(0.012, 0.012, 0.01, plain(C.steel), x, y + ph / 2 - 0.025, wallZ + 0.008))
  }

  // --- The floor: what has fallen, what was screwed up, a carton of it all ---
  for (let i = 0; i < 6; i++) {
    const fx0 = x0 + 0.25 + random() * (w - 0.5)
    const fz0 = z0 + 0.25 + random() * (d - 0.9)
    parts.add(placed(box(0.3, 0.003, 0.21, plain(C.papers[(random() * 5) | 0])), fx0, 0.122 + i * 0.001, fz0, 0, random() * TAU, 0))
  }
  for (let i = 0; i < 4; i++) {
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035 + random() * 0.015, 0), plain(C.papers[(random() * 5) | 0]))
    parts.add(placed(ball, x0 + 0.3 + random() * (w - 0.6), 0.155, z0 + 0.25 + random() * 0.7, random(), random(), random()))
  }
  const carton = new THREE.Group()
  carton.add(box(0.4, 0.28, 0.3, plain(C.card), 0, 0.14, 0))
  carton.add(placed(box(0.4, 0.004, 0.15, plain(C.card)), 0, 0.31, 0.2, -1.1, 0, 0)) // a flap open
  for (let i = 0; i < 4; i++) carton.add(placed(box(0.3, 0.004, 0.21, plain(C.papers[i])), (random() - 0.5) * 0.06, 0.26 + i * 0.012, (random() - 0.5) * 0.05, (random() - 0.5) * 0.4, random(), (random() - 0.5) * 0.3))
  carton.position.set(x1 - 0.32, 0.12, z0 + 0.3)
  carton.rotation.y = 0.2
  parts.add(carton)

  // --- On the glass from inside, to be read from out: when, and that there are none ---
  const notes = [[note('ВЫДАЧА', '8–20', 73), -0.6, 1.2, 0.04], [note('СПИЧЕК', 'НЕТ', 79), -0.75, 1.85, -0.07]]
  for (const [texture, x, y, turn] of notes) parts.add(placed(part(new THREE.PlaneGeometry(0.21, 0.14), texture), x, y, zGlass - 0.01, 0, 0, turn))

  // The bulb's flex inside, from the roof, a socket at its end.
  const [ix, iy, iz] = LAMPS.inside
  parts.add(cylinder(0.005, ROOF - iy - 0.06, plain(C.phone), ix, (ROOF + iy + 0.06) / 2, iz, 4))
  parts.add(cylinder(0.02, 0.05, plain(C.frame), ix, iy + 0.045, iz, 8))

  group.add(baked(parts))
  // The glass, one mesh: grimy, more seen through than seen.
  const panes = celMaterial({ color: 0x8a9a9c, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })
  group.add(new THREE.Mesh(mergeGeometries(glass.map((g) => g.index ? g.toNonIndexed() : g)), panes))
  return { group }
}

/** The booth, by its kind in a record (`room-props.js`'s `PROPS` takes it in). */
export const BOOTH = {
  ravenBooth: { build: booth, solid: [SIZE.w, SIZE.h, SIZE.d], traits: {} },
}
