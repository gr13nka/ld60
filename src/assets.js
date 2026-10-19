// Buildings as whole assets: a house, a tower, a stair, a doorway, a bridge, each made once in its
// own frame and stood in a place as many times as wanted, turned and moved as one. An asset
// stands in a place in one of two forms:
// - live: an instance in the place's `assets`, `{ tag, name, params, parts, at, yaw }` (`places.js`),
//   built afresh by `buildAsset` whenever the place is stood up, so that a changed parameter is a
//   changed building, and the editor (`editor.js`) moves, turns and retypes it as one thing. Its
//   `params` hold only what differs from `DEFAULTS`; its `parts` what was changed by hand in one
//   part or another of it (`asset-parts.js`).
// - baked: forms and murals carrying the same `asset` tag ('flats-2'), written into the lists
//   once by `bakeAsset` (the palace and the scaffold are made so, by `scripts/places/`), which the
//   editor picks together on the first click and the one part under the pointer on the second,
//   and which keep the hand tuning done on them since.
// This module owns the convention that ties the two to the lists: the tag ('<name>-<n>'), a live
// asset's form ids ('<tag>:<n>') and the `asset: tag` on a baked part (`freshTag`, `kindOfTag`,
// `assetParts`, `checkInstance`).
//
// An asset's frame: its footprint about x = z = 0, the ground at y = 0, its front toward +Z.
// `bakeAsset` turns and moves that frame into a place; `ASSETS` are the builders, each taking
// its own parameters (all of them optional) and giving `{ forms, murals }`.
//
// The scale they are made at and the kit they are made of are `asset-kit.js`'s: every building
// is `SCALE` times its real size, its storeys, windows, doors and parapets a man's. A landmark
// has a module of its own (`asset-velasca.js`, `asset-salk.js`, `asset-sesc.js`, and the palace's
// outside, `asset-palace.js`, read off its place file), and so have the
// brutalist stairs (`asset-stairs.js`) and doorways (`asset-portals.js`), which a building may
// also stand inside itself (the kit's `add`); the scaffold's buildings are here.
//
// The rules every builder keeps, so that nothing stands inside anything:
// - A face that carries something (a grid, a ladder, a mosaic, pipes) is flat: no belly, no
//   taper, no drawn-in crown on that mass, and what it carries spans only its flat part,
//   between the rounded corners.
// - Every extent comes from the builder's own numbers; parts meet face to face. A tier's foot is
//   the last tier's top; a fin's back is on its face; a floor's edge runs between the outer fins;
//   a drum, a stack, a tank or a pipe stands on or against what holds it, never in it.
// - The look is the scaffold's: brutalist mass and grid (`docs/research/brutalism.md`) softened
//   after Machinarium (round corners, bellies, leaning drums, domes, portholes, pipes), the frame
//   grey and the colour only in the recesses, never red or green. Velasca, Salk and SESC are
//   sharp, Velasca at the owner's choice, Salk and SESC as Kahn and Lina Bo Bardi built them, and
//   SESC's orange on rails and frames as her red was: their own comments say why.
// Pure: no scene.

import { KEYBOARD, LEDGE, PARAPET, between, hash, kit, ladder, p, placeRecords, result, withDefaults } from './asset-kit.js'
import { salk, DEFAULTS as SALK } from './asset-salk.js'
import { sesc, DEFAULTS as SESC } from './asset-sesc.js'
import { velasca, DEFAULTS as VELASCA } from './asset-velasca.js'
import { palace, DEFAULTS as PALACE } from './asset-palace.js'
import { slabPlatform, steppedPlatform, cantileverPlatform, waffleDeck, podStack, troughPlatform, pierPlatform, mushroomColumn, consoleTree, twinBlades, stiltDeck, spiralLandings, squareColumn, bladeColumn, drumColumn, shearedColumn, colonnade, beamBridge, troughBridge, hungBridge, brokenBridge, steppedBridge, DEFAULTS as PLATFORMS } from './asset-platforms.js'
import { ajarPortal, bladePortal, cleftPortal, deepPortal, funnelPortal, gatePortal, hoodPortal, stackPortal, steppedPortal, sunkPortal, weightPortal, DEFAULTS as PORTALS } from './asset-portals.js'
import { flightStair, helixStair, hungStair, towerStair, DEFAULTS as STAIRS } from './asset-stairs.js'
import { buildForm, roundedRect } from './forms.js'
import { keyed, withParts } from './asset-parts.js'
import { EDITABLE_LISTS, recordProblem } from './place-file.js'

export { LEDGE }

