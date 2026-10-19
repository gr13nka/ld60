// The air the level sits in, coloured by its theme: sky, stars, moon, fog, the wind, and the
// light they shed. A theme may change along its level, a sunset going to night. As the fire front closes in, the horizon behind glows, the haze warms, and a warm
// light comes up from that side. Only ever seen, so it is driven once per frame.

import * as THREE from 'three'
import { celMaterial } from './shading.js'

const SKY_TOP = new THREE.Color(0x07112a)
const SKY_HORIZON = new THREE.Color(0x3c6c86)
const FOG_COLOR = new THREE.Color(0x284a5e)
const FOG_NEAR = 180
const FOG_FAR = 1000
const SKY_RADIUS = 3000

// Ahead and to the right of someone looking down the level, low enough to be in view.
const MOON_DIRECTION = new THREE.Vector3(-0.55, 0.45, 0.7).normalize()
const MOON_SIZE = 420 // of the whole sprite, halo included; the disc is a quarter of it

const STAR_COUNT = 360
const BRIGHT_STARS = 0.18 // the share drawn larger, which twinkle visibly

const FIRE_GLOW = new THREE.Color(0xff6a22)
const AFTERGLOW = 0.6 // how strongly a theme's afterglow colour is laid over the sky
const HAZE_COLOR = new THREE.Color(0x7a4630)
const HAZE_AT_FULL = 0.25 // how far the fog leans to HAZE_COLOR with the fire on top of you
const FIRE_FILL = 1.2 // intensity of the fire's light on the scene at the same moment
const LOOM_EASE = 1.5 // per second; keeps the fire's arrival from snapping the colours
// A theme with a `later` look is wholly its first self up to here, and wholly the later one
// from there, as fractions of the way along the level — unless it says where itself (`later.between`).
const LATER_BETWEEN = [0.08, 0.8]

// The sun's shadows cover a square of ground this wide around the spot the game asks for;
// beyond it nothing is shaded.
const SHADOW_SPAN = 320
const SHADOW_MAP = 1024
const SHADOW_DEPTH = 700 // along the light, centred on that spot: room for a tower above and a valley below
const SHADOW_TEXEL = SHADOW_SPAN / SHADOW_MAP

// What drifts the mist's banks (`picture.js`'s `MistPass`), in metres a second. There are no
// clouds: a layer that knew nothing of what stood under it ran through every tall building.
const WIND = new THREE.Vector3(3.5, 0, 1.5)

const _matrix = new THREE.Matrix4()
const _spot = new THREE.Vector3()

const rand = (min, max) => min + Math.random() * (max - min)

// What a theme asks of the air at one end of its level, in colours that can be mixed.
// `shining` is whether the stars and moon are out, as 0 or 1.
function lookOf({ sky, fog, light }) {
  return {
    top: new THREE.Color(sky.top),
    horizon: new THREE.Color(sky.horizon),
    afterglow: new THREE.Color(sky.afterglow ?? 0x000000).multiplyScalar(AFTERGLOW),
    shining: sky.stars ? 1 : 0,
    fog: new THREE.Color(fog.color),
    fogNear: fog.near,
    fogFar: fog.far,
    skyLight: new THREE.Color(light.sky),
    groundLight: new THREE.Color(light.ground),
    ambient: light.ambient,
    sun: new THREE.Color(light.sun),
    sunPower: light.sunPower,
  }
}

// Writes to `into` the look that is `mix` of the way from `from` to `to`, and returns it.
function mixLooks(into, from, to, mix) {
  for (const [name, value] of Object.entries(from)) {
    if (value.isColor) into[name].lerpColors(value, to[name], mix)
    else into[name] = THREE.MathUtils.lerp(value, to[name], mix)
  }
  return into
}

// A theme's two looks: at the start of its level and at the far end, the same where it has no
// `later`, and where along the level the one turns into the other.
function looksOf(theme) {
  const look = lookOf(theme)
  const later = theme.later ? lookOf(theme.later) : null
  return { look, later, between: theme.later?.between ?? LATER_BETWEEN }
}

