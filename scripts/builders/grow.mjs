// The generator: grows the whole builders' copy (src/places/builders.json) from the story's ways,
// with no LLM. Three layers, in order, each its own module under ./grow/:
//   ways  (grow-ways.mjs)  every leg made exactly: pads, runs, climbs, wall runs and canyons, supports;
//   blame (grow-blame.mjs) BLAME!'s structure round them: strata, shafts, column forests, drift modules;
//   stops (grow-stops.mjs) a set piece at each story stop, built for what happens there;
//   steam (grow-steam.mjs) the old-tech layer: turning gear trains, street-size mains, steam grates.
// Each run starts from the copy stripped of every builder's record (the LLM shifts' and its own), so
// growing is repeatable: same seed, same level. Last, the owner's edits in `?edit` go back on
// (`hand.mjs`); the world as grown, without them, is kept in plans/builders/grown.json.
//
//   node scripts/builders/grow.mjs [--layers=ways,blame,stops,steam] [--seed=N] [--dry]
//
// The layer contract (every layer keeps to it; `ctx` is built here):
//   ctx = { order, zones, place, site, recs, solids, rng, seed, clearOf, stand }
//     order  loadWays(): { stops, ways: [{ id, points, legs: [{ n, a, b, move, suit, length, rise }] }] }
//     zones  zonesOf(order): the story's keep and clear shapes; nothing solid may meet a `clear`
//     place  the copy as it stands now (read only, but for the ways layer: see below)
//     site   standSite(place): floors and solids, re-stood after each layer (floorHit, footUnder…)
//     rng    a seeded () → [0, 1); use it for every random choice
//     clearOf(list, record) → true when the record's triangles meet no clear zone
//   growWays(ctx)                → { add, pads }
//   growBlame(ctx, pads)         → { add, voids?, drop? }
//     drop  ids of earlier layers' forms with `role: 'support'` that this layer's mass replaces
//   growStops(ctx, pads, blame)  → { add, drop? }
//   growSteam(ctx, pads, blame)  → { add }
//     add   { forms: [], boxes: [], assets: [], props: [], lamps: [], lights: [], … } place-file
//           records, each with `planOwner: 'builders-grow-<layer>'`
//     pads  [{ way, n, x, y, z, w, l, yaw, move }]: the floor each route point stands on (n is the
//           point's index in way.points; yaw faces along the way)
//   Only the ways layer may edit ctx.place in place, and only: the palace asset, `starts`, `mists`,
//   `abyss`, and par lines. Everything else a layer makes goes into `add`.
//   The ways layer may also return `remove: [{ list, key, why }]`: the owner's own balcony records
//   (boxes, assets, forms) that stand in a leg's air or on its pad. The owner put the routes first
//   (2026-10-19); only the copy loses them, never balcony.json, and the report lists each one.
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { loadWays, testWays } from './ways.mjs'
import { zonesOf, meetsMesh } from './zones.mjs'
import { PATHS, boundsOf, keyOf, nameEverything, propSolids, saveCopy, solidRecords, standSite, positionsOf, writeJson } from './world.mjs'
import { completePlace, nextFormId } from '../../src/place-file.js'
import { growWays } from './grow/grow-ways.mjs'
import { growBlame } from './grow/grow-blame.mjs'
import { growSteam } from './grow/grow-steam.mjs'
import { growStops } from './grow/grow-stops.mjs'
import { placeStory } from './grow/story.mjs'
import { withHand } from './hand.mjs'

const BUILT = /^builders-/ // every builder's records: the LLM generations' and the generator's

/** A seeded generator (mulberry32). */
export function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stand-in pads for a layer written before the ways layer: every route point at its height, 10 m square. */
export function stubPads(order) {
  const pads = []
  for (const way of order.ways) {
    way.points.forEach((p, n) => {
      const q = way.points[Math.min(n + 1, way.points.length - 1)]
      const o = way.points[Math.max(n - 1, 0)]
      pads.push({ way: way.id, n, x: p.x, y: p.y, z: p.z, w: 10, l: 10, yaw: Math.atan2(q.x - o.x, q.z - o.z), move: way.legs[Math.min(n, way.legs.length - 1)].move })
    })
  }
  return pads
}

