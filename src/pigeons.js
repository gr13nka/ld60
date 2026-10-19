// Pigeons on the ground of a parkour place: perched in flocks where people would be, up in a
// scatter when the runner comes near, round and round overhead, and down again once he has
// gone. Look only: nothing here is met, and nothing decides anything. All birds of a place
// are one instanced mesh; the flap is done in the vertex shader from a phase kept per bird
// (as `doves.js` does), and each bird's place and heading are kept here, on the CPU, because
// what a bird does depends on where the runner is.

import * as THREE from 'three'

const SCARE = 10 // metres from the runner's feet to a flock's nearest edge at which it goes up
const SCARE_DELAY = 0.03 // seconds per metre of a bird's distance from him that it waits: the near ones go first
const SCARE_JITTER = 0.25 // seconds, at random, added to that
const CLIMB = 6.5 // m/s upward while scattering: steep
const FLEE = 3.5 // m/s away from him, along the ground, while scattering
const SCATTER_FOR = 5 // seconds after which a bird that has not reached its height starts circling anyway
const CIRCLE_HEIGHT = [15, 30] // metres over the perch
const CIRCLE_RADIUS = [8, 18] // metres
const CIRCLE_FOR = [20, 40] // seconds before a bird may come down, if he is far enough
const CRUISE = [7, 9] // m/s along the circle
const LAND_FAR = 40 // metres: they land only once he is farther than this from the perch
const LAND_SPEED = 7 // m/s on the way down, easing off near the ground
const STEER = 3 // per second: how fast a bird's velocity follows what it wants
const FLAP_RATE = 30 // rad/s of the wing while scattering
const CRUISE_RATE = 16 // rad/s while circling, in bursts
const WARMUP = 6 // per second: how fast the wing opens and closes
const SLEEP = 90 // metres: a perched flock this far from him is not stepped at all
const BELLY = 0.05 // metres from a perched bird's centre to the ground
const HOP_EVERY = [1.2, 4.5] // seconds between a perched bird's small things
const HOP_HEIGHT = 0.08 // metres
const PECK_PITCH = 0.7 // radians nose down at the bottom of a peck
const BODY = new THREE.Color(0x7f8da1).multiplyScalar(1.1) // grey-blue
const HEAD = new THREE.Color(0x3a4150) // and darker
const PERCHED = 0
const SCATTERING = 1
const CIRCLING = 2
const LANDING = 3

