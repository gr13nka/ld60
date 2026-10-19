// Brutalist pieces to lay a jump line with: platforms, platforms on columns, bare columns and
// bridges, each a simple mass with one device of the buildings the owner likes (a hung slab, a
// stepped section, a core with a console, a deck between piers). A runner is 1.8 m and runs at
// 20 m/s; a level jump at that pace carries 18 m (0.7 of it, 12.6 m, is a fair gap), rises 2.8 m
// and is 0.9 s in the air (the move table, `docs/internals/parkour.md`). So:
// - the top one lands on is at `height` over the asset's foot, flat, `cast`, and at least 8 m
//   across: `at.y` and `height` together put it anywhere;
// - edges are open, to be jumped off; `parapet` stands a solid one `PARAPET` high round a top,
//   never a rail;
// - a tier or a step climbed by hand is `LEDGE` (2.4) or less, under `mantleReach` (2.8);
// - what stands on the ground goes down to `k.foot`, so that over an abyss (`sink`) a column runs
//   on down into the haze.
// Masses are grey (`board`, `cast`, `dim` for what is out of the sun); a colour only in a recess,
// from the keyboard (`KEYBOARD`), never red or green. Sharp pieces only, and a few dozen forms each.
// Platforms, standing or lifted (`at.y`):
// - `slabPlatform`: a thick slab over a plinth set back under it, a shadow round its foot.
// - `steppedPlatform`: a ziggurat of tiers, each `rise` up and set back (the Yerevan Cascade).
// - `cantileverPlatform`: a short core with a slab hung far out on one side (Tbilisi's Ministry of Highways).
// - `waffleDeck`: a coffered slab on four squat piers, its ribs deep under it, a colour in its coffers.
// - `podStack`: boxes stacked crosswise with half offsets, every roof a landing (Habitat 67).
// - `troughPlatform`: a deck sunk between two thick walls, open at both ends (SESC Pompéia's bridges).
// Platforms on columns:
// - `pierPlatform`: a square column with a slab on it, a dark reveal at the joint.
// - `mushroomColumn`: a shaft flaring into a square capital, the slab its top.
// - `consoleTree`: one core, a square slab carried on four triangular consoles (Tbilisi).
// - `twinBlades`: two blade walls with a slab across them, a portal frame (Genex; MASP).
// - `stiltDeck`: a deck on rows of thin pilotis (Boston City Hall; the Unité's).
// - `spiralLandings`: square landings round one column, each a quarter turn on and `rise` up.
// Columns only:
// - `squareColumn`: plain, an abacus on its head, fins down its faces if asked.
// - `bladeColumn`: thin and long, a wall to run along.
// - `drumColumn`: round, faceted, grooved by rings.
// - `shearedColumn`: its head cut on a slant, a slope to land on and run off.
// - `colonnade`: a row of columns, a lintel along their heads to run.
// Bridges, along Z (their yaw lays them across a gap):
// - `beamBridge`: a deck on two piers, edge beams deep under it.
// - `troughBridge`: a deck whose walls are its beams (SESC Pompéia).
// - `hungBridge`: a deck hung under a box girder on two piers (MASP; Genex).
// - `brokenBridge`: two cantilevers that stop short of each other: the gap between is the jump.
// - `steppedBridge`: spans on their own piers, each `step` up from the last: a jump line in one.
// Sourced: the devices, from `docs/research/brutalism.md`. Guessed: every size, taken from what the
// runner can do, not from the buildings. Pure: no scene.

import { hash, kit, KEYBOARD, LEDGE, p, PARAPET, result, withDefaults } from './asset-kit.js'

