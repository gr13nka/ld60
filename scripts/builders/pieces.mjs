// What the builders' hands make: records of a place (`places.js`' shapes) for a deck, a stair, a
// bridge, a pier, a hanger, a pipe, an arc, a block, a graft and the rest, out of `forms.js`'
// sections and the asset kit. Each maker returns `{ forms, assets, props, lamps, lights, signs,
// cuts, way }`; `b.mjs` tags, checks and lays them in. Yaws and directions the builder gives are
// in degrees on the plan: 0 is +Z, 90 is +X (a rising yaw turns +Z toward +X, `forms.js`).
// Pure: no files.
import { circle, prism, rect, ring, roundedTop, trapezoid } from '../../src/forms.js'
import { assetDefaults, assetExtent, ASSETS, freshTag } from '../../src/assets.js'
import { floorHit, ceilingHit, MIST, round } from './world.mjs'

export const DEG = Math.PI / 180
const r2 = (v) => round(v, 100)
const P = (x, y, z) => ({ x: r2(x), y: r2(y), z: r2(z) })
const empty = () => ({ forms: [], assets: [], props: [], lamps: [], lights: [], signs: [], cuts: [], murals: [] })

/** A point 'x,y,z' as numbers. */
export function point(text, what = 'a point') {
  const v = String(text ?? '').split(',').map(Number)
  if (v.length !== 3 || v.some((n) => !Number.isFinite(n))) throw new Error(`${what} must be x,y,z (three numbers), not "${text}"`)
  return { x: v[0], y: v[1], z: v[2] }
}
/** Points 'x,y,z;x,y,z' as a list. */
export const points = (text, what) => String(text ?? '').split(';').filter(Boolean).map((p) => point(p, what))
/** A number, within [lo, hi], or the fallback. */
export function num(value, fallback, lo = -Infinity, hi = Infinity, what = 'a number') {
  if (value === undefined || value === '') {
    if (fallback === undefined) throw new Error(`${what} is wanted`)
    return fallback
  }
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error(`${what} must be a number, not "${value}"`)
  return Math.min(hi, Math.max(lo, n))
}

const flat = (a, b) => Math.hypot(b.x - a.x, b.z - a.z)
// The level unit vector from a toward b, and the one to its right (`forms.js`' u for a sweep along it).
function heading(a, b) {
  const d = flat(a, b) || 1
  const t = { x: (b.x - a.x) / d, z: (b.z - a.z) / d }
  return { t, right: { x: -t.z, z: t.x } }
}
const yawToward = (a, b) => Math.atan2(b.x - a.x, b.z - a.z)

// A level slab's record along a → b (the path at its top), `w` across and `thick` deep.
export function slab(a, b, w, thick, look, shape = 'chamfer') {
  const section = shape === 'hull' ? trapezoid(w * 0.62, w, thick, -thick) : rect(w, thick, -thick)
  const bevel = shape === 'flat' ? undefined : { size: r2(Math.min(0.6, thick * 0.35)), segments: shape === 'rounded' ? 3 : 1 }
  return { kind: 'sweep', at: P(a.x, a.y, a.z), look, section, ...(bevel && { bevel }), path: [{ x: 0, y: 0, z: 0 }, P(b.x - a.x, b.y - a.y, b.z - a.z)] }
}

// An upright post from `y0` to `y1` at (x, z): square, round or a blade turned `yaw`, tapering to `taper` of itself at the top.
export function post(x, z, y0, y1, size, shape, look, yaw = 0, taper = 1) {
  if (shape === 'round') {
    const r = size / 2
    return { kind: 'lathe', at: P(x, y0, z), look, sides: 12, smooth: true, profile: [[0, 0], [r2(r), 0], [r2(r * taper), r2(y1 - y0)], [0, r2(y1 - y0)]] }
  }
  const [hw, hd] = shape === 'blade' ? [size * 1.6, size * 0.3] : [size / 2, size / 2]
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [x + u * c + v * s, z - u * s + v * c])
  const form = prism(corners, y0, y1, look)
  if (taper !== 1) form.path[1].scale = [r2(taper), r2(taper)]
  return form
}

/** Where a post standing from `top` down at (x, z) comes to rest: the first floor under it, or into the mist. */
export function footUnder(site, x, top, z) {
  const hit = floorHit(site, x, top - 0.2, z)
  return hit && hit.y > MIST ? { y: hit.y - 0.4, on: hit.key } : { y: MIST - 4, on: 'mist' }
}

// Posts under a way from a to b (its top at the path, `thick` deep), one every `every` metres, standing to whatever is below.
function postsUnder(site, a, b, thick, every, size, shape, look) {
  const n = Math.max(1, Math.ceil(flat(a, b) / every))
  const out = []
  for (let k = 0; k <= n; k++) {
    const t = k / n
    const x = a.x + (b.x - a.x) * t
    const z = a.z + (b.z - a.z) * t
    const top = a.y + (b.y - a.y) * t - thick + 0.3
    const foot = footUnder(site, x, top - 0.6, z)
    if (top - foot.y < 0.8) continue // it already lies on something there
    out.push(post(x, z, foot.y, top, size, shape, look, yawToward(a, b)))
  }
  return out
}

