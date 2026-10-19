// What the editor (`editor.js`) can pick and change in a place, kind by kind: a form, a box,
// a lamp, a sign, a mural, and a point of a sweep's path. Each keeps where it stands in its
// own words (`at`, `yaw` and `scale`; `x0` to `z1`; `x`, `y`, `z`, `w` and `h`), and this is the
// only reading of those words: to the editor every one is a target with one transform,
// `{ at: { x, y, z }, yaw, size: [x, y, z] }`, read and written back.
//
// A place's `assets` are whole buildings, each one target moved and turned by its `at` and `yaw`.
//
// A target: `{ list, record, turns, sizes, scaled, own, live, glows, label(), read(), write(transform),
// bounds(), outline(), pivot() }`, and where the kind has them `shown()`, `onRetype(typed)` and
// `onCopy(copy, world)`. `list` is the place's list the record is in (`place-file.js`'s `LISTS`).
// `turns` is whether it has a `yaw`; `sizes` the axes it can be sized along ('xyz', 'xy' or '');
// `scaled` whether its size multiplies a shape `own` metres across (a form) or is its measure in
// metres itself (the rest). `live` is whether it is cheap enough to stand again at every step of
// a drag. `glows` is whether its mesh wears the glow of a pick (what has a mesh of its own and
// takes light); `label()` names it in the status line. `bounds()` is the box round it in the
// world, `outline()` that box or a closer one turned as the thing is (`{ box, at, yaw }`: the box
// stands at `at`, turned by `yaw`), and `pivot()` the point it is held by, turned about and sized
// about: the middle of that box, since a form's own `at` may be far from anything of it that is
// seen. `shown()` is the record as the panel shows it, if that is not the record itself;
// `onRetype(typed)` makes the record typed in the panel one this kind can take (its identity kept);
// `onCopy(copy, world)` gives a copy the identity of its own.
//
// A group (`groupOf`) is a target too, with `members` (its targets) and `centre`. The editor puts
// an `asset` (a tag) on a target that holds the baked parts of one asset.
//
// A part of a live asset (`partOf`, the editor's Tab on an asset) is a target too: a form or a
// mural as its builder made it, moved, turned and sized as one of the place's own is, with
// `record` the instance and `part` its key; what is done to it is kept in the instance's `parts`
// (`asset-parts.js`).

import * as THREE from 'three'
import { buildForm, placePoint, unplacePoint } from './forms.js'
import { assetDefaults, freshTag, kindOfTag, madeParts } from './assets.js'
import { changeOf, setPart } from './asset-parts.js'
import { EDITABLE_LISTS, LISTS, holdsEveryList, nextFormId } from './place-file.js'

const ZERO = { x: 0, y: 0, z: 0 }
const LEAST = 0.01 // metres: the thinnest a box, a sign or a band is let be
const PLATE_DEEP = 0.1 // metres either side of a sign or a mural its outline stands off
const round = (v) => Math.round(v * 1000) / 1000
const trio = (scale = 1) => (Array.isArray(scale) ? [...scale] : [scale, scale, scale])


// A form's own point as it stands in the world, and back (`forms.js`'s transform), to the millimetre on the way back.
const toWorld = (form, p) => placePoint(form, p)
function toLocal(form, world) {
  const { x, y, z } = unplacePoint(form, world)
  return { x: round(x), y: round(y), z: round(z) }
}

// How far across a form's shape is before it is placed, turned or sized: what its scale multiplies.
function ownSize(form) {
  const { positions } = buildForm({ ...form, at: ZERO, yaw: 0, scale: 1 })
  const box = new THREE.Box3().setFromArray(positions)
  return box.isEmpty() ? [1, 1, 1] : box.getSize(new THREE.Vector3()).toArray()
}

function formShape(form) {
  let own = null
  return {
    turns: true,
    sizes: 'xyz',
    scaled: true,
    get own() {
      return (own ??= ownSize(form)) // building the shape to measure it is dear, and a group never asks
    },
    live: true,
    glows: true,
    label: () => `form ${form.id} · ${form.kind}`,
    onRetype: (typed) => (typed.id = form.id), // a form keeps its id
    onCopy: (copy, world) => (copy.id = nextFormId(world.place)),
    read: () => ({ at: { ...ZERO, ...form.at }, yaw: form.yaw ?? 0, size: trio(form.scale) }),
    write({ at, yaw, size }) {
      form.at = { x: round(at.x), y: round(at.y), z: round(at.z) }
      if (round(yaw) === 0) delete form.yaw
      else form.yaw = round(yaw)
      const scale = size.map(round)
      if (scale.every((s) => s === 1)) delete form.scale
      else form.scale = scale
    },
  }
}

