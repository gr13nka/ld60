// The Palace of Culture (`places/palace.json`, `?parkour=palace`; the hive until 2026-10-13) seen
// from outside, a landmark far off: what can be seen of it from beyond its wall and none of what
// is inside. It reads the palace's own file, so whatever the editor tunes there is here too.
// Kept is every form with a corner past the wall's outer face, which stands upright at `SKIN`
// from foot to top (palace.mjs's `wallBand` runs every band out to it): the wall's bands whole,
// their inside faces with them, the mountain, the breach's lip, columns and rubble, the cutting.
// Left out are the pylon, the fan, the bridges, the dirigible, the houses over the bowl and the
// rooms, which go 38 m into a wall 40 thick and stop short of its face. The towers on the flank and
// the giants over its crest (`boxes`, look `far`) are kept by the same rule and made sharp blocks,
// since an asset has no boxes; the murals hang inside, and lamps and signs stay with the place.
// Its frame: the void's axis at x = z = 0, the ground at y = 0 where the mountain's flank meets it
// 700 m out, turned so that the breach (the palace's +X) is the front. Whole, it is 1,400 m across
// and 1,700 high; the balcony stands it at 0.3 of that, in the Spire's place (2026-10-18).
// Pure: no scene.

import PALACE from './places/palace.json' with { type: 'json' }
import { kit, p, placeRecords, result, withDefaults } from './asset-kit.js'
import { buildForm } from './forms.js'

/** Its parameters as it is built when given none (`assets.js` hands them to the editor). Metres unless said. */
export const DEFAULTS = {
  city: true, // the towers on the mountain's flank and the giants over its crest
  sink: 0,
}

const SKIN = 280 // the wall's outer face (palace.mjs's `SKIN`)
const OUTSIDE = SKIN - 0.5 // a corner further from the axis than this is seen from outside
const FOOT = 700 // where the mountain's flank meets the ground (palace.mjs's `MOUNTAIN.foot`)
const UNDER = -40 // the mountain's underside
const BREACH_TO_FRONT = -Math.PI / 2 // the yaw that turns the palace's +X, where the breach is, to +Z

// The palace's forms and boxes that are seen from outside, picked on the first build and kept:
// every form's triangles are made to look, which is too slow to do again for each instance.
let outside = null
function seenFromOutside() {
  if (outside) return outside
  const out = (x, z) => Math.hypot(x, z) > OUTSIDE
  const forms = PALACE.forms
    .filter((form) => {
      const { positions } = buildForm(form)
      for (let i = 0; i < positions.length; i += 3) if (out(positions[i], positions[i + 2])) return true
      return false
    })
    .map(({ id, ...form }) => form) // the place gives each form its own id
  const boxes = PALACE.boxes.filter((b) => out(b.x0, b.z0) || out(b.x0, b.z1) || out(b.x1, b.z0) || out(b.x1, b.z1))
  outside = { forms, boxes }
  return outside
}

export function palace(given) {
  const { city, sink } = withDefaults(DEFAULTS, given)
  const { forms, boxes } = seenFromOutside()
  const k = kit(sink)
  for (const form of structuredClone(forms)) k.form(form)
  if (city) for (const b of boxes) k.block(b.x0, b.x1, b.y0, b.y1, b.z0, b.z1, 'concrete')
  if (sink > 0) k.form({ kind: 'lathe', at: p(0, 0, 0), look: 'earth', sides: 72, profile: [[0, UNDER - sink], [FOOT, UNDER - sink], [FOOT, UNDER], [0, UNDER]] })
  return placeRecords(result(k), { at: p(0, 0, 0), yaw: BREACH_TO_FRONT })
}