// Hangers over a way: rods from its top up to the first underside above, if there is one within `most`.
function hangersOver(site, a, b, every, most, look) {
  const n = Math.max(1, Math.ceil(flat(a, b) / every))
  const out = []
  for (let k = 0; k <= n; k++) {
    const t = k / n
    const x = a.x + (b.x - a.x) * t
    const z = a.z + (b.z - a.z) * t
    const y = a.y + (b.y - a.y) * t
    const up = ceilingHit(site, x, y + 2.5, z)
    if (!up || up.y - y > most) continue
    out.push({ kind: 'sweep', at: P(x, y - 0.3, z), look, section: circle(0.25, 6), path: [{ x: 0, y: 0, z: 0 }, P(0, up.y - y + 0.6, 0)] })
  }
  return out
}

// The holds asked for under or over a way: 'auto' (every `span` metres), a number of metres, or none.
function holds(args, made, site, a, b, thick, gen, look) {
  const piers = args.piers ?? 'auto'
  if (piers !== 'none' && piers !== '0') {
    const every = piers === 'auto' ? Math.max(8, gen.span * 0.8) : num(piers, 20, 6, 400, 'piers')
    made.forms.push(...postsUnder(site, a, b, thick, every, num(args.pierSize, 3, 0.8, 30, 'pierSize'), args.pierShape ?? 'round', look).map((f) => ({ ...f, role: 'support' })))
  }
  if (args.hangers && gen.verbs.includes('hanger')) {
    const every = args.hangers === 'auto' ? 12 : num(args.hangers, 12, 4, 200, 'hangers')
    made.forms.push(...hangersOver(site, a, b, every, gen.hanger, look).map((f) => ({ ...f, role: 'support' })))
  }
}

/** deck from= to= width= [thick=] [shape=chamfer|rounded|hull|flat] [piers=auto|<m>|none] */
export function deck(args, ctx) {
  const a = point(args.from, 'from')
  const b = point(args.to, 'to')
  const w = num(args.width, 18, 2, 120, 'width') * ctx.drift()
  const thick = num(args.thick, 1.6, 0.4, 12, 'thick') * ctx.drift()
  const made = empty()
  made.forms.push({ ...slab(a, b, w, thick, ctx.look(args.look), args.shape ?? 'chamfer'), role: 'way', way: { from: [a.x, a.y, a.z], to: [b.x, b.y, b.z], width: r2(w) } })
  holds(args, made, ctx.site, a, b, thick, ctx.gen, ctx.look(args.pierLook ?? args.look))
  made.way = { a, b, width: w, slope: Math.atan2(Math.abs(b.y - a.y), flat(a, b)) / DEG }
  if (made.way.slope > ctx.gen.rampMost) throw new Error(`a way of ${made.way.slope.toFixed(0)}° is steeper than ${ctx.gen.rampMost}°: make it longer, or use a stair`)
  return made
}

/** ramp: a deck that slopes; refused steeper than the shift allows. */
export function ramp(args, ctx) {
  return deck(args, ctx)
}

/** stair from= to= width=: risers of 0.45 at most, a landing every 18, as one sweep; or kit=<a stair asset>. */
export function stair(args, ctx) {
  if (args.kit) return asset({ ...args, name: args.kit, at: args.at ?? args.from }, ctx)
  let a = point(args.from, 'from')
  let b = point(args.to, 'to')
  if (b.y > a.y) [a, b] = [b, a] // laid from its top down
  const w = num(args.width, 18, 2, 120, 'width') * ctx.drift()
  const run = flat(a, b)
  const H = a.y - b.y
  const riser = Math.min(0.45, num(args.riser, 0.45, 0.15, 0.45, 'riser'))
  const n = Math.max(1, Math.ceil(H / riser))
  const landings = Math.floor((n - 1) / 18)
  const landLen = num(args.landing, 4, 2, 30, 'landing')
  const tread = (run - landings * landLen) / n
  if (H < 0.5) throw new Error('a stair must fall: from and to are at the same height (use a deck)')
  if (tread < 0.3) throw new Error(`the stair is too steep: ${n} risers of ${(H / n).toFixed(2)} m over ${run.toFixed(1)} m leave treads of ${tread.toFixed(2)} m (0.3 at least). Make it ${Math.ceil(n * 0.3 + landings * landLen - run)} m longer, or fewer landings.`)
  const r = H / n
  const top = [[0, 0]]
  let u = 0
  let v = 0
  for (let k = 1; k <= n; k++) {
    u += tread
    top.push([r2(u), r2(v)])
    v -= r
    top.push([r2(u), r2(v)])
    if (k % 18 === 0 && k < n) {
      u += landLen
      top.push([r2(u), r2(v)])
    }
  }
  const lag = 18 * (r - (tread * H) / run)
  const thick = Math.max(1.2, lag + 1.2)
  const outline = [...top, [r2(run), r2(-H - thick)], [0, r2(-thick)]]
  // Wound counter-clockwise (u right, v up): the steps are traced left to right and down, so turn it round.
  const section = outline.reverse()
  // The path runs across the stair, so that the section's u lies down its length: t = up × s.
  const { t: s } = heading(a, b)
  const across = { x: s.z, z: -s.x }
  const made = empty()
  made.forms.push({
    kind: 'sweep',
    at: P(a.x - (across.x * w) / 2, a.y, a.z - (across.z * w) / 2),
    look: ctx.look(args.look),
    section,
    path: [{ x: 0, y: 0, z: 0 }, P(across.x * w, 0, across.z * w)],
    role: 'way',
    way: { from: [a.x, a.y, a.z], to: [b.x, b.y, b.z], width: r2(w) },
  })
  holds(args, made, ctx.site, a, b, thick, ctx.gen, ctx.look(args.pierLook ?? args.look))
  made.way = { a, b, width: w, slope: Math.atan2(H, run) / DEG }
  return made
}

