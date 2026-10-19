// A place's finds as they are seen (`finds.js`). Look only. The small body remains the thing
// he takes; a bright, depth-tested flare gives its position away across a wide place, and the
// walls still hide it.

import * as THREE from 'three'
import { FINDS } from './finds.js'

const BOB = 0.18 // metres a find rises and falls round chest height
const TURN = 1.1 // radians a second
const _flare = new THREE.PlaneGeometry(1, 1)

// A camera-facing patch in view space: its size grows with distance, while the scene's depth
// still hides it behind walls. The hot centre and four soft rays survive bloom and fog.
function flareMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      opacity: { value: 0 },
      size: { value: 1 },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      uniform float size;
      void main() {
        vUv = uv;
        vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        center.xy += position.xy * size;
        gl_Position = projectionMatrix * center;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 color;
      uniform float opacity;
      uniform float time;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float radius = length(p);
        float core = exp(-radius * radius * 34.0);
        float haze = exp(-radius * radius * 5.0);
        float rays = exp(-abs(p.x) * 23.0) * exp(-abs(p.y) * 3.5)
                   + exp(-abs(p.y) * 23.0) * exp(-abs(p.x) * 3.5);
        float ring = exp(-pow((radius - 0.47) * 17.0, 2.0));
        float pulse = 0.88 + 0.12 * sin(time * 3.0);
        float light = (core * 0.8 + haze * 0.12 + rays * 0.22 + ring * 0.1) * opacity * pulse;
        gl_FragColor = vec4(color * 2.5, min(light, 1.0));
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
  })
}

// Shared pieces keep replacing finds in the editor from making new GPU resources each time.
const MAT = {
  sleeve: new THREE.MeshBasicMaterial({ color: 0xe3b84a }),
  label: new THREE.MeshBasicMaterial({ color: 0xffe2a0 }),
  red: new THREE.MeshBasicMaterial({ color: 0x8d2a1c }),
  wood: new THREE.MeshBasicMaterial({ color: 0xe4d3ae }),
  head: new THREE.MeshBasicMaterial({ color: 0xe85730 }),
  vane: new THREE.MeshBasicMaterial({ color: 0xeef3f7, side: THREE.DoubleSide }),
  spine: new THREE.MeshBasicMaterial({ color: 0xb6d2df }),
  barbs: new THREE.LineBasicMaterial({ color: 0xb8d0da, transparent: true, opacity: 0.8 }),
}
const GEO = {
  // A box of matches laid along X, its drawer half out at +X: the kind's `size` brings it down.
  sleeve: new THREE.BoxGeometry(0.82, 0.34, 0.6),
  drawer: new THREE.BoxGeometry(0.43, 0.25, 0.49),
  label: new THREE.BoxGeometry(0.51, 0.012, 0.37),
  stripe: new THREE.BoxGeometry(0.65, 0.16, 0.012),
  labelMark: new THREE.BoxGeometry(0.29, 0.014, 0.052),
  match: new THREE.CylinderGeometry(0.012, 0.012, 0.34, 4),
  head: new THREE.SphereGeometry(0.029, 5, 4),
}

const featherShape = new THREE.Shape()
featherShape.moveTo(-0.55, 0)
featherShape.lineTo(-0.36, 0.1)
featherShape.lineTo(-0.13, 0.19)
featherShape.lineTo(0.13, 0.21)
featherShape.lineTo(0.43, 0.12)
featherShape.lineTo(0.58, 0.02)
featherShape.lineTo(0.37, -0.03)
featherShape.lineTo(0.06, -0.12)
featherShape.lineTo(-0.25, -0.1)
featherShape.closePath()
GEO.vane = new THREE.ExtrudeGeometry(featherShape, { depth: 0.025, bevelEnabled: false, curveSegments: 1 })
GEO.spine = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(-0.7, -0.025, 0.016),
  new THREE.Vector3(-0.3, 0.005, 0.016),
  new THREE.Vector3(0.2, 0.035, 0.016),
  new THREE.Vector3(0.58, 0.02, 0.016),
]), 9, 0.012, 4, false)
const barbs = []
for (let i = 0; i < 7; i++) {
  const x = -0.28 + i * 0.105
  const reach = Math.sin((i + 1) / 8 * Math.PI)
  barbs.push(x, 0.01, 0.041, x + 0.09, 0.01 + 0.15 * reach, 0.041)
  barbs.push(x, 0.01, 0.041, x + 0.08, 0.01 - 0.095 * reach, 0.041)
}
GEO.barbs = new THREE.BufferGeometry()
GEO.barbs.setAttribute('position', new THREE.Float32BufferAttribute(barbs, 3))

