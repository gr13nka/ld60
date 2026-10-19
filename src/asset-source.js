// A builder's parameters as its source says them: the defaults object of `assets.js` and of each
// `asset-*.js`, read for what each parameter means (the comment after it on its line) and
// rewritten when the editor makes an instance's values the builder's own. Only the dev server
// reads and writes the sources (`vite.config.js`); the editor asks it through `readDefaults` and
// `writeDefaults`. Pure, and free of the browser's and of Node's modules, as `place-file.js` is.
//
// Where a builder's defaults are: an entry named for it whose value is an object, in a module's
// defaults (`assets.js`'s `flats`, `asset-stairs.js`'s `towerStair`), or the whole defaults of
// the module named for it (`asset-sesc.js` for `sesc`).

/** The dev server's door for a builder's defaults: GET reads them, POST rewrites them. */
export const ASSET_ROUTE = '/__asset/'

/** The files of `src/` a builder's defaults may be in. */
export const SOURCES = /^(assets|asset-[a-z0-9-]+)\.js$/

// Where a module's defaults begin: the declaration at a line's start, exported or not.
const START = /^(?:export\s+)?const\s+DEFAULTS\s*=\s*\{/m
const KEY = /^(?:[A-Za-z_$][\w$]*|'[^']*'|"[^"]*")/
const SCALED = /^-?[\d.]+\s*\*\s*SCALE$/ // a size written as so many times the kit's `SCALE`

/** The builder a request for `url` names, or null if it is no request for one. */
export function assetNamed(url) {
  const [path] = url.split('?')
  const name = path.startsWith(ASSET_ROUTE) ? path.slice(ASSET_ROUTE.length) : ''
  return /^[A-Za-z][A-Za-z0-9]*$/.test(name) ? name : null
}

// --- Reading the source ---

// The index past the whitespace and comments from `i`, and the last line comment passed.
function gap(text, i) {
  let comment = null
  for (;;) {
    while (i < text.length && /\s/.test(text[i])) i++
    if (text.startsWith('//', i)) {
      const end = text.indexOf('\n', i)
      comment = text.slice(i + 2, end < 0 ? text.length : end).trim()
      i = end < 0 ? text.length : end
    } else if (text.startsWith('/*', i)) i = text.indexOf('*/', i) + 2
    else return { i, comment }
  }
}

// The index past the quoted text that opens at `i`.
function pastString(text, i) {
  const quote = text[i]
  for (i++; i < text.length && text[i] !== quote; i++) if (text[i] === '\\') i++
  return i + 1
}

// One value from `i`: the index of the `,` or the closing bracket that ends it at its own depth,
// `to` the end of its code (comments and whitespace after it left out), and the line comment
// inside it if it has no comma after it.
function value(text, i) {
  let depth = 0
  let to = i
  let comment = null
  while (i < text.length) {
    const c = text[i]
    if (c === "'" || c === '"' || c === '`') {
      i = pastString(text, i)
      to = i
      continue
    }
    if (text.startsWith('//', i) || text.startsWith('/*', i)) {
      const after = gap(text, i)
      comment = after.comment ?? comment
      i = after.i
      continue
    }
    if (depth === 0 && (c === ',' || c === '}' || c === ']' || c === ')')) break
    if ('{[('.includes(c)) depth++
    else if ('}])'.includes(c)) depth--
    i++
    if (!/\s/.test(c)) to = i
  }
  return { end: i, to, comment }
}

// The entries of the object literal whose `{` is at `open`: `{ entries, end }`, `end` the index
// of its `}`. An entry is `{ key, from, to, meaning, entries }`: its value's own text from `from`
// to `to`, the comment after it on its line, and the entries of a value that is an object itself.
// A spread is passed over.
function objectAt(text, open) {
  const entries = []
  let i = open + 1
  for (;;) {
    i = gap(text, i).i
    if (i >= text.length) throw new Error('a defaults object that never closes')
    if (text[i] === '}') return { entries, end: i }
    if (text.startsWith('...', i)) {
      i = value(text, i).end
      if (text[i] === ',') i++
      continue
    }
    const key = KEY.exec(text.slice(i))?.[0]
    if (!key) throw new Error(`a defaults entry that is no key, at "${text.slice(i, i + 30)}"`)
    i = gap(text, i + key.length).i
    if (text[i] !== ':') throw new Error(`the defaults entry "${key}" has no value`)
    const from = gap(text, i + 1).i
    let entry
    if (text[from] === '{') {
      const inner = objectAt(text, from)
      i = inner.end + 1
      entry = { from, to: i, entries: inner.entries, meaning: null }
    } else {
      const v = value(text, from)
      i = v.end
      entry = { from, to: v.to, meaning: v.comment }
    }
    if (text[i] === ',') i++
    // The comment after the comma, on the same line.
    const rest = /^[ \t]*\/\/(.*)/.exec(text.slice(i, text.indexOf('\n', i) < 0 ? text.length : text.indexOf('\n', i)))
    if (rest) entry.meaning = rest[1].trim()
    entries.push({ key: key.replace(/^['"]|['"]$/g, ''), ...entry })
  }
}

// The entries of a module's defaults, or null if it has none.
function defaultsOf(text) {
  const start = START.exec(text)
  return start ? objectAt(text, start.index + start[0].length - 1).entries : null
}

// The builder `name`'s entries among `files` (`[{ path, text }]`, every file of `SOURCES`):
// `{ path, text, entries }`, or null.
function find(files, name) {
  for (const { path, text } of files) {
    const top = defaultsOf(text)
    if (!top) continue
    const own = top.find((entry) => entry.key === name && entry.entries)
    if (own) return { path, text, entries: own.entries }
    if (path.endsWith(`asset-${name}.js`)) return { path, text, entries: top }
  }
  return null
}

/**
 * The builder `name`'s defaults as `files` (`[{ path, text }]`, every file of `SOURCES`) write
 * them: `{ path, params: [{ key, text, meaning }] }`, `text` each value as written ('6 * SCALE'),
 * `meaning` the comment after it, or the first said of a parameter of that name anywhere if it
 * has none (the stairs' `sink` and a doorway's `from` are said once for all). Null if no file has them.
 */
export function describe(files, name) {
  const found = find(files, name)
  if (!found) return null
  const said = new Map()
  const gather = (entries) => {
    for (const entry of entries) {
      if (entry.entries) gather(entry.entries)
      else if (entry.meaning && !said.has(entry.key)) said.set(entry.key, entry.meaning)
    }
  }
  for (const { text } of files) gather(defaultsOf(text) ?? [])
  const params = found.entries.map(({ key, from, to, meaning }) => ({ key, text: found.text.slice(from, to), meaning: meaning ?? said.get(key) ?? '' }))
  return { path: found.path, params }
}

// --- Writing it back ---

// The values of an array literal's text, each as written; none if it is no array literal.
function elements(text) {
  if (!text.startsWith('[')) return []
  const parts = []
  let i = 1
  for (;;) {
    i = gap(text, i).i
    if (i >= text.length || text[i] === ']') return parts
    const v = value(text, i)
    parts.push(text.slice(i, v.to))
    i = v.end + (text[v.end] === ',' ? 1 : 0)
  }
}

/**
 * `value` as source, written as `was` was where it can be: a size that was so many times
 * `SCALE` stays one if it is a round number of them (to the millimetre), an array's values
 * each as the one they replace. Strings in single quotes, as the builders write them.
 */
export function literal(value, was = '', scale = 0) {
  if (typeof value === 'number') {
    if (scale && SCALED.test(was.trim())) {
      const times = Math.round((value / scale) * 1000) / 1000
      if (Math.abs(times * scale - value) < 1e-9) return `${times} * SCALE`
    }
    return String(Math.round(value * 1e6) / 1e6)
  }
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  if (Array.isArray(value)) {
    const old = elements(was.trim())
    return `[${value.map((v, i) => literal(v, old.length === value.length ? old[i] : '', scale)).join(', ')}]`
  }
  if (value && typeof value === 'object') return `{ ${Object.entries(value).map(([key, v]) => `${key}: ${literal(v, '', scale)}`).join(', ')} }`
  return String(value)
}

/** The kit's `SCALE` as `files` say it (`asset-kit.js`), or 0 if none does. */
export function scaleIn(files) {
  for (const { text } of files) {
    const found = /^export const SCALE = ([\d.]+)/m.exec(text)
    if (found) return Number(found[1])
  }
  return 0
}

/**
 * The builder `name`'s defaults rewritten so that each key of `values` is that value, every
 * other word and comment of the file kept: `{ path, text }`, the file and its new text. Throws
 * if no file has the builder's defaults, or they have no entry for one of `values`' keys.
 */
export function rewrite(files, name, values) {
  const found = find(files, name)
  if (!found) throw new Error(`no defaults for the asset "${name}" in ${files.map(({ path }) => path).join(', ')}`)
  const scale = scaleIn(files)
  const edits = Object.entries(values).map(([key, v]) => {
    const entry = found.entries.find((e) => e.key === key)
    if (!entry) throw new Error(`the defaults of "${name}" (${found.path}) have no "${key}"`)
    return { ...entry, written: literal(v, found.text.slice(entry.from, entry.to), scale) }
  })
  let text = found.text
  for (const { from, to, written } of edits.sort((a, b) => b.from - a.from)) text = text.slice(0, from) + written + text.slice(to)
  return { path: found.path, text }
}

// --- The editor's side ---

/** The builder `name`'s defaults as the dev server reads them (`describe`). */
export async function readDefaults(name) {
  const response = await fetch(`${ASSET_ROUTE}${name}`)
  const reply = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(reply.error ?? `the server said ${response.status}`)
  return reply
}

/**
 * Makes `values` the builder `name`'s defaults in its source, and, with `place` (`{ name,
 * record }`), writes that place's file in the same request, since the page reloads when either
 * is written. Resolves to the paths written; throws, with the server's reason, if nothing was.
 */
export async function writeDefaults(name, values, place = null) {
  const response = await fetch(`${ASSET_ROUTE}${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ values, place }) })
  const reply = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(reply.error ?? `the server said ${response.status}`)
  return reply.written
}
