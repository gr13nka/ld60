// Four brutalist doorways, the ways a runner is let through a mass (`docs/research/brutalism.md`,
// "How it works"): each is a hole cut through something much bigger than itself, so that the
// opening reads as depth and shadow and the mass as structure. They replace an older soft
// "doorway" asset. Sharp, as the concrete is: `block`s and `relief`s, never the softened pieces.
// A wall's footprint is centred about x = z = 0, its front toward +Z, the passage running through
// it along Z; the gate stands on two cores either side of a gap.
// - `deepPortal`: a square hole through a monolith (Kahn's porticoes at the Salk Institute). The
//   plainest and the heaviest: a wall deep enough to be a tunnel, in three blocks.
// - `hoodPortal`: an opening under a heavy hood standing out of the front (Boston City Hall's
//   two-storey hoods, the Barbican). A thin wall, and the hood carries the weight.
// - `steppedPortal`: jambs and lintel stepping inward in sharp tiers (corbelled portals, the
//   Spomenik facets), the same on both faces, so it reads the same run through either way.
// - `gatePortal`: two cores with a mass held over the gap between them (Genex's Western City Gate
//   in Belgrade, MASP's span): the way is the gap, and what is overhead is a building of storeys.
// And seven odd ones, after the owner asked for more variety and weirdness (2026-10-15): each a way
// through that is not a hole in a wall, or a hole that is not square to the ground.
// - `cleftPortal`: two sheared rocks leaning over a crack, a block jammed in it high up
//   (Tjentište's paired monoliths): the way is the crack.
// - `ajarPortal`: a giant's door left ajar, a concrete leaf on a pivot in the middle of the
//   opening, a man's door cut in it and a handle at a giant's height: two ways, either side of it.
// - `bladePortal`: pairs of blades leaning over the way from either side and crossing high over
//   it, the crossing walking across from pair to pair so that the run twists (Kosmaj's fins).
// - `sunkPortal`: a square frame half sunk into the ground and turned as it went, its hole a
//   leaning quadrilateral with one corner under the ground.
// - `weightPortal`: an inverted stepped pyramid hung by a stem in a tall opening, its point over
//   the way (the Geisel Library's tiers, MASP's held mass).
// - `stackPortal`: identical modules piled crosswise into a gate, each held out past the one
//   under it, one bridging the way (Habitat 67).
// - `funnelPortal`: a horn through a deep mass, wide and high at the front, narrowing and turning
//   aside to a way out off its axis, so that the far end looks smaller and further than it is.
// Sized from the owner's verdict, "never make thin and normal tunnels and doorways": what a
// runner goes through is 28 × 18 m clear (the gauge says 25 × 15 at least), and what a man's
// size shows on it (doors, storeys) keeps its real size, so the opening reads as huge. Every
// opening is lined with 0.3 m of `dim` on its reveals (both jambs and the soffit) so that it reads
// dark, a hole cut in the wall and never a sticker; its clear width and height are exactly
// `wide` and `tall` inside the lining. A real door in each jamb's lining, facing the passage and
// standing 0.3 m into it, shows the building is used; where a jamb is under 3 m deep it is left out.
// Pure: no scene.

import { DOOR, KEYBOARD, hash, kit, p, result, withDefaults } from './asset-kit.js'

/** Thickness of the `dim` lining of an opening's reveals. */
const LINING = 0.3
/** A jamb this deep or deeper has room for a door. */
const DOOR_DEPTH = 3

