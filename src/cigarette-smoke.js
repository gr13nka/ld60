// Smoke from a burning cigarette and from a smoker's mouth. A parcel is released into world
// space once; its source never moves it again. Both kinds are drawn with the same soft density
// sheet, while their initial momentum and width make a sidestream and an exhaled jet distinct.

import * as THREE from 'three'
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js'

const PROFILES = {
  ember: { capacity: 136, interval: 1 / 30, life: 3, drag: 6, rise: 0.07, startRise: 0.018, push: 0 },
  breath: { capacity: 96, interval: 1 / 75, life: 1.35, drag: 1.7, rise: 0.05, startRise: 0.008, push: 0.8 },
}
const IDLE_EMBER = { rise: 0.05, startRise: 0.012, drift: 0.003, air: 0.55, radius: [0.005, 0.025], life: 4 }
const RING_POINTS = 36
const RING_LIFE = 2
const LINK_REACH = 1.5 // only a teleport leaves separate smoke behind
const SMOKE_THINS_AT = [0.6, 3] // tip speed in m/s: a quick move lays down less visible smoke
const STEP = 1 / 60
const MAX_STEPS = 4
const EMBER_AIR_ONSET = [0.18, 1.35] // seconds: still thread first, then room air takes it
const MOVING_EMBER_AIR_ONSET = [0.22, 1.25]
const BREATH_AIR_ONSET = [0.08, 0.65]
const DILUTION_POWER = 0.5 // soften geometric dilution so thin smoke survives the low-resolution picture
const _noise = new ImprovedNoise()
const _flow = new THREE.Vector3()
const _from = new THREE.Vector3()
const _across = new THREE.Vector3()
const _toEye = new THREE.Vector3()
const _tangent = new THREE.Vector3()
const _cameraRight = new THREE.Vector3()
const _cameraForward = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _ringUp = new THREE.Vector3()
const _ringAcross = new THREE.Vector3()
const _radial = new THREE.Vector3()
const rand = (low, high) => low + Math.random() * (high - low)

// A numerical curl of two scales of three-dimensional vector-potential noise. This makes
// nearby parcels take a common turn without a sink, a repeated sine-wave path or fixed spokes.
function airAt(pos, time, out) {
  const h = 0.025
  out.set(0, 0, 0)
  for (const [scale, strength, drift] of [[2.1, 0.018, 0.19], [5.7, 0.0045, -0.28], [13, 0.002, 0.37]]) {
    const x = pos.x * scale, y = pos.y * scale, z = pos.z * scale + time * drift
    const d = h * scale
    const a = (component, px, py, pz) => {
      const offset = component * 41.37
      return _noise.noise(px + offset, py + offset * 0.71, pz - offset * 0.43)
    }
    const curlX = (a(2, x, y + d, z) - a(2, x, y - d, z)
      - a(1, x, y, z + d) + a(1, x, y, z - d)) / (2 * h)
    const curlY = (a(0, x, y, z + d) - a(0, x, y, z - d)
      - a(2, x + d, y, z) + a(2, x - d, y, z)) / (2 * h)
    const curlZ = (a(1, x + d, y, z) - a(1, x - d, y, z)
      - a(0, x, y + d, z) + a(0, x, y - d, z)) / (2 * h)
    out.x += curlX * strength
    out.y += curlY * strength
    out.z += curlZ * strength
  }
  return out
}

// Density varies across and along a connected sheet. The narrow central filaments and frayed
// edges are parts of one flow, rather than separate circular sprites or three fixed ribbons.
const MATERIAL = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  vertexShader: /* glsl */ `
    attribute vec3 smoke;
    varying vec2 vUv;
    varying float vAge;
    varying float vDensity;
    varying float vSeed;
    void main() {
      vUv = uv;
      vAge = smoke.x;
      vDensity = smoke.y;
      vSeed = smoke.z;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    varying float vAge;
    varying float vDensity;
    varying float vSeed;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = smoothstep(0.0, 1.0, fract(p));
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    void main() {
      // The pattern uses the parcels' emission order, so each curl travels with the smoke.
      // Age changes its strength, never the noise coordinates: the texture does not boil.
      float along = vUv.y * 0.52 + vSeed;
      float across = vUv.x * 2.0 - 1.0;
      float breakup = smoothstep(0.08, 0.68, vAge);
      vec2 flow = vec2(across * 1.45, along);
      float sway = noise(vec2(along * 0.74, vSeed * 1.91)) - 0.5;
      flow.x += sway * 0.9 * breakup;
      float roll = noise(flow * vec2(1.7, 1.15) + vec2(7.3, 2.1));
      flow += vec2((roll - 0.5) * 0.75,
                   (noise(flow * vec2(2.2, 1.8) + vec2(19.1, 5.7)) - 0.5) * 0.35) * breakup;
      float fold = noise(flow * vec2(2.0, 1.8));
      float detail = noise(flow * vec2(6.5, 4.0) + vec2(4.1, 8.3));
      float edge = abs(across + (roll - 0.5) * 0.25 * breakup);
      float body = 1.0 - smoothstep(0.28, 1.0, edge + (detail - 0.5) * 0.25 * breakup);
      float ridge = 1.0 - smoothstep(0.045, 0.19, abs(fold - 0.52));
      float filament = mix(0.85, 0.28 + 0.55 * fold + 0.60 * ridge + 0.15 * detail, breakup);
      float fade = 1.0 - smoothstep(0.55, 0.96, vAge);
      float density = vDensity * body * filament * fade;
      float alpha = 1.0 - exp(-1.4 * density);
      vec3 color = mix(vec3(0.48, 0.54, 0.60), vec3(0.58, 0.68, 0.78), ridge * breakup * 0.55);
      gl_FragColor = vec4(color, alpha);
    }
  `,
})