// A box or a lamp: `x0` to `z1`, upright and unturned. It stands at its middle, and its size is its measure.
function boxShape(box) {
  return {
    turns: false,
    sizes: 'xyz',
    scaled: false,
    live: false, // baked with every other: stood again when the change is kept (`ParkourWorld.restand`)
    read: () => ({ at: { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2, z: (box.z0 + box.z1) / 2 }, yaw: 0, size: [box.x1 - box.x0, box.y1 - box.y0, box.z1 - box.z0] }),
    write({ at, size }) {
      const [w, h, d] = size.map((s) => Math.max(LEAST, s))
      const top = round(at.y + h / 2)
      if (box.slope) {
        // A sloping top's two heights go with the top they were let down from.
        box.slope = { from: round(box.slope.from + top - box.y1), to: round(box.slope.to + top - box.y1) }
      }
      Object.assign(box, { x0: round(at.x - w / 2), x1: round(at.x + w / 2), y0: round(at.y - h / 2), y1: top, z0: round(at.z - d / 2), z1: round(at.z + d / 2) })
    },
    bounds: () => new THREE.Box3(new THREE.Vector3(box.x0, box.y0, box.z0), new THREE.Vector3(box.x1, box.y1, box.z1)),
  }
}

// A sign, or a mural on a plane: it hangs at its middle, turned by `yaw`, `w` wide and `h` tall.
function plateShape(plate) {
  return {
    turns: true,
    sizes: 'xy',
    scaled: false,
    live: true,
    read: () => ({ at: { x: plate.x, y: plate.y, z: plate.z }, yaw: plate.yaw ?? 0, size: [plate.w, plate.h, 1] }),
    // Flat and turned: the upright box round it would be a room, so it is outlined as it hangs.
    outline: () => ({
      box: new THREE.Box3(new THREE.Vector3(-plate.w / 2, -plate.h / 2, -PLATE_DEEP), new THREE.Vector3(plate.w / 2, plate.h / 2, PLATE_DEEP)),
      at: { x: plate.x, y: plate.y, z: plate.z },
      yaw: plate.yaw ?? 0,
    }),
    write({ at, yaw, size }) {
      Object.assign(plate, { x: round(at.x), y: round(at.y), z: round(at.z), yaw: round(yaw), w: round(Math.max(LEAST, size[0])), h: round(Math.max(LEAST, size[1])) })
    },
  }
}

// A mural once round a band (`wrap`): it stands at the band's middle, as wide as the band is across.
function bandShape({ wrap }) {
  const read = () => ({ at: { x: wrap.x, y: (wrap.y0 + wrap.y1) / 2, z: wrap.z }, yaw: 0, size: [wrap.radius * 2, wrap.y1 - wrap.y0, wrap.radius * 2] })
  return {
    turns: false,
    sizes: 'xyz',
    scaled: false,
    live: true,
    read,
    write({ at, size }) {
      // It is round: of the two widths, the one that was changed is the one meant.
      const was = wrap.radius * 2
      const across = Math.max(LEAST, Math.abs(size[0] - was) >= Math.abs(size[2] - was) ? size[0] : size[2])
      const h = Math.max(LEAST, size[1])
      Object.assign(wrap, { x: round(at.x), z: round(at.z), radius: round(across / 2), y0: round(at.y - h / 2), y1: round(at.y + h / 2) })
    },
  }
}

// The parameters of asset `name` that are not what the builder would use anyway: all a place keeps.
function differing(name, params) {
  const defaults = assetDefaults(name) ?? {}
  return Object.fromEntries(Object.entries(params ?? {}).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(defaults[key])))
}

/** The asset `instance`'s parameter `key` made `value`, its `params` keeping only what differs from its builder's defaults. */
export function setParam(instance, key, value) {
  instance.params = differing(instance.name, { ...instance.params, [key]: value })
}

