// The story's routes over a place: the courier's round from NPC to NPC (`docs/story-courier.md`),
// drawn on the routes page (`itch/routes.html`) and kept as plans/<place>-routes.json, the order
// the builders are to build round. This is the only reading of that file's shape; pure, so the
// page, the dev server (`vite.config.js`) and the builders' scripts share it.
//
//   { place,
//     stops:  [{ id, name, npc, at: { x, y, z } | null, zone: { keep, clear } }],
//     routes: [{ id, from, to, acts, branch?, secret?, via, legs }        a way from stop to stop
//            | { id, of, line: 'fast' | 'slow', leaves, joins, via, legs }] another line of one
//
// A route's points are its ends and its `via` between them: a way's ends are its stops' `at`, an
// alternate line's are the points `leaves` and `joins` (indices into the points) of the way it is
// `of`, so moving a stop or a way's point moves what starts there. `legs` are the points' gaps in
// order, each `{ move }`, one fewer than the points; a way not yet drawn has none. A stop's zone
// is what the builders keep of it: `keep` metres round it nothing is cut or taken away, `clear`
// metres round it nothing solid is built. A stop not yet placed has `at` null.
//
// No route may be walked whole: every leg says how it is crossed, and a way with no leg but runs
// is called walkable (`verdictsOf`). The moves' limits are the move table's (`scripts/moves/`,
// docs/internals/parkour.md), at its fair margin.

/**
 * The runner's limits: `parkour.js`' numbers and the move table's, measured 2026-10-16. A jump is
 * judged at the owner's margin (the move table's "fair"): 0.7 of what a jump at 28 m/s reaches.
 */
export const LIMITS = {
  run: 22, // m/s a jump is judged at: what the pilot has on a pad (20, 22 after a landing), measured 2026-10-19 (grow/ways-jump.mjs); 28 is a run with a slide's boost
  jumpUp: 12.5, // m/s, a jump's speed up
  gravity: 28, // m/s²
  fair: 0.7, // of what that jump reaches: what is asked of a person
  mantle: 2.8, // metres of ledge pulled up onto
  block: 5.5, // metres of block got onto with a jump
  gapLeast: 4, // metres: a jump shorter is a step, not a gap
  wallRun: 41, // metres along a wall at 20 m/s
  wallRise: 4, // metres a wall run may climb along its way
  wallFall: 10, // and fall
  glide: 2.4, // metres forward for one down: the owner's margin for a flight (the suit's best is 3)
  glideLeast: 30, // metres: a glide shorter is a jump
  dropMost: 60, // metres: the deepest fall a way is let take (`route.mjs`)
}

// The drop the suit spends over L metres flown from a run off a pad at 20 m/s, measured 2026-10-19 with the
// par pilot over the real suit (grow/ways-glide.mjs): [distance, drop] at its best look. It dives some 28 m in the
// first 50 m to find speed (3 to 1 comes only at 40 m/s), then holds 3.1 to 1; past 600 m the long dive's 3.3.
const GLIDE_CURVE = [[0, 0], [50, 29], [100, 53], [200, 95], [300, 133], [400, 167], [500, 199], [600, 227]]
const GLIDE_MARGIN = 1.12 // a person is not the pilot

/** The drop a glide of `length` metres needs, with the margin: the measured curve (`GLIDE_CURVE`) times 1.12, plus 2 m. */
export function glideDrop(length) {
  let drop
  const last = GLIDE_CURVE[GLIDE_CURVE.length - 1]
  if (length >= last[0]) drop = last[1] + (length - last[0]) / 3.3
  else {
    const k = GLIDE_CURVE.findIndex(([d]) => d >= length)
    const [d0, y0] = GLIDE_CURVE[k - 1]
    const [d1, y1] = GLIDE_CURVE[k]
    drop = y0 + ((y1 - y0) * (length - d0)) / (d1 - d0)
  }
  return drop * GLIDE_MARGIN + 2
}

/** What a jump reaches with `drop` metres down (negative: up), fairly. */
export function fairReach(drop) {
  const { run, jumpUp, gravity, fair, mantle } = LIMITS
  if (drop >= 0) return (fair * run * (jumpUp + Math.sqrt(jumpUp * jumpUp + 2 * gravity * drop))) / gravity
  const up = -drop
  if (up < mantle) return (fair * run * (jumpUp + Math.sqrt(jumpUp * jumpUp - 2 * gravity * up))) / gravity
  return 0
}