// Every builder's parameters with what each is when not given: the one place they are said, so
// that a place's `params` need hold only what differs and the editor can show them all
// (`assetDefaults`). A builder reads its own through `withDefaults`. Metres unless said; `sink`
// is in every one: how far down what stands on the ground goes on, for a place over an abyss.
const DEFAULTS = {
  flats: {
    bays: 108, // loggia bays along the front
    bay: 3.8, // width of one bay: a flat's loggia, a man's size
    floors: 45, // storeys in the body, above the pilotis
    floor: 3.2, // height of one storey
    pilotis: 24, // height of the pilotis the body stands on
    piers: 7, // pilotis along each long face
    depth: 72, // front to back
    r: 8, // radius of the corners
    ladder: true, // the scaffold's ladder up the front to the roof
    mosaic: 'seraph', // the picture on the blank end (`murals.js`)
    sink: 0,
  },
  tower: {
    bays: 70, // bays across a tier's front
    bay: 3.6, // width of one bay: an office window's
    floor: 4.2, // height of one storey
    tiers: 3, // stacked blocks, each further toward the front than the last
    floorsPer: 8, // storeys in a tier
    overhang: 12, // how far a tier stands out past the one under it
    depth: 150, // front to back of a tier
    r: 6, // radius of the corners
    balconyBay: 6, // the bay, counted from the −X end, that the balcony leaves
    wing: true, // the lower wing past the +X end
    slot: 8, // width of the slot between the foot and the wing: set by the jump, not by the scale
    quiet: [], // [from, to] stretches along X of the foot's front left without a shop window
    sink: 0,
  },
  house: {
    roof: 28, // height of the roof
    span: 14.25, // the pilotis' grid, in both directions
    sink: 0,
  },
  archBridge: {
    span: 34, // length along +X
    rise: 3, // how far the deck humps over a straight line from end to end
    drop: 0, // how far the far end is lower than the near
    width: 4, // across the deck
    thick: 1.2, // depth of the deck
    sag: 7, // how far the rib springs lower than the deck at each end
    reach: 0, // how far the rib's far foot goes on past the deck's end
    sink: 0,
  },
  pipeShaft: {
    height: 38.4, // top of the pipes, up the wall
    spread: 1.4, // each pipe's distance from the middle
    from: 0, // height of the first plate he stands to begin on: the ground, or a landing
    landing: 0, // how far out from the wall that first plate reaches, if it is not the ground
    sink: 0,
  },
  steamMain: {
    length: 60, // along X, end to end
    height: 12, // of the pipe's middle over the ground
    radius: 1.1, // of the pipe: its round top is what he runs along
    span: 15, // between the trestles it rests on
    flange: 5, // between the collars round it
    drop: 1, // 1: each end turns down into the ground; 0: it ends in the air
    sink: 0,
  },
  velasca: VELASCA,
  salk: SALK,
  sesc: SESC,
  palace: PALACE,
  ...STAIRS,
  ...PORTALS,
  ...PLATFORMS,
}

/** The asset `name`'s parameters as it is built when given none: a copy, to be changed. */
export const assetDefaults = (name) => structuredClone(DEFAULTS[name])

