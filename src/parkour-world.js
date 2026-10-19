// The one place of Quitters: the grown megastructure, stood up whole and kept. The place is a
// record as `places.js` gives one (`place-file.js` says what it holds), changed in place by the
// editor (`editor.js`), which asks for one record at a time to be stood again (`restand`, by
// `STANDING`). How each thing is drawn is `place-drawn.js`'s; this is what is met. It answers a
// runner's questions (`parkour.js`'s `site`: what is underfoot, overhead and in the way) and the
// glide's (what is hit), and keeps the place's life: pigeons, cats, crows, raccoons, finds.
//
// What is met, in the order it is asked:
// 1. `_boxes`: the place's upright boxes, every top ground, some sloping; with them the benches'
//    and the props' (`room-props.js`), met as one box each if their kind has one.
// 2. `_forms`, a `FaceGrid` (`faces.js`): the triangles of every form (`forms.js`) and of every
//    asset instance's forms (`assets.js`), met by the runner and the glide alike, and drawn as
//    the same triangles, so that what is seen is what is hit. A place's own forms are met and
//    drawn less what its `cuts` take out of them (`form-cut.js`); a cut is never seen.
// 3. `_ramps` and `_rampGrid`, the triangles of the ramps (`ramp.js`), also met by a runner.
// Pads, strips and fans move a body; lamps, dressing, signs, murals, inlays, rotors, cables and
// vents are only seen.

import * as THREE from 'three'
import { asLight, bake, box, cylinder, materials, neon } from './models.js'
import { FaceGrid, pushOut } from './faces.js'
import { buildAsset } from './assets.js'
import { buildForm } from './forms.js'
import { cuttersFor, cutForm } from './form-cut.js'
import { facesOf } from './ramp.js'
import { BENCH, benchDrawn, boxesPaint, cablesDrawn, dressed, formMesh, formPaint, inlaid, lightPlaque, lightsDrawn, looksOf, mergedMesh, meshOf, mural, painted, rampsDrawn, rotorDrawn } from './place-drawn.js'
import { PROPS } from './room-props.js'
import { work, workCogs } from './machine-props.js'
import { SteamPuffs } from './steam-puffs.js'
import { EDITABLE_LISTS, LISTS, holdsEveryList } from './place-file.js'
import { THEMES } from './themes.js'
import { NO_GOAL, NoWoods, ParkourBase } from './parkour-base.js'
import { Pigeons } from './pigeons.js'
import { FindsDrawn } from './finds-drawn.js'
import { FINDS } from './finds.js'
import { CrowFigure } from './crow-figure.js'
import { RaccoonFigure } from './raccoon-figure.js'
import { Cat } from './cat.js'

const PAD_HEIGHT = 0.25
const ROTOR_KICK = 1.5 // how much faster a fan's blades go at a beat of the score, falling away before the next
const STRIP_HEIGHT = 0.08
const UNDERFOOT = 0.6 // metres over a pad, a strip or a slope that a runner is still on it
const FLYER_RADIUS = 0.35 // metres: the ball a glide is to a form, where a box is asked about a point
// Under a place over an abyss (`abyss` in its record) there is no street: the floor is this far
// down, never reached, since `Game` begins the attempt again long before.
const ABYSS_FLOOR = -10000
const FAN_FADE = 60 // metres under a fan's top over which its lift dies away
// A suit catches a fan's air while it faces it: looking down this far (as the aim's rise, -1 to 1)
// the lift is gone, so that a dive goes down through the column and a level glide rides it up.
const FAN_DIVE = { from: -0.15, gone: -0.5 }
// The hook's line (`solidAlong`): metres off the eye it is first looked along from, and between
// the points looked at after: less than the thinnest deck it should catch on from the side.
const LINE_FROM = 2
const LINE_STEP = 1.5
const FORM_CELL = 200 // metres: forms of one paint over a square this wide are drawn as one mesh
const _ground = { y: 0, normal: new THREE.Vector3() } // what `FaceGrid.castDown` answers into
const _rampGround = { y: 0, normal: new THREE.Vector3() }
const _probe = new THREE.Vector3()
// How the room round a runner is heard (`spaceAround`): rays from his head, level all round and
// one straight up, each marched out in strides that lengthen with distance until something stops it.
const HEARING = {
  head: 1.6, // metres over the feet the rays start from
  rays: 8, // level ones, evenly round
  reach: 250, // metres: what is further than this is open air to the ear
  stride: 0.1, // of the distance gone, the next stride; never under 2 m
}
// The machines' steam (`ventsNear`): only the nearest this many vents blow, and none further off
// than `reach` metres. Each plume is a ribbon of curling parcels worked out every step; guesses.
const STEAM = { plumes: 12, reach: 120 }
// Gears turn only this near (plus their own radius); further off they stand as they were left.
const TURN_REACH = 600
const _heard = new THREE.Vector3()
const _heardNormal = new THREE.Vector3()
const _probeNormal = new THREE.Vector3()

// The height of a box's top at a point: the one reading of it, for a top that may slope.
function topAt(solid, z) {
  if (!solid.slope) return solid.top
  const along = THREE.MathUtils.clamp((z - (solid.z - solid.halfDepth)) / (solid.halfDepth * 2), 0, 1)
  return THREE.MathUtils.lerp(solid.slope.from, solid.slope.to, along)
}

const over = (solid, x, z) => Math.abs(x - solid.x) < solid.halfWidth && Math.abs(z - solid.z) < solid.halfDepth
// Whether `pos` is over a fan's blades: within its `radius` of the axis and outside its `hole`.
function inColumn(fan, pos) {
  const away = Math.hypot(pos.x - fan.x, pos.z - fan.z)
  return away <= fan.radius && away >= (fan.hole ?? 0)
}

