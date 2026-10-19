// Four brutalist stairs, each the whole of a stair building or a part of one that a landmark
// stands in its own make (`k.add`). A runner is 1.8 m, runs at 20 m/s and climbs a stair at about
// 16 m/s, so every one is made to be run up: risers `RISER` (0.45), treads a metre, a landing
// after each 18 risers (`kit`'s `flight`), lanes at least 6 m wide, and no flight or landing
// that ends in open air: each ends in a wall or in a turn. Edges are solid parapets
// `PARAPET` high, never rails, which shimmer at that speed. What a runner goes through is
// 25 × 15 m at least; a door is only at a man's size and only shows use. Sharp pieces only:
// `block`, `relief`, `prism`, `flight`, `switchback`, and lathes drawn flat.
// - `flightStair`: a monumental flight stacked into a cascade, each tier climbing to a level
//   terrace and the next flight starting at that terrace's back edge, so that the whole steps
//   back tier on tier, each step a mass to the ground (Salk's plaza steps; the Yerevan Cascade).
//   Cheek walls either side of each flight, benches on the terraces for a use, a wall across
//   the top one's back, too high to vault, so that a run up it ends in a wall.
// - `towerStair`: a stair tower standing apart from what it serves (Trellick's service tower;
//   Boston's). Two lanes of flights zigzag up a shaft that is solid on three sides and open on
//   the fourth, the way in under the first landing, over it a colonnade of deep fins that the
//   zigzag shows between. A lift door on the back wall at each landing; if a building is to be
//   joined, a bridge from each landing and from the roof out through the fins to its face, and a
//   door on that face where each landing's bridge meets it; a roof over the shaft but for the
//   hole the last flight comes up through.
// - `hungStair`: one flight hung across a blank wall, from the ground to the roof, carried on
//   triangular consoles that stand out of the face (Tbilisi's Ministry of Highways: a load
//   held over open ground). The wall is on his left climbing; the top landing turns him left
//   onto the roof.
// - `helixStair`: treads spiralling round a solid core inside an open drum whose wall is
//   bands of slotted panels between solid rings (Yamanashi's cores). Faceted, never smooth.
// Sourced: the shape of each is from `docs/research/brutalism.md`. Guessed: every size, which
// were taken from what the runner needs (the gauge, `docs/internals/parkour.md`), not from the
// buildings. Pure: no scene.

import { between, kit, p, PARAPET, result, rightOf, RISER, treads, withDefaults } from './asset-kit.js'

/** Their parameters as they are built when given none (`assets.js` hands them to the editor). Metres unless said. */
export const DEFAULTS = {
  flightStair: {
    width: 30, // across the treads
    rise: 12, // what a tier climbs
    tiers: 3, // flights, each to a terrace, the next starting at that terrace's back edge
    terrace: 24, // depth of each tier's level terrace
    every: 18, // risers between two landings of a flight
    landing: 4, // depth of such a landing
    cheek: 3, // thickness of the cheek walls either side of a flight
    benches: true, // a few low benches on each terrace
    back: true, // a wall across the top terrace's back; false leaves it open onto a roof
    stop: 3.5, // that wall's height: over a parapet's he vaults, and the runner ran up and off the back
    look: 'board', // the walls and masses
    tread: 'cast', // the flights
    sink: 0, // how far down what stands on the ground goes
  },
  towerStair: {
    lobby: 15, // the open ground storey's height: the way in, under the first landing
    storeys: 24, // the man's storeys over the lobby
    floor: 3.2, // one of them
    per: 3, // storeys a flight climbs
    lane: 6, // a flight's width
    gap: 0.6, // between the two lanes
    landing: 6, // a landing's depth
    stop: 3.5, // the wall across a landing's far end
    wall: 1.2, // thickness of the shaft's walls
    fin: 2, // thickness of a fin of the front, along it: few and heavy, as a mass reads (thin ones read as a cage)
    finDeep: 2.4, // how far a fin stands out of the front
    bay: 9.6, // from one fin to the next
    bridge: 0, // metres a bridge deck runs out beyond the fins from each landing but the first, and from the roof; 0 for none
    face: 0, // how far past a bridge's end the face it meets stands: its doors are on it
    look: 'board',
    tread: 'cast',
    dim: 'dim', // the landings, seen from below
    sink: 0,
  },
  hungStair: {
    long: 100, // the blank mass along X
    deep: 16, // and along Z
    height: 30, // and to its roof
    lane: 6, // the flight's width
    under: 0.6, // the flight's slab
    every: 18,
    landing: 4,
    top: 6, // the top landing's length
    stop: 3.5, // the wall across its far end
    console: 8, // from one console to the next, along X
    look: 'board',
    tread: 'cast',
    dim: 'dim', // the top landing, seen from below
    sink: 0,
  },
  helixStair: {
    height: 61.2, // the top deck's level
    perTurn: 34, // treads a turn: 15.3 m a turn, so the way in at the foot is 15 m tall
    core: 4, // the solid core's radius
    inner: 14, // the drum's inner radius, at its corners
    wall: 1.5, // the drum's thickness
    sides: 16, // the drum's facets (a multiple of 4)
    slot: 1.2, // a slot window's width, between two panels
    ring: 1.5, // the solid ring between bands
    door: 25, // the way in's width, along the drum's inside
    bridge: 0, // metres a deck runs out of the top, 6 wide; 0 for none
    bridgeAt: Math.PI / 2, // its angle about the axis, and its gap in the top ring's (snapped to a corner of the drum); π/2 is +Z
    doorAt: Math.PI / 2, // the angle of the way in at the foot
    look: 'board',
    tread: 'cast',
    sink: 0,
  },
}

