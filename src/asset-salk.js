// The Salk Institute (Louis Kahn, La Jolla, 1962–65), `SCALE` times its size: two mirrored wings
// of laboratories either side of a bare travertine plaza, a thin channel of water down its middle
// toward the sea, and the view down that axis is the point. The owner liked it in the brutalism
// gallery ("Long axis and wall" in `docs/research/brutalism.md`). Sharp, as Kahn's concrete is:
// `block`s, `relief`s, `prism`s and `facade`s, never `mass`. The axis runs along Z, the land end
// is the front (+Z), the sea end −Z.
// - The plaza stands on a podium as high as the storeys under it, paved in travertine with a
//   joint across it every 6 m, the channel a groove down its middle from a small square fountain
//   at the land end to the sea end, where it falls down the podium's face into a pool on the
//   ground: a run down the axis ends in a drop. A stair the plaza's width climbs to it at the
//   front, in flights between landings, between two solid cheeks. Parapets low enough to vault
//   along its edges between the towers; benches toward the sea.
// - Each wing, outward from the plaza: a row of study towers, each an open portico on four piers
//   at the plaza's level, offices under the plaza, and studies over the portico whose windows
//   (glass in teak) are turned 45° to the sea, one study a bay, so the face to the plaza is a
//   sawtooth; a light court down to the ground, crossed from every other study floor by a bridge;
//   the block, its storeys from the ground a lab storey and the service storey over it by turns
//   (each service storey a band of openings between two of concrete, where Kahn's trusses carry
//   the pipes), and at its sea end offices behind teak; on its outer side light wells sunk to the
//   ground in a terrace at the plaza's level; at its land end a tower for the heating and the air;
//   a parapet and plant on its roof.
// Sizes, before `SCALE`. Sourced: six storeys, three under the ground, three lab storeys each
// under a service storey; trusses 9 ft (2.7 m) deep; light wells 40 × 25 ft on both sides of each
// building; 36 studies; teak round the studies' and the west offices' windows; six storeys of
// offices at the west end and towers for heating and air at the east end; pozzolanic concrete with
// a warm, pinkish glow; the travertine plaza and its channel east to west (all from Salk's own
// architecture guide). Lab floors 65 × 245 ft (20 × 75 m: Architecture Lab); the plaza some 90 m
// long (Studio Matrx); the channel about a foot wide, from a small square fountain (Threepenny
// Review); five towers a wing (the repo's research notes); the windows at about 45° (Studio
// Matrx alone). Guessed: the plaza's width (27 m), a tower's plan (9 × 9 m) and its portico's
// height, the storeys' heights (4 m a lab storey, 3 a service one), the offices' depth along the
// axis, the wells' count, the pool, the towers for the air, the paving's joints. At the defaults
// about 365 m across and 380 m along the axis, 63 m to the roofs, and about 2,500 forms.
// Pure: no scene.

import { between, kit, PARAPET, p, result, SCALE, treads, withDefaults } from './asset-kit.js'
import { rect } from './forms.js'

/** Its parameters as it is built when given none (`assets.js` hands them to the editor). Metres unless said. */
export const DEFAULTS = {
  storeys: 6 * SCALE, // from the ground up, a lab storey and a service storey by turns, a lab storey first
  under: 3 * SCALE, // of them under the plaza
  lab: 4, // height of a lab storey
  service: 3, // height of a service storey, where the trusses carry the pipes
  length: 90 * SCALE, // the plaza and the wings along the axis
  offices: 15 * SCALE, // of that, the offices at each wing's sea end
  labWidth: 20 * SCALE, // a wing across the axis
  court: 7.6 * SCALE, // the light court between a row of study towers and its wing
  plaza: 27 * SCALE, // between the two rows of study towers
  towers: 5, // study towers a side
  towerWidth: 9 * SCALE, // a study tower along the axis
  towerDeep: 9 * SCALE, // a study tower across it
  porch: 4.7 * SCALE, // height of the portico under a tower's studies
  study: 3.4, // height of a study storey
  studies: 6, // studies a storey on a tower's face to the plaza, each a slanted window
  bay: 3, // between two fins of a lab's or an office's windows
  bridge: 3, // width of a bridge across a light court
  wells: 4, // light wells along a wing's outer side
  well: [12.2 * SCALE, 7.6 * SCALE], // a light well along the wing and out from it
  walk: 3 * SCALE, // the terrace's walk outside the wells
  steps: true, // the stair up to the plaza at the front
  pool: true, // the channel's fall off the sea end into a pool
  air: true, // the towers for heating and air at the wings' land ends
}

