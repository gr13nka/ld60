// The ways layer of the generator (scripts/builders/grow.mjs has the contract): every leg of the
// order made as `ways.mjs`' `legMade` asks it, out of one kind of thing: a pad at every route point,
// a slab between pads for a run, a wall beside a wall run (two, a canyon, over 41 m), a face of ledges
// for a climb, and nothing at all across a jump, glide or drop, which is the structure's void. Every
// pad, slab and wall is carried down into the mist by a pier as wide as itself (6 m at least): the
// megastructure's first layer, which the next layers grow on.
//
// Nothing solid meets a clear zone (`ctx.clearOf`): a piece that does is shrunk until it does not,
// and a pad that cannot be made 4 m long that way is told in `ctx.notes`.
//
// Also edits the copy, as the contract allows: the palace set to meet the Tabachnaya, the mist and
// the abyss, one start a stop, and a par line a way.
import { prism } from '../../../src/forms.js'
import { nextCutId, nextFormId } from '../../../src/place-file.js'
import { floorHit, floorsUnder, inSolid, MIST, nameEverything, positionsOf, round } from '../world.mjs'
import { meetsMesh } from '../zones.mjs'
import { slab } from '../pieces.mjs'
import { fairReach } from '../routes.mjs'

const GAP = new Set(['jump', 'glide', 'drop'])
const DEEP = MIST - 20 // where a pier ends: inside the mist
const THICK = 1.6 // a pad's depth
const SLAB = 2.5 // a run slab's depth
const LEDGE_EVERY = 2.7 // under the 2.8 m a mantle pulls up to
const CANYON = 41 // metres of wall a runner holds at 20 m/s
const LOOK = { deck: 'planDeck', pier: 'planPier', wall: 'board', ledge: 'planDeck' }

const unit = (a, b) => {
  const d = Math.hypot(b.x - a.x, b.z - a.z) || 1
  return { x: (b.x - a.x) / d, z: (b.z - a.z) / d }
}
const plan = (a, b) => Math.hypot(b.x - a.x, b.z - a.z)

// The corners of a rectangle about (x, z): `bk` behind it along u, `fw` ahead, `hw` either side.
function corners(x, z, u, bk, fw, hw) {
  const v = { x: u.z, z: -u.x }
  return [[-bk, -hw], [fw, -hw], [fw, hw], [-bk, hw]].map(([s, t]) => [round(x + u.x * s + v.x * t), round(z + u.z * s + v.z * t)])
}