// A whole asset (`assets.js`), as a place's `assets` holds it: `{ tag, name, params, at, yaw }`. It
// is moved and turned by its `at` and `yaw`, and sized only through its `params`, which are typed
// in the panel's record; it is built afresh at every change, its forms and murals together. The
// panel shows every parameter at its default or its own value, and what is typed back keeps
// only those that differ from the default.
function assetShape(instance) {
  return {
    turns: true,
    sizes: '',
    scaled: false,
    live: false, // a whole building is dear to build: it is carried while dragged, and stood when the change is kept
    glows: true,
    label: () => `${instance.tag} · ${instance.name}`,
    shown: () => ({ ...instance, params: { ...assetDefaults(instance.name), ...instance.params } }),
    onRetype(typed) {
      typed.tag ??= instance.tag
      typed.params = differing(typed.name ?? instance.name, typed.params)
    },
    onCopy: (copy, world) => (copy.tag = freshTag(world.place, instance.name)),
    read: () => ({ at: { ...instance.at }, yaw: instance.yaw ?? 0, size: [1, 1, 1] }),
    write({ at, yaw }) {
      instance.at = { x: round(at.x), y: round(at.y), z: round(at.z) }
      if (round(yaw) === 0) delete instance.yaw
      else instance.yaw = round(yaw)
    },
  }
}

const SHAPES = { forms: formShape, assets: assetShape, boxes: boxShape, lamps: boxShape, signs: plateShape, murals: (mural) => (mural.wrap ? bandShape(mural) : plateShape(mural)) }
holdsEveryList(SHAPES, '`SHAPES` (editor-things.js)')

/** The target that `record` of the place's `list` is, as `world` (a `ParkourWorld`) has it standing. */
export function targetOf(world, list, record) {
  const meshBounds = () => {
    const mesh = world.drawn(list, record)
    return mesh ? new THREE.Box3().setFromObject(mesh) : new THREE.Box3()
  }
  const target = {
    list,
    record,
    glows: false,
    label: () => `${LISTS[list].noun} ${world.place[list].indexOf(record)}`,
    bounds: meshBounds,
    outline: () => ({ box: target.bounds(), at: ZERO, yaw: 0 }),
  }
  Object.defineProperties(target, Object.getOwnPropertyDescriptors(SHAPES[list](record))) // a getter stays one
  target.pivot = () => {
    const box = target.bounds()
    return box.isEmpty() ? target.read().at : box.getCenter(new THREE.Vector3())
  }
  return target
}

/**
 * Several targets held as one, as a box select leaves them: moved, turned and sized together
 * about the middle of them all, in the world's axes. Its transform begins as `{ at: that
 * middle, yaw: 0, size: [1, 1, 1] }`; one written is what has been done to the group since it
 * was made, and each member is put as that makes it from where it was then. A member that
 * cannot turn is still carried round the middle, its width and depth traded on a quarter turn.
 * `centre` is that first middle; `members` the targets.
 */
export function groupOf(members) {
  const bounds = () => members.reduce((box, member) => box.union(member.bounds()), new THREE.Box3())
  const box = bounds()
  const { x, y, z } = box.getCenter(new THREE.Vector3())
  const centre = { x, y, z }
  const starts = members.map((member) => member.read())
  let now = { at: { ...centre }, yaw: 0, size: [1, 1, 1] }
  return {
    list: 'group',
    members,
    centre,
    turns: true,
    sizes: 'xyz',
    scaled: true,
    own: box.getSize(new THREE.Vector3()).toArray(),
    live: false, // the editor carries its meshes as one while it is dragged, and stands them when it is kept
    read: () => ({ at: { ...now.at }, yaw: now.yaw, size: [...now.size] }),
    write({ at, yaw, size }) {
      now = { at: { ...at }, yaw, size: [...size] }
      const by = { x: at.x - centre.x, y: at.y - centre.y, z: at.z - centre.z }
      members.forEach((member, i) => member.write(carried(starts[i], centre, by, yaw, size, member.turns)))
    },
    bounds,
    outline: () => ({ box: bounds(), at: ZERO, yaw: 0 }),
    pivot: () => ({ ...now.at }),
  }
}