export function salk(given) {
  const { storeys, under, lab, service, length, offices, labWidth, court, plaza, towers, towerWidth, towerDeep, porch, study, studies, bay, bridge, wells, well, walk, steps, pool, air } = withDefaults(DEFAULTS, given)
  const k = kit()
  // Each storey from the ground, a lab storey and a service storey by turns: where it begins and how tall.
  const levels = []
  for (let i = 0, y = 0; i < storeys; i++) {
    const h = i % 2 === 0 ? lab : service
    levels.push({ y, h, service: i % 2 === 1 })
    y += h
  }
  const height = (n) => levels.slice(0, n).reduce((sum, { h }) => sum + h, 0)
  const yP = height(Math.max(1, under)) // the plaza
  const yR = height(storeys) // the roofs
  const yS = yP + porch // the studies' first floor, over the porticoes
  const [zW, zE] = [-length / 2, length / 2] // the sea end, the land end
  const zO = zW + offices // where a wing's offices give way to its labs
  // Out from the axis: the plaza's edge (a tower's front), a tower's back, a wing's front, its back,
  // the wells' outer side and the terrace's.
  const xP = plaza / 2
  const xT = xP + towerDeep
  const xL = xT + court
  const xO = xL + labWidth
  const xW = xO + well[1]
  const xE = xW + walk
  const towerAt = Array.from({ length: towers }, (_, i) => zW + ((i + 0.5) * length) / towers) // each tower's middle along the axis
  const studyStoreys = Math.max(1, Math.round((yR - yS) / study))
  const st = (yR - yS) / studyStoreys
  const floors = yR > yS ? Array.from({ length: studyStoreys }, (_, m) => yS + m * st) : [] // the studies' floors
  const crossings = floors.filter((_, m) => m % 2 === 0) // the floors a bridge leaves from
  const d = towerWidth / studies // a study's bay along the tower's face, and how far its slanted window stands out
  const wellAt = Array.from({ length: wells }, (_, i) => zO + ((i + 0.5) * (zE - zO)) / wells) // along the labs only: the offices' outer side is buried
  const wellSpans = wellAt.map((z) => [z - well[0] / 2, z + well[0] / 2])
  const pane = (from, to, deep = 0.06) => [[0, from], [deep, from], [deep, to], [0, to]]
  const upright = (from, to, deep, d0 = 0) => [[d0, from], [d0 + deep, from], [d0 + deep, to], [d0, to]]
  // A strip laid 2 cm proud of what it lies on and drawn over it: a joint, a pool's water.
  const inlay = (x0, x1, y, z0, z1, look) =>
    k.form({ kind: 'sweep', at: p((x0 + x1) / 2, y, (z0 + z1) / 2), section: rect(x1 - x0, 0.02, 0), path: [p(0, 0, (z0 - z1) / 2), p(0, 0, (z1 - z0) / 2)], look, over: true })

  // A wing's labs on a long face at x = `x`, looking `out` (±1 along X), over `[z0, z1]` less the
  // `solid` stretches (where a bridge lands), from `y0` to `y1`: glass behind; a fin each `bay`
  // the whole height; on each service storey two bands of concrete with its openings between,
  // so that a lab storey reads as glass and a service storey as a row of square holes.
  function labFace(x, out, [z0, z1], [y0, y1], solid = []) {
    for (const [a0, a1] of between(z0 + 1, z1 - 1, solid)) {
      const at = { x, z: (a0 + a1) / 2 }
      k.relief(at, [out, 0], a1 - a0, pane(y0, y1), 'dark')
      const fins = Math.max(1, Math.round((a1 - a0) / bay))
      for (let i = 0; i <= fins; i++) k.relief({ x, z: a0 + ((a1 - a0) * i) / fins }, [out, 0], 0.4, upright(y0, y1, 0.7, 0.06), 'pozzolan')
      for (const { y, h, service: pipes } of levels) {
        if (!pipes || y < y0 - 0.01 || y + h > y1 + 0.01) continue
        k.relief(at, [out, 0], a1 - a0, upright(y, y + 1, 0.4, 0.06), 'pozzolan')
        k.relief(at, [out, 0], a1 - a0, upright(y + h - 0.8, y + h, 0.4, 0.06), 'pozzolan')
      }
    }
  }
  // Offices on a face (`facade`'s `face`, `at`, `out`) over `[a0, a1]` less the `solid` stretches,
  // from `y0` to `y1`: windows between fins, about one in five shut behind teak.
  function officeFace(face, at, out, [a0, a1], [y0, y1], solid = [], seed = 0) {
    for (const span of between(a0 + 1, a1 - 1, solid)) {
      k.facade({ face, at, out, along: span, rise: [y0, y1], bay, floor: 3.5, deep: 0.7, look: 'pozzolan', cell: (i, j) => ((i * 7 + j * 3 + seed) % 5 === 0 ? 'wood' : null) })
    }
  }

  // The podium and the plaza on it: travertine either side of the channel, a joint every 6 m.
  k.block(-xP, xP, 0, yP - 0.3, zW, zE, 'pozzolan')
  k.block(-xP, -0.2, yP - 0.3, yP, zW, zE, 'travertine')
  k.block(0.2, xP, yP - 0.3, yP, zW, zE, 'travertine')
  k.block(-0.2, 0.2, yP - 0.3, yP - 0.2, zW, zE, 'water')
  for (let z = zW + 6; z < zE - 3; z += 6) for (const [x0, x1] of [[-xP, -0.2], [0.2, xP]]) inlay(x0, x1, yP, z - 0.12, z + 0.12, 'pozzolan')
  // The small square fountain the channel runs from, over its head.
  k.block(-0.9, 0.9, yP, yP + 0.6, zE - 9, zE - 7.2, 'travertine')
  inlay(-0.6, 0.6, yP + 0.6, zE - 8.7, zE - 7.5, 'water')
  // Benches toward the sea, along both edges.
  for (const s of [1, -1]) for (let i = 0; i < 4; i++) {
    const z = zW + 12 * (i + 1) + 1 // between two joints
    const [x0, x1] = s > 0 ? [xP - 7, xP - 6.4] : [-xP + 6.4, -xP + 7]
    k.block(x0, x1, yP, yP + 0.45, z, z + 4, 'travertine')
  }
  if (steps) {
    // The stair up to the plaza, the plaza's width: its risers under `stepUp`, a landing every
    // eighteen, its top tread the plaza's last metre, between two solid cheeks of the podium's
    // concrete. A stair you take at speed must not leave you on an open edge, and Kahn's ends in walls.
    const CHEEK = 3
    const { length: L } = treads(yP)
    k.flight({ foot: { x: 0, z: zE + L }, way: [0, -1], width: plaza - 2 * CHEEK, y0: 0, y1: yP, under: null, parapets: [-1, 1], parapet: { thick: CHEEK, look: 'pozzolan' }, look: 'travertine' })
  }
  if (pool) {
    // The channel's fall down the podium's face, and the pool it falls into, on the ground.
    const P = { x: 12, long: 30, rim: 0.6, water: 0.4 }
    k.relief({ x: 0, z: zW }, [0, -1], 0.4, pane(P.water, yP - 0.2), 'water')
    k.block(-P.x + P.rim, P.x - P.rim, 0, P.water, zW - P.long + P.rim, zW, 'water')
    k.block(-P.x, -P.x + P.rim, 0, P.rim, zW - P.long, zW, 'travertine')
    k.block(P.x - P.rim, P.x, 0, P.rim, zW - P.long, zW, 'travertine')
    k.block(-P.x + P.rim, P.x - P.rim, 0, P.rim, zW - P.long, zW - P.long + P.rim, 'travertine')
  }

  for (const s of [1, -1]) {
    // A span out from the axis on this side, given as on the +X side: its least and most x.
    const xs = (a, b) => (s > 0 ? [a, b] : [-b, -a])

    // The study towers, and the bridges from their floors across the court.
    const PIER = 3
    for (const zc of towerAt) {
      const [z0, z1] = [zc - towerWidth / 2, zc + towerWidth / 2]
      k.block(...xs(xP, xT), 0, yP - 0.3, z0, z1, 'pozzolan') // offices under the plaza, their windows on the court
      k.block(...xs(xP, xT), yP - 0.3, yP, z0, z1, 'travertine') // the portico's floor, paved as the plaza
      k.facade({ face: 'x', at: s * xT, out: s, along: [z0 + 1, z1 - 1], rise: [0, yP - 0.3], bay, floor: 3.5, deep: 0.5, look: 'pozzolan' })
      for (const [a, b] of [[xP, xP + PIER], [xT - PIER, xT]]) {
        for (const [c, e] of [[z0, z0 + PIER], [z1 - PIER, z1]]) k.block(...xs(a, b), yP, yS - 1, c, e, 'pozzolan')
      }
      k.block(...xs(xP, xT), yS - 1, yS, z0, z1, 'pozzolan') // the portico's ceiling, the studies' floor
      if (floors.length) {
        k.block(...xs(xP + d, xT), yS, yR, z0, z1, 'pozzolan')
        // Each study's bay: its wall square to the face looks to the land, its window to the sea.
        for (let j = 0; j < studies; j++) {
          const [a0, a1] = [z0 + j * d, z0 + (j + 1) * d]
          k.prism([[s * (xP + d), a0], [s * (xP + d), a1], [s * xP, a1]], yS, yR, 'pozzolan')
          const glass = { x: s * (xP + d / 2), z: (a0 + a1) / 2 }
          const out = [-s / Math.SQRT2, -1 / Math.SQRT2]
          for (const y of floors) {
            k.relief(glass, out, d * Math.SQRT2 - 0.8, pane(y + 0.3, y + st - 0.3, 0.15), 'wood')
            k.relief(glass, out, d * Math.SQRT2 - 2.4, upright(y + 0.8, y + st - 0.6, 0.06, 0.15), 'dark')
          }
        }
        // A parapet round the roof's plain edges; the sawtooth's tops are left open.
        k.block(...xs(xT - 0.4, xT), yR, yR + PARAPET, z0, z1, 'pozzolan')
        k.block(...xs(xP + d, xT - 0.4), yR, yR + PARAPET, z0, z0 + 0.4, 'pozzolan')
        k.block(...xs(xP + d, xT - 0.4), yR, yR + PARAPET, z1 - 0.4, z1, 'pozzolan')
      }
      for (const y of crossings) {
        // A door in teak on the tower's back between the bridge's parapets, a single leaf as the
        // bridge is narrow; and the bridge, its deck the floor.
        k.door('x', s * xT, s, zc, y, 'wood', bridge - 0.9)
        k.block(...xs(xT, xL), y - 0.6, y, zc - bridge / 2, zc + bridge / 2, 'pozzolan')
        k.block(...xs(xT, xL), y, y + PARAPET, zc - bridge / 2, zc - bridge / 2 + 0.2, 'pozzolan')
        k.block(...xs(xT, xL), y, y + PARAPET, zc + bridge / 2 - 0.2, zc + bridge / 2, 'pozzolan')
      }
    }
    // The plaza's edge where no tower stands, over the drop into the court: a parapet to vault.
    for (const [a, b] of between(zW, zE, towerAt.map((zc) => [zc - towerWidth / 2, zc + towerWidth / 2]))) {
      k.block(...xs(xP - 0.5, xP), yP, yP + PARAPET, a, b, 'travertine')
    }

    // The wing: one mass, its faces the labs' and the offices', a parapet and plant on its roof.
    k.block(...xs(xL, xO), 0, yR, zW, zE, 'pozzolan')
    const landings = crossings.length ? towerAt.map((zc) => [zc - bridge / 2 - 1, zc + bridge / 2 + 1]) : []
    labFace(s * xL, -s, [zO, zE], [0, yR], landings)
    labFace(s * xO, s, [zO, zE], [yP, yR])
    for (const span of wellSpans) labFace(s * xO, s, span, [0, yP]) // under the terrace, only in the wells
    officeFace('x', s * xL, -s, [zW, zO], [0, yR], landings, 0)
    officeFace('x', s * xO, s, [zW, zO], [yP, yR], [], 2)
    officeFace('z', zW, -1, xs(xL, xO), [0, yR], [], 4) // to the sea
    k.block(...xs(xL, xL + 0.4), yR, yR + PARAPET, zW, zE, 'pozzolan')
    k.block(...xs(xO - 0.4, xO), yR, yR + PARAPET, zW, zE, 'pozzolan')
    k.block(...xs(xL + 0.4, xO - 0.4), yR, yR + PARAPET, zW, zW + 0.4, 'pozzolan')
    k.block(...xs(xL + 0.4, xO - 0.4), yR, yR + PARAPET, zE - 0.4, zE, 'pozzolan')
    for (const zc of [(zO + zE) / 2 - (zE - zO) / 4, (zO + zE) / 2 + (zE - zO) / 4]) {
      k.block(...xs(xL + labWidth * 0.3, xO - labWidth * 0.3), yR, yR + 4.5, zc - 18, zc + 18, 'pozzolan')
    }

    // The terrace on the wing's outer side at the plaza's level, its light wells sunk to the
    // ground, a parapet round each where the terrace meets it.
    k.block(...xs(xW, xE), 0, yP, zW, zE, 'pozzolan')
    for (const [a, b] of between(zW, zE, wellSpans)) k.block(...xs(xO, xW), 0, yP, a, b, 'pozzolan')
    for (const [a, b] of wellSpans) {
      k.block(...xs(xW, xW + 0.4), yP, yP + PARAPET, a, b, 'pozzolan')
      k.block(...xs(xO + 0.8, xW), yP, yP + PARAPET, a - 0.4, a, 'pozzolan') // clear of the wing's fins
      k.block(...xs(xO + 0.8, xW), yP, yP + PARAPET, b, b + 0.4, 'pozzolan')
    }

    if (air) {
      // The tower for heating and air against the wing's land end: a slot of a window up each
      // face it shows, a steel grille round its head over the wing's roof.
      const A = { x0: xL + labWidth * 0.3, x1: xO - labWidth * 0.3, z1: zE + 15, top: yR + 9 }
      k.block(...xs(A.x0, A.x1), 0, A.top, zE, A.z1, 'pozzolan')
      k.relief({ x: (s * (A.x0 + A.x1)) / 2, z: A.z1 }, [0, 1], 1.5, pane(3, yR - 3), 'dark')
      k.relief({ x: (s * (A.x0 + A.x1)) / 2, z: A.z1 }, [0, 1], A.x1 - A.x0, pane(yR + 1, yR + 7, 0.15), 'steel')
      for (const [x, way] of [[A.x0, -1], [A.x1, 1]]) {
        k.relief({ x: s * x, z: (zE + A.z1) / 2 }, [s * way, 0], 1.5, pane(3, yR - 3), 'dark')
        k.relief({ x: s * x, z: (zE + A.z1) / 2 }, [s * way, 0], A.z1 - zE, pane(yR + 1, yR + 7, 0.15), 'steel')
      }
    }
  }
  return result(k)
}