/** Their parameters as they are built when given none (`assets.js` hands them to the editor). Metres unless said. */
export const DEFAULTS = {
  slabPlatform: {
    wide: 14, // the slab along X
    deep: 14, // and along Z
    height: 4, // its top, over the foot
    thick: 1.8, // the slab
    inset: 1.5, // how far the plinth stands back under the slab's edge all round
    parapet: false, // a solid parapet round the top
    look: 'board', // the masses
    top: 'cast', // what is landed on
    dim: 'dim', // what is out of the sun
    sink: 0, // how far down what stands on the ground goes
  },
  steppedPlatform: {
    wide: 24,
    deep: 24,
    tiers: 4, // how many
    rise: 2.4, // what a tier climbs: pulled up by hand at `LEDGE` or less
    setback: 3, // how far each tier stands back from the one under it, all round
    look: 'board',
    top: 'cast',
    sink: 0,
  },
  cantileverPlatform: {
    core: 8, // the core, square
    reach: 16, // how far the slab hangs out past the core's front (+X)
    back: 2, // and past its back
    deep: 12, // the slab along Z
    height: 12,
    thick: 2.4, // the slab, heavy: a hung mass
    fascia: 3, // how deep the edge beam at the slab's far end hangs under it
    look: 'board',
    top: 'cast',
    dim: 'dim',
    sink: 0,
  },
  waffleDeck: {
    wide: 24,
    deep: 24,
    height: 8,
    thick: 0.8, // the slab over the ribs
    cell: 4, // from one rib to the next
    rib: 1.6, // how deep a rib hangs under the slab
    ribThick: 0.5,
    pier: 3, // a pier, square
    inset: 3, // from the slab's corner to a pier's outer face
    coffer: 'ochre', // the slab's underside between the ribs
    look: 'board',
    top: 'cast',
    sink: 0,
  },
  podStack: {
    long: 18, // a pod along its length
    wide: 8, // and across
    high: 4.8, // and up: two ledges, so that one is climbed by hand from the roof under it
    levels: 3, // pods two to a level, each level turned a quarter from the one under it
    seed: 0, // which way each level's pods are pushed along, and their colours
    look: 'board',
    top: 'cast',
    sink: 0,
  },
  troughPlatform: {
    wide: 10, // the deck between the walls
    long: 24, // along Z, open at both ends
    height: 6, // the deck
    wall: 1.2, // the walls' thickness
    upstand: 2.4, // how far they stand over the deck: a ledge, run along on their tops
    thick: 1.2, // the deck
    pier: 3, // the cross walls it stands on, along Z
    look: 'board',
    top: 'cast',
    dim: 'dim',
    sink: 0,
  },
  pierPlatform: {
    column: 4, // the column, square
    wide: 12,
    deep: 12,
    height: 24,
    thick: 1.2,
    reveal: 0.6, // the dark joint under the slab, its height and how far it stands in from the column's faces
    parapet: false,
    look: 'board',
    top: 'cast',
    dim: 'dim',
    sink: 0,
  },
  mushroomColumn: {
    shaft: 4, // the shaft, square
    cap: 14, // the capital's slab, square
    height: 24,
    flare: 5, // how far down from the slab the shaft starts to widen
    thick: 1.2,
    look: 'cast',
    top: 'cast',
    sink: 0,
  },
  consoleTree: {
    core: 5, // the core, square
    wide: 16, // the slab, square
    height: 20,
    thick: 1,
    drop: 1.2, // a console's depth at the core, as a multiple of its reach
    console: 1.2, // a console's thickness
    look: 'board',
    top: 'cast',
    sink: 0,
  },
  twinBlades: {
    gap: 26, // between the blades: a way under, 25 m at least to be flown through
    blade: 1.6, // a blade's thickness
    deep: 12, // their length along Z, and the slab's
    height: 18,
    thick: 2, // the slab
    over: 2, // how far the slab runs out past each blade
    look: 'board',
    top: 'cast',
    dim: 'dim',
    sink: 0,
  },
  stiltDeck: {
    wide: 24,
    deep: 16,
    height: 12,
    thick: 1.4,
    rows: 2, // pilotis along Z
    cols: 3, // and along X
    stilt: 1.6, // a piloti, square
    inset: 3, // from the deck's edge to the outer pilotis' middles
    fascia: 1, // the edge beam round the deck, hanging under it
    look: 'board',
    top: 'cast',
    dim: 'dim',
    sink: 0,
  },
  spiralLandings: {
    column: 6, // the column, square
    reach: 7, // how far a landing stands out past the column's faces
    landings: 6, // how many, each a quarter turn round from the last
    rise: 2.2, // each one over the last: a jump up
    first: 6, // the first one's top, over the foot
    thick: 0.8,
    look: 'board',
    top: 'cast',
    sink: 0,
  },
  squareColumn: {
    column: 5, // square
    height: 24, // its head
    cap: 1.5, // how far the abacus on its head runs out past the faces; 0 for none
    capThick: 1.2,
    fins: false, // a fin down the middle of each face
    look: 'board',
    top: 'cast',
    dim: 'dim',
    sink: 0,
  },
  bladeColumn: {
    long: 18, // along Z
    blade: 1.4, // across
    height: 30,
    plinth: 2.4, // a plinth at its foot, a ledge high, standing out round it
    look: 'board',
    top: 'cast',
    sink: 0,
  },
  drumColumn: {
    radius: 3,
    height: 24,
    sides: 12, // facets: sharp, never round
    band: 4.8, // from one groove to the next
    groove: 0.6, // a groove's height
    cut: 0.4, // and its depth
    head: 6, // the drum on its head that is landed on, its radius; 0 for none
    look: 'cast',
    dim: 'dim',
    sink: 0,
  },
  shearedColumn: {
    wide: 8, // along X, the way its head falls
    deep: 6,
    height: 24, // its high side
    fall: 4, // what its head drops across its width: a slope well under the 60° that is still ground
    look: 'board',
    top: 'cast',
    sink: 0,
  },
  colonnade: {
    count: 5, // columns
    bay: 12, // from one to the next, along Z
    column: 3, // square
    height: 16, // their heads, or the lintel's top
    lintel: 1.6, // the lintel along their heads; 0 for none
    look: 'board',
    top: 'cast',
    sink: 0,
  },
  beamBridge: {
    span: 40, // clear between the piers, along Z
    width: 8, // the deck
    height: 18, // its top
    thick: 0.8, // the deck
    beam: 2.4, // how deep the edge beams hang under it
    pier: 4, // a pier along Z
    over: 6, // how far the deck runs on past each pier
    parapet: true, // solid parapets along both sides
    look: 'board',
    top: 'cast',
    dim: 'dim',
    sink: 0,
  },
  troughBridge: {
    span: 40,
    width: 8,
    height: 18,
    thick: 0.8,
    wall: 0.6, // the walls, which are its beams
    upstand: 2.4, // how far they stand over the deck
    under: 1.6, // how far they hang under it
    pier: 4,
    over: 4,
    look: 'board',
    top: 'cast',
    sink: 0,
  },
  hungBridge: {
    span: 48,
    width: 10,
    height: 16, // the deck's top
    thick: 0.8,
    clear: 6, // from the deck up to the girder's soffit
    girder: 5, // the girder's depth
    hanger: 12, // from one hanger to the next along each edge
    pier: 6, // a pier along Z, and the girder's ends on it
    look: 'board',
    top: 'cast',
    dim: 'dim',
    sink: 0,
  },
  brokenBridge: {
    gap: 12, // between the two ends: the jump, a fair one at a run (`docs/internals/parkour.md`)
    arm: 22, // how far each end reaches out from its pier
    back: 6, // and runs back past it
    width: 8,
    height: 18,
    tip: 0.8, // the deck's depth at its end
    haunch: 3, // and at the pier
    pier: 3, // a pier along Z
    look: 'board',
    top: 'cast',
    sink: 0,
  },
  steppedBridge: {
    spans: 4, // decks
    span: 14, // one, along Z
    gap: 3, // between two, to be jumped; 0 for none
    step: 1.8, // each over the last, under a ledge
    width: 8,
    height: 12, // the first one's top
    thick: 1.2,
    pier: 3, // a pier, along Z, under each deck's middle
    look: 'board',
    top: 'cast',
    sink: 0,
  },
}

