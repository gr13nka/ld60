// How painted surfaces take light: in a few steps, as in a cartoon cel, or shading smoothly
// from lit to dark. Every lit surface in the game is made here, so the look is changed in one
// place, and can be switched while the game runs.

import * as THREE from 'three'

// A ramp says how bright a face is by how squarely it meets the light. `steps` run from facing
// away (first) to facing it (last), the first half being everything turned away from the light;
// `blend` is how much of the way from one step to the next is a smooth passage rather than an
// edge (0 is a hard cel edge).
//
// The hard ramp is the game's own: shadow sides near black, two lit steps. The soft one is for
// a bright place (`docs/research/visual-style.md`): the shadow side keeps most of its paint, as
// light bounced off limewash would leave it, and the passages between steps are soft, so a
// form reads by its half-tones and not by black.
//
// The brut one is for raw concrete in hard daylight (`THEMES.brut`): the shadow side dark enough
// for a mass to read as heavy, yet not the hard ramp's black, so its formwork still shows there.
//
// `smooth` is no ramp: light falls off evenly as a face turns from it, as in any game not drawn
// as a cartoon (`themes.js`'s `LOOKS.eggs`).
//
// A ramp may also be `{ wrap, lift }`: light falling off smoothly but wrapping round past the
// edge-on by `wrap` (0 none, 1 half way round the dark side), over a shadow side kept at `lift`
// of full, as clay and feathers take it (a material's own, `celMaterial`'s `ramp`: the gull's).
export const RAMPS = {
  hard: { steps: [0.12, 0.12, 0.6, 1], blend: 0 },
  soft: { steps: [0.34, 0.4, 0.7, 1], blend: 0.35 },
  brut: { steps: [0.2, 0.24, 0.66, 1], blend: 0.2 },
  smooth: null,
}
const RAMP_SIZE = 64

// One ramp shared by every material and rewritten in place: swapping materials or textures
// instead would rebuild every shader mid-game.
const ramp = rampTexture()
setShade(RAMPS.hard)
const OWN = new Map() // a shade to the ramp a material takes in place of the look's, made once

function rampTexture() {
  const texture = new THREE.DataTexture(new Uint8Array(RAMP_SIZE), RAMP_SIZE, 1, THREE.RedFormat)
  texture.minFilter = texture.magFilter = THREE.LinearFilter
  return texture
}

/**
 * How every lit surface takes light from now on: a ramp of `RAMPS` (or one shaped like them),
 * a `{ wrap, lift }`, or `null` for smooth shading. `Picture.setLook` owns the switch and sets
 * the ink outlines with it.
 */
export function setShade(shade) {
  fill(ramp, shade)
}

function fill(texture, shade) {
  for (let i = 0; i < RAMP_SIZE; i++) {
    const facing = i / (RAMP_SIZE - 1) // 0 turned away from the light, 0.5 edge-on, 1 square to it
    texture.image.data[i] = Math.round(Math.min(1, shade?.steps ? stepped(shade, facing) : wrapped(shade ?? {}, facing)) * 255)
  }
  texture.needsUpdate = true
}

// Smooth light at `facing`, wrapped round past the edge-on and over a lifted shadow side.
function wrapped({ wrap = 0, lift = 0 }, facing) {
  return lift + (1 - lift) * Math.max(0, (facing * 2 - 1 + wrap) / (1 + wrap))
}

// A ramp's brightness at `facing`: its step there, eased toward the next over the last `blend`
// of the step's width.
function stepped({ steps, blend }, facing) {
  const at = Math.min(steps.length - 1, facing * steps.length)
  const step = Math.floor(at)
  const next = Math.min(steps.length - 1, step + 1)
  const into = at - step // 0 to 1 across this step
  const passage = blend > 0 ? THREE.MathUtils.smoothstep(into, 1 - blend, 1) : 0
  return THREE.MathUtils.lerp(steps[step], steps[next], passage)
}

/**
 * A material lit by that ramp. Takes what a `MeshLambertMaterial` would: colour, emissive, map, flat shading and so on.
 * `ramp`, anything `setShade` takes, lights it so whatever the look's: what turns all the time
 * (a bird's wingbeat) flickers as its faces cross a cel's edges.
 */