/** The copy with every builder's record taken out. */
export function stripped(place) {
  for (const [list, records] of Object.entries(place)) {
    if (Array.isArray(records)) place[list] = records.filter((r) => !(r && typeof r === 'object' && BUILT.test(r.planOwner ?? '')))
  }
  return place
}

// The routes' own air, which no layer after the ways may fill whatever its own checks say: every
// pad's head room (a serpentine over its floor, 0.4 to 4.4 m up) and every leg's line but a climb's
// (a wall run's close, as its wall stands 2 m off). Each with its bounds, to skip the far records fast.
function routeAir(order, pads) {
  const air = []
  for (const p of pads) {
    const f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }
    const r = { x: f.z, z: -f.x }
    const hw = Math.max(0, (p.w ?? 10) / 2 - 0.5)
    const hl = Math.max(0, (p.l ?? 10) / 2 - 0.5)
    const rows = Math.max(1, Math.ceil((2 * hl) / 2.5))
    const tube = []
    for (let i = 0; i <= rows; i++) {
      const v = -hl + (2 * hl * i) / rows
      for (const u of i % 2 ? [hw, -hw] : [-hw, hw]) tube.push([p.x + r.x * u + f.x * v, p.y + 2.4, p.z + r.z * u + f.z * v])
    }
    air.push({ tube, r: 2, what: `pad ${p.way} ${p.n}` })
  }
  for (const way of order.ways) {
    for (const leg of way.legs) {
      if (leg.move === 'climb') continue
      const [up, r] = leg.move === 'wallrun' ? [1.5, 1.2] : [2.5, 2]
      air.push({ tube: [[leg.a.x, leg.a.y + up, leg.a.z], [leg.b.x, leg.b.y + up, leg.b.z]], r, what: `leg ${way.id} ${leg.n}` })
    }
  }
  for (const a of air) {
    const lo = [0, 1, 2].map((k) => Math.min(...a.tube.map((q) => q[k])) - a.r)
    const hi = [0, 1, 2].map((k) => Math.max(...a.tube.map((q) => q[k])) + a.r)
    a.bounds = { min: { x: lo[0], y: lo[1], z: lo[2] }, max: { x: hi[0], y: hi[1], z: hi[2] } }
  }
  return air
}

const overlaps = (a, b) => a.min.x <= b.max.x && a.max.x >= b.min.x && a.min.y <= b.max.y && a.max.y >= b.min.y && a.min.z <= b.max.z && a.max.z >= b.min.z

// What of the route's air a record fills, if any. A box is met by its volume, the rest by their triangles.
function fills(air, list, record) {
  if (list === 'boxes') {
    const b = { min: { x: record.x0, y: record.y0, z: record.z0 }, max: { x: record.x1, y: record.y1, z: record.z1 } }
    for (const a of air) {
      if (!overlaps(a.bounds, b)) continue
      for (let i = 0; i + 1 < a.tube.length; i++) {
        const [p, q] = [a.tube[i], a.tube[i + 1]]
        const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) / 1.5))
        for (let k = 0; k <= n; k++) {
          const t = k / n
          const [x, y, z] = [0, 1, 2].map((j) => p[j] + (q[j] - p[j]) * t)
          const d = Math.hypot(Math.max(b.min.x - x, 0, x - b.max.x), Math.max(b.min.y - y, 0, y - b.max.y), Math.max(b.min.z - z, 0, z - b.max.z))
          if (d <= a.r) return a.what
        }
      }
    }
    return null
  }
  const positions = positionsOf(list, record)
  const bounds = boundsOf(positions)
  for (const a of air) if (overlaps(a.bounds, bounds) && meetsMesh(a, positions)) return a.what
  return null
}