const TAU = Math.PI * 2
/** The thickness of a solid parapet that is not part of a flight's own. */
const RIM = 0.6

/**
 * The cells that `region` (`[x0, x1, z0, z1]`) is cut into by the edges of `cuts` (`{ x0, x1, z0, z1 }`)
 * and that lie in none of them: a floor with holes in it, in boxes.
 */
function cellsMinus([x0, x1, z0, z1], cuts) {
  const edges = (lo, hi, values) => [...new Set([lo, hi, ...values.filter((v) => v > lo && v < hi)])].sort((a, b) => a - b)
  const xs = edges(x0, x1, cuts.flatMap((c) => [c.x0, c.x1]))
  const zs = edges(z0, z1, cuts.flatMap((c) => [c.z0, c.z1]))
  const cells = []
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < zs.length; j++) {
      const [cx, cz] = [(xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2]
      if (cuts.some((c) => cx > c.x0 && cx < c.x1 && cz > c.z0 && cz < c.z1)) continue
      cells.push([xs[i], xs[i + 1], zs[j], zs[j + 1]])
    }
  }
  return cells
}

export function flightStair(given) {
  const { width, rise, tiers, terrace, every, landing, cheek, benches, back: closed, stop, look, tread, sink } = withDefaults(DEFAULTS.flightStair, given)
  const k = kit(sink)
  // Every tier is the same flight and terrace; the cascade is centred along Z, climbing toward −Z.
  const { length } = treads(rise, { every, landing })
  const half = width / 2 + cheek
  const BENCH = { high: 0.45, wide: 0.6, long: 4, inset: 1 } // a riser high, so that it is run over
  let foot = (tiers * (length + terrace)) / 2
  for (let tier = 0; tier < tiers; tier++) {
    const y0 = tier * rise
    const y1 = y0 + rise
    k.flight({ foot: { x: 0, z: foot }, way: [0, -1], width, y0, y1, every, landing, under: null, base: k.foot, parapets: [-1, 1], parapet: { thick: cheek, look }, look: tread })
    const front = foot - length // the terrace's front edge, where the flight tops out
    const back = front - terrace
    k.block(-half, half, k.foot, y1, back, front, look)
    for (const side of [-1, 1]) {
      const [x0, x1] = side > 0 ? [half - RIM, half] : [-half, -half + RIM]
      k.block(x0, x1, y1, y1 + PARAPET, back, front, look)
      if (!benches) continue
      const edge = half - RIM - BENCH.inset
      for (const at of [0.25, 0.5, 0.75]) {
        const z = front - terrace * at
        k.block(...(side > 0 ? [edge - BENCH.wide, edge] : [-edge, -edge + BENCH.wide]), y1, y1 + BENCH.high, z - BENCH.long / 2, z + BENCH.long / 2, look)
      }
    }
    if (tier === tiers - 1 && closed) k.block(-half + RIM, half - RIM, y1, y1 + stop, back, back + RIM, look)
    foot = back
  }
  return result(k)
}

