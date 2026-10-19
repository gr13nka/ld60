// The owner's hand on the grown world. What they change in `?edit` and save is the difference
// between the world as last grown (`plans/builders/grown.json`) and the world as saved; the dev
// server keeps it in `plans/builders-hand.json` on every save, and each grow puts it back on the
// world it grows, so a regrow keeps the owner's work.
//
// A record is found again by what it holds, its id aside: the generator numbers its records in
// the order it makes them, so a changed generator gives the same wall another id. An edit whose
// record the new growth no longer holds is not guessed at: it moves to `orphans`, which stays in
// the file and in the grow's report until the owner looks.
//
//   edits = { changed: [{ list, was, now }], added: [{ list, now }], removed: [{ list, was }],
//             set: { key: value }, orphans: [the changed and removed no growth held] }

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { completePlace, layOut, placePath } from '../../src/place-file.js'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
export const WORLD = 'builders' // the one place grown, and the one whose saves are the owner's hand
const PATHS = {
  world: join(ROOT, placePath(WORLD)),
  grown: join(ROOT, 'plans/builders/grown.json'),
  edits: join(ROOT, 'plans/builders-hand.json'),
}
// The field that names a record of a list, where it has one.
const IDENTITY = { forms: 'id', cuts: 'id', boxes: 'bid', props: 'id', assets: 'tag' }

// A record's content as text, its keys in order and its name left out.
function contentOf(list, record) {
  const id = IDENTITY[list]
  const plain = id ? { ...record, [id]: undefined } : record
  return JSON.stringify(plain, (key, value) => (value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : value))
}

// The places of a list's records, by content: the same record may stand twice.
function indexOf(list, records) {
  const index = new Map()
  records.forEach((record, at) => {
    const key = contentOf(list, record)
    if (index.has(key)) index.get(key).push(at)
    else index.set(key, [at])
  })
  return index
}

const listsOf = (...places) => [...new Set(places.flatMap((p) => Object.keys(p).filter((k) => Array.isArray(p[k]))))]
const empty = (orphans = []) => ({ changed: [], added: [], removed: [], set: {}, orphans })

/** What `edited` holds that `grown` does not, as edits; `orphans` are carried over as they are. */
export function handEdits(grown, edited, orphans = []) {
  const edits = empty(orphans)
  for (const list of listsOf(grown, edited)) {
    const index = indexOf(list, grown[list] ?? [])
    const fresh = []
    for (const record of edited[list] ?? []) {
      const at = index.get(contentOf(list, record))
      if (at?.length) at.pop()
      else fresh.push(record)
    }
    const gone = [...index.values()].flat().map((at) => grown[list][at])
    // A fresh record with the name a gone one had is that record changed.
    const id = IDENTITY[list]
    const goneBy = new Map(id ? gone.filter((r) => r[id] !== undefined).map((r) => [r[id], r]) : [])
    for (const now of fresh) {
      const was = id && now[id] !== undefined ? goneBy.get(now[id]) : undefined
      if (was) {
        edits.changed.push({ list, was, now })
        goneBy.delete(now[id])
      } else edits.added.push({ list, now })
    }
    for (const was of gone) if (!id || was[id] === undefined || goneBy.has(was[id])) edits.removed.push({ list, was })
  }
  for (const [key, value] of Object.entries(edited)) {
    if (!Array.isArray(value) && JSON.stringify(value) !== JSON.stringify(grown[key])) edits.set[key] = value
  }
  return edits
}

// A name for an added record that no record of its list has yet.
function named(list, record, taken) {
  const id = IDENTITY[list]
  if (!id || record[id] === undefined || !taken.has(record[id])) return record
  let fresh
  if (typeof record[id] === 'number') fresh = Math.max(...[...taken].filter(Number.isFinite)) + 1
  else for (let n = 1; taken.has((fresh = `${record[id]}-hand${n}`)); n++);
  return { ...record, [id]: fresh }
}