// A place's box as it is met: a solid's shape, with its `slope` if its top has one.
const asSolid = ({ x0, x1, y0, y1, z0, z1, slope }) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, halfWidth: (x1 - x0) / 2, halfDepth: (z1 - z0) / 2, bottom: y0, top: y1, slope })

// How the world stands each list of a place that has a mesh of its own (`place-file.js`'s
// `LISTS`, the editable ones that are not `baked`) one record at a time: `stand` builds it,
// `unstand` takes it away, and `drawn` is what it is drawn as on its own. `standAll`, where
// there is one, stands the whole list at once when that is cheaper (`load`). A baked list (boxes,
// lamps) is drawn in one mesh with the rest (`_standBuilt`) and stood whole. A new list is one
// entry here and one shape in `editor-things.js`; what is missing is found at load.
const STANDING = {
  forms: {
    stand: (world, form) => world._standForm(form),
    unstand: (world, form) => world._unstandForm(form),
    drawn: (world, form) => world._formMeshes.get(form.id),
    standAll: (world, forms) => world._standFormsMerged(forms), // merged, unless the editor keeps them apart
  },
  assets: { stand: (world, instance) => world._standAsset(instance), unstand: (world, instance) => world._unstandAsset(instance), drawn: (world, instance) => world._assets.get(instance)?.group },
  signs: { stand: (world, sign) => world._hang('signs', sign), unstand: (world, sign) => world._unhang(sign, true), drawn: (world, sign) => world._hung.get(sign) },
  murals: { stand: (world, record) => world._hang('murals', record), unstand: (world, record) => world._unhang(record, false), drawn: (world, record) => world._hung.get(record) },
}
holdsEveryList(STANDING, '`STANDING` (parkour-world.js)', (list) => LISTS[list].baked)

export class ParkourWorld extends ParkourBase {
  /**
   * `place` is the place's record as `loadPlace` (`places.js`) gives it; `file` the name of its
   * file, or null for a place made in code; `from` names one of its `starts`, where a run begins
   * instead of at its `start`; `formsApart`, for the editor, draws each form as a mesh of its own
   * rather than merged, so that one can be picked and stood again by itself.
   */
  constructor(scene, place, { file = null, from = null, formsApart = false, bird = 'gull' } = {}) {
    super(scene)
    /** The place this is built from: its record, which the editor changes and `load` stands up. */
    this.place = place
    /** Its file's name, where the editor saves it (`place-file.js`), or null: it is made in code. */
    this.file = file
    this._from = from
    this._formsApart = formsApart
    this._bird = bird // the name in `BIRDS` (`birds.js`) of the bird that plays its crows
    /** What the game takes for the forest here: nothing grows. */
    this.woods = new NoWoods()
    this._boxes = [] // as solids, with `slope` on those that slope and `afoot` on what only a runner meets
    this._afoot = [] // boxes only a runner meets, kept apart from the place's own
    this._built = null // the place's boxes, pads, strips, lamps and dressing as drawn: one group, stood whole
    this._hung = new Map() // each sign's and mural's mesh, by its record
    this._ramps = [] // the triangles of every ramp (`ramp.js`)
    this._rampGrid = new FaceGrid() // the same triangles, for a runner's footing and walls
    this._forms = new FaceGrid() // the triangles of every form (`forms.js`), by the ground they lie over
    this._formMeshes = new Map() // each form's mesh, by its id
    this._formGroup = null
    this._formBounds = new Map() // each form's box, uncut, by its id: what a cut is asked to overlap; only while the place has cuts, or a cut has asked
    this._assets = new Map() // each asset instance's `{ group, ids, parts }`, by its record
    this._apart = new Set() // the asset instances whose parts the editor has in hand, each part drawn as a mesh of its own
    this._looks = looksOf() // each look a form may wear, as this place paints it
    this._unknownLooks = new Set() // looks a form wore that this place has no paint for, each said once
    this._rotors = [] // `{ group, speed }`: the place's `rotors`, fans only seen, turned each frame
    this._pigeons = null // the place's flocks (`pigeons.js`), if it has any
    this._cats = [] // its strays (`cat.js`)
    this._finds = [] // its hidden things (`finds.js`), each hung over the floor: `{ id, kind, x, y, z }`
    this._findsDrawn = null // and their bodies (`finds-drawn.js`)
    this._findsClock = 0
    this._crows = [] // `{ perches, figure }`: its crows' perches set down on the floor, and each one's body (`crow-figure.js`)
    this._raccoons = [] // `{ home, figure }`: its raccoons' homes set down on the floor, and each one's body (`raccoon-figure.js`)
    this._benches = [] // `{ seat, yaw, plaque }`: where a runner may sit, his feet at `seat`, facing `yaw`
    this._benchSolids = [] // each bench as the box it is met as, kept apart so that `_standBuilt` keeps them
    this._lit = null // the bench whose plaque is lit
    this._props = new Map() // each prop's `{ built, kind, solid, vents, radius }` by its record: what `PROPS` built, the box it is met as, where it blows steam
    this._steam = null // the vents' puffs (`steam-puffs.js`), one instanced mesh for all
    this._machineClock = 0 // seconds the machines have run: a dish's swing, a gauge's tremble
  }

