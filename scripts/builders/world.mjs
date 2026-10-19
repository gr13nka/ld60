// The builders' world: the copy of the balcony they build in (src/places/builders.json), the
// run's state and ledger (plans/builders/), every record of the copy known by one key, and the
// questions asked of its solids (what floor is under a point and whose it is). The balcony
// itself is read once, at `keeper init`, and never written: this module throws on any other
// place file than the copy.
import { createHash } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { checkPlace, completePlace, layOut, nextFormId, nextCutId, placePath } from '../../src/place-file.js'
import { buildForm } from '../../src/forms.js'
import { buildAsset, checkInstance } from '../../src/assets.js'
import { MISTS, THEMES } from '../../src/themes.js'
import { siteOf } from '../moves/sim.mjs'

export const ROOT = fileURLToPath(new URL('../../', import.meta.url))
export const NAME = 'builders'
export const PATHS = {
  copy: join(ROOT, placePath(NAME)),
  balcony: join(ROOT, placePath('balcony')),
  run: join(ROOT, 'plans/builders'),
  state: join(ROOT, 'plans/builders/state.json'),
  ledger: join(ROOT, 'plans/builders/ledger.jsonl'),
  protected: join(ROOT, 'plans/builders/protected.json'),
  looks: join(ROOT, 'plans/builders/looks'),
  chronicle: join(ROOT, 'docs/builders-chronicle.md'),
  gens: fileURLToPath(new URL('./gens.json', import.meta.url)),
}
/** What a builder types to use its hands: node and this repository's b.mjs, written with forward slashes. */
export const HANDS = `node ${fileURLToPath(new URL('./b.mjs', import.meta.url)).replace(/\\/g, '/')}`
export const MIST = -880 // what reaches this low goes on down into the gorge's mist: ground
export const ABYSS = -9000 // the simulator's abyss floor (-10000) and anything near it is no floor