export function celMaterial({ ramp: own, ...options }) {
  return new THREE.MeshToonMaterial({ gradientMap: own === undefined ? ramp : ownRamp(own), ...options })
}

function ownRamp(shade) {
  if (!OWN.has(shade)) {
    const texture = rampTexture()
    fill(texture, shade)
    OWN.set(shade, texture)
  }
  return OWN.get(shade)
}

// Grain: the fine relief of a real surface laid over a paint, from `textures/grain.jpg`
// (`scripts/textures/pack.py`), which holds one CC0 material's height in each channel. It only
// darkens and lightens the paint a little, so a colour stays one colour and a form reads as
// flat as before; up close it is limewash or concrete and not plastic. In a look with `relief`
// it is lit as well (`setSurface`): the surface's facing is bent by the height's slope, so a pit
// or a trowel mark catches a lamp at a glance as a real one would. It is laid by where a
// point is in the world, from the three sides, because the forms it is for have no texture
// coordinates. Two sizes: the fine one fades out before it can shimmer, the broad one, a
// weathering of the paint over tens of metres, is kept farther.
// Each kind's share of its channel: concrete's own relief is blotchy, and at full it read as wet stone.
// A fourth number draws formwork over it (`formworkAt`): concrete cast in boards, its pattern
// drawn by the paint and not by the theme, so it shows in any light.
// Fifth, sixth and seventh: tie holes (`tiesAt`), moss and drips (`mossAt`), each a strength, drawn over
// any surface, so an old wall's weathering is the paint's and not a texture file's.
export const GRAIN = {
  lime: [1, 0, 0],
  concrete: [0, 0.5, 0],
  paint: [0, 0, 1],
  bare: [0, 0, 0],
  formwork: [0, 0.5, 0, 1],
  mossy: [0, 0.5, 0, 0, 0, 1, 0.8], // cast concrete grown over
  tied: [0, 0.5, 0, 1, 1, 0.5, 0.7], // boards, tie holes, a little moss
  stained: [0, 0.5, 0, 0, 0.6, 0.35, 1], // slabs and decks: runs and holes, little green
}
const GRAIN_TILE = [2.4, 37] // metres a tile of the fine grain and of the broad covers
const GRAIN_BROAD = 0.35 // the broad grain's share of the strength
const GRAIN_FADE = [40, 160] // metres over which the fine grain thins out to nothing
const GRAIN_FADE_BROAD = [150, 500]
const RELIEF_DEPTH = 3 // how steep the height's slope is taken, a pixel's change of it to the normal's lean, at `relief` 1
const GRAIN_URL = new URL('./textures/grain.jpg', import.meta.url).href

// Shared by every grained material, so that one call changes them all with nothing rebuilt.
// Until the picture has come it is mid-grey, which is no grain at all.
const grain = {
  uGrainMap: { value: new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1) },
  uGrainStrength: { value: 0 },
  uRelief: { value: 0 },
}
grain.uGrainMap.value.needsUpdate = true
let grainLoading = false

function loadGrain() {
  if (grainLoading) return
  grainLoading = true
  new THREE.TextureLoader().load(GRAIN_URL, (texture) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.anisotropy = 4
    grain.uGrainMap.value = texture // a uniform's value swapped: no material is rebuilt
  })
}

// Wear, from `textures/wear.jpg` (`scripts/textures/paint.py`): streaks of grime in green,
// broad patches in blue (red is not read). Laid as the grain is, from three sides by where a
// point is, the streaks small (6 m) and large (30 m), the patches large.
// - `wear.patches`: how thickly dirt lies over the paint in the broad patches;
// - `wear.streaks`: how dark the runs of grime are down an upright face;
// - `wear.dirt`: the grime's colour, what patches and streaks lean toward.
const WEAR_TILE = [6, 30] // metres a tile of the fine wear and of the broad
const WEAR_FADE = [15, 60] // metres over which the fine wear thins out to nothing: farther, its tiles were seen to repeat
const WEAR_FADE_BROAD = [200, 600]
const WEAR_URL = new URL('./textures/wear.jpg', import.meta.url).href