/** bridge from= to= width= kind=beam|arch|hung|truss|kit:<beamBridge|troughBridge|hungBridge|steppedBridge|brokenBridge> */
export function bridge(args, ctx) {
  const kind = args.kind ?? 'beam'
  const a = point(args.from, 'from')
  const b = point(args.to, 'to')
  if (kind.startsWith('kit:')) {
    const name = kind.slice(4)
    const mid = P((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
    const foot = footUnder(ctx.site, mid.x, Math.min(a.y, b.y) - 1, mid.z)
    const height = Math.min(a.y, b.y) - foot.y
    const params = { span: r2(flat(a, b)), height: r2(Math.max(4, height)) }
    if (args.width) params.width = num(args.width, 8, 4, 60, 'width')
    return asset({ ...args, name, at: `${mid.x},${r2(Math.min(a.y, b.y) - params.height)},${mid.z}`, yaw: String(yawToward(a, b) / DEG), params: Object.entries(params).map(([k, v]) => `${k}:${v}`).join(',') + (args.params ? `,${args.params}` : '') }, ctx)
  }
  const made = deck({ ...args, piers: args.piers ?? 'none' }, ctx)
  const w = made.way.width
  const thick = 1.6
  const look = ctx.look(args.look)
  const { t, right } = heading(a, b)
  const span = flat(a, b)
  const along = (k, n, dy = 0, side = 0) => P(a.x + (b.x - a.x) * (k / n) + right.x * side, a.y + (b.y - a.y) * (k / n) + dy, a.z + (b.z - a.z) * (k / n) + right.z * side)
  const rel = (p, o) => P(p.x - o.x, p.y - o.y, p.z - o.z)
  if (kind === 'beam') {
    for (const side of [-1, 1]) {
      const o = along(0, 1, -thick, side * (w / 2 - 0.6))
      made.forms.push({ kind: 'sweep', at: o, look, section: rect(1.2, 2.8, -2.8), bevel: { size: 0.3, segments: 1 }, path: [{ x: 0, y: 0, z: 0 }, rel(along(1, 1, -thick, side * (w / 2 - 0.6)), o)], role: 'way' })
    }
  } else if (kind === 'arch') {
    const n = 16
    const sag = num(args.sag, Math.max(6, span * 0.2), 2, 200, 'sag')
    const o = along(0, n, -thick - sag)
    const path = Array.from({ length: n + 1 }, (_, k) => rel(along(k, n, -thick - sag * (2 * k / n - 1) ** 2), o))
    made.forms.push({ kind: 'sweep', at: o, look, smooth: true, section: rect(Math.min(w * 0.45, 8), 2.4, -1.2), path, role: 'support' })
    for (let k = 1; k < 8; k++) {
      const m = k / 8
      const drop = sag * (2 * m - 1) ** 2
      if (drop < 1) continue
      const p = along(k, 8, -thick - drop)
      made.forms.push({ kind: 'sweep', at: p, look, section: rect(Math.min(w * 0.4, 6), 0.9, -0.45), path: [{ x: 0, y: 0, z: 0 }, P(0, drop + 0.3, 0)], role: 'support' })
    }
  } else if (kind === 'hung') {
    const mast = num(args.mast, Math.max(14, span * 0.22), 6, 200, 'mast')
    for (const side of [-1, 1]) {
      for (const end of [0, 1]) {
        const p = along(end, 1, -thick, side * (w / 2 + 0.8))
        made.forms.push(post(p.x, p.z, p.y, p.y + thick + mast, 1.6, 'square', look, yawToward(a, b), 0.7))
      }
      const n = 10
      const o = along(0, n, mast, side * (w / 2 + 0.8))
      const path = Array.from({ length: n + 1 }, (_, k) => rel(along(k, n, mast - mast * 0.85 * (1 - (2 * k / n - 1) ** 2), side * (w / 2 + 0.8)), o))
      made.forms.push({ kind: 'sweep', at: o, look, smooth: true, section: circle(0.4, 8), path, role: 'support' })
      for (let k = 1; k < n; k++) {
        const h = mast - mast * 0.85 * (1 - (2 * k / n - 1) ** 2)
        const p = along(k, n, 0, side * (w / 2 + 0.8))
        made.forms.push({ kind: 'sweep', at: p, look, section: circle(0.15, 6), path: [{ x: 0, y: 0, z: 0 }, P(0, h, 0)], role: 'support' })
      }
    }
  } else if (kind === 'truss') {
    const n = Math.max(4, Math.round(span / 5))
    for (const side of [-1, 1]) {
      const o = along(0, n, 0, side * (w / 2 - 0.3))
      const path = Array.from({ length: n + 1 }, (_, k) => rel(along(k, n, k % 2 ? 5 : 0.2, side * (w / 2 - 0.3)), o))
      made.forms.push({ kind: 'sweep', at: o, look, section: rect(0.5, 0.5, -0.25), path, role: 'support' })
      const o2 = along(0, 1, 5, side * (w / 2 - 0.3))
      made.forms.push({ kind: 'sweep', at: o2, look, section: rect(0.6, 0.6, -0.3), path: [{ x: 0, y: 0, z: 0 }, rel(along(1, 1, 5, side * (w / 2 - 0.3)), o2)], role: 'support' })
    }
  } else throw new Error(`a bridge is of the kind beam, arch, hung, truss or kit:<a bridge asset>, not "${kind}"`)
  if (args.piers && args.piers !== 'none') holds({ ...args, hangers: undefined }, made, ctx.site, a, b, thick, ctx.gen, look)
  made.kind = kind
  void t
  return made
}

/** pier at=x,y,z (its top) [size=] [shape=round|square|blade] [yaw=] [taper=] */
export function pier(args, ctx) {
  const top = point(args.at, 'at')
  const size = num(args.size, 4, 0.6, 60, 'size') * ctx.drift()
  const foot = footUnder(ctx.site, top.x, top.y - 0.3, top.z)
  const made = empty()
  made.forms.push({ ...post(top.x, top.z, foot.y, top.y, size, args.shape ?? 'round', ctx.look(args.look), num(args.yaw, 0, -720, 720, 'yaw') * DEG, num(args.taper, 1, 0.2, 3, 'taper')), role: 'support' })
  made.note = `down to ${foot.on === 'mist' ? 'the mist' : `${foot.on} at ${foot.y.toFixed(1)}`}`
  return made
}

/** hanger at=x,y,z (its foot) [to=<height>]: a rod up to the first underside above. */
export function hanger(args, ctx) {
  const at = point(args.at, 'at')
  let topY = args.to !== undefined ? num(args.to, 0, -1000, 1000, 'to') : null
  if (topY === null) {
    const up = ceilingHit(ctx.site, at.x, at.y + 0.5, at.z)
    if (!up) throw new Error(`nothing above (${at.x}, ${at.y}, ${at.z}) to hang from`)
    topY = up.y
  }
  if (topY - at.y > ctx.gen.hanger) throw new Error(`the hanger would be ${(topY - at.y).toFixed(0)} m: ${ctx.gen.hanger} m at most`)
  const made = empty()
  made.forms.push({ kind: 'sweep', at: P(at.x, at.y - 0.5, at.z), look: ctx.look(args.look), section: circle(num(args.size, 0.5, 0.1, 6, 'size') / 2, 8), path: [{ x: 0, y: 0, z: 0 }, P(0, topY - at.y + 1, 0)], role: 'support' })
  return made
}

/** rail from= to= | along=<f id>: a parapet 1.1 m high (both edges of a way it is laid along). */
export function rail(args, ctx) {
  const made = empty()
  const look = ctx.look(args.look)
  const h = num(args.h, 1.1, 0.4, 3, 'h')
  const line = (a, b) => ({ kind: 'sweep', at: P(a.x, a.y - 0.2, a.z), look, section: rect(0.35, h + 0.2, 0), bevel: { size: 0.1, segments: 1 }, path: [{ x: 0, y: 0, z: 0 }, P(b.x - a.x, b.y - a.y, b.z - a.z)], role: 'dress' })
  if (args.along) {
    const found = ctx.find(args.along)
    const way = found?.record.way
    if (!way) throw new Error(`"${args.along}" is not a way a rail can be laid along (decks, ramps, stairs and bridges you made are)`)
    const a = { x: way.from[0], y: way.from[1], z: way.from[2] }
    const b = { x: way.to[0], y: way.to[1], z: way.to[2] }
    const { right } = heading(a, b)
    for (const side of [-1, 1]) {
      const off = side * (way.width / 2 - 0.2)
      made.forms.push(line({ x: a.x + right.x * off, y: a.y, z: a.z + right.z * off }, { x: b.x + right.x * off, y: b.y, z: b.z + right.z * off }))
    }
    return made
  }
  made.forms.push(line(point(args.from, 'from'), point(args.to, 'to')))
  return made
}

/** asset name=<kit> at=x,y,z (the middle of its foot) [yaw=deg] [params=k:v,k:v] [scale=] [mirror=true] */
export function asset(args, ctx) {
  const name = args.name
  if (!ctx.gen.kit.includes(name) && !(ctx.gen.kit.includes('*') && name in ASSETS)) throw new Error(`"${name}" is not in your kit. Your kit: ${ctx.gen.kit.join(', ')}`)
  const at = point(args.at, 'at')
  const yaw = num(args.yaw, 0, -720, 720, 'yaw') * DEG
  const params = {}
  const defaults = assetDefaults(name)
  for (const pair of String(args.params ?? '').split(',').filter(Boolean)) {
    const [k, v] = pair.split(':')
    if (!(k in defaults)) throw new Error(`${name} has no parameter "${k}": it has ${Object.keys(defaults).join(', ')}`)
    params[k] = typeof defaults[k] === 'number' ? Number(v) : typeof defaults[k] === 'boolean' ? v === 'true' : v
  }
  for (const look of ['look', 'top', 'tread', 'dim', 'doorLook']) if (look in defaults && !(look in params)) params[look] = ctx.look()
  if (!('sink' in params)) {
    const foot = footUnder(ctx.site, at.x, at.y + 0.1, at.z)
    if (at.y - foot.y > 0.6) params.sink = r2(at.y - foot.y)
  }
  const scale = num(args.scale, ctx.gen.assetScale[0], ctx.gen.assetScale[0], ctx.gen.assetScale[1], 'scale')
  const { lo, hi } = assetExtent(name, params)
  const ox = ((lo.x + hi.x) / 2) * scale
  const oz = ((lo.z + hi.z) / 2) * scale
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const made = empty()
  made.assets.push({
    tag: freshTag(ctx.place, name),
    name,
    params,
    at: P(at.x - (ox * c + oz * s), at.y, at.z - (-ox * s + oz * c)),
    yaw: round(yaw, 1e4),
    ...(args.mirror === 'true' && { mirror: true }),
    ...(scale !== 1 && { scale: r2(scale) }),
  })
  return made
}

/** prop kind=<PROPS kind> at=x,y,z [yaw=deg] [scale=] */
export function prop(args, ctx) {
  const kind = args.kind
  if (!ctx.propKinds.includes(kind) || ['ravenDispatch', 'tamara', 'ravenBooth'].includes(kind)) throw new Error(`no prop "${kind}" for you: ${ctx.gen.props.join(', ')}`)
  if (!ctx.gen.props.includes(kind) && !ctx.gen.props.includes('*')) throw new Error(`"${kind}" is not yours to stand: ${ctx.gen.props.join(', ')}`)
  const at = point(args.at, 'at')
  const scale = num(args.scale, ctx.gen.propScale[0], ctx.gen.propScale[0], ctx.gen.propScale[1], 'scale')
  const record = { kind, x: r2(at.x), y: r2(at.y), z: r2(at.z), yaw: round(num(args.yaw, 0, -720, 720, 'yaw') * DEG, 1e4), scale: r2(scale) }
  if (['gearTrain', 'largeCog', 'cogPair', 'largeGearTrain'].includes(kind)) record.animation = { mode: 'manual', rpm: r2(num(args.rpm, 1.5, 0.1, 12, 'rpm')) }
  const made = empty()
  made.props.push(record)
  return made
}

/** pipe from= [via=x,y,z;x,y,z] to= [r=] [kit=steamMain] */
export function pipe(args, ctx) {
  const a = point(args.from, 'from')
  const b = point(args.to, 'to')
  if (args.kit === 'steamMain') {
    const foot = footUnder(ctx.site, (a.x + b.x) / 2, Math.min(a.y, b.y), (a.z + b.z) / 2)
    const length = flat(a, b)
    const yaw = Math.atan2(-(b.z - a.z), b.x - a.x) // its length along its own X
    const height = Math.max(3, Math.min(a.y, b.y) - foot.y)
    return asset({ name: 'steamMain', at: `${(a.x + b.x) / 2},${r2(foot.y)},${(a.z + b.z) / 2}`, yaw: String(yaw / DEG), params: `length:${r2(length)},height:${r2(height)},radius:${num(args.r, 1.1, 0.3, 12, 'r')}` }, { ...ctx, gen: { ...ctx.gen, kit: [...ctx.gen.kit, 'steamMain'] } })
  }
  const via = args.via ? points(args.via, 'via') : []
  const r = num(args.r, 1, 0.2, 30, 'r') * ctx.drift()
  const all = [a, ...via, b]
  const made = empty()
  made.forms.push({ kind: 'sweep', at: P(a.x, a.y, a.z), look: ctx.look(args.look), smooth: true, section: args.hollow === 'false' ? circle(r, 12) : ring(r, Math.max(0.2, r * 0.22), 12), path: all.map((p) => P(p.x - a.x, p.y - a.y, p.z - a.z)), role: 'service' })
  for (let i = 0; i + 1 < all.length; i++) holds({ piers: args.piers ?? 'none', hangers: args.hangers, pierSize: String(r * 1.2), pierShape: 'square' }, made, ctx.site, all[i], all[i + 1], r, ctx.gen, ctx.look(args.look))
  return made
}

const sectionOf = (text, fallback) => {
  const [shape, dims] = String(text ?? fallback).split(':')
  const d = String(dims ?? '').split(',').map(Number)
  if (shape === 'round') return circle(d[0] || 1, 12)
  if (shape === 'tube') return ring(d[0] || 2, d[1] || 0.5, 12)
  if (shape === 'rect') return rect(d[0] || 2, d[1] || 2, -(d[1] || 2) / 2)
  if (shape === 'blade') return rect(d[1] || 0.8, d[0] || 4, -(d[0] || 4) / 2)
  throw new Error(`a section is rect:w,h, round:r, tube:r,thick or blade:h,w, not "${text}"`)
}

/** arc from= to= rise= [section=rect:w,h|round:r|tube:r,t|blade:h,w] [steps=]: a curved member from a to b, bowed `rise` up (down if negative). */
export function arc(args, ctx) {
  const a = point(args.from, 'from')
  const b = point(args.to, 'to')
  const rise = num(args.rise, 10, -400, 400, 'rise') * ctx.drift()
  const steps = Math.round(num(args.steps, 14, 4, 40, 'steps'))
  const made = empty()
  made.forms.push(arcForm(a, b, rise, steps, sectionOf(args.section, 'rect:2,2'), ctx.look(args.look)))
  return made
}
function arcForm(a, b, rise, steps, section, look) {
  const path = Array.from({ length: steps + 1 }, (_, k) => {
    const t = k / steps
    return P((b.x - a.x) * t, (b.y - a.y) * t + rise * 4 * t * (1 - t), (b.z - a.z) * t)
  })
  return { kind: 'sweep', at: P(a.x, a.y, a.z), look, smooth: true, section, path, role: 'support' }
}

/** rib from= to= rise= count= spacing= [dir=deg]: arcs repeated side by side, `spacing` apart across (or along `dir`). */
export function rib(args, ctx) {
  const a = point(args.from, 'from')
  const b = point(args.to, 'to')
  const rise = num(args.rise, 10, -400, 400, 'rise')
  const count = Math.round(num(args.count, 5, 1, 24, 'count'))
  const spacing = num(args.spacing, 8, 1, 200, 'spacing')
  const dir = args.dir !== undefined ? num(args.dir, 0, -720, 720, 'dir') * DEG : null
  const off = dir === null ? heading(a, b).right : { x: Math.sin(dir), z: Math.cos(dir) }
  const made = empty()
  const section = sectionOf(args.section, 'rect:2,3')
  for (let k = 0; k < count; k++) {
    const d = { x: off.x * spacing * k, z: off.z * spacing * k }
    const jitter = ctx.drift()
    made.forms.push(arcForm({ x: a.x + d.x, y: a.y, z: a.z + d.z }, { x: b.x + d.x, y: b.y, z: b.z + d.z }, rise * jitter, 14, section, ctx.look(args.look)))
  }
  return made
}

/** block corners=x,z;x,z;… | at=x,z w= d= [yaw=]  top= [bottom=]: a mass from the floor under it (or the mist) up to `top`. */
export function block(args, ctx) {
  let corners
  if (args.corners) corners = String(args.corners).split(';').filter(Boolean).map((p) => p.split(',').map(Number))
  else {
    const [x, z] = String(args.at ?? '').split(',').map(Number)
    const w = num(args.w, 20, 2, 400, 'w') * ctx.drift()
    const d = num(args.d, 20, 2, 400, 'd') * ctx.drift()
    const yaw = num(args.yaw, 0, -720, 720, 'yaw') * DEG
    const c = Math.cos(yaw)
    const s = Math.sin(yaw)
    corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [x + u * c + v * s, z - u * s + v * c])
  }
  if (corners.length < 3 || corners.some((c) => c.length !== 2 || c.some((v) => !Number.isFinite(v)))) throw new Error('a block needs corners=x,z;x,z;x,z (three or more), or at=x,z with w= and d=')
  const top = num(args.top, undefined, -400, 600, 'top')
  const cx = corners.reduce((s, c) => s + c[0], 0) / corners.length
  const cz = corners.reduce((s, c) => s + c[1], 0) / corners.length
  const bottom = args.bottom !== undefined ? num(args.bottom, 0, -400, 600, 'bottom') : Math.min(...[[cx, cz], ...corners].map(([x, z]) => footUnder(ctx.site, x, top - 0.5, z).y))
  if (top - bottom < 1) throw new Error(`the block's top (${top}) is not over what is under it (${bottom.toFixed(1)})`)
  const form = prism(corners.map(([x, z]) => [r2(x), r2(z)]), bottom, top, ctx.look(args.look))
  const taper = num(args.taper, 1, 0.2, 3, 'taper')
  if (taper !== 1) form.path[1].scale = [r2(taper), r2(taper)]
  if (args.bevel) form.bevel = { size: num(args.bevel, 0.6, 0.05, 6, 'bevel'), segments: 2 }
  const made = empty()
  made.forms.push({ ...form, role: 'mass' })
  return made
}

// The outline on the plan of a record's top, for a graft: a box's, a prism's own section, or the hull of a form's highest corners.
function topOutline(rec, positionsOf) {
  const r = rec.record
  if (rec.list === 'boxes') return { corners: [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]], top: r.y1 }
  const pos = positionsOf(rec.list, r)
  let top = -Infinity
  for (let i = 1; i < pos.length; i += 3) top = Math.max(top, pos[i])
  const pts = []
  for (let i = 0; i < pos.length; i += 3) if (pos[i + 1] > top - 1.5) pts.push([pos[i], pos[i + 2]])
  return { corners: hull(pts), top }
}
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper = []
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop()
    upper.push(q)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

