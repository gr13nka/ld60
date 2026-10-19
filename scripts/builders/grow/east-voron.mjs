// The Сортировочная: the aisle between two of the blame layer's towers, its faces covered with
// pigeonholes (cells 4.5 m square, two walls of a thousand), a lone booth on a balcony at its
// mouth, chutes from the booth to the cells. A sorting office for a city of giants.
import { cellWall, beam } from './east-kit.mjs'
import { prism } from '../../../src/forms.js'
import { doorFrame, doorLeaf } from './blame-shapes.mjs'

const CELL = 4.5

export function sortingHall(stop) {
  const forms = []
  const lamps = []
  const lights = []
  const y0 = stop.y - 118 // the cells run from here up 135 m: the aisle's legs cross them midway
  const top = y0 + 30 * CELL + 3
  // The aisle's two towers, each rooted in the mist; the aisle between them is 55 m wide, the run's line down its middle.
  const east = { x: stop.x + 20, z0: stop.z + 10, z1: stop.z + 215 }
  const west = { x: stop.x - 35, z0: stop.z + 80, z1: stop.z + 215 }
  forms.push({ ...prism([[east.x, east.z0], [east.x + 90, east.z0], [east.x + 90, east.z1], [east.x, east.z1]], -884, top, 'concrete'), bevel: { size: 0.8, segments: 1 }, role: 'mass' })
  forms.push({ ...prism([[west.x - 110, west.z0], [west.x, west.z0], [west.x, west.z1], [west.x - 110, west.z1]], -884, top, 'concrete'), bevel: { size: 0.8, segments: 1 }, role: 'mass' })
  forms.push(...cellWall({ o: { x: east.x + 3, z: east.z0 + 3 }, t: { x: 0, z: 1 }, f: { x: -1, z: 0 }, y0, cell: CELL, nx: Math.floor((east.z1 - east.z0 - 8) / CELL), ny: 30, depth: 6, look: 'dim' }))
  forms.push(...cellWall({ o: { x: west.x - 3, z: west.z0 + 3 }, t: { x: 0, z: 1 }, f: { x: 1, z: 0 }, y0, cell: CELL, nx: Math.floor((west.z1 - west.z0 - 8) / CELL), ny: 30, depth: 6, look: 'concrete' }))
  // The booth: a balcony on the west tower's north face, a cabin on it with a window and a lamp.
  const b = { x: west.x - 55, z: west.z0 + 1, y: stop.y - 8 }
  forms.push({ ...prism([[b.x - 12, b.z], [b.x + 12, b.z], [b.x + 12, b.z - 18], [b.x - 12, b.z - 18]], b.y - 3, b.y, 'steel'), role: 'mass' })
  forms.push({ ...prism([[b.x - 9, b.z - 1], [b.x + 9, b.z - 1], [b.x + 9, b.z - 13], [b.x - 9, b.z - 13]], b.y, b.y + 12, 'rust'), role: 'mass' })
  forms.push({ ...prism([[b.x - 10.5, b.z - 0.5], [b.x + 10.5, b.z - 0.5], [b.x + 10.5, b.z - 14.5], [b.x - 10.5, b.z - 14.5]], b.y + 12, b.y + 13.5, 'dark'), role: 'mass' })
  forms.push(doorFrame({ x: b.x, y: b.y + 4, z: b.z - 13, w: 12, h: 5, deep: 1.6, yaw: Math.PI, look: 'brass' }))
  forms.push(doorLeaf({ x: b.x, y: b.y + 4, z: b.z - 12.6, w: 12, h: 5, yaw: Math.PI }))
  lamps.push({ x0: b.x - 1, x1: b.x + 1, y0: b.y + 13.5, y1: b.y + 14.3, z0: b.z - 8, z1: b.z - 6 })
  lights.push({ kind: 'point', x: b.x, y: b.y + 9, z: b.z - 16, color: '#ffb35a', power: 260, reach: 90, head: { w: 1.4, h: 0.8, d: 1.4 } })
  // Chutes: square trunks from under the booth's balcony down into the cells of the east wall.
  for (const [k, dz] of [[0, 30], [1, 60], [2, 90]]) {
    forms.push(beam({ x: b.x + 6 + k * 3, y: b.y - 3, z: b.z - 4 }, { x: east.x - 8, y: b.y - 40 - k * 14, z: east.z0 + dz }, 3, 3, 'rust', 'service'))
  }
  return { forms, lamps, lights }
}
