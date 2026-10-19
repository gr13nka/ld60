// Small smoke, ash and lighter sparks shared by the courier and the people he meets. The smoke
// is the filament sheets of `cigarette-smoke.js`; ash and sparks are points, a centimetre or
// two across and round, since a square a hand's width wide filled the view near the eye.
import * as THREE from 'three'
import { CigaretteSmoke } from './cigarette-smoke.js'

const LIMIT = 240
const POINT_SIZE = 0.015 // metres: between a fleck of ash and a spark
const ash = new THREE.Color(0x585653)
const spark = new THREE.Color(0xffb34d)

// A soft round dot, for points that would otherwise be drawn square.
function roundDot() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const context = canvas.getContext('2d')
  const fill = context.createRadialGradient(16, 16, 0, 16, 16, 16)
  fill.addColorStop(0, 'rgba(255,255,255,1)')
  fill.addColorStop(0.5, 'rgba(255,255,255,0.8)')
  fill.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = fill
  context.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(canvas)
}

export class Effects {
  constructor(scene, camera) {
    this.particles = []
    this.smoke = new CigaretteSmoke(scene, camera)
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LIMIT * 3), 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(LIMIT * 3), 3))
    this.points = new THREE.Points(this.geometry, new THREE.PointsMaterial({ size: POINT_SIZE, map: roundDot(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true }))
    this.points.frustumCulled = false
    this.points.geometry.setDrawRange(0, 0)
    scene.add(this.points)
  }

  _emit(pos, vel, color, life, drift = 0.4) {
    if (this.particles.length >= LIMIT) this.particles.shift()
    this.particles.push({
      pos: pos.clone(), vel: vel.clone().multiplyScalar(0.08).add(new THREE.Vector3((Math.random() - 0.5) * drift, 0.3 + Math.random() * drift, (Math.random() - 0.5) * drift)),
      color, life, age: 0,
    })
  }

  cigaretteAsh(pos, vel, scale = 1) {
    this._emit(pos, vel, ash, 0.7 * scale, 0.2)
  }

  ribbon(pos, vel, source = null, moving = false) {
    this.smoke.emitEmber(pos, vel, source, moving)
  }

  flecks(pos, vel, count) {
    for (let i = 0; i < count; i++) this._emit(pos, vel, spark, 0.25 + Math.random() * 0.3, 2)
  }

  exhale(pos, dir, vel, size = 1, source = null) {
    this.smoke.emitBreath(pos, dir, vel, size, source)
  }

  smokeRing(pos, dir, vel) {
    this.smoke.ring(pos, dir, vel)
  }

  update(dt) {
    this.smoke.update(dt)
    this.particles = this.particles.filter((p) => (p.age += dt) < p.life)
    const positions = this.geometry.attributes.position
    const colors = this.geometry.attributes.color
    this.particles.forEach((p, i) => {
      p.pos.addScaledVector(p.vel, dt)
      positions.setXYZ(i, p.pos.x, p.pos.y, p.pos.z)
      const fade = 1 - p.age / p.life
      colors.setXYZ(i, p.color.r * fade, p.color.g * fade, p.color.b * fade)
    })
    positions.needsUpdate = true
    colors.needsUpdate = true
    this.geometry.setDrawRange(0, this.particles.length)
  }
}