  /** Stands the place up and leaves the world ready for a run. */
  load() {
    this.unload()
    const { place } = this
    this._looks = looksOf(place.paints)
    // A level in name only, for what the game reads off one.
    this.level = {
      name: 'Quitters',
      seed: 1,
      theme: THEMES[place.theme],
      mists: place.mists ?? [], // names in `MISTS`, the air the game has it wear (`Game._show`)
      music: [],
      length: Infinity,
      towersFrom: null,
      roadX: () => 0,
      elevationAt: () => 0,
      gorgeDepthAt: () => 0,
    }
    this.goal = NO_GOAL
    this._goalSolids = []
    this._thermals = []
    this._rods = []

    if (!place.abyss) {
      const paving = THEMES[place.theme].street // a theme's own ground, grained as concrete; asphalt otherwise, worn but ungrained
      const street = new THREE.Mesh(new THREE.PlaneGeometry(place.half * 2, place.half * 2).rotateX(-Math.PI / 2), formPaint(paving ?? materials.asphalt.color.getHex(), paving ? 'concrete' : 'bare', false))
      street.receiveShadow = true
      this._scenery.add(street)
    }
    this._standBuilt()
    // Its lights, here and never again: not with what the editor stands anew (`_standBuilt`).
    if (place.lights.length) this._scenery.add(lightsDrawn(place.lights).group)
    if (place.inlays.length) this._scenery.add(inlaid(place.inlays))
    this._ramps = (place.ramps).flatMap(facesOf)
    this._rampGrid.clear()
    this._rampGrid.add(this._ramps)
    if (this._ramps.length > 0) this._scenery.add(...rampsDrawn(this._ramps))
    // The place's `vents`, `{ x, y, z, size, reach }`: steam from a grate or a joint, in the same
    // nearest-first list as the machines' (`ventsNear`); `reach` metres off it is still blown.
    this._placeVents = place.vents.map(({ x, y, z, size = 1, reach = STEAM.reach }) => ({ at: new THREE.Vector3(x, y, z), size, reach }))
    // Cables and pipe bundles, only seen (`place-drawn.js`'s `cablesDrawn`).
    if (place.cables.length) this._scenery.add(cablesDrawn(place.cables, (look) => this._paint({ look })))
    this._rotors = place.rotors.map((rotor) => {
      const group = rotorDrawn(rotor, this._paint({ look: rotor.look ?? 'steel' }))
      this._scenery.add(group)
      return { group, speed: rotor.speed }
    })
    // The forms, each met and drawn as the same triangles, and the rest of the lists that stand on their own.
    this._formGroup = new THREE.Group()
    this._scenery.add(this._formGroup)
    for (const list of EDITABLE_LISTS) {
      const how = STANDING[list]
      if (!how) continue // baked: `_standBuilt` has stood it
      if (how.standAll && !this._formsApart) how.standAll(this, place[list])
      else for (const record of place[list]) how.stand(this, record)
    }
    for (const record of place.props) this._standProp(record)

    this._steam = new SteamPuffs(this._scenery)

    // Life, stood last so that every solid it may sit on is already there.
    if (place.pigeons.length > 0) {
      this._pigeons = new Pigeons(place.pigeons.map((p) => ({ at: this.groundedAt(p), count: p.count, spread: p.spread })))
      this._scenery.add(this._pigeons.group)
    }
    this._cats = place.cats.map((c) => new Cat({ at: this.groundedAt(c), yaw: c.yaw ?? 0 }, (x, y, z) => this.floorAt(x, y, z)))
    for (const cat of this._cats) this._scenery.add(cat.group)
    this._finds = place.finds.map(({ id, kind, x, y, z }) => ({ id, kind, x, y: this.floorAt(x, y, z) + FINDS[kind].lift, z }))
    this._findsDrawn = this._finds.length > 0 ? new FindsDrawn(this._finds) : null
    if (this._findsDrawn) this._scenery.add(this._findsDrawn.group)
    this._crows = place.crows.map(({ perches }) => {
      const figure = new CrowFigure(this._bird)
      this._scenery.add(figure.group)
      return { perches: perches.map((perch) => ({ ...this.groundedAt(perch), yaw: perch.yaw ?? 0 })), figure }
    })
    this._raccoons = place.raccoons.map((home) => {
      const figure = new RaccoonFigure()
      this._scenery.add(figure.group)
      return { home: { ...this.groundedAt(home), yaw: home.yaw ?? 0 }, figure }
    })

    // Benches remain part of the place's architecture and collision.
    for (const bench of place.benches) this._standBench(bench)
    this._boxes.push(...this._benchSolids)
  }

  unload() {
    this._props = new Map()
    this._steam = null // its mesh goes with the scenery
    super.unload()
    this._boxes = []
    this._afoot = []
    this._built = null
    this._hung = new Map()
    this._ramps = []
    this._rampGrid.clear()
    this._forms.clear()
    this._formMeshes = new Map()
    this._formGroup = null
    this._formBounds = new Map()
    this._assets = new Map()
    this._rotors = []
    this._placeVents = []
    this._pigeons = null
    this._cats = []
    this._finds = []
    this._findsDrawn?.dispose()
    this._findsDrawn = null
    this._crows = []
    this._raccoons = []
    this._benches = []
    this._benchSolids = []
    this._lit = null
    this._solids = []
    this._gates = []
  }

  /**
   * Where a run begins, `{ x, y, z, yaw }`: where the editor was last left (`respawn`, until the
   * page is loaded again), else the place's start named `from`, or its `start`. The record is
   * read, never changed, so what the editor saves as the start is the default of a new load.
   */
  get spawn() {
    return this.respawn ?? (this._from && this.place.starts?.[this._from]) ?? this.place.start
  }

  /** NPC positions and the finds, grounded against the built place. */
  get rules() {
    return {
      crows: this._crows.map(({ perches }) => perches),
      raccoons: this._raccoons.map(({ home }) => home),
      finds: this._finds,
    }
  }

  /** The editor's: the world stood up again from `place`, a record as it now stands. */
  reload(place) {
    this.place = place
    this.load()
  }

  /**
   * The editor's: `record`, one of the place's `list` (`STANDING`), stood again as the place's
   * lists now have it, or for the first time. A form is known by its `id`, anything else by the
   * record itself. A baked list (boxes, lamps) is stood whole.
   */
  restand(list, record) {
    this.restandMany([{ list, record }])
  }