export function growWays(ctx) {
  const { order, place } = ctx
  // The balcony's boxes and props have no keys until named: a removal is asked for by key.
  nameEverything(place)
  ctx.stand()
  const forms = []
  const pads = []
  const vols = [] // head room to be cleared of old things: pads, turn pads, slabs
  const ys = new Map() // `${way}.${point}` → the height its pad was set at (a metre under the route's where a jump is just fair)
  const outs = new Map() // `${way}.${glide n}` → the waypoints that carry a glide's landing on to the run after it
  const walls = new Map() // `${way}.${leg n}` → the side (+1 his left, -1 right) its wall stands on
  const towers = new Map() // `${way}.${climb n}` → how far from the climb's start its face stands (the high pad's pier is the tower)
  const turns = new Map() // `${way}.${leg n}` → where a run turns to face its take-off
  const notes = { thin: [], blocked: [], ungrounded: [], hubs: 0 }
  const clear = (form) => ctx.clearOf('forms', form)
  // A pad or slab may stand under a flight's air (its top is the take-off's level, and the flight is above it) and in a run's head room (set on an old floor it may stand above the route's line), but not in a gap.
  const padZones = ctx.zones.filter((z) => z.clear && !/^the (air|head room) of /.test(z.name)).map((z) => z.clear)
  const clearPad = (form) => {
    const pos = positionsOf('forms', form)
    return !padZones.some((c) => meetsMesh(c, pos))
  }
  const put = (form, role) => {
    delete form.id
    forms.push({ ...form, role })
  }

  // A pier under a rectangle: grown to 6 m a side, then shrunk to clear the zones. `flush` keeps its
  // back face where the pad's is (a climb's face is found at that plane, not a hand inside it).
  function pierUnder(x, z, u, bk, fw, hw, top, tag, flush = false) {
    for (const k of flush ? [1] : [1, 0.8, 0.6, 0.45, 0.3]) {
      const back = flush ? bk : Math.max(k < 0.4 ? 0.8 : 1.5, (bk - 0.6) * k)
      const front = Math.max(flush ? 0 : k < 0.4 ? 0.8 : 1.5, (fw - 0.6) * k, k < 0.4 ? 0 : 6 - back)
      const wide = Math.max(k < 0.4 ? 1.5 : 3, (hw - 0.6) * k)
      const form = prism(corners(x, z, u, back, front, wide), DEEP, top, LOOK.pier)
      if (clearPad(form)) return void put(form, flush ? 'tower' : 'support') // a climb's tower is the face itself: blame may not take it over
    }
    const pos = positionsOf('forms', prism(corners(x, z, u, bk, fw, hw), DEEP, top, LOOK.pier))
    notes.blocked.push(`pier of ${tag} (by ${ctx.zones.filter((q) => q.clear && meetsMesh(q.clear, pos)).map((q) => q.name).slice(0, 3).join(', ')})`)
  }

  // A pad: as long as is wanted behind (`bk`) and ahead (`fw`) of the point, shrunk till it meets no zone.
  function pad(x, y, z, u, want, tag, floor = 4) {
    let { bk, fw, hw } = want
    const volume = () => vols.push({ tag, a: { x: x - u.x * bk, y, z: z - u.z * bk }, b: { x: x + u.x * fw, y, z: z + u.z * fw }, hw })
    for (let k = 0; k < 60; k++) {
      const form = prism(corners(x, z, u, bk, fw, hw), y - THICK, y, LOOK.deck)
      if (clearPad(form)) return finish(form, true)
      if (bk >= fw && bk > want.minBk) bk = Math.max(want.minBk, bk - 0.75)
      else if (fw > want.minFw) fw = Math.max(want.minFw, fw - 0.75)
      else if (bk > want.minBk) bk = Math.max(want.minBk, bk - 0.75)
      else if (hw > 3.5) hw -= 0.5
      else break
    }
    return finish(prism(corners(x, z, u, bk, fw, hw), y - THICK, y, LOOK.deck), false)
    function finish(form, ok) {
      if (!ok) notes.blocked.push(`pad ${tag}`)
      if (bk + fw < floor) notes.thin.push(`${tag} ${(bk + fw).toFixed(1)} m`)
      put(form, 'way')
      volume()
      pierUnder(x, z, u, bk, fw, hw, y - THICK + 0.3, tag, want.flush)
      return { bk, fw, hw }
    }
  }

  // A sloped or level slab a → b, narrowed till it meets no zone, with a pier every 28 m.
  function span(a, b, w, tag) {
    for (const width of [w, w * 0.75, 5]) {
      const form = slab(a, b, width, SLAB, LOOK.deck, 'flat')
      if (!clearPad(form)) continue
      put(form, 'way')
      vols.push({ tag: `${tag} slab`, a, b, hw: width / 2 })
      const u = unit(a, b)
      const L = plan(a, b)
      const n = Math.max(1, Math.ceil(L / 28))
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n
        const y = a.y + (b.y - a.y) * t
        pierUnder(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, u, 4, 4, width / 2, y - SLAB + 0.3, `${tag} slab ${k}`)
      }
      return true
    }
    {
      const pos = positionsOf('forms', slab(a, b, w, SLAB, LOOK.deck, 'flat'))
      notes.blocked.push(`slab ${tag} (by ${padZones.filter((c) => meetsMesh(c, pos)).length} zones; a ${JSON.stringify([a, b].map((q) => [q.x, q.y, q.z].map(Math.round)))})`)
    }
    return false
  }

  // Stops: one hub pad each, 14 m square, shrunk to fit.
  const hubs = new Map()
  for (const stop of order.stops) {
    const way = order.ways.find((w) => w.from === stop.id) ?? order.ways.find((w) => w.to === stop.id)
    if (!way) continue
    const atStart = way.from === stop.id
    const leg = atStart ? way.legs[0] : way.legs[way.legs.length - 1]
    const u = atStart ? unit(leg.a, leg.b) : unit(leg.a, leg.b)
    const used = pad(stop.x, stop.y, stop.z, u, { bk: 7, fw: 7, hw: 7, minBk: 2, minFw: 2 }, `hub ${stop.id}`, 6)
    hubs.set(stop.id, { x: round(stop.x + (u.x * (used.fw - used.bk)) / 2), y: stop.y, z: round(stop.z + (u.z * (used.fw - used.bk)) / 2), l: used.bk + used.fw, w: used.hw * 2, u })
    notes.hubs++
  }

  for (const way of order.ways) {
    const last = way.points.length - 1
    way.points.forEach((p, i) => {
      const tag = `${way.id}.${i}`
      const hub = i === 0 ? hubs.get(way.from) : i === last ? hubs.get(way.to) : null
      const yawOf = (u) => Math.atan2(u.x, u.z)
      if (hub) {
        pads.push({ way: way.id, n: i, x: hub.x, y: hub.y, z: hub.z, w: hub.w, l: hub.l, yaw: yawOf(hub.u), move: way.legs[Math.min(i, last - 1)].move })
        return
      }
      const inLeg = way.legs[i - 1]
      const outLeg = way.legs[i]
      const inGap = inLeg && GAP.has(inLeg.move)
      const outGap = outLeg && (GAP.has(outLeg.move) || outLeg.move === 'climb' || outLeg.move === 'wallrun') // a wall run falls away from the pad's edge
      const inClimb = inLeg?.move === 'climb'
      const fast = Math.max(inLeg?.length ?? 0, outLeg?.length ?? 0)
      const len = fast > 150 ? 12 : fast > 60 ? 10 : 8
      const hw = Math.max(len / 2, 5.5) // a runner lands up to 3 m off his line: pads 11 to 12 m across
      const din = inLeg ? unit(inLeg.a, inLeg.b) : null
      const dout = outLeg ? unit(outLeg.a, outLeg.b) : null
      let u = dout ?? din
      let want = { bk: len / 2, fw: len / 2, hw, minBk: 0.3, minFw: 0.3 }
      if (outGap) {
        // Ahead of a take-off the air is sampled from 3 m out, 2 m over the line: a pad must end under it where the line falls.
        const fall = Math.max(0, (outLeg.a.y - outLeg.b.y) / plan(outLeg.a, outLeg.b))
        const reach = fall > 0.05 ? Math.min(len / 2, Math.max(0.3, fall > 0.45 ? 2.4 : 1.4 / fall)) : len / 2
        want = { ...want, bk: inGap ? len * 0.6 : len, fw: inGap ? Math.min(reach, 2.4) : 0.3 }
      }
      else if ((inGap || inClimb) && din) {
        u = din
        // A landing is not met to the metre (a glide lands short as often as long): the pad reaches back under the approach.
        // A glide comes in at 40 m/s: a runout of 36 m (12 m for a jump) before the pad is turned from.
        const out = inLeg.move === 'glide' ? 36 : inLeg.move === 'jump' && inLeg.suit ? 24 : len
        want = { ...want, bk: inGap ? Math.min(len, Math.max(0.3, 0.2 * plan(inLeg.a, inLeg.b))) : 0.3, fw: Math.max(len, out), minFw: Math.min(out, 14), hw: inLeg.move === 'glide' ? 14 : want.hw }
      }
      if (inClimb && !inGap) {
        // The tower is the high pad's pier: its face 16 m short of the pad's far edge, or less where a flight's air or a gap crosses it.
        const Lc = plan(inLeg.a, inLeg.b)
        let hwT = Math.max(hw, 4.5)
        let F = null
        for (const wide of [hwT, 3.5, 3]) {
          for (const keep of [16, 11, 8, 6, 4]) {
            const f = Math.min(0.95, Math.max(0.2, Math.ceil((1 - keep / Lc) * 20) / 20)) * Lc + 0.1
            if (Lc - f < 3) continue
            if (clear(prism(corners(p.x, p.z, din, Lc - f, 0.3, wide - 0.6), DEEP, p.y - THICK + 0.3, LOOK.pier))) {
              F = f
              hwT = wide
              break
            }
          }
          if (F !== null) break
        }
        F ??= Math.min(0.95, Math.max(0.2, Math.ceil((1 - 16 / Lc) * 20) / 20)) * Lc + 0.1
        towers.set(`${way.id}.${i}`, F)
        const tower = Lc - F
        u = din
        want = { ...want, bk: tower, fw: outGap ? 0.3 : len, hw: hwT, minBk: tower, minFw: 2, flush: true }
      }
      // A run is found from the 2 m cell the point is in: a pad under a run's start reaches 1.6 m every way.
      const onRun = outLeg?.move === 'run' || (outLeg?.move === 'climb' && Math.abs(outLeg.b.y - outLeg.a.y) / plan(outLeg.a, outLeg.b) <= 0.42)
      if (onRun) want = { ...want, bk: Math.max(want.bk, 1.6), fw: Math.max(want.fw, 1.6), minBk: Math.max(want.minBk, 1.6), minFw: Math.max(want.minFw, 1.6) }
      // A jump just inside the fair reach is judged by the floors found: land a metre lower (or leave from one) and it is a fair one,
      // where the point is not also another jump's end.
      const tightIn = inLeg?.move === 'jump' && !inLeg.suit && fairReach(-inLeg.rise) - plan(inLeg.a, inLeg.b) < 0.5 && !(outLeg && GAP.has(outLeg.move))
      const tightOut = outLeg?.move === 'jump' && !outLeg.suit && fairReach(-outLeg.rise) - plan(outLeg.a, outLeg.b) < 0.5 && !(inLeg && GAP.has(inLeg.move))
      // Where an old floor of the balcony stands within 4 m over the point, the pad is set on it (the runner would land on it anyway,
      // and a pad sunk into it is a pit): its height, not the route's.
      const oldTop = floorsUnder(ctx.site, p.x, p.z, p.y + 4, 4.5, 1.5).filter((f) => f.y > p.y + 0.3 && f.y <= p.y + 4).at(-1)
      const y = oldTop ? oldTop.y : p.y - (tightIn || tightOut ? 1 : 0)
      ys.set(tag, y)
      const used = pad(p.x, y, p.z, u, want, tag)
      pads.push({ way: way.id, n: i, x: round(p.x + u.x * (used.fw - used.bk) / 2), y, z: round(p.z + u.z * (used.fw - used.bk) / 2), w: used.hw * 2, l: used.bk + used.fw, yaw: yawOf(u), move: (outLeg ?? inLeg).move })
    })

    for (const leg of way.legs) {
      const { move } = leg
      const a = { ...leg.a, y: ys.get(`${way.id}.${leg.n - 1}`) ?? leg.a.y }
      const b = { ...leg.b, y: ys.get(`${way.id}.${leg.n}`) ?? leg.b.y }
      const tag = `${way.id}.${leg.n}`
      const L = plan(a, b)
      const u = unit(a, b)
      const w = L > 150 ? 12 : 10
      const ramp = Math.abs(b.y - a.y) / L <= 0.42
      const next = way.legs[leg.n]
      let end = b
      let start = a
      const prev = way.legs[leg.n - 2]
      if (move === 'run' && prev?.move === 'glide') {
        // Landed at 40 m/s, a runner overshoots a turn by a pad's width: the run begins 18 m on and aside, where he can be.
        const din = unit(prev.a, prev.b)
        const dn = unit(a, b)
        const R = { x: a.x + din.x * 18, y: a.y, z: a.z + din.z * 18 }
        const S = din.x * dn.x + din.z * dn.z < 0.9 ? { x: R.x + dn.x * 15, y: a.y, z: R.z + dn.z * 15 } : R
        if (plan(S, b) > 8 && plan(a, b) >= 30) {
          start = S
          outs.set(`${way.id}.${prev.n}`, { R, S })
        }
      }
      if (move === 'run' && next && ['jump', 'glide', 'wallrun', 'drop'].includes(next.move)) {
        // A run is turned on the ground, not in the air (20 m/s turns in 9 m): a square pad 18 m before the take-off, with a level run-in, on its axis.
        const d = unit(next.a, next.b)
        if (u.x * d.x + u.z * d.z < 0.82) {
          // as far back as the old world lets it (a hand-made box may stand there): 18 m, then less
          const open = (D) => {
            for (let s = 0; s <= D + 8; s += 2) for (const t of [-6, 0, 6]) {
              const x = b.x - d.x * s + d.z * t
              const z = b.z - d.z * s - d.x * t
              if (inSolid(ctx.site, x, b.y + 1.2, z) || inSolid(ctx.site, x, b.y + 2.8, z)) return false
            }
            return true
          }
          // (the old world in the way is cleared by `airCuts` after: a block taken out, a mass cut)
          void open
          const D = 18
          if (D) {
            end = { x: b.x - d.x * D, y: b.y, z: b.z - d.z * D }
            pad(end.x, end.y, end.z, d, { bk: 8, fw: 8, hw: 8, minBk: 2, minFw: 2 }, `turn ${tag}`, 6)
            span(end, b, 16, `${tag} run-in`) // 16 wide: a runner swings 6 m wide of the line turning
            turns.set(tag, end)
          } else notes.blocked.push(`turn ${tag}`)
        }
      }
      if (move === 'run' && end === b) {
        // Ending on a take-off pad that reaches back: the slab meets the pad's rear edge, so that no step of its slope shows.
        const q = pads.find((r) => r.way === way.id && r.n === leg.n)
        if (q && next && GAP.has(next.move)) {
          const qu = { x: Math.sin(q.yaw), z: Math.cos(q.yaw) }
          const rear = { x: q.x - qu.x * (q.l / 2) + qu.x * 0.3, z: q.z - qu.z * (q.l / 2) + qu.z * 0.3 }
          if (q.l >= 5 && Math.hypot(rear.x - a.x, rear.z - a.z) > 4 && (rear.x - a.x) * u.x + (rear.z - a.z) * u.z > 0) end = { ...rear, y: b.y }
        }
      }
      if (move === 'run' || (move === 'climb' && (b.y - a.y <= 4 || ramp))) span(start, end, w, tag)
      else if (move === 'climb') {
        // The face is the high pad's pier, 16 m from its far edge; a level slab brings the runner to it.
        // `legMade` looks for the face only at a twentieth of the leg, within a hand of it: stand it on one.
        if (leg.n === way.legs.length && hubs.has(way.to)) {
          // The climb ends on a stop's hub: no pad of its own to make a tower of, so the tower is made here, from its face to the hub.
          let F = null
          let wide = 4.5
          for (const hwT of [4.5, 3.5, 3]) {
            for (const keep of [16, 11, 8, 6, 4]) {
              const f = Math.min(0.95, Math.max(0.2, Math.ceil((1 - keep / L) * 20) / 20)) * L + 0.1
              if (L - f < 9) continue
              if (clear(prism(corners(b.x, b.z, u, L - f, 7, hwT - 0.6), DEEP, b.y - THICK + 0.3, LOOK.pier))) {
                F = f
                wide = hwT
                break
              }
            }
            if (F !== null) break
          }
          F ??= Math.min(0.95, Math.max(0.2, Math.ceil((1 - 16 / L) * 20) / 20)) * L + 0.1
          towers.set(tag, F)
          // the deck over it, from the face to the hub's near edge (the hub's own is not doubled), and the tower under both
          const gapLen = L - F - 7
          if (gapLen > 0.5) pad(b.x - u.x * 7, b.y, b.z - u.z * 7, u, { bk: gapLen, fw: 0.2, hw: wide, minBk: gapLen, minFw: 0.2, flush: true }, `${tag} top`, 0)
          pierUnder(b.x, b.z, u, L - F, 7, wide, b.y - THICK + 0.3, `${tag} tower`, true)
        }
        const face = towers.get(tag) ?? Math.min(0.95, Math.max(0.2, Math.ceil((1 - 16 / L) * 20) / 20)) * L + 0.1
        if (face > 1) span(a, { x: a.x + u.x * face, y: a.y, z: a.z + u.z * face }, w, `${tag} approach`)
        const left = { x: u.z, z: -u.x }
        for (let k = 1, y = a.y + LEDGE_EVERY; y < b.y - 1.5; k++, y += LEDGE_EVERY) {
          const side = k % 2 ? 1 : -1
          const cx = a.x + u.x * face + left.x * side * 2.2
          const cz = a.z + u.z * face + left.z * side * 2.2
          const ledge = prism(corners(cx, cz, u, 2.2, 3, 1.8), y - 1, y, LOOK.ledge)
          if (clear(ledge)) put(ledge, 'way')
        }
      } else if (move === 'wallrun') {
        const left = { x: u.z, z: -u.x }
        const top = Math.max(a.y, b.y) + 6
        const wall = (side, near, deep, bottom) => {
          const c = near + deep / 2
          const form = prism(corners(a.x + left.x * side * c + u.x * (L / 2), a.z + left.z * side * c + u.z * (L / 2), u, L / 2 + 2, L / 2 + 2, deep / 2), bottom, top, LOOK.wall)
          return clear(form) ? form : null
        }
        let main = null
        for (const side of [1, -1]) {
          for (const bottom of [DEEP, Math.min(a.y, b.y) - 8]) {
            main = wall(side, 2.3, 6, bottom)
            if (main) {
              walls.set(tag, side)
              if (bottom !== DEEP) notes.ungrounded.push(`wall ${tag}`)
              if (L > CANYON) {
                const facing = wall(-side, 15.8, 5, bottom)
                if (facing) put(facing, 'way')
                else notes.blocked.push(`canyon wall ${tag}`)
              }
              break
            }
          }
          if (main) break
        }
        if (main) put(main, 'way')
        else notes.blocked.push(`wall ${tag}`)
      }
    }
  }

  let id = nextFormId(place)
  for (const form of forms) form.id = id++

  const { cuts, remove } = airCuts(ctx, order, notes, vols, towers)
  mend(ctx, order, pads, notes, turns, ys, outs, walls, towers)
  ctx.notes = notes
  if (process.env.WAYS_DEBUG) console.error('blocked', notes.blocked.filter((b) => b.includes(process.env.WAYS_DEBUG)).join(' | '))
  if (process.env.WAYS_DEBUG) for (const q of pads.filter((r) => r.way === process.env.WAYS_DEBUG)) console.error('pad', q.n, q.x.toFixed(1), q.y.toFixed(1), q.z.toFixed(1), 'l', q.l.toFixed(1), 'w', q.w.toFixed(1), 'yaw', (q.yaw * 57.3).toFixed(0), q.move)
  console.error(`ways: ${forms.length} forms, ${pads.length} pads; thin ${notes.thin.length}, blocked ${notes.blocked.length}, ungrounded ${notes.ungrounded.length}`)
  return { add: { forms, cuts }, pads, remove }
}

