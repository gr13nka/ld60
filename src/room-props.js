// What stands in the place besides its forms (`props` in the place file): the watchman's booth, a
// chair, and the gorge's machines. Each kind is one entry of `PROPS`: `build(record)`
// makes it in its own frame, facing +Z with its origin where it stands, and returns `{ group,
// ...parts }`; `solid`, `[w, h, d]` if it is met, the box a body meets; `traits`, what the place
// asks of it: `vents` and `hums` of the machines (`machine-props.js`), `watch` of a person.
// Every size and colour is a first guess. Look only.

import * as THREE from 'three'
import { box } from './models.js'
import { baked, plain } from './npc-kit.js'
import { MACHINES } from './machine-props.js'
import { BOOTH } from './booth.js'

// Text written on a brush's canvas, `size` texels tall, centred at (u, v).
export function write(b, text, u, v, size, color, weight = 'bold') {
  const c = b.context
  c.fillStyle = color
  c.font = `${weight} ${size}px monospace`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(text, u * b.width, (1 - v) * b.height)
}

// --- An old wooden kitchen chair, the paint worn off its seat, a rail of its back gone ---

function chair() {
  const group = new THREE.Group()
  const parts = new THREE.Group()
  const wood = plain(0x6a4a30)
  const worn = plain(0x8a6844)
  for (const x of [-0.19, 0.19]) {
    for (const z of [-0.18, 0.18]) parts.add(box(0.035, 0.45, 0.035, wood, x, 0.225, z)) // the legs
    parts.add(box(0.035, 0.5, 0.035, wood, x, 0.7, -0.18)) // the back's uprights, on from the back legs
    parts.add(box(0.025, 0.025, 0.36, wood, x, 0.14, 0)) // a rung between each side's legs
  }
  parts.add(box(0.44, 0.035, 0.42, worn, 0, 0.465, 0)) // the seat, rubbed pale
  parts.add(box(0.4, 0.07, 0.025, wood, 0, 0.9, -0.18)) // the top rail
  const fallen = box(0.4, 0.04, 0.02, wood, 0, 0.7, -0.18) // the rail below it, hanging off one end
  fallen.rotation.z = -0.35
  fallen.position.x = 0.05
  parts.add(fallen)
  group.add(baked(parts))
  return { group }
}

/**
 * Every kind of prop, by its name in a record's `kind`: `build(record)`, `solid` (`[w, h, d]`,
 * standing on the record's point, centred on it level) and `traits` (see above).
 */
export const PROPS = {
  ...BOOTH, // Ворон's watchman's booth
  chair: { build: chair, solid: [0.45, 0.48, 0.45], traits: {} },
  ...MACHINES, // the gorge's clocks, boilers, engines, gears, pipes, masts and horns
}
