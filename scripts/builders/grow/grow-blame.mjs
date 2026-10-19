// The blame layer of the generator (scripts/builders/grow.mjs has the contract): BLAME!'s grammar
// round the routes, so that the courier is small in something endlessly larger.
//   strata   floors 40–60 m thick every 150–250 m of height, a km or two across, ragged-edged, with
//            light wells, cut by holes 32 m wider than any route through them; undersides carry
//            girders and cable, lamps hang in rows;
//   shafts   walls round the descents (60–300 m across, mist to the top floor) with ledges, brass
//            bands and doors 30 m up with nothing to step onto;
//   columns  forests of piers from the mist (40–80 m apart, 10–30 m thick) flaring into the floor
//            above; some lean, some are cracked across, some are broken off;
//   drift    rows of cell-block towers, each copy off its neighbour in height, width and turn;
//   useless  a stair of a hundred treads into a ceiling, bridges that end in air, rows of identical
//            booths, a half-buried ring, needles that taper or widen as they climb.
// Everything is kept `M` metres off every route and every record already standing; nothing here
// bridges a leg. Each form is one record that reads as a great deal of building: the record count
// is a few hundred to a thousand. All of it reaches the mist or lies fused to what does.
import { band, prism, ringDeck } from '../../../src/forms.js'
import { nextFormId } from '../../../src/place-file.js'
import { MIST, round, solidRecords, standSite, positionsOf } from '../world.mjs'
import { testWays } from '../ways.mjs'
import { routeAir, fillsForm } from './blame-air.mjs'
import { fieldOf } from './blame-field.mjs'
import { boothRow, cable, column, doorFrame, doorLeaf, FOOT, finTower, girder, pylon, ring, slab, stair } from './blame-shapes.mjs'

const M = 32 // metres every mass keeps off every route
const PIECE = 395 // the most a floor piece spans
const CELL = 100 // the grid the strata are cut on
const MAX_COLUMNS = 300
const MAX_GIRDERS = 60
const MAX_LAMPS = 420
const ARCS = 72 // buckets the turn of a shaft's wall is cut into when a route crosses it
const CONCRETE = ['concrete', 'concrete', 'dim', 'pozzolan', 'board', 'cast', 'dark']

// The longest run of free buckets of a turn (cyclic) as radians [from, to], if it is at least `least` of the turn.
function widestFree(blocked, least) {
  const n = blocked.length
  if (blocked.every((b) => !b)) return [0, Math.PI * 2 - 1e-3]
  let best = null
  for (let k = 0; k < n; k++) {
    if (blocked[k] || !blocked[(k + n - 1) % n]) continue // a run starts after a blocked bucket
    let len = 0
    while (!blocked[(k + len) % n] && len < n) len++
    if (!best || len > best.len) best = { k, len }
  }
  if (!best || best.len < n * least) return null
  const from = (best.k / n) * Math.PI * 2
  return [from, from + (best.len / n) * Math.PI * 2]
}

// The owner's hand-made balcony stands near the origin and is left whole: what is older than the builders, out there, is only a heap of earlier tries that a mass may stand through.
const nearBalcony = ({ min, max }) => max.x > -330 && min.x < 430 && max.z > -230 && min.z < 650