export function towerStair(given) {
  const { lobby, storeys, floor, per, lane, gap, landing, stop, wall, fin, finDeep, bay, bridge, face, look, tread, dim, sink } = withDefaults(DEFAULTS.towerStair, given)
  const k = kit(sink)
  const BEAM = 3 // the beam along the front at the lobby's head, which the fins stand on
  const DECK = 0.8 // a bridge's deck
  const top = lobby + storeys * floor
  const levels = [0, lobby]
  while (levels.at(-1) < top - 1e-6) levels.push(Math.min(levels.at(-1) + per * floor, top))
  // The flights run along X from x = 0, in two lanes side by side along Z. `side` puts the second
  // lane behind (−Z) the first.
  const side = rightOf([1, 0])[1] > 0 ? -1 : 1
  const pitch = lane + gap
  const zFront = lane / 2 + gap / 2 // the first lane's outer parapet's face, which the fins stand against
  const zBack = -pitch - lane / 2 // the shaft's back wall's inside face
  // Where each flight begins and tops out, and the shaft's inside from end to end: from a landing's
  // depth before the first foot (room to come in from the front and turn onto it) to past the
  // farthest landing's stop wall.
  const flights = []
  let along = 0
  let [lo, hi] = [-landing, 0]
  for (let m = 0; m + 1 < levels.length; m++) {
    const dir = m % 2 === 0 ? 1 : -1
    const foot = along
    along += dir * treads(levels[m + 1] - levels[m]).length
    const end = m + 2 < levels.length ? along + dir * (landing + 0.4) : along // the roof has no landing
    flights.push({ foot, top: along, lane: m % 2 })
    lo = Math.min(lo, along, end)
    hi = Math.max(hi, along, end)
  }
  const landings = k.switchback({ foot: { x: 0, z: 0 }, way: [1, 0], side, lane, gap, levels, landing, stop, outer: [true, false], lastLanding: false, look: tread, wall: look, floor: dim })

  // The shaft: a back wall and two end walls, up past the roof's level by a parapet.
  k.block(lo - wall, hi + wall, k.foot, top + PARAPET, zBack - wall, zBack, look)
  k.block(lo - wall, lo, k.foot, top + PARAPET, zBack, zFront, look)
  k.block(hi, hi + wall, k.foot, top + PARAPET, zBack, zFront, look)

  // The front, open over the lobby's whole length and height, then a beam, and over the beam
  // deep fins, with the zigzag of the flights between them. A bridge leaves through a gap in the fins.
  // The first landing, at the lobby's head, has none: its deck would run through the beam. The
  // roof's leaves over the end the last flight tops out at, where the landing two below it is.
  const bridged = bridge > 0 ? landings.slice(1) : []
  const roofBridge = bridge > 0 && landings.length >= 2 ? { ...landings.at(-2), y: top } : null
  if (roofBridge) bridged.push(roofBridge)
  const zOut = zFront + finDeep
  k.block(lo - wall, hi + wall, lobby, lobby + BEAM, zFront, zOut, look)
  const fins = Math.max(1, Math.round((hi - lo) / bay))
  for (let i = 0; i <= fins; i++) {
    const x = lo + ((hi - lo) * i) / fins
    // The stretches of this fin that no bridge goes through.
    const cuts = bridged.filter((l) => x + fin / 2 > l.x0 && x - fin / 2 < l.x1).map((l) => [l.y - DECK, l.y + 4])
    let from = lobby + BEAM
    for (const [y0, y1] of [...cuts, [top + PARAPET, top + PARAPET]]) {
      if (y0 > from) k.block(x - fin / 2, x + fin / 2, from, y0, zFront, zOut, look)
      from = Math.max(from, y1)
    }
  }
  const end = zOut + bridge
  for (const l of bridged) {
    k.block(l.x0, l.x1, l.y - DECK, l.y, l.z1, end, look)
    k.block(l.x0, l.x0 + 0.4, l.y, l.y + PARAPET, l.z1, end, look)
    k.block(l.x1 - 0.4, l.x1, l.y, l.y + PARAPET, l.z1, end, look)
  }
  for (const l of landings) {
    // A lift's door on the back wall at each landing; the landing's front closed by a parapet
    // where no bridge leaves it; where one does, a door on the face it meets.
    k.door('z', zBack, 1, (l.x0 + l.x1) / 2, l.y)
    if (bridged.includes(l)) k.door('z', end + face, -1, (l.x0 + l.x1) / 2, l.y)
    else k.block(l.x0, l.x1, l.y, l.y + PARAPET, l.z1 - 0.4, l.z1, look)
  }

  // The roof: the last level, a slab over the shaft but for the hole the last flight comes up
  // through (its lane and its parapets), which then runs on across the roof to the end wall.
  // A parapet round the hole and along the front.
  const last = flights.at(-1)
  const [fx0, fx1] = [Math.min(last.foot, last.top), Math.max(last.foot, last.top)]
  const front = last.lane === 0
  const hole = { x0: fx0, x1: fx1, z0: front ? -lane / 2 - gap / 2 : zBack, z1: front ? zFront : -pitch + lane / 2 + gap / 2 }
  const slab = 0.6
  for (const [x0, x1, z0, z1] of cellsMinus([lo, hi, zBack, zFront], [hole])) k.block(x0, x1, top - slab, top, z0, z1, dim)
  const nearX = last.foot < last.top ? [hole.x0 - 0.4, hole.x0] : [hole.x1, hole.x1 + 0.4]
  const rim = gap / 2
  k.block(...nearX, top, top + PARAPET, hole.z0, front ? hole.z1 - rim : hole.z1, look)
  const [seamZ0, seamZ1] = front ? [hole.z0 - 0.4, hole.z0] : [hole.z1, hole.z1 + 0.4]
  k.block(hole.x0, hole.x1, top, top + PARAPET, seamZ0, seamZ1, look)
  const frontOpen = [...(front ? [[hole.x0, hole.x1]] : []), ...(roofBridge ? [[roofBridge.x0, roofBridge.x1]] : [])]
  for (const [x0, x1] of between(lo, hi, frontOpen)) k.block(x0, x1, top, top + PARAPET, zFront - rim, zFront, look)

  // Centre the footprint, shaft and fins, about the origin.
  const [shiftX, shiftZ] = [(lo + hi) / 2, (zBack - wall + zOut) / 2]
  for (const record of k.forms) record.at = { ...record.at, x: record.at.x - shiftX, z: record.at.z - shiftZ }
  return result(k)
}