/** Their parameters as they are built when given none (`assets.js` hands them to the editor). Metres unless said. */
export const DEFAULTS = {
  deepPortal: {
    from: -45, // the wall's left end along X (its least x)
    to: 45, // its right end
    height: 40, // of the wall
    wide: 28, // the clear opening across
    tall: 18, // and its clear height
    deep: 12, // the wall's thickness along Z, centred on z = 0
    look: 'board', // the concrete
    doorLook: 'pale', // the frames of the doors in the jambs
    sink: 0, // how far the wall goes down below the ground, for a place over an abyss
  },
  hoodPortal: {
    from: -45,
    to: 45,
    height: 40,
    wide: 28,
    tall: 18,
    deep: 4, // the wall is thin: the hood is its weight
    reach: 14, // how far the hood stands out of the front
    hood: 7, // its depth, two storeys
    overhang: 6, // how much wider than the opening it is, each side
    look: 'board',
    doorLook: 'pale',
    sink: 0,
  },
  steppedPortal: {
    from: -45,
    to: 45,
    height: 40,
    wide: 28, // the passage, the middle slice's clear opening
    tall: 18,
    deep: 15, // the whole wall; cut into 2 * steps - 1 slices along Z
    steps: 3, // tiers on each face, the passage being the last
    inset: 3, // how far each tier steps in, in plan and in height
    look: 'board',
    doorLook: 'pale',
    sink: 0,
  },
  gatePortal: {
    wide: 28, // the gap between the cores, the way through
    core: 20, // each core's side, square in plan
    height: 72, // of the cores
    clear: 30, // the bridge's underside over the passage
    span: 4, // storeys in the bridge
    floor: 3.2, // a storey's height
    bay: 3.6, // between two fins of the bridge's face
    look: 'board',
    doorLook: 'pale',
    sink: 0,
  },
  cleftPortal: {
    wide: 28, // the crack across at the foot, kept plumb up to `tall`
    tall: 18,
    height: 64, // the right rock's point; the left stands lower
    rock: 30, // the right rock's width at its foot; the left is wider
    deep: 16, // each rock's depth along Z
    stuck: 15, // the jammed block across, where the rocks have leant in that close
    look: 'cast',
    stuckLook: 'board',
    doorLook: 'pale',
    sink: 0,
  },
  ajarPortal: {
    from: -80,
    to: 80,
    height: 66,
    wide: 76, // the opening; at `open` 74 the leaf leaves 26 m clear on each side of it
    tall: 44,
    deep: 8,
    leaf: 3, // the door's thickness
    open: 74, // degrees the leaf stands turned about its pivot from shut
    look: 'board',
    leafLook: 'cobalt',
    doorLook: 'pale',
    sink: 0,
  },
  bladePortal: {
    wide: 28, // the way left clear under the blades
    tall: 18,
    pairs: 4, // pairs of blades along the way
    pitch: 17, // from one pair to the next
    blade: 5, // a blade's thickness along the way: fins, not poles
    reach: 60, // how high a blade's point stands
    twist: 18, // metres the crossing walks across the way from the first pair to the last
    look: 'cast', // the blades from the right, as one comes through the front
    accent: 'ochre', // and from the left
    doorLook: 'pale',
    sink: 0,
  },
  sunkPortal: {
    side: 64, // the frame's outer side
    bar: 13, // its thickness, so that its hole is `side` - 2 `bar` across
    deep: 14,
    tilt: 20, // degrees it turned as it sank
    centre: 15, // its middle's height over the ground
    look: 'board',
    doorLook: 'pale',
    sink: 0,
  },
  weightPortal: {
    from: -50,
    to: 50,
    height: 72,
    wide: 44, // the opening, tall enough for the weight to hang in
    tall: 58,
    deep: 12,
    tiers: 4, // the weight's steps, the widest at its top
    under: 20, // its point's underside over the way
    top: 36, // the widest tier across
    rise: 8, // each tier's height
    reach: 22, // the widest tier's depth along Z: it stands out of both faces of the wall
    neck: 6, // the stem it hangs by, square
    look: 'board',
    doorLook: 'pale',
    sink: 0,
  },
  stackPortal: {
    wide: 28, // the way under the module that bridges it, which is `storeys` × `floor` over the ground
    long: 36, // a module's length (Habitat's 11.7 m, three times)
    across: 15, // and its width
    storeys: 3, // in a module, at a man's height each
    floor: 3.2,
    bay: 3.6,
    look: 'pale',
    sink: 0,
  },
  funnelPortal: {
    from: -55,
    to: 55,
    height: 50,
    deep: 48, // the mass the funnel goes through, along Z
    mouthWide: 64, // the front opening
    mouthTall: 42,
    wide: 28, // the way out at the back
    tall: 18,
    skew: 10, // how far the way out stands to the side of the mouth's middle
    look: 'board',
    doorLook: 'pale',
    sink: 0,
  },
}

