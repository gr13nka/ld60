// A live asset's parts (`assets.js`), and the changes made to them by hand that its instance keeps.
//
// A part is one record a builder gives, a form or a mural in the asset's own frame, known by a key
// made of the record itself ('f-1x9kq3'; '-2', '-3' after it for a second and a third of the
// same record), so that the same part from the same builder has the same key at every build. A
// part that the builder or a parameter makes another has another key: a change made to it is
// then left over (`strayParts` in `assets.js`), and never lands on something else.
//
// An instance's `parts`, `{ <key>: change }`, holds what was done by hand (the editor's Tab):
// null takes the part away; an object replaces those fields of its record, in the asset's own
// frame, a field given as null being taken off.
// Pure: no scene.

import { placeRecords } from './asset-kit.js'
import { unplacePoint } from './forms.js'

const LISTS = { forms: 'f', murals: 'm' }
const OWN = new Set(['id', 'asset', 'part']) // what a built part carries that its builder did not give it
const round = (v) => Math.round(v * 1000) / 1000

// FNV-1a of `text`, in base 36: short, and the same text gives the same key.
function digest(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/** Each record a builder made (`{ forms, murals }`, its own frame) with its key: `[{ list, key, record }]`. */
export function keyed(made) {
  const seen = new Map()
  const all = []
  for (const [list, letter] of Object.entries(LISTS)) {
    for (const record of made[list] ?? []) {
      const base = `${letter}-${digest(JSON.stringify(record))}`
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      all.push({ list, key: n === 1 ? base : `${base}-${n}`, record })
    }
  }
  return all
}

// `record` with `change` made to it.
function changed(record, change) {
  const out = { ...record, ...change }
  for (const [field, v] of Object.entries(change)) if (v === null) delete out[field]
  return out
}

/** What a builder made with `parts` done to it, each record carrying its key as `part`: `{ forms, murals }`. */
export function withParts(made, parts = {}) {
  const out = { forms: [], murals: [] }
  for (const { list, key, record } of keyed(made)) {
    const change = parts[key]
    if (change === null) continue
    out[list].push({ ...(change ? changed(record, change) : record), part: key })
  }
  return out
}

/**
 * The change, in the asset's own frame, that makes `original` (a record as its builder made it, of
 * `list`) stand as `edited` does in the world, the asset standing at `frame` (`{ at, yaw }`): only
 * the fields that differ from the original as it would stand there, so that a part only repainted
 * keeps no place of its own. Null if none differ.
 */
export function changeOf(list, original, edited, frame) {
  const stood = placeRecords({ forms: [], murals: [], [list]: [original] }, frame)[list][0]
  const change = {}
  for (const field of new Set([...Object.keys(stood), ...Object.keys(edited)])) {
    if (OWN.has(field)) continue
    if (!(field in edited)) change[field] = null
    else if (JSON.stringify(edited[field]) !== JSON.stringify(stood[field])) change[field] = edited[field]
  }
  // Where it stands and how it is turned are the world's in `edited`, and the asset's in a change.
  if ('at' in change && change.at) change.at = unplacedPoint(frame, change.at)
  if (list === 'murals' && ['x', 'y', 'z'].some((axis) => axis in change)) Object.assign(change, unplacedPoint(frame, edited))
  if ('yaw' in change) {
    const own = round((edited.yaw ?? 0) - (frame.yaw ?? 0))
    change.yaw = own === 0 && list === 'forms' ? null : own
    if (change.yaw === null && !('yaw' in original)) delete change.yaw
  }
  return Object.keys(change).length > 0 ? change : null
}

function unplacedPoint(frame, point) {
  const { x, y, z } = unplacePoint({ at: frame.at, yaw: frame.yaw ?? 0 }, point)
  return { x: round(x), y: round(y), z: round(z) }
}

/** `instance`'s `parts` with the part `key` changed by `change` (null for none: as its builder made it). */
export function setPart(instance, key, change) {
  const parts = { ...instance.parts }
  if (change) parts[key] = change
  else delete parts[key]
  if (Object.keys(parts).length > 0) instance.parts = parts
  else delete instance.parts
}

/** `instance`'s part `key` taken away. */
export function dropPart(instance, key) {
  instance.parts = { ...instance.parts, [key]: null }
}