// One member's transform `start`, grown `grow` times along the world's axes about `centre`, turned by `turn` about it, and moved `by`.
function carried({ at, yaw, size }, centre, by, turn, grow, turns) {
  const dx = (at.x - centre.x) * grow[0]
  const dz = (at.z - centre.z) * grow[2]
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  // Its own axes, as the world's growing stretches them.
  const across = Math.hypot(grow[0] * Math.cos(yaw), grow[2] * Math.sin(yaw))
  const along = Math.hypot(grow[0] * Math.sin(yaw), grow[2] * Math.cos(yaw))
  const grown = [size[0] * across, size[1] * grow[1], size[2] * along]
  const quarter = !turns && Math.abs(sin) > Math.SQRT1_2 // an upright box turned a quarter is as wide as it was deep
  return {
    at: { x: centre.x + dx * cos + dz * sin + by.x, y: centre.y + (at.y - centre.y) * grow[1] + by.y, z: centre.z - dx * sin + dz * cos + by.z },
    yaw: turns ? yaw + turn : yaw,
    size: quarter ? [grown[2], grown[1], grown[0]] : grown,
  }
}

/**
 * Everything of the place that can be picked, as a box select draws it (`editor-seen.js`):
 * `[{ list, record, meshes }]` for what has a mesh of its own, `[{ list, record, box }]` for a box
 * or a lamp, baked in with the rest.
 */
export function pickables(world) {
  const found = []
  for (const list of EDITABLE_LISTS) {
    for (const record of world.place[list] ?? []) {
      if (LISTS[list].baked) found.push({ list, record, box: boxShape(record).bounds() })
      else {
        const drawn = world.drawn(list, record)
        if (drawn) found.push({ list, record, meshes: meshesOf(drawn) })
      }
    }
  }
  return found
}

const BUILT = new Set(['id', 'asset', 'part']) // what a built part carries that is the build's, not its record's

/**
 * The target that the part `key` of the live asset `instance` is, as it now stands
 * (`ParkourWorld.partsOf`): moved, turned and sized as a form or a mural of the place is, a copy
 * of its record changed and what then differs from the part its builder makes kept in the
 * instance's `parts` (`changeOf`). `partList` is what it is ('forms' or 'murals'); `retype(typed)`
 * makes it the record typed in the panel. Null if no such part stands.
 */
export function partOf(world, instance, key) {
  const stood = world.partsOf(instance).get(key)
  const made = madeParts(instance).get(key)
  if (!stood || !made) return null
  const working = structuredClone(stood.record)
  const keep = () => setPart(instance, key, changeOf(stood.list, made.record, working, { at: instance.at, yaw: instance.yaw ?? 0 }))
  const shape = SHAPES[stood.list](working)
  const bounds = () => (stood.mesh ? new THREE.Box3().setFromObject(stood.mesh) : new THREE.Box3())
  const target = {}
  Object.defineProperties(target, Object.getOwnPropertyDescriptors(shape)) // a getter stays one
  Object.assign(target, {
    list: 'assets',
    record: instance,
    part: key,
    partList: stood.list,
    live: false, // the whole building is stood again when it is kept: the part's mesh is carried while it is dragged
    glows: stood.list === 'forms',
    onRetype: undefined,
    onCopy: undefined,
    label: () => `${instance.tag} · ${LISTS[stood.list].noun} ${key}${key in (instance.parts ?? {}) ? ' · changed' : ''}`,
    drawn: () => stood.mesh,
    bounds,
    shown: () => Object.fromEntries(Object.entries(working).filter(([field]) => !BUILT.has(field))),
    write(transform) {
      shape.write(transform)
      keep()
    },
    retype(typed) {
      for (const field of Object.keys(working)) if (!BUILT.has(field)) delete working[field]
      Object.assign(working, Object.fromEntries(Object.entries(typed).filter(([field]) => !BUILT.has(field))))
      keep()
    },
  })
  target.outline ??= () => ({ box: bounds(), at: ZERO, yaw: 0 })
  target.pivot = () => {
    const box = bounds()
    return box.isEmpty() ? target.read().at : box.getCenter(new THREE.Vector3())
  }
  return target
}