// The balcony's old masses stand in some of the legs' air, head room and climbs. Where a sample of the leg's
// space is in an old form, a corridor 11 m wide is cut through that form (`of` names it, so that nothing of ours
// is cut), in chunks of 30 m; a box or an asset cannot be cut, and is told. A jump, glide or drop is sampled 2 m over
// its line, a run 1.2 and 2.8 m over it; a climb's face is sampled up its height, and cut from there.
function airCuts(ctx, order, notes, vols, towers) {
  const cuts = []
  const rm = new Map() // key → why: old boxes, assets and props that cannot be cut, taken out
  let id = nextCutId(ctx.place)
  const carve = (tag, a, b, lows, top, hw, pre = 0) => {
    const L = plan(a, b)
    const u = unit(a, b)
    const chunks = Math.max(1, Math.ceil(L / 30))
    for (let k = 0; k < chunks; k++) {
      const t0 = k / chunks
      const t1 = (k + 1) / chunks
      const of = new Set()
      for (let s = Math.max(pre, t0 * L); s <= Math.min(L - pre, t1 * L) + 1e-6; s += 1) {
        const t = s / L
        for (const up of lows) {
          for (const side of [0, -hw * 0.7, hw * 0.7]) {
            const p = { x: a.x + (b.x - a.x) * t + u.z * side, y: a.y + (b.y - a.y) * t + up, z: a.z + (b.z - a.z) * t - u.x * side }
            if (!inSolid(ctx.site, p.x, p.y, p.z)) continue
            for (const r of ctx.recs) {
              const bb = r.bounds
              if (p.x < bb.min.x - 1 || p.x > bb.max.x + 1 || p.y < bb.min.y - 1 || p.y > bb.max.y + 1 || p.z < bb.min.z - 1 || p.z > bb.max.z + 1) continue
              if (r.list === 'forms') {
                // A small old form (a block, a stair) is taken out whole: cut through, it leaves a ragged wall in the way; a mass is cut.
                const vol = (bb.max.x - bb.min.x) * (bb.max.y - bb.min.y) * (bb.max.z - bb.min.z)
                if (vol < 40000) rm.set(r.key, `stands in ${tag}`)
                else of.add(r.record.id)
              }
              else if (r.keep) continue
              else if (!rm.has(r.key)) rm.set(r.key, `stands in ${tag}`)
            }
          }
        }
      }
      if (!of.size) continue
      const ya = a.y + (b.y - a.y) * t0
      const yb = a.y + (b.y - a.y) * t1
      const form = prism(corners(a.x + (b.x - a.x) * t0, a.z + (b.z - a.z) * t0, u, 0, (t1 - t0) * L, hw), Math.min(ya, yb) + top[0], Math.max(ya, yb) + top[1])
      const { kind, ...cut } = form
      void kind
      cuts.push({ ...cut, id: id++, of: [...of] })
    }
  }
  for (const way of order.ways) {
    for (const leg of way.legs) {
      const { a, b, move } = leg
      const tag = `${way.id}.${leg.n}`
      const ramp = Math.abs(b.y - a.y) / plan(a, b) <= 0.42
      if (GAP.has(move)) {
        carve(tag, a, b, [2], [-2, 9], 5.5, 1)
        // a jump is a gap: nothing floors it (the 'bridged' test looks 3 m under the line)
        if (move === 'jump') carve(`${tag} gap`, a, b, [-2.5, -1], [-3.5, 0.5], 3, 3)
      } else if (move === 'run' || (move === 'climb' && (b.y - a.y <= 4 || ramp))) carve(tag, a, b, [1.2, 2.8], [0.6, 5], 6, 0)
      else if (move === 'wallrun') {
        // the line and the way to the wall, and, in a canyon, the whole width of it
        carve(tag, a, b, [1, 2.2], [0.4, 4], 3.5, 0)
        if (plan(a, b) > CANYON) carve(`${tag} canyon`, a, b, [1.2, 2.5], [0.4, 4], 17, 0)
      } else if (move === 'climb') {
        // the face's corridor: 4 m of the approach to the face, its whole height
        const L = plan(a, b)
        const u = unit(a, b)
        const face = towers.get(tag) ?? Math.min(0.95, Math.max(0.2, Math.ceil((1 - 16 / L) * 20) / 20)) * L
        const from = { x: a.x + u.x * (face - 4), y: a.y, z: a.z + u.z * (face - 4) }
        const to = { x: a.x + u.x * face, y: a.y, z: a.z + u.z * face }
        for (let y = a.y + 2; y < b.y - 2; y += 24) {
          const hi = Math.min(b.y, y + 24)
          carve(`${tag} face`, { ...from, y }, { ...to, y }, [0, 4, 8, 12, 16, 20], [-0.5, hi - y + 1], 5.5, 0)
        }
      }
    }
  }
  // every pad, turn pad and slab: head room over it
  for (const v of vols) carve(v.tag, v.a, v.b, [0.6, 1.8, 3], [0.3, 4], v.hw, 0)
  notes.removed = [...rm.keys()]
  return { cuts, remove: [...rm].map(([key, why]) => ({ list: key.startsWith('f') ? 'forms' : key.startsWith('b') ? 'boxes' : key.startsWith('a:') ? 'assets' : 'props', key, why })) }
}

