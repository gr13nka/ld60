// Torre Velasca (BBPR, Milan, 1956–58): a shaft of offices carrying a wider crown of flats, the
// crown held out over the shaft on oblique struts. Made at the game's scale (`SCALE`, 3×), by the
// rule of `asset-kit.js`: its masses, spans and structure are three times Milan's, what a man is
// measured against (storeys, windows, balconies, shutters, parapets, dormers) is Milan's own size,
// so the tower is taller by having more storeys and wider by having more bays, never by having
// bigger ones.
// Sourced: 106 m to the architectural top (Wikipedia, CTBUH); 26 floors above ground, offices in
// the shaft and flats in the top seven, the crown (the Italian heritage atlas); the crown carried
// by about 20 oblique struts that leave the façade at the 18th floor (Mapei); an office floor of
// over 700 m² round a central core; pinkish concrete, ribbed, with irregular windows; a steeply
// hipped roof with dormers, chimneys, the lift's room and a mast; a low block behind.
// Estimated: the storey (3.6 m, from 106 m and 26 floors), the overhang (3 m), the shaft's
// footprint (34 × 24 m), the rib spacing (about 5.7 m), the lobby (6 m), the podium, the roof's
// pitch, every small part. Game scale: shaft 102 × 72, overhang 9, struts over ten storeys, roof
// foot at about 277 m, ridge at about 319 m, the mast above that.
// Sharp, as the real tower is: the owner chose it over the softened kit (2026-10-14), so its masses
// are `block`s and its ribs `relief`s, never `mass`; and, asked for "more details" the same day,
// it carries the real tower's smaller parts too:
// - At the foot, the ground floor (`lobby`, taller than the rest) is glass set `inset` back, so the
//   ribs stand free as a colonnade; over the entrance in the front's middle bays a hood, heavy
//   and sharp, its soffit dark, and under it four doors in the glass.
// - Up the shaft, a rib on each bay line and a slimmer mullion halfway between, and on each floor a
//   spandrel band across the whole face behind them. Each half bay is, in vertical runs of two to
//   six floors, a wide window, a narrow one or wall (`hash`): the real tower's uneven windows. A
//   run is one pane behind the bands, so the floors inside it read as ribbon glass.
// - Over the shaft's last `ribFloors` floors each rib forks: it goes on straight to the crown's
//   underside and a strut leans out from it to the crown's edge, `overhang` out, leaving an open
//   triangle between; the corners do the same on the diagonal.
// - The crown starts with a belt; its floors have the same bands, and each half bay is, by runs of
//   two to five floors, wall, a window with shutters either side, a plain one, a narrow one or a
//   loggia: a colour from the keyboard behind balconies and their parapets, all one comb-shaped
//   form for the run.
// - On the crown a terrace `terrace` wide behind a parapet low enough to pull over; then a steep
//   hipped roof with a gutter round its foot, four rows of dormers up its slopes, and on its ridge
//   the lift's room, capped chimneys and a mast.
// - Behind the foot (`podium`) a low block with a cornice, shops below, offices above, plant on
//   its roof, which is a landing: a stair climbs to it along its blank front beside the shaft,
//   solid, a parapet on its open side, ending in a wall where the roof is on the right.
// `bays` is how many bays across the front and across an end. Forms: every face's count grows with
// its bays plus its floors, never their product, because a collision cell holds every storey of a
// column (`faces.js`). At the defaults about 3,000: shaft windows about 850 (36 half bays on a
// front, 24 on an end, about seven runs a column of which half are glass), crown windows about
// 1,000, bands about 300, ribs and mullions about 300, lobby frames about 55, podium about 160,
// roof and dormers about 150.
// Pure: no scene.

import { KEYBOARD, PARAPET, SCALE, hash, kit, p, result, treads, withDefaults } from './asset-kit.js'

