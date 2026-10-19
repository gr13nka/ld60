// A place's `cuts`: sweeps that are not solid but taken out of the forms they pass through, a
// door through a wall, a well down a slab. A cut is a sweep's record (`forms.js`: `at`, `yaw`,
// `scale`, `section`, `path`, `bevel`; its `kind` is a sweep's whether said or not) and `of`, the
// ids of the forms it takes from, or, without `of`, every form its bounds overlap. It stays a
// record of its own, so a hole goes where its cut is moved; what is met and what is seen of a
// form are both the triangles left (`ParkourWorld`), so the two cannot come apart. The cutting
// is three-bvh-csg's, over a form's triangles as `buildForm` lays them in the world.
// Pure: no scene.

import { BufferAttribute, BufferGeometry, Box3, MeshBasicMaterial, Vector3 } from 'three'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { buildForm } from './forms.js'
import { triangle } from './faces.js'

const CUT_STRIPS = 4e6 // a triangle of a cut's own wall is a strip of its own from here on, so nothing is shaded across it
const _bounds = new WeakMap() // a record → `{ sign, box }`: its bounds, while its record reads as it did
const _paint = new MeshBasicMaterial() // the brushes', never drawn
let _evaluator = null
let _warned = false

/** A cut's record as `buildForm` takes it: a closed sweep, met by nothing, its own id none. */
export const asCutter = (cut) => ({ ...cut, kind: 'sweep', id: -1, open: false, smooth: false })

/** The box round `cut` in the world, kept while its record is as it was. */
export const cutBounds = (cut) => boundsOf(cut, () => asCutter(cut))

/** The box round `form` in the world, uncut, kept while its record is as it was. */
export const formBounds = (form) => boundsOf(form, () => form)

function boundsOf(record, built) {
  const sign = JSON.stringify(record)
  const kept = _bounds.get(record)
  if (kept?.sign === sign) return kept.box
  const box = new Box3().setFromArray(buildForm(built()).positions)
  _bounds.set(record, { sign, box })
  return box
}

/**
 * The cuts of `cuts` that take from `form`: those whose `of` names its id, and those with no `of`
 * whose bounds overlap its own (`bounds`, the uncut form's box, when it is to hand). None at all,
 * and nothing is measured, when the place has no cuts.
 */
export function cuttersFor(form, cuts, bounds = null) {
  if (!cuts?.length) return []
  let box = bounds
  return cuts.filter((cut) => {
    if (Array.isArray(cut.of)) return cut.of.includes(form.id)
    box ??= formBounds(form)
    return cutBounds(cut).intersectsBox(box)
  })
}

/**
 * `built` (`buildForm`'s `{ faces, positions, normals }`, in the world) less each of `cutters`
 * (cut records), in the same shape: its faces the form's `id`, what is left of its own surface
 * shaded as it was, and the walls the cuts leave flat, each triangle of them a strip of its own.
 * If the cutting fails the form is given back whole, and that is said once.
 */
export function cutForm(built, cutters) {
  if (!cutters.length || !built.faces.length) return built
  const id = built.faces[0].id
  try {
    _evaluator ??= Object.assign(new Evaluator(), { attributes: ['position', 'normal', 'strip'], useGroups: false })
    let result = brushOf(built.positions, built.normals, built.faces.map((face) => face.strip))
    for (const cutter of cutters) {
      const cut = buildForm(asCutter(cutter))
      if (!cut.faces.length) continue
      result = _evaluator.evaluate(result, brushOf(cut.positions, cut.normals, null), SUBTRACTION)
    }
    return fromGeometry(result.geometry, id)
  } catch (error) {
    if (!_warned) console.warn('A cut could not be made, and the form is left whole:', error)
    _warned = true
    return built
  }
}

// Triangles laid end to end as a brush: `strips` each triangle's strip, or none (-1) for a cutter's.
function brushOf(positions, normals, strips) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
  const corners = positions.length / 3
  const strip = new Float32Array(corners).fill(-1)
  if (strips) for (let i = 0; i < corners; i++) strip[i] = strips[Math.floor(i / 3)]
  geometry.setAttribute('strip', new BufferAttribute(strip, 1))
  const brush = new Brush(geometry, _paint)
  brush.updateMatrixWorld()
  return brush
}

// What the cutting left, as `buildForm` gives a form: a triangle of the form's own surface keeps
// its strip and the normals it had there; one of a cut's wall is flat.
function fromGeometry(geometry, id) {
  const position = geometry.attributes.position
  const normal = geometry.attributes.normal
  const strip = geometry.attributes.strip
  const index = geometry.index
  const count = index ? index.count : position.count
  const corner = (i) => (index ? index.getX(i) : i)
  const faces = []
  const normalsOf = []
  for (let i = 0; i < count; i += 3) {
    const [p, q, r] = [corner(i), corner(i + 1), corner(i + 2)]
    const at = (k) => new Vector3().fromBufferAttribute(position, k)
    const own = strip.getX(p) >= 0
    const face = triangle(at(p), at(q), at(r), id, own ? Math.round(strip.getX(p)) : CUT_STRIPS + faces.length)
    if (!face) continue
    faces.push(face)
    normalsOf.push(own ? [p, q, r].map((k) => new Vector3().fromBufferAttribute(normal, k).normalize()) : [face.normal, face.normal, face.normal])
  }
  const positions = new Float32Array(faces.length * 9)
  const normals = new Float32Array(faces.length * 9)
  faces.forEach((face, i) => {
    ;[face.a, face.b, face.c].forEach((p, k) => {
      p.toArray(positions, i * 9 + k * 3)
      normalsOf[i][k].toArray(normals, i * 9 + k * 3)
    })
  })
  return { faces, positions, normals }
}