function radiusAt(kind, age, life, size, still = false) {
  const t = Math.min(1, age / life)
  const radius = kind === 'breath'
    ? 0.012 + 0.12 * THREE.MathUtils.smoothstep(age, 0, 0.75)
    : kind === 'ring' ? 0.012 + 0.016 * t
      : still ? IDLE_EMBER.radius[0] + IDLE_EMBER.radius[1] * t : 0.0045 + 0.036 * t
  return radius * size
}

class SmokeSheet {
  constructor(scene, capacity, kind) {
    this.kind = kind
    const rows = capacity + 1
    this.positions = new THREE.BufferAttribute(new Float32Array(rows * 2 * 3), 3)
    this.uv = new THREE.BufferAttribute(new Float32Array(rows * 2 * 2), 2)
    this.smoke = new THREE.BufferAttribute(new Float32Array(rows * 2 * 3), 3)
    this.indices = new THREE.BufferAttribute(new Uint16Array(rows * 6), 1)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', this.positions)
    geometry.setAttribute('uv', this.uv)
    geometry.setAttribute('smoke', this.smoke)
    geometry.setIndex(this.indices)
    geometry.setDrawRange(0, 0)
    this.mesh = new THREE.Mesh(geometry, MATERIAL)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 800 // world first, then smoke, then the hands' own late draw
    scene.add(this.mesh)
  }

  draw(points, camera, closed = false) {
    const count = points.length
    if (count < 2) {
      this.mesh.geometry.setDrawRange(0, 0)
      return
    }
    const position = this.positions.array
    const uv = this.uv.array
    const smoke = this.smoke.array
    camera.getWorldPosition(_from)
    camera.getWorldDirection(_cameraForward)
    _cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion)
    for (let i = 0; i < count; i++) {
      const p = points[i]
      const prev = points[closed ? (i + count - 1) % count : Math.max(0, i - 1)]
      const next = points[closed ? (i + 1) % count : Math.min(count - 1, i + 1)]
      _tangent.subVectors(next.pos, prev.pos)
      _toEye.subVectors(_from, p.pos)
      _across.crossVectors(_tangent, _toEye)
      if (_across.lengthSq() < 1e-9) _across.copy(_cameraRight)
      else _across.normalize()
      const t = Math.min(1, p.age / p.life)
      const radius = radiusAt(this.kind, p.age, p.life, p.size, p.still)
      const sourceRadius = radiusAt(this.kind, 0, p.life, p.size, p.still)
      const dilution = Math.pow(sourceRadius / radius, DILUTION_POWER)
      for (let edge = 0; edge < 2; edge++) {
        const v = i * 2 + edge
        const side = edge ? 1 : -1
        position[v * 3] = p.pos.x + side * _across.x * radius
        position[v * 3 + 1] = p.pos.y + side * _across.y * radius
        position[v * 3 + 2] = p.pos.z + side * _across.z * radius
        uv[v * 2] = edge
        uv[v * 2 + 1] = p.serial * 0.12
        smoke[v * 3] = t
        smoke[v * 3 + 1] = p.density * dilution
        smoke[v * 3 + 2] = p.seed
      }
    }
    const index = this.indices.array
    let used = 0
    const segments = closed ? count : count - 1
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % count
      if (!closed && (points[i].segment !== points[next].segment
        || points[i].pos.distanceTo(points[next].pos) > LINK_REACH)) continue
      const a = i * 2, b = next * 2
      index[used++] = a
      index[used++] = a + 1
      index[used++] = b
      index[used++] = a + 1
      index[used++] = b + 1
      index[used++] = b
    }
    this.positions.needsUpdate = true
    this.uv.needsUpdate = true
    this.smoke.needsUpdate = true
    this.indices.needsUpdate = true
    this.mesh.geometry.setDrawRange(0, used)
  }

  clear() { this.mesh.geometry.setDrawRange(0, 0) }
  dispose(scene) {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
  }
}