/** The drop a jump of `length` metres needs to be fair: 0 within the level reach. */
export function dropFor(length) {
  const { run, jumpUp, gravity, fair } = LIMITS
  if (length <= fairReach(0)) return 0
  const root = (length * gravity) / (fair * run) - jumpUp
  return (root * root - jumpUp * jumpUp) / (2 * gravity)
}

/** How a leg is crossed, by its key on the page. Only `run` is walked. */
export const MOVES = {
  run: { key: '1', words: 'run' },
  jump: { key: '2', words: 'jump' },
  glide: { key: '3', words: 'glide' },
  climb: { key: '4', words: 'climb' },
  drop: { key: '5', words: 'drop' },
  wallrun: { key: '6', words: 'wall run' },
}

/**
 * The story's stops, and where the place has each already (`seed`): the gull's first perch, the
 * dispatch's and Tamara's speakers, the boiler factory's start for the Tabachnaya. The pipe man,
 * the raccoon and Gavrilov stand nowhere yet.
 */
export const STOPS = [
  { id: 'gull', name: 'Чайка · крыша, антенна', npc: 'gull', seed: (place) => place.crows?.[0]?.perches?.[0] },
  { id: 'voron', name: 'Ворон · Сортировочная', npc: 'ravenDispatch', seed: (place) => speaker(place, 'ravenDispatch') },
  { id: 'tamara', name: 'Тамара Ильинична · 19-й ярус', npc: 'tamara', seed: (place) => speaker(place, 'tamara') },
  { id: 'raccoon', name: 'Енот · свалка у шахты лифта', npc: 'raccoon', seed: (place) => place.raccoons?.[0] },
  { id: 'pipeman', name: 'Человек в трубе · 8-й ярус', npc: 'pipeman' },
  { id: 'gavrilov', name: 'Гаврилов · решётка на левой лестнице', npc: 'gavrilov' },
  { id: 'tabachnaya', name: 'Табачная · котёл и Главный Центр', npc: null, seed: (place) => place.starts?.['boiler-factory'] },
]
const ZONE = { keep: 24, clear: 4 } // metres

function speaker(place, kind) {
  for (const delivery of place.deliveries ?? []) for (const end of [delivery.speakerFrom, delivery.speakerTo]) if (end?.kind === kind) return end
  return null
}

/**
 * The ways the story sends him (the owner, 2026-10-19): one round, made in each of the three acts,
 * from the gull on the roof by Ворон's dispatch, Тамара, the raccoon and the pipe man back to the
 * roof; and at Ворон, in every act, a way off it (`branch`) to Gavrilov's grate, and on from
 * there down to the Табачная, the hidden ending's (`secret`). In this order, the round's first.
 */
export const STORY = [
  { from: 'gull', to: 'voron' },
  { from: 'voron', to: 'tamara' },
  { from: 'tamara', to: 'raccoon' },
  { from: 'raccoon', to: 'pipeman' },
  { from: 'pipeman', to: 'gull' },
  { from: 'voron', to: 'gavrilov', branch: true },
  { from: 'gavrilov', to: 'tabachnaya', branch: true, secret: true },
]
const ACTS = [1, 2, 3]
const wayIn = ({ from, to, branch, secret }) => ({ id: `${from}-${to}`, from, to, acts: [...ACTS], ...(branch ? { branch: true } : {}), ...(secret ? { secret: true } : {}) })

const round = (v) => Math.round(v * 10) / 10
const pointOf = (at) => (at ? { x: round(at.x), y: at.y == null ? null : round(at.y), z: round(at.z) } : null)

/** A new routes file for `place` (its record): the stops where it has them, every way undrawn. */
export function freshRoutes(name, place) {
  return {
    place: name,
    stops: STOPS.map(({ id, name: words, npc, seed }) => ({ id, name: words, npc, at: pointOf(seed?.(place)), zone: { ...ZONE } })),
    routes: STORY.map((way) => ({ ...wayIn(way), via: [], legs: [] })),
  }
}

/**
 * `file` with its ways as `STORY` has them now, in its order, every drawing kept: a way the story
 * still asks for keeps its points and legs and takes the story's acts and kinds; one it asks for
 * anew comes undrawn; one it no longer asks for goes if undrawn, and stays at the end, in no act,
 * if drawn. Lines go with their ways.
 */
