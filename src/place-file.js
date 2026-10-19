import { COG_KINDS, cogAnimationProblem } from './cog-motion.js'

// A place's file (`src/places/<name>.json`): what its name may be, where it is kept, its lists
// and which of them the editor changes, how it is checked and completed, how it is laid out on
// disk and how the editor sends it to the dev server. The game reads these files through
// `places.js`; the dev server writes them (`vite.config.js`), so this is the one module both
// import. Pure, and free of the browser and of Three.js, for that reason: what a check needs of
// `themes.js` or `assets.js` is handed in (`known`), never imported.

/** What a place's name may be: the word after `?parkour=`, and its file's name. */
export const PLACE_NAME = /^[a-z][a-z0-9-]*$/

/** Where the place `name`'s file is, from the project's root. */
export const placePath = (name) => `src/places/${name}.json`

/** The dev server's door for saving a place: a POST to `PLACE_ROUTE` and the place's name. */
export const PLACE_ROUTE = '/__place/'

/** The place a request for `url` names, or null if it is no request for one. */
export function placeNamed(url) {
  const [path] = url.split('?')
  const name = path.startsWith(PLACE_ROUTE) ? path.slice(PLACE_ROUTE.length) : ''
  return name && !name.includes('/') ? name : null
}

/**
 * Every list of records a place has, and what is said of it. `editable`: the editor picks from it
 * and changes it (the order is the order a click is tried on them, `editor-things.js`); `noun`:
 * what one record of it is called there; `baked`: its records are drawn in one mesh with the rest
 * (`ParkourWorld._standBuilt`), so are stood whole and have no mesh of their own. Every list is
 * written a record to a line (`layOut`). A new list is an entry here, and, if the editor changes it,
 * one in `STANDING` (`parkour-world.js`) and one in `SHAPES` (`editor-things.js`): each checks at
 * load that it has exactly the editable lists.
 */
export const LISTS = {
  forms: { editable: true, noun: 'form' },
  cuts: { editable: false, noun: 'cut' },
  assets: { editable: true, noun: 'asset' },
  props: { editable: false, noun: 'prop' },
  boxes: { editable: true, noun: 'box', baked: true },
  lamps: { editable: true, noun: 'lamp', baked: true },
  signs: { editable: true, noun: 'sign' },
  lights: {},
  murals: { editable: true, noun: 'mural' },
  checkpoints: { editable: false, noun: 'checkpoint' },
  pads: {},
  strips: {},
  barrels: {},
  marks: {},
  par: {},
  fans: {},
  rotors: {},
  vents: {},
  cables: {},
  ramps: {},
  dressing: {},
  inlays: {},
  deliveries: {},
  benches: {},
  pigeons: {},
  cats: {},
  crows: {},
  raccoons: {},
  finds: {},
}

/** The lists the editor picks from and changes, in the order a click is tried on them. */
export const EDITABLE_LISTS = Object.keys(LISTS).filter((list) => LISTS[list].editable)

/**
 * Throws unless `table` has an entry for exactly the editable lists (less the baked, if `except`
 * says so): a list added to `LISTS` and not to a table that stands or picks it would otherwise
 * fail silently, in the editor only. `who` names the table.
 */
export function holdsEveryList(table, who, except = () => false) {
  const wanted = EDITABLE_LISTS.filter((list) => !except(list))
  const have = Object.keys(table)
  if (wanted.length !== have.length || !wanted.every((list) => list in table)) {
    throw new Error(`${who} must have exactly the editable lists (${wanted.join(', ')}), and has ${have.join(', ')}`)
  }
}

/**
 * An id no form of `place` has: one more than the greatest. The one way a form is given an id.
 * The id is what `FaceGrid` removes a form's triangles by, so it is unique among the place's
 * forms, an integer (an asset's forms are '<tag>:<n>', in no list but its own build).
 */
export function nextFormId(place) {
  return nextIdIn(place.forms)
}