// A sweep up a path that leans frames its section by the lean (`forms.js`' `frame`): its v is
// laid back against the lean, its u across it, where an upright path lays u on +X and v on +Z. So
// a plan outline stood on a leaning path is turned first, to stand where the upright one would.
function leaned(form, lx, lz) {
  const len = Math.hypot(lx, lz)
  if (len < 1e-3) return form
  const [Lx, Lz] = [lx / len, lz / len]
  form.section = form.section.map(([x, z]) => [r2(x * -Lz + z * Lx), r2(x * -Lx + z * -Lz)])
  form.path[1] = { ...form.path[1], x: r2(lx), z: r2(lz) }
  return form
}

/** graft on=<key> up= [taper=] [lean=dx,dz] [inset=]: what stands is continued upward, a mass on its top. */
export function graft(args, ctx, positionsOf) {
  const rec = ctx.find(args.on)
  if (!rec) throw new Error(`nothing is known by "${args.on}" (keys look like f123, b45, a:house-1)`)
  if (rec.list === 'props' || rec.list === 'assets') throw new Error('a graft continues a form or a box; bake an asset first')
  if (rec.record.storyKeep) throw new Error(`${args.on} must stay as it is: nothing is grafted onto it`)
  let { corners, top } = topOutline({ list: rec.list, record: rec.record }, positionsOf)
  if (corners.length < 3) throw new Error(`${args.on} has no top to graft onto`)
  const inset = num(args.inset, 0, 0, 0.45, 'inset')
  if (inset) {
    const cx = corners.reduce((s, c) => s + c[0], 0) / corners.length
    const cz = corners.reduce((s, c) => s + c[1], 0) / corners.length
    corners = corners.map(([x, z]) => [cx + (x - cx) * (1 - inset), cz + (z - cz) * (1 - inset)])
  }
  const up = num(args.up, 12, 1, 400, 'up') * ctx.drift()
  if (up < (ctx.gen.graftLeast ?? 1)) throw new Error(`a graft of ${up.toFixed(1)} m is a crumb: your kind raises ${ctx.gen.graftLeast} m at the least`)
  // A graft on a graft on a graft of this same shift is a column of crumbs: twice is the most.
  let depth = 0
  for (let r = rec.record; r?.grafted && r.planOwner === ctx.ownTag && depth < 3; r = ctx.find(r.grafted)?.record) depth++
  if (depth >= 2) throw new Error(`${args.on} is already a graft on a graft of yours: raise something else`)
  const form = prism(corners.map(([x, z]) => [r2(x), r2(z)]), top - 0.5, top + up, ctx.look(args.look))
  const [lx, lz] = String(args.lean ?? '0,0').split(',').map(Number)
  const taper = num(args.taper, 1, 0.2, 3, 'taper')
  if (taper !== 1) form.path[1].scale = [r2(taper), r2(taper)]
  leaned(form, lx || 0, lz || 0)
  const made = empty()
  made.forms.push({ ...form, role: 'mass', grafted: args.on })
  return made
}