// A theme's `cycle` as looks, each part of a stop over the theme's own: `[{ at, look }]` in order.
function cycleOf(theme) {
  return theme.cycle.map(({ at, sky, fog, light }) => ({
    at,
    look: lookOf({ sky: { ...theme.sky, ...sky }, fog: { ...theme.fog, ...fog }, light: { ...theme.light, ...light } }),
  }))
}

// The two looks of a cycle that `along` (0 to 1, coming round) lies between, and how far it is
// from the one to the other: `[from, to, mix]`.
function aroundCycle(cycle, along) {
  const at = THREE.MathUtils.euclideanModulo(along, 1)
  let i = cycle.length - 1
  while (i > 0 && cycle[i].at > at) i--
  if (cycle[0].at > at) i = cycle.length - 1
  const from = cycle[i]
  const to = cycle[(i + 1) % cycle.length]
  const span = THREE.MathUtils.euclideanModulo(to.at - from.at, 1) || 1
  return [from.look, to.look, THREE.MathUtils.euclideanModulo(at - from.at, 1) / span]
}

// The dome: fog-coloured at the horizon so the ground melts into it, with the fire's glow
// low on the side the level starts from (-Z).
function createDome(fogColor) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: SKY_TOP.clone() },
      uHorizon: { value: SKY_HORIZON.clone() },
      uFog: { value: fogColor },
      uFireColor: { value: FIRE_GLOW },
      uAfterglow: { value: new THREE.Color(0x000000) },
      uFire: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uFog;
      uniform vec3 uFireColor;
      uniform vec3 uAfterglow;
      uniform float uFire;
      varying vec3 vDirection;
      void main() {
        vec3 direction = normalize(vDirection);
        float up = max(direction.y, 0.0);
        vec3 sky = mix(uHorizon, uTop, sqrt(min(up / 0.53, 1.0)));
        sky = mix(uFog, sky, smoothstep(0.0, 0.16, direction.y));
        float behind = max(-direction.z, 0.0);
        sky += uFireColor * (uFire * behind * behind * exp(-up * 7.0));
        // The last of the daylight, low on the side the level runs towards (+Z).
        float ahead = max(direction.z, 0.0);
        sky += uAfterglow * (ahead * ahead * exp(-up * 5.0));
        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  })
  return new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 24, 12), material)
}

function createStars() {
  const positions = new Float32Array(STAR_COUNT * 3)
  const sizes = new Float32Array(STAR_COUNT)
  const phases = new Float32Array(STAR_COUNT)
  const at = new THREE.Vector3()
  for (let i = 0; i < STAR_COUNT; i++) {
    at.randomDirection()
    at.y = Math.abs(at.y) * 0.9 + 0.12
    at.normalize().multiplyScalar(SKY_RADIUS - 200).toArray(positions, i * 3)
    sizes[i] = Math.random() < BRIGHT_STARS ? rand(2.4, 3.4) : rand(1.2, 1.9)
    phases[i] = rand(0, Math.PI * 2)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1))
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xcfe0ff) }, uTime: { value: 0 }, uShining: { value: 1 } },
    // Added to the sky behind, so that stars can come out of a sky still light.
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float phase;
      uniform float uTime;
      varying float vGlow;
      void main() {
        // Bigger stars are brighter and waver more.
        float big = smoothstep(1.9, 2.4, size);
        vGlow = (0.7 + 0.5 * big) * (1.0 - (0.15 + 0.3 * big) * (0.5 + 0.5 * sin(uTime * (1.0 + phase) + phase * 7.0)));
        gl_PointSize = size;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uShining;
      varying float vGlow;
      void main() {
        gl_FragColor = vec4(uColor * (vGlow * uShining), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  return new THREE.Points(geometry, material)
}

function createMoon() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const halo = ctx.createRadialGradient(size / 2, size / 2, size / 8, size / 2, size / 2, size / 2)
  halo.addColorStop(0, 'rgba(170, 200, 255, 0.35)')
  halo.addColorStop(0.35, 'rgba(150, 185, 255, 0.1)')
  halo.addColorStop(1, 'rgba(150, 185, 255, 0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#f6f8ff'
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 8, 0, Math.PI * 2)
  ctx.fill()
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map, fog: false, depthWrite: false }))
  moon.scale.setScalar(MOON_SIZE)
  moon.position.copy(MOON_DIRECTION).multiplyScalar(SKY_RADIUS - 400)
  return moon
}