export function withStory(file) {
  const old = new Map(file.routes.filter((route) => !isLine(route)).map((route) => [route.id, route]))
  const ways = STORY.map((way) => {
    const was = old.get(wayIn(way).id)
    old.delete(wayIn(way).id)
    return { ...wayIn(way), via: was?.via ?? [], legs: was?.legs ?? [] }
  })
  const left = [...old.values()].filter(drawn).map((route) => ({ ...route, acts: [], branch: undefined, secret: undefined }))
  const kept = new Set([...ways, ...left].map((route) => route.id))
  const lines = file.routes.filter((route) => isLine(route) && kept.has(route.of))
  return { ...file, routes: [...ways, ...left, ...lines] }
}

// ---- reading

export const stopOf = (file, id) => file.stops.find((stop) => stop.id === id) ?? null
export const routeOf = (file, id) => file.routes.find((route) => route.id === id) ?? null
export const isLine = (route) => route.of != null
export const linesOf = (file, way) => file.routes.filter((route) => route.of === way.id)
/** The way a route is, or is another line of. */
export const wayOf = (file, route) => (isLine(route) ? routeOf(file, route.of) : route)

/** A route's points, ends included, or null while an end has nowhere to be. */
export function pointsOf(file, route) {
  let ends
  if (isLine(route)) {
    const way = pointsOf(file, routeOf(file, route.of) ?? { via: [] })
    ends = [way?.[route.leaves], way?.[route.joins]]
  } else ends = [stopOf(file, route.from)?.at, stopOf(file, route.to)?.at]
  if (!ends[0] || !ends[1]) return null
  return [ends[0], ...route.via, ends[1]]
}

export const drawn = (route) => route.legs.length > 0 && route.legs.length === route.via.length + 1

/**
 * A leg from `a` to `b` crossed by `move`: its length on the plan, its rise (null where a height is
 * open), and whether a person can make it, `ok`, with what is wrong `said`.
 */
export function legOf(a, b, move) {
  const length = Math.hypot(b.x - a.x, b.z - a.z)
  const rise = a.y == null || b.y == null ? null : b.y - a.y
  const m = (v) => `${Math.round(v * 10) / 10} m`
  const fail = (said) => ({ length, rise, ok: false, said })
  const L = LIMITS
  if (move === 'jump') {
    if (length < L.gapLeast) return fail(`a step, not a gap (${m(length)})`)
    if (rise != null && rise >= L.mantle) return fail(`jump up ${m(rise)}: over the ${m(L.mantle)} a jump rises`)
    const reach = fairReach(rise == null ? 0 : -rise)
    if (length > reach) return fail(`jump ${m(length)} > fair ${m(reach)}`)
  } else if (move === 'glide') {
    if (length < L.glideLeast) return fail(`a glide of ${m(length)} is a jump`)
    const needs = glideDrop(length)
    if (rise != null && -rise < needs) return fail(`glide ${m(length)} needs ${m(needs)} of drop, has ${m(Math.max(0, -rise))}`)
  } else if (move === 'climb') {
    if (rise != null && rise <= 0) return fail('a climb goes up')
  } else if (move === 'drop') {
    if (rise != null && rise >= 0) return fail('a drop goes down')
    if (rise != null && -rise > L.dropMost) return fail(`drop ${m(-rise)} > ${m(L.dropMost)}`)
  } else if (move === 'wallrun') {
    if (length > L.wallRun) return fail(`wall run ${m(length)} > ${m(L.wallRun)}`)
    if (rise != null && rise > L.wallRise) return fail(`a wall run climbs at most ${m(L.wallRise)}`)
    if (rise != null && -rise > L.wallFall) return fail(`a wall run falls at most ${m(L.wallFall)}`)
  }
  return { length, rise, ok: true, said: '' }
}

/** A route's legs as drawn: each `{ a, b, move, length, rise, ok, said }`. */
export function legsOf(file, route) {
  const points = pointsOf(file, route)
  if (!points || !drawn(route)) return []
  return route.legs.map(({ move }, i) => ({ a: points[i], b: points[i + 1], move, ...legOf(points[i], points[i + 1], move) }))
}

// ---- heights, inferred

