// SESC Pompéia (Lina Bo Bardi, São Paulo, 1977–86): a 1930s factory made a leisure centre, and
// behind its sheds a sports block of two concrete towers tied by footbridges across a strip where
// a buried stream forbade building, a water tower beside them. The owner liked it in the
// brutalism gallery (`docs/research/brutalism.md`): mass that bridges. Made at the game's scale
// (`SCALE`, 3×) by the rule of `asset-kit.js`, with this reading of it: the towers' masses, their
// rooms (voids), every opening, the span, the street and the water tower are three times São
// Paulo's; rails, doors and the sheds' halls are their own size. Sharp, as her concrete is:
// `block`s, panels and sweeps, never `mass`.
//
// The owner, of the first make (holes of a man's size dotting a box, fifteen thin bridges, in a
// pale mist): "looks bad and not even close that brutal... the overall buildings doesnt look
// very impressive"; then of the second (a hollow courts tower with holes three times the size,
// a solid lockers tower dotted with a man's windows, eight bridges 5 m wide, a beige light):
// "the colors and size are weird", and, asked, the towers too squat, the bridges too thin, the
// two towers' openings at two scales. So both towers are hollow, at one scale, and taller than
// they are wide.
//
// Its axis is the strip, along Z at x = 0: the towers stand either side of it at the back, the
// bridges cross it, a wooden deck lies in it, and the water tower ends it behind; in front the
// factory's inner street runs on along the axis between the sheds. Its front (+Z) is the street's
// end. The footprint is centred along Z; along X its 0 stays the strip's middle.
// - Both towers hollow (`hollowTower`): walls `wall` thick, board outside and `dim` inside, so a
//   room seen through an opening is dark; on the three faces away from the strip a row of panels
//   a storey, each but a few cut through by an opening (`blob`, a hole, wide and rounded; squarer
//   and smaller on the lockers); on the strip, cut where the bridges come in; a floor a storey and
//   a roof behind a parapet. Each has a way in at the ground (the owner: "I dont see how I can
//   enter these buildings") on its front toward the street and on the strip off the deck, as large
//   as the ground storey and the front's panels let it be, its reveal lined dark (`WAY_IN`).
// - The courts tower (+X): a pool's hall (the pool in it), then `courts` court halls, each used
//   (the owner: "add a human walkable inside arc of some kind, like these buildings are actualy
//   used by people"), and each its own ("the weird basketball and the spiral are cool, but only
//   once"): a gallery halfway up along the strip behind an orange rail, and on the floor one of
//   `uses`, each with its own way from the floor up to the gallery: a basketball court and a
//   spiral ramp; volleyball and bleachers; a climbing wall in tiers; gymnastics and a stair in
//   two flights (`switchback`). So a man comes in off the front bridge, gets up to the gallery the hall's way
//   and leaves by the back bridge. A quarter of its holes are shut by Lina's lattice, orange
//   slats set back in the wall; on its end, over its last two halls, the mosaic (`mosaic`).
// - The lockers tower (−X): storeys half a hall high, `lockersOver` halls taller, an orange duct up
//   its back and over its parapet; inside, the way up: stairs along its far wall from the ground
//   to the roof (`switchback`), a flight a storey in two lanes 6 m wide by turns, their solid
//   parapets back to back, a landing at each floor ending in a wall, the last flight coming out
//   through the roof in a stair house. On the roof ("there MUST be something
//   interesting at the very top") the jump-off deck, `jumpOff` out over the strip at 160 m.
// - The bridges, a pair for each court: the front lane's from the court's floor up to the lockers
//   storey half a hall higher, the back lane's from the court's gallery down to the lockers storey
//   level with the court, so that from the front each pair crosses in an X, about 11° at the
//   defaults, to run up. Each is a plain beam, as in São Paulo: a trough whose walls are its sides,
//   sloping from face to face, its last metre level and buried in each wall, which is cut only by
//   its walkway's door; under its end at the lockers tower a console. Cast smooth (`cast`), as the
//   ramps, the stairs and the water tower are: formwork's level lines cut across a slope ("the
//   squared texture is cut with diagonal bridges look ugly").
// - The deck in the strip, from the water tower's foot to the sheds; the water tower ringed at
//   every pour, where the concrete oozed out of the joint, its head a little wider.
// - In front (`sheds`), the sheds either side of the inner street: `halls` gabled brick halls
//   side by side, their roofs pale with a skylight down each slope, tall windows and orange doors
//   along the street, a big window in each gable end to the front, a door to the yard behind.
// Lina's red (rails, ducts, frames, lattices) is a dull orange here: red is what blows up.
// Sourced (`research_notes/Brutalism for 3D modelling/`): two board-marked concrete sports
// towers; eight prestressed footbridges spanning up to 25 m; a cylindrical water tower of about
// 70 m, cast with "oozing" joints; irregular "globular" windows; red on rails, ducts, frames and
// windows against grey concrete and the old sheds' reddish brick. The building as generally
// known, with no source in the repo: the pool and four courts stacked in the bigger tower, the
// changing rooms over eleven floors in the narrower, the bridges in crossing pairs, the lattices
// in the holes, the deck over the stream, the sheds along an inner street. Estimated: every other
// size (the towers 22 × 28 and 12 × 28 m, the pool's hall 6 m and a court's 9.3 m, a hole about
// 5 × 3 m and a lockers window 1.5 × 1.2 m, the walls 0.4 m, the water tower 8 m across, a hall
// of the sheds 16 m, the street 12 m), the galleries and the water tower's head. Game scale: a
// span of 75 m (3.75 s of glide at 20 m/s), the courts tower 66 × 84 m and 131 m high, the
// lockers tower 36 m wide and 160 m high, the water tower 210 m, the sheds 210 m long.
// Forms: about 1,020 at the defaults: the towers' walls about 450 (a panel each, two skins), the
// lattices' slats about 120, the halls' uses about 90, the stairs about 45, the bridges and
// consoles 16, the roof's stair house and deck 10, the sheds about 190.
// Pure: no scene.

import { KEYBOARD, LEDGE, PARAPET, SCALE, between, hash, kit, p, result, treads, withDefaults } from './asset-kit.js'
import { circle } from './forms.js'