class SmokeStream {
  constructor(scene, kind, scale = 1) {
    this.kind = kind
    this.scale = scale
    this.profile = PROFILES[kind]
    this.items = []
    this.spare = []
    this.sheet = new SmokeSheet(scene, this.profile.capacity, kind)
    this.source = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), dir: new THREE.Vector3(), size: 1, moving: false }
    this.last = new THREE.Vector3()
    this.fed = false
    this.wasFed = false
    this.until = 0
    this.segment = 0
    this.serial = 0
    this.seed = rand(0, 100)
    this.emission = 1
    this.time = 0
  }

  feed(pos, vel, dir = null, size = 1, moving = false) {
    this.source.pos.copy(pos)
    this.source.vel.copy(vel)
    if (dir) this.source.dir.copy(dir).normalize()
    else this.source.dir.set(0, 0, 0)
    this.source.size = size * this.scale
    this.source.moving = moving
    this.fed = true
  }

  spawn(at) {
    const { profile, source } = this
    const p = this.spare.pop() ?? { pos: new THREE.Vector3(), vel: new THREE.Vector3() }
    p.still = this.kind === 'ember' && !source.moving
    const drift = p.still ? IDLE_EMBER.drift : 0.025
    p.pos.copy(at)
    p.vel.set(
      THREE.MathUtils.clamp(source.vel.x * 0.12, -0.55, 0.55) + rand(-drift, drift) + source.dir.x * profile.push,
      source.dir.y * profile.push,
      THREE.MathUtils.clamp(source.vel.z * 0.12, -0.55, 0.55) + rand(-drift, drift) + source.dir.z * profile.push,
    )
    p.rise = p.still ? IDLE_EMBER.startRise : profile.startRise
    p.targetRise = p.still ? IDLE_EMBER.rise : profile.rise
    p.age = 0
    p.life = (p.still ? IDLE_EMBER.life : profile.life) * rand(0.88, 1.08)
    p.size = source.size
    const density = this.kind === 'breath' ? rand(0.34, 0.49)
      : p.still ? rand(0.48, 0.62) : rand(0.41, 0.59)
    p.density = density * (this.kind === 'ember' ? this.emission : 1)
    p.seed = this.seed
    p.segment = this.segment
    p.serial = this.serial++
    if (this.items.length >= profile.capacity) this.spare.push(this.items.shift())
    this.items.push(p)
  }

  update(dt, camera) {
    const { profile, items } = this
    const elapsed = Math.max(0, Math.min(dt, STEP * MAX_STEPS))
    this.time += elapsed
    if (elapsed > 0) {
      const steps = Math.ceil(elapsed / STEP)
      const step = elapsed / steps
      for (let n = 0; n < steps; n++) {
        const drag = Math.exp(-profile.drag * step)
        const buoyancy = 1 - Math.exp(-4 * step)
        for (const p of items) {
          p.age += step
          p.vel.multiplyScalar(drag)
          p.rise += (p.targetRise - p.rise) * buoyancy
          const onset = this.kind === 'breath' ? BREATH_AIR_ONSET
            : p.still ? EMBER_AIR_ONSET : MOVING_EMBER_AIR_ONSET
          const turbulence = THREE.MathUtils.smoothstep(p.age, onset[0], onset[1])
          p.pos.addScaledVector(p.vel, step)
          if (turbulence > 0) {
            airAt(p.pos, this.time, _flow)
            _flow.y *= 0.18
            p.pos.addScaledVector(_flow, step * turbulence * (p.still ? IDLE_EMBER.air : 1))
          }
          p.pos.y += p.rise * step
        }
      }
      let alive = 0
      for (const p of items) {
        if (p.age < p.life) items[alive++] = p
        else this.spare.push(p)
      }
      items.length = alive
      if (this.fed) {
        const travel = this.last.distanceTo(this.source.pos)
        const continuous = this.wasFed && travel < 1.5
        if (this.kind === 'ember') {
          const speed = continuous && elapsed > 0 ? travel / elapsed : 0
          const target = 1 - THREE.MathUtils.smoothstep(speed, ...SMOKE_THINS_AT)
          const response = target < this.emission ? 24 : 7
          this.emission += (target - this.emission) * (1 - Math.exp(-response * elapsed))
        }
        if (!continuous) {
          this.segment++
          this.until = 0
          this.last.copy(this.source.pos)
        }
        let due = this.until
      while (due < elapsed) {
          _from.lerpVectors(this.last, this.source.pos, due / elapsed)
          this.spawn(_from)
          due += profile.interval
        }
        this.until = due - elapsed
        this.last.copy(this.source.pos)
      } else this.until = 0
    }
    this.wasFed = this.fed
    this.fed = false
    this.sheet.draw(items, camera)
  }

  clear() {
    this.spare.push(...this.items)
    this.items.length = 0
    this.fed = this.wasFed = false
    this.emission = 1
    this.until = 0
    this.sheet.clear()
  }

  dispose(scene) {
    this.sheet.dispose(scene)
  }
}

