// The steam layer of the generator (scripts/builders/grow.mjs has the contract): the old-tech
// layer. Gear trains turning (or seized) in wall slabs beside the climbs and wall runs, their
// axles out across the void; street-size mains beside the runs and up the shafts the glides and
// drops fall through, leaking at their collars; steam grates in the floors under those shafts
// and on some run pads. Nothing here is on a leg's line: every piece is tested against samples
// of every leg of every way, so the layer cannot unmake one. The Tabachnaya stays cold and still.
//
// Records made (planOwner builders-grow-steam, set by the contract's merge):
//   props    `cog` (machine-props.js bigCog): one gear of a train, `{ teeth, turn, thick, axle, scale,
//            animation: { rpm } }`, rpm 0 for a seized one; turns only within view (parkour-world.js)
//   boxes    the wall slab each train is set into (a solid), trestles under mains
//   forms    mains (sweeps, lathes) and their collars
//   dressing grate frames and bars, only seen
//   vents    `{ x, y, z, size, reach }`: steam, the nearest few blown (parkour-world.js `ventsNear`)
import { floorHit, MIST, round, solidRecords, standSite } from '../world.mjs'
import { scanSupport } from '../support.mjs'
import { growCables, harvest } from './steam-cables.mjs'
import { growWalls } from './steam-walls.mjs'
import { nextFormId } from '../../../src/place-file.js'
import { ring } from '../../../src/forms.js'

const TAU = Math.PI * 2
const MODULE = 0.06 // machine-props.js: a tooth's metres at scale 1
const COLD = { name: 'Табачная', r: 200 } // metres round it where nothing moves and no steam rises
const LEG_GAP = 5 // metres any solid keeps off the guard's axis (grow.mjs `routeAir`: a tube of 2 m round a line 2.5 m up): 3 m beyond its shape
const r2 = (v) => round(v, 100)
const P = (x, y, z) => ({ x: r2(x), y: r2(y), z: r2(z) })