export function growBlame(ctx, pads) {
  const off = (process.env.BLAME_OFF ?? '').split(',') // dev: switch parts off to find which unmakes a leg
  const rng = ctx.rng
  const R = (a, b) => a + (b - a) * rng()
  const pick = (list) => list[Math.floor(rng() * list.length)]
  // the ways layer's piers do not stand in the field: a wall may take a pier's place
  const piers = ctx.recs.filter((r) => r.owner === 'builders-grow-ways' && r.record.role === 'support' && r.list === 'forms')
  const air = routeAir(ctx.order, pads)
  const clearAll = (f) => ctx.clearOf('forms', f) && !fillsForm(air, f) // the story's zones and the route's own air
  const F = fieldOf(ctx.order, pads, ctx.recs.filter((r) => !piers.includes(r) && (r.owner !== 'old' || nearBalcony(r.bounds))))
  const forms = []
  const lamps = []
  const lights = []
  const stats = {}
  const count = (k, n = 1) => ((stats[k] = (stats[k] ?? 0) + n), true)
  const lamp = (x, y, z, s = 2.4) => {
    if (lamps.length < MAX_LAMPS && !F.hitBox(x - s / 2, x + s / 2, y, y + 0.8, z - s / 2, z + s / 2, 9)) lamps.push({ x0: x - s / 2, x1: x + s / 2, y0: y, y1: y + 0.8, z0: z - s / 2, z1: z + s / 2 })
  }

  const ys = F.samples.map((s) => s[1])
  const top = Math.max(...ys)
  const xs = F.samples.map((s) => s[0])
  const zs = F.samples.map((s) => s[2])
  const box = { x0: Math.min(...xs) - 650, x1: Math.max(...xs) + 650, z0: Math.min(...zs) - 650, z1: Math.max(...zs) + 650 }

  // --- Levels of strata. ---
  const levels = []
  for (let y = MIST + 40 + R(0, 20); y < top + 340; ) {
    const thick = R(40, 60)
    levels.push({ y0: y, y1: y + thick, rects: [] })
    y += thick + R(100, 190)
  }

  const shafts = [] // laid after the walls, which hold their ground first
  // --- Mega walls: the full wall, mist to out of the frame, 24–90 m off the route; where the route meets it the wall is pierced. ---
  // A wall is built as pieces round its openings (left, right, above, below), each opening framed. The
  // ways layer's piers a wall takes over are dropped: the pad stands on the piece below its opening,
  // or hangs on a corbel into the wall.
  const stops = ctx.order.stops
  const walls = []
  const over = [] // what has a floor over it: { poly: [[x, z], …], y0, y1 }
  const inPoly = (poly, x, z) => {
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i]
      const [xj, zj] = poly[j]
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
    }
    return inside
  }
  const segGap = (a0, a1, b0, b1) => {
    let least = Infinity
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
      const pa = { x: a0.x + ((a1.x - a0.x) * i) / 8, z: a0.z + ((a1.z - a0.z) * i) / 8 }
      const pb = { x: b0.x + ((b1.x - b0.x) * j) / 8, z: b0.z + ((b1.z - b0.z) * j) / 8 }
      least = Math.min(least, Math.hypot(pa.x - pb.x, pa.z - pb.z))
    }
    return least
  }
  function tryWall(p, q, o = {}) {
    let dx = q.x - p.x
    let dz = q.z - p.z
    const run = Math.hypot(dx, dz)
    if (run < 100) return false
    dx /= run
    dz /= run
    const side = rng() < 0.5 ? 1 : -1
    const nrm = { x: -dz * side, z: dx * side } // from the route toward the wall
    const L = R(260, 640)
    const face = o.face ?? (rng() < 0.75 ? R(31, 42) : R(44, 90)) // the near ones hang the route on the cliff: corbels reach them
    const thick = R(28, 44)
    const m = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 }
    const c = { x: m.x + nrm.x * (face + thick / 2), z: m.z + nrm.z * (face + thick / 2) }
    const yTop = Math.min(top + 330, Math.max(p.y, q.y) + R(150, 420))
    const k = rng() < 0.4 ? R(0.04, 0.12) : 0
    const lo = { x: c.x - dx * L / 2, z: c.z - dz * L / 2 }
    const hi = { x: c.x + dx * L / 2, z: c.z + dz * L / 2 }
    if (o.stop) {
      const u = (o.stop.x - c.x) * dx + (o.stop.z - c.z) * dz
      if (Math.abs(u) > L / 2 - 10) return false
    }
    for (let s = -L / 2; s <= L / 2; s += 40) {
      const x = c.x + dx * s
      const z = c.z + dz * s
      if (x > -330 - thick && x < 430 + thick && z > -230 - thick && z < 650 + thick) return count('w:balcony') && false
      if (shafts.some((sh) => Math.hypot(x - sh.cx, z - sh.cz) < sh.r + sh.t + thick)) return count('w:shaft') && false
    }
    if (walls.some((w) => segGap(lo, hi, w.lo, w.hi) < (thick + w.thick) / 2 + 8)) return count('w:crowded') && false
    // what the wall meets: openings
    const obs = []
    for (const [x, y, z, r, move] of F.samples) {
      const u = (x - c.x) * dx + (z - c.z) * dz
      if (Math.abs(u) > L / 2 + 20 || y > yTop + 5) continue
      const lat = (x - c.x) * nrm.x + (z - c.z) * nrm.z - k * (y - FOOT)
      if (Math.abs(lat) > thick / 2 + 5 + 21 + r) continue // fins 5 m, and the run's corridor wants 21 m more
      const air = move === 'glide' || move === 'drop' || move === 'jump'
      const big = move === 'glide' || move === 'drop'
      const hw = (big ? 36 : air ? 22 : 12) + r
      obs.push({ u0: u - hw, u1: u + hw, y0: big ? y - 45 : air ? y - 6 : y - 1.5, y1: y + (big ? 45 : 30), air, big })
    }
    obs.sort((a, b) => a.u0 - b.u0)
    const ops = []
    for (const ob of obs) {
      const last = ops.at(-1)
      if (last && ob.u0 < last.u1 + 8) {
        last.u1 = Math.max(last.u1, ob.u1)
        last.y0 = Math.min(last.y0, ob.y0)
        last.y1 = Math.max(last.y1, ob.y1)
        last.air ||= ob.air
        last.big ||= ob.big
      } else ops.push({ ...ob })
    }
    for (const op of ops) {
      const need = op.big ? 40 : 24
      if (op.u1 - op.u0 < need) {
        const mid = (op.u0 + op.u1) / 2
        op.u0 = mid - need / 2
        op.u1 = mid + need / 2
      }
      op.y1 = Math.max(op.y1, op.y0 + (op.big ? 40 : 20))
    }
    // widened openings may have grown into each other: one opening, then, for the pieces round it to stand clear
    for (let i = 1; i < ops.length; ) {
      if (ops[i].u0 < ops[i - 1].u1 + 6) {
        const a = ops[i - 1]
        a.u1 = Math.max(a.u1, ops[i].u1)
        a.y0 = Math.min(a.y0, ops[i].y0)
        a.y1 = Math.max(a.y1, ops[i].y1)
        a.air ||= ops[i].air
        a.big ||= ops[i].big
        ops.splice(i, 1)
      } else i++
    }
    if (ops.length > 12) return count('w:chaotic') && false
    let beside = 0
    let besideMax = -Infinity
    for (const [x, y, z] of F.samples) {
      const u = (x - c.x) * dx + (z - c.z) * dz
      const lat = (x - c.x) * nrm.x + (z - c.z) * nrm.z - thick / 2
      if (Math.abs(u) < L / 2 && lat < 0 && lat > -(face + 90) && y < yTop) {
        beside++
        besideMax = Math.max(besideMax, y)
      }
    }
    if (beside < L / 16) return count('w:notbeside') && false
    // the pieces (kept apart until the story's zones have judged them: one that meets a leg's air unmakes the wall)
    const mark = forms.length
    const yaw = Math.atan2(-nrm.x, -nrm.z)
    const look = pick(['board', 'cast', 'pale', 'board', 'dim', 'concrete']) // the far ones read lighter and cooler
    const period = R(90, 140)
    const piece = (u0, u1, y0, y1) => {
      u0 = Math.max(u0, -L / 2)
      u1 = Math.min(u1, L / 2)
      if (u1 - u0 < 4 || y1 - y0 < 6) return
      if (u1 - u0 > 230) {
        // gravity fuses only what covers under 400 × 400 m on the plan: a long wall is cut into pieces, a diagonal one the shorter
        const n = Math.ceil((u1 - u0) / 230)
        for (let i = 0; i < n; i++) piece(u0 + ((u1 - u0) * i) / n, u0 + ((u1 - u0) * (i + 1)) / n, y0, y1)
        return
      }
      const um = (u0 + u1) / 2
      const sh = k * (y0 - FOOT)
      forms.push(finTower({ x: c.x + dx * um + nrm.x * sh, z: c.z + dz * um + nrm.z * sh, y0, y1, w: u1 - u0 + 1, d: thick, fins: Math.max(1, Math.round((u1 - u0) / 24)), fin: 5, yaw, period, look, oneSide: true, lean: [nrm.x * k * (y1 - y0), nrm.z * k * (y1 - y0)] }))
    }
    let cursor = -L / 2
    for (const op of ops) {
      piece(cursor, op.u0, FOOT, yTop)
      piece(op.u0, op.u1, FOOT, op.y0)
      if (op.u0 > -L / 2 + 4 || op.u1 < L / 2 - 4) piece(op.u0, op.u1, op.y1, yTop) // else nothing would hold it
      if (!off.includes('frame') && !op.air && op.u1 > -L / 2 && op.u0 < L / 2) {
        const um = (op.u0 + op.u1) / 2
        const sh = k * (op.y0 - FOOT) + thick / 2
        forms.push(doorFrame({ x: c.x + dx * um + nrm.x * sh, y: op.y0, z: c.z + dz * um + nrm.z * sh, w: op.u1 - op.u0, h: op.y1 - op.y0, deep: thick + 3, yaw, look: pick(['brass', 'rust', 'concrete'])}))
        count('portals')
      }
      cursor = Math.max(cursor, op.u1)
    }
    piece(cursor, L / 2, FOOT, yTop)
    for (const f of forms.slice(mark)) f.part = 'megawall' // for the layers after, which hang gear trains and mains on the faces
    if (!forms.slice(mark).every((f) => clearAll(f))) {
      forms.length = mark
      return count('w:zone') && false
    }
    const h = yTop - FOOT
    for (let s = -L / 2; s <= L / 2; s += 40) F.addSolid({ x: c.x + dx * s - 24 - Math.abs(nrm.x * k * h), y: FOOT, z: c.z + dz * s - 24 - Math.abs(nrm.z * k * h) }, { x: c.x + dx * s + 24 + Math.abs(nrm.x * k * h), y: yTop, z: c.z + dz * s + 24 + Math.abs(nrm.z * k * h) })
    for (const row of [p.y + 12, p.y + 90]) {
      if (row > yTop - 20) continue
      for (let s = -L / 2 + 20; s < L / 2; s += 48) lamp(c.x + dx * s - nrm.x * (thick / 2 + 8), row, c.z + dz * s - nrm.z * (thick / 2 + 8), 2.6)
    }
    // the shelf: a floor thrown out of the wall over the route, pierced where anything else passes
    const sh = R(22, 36)
    const depth = R(70, 130)
    const yS = Math.min(yTop - 60, besideMax + R(60, 110))
    if (!off.includes('shelf') && yS > FOOT + 100 && !shafts.some((s) => Math.hypot(s.cx - c.x, s.cz - c.z) < s.r + s.t + L / 2 + depth)) {
      const shift = k * (yS - FOOT)
      const CELL2 = 16
      const nu = Math.floor((L - 16) / CELL2)
      const nl = Math.floor((depth + 10) / CELL2)
      const lat0 = -thick / 2 - depth + shift // the free edge
      const cellFree = Array.from({ length: nu }, () => new Array(nl).fill(true))
      for (const [x, y, z, r] of F.samples) {
        if (y < yS - 70 || y > yS + sh + 50) continue
        const u = (x - c.x) * dx + (z - c.z) * dz
        const lat = (x - c.x) * nrm.x + (z - c.z) * nrm.z
        const i = Math.floor((u + L / 2 - 8) / CELL2)
        const j = Math.floor((lat - lat0) / CELL2)
        const reach = Math.ceil((26 + r) / CELL2) + 1
        for (let a = i - reach; a <= i + reach; a++) for (let b = j - reach; b <= j + reach; b++) if (a >= 0 && a < nu && b >= 0 && b < nl) cellFree[a][b] = false
      }
      // keep what is joined to the wall's edge
      const joined = Array.from({ length: nu }, () => new Array(nl).fill(false))
      const stack = []
      for (let a = 0; a < nu; a++) if (cellFree[a][nl - 1]) {
        joined[a][nl - 1] = true
        stack.push([a, nl - 1])
      }
      while (stack.length) {
        const [a, b] = stack.pop()
        for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const na = a + da
          const nb = b + db
          if (na >= 0 && na < nu && nb >= 0 && nb < nl && cellFree[na][nb] && !joined[na][nb]) {
            joined[na][nb] = true
            stack.push([na, nb])
          }
        }
      }
      let pieces = 0
      for (let b = 0; b < nl; b++) for (let a = 0; a < nu; a++) {
        if (!joined[a][b]) continue
        let w = 1
        while (a + w < nu && w < 12 && joined[a + w][b]) w++
        let hh = 1
        outer: while (b + hh < nl) {
          for (let t = 0; t < w; t++) if (!joined[a + t][b + hh]) break outer
          hh++
        }
        for (let t = 0; t < w; t++) for (let v = 0; v < hh; v++) joined[a + t][b + v] = false
        const u0 = -L / 2 + 8 + a * CELL2 - 0.5
        const u1 = -L / 2 + 8 + (a + w) * CELL2 + 0.5
        const l0 = lat0 + b * CELL2 - 0.5
        const l1 = lat0 + (b + hh) * CELL2 + 0.5 + (b + hh === nl ? 0 : 0)
        const poly = [[u0, l0], [u1, l0], [u1, l1], [u0, l1]].map(([u, l]) => [c.x + dx * u + nrm.x * l, c.z + dz * u + nrm.z * l])
        const slabForm = { ...prism(poly.map(([x, z]) => [round(x, 100), round(z, 100)]), yS, yS + sh, 'concrete'), role: 'mass' }
        if (!clearAll(slabForm)) continue
        forms.push(slabForm)
        over.push({ poly, y0: yS, y1: yS + sh })
        pieces++
      }
      if (pieces) {
        count('shelves')
        count('shelf pieces', pieces)
        for (let s = -L / 2 + 30; s < L / 2 - 20; s += 56) lamp(c.x + dx * s + nrm.x * lat0, yS - 0.9, c.z + dz * s + nrm.z * lat0, 2.6)
        F.addSolid({ x: Math.min(c.x, c.x + nrm.x * lat0) - L / 2, y: yS - 2, z: Math.min(c.z, c.z + nrm.z * lat0) - L / 2 }, { x: Math.max(c.x, c.x + nrm.x * lat0) + L / 2, y: yS + sh + 2, z: Math.max(c.z, c.z + nrm.z * lat0) + L / 2 })
      }
    }
    walls.push({ x: c.x, z: c.z, dx, dz, nrm, len: L, thick, k, yTop, ops, lo, hi })
    count('mega walls')
    return true
  }
  // one for every stop first, so that a wall leaves the frame beside each; then along every way
  for (const st of stops) {
    for (let t = 0; t < 2500; t++) {
      const way = ctx.order.ways[Math.floor(rng() * ctx.order.ways.length)]
      let i = way.legs.findIndex((l) => Math.hypot(l.a.x - st.x, l.a.z - st.z) < 6 && Math.abs(l.a.y - st.y) < 6)
      if (i < 0) i = way.legs.findIndex((l) => Math.hypot(l.b.x - st.x, l.b.z - st.z) < 6 && Math.abs(l.b.y - st.y) < 6) - 1
      if (i < -1 || (i < 0 && way.legs.length < 3)) continue
      i = Math.max(0, i)
      if (tryWall(way.legs[Math.max(0, i - 2)].a, way.legs[Math.min(way.legs.length - 1, i + 2)].b, { stop: st, face: R(26, 70) })) {
        count('stop walls')
        break
      }
    }
  }
  for (const way of ctx.order.ways) {
    let got = 0
    for (let t = 0; t < 900 && got < 10 && walls.length < 80; t++) {
      const i = Math.floor(rng() * way.legs.length)
      let j = i
      while (j + 1 < way.legs.length && j < i + 10 && Math.hypot(way.legs[j].b.x - way.legs[i].a.x, way.legs[j].b.z - way.legs[i].a.z) < R(160, 300)) j++
      if (tryWall(way.legs[i].a, way.legs[j].b)) got++
    }
  }

  // --- The ways layer's piers a wall takes over: standing in an opening on the piece below it, or a corbel into the wall. ---
  stats.stopWall = stops.map((st) => Math.round(Math.min(...walls.map((w) => {
    const u = Math.max(-w.len / 2, Math.min(w.len / 2, (st.x - w.x) * w.dx + (st.z - w.z) * w.dz))
    return Math.hypot(st.x - (w.x + w.dx * u), st.z - (w.z + w.dz * u)) - w.thick / 2
  }))))
  const drop = []
  for (const pier of off.includes('drops') ? [] : piers) {
    const { min, max } = pier.bounds
    const px = (min.x + max.x) / 2
    const pz = (min.z + max.z) / 2
    const yTopPier = max.y
    for (const w of walls) {
      const u = (px - w.x) * w.dx + (pz - w.z) * w.dz
      const lat = (px - w.x) * w.nrm.x + (pz - w.z) * w.nrm.z
      const shift = w.k * (yTopPier - FOOT) // a leaning wall's face is further off up there
      if (Math.abs(u) > w.len / 2 - 6 || yTopPier > w.yTop - 12) continue
      if (Math.abs(lat - shift) < w.thick / 2 + 5) {
        // in the wall's footprint: it stands in an opening, its pad on the piece below
        if (w.ops.some((op) => u > op.u0 + 2 && u < op.u1 - 2 && yTopPier > op.y0 - 4 && yTopPier < op.y0 + 3)) {
          drop.push(pier.record.id)
          count('piers dropped')
          break
        }
        continue
      }
      if (off.includes('corbel') || stops.some((st) => Math.hypot(st.x - px, st.z - pz) < 28)) continue // a stop's hub keeps its piers
      const gap = -w.thick / 2 + shift - lat // from the pier to the face, along the normal
      if (gap < 3 || gap > 48) continue
      const target = { x: px + w.nrm.x * (gap + 10), y: yTopPier, z: pz + w.nrm.z * (gap + 10) }
      const beam = girder({ x: px, y: yTopPier, z: pz }, target, Math.min(7, Math.max(4, (max.x - min.x + max.z - min.z) / 3)), R(3, 5), 'concrete')
      if (!clearAll(beam)) continue
      // not across any other stretch of the route: only the pad it holds may be near its line
      const len = gap + 10
      let across = false
      for (const [x, y, z, r] of F.samples) {
        if (Math.abs(y - yTopPier) > 12) continue
        const t = ((x - px) * w.nrm.x + (z - pz) * w.nrm.z)
        const d = Math.abs((x - px) * w.nrm.z - (z - pz) * w.nrm.x)
        if (t > 10 + r && t < len + 6 && d < 12 + r) {
          across = true
          break
        }
      }
      if (across) continue
      forms.push(beam)
      drop.push(pier.record.id)
      count('corbels')
      count('piers dropped')
      break
    }
  }
  count('piers total', piers.length)
  // --- Shafts: round the descents. ---
  const descents = ctx.order.ways.flatMap((w) => w.legs).filter((l) => l.a.y - l.b.y >= 25).sort((a, b) => b.a.y - b.b.y - (a.a.y - a.b.y))
  const topAll = levels.at(-1).y1
  for (const leg of descents) {
    if (shafts.length >= 8) break
    let made = false
    const along = Math.hypot(leg.b.x - leg.a.x, leg.b.z - leg.a.z) || 1
    for (const [u, off] of [[0.5, 0], [0.5, 0.55], [0.5, -0.55], [0.3, 0], [0.7, 0], [0.4, 0.8], [0.6, -0.8]]) {
      for (const r of [150, 105, 170, 70]) {
        const cx = leg.a.x + (leg.b.x - leg.a.x) * u - ((leg.b.z - leg.a.z) / along) * off * r
        const cz = leg.a.z + (leg.b.z - leg.a.z) * u + ((leg.b.x - leg.a.x) / along) * off * r
        const t = R(14, 24)
        if (shafts.some((s) => Math.hypot(s.cx - cx, s.cz - cz) < s.r + r + 120)) continue
        const arc = widestFree(F.blockedArcs(cx, cz, r - 22, r + t, FOOT, topAll + 20, 24, ARCS), 0.3)
        if (!arc) continue
        shafts.push({ cx, cz, r, t, y0: FOOT, y1: topAll + 24, arc })
        made = true
        break
      }
      if (made) break
    }
  }
  const inShaft = (x, z, pad) => shafts.some((s) => Math.hypot(x - s.cx, z - s.cz) < s.r + s.t + pad)

  const canopyLevels = []

  // --- Strata: cells that keep clear, merged into rectangles. ---
  const nx = Math.ceil((box.x1 - box.x0) / CELL)
  const nz = Math.ceil((box.z1 - box.z0) / CELL)
  const mid = { x: (box.x0 + box.x1) / 2, z: (box.z0 + box.z1) / 2 }
  for (const L of levels) {
    const c = { x: mid.x + R(-150, 150), z: mid.z + R(-150, 150) }
    const ax = (box.x1 - box.x0) / 2 * R(0.78, 0.98)
    const az = (box.z1 - box.z0) / 2 * R(0.78, 0.98)
    const [p1, p2, f1, f2] = [R(0, 6), R(0, 6), Math.floor(R(2, 5)), Math.floor(R(5, 9))]
    const wells = Array.from({ length: 4 }, () => ({ x: R(box.x0, box.x1), z: R(box.z0, box.z1), w: R(120, 340), d: R(120, 340) }))
    const filled = Array.from({ length: nx }, () => new Array(nz).fill(false))
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const x0 = box.x0 + i * CELL
        const z0 = box.z0 + j * CELL
        const x = x0 + CELL / 2
        const z = z0 + CELL / 2
        const th = Math.atan2(z - c.z, x - c.x)
        const e = ((x - c.x) / ax) ** 2 + ((z - c.z) / az) ** 2
        if (e > 1 + 0.2 * Math.sin(f1 * th + p1) + 0.12 * Math.sin(f2 * th + p2)) continue
        if (wells.some((w) => Math.abs(x - w.x) < w.w / 2 && Math.abs(z - w.z) < w.d / 2)) continue
        if (inShaft(x, z, 70) || shafts.some((s) => Math.hypot(x - s.cx, z - s.cz) < s.r + s.t + 70 + CELL * 0.7)) continue
        if (F.hitBox(x0, x0 + CELL, L.y0 - 26, L.y1 + 12, z0, z0 + CELL, M)) continue
        filled[i][j] = true
      }
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        if (!filled[i][j]) continue
        let w = 1
        while (i + w < nx && filled[i + w][j]) w++
        let h = 1
        outer: while (j + h < nz) {
          for (let k = 0; k < w; k++) if (!filled[i + k][j + h]) break outer
          h++
        }
        for (let k = 0; k < w; k++) for (let m = 0; m < h; m++) filled[i + k][j + m] = false
        L.rects.push({ x0: box.x0 + i * CELL, x1: box.x0 + (i + w) * CELL, z0: box.z0 + j * CELL, z1: box.z0 + (j + h) * CELL, y0: L.y0, y1: L.y1, anchored: false })
      }
    }
    count('rects before columns', L.rects.length)
  }
  const solidAt = (L, x, z, pad = 0) => L?.rects.some((r) => r.anchored && x > r.x0 + pad && x < r.x1 - pad && z > r.z0 + pad && z < r.z1 - pad)

  // --- Columns. ---
  const columns = []
  const spaced = (x, z, s) => columns.every((c) => Math.hypot(c.x - x, c.z - z) > s)
  const lookOf = () => (rng() < 0.08 ? 'rust' : pick(CONCRETE))
  const tryColumn = (x, z, yTop, rect, o = {}) => {
    if (!o.anchor && columns.length >= MAX_COLUMNS) return false
    const r = o.r ?? R(5, 15)
    const flare = rect ? R(1.55, 2.1) : 1
    const h = yTop - FOOT
    const lean = !o.straight && rng() < 0.22 ? [R(-0.06, 0.06) * h, R(-0.06, 0.06) * h] : [0, 0]
    const reach = r * flare + Math.hypot(...lean)
    if (!spaced(x, z, o.spacing ?? 36)) return false
    if (F.holdsRoute(x, z, (o.anchor ? 45 : 60) + reach, FOOT, yTop) || stops.some((st) => Math.hypot(st.x - x, st.z - z) < 150)) return false
    if (inShaft(x, z, reach + 20)) return false
    if (F.hitAxis(x + lean[0] / 2, z + lean[1] / 2, reach, FOOT, yTop, M)) return false
    if (rect && (x + lean[0] < rect.x0 + r * flare || x + lean[0] > rect.x1 - r * flare || z + lean[1] < rect.z0 + r * flare || z + lean[1] > rect.z1 - r * flare)) return false
    const look = lookOf()
    const taper = R(0.78, 1.1)
    if (rng() < 0.12 && h > 160) {
      // cracked across: the top half slid sideways, still bearing on the lower
      const split = FOOT + h * R(0.3, 0.7)
      const slide = R(3, 6) * (rng() < 0.5 ? -1 : 1)
      forms.push(column({ x, z, y0: FOOT, y1: split + 4, r, look }))
      forms.push(column({ x: x + slide, z, y0: split - 4, y1: yTop, r, look, lean, taper, flare }))
      count('columns cracked')
    } else forms.push(column({ x, z, y0: FOOT, y1: yTop, r, look, lean, taper, flare }))
    columns.push({ x, z })
    return true
  }
  for (const C of canopyLevels) {
    const rect = C.rects[0]
    for (let t = 0; t < 50 && !rect.anchored; t++) {
      if (tryColumn(R(rect.x0 + 14, rect.x1 - 14), R(rect.z0 + 14, rect.z1 - 14), rect.y0 + (rect.y1 - rect.y0) * 0.6, rect, { anchor: true })) rect.anchored = true
    }
  }
  // anchors first on every floor, so that no floor is starved by the one below it
  for (const L of levels) {
    for (const rect of L.rects) {
      const need = Math.max(1, Math.round(((rect.x1 - rect.x0) * (rect.z1 - rect.z0)) / 90000))
      let got = 0
      for (let t = 0; t < 60 && got < need; t++) {
        const x = R(rect.x0 + 14, rect.x1 - 14)
        const z = R(rect.z0 + 14, rect.z1 - 14)
        if (tryColumn(x, z, L.y0 + (L.y1 - L.y0) * 0.6, rect, { anchor: true })) {
          got++
          rect.anchored = true
        }
      }
    }
  }
  // then forests: a grid of piers about a point of a floor
  for (const L of levels) {
    let budget = 46
    for (const rect of L.rects) {
      if (!rect.anchored || budget <= 0 || rng() > 0.5) continue
      const sp = R(44, 80)
      const gx = Math.floor(R(3, 6))
      const gz = Math.floor(R(3, 6))
      const x0 = R(rect.x0 + 40, Math.max(rect.x0 + 41, rect.x1 - sp * gx))
      const z0 = R(rect.z0 + 40, Math.max(rect.z0 + 41, rect.z1 - sp * gz))
      const slant = R(-0.2, 0.2)
      for (let i = 0; i < gx; i++) {
        for (let j = 0; j < gz; j++) {
          const x = x0 + i * sp + j * sp * slant
          const z = z0 + j * sp
          if (tryColumn(x, z, L.y0 + (L.y1 - L.y0) * 0.6, rect, { spacing: sp * 0.6 })) {
            count('forest columns')
            budget--
          }
        }
      }
    }
  }
  // piers standing free of any floor, broken off (stumps that read as what was there)
  for (let k = 0; k < 90 && columns.length < MAX_COLUMNS; k++) {
    const x = R(box.x0 + 200, box.x1 - 200)
    const z = R(box.z0 + 200, box.z1 - 200)
    const yTop = R(MIST + 80, levels[0].y0 - 30)
    if (tryColumn(x, z, yTop, null, { straight: true, r: R(8, 16), spacing: 45 })) count('broken piers')
  }
  count('columns', columns.length)

  // --- The floors, stood only where something bears them. ---
  let girders = 0
  for (const L of [...levels, ...canopyLevels]) {
    L.rects = L.rects.filter((r) => r.anchored)
    for (const r of L.rects) {
      const pad = 0.6
      // dark and warm below, lighter and cooler higher: depth reads in layers of tone
      const rise = (levels.indexOf(L) + 0.5) / levels.length
      const look = rise < 0.35 ? pick(['dim', 'dark', 'concrete']) : rise < 0.7 ? pick(['concrete', 'dim', 'pozzolan']) : pick(['board', 'cast', 'pale'])
      const dy = rng() < 0.28 ? R(-6, 8) : 0
      // cut into pieces under 400 m: gravity lets a piece that size be fused to what stands in it, a larger one only bears
      const px = Math.ceil((r.x1 - r.x0) / PIECE)
      const pz = Math.ceil((r.z1 - r.z0) / PIECE)
      for (let i = 0; i < px; i++) {
        for (let j = 0; j < pz; j++) {
          const x0 = r.x0 + ((r.x1 - r.x0) * i) / px
          const z0 = r.z0 + ((r.z1 - r.z0) * j) / pz
          forms.push(slab(x0 - pad, r.x0 + ((r.x1 - r.x0) * (i + 1)) / px + pad, z0 - pad, r.z0 + ((r.z1 - r.z0) * (j + 1)) / pz + pad, L.y0 + dy, L.y1 + dy, look))
          count('floors')
        }
      }
      const w = r.x1 - r.x0
      const d = r.z1 - r.z0
      if (w * d < 18000 || girders >= MAX_GIRDERS) continue
      // undersides: girders along the long side, a cable bundle between two of them
      const along = w >= d
      const span = along ? w : d
      const across = along ? d : w
      const lines = Math.max(2, Math.min(5, Math.floor(across / R(55, 90))))
      const hang = R(14, 24)
      const gw = R(5, 9)
      for (let k = 0; k < lines; k++) {
        const t = (k + 0.5) / lines
        const p = along ? r.z0 + across * t : r.x0 + across * t
        const a = along ? { x: r.x0 + 6, y: L.y0 + dy + 3, z: p } : { x: p, y: L.y0 + dy + 3, z: r.z0 + 6 }
        const b = along ? { x: r.x1 - 6, y: a.y, z: p } : { x: p, y: a.y, z: r.z1 - 6 }
        forms.push({ ...girder(a, b, gw, hang, rng() < 0.15 ? 'rust' : 'dim'), under: true })
        girders++
        for (let s = 40; s < span - 40; s += R(36, 48)) lamp(along ? r.x0 + s : p, a.y - hang - 0.8, along ? p : r.z0 + s)
      }
      if (girders < MAX_GIRDERS) {
        // a cable bundle laid hard against the first girder's side, so that it hangs from it
        const cr = R(2, 4.5)
        const p = (along ? r.z0 + across * 0.5 / lines : r.x0 + across * 0.5 / lines) + gw / 2 + cr * 0.7
        const y = L.y0 + dy + 3 - hang * 0.5
        const a = along ? { x: r.x0 + 20, y, z: p } : { x: p, y, z: r.z0 + 20 }
        const b = along ? { x: r.x1 - 20, y, z: p } : { x: p, y, z: r.z1 - 20 }
        forms.push({ ...cable(a, b, cr, rng() < 0.5 ? 'rust' : 'dark'), under: true })
        count('cables')
      }
    }
  }
  count('girders', girders)

  // --- Shaft walls. ---
  for (const s of shafts) {
    const H = s.y1 - s.y0
    forms.push({ kind: 'lathe', at: { x: s.cx, y: s.y0, z: s.cz }, look: pick(['concrete', 'dim', 'board']), smooth: true, sides: 28, arc: s.arc, profile: band(s.r, s.t, 0, H), role: 'mass' })
    count('shaft walls')
    // ledges and brass bands at heights between the floors; lamps ring each ledge
    for (const L of levels) {
      const y = L.y0 - R(30, 70)
      if (y < FOOT + 60) continue
      forms.push({ kind: 'lathe', at: { x: s.cx, y: 0, z: s.cz }, look: 'dim', sides: 28, arc: s.arc, profile: ringDeck(s.r - 20, s.r + 2, y, 10), role: 'mass' })
      count('ledges')
      for (let k = 0; k < 14; k++) {
        const th = s.arc[0] + ((s.arc[1] - s.arc[0]) * (k + 0.5)) / 14
        lamp(s.cx + Math.cos(th) * (s.r - 12), y + 0.2, s.cz + Math.sin(th) * (s.r - 12))
      }
      forms.push({ kind: 'lathe', at: { x: s.cx, y: 0, z: s.cz }, look: 'brass', sides: 28, arc: s.arc, profile: band(s.r - 0.8, 1.6, y + 40, y + 46), role: 'dress' })
    }
    // doors 30 m up the wall, with nothing before them
    for (let k = 0; k < 4; k++) {
      const th = s.arc[0] + (s.arc[1] - s.arc[0]) * R(0.1, 0.9)
      const y = R(MIST + 150, topAll - 100)
      const w = R(26, 40)
      const h = R(52, 80)
      const nxo = -Math.cos(th)
      const nzo = -Math.sin(th)
      const at = (radial) => ({ x: s.cx + Math.cos(th) * radial, z: s.cz + Math.sin(th) * radial })
      const back = at(s.r + 6)
      if (F.hitBox(back.x - 40, back.x + 40, y - 10, y + h + 10, back.z - 40, back.z + 40, 12)) continue
      const yaw = Math.atan2(nxo, nzo)
      forms.push(doorFrame({ x: back.x, y, z: back.z, w, h, deep: 11, yaw, look: pick(['rust', 'brass', 'concrete']) }))
      const leaf = at(s.r - 1.5)
      forms.push(doorLeaf({ x: leaf.x, y, z: leaf.z, w: w - 0.2, h: h - 0.2, yaw }))
      count('doors')
    }
    lights.push({ kind: 'point', x: s.cx + Math.cos((s.arc[0] + s.arc[1]) / 2) * (s.r - 30), y: (levels[1] ?? levels[0]).y0 - 40, z: s.cz + Math.sin((s.arc[0] + s.arc[1]) / 2) * (s.r - 30), color: '#ffb35a', power: 260, reach: 120, head: { w: 1.2, h: 0.8, d: 1.2 } })
  }

  // --- Drift: rows of cell-block towers. ---
  const towers = []
  for (let row = 0; row < 5; row++) {
    const a = R(0, Math.PI * 2)
    const dir = { x: Math.cos(a), z: Math.sin(a) }
    let x = R(box.x0 + 300, box.x1 - 300)
    let z = R(box.z0 + 300, box.z1 - 300)
    const base = { w: R(60, 90), d: R(32, 46), fins: Math.floor(R(5, 8)), period: R(40, 56), look: pick(['concrete', 'board', 'pozzolan']) }
    let yaw = a + Math.PI / 2
    const sp = R(95, 140)
    for (let k = 0; k < 12; k++) {
      x += dir.x * sp * R(0.95, 1.1)
      z += dir.z * sp * R(0.95, 1.1)
      yaw += R(-0.05, 0.05)
      const w = base.w * R(0.88, 1.14)
      const d = base.d * R(0.9, 1.12)
      const L = pick(levels.slice(1))
      const yTop = rng() < 0.6 ? L.y0 + 24 : R(MIST + 200, top + 100)
      const reach = Math.hypot(w, d) / 2 + 8
      if (towers.some((t) => Math.hypot(t.x - x, t.z - z) < 70) || inShaft(x, z, reach + 20) || F.holdsRoute(x, z, reach + 60, FOOT, yTop) || stops.some((st) => Math.hypot(st.x - x, st.z - z) < 150) || F.hitAxis(x, z, reach, FOOT, yTop, M)) continue
      forms.push(finTower({ x, z, y0: FOOT, y1: yTop, w, d, fins: base.fins + (rng() < 0.2 ? 1 : 0), yaw: yaw + (rng() < 0.15 ? 0.2 : 0), period: base.period * R(0.96, 1.04), look: base.look }))
      towers.push({ x, z })
    }
  }
  count('cell-block towers', towers.length)

  // --- Needles: slabs that widen or taper as they climb. ---
  for (let k = 0, got = 0; k < 120 && got < 16; k++) {
    const x = R(box.x0 + 200, box.x1 - 200)
    const z = R(box.z0 + 200, box.z1 - 200)
    const w = R(18, 44)
    const d = R(14, 30)
    const yTop = R(MIST + 260, top + 160)
    const taper = rng() < 0.5 ? R(0.25, 0.5) : R(1.5, 2.2)
    const reach = Math.hypot(w, d) * Math.max(1, taper) / 2 + 4
    if (towers.some((t) => Math.hypot(t.x - x, t.z - z) < 90) || columns.some((c) => Math.hypot(c.x - x, c.z - z) < reach + 14) || inShaft(x, z, reach + 20) || F.holdsRoute(x, z, reach + 60, FOOT, yTop) || F.hitAxis(x, z, reach, FOOT, yTop, M)) continue
    forms.push(pylon({ x, z, y0: FOOT, y1: yTop, w, d, yaw: R(0, 3), taper, look: rng() < 0.2 ? 'rust' : pick(CONCRETE), bevel: 0.8 }))
    towers.push({ x, z })
    got++
    count('needles')
  }

  // --- Silos: round shafts of 30–65 m across, out of the frame, standing in the open a few hundred metres from each stop. ---
  for (const st of stops) {
    for (let t = 0, got = 0; t < 120 && got < 2; t++) {
      const a = R(0, Math.PI * 2)
      const d = R(220, 460)
      const x = st.x + Math.cos(a) * d
      const z = st.z + Math.sin(a) * d
      const r = R(16, 32)
      const yTop = top + R(200, 330)
      if (x > -330 - r && x < 430 + r && z > -230 - r && z < 650 + r) continue
      if (inShaft(x, z, r + 30) || towers.some((q) => Math.hypot(q.x - x, q.z - z) < r + 60) || columns.some((c) => Math.hypot(c.x - x, c.z - z) < r + 30)) continue
      if (F.holdsRoute(x, z, r + 50, FOOT, yTop) || F.hitAxis(x, z, r, FOOT, yTop, 34)) continue
      const silo = column({ x, z, y0: FOOT, y1: yTop, r, look: pick(['board', 'cast', 'pale', 'concrete']), sides: 28 })
      if (!clearAll(silo)) continue
      forms.push(silo)
      towers.push({ x, z })
      F.addSolid({ x: x - r, y: FOOT, z: z - r }, { x: x + r, y: yTop, z: z + r })
      got++
      count('silos')
    }
  }
  // --- Things built for a use nobody remembers, laid on the floors. ---
  const flat = levels.flatMap((L, i) => L.rects.map((r) => ({ ...r, i }))).filter((r) => r.x1 - r.x0 >= 160 && r.z1 - r.z0 >= 160)
  const free = (x0, x1, y0, y1, z0, z1) => !F.hitBox(x0, x1, y0, y1, z0, z1, M)
  const freeFar = (x0, x1, y0, y1, z0, z1) => !F.hitBox(x0, x1, y0, y1, z0, z1, 60) // small things keep 60 m off the routes
  // rows of identical booths
  for (let k = 0, got = 0; k < 80 && got < 7 && flat.length; k++) {
    const r = pick(flat)
    const n = Math.floor(R(18, 38))
    const along = rng() < 0.5
    const len = n * 24
    if ((along ? r.x1 - r.x0 : r.z1 - r.z0) < len + 60 || (along ? r.z1 - r.z0 : r.x1 - r.x0) < 80) continue
    const x = along ? R(r.x0 + 30 + len / 2, r.x1 - 30 - len / 2) : R(r.x0 + 40, r.x1 - 40)
    const z = along ? R(r.z0 + 40, r.z1 - 40) : R(r.z0 + 30 + len / 2, r.z1 - 30 - len / 2)
    const ex = along ? len / 2 : 22
    const ez = along ? 22 : len / 2
    if (!freeFar(x - ex, x + ex, r.y1, r.y1 + 30, z - ez, z + ez)) continue
    forms.push(boothRow({ x, y: r.y1 - 0.2, z, n, w: 14, d: 12, gap: 10, tall: R(15, 20), yaw: along ? Math.PI / 2 : 0, look: rng() < 0.3 ? 'rust' : 'dim', rng }))
    for (let s = -len / 2 + 20; s < len / 2; s += 40) lamp(along ? x + s : x, r.y1 + 22, along ? z : z + s, 3)
    got++
    count('booth rows')
  }
  // a ring half sunk in a floor
  for (let k = 0, got = 0; k < 80 && got < 3 && flat.length; k++) {
    const r = pick(flat)
    const Rr = R(90, 150)
    const x = R(r.x0 + Rr + 20, r.x1 - Rr - 20)
    const z = R(r.z0 + Rr + 20, r.z1 - Rr - 20)
    if (!(r.x1 - r.x0 > 2 * Rr + 60 && r.z1 - r.z0 > 2 * Rr + 60)) continue
    const yaw = R(0, Math.PI)
    const cy = r.y1 + Rr * 0.55
    if (!freeFar(x - Rr - 20, x + Rr + 20, r.y1 - 2, cy + Rr + 20, z - Rr - 20, z + Rr + 20)) continue
    forms.push(ring({ x, y: cy, z, R: Rr, tube: R(8, 13), yaw, look: pick(['rust', 'brass', 'concrete']) }))
    got++
    count('rings')
  }
  // a stair that climbs into the ceiling
  for (let k = 0, got = 0; k < 160 && got < 3; k++) {
    const r = pick(flat)
    const up = levels[r.i + 1]
    if (!up) continue
    const H = up.y0 - r.y1 + 6
    const n = Math.round(H)
    const run = R(2.0, 2.6)
    const len = n * run
    const width = R(34, 50)
    const east = rng() < 0.5
    if (r.x1 - r.x0 < len + 80 || r.z1 - r.z0 < width + 80) continue
    const xa = R(r.x0 + 40, r.x1 - 40 - len)
    const z = R(r.z0 + 40 + width / 2, r.z1 - 40 - width / 2)
    const foot = east ? xa : xa + len
    const end = east ? xa + len : xa
    if (!solidAt(up, end, z, 6)) continue
    if (!free(xa, xa + len, r.y1, up.y0, z - width / 2, z + width / 2)) continue
    forms.push(stair({ x: foot, y0: r.y1 - 0.2, z, n, rise: (H - 0.2) / n, run, width, look: pick(['concrete', 'dim', 'cast']), east }))
    got++
    count('ceiling stairs')
  }
  // bridges that end in air, thrown from a floor's edge over its hole
  for (let k = 0, got = 0; k < 160 && got < 14; k++) {
    const L = pick(levels)
    if (!L.rects.length) continue
    const r = pick(L.rects)
    const side = Math.floor(rng() * 4)
    const len = R(110, 240)
    const wd = R(12, 22)
    const th = R(5, 9)
    const horizontal = side < 2
    const edge = horizontal ? (side === 0 ? r.x0 : r.x1) : side === 2 ? r.z0 : r.z1
    const sign = side % 2 === 0 ? -1 : 1
    const along = horizontal ? R(r.z0 + 20, r.z1 - 20) : R(r.x0 + 20, r.x1 - 20)
    const a = horizontal ? { x: edge - sign * 14, y: L.y1, z: along } : { x: along, y: L.y1, z: edge - sign * 14 }
    const b = horizontal ? { x: edge + sign * len, y: L.y1, z: along } : { x: along, y: L.y1, z: edge + sign * len }
    if (!free(Math.min(a.x, b.x) - wd, Math.max(a.x, b.x) + wd, L.y1 - 40, L.y1 + 12, Math.min(a.z, b.z) - wd, Math.max(a.z, b.z) + wd)) continue
    if (L.rects.some((o) => o !== r && o.x0 < Math.max(a.x, b.x) + wd && o.x1 > Math.min(a.x, b.x) - wd && o.z0 < Math.max(a.z, b.z) + wd && o.z1 > Math.min(a.z, b.z) - wd)) continue
    forms.push(girder(a, b, wd, th, rng() < 0.3 ? 'rust' : 'dim'))
    got++
    count('bridges to nowhere')
  }

  // --- A few real lights in the middle of the dark. ---
  for (let k = 0; k < 8; k++) {
    const L = pick(levels)
    const r = L.rects.length ? pick(L.rects) : null
    if (!r) continue
    lights.push({ kind: 'point', x: (r.x0 + r.x1) / 2, y: L.y0 - 18, z: (r.z0 + r.z1) / 2, color: '#ffb35a', power: 300, reach: 120, head: { w: 1.4, h: 0.8, d: 1.4 } })
  }

  // how much of each way has a floor over it within 250 m (a ray up from every 8 m of its legs)
  for (const L of levels) for (const r of L.rects) over.push({ poly: [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]], y0: r.y0, y1: r.y1 })
  stats.overhead = {}
  for (const way of ctx.order.ways) {
    let n = 0
    let covered = 0
    for (const leg of way.legs) {
      const steps = Math.max(1, Math.ceil(leg.length / 8))
      for (let k = 0; k <= steps; k++) {
        const t = k / steps
        const x = leg.a.x + (leg.b.x - leg.a.x) * t
        const y = leg.a.y + (leg.b.y - leg.a.y) * t
        const z = leg.a.z + (leg.b.z - leg.a.z) * t
        n++
        if (over.some((o) => o.y0 > y + 4 && o.y0 - y <= 250 && inPoly(o.poly, x, z))) covered++
      }
    }
    stats.overhead[way.id] = Math.round((100 * covered) / n)
  }

  // a last net: nothing of this layer stands in a leg's air or head room
  for (let i = forms.length - 1; i >= 0; i--) {
    if (!clearAll(forms[i])) {
      forms.splice(i, 1)
      count('removed by zones')
    }
  }

  // --- Self-check: stand the copy with this layer in it and see which legs it unmade. A floor over a leg's plan can unmake a run
  // (the grid of floors the runner is routed on sees it), whatever its height; those floors are taken back, not the walls.
  {
    const made = (list) => new Set(list.flatMap((w) => w.legs.filter((l) => l.made).map((l) => `${w.id}:${l.n}`)))
    const baseline = made(testWays(ctx.site, ctx.order.ways, ctx.recs))
    const dropped = new Set(drop)
    const keep = () => ctx.place.forms.filter((f) => !dropped.has(f.id))
    let idn = nextFormId(ctx.place)
    for (const f of forms) f.id ??= idn++
    const boundsOfForm = (f) => {
      const pos = positionsOf('forms', f)
      const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }
      for (let i = 0; i < pos.length; i += 3) {
        b.x0 = Math.min(b.x0, pos[i])
        b.x1 = Math.max(b.x1, pos[i])
        b.z0 = Math.min(b.z0, pos[i + 2])
        b.z1 = Math.max(b.z1, pos[i + 2])
      }
      return b
    }
    for (let round2 = 0; round2 < 4; round2++) {
      const place2 = { ...ctx.place, forms: [...keep(), ...forms] }
      const site2 = standSite(place2, ctx.solids)
      const lost = [...baseline].filter((k) => !made(testWays(site2, ctx.order.ways, solidRecords(place2, ctx.solids))).has(k))
      stats.lostAfterRound = (stats.lostAfterRound ?? []).concat([lost.length])
      if (!lost.length) break
      const legs = lost.map((k) => {
        const [id, n] = k.split(':')
        return ctx.order.ways.find((w) => w.id === id).legs[Number(n) - 1]
      })
      for (let i = forms.length - 1; i >= 0; i--) {
        const f = forms[i]
        if (f.part === 'megawall' || f.role === 'support' || f.kind !== 'sweep' || f.path.length !== 2) continue
        const b = boundsOfForm(f)
        if (legs.some((l) => b.x0 < Math.max(l.a.x, l.b.x) + 25 && b.x1 > Math.min(l.a.x, l.b.x) - 25 && b.z0 < Math.max(l.a.z, l.b.z) + 25 && b.z1 > Math.min(l.a.z, l.b.z) - 25)) {
          forms.splice(i, 1)
          count('floors taken back')
        }
      }
    }
  }

  // what hung under a floor taken back goes with it; the mark is then taken off
  {
    const slabs = forms.filter((f) => f.kind === 'sweep' && f.role === 'mass' && f.path.length === 2 && f.part !== 'megawall').map((f) => ({ f, b: positionsOf('forms', f) }))
    const spans = slabs.map(({ b }) => {
      const r = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity }
      for (let i = 0; i < b.length; i += 3) {
        r.x0 = Math.min(r.x0, b[i]); r.x1 = Math.max(r.x1, b[i]); r.y0 = Math.min(r.y0, b[i + 1]); r.y1 = Math.max(r.y1, b[i + 1]); r.z0 = Math.min(r.z0, b[i + 2]); r.z1 = Math.max(r.z1, b[i + 2])
      }
      return r
    })
    for (let i = forms.length - 1; i >= 0; i--) {
      const f = forms[i]
      if (!f.under) continue
      delete f.under
      const pos = positionsOf('forms', f)
      let top = -Infinity
      let cx = 0
      let cz = 0
      for (let k = 0; k < pos.length; k += 3) {
        top = Math.max(top, pos[k + 1])
        cx += pos[k]
        cz += pos[k + 2]
      }
      cx /= pos.length / 3
      cz /= pos.length / 3
      if (!spans.some((r) => cx > r.x0 - 1 && cx < r.x1 + 1 && cz > r.z0 - 1 && cz < r.z1 + 1 && r.y0 - 2 < top && r.y1 > top - 1)) forms.splice(i, 1)
    }
  }

  if (process.env.BLAME_KEEP !== undefined) { // dev: bisect which record unmakes a leg
    forms.length = Math.min(forms.length, Number(process.env.BLAME_KEEP))
    if (!process.env.BLAME_LAMPS) lamps.length = lights.length = 0
  }
  let id = nextFormId(ctx.place)
  for (const f of forms) f.id ??= id++
  for (const f of forms) f.planOwner = 'builders-grow-blame'
  for (const l of lamps) l.planOwner = 'builders-grow-blame'
  for (const l of lights) l.planOwner = 'builders-grow-blame'
  console.error('blame:', JSON.stringify({ levels: levels.map((L) => [Math.round(L.y0), L.rects.length]), shafts: shafts.length, forms: forms.length, lamps: lamps.length, lights: lights.length, ...stats }))
  return { add: { forms, lamps, lights }, drop, voids: shafts.map((s) => ({ ball: [s.cx, (s.y0 + s.y1) / 2, s.cz], r: s.r })) }
}
