// The stops layer of the generator (grow.mjs has the contract): one set piece at each story stop,
// built for the story told there. Two halves, written apart: the gull's roof, the raven's sorting
// hall, Gavrilov's grate and the Табачная (stops-east.mjs); Tamara's window, the raccoon's junkyard
// and the pipe man's mains (stops-west.mjs).
import { stopsEast } from './stops-east.mjs'
import { stopsWest } from './stops-west.mjs'

export function growStops(ctx, pads, blame) {
  const east = stopsEast(ctx, pads, blame)
  const west = stopsWest(ctx, pads, blame)
  const add = {}
  for (const part of [east.add, west.add]) for (const [list, records] of Object.entries(part ?? {})) (add[list] ??= []).push(...records)
  return { add, drop: [...(east.drop ?? []), ...(west.drop ?? [])] }
}