/** An id no cut of `place` has, as `nextFormId` gives a form's: the one way a cut is given one. */
export function nextCutId(place) {
  return nextIdIn(place.cuts ?? [])
}

const nextIdIn = (records) => Math.max(-1, ...records.map((record) => (Number.isInteger(record.id) ? record.id : -1))) + 1

/**
 * `place` with every list it lacks (an empty one) and every form's and cut's id, once it is known to be a
 * place at all (`checkPlace`). It changes `place` itself and returns it: a place's own copy is
 * what is completed, never a module's.
 */
export function completePlace(place) {
  for (const list of Object.keys(LISTS)) place[list] ??= []
  let next = nextFormId(place)
  for (const form of place.forms) form.id ??= next++
  let nextCut = nextCutId(place)
  for (const cut of place.cuts) cut.id ??= nextCut++
  return place
}

/**
 * What is wrong with `record` as a member of a place's `list`, in words that complete the
 * sentence "the place has…", or null. `known.instance` (`assets.js`' `checkInstance`) judges an
 * asset's kind when it is handed in; without it only what needs no table is checked.
 */
export function recordProblem(list, record, known = {}) {
  if (list === 'props' && COG_KINDS.includes(record.kind)) return cogAnimationProblem(record.animation)
  if (list === 'forms' && record.kind !== 'sweep' && record.kind !== 'lathe') return `a form ${record.id ?? ''} of no kind it knows ("${record.kind}"): a form is a sweep or a lathe`
  if ((list === 'forms' || list === 'cuts') && record.bevel !== undefined && bevelProblem(record.bevel)) return `a ${LISTS[list].noun} ${record.id ?? ''} with ${bevelProblem(record.bevel)}`
  if (list === 'cuts') {
    if (record.kind !== undefined && record.kind !== 'sweep') return `a cut ${record.id ?? ''} of the kind "${record.kind}": a cut is a sweep`
    const section = Array.isArray(record.section) ? record.section : record.section?.outer
    if (!Array.isArray(section) || section.length < 3) return `a cut ${record.id ?? ''} with no \`section\` of three corners or more`
    if (!Array.isArray(record.path) || record.path.length < 2) return `a cut ${record.id ?? ''} with no \`path\` of two points or more`
    if (record.of !== undefined && !(Array.isArray(record.of) && record.of.every((id) => typeof id === 'number'))) return `a cut ${record.id ?? ''} whose \`of\` is not a list of forms' ids`
  }
  if (list === 'assets') return known.instance?.(record) ?? (!record.tag || !record.at ? `an asset of "${record.name}" with no \`tag\` or no \`at\`` : null)
  return null
}

// What is wrong with a sweep's `bevel`, or null: a size of 0 or more and a whole number of segments from 1 to 8.
function bevelProblem(bevel) {
  if (typeof bevel !== 'object' || bevel === null) return 'a `bevel` that is not `{ size, segments }`'
  if (!(Number.isFinite(bevel.size) && bevel.size >= 0)) return 'a `bevel` whose `size` is not a number of 0 or more'
  if (!(Number.isInteger(bevel.segments) && bevel.segments >= 1 && bevel.segments <= 8)) return 'a `bevel` whose `segments` is not a whole number from 1 to 8'
  return null
}

/**
 * Throws, naming what is wrong, unless `place` (named `name`) is a place: a theme, a `start`
 * (and `starts`) with x, y and z, an `abyss` with a `lost` or a street (`half`), every list a
 * list, every form a sweep or a lathe with any `bevel` one that can be cut, every cut a sweep with a
 * section and a path, every asset of a known kind with a `tag` and an `at`, every find a point with
 * an id of its own, every courier crossing two ends. It reads only. `known` is
 * `{ themes, mists, instance, finds }` (`places.js`'s `KNOWN`): the theme, the mists, the asset
 * kinds and the find kinds are checked only against what is given.
 */