export function growSteam(ctx, pads, blame) {
  const { order, rng } = ctx
  const pick = (list) => list[Math.floor(rng() * list.length)]
  const between = (a, b) => a + (b - a) * rng()
  const shuffled = (list) => list.map((v) => [rng(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v)

  const cold = order.stops.find((s) => s.name.startsWith(COLD.name))
  const isCold = (x, y, z, pad = 0) => !!cold && Math.hypot(x - cold.x, y - cold.y, z - cold.z) < COLD.r + pad

  // Every leg of every way, sampled each 3 m: the line nothing may touch.
  const samples = []
  const legs = []
  for (const way of order.ways) {
    for (const leg of way.legs) {
      legs.push({ ...leg, way: way.id })
      const n = Math.max(1, Math.ceil(leg.length / 3))
      const lift = leg.move === 'climb' ? 0 : 2.5 // the guard's line is lifted; a climb has none
      for (let i = 0; i <= n; i++) {
        const t = i / n
        samples.push([leg.a.x + (leg.b.x - leg.a.x) * t, leg.a.y + (leg.b.y - leg.a.y) * t + lift, leg.a.z + (leg.b.z - leg.a.z) * t])
      }
    }
  }
  // And every pad's head room, as the contract's merge keeps it (grow.mjs `routeAir`): a main refused there would leave its collars floating.
  for (const pad of pads) {
    const f = { x: Math.sin(pad.yaw), z: Math.cos(pad.yaw) }
    for (let u = -(pad.w ?? 10) / 2; u <= (pad.w ?? 10) / 2 + 0.01; u += 3) {
      for (let v = -(pad.l ?? 10) / 2; v <= (pad.l ?? 10) / 2 + 0.01; v += 3) {
        for (const up of [2.4]) samples.push([pad.x + f.z * u + f.x * v, pad.y + up, pad.z - f.x * u + f.z * v])
      }
    }
  }
  // Whether every sample is at least `gap` from the shape, whose distance to a point `dist` gives.
  const keepsOff = (dist, gap = LEG_GAP) => samples.every((p) => dist(p) >= gap)

  const clock = (name) => { if (process.env.STEAM_DEBUG) console.log('t', name, ((performance.now() - t0) / 1000).toFixed(1)) }
  const t0 = performance.now()
  const out = { props: [], boxes: [], forms: [], dressing: [], vents: [], cables: [] }
  let formId = nextFormId(ctx.place)
  let boxId = Math.max(-1, ...ctx.place.boxes.map((b) => (Number.isInteger(b.bid) ? b.bid : -1))) + 1
  const form = (f) => out.forms[out.forms.push({ ...f, id: formId++ }) - 1]
  const slabBox = (b) => out.boxes[out.boxes.push({ ...b, bid: boxId++ }) - 1]
  // A vent leaks from the record `owner`; if gravity takes that record away, its vent goes too.
  const owners = new Map()
  const parentOf = new Map() // a collar → the main or column it rings
  const vent = (x, y, z, size, reach, owner = null) => owners.set(out.vents[out.vents.push({ x: r2(x), y: r2(y), z: r2(z), size, reach }) - 1], owner)

  // --- Gear trains, in wall slabs beside the climbs and wall runs. ---
  const placed = [] // centres of the trains stood, so that they are spread out
  const stats = { turning: 0, seized: 0, trains: 0, mains: 0, verticals: 0, bigGrates: 0, smallGrates: 0, vents: 0 }
  const AXES = [[1, 0], [-1, 0], [0, 1], [0, -1]] // the way a wall faces: from the wall out into the void (x, z)

  // A train laid out in its own plane (x across, y up, the first gear at the origin): each gear
  // `{ teeth, x, y, rest, rpm, R }`, a tooth of one falling in the gap of the next it meshes.
  function laidTrain(m, { min = 24, max = 120, seized: forced = null } = {}) {
    const count = 2 + Math.floor(rng() * 3)
    const teethFor = (lo, hi) => Math.max(12, Math.round(between(lo, hi) / m))
    const seized = forced ?? rng() < 0.35
    const rpm = (rng() < 0.5 ? -1 : 1) * between(0.6, 2.2)
    const first = { teeth: teethFor(min, min + (max - min) * rng() ** 2), x: 0, y: 0, rest: rng() * TAU, rpm: seized ? 0 : rpm }
    const gears = [first]
    for (let tries = 0; gears.length < count && tries < 40; tries++) {
      const by = gears[gears.length - 1]
      const teeth = teethFor(20, 20 + 70 * rng() ** 2)
      const toward = between(-Math.PI, Math.PI)
      const apart = ((by.teeth + teeth) * m) / 2
      const x = by.x + Math.cos(toward) * apart
      const y = by.y + Math.sin(toward) * apart
      const tip = (g) => (g.teeth / 2 + 1) * m
      // Clear of every other gear of the train (not only the one it meshes with).
      if (gears.some((g) => g !== by && Math.hypot(g.x - x, g.y - y) < tip(g) + (teeth / 2 + 1) * m + m)) continue
      const offset = ((((toward - by.rest) * by.teeth) / TAU) % 1 + 1) % 1
      gears.push({ teeth, x, y, rest: toward + Math.PI - (TAU / teeth) * (0.5 - offset), rpm: seized ? 0 : (-by.rpm * by.teeth) / teeth, by })
    }
    for (const g of gears) g.R = (g.teeth / 2 + 1) * m
    return { gears, seized }
  }

  const why = {}
  const no = (k) => { why[k] = (why[k] ?? 0) + 1; return false }
  function standTrain(leg) {
    const m = between(1.5, 3.2) // a tooth's metres
    const s = m / MODULE
    const thick = m * 2.2
    const { gears, seized } = laidTrain(m)
    const x0 = Math.min(...gears.map((g) => g.x - g.R))
    const x1 = Math.max(...gears.map((g) => g.x + g.R))
    const y0 = Math.min(...gears.map((g) => g.y - g.R))
    const y1 = Math.max(...gears.map((g) => g.y + g.R))
    const mid = { x: (leg.a.x + leg.b.x) / 2, y: (leg.a.y + leg.b.y) / 2, z: (leg.a.z + leg.b.z) / 2 }
    if (isCold(mid.x, mid.y, mid.z, (x1 - x0) / 2)) return no('cold')
    if (placed.some((p) => Math.hypot(p.x - mid.x, p.y - mid.y, p.z - mid.z) < 110)) return no('crowded')
    const heading = Math.atan2(leg.b.x - leg.a.x, leg.b.z - leg.a.z)
    // The walls that face across the leg first.
    const faces = shuffled(AXES).sort((p, q) => Math.abs(p[0] * Math.sin(heading) + p[1] * Math.cos(heading)) - Math.abs(q[0] * Math.sin(heading) + q[1] * Math.cos(heading)))
    for (const [ax, az] of faces) {
      const gap = 27 + 0.3 * thick + between(0, 8) // the runner's line to the wall's face
      const yaw = Math.atan2(ax, az)
      const ux = [Math.cos(yaw), -Math.sin(yaw)] // the train's own x on the plan
      const shift = between(-0.2, 0.2) * (x1 - x0)
      const cx = (x0 + x1) / 2 + shift
      const cy = (y0 + y1) / 2
      // The face of the wall, `gap` back from the leg's middle; the wheels' middles 0.2 thick into it.
      const face = { x: mid.x - ax * gap, z: mid.z - az * gap }
      const at = (g, depth = 0) => ({
        x: face.x - ax * (0.2 * thick) + ax * depth + ux[0] * (g.x - cx),
        y: mid.y + (g.y - cy),
        z: face.z - az * (0.2 * thick) + az * depth + ux[1] * (g.x - cx),
      })
      const axles = gears.map(() => [6 + between(0, 10), between(10, 45)])
      // The wheels, with their swept discs, and the shafts out of them, off every leg's line.
      const discs = gears.map((g, i) => ({ g, c: at(g), A: [ax, 0, az], front: axles[i][1] }))
      const clearDisc = ({ g, c }) => keepsOff(([px, py, pz]) => {
        const d = [px - c.x, py - c.y, pz - c.z]
        const axial = d[0] * ax + d[2] * az
        const radial = Math.sqrt(Math.max(0, d[0] * d[0] + d[1] * d[1] + d[2] * d[2] - axial * axial))
        return Math.hypot(Math.max(0, Math.abs(axial) - thick / 2), Math.max(0, radial - g.R))
      })
      if (!discs.every(clearDisc)) { no('disc'); continue }
      // A shaft is cut short where it would meet a leg (down to 6 m, or the train is not stood).
      let shafts = true
      for (const d of discs) {
        for (; d.front >= 6; d.front -= 4) {
          const end = { x: d.c.x + ax * (thick / 2 + d.front), z: d.c.z + az * (thick / 2 + d.front) }
          const ok = keepsOff(([px, py, pz]) => {
            const t = Math.min(1, Math.max(0, ((px - d.c.x) * ax + (pz - d.c.z) * az) / (thick / 2 + d.front)))
            return Math.hypot(px - (d.c.x + (end.x - d.c.x) * t), py - d.c.y, pz - (d.c.z + (end.z - d.c.z) * t)) - (d.g.teeth * m * 0.035)
          })
          if (ok) break
        }
        if (d.front < 6) shafts = false
      }
      if (!shafts) { no('shaft'); continue }
      // The wall slab the train is set into: 16 m deep behind the face, to the floor under it if one is near.
      const corners = [x0 - 3, x1 + 3].map((u) => ({ x: face.x + ux[0] * (u - cx), z: face.z + ux[1] * (u - cx) }))
      const back = { x: face.x - ax * 16, z: face.z - az * 16 }
      const xs = [corners[0].x, corners[1].x, back.x]
      const zs = [corners[0].z, corners[1].z, back.z]
      const bx = [Math.min(...xs), Math.max(...xs)]
      const bz = [Math.min(...zs), Math.max(...zs)]
      const top = mid.y + (y1 - cy) + 3
      const bottom = mid.y + (y0 - cy) - 3
      const ground = floorHit(ctx.site, (bx[0] + bx[1]) / 2, bottom - 0.5, (bz[0] + bz[1]) / 2)
      const foot = ground && bottom - ground.y <= 350 && ground.y > MIST ? ground.y : MIST // no floor near: it goes down into the mist
      const slab = { x0: r2(bx[0]), x1: r2(bx[1]), y0: r2(foot), y1: r2(top), z0: r2(bz[0]), z1: r2(bz[1]), look: pick(['dark', 'plate', 'concrete']) }
      const nearBox = ([px, py, pz]) => Math.hypot(Math.max(slab.x0 - px, 0, px - slab.x1), Math.max(slab.y0 - py, 0, py - slab.y1), Math.max(slab.z0 - pz, 0, pz - slab.z1))
      if (slab.y1 - slab.y0 > 400 || !keepsOff(nearBox, 24) || !ctx.clearOf('boxes', slab)) { no('slab'); continue }
      // The wheels' swept discs themselves, as boxes, against the story's clear zones.
      if (!discs.every(({ g, c }) => ctx.clearOf('boxes', { x0: c.x - (ax ? thick / 2 : g.R), x1: c.x + (ax ? thick / 2 : g.R), y0: c.y - g.R, y1: c.y + g.R, z0: c.z - (az ? thick / 2 : g.R), z1: c.z + (az ? thick / 2 : g.R) }))) { no('swept'); continue }

      const standing = slabBox({ ...slab, train: stats.trains })
      discs.forEach(({ g, c, front }, i) => {
        out.props.push({
          id: `steam-cog-${stats.trains}-${i}`,
          kind: 'cog',
          x: r2(c.x), y: r2(c.y), z: r2(c.z),
          yaw: round(yaw, 1e4),
          scale: r2(s),
          teeth: g.teeth,
          turn: round(g.rest, 1e4),
          thick: r2(thick),
          axle: [r2(axles[i][0]), r2(thick / 2 + front)],
          look: i % 2 ? 'rust' : 'brass',
          animation: { mode: 'manual', rpm: round(g.rpm, 1e3) },
        })
        if (g.rpm) stats.turning++
        else stats.seized++
      })
      placed.push(mid)
      stats.trains++
      // A little steam where the train meets the floor of its slab's face: a gland that leaks.
      if (!seized && rng() < 0.5) vent(face.x + ax * 2, mid.y + (y0 - cy) + 1, face.z + az * 2, 3, 200, standing)
      return true
    }
    return false
  }

  const wanted = legs.filter((l) => l.move === 'climb' || l.move === 'wallrun' || l.move === 'drop' || l.move === 'glide')
  const climbs = shuffled(wanted.filter((l) => l.move === 'climb' || l.move === 'wallrun'))
  for (const leg of climbs) {
    if (stats.trains >= 26) break
    for (let attempt = 0; attempt < 8 && !standTrain(leg); attempt++); // another train, another wall, until one fits
  }

  // --- Trains on the megawalls, to be seen from every stop; and mains along their faces. ---
  const anchors = harvest(ctx, rng)
  let wallTrains = 0
  const walled = growWalls({
    ctx, planes: anchors.planes, samples, isCold, stops: order.stops, laid: laidTrain,
    kit: {
      trainId: () => wallTrains++,
      prop: (record, turning) => { out.props.push(record); stats[turning ? 'turning' : 'seized']++ },
      vent, form, collarAt, box: slabBox,
    },
  })
  stats.walls = { trains: walled.trains, mains: walled.mains }
  for (const line of walled.visible) console.log('STEAM-VISIBLE ' + JSON.stringify(line))

  // --- Mains: a street-size pipe beside a run, collared, leaking at the collars. ---
  function collarAt(base, dir, r, along, dry, owner) {
    // A collar: a short fat sweep round the pipe, brass; every other one leaks.
    const c = { x: base.x + dir.x * along, y: base.y, z: base.z + dir.z * along }
    parentOf.set(form({ kind: 'sweep', at: P(c.x - dir.x * 1.2, c.y, c.z - dir.z * 1.2), look: 'b1Ochre', smooth: true, section: ring(r + 0.9, 1.4, 14), path: [P(0, 0, 0), P(dir.x * 2.4, 0, dir.z * 2.4)], role: 'service' }), owner)
    if (!dry) vent(c.x, c.y + r * 0.9, c.z, between(3, 5), 180, owner)
  }

  const runs = shuffled(legs.filter((l) => l.move === 'run' && l.length >= 20))
  for (const leg of runs) {
    if (stats.mains >= 16) break
    const len = leg.length
    const dir = { x: (leg.b.x - leg.a.x) / len, z: (leg.b.z - leg.a.z) / len }
    const mid = { x: (leg.a.x + leg.b.x) / 2, y: (leg.a.y + leg.b.y) / 2, z: (leg.a.z + leg.b.z) / 2 }
    if (isCold(mid.x, mid.y, mid.z, len)) continue
    if (placed.some((p) => Math.hypot(p.x - mid.x, p.z - mid.z) < 30)) continue
    const r = between(3, 7)
    const side = rng() < 0.5 ? 1 : -1
    const off = r + 10 + between(0, 8)
    const lat = { x: -dir.z * side, z: dir.x * side }
    const a = { x: leg.a.x + lat.x * off - dir.x * 25, z: leg.a.z + lat.z * off - dir.z * 25 }
    const b = { x: leg.b.x + lat.x * off + dir.x * 25, z: leg.b.z + lat.z * off + dir.z * 25 }
    const y = (ay) => ay + r * 0.3 // its middle a little over the run's floor: its round top is a rail beside the way
    const ya = y(leg.a.y)
    const yb = y(leg.b.y)
    const keep = ([px, py, pz]) => {
      // Distance to the pipe's axis segment, less its radius.
      const vx = b.x - a.x
      const vy = yb - ya
      const vz = b.z - a.z
      const t = Math.min(1, Math.max(0, ((px - a.x) * vx + (py - ya) * vy + (pz - a.z) * vz) / (vx * vx + vy * vy + vz * vz)))
      return Math.hypot(px - (a.x + vx * t), py - (ya + vy * t), pz - (a.z + vz * t)) - r
    }
    if (!keepsOff(keep)) continue
    const mainForm = { kind: 'sweep', at: P(a.x, ya, a.z), look: pick(['rust', 'rust', 'cast']), smooth: true, section: ring(r, r * 0.2, 14), path: [P(0, 0, 0), P(b.x - a.x, yb - ya, b.z - a.z)], role: 'service' }
    if (!ctx.clearOf('forms', mainForm)) continue
    const stoodMain = form(mainForm)
    // Collars every ~28 m, and trestles to the floor under them if one is near.
    const total = Math.hypot(b.x - a.x, b.z - a.z)
    const collars = Math.max(2, Math.min(14, Math.floor(total / 12)))
    for (let i = 0; i <= collars; i++) {
      const t = i / collars
      const at = { x: a.x + (b.x - a.x) * t, y: ya + (yb - ya) * t, z: a.z + (b.z - a.z) * t }
      const flat = { x: (b.x - a.x) / total, z: (b.z - a.z) / total }
      collarAt(at, flat, r, 0, i % 2 === 1, stoodMain)
      const ground = floorHit(ctx.site, at.x, at.y - r - 1, at.z)
      if (ground && at.y - r - ground.y <= 80 && ground.y > MIST && i % 2 === 0) {
        const hw = 1.2
        const trestle = { x0: r2(at.x - hw), x1: r2(at.x + hw), y0: r2(ground.y), y1: r2(at.y - r * 0.8), z0: r2(at.z - hw), z1: r2(at.z + hw), look: 'dark' }
        if (keepsOff(([px, py, pz]) => Math.hypot(Math.max(trestle.x0 - px, 0, px - trestle.x1), Math.max(trestle.y0 - py, 0, py - trestle.y1), Math.max(trestle.z0 - pz, 0, pz - trestle.z1)), 3)) slabBox(trestle)
      }
    }
    placed.push({ x: mid.x, y: mid.y, z: mid.z })
    stats.mains++
  }

  // --- Shafts: a vertical main beside each glide and drop, and a great grate at the floor under it. ---
  const falls = shuffled(legs.filter((l) => (l.move === 'glide' || l.move === 'drop') && Math.abs(l.a.y - l.b.y) >= 8))
  for (const leg of falls) {
    const mid = { x: (leg.a.x + leg.b.x) / 2, y: (leg.a.y + leg.b.y) / 2, z: (leg.a.z + leg.b.z) / 2 }
    if (isCold(mid.x, mid.y, mid.z, 100)) continue
    const len = Math.max(1, Math.hypot(leg.b.x - leg.a.x, leg.b.z - leg.a.z))
    const dir = { x: (leg.b.x - leg.a.x) / len, z: (leg.b.z - leg.a.z) / len }
    const side = rng() < 0.5 ? 1 : -1
    const r = between(3, 6)
    const off = between(14, 26)
    const pos = { x: mid.x - dir.z * side * off, z: mid.z + dir.x * side * off }
    const top = Math.max(leg.a.y, leg.b.y) + 6
    const ground = floorHit(ctx.site, pos.x, Math.min(leg.a.y, leg.b.y) - 1, pos.z)
    const bottom = ground && ground.y > MIST && top - ground.y <= 400 ? ground.y : MIST
    if (top - bottom < 10 || top - bottom > 1000) continue
    const fits = keepsOff(([px, py, pz]) => (py < bottom || py > top ? Infinity : Math.hypot(px - pos.x, pz - pos.z) - r), 5)
    const column = { kind: 'lathe', at: P(pos.x, bottom, pos.z), look: 'rust', sides: 16, smooth: true, profile: [[0, 0], [r2(r), 0], [r2(r), r2(top - bottom)], [0, r2(top - bottom)]], role: 'service' }
    if (!fits || !ctx.clearOf('forms', column)) continue
    const stoodColumn = form(column)
    // Collars up it, brass; each second one leaks.
    for (let y = bottom + 20, i = 0; y < top - 6; y += 34, i++) {
      parentOf.set(form({ kind: 'lathe', at: P(pos.x, y, pos.z), look: 'b1Ochre', sides: 16, smooth: true, profile: [[0, 0], [r2(r + 0.9), 0], [r2(r + 0.9), 2.4], [0, 2.4]], role: 'service' }), stoodColumn)
      if (i % 2 === 0) vent(pos.x + r, y + 1.2, pos.z, between(3, 5), 220, stoodColumn)
    }
    stats.verticals++
    // The great grate where the shaft's floor is, a landmark: only on a floor met under it.
    if (ground && ground.y > MIST && stats.bigGrates < 8) {
      const g = { x: mid.x + dir.x * 6, z: mid.z + dir.z * 6 }
      const floor = floorHit(ctx.site, g.x, Math.min(leg.a.y, leg.b.y) - 2, g.z)
      if (floor && floor.y > MIST && !isCold(g.x, floor.y, g.z, 50)) {
        grate(g.x, floor.y, g.z, 0, 22, 22, 6)
        vent(g.x, floor.y + 0.5, g.z, 7, 480)
        stats.bigGrates++
      }
    }
  }

  // --- Small grates on some run pads: steam rising through the floor marks the path. ---
  const smallPads = shuffled(pads.filter((p) => p.move === 'run'))
  for (const pad of smallPads) {
    if (stats.smallGrates >= 36) break
    if (isCold(pad.x, pad.y, pad.z, 20)) continue
    const along = between(-0.2, 0.2) * pad.l
    const gx = pad.x + Math.sin(pad.yaw) * along
    const gz = pad.z + Math.cos(pad.yaw) * along
    grate(gx, pad.y, gz, pad.yaw, 3, 3, 3)
    vent(gx, pad.y + 0.3, gz, 3, 150)
    stats.smallGrates++
  }

  // A grate: a dark pit with bars across it, `w` across by `l` along, bars `n` a metre-ish, its top at `y`.
  // Seen only (dressing), laid flat on the floor, so it takes nothing from any leg.
  function grate(x, y, z, yaw, w, l, bars) {
    const at = (u, v) => [x + u * Math.cos(yaw) + v * Math.sin(yaw), z - u * Math.sin(yaw) + v * Math.cos(yaw)]
    const part = (u, v, pw, pd, h, look) => {
      const [px, pz] = at(u, v)
      out.dressing.push({ x: r2(px), y: r2(y + h / 2 + 0.02), z: r2(pz), w: r2(pw), h: r2(h), d: r2(pd), turn: [0, round(yaw, 1e4), 0], look })
    }
    const bar = Math.max(0.12, w / 24)
    part(0, 0, w, l, 0.05, 'joint') // the dark vent under the bars
    for (let i = 0; i < bars; i++) part(-w / 2 + (w * (i + 0.5)) / bars, 0, bar, l, bar * 1.2, 'prop') // bars along the length
    for (const side of [-1, 1]) part(0, (side * l) / 2, w + bar * 2, bar * 2, bar * 1.6, 'prop') // the frame's ends
    for (const side of [-1, 1]) part((side * w) / 2, 0, bar * 2, l, bar * 1.6, 'prop') // and sides
  }

  clock('placed')
  // Gravity (support.mjs) over the copy with these records stood: what floats goes, with its train.
  const ventsMade = out.vents.length
  const mine = new Set(['forms', 'boxes'])
  for (let pass = 0; pass < 1; pass++) { // one pass, taking the children with it (`parentOf`, trains): what hangs from a dropped main goes too
    const trial = { ...ctx.place }
    for (const list of Object.keys(out)) trial[list] = [...(ctx.place[list] ?? []), ...out[list]]
    const site = standSite(trial, ctx.solids)
    const recs = solidRecords(trial, ctx.solids)
    const scan = scanSupport(site, recs)
    const ours = new Set([...out.forms, ...out.boxes])
    const floating = recs.filter((r) => mine.has(r.list) && ours.has(r.record) && !scan.grounded.has(r.key))
    if (process.env.STEAM_DEBUG) console.log('pass', pass, 'floating', floating.length, floating.slice(0, 3).map((r) => r.key + ' ' + r.record.look))
    if (!floating.length) break
    const lost = new Set(floating.map((r) => r.record))
    for (const [child, parent] of parentOf) if (lost.has(parent)) lost.add(child)
    const trains = new Set(floating.map((r) => r.record.train).filter((t) => t !== undefined))
    out.forms = out.forms.filter((f) => !lost.has(f))
    out.boxes = out.boxes.filter((b) => !lost.has(b))
    if (trains.size) {
      for (const b of out.boxes) if (trains.has(b.train)) lost.add(b)
      out.boxes = out.boxes.filter((b) => !trains.has(b.train))
      out.props = out.props.filter((pr) => !trains.has(Number(pr.id.split('-')[2])))
    }
    out.vents = out.vents.filter((v) => !lost.has(owners.get(v)))
    stats.dropped = (stats.dropped ?? 0) + floating.length
  }
  clock('gravity')
  // Cables and pipe bundles: look only, so after gravity has had its say.
  const bundled = growCables({ ctx, samples, isCold, anchors })
  out.cables = bundled.cables
  out.vents.push(...bundled.vents)
  stats.cables = bundled.count
  clock('cables')
  stats.anchors = bundled.anchors
  stats.why = bundled.why
  stats.ventsBefore = ventsMade
  stats.vents = out.vents.length
  console.log(`steam: ${JSON.stringify(stats)} refused ${JSON.stringify(why)}`)
  return { add: out }
}