/** skew id=<box key> [lean=dx,dz] [taper=]: a box taken out and stood again as a mass that leans and narrows. */
export function skew(args, ctx) {
  const rec = ctx.find(args.id)
  if (!rec || rec.list !== 'boxes') throw new Error(`skew takes a box (b<number>), and "${args.id}" is not one`)
  if (rec.record.storyKeep || ctx.keeps?.({ min: { x: rec.record.x0, y: rec.record.y0, z: rec.record.z0 }, max: { x: rec.record.x1, y: rec.record.y1, z: rec.record.z1 } })) throw new Error(`${args.id} lies in ground that must stay: it is not to be moved`)
  const b = rec.record
  const form = prism([[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]], b.y0, b.y1, b.look)
  const [lx, lz] = String(args.lean ?? '2,0').split(',').map(Number)
  const taper = num(args.taper, 0.85, 0.2, 3, 'taper')
  form.path[1].scale = [r2(taper), r2(taper)]
  leaned(form, lx || 0, lz || 0)
  const made = empty()
  made.forms.push({ ...form, role: 'mass', was: args.id })
  made.remove = [args.id]
  return made
}

/** sweep at=x,y,z section=u,v;u,v;… path=x,y,z;x,y,z;… [smooth=true]: a raw form. */
export function sweep(args, ctx) {
  const at = point(args.at, 'at')
  const section = String(args.section ?? '').split(';').filter(Boolean).map((p) => p.split(',').map(Number))
  if (section.length < 3 || section.some((c) => c.length !== 2 || c.some((v) => !Number.isFinite(v)))) throw new Error('section must be three or more u,v corners: section="-2,0;2,0;0,3"')
  const area = section.reduce((s, [u, v], i) => s + u * section[(i + 1) % section.length][1] - section[(i + 1) % section.length][0] * v, 0)
  const path = points(args.path, 'path')
  if (path.length < 2) throw new Error('path must be two or more points relative to at: path="0,0,0;0,0,40"')
  const made = empty()
  made.forms.push({ kind: 'sweep', at: P(at.x, at.y, at.z), look: ctx.look(args.look), smooth: args.smooth === 'true', section: (area < 0 ? [...section].reverse() : section).map(([u, v]) => [r2(u * ctx.drift()), r2(v)]), path: path.map((p) => P(p.x, p.y, p.z)), role: 'mass' })
  return made
}