/** A parapet's thickness. */
const RIM = 0.5
/** A slab's top skin, painted apart from the mass under it: what is landed on. */
const SKIN = 0.2

// A solid of the front outline `outline` (`[[x, y], …]`, counter-clockwise looking from +Z) from z0 to z1.
const slab = (k, outline, [z0, z1], look) => k.form({ kind: 'sweep', at: p(0, 0, 0), look, section: outline, path: [p(0, 0, z1), p(0, 0, z0)] })

// A slab from x0 to x1 and z0 to z1 whose top is at `y`, `thick` deep: the mass `look`, its top `top`.
function deck(k, [x0, x1, z0, z1], y, thick, look, top) {
  k.block(x0, x1, y - thick, y - SKIN, z0, z1, look)
  k.block(x0, x1, y - SKIN, y, z0, z1, top)
}

// A solid parapet round the top at `y` of the slab [x0, x1, z0, z1], on the `sides` given ('x0', 'x1', 'z0', 'z1').
function parapets(k, [x0, x1, z0, z1], y, sides, look) {
  const up = y + PARAPET
  if (sides.includes('x0')) k.block(x0, x0 + RIM, y, up, z0, z1, look)
  if (sides.includes('x1')) k.block(x1 - RIM, x1, y, up, z0, z1, look)
  const [a, b] = [sides.includes('x0') ? x0 + RIM : x0, sides.includes('x1') ? x1 - RIM : x1]
  if (sides.includes('z0')) k.block(a, b, y, up, z0, z0 + RIM, look)
  if (sides.includes('z1')) k.block(a, b, y, up, z1 - RIM, z1, look)
}
const ALL = ['x0', 'x1', 'z0', 'z1']

// A square column `c` across about (x, z), from y0 to y1.
const column = (k, x, z, c, y0, y1, look) => k.block(x - c / 2, x + c / 2, y0, y1, z - c / 2, z + c / 2, look)

// --- Platforms ---