/** Its parameters as it is built when given none (`assets.js` hands them to the editor). Metres unless said. */
export const DEFAULTS = {
  floor: 3.6, // height of one storey: Milan's own (a man's), not scaled
  lobby: 6, // height of the ground storey: Milan's own
  shaftFloors: 54, // storeys in the shaft over the lobby
  crownFloors: 21, // storeys in the crown
  belt: 1.4, // height of the belt at the crown's foot
  width: 34 * SCALE, // front of the shaft
  depth: 24 * SCALE, // end of the shaft
  bays: [18, 12], // bays across the front and across an end, about 5.7 m apart as in Milan
  overhang: 3 * SCALE, // how far the crown stands out past the shaft
  ribFloors: 10, // storeys at the top of the shaft where each rib forks, three of Milan's three or four, scaled
  pilaster: [2, 2.4], // width and depth of a rib
  inset: 4.5, // how far the glass ground floor stands back from the shaft's faces
  terrace: 9, // width of the terrace behind the crown's parapet
  pitch: 42, // height of the roof
  mast: 30, // height of the mast over the lift's room
  podium: true, // the low block behind
}

export function velasca(given) {
  const { floor, lobby, shaftFloors, crownFloors, belt, width, depth, bays, overhang: o, ribFloors, pilaster: [pw, pd], inset, terrace, pitch, mast, podium } = withDefaults(DEFAULTS, given)
  const k = kit()
  const X = width / 2
  const Z = depth / 2
  const yS = lobby + shaftFloors * floor // the shaft's top: the crown's underside
  const y0 = yS - ribFloors * floor // where the struts lean out from the ribs
  const yB = yS + belt // the crown's first floor
  const yC = yB + crownFloors * floor // the crown's top: the terrace
  const BAND = { h: 1.1, d: 0.35 } // a floor's spandrel, standing out of the face
  const MULLION = { w: 0.5, d: 0.9 }
  const BALCONY = { d: 1.35, slab: 0.3, rail: 0.15 } // Milan's loggias are 1.2–1.5 m deep
  k.block(-X + inset, X - inset, 0, lobby, -Z + inset, Z - inset, 'dark') // the glass ground floor
  k.block(-X, X, lobby, yS, -Z, Z, 'rose')
  k.block(-X - o, X + o, yS, yC, -Z - o, Z + o, 'rose')
  const upright = (from, to, d = pd, d0 = 0) => [[d0, from], [d0 + d, from], [d0 + d, to], [d0, to]]
  const strut = (reach) => [[0, y0], [pd, y0], [reach + pd, yS], [reach, yS]]
  const pane = (from, to, d = 0.06) => [[0, from], [d, from], [d, to], [0, to]]
  // The balconies of `n` floors from `first`, as one outline: a thin spine standing off the face
  // (clear of the bands, which are `BAND.d` deep) up to `top`, and from it at each floor a slab and
  // its parapet. Counter-clockwise, up the outside and down the spine.
  const balconies = (first, n, top) => {
    const spine = BAND.d + 0.15
    const { d, slab, rail } = BALCONY
    const out = [[BAND.d, first]]
    for (let j = 0; j < n; j++) {
      const y = first + j * floor
      if (j > 0) out.push([spine, y])
      out.push([d, y], [d, y + slab + PARAPET], [d - rail, y + slab + PARAPET], [d - rail, y + slab], [spine, y + slab])
    }
    out.push([spine, top], [BAND.d, top])
    return out
  }
  // The floors 0 … `count - 1` cut into runs of `lo` to `lo + span - 1`, as [first, last] pairs:
  // what lets a window be one form for several floors.
  const runs = (count, seed, lo, span) => {
    const out = []
    for (let j = 0; j < count;) {
      const last = Math.min(count, j + lo + Math.floor(hash(seed, j) * span)) - 1
      out.push([j, last])
      j = last + 1
    }
    return out
  }
  // The four faces: the way each looks, how far out it stands (`half`), half its length (`span`),
  // its bays, and a point of it `a` along and `d` out.
  const faces = [
    { out: [0, 1], half: Z, span: X, n: bays[0], at: (a, d) => ({ x: a, z: d }) },
    { out: [0, -1], half: Z, span: X, n: bays[0], at: (a, d) => ({ x: -a, z: -d }) },
    { out: [1, 0], half: X, span: Z, n: bays[1], at: (a, d) => ({ x: d, z: -a }) },
    { out: [-1, 0], half: X, span: Z, n: bays[1], at: (a, d) => ({ x: -d, z: a }) },
  ]
  // The windows of a face's `count` floors from `base`, between the bay lines `lines` (the first and
  // last are corners): each half bay by runs of floors, by `hash`. `flats` gives the crown's kinds
  // of window, otherwise the offices'.
  function windows(f, half, lines, base, count, seed, flats) {
    for (let i = 0; i < lines.length - 1; i++) {
      const mid = (lines[i] + lines[i + 1]) / 2
      for (const [c0, c1, s] of [[lines[i], mid, 0], [mid, lines[i + 1], 1]]) {
        const e0 = c0 + (c0 === lines[i] ? pw / 2 : MULLION.w / 2) + 0.5
        const e1 = c1 - (c1 === lines[i + 1] ? pw / 2 : MULLION.w / 2) - 0.5
        const w = e1 - e0
        const cell = i * 2 + s
        for (const [j0, j1] of runs(count, seed + cell * 1.7, 2, flats ? 4 : 5)) {
          const h = hash(seed + cell, j0 + 0.5)
          const from = base + j0 * floor + BAND.h
          const top = base + (j1 + 1) * floor - 0.5
          const glass = (a, wide, d = 0.06, look = 'dark') => k.relief(f.at(a, half), f.out, wide, pane(from, top, d), look)
          if (!flats) {
            if (h < 0.3) continue
            if (h < 0.7) glass((e0 + e1) / 2, w)
            else glass(h < 0.85 ? e0 + w * 0.3 : e1 - w * 0.3, w * 0.6)
            continue
          }
          if (h < 0.2) continue
          if (h < 0.45) {
            // A window with its shutters folded back either side of it.
            glass((e0 + e1) / 2, w * 0.6)
            for (const a of [e0 + w * 0.1, e1 - w * 0.1]) glass(a, w * 0.18, 0.15, 'plaster')
          } else if (h < 0.65) glass((e0 + e1) / 2, w)
          else if (h < 0.88) {
            // A loggia: balconies and their parapets, the run's one colour.
            const first = base + j0 * floor
            k.relief(f.at((e0 + e1) / 2, half), f.out, w, balconies(first, j1 - j0 + 1, top), KEYBOARD[Math.floor(h * 97) % KEYBOARD.length])
          } else glass(h < 0.94 ? e0 + w * 0.3 : e1 - w * 0.3, w * 0.6)
        }
      }
    }
  }
  faces.forEach((f, side) => {
    const lines = Array.from({ length: f.n + 1 }, (_, i) => -f.span + (2 * f.span * i) / f.n) // the bay lines, the corners at each end
    const inner = lines.slice(1, -1)
    // The ribs, free at the foot; each forks into a strut that leans out to the crown's edge and
    // goes on up the crown's face from there.
    for (const a of inner) {
      k.relief(f.at(a, f.half), f.out, pw, upright(0, yS), 'plaster')
      k.relief(f.at(a, f.half), f.out, pw, strut(o), 'plaster')
      k.relief(f.at(a, f.half + o), f.out, pw, upright(yS, yC), 'plaster')
    }
    // The mullions, halfway between the ribs, from the lobby's head to the crown.
    for (let i = 0; i < f.n; i++) k.relief(f.at((lines[i] + lines[i + 1]) / 2, f.half), f.out, MULLION.w, upright(lobby, yS, MULLION.d), 'plaster')
    // A band across the face at each floor, then the windows over them.
    for (let j = 0; j < shaftFloors; j++) {
      const y = lobby + j * floor
      k.relief(f.at(0, f.half), f.out, 2 * f.span, upright(y, y + BAND.h, BAND.d), 'rose')
    }
    windows(f, f.half, lines, lobby, shaftFloors, side * 31, false)
    // The glass ground floor's frames, every 6 m along its face, set back `inset`.
    const glassSpan = f.span - inset
    const frames = Math.max(1, Math.round((2 * glassSpan) / 6))
    for (let i = 1; i < frames; i++) k.relief(f.at(-glassSpan + (2 * glassSpan * i) / frames, f.half - inset), f.out, 0.3, upright(0, lobby, 0.3), 'plaster')
    // The crown: a belt at its foot, then its floors, its end bays wider by the overhang.
    const crownLines = [-f.span - o, ...inner, f.span + o]
    k.relief(f.at(0, f.half + o), f.out, 2 * (f.span + o), upright(yS, yB, 0.5), 'plaster')
    for (let i = 0; i < f.n; i++) k.relief(f.at((crownLines[i] + crownLines[i + 1]) / 2, f.half + o), f.out, MULLION.w, upright(yB, yC, MULLION.d), 'plaster')
    for (let j = 0; j < crownFloors; j++) {
      const y = yB + j * floor
      k.relief(f.at(0, f.half + o), f.out, 2 * (f.span + o), upright(y, y + BAND.h, BAND.d), 'rose')
    }
    windows(f, f.half + o, crownLines, yB, crownFloors, side * 31 + 7, true)
  })
  // The corners: a rib on the diagonal, set in so that its back edge lies on both faces, forking
  // into a strut that leans out √2 × the overhang to the crown's corner.
  const s = pw / (2 * Math.SQRT2)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const out = [sx / Math.SQRT2, sz / Math.SQRT2]
    const shaft = { x: sx * (X - s), z: sz * (Z - s) }
    k.relief(shaft, out, pw, upright(0, yS), 'plaster')
    k.relief(shaft, out, pw, strut(o * Math.SQRT2), 'plaster')
    k.relief({ x: sx * (X + o - s), z: sz * (Z + o - s) }, out, pw, upright(yS, yC), 'plaster')
  }
  // The entrance: a hood out past the ribs over the front's four middle bays, and under it four
  // doors in the glass, between its frames (every 6 m, as above).
  const bay = width / bays[0]
  k.hood({ face: 'z', at: Z + pd, out: 1, along: [-2 * bay, 2 * bay], y: lobby - 1.2, reach: 12, deep: 2.6, look: 'plaster' })
  const frameStep = (2 * (X - inset)) / Math.max(1, Math.round((2 * (X - inset)) / 6))
  for (const i of [-2, -1, 0, 1]) k.door('z', Z - inset, 1, (i + 0.5) * frameStep, 0, 'plaster')
  // The terrace's parapet: a runner pulls himself over it.
  const [CX, CZ, t] = [X + o, Z + o, 0.6]
  k.block(-CX, CX, yC, yC + PARAPET, CZ - t, CZ, 'plaster')
  k.block(-CX, CX, yC, yC + PARAPET, -CZ, -CZ + t, 'plaster')
  k.block(CX - t, CX, yC, yC + PARAPET, -CZ + t, CZ - t, 'plaster')
  k.block(-CX, -CX + t, yC, yC + PARAPET, -CZ + t, CZ - t, 'plaster')
  // The roof: four faces turned on the axis, their corners on the diagonals, stretched to the
  // crown's plan less the terrace, drawn in to `ridge` of it at the top; a gutter round its foot.
  const [RX, RZ, ridge] = [CX - terrace, CZ - terrace, 0.3]
  const yR = yC + pitch
  k.form({ kind: 'lathe', at: p(0, yC, 0), look: 'terracotta', sides: 4, arc: [Math.PI / 4, Math.PI / 4 + 2 * Math.PI], scale: [RX, 1, RZ], profile: [[0, 0], [Math.SQRT2, 0], [ridge * Math.SQRT2, pitch], [0, pitch]] })
  k.block(-RX - 0.4, RX + 0.4, yC, yC + 0.8, RZ - 0.6, RZ + 0.4, 'dark')
  k.block(-RX - 0.4, RX + 0.4, yC, yC + 0.8, -RZ - 0.4, -RZ + 0.6, 'dark')
  k.block(RX - 0.6, RX + 0.4, yC, yC + 0.8, -RZ + 0.6, RZ - 0.6, 'dark')
  k.block(-RX - 0.4, -RX + 0.6, yC, yC + 0.8, -RZ + 0.6, RZ - 0.6, 'dark')
  // Dormers up the long slopes, four rows, each of a man's size: a box whose front stands where the
  // slope is at its sill's height and whose back is lost in the roof, a window in its front.
  for (const [rise, step] of [[5, 10], [14, 10], [23, 12], [31, 14]]) {
    const zFace = RZ - RZ * (1 - ridge) * (rise / pitch)
    const reach = RX - RX * (1 - ridge) * ((rise + 3.4) / pitch) - 2 // its whole width under the slope's end at its top
    for (let x = -reach; x <= reach + 0.01; x += step) for (const sz of [-1, 1]) {
      const [z0, z1] = sz > 0 ? [zFace - 3, zFace] : [-zFace, -zFace + 3]
      k.block(x - 1.6, x + 1.6, yC + rise, yC + rise + 3.4, z0, z1, 'plaster')
      k.relief({ x, z: sz * zFace }, [0, sz], 2, pane(yC + rise + 0.6, yC + rise + 2.8), 'dark')
    }
  }
  // On the ridge: the lift's room in the middle, a capped chimney either side of it at each end, and a mast.
  const [PX, PZ] = [ridge * RX, ridge * RZ]
  const room = 9
  k.block(-4, 4, yR, yR + room, -PZ * 0.6, PZ * 0.6, 'plaster') // narrow enough to clear the inner chimneys
  for (const [cx, tall] of [[-0.7, 18], [-0.45, 14], [0.45, 16], [0.7, 20]]) for (const cz of [-0.5, 0.5]) {
    const [x, z] = [cx * PX, cz * PZ]
    k.block(x - 1.5, x + 1.5, yR, yR + tall, z - 1.5, z + 1.5, 'plaster')
    k.block(x - 2, x + 2, yR + tall, yR + tall + 0.5, z - 2, z + 2, 'dark')
  }
  k.block(-0.45, 0.45, yR + room, yR + room + mast, -0.45, 0.45, 'steel')
  // The low block behind, its front on the back ribs' faces: shop windows under a band, office
  // windows over it, a cornice, plant on its roof. Its shopfronts are a man's size, six metres.
  if (podium) {
    const B = { x0: -X - 36, x1: X + 72, z0: -Z - pd - 108, z1: -Z - pd, top: 3 * floor + 2 }
    k.block(B.x0, B.x1, 0, B.top, B.z0, B.z1, 'rose')
    k.block(B.x0 - 0.6, B.x1 + 0.6, B.top, B.top + 0.8, B.z0 - 0.6, B.z1, 'plaster')
    const shopfront = (base, out) => {
      k.relief(base, out, 6, pane(0.9, 4.6), 'dark')
      k.relief(base, out, 6.8, upright(4.6, 5.2, 0.8), 'plaster') // the fascia over it
      k.relief(base, out, 4.5, pane(6.8, B.top - 1), 'dark')
    }
    for (let x = B.x0 + 6; x + 6 <= B.x1 - 2; x += 8) shopfront({ x: x + 3, z: B.z0 }, [0, -1])
    for (const [x, out] of [[B.x0, [-1, 0]], [B.x1, [1, 0]]]) {
      for (let z = B.z0 + 6; z + 6 <= B.z1 - 2; z += 8) shopfront({ x, z: z + 3 }, out)
    }
    k.block(B.x1 - 54, B.x1 - 18, B.top + 0.8, B.top + 6.8, B.z0 + 18, B.z0 + 48, 'pale')
    k.block(B.x0 + 18, B.x0 + 36, B.top + 0.8, B.top + 4.8, B.z0 + 24, B.z0 + 78, 'pale')
    // The way up to its roof: a flight along its blank front past the shaft's end, climbing
    // toward the shaft, solid, a parapet on its open side; at its top a wall ahead and the roof on
    // the right, flush with the top tread.
    const STAIR = { lane: 6, from: B.x1 - 2 }
    const roof = B.top + 0.8
    const { length } = treads(roof)
    k.flight({ foot: { x: STAIR.from, z: B.z1 + STAIR.lane / 2 }, way: [-1, 0], width: STAIR.lane, y0: 0, y1: roof, under: null, parapets: [-1], parapet: { thick: 0.6, look: 'rose' }, look: 'rose' })
    const top = STAIR.from - length
    k.block(top - 0.6, top, roof, roof + 3.5, B.z1, B.z1 + STAIR.lane + 0.6, 'rose')
  }
  return result(k)
}
