// Set pieces at the west stops (grow-stops.mjs has the layer; grow.mjs the contract): Тамара's
// window, the raccoon's junkyard under the lift shaft, and the pipe man's mains. Each is built
// round the stop's own ground, which stays as the ways layer left it: the pad is the NPC's, and
// what is made here keeps its distance from it, from every leg's line and from the clear zones
// (`west-kit.mjs`' Placer). Everything stands by gravity: wall, shaft and pillars go down to the
// mist; heaps and parcels are sunk into what they lie on.
//
// Records made (planOwner builders-grow-stops, set by the contract's merge):
//   forms   walls, plates, beams, tubes; roles 'mass' (and 'support' for piers and trestles)
//   props   `cog` discs, seized, half buried in the scrap
//   lamps, lights, signs   the window's glow, the pipe room's lamp, the number on the wall
import { floorHit, MIST } from '../world.mjs'
import { footUnder, post } from '../pieces.mjs'
import { beam, box, disc, hollowBox, inPlate, Placer, plate, rod, tube } from './west-kit.mjs'

const FOOT = MIST - 4 // where whatever stands from the gorge starts: below the mist, so it is grounded
const stopOf = (ctx, id) => ctx.order.stops.find((s) => s.id === id)
const topAt = (ctx, s) => floorHit(ctx.site, s.x, s.y + 2, s.z)?.y ?? s.y
const merge = (add, placer) => { for (const [list, records] of Object.entries(placer.add)) (add[list] ??= []).push(...records) }

export function stopsWest(ctx, pads, blame) {
  if (process.env.WEST_OFF) return { add: {} } // dev: the layer without this half, to see what it costs the ways
  const add = {}
  const report = {}
  for (const [name, build] of [['tamara', tamara], ['raccoon', raccoon], ['pipeman', pipeman]]) {
    const stop = stopOf(ctx, name)
    if (!stop) continue
    const placer = build(ctx, stop)
    merge(add, placer)
    report[name] = { ...placer.count, refused: placer.refused, ...placer.stats }
  }
  if (process.env.WEST_REPORT) console.error('stops-west', JSON.stringify(report))
  return { add }
}