// The owner drew without heights ("I was drawing a line longer if I wanted a higher, steeper object
// to climb, or for a long glide"): each leg asks for a rise from its move and its length on the
// plan, and every point's height is what fits all of them best (weighted least squares, the stops
// shared, so the round closes on itself). `ASKS` is each move's rise for a leg of L metres and how
// hard it holds to it; a run gives way most, as a ramp.
export const ASKS = {
  glide: { rise: (L) => -glideDrop(L) * 1.02, weight: 10 },
  // A jump past what any fair jump reaches (`longestJump`, with the deepest drop) is made only by
  // opening the suit in the air: it asks for a glide's drop, and is said so.
  jump: { rise: (L) => (L > longestJump() ? -glideDrop(L) * 1.02 : -dropFor(L) * 1.05 - 0.5), weight: 10 },
  drop: { rise: (L) => -Math.max(3, Math.min(L, LIMITS.dropMost)), weight: 10 },
  climb: { rise: (L) => L, weight: 10 },
  wallrun: { rise: () => -0.7, weight: 10 }, // nearly level: a wall run is made along a wall, not up it
  run: { rise: () => 0, weight: 0.3, slope: 1 / 3 },
}
const HELD = { first: 1000, others: 0.02 } // how hard the first stop (the gull's roof) and the rest keep their drawn heights
const LOWEST = 'tabachnaya' // the story's bottom: kept under every other point
const UNDER = 20 // metres it is kept under them
const MARGIN = 0.5 // metres of rise or fall a leg is solved to have beyond what its move needs
/** The longest fair jump: off the deepest drop a way may take. */
export const longestJump = () => fairReach(LIMITS.dropMost)

/**
 * Every placed stop's and drawn route's points' inferred heights: `{ stops: { id: y }, routes:
 * { id: [y a point] }, said: [what no height can make] }`.
 */
export function heightsOf(file) {
  const index = new Map() // unknown's key → its column
  const key = (route, i, points) => (i === 0 && !isLine(route) ? `s:${route.from}` : i === points.length - 1 && !isLine(route) ? `s:${route.to}` : isLine(route) && (i === 0 || i === points.length - 1) ? `p:${route.of}:${i === 0 ? route.leaves : route.joins}` : `p:${route.id}:${i}`)
  const col = (k) => (index.has(k) ? index.get(k) : (index.set(k, index.size), index.size - 1))
  const legs = []
  for (const route of file.routes) {
    const points = pointsOf(file, route)
    if (!points || !drawn(route)) continue
    route.legs.forEach(({ move }, i) => {
      const L = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z)
      legs.push({ route, i, move, L, a: col(key(route, i, points)), b: col(key(route, i + 1, points)), ...ASKS[move], want: ASKS[move].rise(L) })
    })
  }
  const anchors = file.stops
    .filter((stop) => stop.at?.y != null && index.has(`s:${stop.id}`))
    .map((stop, k) => ({ at: index.get(`s:${stop.id}`), y: stop.at.y, weight: k === 0 ? HELD.first : HELD.others }))
  let y = []
  // Solved again while a leg cannot be made at the heights found (`made`), or a run is steeper than
  // a ramp, or the bottom is not the bottom: each time holding those harder.
  for (let round = 0; round < 24; round++) {
    y = solve(index.size, legs, anchors)
    let again = false
    for (const leg of legs) {
      const rise = y[leg.b] - y[leg.a]
      if (!made(leg, rise) || (leg.slope && Math.abs(rise) > leg.L * leg.slope)) {
        leg.weight *= 4
        again = true
      }
    }
    const low = index.get(`s:${LOWEST}`)
    if (low !== undefined) {
      const others = Math.min(...y.filter((_, i) => i !== low))
      if (y[low] > others - UNDER + 0.5) {
        anchors.push({ at: low, y: others - UNDER, weight: 100 })
        again = true
      }
    }
    if (!again) break
  }
  const at = (k) => Math.round(y[index.get(k)] * 10) / 10
  const stops = Object.fromEntries(file.stops.filter((stop) => index.has(`s:${stop.id}`)).map((stop) => [stop.id, at(`s:${stop.id}`)]))
  const routes = {}
  const said = []
  for (const route of file.routes) {
    const points = pointsOf(file, route)
    if (!points || !drawn(route)) continue
    routes[route.id] = points.map((_, i) => at(key(route, i, points)))
  }
  for (const leg of legs) {
    const ys = routes[leg.route.id]
    const name = `${leg.route.id} leg ${leg.i + 1}`
    if (leg.move === 'jump' && leg.L > longestJump()) said.push(`${name}: a ${Math.round(leg.L)} m jump is past any jump (${Math.round(longestJump())} m): the suit opens on it`)
    else {
      const found = legOf({ x: 0, y: 0, z: 0 }, { x: leg.L, y: ys[leg.i + 1] - ys[leg.i], z: 0 }, leg.move)
      if (!found.ok) said.push(`${name}: ${found.said}`)
    }
  }
  return { stops, routes, said }
}

