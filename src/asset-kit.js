// What every asset (`assets.js`) is made of: the scale a building is made at, the sizes a man is
// measured against, and the kit of pieces each builder pushes its records with. The builders
// are `assets.js`'s own (the scaffold's: flats, tower, house, bridge, pipes), one module a
// landmark (`asset-velasca.js`, `asset-salk.js`, `asset-sesc.js`), and the brutalist stairs and
// doorways (`asset-stairs.js`, `asset-portals.js`); `assets.js` gathers them. A builder may stand
// another's whole make in its own (`add`): a landmark's stair tower is a `towerStair`.
// Pure: no scene.

import { circle, placePoint, rect, ring, roundedRect } from './forms.js'

/**
 * How many times its real size a building is made: its masses, spans and voids, taken from the
 * real building (`docs/research/brutalism.md`). The runner is a man of 1.8 m (`parkour.js`), and
 * a building's size is read by counting what is a man's size on it, so storeys, windows, doors,
 * steps, parapets and ledges keep their real sizes: a building is bigger by more of them, never
 * by bigger ones. Three, the owner's choice of 2026-10-14.
 */
export const SCALE = 3
/** Metres between two ledges a runner pulls himself up by (`mantleReach` is 2.8): ladders and roofs keep to it. */
export const LEDGE = 2.4
/** A parapet's or a rail's height: vaulted, or pulled over. */
export const PARAPET = 1.1
/** A step's rise, under `stepUp` (0.5), so that a stair is run up. */
export const RISER = 0.45
/**
 * A door at its real size, a double one: what shows that a building is used. Never a way
 * through: whatever a runner goes through is sized from the gauge, 25 × 15 m at least.
 */
export const DOOR = { w: 2.4, h: 3 }
/** The colours of the recesses (`docs/research/brutalism.md`): never red or green. */
export const KEYBOARD = ['ochre', 'cobalt', 'turquoise', 'whitewash', 'terracotta']
export const p = (x, y, z) => ({ x, y, z })
/** A number in [0, 1) fixed by two counts: which cell of a grid gets a window, a colour or a wall. */
export const hash = (i, j) => Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1
/** A builder's parameters: its `defaults`, with what is `given` over them. */
export const withDefaults = (defaults, given = {}) => ({ ...structuredClone(defaults), ...given })
/** What a builder gives: the records, not the kit that made them. */
export const result = ({ forms, murals }) => ({ forms, murals })

const round = (v) => Math.round(v * 1000) / 1000

/**
 * A builder's records (`{ forms, murals }`, in its own frame) as they stand moved to `at`
 * (`{ x, y, z }`) and turned `yaw` radians about up, as `forms.js`'s placer turns a form: each
 * form's `at` placed and its `yaw` added to, each mural's point placed and its `yaw` added to,
 * to the millimetre. Copies. The one reading of an asset's frame: a baked asset (`bakeAsset`)
 * and a builder standing another's make (`add`) both go through it.
 */
export function placeRecords({ forms, murals }, { at, yaw = 0 }) {
  const frame = { at, yaw }
  return {
    forms: forms.map((form) => {
      const { x, y, z } = placePoint(frame, form.at)
      const turnedYaw = round((form.yaw ?? 0) + yaw)
      const placed = { ...form, at: { x: round(x), y: round(y), z: round(z) } }
      if (turnedYaw === 0) delete placed.yaw
      else placed.yaw = turnedYaw
      return placed
    }),
    murals: murals.map((mural) => {
      const { x, y, z } = placePoint(frame, mural)
      return { ...mural, x: round(x), y: round(y), z: round(z), yaw: round((mural.yaw ?? 0) + yaw) }
    }),
  }
}

/**
 * How a flight climbing `height` is laid out (`kit`'s `flight` lays it so): `n` risers of `rise`
 * (`RISER` at most), the tread after each from the foot up (`runs`: `run`, but a landing
 * `landing` deep after every `every` risers short of the top), how far each riser's foot is along
 * from the flight's (`at`, n + 1 of them, the last the top tread's far edge) and the whole
 * `length`. A slab `under` thick under it has its soffit `m * rise - under` up at `at[m]`,
 * straight between: for whatever stands under a flight, a console or a door.
 */
export function treads(height, { run = 1, every = 18, landing = 4 } = {}) {
  const n = Math.max(1, Math.ceil(height / RISER - 1e-6))
  const runs = Array.from({ length: n }, (_, i) => (i + 1 < n && (i + 1) % every === 0 ? landing : run))
  const at = [0]
  for (const r of runs) at.push(at[at.length - 1] + r)
  return { n, rise: height / n, runs, at, length: at[n] }
}

