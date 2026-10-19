// Steam as soft puffs: round sprites with a radial falloff, a few metres across, faint, drifting up
// and spreading, warm grey. All the place's vents draw as one instanced mesh (one call), however
// many blow. Fed a frame at a time by the vent's `source` (`CigaretteSmoke.emitSteam`), as the
// cigarette's streams are; a source not fed stops puffing and its puffs fade out. Look only.
import * as THREE from 'three'

const MAX = 360 // puffs alive at once, over every vent
const PUFFS = { every: 0.28, life: 5, rise: 2.4, alpha: 0.25, from: 0.7, to: 1.9 } // seconds, seconds, m/s, opacity, widths of `size` at birth and death
const WARM = new THREE.Color(0xcfc6b8)

const VERTEX = `
attribute vec3 aAt;
attribute vec2 aLook; // width in metres, opacity
varying vec2 vUv;
varying float vAlpha;
void main() {
  vUv = uv;
  vAlpha = aLook.y;
  vec4 mv = viewMatrix * vec4(aAt, 1.0);
  mv.xy += position.xy * aLook.x;
  gl_Position = projectionMatrix * mv;
}`
const FRAGMENT = `
uniform vec3 uColor;
varying vec2 vUv;
varying float vAlpha;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float soft = pow(clamp(1.0 - r, 0.0, 1.0), 1.6);
  gl_FragColor = vec4(uColor, soft * vAlpha);
}`

export class SteamPuffs {
  constructor(scene) {
    this.scene = scene
    const quad = new THREE.PlaneGeometry(1, 1)
    this.geometry = new THREE.InstancedBufferGeometry()
    this.geometry.index = quad.index
    this.geometry.setAttribute('position', quad.attributes.position)
    this.geometry.setAttribute('uv', quad.attributes.uv)
    this.at = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3).setUsage(THREE.DynamicDrawUsage)
    this.look = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2).setUsage(THREE.DynamicDrawUsage)
    this.geometry.setAttribute('aAt', this.at)
    this.geometry.setAttribute('aLook', this.look)
    this.geometry.instanceCount = 0
    this.mesh = new THREE.Mesh(this.geometry, new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms: { uColor: { value: WARM } }, transparent: true, depthWrite: false }))
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 5
    scene.add(this.mesh)
    this.puffs = []
    this.sources = new Map() // source → { at, size, due, fed }
  }

  /** Steam from `pos` this frame: `size` metres is about the width of a puff when it is born. */
  feed(pos, source, size) {
    let s = this.sources.get(source)
    if (!s) this.sources.set(source, (s = { at: new THREE.Vector3(), size: 1, due: 0, fed: false }))
    s.at.copy(pos)
    s.size = size
    s.fed = true
  }

  update(dt) {
    for (const [source, s] of this.sources) {
      if (!s.fed) {
        this.sources.delete(source)
        continue
      }
      s.fed = false
      s.due += dt
      while (s.due >= PUFFS.every) {
        s.due -= PUFFS.every
        if (this.puffs.length >= MAX) this.puffs.shift()
        const lift = THREE.MathUtils.clamp(Math.sqrt(s.size / 3), 1, 4)
        this.puffs.push({ x: s.at.x + (Math.random() - 0.5) * s.size * 0.3, y: s.at.y, z: s.at.z + (Math.random() - 0.5) * s.size * 0.3, vx: (Math.random() - 0.5) * 0.5, vz: (Math.random() - 0.5) * 0.5, rise: PUFFS.rise * lift, size: s.size, age: 0 })
      }
    }
    let n = 0
    for (const p of this.puffs) {
      p.age += dt
      if (p.age >= PUFFS.life) continue
      const t = p.age / PUFFS.life
      p.x += p.vx * dt
      p.z += p.vz * dt
      p.y += p.rise * (1 - t * 0.6) * dt
      this.puffs[n++] = p
      const k = n - 1
      this.at.setXYZ(k, p.x, p.y, p.z)
      // In over a tenth of its life, out over the rest.
      const fade = Math.min(t / 0.1, 1) * (1 - t) ** 1.2
      this.look.setXY(k, p.size * (PUFFS.from + (PUFFS.to - PUFFS.from) * Math.sqrt(t)), PUFFS.alpha * fade)
    }
    this.puffs.length = n
    this.geometry.instanceCount = n
    this.at.needsUpdate = this.look.needsUpdate = true
  }

  clear() {
    this.puffs.length = 0
    this.sources.clear()
    this.geometry.instanceCount = 0
  }
}