export const ASSETS = {
  // The builders' house: the Unité d'Habitation, Marseille (Le Corbusier), softened after
  // Machinarium, made at `SCALE` times its size. Sourced: about 137 m long, 24 m wide, 56 m high,
  // 18 floors, a dozen massive pilotis, loggias on both long faces, a roof terrace with a gym and
  // ventilation stacks (Structurae, Wikipedia). Estimated: the pilotis' height (8 m), the floor
  // height (3 m) and the loggia's width (3.66 m, Modulor). So it is about 410 × 72 m and 170 m high,
  // its pilotis 24 m tall, and bigger by 45 storeys and 108 bays, each a man's. The block stands on
  // `piers` pilotis a face, with a hall between two of them and a way through it from front to
  // back, 28 × 18 m, lined dark under a hood, lift doors in its sides; loggias on the front and the
  // −X end (a few of them coloured; a band of them a third up for the shopping street); a plain
  // back with coarse floor edges, and off it the stair tower (a `towerStair`, bridged to it every
  // third storey), the back bare behind it; a mosaic over half of the blank +X end; on the front,
  // beside the way through, the scaffold's ladder (`ladder`) up to the roof; on the roof a gym,
  // two lift houses, stacks and tanks, the front strip left clear to step onto from a bridge. The
  // facades are `facade`s, not grids: about 1,580 forms at the defaults (the front's 760, the −X
  // end's 140, the back's 100, the stair tower's 250, the ladder's 72).
  flats(given) {
    const { bays, bay, floors, floor, pilotis, piers, depth, r, ladder: withLadder, mosaic, sink } = withDefaults(DEFAULTS.flats, given)
    const k = kit(sink)
    const flat = bays * bay // the front's flat part, between the rounded corners
    const X = flat / 2 + r
    const Z = depth / 2
    const body = pilotis + floors * floor
    const roof = Math.ceil((body + 1) / LEDGE) * LEDGE // the lip brings it to a whole number of ledges
    k.mass(-X, X, -Z, Z, pilotis, body, 'concrete', { r, crown: false })
    k.mass(-X, X, -Z, Z, body, roof, 'pale', { r, crown: false }) // the roof's lip, flush so that the ladder reaches it

    // The pilotis, two rows, tapering; the hall between the second and third of each row.
    const reach = flat / 2 - 20
    const gap = (2 * reach) / (piers - 1)
    for (let i = 0; i < piers; i++) {
      for (const z of [-(Z - 14), Z - 14]) {
        k.form({ kind: 'lathe', at: p((i - (piers - 1) / 2) * gap, 0, z), smooth: true, look: 'concrete', profile: [[0, k.foot], [5, k.foot], [3.5, pilotis], [0, pilotis]] })
      }
    }
    const hall = { x: (1.5 - (piers - 1) / 2) * gap, half: Math.min(24, (gap - 13) / 2) } // clear of the pilotis' feet, 5 m round
    // The way through it, front to back (the owner: "doorways and stairs in current assets are very
    // poor"): a hole of the gauge's size, 28 × 18 m, cut through the hall and lined dark, under a
    // hood on the front; in its sides, doors to the lifts. Over an abyss there is no ground to come
    // in from, and the hall is solid.
    const PASS = { half: 14, tall: 18, lining: 0.3, hood: 12 }
    const cut = PASS.half + PASS.lining
    if (sink === 0) {
      k.block(hall.x - hall.half, hall.x - cut, k.foot, pilotis, -Z, Z, 'concrete')
      k.block(hall.x + cut, hall.x + hall.half, k.foot, pilotis, -Z, Z, 'concrete')
      k.block(hall.x - cut, hall.x + cut, PASS.tall + PASS.lining, pilotis, -Z, Z, 'concrete')
      k.block(hall.x - cut, hall.x - PASS.half, 0, PASS.tall, -Z, Z, 'dim')
      k.block(hall.x + PASS.half, hall.x + cut, 0, PASS.tall, -Z, Z, 'dim')
      k.block(hall.x - cut, hall.x + cut, PASS.tall, PASS.tall + PASS.lining, -Z, Z, 'dim')
      for (const z of [-Z / 2, 0, Z / 2]) for (const s of [-1, 1]) k.door('x', hall.x + s * PASS.half, -s, z, 0)
      k.hood({ face: 'z', at: Z, out: 1, along: [hall.x - cut - 0.6, hall.x + cut + 0.6], y: PASS.tall + PASS.lining, reach: PASS.hood, deep: pilotis - PASS.tall - PASS.lining, look: 'concrete' })
    } else k.block(hall.x - hall.half, hall.x + hall.half, k.foot, pilotis, -Z, Z, 'concrete')

    // The ladder climbs the hall's front beside the way through, past the hood, and the wall above
    // it, so the loggias leave its strip bare.
    const lift = { x0: hall.x + cut + 1.2, x1: hall.x + cut + 9.2 }
    // About a tenth of the loggias take a colour; the shopping street, a third of the way up, is plaster.
    const street = Math.round(floors / 3)
    const loggias = (seed) => (i, j) => {
      if (j === street || j === street + 1) return 'plaster'
      const h = hash(i + seed, j)
      return h > 0.88 ? KEYBOARD[Math.floor(h * 97) % KEYBOARD.length] : null
    }
    const face = { rise: [pilotis, body], bay, floor, deep: 1.2, soft: true }
    k.facade({ ...face, face: 'z', at: Z, out: 1, along: [-X + r, lift.x0 - 2], cell: loggias(0) })
    k.facade({ ...face, face: 'z', at: Z, out: 1, along: [lift.x1 + 2, X - r], cell: loggias(41) })
    k.facade({ ...face, face: 'x', at: -X, out: -1, along: [-Z + r, Z - r], cell: loggias(17) })

    // The stair: a tower standing off the back across a gap (Trellick's service tower), a
    // `towerStair` whose lobby is the pilotis' height and whose landings are every third storey of
    // the flats, its roof level with the body's top; a bridge leaves each landing for a door in the
    // back, and its roof's for the foot of the lip, a ledge (2.4 m) under the roof. Behind it the
    // back is bare, so a bridge lands on the face wherever it leaves.
    const STAIR = { gap: 8, per: 3 }
    const stairs = { lobby: pilotis, storeys: floors, floor, per: STAIR.per, bridge: STAIR.gap, look: 'concrete', tread: 'pale', sink }
    const { hi: shaft } = assetExtent('towerStair', { ...stairs, bridge: 0 }) // its half-length and its fins' face
    const stairX = -X + r + shaft.x + 2
    k.add(ASSETS.towerStair(stairs), { at: { x: stairX, y: 0, z: -Z - STAIR.gap - shaft.z } })

    // The rest of the back: a floor's edge at each storey and a fin every six bays.
    k.facade({ ...face, face: 'z', at: -Z, out: -1, along: [stairX + shaft.x + 2, X - r], bay: bay * 6, look: 'pale', glass: 'concrete', deep: 1 })

    // The blank end: a mosaic over about half of it (48 × 76 on a wall 56 × 144), in a pale frame.
    const MOSAIC = { w: Math.min(48, depth - 2 * r - 6), h: Math.min(76, body - pilotis - 32), y: pilotis + 16 }
    k.bar(X, X + 0.8, MOSAIC.y - 1.5, MOSAIC.y + MOSAIC.h + 1.5, -MOSAIC.w / 2 - 1.5, MOSAIC.w / 2 + 1.5, 'pale', 0.3)
    k.murals.push({ subject: mosaic, x: X + 0.85, y: MOSAIC.y + MOSAIC.h / 2, z: 0, w: MOSAIC.w, h: MOSAIC.h, yaw: Math.PI / 2 })

    if (withLadder) ladder(k, lift.x0, lift.x1, Z, roof)

    // The roof terrace: the gym, with round windows on its front; lift houses; stacks and tanks on the back half.
    const gym = { x0: -X + r + 14, x1: -X + r + 62, z0: -Z + 8, z1: -4, h: 5 }
    k.mass(gym.x0, gym.x1, gym.z0, gym.z1, roof, roof + gym.h, 'concrete', { r: 4, taper: 0.96 })
    for (const x of [8, 20, 32, 44]) k.porthole('z', gym.z1, 1, gym.x0 + x, roof + gym.h / 2, 0.8)
    for (const x of [-110, 105]) k.mass(x - 8, x + 8, -Z + 8, -Z + 20, roof, roof + 4.8, 'concrete', { r: 2, taper: 0.97 })
    for (let i = 0; i < 6; i++) k.stack(-70 + 50 * i, roof, -Z + 10, 4, 16)
    k.tank(55, roof, -Z + 14, 9, 12)
    k.tank(-45, roof, -Z + 14, 7.5, 10)
    return result(k)
  },

  // The offices: Boston City Hall (Kallmann McKinnell & Knowles), top-heavy, softened, made at
  // `SCALE` times its size. Sourced: 98 × 76 m in plan, nine storeys, 42 m high, piers rising 27 m
  // under three office floors that project outward as they rise, close-set precast fins, a brick
  // base in the hillside (Wikipedia, MIT record). Estimated: the office storey (4.2 m, taken as
  // real). So the foot is 294 × 228 m, the whole 127 m high, in 30 storeys of 4.2 m. A foot of
  // stores (the ground storey's shop windows with hoods over them, and above them a blank brick
  // wall with a few windows; the stretches in `quiet` left bare both ways); `tiers` of
  // `floorsPer` storeys, each standing `overhang` further toward the front than the one under it,
  // fins close on the front, coarse on the ends and the back; a balcony out of the lowest at
  // `balconyBay`; plant, tanks and stacks on the roof, whose air comes down the −X end in pipes
  // onto the foot's roof; and (`wing`) a lower wing past the +X end across a slot. The ways up,
  // one after the other: a monumental flight in two tiers (a `flightStair`, Boston's own brick
  // steps) climbing the foot's back from the street to its roof, which is open there, behind the
  // tiers; then, straight ahead on that roof against the tiers' back, a stair in an open drum (a
  // `helixStair`, Yamanashi's cores), its way in toward the flight, its top bridged onto the
  // tiers' roof. The foot stays concrete: the frame is grey and the
  // colour only in the recesses. About 1,200 forms at the defaults (the tiers' 700, the foot's
  // 230, the drum's 300, the wing's 80).
  tower(given) {
    const { bays, bay, floor, tiers, floorsPer, overhang, depth, r, balconyBay, wing, slot, quiet, sink } = withDefaults(DEFAULTS.tower, given)
    const k = kit(sink)
    const DEEP = 1.2 // how far the fins and floor edges stand out
    const FOOT = { X: 147, Z: 114, body: 6 * floor, shops: floor }
    FOOT.top = FOOT.body + 1.5
    const X = (bays * bay) / 2 + r
    const back = FOOT.Z - depth
    const keyed = (seed) => (i, j) => {
      const h = hash(i + seed, j)
      return h > 0.92 ? KEYBOARD[Math.floor(h * 97) % KEYBOARD.length] : null
    }
    k.mass(-FOOT.X, FOOT.X, -FOOT.Z, FOOT.Z, k.foot, FOOT.body, 'concrete', { r: 6, crown: false })
    k.mass(-FOOT.X - 1.5, FOOT.X + 1.5, -FOOT.Z - 1.5, FOOT.Z + 1.5, FOOT.body, FOOT.top, 'pale', { r: 7.5, crown: false }) // its cornice
    for (let x = -FOOT.X + 9; x + 4 <= FOOT.X - 9; x += 6) {
      if (quiet.some(([from, to]) => x + 4.4 > from && x - 0.4 < to)) continue
      k.block(x, x + 4, 0.5, 3.4, FOOT.Z, FOOT.Z + 0.3, 'dark') // the stores' windows
      k.bar(x - 0.4, x + 4.4, 3.6, FOOT.shops, FOOT.Z, FOOT.Z + 1.8, 'pale', 0.2) // and the hoods over them
    }
    // Above the shops the brick is mostly blank: a window in about half the cells.
    for (const [a, b] of between(-FOOT.X + 6, FOOT.X - 6, quiet)) {
      k.facade({ face: 'z', at: FOOT.Z, out: 1, along: [a, b], rise: [FOOT.shops, FOOT.body], bay: 7.2, floor, deep: 0.4, fin: 0.5, soft: true, glass: 'concrete', cell: (i, j) => (hash(i + Math.round(a), j) > 0.5 ? 'dark' : null) })
    }

    let y = FOOT.top
    for (let t = 0; t < tiers; t++) {
      const front = FOOT.Z + t * overhang
      const top = y + floorsPer * floor
      const tier = { rise: [y, top], floor, deep: DEEP, soft: true }
      k.mass(-X, X, back, front, y, top, 'concrete', { r, crown: false })
      k.facade({ ...tier, face: 'z', at: front, out: 1, along: [-X + r, X - r], bay, cell: keyed(t * 7) })
      k.facade({ ...tier, face: 'z', at: back, out: -1, along: [-X + r, X - r], bay: 2 * bay })
      for (const side of [-1, 1]) k.facade({ ...tier, face: 'x', at: side * X, out: side, along: [back + r, front - r], bay: 2 * bay })
      if (t === 0) {
        // The balcony, two bays wide on the second floor's edge, its parapet solid; the fins' tips hold its slab.
        const a = -X + r + balconyBay * bay + 0.2
        const b = a + 2 * bay - 0.4
        const slab = y + 2 * floor
        const near = front + DEEP
        const far = near + 3.6
        k.bar(a, b, slab - 0.5, slab, near, far, 'concrete', 0.2)
        k.bar(a, b, slab, slab + PARAPET, far - 0.2, far, 'pale', 0.1)
        for (const [x0, x1] of [[a, a + 0.2], [b - 0.2, b]]) k.bar(x0, x1, slab, slab + PARAPET, near, far, 'pale', 0.1)
      }
      y = top
    }
    const roof = y
    k.mass(-55, 55, back + 16, back + 64, roof, roof + 14, 'concrete', { r: 8, belly: 1.04, taper: 0.94 }) // the plant
    const PIPE = { r: 1.5, stackX: -X + 12, stackR: 5 }
    for (const z of [back + 20, back + 50]) k.stack(PIPE.stackX, roof, z, PIPE.stackR, 20)
    k.tank(X - 24, roof, back + 28, 9, 12)
    k.tank(X - 24, roof, back + 80, 7.5, 14)
    for (const z of [back + 20, back + 50]) {
      const out = -X - DEEP - PIPE.r - 0.15
      k.pipe([p(PIPE.stackX + PIPE.stackR, roof + PIPE.r, z), p(-X + 1, roof + PIPE.r, z), p(out, roof - 0.5, z), p(out, FOOT.top + 3, z), p(out - 2, FOOT.top + PIPE.r, z), p(-FOOT.X + 4, FOOT.top + PIPE.r, z)], PIPE.r)
    }
    // The drum on the foot's roof, a bridge's length off the fins on the tiers' back: its way in
    // toward the foot's open roof behind (−Z), its top bridged (+Z) onto the tiers' roof, the
    // bridge's end on the outer face of the last floor's edge.
    const HELIX = { x: X - 24, bridge: 4 }
    const helix = { height: roof - FOOT.top, bridge: HELIX.bridge, bridgeAt: Math.PI / 2, doorAt: -Math.PI / 2, look: 'concrete', tread: 'pale' }
    const { hi: drum } = assetExtent('helixStair', { ...helix, bridge: 0 })
    k.add(ASSETS.helixStair(helix), { at: { x: HELIX.x, y: FOOT.top, z: back - DEEP - HELIX.bridge - drum.z } })
    // The street's flight up the foot's back to its roof, in line with the drum's way in, its top
    // terrace open onto the cornice: turned half round, so it climbs +Z. Over an abyss there is no street.
    if (sink === 0) {
      const steps = { rise: FOOT.top / 2, tiers: 2, width: 30, back: false, look: 'concrete', tread: 'pale' }
      const { lo: top } = assetExtent('flightStair', steps) // its top terrace's back edge
      k.add(ASSETS.flightStair(steps), { at: { x: HELIX.x, y: 0, z: -FOOT.Z - 1.5 + top.z }, yaw: Math.PI })
    }
    if (wing) {
      const W = { x0: FOOT.X + slot, x1: FOOT.X + slot + 150, z0: -FOOT.Z, z1: 40, top: 17 * floor }
      k.mass(W.x0, W.x1, W.z0, W.z1, k.foot, W.top, 'concrete', { r, crown: false })
      k.facade({ face: 'z', at: W.z1, out: 1, along: [W.x0 + r, W.x1 - r], rise: [W.top - 8 * floor, W.top], bay, floor, deep: DEEP, soft: true, cell: keyed(3) })
    }
    return result(k)
  },

  // A small house on pilotis: the Villa Savoye (Le Corbusier), softened, at `SCALE` times its
  // size. Sourced: pilotis on a 4.75 m grid, 190 m² on the ground (Cité de l'architecture).
  // Estimated: the main floor 19 × 21 m and the height 9–10 m. So the pilotis' grid is 14.25 m
  // (`span`), the main floor 57 × 63 m and the whole 28 m high; the pilotis tower 9 m, two of a
  // man's storeys of 3.6 m make the bellied lower room, three the wider upper one. Sixteen
  // tapering pilotis; the lower room bellied, narrower than the upper by the 4.5 m that
  // overhangs it; the upper room with a loggia grid (`facade`) on each face, about a fifth of its
  // cells coloured on the front; a lip round the flat roof, to land on, with a screen wall for the
  // solarium and a cupola on a back corner. About 115 forms.
  house(given) {
    const { roof, span, sink } = withDefaults(DEFAULTS.house, given)
    const k = kit(sink)
    const STOREY = 3.6
    const foot = 9
    const split = foot + 2 * STOREY
    const top = roof - 1
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      k.form({ kind: 'lathe', at: p((i - 1.5) * span, 0, (j - 1.5) * span), smooth: true, look: 'concrete', profile: [[0, k.foot], [1.6, k.foot], [1.1, foot], [0, foot]] })
    }
    k.mass(-24, 24, -27, 27, foot, split, 'concrete', { r: 6, belly: 1.04, crown: false })
    k.mass(-28.5, 28.5, -31.5, 31.5, split, top, 'concrete', { r: 7, crown: false })
    const upper = { rise: [split, top], bay: STOREY, floor: STOREY, deep: 1, soft: true }
    k.facade({ ...upper, face: 'z', at: 31.5, out: 1, along: [-21.5, 21.5], cell: (i, j) => (hash(i + 5, j) > 0.8 ? KEYBOARD[Math.floor(hash(i + 5, j) * 97) % KEYBOARD.length] : null) })
    k.facade({ ...upper, face: 'z', at: -31.5, out: -1, along: [-21.5, 21.5] })
    for (const side of [-1, 1]) k.facade({ ...upper, face: 'x', at: side * 28.5, out: side, along: [-24.5, 24.5] })
    k.mass(-30, 30, -33, 33, top, roof, 'pale', { r: 8.5 })
    k.bar(-12, 14, roof, roof + 3.6, -2, -0.6, 'whitewash', 0.5) // the solarium's screen
    k.drum(-22, -24, roof, roof + 4.5, 3.6, 'whitewash', { belly: 1.08 })
    k.cupola(-22, roof + 4.5, -24, 3.6)
    return result(k)
  },

  // A footbridge whose deck humps `rise` over its span along +X from x = 0 (where its top is at
  // y = 0) to x = `span` (at y = −`drop`): a concrete deck with soft edges on an arch rib that
  // springs `sag` lower at each end and meets the deck's underside at the crown, slender posts
  // between. Its ends are the faces it spans between, so it stands in neither; `reach` carries
  // the rib's far foot on past the deck's end, to a face set back under a cornice the deck rests on.
  archBridge(given) {
    const { span, rise, drop, width, thick, sag, reach, sink } = withDefaults(DEFAULTS.archBridge, given)
    const k = kit(sink)
    const N = 12
    const at = (t, y) => p(span * t, y, 0)
    const deck = (t) => -drop * t + rise * Math.sin(Math.PI * t)
    const rib = (t) => -drop * t - sag + (rise + sag - thick) * Math.sin(Math.PI * t)
    const ts = Array.from({ length: N + 1 }, (_, i) => i / N)
    k.form({ kind: 'sweep', at: p(0, 0, 0), smooth: true, look: 'concrete', section: roundedRect(width, thick, 0.4, -thick), path: [p(0, 0, 0), ...ts.map((t) => p(1 + (span - 2) * t, deck(t), 0)), p(span, -drop, 0)] }) // a level metre at each end, so that its ends are upright
    k.form({ kind: 'sweep', at: p(0, 0, 0), smooth: true, look: 'pale', section: roundedRect(width * 0.5, 1.2, 0.4, -1.2), path: [...ts.map((t) => at(t, rib(t))), ...(reach > 0 ? [p(span + reach, rib(1), 0)] : [])] })
    for (const t of [0.18, 0.32, 0.68, 0.82]) {
      const under = deck(t) - thick
      const onRib = rib(t)
      k.drum(span * t, 0, onRib, under, 0.35, 'pale', { crown: false })
    }
    return result(k)
  },

  // Pipes up a wall to climb in a tight slot: the wall's face is z = 0 and the shaft stands in
  // front of it, toward +Z. Two pipes from the ground to `height`, bent into the wall at the top,
  // clamped by plates a ledge apart from `from` (where he stands to begin: the ground, or a plate
  // `landing` metres out from the wall, to reach it from something across the slot), the last a
  // ledge under `height`, so that he pulls himself from plate to plate and onto the roof.
  pipeShaft(given) {
    const { height, spread, from, landing, sink } = withDefaults(DEFAULTS.pipeShaft, given)
    const k = kit(sink)
    for (const x of [-spread, spread]) k.pipe([p(x, k.foot, 0.7), p(x, height - 1, 0.7), p(x, height - 1, 0)], 0.7) // turned square into the wall
    const n = Math.round((height - from) / LEDGE) - 1
    for (let i = 1; i <= n; i++) k.bar(-spread - 0.9, spread + 0.9, from + i * LEDGE - 0.4, from + i * LEDGE, 0, 1.8, 'rust', 0.15)
    if (landing > 0) k.bar(-spread - 0.9, spread + 0.9, from - 0.6, from, 0, landing, 'rust', 0.15)
    return result(k)
  },

  // A steam main across a gorge (the owner's painting, 2026-10-17): one fat pipe along X at
  // `height`, resting on trestles `span` apart whose crossbars meet its underside, collared every
  // `flange`, and, with `drop`, turned down at each end into the ground. Its top is a way along.
  steamMain(given) {
    const { length, height, radius, span, flange, drop, sink } = withDefaults(DEFAULTS.steamMain, given)
    const k = kit(sink)
    const half = length / 2
    k.pipe(drop ? [p(-half, k.foot, 0), p(-half, height, 0), p(half, height, 0), p(half, k.foot, 0)] : [p(-half, height, 0), p(half, height, 0)], radius)
    const trestles = Math.max(1, Math.floor(length / span))
    for (let i = 0; i <= trestles; i++) {
      const x = -half + radius + 1 + ((length - 2 * radius - 2) * i) / trestles
      const under = height - radius
      for (const s of [-1, 1]) k.block(x - 0.3, x + 0.3, k.foot, under - 0.6, s > 0 ? radius : -radius - 0.6, s > 0 ? radius + 0.6 : -radius, 'steel')
      k.block(x - 0.4, x + 0.4, under - 0.6, under, -radius - 0.6, radius + 0.6, 'steel')
    }
    for (let x = -half + flange; x < half - 0.5; x += flange) k.pipe([p(x - 0.25, height, 0), p(x + 0.25, height, 0)], radius + 0.25, 'brass')
    return result(k)
  },

  // The landmarks, each in its own module: the real building, made `SCALE` times its size.
  velasca,
  salk,
  sesc,
  // and the palace (`asset-palace.js`), read off its own place file: only its outside, far off.
  palace,

  // The brutalist stairs (`asset-stairs.js`), run up at speed: each ends in a wall or a turn.
  flightStair,
  towerStair,
  hungStair,
  helixStair,

  // The brutalist doorways (`asset-portals.js`): ways through a mass, 28 × 18 m clear.
  deepPortal,
  hoodPortal,
  steppedPortal,
  gatePortal,
  // and the odd ones, a way through that is not a square hole in a wall.
  cleftPortal,
  ajarPortal,
  bladePortal,
  sunkPortal,
  weightPortal,
  stackPortal,
  funnelPortal,

  // Pieces to lay a jump line with (`asset-platforms.js`): platforms, platforms on columns,
  // bare columns and bridges, their tops at `height`, their edges open to be jumped off.
  slabPlatform,
  steppedPlatform,
  cantileverPlatform,
  waffleDeck,
  podStack,
  troughPlatform,
  pierPlatform,
  mushroomColumn,
  consoleTree,
  twinBlades,
  stiltDeck,
  spiralLandings,
  squareColumn,
  bladeColumn,
  drumColumn,
  shearedColumn,
  colonnade,
  beamBridge,
  troughBridge,
  hungBridge,
  brokenBridge,
  steppedBridge,
}