export function hungStair(given) {
  const { long, deep, height, lane, under, every, landing, top, stop, console: pitch, look, tread, dim, sink } = withDefaults(DEFAULTS.hungStair, given)
  const k = kit(sink)
  const MARGIN = 6 // from the mass's −X end to the flight's foot
  const CONSOLE = { thick: 0.8, slope: 1.2, clear: 3 } // along X; its drop as a multiple of its reach; the least soffit it is hung under
  // The mass, then the flight along its face, and the whole centred about z = 0.
  const span = deep + lane + RIM
  const zBack = -span / 2
  const zFace = zBack + deep
  const zOuter = zFace + lane + RIM
  const { at, length, rise } = treads(height, { every, landing })
  const footX = -long / 2 + MARGIN
  const topX = footX + length
  const farX = topX + top
  k.block(-long / 2, long / 2, k.foot, height, zBack, zFace, look)
  k.flight({ foot: { x: footX, z: zFace + lane / 2 }, way: [1, 0], width: lane, y0: 0, y1: height, every, landing, under, parapets: [1], parapet: { thick: RIM, look }, look: tread })

  // The top landing, level with the roof, with its outer parapet and a stop wall across the far
  // end: he runs up with the mass on his left and turns left onto the roof.
  k.block(topX, farX, height - under, height, zFace, zFace + lane, dim)
  k.block(topX, farX, height - under, height + PARAPET, zFace + lane, zOuter, look)
  k.block(farX, farX + 0.4, height - under, height + stop, zFace, zOuter, look)
  // The roof's parapet round its edge, open where the landing meets it.
  k.block(-long / 2, long / 2, height, height + PARAPET, zBack, zBack + RIM, look)
  for (const [x0, x1] of [[-long / 2, -long / 2 + RIM], [long / 2 - RIM, long / 2]]) k.block(x0, x1, height, height + PARAPET, zBack + RIM, zFace, look)
  k.block(-long / 2 + RIM, topX, height, height + PARAPET, zFace - RIM, zFace, look)
  k.block(farX, long / 2 - RIM, height, height + PARAPET, zFace - RIM, zFace, look)

  // Consoles under the flight, triangles standing out of the face to the flight's outer edge, each
  // hung under the soffit at its lower side so that it never pokes into the slab. Where the flight
  // comes down to the ground there is nothing to hang them under, and it is left open.
  const soffit = (u) => {
    if (u >= length) return height - under
    let m = 0
    while (at[m + 1] < u) m++
    return (m + (u - at[m]) / (at[m + 1] - at[m])) * rise - under
  }
  const reach = lane + RIM
  for (let x = footX + pitch; x < farX; x += pitch) {
    const roofOf = soffit(Math.max(0, x - CONSOLE.thick / 2 - footX)) - 0.02
    if (roofOf + 0.02 < CONSOLE.clear) continue
    const drop = Math.min(CONSOLE.slope * reach, roofOf - k.foot)
    k.relief({ x, z: zFace }, [0, 1], CONSOLE.thick, [[0, roofOf - drop], [reach, roofOf], [0, roofOf]], look)
  }
  return result(k)
}