  /** The editor's: `record` of `list` taken away (it is no longer in the place's list). */
  unstand(list, record) {
    this.restandMany([], [{ list, record }])
  }

  /**
   * The editor's: `restand` for several at once (`[{ list, record }]`) and `unstand` for those
   * `gone`; whatever is baked is stood once, whole, however many of it changed.
   */
  restandMany(changed, gone = []) {
    let baked = false
    for (const { list, record } of gone) {
      if (LISTS[list].baked) baked = true
      else STANDING[list].unstand(this, record)
    }
    for (const { list, record } of changed) {
      if (LISTS[list].baked) baked = true
      else {
        STANDING[list].unstand(this, record)
        STANDING[list].stand(this, record)
      }
    }
    if (baked) this._standBuilt()
  }

  /**
   * The editor's: what `record` of `list` is drawn as on its own, or null: a mesh for a form, a
   * sign or a mural, a group of meshes for an asset, nothing for what is baked.
   */

  /**
   * The editor's: what `record` of `list` is drawn as on its own, or null: a mesh for a form, a
   * sign or a mural, a group of meshes for an asset, nothing for what is baked.
   */
  drawn(list, record) {
    return STANDING[list]?.drawn?.(this, record) ?? null // a baked list has no entry: nothing of its own
  }

  // The place's boxes as they are met, and with its pads, strips, lamps and dressing as they
  // are drawn: baked into one, so stood whole, and whole again when the editor has changed one.
  _standBuilt() {
    const { place } = this
    if (this._built) {
      this._scenery.remove(this._built)
      this._built.traverse((part) => part.geometry?.dispose())
    }
    this._reboxed()
    this._built = new THREE.Group()
    const built = new THREE.Group()
    for (const b of place.boxes) built.add(boxesPaint(b.look) ? meshOf(b) : meshOf(b, this._paint(b))) // a look of the place's paints, as a form's
    for (const pad of place.pads) built.add(asLight(cylinder(pad.radius, PAD_HEIGHT, neon.amber, pad.x, pad.y + PAD_HEIGHT / 2, pad.z, 16)))
    for (const s of place.strips) built.add(asLight(box(s.x1 - s.x0, STRIP_HEIGHT, s.z1 - s.z0, neon.amber, (s.x0 + s.x1) / 2, s.y + STRIP_HEIGHT / 2, (s.z0 + s.z1) / 2)))
    for (const lamp of place.lamps) built.add(asLight(meshOf({ ...lamp, look: 'lamp' })))
    for (const part of place.dressing) built.add(dressed(part))
    this._built.add(bake(built))
    this._scenery.add(this._built)
  }

  // The boxes as they are met: the place's, the benches and the props.
  _reboxed() {
    this._boxes = this.place.boxes.map(asSolid).concat(this._afoot, this._benchSolids, [...this._props.values()].map(({ solid }) => solid).filter(Boolean))
  }