/** The parts of the live asset `instance` under a ray, nearest first: `[{ list, record, part, distance }]`, each part once. */
export function partsUnder(world, instance, raycaster) {
  const owners = new Map()
  for (const [part, { mesh }] of world.partsOf(instance)) if (mesh) for (const one of meshesOf(mesh)) owners.set(one, part)
  const found = []
  for (const { object, distance } of raycaster.intersectObjects([...owners.keys()], false)) {
    const part = owners.get(object)
    if (!found.some((thing) => thing.part === part)) found.push({ list: 'assets', record: instance, part, distance })
  }
  return found
}

/** Every part of the live asset `instance` that can be picked, as a box select draws them: `[{ list, record, part, meshes }]`. */
export function partPickables(world, instance) {
  return [...world.partsOf(instance)].filter(([, { mesh }]) => mesh).map(([part, { mesh }]) => ({ list: 'assets', record: instance, part, meshes: meshesOf(mesh) }))
}

/** Whether `form` has a path whose points can be moved one by one. */
export const hasPoints = (form) => form.kind === 'sweep' && Array.isArray(form.path)

/** Where each point of a sweep's path is in the world. */
export const pointsOf = (form) => form.path.map((point) => toWorld(form, point))

/** The target that one point of a sweep's path is: it is only moved. */
export function pointOf(world, form, index) {
  return {
    list: 'forms',
    record: form,
    turns: false,
    sizes: '',
    scaled: false,
    live: true,
    read: () => ({ at: toWorld(form, form.path[index]), yaw: 0, size: [1, 1, 1] }),
    write: ({ at }) => Object.assign(form.path[index], toLocal(form, at)),
    bounds: () => new THREE.Box3().setFromObject(world.drawn('forms', form)),
    outline: () => ({ box: new THREE.Box3().setFromObject(world.drawn('forms', form)), at: ZERO, yaw: 0 }),
    pivot: () => toWorld(form, form.path[index]),
  }
}

/**
 * Everything of the place under a ray (a `THREE.Raycaster`), nearest first:
 * `[{ list, record, distance }]`, each thing once.
 */
export function recordsUnder(world, raycaster) {
  const { place } = world
  const found = []
  const owners = new Map()
  for (const list of EDITABLE_LISTS) {
    for (const record of place[list] ?? []) {
      const drawn = world.drawn(list, record)
      if (drawn) for (const mesh of meshesOf(drawn)) owners.set(mesh, { list, record })
      else if (LISTS[list].baked) {
        const at = raycaster.ray.intersectBox(boxShape(record).bounds(), new THREE.Vector3())
        if (at) found.push({ list, record, distance: at.distanceTo(raycaster.ray.origin) })
      }
    }
  }
  const seen = new Set()
  for (const { object, distance } of raycaster.intersectObjects([...owners.keys()], false)) {
    const owner = owners.get(object)
    if (seen.has(owner.record)) continue
    seen.add(owner.record)
    found.push({ ...owner, distance })
  }
  return found.sort((a, b) => a.distance - b.distance)
}

/** The meshes `drawn` (what `ParkourWorld.drawn` gave) is made of: itself, or those in its group. */
export function meshesOf(drawn) {
  if (drawn.isMesh) return [drawn]
  const meshes = []
  drawn.traverse((part) => part.isMesh && meshes.push(part))
  return meshes
}

/**
 * A copy of `record` to stand beside it in the place's `list`, with the identity its kind needs
 * of its own (a form's id, an asset's tag: `onCopy`).
 */
export function copyOf(world, list, record) {
  const copy = structuredClone(record)
  targetOf(world, list, record).onCopy?.(copy, world)
  return copy
}

/**
 * Copies of `members` (`[{ list, record }]`), each handed to `put(list, copy)` as it is made, so
 * that it is in its list before the next copy is (a form's id is another than the last copy's):
 * `{ changes, tag }`, what `put` gave back for each, and the tag of the asset the copies are
 * together if `asset` (the tag of the baked asset the members are the parts of) is given. A
 * whole asset's copy is an asset of its own, under a fresh tag.
 */
export function copiesOf(world, members, asset, put) {
  const tag = asset ? freshTag(world.place, kindOfTag(asset)) : null
  const changes = members.map(({ list, record }) => {
    const copy = copyOf(world, list, record)
    if (tag) copy.asset = tag
    return put(list, copy)
  })
  return { changes, tag }
}