// --- Тамара: a sheer wall with one lit window, parcels stacked behind the glass. ---
// The wall stands behind the pad (the climb comes up from the other side) and leaves the frame
// top and bottom. The window is 34 m wide, its mullions a man's: the glass above a first row
// that stays open, which is where she talks through. A ledge joins the pad to the wall.
function tamara(ctx, stop) {
  const pl = new Placer(ctx, stop, { keep: 0 })
  const rng = ctx.rng
  const top = topAt(ctx, stop)
  const face = stop.z - 18 // the wall's front, facing the pad
  const back = face - 44
  const half = 90
  const x0 = stop.x - half
  const x1 = stop.x + half
  const sill = top + 2.5
  const lintel = sill + 30
  const roof = top + 380
  const wx = 17 // half the window's width
  const put = (...a) => pl.put('forms', ...a)

  // The wall, round the window.
  put(box(x0, stop.x - wx, FOOT, roof, back, face, 'concrete'))
  put(box(stop.x + wx, x1, FOOT, roof, back, face, 'concrete'))
  put(box(stop.x - wx, stop.x + wx, FOOT, sill, back, face, 'concrete'))
  put(box(stop.x - wx, stop.x + wx, lintel, roof, back, face, 'concrete'))
  put(box(stop.x - wx, stop.x + wx, sill, lintel, back, face - 28, 'dark')) // the room's far wall

  // The ledge she leans out over, and the surround that stands proud of the wall round the glass.
  put(box(stop.x - 36, stop.x + 36, top - 2.4, top, face - 1, stop.z - 7, 'concrete'))
  put(box(stop.x - wx - 4, stop.x + wx + 4, lintel, lintel + 5, face - 1, face + 2.2, 'pale'))
  put(box(stop.x - wx - 4, stop.x + wx + 4, sill - 3, sill, face - 1, face + 2.2, 'pale'))
  for (const s of [-1, 1]) put(box(s < 0 ? stop.x - wx - 4 : stop.x + wx, s < 0 ? stop.x - wx : stop.x + wx + 4, sill - 3, lintel + 5, face - 1, face + 2.2, 'pale'))

  // Pilasters and courses: the wall reads as storeys, so that its height is measurable.
  for (const dx of [-84, -62, -40, 40, 62, 84]) put(box(stop.x + dx - 3, stop.x + dx + 3, FOOT, roof, face - 1, face + 3, 'dark'))
  for (let k = -16; k <= 7; k++) {
    if (k === 0) continue
    const y = sill + 48 * k
    put(box(x0, x1, y, y + 2.6, face - 1, face + 1.2, 'rust'))
  }

  // The glass, in eight cells, with mullions and transoms of rusted steel over it.
  const cell = (2 * wx) / 8
  for (let i = 0; i < 8; i++) {
    const a = stop.x - wx + i * cell
    put(box(a + 0.3, a + cell - 0.3, sill + 9, lintel - 0.3, face - 0.9, face - 0.55, 'sky'))
  }
  for (let i = 0; i <= 8; i++) {
    const a = stop.x - wx + i * cell
    put(box(a - 0.3, a + 0.3, sill, lintel, face - 1.5, face + 0.3, 'rust'))
  }
  for (const up of [0, 9, 19.5, 29.5]) put(box(stop.x - wx, stop.x + wx, sill + up, sill + up + 0.6, face - 1.5, face + 0.3, 'rust'))

  // Parcels in stacks to the glass: each stack of two or three, taller toward the window.
  const looks = ['wood', 'plaster', 'terracotta', 'wood', 'earth']
  const cols = 7
  const rows = 5
  const cx = (2 * wx - 1) / cols
  const cz = 24 / rows
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (rng() < 0.12) continue
      const xa = stop.x - wx + 0.5 + i * cx
      const za = face - 2 - (j + 1) * cz // j = 0 is nearest the glass
      let y = sill
      const target = 6 + (rows - j) * 3.4 + rng() * 5 // metres of stack
      let n = 0
      while (y - sill < target && n < 5) {
        const h = 1.6 + rng() * 2.2
        const w = cx - 0.35 - rng() * 0.8
        const d = cz - 0.35 - rng() * 0.6
        put(box(xa + 0.2, xa + 0.2 + w, y - (n ? 0 : 0.3), y + h, za + 0.2, za + 0.2 + d, looks[Math.floor(rng() * looks.length)]))
        y += h
        n++
      }
    }
  }
  // A few on the ledge too, at its ends, off the NPC's ground.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const xa = stop.x + s * (27 + k * 3.5 + rng() * 1.5)
      put(box(xa, xa + 3, top - 0.3, top + 2.2 + rng() * 2, face + 1, face + 5, looks[(k + 1) % looks.length]))
    }
  }

  // The only light on the wall: strips under the lintel, and a real one inside.
  const lamps = (pl.add.lamps ??= [])
  for (const dz of [3, 12, 21]) lamps.push({ x0: stop.x - 15, x1: stop.x + 15, y0: lintel - 1, y1: lintel - 0.5, z0: face - dz - 1, z1: face - dz })
  const lights = (pl.add.lights ??= [])
  lights.push({ kind: 'point', x: stop.x, y: lintel - 4, z: face - 9, color: '#ffc27a', power: 140, reach: 110, head: { w: 0.4, h: 0.25, d: 0.4 } })
  ;(pl.add.signs ??= []).push({ x: stop.x - 51, y: sill + 12, z: face + 3.3, w: 30, h: 22, yaw: 0, text: '19', under: 'ЯРУС' })
  return pl
}

