// How far the eye may go from a point the body keeps clear toward where it is asked to be,
// before what is drawn nearest it would be inside something solid: a third-person camera's
// spring arm, swept with a ball as theirs is, here over the few centimetres to a metre that a
// first-person eye is put off its body (over his head, ahead of the last step, a jolt). Pure.

import { Vector3 } from 'three'

const MOST_PUSHES = 3 // a point in a corner may be put out of one solid into the next
const FINER = 5 // halvings of the step that met something: a thirty-second of it

const _at = new Vector3()
const _normal = new Vector3()

/**
 * How far along the straight way from `from` to `to` a ball of `radius` goes before it meets
 * anything, 0 to 1 (1: all the way). `from` is first put out of what it is in or within
 * `radius` of, in place: a glider is a point to a box, and may be brushing one.
 * `pushOut(point, radius, normal)` is a world's (`World.eyeOutOfSolids`): it moves `point` out
 * of a solid it is within `radius` of and says whether it did.
 */
export function clearAlong(pushOut, from, to, radius) {
  for (let i = 0; i < MOST_PUSHES && pushOut(from, radius, _normal); i++);
  const length = from.distanceTo(to)
  if (length < 1e-6) return 1
  // Balls half their radius apart overlap, so no wall is stepped over between two of them.
  const steps = Math.ceil(length / (radius * 0.5))
  const meets = (t) => pushOut(_at.lerpVectors(from, to, t), radius, _normal)
  let clear = 0
  for (let i = 1; i <= steps; i++) {
    let met = i / steps
    if (!meets(met)) {
      clear = met
      continue
    }
    for (let j = 0; j < FINER; j++) {
      const half = (clear + met) / 2
      if (meets(half)) met = half
      else clear = half
    }
    return clear
  }
  return 1
}