function bodyOf(kind) {
  const group = new THREE.Group()
  if (kind === 'match') {
    group.add(new THREE.Mesh(GEO.sleeve, MAT.sleeve))
    const drawer = new THREE.Mesh(GEO.drawer, MAT.red)
    drawer.position.x = 0.48
    group.add(drawer)
    const label = new THREE.Mesh(GEO.label, MAT.label)
    label.position.set(-0.09, 0.18, 0)
    group.add(label)
    const mark = new THREE.Mesh(GEO.labelMark, MAT.red)
    mark.position.set(-0.09, 0.191, 0)
    group.add(mark)
    const stripe = new THREE.Mesh(GEO.stripe, MAT.red)
    stripe.position.z = 0.307
    group.add(stripe)
    for (const z of [-0.13, 0, 0.13]) {
      const stick = new THREE.Mesh(GEO.match, MAT.wood)
      stick.rotation.z = Math.PI / 2
      stick.position.set(0.53, 0.13, z)
      const head = new THREE.Mesh(GEO.head, MAT.head)
      head.position.set(0.71, 0.13, z)
      group.add(stick, head)
    }
  } else {
    group.add(new THREE.Mesh(GEO.vane, MAT.vane))
    group.add(new THREE.Mesh(GEO.spine, MAT.spine))
    group.add(new THREE.LineSegments(GEO.barbs, MAT.barbs))
  }
  return group
}

export class FindsDrawn {
  /** `finds`: the records (`id`, `kind`, `x`, `y`, `z`), `y` where each hangs. */
  constructor(finds) {
    this.group = new THREE.Group()
    this._items = finds.map((find, i) => {
      const { color, size } = FINDS[find.kind]
      const item = new THREE.Group()
      const body = bodyOf(find.kind)
      const flare = new THREE.Mesh(_flare, flareMaterial(color))
      flare.frustumCulled = false // its view-space patch reaches beyond the tiny body's bounds
      item.add(body, flare)
      item.scale.setScalar(size)
      item.position.set(find.x, find.y, find.z)
      body.rotation.y = i * 1.7 // none alike
      this.group.add(item)
      return { item, body, flare, rest: find.y, find }
    })
  }

  /**
   * One frame of `dt`: the finds turned and bobbed on, each flare as bright as `finds.glint` (from
   * the eye at `focus`) says, and a taken one gone. `time`, seconds, keeps the bob going.
   */
  show(finds, focus, dt, time) {
    this._items.forEach(({ item, body, flare, rest, find }, i) => {
      item.visible = !finds.has(find.id)
      if (!item.visible) return
      const seen = finds.glint(focus, find)
      body.rotation.y += TURN * dt
      item.position.y = rest + Math.sin(time * 1.6 + i) * BOB
      const distance = Math.hypot(focus.x - find.x, focus.y - find.y, focus.z - find.z)
      flare.visible = seen > 0
      flare.material.uniforms.opacity.value = seen * (0.16 + 0.84 * Math.min(1, distance / 8))
      flare.material.uniforms.size.value = Math.min(7, Math.max(1.7, distance * 0.05))
      flare.material.uniforms.time.value = time + i
    })
  }

  dispose() {
    this.group.removeFromParent()
    for (const { flare } of this._items) flare.material.dispose()
  }
}