// A door on each of two reveals at x = ±wide / 2, facing the passage, in the middle of the wall's
// depth `[z0, z1]`; none where the jamb is shallower than a door wants.
function jambDoors(k, wide, [z0, z1], doorLook) {
  if (z1 - z0 < DOOR_DEPTH) return
  const mid = (z0 + z1) / 2
  k.door('x', wide / 2, -1, mid, 0, doorLook)
  k.door('x', -wide / 2, 1, mid, 0, doorLook)
}

// The lining of an opening `wide` × `tall` over the depth `[z0, z1]`: both jambs and the soffit.
function lining(k, wide, tall, [z0, z1]) {
  k.block(wide / 2, wide / 2 + LINING, 0, tall, z0, z1, 'dim')
  k.block(-wide / 2 - LINING, -wide / 2, 0, tall, z0, z1, 'dim')
  k.block(-wide / 2 - LINING, wide / 2 + LINING, tall, tall + LINING, z0, z1, 'dim')
}

// A wall from `from` to `to` and up to `height`, its depth `[z0, z1]`, with the lined opening
// cut through it as three blocks: left of the opening, right of it, and the lintel over it.
function holedWall(k, { from, to, height, wide, tall, look }, [z0, z1]) {
  const [hx, hy] = [wide / 2 + LINING, tall + LINING] // the stone's cut, outside the lining
  k.block(hx, to, k.foot, height, z0, z1, look)
  k.block(from, -hx, k.foot, height, z0, z1, look)
  k.block(-hx, hx, hy, height, z0, z1, look)
  lining(k, wide, tall, [z0, z1])
}

export function deepPortal(given) {
  const { from, to, height, wide, tall, deep, look, doorLook, sink } = withDefaults(DEFAULTS.deepPortal, given)
  const k = kit(sink)
  const depth = [-deep / 2, deep / 2]
  holedWall(k, { from, to, height, wide, tall, look }, depth)
  jambDoors(k, wide, depth, doorLook)
  return result(k)
}

export function hoodPortal(given) {
  const { from, to, height, wide, tall, deep, reach, hood, overhang, look, doorLook, sink } = withDefaults(DEFAULTS.hoodPortal, given)
  const k = kit(sink)
  const depth = [-deep / 2, deep / 2]
  holedWall(k, { from, to, height, wide, tall, look }, depth)
  jambDoors(k, wide, depth, doorLook)
  // Its underside is the lintel's, so the hood reads as the lintel carried out over the way in.
  k.hood({ face: 'z', at: deep / 2, out: 1, along: [-wide / 2 - overhang, wide / 2 + overhang], y: tall + LINING, reach, deep: hood, look })
  return result(k)
}

export function steppedPortal(given) {
  const { from, to, height, wide, tall, deep, steps, inset, look, doorLook, sink } = withDefaults(DEFAULTS.steppedPortal, given)
  const k = kit(sink)
  const slices = 2 * steps - 1
  const thick = deep / slices
  // The half-width and the head of tier `t`'s opening (0 the outermost, steps - 1 the passage,
  // whose stone is cut outside its lining).
  const half = (t) => (t === steps - 1 ? wide / 2 + LINING : wide / 2 + (steps - 1 - t) * inset)
  const head = (t) => (t === steps - 1 ? tall + LINING : tall + (steps - 1 - t) * inset)
  const [h0, y0] = [half(0), head(0)]
  // The bulk outside the outermost opening, through the whole depth.
  k.block(h0, to, k.foot, height, -deep / 2, deep / 2, look)
  k.block(from, -h0, k.foot, height, -deep / 2, deep / 2, look)
  k.block(-h0, h0, y0, height, -deep / 2, deep / 2, look)
  // Each slice inside the outermost fills what lies between that opening and its own.
  for (let i = 0; i < slices; i++) {
    const t = steps - 1 - Math.abs(i - (steps - 1))
    if (t === 0) continue
    const [z0, z1] = [-deep / 2 + i * thick, -deep / 2 + (i + 1) * thick]
    k.block(half(t), h0, k.foot, y0, z0, z1, look)
    k.block(-h0, -half(t), k.foot, y0, z0, z1, look)
    k.block(-half(t), half(t), head(t), y0, z0, z1, look)
  }
  const passage = [-deep / 2 + (steps - 1) * thick, -deep / 2 + steps * thick]
  lining(k, wide, tall, passage)
  jambDoors(k, wide, passage, doorLook)
  return result(k)
}

