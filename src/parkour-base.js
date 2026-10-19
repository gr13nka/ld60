// The shared scene and hollow-solid collision needed by a place. The old corridor world's
// terrain, targets and fire are deliberately outside this boundary.
import * as THREE from 'three'

const INDOOR_MARGIN = 1.5
export const NO_GOAL = { burnt: true, arrival: -1, name: '', pos: new THREE.Vector3() }
export class NoWoods { update() {} reset() {} dispose() {} }

function disposeGeometries(group) {
  group.traverse((object) => {
    object.geometry?.dispose()
    if (object.isInstancedMesh) object.dispose()
  })
  group.clear()
}

export class ParkourBase {
  constructor(scene) {
    this.scene = scene
    this._scenery = new THREE.Group()
    this._solids = []
    this._goalSolids = []
    this._gates = []
    this._debris = []
    scene.add(this._scenery)
  }

  unload() {
    disposeGeometries(this._scenery)
    this._solids = []
    this._goalSolids = []
    this._gates = []
    this._debris = []
  }

  _boxAt(pos, margin = 0) {
    const inset = Math.min(margin, INDOOR_MARGIN)
    return this._solids.find((solid) =>
      Math.abs(pos.x - solid.x) < solid.halfWidth + margin &&
      Math.abs(pos.z - solid.z) < solid.halfDepth + margin &&
      pos.y > solid.bottom - margin && pos.y < solid.top + margin &&
      !solid.voids?.some((room) =>
        pos.x > room.x0 + inset && pos.x < room.x1 - inset &&
        pos.y > room.y0 + inset && pos.y < room.y1 - inset &&
        pos.z > room.z0 + inset && pos.z < room.z1 - inset))
  }

  hitsSolid(pos, margin = 0) { return !!this._boxAt(pos, margin) }

  pushOutOfSolids(point, radius, normal) {
    const box = this._boxAt(point, radius)
    if (!box) return false
    const dx = point.x - box.x
    const dz = point.z - box.z
    if (box.voids && Math.abs(dx) < box.halfWidth && Math.abs(dz) < box.halfDepth && point.y < box.top) {
      const inset = Math.min(radius, INDOOR_MARGIN)
      let nearest = Infinity
      for (const room of box.voids) {
        const x = THREE.MathUtils.clamp(point.x, room.x0 + inset, room.x1 - inset)
        const y = THREE.MathUtils.clamp(point.y, room.y0 + inset, room.y1 - inset)
        const z = THREE.MathUtils.clamp(point.z, room.z0 + inset, room.z1 - inset)
        const away = Math.hypot(x - point.x, y - point.y, z - point.z)
        if (away >= nearest) continue
        nearest = away
        normal.set(x - point.x, y - point.y, z - point.z)
      }
      point.add(normal)
      normal.normalize()
      return true
    }
    const toSide = box.halfWidth + radius - Math.abs(dx)
    const toEnd = box.halfDepth + radius - Math.abs(dz)
    const toTop = box.top + radius - point.y
    if (toTop <= toSide && toTop <= toEnd) {
      point.y = box.top + radius
      normal.set(0, 1, 0)
    } else if (toSide <= toEnd) {
      const side = dx < 0 ? -1 : 1
      point.x = box.x + side * (box.halfWidth + radius)
      normal.set(side, 0, 0)
    } else {
      const end = dz < 0 ? -1 : 1
      point.z = box.z + end * (box.halfDepth + radius)
      normal.set(0, 0, end)
    }
    return true
  }

  _presentDebris(dt) {
    for (const debris of this._debris) debris.present(dt)
    this._debris = this._debris.filter((debris) => !debris.done)
  }
}