/** Its parameters as it is built when given none (`assets.js` hands them to the editor). Metres unless said. */
export const DEFAULTS = {
  pool: 6 * SCALE, // height of the pool's hall at the courts tower's foot: a room, so three times São Paulo's
  court: 28, // height of a court's hall, about three times São Paulo's 9.3 m; a lockers storey is half of it
  courts: 4, // court halls stacked over the pool, as in São Paulo, each with its pair of bridges
  courtsWide: 22 * SCALE, // the courts tower across the strip (X)
  lockersWide: 12 * SCALE, // the lockers tower across it
  deep: 28 * SCALE, // both towers along it (Z)
  lockersOver: 1, // court halls the lockers tower rises over the courts tower: one at least
  wall: 1.2, // thickness of the towers' walls, the openings' reveals: three times 0.4 m
  hole: [15, 8.5], // a courts hole's width and height before `hash` varies them, three times Lina's
  holeStretch: 30, // the stretch of a courts wall a panel spans, each with at most one hole
  window: [4.5, 3.6], // a lockers window's, three times São Paulo's
  windowStretch: 12, // the stretch of a lockers wall a panel spans
  shut: 0.25, // share of the courts holes shut by their lattice
  gap: 25 * SCALE, // the strip between the towers: the bridges' span
  lane: 15, // how far each lane of bridges is from the towers' middle along Z
  bridge: 8, // width of a bridge, over the outer faces of its walls
  beam: 4, // how far a bridge's walls, its beams, reach below its deck's top
  waterTower: 70 * SCALE, // height of the water tower
  waterRadius: 4 * SCALE, // its radius
  pour: 2.4, // height of one pour of its concrete, from one oozing joint to the next
  sheds: true, // the factory's sheds either side of the inner street, in front
  street: 12 * SCALE, // width of the inner street
  shedLength: 70 * SCALE, // a shed along the street
  halls: 4, // gabled halls in a shed, side by side, each its own size
  hallWide: 16, // one hall across
  eave: 7, // height of a hall's walls
  ridge: 11, // height of its ridge
  yard: 12 * SCALE, // between the towers and the sheds, and between the towers and the water tower
  uses: ['basketball', 'volleyball', 'climbing', 'gymnastics'], // what each court hall holds, from the bottom up, each with its own way up to its gallery
  jumpOff: 25, // how far the deck on the lockers tower's roof reaches out over the strip
  mosaic: 'seraph', // the picture high on the courts tower's end (`murals.js`)
}

const LINING = 0.3 // the dark inner skin of the towers' walls
const SLAB = 1.5 // a floor's, a gallery's and a roof's thickness
const GALLERY = 10 // how far a court's gallery reaches in from the strip's wall
const WALKWAY = 4 // the height of the door a bridge's walkway goes in by, between its walls
const WAY_IN = { wide: 24, tall: 15, lockers: 9.6 } // a way in at the ground, clear inside its lining: its width and height, and the lockers' front's width, held to one of that face's panels
const WAY_LINING = 0.3 // the dark lining round a way in's jambs and head
const STAIR = { lane: 6, gap: 0.6, from: 20, landing: 6, stop: 3.5 } // the stairs: a flight's width, the gap between two lanes, where the lockers' first begins along Z, a landing's depth, the height of the wall that ends it
const CONSOLE = [1.8, 2.5] // how far a console under a bridge's end stands out of the lockers tower, and how tall it is
const SLAT = [0.25, 0.6] // a lattice's slat: its height, and from one to the next
const RAMP = { r: 12, width: 3, grade: 0.12, steps: 64 } // a court's ramp: the radius of its turns, its width, its rise a metre along (7°, a walk), the pieces of its curve
const HEAD = 1.15 // how much wider the water tower's head is than its shaft

// An irregular rounded outline about (`u`, `y`), `w` across and `h` tall, its radii jittered by
// `seed`: one of Lina's openings, the same seed giving the same shape at any size; `square`, the
// power its round is bent by, under 1 toward a rectangle. Counter-clockwise, as a panel's outline is.
function blob(seed, w, h, y, u = 0, square = 0.6, n = 9) {
  const bend = (c) => Math.sign(c) * Math.abs(c) ** square
  return Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n
    const r = 0.8 + 0.2 * hash(seed, 40 + i)
    return [u + (w / 2) * r * bend(Math.cos(angle)), y + (h / 2) * r * bend(Math.sin(angle))]
  })
}

// The stretch of u a closed outline covers at the height `y`: [least, most], or null.
function chord(outline, y) {
  const us = []
  outline.forEach(([u0, v0], i) => {
    const [u1, v1] = outline[(i + 1) % outline.length]
    if ((v0 <= y && v1 > y) || (v1 <= y && v0 > y)) us.push(u0 + ((y - v0) / (v1 - v0)) * (u1 - u0))
  })
  return us.length >= 2 ? [Math.min(...us), Math.max(...us)] : null
}

// A rectangle on a face, `a` either side of `u` and from `y0` up to `y1`. Counter-clockwise.
const box = (a, y0, y1, u = 0) => [[u - a, y0], [u + a, y0], [u + a, y1], [u - a, y1]]

// A trough's section, a bridge's or a ramp's: a deck between two walls `wall` thick, `a` either
// side of the path, from `deep` under the deck's top to a rail's height over it.
const trough = (a, wall, deep) => [[-a, -deep], [a, -deep], [a, PARAPET], [a - wall, PARAPET], [a - wall, 0], [-a + wall, 0], [-a + wall, PARAPET], [-a, PARAPET]]

// The points beside a path of `points`, `e` metres to its right (the way a sweep's u runs along
// it: (−tz, tx) of its level tangent) and `dy` up: a rail along a curved trough's wall.
function alongside(points, e, dy) {
  return points.map((point, i) => {
    const [a, b] = [points[Math.max(0, i - 1)], points[Math.min(points.length - 1, i + 1)]]
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    return p(point.x - ((b.z - a.z) / length) * e, point.y + dy, point.z + ((b.x - a.x) / length) * e)
  })
}