export function slabPlatform(given) {
  const { wide, deep, height, thick, inset, parapet, look, top, dim, sink } = withDefaults(DEFAULTS.slabPlatform, given)
  const k = kit(sink)
  const [x, z] = [wide / 2, deep / 2]
  const under = height - thick
  if (under > k.foot) k.block(-x + inset, x - inset, k.foot, under, -z + inset, z - inset, dim)
  deck(k, [-x, x, -z, z], height, Math.min(thick, height - k.foot), look, top)
  if (parapet) parapets(k, [-x, x, -z, z], height, ALL, look)
  return result(k)
}

export function steppedPlatform(given) {
  const { wide, deep, tiers, rise, setback, look, top, sink } = withDefaults(DEFAULTS.steppedPlatform, given)
  const k = kit(sink)
  let from = k.foot
  for (let i = 0; i < tiers; i++) {
    const [x, z] = [wide / 2 - i * setback, deep / 2 - i * setback]
    if (x <= 1 || z <= 1) break
    const y = (i + 1) * rise
    k.block(-x, x, from, y - SKIN, -z, z, look)
    // The skin only where the tier is landed on: the ring left round the next tier, or all of the last.
    const [nx, nz] = [x - setback, z - setback]
    if (i === tiers - 1 || nx <= 1 || nz <= 1) k.block(-x, x, y - SKIN, y, -z, z, top)
    else {
      k.block(-x, x, y - SKIN, y, -z, -nz, top)
      k.block(-x, x, y - SKIN, y, nz, z, top)
      k.block(-x, -nx, y - SKIN, y, -nz, nz, top)
      k.block(nx, x, y - SKIN, y, -nz, nz, top)
    }
    from = y
  }
  return result(k)
}

export function cantileverPlatform(given) {
  const { core, reach, back, deep, height, thick, fascia, look, top, dim, sink } = withDefaults(DEFAULTS.cantileverPlatform, given)
  const k = kit(sink)
  // Centred along X on the whole slab, the core toward −X.
  const length = back + core + reach
  const x0 = -length / 2
  const [c0, c1] = [x0 + back, x0 + back + core]
  const under = height - thick
  k.block(c0, c1, k.foot, under, -core / 2, core / 2, look)
  deck(k, [x0, length / 2, -deep / 2, deep / 2], height, thick, look, top)
  // The edge beam across the far end, and the soffit between it and the core out of the sun.
  k.block(length / 2 - 1.2, length / 2, under - fascia, under, -deep / 2, deep / 2, look)
  k.block(c1, length / 2 - 1.2, under - 0.1, under, -deep / 2, deep / 2, dim)
  return result(k)
}

export function waffleDeck(given) {
  const { wide, deep, height, thick, cell, rib, ribThick, pier, inset, coffer, look, top, sink } = withDefaults(DEFAULTS.waffleDeck, given)
  const k = kit(sink)
  const [x, z] = [wide / 2, deep / 2]
  const soffit = height - thick
  deck(k, [-x, x, -z, z], height, thick - 0.1, look, top)
  k.block(-x, x, soffit, soffit + 0.1, -z, z, coffer) // the coffers' paint, seen between the ribs
  // Ribs along X the whole width at each cell's edge; along Z only between them, so that none stands in another.
  const nx = Math.max(1, Math.round(wide / cell))
  const nz = Math.max(1, Math.round(deep / cell))
  const zs = Array.from({ length: nz + 1 }, (_, j) => -z + (deep * j) / nz)
  const xs = Array.from({ length: nx + 1 }, (_, i) => -x + (wide * i) / nx)
  const lo = soffit - rib
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
  const zRib = zs.map((zj) => [clamp(zj - ribThick / 2, -z, z - ribThick), clamp(zj + ribThick / 2, -z + ribThick, z)])
  for (const [a, b] of zRib) k.block(-x, x, lo, soffit, a, b, look)
  for (const xi of xs) {
    const [a, b] = [clamp(xi - ribThick / 2, -x, x - ribThick), clamp(xi + ribThick / 2, -x + ribThick, x)]
    for (let j = 0; j < nz; j++) k.block(a, b, lo, soffit, zRib[j][1], zRib[j + 1][0], look)
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) column(k, sx * (x - inset - pier / 2), sz * (z - inset - pier / 2), pier, k.foot, lo, look)
  return result(k)
}