export class Atmosphere {
  constructor(scene) {
    this._fog = new THREE.Fog(FOG_COLOR.clone(), FOG_NEAR, FOG_FAR)
    scene.fog = this._fog

    this._fogBase = FOG_COLOR.clone() // the fog's colour before any fire warms it
    this._dome = createDome(this._fog.color)
    this._stars = createStars()
    this._moon = createMoon()
    this._sky = new THREE.Group().add(this._dome, this._stars, this._moon)
    scene.add(this._sky)

    this._ambient = new THREE.HemisphereLight(0x9dbfe0, 0x1a2530, 1.7)
    this._sun = new THREE.DirectionalLight(0xb4ccff, 1.6) // the moon, on a night level
    this._sunFrom = MOON_DIRECTION.clone() // towards the sun
    // To and from a frame that looks along the sun's light, where its shadow texels are square.
    this._sunTurn = new THREE.Quaternion()
    this._sunBack = new THREE.Quaternion()
    this._sun.castShadow = true
    const { shadow } = this._sun
    shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP)
    shadow.camera.left = shadow.camera.bottom = -SHADOW_SPAN / 2
    shadow.camera.right = shadow.camera.top = SHADOW_SPAN / 2
    shadow.camera.near = 1
    shadow.camera.far = SHADOW_DEPTH
    // Flat-shaded faces at a grazing sun shade themselves without this.
    shadow.normalBias = 0.6
    shadow.bias = -0.0004
    scene.add(this._ambient, this._sun, this._sun.target)

    this._drift = new THREE.Vector3() // how far the wind has carried the air, in metres
    /**
     * The air as the picture's mist needs it (`Picture.setLook`'s `air`), the same objects
     * always, to be read and not changed: `drift`, how far the wind has carried it, in game
     * time; `sunFrom`, the way to the sun (or moon); `sun`, its colour just now.
     */
    this.air = { drift: this._drift, sunFrom: this._sunFrom, sun: this._sun.color }

    // Always in the scene, dark until there is a fire: adding a light later would stall the
    // frame while every material is rebuilt for it.
    this._fireFill = new THREE.DirectionalLight(0xff7a3a, 0)
    this._fireFill.position.set(0, 0.2, -1)
    scene.add(this._fireFill)