// Shared by every grained material, as the grain's are. Mid-grey until the picture comes: no patches, a little streak.
const wear = {
  uWearMap: { value: new THREE.DataTexture(new Uint8Array([128, 0, 128, 255]), 1, 1) },
  uWear: { value: new THREE.Vector2() }, // patches, streaks
  uDirt: { value: new THREE.Color() },
}
wear.uWearMap.value.needsUpdate = true
let wearLoading = false

/**
 * How every grained surface is painted from now on, by a look's surface parts (`themes.js`'s
 * `LOOKS`): `grain` (0 none, about 0.3 plain to see), `relief` (0 none, 1 plain) and `wear` as
 * said above; any left out is none. `null` for none of them.
 */
export function setSurface(look) {
  const { grain: strength = 0, relief = 0, wear: worn = {} } = look ?? {}
  grain.uGrainStrength.value = strength
  grain.uRelief.value = relief
  wear.uWear.value.set(worn.patches ?? 0, worn.streaks ?? 0)
  wear.uDirt.value.setHex(worn.dirt ?? 0x000000)
}

function loadWear() {
  if (wearLoading) return
  wearLoading = true
  new THREE.TextureLoader().load(WEAR_URL, (texture) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.anisotropy = 4
    texture.colorSpace = THREE.NoColorSpace // numbers, not a colour
    wear.uWearMap.value = texture
  })
}

/**
 * A `celMaterial` with grain over its paint: `kind` is one of `GRAIN`, the surface it is
 * painted on. Every grained material is one shader program; only `kind` differs.
 */
