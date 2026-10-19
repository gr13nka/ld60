// A ramp to surf: a ridge with a face falling away either side of it, as a tent stands. A
// ramp is its triangles (`faces.js`), and the same triangles are what is drawn
// (`parkour-world.js`) and what a body meets, so that the two cannot come apart. Each face
// is turned to face out and up, whichever way its corners were given.
// Pure: no scene.

import { Vector3 } from 'three'
import { triangle as face } from './faces.js'

// One triangle of a ramp, the normal of the side that faces out and up, and which stretch of
// the ridge it belongs to (-1 for an end).
function triangle(a, b, c, stretch) {
  const made = face(a, b, c, -1, stretch)
  if (made.normal.y < 0) made.normal.negate()
  made.stretch = stretch
  return made
}

/**
 * The triangles of `ramp`: `{ ridge, reach, drop }`, where `ridge` is its top edge as points
 * (`{ x, y, z }`, two at least, going on along +Z or near it), and each face goes `reach`
 * metres out from it level and `drop` metres down. A bend is more points: the faces are
 * mitred where two stretches meet, so it has no cracks. Both ends are closed.
 * Each triangle is `{ a, b, c, normal, stretch, min, max }`; `stretch` counts along the ridge.
 */
export function facesOf({ ridge, reach, drop }) {
  const tops = ridge.map(({ x, y, z }) => new Vector3(x, y, z))
  // Level and to the left of the way at each point (looking down +Z, +X is on the left),
  // as long as it takes to keep both stretches there `reach` wide.
  const lefts = tops.map((top, i) => {
    const before = i > 0 ? leftOf(tops[i - 1], top) : null
    const after = i < tops.length - 1 ? leftOf(top, tops[i + 1]) : null
    const mitre = new Vector3().addVectors(before ?? after, after ?? before).normalize()
    return mitre.multiplyScalar(reach / mitre.dot(before ?? after))
  })
  const foot = (i, side) => tops[i].clone().addScaledVector(lefts[i], side).setY(tops[i].y - drop)
  const faces = []
  for (let i = 0; i < tops.length - 1; i++) {
    for (const side of [1, -1]) {
      faces.push(triangle(tops[i], tops[i + 1], foot(i + 1, side), i), triangle(tops[i], foot(i + 1, side), foot(i, side), i))
    }
  }
  const last = tops.length - 1
  faces.push(triangle(foot(0, 1), tops[0], foot(0, -1), -1), triangle(foot(last, 1), tops[last], foot(last, -1), -1))
  return faces
}

function leftOf(from, to) {
  return new Vector3(to.z - from.z, 0, from.x - to.x).normalize()
}
