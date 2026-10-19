// Gear trains and mains on the megawalls, to be SEEN (steam layer, grow-steam.mjs). A megawall is a
// flat face of a big form (`steam-cables.mjs`' `harvest`: its plane and its extent). A train is set
// half sunk into one: 40-120 m across, the wheels' centres on the face, each with a shaft out of it
// and one into the wall, turning or seized. Turning wheels are props without solids, so they ask
// only that no leg runs through their swept disc. Each stop but the cold one is given a train in
// clear view (150-400 m, the face turned to it, no solid between); a main of 10-14 m runs along
// some faces beside the trains. What is placed is logged per stop for the eyes to aim at.
import { ring } from '../../../src/forms.js'
import { round } from '../world.mjs'
import { offLegsOf } from './steam-cables.mjs'

const MODULE = 0.06
const r2 = (v) => round(v, 100)
const SEE = { near: 120, far: 400 } // metres a train is in clear view from a stop

export function growWalls({ ctx, planes, stops, samples, isCold, laid, kit, wanted = 20 }) {
  const { rng, site } = ctx
  const between = (a, b) => a + (b - a) * rng()
  const pick = (list) => list[Math.floor(rng() * list.length)]
  const offAxle = offLegsOf(samples, 4)
  const offMain = offLegsOf(samples, 9)
  const trains = [] // { c, n, R, plane }
  const mains = []
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const along = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
  const solidAt = (p, r) => site.hitsSolid({ x: p[0], y: p[1], z: p[2] }, r)
  const at = (plane, u, v) => [plane.n[0] * plane.d + plane.ux[0] * u, v, plane.n[2] * plane.d + plane.ux[2] * u]

  // Whether `from` sees the point `to` with nothing solid between (the last 8 m, at the face, left out).
  function sees(from, to, skip = 8) {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])
    for (let d = skip; d < len - 8; d += 8) {
      if (solidAt(along(from, to, d / len), 0.3)) {
        if (process.env.STEAM_DEBUG === '2') console.log('blocked at', d, along(from, to, d / len).map(Math.round))
        return false
      }
    }
    return true
  }
  const viewed = (stop, c, n, skip = 8) => {
    const eye = [stop.x, stop.y + 2, stop.z]
    const d = Math.hypot(c[0] - eye[0], c[1] - eye[1], c[2] - eye[2])
    if (d < SEE.near || d > SEE.far) return null
    if ((n[0] * (eye[0] - c[0]) + n[2] * (eye[2] - c[2])) / d < 0.25) return null // the face turned away
    return sees(eye, [c[0] + n[0] * 3, c[1], c[2] + n[2] * 3], skip) ? d : null
  }

  // `opts`: `min` the first wheel's least width, `seized` to force turning (false) or standing (true).
  function trainOn(plane, want = null, opts = {}) {
    for (let attempt = 0; attempt < 14; attempt++) {
      const m = between(1.8, 3.6)
      const s = m / MODULE
      const thick = m * 2.2
      const cap = Math.min(120, plane.W - 8, plane.H - 8)
      const min = opts.min ?? 40
      if (cap < min) return null
      const { gears, seized } = laid(m, { min, max: cap, seized: opts.seized ?? null })
      const x0 = Math.min(...gears.map((g) => g.x - g.R))
      const x1 = Math.max(...gears.map((g) => g.x + g.R))
      const y0 = Math.min(...gears.map((g) => g.y - g.R))
      const y1 = Math.max(...gears.map((g) => g.y + g.R))
      const [w, h] = [x1 - x0, y1 - y0]
      if (w > plane.W - 8 || h > plane.H - 8) continue
      const uc = clamp(want ? want[0] : between(plane.u0, plane.u1), plane.u0 + w / 2 + 4, plane.u1 - w / 2 - 4)
      const vc = clamp(want ? want[1] : between(plane.v0, plane.v1), plane.v0 + h / 2 + 4, plane.v1 - h / 2 - 4)
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2
      const centre = at(plane, uc, vc)
      if (isCold(centre[0], centre[1], centre[2], (w + h) / 4) || trains.some((t) => Math.hypot(t.c[0] - centre[0], t.c[1] - centre[1], t.c[2] - centre[2]) < 80)) continue
      const discs = gears.map((g) => ({ g, c: at(plane, uc + g.x - cx, vc + g.y - cy), front: between(10, 40) }))
      // No leg through any swept disc (3 m to spare).
      const n = plane.n
      const clearOfLegs = discs.every(({ g, c }) => samples.every((p) => {
        const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]
        const axial = d[0] * n[0] + d[2] * n[2]
        const radial = Math.sqrt(Math.max(0, d[0] * d[0] + d[1] * d[1] + d[2] * d[2] - axial * axial))
        return Math.hypot(Math.max(0, Math.abs(axial) - thick / 2), Math.max(0, radial - g.R)) >= 3
      }))
      if (!clearOfLegs) continue
      // Each shaft is cut short where it would meet a leg or a solid (down to a 6 m stub).
      for (const d of discs) {
        const axleR = d.g.teeth * m * 0.035
        for (; d.front > 6; d.front -= 4) {
          const end = [d.c[0] + n[0] * (thick / 2 + d.front), d.c[1], d.c[2] + n[2] * (thick / 2 + d.front)]
          if (offAxle([d.c, end], axleR) && ![0.3, 0.6, 1].some((k) => solidAt(along(d.c, end, k), axleR + 0.5))) break
        }
        d.front = Math.max(6, d.front)
      }
      const id = kit.trainId()
      const yaw = Math.atan2(n[0], n[2])
      discs.forEach(({ g, c, front }, i) => {
        kit.prop({
          id: `steam-cog-${id}-${i}`,
          kind: 'cog',
          x: r2(c[0]), y: r2(c[1]), z: r2(c[2]),
          yaw: round(yaw, 1e4),
          scale: r2(s),
          teeth: g.teeth,
          turn: round(g.rest, 1e4),
          thick: r2(thick),
          axle: [r2(8 + thick), r2(thick / 2 + front)],
          look: i % 2 ? 'rust' : 'brass',
          animation: { mode: 'manual', rpm: round(g.rpm, 1e3) },
        }, g.rpm !== 0)
      })
      const R = Math.hypot(w, h) / 2
      trains.push({ c: centre, n, R, plane, seized, gears: gears.length })
      if (!seized && rng() < 0.5) kit.vent(centre[0] + n[0] * 2, centre[1] - h / 2 + 1, centre[2] + n[2] * 2, 5, 220)
      return trains.at(-1)
    }
    return null
  }

  // --- One train in clear view of every stop but the cold one. ---
  const visibleFrom = (stop) => {
    let best = null
    for (const t of trains) {
      const d = viewed(stop, t.c, t.n)
      if (d !== null && (!best || d < best.d)) best = { d, t }
    }
    return best
  }
  const shuffled = planes.map((p) => [rng(), p]).sort((a, b) => a[0] - b[0]).map(([, p]) => p)
  for (const stop of stops) {
    if (isCold(stop.x, stop.y, stop.z, 0) || visibleFrom(stop)) continue
    // Гаврилов, near the cold hall: a seized train, on the side away from it.
    const standing = stop.name.startsWith('Гаврилов')
    const hall = stops.find((o) => o.name.startsWith('Табачная'))
    const away = (c) => !standing || !hall || Math.hypot(c[0] - hall.x, c[2] - hall.z) > Math.hypot(stop.x - hall.x, stop.z - hall.z)
    const candidates = []
    for (const plane of shuffled) {
      if (plane.W < 50 || plane.H < 42) continue
      let tried = 0
      for (let k = 0; k < 14 && tried < 4; k++) {
        const u = between(plane.u0 + 30, plane.u1 - 30)
        // Level with the stop (-50..+120 m round it): a player looks ahead, not up.
        const lo = Math.max(plane.v0 + 25, stop.y - 50)
        const hi = Math.min(plane.v1 - 25, stop.y + 120)
        if (lo > hi) continue
        const v = between(lo, hi)
        const c = at(plane, u, v)
        const d = Math.hypot(c[0] - stop.x, c[1] - stop.y, c[2] - stop.z)
        const pitch = (Math.atan2(c[1] - stop.y - 2, Math.hypot(c[0] - stop.x, c[2] - stop.z)) * 180) / Math.PI
        if (d < SEE.near + 20 || d > SEE.far - 20 || pitch < -25 || pitch > 30 || isCold(c[0], c[1], c[2], 60) || !away(c)) continue
        tried++
        if (viewed(stop, c, plane.n) !== null) candidates.push({ plane, u, v, d })
      }
      if (candidates.length >= 30) break
    }
    candidates.sort((a, b) => Math.abs(a.d - 250) - Math.abs(b.d - 250))
    for (const cand of candidates) {
      const t = trainOn(cand.plane, [cand.u, cand.v], standing ? { seized: true } : {})
      if (t && visibleFrom(stop)) break
    }
  }
  // --- Чайка, on a roof with no wall in view: a freestanding pylon from the mist, a turning train on its face. ---
  const roof = stops.find((o) => o.name.startsWith('Чайка'))
  if (roof) { // always: it stands where the first legs look, whatever a wall may show from the roof
    const way = ctx.order.ways.find((w) => Math.hypot(w.points[0].x - roof.x, w.points[0].z - roof.z) < 30)
    const heading = [0, 1, 2].map((k) => way?.points[Math.min(3 + k * 0, way.points.length - 1)]).filter(Boolean)[0]
    let dir = heading ? [heading.x - roof.x, heading.z - roof.z] : [0, 1]
    const len = Math.hypot(...dir) || 1
    dir = [dir[0] / len, dir[1] / len]
    const W = 150
    outer: for (const dist of [300, 340, 270, 380, 320, 250]) {
      for (const [lateral, rise] of [[-70, 110], [-140, 110], [70, 110], [-100, 200], [100, 200], [-200, 150], [200, 150], [-160, 260], [160, 260], [0, 300]]) {
        const C = [roof.x + dir[0] * dist - dir[1] * lateral, roof.z + dir[1] * dist + dir[0] * lateral]
        const useZ = Math.abs(dir[1]) >= Math.abs(dir[0])
        const sign = useZ ? Math.sign(dir[1]) || 1 : Math.sign(dir[0]) || 1
        const n = useZ ? [0, 0, -sign] : [-sign, 0, 0]
        const ux = [n[2], 0, -n[0]]
        const top = roof.y + rise
        const box = useZ
          ? { x0: C[0] - W / 2, x1: C[0] + W / 2, z0: Math.min(C[1], C[1] + sign * 24), z1: Math.max(C[1], C[1] + sign * 24) }
          : { z0: C[1] - W / 2, z1: C[1] + W / 2, x0: Math.min(C[0], C[0] + sign * 24), x1: Math.max(C[0], C[0] + sign * 24) }
        const uOf = (x, z) => x * ux[0] + z * ux[2]
        const us = [uOf(box.x0, box.z0), uOf(box.x1, box.z1)]
        const plane = { n, d: n[0] * C[0] + n[2] * C[1], ux, u0: Math.min(...us), u1: Math.max(...us), v0: top - 150, v1: top, W, H: 150 }
        const slab = { ...box, y0: -640, y1: r2(top), look: 'concrete' }
        const near = ([px, py, pz]) => Math.hypot(Math.max(slab.x0 - px, 0, px - slab.x1), Math.max(slab.y0 - py, 0, py - slab.y1), Math.max(slab.z0 - pz, 0, pz - slab.z1))
        const why = samples.some((p) => near(p) < 6) ? 'legs' : !ctx.clearOf('boxes', slab) ? 'zone' : isCold(C[0], top, C[1], 100) ? 'cold' : null
        if (process.env.STEAM_DEBUG) console.log('tower', dist, lateral, JSON.stringify(dir), why)
        if (why) continue
        const centre = at(plane, (plane.u0 + plane.u1) / 2, top - 75)
        // The first 64 m of the view are the roof's own run.
        if (viewed(roof, centre, n, 8) === null) { if (process.env.STEAM_DEBUG) console.log('tower unseen'); continue }
        const t = trainOn(plane, [(plane.u0 + plane.u1) / 2, top - 75], { min: 80, seized: false })
        if (!t) { if (process.env.STEAM_DEBUG) console.log('tower train refused'); continue }
        kit.box(slab)
        break outer
      }
    }
  }
  // --- And more, anywhere a route passes within reach of a wall, until there are enough. ---
  // A route sample within reach of the face's middle: the trains are set level with the route (-50..+120 m).
  const routeNear = (c) => {
    let best = null
    for (let i = 0; i < samples.length; i += 4) {
      const p = samples[i]
      const d = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])
      if (d < 260 && (!best || d < best.d)) best = { d, y: p[1] }
    }
    return best
  }
  for (const plane of shuffled) {
    if (trains.length >= wanted) break
    if (plane.W < 50 || plane.H < 50) continue
    const near = routeNear(at(plane, (plane.u0 + plane.u1) / 2, (plane.v0 + plane.v1) / 2))
    if (!near) continue
    const lo = Math.max(plane.v0 + 30, near.y - 50)
    const hi = Math.min(plane.v1 - 30, near.y + 120)
    if (lo > hi) continue
    trainOn(plane, [between(plane.u0, plane.u1), between(lo, hi)])
  }

  // --- Mains along some faces, 10-14 m across, level, above or below the trains. ---
  const withTrains = trains.map((t) => t.plane)
  const hosts = [...new Set([...withTrains, ...shuffled.filter((p) => p.W >= 80 && p.H >= 40)])]
  for (const plane of hosts) {
    if (mains.length >= 10) break
    for (let attempt = 0; attempt < 6; attempt++) {
      const r = between(5, 7)
      const len = Math.min(between(60, 160), plane.W - 10)
      if (len < 60 || plane.H < 2 * r + 12) break
      const uc = between(plane.u0 + len / 2 + 5, plane.u1 - len / 2 - 5)
      const vc = between(plane.v0 + r + 5, plane.v1 - r - 5)
      const mid = at(plane, uc, vc)
      const off = r + 0.3
      const a = [mid[0] + plane.n[0] * off - plane.ux[0] * len / 2, vc, mid[2] + plane.n[2] * off - plane.ux[2] * len / 2]
      const b = [mid[0] + plane.n[0] * off + plane.ux[0] * len / 2, vc, mid[2] + plane.n[2] * off + plane.ux[2] * len / 2]
      if (isCold(mid[0], vc, mid[2], len / 2) || !offMain([a, b], r)) continue
      if (trains.some((t) => t.plane === plane && Math.abs(t.c[1] - vc) < t.R + r + 4 && Math.abs((t.c[0] - mid[0]) * plane.ux[0] + (t.c[2] - mid[2]) * plane.ux[2]) < t.R + len / 2)) continue
      if ([0, 0.25, 0.5, 0.75, 1].some((k) => solidAt(along(a, b, k), r - 0.5))) continue
      const stood = kit.form({ kind: 'sweep', at: { x: r2(a[0]), y: r2(a[1]), z: r2(a[2]) }, look: pick(['rust', 'rust', 'cast']), smooth: true, section: ring(r, r * 0.2, 14), path: [{ x: 0, y: 0, z: 0 }, { x: r2(b[0] - a[0]), y: 0, z: r2(b[2] - a[2]) }], role: 'service' })
      const collars = Math.max(2, Math.min(14, Math.floor(len / 12)))
      for (let i = 0; i <= collars; i++) {
        const p = along(a, b, i / collars)
        kit.collarAt({ x: p[0], y: p[1], z: p[2] }, { x: plane.ux[0], z: plane.ux[2] }, r, 0, i % 2 === 1, stood)
      }
      mains.push({ c: mid, r, len })
      break
    }
  }

  // The two nearest trains in clear view of each stop, for the eyes: where to stand, the way to look.
  const visible = stops.flatMap((stop) => {
    if (isCold(stop.x, stop.y, stop.z, 0)) return [{ stop: stop.name, cold: true }]
    const seen = trains.map((t) => ({ t, d: viewed(stop, t.c, t.n) })).filter((v) => v.d !== null).sort((x, y) => x.d - y.d).slice(0, 2)
    if (!seen.length) return [{ stop: stop.name, train: null }]
    return seen.map(({ t, d }) => {
      const [dx, dy, dz] = [t.c[0] - stop.x, t.c[1] - stop.y - 2, t.c[2] - stop.z]
      return { stop: stop.name, from: [stop.x, stop.y, stop.z].map(Math.round), metres: Math.round(d), at: t.c.map(Math.round), yaw: Math.round((Math.atan2(dx, dz) * 180) / Math.PI), pitch: Math.round((Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI), across: Math.round(2 * t.R), seized: t.seized }
    })
  })
  return { trains: trains.length, mains: mains.length, visible }
}