// One bird, about 0.33 m long, facing +Z. `wing` is 1 at a wing tip (what flaps and folds);
// `tone` is 1 at the head, which is darker.
function birdGeometry() {
  const positions = []
  const wings = []
  const tones = []
  const vertex = (x, y, z, wing = 0, tone = 0) => {
    positions.push(x, y, z)
    wings.push(wing)
    tones.push(tone)
  }
  const ring = (z, r) => [[r, 0, z], [0, r * 0.9, z], [-r, 0, z], [0, -r * 0.8, z]]
  const tail = [0, 0.01, -0.165]
  const nose = [0, 0.005, 0.165]
  const hips = ring(-0.03, 0.04)
  const chest = ring(0.05, 0.042)
  const head = ring(0.11, 0.02)
  const join = (from, to, toneFrom, toneTo) => {
    from.forEach((a, i) => {
      const b = from[(i + 1) % from.length]
      const c = to[i]
      const d = to[(i + 1) % to.length]
      vertex(...a, 0, toneFrom); vertex(...b, 0, toneFrom); vertex(...c, 0, toneTo)
      vertex(...b, 0, toneFrom); vertex(...d, 0, toneTo); vertex(...c, 0, toneTo)
    })
  }
  join(hips, chest, 0, 0)
  join(chest, head, 0, 1)
  hips.forEach((a, i) => {
    const b = hips[(i + 1) % hips.length]
    vertex(...tail, 0, 0); vertex(...b, 0, 0); vertex(...a, 0, 0)
  })
  head.forEach((a, i) => {
    const b = head[(i + 1) % head.length]
    vertex(...nose, 0, 1); vertex(...a, 0, 1); vertex(...b, 0, 1)
  })
  for (const side of [-1, 1]) {
    vertex(side * 0.035, 0.015, 0.07)
    vertex(side * 0.035, 0.015, -0.1)
    vertex(side * 0.34, 0.015, -0.06, 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('wing', new THREE.Float32BufferAttribute(wings, 1))
  geometry.setAttribute('tone', new THREE.Float32BufferAttribute(tones, 1))
  return geometry
}

const between = ([low, high]) => low + Math.random() * (high - low)

const _euler = new THREE.Euler(0, 0, 0, 'YXZ')
const _quaternion = new THREE.Quaternion()
const _position = new THREE.Vector3()
const _scale = new THREE.Vector3()
const _matrix = new THREE.Matrix4()

export class Pigeons {
  /** `perches`: `[{ at: Vector3 on the ground, count, spread }]`, one flock each. */
  constructor(perches) {
    this._flocks = []
    this._tookOff = [] // `present`'s answer, kept from call to call
    this._birds = []
    for (const { at, count, spread } of perches) {
      const flock = { at, spread, birds: [], scared: false, clockwise: Math.random() < 0.5 ? 1 : -1 }
      for (let i = 0; i < count; i++) {
        const bird = {
          flock,
          index: this._birds.length, // its instance
          state: PERCHED,
          x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
          homeX: 0, homeY: at.y + BELLY, homeZ: 0,
          yaw: Math.random() * Math.PI * 2, pitch: 0,
          scale: 0.92 + Math.random() * 0.16,
          wait: 0, // seconds until a scared bird goes up
          clock: Math.random() * 20, // seconds of its own, for the bursts of flapping
          phase: Math.random() * 6.28,
          spread: 0, beat: 0, // how far the wing is open, how hard it beats
          next: between(HOP_EVERY), doing: 0, // the next small thing, and seconds into it (0 = none)
          peck: false,
          height: between(CIRCLE_HEIGHT), radius: between(CIRCLE_RADIUS), speed: between(CRUISE),
          angle: 0, circleFor: 0, scattered: 0,
        }
        this._settle(bird)
        flock.birds.push(bird)
        this._birds.push(bird)
      }
      this._flocks.push(flock)
    }

    const geometry = birdGeometry()
    this._flaps = new THREE.InstancedBufferAttribute(new Float32Array(this._birds.length * 3), 3)
    this._flaps.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('flap', this._flaps)
    const material = new THREE.ShaderMaterial({
      uniforms: { uBody: { value: BODY }, uHead: { value: HEAD } },
      vertexShader: /* glsl */ `
        attribute float wing;
        attribute float tone;
        attribute vec3 flap; // how far the wing is open, how hard it beats, where in the beat
        varying float vShade;
        varying float vTone;
        void main() {
          vec3 bird = position;
          bird.x *= mix(${(0.12).toFixed(2)}, 1.0, flap.x);
          bird.y += wing * sin(flap.z) * flap.y * 0.17;
          vTone = tone;
          vShade = 1.0 - 0.15 * wing - 0.1 * step(position.y, -0.005);
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(bird, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uBody;
        uniform vec3 uHead;
        varying float vShade;
        varying float vTone;
        void main() {
          gl_FragColor = vec4(mix(uBody, uHead, vTone) * vShade, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      side: THREE.DoubleSide,
    })
    this.mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, this._birds.length))
    this.mesh.count = this._birds.length
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false // drawn where the matrices put them, not where the geometry is
    this.group = new THREE.Group()
    this.group.add(this.mesh)
    for (const bird of this._birds) this._write(bird)
  }

  /** Puts a bird on a spot of the ground round its flock's perch. */
  _settle(bird) {
    const { at, spread } = bird.flock
    const angle = Math.random() * Math.PI * 2
    const reach = spread * Math.sqrt(Math.random())
    bird.homeX = at.x + Math.cos(angle) * reach
    bird.homeZ = at.z + Math.sin(angle) * reach
    bird.homeY = at.y + BELLY
    bird.x = bird.homeX
    bird.y = bird.homeY
    bird.z = bird.homeZ
    bird.vx = bird.vy = bird.vz = 0
    bird.state = PERCHED
    bird.pitch = 0
  }

  /**
   * Steps the birds; `focus` is the runner's feet. Returns where each flock that took off this
   * frame was perched, in a list that is the same one every call.
   */
  present(dt, focus) {
    const tookOff = this._tookOff
    tookOff.length = 0
    if (dt <= 0) return tookOff
    dt = Math.min(dt, 0.1)
    let moved = false
    for (const flock of this._flocks) {
      const away = Math.hypot(focus.x - flock.at.x, focus.y - flock.at.y, focus.z - flock.at.z)
      if (!flock.scared && away > SLEEP) continue
      moved = true
      if (!flock.scared && away - flock.spread < SCARE) {
        flock.scared = true
        tookOff.push(flock.at)
        for (const bird of flock.birds) if (bird.state === PERCHED) this._scare(bird, focus)
      }
      let allDown = true
      for (const bird of flock.birds) {
        this._step(bird, dt, focus, away)
        if (bird.state !== PERCHED) allDown = false
        this._write(bird)
      }
      if (allDown) flock.scared = false
    }
    if (moved) {
      this.mesh.instanceMatrix.needsUpdate = true
      this._flaps.needsUpdate = true
    }
    return tookOff
  }

  _scare(bird, focus) {
    const near = Math.hypot(bird.x - focus.x, bird.y - focus.y, bird.z - focus.z)
    bird.wait = near * SCARE_DELAY + Math.random() * SCARE_JITTER
    bird.state = SCATTERING
    bird.scattered = 0
    bird.doing = 0
  }

  _step(bird, dt, focus, away) {
    bird.clock += dt
    let openTo = 0 // where the wing is going: open, and how hard it beats
    let beatTo = 0
    let rate = 0
    if (bird.state === PERCHED) {
      this._perched(bird, dt)
    } else if (bird.state === SCATTERING) {
      bird.scattered += dt
      if (bird.scattered < bird.wait) {
        this._perched(bird, dt) // still on the ground, alert
      } else {
        let dx = bird.x - focus.x
        let dz = bird.z - focus.z
        const len = Math.hypot(dx, dz) || 1
        dx /= len
        dz /= len
        this._steer(bird, dt, dx * FLEE, CLIMB, dz * FLEE)
        openTo = 1
        beatTo = 1
        rate = FLAP_RATE
        const rose = bird.y - bird.flock.at.y
        if (rose > bird.height * 0.85 || bird.scattered - bird.wait > SCATTER_FOR) this._circle(bird)
      }
    } else if (bird.state === CIRCLING) {
      const { at } = bird.flock
      bird.angle += (bird.flock.clockwise * bird.speed * dt) / bird.radius
      const tx = at.x + Math.cos(bird.angle) * bird.radius
      const tz = at.z + Math.sin(bird.angle) * bird.radius
      const ty = at.y + bird.height + Math.sin(bird.clock * 0.6) * 1.5
      let vx = (tx - bird.x) * 1.2
      let vy = (ty - bird.y) * 1.2
      let vz = (tz - bird.z) * 1.2
      const len = Math.hypot(vx, vy, vz)
      if (len > 0) {
        const f = Math.min(bird.speed * 1.3, len) / len
        vx *= f; vy *= f; vz *= f
      }
      this._steer(bird, dt, vx, vy, vz)
      bird.circleFor -= dt
      // Flapping comes in bursts between glides.
      const burst = THREE.MathUtils.clamp(Math.sin(bird.clock * 0.9 + bird.phase) * 2, 0, 1)
      openTo = 1
      beatTo = 0.1 + 0.9 * burst
      rate = CRUISE_RATE
      if (bird.circleFor <= 0 && away > LAND_FAR) this._land(bird)
    } else {
      // Landing: straight at the spot, easing off near it, wings out and the beat back at the end.
      const dx = bird.homeX - bird.x
      const dy = bird.homeY - bird.y
      const dz = bird.homeZ - bird.z
      const left = Math.hypot(dx, dy, dz)
      if (away - bird.flock.spread < SCARE) {
        this._scare(bird, focus)
        bird.wait = 0
        return
      }
      if (left < 0.12) {
        bird.x = bird.homeX
        bird.y = bird.homeY
        bird.z = bird.homeZ
        bird.vx = bird.vy = bird.vz = 0
        bird.state = PERCHED
        bird.pitch = 0
        bird.yaw = Math.random() * Math.PI * 2
        bird.next = between(HOP_EVERY)
      } else {
        const speed = Math.min(LAND_SPEED, 1 + left * 0.8)
        this._steer(bird, dt, (dx / left) * speed, (dy / left) * speed, (dz / left) * speed)
        openTo = 1
        beatTo = left < 2 ? 1 : 0.1
        rate = left < 2 ? FLAP_RATE * 0.8 : CRUISE_RATE
      }
    }
    // The wing follows what is wanted, not jumps to it.
    const k = Math.min(1, WARMUP * dt)
    bird.spread += (openTo - bird.spread) * k
    bird.beat += (beatTo - bird.beat) * k
    bird.phase += rate * dt
  }

  _circle(bird) {
    bird.state = CIRCLING
    const { at } = bird.flock
    bird.angle = Math.atan2(bird.z - at.z, bird.x - at.x)
    bird.circleFor = between(CIRCLE_FOR)
  }

  _land(bird) {
    const { at, spread } = bird.flock
    const angle = Math.random() * Math.PI * 2
    const reach = spread * Math.sqrt(Math.random())
    bird.homeX = at.x + Math.cos(angle) * reach
    bird.homeZ = at.z + Math.sin(angle) * reach
    bird.state = LANDING
  }

  /** A bird on the ground: now and then a peck (head down and up) or a little hop with a new heading. */
  _perched(bird, dt) {
    bird.y = bird.homeY
    if (bird.doing === 0) {
      bird.next -= dt
      if (bird.next <= 0) {
        bird.doing = 1e-3
        bird.peck = Math.random() < 0.7
        if (!bird.peck) bird.yaw += (Math.random() - 0.5) * 2
      }
      bird.pitch = 0
      return
    }
    bird.doing += dt
    if (bird.peck) {
      const t = bird.doing / 0.4
      bird.pitch = PECK_PITCH * Math.sin(Math.PI * Math.min(1, t))
      if (t >= 1) this._done(bird)
    } else {
      const t = bird.doing / 0.25
      bird.y = bird.homeY + HOP_HEIGHT * Math.sin(Math.PI * Math.min(1, t))
      if (t >= 1) this._done(bird)
    }
  }

  _done(bird) {
    bird.doing = 0
    bird.pitch = 0
    bird.next = between(HOP_EVERY)
  }

  /** Eases the velocity towards what the bird wants, moves it, and turns it to where it goes. */
  _steer(bird, dt, wantX, wantY, wantZ) {
    const k = Math.min(1, STEER * dt)
    bird.vx += (wantX - bird.vx) * k
    bird.vy += (wantY - bird.vy) * k
    bird.vz += (wantZ - bird.vz) * k
    bird.x += bird.vx * dt
    bird.y += bird.vy * dt
    bird.z += bird.vz * dt
    const along = Math.hypot(bird.vx, bird.vz)
    if (along > 0.3) {
      let turn = Math.atan2(bird.vx, bird.vz) - bird.yaw
      turn = Math.atan2(Math.sin(turn), Math.cos(turn))
      bird.yaw += turn * Math.min(1, 6 * dt)
    }
    // Positive pitch is nose down.
    bird.pitch += (-Math.atan2(bird.vy, Math.max(along, 0.5)) - bird.pitch) * Math.min(1, 5 * dt)
  }

  /** Writes a bird's place and wing into its instance. */
  _write(bird) {
    const i = bird.index
    _euler.set(bird.pitch, bird.yaw, 0)
    _quaternion.setFromEuler(_euler)
    _position.set(bird.x, bird.y, bird.z)
    _scale.setScalar(bird.scale)
    this.mesh.setMatrixAt(i, _matrix.compose(_position, _quaternion, _scale))
    this._flaps.setXYZ(i, bird.spread, bird.beat, bird.phase)
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
    this.mesh.dispose()
  }
}