/**
 * The asset `name` built with `params` (its own, `DEFAULTS` for any left out), stood at `at`
 * (`{ x, y, z }`, metres, where its frame's origin goes: the middle of its footprint, on the
 * ground) turned `yaw` radians about up (`placeRecords`; its front, +Z in its frame, then faces +Z
 * turned by `yaw`): `{ forms, murals }`, every record tagged `asset: tag`, each form given the id
 * `nextId()` returns, which must be one no other form of the place has. The records are copies:
 * nothing ties them to the builder after. This is the baked form; `buildAsset` the live.
 */
export function bakeAsset(name, params, { at, yaw = 0 }, tag, nextId) {
  return stood(made(name, params), { at, yaw }, tag, nextId)
}

/**
 * One instance of a place's `assets`, `{ tag, name, params, parts, at, yaw, mirror, scale }`, built as it now
 * stands: `bakeAsset`'s `{ forms, murals }` with the changes made by hand to its parts done
 * (`parts`, `asset-parts.js`), each record carrying its part's key as `part`, each form's id
 * '<tag>:<n>', so that it is never one of the place's own forms' and is taken away with the rest
 * of its building. This is the live form.
 */
export function buildAsset({ tag, name, params = {}, parts, at, yaw = 0, mirror = false, scale = 1 }) {
  let n = 0
  let own = withParts(made(name, params), parts)
  if (scale !== 1) own = grown(own, scale)
  return stood(mirror ? mirrored(own) : own, { at, yaw }, tag, () => `${tag}:${n++}`)
}