export function podStack(given) {
  const { long, wide, high, levels, seed, look, top, sink } = withDefaults(DEFAULTS.podStack, given)
  const k = kit(sink)
  const PANEL = { lip: 1, proud: 0.15 } // the coloured panel on a pod's end, inside a lip of the frame
  for (let j = 0; j < levels; j++) {
    const alongX = j % 2 === 0
    const y0 = j === 0 ? k.foot : j * high
    const y1 = (j + 1) * high
    for (const side of [-1, 1]) {
      // Pushed a quarter of its length one way or the other along it: a half offset between the two.
      const shift = (hash(j + seed, side) < 0.5 ? -1 : 1) * side * (long / 4)
      const across = side * (wide / 2)
      const [x0, x1, z0, z1] = alongX
        ? [shift - long / 2, shift + long / 2, across - wide / 2, across + wide / 2]
        : [across - wide / 2, across + wide / 2, shift - long / 2, shift + long / 2]
      k.block(x0, x1, y0, y1 - SKIN, z0, z1, look)
      k.block(x0, x1, y1 - SKIN, y1, z0, z1, top)
      // A colour on the end that looks out, set in a lip of the pod's own concrete.
      const paint = KEYBOARD[Math.floor(hash(j * 7 + seed, side + 3) * KEYBOARD.length)]
      const [m0, m1] = [Math.max(y0, j * high) + PANEL.lip, y1 - PANEL.lip]
      const end = shift > 0 ? 1 : -1
      if (alongX) {
        const e = end > 0 ? x1 : x0
        k.block(...(end > 0 ? [e, e + PANEL.proud] : [e - PANEL.proud, e]), m0, m1, z0 + PANEL.lip, z1 - PANEL.lip, paint)
      } else {
        const e = end > 0 ? z1 : z0
        k.block(x0 + PANEL.lip, x1 - PANEL.lip, m0, m1, ...(end > 0 ? [e, e + PANEL.proud] : [e - PANEL.proud, e]), paint)
      }
    }
  }
  return result(k)
}

export function troughPlatform(given) {
  const { wide, long, height, wall, upstand, thick, pier, look, top, dim, sink } = withDefaults(DEFAULTS.troughPlatform, given)
  const k = kit(sink)
  const [a, b] = [wide / 2, wide / 2 + wall]
  const soffit = height - thick
  // The U, seen from its open end, swept along its length.
  slab(k, [[-b, soffit], [b, soffit], [b, height + upstand], [a, height + upstand], [a, height - SKIN], [-a, height - SKIN], [-a, height + upstand], [-b, height + upstand]], [-long / 2, long / 2], look)
  k.block(-a, a, height - SKIN, height, -long / 2, long / 2, top)
  // The two cross walls it stands on, a quarter in from each end, and the shade between them.
  for (const s of [-1, 1]) k.block(-b, b, k.foot, soffit, s * (long / 4) - pier / 2, s * (long / 4) + pier / 2, look)
  k.block(-b, b, soffit - 0.1, soffit, -long / 4 + pier / 2, long / 4 - pier / 2, dim)
  return result(k)
}

// --- Platforms on columns ---

export function pierPlatform(given) {
  const { column: c, wide, deep, height, thick, reveal, parapet, look, top, dim, sink } = withDefaults(DEFAULTS.pierPlatform, given)
  const k = kit(sink)
  const under = height - thick
  column(k, 0, 0, c, k.foot, under - reveal, look)
  column(k, 0, 0, c - 2 * reveal, under - reveal, under, dim)
  deck(k, [-wide / 2, wide / 2, -deep / 2, deep / 2], height, thick, look, top)
  if (parapet) parapets(k, [-wide / 2, wide / 2, -deep / 2, deep / 2], height, ALL, look)
  return result(k)
}

export function mushroomColumn(given) {
  const { shaft, cap, height, flare, thick, look, top, sink } = withDefaults(DEFAULTS.mushroomColumn, given)
  const k = kit(sink)
  const under = height - thick
  const neck = Math.max(k.foot, under - flare)
  // One sweep up the shaft, square, its last stretch widening to the capital's edge.
  const grow = cap / shaft
  k.form({
    kind: 'sweep', at: p(0, k.foot, 0), look,
    section: [[-shaft / 2, -shaft / 2], [shaft / 2, -shaft / 2], [shaft / 2, shaft / 2], [-shaft / 2, shaft / 2]],
    path: [{ x: 0, y: 0, z: 0, scale: [1, 1] }, { x: 0, y: neck - k.foot, z: 0, scale: [1, 1] }, { x: 0, y: under - k.foot, z: 0, scale: [grow, grow] }],
  })
  deck(k, [-cap / 2, cap / 2, -cap / 2, cap / 2], height, thick, look, top)
  return result(k)
}