export function gatePortal(given) {
  const { wide, core, height, clear, span, floor, bay, look, doorLook, sink } = withDefaults(DEFAULTS.gatePortal, given)
  const k = kit(sink)
  const [inner, outer] = [wide / 2, wide / 2 + core]
  const reach = core / 2 // a core's half-depth, and the bridge's front and back less its inset
  const top = clear + span * floor
  const SOFFIT = 0.15
  for (const s of [1, -1]) {
    const [x0, x1] = s > 0 ? [inner, outer] : [-outer, -inner]
    k.block(x0, x1, k.foot, height, -reach, reach, look)
    // A narrow strip of dark stair windows up each core's front and back.
    for (const z of [reach, -reach]) {
      const out = Math.sign(z)
      k.relief({ x: s * (inner + core / 2), z }, [0, out], 2.4, [[0, 6], [0.1, 6], [0.1, height - 4], [0, height - 4]], 'dark')
    }
    // A real door at the core's foot, on its inner face, in the middle of its depth.
    k.door('x', s * inner, -s, 0, 0, doorLook)
  }
  // The bridge: its own member, drawn back 1 m from the cores' faces, with a lip on top.
  const edge = reach - 1
  k.block(-inner, inner, clear + SOFFIT, top + 1.2, -edge, edge, look)
  k.block(-inner, inner, clear, clear + SOFFIT, -edge, edge, 'dim')
  for (const out of [1, -1]) {
    k.facade({ face: 'z', at: out * edge, out, along: [-inner + 0.5, inner - 0.5], rise: [clear, top], bay, floor, deep: 1, look })
  }
  return result(k)
}

// --- The odd ones. Most are cut as outlines seen from the front: polygons `[[x, y], …]` wound
// counter-clockwise with x to the right and y up as one looks at the front (from +Z), swept
// through the depth by `slab`. ---

const ON_GROUND = 1e-6
const SOFFIT = 0.15 // the `dim` underside of what hangs over the way

// A solid of `outline` from z0 to z1. Run toward −Z, a sweep's u is +X (`forms.js`).
const slab = (k, outline, [z0, z1], look) => k.form({ kind: 'sweep', at: p(0, 0, 0), look, section: outline, path: [p(0, 0, z1), p(0, 0, z0)] })

// The part of `outline` at or over the ground.
function aboveGround(outline) {
  const kept = []
  const keep = (point) => {
    const last = kept[kept.length - 1]
    if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > 1e-6) kept.push(point)
  }
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length]
    if (a[1] >= 0) keep(a)
    if (a[1] >= 0 !== b[1] >= 0) keep([a[0] + ((b[0] - a[0]) * a[1]) / (a[1] - b[1]), 0])
  })
  if (Math.hypot(kept[0][0] - kept.at(-1)[0], kept[0][1] - kept.at(-1)[1]) < 1e-6) kept.pop()
  return kept
}

// `outline` grown `d` all round, its corners mitred.
function grown(outline, d) {
  const n = outline.length
  const normal = ([ax, ay], [bx, by]) => {
    const length = Math.hypot(bx - ax, by - ay)
    return [(by - ay) / length, (ax - bx) / length]
  }
  return outline.map((v, i) => {
    const [m, l] = [normal(outline[(i + n - 1) % n], v), normal(v, outline[(i + 1) % n])]
    const s = d / (1 + m[0] * l[0] + m[1] * l[1])
    return [v[0] + (m[0] + l[0]) * s, v[1] + (m[1] + l[1]) * s]
  })
}