// A builder's records `k` times their size about its own origin, the same every way: a form by its
// scale and where it stands, a mural by its place and measure. An instance's `scale` (the editor's T).
function grown({ forms, murals }, k) {
  const times = (p) => (p ? { x: (p.x ?? 0) * k, y: (p.y ?? 0) * k, z: (p.z ?? 0) * k } : p)
  return {
    forms: forms.map((form) => ({ ...form, at: times(form.at ?? { x: 0, y: 0, z: 0 }), scale: Array.isArray(form.scale) ? form.scale.map((s) => s * k) : (form.scale ?? 1) * k })),
    murals: murals.map((mural) =>
      mural.wrap
        ? { ...mural, wrap: { ...mural.wrap, x: mural.wrap.x * k, z: mural.wrap.z * k, radius: mural.wrap.radius * k, y0: mural.wrap.y0 * k, y1: mural.wrap.y1 * k } }
        : { ...mural, ...times(mural), w: mural.w * k, h: mural.h * k },
    ),
  }
}

// A builder's records turned over across its own x = 0: a form by a negative scale along its own X
// (`forms.js` turns its faces with it), a mural put on the other side and turned the other way,
// its painting not reversed. An instance's `mirror` (the editor's Ctrl+M) builds it so.
function mirrored({ forms, murals }) {
  return {
    forms: forms.map((form) => {
      const [sx, sy, sz] = Array.isArray(form.scale) ? form.scale : [form.scale ?? 1, form.scale ?? 1, form.scale ?? 1]
      return { ...form, at: { ...form.at, x: -(form.at?.x ?? 0) }, yaw: -(form.yaw ?? 0), scale: [-sx, sy, sz] }
    }),
    murals: murals.map((mural) => (mural.wrap ? { ...mural, wrap: { ...mural.wrap, x: -mural.wrap.x } } : { ...mural, x: -mural.x, yaw: -(mural.yaw ?? 0) })),
  }
}