// --- Енот: a junkyard at the foot of a lift shaft. ---
// A yard on stilts behind the pad; a hollow shaft 60 m square rising out of sight at its back,
// its dead cage on the floor and its ropes hanging up into the fog; scrap heaped in the middle:
// plates leaning together, girders from the floor to their tops, lift cabins on their sides,
// seized cogs half buried.
function raccoon(ctx, stop) {
  const pl = new Placer(ctx, stop)
  const rng = ctx.rng
  const put = (...a) => pl.put('forms', ...a)
  const top = topAt(ctx, stop) - 0.6
  const x0 = stop.x - 160
  const x1 = stop.x + 8
  const z0 = stop.z + 9
  const z1 = stop.z + 175
  const thick = 9
  const floor = top - thick

  put(box(x0, x1, floor, top, z0, z1, 'dim'), { keep: 0 })
  for (const px of [x0 + 22, (x0 + x1) / 2, x1 - 22]) {
    for (const pz of [z0 + 26, z1 - 26]) {
      const foot = footUnder(ctx.site, px, floor, pz).y
      put({ ...post(px, pz, foot, floor + 1, 10, 'round', 'dim', 0, 1.5), role: 'support' }, { keep: 0 })
    }
  }

  // The shaft: a square tube with a gate in its front, 60 m outside and 440 m up.
  const C = { x: stop.x - 70, z: stop.z + 140 }
  const H = 30
  const wall = 6
  const roof = stop.y + 440
  const base = top - 1
  put(box(C.x - H, C.x - H + wall, base, roof, C.z - H, C.z + H, 'concrete'))
  put(box(C.x + H - wall, C.x + H, base, roof, C.z - H, C.z + H, 'concrete'))
  put(box(C.x - H, C.x + H, base, roof, C.z + H - wall, C.z + H, 'concrete'))
  put(box(C.x - H, C.x - 13, base, roof, C.z - H, C.z - H + wall, 'concrete'))
  put(box(C.x + 13, C.x + H, base, roof, C.z - H, C.z - H + wall, 'concrete'))
  put(box(C.x - H, C.x + H, top + 44, roof, C.z - H, C.z - H + wall, 'concrete'))
  for (let y = top + 80; y < roof; y += 36) put(box(C.x - H, C.x + H, y, y + 2.4, C.z - H - 2.2, C.z - H + 3, 'rust'))
  for (const dx of [-16, 16]) put(box(C.x + dx - 0.8, C.x + dx + 0.8, base, roof, C.z + H - wall - 1.8, C.z + H - wall + 0.5, 'steel')) // guide rails

  // The dead cage on the shaft's floor, and its ropes going up out of sight.
  const cz = C.z - 2
  put(box(C.x - 11, C.x + 11, top - 0.4, top + 0.9, cz - 9, cz + 9, 'steel'))
  put(box(C.x - 11, C.x + 11, top + 19, top + 20.2, cz - 9, cz + 9, 'steel'))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(box(C.x + sx * 10.3 - 0.7, C.x + sx * 10.3 + 0.7, top + 0.5, top + 19.5, cz + sz * 8.3 - 0.7, cz + sz * 8.3 + 0.7, 'rust'))
  put(box(C.x - 11, C.x + 11, top + 0.5, top + 11, cz + 8.4, cz + 9, 'rust'))
  for (const up of [6, 12, 17]) for (const sx of [-1, 1]) put(box(C.x + sx * 10.8 - 0.3, C.x + sx * 10.8 + 0.3, top + up, top + up + 0.8, cz - 9, cz + 9, 'rust'))
  for (const dx of [-7, -2.5, 2.5, 7]) put(rod({ x: C.x + dx, y: top + 19.4, z: cz }, { x: C.x + dx + rng() * 1.2, y: top + 330, z: cz + rng() * 1.5 }, 0.7, 'dark'))

  // The heaps, in piles that keep a lane to the gate and the NPC's ground clear.
  const piles = []
  for (let tries = 0; tries < 400 && piles.length < 13; tries++) {
    const p = { x: x0 + 20 + rng() * (x1 - x0 - 40), z: stop.z + 42 + rng() * (z1 - stop.z - 62) }
    if (Math.abs(p.x - C.x) < 30 && p.z > C.z - 100) continue // the gate's lane
    if (p.z > C.z - 26 && Math.abs(p.x - C.x) < H + 16) continue // the shaft's own foot
    if (piles.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 30)) continue
    piles.push(p)
  }
  const looks = ['rust', 'dark', 'steel', 'concrete', 'rust', 'terracotta']
  const pick = (list) => list[Math.floor(rng() * list.length)]
  let plates = 0
  let girders = 0
  for (const p of piles) {
    const n = 4 + Math.floor(rng() * 3)
    const spin = rng() * Math.PI * 2
    const stood = []
    for (let i = 0; i < n; i++) {
      const th = spin + (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.5
      const h = 14 + rng() * 22
      const tilt = Math.tan((12 + rng() * 20) * (Math.PI / 180))
      const reach = h * tilt
      const rho = reach * (0.8 + rng() * 0.3)
      const rec = { x: p.x + Math.cos(th) * rho, z: p.z + Math.sin(th) * rho, y0: top - 0.8, h, w: 9 + rng() * 15, t: 1.4 + rng() * 1.1, yaw: th + Math.PI / 2 + (rng() - 0.5) * 0.4, lean: [-Math.cos(th) * reach, -Math.sin(th) * reach] }
      if (put(plate({ ...rec, look: pick(looks) }))) {
        stood.push(rec)
        plates++
      }
    }
    // Girders from the floor to the top of a plate, resting on it.
    for (let k = 0; k < 2 && stood.length; k++) {
      const rec = stood[Math.floor(rng() * stood.length)]
      const end = inPlate(rec, rec.h * (0.55 + rng() * 0.25))
      const th = rng() * Math.PI * 2
      const run = 14 + rng() * 14
      if (put(beam({ x: end.x + Math.cos(th) * run, y: top - 0.6, z: end.z + Math.sin(th) * run }, end, 1.3 + rng() * 0.8, 1.3 + rng() * 0.8, pick(['steel', 'rust', 'dark'])))) girders++
    }
  }

  // Lift cabins on their sides, open at both ends, and cogs half buried.
  let cabins = 0
  for (let tries = 0; tries < 60 && cabins < 5; tries++) {
    const q = { x: x0 + 24 + rng() * (x1 - x0 - 48), z: stop.z + 40 + rng() * (z1 - stop.z - 60) }
    if (Math.abs(q.x - C.x) < 30 && q.z > C.z - 100) continue
    if (q.z > C.z - 26 && Math.abs(q.x - C.x) < H + 16) continue
    const yaw = rng() * Math.PI
    const len = 15
    const hgt = 12 + rng() * 2
    const a = { x: q.x - Math.sin(yaw) * len / 2, y: top + hgt / 2 - 0.5, z: q.z - Math.cos(yaw) * len / 2 }
    const b = { x: q.x + Math.sin(yaw) * len / 2, y: a.y, z: q.z + Math.cos(yaw) * len / 2 }
    if (put(hollowBox(a, b, 10.5, hgt, 0.8, cabins === 2 ? 'brass' : pick(['rust', 'dark', 'steel'])))) cabins++
  }
  const cogs = (pl.add.props ??= [])
  for (let tries = 0; tries < 80 && cogs.length < 9; tries++) {
    const s = 2.2 + rng() * 1.4
    const teeth = Math.round(140 + rng() * 120)
    const R = (teeth * 0.06 * s) / 2
    const q = { x: x0 + 22 + rng() * (x1 - x0 - 44), z: stop.z + 38 + rng() * (z1 - stop.z - 58) }
    if (Math.hypot(q.x - stop.x, q.z - stop.z) < R + 30) continue
    if (Math.abs(q.x - C.x) < 30 + R && q.z > C.z - 100) continue
    if (pl.samples.some(([x, y, z]) => Math.hypot(x - q.x, z - q.z) < R + 6 && Math.abs(y - top) < R + 6)) continue
    cogs.push({ id: `west-cog-${cogs.length}`, kind: 'cog', x: Math.round(q.x * 100) / 100, y: Math.round((top + R * 0.5) * 100) / 100, z: Math.round(q.z * 100) / 100, yaw: Math.round(rng() * 6.28 * 1e4) / 1e4, scale: Math.round(s * 100) / 100, teeth, turn: Math.round(rng() * 6.28 * 1e4) / 1e4, thick: 1.6, axle: [0, 0], look: pick(['rust', 'brass', 'rust']), animation: { mode: 'manual', rpm: 0 } })
  }

  // Amber at the gate, so that the shaft's mouth is found from afar.
  const lamps = (pl.add.lamps ??= [])
  for (const dx of [-12, -4, 4, 12]) lamps.push({ x0: C.x + dx - 0.6, x1: C.x + dx + 0.6, y0: top + 43, y1: top + 43.5, z0: C.z - H - 1.2, z1: C.z - H + 0.2 })
  lamps.push({ x0: C.x + 15, x1: C.x + 17, y0: top + 60, y1: top + 60.6, z0: C.z + H - wall - 2.6, z1: C.z + H - wall - 1.8 })
  ;(pl.add.lights ??= []).push({ kind: 'point', x: C.x, y: top + 38, z: C.z - H - 4, color: '#ffc27a', power: 160, reach: 120, head: { w: 0.4, h: 0.25, d: 0.4 } })
  pl.stats = { piles: piles.length, plates, girders, cabins }
  return pl
}