// Whether a leg of `heightsOf` can be made with this rise; a jump past any jump as the glide it becomes.
function made(leg, rise) {
  const move = leg.move === 'jump' && leg.L > longestJump() ? 'glide' : leg.move
  const margin = Math.sign(leg.want) * MARGIN // judged a little short of what was found, so heights rounded still make it
  return legOf({ x: 0, y: 0, z: 0 }, { x: leg.L, y: rise - margin, z: 0 }, move).ok
}

// Weighted least squares: each leg's rise and each anchor's height, by the normal equations.
function solve(n, legs, anchors) {
  const A = Array.from({ length: n }, () => new Float64Array(n))
  const b = new Float64Array(n)
  for (const { a, b: c, want, weight } of legs) {
    A[a][a] += weight
    A[c][c] += weight
    A[a][c] -= weight
    A[c][a] -= weight
    b[c] += weight * want
    b[a] -= weight * want
  }
  for (const { at, y, weight } of anchors) {
    A[at][at] += weight
    b[at] += weight * y
  }
  // Gaussian elimination with partial pivoting; n is a few hundred.
  for (let k = 0; k < n; k++) {
    let p = k
    for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i
    ;[A[k], A[p]] = [A[p], A[k]]
    ;[b[k], b[p]] = [b[p], b[k]]
    const d = A[k][k] || 1e-9
    for (let i = k + 1; i < n; i++) {
      const f = A[i][k] / d
      if (!f) continue
      for (let j = k; j < n; j++) A[i][j] -= f * A[k][j]
      b[i] -= f * b[k]
    }
  }
  const y = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i]
    for (let j = i + 1; j < n; j++) sum -= A[i][j] * y[j]
    y[i] = sum / (A[i][i] || 1e-9)
  }
  return y
}

/** A route's points at their inferred heights (`heights` from `heightsOf`), or null. */
export function pointsAtHeight(file, route, heights) {
  const points = pointsOf(file, route)
  const ys = heights.routes[route.id]
  return points && ys ? points.map((p, i) => ({ ...p, y: ys[i] })) : null
}

/**
 * A route's legs as `legsOf` has them, at their inferred heights: a jump past any jump is judged
 * as the glide it becomes, and marked `suit`.
 */
export function legsAtHeight(file, route, heights) {
  const points = pointsAtHeight(file, route, heights)
  if (!points || !drawn(route)) return []
  return route.legs.map(({ move }, i) => {
    const [a, b] = [points[i], points[i + 1]]
    const suit = move === 'jump' && Math.hypot(b.x - a.x, b.z - a.z) > longestJump()
    return { a, b, move, suit, ...legOf(a, b, suit ? 'glide' : move) }
  })
}

/** What is wrong with each route as drawn, by its id, and the stops not yet placed. Nothing here refuses a save. */
export function verdictsOf(file) {
  const routes = {}
  for (const route of file.routes) {
    const said = []
    const points = pointsOf(file, route)
    if (!points) said.push(isLine(route) ? 'its way is not drawn there' : 'a stop is not placed')
    else if (!drawn(route)) said.push('not drawn')
    else {
      const legs = legsOf(file, route)
      for (const [i, leg] of legs.entries()) if (!leg.ok) said.push(`leg ${i + 1}: ${leg.said}`)
      if (!isLine(route) && legs.every((leg) => leg.move === 'run')) said.push('walkable: no jump, glide, climb, drop or wall run')
    }
    routes[route.id] = said
  }
  return { routes, unplaced: file.stops.filter((stop) => !stop.at).map((stop) => stop.id) }
}

// ---- changing (in place)

/** Puts `point` into `route` before its point `at` (1 … points − 1), splitting that leg; lines that leave or join later shift on. */
export function insertPoint(file, route, at, point) {
  route.via.splice(at - 1, 0, pointOf(point))
  if (route.legs.length) route.legs.splice(at - 1, 0, { ...route.legs[at - 1] })
  for (const line of linesOf(file, route)) {
    if (line.leaves >= at) line.leaves++
    if (line.joins >= at) line.joins++
  }
}