// The copy's own edits: the palace, the mist and abyss, a start a stop, a par line a way.
function mend(ctx, order, pads, notes, turns, ys, outs, walls, towers) {
  const { place } = ctx
  place.mists = ['buildersGorge']
  place.abyss = { lost: MIST - 60 }
  lowerPalace(ctx, order, notes)
  startsAndPar(ctx, order, pads, turns, ys, outs, walls, towers)
}

// The palace is lowered so that the floor under the Tabachnaya's stop (the terrace the last run ends on) is the stop's height.
function lowerPalace(ctx, order, notes) {
  const { place } = ctx
  const asset = place.assets.find((a) => a.tag === 'palace-1')
  if (!asset) return
  const stop = order.stops.find((s) => s.id === 'tabachnaya')
  const floor = floorsUnder(ctx.site, stop.x, stop.z, 600, 1400, 1.5).find((f) => f.key === 'a:palace-1')
  if (!floor) return
  notes.palace = { was: { ...asset.at }, floor: floor.y }
  asset.at = { ...asset.at, y: round(asset.at.y + stop.y - floor.y) }
  notes.palace.now = { ...asset.at }
}

function startsAndPar(ctx, order, pads, turns, ys, outs, walls, towers) {
  const { place } = ctx
  place.starts ??= {}
  // Starts left floating by the strip are taken away.
  for (const [name, s] of Object.entries(place.starts)) {
    const hit = floorHit(ctx.site, s.x, s.y + 0.6, s.z)
    if (!hit || s.y - hit.y > 1.5) delete place.starts[name]
  }
  for (const stop of order.stops) {
    const way = order.ways.find((w) => w.from === stop.id)
    const leg = way?.legs[0] ?? order.ways.find((w) => w.to === stop.id).legs.at(-1)
    place.starts[stop.id] = { x: round(stop.x, 100), y: round(stop.y, 100), z: round(stop.z, 100), yaw: round(Math.atan2(leg.b.x - leg.a.x, leg.b.z - leg.a.z), 1000), pitch: -0.04 }
  }
  place.par = (place.par ?? []).filter((q) => !q.way)
  for (const way of order.ways) place.par.push(...parLine(way, pads, turns, ys, outs, walls, towers))
}