function merge(place, add, layer, air = null, refused = []) {
  let n = 0
  for (let [list, records] of Object.entries(add ?? {})) {
    if (!records?.length) continue
    if (air && ['forms', 'boxes', 'assets'].includes(list)) {
      records = records.filter((r) => {
        const what = fills(air, list, r)
        if (what) refused.push(`${list} ${r.id ?? r.tag ?? r.bid ?? '?'} in ${what}`)
        return !what
      })
    }
    place[list] ??= []
    // A form's id is its key in the editor and the ledger: one a layer gave twice, or none, is given afresh.
    const taken = list === 'forms' ? new Set(place.forms.map((f) => f.id)) : null
    for (const r of records) {
      const rec = { ...r, planOwner: r.planOwner ?? `builders-grow-${layer}` }
      if (taken && (!Number.isInteger(rec.id) || taken.has(rec.id))) rec.id = nextFormId(place)
      taken?.add(rec.id)
      place[list].push(rec)
    }
    n += records.length
  }
  return n
}

export async function grow({ layers = ['ways', 'blame', 'stops', 'steam'], seed = 1, dry = false } = {}) {
  const t0 = performance.now()
  if (!dry) writeJson(PATHS.run + '/pre-grow.json', JSON.parse(readFileSync(PATHS.copy, 'utf8')))
  // Always from the owner's balcony, never from the last copy: what a layer took out of the copy for
  // a route (`remove`) or what an older run left must not outlive the run that did it.
  const place = stripped(completePlace(JSON.parse(readFileSync(PATHS.balcony, 'utf8'))))
  nameEverything(place) // the boxes' and props' keys, given as keeper's init gave the copy's (`b1`, `p2`)
  place.theme = 'builders' // the balcony under hard amber light and far fog (themes.js)
  const order = loadWays()
  const zones = zonesOf(order)
  const solids = await propSolids()
  const clears = zones.map((z) => z.clear).filter(Boolean)
  const ctx = {
    order, zones, place, solids, seed, rng: seeded(seed),
    clearOf: (list, record) => { const pos = positionsOf(list, record); return !clears.some((c) => meetsMesh(c, pos)) },
    stand() { ctx.site = standSite(place, solids); ctx.recs = solidRecords(place, solids); return ctx },
  }
  ctx.stand()
  const times = {}
  const removed = [] // the owner's records taken out of the copy for a route
  const guarded = {} // what a later layer put in the route's air, left out
  const repaired = {} // the legs a later layer unmade, and what was taken back to remake them
  let madeOnce = new Set() // the legs made once the ways stand
  let pads = stubPads(order)
  let blame = { add: {} }
  const run = async (name, fn) => {
    const t = performance.now()
    const out = await fn()
    for (const { list, key, why } of out.remove ?? []) {
      const at = place[list]?.findIndex((r) => keyOf(list, r) === key)
      if (at >= 0 && !BUILT.test(place[list][at].planOwner ?? '')) {
        place[list].splice(at, 1)
        removed.push({ list, key, why })
      }
    }
    // A later layer may take over an earlier one's supports (a megawall that a pad's pier stood in):
    // `drop` names those forms by id, and the pad must stand on what replaced them.
    const dropped = []
    if (out.drop?.length) {
      const drop = new Set(out.drop)
      place.forms = place.forms.filter((f) => {
        const gone = drop.has(f.id) && BUILT.test(f.planOwner ?? '') && f.role === 'support'
        if (gone) dropped.push(f)
        return !gone
      })
    }
    const refused = []
    const air = name === 'ways' ? null : routeAir(order, pads)
    times[name] = { s: ((performance.now() - t) / 1000).toFixed(1), records: merge(place, out.add, name, air, refused) }
    if (refused.length) guarded[name] = { refused: refused.length, first: refused.slice(0, 12) }
    ctx.stand()
    if (name === 'ways') madeOnce = madeLegs()
    else {
      const repair = keepMade(name, dropped)
      if (repair) repaired[name] = repair
    }
    return out
  }

  // The legs testWays says are made, as `way:n`.
  const madeLegs = () => new Set(testWays(ctx.site, order.ways, ctx.recs).flatMap((w) => w.legs.filter((l) => l.made).map((l) => `${w.id}:${l.n}`)))

  // No layer after the ways may unmake a leg. Where one did, its records near the leg go and the
  // supports it took over there come back, and the leg is tried again; what still fails is reported.
  function keepMade(name, dropped) {
    const now = madeLegs()
    const lost = [...madeOnce].filter((k) => !now.has(k))
    if (!lost.length) return null
    const owner = `builders-grow-${name}`
    const near = (b, leg, m = 12) => b.min.x <= Math.max(leg.a.x, leg.b.x) + m && b.max.x >= Math.min(leg.a.x, leg.b.x) - m && b.min.y <= Math.max(leg.a.y, leg.b.y) + m && b.max.y >= Math.min(leg.a.y, leg.b.y) - m && b.min.z <= Math.max(leg.a.z, leg.b.z) + m && b.max.z >= Math.min(leg.a.z, leg.b.z) - m
    const legOf = (k) => { const [id, n] = k.split(':'); return order.ways.find((w) => w.id === id).legs[Number(n) - 1] }
    const before = Object.fromEntries(['forms', 'boxes', 'assets'].map((list) => [list, place[list]]))
    let taken = 0
    let restored = 0
    let still = lost
    // Widening rings round each leg still lost: a run's way is looked for 20 m either side of it.
    for (const m of [12, 25, 45]) {
      const legs = still.map(legOf)
      for (const list of ['forms', 'boxes', 'assets']) {
        place[list] = place[list].filter((r) => {
          if (r.planOwner !== owner) return true
          const b = list === 'boxes' ? { min: { x: r.x0, y: r.y0, z: r.z0 }, max: { x: r.x1, y: r.y1, z: r.z1 } } : boundsOf(positionsOf(list, r))
          const hit = legs.some((leg) => near(b, leg, m))
          if (hit) taken++
          return !hit
        })
      }
      const back = dropped.filter((f) => !place.forms.includes(f) && legs.some((leg) => near(boundsOf(positionsOf('forms', f)), leg, m + 20)))
      place.forms.push(...back)
      restored += back.length
      ctx.stand()
      const now = madeLegs()
      still = still.filter((k) => !now.has(k))
      if (!still.length) break
    }
    // Taking back what remade nothing only loses the layer's work: put it all as it was.
    if (still.length === lost.length) {
      Object.assign(place, before)
      ctx.stand()
      return { lost, taken: 0, restored: 0, stillLost: still, cause: 'not this layer\'s records near the legs' }
    }
    return { lost, taken, restored, stillLost: still }
  }
  if (layers.includes('ways')) pads = (await run('ways', () => growWays(ctx))).pads ?? pads
  if (layers.includes('blame')) blame = await run('blame', () => growBlame(ctx, pads))
  if (layers.includes('stops')) await run('stops', () => growStops(ctx, pads, blame))
  if (layers.includes('steam')) await run('steam', () => growSteam(ctx, pads, blame))
  const tested = testWays(ctx.site, order.ways, ctx.recs)
  const made = tested.reduce((s, w) => s + w.made, 0)
  const of = tested.reduce((s, w) => s + w.of, 0)
  const report = { seed, layers, times, removed, guarded, repaired, made: `${made}/${of}`, ways: tested.map((w) => ({ id: w.id, made: `${w.made}/${w.of}`, unmade: w.legs.filter((l) => !l.made).map((l) => `${l.n} ${l.move}: ${l.why}`) })), total: ((performance.now() - t0) / 1000).toFixed(1) + ' s' }
  placeStory(place, order, ctx.site)
  report.hand = withHand(place, { save: !dry }) // the owner's edits in `?edit`, over what was grown
  if (!dry) saveCopy(place, null)
  return report
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d
  const report = await grow({ layers: arg('layers', 'ways,blame,stops,steam').split(','), seed: Number(arg('seed', 1)), dry: process.argv.includes('--dry') })
  console.log(JSON.stringify(report, null, 1))
}