// What the builder `name` makes of `params`, in its own frame.
function made(name, params) {
  if (!(name in ASSETS)) throw new Error(`there is no asset "${name}": the assets are ${Object.keys(ASSETS).join(', ')}`)
  return ASSETS[name](params)
}

// A builder's records (`made`) stood at `frame` in a place, tagged `tag`, each form given the id `nextId()` returns.
function stood(records, frame, tag, nextId) {
  const placed = placeRecords(records, frame)
  return {
    forms: placed.forms.map((form) => ({ id: nextId(), asset: tag, ...form })),
    murals: placed.murals.map((mural) => ({ asset: tag, ...mural })),
  }
}

// The last make a part was looked up in: a part in the editor's hands asks at every change, and
// a building of a thousand forms is not made again for each.
let lastMade = null

/**
 * The parts of `instance` (`{ name, params }`) as its builder makes them, before any change by
 * hand, in its own frame: `Map(key → { list, record })` (`asset-parts.js`). The records are the
 * builder's own: read them, never change them.
 */
export function madeParts({ name, params = {} }) {
  const text = JSON.stringify(params)
  if (lastMade?.name !== name || lastMade.text !== text) {
    lastMade = { name, text, parts: new Map(keyed(made(name, params)).map(({ list, key, record }) => [key, { list, record }])) }
  }
  return lastMade.parts
}