export function checkPlace(place, name, known = {}) {
  const wrong = (why) => {
    throw new Error(`the place "${name}" ${why}`)
  }
  if (known.themes && !(place.theme in known.themes)) wrong(`has no theme by the name "${place.theme}"`)
  if (place.mists !== undefined && !Array.isArray(place.mists)) wrong('has `mists` that are not a list')
  for (const mist of place.mists ?? []) if (known.mists && !(mist in known.mists)) wrong(`has no mist by the name "${mist}"`)
  const point = (p) => ['x', 'y', 'z'].every((axis) => Number.isFinite(p?.[axis]))
  if (!point(place.start)) wrong('has no `start` with x, y and z')
  for (const [from, start] of Object.entries(place.starts ?? {})) if (!point(start)) wrong(`has a start "${from}" with no x, y and z`)
  if (place.abyss && place.abyss.lost !== null && !Number.isFinite(place.abyss.lost)) wrong('has an `abyss` with neither a number nor null for `lost`')
  if (!place.abyss && !(place.half > 0)) wrong('has neither a street (`half`) nor an abyss')
  if (place.seam && !(Number.isFinite(place.seam.below) && place.seam.rise > 0)) wrong('has a `seam` with no height `below` or no `rise` over 0')
  for (const list of Object.keys(LISTS)) if (place[list] !== undefined && !Array.isArray(place[list])) wrong(`has a \`${list}\` that is not a list`)
  const ids = new Set()
  for (const [i, find] of (place.finds ?? []).entries()) {
    if (known.finds && !(find?.kind in known.finds)) wrong(`has a find ${i} of the kind "${find?.kind}": the kinds are ${Object.keys(known.finds).join(', ')}`)
    if (!point(find)) wrong(`has a find ${i} with no x, y and z`)
    // The save keeps what was taken by id, so an id is never shared or left out.
    if (typeof find.id !== 'string' || !find.id || ids.has(find.id)) wrong(`has a find ${i} with no \`id\` of its own`)
    ids.add(find.id)
  }
  for (const [i, crossing] of (place.courier?.crossings ?? []).entries()) {
    if (!point(crossing?.a) || !point(crossing?.b)) wrong(`has a courier crossing ${i} without both ends \`a\` and \`b\``)
  }
  for (const list of ['forms', 'cuts', 'assets', 'props']) {
    for (const record of place[list] ?? []) {
      const problem = recordProblem(list, record, known)
      if (problem) wrong(`has ${problem}`)
    }
  }
}

/**
 * A place's file as the editor writes it: a key to a line, and a record to a line in the lists
 * of records, so that a changed form is one changed line in a diff and the file stays short
 * enough to read. An empty list is left out: `completePlace` gives a place every list it lacks.
 */
export function layOut(place) {
  const lines = Object.entries(place)
    .filter(([, value]) => !(Array.isArray(value) && value.length === 0))
    .map(([key, value]) => {
      const quoted = JSON.stringify(key)
      if (key in LISTS && Array.isArray(value)) {
        return `  ${quoted}: [\n${value.map((record) => `    ${JSON.stringify(record)}`).join(',\n')}\n  ]`
      }
      return `  ${quoted}: ${JSON.stringify(value)}`
    })
  return `{\n${lines.join(',\n')}\n}\n`
}

/** A place's record as the text it is sent in: what it holds, its functions left out. */
export const placeText = (place) => JSON.stringify(place, (key, value) => (typeof value === 'function' ? undefined : value))

/**
 * The editor's save: POSTs `place` whole to the dev server, which checks it and writes it to the
 * place `name`'s file. Resolves to the path written; throws, with the server's reason, if it was not.
 * `quiet` (the autosave's): the dev server lets the page be, with no reload for the change.
 */
export async function savePlace(name, place, { quiet = false } = {}) {
  const body = placeText(place)
  const response = await fetch(`${PLACE_ROUTE}${name}${quiet ? '?quiet' : ''}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
  const reply = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(reply.error ?? `the server said ${response.status}`)
  return reply.written
}