// What is left of `wall` with `hole` cut from its foot, both standing on the ground and the
// hole's foot within the wall's: one outline, the wall's foot running into the hole's left side,
// round over its head and out of its right side.
function notched(wall, hole) {
  const foot = (outline) =>
    outline.findIndex((a, i) => {
      const b = outline[(i + 1) % outline.length]
      return a[1] < ON_GROUND && b[1] < ON_GROUND && b[0] > a[0]
    })
  const [i, j, n] = [foot(wall), foot(hole), hole.length]
  const over = Array.from({ length: n }, (_, m) => hole[(j - m + n) % n])
  return [...wall.slice(0, i + 1), ...over, ...wall.slice(i + 1)]
}

// A wall of outline `wall` through `depth` with `opening` cut from its foot, the opening's
// reveals lined `dim` `LINING` thick so that it reads as a hole, its clear outline exactly
// `opening`. Each may reach under the ground; what is under it is cut off at the ground, and
// below that, for a place over an abyss, the wall's foot goes on down as a plinth.
function cutWall(k, wall, opening, depth, look) {
  const cut = aboveGround(grown(opening, LINING))
  const standing = aboveGround(wall)
  slab(k, notched(standing, cut), depth, look)
  slab(k, notched(cut, aboveGround(opening)), depth, 'dim')
  if (k.foot < 0) {
    const xs = standing.filter(([, y]) => y < ON_GROUND).map(([x]) => x)
    k.block(Math.min(...xs), Math.max(...xs), k.foot, 0, ...depth, look)
  }
  return { standing, cut }
}

// A real door on an upright face turned any way (`k.door` takes only quarter turns): `base`
// (`{ x, z }`) the middle of its sill on the face, `out` (`[ox, oz]`, of length 1) the face's way.
function doorOn(k, { x, z }, out, y, look) {
  const [w, h, f] = [DOOR.w / 2, DOOR.h, 0.25]
  const at = (a) => ({ x: x + out[1] * a, z: z - out[0] * a })
  const proud = (d, y0, y1) => [[0, y0], [d, y0], [d, y1], [0, y1]]
  k.relief(at(0), out, DOOR.w, proud(0.1, y, y + h), 'dark')
  for (const s of [-1, 1]) k.relief(at(s * (w + f / 2)), out, f, proud(0.3, y, y + h + f), look)
  k.relief(at(0), out, DOOR.w, proud(0.3, y + h, y + h + f), look)
}

const mirrored = (outline) => outline.map(([x, y]) => [-x, y]).reverse()

// Where along `line` (`[[x, y], …]`, rising) it is at the height `y`.
function xAt(line, y) {
  for (let i = 1; i < line.length; i++) {
    const [[x0, y0], [x1, y1]] = [line[i - 1], line[i]]
    if (y <= y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0)
  }
  return line.at(-1)[0]
}