export function consoleTree(given) {
  const { core, wide, height, thick, drop, console: t, look, top, sink } = withDefaults(DEFAULTS.consoleTree, given)
  const k = kit(sink)
  const under = height - thick
  column(k, 0, 0, core, k.foot, under, look)
  deck(k, [-wide / 2, wide / 2, -wide / 2, wide / 2], height, thick, look, top)
  // A console out of the middle of each face to the slab's edge, deepest at the core.
  const reach = wide / 2 - core / 2
  const depth = Math.min(drop * reach, under - k.foot)
  for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    k.relief({ x: (ox * core) / 2, z: (oz * core) / 2 }, [ox, oz], t, [[0, under - depth], [reach, under], [0, under]], look)
  }
  return result(k)
}

export function twinBlades(given) {
  const { gap, blade, deep, height, thick, over, look, top, dim, sink } = withDefaults(DEFAULTS.twinBlades, given)
  const k = kit(sink)
  const under = height - thick
  const inner = gap / 2
  for (const s of [-1, 1]) k.block(...(s > 0 ? [inner, inner + blade] : [-inner - blade, -inner]), k.foot, under, -deep / 2, deep / 2, look)
  const x = inner + blade + over
  deck(k, [-x, x, -deep / 2, deep / 2], height, thick, look, top)
  k.block(-inner, inner, under - 0.1, under, -deep / 2, deep / 2, dim)
  return result(k)
}

export function stiltDeck(given) {
  const { wide, deep, height, thick, rows, cols, stilt, inset, fascia, look, top, dim, sink } = withDefaults(DEFAULTS.stiltDeck, given)
  const k = kit(sink)
  const [x, z] = [wide / 2, deep / 2]
  const under = height - thick
  deck(k, [-x, x, -z, z], height, thick, look, top)
  // The fascia, an edge beam all round hanging under the deck, and the soffit inside it out of the sun.
  const F = 0.6
  k.block(-x, x, under - fascia, under, -z, -z + F, look)
  k.block(-x, x, under - fascia, under, z - F, z, look)
  k.block(-x, -x + F, under - fascia, under, -z + F, z - F, look)
  k.block(x - F, x, under - fascia, under, -z + F, z - F, look)
  k.block(-x + F, x - F, under - 0.1, under, -z + F, z - F, dim)
  const spread = (n, half) => (n < 2 ? [0] : Array.from({ length: n }, (_, i) => -half + inset + ((2 * (half - inset)) * i) / (n - 1)))
  for (const sx of spread(cols, x)) for (const sz of spread(rows, z)) column(k, sx, sz, stilt, k.foot, under - 0.1, look)
  return result(k)
}

export function spiralLandings(given) {
  const { column: c, reach, landings, rise, first, thick, look, top, sink } = withDefaults(DEFAULTS.spiralLandings, given)
  const k = kit(sink)
  const last = first + (landings - 1) * rise
  // The column's head is level with the last landing, landed on too.
  column(k, 0, 0, c, k.foot, last - SKIN, look)
  column(k, 0, 0, c, last - SKIN, last, top)
  // Each landing a square from the column's middle out past its corner, the next a quarter turn
  // round (counter-clockwise from above), so that two in turn meet along an edge, one `rise` over
  // the other: an L of two boxes, the quarter of the column left out of it.
  const e = c / 2 + reach
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]]
  for (let i = 0; i < landings; i++) {
    const [sx, sz] = corners[i % 4]
    const y = first + i * rise
    const [z0, z1] = sz > 0 ? [0, e] : [-e, 0]
    const outX = sx > 0 ? [c / 2, e] : [-e, -c / 2]
    const inX = sx > 0 ? [0, c / 2] : [-c / 2, 0]
    const outZ = sz > 0 ? [c / 2, e] : [-e, -c / 2]
    k.block(...outX, y - thick, y - SKIN, z0, z1, look)
    k.block(...inX, y - thick, y - SKIN, ...outZ, look)
    k.block(...outX, y - SKIN, y, z0, z1, top)
    k.block(...inX, y - SKIN, y, ...outZ, top)
  }
  return result(k)
}

// --- Columns only ---

export function squareColumn(given) {
  const { column: c, height, cap, capThick, fins, look, top, dim, sink } = withDefaults(DEFAULTS.squareColumn, given)
  const k = kit(sink)
  const FIN = { thick: 0.8, out: 1.2 }
  const shaftTop = cap > 0 ? height - capThick - 0.4 : height - SKIN
  column(k, 0, 0, c, k.foot, shaftTop, look)
  if (fins) {
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [x0, x1] = ox ? (ox > 0 ? [c / 2, c / 2 + FIN.out] : [-c / 2 - FIN.out, -c / 2]) : [-FIN.thick / 2, FIN.thick / 2]
      const [z0, z1] = oz ? (oz > 0 ? [c / 2, c / 2 + FIN.out] : [-c / 2 - FIN.out, -c / 2]) : [-FIN.thick / 2, FIN.thick / 2]
      k.block(x0, x1, k.foot, shaftTop, z0, z1, look)
    }
  }
  if (cap > 0) {
    column(k, 0, 0, c - 0.8, shaftTop, height - capThick, dim)
    const w = c + 2 * cap
    deck(k, [-w / 2, w / 2, -w / 2, w / 2], height, capThick, look, top)
  } else column(k, 0, 0, c, shaftTop, height, top)
  return result(k)
}

