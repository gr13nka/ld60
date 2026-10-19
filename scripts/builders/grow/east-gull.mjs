// The gull's roof: the antenna on the highest roof, open sky. Behind the stop, on the block's top
// (22 m up, north of the start strip), a radio tower at eight times its size with its dishes, beside
// it a 300 m lattice needle; guys of cable come down to the roof, two loop antennas stand on it, and
// amber beacons burn at the tops. The strip the stop stands on is the roof's edge over the abyss.
import { bar, hung, mast } from './east-kit.mjs'
import { ring } from './blame-shapes.mjs'

const ROOF = 22 // the block's top, from the map round the stop

export function gullRoof(stop) {
  const forms = []
  const props = []
  const lights = []
  const lamps = []
  const at = { x: stop.x + 1.4, z: stop.z - 19.6 } // the tower: 20 m behind the start, clear of the glide's last approach
  const needle = { x: stop.x + 13.4, z: stop.z - 30.6 }
  const sunk = ROOF - 0.8

  props.push({ id: 'gull-tower', kind: 'radioTower', x: at.x, y: sunk, z: at.z, yaw: 0, scale: 7 })
  forms.push(...mast({ x: needle.x, z: needle.z, y0: sunk, y1: ROOF + 300, half0: 3.2, half1: 0.7, bays: 30, leg: 0.9, diag: 0.4, look: 'rust', diagLook: 'dim', ringEvery: 6 }))
  // The needle's top: a short boom with two arms, so that its tip is not a pin.
  const top = { x: needle.x, y: ROOF + 300, z: needle.z }
  // Each arm starts inside a leg of the lattice (0.75 m off the axis up here), so that it is fused to it.
  for (const [dx, dz, ex, ez] of [[-0.75, 0.75, -14, 0.75], [0.75, 0.75, 14, 0.75]]) forms.push(bar({ x: top.x + dx, y: top.y - 6, z: top.z + dz }, { x: top.x + ex, y: top.y - 6, z: top.z + ez }, 0.6, 'rust', 'support', 6))
  for (const [dx, dz, ex, ez] of [[0.75, -0.75, 0.75, -11], [0.75, 0.75, 0.75, 11]]) forms.push(bar({ x: top.x + dx, y: top.y - 18, z: top.z + dz }, { x: top.x + ex, y: top.y - 18, z: top.z + ez }, 0.6, 'rust', 'support', 6))
  forms.push(bar(top, { x: top.x, y: top.y + 22, z: top.z }, 0.25, 'dim', 'support', 6))
  // Guys: from the tower's waist and the needle's, down to the roof's corners.
  const waist = { x: at.x, y: ROOF + 112, z: at.z }
  const high = { x: needle.x, y: ROOF + 190, z: needle.z }
  const anchors = [[-12, -16], [18, -16], [-12, 8], [18, 8]]
  for (const [ax, az] of anchors) {
    const foot = { x: stop.x + ax, y: ROOF - 0.5, z: stop.z + az - 14 }
    forms.push(hung(waist, foot, 0.28, 3, 'dim'))
    forms.push(hung(high, { ...foot, x: foot.x + Math.sign(ax) * 3 }, 0.22, 6, 'dim'))
  }
  // Two loop antennas on the roof, turned differently.
  forms.push(ring({ x: stop.x - 9, y: ROOF + 12.5, z: stop.z - 31, R: 13, tube: 0.8, yaw: 0.5, look: 'brass', gap: 0.12 }))
  forms.push(ring({ x: stop.x + 4, y: ROOF + 9.5, z: stop.z - 28, R: 10, tube: 0.6, yaw: 1.9, look: 'rust', gap: 0.12 }))
  lights.push({ kind: 'point', x: top.x, y: top.y + 22, z: top.z, color: '#ffb35a', power: 400, reach: 160, head: { w: 1.2, h: 0.8, d: 1.2 } })
  lights.push({ kind: 'point', x: at.x, y: ROOF + 7 * 26 + 3, z: at.z, color: '#ffb35a', power: 300, reach: 120, head: { w: 1.2, h: 0.8, d: 1.2 } })
  lamps.push({ x0: top.x - 1, x1: top.x + 1, y0: top.y + 22, y1: top.y + 23, z0: top.z - 1, z1: top.z + 1 })
  return { forms, props, lights, lamps }
}
