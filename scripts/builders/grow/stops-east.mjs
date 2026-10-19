// Set pieces at the east stops (grow-stops.mjs): the gull's antenna roof, the raven's sorting hall,
// Gavrilov's grated stair and the cold boiler hall of the Табачная. Each is built from the stop's
// own position (the order's heights change); every
// record that would meet a clear zone is left out, and the rest stand by gravity (support.mjs).
import { gullRoof } from './east-gull.mjs'
import { sortingHall } from './east-voron.mjs'
import { gavrilovStair } from './east-gavrilov.mjs'
import { boilerHall } from './east-tabachnaya.mjs'

export function stopsEast(ctx, pads, blame) {
  const stop = (id) => ctx.order.stops.find((s) => s.id === id)
  const add = { forms: [], props: [], lights: [], lamps: [] }
  const stats = {}
  // Whether a record stands clear of every zone; the dropped are counted by piece.
  const lay = (piece, list, records) => {
    for (const r of records ?? []) {
      if (ctx.clearOf(list, r)) add[list].push(r)
      else stats[piece] = (stats[piece] ?? 0) + 1
    }
  }

  const gull = stop('gull')
  if (gull) {
    const g = gullRoof(gull)
    lay('gull', 'forms', g.forms)
    lay('gull', 'props', g.props)
    add.lights.push(...g.lights)
    add.lamps.push(...g.lamps)
  }

  const voron = stop('voron')
  if (voron) {
    const h = sortingHall(voron)
    lay('voron', 'forms', h.forms)
    add.lights.push(...h.lights)
    add.lamps.push(...h.lamps)
  }

  const gav = stop('gavrilov')
  if (gav) {
    const g = gavrilovStair(gav, ctx.rng)
    lay('gavrilov', 'forms', g.forms)
    lay('gavrilov', 'forms', g.columns)
  }

  const tab = stop('tabachnaya')
  if (tab) {
    const hall = boilerHall(tab)
    lay('tabachnaya', 'forms', hall.forms)
    add.lights.push(...hall.lights)
  }

  console.error('stops-east:', JSON.stringify({ forms: add.forms.length, props: add.props.length, droppedByZone: stats }))
  return { add }
}