/** lathe at=x,y,z profile=r,y;r,y;… [sides=] [arc=from,to]: a raw form turned about an upright axis. */
export function lathe(args, ctx) {
  const at = point(args.at, 'at')
  const profile = String(args.profile ?? '').split(';').filter(Boolean).map((p) => p.split(',').map(Number))
  if (profile.length < 3 || profile.some((c) => c.length !== 2 || c.some((v) => !Number.isFinite(v)) || c[0] < 0)) throw new Error('profile must be three or more r,y points with r ≥ 0: profile="0,0;8,0;6,30;0,30"')
  const k = ctx.drift()
  const made = empty()
  const form = { kind: 'lathe', at: P(at.x, at.y, at.z), look: ctx.look(args.look), smooth: true, sides: Math.round(num(args.sides, 16, 3, 48, 'sides')), profile: profile.map(([r, y]) => [r2(r * k), r2(y)]), role: 'mass' }
  if (args.arc) form.arc = String(args.arc).split(',').map((v) => Number(v) * DEG)
  made.forms.push(form)
  return made
}

/** lamp at=x,y,z: a box of amber light. light at=x,y,z [power=] [reach=]: real light, amber. sign at= w= h= yaw= text= */
export function lamp(args, ctx) {
  const at = point(args.at, 'at')
  const made = empty()
  made.lamps.push({ x0: r2(at.x - 0.4), x1: r2(at.x + 0.4), y0: r2(at.y), y1: r2(at.y + 0.3), z0: r2(at.z - 0.4), z1: r2(at.z + 0.4) })
  void ctx
  return made
}
export function light(args) {
  const at = point(args.at, 'at')
  const made = empty()
  made.lights.push({ kind: 'point', x: r2(at.x), y: r2(at.y), z: r2(at.z), color: '#ffc27a', power: num(args.power, 60, 5, 400, 'power'), reach: num(args.reach, 40, 5, 120, 'reach'), head: { w: 0.4, h: 0.25, d: 0.4 } })
  return made
}
export function sign(args, ctx) {
  const at = point(args.at, 'at')
  const text = String(args.text ?? '').slice(0, 40)
  if (!text) throw new Error('a sign needs text="..."')
  const made = empty()
  made.signs.push({ x: r2(at.x), y: r2(at.y), z: r2(at.z), w: num(args.w, 8, 1, 60, 'w'), h: num(args.h, 2, 0.5, 20, 'h'), yaw: round(num(args.yaw, 0, -720, 720, 'yaw') * DEG, 1e4), text: ctx.gen.signCase === 'upper' ? text.toUpperCase() : text })
  return made
}