export const sha = (text) => createHash('sha256').update(text).digest('hex')
export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
export function writeAtomic(path, text) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(`${path}.tmp`, text)
  renameSync(`${path}.tmp`, path)
}
export const writeJson = (path, value) => writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`)
export const round = (v, to = 100) => Math.round(v * to) / to

// --- The run's state: one file, `state.json`, written by several processes at once (the hands server
// for every shift, a keeper for each batch). `opens` holds every open shift by its id, and a process
// sees the one it works on as `state.open`: its own (`id`, the B_SHIFT of the builder's shell), or the
// only one open. Each write is made under a lock, on what is on disk then: a shift's own record goes
// in, and, unless it is a keeper's, the copy's sha and what stands (`global`); what other shifts wrote
// meanwhile is kept. ---

/** The id of a shift: `1.gull-voron`, and `1.gull-voron.2` for a second pass. */
export const shiftId = (open) => `${open.gen}.${open.way}${(open.pass ?? 1) > 1 ? `.${open.pass}` : ''}`

const STATE_LOCK = `${PATHS.state}.lock`
function locked(fn) {
  const until = Date.now() + 15000
  for (;;) {
    try {
      closeSync(openSync(STATE_LOCK, 'wx'))
      break
    } catch {
      try {
        if (Date.now() - statSync(STATE_LOCK).mtimeMs > 20000) rmSync(STATE_LOCK, { force: true })
      } catch {}
      if (Date.now() > until) throw new Error('the state is locked')
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
    }
  }
  try {
    return fn()
  } finally {
    rmSync(STATE_LOCK, { force: true })
  }
}

// What is on disk, a run of the old shape (one `open`) brought to `opens`.
function rawState() {
  if (!existsSync(PATHS.state)) return null
  const disk = readJson(PATHS.state)
  if (disk.open && !disk.opens) disk.opens = { [shiftId(disk.open)]: disk.open }
  delete disk.open
  disk.opens ??= {}
  disk.shifts ??= {}
  return disk
}

export function loadState(id = process.env.B_SHIFT || null) {
  const state = rawState()
  if (!state) return null
  const ids = Object.keys(state.opens)
  const pick = id ?? (ids.length === 1 ? ids[0] : null)
  state.id = pick
  state.open = pick ? state.opens[pick] ?? null : null
  state.openIds = ids
  return state
}

/**
 * Writes `state` as one shift's: its `open` (null: it is closed) under its `id`, the copy's sha and
 * what stands unless `global: false`, the shifts closed since (all of them if `shifts: 'replace'`).
 */
export function saveState(state, { global = true, shifts = 'add' } = {}) {
  locked(() => {
    const disk = rawState() ?? { opens: {}, shifts: {} }
    if (state.id) {
      if (state.open) disk.opens[state.id] = state.open
      else delete disk.opens[state.id]
    }
    if (global) for (const key of ['copySha', 'grounded']) if (key in state) disk[key] = state[key]
    for (const key of ['order', 'balconySha', 'initial']) if (key in state && !(key in disk)) disk[key] = state[key]
    if (shifts === 'replace') disk.shifts = state.shifts
    else for (const [key, record] of Object.entries(state.shifts ?? {})) if (!(key in disk.shifts)) disk.shifts[key] = record
    writeJson(PATHS.state, disk)
  })
}

/** The whole state written as given, for what no other process is doing (`init`, `undo`, `restore`). */
export function replaceState(state) {
  const { open, id, openIds, ...whole } = state
  locked(() => writeJson(PATHS.state, whole))
}
export const gensTable = () => readJson(PATHS.gens)
/** A file of the shift `open` (its generation and way): `gen-1.gull-voron.prompt.md`. */
export const shiftFile = (open, ext) => join(PATHS.run, `gen-${open.gen}.${open.way}.${ext}`)

// The chronicle's last section is the archived Codex run of generation 0; what is written now goes before it.
export const ARCHIVED = '\n## Codex, gen 0 (archived)\n'
export function appendChronicle(text) {
  const old = existsSync(PATHS.chronicle) ? readFileSync(PATHS.chronicle, 'utf8') : ''
  const at = old.indexOf(ARCHIVED)
  writeFileSync(PATHS.chronicle, at < 0 ? old + text : old.slice(0, at + 1) + text + old.slice(at + 1))
}

const KNOWN = { themes: THEMES, mists: MISTS, instance: checkInstance }

/** The copy as it is on disk, with its text's sha. Says so if someone else's hand changed it. */
export function loadCopy(state = loadState()) {
  const text = readFileSync(PATHS.copy, 'utf8')
  const place = completePlace(JSON.parse(text))
  const hash = sha(text)
  const otherHand = state?.copySha && state.copySha !== hash
  return { place, hash, otherHand }
}

/** Checks the copy and writes it (to the copy's path only), and keeps its sha in `state`. */
export function saveCopy(place, state) {
  checkPlace(place, NAME, KNOWN)
  const text = layOut(place)
  if (PATHS.copy !== join(ROOT, placePath(NAME))) throw new Error('the builders write only their own copy')
  writeAtomic(PATHS.copy, text)
  if (state) {
    state.copySha = sha(text)
    saveState(state)
  }
  return sha(text)
}

export function appendLedger(entry) {
  mkdirSync(PATHS.run, { recursive: true })
  appendFileSync(PATHS.ledger, `${JSON.stringify(entry)}\n`)
}
export const readLedger = () =>
  existsSync(PATHS.ledger)
    ? readFileSync(PATHS.ledger, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : []

// --- Props: what each kind is met as (`room-props.js`' `PROPS[kind].solid`), read once. ---
let _solids = null
export async function propSolids() {
  if (_solids) return _solids
  const warn = console.warn
  const log = console.log
  console.warn = () => {}
  console.log = () => {}
  try {
    const { PROPS } = await import(pathToFileURL(join(ROOT, 'src/room-props.js')).href)
    _solids = Object.fromEntries(Object.entries(PROPS).map(([kind, def]) => [kind, def.solid ?? null]))
    _solids.__kinds = Object.keys(PROPS)
  } finally {
    console.warn = warn
    console.log = log
  }
  return _solids
}

/** The box a prop is met as (`ParkourWorld._standProp`), or null. */
export function propBox(record, solids) {
  const solid = solids[record.kind]
  if (!solid) return null
  const scale = Array.isArray(record.scale) ? record.scale : [record.scale ?? 1, record.scale ?? 1, record.scale ?? 1]
  const [w, h, d] = solid.map((size, i) => size * scale[i])
  const yaw = record.yaw ?? 0
  const across = Math.abs(Math.sin(Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2))) > 0.5
  const hw = (across ? d : w) / 2
  const hd = (across ? w : d) / 2
  return { x0: record.x - hw, x1: record.x + hw, y0: record.y, y1: record.y + h, z0: record.z - hd, z1: record.z + hd }
}

// --- Every solid record by one key: 'f<id>' a form, 'b<bid>' a box, 'a:<tag>' an asset, 'p:<id>' a prop. ---

export const formKey = (id) => (typeof id === 'string' ? `a:${id.replace(/:\d+$/, '')}` : `f${id}`)

/** Gives every box a `bid` and every prop an `id` it lacks, so that each is known by a key that does not shift. */
export function nameEverything(place) {
  let nb = Math.max(-1, ...place.boxes.map((b) => (Number.isInteger(b.bid) ? b.bid : -1))) + 1
  for (const box of place.boxes) box.bid ??= nb++
  let np = 0
  const taken = new Set(place.props.map((p) => p.id).filter(Boolean))
  for (const prop of place.props) {
    if (prop.id) continue
    while (taken.has(`p${np}`)) np++
    prop.id = `p${np}`
    taken.add(prop.id)
  }
}

/** The key of a record of the list `list`. */
export function keyOf(list, record) {
  if (list === 'forms') return `f${record.id}`
  if (list === 'boxes') return `b${record.bid}`
  if (list === 'assets') return `a:${record.tag}`
  if (list === 'props') return `p:${record.id}`
  return null
}

/** The record a key names, as `{ list, record, index }`, or null. */
export function findKey(place, key) {
  const lists = { f: 'forms', b: 'boxes' }
  let list
  let test
  if (key.startsWith('a:')) [list, test] = ['assets', (r) => r.tag === key.slice(2)]
  else if (key.startsWith('p:')) [list, test] = ['props', (r) => r.id === key.slice(2)]
  else if (lists[key[0]]) {
    const n = Number(key.slice(1))
    list = lists[key[0]]
    test = list === 'forms' ? (r) => r.id === n : (r) => r.bid === n
  } else return null
  const index = place[list].findIndex(test)
  return index < 0 ? null : { list, record: place[list][index], index }
}

/** Who made a record: 'builders-genN', or 'old' for what was there. */
export const ownerOf = (record) => (typeof record.planOwner === 'string' && record.planOwner.startsWith('builders-') ? record.planOwner : 'old')
export const genOf = (record) => {
  const owner = ownerOf(record)
  return owner === 'old' ? -1 : Number(owner.replace('builders-gen', ''))
}

// The triangles' corners of a record, in the world, as a flat list of numbers (three a corner).
const _positions = new WeakMap()
export function positionsOf(list, record) {
  const sign = JSON.stringify(record)
  const kept = _positions.get(record)
  if (kept?.sign === sign) return kept.positions
  let positions
  if (list === 'forms') positions = buildForm(record).positions
  else if (list === 'assets') {
    const all = []
    for (const form of buildAsset(record).forms) for (const v of buildForm(form).positions) all.push(v)
    positions = Float32Array.from(all)
  } else positions = boxCorners(record)
  _positions.set(record, { sign, positions })
  return positions
}
function boxCorners(b) {
  const out = []
  for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) out.push(x, y, z)
  return out
}

export function boundsOf(positions) {
  const min = { x: Infinity, y: Infinity, z: Infinity }
  const max = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (let i = 0; i < positions.length; i += 3) {
    const [x, y, z] = [positions[i], positions[i + 1], positions[i + 2]]
    if (x < min.x) min.x = x
    if (y < min.y) min.y = y
    if (z < min.z) min.z = z
    if (x > max.x) max.x = x
    if (y > max.y) max.y = y
    if (z > max.z) max.z = z
  }
  return { min, max }
}

/**
 * Every solid record of `place` as `{ key, list, record, bounds, owner, keep }`: forms, boxes,
 * assets (one record for the whole building), and props met as a box.
 */
export function solidRecords(place, solids) {
  const out = []
  for (const list of ['forms', 'boxes', 'assets']) {
    for (const record of place[list]) {
      const positions = positionsOf(list, record)
      if (!positions.length) continue
      out.push({ key: keyOf(list, record), list, record, bounds: boundsOf(positions), owner: ownerOf(record), keep: !!record.storyKeep })
    }
  }
  for (const record of place.props) {
    const box = propBox(record, solids)
    if (!box) continue
    out.push({ key: keyOf('props', record), list: 'props', record, bounds: { min: { x: box.x0, y: box.y0, z: box.z0 }, max: { x: box.x1, y: box.y1, z: box.z1 } }, owner: ownerOf(record), keep: !!record.storyKeep, box })
  }
  return out
}

// --- The site: what a body meets (`sim.mjs`' `siteOf`), with props met as boxes, and whose each solid is. ---

const CELL = 8 // `faces.js`'s
const cellKey = (x, z) => (Math.floor(x / CELL) + 32768) * 65536 + (Math.floor(z / CELL) + 32768)

function heightOver({ a, b, c }, x, z) {
  const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z)
  if (Math.abs(d) < 1e-12) return null
  const l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d
  const l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d
  const l3 = 1 - l1 - l2
  if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) return null
  return l1 * a.y + l2 * b.y + l3 * c.y
}

/** The site of `place`: `siteOf`'s, plus `boxes` (each `{ x0…z1, key }`, the place's and the props') to ask whose a floor is. */
export function standSite(place, solids) {
  const boxes = place.boxes.map((b) => ({ ...b, key: keyOf('boxes', b) }))
  for (const prop of place.props) {
    const box = propBox(prop, solids)
    if (box) boxes.push({ ...box, key: keyOf('props', prop) })
  }
  const site = siteOf({ ...place, boxes })
  site.keyedBoxes = boxes
  return site
}

const topOf = (b, z) => (b.slope ? b.slope.from + (b.slope.to - b.slope.from) * Math.min(1, Math.max(0, (z - b.z0) / (b.z1 - b.z0))) : b.y1)

/**
 * The highest ground at or below `y` over (x, z), and whose it is: `{ y, key, ny }`, or null.
 * `skip` (a key) is passed through, as if it were not there.
 */
export function floorHit(site, x, y, z, skip = null) {
  let best = null
  for (const b of site.keyedBoxes) {
    if (b.key === skip || x <= b.x0 || x >= b.x1 || z <= b.z0 || z >= b.z1) continue
    const top = topOf(b, z)
    if (top <= y + 1e-3 && (!best || top > best.y)) best = { y: top, key: b.key, ny: 1 }
  }
  const cell = site.faces._cells.get(cellKey(x, z))
  if (cell) {
    for (const face of cell) {
      if (face.normal.y < 0.5 || face.min.y > y || face.min.x > x || face.max.x < x || face.min.z > z || face.max.z < z) continue
      const key = formKey(face.id)
      if (key === skip) continue
      const h = heightOver(face, x, z)
      if (h === null || h > y + 1e-3 || (best && h <= best.y)) continue
      best = { y: h, key, ny: face.normal.y }
    }
  }
  return best && best.y > ABYSS ? best : null
}

/** The lowest underside at or above `y` over (x, z), and whose: `{ y, key }`, or null. */
export function ceilingHit(site, x, y, z, skip = null) {
  let best = null
  for (const b of site.keyedBoxes) {
    if (b.key === skip || x <= b.x0 || x >= b.x1 || z <= b.z0 || z >= b.z1) continue
    if (b.y0 >= y - 1e-3 && (!best || b.y0 < best.y)) best = { y: b.y0, key: b.key }
  }
  const cell = site.faces._cells.get(cellKey(x, z))
  if (cell) {
    for (const face of cell) {
      if (face.normal.y > -0.05 || face.max.y < y || face.min.x > x || face.max.x < x || face.min.z > z || face.max.z < z) continue
      const key = formKey(face.id)
      if (key === skip) continue
      const h = heightOver(face, x, z)
      if (h === null || h < y - 1e-3 || (best && h >= best.y)) continue
      best = { y: h, key }
    }
  }
  return best
}

/** Every floor stacked over (x, z) from `top` down, highest first: `[{ y, key, ny }]`. */
export function floorsUnder(site, x, z, top = 400, depth = 400, gap = 1.5) {
  const out = []
  let y = top
  while (out.length < 12) {
    const hit = floorHit(site, x, y, z)
    if (!hit || hit.y < top - depth) break
    out.push(hit)
    y = hit.y - gap
  }
  return out
}

/** Whether (x, y, z) is inside a solid: a box, or a face pushes it out. */
export function inSolid(site, x, y, z, margin = 0.3) {
  return site.hitsSolid({ x, y, z }, margin)
}

export { nextFormId, nextCutId }