export function bladeColumn(given) {
  const { long, blade, height, plinth, look, top, sink } = withDefaults(DEFAULTS.bladeColumn, given)
  const k = kit(sink)
  const OUT = 1.2
  if (plinth > 0) {
    k.block(-blade / 2 - OUT, blade / 2 + OUT, k.foot, plinth - SKIN, -long / 2 - OUT, long / 2 + OUT, look)
    k.block(-blade / 2 - OUT, blade / 2 + OUT, plinth - SKIN, plinth, -long / 2 - OUT, long / 2 + OUT, top)
  }
  k.block(-blade / 2, blade / 2, plinth > 0 ? plinth : k.foot, height - SKIN, -long / 2, long / 2, look)
  k.block(-blade / 2, blade / 2, height - SKIN, height, -long / 2, long / 2, top)
  return result(k)
}

export function drumColumn(given) {
  const { radius: r, height, sides, band, groove, cut, head, look, dim, sink } = withDefaults(DEFAULTS.drumColumn, given)
  const k = kit(sink)
  const HEAD = 1.2 // the head drum's thickness
  const shaftTop = head > 0 ? height - HEAD : height
  // Up the outside, in at each groove; a groove `band` apart from the foot of the column's own
  // ground (0) up, none within a band of the top.
  const profile = [[0, k.foot], [r, k.foot]]
  for (let y = band; y + groove < shaftTop - band / 2; y += band) profile.push([r, y], [r - cut, y], [r - cut, y + groove], [r, y + groove])
  profile.push([r, shaftTop], [0, shaftTop])
  k.form({ kind: 'lathe', at: p(0, 0, 0), smooth: false, sides, profile, look })
  if (head > 0) {
    // The head's underside out of the sun, a ring round the shaft, and the head over it.
    k.form({ kind: 'lathe', at: p(0, 0, 0), smooth: false, sides, profile: [[r, shaftTop], [head, shaftTop], [head, shaftTop + 0.1], [r, shaftTop + 0.1]], look: dim })
    k.form({ kind: 'lathe', at: p(0, 0, 0), smooth: false, sides, profile: [[0, shaftTop], [r, shaftTop], [r, shaftTop + 0.1], [head, shaftTop + 0.1], [head, height], [0, height]], look })
  }
  return result(k)
}

export function shearedColumn(given) {
  const { wide, deep, height, fall, look, top, sink } = withDefaults(DEFAULTS.shearedColumn, given)
  const k = kit(sink)
  const [x, lo] = [wide / 2, height - fall]
  slab(k, [[-x, k.foot], [x, k.foot], [x, height - SKIN], [-x, lo - SKIN]], [-deep / 2, deep / 2], look)
  slab(k, [[-x, lo - SKIN], [x, height - SKIN], [x, height], [-x, lo]], [-deep / 2, deep / 2], top)
  return result(k)
}

export function colonnade(given) {
  const { count, bay, column: c, height, lintel, look, top, sink } = withDefaults(DEFAULTS.colonnade, given)
  const k = kit(sink)
  const length = (count - 1) * bay
  const head = lintel > 0 ? height - lintel : height
  for (let i = 0; i < count; i++) {
    const z = -length / 2 + i * bay
    column(k, 0, z, c, k.foot, lintel > 0 ? head : height - SKIN, look)
    if (lintel <= 0) column(k, 0, z, c, height - SKIN, height, top)
  }
  if (lintel > 0) deck(k, [-c / 2, c / 2, -length / 2 - c / 2, length / 2 + c / 2], height, lintel, look, top)
  return result(k)
}

// --- Bridges, along Z ---

export function beamBridge(given) {
  const { span, width, height, thick, beam, pier, over, parapet, look, top, dim, sink } = withDefaults(DEFAULTS.beamBridge, given)
  const k = kit(sink)
  const [x, z] = [width / 2, span / 2 + pier + over]
  const soffit = height - thick
  deck(k, [-x, x, -z, z], height, thick, look, top)
  const B = 0.6 // an edge beam's width
  for (const s of [-1, 1]) k.block(...(s > 0 ? [x - B, x] : [-x, -x + B]), soffit - beam, soffit, -z, z, look)
  k.block(-x + B, x - B, soffit - 0.1, soffit, -z, z, dim)
  for (const s of [-1, 1]) {
    const [z0, z1] = s > 0 ? [span / 2, span / 2 + pier] : [-span / 2 - pier, -span / 2]
    k.block(-x, x, k.foot, soffit - beam, z0, z1, look)
    k.block(-x + B, x - B, soffit - beam, soffit - 0.1, z0, z1, look) // up between the beams to the soffit
  }
  if (parapet) parapets(k, [-x, x, -z, z], height, ['x0', 'x1'], look)
  return result(k)
}