const sectionCut = (shape, w, h) => {
  if (shape === 'arch') return roundedTop(w, h, Math.min(w / 2, h) - 0.01, 0, 8)
  if (shape === 'round') return circle(w / 2, 16, 0, w / 2)
  return rect(w, h, 0)
}

/** cut shape=box|arch|round|well at=x,y,z dir=deg length= w= h=: a hole taken out of what it passes through. */
export function cutRecord(args) {
  const shape = args.shape ?? 'box'
  const at = point(args.at, 'at')
  const w = num(args.w, 26, 1, 300, 'w')
  const h = num(args.h, 16, 1, 300, 'h')
  const length = num(args.length, 20, 1, 400, 'length')
  if (shape === 'well') return { at: P(at.x, at.y + 1, at.z), section: rect(w, h, -h / 2), path: [{ x: 0, y: 0, z: 0 }, P(0, -(length + 1), 0)] }
  const dir = num(args.dir, 0, -720, 720, 'dir') * DEG
  return { at: P(at.x, at.y, at.z), section: sectionCut(shape, w, h), path: [{ x: 0, y: 0, z: 0 }, P(Math.sin(dir) * length, 0, Math.cos(dir) * length)] }
}

export const VERBS = { deck, ramp, stair, bridge, pier, hanger, rail, asset, prop, pipe, arc, rib, block, graft, skew, sweep, lathe, lamp, light, sign }