/** The keys of `instance`'s `parts` that its builder no longer makes a part for: changes by hand left over. */
export function strayParts(instance) {
  const parts = madeParts(instance)
  return Object.keys(instance.parts ?? {}).filter((key) => !parts.has(key))
}

/** What is wrong with `instance` as an entry of a place's `assets` (the words that follow "the place has"), or null. */
export function checkInstance(instance) {
  if (!(instance.name in ASSETS)) return `an asset "${instance.tag}" of no known kind "${instance.name}": the assets are ${Object.keys(ASSETS).join(', ')}`
  return recordProblem('assets', instance)
}

/** What `tag` ('flats-2') is an asset of: its name, the number taken off. */
export const kindOfTag = (tag) => tag.replace(/-\d+$/, '')

/**
 * A tag no asset of `place` has yet, live or baked: `name` and the next number after the last of
 * that name.
 */
export function freshTag(place, name) {
  const taken = new Set(EDITABLE_LISTS.flatMap((list) => (place[list] ?? []).map((record) => (list === 'assets' ? record.tag : record.asset))))
  let n = 1
  while (taken.has(`${name}-${n}`)) n++
  return `${name}-${n}`
}

/** Every record of `place` carrying the baked asset `tag`, as `[{ list, record }]`: the parts of one building stood as a whole. */
export function assetParts(place, tag) {
  return EDITABLE_LISTS.flatMap((list) => (place[list] ?? []).filter((record) => record.asset === tag).map((record) => ({ list, record })))
}

/**
 * How far the asset `name` built with `params` reaches in its own frame, before it is placed:
 * `{ lo, hi }`, its least and most x and z, from the triangles of its forms. For laying assets out
 * side by side (`parkour-assets.js`) without building them in a place first.
 */
export function assetExtent(name, params = {}) {
  const lo = { x: Infinity, z: Infinity }
  const hi = { x: -Infinity, z: -Infinity }
  for (const form of ASSETS[name](params).forms) {
    const { positions } = buildForm(form)
    for (let i = 0; i < positions.length; i += 3) {
      lo.x = Math.min(lo.x, positions[i])
      hi.x = Math.max(hi.x, positions[i])
      lo.z = Math.min(lo.z, positions[i + 2])
      hi.z = Math.max(hi.z, positions[i + 2])
    }
  }
  return { lo, hi }
}
