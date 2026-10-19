// Quitters has one authored place. Its boxes, forms, assets, finds and courier spots live
// together in builders.json so the route can change without changing the dialogue script.
import builders from './places/builders.json'
import { checkPlace, completePlace } from './place-file.js'
import { checkInstance } from './assets.js'
import { MISTS, THEMES } from './themes.js'
import { FINDS } from './finds.js'

export const FIRST_PLACE = 'builders'
export const KNOWN = { themes: THEMES, mists: MISTS, instance: checkInstance, finds: FINDS }
export const placeNames = () => [FIRST_PLACE]

export function loadPlace(name = FIRST_PLACE) {
  if (!placeNames().includes(name)) throw new Error(`there is no place "${name}"`)
  const place = structuredClone(builders)
  checkPlace(place, name, KNOWN)
  return { place: completePlace(place), file: FIRST_PLACE }
}