// --- Человек в трубе: heating mains as big as tunnels. ---
// The pad sits in a pocket of walls that the structure layer left; the one way out that is open
// at the pad's level runs south, so his main does: 28 m across, open at the north end that
// faces the pad, a floor laid in it at the pad's level and a room built inside, lit, with a
// door and a window. Beside it a second and a third that end in capped flanges with hatches,
// and a fourth that crosses over all of them. Collared every 36 m, saddled on pillars to the gorge.
function pipeman(ctx, stop) {
  const pl = new Placer(ctx, stop)
  const put = (...a) => pl.put('forms', ...a)
  const padTop = topAt(ctx, stop)
  const mx = stop.x + 4 // its axis: the floor stays clear of the climb's foot, west of the pad
  const mouth = stop.z + 28
  const THICK = 2

  // A main along +Z from (x, c, from), as far as it runs free (`most` at the most), collared and saddled.
  function main({ x, c, r, wall, from = mouth, most = 340, look = 'steel', cap = false }) {
    const len = Math.floor(pl.runFree({ x, y: c, z: from }, { x, y: c, z: from + most }, r + 1.5, 4, 0))
    if (len < 40) return { len: 0 }
    put(tube({ x, y: c, z: from }, { x, y: c, z: from + len }, r, wall, look))
    for (let d = 18; d < len - 4; d += 36) put(tube({ x, y: c, z: from + d }, { x, y: c, z: from + d + 3 }, r + 1.4, wall + 1.4, d % 72 < 36 ? 'brass' : 'rust'))
    for (let d = 10; d < len; d += 48) {
      for (const s of [-1, 1]) {
        const dx = s * r * 0.55
        const topY = c - Math.sqrt(r * r - dx * dx) + 1
        const foot = FOOT // to the gorge: a floor met on the way may itself be a floater's
        put({ ...post(x + dx, from + d, foot, topY, Math.max(3.4, r * 0.4), 'round', 'dim', 0, 1.35), role: 'support' })
      }
    }
    if (cap) {
      const end = from + len
      put(rod({ x, y: c, z: end }, { x, y: c, z: end + 1.6 }, r + 1.6, 'rust', 24)) // the sealed end
      put(rod({ x, y: c - r * 0.25, z: end + 1.6 }, { x, y: c - r * 0.25, z: end + 2.4 }, 1.7, 'brass', 16)) // a hatch a man's size
      put(rod({ x, y: c - r * 0.25, z: end + 2.4 }, { x, y: c - r * 0.25, z: end + 3 }, 0.8, 'dark', 8)) // its wheel
    }
    return { len }
  }

  // His: the floor at the pad's level runs the whole way in, and a bridge from the pad to it.
  const c1 = padTop + 6
  const r1 = 14
  const his = main({ x: mx, c: c1, r: r1, wall: THICK, look: 'steel', most: 300 })
  const L = his.len
  put(tube({ x: mx, y: c1, z: mouth }, { x: mx, y: c1, z: mouth + 3.5 }, r1 + 2.2, THICK + 2.2, 'brass')) // its rim
  put(box(mx - 10.4, mx + 10.4, padTop - 3, padTop, mouth - 0.5, mouth + Math.max(L, 20), 'dim'), { keep: 0 })
  put(box(mx - 10.4, mx + 10.4, padTop - 1.6, padTop, stop.z + 9.6, mouth, 'concrete'), { keep: 0 })

  // The room in the pipe, 16 m deep, a door and a window to the mouth.
  const m = mouth + 4
  const w = 6.2
  const hgt = 4.6
  const t = 0.4
  const wallLook = 'plaster'
  const keepOff = { keep: 0 }
  put(box(mx - w, mx + w, padTop, padTop + hgt, m + 16, m + 16 + t, wallLook), keepOff)
  for (const s of [-1, 1]) put(box(s < 0 ? mx - w - t : mx + w, s < 0 ? mx - w : mx + w + t, padTop, padTop + hgt, m, m + 16, wallLook), keepOff)
  put(box(mx - w - t, mx + w + t, padTop + hgt, padTop + hgt + t, m - t, m + 16 + t, 'dark'), keepOff)
  put(box(mx - w, mx - 1.4, padTop, padTop + hgt, m - t, m, wallLook), keepOff)
  put(box(mx - 1.4, mx + 1.4, padTop + 3.4, padTop + hgt, m - t, m, wallLook), keepOff)
  put(box(mx + 1.4, mx + w, padTop, padTop + 1, m - t, m, wallLook), keepOff)
  put(box(mx + 1.4, mx + w, padTop + 2.8, padTop + hgt, m - t, m, wallLook), keepOff)
  // What is in it: a bunk, a table, a stove, crates.
  put(box(mx - 5.6, mx - 2, padTop, padTop + 1.1, m + 10, m + 15.5, 'wood'), keepOff)
  put(box(mx + 0.6, mx + 3.2, padTop, padTop + 0.9, m + 6.5, m + 9, 'wood'), keepOff)
  put({ ...post(mx + 3.8, m + 14.5, padTop, padTop + 1.8, 1.8, 'round', 'rust'), role: 'mass' }, keepOff)
  put(box(mx + 3.5, mx + 5.5, padTop, padTop + 1.2, m + 3, m + 5, 'wood'), keepOff)
  const lamps = (pl.add.lamps ??= [])
  lamps.push({ x0: mx - 0.4, x1: mx + 0.4, y0: padTop + 3.5, y1: padTop + 3.9, z0: m - 1.6, z1: m - 0.8 })
  lamps.push({ x0: mx - 0.4, x1: mx + 0.4, y0: padTop + hgt - 0.5, y1: padTop + hgt - 0.1, z0: m + 7, z1: m + 9 })
  ;(pl.add.lights ??= []).push({ kind: 'point', x: mx, y: padTop + hgt - 1, z: m + 8, color: '#ffc27a', power: 90, reach: 46, head: { w: 0.4, h: 0.25, d: 0.4 } })

  // The others: a second and a third either side of his, capped, and a fourth across them.
  const second = main({ x: mx - 40, c: padTop + 12, r: 10, wall: 1.8, from: mouth + 8, look: 'steel', cap: true, most: 300 })
  let third = { len: 0 }
  for (const [dx, up] of [[38, 28], [30, 44], [-80, 20], [80, 20], [-80, 50], [80, 50], [-120, 30]]) {
    third = main({ x: mx + dx, c: padTop + up, r: 7.5, wall: 1.4, from: mouth + 20, look: 'rust', cap: true, most: 260 })
    if (third.len) break
  }
  // The cross main takes the longest free line over the others that it finds.
  let best = { free: 0 }
  for (const dz of [40, 55, 70, 85, 100, 130, 160]) {
    for (const up of [44, 62, 80, 110]) {
      const a = { x: mx - 150, y: padTop + up, z: mouth + dz }
      const run = Math.floor(pl.runFree(a, { ...a, x: mx + 150 }, 11, 4, 0))
      if (run > best.free) best = { free: run, cz: a.z, c4: a.y }
    }
  }
  const { cz, c4 } = best
  const r4 = 9
  const lo = mx - 150
  const free = best.free
  if (free > 100) {
    put(tube({ x: lo, y: c4, z: cz }, { x: lo + free, y: c4, z: cz }, r4, 1.6, 'steel'))
    for (let d = 14; d < free - 4; d += 40) put(tube({ x: lo + d, y: c4, z: cz }, { x: lo + d + 3, y: c4, z: cz }, r4 + 1.4, 3, d % 80 < 40 ? 'brass' : 'rust'))
    for (let d = 20; d < free; d += 60) {
      for (const s of [-1, 1]) {
        const dz = s * r4 * 0.55
        const topY = c4 - Math.sqrt(r4 * r4 - dz * dz) + 1
        put({ ...post(lo + d, cz + dz, FOOT, topY, 4, 'round', 'dim', 0, 1.35), role: 'support' })
      }
    }
  }
  pl.stats = { his: L, second: second.len, third: third.len, cross: free }
  return pl
}