// The points a pilot holds for a way (`scripts/moves/pilot.mjs`): a point at each take-off with what it does there.
function parLine(way, pads, turns, ys, outs, walls, towers) {
  const out = []
  const at = (p, rest) => out.push({ x: round(p.x), y: round(p.y), z: round(p.z), ...rest, line: way.id, way: way.id })
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t })
  // Flights in a row (a glide or a suit jump after one) are flown through, not landed between: over each pad by 4 m, the suit held.
  // Over a pad 4 m up, and 14 m on along the next flight, so that the dive down it clears the pad's pier.
  const overPad = (b, next) => {
    const d = unit(next.a, next.b)
    return { x: b.x + d.x * 14, y: b.y + 4, z: b.z + d.z * 14 }
  }
  const flight = (l) => l && (l.move === 'glide' || (l.move === 'jump' && l.suit))
  way.legs.forEach((leg, i) => {
    const { move } = leg
    const chainedIn = flight(way.legs[i - 1]) && flight(leg)
    const chainedOut = flight(leg) && flight(way.legs[i + 1])
    const a = { ...leg.a, y: ys.get(`${way.id}.${i}`) ?? leg.a.y }
    const b = { ...leg.b, y: ys.get(`${way.id}.${i + 1}`) ?? leg.b.y }
    const L = plan(a, b)
    if (i === 0) at(a, { do: 'run' })
    // Turns are made on the pad, not in the air: go to the pad's rear first, so that the take-off is run in straight.
    const pad = pads.find((q) => q.way === way.id && q.n === i)
    const turn = turns.get(`${way.id}.${i}`)
    if (chainedIn) {
      // flown through: nothing to turn or run up
    } else if (turn) {
      out.pop()
      at(turn, { do: 'run' })
      at(lerp(turn, a, 0.45), { do: 'run' }) // on the run-in's own line early, the turn being made on the pad
    } else if (pad && ['jump', 'glide', 'wallrun'].includes(move) && pad.l >= 5) {
      const u = { x: Math.sin(pad.yaw), z: Math.cos(pad.yaw) }
      const d = unit(a, b)
      if (u.x * d.x + u.z * d.z > 0.9) {
        const rear = { x: pad.x - u.x * (pad.l / 2 - 1.2), y: a.y, z: pad.z - u.z * (pad.l / 2 - 1.2) }
        if (i > 0) {
          out.pop() // the run's end is on the pad: head for its rear instead, and run through the point
          at(rear, { do: 'run' })
        }
      }
    }
    if (move === 'jump') {
      // A short gap is not flown at the run's 20 m/s: the pace that lands on the point, the middle of a short pad (a flight lasts T seconds).
      const D = a.y - b.y
      const T = (12.5 + Math.sqrt(Math.max(0, 156.25 + 56 * D))) / 28
      const pace = (L - 0.3) / T
      if (!chainedIn) at(a, { do: 'jump', near: 0.3, heading: round(Math.atan2(b.x - a.x, b.z - a.z), 1000), ...(!leg.suit && pace < 19 ? { pace: round(Math.max(pace, 5)) } : {}) })
      if (leg.suit) {
        if (!chainedIn) at(lerp(a, b, 0.3), { do: 'wing' })
        if (chainedOut) {
          at(overPad(b, way.legs[i + 1]), {})
          return
        }
        at(lerp(a, b, 0.92), { do: 'fold' })
        const d = unit(a, b)
        at({ x: b.x + d.x * 18, y: b.y, z: b.z + d.z * 18 }, { do: 'run' })
        return
      }
    } else if (move === 'glide') {
      if (!chainedIn) {
        at(a, { do: 'jump', heading: round(Math.atan2(b.x - a.x, b.z - a.z), 1000) })
        at(lerp(a, b, 0.1), { do: 'wing' })
      }
      if (chainedOut) {
        at(overPad(b, way.legs[i + 1]), {})
        return
      }
      at(lerp(a, b, 0.95), { do: 'fold' })
      const d = unit(a, b)
      const land = outs.get(`${way.id}.${leg.n}`)
      if (land) {
        at(land.R, { do: 'run' })
        if (land.S !== land.R) at(land.S, { do: 'run' })
      } else {
        // a runout of 18 m, or half the next leg where that is shorter (its take-off must not be run past)
        const nx = way.legs[i + 1]
        const r = nx ? Math.min(18, plan(nx.a, nx.b) * 0.4) : 18
        if (r >= 5) at({ x: b.x + d.x * r, y: b.y, z: b.z + d.z * r }, { do: 'run' })
        else at(b, { do: 'run' })
      }
      return // the runout stands for the landing point
    } else if (move === 'wallrun') {
      const side = walls.get(`${way.id}.${leg.n}`) ?? 1
      at(lerp(a, b, 0.15), { do: 'run', wall: side })
      at(lerp(a, b, 0.9), { do: 'jump', wall: side, after: 0.6 })
    } else if (move === 'climb' && Math.abs(b.y - a.y) / L > 0.42 && b.y - a.y > 4) {
      // The face stands 16 m short of the top pad's far edge (see the climb's span): start jumping 4 m before it.
      const face = towers.get(`${way.id}.${leg.n}`) ?? Math.min(0.95, Math.max(0.2, Math.ceil((1 - 16 / L) * 20) / 20)) * L
      at(lerp(a, b, Math.max(0, face - 4) / L), { do: 'climb', top: round(b.y) })
    }
    at(b, { do: move === 'run' || move === 'climb' ? 'run' : 'run' })
  })
  return out
}