/** Puts `edits` on `place`, in place. Returns the changed and removed whose record it does not hold. */
export function applyHand(place, edits) {
  const lost = []
  const byList = (entries) => entries.reduce((lists, e) => ((lists[e.list] ??= []).push(e), lists), {})
  const changed = byList(edits.changed)
  const removed = byList(edits.removed)
  const added = byList(edits.added)
  for (const list of new Set([...Object.keys(changed), ...Object.keys(removed), ...Object.keys(added)])) {
    const records = (place[list] ??= [])
    const index = indexOf(list, records)
    const found = (entry) => {
      const at = index.get(contentOf(list, entry.was))?.pop()
      if (at === undefined) lost.push(entry)
      return at
    }
    for (const entry of removed[list] ?? []) {
      const at = found(entry)
      if (at !== undefined) records[at] = null
    }
    const id = IDENTITY[list]
    for (const entry of changed[list] ?? []) {
      const at = found(entry)
      if (at !== undefined) records[at] = id ? { ...entry.now, [id]: records[at][id] } : entry.now
    }
    place[list] = records.filter((r) => r !== null)
    const taken = new Set(id ? place[list].map((r) => r[id]) : [])
    for (const { now } of added[list] ?? []) {
      const record = named(list, now, taken)
      if (id) taken.add(record[id])
      place[list].push(record)
    }
  }
  Object.assign(place, structuredClone(edits.set))
  return lost
}

function readEdits() {
  return existsSync(PATHS.edits) ? { ...empty(), ...JSON.parse(readFileSync(PATHS.edits, 'utf8')) } : empty()
}

function writeEdits(edits) {
  mkdirSync(dirname(PATHS.edits), { recursive: true })
  writeFileSync(PATHS.edits, `${JSON.stringify(edits, null, 1)}\n`)
}

/** How many of each the edits hold, for a report. */
export const counted = (edits) => Object.fromEntries(['changed', 'added', 'removed', 'orphans'].map((k) => [k, edits[k].length]).concat([['set', Object.keys(edits.set)]]))

// The grown world, read once per change of its file: the editor saves every few seconds.
let grownCache = null
function readGrown() {
  const at = statSync(PATHS.grown).mtimeMs
  if (grownCache?.at !== at) grownCache = { at, place: completePlace(JSON.parse(readFileSync(PATHS.grown, 'utf8'))) }
  return grownCache.place
}

/**
 * Dev server, before a save of the world is written: a world grown before the hand was kept has
 * no `grown.json`, and the file about to be overwritten is that world.
 */
export function keepGrown() {
  if (!existsSync(PATHS.grown) && existsSync(PATHS.world)) {
    mkdirSync(dirname(PATHS.grown), { recursive: true })
    copyFileSync(PATHS.world, PATHS.grown)
  }
}

/** Dev server, after a save of the world is written: the owner's edits, as the saved world says them. */
export function noteHand(edited) {
  const edits = handEdits(readGrown(), completePlace(structuredClone(edited)), readEdits().orphans)
  writeEdits(edits)
  return counted(edits)
}

/**
 * The grow's last step: `place`, just grown, is kept as grown, then the owner's edits are put on
 * it. What they no longer find goes to the orphans. `save` false (a dry run) writes nothing.
 */
export function withHand(place, { save = true } = {}) {
  const grown = structuredClone(place)
  if (save) {
    mkdirSync(dirname(PATHS.grown), { recursive: true })
    writeFileSync(PATHS.grown, layOut(grown))
  }
  const edits = readEdits()
  const lost = applyHand(place, edits)
  const kept = handEdits(grown, place, [...edits.orphans, ...lost])
  if (save) writeEdits(kept)
  return { ...counted(kept), lost: lost.map((e) => `${e.list} ${e.now ? 'changed' : 'removed'}`) }
}

/** The world as last grown, for a step that re-grows part of it (`grow/story.mjs`): the copy if none was kept. */
export function grownWorld() {
  return completePlace(JSON.parse(readFileSync(existsSync(PATHS.grown) ? PATHS.grown : PATHS.world, 'utf8')))
}