export function sesc(given) {
  const { pool, court, courts, courtsWide, lockersWide, deep, lockersOver, wall, hole, holeStretch, window, windowStretch, shut, gap, lane, bridge, beam, waterTower, waterRadius, pour, sheds, street, shedLength, halls, hallWide, eave, ridge, yard, uses, jumpOff, mosaic } = withDefaults(DEFAULTS, given)
  const k = kit()
  const g = gap / 2
  const D = deep / 2
  const half = court / 2 // a court's gallery over its floor, a lockers storey, and the rise of a bridge
  const t = wall + LINING // a wall through
  const XA = g + courtsWide // the courts tower's far face
  const XB = -g - lockersWide // the lockers tower's far face
  const yA = pool + courts * court // the courts tower's walls' top, under its roof
  const yB = yA + Math.max(1, lockersOver) * court // the lockers tower's
  const T = 0.6 // a parapet's thickness
  const waterZ = -D - yard - waterRadius // the water tower's middle

  // A flat piece lying on a face, any outline: `outline` is `[[u, y], …]` (or `{ outer, inner }`)
  // in the face's plane, u metres from `base` (`{ x, z }`, a point of the face) and y up from the
  // ground, carried from `d0` to `d1` metres out along `out` (`[ox, oz]`, of length 1; less than 0
  // is into the face). The sweep runs out along `out`, so its right, the way u runs, is (−oz, ox):
  // leftward as the face is looked at. Counter-clockwise, an inner outline clockwise.
  const panel = (base, [ox, oz], outline, d0, d1, look) =>
    k.form({ kind: 'sweep', at: p(0, 0, 0), look, section: outline, path: [p(base.x + ox * d0, 0, base.z + oz * d0), p(base.x + ox * d1, 0, base.z + oz * d1)] })
  // How far a face's point `a` along it is from its point `mid`, the way a panel's u runs there.
  const uOff = (face, a, mid) => {
    const [P, M] = [face.at(a), face.at(mid)]
    return (P.x - M.x) * -face.out[1] + (P.z - M.z) * face.out[0]
  }
  // A dark window `w` wide from `y0` to `y1`, in a frame of `look` 0.4 wide all round.
  function framed(base, out, w, y0, y1, look) {
    const f = 0.4
    panel(base, out, { outer: box(w / 2 + f, y0 - f, y1 + f), inner: box(w / 2, y0, y1).reverse() }, 0, 0.25, look)
    panel(base, out, box(w / 2, y0, y1), 0, 0.1, 'dark')
  }
  // A court's floor at a man's size on a floor at `y`, `L` either side of `z` along Z and `W` of
  // `x` across, painted `look` and lined in white round its edge and across its middle: its paint's
  // top, and `stripe(x0, x1, z0, z1)` for its own lines.
  const LINE = 0.08
  function courtFloor(x, z, y, L, W, look) {
    const top = y + 0.02
    k.block(x - W, x + W, y, top, z - L, z + L, look)
    const stripe = (x0, x1, z0, z1) => k.block(x0, x1, top, top + 0.01, z0, z1, 'whitewash')
    stripe(x - W, x + W, z - L, z - L + LINE)
    stripe(x - W, x + W, z + L - LINE, z + L)
    stripe(x - W, x - W + LINE, z - L + LINE, z + L - LINE)
    stripe(x + W - LINE, x + W, z - L + LINE, z + L - LINE)
    stripe(x - W + LINE, x + W - LINE, z - LINE / 2, z + LINE / 2)
    return { top, stripe }
  }
  const span = (a, b) => [Math.min(a, b), Math.max(a, b)]
  // A dark opening's orange frame, open at its foot: `width` across, from `y` up `height`, on a face.
  function frame(base, out, width, y, height) {
    const [a, f] = [width / 2, 0.6]
    panel(base, out, [[-a - f, y], [-a, y], [-a, y + height], [a, y + height], [a, y], [a + f, y], [a + f, y + height + f], [-a - f, y + height + f]], 0, 0.3, 'orange')
  }
  // A way in cut through a tower's wall at `base` looking `out`, `[u0, u1]` across the face (a
  // panel's u) from the ground to its head at `head`: its jambs and its head lined `WAY_LINING` of
  // `dim` through the whole wall, so that it reads as a hole and not as a door painted on, and an
  // orange frame round it, as Lina framed hers.
  function wayInLined(base, out, [u0, u1], head) {
    const L = WAY_LINING
    panel(base, out, box(L / 2, 0, head - L, u0 + L / 2), -t, 0, 'dim')
    panel(base, out, box(L / 2, 0, head - L, u1 - L / 2), -t, 0, 'dim')
    panel(base, out, box((u1 - u0) / 2, head - L, head, (u0 + u1) / 2), -t, 0, 'dim')
    frame({ x: base.x + -out[1] * (u0 + u1) / 2, z: base.z + out[0] * (u0 + u1) / 2 }, out, u1 - u0, 0, head)
  }
  // A parapet round a roof at `y` from `x0` to `x1` and across the towers' depth, open on the side
  // at x = `strip` where `open` (`[from, to]` along Z) says.
  function parapet(x0, x1, y, strip = null, open = []) {
    k.block(x0, x1, y, y + PARAPET, D - T, D, 'board')
    k.block(x0, x1, y, y + PARAPET, -D, -D + T, 'board')
    for (const [a, b] of [[x0, x0 + T], [x1 - T, x1]]) {
      const gaps = (strip === x0 && a === x0) || (strip === x1 && b === x1) ? open : []
      for (const [c, d] of between(-D + T, D - T, gaps)) k.block(a, b, y, y + PARAPET, c, d, 'board')
    }
  }

  // A storey's wall along a face, a panel at a time: board outside, `dim` inside, each panel cut
  // through by an opening somewhere in it (by `hash`), or now and then blank, and always where it
  // meets a `plain` stretch (`[from, to, above]` along the face, on the storeys from the height
  // `above` up, or all of them). A `shut` share of the openings are
  // closed by a lattice: orange slats, each as wide as the opening at its height, set back in it.
  // On the ground storey a panel holding one of the `entrances` (`{ a, width, height }`, its
  // middle along the face, clear inside its lining) is notched from the ground up, lined and
  // framed (`wayInLined`), and has no opening besides.
  function holedWall(face, y0, y1, seed, { size: [W, H], stretch, square, shut = 0, plain = [], entrances = [] }) {
    const n = Math.max(1, Math.round((face.to - face.from) / stretch))
    const step = (face.to - face.from) / n
    for (let i = 0; i < n; i++) {
      const s = seed + i * 7
      const [a0, a1] = [face.from + i * step, face.from + (i + 1) * step]
      const mid = (a0 + a1) / 2
      const base = face.at(mid)
      const [l0, l1] = [Math.max(a0, face.inner[0]), Math.min(a1, face.inner[1])]
      const [lu, la] = [uOff(face, (l0 + l1) / 2, mid), (l1 - l0) / 2] // the lining's middle and half its span
      const outer = box(step / 2, y0, y1)
      const lining = box(la, y0, y1, lu)
      const entrance = y0 === 0 && entrances.find(({ a, width }) => a - width / 2 - WAY_LINING >= a0 + 0.5 && a + width / 2 + WAY_LINING <= a1 - 0.5)
      if (entrance) {
        const cut = entrance.width / 2 + WAY_LINING
        const [n0, n1] = [uOff(face, entrance.a - cut, mid), uOff(face, entrance.a + cut, mid)].sort((m, q) => m - q)
        const head = entrance.height + WAY_LINING
        const notched = (ua, ub) => [[ua, y0], [n0, y0], [n0, head], [n1, head], [n1, y0], [ub, y0], [ub, y1], [ua, y1]]
        panel(base, face.out, notched(-step / 2, step / 2), -wall, 0, 'board')
        panel(base, face.out, notched(lu - la, lu + la), -t, -wall, 'dim')
        wayInLined(base, face.out, [n0, n1], head)
        continue
      }
      if (hash(s, 0) < 0.15 || plain.some(([from, to, above = -Infinity]) => from < a1 && to > a0 && y0 >= above)) {
        panel(base, face.out, outer, -wall, 0, 'board')
        panel(base, face.out, lining, -t, -wall, 'dim')
        continue
      }
      const [w, h] = [W * (0.75 + 0.5 * hash(s, 1)), H * (0.8 + 0.4 * hash(s, 2))]
      const at = mid + (hash(s, 3) - 0.5) * Math.max(0, step - w - 4) // two metres of wall at least either side
      const y = y0 + (y1 - y0) * (0.4 + 0.2 * hash(s, 4))
      const opening = blob(s, w, h, y, uOff(face, at, mid), square)
      panel(base, face.out, { outer, inner: [...opening].reverse() }, -wall, 0, 'board')
      panel(base, face.out, { outer: lining, inner: [...opening].reverse() }, -t, -wall, 'dim')
      if (hash(s, 5) >= shut) continue
      for (let v = y - h / 2 + SLAT[1] / 2; v + SLAT[0] < y + h / 2; v += SLAT[1]) {
        const [below, above] = [chord(opening, v), chord(opening, v + SLAT[0])]
        if (!below || !above) continue
        const [u0, u1] = [Math.max(below[0], above[0]) + 0.05, Math.min(below[1], above[1]) - 0.05]
        if (u1 - u0 > 0.3) panel(base, face.out, box((u1 - u0) / 2, v, v + SLAT[0], (u0 + u1) / 2), -wall * 0.7, -wall * 0.5, 'orange')
      }
    }
  }

  // A hollow tower from `x0` to `x1` across the strip and the towers' depth along it, its face on
  // the strip at x = `strip` (`x0` or `x1`) looking `toStrip` (±1 along X): its walls over each of
  // `storeys` (`[y0, y1]` from the ground up), holed on the three faces away from the strip
  // (`holedWall`, by `openings`; `plain` and `entrances` a face's index to its plain stretches and
  // its ways in), cut on the strip where a bridge's walkway or a way in goes through (`doors`,
  // `[{ z, y, width, height }]`, each from its floor `y`); a floor at each storey's foot but the
  // ground's, across `floorX` (all inside the walls unless said), and a roof behind a parapet,
  // with a `roofHole` (`[x0, x1, z0, z1]`) where a stair comes up through it and the parapet open
  // on the strip where `parapetOpen` says.
  function hollowTower({ x0, x1, strip, toStrip, storeys, openings, plain = {}, entrances = {}, doors, floorX = [x0 + t, x1 - t], roofHole = null, parapetOpen = [], seed }) {
    const far = strip === x0 ? x1 : x0
    const faces = [
      { out: [0, 1], from: x0, to: x1, inner: [x0 + t, x1 - t], at: (a) => ({ x: a, z: D }) },
      { out: [0, -1], from: x0, to: x1, inner: [x0 + t, x1 - t], at: (a) => ({ x: a, z: -D }) },
      { out: [-toStrip, 0], from: -D + wall, to: D - wall, inner: [-D + t, D - t], at: (a) => ({ x: far, z: a }) },
    ]
    storeys.forEach(([y0, y1], j) => faces.forEach((face, side) => holedWall(face, y0, y1, seed + side * 1009 + j * 101, { ...openings, plain: plain[side] ?? [], entrances: entrances[side] ?? [] })))
    // On the strip: its board between the long walls' boards, its lining between their linings.
    storeys.forEach(([y0, y1]) => {
      const cuts = doors.filter(({ y }) => y >= y0 - 0.01 && y < y1 - 0.01).map(({ z, y, width, height }) => ({ z0: z - width / 2, z1: z + width / 2, y0: y, y1: Math.min(y1, y + height) }))
      for (const [d0, d1, reach, look] of [[0, wall, D - wall, 'board'], [wall, t, D - t, 'dim']]) {
        const [xa, xb] = toStrip < 0 ? [strip + d0, strip + d1] : [strip - d1, strip - d0]
        const piece = (z0, z1, ya, yb) => yb - ya > 0.01 && k.block(xa, xb, ya, yb, z0, z1, look)
        for (const [a, b] of between(-reach, reach, cuts.map(({ z0, z1 }) => [z0, z1]))) piece(a, b, y0, y1)
        for (const cut of cuts) {
          piece(cut.z0, cut.z1, y0, cut.y0)
          piece(cut.z0, cut.z1, cut.y1, y1)
        }
      }
    })
    for (const [y0] of storeys.slice(1)) k.block(...floorX, y0 - SLAB, y0, -D + t, D - t, 'dim')
    const top = storeys[storeys.length - 1][1]
    const [hx0, hx1, hz0, hz1] = roofHole ?? [0, 0, D, D]
    const roofPieces = [[x0, x1, -D, hz0], [x0, x1, hz1, D], [x0, hx0, hz0, hz1], [hx1, x1, hz0, hz1]]
    for (const [a, b, c, d] of roofPieces) if (b - a > 0.01 && d - c > 0.01) k.block(a, b, top, top + SLAB, c, d, 'board')
    parapet(x0, x1, top + SLAB, strip, parapetOpen)
  }

  // The bridges' ends, a pair for each court: the front lane's from the court's floor up to the
  // lockers, the back lane's from its gallery down to the lockers. A bridge goes into a tower by a
  // door the width of its walkway; the rest of its end is buried in the wall, as in São Paulo.
  const pairs = Array.from({ length: courts }, (_, i) => pool + i * court).flatMap((f) => [
    { z: lane, from: f, to: f + half },
    { z: -lane, from: f + half, to: f },
  ])
  const [bw, bt] = [bridge / 2, 0.6] // half a bridge's width, and its walls' thickness
  const walkwayDoor = (z, y) => ({ z, y, width: bridge - 2 * bt, height: WALKWAY })
  // Each tower has a way in at the ground on its front, toward the street, and on the strip, off
  // the deck: the strip's cut a lining wider each side and over its head than the way is clear.
  const wayIn = { z: 0, y: 0, width: WAY_IN.wide + 2 * WAY_LINING, height: WAY_IN.tall + WAY_LINING }

  // The courts tower: the pool's hall, then the courts', its holes wide, a quarter of them shut.
  const mosaicFrom = pool + Math.max(0, courts - 2) * court // the foot of the halls the mosaic covers on the end
  hollowTower({
    x0: g, x1: XA, strip: g, toStrip: -1, seed: 0,
    storeys: [[0, pool], ...Array.from({ length: courts }, (_, i) => [pool + i * court, pool + (i + 1) * court])],
    openings: { size: hole, stretch: holeStretch, square: 0.6, shut },
    plain: { 2: [[-D, D, mosaicFrom]] }, // the end's last two halls carry the mosaic
    entrances: { 0: [{ a: g + courtsWide / 4, width: WAY_IN.wide, height: WAY_IN.tall }] },
    doors: [...pairs.map(({ z, from }) => walkwayDoor(z, from)), wayIn],
  })
  // Inside it, each court's hall as it is used, at a man's size, and each its own (the owner: "the
  // weird basketball and the spiral are cool, but only once, they shouldnt repeat on every
  // level"): every hall has its gallery halfway up along the strip's wall behind an orange rail,
  // where the back bridge comes in; what stands on its floor and how a man gets from the floor,
  // where the front bridge comes in, up to the gallery is the hall's use (`uses`, from the bottom
  // up). A use gives the stretch of the gallery's edge its way up arrives at, where the rail is open.
  const edge = g + t + GALLERY // the gallery's edge
  const CLIMB = [-8, 4] // the climbing wall's stretch along Z
  const CLIMB_IN = 1.2 // how much further back toward the gallery each of its tiers stands than the one under it
  const USES = {
    // A basketball court, and a ramp, a trough winding a turn and a half (`RAMP`) up the hall's
    // far back corner at a walking grade, then straight across the hall onto the gallery.
    basketball(f, y) {
      const turns = { x: XA - t - RAMP.r - RAMP.width / 2 - 2, z: -D + t + RAMP.r + RAMP.width / 2 + 2 } // the middle of its turns
      const landing = turns.z + RAMP.r // where its walkway crosses the hall, along X
      const sweep = (y - f) / RAMP.grade / RAMP.r
      const points = Array.from({ length: RAMP.steps + 1 }, (_, n) => {
        const angle = Math.PI / 2 - sweep * (1 - n / RAMP.steps)
        return p(turns.x + RAMP.r * Math.cos(angle), f + ((y - f) * n) / RAMP.steps, turns.z + RAMP.r * Math.sin(angle))
      })
      points.push(p(edge, y, landing))
      // It begins as a sliver on the floor.
      k.form({ kind: 'sweep', at: p(0, 0, 0), look: 'cast', section: trough(RAMP.width / 2, 0.2, 0.6), path: [{ ...points[0], scale: [1, 0.05] }, ...points.slice(1)] })
      for (const e of [RAMP.width / 2 - 0.1, -RAMP.width / 2 + 0.1]) k.beam(alongside(points.slice(1), e, PARAPET + 0.1), 0.2, 0.1, 'orange')
      // The court, 28 × 15 m: turquoise, its keys ochre, at each end a hoop on a post outside it,
      // its board 1.2 m in from the line and its ring orange.
      const [x, z, L] = [(g + XA) / 2, (landing + RAMP.width / 2 + D - t) / 2, 14]
      const { top } = courtFloor(x, z, f, L, 7.5, 'turquoise')
      for (const e of [-1, 1]) {
        const end = z + e * L
        k.block(x - 2.45, x + 2.45, top, top + 0.01, ...span(end - e * LINE, end - e * 5.8), 'ochre')
        const [post, board] = [end + e * 1.2, end - e * 1.2]
        k.block(x - 0.125, x + 0.125, f, f + 3.6, post - 0.125, post + 0.125, 'steel')
        k.block(x - 0.1, x + 0.1, f + 3.3, f + 3.5, ...span(post - e * 0.125, board + e * 0.025), 'steel')
        k.block(x - 0.9, x + 0.9, f + 2.9, f + 3.95, board - 0.025, board + 0.025, 'whitewash')
        k.form({ kind: 'lathe', at: p(x, f + 3.05, board - e * 0.425), look: 'orange', profile: [[0.21, 0], [0.25, 0], [0.25, 0.03], [0.21, 0.03]] })
      }
      return [landing - RAMP.width / 2, landing + RAMP.width / 2]
    },
    // Bleachers: tiers of concrete seats facing the court, from the floor up to the gallery's
    // edge, run up as a stair is (each rise under `stepUp`); and a volleyball court, 18 × 9 m,
    // blue, its attack lines 3 m either side of a net on steel posts.
    volleyball(f, y) {
      const [z, width, tread] = [-10, 40, 0.8] // clear of the front bridge's door, over the back bridge's
      const seats = { run: tread, every: Infinity } // no landings: tiers of seats
      const { length } = treads(y - f, seats)
      k.flight({ foot: { x: edge + length, z }, way: [-1, 0], width, y0: f, y1: y, ...seats, under: null, look: 'cast' })
      const x = edge + length + 6 + 4.5
      const { stripe } = courtFloor(x, z, f, 9, 4.5, 'cobalt')
      for (const e of [-1, 1]) stripe(x - 4.5 + LINE, x + 4.5 - LINE, z + e * 3 - LINE / 2, z + e * 3 + LINE / 2)
      for (const e of [-1, 1]) k.block(x + e * 5.5 - 0.06, x + e * 5.5 + 0.06, f, f + 2.55, z - 0.06, z + 0.06, 'steel')
      k.block(x - 5.44, x + 5.44, f + 1.43, f + 2.33, z - 0.02, z + 0.02, 'dark') // the net
      k.block(x - 5.44, x + 5.44, f + 2.33, f + 2.43, z - 0.03, z + 0.03, 'whitewash') // its tape
      return [z - width / 2, z + width / 2]
    },
    // A climbing wall standing out of the gallery's edge from the floor to the gallery's top:
    // orange, in tiers a `LEDGE` tall, each `CLIMB_IN` further back toward the gallery than the one
    // under it, the last level with the gallery, so that a man on one tier pushes into the next's
    // face and pulls himself onto it (`mantleReach`). Ledges stacked straight up a face cannot be
    // climbed so: on one he is under the next, with nothing before him to pull up by (the runner
    // stood on the first and went no further). Holds of every colour on the tiers' faces, crash
    // mats at its foot.
    climbing(f, y) {
      const [z0, z1] = CLIMB
      const heights = []
      for (let h = f + LEDGE; h < y - 0.5; h += LEDGE) heights.push(h)
      heights.push(y)
      const depth = heights.length * CLIMB_IN
      const outline = [[0, f], [depth, f], [depth, y]]
      for (let i = heights.length - 1; i >= 1; i--) outline.push([i * CLIMB_IN, heights[i]], [i * CLIMB_IN, heights[i - 1]])
      outline.push([0, heights[0]])
      k.relief({ x: edge + depth, z: (z0 + z1) / 2 }, [-1, 0], z1 - z0, outline, 'orange')
      heights.forEach((h, i) => {
        const [face, below] = [edge + depth - i * CLIMB_IN, i === 0 ? f : heights[i - 1]] // a tier's face, and its foot
        for (let j = 0; j < 4; j++) {
          const s = i * 37 + j * 13 + Math.round(f)
          const [hz, hy] = [z0 + 1 + hash(s, 1) * (z1 - z0 - 2), below + 0.3 + hash(s, 2) * (h - below - 0.9)]
          k.block(face, face + 0.25, hy, hy + 0.3, hz - 0.2, hz + 0.2, KEYBOARD[Math.floor(hash(s, 3) * KEYBOARD.length)])
        }
      })
      k.block(edge + depth + 0.5, edge + depth + 6.5, f, f + 0.4, z0, z1, 'cobalt')
      return CLIMB
    },
    // Gymnastics: a floor of 12 × 12 m, rings on a steel gantry, parallel bars, a vault, mats;
    // and a stair up to the gallery in two flights (`switchback`), along +Z out in the hall and
    // back along −Z beside the gallery's edge, a landing ending in a wall after each; from the top
    // one a man steps off sideways onto the gallery.
    gymnastics(f, y) {
      const from = -20
      const [top] = k.switchback({
        foot: { x: edge + 1.5 * STAIR.lane + STAIR.gap, z: from }, way: [0, 1], side: 1, lane: STAIR.lane, gap: STAIR.gap,
        levels: [f, f + (y - f) / 2, y], landing: STAIR.landing, stop: STAIR.stop, slab: SLAB, look: 'cast', wall: 'board', floor: 'dim',
      }).slice(-1)
      const [x, z] = [80, 15]
      courtFloor(x, z, f, 6, 6, 'cobalt')
      // The rings, on a gantry: two posts, a beam, short straps.
      const R = { x0: 90, x1: 96, z: 0, top: f + 5.8 }
      for (const px of [R.x0, R.x1]) k.block(px - 0.125, px + 0.125, f, R.top, R.z - 0.125, R.z + 0.125, 'steel')
      k.block(R.x0 - 0.125, R.x1 + 0.125, R.top, R.top + 0.25, R.z - 0.125, R.z + 0.125, 'steel')
      for (const rx of [92.6, 93.4]) {
        k.block(rx - 0.05, rx + 0.05, f + 2.9, R.top, R.z - 0.05, R.z + 0.05, 'steel')
        k.form({ kind: 'sweep', at: p(rx, f + 2.76, R.z), look: 'wood', section: { outer: circle(0.14, 12), inner: circle(0.11, 12).reverse() }, path: [p(0, 0, -0.03), p(0, 0, 0.03)] })
      }
      // The parallel bars, the vault and the mats under them.
      const B = { x: 80, z0: -32, z1: -28.5 }
      k.block(B.x - 2, B.x + 2, f, f + 0.2, B.z0 - 1, B.z1 + 1, 'cobalt')
      for (const bx of [B.x - 0.25, B.x + 0.25]) {
        for (const bz of [B.z0 + 0.3, B.z1 - 0.3]) k.block(bx - 0.04, bx + 0.04, f + 0.2, f + 1.75, bz - 0.04, bz + 0.04, 'steel')
        k.block(bx - 0.03, bx + 0.03, f + 1.75, f + 1.8, B.z0, B.z1, 'wood')
      }
      k.block(92, 93.6, f, f + 1.25, -31, -30.65, 'wood') // the vault
      k.block(70, 92, f, f + 0.05, -31.4, -30.25, 'cobalt') // its runway
      return [top.z0, top.z1]
    },
  }
  for (let i = 0; i < courts; i++) {
    const f = pool + i * court
    const y = f + half
    const arrives = USES[uses[i % uses.length]]?.(f, y)
    k.block(g + t, edge, y - SLAB, y, -D + t, D - t, 'dim')
    for (const [a, b] of between(-D + t, D - t, arrives ? [arrives] : [])) k.block(edge - 0.2, edge, y, y + PARAPET, a, b, 'orange')
  }
  const P ={ x0: (g + XA) / 2 - 25, x1: (g + XA) / 2 + 25, z: 12.5, rim: 1 }
  k.block(P.x0 + P.rim, P.x1 - P.rim, 0, 0.4, -P.z + P.rim, P.z - P.rim, 'water')
  k.block(P.x0, P.x1, 0, 0.6, P.z - P.rim, P.z, 'board')
  k.block(P.x0, P.x1, 0, 0.6, -P.z, -P.z + P.rim, 'board')
  k.block(P.x0, P.x0 + P.rim, 0, 0.6, -P.z + P.rim, P.z - P.rim, 'board')
  k.block(P.x1 - P.rim, P.x1, 0, 0.6, -P.z + P.rim, P.z - P.rim, 'board')

  // The lockers tower: storeys half a hall high over a ground storey the pool's height, its
  // windows squarer and smaller, none shut; the stretch of its back the duct goes up left plain;
  // its floors stopping short of the stairs' two lanes along its far wall.
  const duct = { x: XB + 3, r: 0.9 }
  const slot = XB + t + 2 * STAIR.lane + 1.5 * STAIR.gap // the floors' edge on the stairs' side, past the inner lane's outer parapet
  const lockerStoreys = [[0, pool], ...Array.from({ length: Math.round((yB - pool) / half) }, (_, m) => [pool + m * half, pool + (m + 1) * half])]
  const roofTop = yB + SLAB
  // Its stairs' flights, a storey each, the last on up through the roof (the owner: "there MUST
  // be something interesting at the very top"), in two lanes along its far wall by turns, the
  // outer first, up −Z from `STAIR.from` (`switchback`, below). The last flight is worked out here
  // for the hole it comes up through: its lane, the way it climbs, and where its top tread ends.
  const levels = [...lockerStoreys.map(([y0]) => y0), roofTop]
  const laneX = (l) => XB + t + STAIR.lane / 2 + l * (STAIR.lane + STAIR.gap)
  let along = STAIR.from
  levels.slice(1).forEach((y1, m) => (along += (m % 2 === 0 ? -1 : 1) * treads(y1 - levels[m]).length))
  const last = { l: (levels.length - 2) % 2, up: (levels.length - 2) % 2 === 0 ? -1 : 1, rise: treads(roofTop - levels[levels.length - 2]).rise }
  // The roof is open over the last flight's treads that come within a man's height of it, and
  // over the parapet on its gap's side, which rises with them.
  const opened = Math.ceil((SLAB + 2.2) / last.rise) + 1
  const [lx0, lx1] = [laneX(last.l) - STAIR.lane / 2, laneX(last.l) + STAIR.lane / 2]
  const stairHole = [last.l === 0 ? lx0 : lx0 - STAIR.gap / 2, lx1 + STAIR.gap / 2, ...span(along, along - last.up * opened)] // the outer lane has no parapet on the wall's side
  const deckHalf = 3 // half the jump-off deck's width
  hollowTower({
    x0: XB, x1: -g, strip: -g, toStrip: 1, seed: 5003,
    storeys: lockerStoreys,
    openings: { size: window, stretch: windowStretch, square: 0.3 },
    plain: { 1: [[XB, duct.x + duct.r + 1]] },
    entrances: { 0: [{ a: XB + lockersWide / Math.max(1, Math.round(lockersWide / windowStretch)) / 2, width: WAY_IN.lockers, height: WAY_IN.tall }] }, // the front's first panel, before the stairs' first lane
    doors: [...pairs.map(({ z, to }) => walkwayDoor(z, to)), wayIn],
    floorX: [slot, -g - t],
    roofHole: stairHole,
    parapetOpen: [[-deckHalf, deckHalf]],
  })
  // Its stairs, the way up for a man who came in at the ground (the owner: "I dont see how I can
  // enter these buildings"), and the only one, as in São Paulo, where the courts are reached by
  // the bridges: a flight a storey, the first from just inside the front's way in, by turns up −Z
  // in the outer lane and up +Z in the inner, their solid parapets back to back and one along the
  // inner lane's floor side. Where one ends and the next begins, a landing across both lanes at
  // the floor, reaching the floor's edge, and a wall across its far end: a run up a flight is fast
  // (the runner went up the first, 18 m, in 2.5 s) and went on off the landing into the stairwell
  // ("I still cant walk these bridges, cant walk from one tower into another!"); now it ends at
  // the wall, to turn. Along the floor's edge but at the landing, an orange rail. The last flight
  // has no landing: it comes out on the roof, inside a stair house.
  const landings = k.switchback({
    foot: { x: laneX(0), z: STAIR.from }, way: [0, -1], side: 1, lane: STAIR.lane, gap: STAIR.gap, levels,
    landing: STAIR.landing, stop: STAIR.stop, slab: SLAB, outer: [false, true], lastLanding: false, look: 'cast', wall: 'board', floor: 'dim',
  })
  for (const { z0, z1, y } of landings) {
    for (const [a, b] of between(-D + t, D - t, [[z0, z1]])) k.block(slot, slot + 0.2, y, y + PARAPET, a, b, 'orange')
  }
  // On the roof, the stair house over the hole and a landing past its top: walls on three sides
  // and a roof, the wall ahead of the flight a stop wall (the runner came up it at speed and ran on
  // out of the house, across the roof and over the back's parapet), and the house open on its side
  // toward the roof's middle and the jump-off deck, in an orange frame.
  {
    const [hx0, hx1, hz0, hz1] = stairHole
    const [h, w] = [4.5, 0.5] // its height inside, its walls' thickness
    const [ox0, ox1] = [XB + T, hx1 + w] // its outer sides: against the parapet, and past the hole
    const top = last.up < 0 ? hz0 : hz1 // where the flight comes out
    const ahead = top + last.up * STAIR.landing // the landing's far edge, where the stop wall stands
    const [back0, back1] = last.up < 0 ? [hz1, hz1 + w] : [hz0 - w, hz0] // its back wall, behind the flight's foot
    const [stop0, stop1] = span(ahead, ahead + last.up * w)
    const [z0, z1] = [Math.min(back0, stop0), Math.max(back1, stop1)]
    const [open0, open1] = span(top, ahead) // the side left open, over the landing
    k.block(ox0, hx0, roofTop, roofTop + h, z0, z1, 'board')
    for (const [a, b] of between(z0, z1, [[open0, open1]])) k.block(hx1, ox1, roofTop, roofTop + h, a, b, 'board')
    k.block(hx0, hx1, roofTop, roofTop + h, back0, back1, 'board')
    k.block(ox0, ox1, roofTop, roofTop + h, stop0, stop1, 'board')
    k.block(ox0, ox1, roofTop + h, roofTop + h + 0.5, z0, z1, 'board')
    frame({ x: ox1, z: (open0 + open1) / 2 }, [1, 0], open1 - open0, roofTop, h - 0.6)
  }
  // The jump-off deck: a slab out of the roof's edge over the strip at its middle, `jumpOff` long,
  // an orange rail along each side and its tip open, held by a bracket into the wall under it;
  // the parapet open where it leaves. From its tip the courts tower's roof is a glide away, 28 m
  // down across 50, and past it the water tower and the sheds.
  k.block(-g, -g + jumpOff, roofTop - SLAB, roofTop, -deckHalf, deckHalf, 'board')
  for (const e of [-1, 1]) k.block(-g, -g + jumpOff, roofTop, roofTop + PARAPET, ...span(e * deckHalf, e * (deckHalf - 0.2)), 'orange')
  k.relief({ x: -g, z: 0 }, [1, 0], 4, [[0, roofTop - SLAB - 0.6 * jumpOff], [0.65 * jumpOff, roofTop - SLAB], [0, roofTop - SLAB]], 'board')
  // The mosaic, high on the courts tower's end over its last two halls, seen from far off: framed
  // as the flats' is, on a board 0.8 m out of the wall.
  {
    const [w, h] = [Math.min(60, deep - 2 * t - 8), Math.min(48, (yA - mosaicFrom) - 8)]
    const y = (yA + mosaicFrom) / 2
    k.block(XA, XA + 0.8, y - h / 2 - 1.5, y + h / 2 + 1.5, -w / 2 - 1.5, w / 2 + 1.5, 'board')
    k.murals.push({ subject: mosaic, x: XA + 0.85, y, z: 0, w, h, yaw: Math.PI / 2 })
  }
  // The ways in on the strip, lined and framed as the fronts' are (`holedWall`).
  for (const [x, out] of [[g, -1], [-g, 1]]) wayInLined({ x, z: 0 }, [out, 0], [-wayIn.width / 2, wayIn.width / 2], wayIn.height)
  const roof = yB + SLAB
  k.pipe([p(duct.x, 0, -D - duct.r), p(duct.x, roof + PARAPET + duct.r, -D - duct.r), p(duct.x, roof + PARAPET + duct.r, -D + T + 3), p(duct.x, roof, -D + T + 3)], duct.r, 'orange')

  // The bridges, across the strip from the courts tower's face (x = g) to the lockers tower's
  // (x = −g), as in São Paulo (the owner, of a level metre outside each face and an opening wider
  // than the bridge round its end: "the bridge transits into the tower too harsh and ugly, make it
  // the same way it is done in real building", with a photograph): a plain beam sloping from face
  // to face, its last metre level and buried in the wall, its walkway's door alone cut, and under
  // its end at the lockers tower a console standing out of the wall. A bridge's section: its deck
  // between two walls, its beams, from `beam` under the deck's top to a rail's height over it,
  // flush, as the photograph's are. Cast smooth: formwork's level lines cut across a slope.
  const section = trough(bw, bt, beam)
  for (const { z, from, to } of pairs) {
    k.form({ kind: 'sweep', at: p(0, 0, 0), look: 'cast', section, path: [p(g + wall, from, z), p(g, from, z), p(-g, to, z), p(-g - wall, to, z)] })
    const under = to - beam + Math.max(0, ((from - to) * CONSOLE[0]) / gap) // the beam's underside at its outer end, where it rises away from the wall
    k.block(-g, -g + CONSOLE[0], under - CONSOLE[1], under, z - bw - 0.4, z + bw + 0.4, 'board')
  }

  // The deck in the strip, and the water tower at its end.
  k.block(-g, g, 0, 0.4, waterZ + waterRadius, D + yard, 'deck')
  const widens = waterTower - 6
  const profile = [[0, 0], [waterRadius, 0]]
  for (let y = pour; y < widens - 0.5; y += pour) profile.push([waterRadius, y - 0.25], [waterRadius + 0.3, y], [waterRadius, y + 0.25])
  profile.push([waterRadius, widens], [waterRadius * HEAD, widens + 3], [waterRadius * HEAD, waterTower], [0, waterTower])
  k.form({ kind: 'lathe', at: p(0, 0, waterZ), smooth: true, look: 'cast', profile, sides: 16 }) // its rings are its marks

  if (sheds) {
    // Either side of the inner street, from the yard to the front: the halls, each a gable swept
    // toward −Z (so that a section's u is +X) with its roof laid on its gable's edges, reaching
    // past the walls on the street and on the outside but never over a neighbour.
    const [z0, z1] = [D + yard, D + yard + shedLength]
    const w = hallWide / 2
    const slope = (ridge - eave) / w
    const [RT, O] = [0.4, 0.8] // the roof's thickness, and how far it reaches past an outer wall
    const top = (dx) => ridge + RT - slope * Math.abs(dx) // the roof's top `dx` across from the ridge
    const along = [p(0, 0, 0), p(0, 0, -shedLength)]
    for (const s of [1, -1]) {
      for (let h = 0; h < halls; h++) {
        const xc = s * (street / 2 + (h + 0.5) * hallWide)
        const [toStreet, toOutside] = [h === 0 ? O : 0, h === halls - 1 ? O : 0]
        const [oL, oR] = s > 0 ? [toStreet, toOutside] : [toOutside, toStreet]
        k.form({ kind: 'sweep', at: p(xc, 0, z1), path: along, look: 'brick', section: [[-w, 0], [w, 0], [w, eave], [0, ridge], [-w, eave]] })
        k.form({
          kind: 'sweep', at: p(xc, 0, z1), path: along, look: 'pale',
          section: [[-w - oL, eave - oL * slope], [0, ridge], [w + oR, eave - oR * slope], [w + oR, eave - oR * slope + RT], [0, ridge + RT], [-w - oL, eave - oL * slope + RT]],
        })
        for (const [a, b] of [[0.25 * w, 0.6 * w], [-0.6 * w, -0.25 * w]]) {
          k.form({ kind: 'sweep', at: p(xc, 0, z1 - 4), path: [p(0, 0, 0), p(0, 0, 8 - shedLength)], look: 'sky', section: [[a, top(a)], [b, top(b)], [b, top(b) + 0.1], [a, top(a) + 0.1]] })
        }
        framed({ x: xc, z: z1 }, [0, 1], 0.4 * hallWide, 2, eave + 0.3 * (ridge - eave), 'pale') // the gable end's window
      }
      // Along the street: tall windows, every fourth bay a door; and a door to the yard.
      const x = (s * street) / 2
      const bays = Math.max(1, Math.round(shedLength / 6))
      for (let j = 0; j < bays; j++) {
        const base = { x, z: z0 + ((j + 0.5) * shedLength) / bays }
        if (j % 4 === 2) k.door('x', x, -s, base.z, 0, 'orange', 4, 4.5) // a goods door
        else framed(base, [-s, 0], 2.4, 1.5, eave - 1.5, 'pale')
      }
      k.door('z', z0, -1, s * (street / 2 + w), 0, 'orange', 5, 4.5)
    }
  }

  // Built about the towers' middle; moved along Z so that the footprint's middle is the frame's.
  const back = waterZ - waterRadius * HEAD
  const front = D + yard + (sheds ? shedLength : 0)
  for (const record of k.forms) record.at = { ...record.at, z: record.at.z - (back + front) / 2 }
  for (const mural of k.murals) mural.z -= (back + front) / 2
  return result(k)
}