class SmokeRing {
  constructor(scene, pos, dir, vel) {
    this.sheet = new SmokeSheet(scene, RING_POINTS, 'ring')
    this.items = []
    this.age = 0
    _ringAcross.crossVectors(dir, _up)
    if (_ringAcross.lengthSq() < 1e-8) _ringAcross.set(1, 0, 0)
    _ringAcross.normalize()
    _ringUp.crossVectors(_ringAcross, dir).normalize()
    const seed = rand(0, 100)
    for (let i = 0; i < RING_POINTS; i++) {
      const angle = (i / RING_POINTS) * Math.PI * 2
      _radial.copy(_ringAcross).multiplyScalar(Math.cos(angle)).addScaledVector(_ringUp, Math.sin(angle))
      this.items.push({
        pos: pos.clone().addScaledVector(_radial, 0.045),
        vel: dir.clone().multiplyScalar(1.1).addScaledVector(_radial, 0.23)
          .add(new THREE.Vector3(vel.x * 0.1, 0, vel.z * 0.1)),
        rise: 0.04, age: 0, life: RING_LIFE, size: 1,
        density: rand(0.53, 0.76), seed, serial: i,
      })
    }
  }

  update(dt, time, camera) {
    this.age += dt
    const drag = Math.exp(-0.9 * dt)
    for (const p of this.items) {
      p.age = this.age
      p.vel.multiplyScalar(drag)
      airAt(p.pos, time, _flow)
      p.pos.addScaledVector(p.vel, dt).addScaledVector(_flow, dt * 0.3)
      p.pos.y += p.rise * dt
    }
    this.sheet.draw(this.items, camera, true)
    return this.age < RING_LIFE
  }

  dispose(scene) { this.sheet.dispose(scene) }
}

export class CigaretteSmoke {
  constructor(scene, camera) {
    this.scene = scene
    this.camera = camera
    this.ember = new SmokeStream(scene, 'ember')
    this.breath = new SmokeStream(scene, 'breath')
    this.otherEmbers = new Map()
    this.otherBreaths = new Map()
    this.rings = []
    this.time = 0
  }

  emitEmber(pos, vel, source = null, moving = false) {
    let stream = this.ember
    if (source) {
      stream = this.otherEmbers.get(source)
      if (!stream) {
        stream = new SmokeStream(this.scene, 'ember', 2.2)
        this.otherEmbers.set(source, stream)
      }
    }
    stream.feed(pos, vel, null, 1, moving)
  }

  emitBreath(pos, dir, vel, size = 1, source = null) {
    let stream = this.breath
    if (source) {
      stream = this.otherBreaths.get(source)
      if (!stream) {
        stream = new SmokeStream(this.scene, 'breath')
        this.otherBreaths.set(source, stream)
      }
    }
    stream.feed(pos, vel, dir, size)
  }

  ring(pos, dir, vel) {
    if (this.rings.length >= 2) this.rings.shift().dispose(this.scene)
    this.rings.push(new SmokeRing(this.scene, pos, dir, vel))
  }

  update(dt) {
    this.time += dt
    this.ember.update(dt, this.camera)
    this.breath.update(dt, this.camera)
    for (const stream of this.otherEmbers.values()) stream.update(dt, this.camera)
    for (const stream of this.otherBreaths.values()) stream.update(dt, this.camera)
    this.rings = this.rings.filter((ring) => {
      if (ring.update(dt, this.time, this.camera)) return true
      ring.dispose(this.scene)
      return false
    })
  }

  clear() {
    this.ember.clear()
    this.breath.clear()
    for (const stream of this.otherEmbers.values()) stream.dispose(this.scene)
    for (const stream of this.otherBreaths.values()) stream.dispose(this.scene)
    this.otherEmbers.clear()
    this.otherBreaths.clear()
    for (const ring of this.rings) ring.dispose(this.scene)
    this.rings.length = 0
  }
}