export function cleftPortal(given) {
  const { wide, tall, height, rock, deep, stuck, look, stuckLook, doorLook, sink } = withDefaults(DEFAULTS.cleftPortal, given)
  const k = kit(sink)
  const w = wide / 2
  // A rock on the right `h` high and `r` wide at its foot: its inner face plumb to `tall`, then
  // leaning in over the crack to its point; its back sheared away in facets down to its foot.
  const inner = (h) => [[w, 0], [w, tall], [w * 0.75, tall + (h - tall) * 0.3], [w * 0.45, tall + (h - tall) * 0.68], [w * 0.3, h]]
  const outline = (h, r) => [[w + r, 0], [w + r, 0.12 * h], [w + 0.88 * r, 0.36 * h], [w + 0.6 * r, 0.6 * h], [w + 0.2 * r, 0.84 * h], ...inner(h).reverse()]
  // Two unlike rocks, the left lower, wider and standing forward of the right.
  const [hl, shift] = [height * 0.86, deep / 3]
  const [right, left] = [[-deep / 2, deep / 2], [-deep / 2 + shift, deep / 2 + shift]]
  if (k.foot < 0) {
    k.block(w, w + rock, k.foot, 0, ...right, look)
    k.block(-w - rock * 1.2, -w, k.foot, 0, ...left, look)
  }
  slab(k, outline(height, rock), right, look)
  slab(k, mirrored(outline(hl, rock * 1.2)), left, look)
  k.door('x', w, -1, 0, 0, doorLook)
  k.door('x', -w, 1, shift, 0, doorLook)
  // The jammed block: a square turned 20°, its corners wedged against the two faces where they
  // have leant in to its width; its right corner is the lower, so it reads as dropped and caught.
  const turn = (20 * Math.PI) / 180
  const r = stuck / (Math.cos(turn) + Math.sin(turn)) / Math.SQRT2
  const [dx, dy] = [r * Math.cos(Math.PI / 4 - turn), r * Math.sin(Math.PI / 4 - turn)]
  const [faceR, faceL] = [inner(height), inner(hl)]
  for (let y = tall + r; y < hl; y += 0.2) {
    const [xr, xl] = [xAt(faceR, y - dy), -xAt(faceL, y + dy)]
    if (xr - xl > stuck) continue
    const cx = (xr + xl) / 2
    const corners = [0, 1, 2, 3].map((q) => {
      const a = turn + Math.PI / 4 + (q * Math.PI) / 2
      return [cx + r * Math.cos(a), y + r * Math.sin(a)]
    })
    slab(k, corners, [-deep / 2 + 2, deep / 2 + shift - 2], stuckLook)
    break
  }
  return result(k)
}

export function ajarPortal(given) {
  const { from, to, height, wide, tall, deep, leaf, open, look, leafLook, doorLook, sink } = withDefaults(DEFAULTS.ajarPortal, given)
  const k = kit(sink)
  const depth = [-deep / 2, deep / 2]
  holedWall(k, { from, to, height, wide, tall, look }, depth)
  jambDoors(k, wide, depth, doorLook)
  // The leaf, turned `open` degrees about the opening's middle, just short of it across and up.
  const a = (open * Math.PI) / 180
  const along = [Math.cos(a), Math.sin(a)] // its length's way in plan, (x, z)
  const face = [-Math.sin(a), Math.cos(a)] // one of its faces' way out; the other is the opposite
  const [half, t] = [wide / 2 - 0.5, leaf / 2]
  const on = (s, u) => ({ x: s * half * along[0] + u * t * face[0], z: s * half * along[1] + u * t * face[1] })
  const corner = (s, u) => [on(s, u).x, on(s, u).z]
  k.prism([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], 0, tall - 0.5, leafLook)
  // A man's door through it, and a giant's handle: a pull on one face, a push plate on the other.
  const back = [-face[0], -face[1]]
  doorOn(k, on(0.55, 1), face, 0, doorLook)
  doorOn(k, on(0.55, -1), back, 0, doorLook)
  const handle = on(-0.6, 1)
  k.relief(handle, face, 1.4, [[1.6, 14], [3, 14], [3, 30], [1.6, 30]], 'steel')
  for (const y of [15, 27.6]) k.relief(handle, face, 1, [[0, y], [1.6, y], [1.6, y + 1.4], [0, y + 1.4]], 'steel')
  k.relief(on(-0.6, -1), back, 4, [[0, 14], [0.2, 14], [0.2, 30], [0, 30]], 'brass')
  return result(k)
}