export function grainedMaterial(options, kind) {
  const material = celMaterial(options)
  const mask = { value: new THREE.Vector3(...kind) }
  const formwork = { value: kind[3] ?? 0 }
  const weather = { value: new THREE.Vector3(kind[4] ?? 0, kind[5] ?? 0, kind[6] ?? 0) } // ties, moss, drips
  material.onBeforeCompile = (shader) => {
    loadGrain()
    loadWear()
    Object.assign(shader.uniforms, grain, wear, { uGrainMask: mask, uFormwork: formwork, uWeather: weather })
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vGrainAt;\nvarying vec3 vGrainNormal;\nvoid main() {')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vGrainAt = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vGrainNormal = mat3(modelMatrix) * objectNormal;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform sampler2D uGrainMap;
        uniform float uGrainStrength;
        uniform vec3 uGrainMask;
        varying vec3 vGrainAt;
        varying vec3 vGrainNormal;
        // The grain at a point, seen from the three sides and blended by which way the surface faces.
        float grainAt(vec3 at, vec3 weights) {
          vec3 g = texture2D(uGrainMap, at.zy).rgb * weights.x + texture2D(uGrainMap, at.xz).rgb * weights.y + texture2D(uGrainMap, at.xy).rgb * weights.z;
          return dot(g, uGrainMask) - 0.5 * (uGrainMask.x + uGrainMask.y + uGrainMask.z);
        }
        uniform sampler2D uWearMap;
        uniform vec2 uWear;
        uniform vec3 uDirt;
        vec3 wearAt(vec3 at, vec3 weights) {
          return texture2D(uWearMap, at.zy).rgb * weights.x + texture2D(uWearMap, at.xz).rgb * weights.y + texture2D(uWearMap, at.xy).rgb * weights.z;
        }
        uniform float uRelief;
        // The facing bent by a height's slope: Mikkelsen's bump without texture coordinates, as
        // three's own (\`bumpmap_pars_fragment\`), which a material without a bump map does not
        // have. The picture's steps are taken as they are, so a pixel's change of height leans a
        // face the same near and far.
        vec3 reliefNormal(vec3 at, vec3 facing, vec2 slope, float faceDirection) {
          vec3 sigmaX = normalize(dFdx(at));
          vec3 sigmaY = normalize(dFdy(at));
          vec3 r1 = cross(sigmaY, facing);
          vec3 r2 = cross(facing, sigmaX);
          float det = dot(sigmaX, r1) * faceDirection;
          vec3 grad = sign(det) * (slope.x * r1 + slope.y * r2);
          return normalize(abs(det) * facing - grad);
        }
        uniform float uFormwork;
        // Formwork on an upright face, at a man's size, which is what makes a wall's size
        // countable: the print of boards 0.3 m tall, each a shade lighter or darker; the faint
        // joints of the panels they were nailed into, 2.4 m across and 1.2 m up; and, plainest,
        // a pour line every 2.4 m up, so a wall reads as courses and not as tiles. The boards
        // fade out first, the lines before they can shimmer.
        float formworkAt(vec3 at, vec3 n, float away) {
          if (abs(n.y) > 0.5) return 0.0;
          float along = abs(n.x) > abs(n.z) ? at.z : at.x;
          vec2 cell = vec2(along / 2.4, at.y / 1.2);
          vec2 seam = (0.5 - abs(fract(cell) - 0.5)) * vec2(2.4, 1.2); // metres to the nearest joint, across and up
          vec2 blur = max(fwidth(cell) * vec2(2.4, 1.2), vec2(0.001));
          float across = 1.0 - smoothstep(0.02, 0.02 + 1.5 * blur.x, seam.x);
          float up = 1.0 - smoothstep(0.02, 0.02 + 1.5 * blur.y, seam.y);
          float pour = 1.0 - smoothstep(0.05, 0.05 + 1.5 * blur.y, (0.5 - abs(fract(at.y / 2.4) - 0.5)) * 2.4);
          float board = fract(sin(dot(vec2(floor(at.y / 0.3), floor(cell.x)), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
          float near = 1.0 - smoothstep(40.0, 140.0, away);
          float far = 1.0 - smoothstep(100.0, 350.0, away);
          return 0.08 * board * near - (0.06 * across + 0.04 * up) * near - 0.14 * pour * far;
        }
        uniform vec3 uWeather;
        float hash21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        // The holes tie rods left through a cast wall: on a grid of 1.8 m across and 1.2 m up, a
        // few missing, each a dark pit with a rust ring that runs a little down. x is the pit, y the ring.
        vec2 tiesAt(vec3 at, vec3 n, float away) {
          if (abs(n.y) > 0.5) return vec2(0.0);
          float along = abs(n.x) > abs(n.z) ? at.z : at.x;
          vec2 cell = vec2(along / 1.8, at.y / 1.2);
          vec2 id = floor(cell);
          vec2 local = (fract(cell) - 0.5) * vec2(1.8, 1.2);
          float present = step(0.18, hash21(id));
          vec2 d = local - vec2(0.0, 0.0);
          float pit = 1.0 - smoothstep(0.05, 0.075, length(d));
          float ring = 1.0 - smoothstep(0.09, 0.2, length(d * vec2(1.0, 0.7) + vec2(0.0, 0.06)));
          float near = 1.0 - smoothstep(25.0, 90.0, away);
          return vec2(pit, ring - pit) * present * near;
        }
        // Moss and algae, from the wear map's patches: gathers on what faces up and where the grime
        // runs, and is faded out far off with the rest of the fine wear. Returns its share of a point.
        float mossAt(vec3 at, vec3 facing, vec3 weights, float away) {
          vec3 damp = wearAt(at / 17.0, weights);
          vec3 run = wearAt(at / 6.0, weights);
          float up = clamp(facing.y, 0.0, 1.0);
          float low = 1.0 - smoothstep(0.35, 0.7, abs(facing.y));
          float field = damp.b + 0.5 * wearAt(at / 3.1, weights).b + 0.3 * up + 0.35 * run.g * low;
          return smoothstep(1.0, 1.45, field) * (1.0 - smoothstep(60.0, 220.0, away));
        }
        void main() {`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (uGrainStrength > 0.0) {
          vec3 weights = pow(abs(normalize(vGrainNormal)), vec3(4.0));
          weights /= weights.x + weights.y + weights.z;
          float away = length(vGrainAt - cameraPosition);
          float fine = grainAt(vGrainAt / ${GRAIN_TILE[0].toFixed(2)}, weights) * (1.0 - smoothstep(${GRAIN_FADE[0].toFixed(1)}, ${GRAIN_FADE[1].toFixed(1)}, away));
          float broad = grainAt(vGrainAt / ${GRAIN_TILE[1].toFixed(2)}, weights) * (1.0 - smoothstep(${GRAIN_FADE_BROAD[0].toFixed(1)}, ${GRAIN_FADE_BROAD[1].toFixed(1)}, away));
          diffuseColor.rgb *= 1.0 + 2.0 * uGrainStrength * (fine + ${GRAIN_BROAD.toFixed(2)} * broad);
        }
        if (uFormwork > 0.0) diffuseColor.rgb *= 1.0 + uFormwork * formworkAt(vGrainAt, normalize(vGrainNormal), length(vGrainAt - cameraPosition));
        if (uWear.x + uWear.y > 0.0) {
          vec3 facing = normalize(vGrainNormal);
          vec3 weights = pow(abs(facing), vec3(4.0));
          weights /= weights.x + weights.y + weights.z;
          float away = length(vGrainAt - cameraPosition);
          float near = 1.0 - smoothstep(${WEAR_FADE[0].toFixed(1)}, ${WEAR_FADE[1].toFixed(1)}, away);
          float far = 1.0 - smoothstep(${WEAR_FADE_BROAD[0].toFixed(1)}, ${WEAR_FADE_BROAD[1].toFixed(1)}, away);
          vec3 fine = wearAt(vGrainAt / ${WEAR_TILE[0].toFixed(2)}, weights);
          vec3 broad = wearAt(vGrainAt / ${WEAR_TILE[1].toFixed(2)}, weights);
          // Patches of dirt over the paint, and on a wall, runs of it down from wherever.
          float upright = 1.0 - smoothstep(0.35, 0.7, abs(facing.y));
          float blotch = smoothstep(0.5, 0.95, broad.b) * far;
          float streak = clamp(broad.g * far + 0.6 * fine.g * near, 0.0, 1.0) * upright * (0.5 + broad.b);
          diffuseColor.rgb = mix(diffuseColor.rgb, uDirt, clamp(0.6 * uWear.x * blotch + 0.8 * uWear.y * streak, 0.0, 0.85));
        }
        if (uWeather.x + uWeather.y + uWeather.z > 0.0) {
          vec3 facing = normalize(vGrainNormal);
          vec3 weights = pow(abs(facing), vec3(4.0));
          weights /= weights.x + weights.y + weights.z;
          float away = length(vGrainAt - cameraPosition);
          float upright = 1.0 - smoothstep(0.35, 0.7, abs(facing.y));
          float luma = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
          // runs of damp down an upright face
          float runs = wearAt(vec3(vGrainAt.x, vGrainAt.y * 0.25, vGrainAt.z) / 9.0, weights).g * upright * (1.0 - smoothstep(30.0, 200.0, away));
          diffuseColor.rgb *= 1.0 - 0.38 * uWeather.z * runs;
          float moss = mossAt(vGrainAt, facing, weights, away) * uWeather.y;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.36, 0.13) * (0.55 + 1.1 * luma), 0.78 * moss);
          vec2 tie = tiesAt(vGrainAt, facing, away) * uWeather.x;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.2, 0.1) * (0.5 + luma), 0.55 * tie.y);
          diffuseColor.rgb *= 1.0 - 0.7 * tie.x;
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        if (uRelief > 0.0) {
          vec3 reliefWeights = pow(abs(normalize(vGrainNormal)), vec3(4.0));
          reliefWeights /= reliefWeights.x + reliefWeights.y + reliefWeights.z;
          float height = grainAt(vGrainAt / ${GRAIN_TILE[0].toFixed(2)}, reliefWeights);
          float reliefNear = 1.0 - smoothstep(${GRAIN_FADE[0].toFixed(1)}, ${GRAIN_FADE[1].toFixed(1)}, length(vGrainAt - cameraPosition));
          vec2 slope = vec2(dFdx(height), dFdy(height)) * uRelief * ${RELIEF_DEPTH.toFixed(1)} * reliefNear;
          normal = reliefNormal(-vViewPosition, normal, slope, faceDirection);
        }`,
      )
  }
  return material
}