  // A prop (`room-props.js`) stood where its record says: turned by its `yaw`, sized by its
  // `scale` (a number, or one for each axis), and met as the box its kind has, if any. A box
  // turns by quarter turns only, so it is the nearest quarter of the prop's turn.
  _standProp(record) {
    const kind = PROPS[record.kind]
    if (!kind) return console.warn(`no prop of the kind "${record.kind}": it is not stood`)
    const built = kind.build(record)
    const { x, y, z, yaw = 0 } = record
    const scale = Array.isArray(record.scale) ? record.scale : [record.scale ?? 1, record.scale ?? 1, record.scale ?? 1]
    built.group.position.set(x, y, z)
    built.group.rotation.y = yaw
    built.group.scale.set(...scale)
    this._scenery.add(built.group)
    let solid = null
    if (kind.solid) {
      const [w, h, d] = kind.solid.map((size, i) => size * scale[i])
      const across = Math.abs(Math.sin(Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2))) > 0.5 // its width lies along Z
      solid = { x, z, halfWidth: (across ? d : w) / 2, halfDepth: (across ? w : d) / 2, bottom: y, top: y + h }
    }
    // A machine's vents (`machine-props.js`), where they are in the world, as large as it is.
    built.group.updateWorldMatrix(true, false)
    const size = (scale[0] + scale[1] + scale[2]) / 3
    const at = (local) => built.group.localToWorld(new THREE.Vector3(...local))
    const vents = (kind.traits.vents ?? []).map(([vx, vy, vz, vent]) => ({ at: at([vx, vy, vz]), size: vent * size }))
    this._props.set(record, { built, kind, solid, vents, radius: (built.radius ?? 0) * size })
    this._reboxed()
  }

  /**
   * Look only: where the machines blow steam near `focus` this frame, the nearest `STEAM.plumes`
   * vents within its reach, nearest first: `[{ at, size }]`, for `Effects.steam`.
   */
  ventsNear(focus) {
    const near = []
    for (const { vents } of this._props.values()) {
      for (const vent of vents) {
        const far = vent.at.distanceToSquared(focus)
        if (far < STEAM.reach * STEAM.reach) near.push({ vent, far })
      }
    }
    for (const vent of this._placeVents) {
      const far = vent.at.distanceToSquared(focus)
      if (far < vent.reach * vent.reach) near.push({ vent, far })
    }
    return near.sort((a, b) => a.far - b.far).slice(0, STEAM.plumes).map(({ vent }) => vent)
  }

  _unstandProp(record) {
    const stood = this._props.get(record)
    if (!stood) return
    this._scenery.remove(stood.built.group)
    stood.built.group.traverse((part) => part.geometry?.dispose())
    this._props.delete(record)
    this._reboxed()
  }

  // The paint of a form of this place, by its `look` (and `over`); a look the place has no paint
  // for is concrete, and said once.
  _paint({ look, over = false }) {
    let paint = this._looks[look]
    if (!paint) {
      if (!this._unknownLooks.has(look)) console.warn(`no paint for the look "${look}": it is drawn as concrete`)
      this._unknownLooks.add(look)
      paint = this._looks.concrete
    }
    return formPaint(paint.color, paint.grain, Boolean(over))
  }

  // An asset instance built as it now stands: its forms' triangles where they are met, and its
  // forms drawn merged, one mesh for each paint (Velasca's 1,303 forms as meshes of their own
  // were 1,303 draws), with its murals, in a group kept by the record. Its parts are kept by
  // their keys (`asset-parts.js`): each record as it stands, and, for one the editor has apart
  // (`standApart`), each form's own mesh.
  _standAsset(instance) {
    const { forms, murals } = buildAsset(instance)
    const apart = this._apart.has(instance)
    const group = new THREE.Group()
    const byPaint = new Map()
    const parts = new Map()
    for (const form of forms) {
      const { faces, positions, normals } = buildForm(form)
      this._forms.add(faces)
      const part = { list: 'forms', record: form, mesh: null }
      parts.set(form.part, part)
      if (!positions.length) continue
      const paint = this._paint(form)
      if (apart) group.add((part.mesh = formMesh(positions, normals, paint)))
      else {
        if (!byPaint.has(paint)) byPaint.set(paint, [])
        byPaint.get(paint).push([positions, normals])
      }
    }
    for (const [paint, merged] of byPaint) group.add(mergedMesh(merged, paint))
    for (const record of murals) {
      const mesh = mural(record)
      group.add(mesh)
      parts.set(record.part, { list: 'murals', record, mesh })
    }
    this._scenery.add(group)
    this._assets.set(instance, { group, ids: forms.map((form) => form.id), parts })
  }

  /**
   * The editor's: the asset `instance` stood again with each of its forms drawn as a mesh of its
   * own (`apart`), so that one part can be picked, or merged again.
   */
  standApart(instance, apart) {
    if (apart) this._apart.add(instance)
    else this._apart.delete(instance)
    if (this._assets.has(instance)) this.restand('assets', instance) // one taken out of the place is not stood again
  }

  /**
   * The editor's: the parts of the asset `instance` as they now stand, `Map(key → { list, record,
   * mesh })`: each record as it is built and placed, and its mesh while the asset is apart (a
   * mural's always). Empty for one not stood.
   */
  partsOf(instance) {
    return this._assets.get(instance)?.parts ?? new Map()
  }

  /** The names of the looks a form may wear in this place, its own paints among them. */
  get looks() {
    return Object.keys(this._looks)
  }

  _unstandAsset(instance) {
    const stood = this._assets.get(instance)
    if (!stood) return
    this._forms.remove(stood.ids)
    this._scenery.remove(stood.group)
    stood.group.traverse((part) => {
      part.geometry?.dispose()
      if (part.material?.map) part.material.dispose() // a mural's own; a form's paint is shared
    })
    this._assets.delete(instance)
  }

  // A sign or a mural, hung where its record says and kept by that record.
  _hang(list, record) {
    const mesh = (list === 'signs' ? painted : mural)(record)
    this._hung.set(record, mesh)
    this._scenery.add(mesh)
  }

  // A sign or a mural taken down; `ownTexture` for a sign, whose lettering is its own (a mural's picture is shared).
  _unhang(record, ownTexture) {
    const old = this._hung.get(record)
    if (!old) return
    this._scenery.remove(old)
    old.geometry.dispose()
    if (ownTexture) old.material.map.dispose()
    old.material.dispose()
    this._hung.delete(record)
  }

  /**
   * The editor's, for a world already stood up without the `formsApart` option: from now on
   * every form of this world is drawn as a mesh of its own, the forms standing now included.
   */
  keepFormsApart() {
    this._formsApart = true
    if (!this._formGroup || this._formMeshes.size) return
    for (const mesh of [...this._formGroup.children]) {
      mesh.geometry.dispose()
      this._formGroup.remove(mesh)
    }
    for (const form of this.place.forms) this._standForm(form, false)
  }

  // Puts every form's triangles where they are met, and draws them merged: one mesh for each
  // paint over each `FORM_CELL` of ground. The palace's two thousand forms as meshes of their
  // own were as many draws, twice over with the shadows, and the picture was made coarser to
  // keep up (`picture.md`); merged they are a few hundred, and a cell out of view is still not drawn.
  _standFormsMerged(forms) {
    const buckets = new Map()
    for (const form of forms) {
      const { faces, positions, normals } = this._formTriangles(form)
      this._forms.add(faces)
      if (!positions.length) continue
      let x = 0
      let z = 0
      for (let i = 0; i < positions.length; i += 3) {
        x += positions[i]
        z += positions[i + 2]
      }
      const corners = positions.length / 3
      const key = `${form.look}|${form.over ? 'over' : ''}|${Math.floor(x / corners / FORM_CELL)}|${Math.floor(z / corners / FORM_CELL)}`
      let bucket = buckets.get(key)
      if (!bucket) buckets.set(key, (bucket = { paint: this._paint(form), parts: [] }))
      bucket.parts.push([positions, normals])
    }
    for (const { paint, parts } of buckets.values()) this._formGroup.add(mergedMesh(parts, paint))
  }

  // Builds `form`, puts its triangles where they are met (unless they are already) and its mesh where it is seen.
  _standForm(form, meet = true) {
    const { faces, positions, normals } = this._formTriangles(form)
    if (meet) this._forms.add(faces)
    const mesh = formMesh(positions, normals, this._paint(form))
    this._formGroup.add(mesh)
    this._formMeshes.set(form.id, mesh)
    return mesh
  }

  // `form`'s triangles as they stand in this place: built (`buildForm`), less whatever its cuts
  // take (`form-cut.js`). The one build of a place's form, so that what is met and what is seen
  // are both what is left. With no cuts in the place nothing more is done.
  _formTriangles(form) {
    const built = buildForm(form)
    const cuts = this.place.cuts ?? []
    if (cuts.length === 0) {
      this._formBounds.delete(form.id)
      return built
    }
    const bounds = new THREE.Box3().setFromArray(built.positions)
    this._formBounds.set(form.id, bounds)
    return cutForm(built, cuttersFor(form, cuts, bounds))
  }

  // A form taken away: its triangles from where they are met, and its mesh.
  _unstandForm(form) {
    this._forms.remove(form.id)
    const old = this._formMeshes.get(form.id)
    if (!old) return
    this._formGroup.remove(old)
    old.geometry.dispose()
    this._formMeshes.delete(form.id)
  }

  /** Restore transient place state. */
  reset() {
    this._debris = []
    for (const gate of this._gates) gate.next = 0
  }

  /** The street, or the abyss's floor that is never reached. */
  heightAt() {
    return this.place?.abyss ? ABYSS_FLOOR : 0
  }

  /**
   * The highest footing at (x, z) no higher than `y`: a box's top, a form's face that can be
   * stood on, or the street. Given `normal`, the footing's normal is written to it (up, for
   * a box or the street).
   */
  floorAt(x, y, z, normal = null) {
    let floor = this.heightAt()
    normal?.set(0, 1, 0)
    for (const solid of this._boxes) {
      if (!over(solid, x, z)) continue
      const top = topAt(solid, z)
      if (top <= y && top > floor) floor = top
    }
    if (this._forms.castDown(x, y, z, _ground) && _ground.y > floor) {
      floor = _ground.y
      normal?.copy(_ground.normal)
    }
    if (this._rampGrid.castDown(x, y, z, _rampGround) && _rampGround.y > floor) {
      floor = _rampGround.y
      normal?.copy(_rampGround.normal)
    }
    return floor
  }

  // A bench stood: drawn, met as a box the size of its seat, and kept as somewhere to sit. It
  // turns by quarter turns only, as every box does.
  _standBench({ x, y, z, yaw = 0 }) {
    const at = this.groundedAt({ x, y, z })
    const turn = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2)
    const { group, plaque } = benchDrawn(this._paint({ look: 'wood' }), this._paint({ look: 'concrete' }))
    group.position.copy(at)
    group.rotation.y = turn
    this._scenery.add(group)
    const across = Math.abs(Math.sin(turn)) > 0.5 // its length lies along Z
    this._benchSolids.push({ x: at.x, z: at.z, halfWidth: (across ? BENCH.depth : BENCH.length) / 2, halfDepth: (across ? BENCH.length : BENCH.depth) / 2, bottom: at.y, top: at.y + BENCH.seat })
    this._benches.push({ seat: new THREE.Vector3(at.x, at.y + BENCH.seat, at.z), yaw: turn, plaque })
  }

  /** The benches here, `{ seat, yaw }`: his feet put at `seat` to sit, facing `yaw`. */
  get benches() {
    return this._benches
  }

  /** Look only. `rest`, one of `benches` or null: the one he would come back to, its plaque lit. */
  showUse(rest) {
    if (rest !== this._lit) {
      if (this._lit) lightPlaque(this._lit.plaque, false)
      if (rest) lightPlaque(rest.plaque, true)
      this._lit = rest
    }
  }

  /**
   * Look only. Each of the place's crows as `crows` (`Crow`s, in the order of `rules.crows`) now
   * are, drawn `ahead` seconds on from their last step; `focus` is his feet.
   */
  showCrows(crows, dt, ahead, focus, effects) {
    this._crows.forEach(({ figure }, i) => figure.show(crows[i], dt, ahead, focus, effects))
  }

  /**
   * Look only. Each of the place's raccoons as `raccoons` (`Raccoon`s, in the order of
   * `rules.raccoons`) now are, drawn `ahead` seconds on from their last step; `focus` is his eye.
   */
  showRaccoons(raccoons, dt, ahead, focus, effects) {
    this._raccoons.forEach(({ figure }, i) => figure.show(raccoons[i], dt, ahead, focus, effects))
  }

  /** Look only. The place's finds (`finds`, a `Finds`) as seen from `focus`, his eye, `dt` seconds on. */
  showFinds(finds, focus, dt) {
    this._findsClock += dt
    this._findsDrawn?.show(finds, focus, dt, this._findsClock)
  }

  /**
   * A record of the place's life and use (`benches`, `pigeons`, `cats`, `finds`) set
   * down on the footing below it, as a new point: its `y` is only where the search starts.
   */
  groundedAt({ x, y, z }) {
    return new THREE.Vector3(x, this.floorAt(x, y, z), z)
  }

  /** How the footing under `feet` slopes, written to `out`: metres up for each along +X and +Z. Nothing on the level. */
  gradeAt(feet, out) {
    out.set(0, 0, 0)
    for (const solid of this._boxes) {
      if (!solid.slope || !over(solid, feet.x, feet.z) || Math.abs(topAt(solid, feet.z) - feet.y) > UNDERFOOT) continue
      out.z = (solid.slope.to - solid.slope.from) / (solid.halfDepth * 2)
    }
    if (this._forms.castDown(feet.x, feet.y + UNDERFOOT, feet.z, _ground) && Math.abs(_ground.y - feet.y) <= UNDERFOOT) {
      const { normal } = _ground
      out.x = -normal.x / normal.y
      out.z = -normal.z / normal.y
    }
    if (this._rampGrid.castDown(feet.x, feet.y + UNDERFOOT, feet.z, _rampGround) && Math.abs(_rampGround.y - feet.y) <= UNDERFOOT && _rampGround.y >= this.floorAt(feet.x, feet.y + UNDERFOOT, feet.z) - 0.01) {
      const { normal } = _rampGround
      out.x = -normal.x / normal.y
      out.z = -normal.z / normal.y
    }
    return out
  }

  /**
   * The room round `feet`, as `Sound` hears it: `enclosure`, 0 under open sky to 1 walled in
   * all round and roofed; `size`, the mean metres to what walls it in; `wall`, the metres to
   * the nearest wall, or Infinity. Asked once a footfall, so it may be slow-ish.
   */
  spaceAround(feet) {
    const y = feet.y + HEARING.head
    const roof = this.ceilingAt(feet.x, y, feet.z) - y
    let walled = Number.isFinite(roof) && roof < HEARING.reach ? 1 : 0
    let reached = walled ? roof : 0
    let wall = Infinity
    for (let i = 0; i < HEARING.rays; i++) {
      const turn = (i / HEARING.rays) * Math.PI * 2
      const far = this._heardAt(feet.x, y, feet.z, Math.sin(turn), Math.cos(turn))
      if (far === Infinity) continue
      walled++
      reached += far
      wall = Math.min(wall, far)
    }
    return { enclosure: walled / (HEARING.rays + 1), size: walled ? reached / walled : 0, wall }
  }

  // The metres from (x, y, z) level along (dx, dz) to the first solid, or Infinity within `HEARING.reach`.
  _heardAt(x, y, z, dx, dz) {
    for (let gone = 2; gone < HEARING.reach; gone += Math.max(2, gone * HEARING.stride)) {
      _heard.set(x + dx * gone, y, z + dz * gone)
      if (this._solidAt(_heard, Math.max(1, gone * HEARING.stride))) return gone
    }
    return Infinity
  }

  // Whether `pos`, or anything within `radius` of it level, is inside a box, a form or the megastructure.
  _solidAt(pos, radius) {
    for (const solid of this._boxes) {
      if (solid.afoot) continue
      if (pos.y >= solid.bottom && pos.y <= topAt(solid, pos.z) && over(solid, pos.x, pos.z)) return true
    }
    if (this._boxAt(pos, 0)) return true
    _probe.copy(pos)
    return this._forms.pushOutLevel(_probe, pos.y - 1, pos.y + 1, radius, _heardNormal)
  }

  /** The lowest underside over a point at or above the height `y`, or Infinity under open sky. */
  ceilingAt(x, y, z) {
    let ceiling = this._forms.castUp(x, y, z)
    for (const solid of this._boxes) {
      if (solid.bottom < y || solid.bottom >= ceiling) continue
      if (over(solid, x, z)) ceiling = solid.bottom
    }
    return ceiling
  }

  /**
   * Moves `feet` level out of whatever stands within `radius` metres of it between the
   * heights `low` and `high`, through the nearer side, and writes that side's outward normal
   * to `normal`. True if it was moved.
   */
  wallAt(feet, low, high, radius, normal) {
    let moved = false
    for (const solid of this._boxes) {
      if (solid.bottom >= high) continue
      const dx = feet.x - solid.x
      const dz = feet.z - solid.z
      const toSide = solid.halfWidth + radius - Math.abs(dx)
      const toEnd = solid.halfDepth + radius - Math.abs(dz)
      if (toSide <= 0 || toEnd <= 0 || topAt(solid, feet.z) <= low) continue
      if (toSide <= toEnd) {
        const side = dx < 0 ? -1 : 1
        feet.x = solid.x + side * (solid.halfWidth + radius)
        normal.set(side, 0, 0)
      } else {
        const end = dz < 0 ? -1 : 1
        feet.z = solid.z + end * (solid.halfDepth + radius)
        normal.set(0, 0, end)
      }
      moved = true
    }
    if (this._forms.pushOutLevel(feet, low, high, radius, normal)) moved = true
    if (this._rampGrid.pushOutLevel(feet, low, high, radius, normal)) moved = true
    return moved
  }

  /**
   * How hard the air rises at `pos`, in m/s²: in the column of a fan (the place's `fans`,
   * each `{ x, z, radius, hole, y0, y1, up }`), `up` within `radius` of its axis and outside
   * `hole`, between the heights `y0` and `y1`, dying away over the last `FAN_FADE` metres.
   * Given `aim` (the view's unit vector), a suit looking down takes less of it, none past
   * `FAN_DIVE.gone`: the column is a hub, ridden up or dived down through at will.
   */
  updraftAt(pos, clearance = 0, aim = null) {
    let rising = 0
    for (const fan of this.place.fans) {
      if (!inColumn(fan, pos) || pos.y < fan.y0 || pos.y > fan.y1) continue
      rising = Math.max(rising, fan.up * (1 - THREE.MathUtils.smoothstep(pos.y, fan.y1 - FAN_FADE, fan.y1)))
    }
    if (aim) rising *= THREE.MathUtils.smoothstep(aim.y, FAN_DIVE.gone, FAN_DIVE.from)
    return rising
  }

  /**
   * How fast a pad under `feet` throws a runner up, in m/s, or 0 where there is none. A fan's
   * air moves a man too: standing on a fan's `floor` in its column he is thrown up at `throw`,
   * so that a fall into the fan is never a dead end (a press in the air then opens the suit,
   * and the column takes him).
   */
  padAt(feet) {
    for (const pad of this.place.pads) {
      if (Math.abs(feet.y - pad.y) < UNDERFOOT && Math.hypot(feet.x - pad.x, feet.z - pad.z) < pad.radius) return pad.up
    }
    for (const fan of this.place.fans) {
      if (fan.throw && Math.abs(feet.y - fan.floor) < UNDERFOOT && inColumn(fan, feet)) return fan.throw
    }
    return 0
  }

  /** How much a strip under `feet` adds along a runner's way, in m/s, or 0 where there is none. */
  stripAt(feet) {
    for (const strip of this.place.strips) {
      if (Math.abs(feet.y - strip.y) < UNDERFOOT && feet.x > strip.x0 && feet.x < strip.x1 && feet.z > strip.z0 && feet.z < strip.z1) return strip.boost
    }
    return 0
  }

  isWaterAt() {
    return false
  }

  isOpenGround() {
    return true
  }

  /** There is no goal to be any distance from. */
  distanceToGoal() {
    return Infinity
  }

  /**
   * Whether a line from `from` along the unit `dir` meets something solid within `reach`
   * metres: a box, a form, or any footing it comes down through, ramps and the street
   * included. Where it meets it is written to `out`. The hook's throw.
   */
  solidAlong(from, dir, reach, out) {
    for (let along = LINE_FROM; along <= reach; along += LINE_STEP) {
      out.copy(from).addScaledVector(dir, along)
      if (this.hitsSolid(out)) return true
      if (out.y < this.floorAt(out.x, out.y + LINE_STEP, out.z)) return true
    }
    return false
  }

  /** Whether `pos` is in a box, within `margin` of one, or (as a ball of at least `FLYER_RADIUS`) in a form. */
  hitsSolid(pos, margin = 0) {
    return this._boxAround(pos, margin) !== undefined || this._forms.pushOut(_probe.copy(pos), Math.max(margin, FLYER_RADIUS), _probeNormal) || super.hitsSolid(pos, margin)
  }

  /**
   * For boxes that may hang in the air: the nearest face is the way out, the underside
   * among them; then the forms, then the base's hollow solids.
   */
  pushOutOfSolids(point, radius, normal) {
    return this._outOfBox(point, radius, normal) || this._forms.pushOut(point, radius, normal) || super.pushOutOfSolids(point, radius, normal)
  }

  /**
   * A surfer's one question (`surf.js`'s `site`): moves a ball of `radius` at `centre` out of
   * the ramp, the form or the box it is in, and writes the way it was moved to `normal`. True if it was.
   */
  surfaceAt(centre, radius, normal) {
    return pushOut(this._ramps, centre, radius, normal) || this._forms.pushOut(centre, radius, normal) || this._outOfBox(centre, radius, normal)
  }

  /** The eye meets every drawn solid, including ramps, until none pushes it into another. */
  eyeOutOfSolids(point, radius, normal) {
    let moved = false
    for (let pass = 0; pass < 4; pass++) {
      let pushed = false
      if (this._outOfBox(point, radius, normal)) pushed = true
      if (this._forms.pushOut(point, radius, normal)) pushed = true
      if (super.pushOutOfSolids(point, radius, normal)) pushed = true
      if (pushOut(this._ramps, point, radius, normal)) pushed = true
      if (!pushed) break
      moved = true
    }
    return moved
  }

  // Moves `point` out of the box of the place it is within `radius` of, through its nearest
  // face, and writes that face's normal. False in the clear.
  _outOfBox(point, radius, normal) {
    const solid = this._boxAround(point, radius)
    if (!solid) return false
    const dx = point.x - solid.x
    const dz = point.z - solid.z
    const ways = [
      [topAt(solid, point.z) + radius - point.y, 0, 1, 0],
      [point.y - (solid.bottom - radius), 0, -1, 0],
      [solid.halfWidth + radius - Math.abs(dx), dx < 0 ? -1 : 1, 0, 0],
      [solid.halfDepth + radius - Math.abs(dz), 0, 0, dz < 0 ? -1 : 1],
    ]
    const [away, x, y, z] = ways.reduce((nearest, way) => (way[0] < nearest[0] ? way : nearest))
    normal.set(x, y, z)
    point.addScaledVector(normal, away)
    return true
  }

  // The box of the place that a body in the glide at `pos` is inside, or within `margin` metres of.
  _boxAround(pos, margin) {
    return this._boxes.find(
      (solid) =>
        !solid.afoot &&
        Math.abs(pos.x - solid.x) < solid.halfWidth + margin &&
        Math.abs(pos.z - solid.z) < solid.halfDepth + margin &&
        pos.y > solid.bottom - margin &&
        pos.y < topAt(solid, pos.z) + margin,
    )
  }

  update() {}

  /**
   * Look only: the frame's changes, about `focus` (his feet). `beat`, how far through a beat of
   * the score the music is (0 at the beat, toward 1 before the next), or null with none: a fan's
   * blades kick round on each one.
   */
  present(focus, dt, beat = null, musicTiming = null) {
    this._presentDebris(dt)
    const kick = beat === null ? 1 : 1 + ROTOR_KICK * (1 - beat) ** 3
    for (const rotor of this._rotors) rotor.group.rotation.y += rotor.speed * kick * dt
    this._machineClock += dt
    for (const [record, { built, kind, radius }] of this._props) {
      if (kind.traits.cogs) {
        const reach = TURN_REACH + radius
        if (built.group.position.distanceToSquared(focus) < reach * reach) workCogs(built, kind.traits.moves, record.animation, dt, musicTiming)
      }
      else if (kind.traits.moves) work(built, kind.traits.moves, this._machineClock, dt)
    }
    if (this._steam) {
      for (const vent of this.ventsNear(focus)) this._steam.feed(vent.at, vent, vent.size)
      this._steam.update(dt)
    }
    // The sounds to play this frame, `{ name, at }`, for `Game` to play from where they are.
    const sounds = []
    if (this._pigeons) for (const at of this._pigeons.present(dt, focus)) sounds.push({ name: 'flutter', at })
    for (const cat of this._cats) {
      const sound = cat.present(dt, focus)
      if (sound) sounds.push({ name: sound, at: cat.group.position })
    }
    return sounds
  }

  prepare() {}
}