export function bladePortal(given) {
  const { wide, tall, pairs, pitch, blade, reach, twist, look, accent, doorLook, sink } = withDefaults(DEFAULTS.bladePortal, given)
  const k = kit(sink)
  const w = wide / 2
  const [FOOT, CLEAR] = [15, 2] // a blade's foot across; how far it stays over `tall` at the way's edge
  for (let i = 0; i < pairs; i++) {
    const s = pairs > 1 ? i / (pairs - 1) - 0.5 : 0
    const z = (i - (pairs - 1) / 2) * pitch
    for (const side of [1, -1]) {
      // As the right one would stand: its point leans over the far half of the way, and the two
      // points walk across it together pair by pair, one rising as the other falls.
      const tip = [-w * 0.9 + side * twist * s, reach * (0.85 + 0.15 * (0.5 - side * s))]
      const c = (tall + CLEAR) / tip[1]
      const foot = Math.max(w + 4, (w - c * tip[0]) / (1 - c)) // its underside passes over (w, tall + CLEAR)
      const outline = [[foot, 0], [foot + FOOT, 0], tip]
      // The two of a pair a little apart along the way, so that they pass each other as shears do.
      const depth = side > 0 ? [z - blade - 0.2, z - 0.2] : [z + 0.2, z + blade + 0.2]
      const paint = side > 0 ? look : accent
      if (k.foot < 0) k.block(side * foot - (side < 0 ? FOOT : 0), side * foot + (side > 0 ? FOOT : 0), k.foot, 0, ...depth, paint)
      slab(k, side > 0 ? outline : mirrored(outline), depth, paint)
      if (i === pairs - 1) k.door('z', depth[1], 1, side * (foot + 2.5), 0, doorLook)
      if (i === 0) k.door('z', depth[0], -1, side * (foot + 2.5), 0, doorLook)
    }
  }
  return result(k)
}

export function sunkPortal(given) {
  const { side, bar, deep, tilt, centre, look, doorLook, sink } = withDefaults(DEFAULTS.sunkPortal, given)
  const k = kit(sink)
  const square = (half) =>
    [0, 1, 2, 3].map((q) => {
      const a = ((tilt + 45 + 90 * q) * Math.PI) / 180
      return [half * Math.SQRT2 * Math.cos(a), centre + half * Math.SQRT2 * Math.sin(a)]
    })
  const depth = [-deep / 2, deep / 2]
  const { standing, cut } = cutWall(k, square(side / 2), square(side / 2 - bar), depth, look)
  // A door on both faces of each of its feet, where a foot is wide enough for one.
  const ground = (outline) => outline.filter(([, y]) => y < ON_GROUND).map(([x]) => x).sort((a, b) => a - b)
  const [[x0, x1], [h0, h1]] = [ground(standing), ground(cut)]
  for (const [a, b] of [[x0, h0], [h1, x1]]) {
    if (b - a < 8) continue
    for (const out of [1, -1]) k.door('z', (out * deep) / 2, out, (a + b) / 2, 0, doorLook)
  }
  return result(k)
}

export function weightPortal(given) {
  const { from, to, height, wide, tall, deep, tiers, under, top, rise, reach, neck, look, doorLook, sink } = withDefaults(DEFAULTS.weightPortal, given)
  const k = kit(sink)
  const depth = [-deep / 2, deep / 2]
  holedWall(k, { from, to, height, wide, tall, look }, depth)
  jambDoors(k, wide, depth, doorLook)
  // Each tier wider and deeper than the one under it, its underside lined dark.
  for (let i = 0; i < tiers; i++) {
    const [x, z] = [(top * (i + 1)) / tiers / 2, (reach * (i + 1)) / tiers / 2]
    const y = under + i * rise
    k.block(-x, x, y, y + SOFFIT, -z, z, 'dim')
    k.block(-x, x, y + SOFFIT, y + rise, -z, z, look)
  }
  const hung = under + tiers * rise
  if (hung < tall) k.block(-neck / 2, neck / 2, hung, tall, -neck / 2, neck / 2, look)
  return result(k)
}

