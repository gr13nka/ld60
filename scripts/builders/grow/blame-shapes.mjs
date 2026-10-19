// The forms the BLAME! layer is made of, as place-file records (no ids: the layer gives them).
// Each is one record that reads as a great deal of building: a comb of fins, a stair of a hundred
// treads, a column that flares into the floor above. Pure.
import { circle, prism, rect } from '../../../src/forms.js'
import { MIST, round } from '../world.mjs'

const r2 = (v) => round(v, 100)
const P = (x, y, z) => ({ x: r2(x), y: r2(y), z: r2(z) })
export const FOOT = MIST - 4 // where whatever stands from the gorge starts: below the mist, so it is grounded

/** A level slab over (x0..x1, z0..z1), its top at y1 and its underside at y0. */
export const slab = (x0, x1, z0, z1, y0, y1, look) => ({ ...prism([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y1, look), role: 'mass' })

/** A column from `y0` to `y1` at (x, z), `r` thick; it leans (`lean` metres at the top), tapers to `taper`, and flares to `flare` times at the top. */
export function column({ x, z, y0, y1, r, look, lean = [0, 0], taper = 1, flare = 1, sides = 14 }) {
  const h = y1 - y0
  const path = [P(0, 0, 0)]
  if (flare > 1) {
    path.push({ ...P(lean[0] * 0.82, h - 34, lean[1] * 0.82), scale: [r2(taper), r2(taper)] })
    path.push({ ...P(lean[0] * 0.94, h - 6, lean[1] * 0.94), scale: [r2(taper * flare), r2(taper * flare)] })
    path.push({ ...P(lean[0], h, lean[1]), scale: [r2(taper * flare), r2(taper * flare)] })
  } else path.push({ ...P(lean[0], h, lean[1]), scale: [r2(taper), r2(taper)] })
  return { kind: 'sweep', at: P(x, y0, z), look, smooth: true, section: circle(r, sides), path, role: 'support' }
}

/** A square pier or slab, `w` by `d` turned `yaw`, tapering to `taper` of itself (above 1 it widens upward). */
export function pylon({ x, z, y0, y1, w, d, yaw = 0, taper = 1, look, bevel = 0 }) {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const form = prism([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [r2(x + u * c + v * s), r2(z - u * s + v * c)]), y0, y1, look)
  if (taper !== 1) form.path[1].scale = [r2(taper), r2(taper)]
  if (bevel) form.bevel = { size: bevel, segments: 1 }
  return { ...form, role: 'mass' }
}

/**
 * A cell block: a body `w` by `d` with `fins` blades standing off both long faces, and a floor
 * band every `period` metres that overhangs by `over`. One record, a tower of windows' rhythm.
 */
export function finTower({ x, z, y0, y1, w, d, fins, fin = 4, yaw = 0, period = 48, over = 1.1, look, oneSide = false, lean = [0, 0] }) {
  const pitch = w / fins
  const front = []
  for (let k = fins - 1; k >= 0; k--) {
    const xl = -w / 2 + k * pitch + pitch * 0.2
    const xr = xl + pitch * 0.45
    front.push([xr, d / 2], [xr, d / 2 + fin], [xl, d / 2 + fin], [xl, d / 2])
  }
  const back = oneSide ? [] : front.map(([u, v]) => [-u, -v])
  const outline = [[-w / 2, -d / 2], ...back, [w / 2, -d / 2], [w / 2, d / 2], ...front, [-w / 2, d / 2]]
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const form = prism(outline.map(([u, v]) => [r2(x + u * c + v * s), r2(z - u * s + v * c)]), y0, y1, look)
  const h = y1 - y0
  const at = (y, scale) => ({ ...P(lean[0] * (y / h), y, lean[1] * (y / h)), scale: [scale, scale] })
  const path = [at(0, 1)]
  for (let y = 0; y + period < h; y += period) {
    path.push(at(y + period - 5, 1), at(y + period - 4.5, over), at(y + period - 0.6, over), at(y + period, 1))
  }
  path.push(at(h, 1))
  form.path = path
  return { ...form, role: 'mass' }
}

/** A girder, `w` across and `h` deep (its top on the line a → b), one record. */
export const girder = (a, b, w, h, look) => ({ kind: 'sweep', at: P(a.x, a.y, a.z), look, section: rect(w, h, -h), bevel: { size: r2(Math.min(0.6, w * 0.1)), segments: 1 }, path: [P(0, 0, 0), P(b.x - a.x, b.y - a.y, b.z - a.z)], role: 'support' })

/** A pipe or cable bundle along a → b, `r` thick, round. */
export const cable = (a, b, r, look) => ({ kind: 'sweep', at: P(a.x, a.y, a.z), look, smooth: true, section: circle(r, 10), path: [P(0, 0, 0), P(b.x - a.x, b.y - a.y, b.z - a.z)], role: 'service' })

/**
 * A stair of `n` treads (`rise` high, `run` long, `width` across) climbing toward -x (toward +x
 * if `east`), its foot at (x, y0, z), a solid wedge under it. The top is at y0 + n * rise.
 */
export function stair({ x, y0, z, n, rise, run, width, look, east = false }) {
  const pts = [[0, 0]]
  for (let k = 0; k < n; k++) pts.push([k * run, (k + 1) * rise], [(k + 1) * run, (k + 1) * rise])
  pts.push([n * run, 0])
  let section = pts.map(([u, v]) => [r2(east ? -u : u), r2(v)])
  const area = section.reduce((s, [u, v], i) => s + u * section[(i + 1) % section.length][1] - section[(i + 1) % section.length][0] * v, 0)
  if (area < 0) section = section.reverse()
  return { kind: 'sweep', at: P(x, y0, z - width / 2), look, section, path: [P(0, 0, 0), P(0, 0, width)], role: 'mass' }
}

/** A vertical ring (a torus about a horizontal axis turned `yaw`), `R` the ring, `tube` the bar, with a gap of `gap` radians. */
export function ring({ x, y, z, R, tube, yaw = 0, look, gap = 0.25, steps = 30 }) {
  const hx = Math.sin(yaw)
  const hz = Math.cos(yaw)
  const path = Array.from({ length: steps + 1 }, (_, k) => {
    const t = gap + ((Math.PI * 2 - gap * 2) * k) / steps
    return P(hx * R * Math.cos(t) - hx * R, R * Math.sin(t), hz * R * Math.cos(t) - hz * R)
  })
  return { kind: 'sweep', at: P(x + hx * R, y, z + hz * R), look, smooth: true, section: circle(tube, 12), path, role: 'mass' }
}

/** A row of `n` booths on a shared plinth along (hx, hz): one comb-shaped record. Each booth drifts a little in size. */
export function boothRow({ x, y, z, n, w, d, gap, tall, yaw, look, rng }) {
  const teeth = []
  let u = 0
  for (let k = 0; k < n; k++) {
    const bw = w * (0.9 + rng() * 0.2)
    const bd = d * (0.9 + rng() * 0.25)
    teeth.push([u, bd, bw])
    u += bw + gap
  }
  const length = u - gap
  const plinth = 3
  const top = [[length, 0], [length, plinth]]
  for (let k = n - 1; k >= 0; k--) {
    const [u0, bd, bw] = teeth[k]
    top.push([u0 + bw, plinth], [u0 + bw, bd], [u0, bd], [u0, plinth])
  }
  top.push([0, plinth])
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const corners = [[0, 0], ...top].filter((p, i, all) => i === 0 || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]).map(([a, b]) => [r2(x + (a - length / 2) * c + b * s), r2(z - (a - length / 2) * s + b * c)])
  return { ...prism(corners, y, y + tall, look), role: 'mass' }
}

/** A door frame `w` by `h` with its leaf missing, `deep` thick, from (x, y, z) (its back, the middle of its sill) out along the heading `yaw`. */
export function doorFrame({ x, y, z, w, h, deep, yaw, look }) {
  const edge = Math.min(w, h) * 0.18
  return {
    kind: 'sweep',
    at: P(x, y, z),
    yaw: r2(yaw), // the sweep's path runs along local +z: `yaw` is the heading out of the wall
    look,
    section: { outer: rect(w + edge * 2, h + edge * 2, -edge).map(([u, v]) => [u, v]), inner: rect(w, h, 0).slice().reverse() },
    path: [P(0, 0, 0), P(0, 0, deep)],
    role: 'dress',
  }
}

/** The dark that fills a door frame's opening (a plate 1 m thick), placed as the frame is. */
export const doorLeaf = ({ x, y, z, w, h, yaw }) => ({ kind: 'sweep', at: P(x, y, z), yaw: r2(yaw), look: 'dark', section: rect(w, h, 0), path: [P(0, 0, 0), P(0, 0, 1)], role: 'dress' })