    this._loom = 0
    this._look = null // what the loaded theme asks for at the start of its level
    this._later = null // and at the far end, if that is different
    this._laterBetween = LATER_BETWEEN // where along the level the one turns into the other
    this._visit = null // the looks of a place being visited, as `looksOf` gives them (`setVisit`)
    this._here = null // scratch: the theme's look just now, and the visited place's
    this._there = null
  }

  /**
   * Takes on the sky, fog and light of a level's theme (an entry of THEMES), as they are at the
   * start of the level. Stars and moon are for night skies.
   */
  setTheme(theme) {
    const { look, later, between } = looksOf(theme)
    this._look = look
    this._later = later
    this._laterBetween = between
    this._cycle = theme.cycle ? cycleOf(theme) : null
    this._here = lookOf(theme)
    this._sunFrom.fromArray(theme.light.sunFrom).normalize()
    this._sunBack.setFromRotationMatrix(_matrix.lookAt(this._sunFrom, _spot.set(0, 0, 0), THREE.Object3D.DEFAULT_UP))
    this._sunTurn.copy(this._sunBack).invert()
    this._wear(this._look, this._look, 0)
  }

  /**
   * Makes ready the sky, fog and light of a place within the world that has a theme of its
   * own (`theme`, an entry of THEMES), to be turned to as `present` is told it nears; null for
   * none. The sun stays where the world's own theme has it.
   */
  setVisit(theme) {
    this._visit = theme && looksOf(theme)
    this._there = theme && lookOf(theme)
  }

  // Puts on the look that is `mix` of the way from `from` to `to`.
  _wear(from, to, mix) {
    const { lerp } = THREE.MathUtils
    const { uTop, uHorizon, uAfterglow } = this._dome.material.uniforms
    uTop.value.lerpColors(from.top, to.top, mix)
    uHorizon.value.lerpColors(from.horizon, to.horizon, mix)
    uAfterglow.value.lerpColors(from.afterglow, to.afterglow, mix)
    const shining = lerp(from.shining, to.shining, mix)
    this._stars.visible = this._moon.visible = shining > 0
    this._stars.material.uniforms.uShining.value = shining
    this._moon.material.opacity = shining
    this._fogBase.lerpColors(from.fog, to.fog, mix)
    this._fog.near = lerp(from.fogNear, to.fogNear, mix)
    this._fog.far = lerp(from.fogFar, to.fogFar, mix)
    this._ambient.color.lerpColors(from.skyLight, to.skyLight, mix)
    this._ambient.groundColor.lerpColors(from.groundLight, to.groundLight, mix)
    this._ambient.intensity = lerp(from.ambient, to.ambient, mix)
    this._sun.color.lerpColors(from.sun, to.sun, mix)
    this._sun.intensity = lerp(from.sunPower, to.sunPower, mix)
  }

  /**
   * Call once per frame. `eye` is where the camera is; `fireNearness` runs from 0 (no fire,
   * or far behind) to 1 (the front is on top of the eye). `shadowFocus` is the spot on the ground the
   * sun's shadows should be drawn around, and `wayAlong` how far along the level the player
   * has got, 0 to 1, which is what a theme that changes goes by. `visit` is how much of the place made
   * ready by `setVisit` is about the eye, `{ near, along }`: `near` from 0 (none of it) to 1
   * (all of it), `along` what `wayAlong` is to the level; null with no such place.
   */
  present(dt, eye, fireNearness, shadowFocus, wayAlong, visit = null) {
    this._loom += (fireNearness - this._loom) * Math.min(1, LOOM_EASE * dt)
    const loom = this._loom
    const { smoothstep } = THREE.MathUtils
    const turned = this._later ? smoothstep(wayAlong, ...this._laterBetween) : 0
    if (this._cycle) {
      const [from, to, mix] = aroundCycle(this._cycle, wayAlong)
      this._wear(from, to, smoothstep(mix, 0, 1))
    } else if (this._visit && visit && visit.near > 0) {
      const { look, later, between } = this._visit
      const here = this._later ? mixLooks(this._here, this._look, this._later, turned) : this._look
      const there = later ? mixLooks(this._there, look, later, smoothstep(visit.along, ...between)) : look
      this._wear(here, there, visit.near)
    } else if (this._later) this._wear(this._look, this._later, turned)
    else if (this._visit) this._wear(this._look, this._look, 0) // back from a visit, under a sky that does not change

    this._sky.position.copy(eye)
    this._stars.material.uniforms.uTime.value += dt
    this._dome.material.uniforms.uFire.value = loom
    // The dome reads this same colour, so the horizon stays seamless as the haze warms.
    this._fog.color.copy(this._fogBase).lerp(HAZE_COLOR, HAZE_AT_FULL * loom)
    this._fireFill.intensity = FIRE_FILL * loom
    this._drift.addScaledVector(WIND, dt)
    this._aimSun(shadowFocus)
  }

  // Stands the sun over `shadowFocus`, moved only in whole shadow texels across its own light so
  // that shadow edges hold still as the player flies.
  _aimSun(shadowFocus) {
    _spot.copy(shadowFocus).applyQuaternion(this._sunTurn)
    _spot.x = Math.round(_spot.x / SHADOW_TEXEL) * SHADOW_TEXEL
    _spot.y = Math.round(_spot.y / SHADOW_TEXEL) * SHADOW_TEXEL
    _spot.applyQuaternion(this._sunBack)
    this._sun.target.position.copy(_spot)
    this._sun.position.copy(_spot).addScaledVector(this._sunFrom, SHADOW_DEPTH / 2)
  }
}