export function stackPortal(given) {
  const { wide, long: L, across: A, storeys, floor, bay, look, sink } = withDefaults(DEFAULTS.stackPortal, given)
  const k = kit(sink)
  const [w, H] = [wide / 2, storeys * floor]
  // Each module as `[x0, z0, storey band, the way its length runs]`, x0 and z0 its least corner
  // in plan. Drawn for the defaults' proportions, it keeps them as they change.
  const MODULES = [
    // On the ground either side, out of line with each other.
    [w + L - A - 4, -L / 2 + 6, 0, 'z'],
    [-w - L + 4, -L / 2 - 6, 0, 'z'],
    // On them, each reaching out over the ground to the way's edge.
    [w, -A / 2, 1, 'x'],
    [-w - L, -A / 2 + 4, 1, 'x'],
    // The one across the way, on the two; and the others of its band, held out past theirs.
    [-L / 2, -A / 2 - 3, 2, 'x'],
    [w + L - A, -L / 2 - 8, 2, 'z'],
    [-w - L - 6, -A / 2 + 8, 2, 'x'],
    // On up, each standing out further than the one it is on.
    [-L / 2, -A / 2 - 2.5, 3, 'z'],
    [w + 6, -L / 2 - 4, 3, 'x'],
    [-L / 2 - 4, A / 2 + 4.5, 4, 'x'],
  ]
  MODULES.forEach(([x0, z0, band, way], m) => {
    const [x1, z1] = way === 'x' ? [x0 + L, z0 + A] : [x0 + A, z0 + L]
    const y0 = band * H
    if (band > 0) k.block(x0, x1, y0, y0 + SOFFIT, z0, z1, 'dim')
    k.block(x0, x1, band > 0 ? y0 + SOFFIT : k.foot, y0 + H, z0, z1, look)
    // Its long faces glazed between fins and floors, a loggia now and then in colour or shut;
    // its ends one dark window each.
    const cell = (i, j) => {
      const h = hash(i + m * 7, j + m)
      return h > 0.82 ? KEYBOARD[Math.floor(h * 97) % KEYBOARD.length] : h > 0.6 ? look : null
    }
    // Each as [face, its two planes, the span along it].
    const [sides, ends] = way === 'x' ? [['z', [z0, z1], [x0, x1]], ['x', [x0, x1], [z0, z1]]] : [['x', [x0, x1], [z0, z1]], ['z', [z0, z1], [x0, x1]]]
    for (const [at, out] of [[sides[1][1], 1], [sides[1][0], -1]]) {
      k.facade({ face: sides[0], at, out, along: [sides[2][0] + 0.6, sides[2][1] - 0.6], rise: [y0, y0 + H], bay, floor, deep: 0.8, cell, look })
    }
    for (const [at, out] of [[ends[1][1], 1], [ends[1][0], -1]]) k.faceBlock(ends[0], at, out, ends[2][0] + 1.2, ends[2][1] - 1.2, 0, 0.1, y0 + 0.8, y0 + H - 0.8, 'dark')
  })
  return result(k)
}

export function funnelPortal(given) {
  const { from, to, height, deep, mouthWide, mouthTall, wide, tall, skew, look, doorLook, sink } = withDefaults(DEFAULTS.funnelPortal, given)
  const k = kit(sink)
  const D = deep / 2
  const [m, b] = [mouthWide / 2 + LINING, wide / 2 + LINING] // the stone's cut, outside the lining
  // The masses either side, their inner faces slanting in from the mouth to the way out.
  k.prism([[from, -D], [skew - b, -D], [-m, D], [from, D]], k.foot, height, look)
  k.prism([[skew + b, -D], [to, -D], [to, D], [m, D]], k.foot, height, look)
  // The roof over it, its soffit falling from the mouth's head to the way out's.
  const across = (section, look) => k.relief({ x: 0, z: 0 }, [0, 1], 2 * m, section, look)
  across([[-D, tall + LINING], [D, mouthTall + LINING], [D, height], [-D, height]], look)
  across([[-D, tall], [D, mouthTall], [D, mouthTall + LINING], [-D, tall + LINING]], 'dim')
  // The sides' linings, `LINING` thick square to their slant; up to the mouth's head, the rest
  // of them in the roof.
  for (const s of [1, -1]) {
    const [front, back] = [s * m, skew + s * b]
    const e = (LINING * Math.hypot(front - back, deep)) / deep
    k.prism([[back, -D], [back - s * e, -D], [front - s * e, D], [front, D]], 0, mouthTall + LINING, 'dim')
    k.door('z', D, 1, s * (m + 10), 0, doorLook)
  }
  return result(k)
}