export function troughBridge(given) {
  const { span, width, height, thick, wall, upstand, under, pier, over, look, top, sink } = withDefaults(DEFAULTS.troughBridge, given)
  const k = kit(sink)
  const [a, b, z] = [width / 2, width / 2 + wall, span / 2 + pier + over]
  const soffit = height - thick
  const low = soffit - under
  slab(k, [[-b, low], [-a, low], [-a, soffit], [a, soffit], [a, low], [b, low], [b, height + upstand], [a, height + upstand], [a, height - SKIN], [-a, height - SKIN], [-a, height + upstand], [-b, height + upstand]], [-z, z], look)
  k.block(-a, a, height - SKIN, height, -z, z, top)
  for (const [z0, z1] of [[span / 2, span / 2 + pier], [-span / 2 - pier, -span / 2]]) k.block(-b, b, k.foot, low, z0, z1, look)
  return result(k)
}

export function hungBridge(given) {
  const { span, width, height, thick, clear, girder, hanger, pier, look, top, dim, sink } = withDefaults(DEFAULTS.hungBridge, given)
  const k = kit(sink)
  const [x, z] = [width / 2, span / 2]
  const soffit = height - thick
  const g0 = height + clear
  const g1 = g0 + girder
  deck(k, [-x, x, -z, z], height, thick, look, top)
  k.block(-x, x, soffit - 0.1, soffit, -z, z, dim)
  // The girder over the deck's whole length and the piers', and the piers from the ground to it.
  k.block(-x, x, g0 + 0.1, g1, -z, z, look)
  for (const [z0, z1] of [[-z - pier, -z], [z, z + pier]]) k.block(-x, x, g0, g1, z0, z1, look)
  k.block(-x, x, g0, g0 + 0.1, -z, z, dim)
  for (const s of [-1, 1]) k.block(-x, x, k.foot, g0, ...(s > 0 ? [z, z + pier] : [-z - pier, -z]), look)
  // Hangers down each edge from the girder to the deck, a man's rail between them.
  const H = 0.8
  const n = Math.max(1, Math.round(span / hanger))
  for (let i = 1; i < n; i++) {
    const at = -z + (span * i) / n
    for (const s of [-1, 1]) k.block(...(s > 0 ? [x - H, x] : [-x, -x + H]), height, g0, at - H / 2, at + H / 2, look)
  }
  return result(k)
}

export function brokenBridge(given) {
  const { gap, arm, back, width, height, tip, haunch, pier, look, top, sink } = withDefaults(DEFAULTS.brokenBridge, given)
  const k = kit(sink)
  const g = gap / 2
  const at = g + arm // a pier's middle
  const end = at + back
  // Each half seen from the side, its depth growing from the tip to the pier and held behind it,
  // swept across the width, the one toward +Z and its mirror toward −Z.
  for (const out of [[0, 1], [0, -1]]) {
    k.relief({ x: 0, z: 0 }, out, width, [[g, height - tip], [at, height - haunch], [end, height - haunch], [end, height - SKIN], [g, height - SKIN]], look)
    k.relief({ x: 0, z: 0 }, out, width, [[g, height - SKIN], [end, height - SKIN], [end, height], [g, height]], top)
    const s = out[1]
    k.block(-width / 2, width / 2, k.foot, height - haunch, s * at - pier / 2, s * at + pier / 2, look)
  }
  return result(k)
}

export function steppedBridge(given) {
  const { spans, span, gap, step, width, height, thick, pier, look, top, sink } = withDefaults(DEFAULTS.steppedBridge, given)
  const k = kit(sink)
  const length = spans * span + (spans - 1) * gap
  const x = width / 2
  // The first deck at −Z, each next one further on along +Z and `step` higher.
  for (let i = 0; i < spans; i++) {
    const z0 = -length / 2 + i * (span + gap)
    const y = height + i * step
    // Where two decks meet with no gap, the higher stands on the lower's end, never in it.
    deck(k, [-x, x, z0, z0 + span], y, thick, look, top)
    k.block(-x + 1, x - 1, k.foot, y - thick, z0 + span / 2 - pier / 2, z0 + span / 2 + pier / 2, look)
  }
  return result(k)
}