/** The right of a level way `[ox, oz]` as seen going along it: looking down +Z, +X is on the left. */
export const rightOf = ([ox, oz]) => [-oz, ox]

/**
 * The stretches of [lo, hi] left between the `taken` ones (`[from, to]`, in any order), each
 * longer than a metre: where a face is free to carry something.
 */
export function between(lo, hi, taken) {
  const free = []
  let from = lo
  for (const [a, b] of [...taken].sort((m, n) => m[0] - n[0])) {
    if (a > from) free.push([from, Math.min(a, hi)])
    from = Math.max(from, b)
  }
  if (from < hi) free.push([from, hi])
  return free.filter(([a, b]) => b - a > 1)
}

/**
 * The pieces every builder is made of, each pushing its records into the kit's lists. `foot`
 * is where what stands on the ground begins: 0, or (a builder's `sink`) far down, for a place
 * over an abyss, where a building's walls, piers and pipes go on down into the haze.
 */
export function kit(sink = 0) {
  const foot = -sink
  const forms = []
  const murals = []
  const form = (record) => forms.push(record)

  // A sharp upright box between two corners.
  const block = (x0, x1, y0, y1, z0, z1, look) =>
    form({ kind: 'sweep', at: p((x0 + x1) / 2, y0, (z0 + z1) / 2), section: rect(x1 - x0, y1 - y0, 0), path: [p(0, 0, (z0 - z1) / 2), p(0, 0, (z1 - z0) / 2)], look })
  // A plank `w` wide and `t` thick, its top along the points.
  const beam = (points, w, t, look, smooth = false) => form({ kind: 'sweep', at: p(0, 0, 0), section: rect(w, t, -t), path: points, look, smooth })
  // An upright mass with round corners: bellied at the middle, tapered at the top, leaning
  // `lean` metres toward +X as it rises, and (`crown`) its last metre drawn in 0.4 m all round so
  // that its roof's edge reads round. The roof is flat, to land on.
  function mass(x0, x1, z0, z1, y0, y1, look, { r = 6, belly = 1, taper = 1, lean = 0, crown = true, section } = {}) {
    const h = y1 - y0
    const edge = Math.min(1, h / 4)
    const w = x1 - x0
    const d = z1 - z0
    const at = (k, y, su, sv = su) => ({ x: lean * k, y, z: 0, scale: [su, sv] })
    const top = crown ? at(1, h, taper * (1 - 0.8 / w), taper * (1 - 0.8 / d)) : at(1, h, taper)
    form({
      kind: 'sweep', at: p((x0 + x1) / 2, y0, (z0 + z1) / 2), smooth: true, look,
      section: section ?? roundedRect(w, d, r),
      path: [at(0, 0, 1), at(0.45, h * 0.45, belly), at((h - edge) / h, h - edge, taper), top],
    })
  }
  const drum = (x, z, y0, y1, r, look, options = {}) => mass(x - r, x + r, z - r, z + r, y0, y1, look, { ...options, section: circle(r, 20) })
  const cupola = (x, y, z, r, look = 'brass') =>
    form({ kind: 'lathe', at: p(x, y, z), smooth: true, look, profile: [[0, 0], [r, 0], [r * 1.05, r * 0.15], [r * 0.8, r * 0.7], [r * 0.4, r * 1.0], [r * 0.12, r * 1.25], [0, r * 1.3]] })
  const tank = (x, y, z, r, h) =>
    form({ kind: 'lathe', at: p(x, y, z), smooth: true, look: 'sky', profile: [[0, 0], [r, 0], [r, h], [r * 0.85, h + r * 0.35], [r * 0.5, h + r * 0.6], [0, h + r * 0.68]] })
  // A ventilation stack, a cone flaring at its lip (the Unité's roof).
  const stack = (x, y, z, r, h) => form({ kind: 'lathe', at: p(x, y, z), smooth: true, look: 'pale', profile: [[0, 0], [r, 0], [r * 0.6, h * 0.8], [r * 0.9, h], [0, h]] })
  // A long soft box lying down, its long edges rounded, run along the longer of X and Z.
  function bar(x0, x1, y0, y1, z0, z1, look, r = 0.4) {
    const alongZ = z1 - z0 >= x1 - x0
    const half = (alongZ ? z1 - z0 : x1 - x0) / 2
    form({
      kind: 'sweep', at: p((x0 + x1) / 2, y0, (z0 + z1) / 2), smooth: true, look,
      section: roundedRect(alongZ ? x1 - x0 : z1 - z0, y1 - y0, r, 0),
      path: alongZ ? [p(0, 0, -half), p(0, 0, half)] : [p(-half, 0, 0), p(half, 0, 0)],
    })
  }
  const pipe = (points, r = 1.1, look = 'rust') => form({ kind: 'sweep', at: p(0, 0, 0), smooth: true, look, section: circle(r, 12), path: points })
  // A face is a plane: 'x' or 'z' at `at`, facing `out` (+1 or -1). A point `d` out from it, at `a` along it and `y` up.
  const onFace = (face, at, out, a, y, d) => (face === 'x' ? p(at + out * d, y, a) : p(a, y, at + out * d))
  // A box standing out of a face, from `d0` to `d1` metres out, `b0` to `b1` along it: its corners.
  const offFace = (face, at, out, b0, b1, d0, d1) => {
    const [n0, n1] = [Math.min(at + out * d0, at + out * d1), Math.max(at + out * d0, at + out * d1)]
    return face === 'x' ? [n0, n1, b0, b1] : [b0, b1, n0, n1]
  }
  // A round window on a face: a dark disc in a brass rim.
  function porthole(face, at, out, a, y, r) {
    form({ kind: 'sweep', at: p(0, 0, 0), look: 'dark', smooth: true, section: circle(r, 16), path: [onFace(face, at, out, a, y, 0), onFace(face, at, out, a, y, 0.3)] })
    form({ kind: 'sweep', at: p(0, 0, 0), look: 'brass', smooth: true, section: ring(r + 0.6, 0.7, 16), path: [onFace(face, at, out, a, y, 0), onFace(face, at, out, a, y, 0.8)] })
  }
  // A deep grid on a flat face: soft fins and floor edges `deep` out of it, the cells between set
  // back (dark glass, now and then a colour from the keyboard or a round window). `along` is the
  // span cut into `bay`s, `rise` the height cut into `floor`s. A form a cell: for a face of a few
  // dozen cells; a larger one is a `facade`.
  function grid({ face, at, out, along: [a0, a1], rise: [y0, y1], bay, floor, deep = 2.5, fin = 0.8, seed = 0 }) {
    for (let a = a0; a <= a1 + 0.01; a += bay) {
      const [x0, x1, z0, z1] = offFace(face, at, out, a - fin / 2, a + fin / 2, 0, deep)
      mass(x0, x1, z0, z1, y0, y1, 'pale', { r: 0.35, crown: false })
    }
    let j = 0
    for (let y = y0; y + floor <= y1 + 0.01; y += floor, j++) {
      const [x0, x1, z0, z1] = offFace(face, at, out, a0 + fin / 2, a1 - fin / 2, 0, deep)
      bar(x0, x1, y + floor - 0.8, y + floor, z0, z1, 'pale', 0.35)
      let i = 0
      for (let a = a0; a + bay <= a1 + 0.01; a += bay, i++) {
        const h = hash(i + seed, j)
        if (h >= 0.82) porthole(face, at, out, a + bay / 2, y + (floor - 0.8) / 2, Math.min(bay, floor) / 2 - 1.6)
        else {
          const [cx0, cx1, cz0, cz1] = offFace(face, at, out, a + fin / 2, a + bay - fin / 2, 0, 0.3)
          block(cx0, cx1, y, y + floor - 0.8, cz0, cz1, h < 0.62 ? 'dark' : KEYBOARD[Math.floor(h * 97) % KEYBOARD.length])
        }
      }
    }
  }
  // A sharp piece standing out of a face, any way the face looks: `section` is its outline as seen
  // from the side, `[[d, y], …]` counter-clockwise with d metres out from the face and y up from
  // the ground, carried `width` across the face about `base` (`{ x, z }`, a point of the face). `out`
  // is the face's outward way, `[ox, oz]` of length 1: a quarter turn or a corner's diagonal. The
  // sweep runs square to `out`, along (oz, −ox), so its right is `out` and its up is up.
  function relief(base, [ox, oz], width, section, look) {
    const [tx, tz] = [(oz * width) / 2, (-ox * width) / 2]
    form({ kind: 'sweep', at: p(0, 0, 0), look, section, path: [p(base.x - tx, 0, base.z - tz), p(base.x + tx, 0, base.z + tz)] })
  }
  // A sharp upright solid whose plan is the polygon `points` (`[[x, z], …]`, wound either way),
  // from `y0` up to `y1`: what is not a box in plan, a study's slanted bay. Up an upright path a
  // section's u is +X and v is +Z, and it must turn counter-clockwise there for its faces to look out.
  function prism(points, y0, y1, look) {
    const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length
    const cz = points.reduce((sum, [, z]) => sum + z, 0) / points.length
    const area = points.reduce((sum, [x, z], i) => {
      const [nx, nz] = points[(i + 1) % points.length]
      return sum + x * nz - nx * z
    }, 0)
    const section = points.map(([x, z]) => [x - cx, z - cz])
    form({ kind: 'sweep', at: p(cx, y0, cz), look, section: area < 0 ? section.reverse() : section, path: [p(0, 0, 0), p(0, y1 - y0, 0)] })
  }
  // A grid at a man's scale over a flat face, cheap enough to cover a megastructure: its forms
  // grow with the face's bays and storeys, never with their product, because the ground cells the
  // runner is met in (`faces.js`) hold every storey of a face at once. One pane of `glass` over the
  // whole face; a fin up the whole height at each of whole `bay`s from `a0` to `a1`, the last on
  // the face's end; a floor's edge across the whole width at the head of each of whole `floor`s;
  // and a panel over the pane only in the cells `cell(i, j)` gives a look for (i the bay from
  // `a0`, j the storey from `y0`; null for none): a loggia's colour, a wall, a shutter. Fins and
  // edges stand `deep` out, `fin` and `edge` thick, painted `look`; `soft` makes them the softened
  // kit's round ones. The face (`face`, `at`, `out`) is as for `onFace`.
  function facade({ face, at, out, along: [a0, a1], rise: [y0, y1], bay, floor, deep = 1, fin = 0.4, edge = 0.4, cell = () => null, look = 'concrete', glass = 'dark', soft = false }) {
    const PANE = 0.06
    const way = face === 'x' ? [out, 0] : [0, out]
    const point = (a) => (face === 'x' ? { x: at, z: a } : { x: a, z: at })
    const bays = Math.max(1, Math.round((a1 - a0) / bay))
    const step = (a1 - a0) / bays
    const storeys = Math.max(1, Math.round((y1 - y0) / floor))
    const rise = (y1 - y0) / storeys
    relief(point((a0 + a1) / 2), way, a1 - a0, [[0, y0], [PANE, y0], [PANE, y1], [0, y1]], glass)
    for (let i = 0; i <= bays; i++) {
      const a = a0 + i * step
      if (!soft) relief(point(a), way, fin, [[PANE, y0], [deep, y0], [deep, y1], [PANE, y1]], look)
      else {
        const [x0, x1, z0, z1] = offFace(face, at, out, a - fin / 2, a + fin / 2, PANE, deep)
        mass(x0, x1, z0, z1, y0, y1, look, { r: Math.min(0.35, fin / 2), crown: false })
      }
    }
    for (let j = 1; j <= storeys; j++) {
      const y = y0 + j * rise
      if (!soft) relief(point((a0 + a1) / 2), way, a1 - a0 - fin, [[PANE, y - edge], [deep, y - edge], [deep, y], [PANE, y]], look)
      else {
        const [x0, x1, z0, z1] = offFace(face, at, out, a0 + fin / 2, a1 - fin / 2, PANE, deep)
        bar(x0, x1, y - edge, y, z0, z1, look, Math.min(0.35, edge / 2))
      }
    }
    for (let j = 0; j < storeys; j++) {
      const y = y0 + j * rise
      for (let i = 0; i < bays; i++) {
        const paint = cell(i, j)
        if (paint) relief(point(a0 + (i + 0.5) * step), way, step - fin, [[PANE, y], [PANE + 0.15, y], [PANE + 0.15, y + rise - edge], [PANE, y + rise - edge]], paint)
      }
    }
  }
  // A box standing out of a face from `d0` to `d1` metres, `b0` to `b1` along it, `y0` to `y1` up.
  const faceBlock = (face, at, out, b0, b1, d0, d1, y0, y1, look) => {
    const [x0, x1, z0, z1] = offFace(face, at, out, b0, b1, d0, d1)
    block(x0, x1, y0, y1, z0, z1, look)
  }
  // A flight of stairs, run up: from its foot (`foot`, `{ x, z }`, the middle of its first riser's
  // line, at `y0`) up along `way` (`[ox, oz]`, level, of length 1) to `y1`, `width` across, its
  // risers `RISER` at most, its treads `run` deep, and after every `every` risers but the last a
  // landing `landing` deep: one section swept across the width. Under it, solid down to `base`
  // (`y0` unless said) when `under` is null; otherwise a slab `under` thick, its soffit following
  // each flight's slope and each landing's. `parapets` are the sides (−1 left, +1 right, as seen
  // climbing) that have a solid upstand just outside the width, `parapet.high` (`PARAPET`) over
  // the nosings and down to the same underside, `parapet.thick` (0.3) across: thick, it is a
  // monumental stair's cheek. Its top tread is level with `y1`; returns that tread's far edge's
  // middle and how far it is along from the foot, `{ x, z, y, length }`.
  function flight({ foot, way, width, y0, y1, run = 1, every = 18, landing = 4, under = null, base = y0, parapets = [], parapet = {}, look = 'cast' }) {
    const { n, rise, runs, at: D, length } = treads(y1 - y0, { run, every, landing })
    // Where a slope changes: the foot, the top, and each end of a landing.
    const bends = D.map((_, m) => m).filter((m) => m === 0 || m === n || runs[m - 1] !== runs[m])
    const floor = under == null ? [[0, base], [length, base]] : bends.map((m) => [D[m], y0 + m * rise - under])
    const steps = [[length, y1]]
    for (let i = n; i >= 1; i--) steps.push([D[i - 1], y0 + i * rise], [D[i - 1], y0 + (i - 1) * rise])
    if (under == null && base === y0) steps.pop() // its last corner is the floor's first
    relief(foot, way, width, [...floor, ...steps], look)
    const { thick = 0.3, high = PARAPET, look: wall = look } = parapet
    // Its top: the line of the nosings where its slope changes, then the top tread's far end; from the top down.
    const nosings = bends.filter((m) => m < n).map((m) => [D[m], y0 + (m + 1) * rise + high])
    nosings.push([D[n - 1], y1 + high], [length, y1 + high])
    const upstand = [...floor, ...nosings.reverse()]
    const [rx, rz] = rightOf(way)
    for (const side of parapets) {
      const e = side * (width / 2 + thick / 2)
      relief({ x: foot.x + rx * e, z: foot.z + rz * e }, way, thick, upstand, wall)
    }
    return { x: foot.x + way[0] * length, z: foot.z + way[1] * length, y: y1, length }
  }
  // A door at a man's size (`DOOR`; `wide` and `high` where a single leaf must do, or a shed's
  // goods door) on a face (`face`, `at`, `out` as for `onFace`), its middle `a` along the face and
  // its sill at `y`: a dark leaf set in a frame of `look` 0.25 wide standing out of the face, open
  // at its foot. Never a way through: it shows that a building is used.
  function door(face, at, out, a, y = 0, look = 'pale', wide = DOOR.w, high = DOOR.h) {
    const [w, h, f] = [wide / 2, high, 0.25]
    faceBlock(face, at, out, a - w, a + w, 0, 0.1, y, y + h, 'dark')
    faceBlock(face, at, out, a - w - f, a - w, 0, 0.3, y, y + h + f, look)
    faceBlock(face, at, out, a + w, a + w + f, 0, 0.3, y, y + h + f, look)
    faceBlock(face, at, out, a - w, a + w, 0, 0.3, y + h, y + h + f, look)
  }
  // A hood over a way in, heavy and sharp (Boston City Hall's): a mass standing `reach` out of a
  // face (`face`, `at`, `out`) from `a0` to `a1` along it, its underside at `y` and its top `deep`
  // over that; a fascia 0.8 m deep along its front edge, and behind the fascia its soffit lined
  // `dim`, so that under it reads dark.
  function hood({ face, at, out, along: [a0, a1], y, reach, deep, look = 'board' }) {
    const FASCIA = 0.8
    faceBlock(face, at, out, a0, a1, 0, reach, y + FASCIA, y + deep, look)
    faceBlock(face, at, out, a0, a1, reach - FASCIA, reach, y, y + FASCIA, look)
    faceBlock(face, at, out, a0, a1, 0, reach - FASCIA, y + FASCIA - 0.15, y + FASCIA, 'dim')
  }
  // Stairs that switch back up a shaft: a `flight` between each two of `levels` (heights, from the
  // foot up), by turns in two lanes `lane` wide side by side and `gap` apart. The first climbs from
  // `foot` (`{ x, z }`, its first riser's middle) along `way` (a quarter turn); the next climbs
  // back the other way in the lane on `side` of it (+1 right, −1 left, as seen climbing the
  // first); and so on. Past each flight's top a landing `landing` deep across both lanes and their
  // outer parapets, a slab `slab` thick, and, if `stop`, a wall `stop` high across its far end: a
  // runner comes up a flight at 16 m/s and runs on off an open landing into the stairwell. Each
  // flight has a solid parapet on the gap's side, half the gap thick, so that the two lanes' meet
  // back to back; and one on its lane's outer side where `outer[lane]` (lane 0 the first's). The
  // flights' soffits follow them `under` thick. With `lastLanding` false the last flight has no
  // landing or wall: it comes out through whatever is at its top, a roof. Returns the landings,
  // `[{ x0, x1, z0, z1, y }]`, for the floors they meet.
  function switchback({ foot, way, side = 1, lane, gap = 0.6, levels, landing = 6, stop = 0, slab = 0.6, under = 0.5, outer = [false, false], lastLanding = true, look = 'cast', wall = look, floor = 'dim' }) {
    const [rx, rz] = rightOf(way).map((v) => v * side) // toward the second lane
    const pitch = lane + gap // from one lane's middle to the other's
    const at = (along, c) => ({ x: foot.x + way[0] * along + rx * c, z: foot.z + way[1] * along + rz * c })
    const box = (a0, a1, c0, c1, y0, y1, look) => {
      const [P, Q] = [at(a0, c0), at(a1, c1)]
      const placed = { x0: Math.min(P.x, Q.x), x1: Math.max(P.x, Q.x), z0: Math.min(P.z, Q.z), z1: Math.max(P.z, Q.z), y: y1 }
      block(placed.x0, placed.x1, y0, y1, placed.z0, placed.z1, look)
      return placed
    }
    const [c0, c1] = [-lane / 2 - (outer[0] ? gap / 2 : 0), pitch + lane / 2 + (outer[1] ? gap / 2 : 0)] // across both lanes
    const landings = []
    let along = 0
    for (let m = 0; m + 1 < levels.length; m++) {
      const l = m % 2
      const dir = l === 0 ? 1 : -1
      // The gap is on `side` of every flight as seen climbing it: the lane and the way both turn over.
      const top = flight({ foot: at(along, l * pitch), way: [way[0] * dir, way[1] * dir], width: lane, y0: levels[m], y1: levels[m + 1], under, parapets: outer[l] ? [side, -side] : [side], parapet: { thick: gap / 2, look: wall }, look })
      along += dir * top.length
      if (!lastLanding && m + 2 === levels.length) break
      const end = along + dir * landing
      landings.push(box(along, end, c0, c1, levels[m + 1] - slab, levels[m + 1], floor))
      if (stop) box(end, end + dir * 0.4, c0, c1, levels[m + 1], levels[m + 1] + stop, wall)
    }
    return landings
  }
  // Another builder's whole make (`{ forms, murals }`, in its own frame) stood in this one: moved
  // to `at` (`{ x, y, z }`) and turned `yaw` radians, as `bakeAsset` stands an asset in a place.
  function add(built, { at, yaw = 0 }) {
    const placed = placeRecords(built, { at, yaw })
    forms.push(...placed.forms)
    murals.push(...placed.murals)
  }
  return { foot, forms, murals, form, block, beam, mass, drum, cupola, tank, stack, bar, pipe, porthole, grid, onFace, offFace, faceBlock, relief, prism, facade, flight, door, hood, switchback, add }
}

/**
 * A ladder of ledges on a flat face at z = `face` (facing +Z), from the kit `k`: soft slats
 * `LEDGE` apart from the first up to `top` - LEDGE, so that the last is pulled from onto `top`;
 * two braces across them.
 */
export function ladder(k, x0, x1, face, top) {
  const n = Math.round(top / LEDGE) - 1
  for (let i = 1; i <= n; i++) k.bar(x0, x1, i * LEDGE - 0.5, i * LEDGE, face, face + 1.6, 'pale', 0.2)
  for (const x of [x0 + (x1 - x0) / 3, x0 + (2 * (x1 - x0)) / 3]) {
    k.beam([p(x - 6, LEDGE, face + 2.1), p(x + 6, top - LEDGE, face + 2.1)], 0.5, 0.5, 'dark')
  }
}