export function helixStair(given) {
  const { height, perTurn, core, inner, wall, sides, slot, ring, door, bridge, bridgeAt, doorAt, look, tread, sink } = withDefaults(DEFAULTS.helixStair, given)
  const k = kit(sink)
  const DECK = 0.6 // the top deck's thickness
  const TREAD = 0.5 // a tread's thickness
  const LIP = 0.4 // the parapet on a tread's outer edge, where the drum has no wall to keep him on
  const HEADROOM = 3 // under the top deck, where a tread comes up through it
  const WIDTH = 6 // of the bridge
  const flat = TAU / sides // one facet's angle
  const half = Math.PI / sides
  // The drum's inner facets lie `d` from the axis; a tread stops short of them. The ring and the
  // panels are made so that their faces lie on the same planes, their corners at the radii that puts them there.
  const d = inner * Math.cos(half)
  const outerAt = (plane, angle) => plane / Math.cos(angle) // the radius at which a point `angle` off a facet's middle lies on the plane `plane` out
  const rOut = d - 0.05
  const rTread = core * Math.cos(half) // a hair inside the core's flats, so that nothing is left between
  const N = Math.max(1, Math.ceil(height / RISER - 1e-6))
  const rise = height / N
  const pie = TAU / perTurn
  const turn = perTurn * rise
  const bands = Math.ceil(height / turn - 1e-6)
  const facetMiddle = (i) => (i + 0.5) * flat
  // The way in: the facets of the first band within `door` of the middle of the front (+Z).
  const around = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle)) // an angle in (−π, π]
  const open = new Set()
  const rels = []
  for (let i = 0; i < sides; i++) {
    const rel = around(facetMiddle(i) - doorAt)
    if (Math.abs(rel) < Math.PI / 2 && Math.abs(d * Math.sin(rel)) < door / 2) {
      open.add(i)
      rels.push(rel)
    }
  }
  const wayIn = rels.length ? [Math.min(...rels) - half, Math.max(...rels) + half] : [0, 0] // relative to doorAt
  const lower = doorAt + wayIn[1] // the stair begins at the way in's edge that lies on his side when he comes in
  const inWayIn = (angle) => {
    const rel = around(angle - doorAt)
    return rel > wayIn[0] && rel < wayIn[1]
  }

  // The treads: each a wedge of the spiral, a slab hung off the core, the last at the top deck's level.
  for (let i = 0; i < N; i++) {
    const y = (i + 1) * rise
    const from = lower + i * pie
    // Over the way in the drum has no wall, so the tread keeps a lip on its outer edge.
    const lipped = y <= turn + 1e-6 && inWayIn(from + pie / 2)
    const profile = lipped
      ? [[rTread, y - TREAD], [rOut, y - TREAD], [rOut, y + PARAPET], [rOut - LIP, y + PARAPET], [rOut - LIP, y], [rTread, y]]
      : [[rTread, y - TREAD], [rOut, y - TREAD], [rOut, y], [rTread, y]]
    k.form({ kind: 'lathe', at: p(0, 0, 0), smooth: false, sides: 2, arc: [from, from + pie], profile, look: tread })
  }
  // The core, and over it the top deck, a pie of the turn but for the treads that come up
  // through it with too little headroom (the last of them is the deck's own level).
  k.form({ kind: 'lathe', at: p(0, 0, 0), smooth: false, sides, profile: [[0, k.foot], [core, k.foot], [core, height - DECK], [0, height - DECK]], look })
  const cut = Math.ceil((HEADROOM + DECK) / rise - 1e-6)
  const deckFrom = lower + N * pie
  const deckSpan = TAU - cut * pie
  if (deckSpan > 0) {
    k.form({ kind: 'lathe', at: p(0, 0, 0), smooth: false, sides: Math.ceil(deckSpan / (flat / 2)), arc: [deckFrom, deckFrom + deckSpan], profile: [[0, height - DECK], [rOut, height - DECK], [rOut, height], [0, height]], look })
  }

  // The drum: a solid ring at the foot of every band after the first, panels between the rings
  // with a slot between each two, and over the top deck a solid ring a parapet high.
  const rIn = inner
  const rWall = (d + wall) / Math.cos(half)
  const wallRing = (y0, y1) => k.form({ kind: 'lathe', at: p(0, 0, 0), smooth: false, sides, profile: [[rWall, y0], [rWall, y1], [rIn, y1], [rIn, y0]], look })
  const panelHalf = Math.atan((d * Math.tan(half) - slot / 2) / d)
  const panel = (i, y0, y1) => {
    const [a, b] = [outerAt(d, panelHalf), outerAt(d + wall, panelHalf)]
    k.form({ kind: 'lathe', at: p(0, 0, 0), smooth: false, sides: 1, arc: [facetMiddle(i) - panelHalf, facetMiddle(i) + panelHalf], profile: [[b, y0], [b, y1], [a, y1], [a, y0]], look })
  }
  for (let band = 0; band < bands; band++) {
    const y0 = band * turn
    const y1 = Math.min(height, y0 + turn)
    if (band > 0) wallRing(y0, y0 + ring)
    for (let i = 0; i < sides; i++) if (band > 0 || !open.has(i)) panel(i, band === 0 ? k.foot : y0 + ring, y1)
  }
  // The top ring, and, if a bridge leaves, the gap it leaves through: the two facets either side of
  // the front's corner are cut square at the bridge's edge (a prism on the facet's own planes).
  if (!bridge) wallRing(height, height + PARAPET)
  else {
    const gap = WIDTH / 2
    const shift = Math.round((bridgeAt - Math.PI / 2) / flat) // corners of the drum from +Z
    const turned = shift * flat
    const front = sides / 4 + shift // the corner the bridge leaves at is where this facet begins
    const wrap = (i) => ((i % sides) + sides) % sides
    for (let i = 0; i < sides; i++) {
      if (i !== wrap(front - 1) && i !== wrap(front)) {
        k.form({ kind: 'lathe', at: p(0, 0, 0), smooth: false, sides: 1, arc: [i * flat, (i + 1) * flat], profile: [[rWall, height], [rWall, height + PARAPET], [rIn, height + PARAPET], [rIn, height]], look })
        continue
      }
      // Cut square at the bridge's edge in the frame where the bridge is at +Z, then turned back.
      const sign = i === wrap(front) ? -1 : 1 // the facet on the −X side is the mirror of the one on +X
      const theta = facetMiddle(sides / 4 - 1) // the +X facet's middle
      const onPlane = (plane) => {
        const u = (plane * Math.cos(theta) - gap) / Math.sin(theta)
        return [plane * Math.cos(theta) - u * Math.sin(theta), plane * Math.sin(theta) + u * Math.cos(theta)]
      }
      const corner = (radius) => [radius * Math.cos(sides / 4 * flat - flat), radius * Math.sin(sides / 4 * flat - flat)]
      const points = [corner(rIn), onPlane(d), onPlane(d + wall), corner(rWall)].map(([x, z]) => {
        const [mx, mz] = [sign * x, z]
        return [mx * Math.cos(turned) - mz * Math.sin(turned), mx * Math.sin(turned) + mz * Math.cos(turned)]
      })
      k.prism(points, height, height + PARAPET, look)
    }
    // The deck, stood in the top deck's edge a little so that its top lies 2 cm under, and its parapets.
    const [ox, oz] = [Math.cos(Math.PI / 2 + turned), Math.sin(Math.PI / 2 + turned)]
    const end = rWall + bridge
    const start = rOut - 0.6
    const slab = (from, to, y0, y1) => [[from, y0], [to, y0], [to, y1], [from, y1]]
    k.relief(p(0, 0, 0), [ox, oz], 2 * gap, slab(rOut - 1.2, end, height - DECK, height - 0.02), look)
    for (const side of [-1, 1]) {
      const lateral = side * (gap - 0.2) // along (−oz, ox)
      k.relief(p(-oz * lateral, 0, ox * lateral), [ox, oz], 0.4, slab(start, end, height - 0.02, height + PARAPET), look)
    }
  }
  return result(k)
}