/** Takes `route`'s point `at` (a via point, 1 … points − 2) away, its two legs one; a line leaving or joining there goes with it. */
export function removePoint(file, route, at) {
  route.via.splice(at - 1, 1)
  if (route.legs.length) route.legs.splice(at, 1)
  for (const line of linesOf(file, route)) {
    if (line.leaves === at || line.joins === at) file.routes.splice(file.routes.indexOf(line), 1)
    else {
      if (line.leaves > at) line.leaves--
      if (line.joins > at) line.joins--
    }
  }
}

/** Takes a route away, and the lines of it. */
export function removeRoute(file, route) {
  file.routes = file.routes.filter((each) => each !== route && each.of !== route.id)
}

/** A new line of `way` between its points `leaves` and `joins`, through `via`, every leg `move`. */
export function addLine(file, way, leaves, joins, via, move, line = 'fast') {
  const ids = new Set(file.routes.map((route) => route.id))
  let n = 1
  while (ids.has(`${way.id}~${line}${n > 1 ? n : ''}`)) n++
  const made = { id: `${way.id}~${line}${n > 1 ? n : ''}`, of: way.id, line, leaves, joins, via: via.map(pointOf), legs: Array.from({ length: via.length + 1 }, () => ({ move })) }
  file.routes.push(made)
  return made
}

export const setPoint = (point, at) => Object.assign(point, pointOf({ ...point, ...at }))

// ---- the file

/** What is wrong with `file`'s shape, as a list of reasons; empty when it may be written. */
export function checkRoutes(file) {
  const wrong = []
  if (!file || typeof file !== 'object' || Array.isArray(file)) return ['a routes file is an object']
  if (typeof file.place !== 'string') wrong.push('no place')
  if (!Array.isArray(file.stops)) wrong.push('no stops')
  if (!Array.isArray(file.routes)) wrong.push('no routes')
  if (wrong.length) return wrong
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.z) && (p.y === null || Number.isFinite(p.y))
  const stops = new Set()
  for (const stop of file.stops) {
    if (typeof stop.id !== 'string' || stops.has(stop.id)) wrong.push(`stop "${stop.id}": no id, or one used twice`)
    stops.add(stop.id)
    if (stop.at !== null && !finite(stop.at)) wrong.push(`stop "${stop.id}": at is not a point`)
    if (!Number.isFinite(stop.zone?.keep) || !Number.isFinite(stop.zone?.clear)) wrong.push(`stop "${stop.id}": a zone has keep and clear`)
  }
  const ids = new Set()
  for (const route of file.routes) {
    const name = `route "${route.id}"`
    if (typeof route.id !== 'string' || ids.has(route.id)) wrong.push(`${name}: no id, or one used twice`)
    ids.add(route.id)
    if (!Array.isArray(route.via) || !route.via.every(finite)) wrong.push(`${name}: via is not a list of points`)
    if (!Array.isArray(route.legs) || !route.legs.every((leg) => MOVES[leg?.move])) wrong.push(`${name}: a leg's move is none of ${Object.keys(MOVES).join(', ')}`)
    else if (route.legs.length && route.legs.length !== (route.via?.length ?? 0) + 1) wrong.push(`${name}: ${route.legs.length} legs for ${(route.via?.length ?? 0) + 2} points`)
    if (isLine(route)) {
      const way = routeOf(file, route.of)
      if (!way || isLine(way)) wrong.push(`${name}: of no way`)
      else if (!(Number.isInteger(route.leaves) && Number.isInteger(route.joins) && route.leaves >= 0 && route.leaves < route.joins && route.joins <= way.via.length + 1)) wrong.push(`${name}: leaves and joins are not points of its way in order`)
      if (route.line !== 'fast' && route.line !== 'slow') wrong.push(`${name}: a line is fast or slow`)
    } else {
      if (!stops.has(route.from) || !stops.has(route.to)) wrong.push(`${name}: from or to is no stop`)
      if (!Array.isArray(route.acts)) wrong.push(`${name}: no acts`)
    }
  }
  return wrong
}

/** `file` as text: a stop a line and a route a line, so a change shows as the lines it changed. */
export function layOutRoutes(file) {
  const list = (records) => records.map((record) => `    ${JSON.stringify(record)}`).join(',\n')
  return `{\n  "place": ${JSON.stringify(file.place)},\n  "stops": [\n${list(file.stops)}\n  ],\n  "routes": [\n${list(file.routes)}\n  ]\n}\n`
}
