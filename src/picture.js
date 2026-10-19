// The finished frame. The scene is drawn at most `PICTURE_LINES` tall, then in turn: ink
// outlines and darkened creases from its depth, a place's mists where it has any, the glow that
// bright things shed into what is around them, the lens (the blur of speed, the vignette, the
// tint of shadow, a look's grade and palette), the tone mapping a look may have, and on the way to the
// screen either a look's PlayStation screen or the upscale. Stands in for the renderer
// wherever a scene is drawn, and is what is made cheaper (`cheapen`) or readied ahead
// (`prepare`) when the machine is not keeping up.
//
// The scene has a frame of its own, the only one with anti-aliasing and a depth; everything
// after it is drawn through two plain ones. Anti-aliasing on those was paid for in every pass
// (a quarter of the frame, in Chrome on an M2), and a pass that draws into the frame whose
// depth it reads is answered by a strict browser with a black screen.
//
// That picture is small, and the canvas is not: the last pass (`SharpPass`) brings it up to
// the screen's own pixels, following its edges, and sharpens it there. Left to the browser,
// the stretch is a blur at full size and blocks once `cheapen` has cut the lines.

import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { RAMPS, setShade, setSurface } from './shading.js'

// Brightness is measured before the screen's gamma, where moonlit surfaces stay under about
// 0.35 and only lamps, flames and whatever stands right next to a fire get past the threshold.
const BLOOM_THRESHOLD = 0.6
const BLOOM_STRENGTH = 0.5
const BLOOM_RADIUS = 0.85 // wide and soft: a halo round a lamp, not a hard rim
const SAMPLES = 2 // the canvas's own anti-aliasing does not reach an off-screen frame
// The picture is never drawn taller than this many lines; a bigger window gets it stretched,
// smoothly. That is what pays for the shadows and the blur.
const PICTURE_LINES = 720
const MIN_SCALE = 0.5
// The canvas itself is the screen's size, up to this many lines: the picture is brought up to
// it by `SharpPass`. More than this and the pass costs a weak card what it was meant to save.
const OUTPUT_LINES = 1080
const SHARPENING_STOPS = 0.3 // how far short of its hardest the sharpening stops, in halvings: 0 is hardest and rings round the ink; a look's `sharpen` in its place
const SCALE_STEP = 0.85
const BLUR_REACH = 0.14 // at full speed, how far a corner smears towards the centre, as a share of the way there
const BLUR_CLEAR = 0.35 // the middle of the picture, as a share of its half-height, that stays sharp
const SPEED_FRINGE = 0.012 // at full speed, how far red and blue part at a corner, as a share of the way to the centre
const SPEED_VIGNETTE = 0.3 // how much the corners darken at full speed, on top of the level's own vignette
// A tunnel darkens the picture in a circle about its middle, from `TUNNEL_FROM` half-heights out to all of it at
// `TUNNEL_TO`, which is the corners of a 16:9 frame. The shape is VHOLUME's (`docs/research/vholume-camera.md`).
const TUNNEL_FROM = 0.1
const TUNNEL_TO = 2.0

// The game's ink, which a theme's `shade.ink` may change in any part (`themes.js`):
// - `color` and `strength`: what a full line is, and how much of the picture under it it covers;
// - `edge`: a line is drawn where the distance to what is seen jumps, between neighbouring
//   pixels, by more than the first share of itself, and is full by the second. Lower draws more
//   lines (the creases of the terrain among them), higher only the outlines of things;
// - `fade`: metres over which the lines thin out to nothing, so the distance stays calm.
const INK = { color: 0x0b0d14, strength: 0.85, edge: [0.03, 0.08], fade: [220, 600] }

// A theme's mist (`MistPass`): how tightly its glow gathers about the sun, as the power of how
// nearly a line of sight looks at it (higher is a smaller halo); and how far out its banks are
// read, in metres. Beyond that a line takes the bank that far along it, and the banks fade out
// on the way there, so that far mist is even and does not crawl.
const MIST_GLOW_TIGHTNESS = 8
const MIST_BANK_REACH = 400
// How many mists can lie at once (`setLook`'s `mists`): each one more is its sums again for every pixel.
const MIST_LAYERS = 5

// Creases (`setLook`'s `shade.occlusion`): how many points about a pixel are asked how far they
// are, the most pixels out they are looked for however near the surface, and the metres over
// which the darkening thins out to nothing, where the depth is too coarse to tell a crease from
// a flat wall.
const CREASE_TAPS = 12
const CREASE_REACH = 64
const CREASE_FADE = [120, 360]

// Filmic tone mapping by a look's `tone` (`themes.js`'s `LOOKS`): how light brighter than white is
// brought down into the screen's range, gently, as film does, instead of being cut off.
const TONES = { agx: THREE.AgXToneMapping, aces: THREE.ACESFilmicToneMapping, neutral: THREE.NeutralToneMapping }
const UNGRADED = [1, 1, 1]

// Brings the scene into the passes, from the frame it was drawn to (`frame`), marking the shape
// of what is seen from how far each pixel is. `inked`, it draws dark outlines round whatever
// stands in front of something farther away; given `occlusion`, it darkens creases, corners and
// the feet of walls, where the light of the open sky reaches less. With neither the scene goes
// on as it is.
//
// The darkening is asked of the scene's depth alone, which this pass reads anyway: the usual
// ways (three's SAO and GTAO) draw the whole scene a second time for its normals. Each pixel
// asks a few points in a spiral about it, turned a different way at each pixel so that what
// one misses its neighbour sees, how far above its surface they stand; its surface's facing
// is found from its neighbours' depths, from whichever side does not cross an edge.
class ShapePass extends Pass {
  constructor(frame) {
    super()
    this._frame = frame
    this.inked = true
    /**
     * `{ strength, radius, grime }`: how dark a crease goes (1 takes about half the light from a
     * deep corner), over how many metres it is looked for, and the colour it darkens toward,
     * as grime gathers there (black unless said); null for none.
     */
    this.occlusion = null
    this._inkStrength = INK.strength
    this._plain = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: frame.texture } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(tDiffuse, vUv);
        }
      `,
      depthTest: false,
      depthWrite: false,
    })
    this._material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uNear: { value: 1 },
        uFar: { value: 1 },
        uView: { value: new THREE.Vector2(1, 1) },
        uInk: { value: new THREE.Color(INK.color) },
        uStrength: { value: INK.strength },
        uEdge: { value: new THREE.Vector2(...INK.edge) },
        uFade: { value: new THREE.Vector2(...INK.fade) },
        uOcclusion: { value: new THREE.Vector2() }, // strength, radius in metres
        uGrime: { value: new THREE.Color() },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform vec2 uTexel;
        uniform float uNear;
        uniform float uFar;
        uniform vec2 uView; // how far the picture reaches to its right and top edges, for each metre ahead
        uniform vec3 uInk;
        uniform float uStrength;
        uniform vec2 uEdge;
        uniform vec2 uFade;
        uniform vec2 uOcclusion;
        uniform vec3 uGrime;
        varying vec2 vUv;

        // About near / distance: unlike distance itself, this changes evenly across any
        // flat surface on screen, so only an edge or a crease bends it.
        float closeness(vec2 uv) {
          return 1.0 - texture2D(tDepth, uv).r;
        }
        // Where a pixel is, before the camera, in metres: x right, y up, looking down -z.
        vec3 seen(vec2 uv, float closeness_) {
          float ahead = uNear * uFar / (closeness_ * (uFar - uNear) + uNear);
          return vec3((uv * 2.0 - 1.0) * uView * ahead, -ahead);
        }
        // Jimenez's interleaved gradient noise: neighbouring pixels as unlike as can be.
        float scatter(vec2 at) {
          return fract(52.9829189 * fract(dot(at, vec2(0.06711056, 0.00583715))));
        }
        // How much of the open sky a pixel's surface sees, 1 for all of it.
        float open(float here, float left, float right, float below, float above) {
          if (here <= 0.0) return 1.0; // the sky
          vec3 at = seen(vUv, here);
          vec3 toLeft = seen(vUv - vec2(uTexel.x, 0.0), left);
          vec3 toRight = seen(vUv + vec2(uTexel.x, 0.0), right);
          vec3 toBelow = seen(vUv - vec2(0.0, uTexel.y), below);
          vec3 toAbove = seen(vUv + vec2(0.0, uTexel.y), above);
          vec3 across = abs(toRight.z - at.z) < abs(at.z - toLeft.z) ? toRight - at : at - toLeft;
          vec3 up = abs(toAbove.z - at.z) < abs(at.z - toBelow.z) ? toAbove - at : at - toBelow;
          vec3 facing = normalize(cross(across, up));
          float radius = uOcclusion.y;
          float reach = radius / (-at.z * uView.y) * 0.5 / uTexel.y; // the radius in pixels, there
          if (reach < 1.0) return 1.0;
          reach = min(reach, ${CREASE_REACH.toFixed(1)});
          float turn = scatter(gl_FragCoord.xy) * 6.2832;
          float start = scatter(gl_FragCoord.yx + 17.0);
          float shut = 0.0;
          for (int i = 0; i < ${CREASE_TAPS}; i++) {
            float out_ = (float(i) + start) / ${CREASE_TAPS.toFixed(1)};
            float angle = turn + float(i) * 2.39996; // the golden angle: a spiral that never lines up
            vec2 tap = vUv + vec2(cos(angle), sin(angle)) * reach * out_ * uTexel;
            vec3 to = seen(tap, closeness(tap)) - at;
            float apart = length(to);
            // Above the surface and near enough to shade it; something far in front shades nothing.
            shut += max(dot(to, facing) / max(apart, 1e-4) - 0.05, 0.0) * (1.0 - smoothstep(0.5 * radius, radius, apart));
          }
          float sky = 1.0 - 4.0 * uOcclusion.x * shut / ${CREASE_TAPS.toFixed(1)};
          return mix(1.0, clamp(sky, 0.0, 1.0), 1.0 - smoothstep(${CREASE_FADE[0].toFixed(1)}, ${CREASE_FADE[1].toFixed(1)}, -at.z));
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float here = closeness(vUv);
          float left = closeness(vUv - vec2(uTexel.x, 0.0));
          float right = closeness(vUv + vec2(uTexel.x, 0.0));
          float below = closeness(vUv - vec2(0.0, uTexel.y));
          float above = closeness(vUv + vec2(0.0, uTexel.y));
          if (uOcclusion.x > 0.0) color.rgb *= mix(uGrime, vec3(1.0), open(here, left, right, below, above));
          float nearest = max(max(here, 1e-7), max(max(left, right), max(below, above)));
          float bend = abs(left + right + below + above - 4.0 * here) / nearest;
          float line = smoothstep(uEdge.x, uEdge.y, bend);
          line *= 1.0 - smoothstep(uFade.x, uFade.y, uNear / nearest);
          gl_FragColor = vec4(mix(color.rgb, uInk, line * uStrength), color.a);
        }
      `,
      depthTest: false,
      depthWrite: false,
    })
    this._quad = new FullScreenQuad(this._material)
    this.camera = null
  }

  /** The ink to draw with: the game's own (`INK`) with whatever `ink` gives in its place. */
  set ink(ink) {
    const { color, strength, edge, fade } = { ...INK, ...ink }
    const u = this._material.uniforms
    u.uInk.value.setHex(color)
    this._inkStrength = strength
    u.uEdge.value.set(...edge)
    u.uFade.value.set(...fade)
  }

  render(renderer, writeBuffer) {
    const { tDiffuse, tDepth, uTexel, uNear, uFar, uView, uStrength, uOcclusion, uGrime } = this._material.uniforms
    tDiffuse.value = this._frame.texture
    tDepth.value = this._frame.depthTexture
    uTexel.value.set(1 / this._frame.width, 1 / this._frame.height)
    uNear.value = this.camera.near
    uFar.value = this.camera.far
    const projection = this.camera.projectionMatrix.elements
    uView.value.set(1 / projection[0], 1 / projection[5])
    uStrength.value = this.inked ? this._inkStrength : 0
    uOcclusion.value.set(this.occlusion?.strength ?? 0, this.occlusion?.radius ?? 1)
    uGrime.value.setHex(this.occlusion?.grime ?? 0x000000)
    this._quad.material = this.inked || this.occlusion ? this._material : this._plain
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this._quad.render(renderer)
  }
}

// Lays a mist over the picture (`themes.js`'s `MISTS`): air that is thick low down and
// thinner by the same share for every `height` metres up, so that what stands in a depth is
// paler the deeper it stands, from wherever it is looked at. Each pixel's place is found from
// how far it is and the camera, and it takes as much mist as lies along the line of sight to
// it. It reads the scene's own depth and draws into a frame without one, as the ink does.
// What writes no depth (sparks, smoke, the sky) takes the mist of whatever is behind it.
// Two things make it air and not paint, both worked out per pixel with no more reads: looking
// toward the sun the mist is lit through and takes the sun's colour (`glow`), and it lies in
// banks, thicker and thinner in patches `size` metres across that the wind carries (`banks`).
// Several mists can lie at once, up to `MIST_LAYERS`, in the same pass: what each lets through
// is let through by the next, and what is taken has each one's colour as much as it took.
class MistPass extends Pass {
  constructor(frame) {
    super()
    this._frame = frame
    this.camera = null
    const layers = (make) => Array.from({ length: MIST_LAYERS }, make)
    this._material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        uNear: { value: 1 },
        uFar: { value: 1 },
        uProjectionInverse: { value: new THREE.Matrix4() },
        uCameraWorld: { value: new THREE.Matrix4() },
        uEye: { value: new THREE.Vector3() },
        uLayers: { value: 0 },
        uColor: { value: layers(() => new THREE.Color()) },
        uShape: { value: layers(() => new THREE.Vector4(0, 1, 0, 1)) }, // base, height, density, most
        uAir: { value: layers(() => new THREE.Vector3(0, 0, 1)) }, // glow, banks, size
        uSunFrom: { value: new THREE.Vector3(0, 1, 0) },
        uSun: { value: new THREE.Color() },
        uDrift: { value: new THREE.Vector2() },
      },
      vertexShader: /* glsl */ `
        uniform mat4 uProjectionInverse;
        uniform mat4 uCameraWorld;
        varying vec2 vUv;
        varying vec3 vRay; // in the world, to this pixel, for each metre of depth before the camera
        void main() {
          vUv = uv;
          vec4 far = uProjectionInverse * vec4(position.xy, 1.0, 1.0);
          vec3 seen = far.xyz / far.w;
          vRay = mat3(uCameraWorld) * (seen / -seen.z);
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform float uNear;
        uniform float uFar;
        uniform vec3 uEye;
        uniform int uLayers;
        uniform vec3 uColor[${MIST_LAYERS}];
        uniform vec4 uShape[${MIST_LAYERS}];
        uniform vec3 uAir[${MIST_LAYERS}];
        uniform vec3 uSunFrom;
        uniform vec3 uSun;
        uniform vec2 uDrift;
        varying vec2 vUv;
        varying vec3 vRay;
        // Dave Hoskins' hash, without a sine, so that it is the same on every card.
        float hash(vec2 p) {
          vec3 q = fract(vec3(p.xyx) * 0.1031);
          q += dot(q, q.yzx + 33.33);
          return fract((q.x + q.y) * q.z);
        }
        float lumps(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float closeness = 1.0 - texture2D(tDepth, vUv).r;
          float depth = uNear * uFar / (closeness * (uFar - uNear) + uNear); // the sky is as far as the camera draws
          float length_ = length(vRay) * depth;
          float glare = pow(max(dot(normalize(vRay), uSunFrom), 0.0), ${MIST_GLOW_TIGHTNESS.toFixed(1)});
          // Where the line ends, or where it is as far out as banks are read, among the banks.
          vec2 end = uEye.xz + vRay.xz * min(depth, ${MIST_BANK_REACH.toFixed(1)}) - uDrift;
          float near = 1.0 - smoothstep(${(MIST_BANK_REACH * 0.3).toFixed(1)}, ${MIST_BANK_REACH.toFixed(1)}, length_);
          float through = 1.0; // what all the mists let through
          vec3 lit = vec3(0.0); // their colours, each as much as it took
          float taken = 0.0;
          for (int i = 0; i < ${MIST_LAYERS}; i++) {
            if (i >= uLayers) break;
            vec4 shape = uShape[i];
            // The mist's thickness goes down evenly with height, so what lies along a line is
            // its thickness at the eye, the line's length, and how the line's rise changes that.
            float rise = clamp(vRay.y * depth / shape.y, -60.0, 60.0);
            float share = abs(rise) < 1e-3 ? 1.0 : (1.0 - exp(-rise)) / rise;
            float atEye = shape.z * exp(clamp((shape.x - uEye.y) / shape.y, -60.0, 20.0));
            float banks = uAir[i].y * near;
            float bank = 0.5;
            if (banks > 0.0) {
              vec2 at = end / uAir[i].z;
              bank = 0.65 * lumps(at) + 0.35 * lumps(at * 2.3 + 17.0);
            }
            float mist = min(shape.w, 1.0 - exp(-atEye * (1.0 + banks * (2.0 * bank - 1.0)) * length_ * share));
            through *= 1.0 - mist;
            lit += mist * mix(uColor[i], uSun, uAir[i].x * glare);
            taken += mist;
          }
          gl_FragColor = vec4(mix(color.rgb, taken > 0.0 ? lit / taken : color.rgb, 1.0 - through), color.a);
        }
      `,
      depthTest: false,
      depthWrite: false,
    })
    this._quad = new FullScreenQuad(this._material)
  }

  /** The mists to lay, a list of `MISTS` (the first `MIST_LAYERS`), under the air `Atmosphere.air` gives (its sun and its wind), or none. */
  set(mists, air) {
    const { uLayers, uColor, uShape, uAir, uSunFrom, uSun, uDrift } = this._material.uniforms
    uLayers.value = Math.min(mists.length, MIST_LAYERS)
    for (let i = 0; i < uLayers.value; i++) {
      const { color, base, height, density, most, glow = 0, banks = 0, size = 1 } = mists[i]
      uColor.value[i].setHex(color)
      uShape.value[i].set(base, height, density, most)
      uAir.value[i].set(air ? glow : 0, air ? banks : 0, size)
    }
    if (!air) return
    uSunFrom.value.copy(air.sunFrom)
    uSun.value.copy(air.sun)
    uDrift.value.set(air.drift.x, air.drift.z)
  }

  render(renderer, writeBuffer, readBuffer) {
    const { tDiffuse, tDepth, uNear, uFar, uProjectionInverse, uCameraWorld, uEye } = this._material.uniforms
    tDiffuse.value = readBuffer.texture
    tDepth.value = this._frame.depthTexture
    uNear.value = this.camera.near
    uFar.value = this.camera.far
    uProjectionInverse.value.copy(this.camera.projectionMatrixInverse)
    uCameraWorld.value.copy(this.camera.matrixWorld)
    uEye.value.setFromMatrixPosition(this.camera.matrixWorld)
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this._quad.render(renderer)
  }
}

// A blast's punch (`setLook`'s `punch`) at full: how much of flat-out speed's smear and fringe
// it adds for its instant, and how far it lifts the picture, warm. Well short of white, and
// over in a blink: a knock, never a flash that could strobe.
const PUNCH_SMEAR = 0.9
const PUNCH_LIFT = [0.28, 0.15, 0.04]

// Linear sRGB to Oklab and back (Björn Ottosson, 2020), each matrix by its rows: the space a
// look's palette is laid in, where a colour's lightness is apart from its hue and how much of it.
const OKLAB = {
  lms: [0.4122214708, 0.5363325363, 0.0514459929, 0.2119034982, 0.6806995451, 0.1073969566, 0.0883024619, 0.2817188376, 0.6299787005],
  lab: [0.2104542553, 0.793617785, -0.0040720468, 1.9779984951, -2.428592205, 0.4505937099, 0.0259040371, 0.7827717662, -0.808675766],
  fromLab: [1, 0.3963377774, 0.2158037573, 1, -0.1055613458, -0.0638541728, 1, -0.0894841775, -1.291485548],
  rgb: [4.0767416621, -3.3077115913, 0.2309699292, -1.2684380046, 2.6097574011, -0.3413193965, -0.0041960863, -0.7034186147, 1.707614701],
}
// A matrix by its rows as GLSL has it: GLSL fills a matrix by columns, so `v * m` is the rows' product.
const glslRows = (rows) => `mat3(${rows.map((v) => v.toFixed(10)).join(', ')})`
const byRows = (rows, [x, y, z]) => [0, 1, 2].map((i) => rows[3 * i] * x + rows[3 * i + 1] * y + rows[3 * i + 2] * z)
const sRGB = new THREE.Color() // scratch: `setHex` takes it to linear

/** A colour given as sRGB hex, as Oklab's `(L, a, b)` into `into`. */
function oklab(hex, into) {
  const { r, g, b } = sRGB.setHex(hex)
  return into.set(...byRows(OKLAB.lab, byRows(OKLAB.lms, [r, g, b]).map(Math.cbrt)))
}

// What a lens does to the picture. With speed: smears it along lines through its centre,
// pulls its colours apart and darkens it, all more towards the edges. For a level's mood:
// a standing vignette, and a colour lifted into the darkest parts. For a look's (`shade.grade`):
// its colour drained or deepened, and its shadows and lights each turned a colour of their own,
// as a film is graded; and its palette (`shade.palette`), a painter's few colours, which every
// point takes by how light it is, keeping that lightness.
const Lens = {
  uniforms: {
    tDiffuse: { value: null },
    uAmount: { value: 0 },
    uVignette: { value: 0 },
    uTunnel: { value: 0 },
    uAspect: { value: 16 / 9 },
    uFlow: { value: new THREE.Vector2(0.5, 0.5) },
    uShadowTint: { value: new THREE.Color(0x000000) },
    uPunch: { value: 0 },
    uSaturation: { value: 1 },
    uShadowsTone: { value: new THREE.Vector3(...UNGRADED) },
    uLightsTone: { value: new THREE.Vector3(...UNGRADED) },
    uPalette: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] }, // Oklab, darkest first
    uPaletteAmount: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    uniform float uVignette;
    uniform float uTunnel;
    uniform float uAspect;
    uniform vec2 uFlow;
    uniform vec3 uShadowTint;
    uniform float uPunch;
    uniform float uSaturation;
    uniform vec3 uShadowsTone;
    uniform vec3 uLightsTone;
    uniform vec3 uPalette[3];
    uniform float uPaletteAmount;
    varying vec2 vUv;
    const int TAPS = 6;
    vec3 toOklab(vec3 rgb) {
      return pow(max(rgb * ${glslRows(OKLAB.lms)}, 0.0), vec3(1.0 / 3.0)) * ${glslRows(OKLAB.lab)};
    }
    vec3 fromOklab(vec3 lab) {
      vec3 lms = lab * ${glslRows(OKLAB.fromLab)};
      return (lms * lms * lms) * ${glslRows(OKLAB.rgb)};
    }
    void main() {
      vec2 inward = 0.5 - vUv;
      float out_ = length(inward) * 2.0; // 0 at the centre, 1 at the top and bottom edges, 1.4 in the corners
      // The smear is drawn out from where the air comes from, which is the middle unless said.
      vec2 upwind = uFlow - vUv;
      float edge = smoothstep(${BLUR_CLEAR.toFixed(3)}, 1.4, length(upwind) * 2.0);
      float smear = uAmount + uPunch * ${PUNCH_SMEAR.toFixed(3)};
      vec2 stride = upwind * (smear * edge * ${BLUR_REACH.toFixed(3)} / float(TAPS - 1));
      vec2 fringe = upwind * (smear * edge * ${SPEED_FRINGE.toFixed(4)});
      vec3 color = vec3(0.0);
      if (smear * edge > 0.0) {
        for (int i = 0; i < TAPS; i++) {
          vec2 at = vUv + stride * float(i);
          color.r += texture2D(tDiffuse, at + fringe).r;
          color.g += texture2D(tDiffuse, at).g;
          color.b += texture2D(tDiffuse, at - fringe).b;
        }
        color /= float(TAPS);
      } else {
        // The middle of the picture, and all of it at rest: nothing to smear, one look does.
        color = texture2D(tDiffuse, vUv).rgb;
      }
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, uSaturation) * mix(uShadowsTone, uLightsTone, smoothstep(0.02, 0.5, luma));
      if (uPaletteAmount > 0.0) {
        // The palette's colour at this lightness, each of its three at its own; under the darkest
        // it goes as the light does, so black stays black.
        vec3 lab = toOklab(max(color, 0.0));
        vec3 dark = uPalette[0];
        vec3 middle = uPalette[1];
        vec3 light = uPalette[2];
        vec2 hue = lab.x < middle.x
          ? mix(dark.yz, middle.yz, clamp((lab.x - dark.x) / max(middle.x - dark.x, 0.001), 0.0, 1.0))
          : mix(middle.yz, light.yz, clamp((lab.x - middle.x) / max(light.x - middle.x, 0.001), 0.0, 1.0));
        hue *= min(1.0, lab.x / max(dark.x, 0.001));
        lab.yz = mix(lab.yz, hue, uPaletteAmount);
        color = max(fromOklab(lab), 0.0);
      }
      color += uShadowTint * (1.0 - smoothstep(0.0, 0.5, max(color.r, max(color.g, color.b))));
      color *= 1.0 - (uVignette + uAmount * ${SPEED_VIGNETTE.toFixed(3)}) * smoothstep(0.5, 1.5, out_);
      // The tunnel is a circle on the screen, not an oval fitted to the frame: 1 out at the top and bottom edges, further at the sides.
      float round_ = length(inward * vec2(uAspect, 1.0)) * 2.0;
      color *= 1.0 - uTunnel * smoothstep(${TUNNEL_FROM.toFixed(2)}, ${TUNNEL_TO.toFixed(2)}, round_);
      color *= 1.0 + uPunch * vec3(${PUNCH_LIFT.map((part) => part.toFixed(3)).join(', ')});
      gl_FragColor = vec4(color, 1.0);
    }
  `,
}

const QUAD_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// Brings the finished picture up to the canvas's size and sharpens it, in two draws: the
// first makes each of the canvas's pixels from the twelve of the picture around it, weighted
// along whatever edge runs through them, so a slanted outline comes out a line and not a
// stair; the second sharpens the result as far as its neighbours' range allows, which is what
// keeps a halo off the ink. Both take the picture as the screen shows it, after `OutputPass`.
//
// Ported from AMD FidelityFX Super Resolution 1.0 (EASU and RCAS in `ffx_fsr1.h`),
// Copyright (c) 2021 Advanced Micro Devices, Inc., under the MIT licence.
class SharpPass extends Pass {
  constructor() {
    super()
    this._wide = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }) // the canvas's size
    this._widen = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uSize: { value: new THREE.Vector2(1, 1) } },
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 uSize; // of the picture coming in, in its own pixels
        varying vec2 vUv;

        vec3 pixel(vec2 at) {
          return clamp(texture2D(tDiffuse, at / uSize).rgb, 0.0, 1.0);
        }
        float luma(vec3 c) {
          return c.b * 0.5 + (c.r * 0.5 + c.g);
        }
        // One of the four pixels nearest: which way brightness runs across it (a above, b left,
        // c itself, d right, e below) and how much of an edge that is, by its weight.
        void edge(inout vec2 dir, inout float len, float w, float a, float b, float c, float d, float e) {
          float dirX = d - b;
          float lenX = clamp(abs(dirX) / max(max(abs(d - c), abs(c - b)), 1e-5), 0.0, 1.0);
          dir.x += dirX * w;
          len += lenX * lenX * w;
          float dirY = e - a;
          float lenY = clamp(abs(dirY) / max(max(abs(e - c), abs(c - a)), 1e-5), 0.0, 1.0);
          dir.y += dirY * w;
          len += lenY * lenY * w;
        }
        void tap(inout vec3 sum, inout float weight, vec2 off, vec2 dir, vec2 len, float lob, float clp, vec3 c) {
          vec2 v = vec2(off.x * dir.x + off.y * dir.y, off.y * dir.x - off.x * dir.y) * len;
          float d2 = min(dot(v, v), clp);
          float wB = 0.4 * d2 - 1.0;
          float wA = lob * d2 - 1.0;
          wB = 1.5625 * wB * wB - 0.5625;
          float w = wB * wA * wA;
          sum += c * w;
          weight += w;
        }
        void main() {
          //   b c
          // e f g h
          // i j k l
          //   n o
          vec2 pp = vUv * uSize - 0.5;
          vec2 f0 = floor(pp) + 0.5;
          pp = fract(pp);
          vec3 b = pixel(f0 + vec2(0.0, -1.0));
          vec3 c = pixel(f0 + vec2(1.0, -1.0));
          vec3 e = pixel(f0 + vec2(-1.0, 0.0));
          vec3 f = pixel(f0);
          vec3 g = pixel(f0 + vec2(1.0, 0.0));
          vec3 h = pixel(f0 + vec2(2.0, 0.0));
          vec3 i = pixel(f0 + vec2(-1.0, 1.0));
          vec3 j = pixel(f0 + vec2(0.0, 1.0));
          vec3 k = pixel(f0 + vec2(1.0, 1.0));
          vec3 l = pixel(f0 + vec2(2.0, 1.0));
          vec3 n = pixel(f0 + vec2(0.0, 2.0));
          vec3 o = pixel(f0 + vec2(1.0, 2.0));
          float bL = luma(b), cL = luma(c), eL = luma(e), fL = luma(f), gL = luma(g), hL = luma(h);
          float iL = luma(i), jL = luma(j), kL = luma(k), lL = luma(l), nL = luma(n), oL = luma(o);

          vec2 dir = vec2(0.0);
          float len = 0.0;
          edge(dir, len, (1.0 - pp.x) * (1.0 - pp.y), bL, eL, fL, gL, jL);
          edge(dir, len, pp.x * (1.0 - pp.y), cL, fL, gL, hL, kL);
          edge(dir, len, (1.0 - pp.x) * pp.y, fL, iL, jL, kL, nL);
          edge(dir, len, pp.x * pp.y, gL, jL, kL, lL, oL);

          float dirR = dot(dir, dir);
          bool none = dirR < 1.0 / 32768.0;
          dir = none ? vec2(1.0, 0.0) : dir * inversesqrt(dirR);
          len = len * 0.5;
          len *= len;
          // Along an edge the kernel is stretched, across it squeezed.
          float stretch = dot(dir, dir) / max(abs(dir.x), abs(dir.y));
          vec2 len2 = vec2(1.0 + (stretch - 1.0) * len, 1.0 - 0.5 * len);
          float lob = 0.5 + ((1.0 / 4.0 - 0.04) - 0.5) * len;
          float clp = 1.0 / lob;

          vec3 sum = vec3(0.0);
          float weight = 0.0;
          tap(sum, weight, vec2(0.0, -1.0) - pp, dir, len2, lob, clp, b);
          tap(sum, weight, vec2(1.0, -1.0) - pp, dir, len2, lob, clp, c);
          tap(sum, weight, vec2(-1.0, 1.0) - pp, dir, len2, lob, clp, i);
          tap(sum, weight, vec2(0.0, 1.0) - pp, dir, len2, lob, clp, j);
          tap(sum, weight, vec2(0.0, 0.0) - pp, dir, len2, lob, clp, f);
          tap(sum, weight, vec2(-1.0, 0.0) - pp, dir, len2, lob, clp, e);
          tap(sum, weight, vec2(1.0, 1.0) - pp, dir, len2, lob, clp, k);
          tap(sum, weight, vec2(2.0, 1.0) - pp, dir, len2, lob, clp, l);
          tap(sum, weight, vec2(2.0, 0.0) - pp, dir, len2, lob, clp, h);
          tap(sum, weight, vec2(1.0, 0.0) - pp, dir, len2, lob, clp, g);
          tap(sum, weight, vec2(1.0, 2.0) - pp, dir, len2, lob, clp, o);
          tap(sum, weight, vec2(0.0, 2.0) - pp, dir, len2, lob, clp, n);
          // Never brighter or darker than the four pixels nearest: no ringing.
          vec3 low = min(min(f, g), min(j, k));
          vec3 high = max(max(f, g), max(j, k));
          gl_FragColor = vec4(min(high, max(low, sum / weight)), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    })
    this._sharpen = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this._wide.texture }, uTexel: { value: new THREE.Vector2(1, 1) }, uSharp: { value: Math.pow(2, -SHARPENING_STOPS) } },
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 uTexel;
        uniform float uSharp;
        varying vec2 vUv;
        void main() {
          vec3 e = texture2D(tDiffuse, vUv).rgb;
          vec3 b = texture2D(tDiffuse, vUv - vec2(0.0, uTexel.y)).rgb;
          vec3 d = texture2D(tDiffuse, vUv - vec2(uTexel.x, 0.0)).rgb;
          vec3 f = texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)).rgb;
          vec3 h = texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)).rgb;
          vec3 low = min(min(b, d), min(f, h));
          vec3 high = max(max(b, d), max(f, h));
          // As much as can be taken from the four around without leaving black or white behind.
          vec3 hitLow = min(low, e) / max(4.0 * high, 1e-4);
          vec3 hitHigh = (1.0 - max(high, e)) / min(4.0 * low - 4.0, -1e-4);
          vec3 lobes = max(-hitLow, hitHigh);
          float lobe = max(-0.1875, min(max(lobes.r, max(lobes.g, lobes.b)), 0.0)) * uSharp;
          gl_FragColor = vec4((lobe * (b + d + f + h) + e) / (4.0 * lobe + 1.0), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    })
    this._quad = new FullScreenQuad(this._widen)
  }

  /** How far short of its hardest the sharpening stops, in halvings (`SHARPENING_STOPS` unless a look says). */
  set stops(stops) {
    this._sharpen.uniforms.uSharp.value = Math.pow(2, -stops)
  }

  /** How big the canvas is, in its own pixels. */
  setCanvasSize(width, height) {
    this._wide.setSize(width, height)
    this._sharpen.uniforms.uTexel.value.set(1 / width, 1 / height)
  }

  render(renderer, writeBuffer, readBuffer) {
    this._widen.uniforms.tDiffuse.value = readBuffer.texture
    this._widen.uniforms.uSize.value.set(readBuffer.width, readBuffer.height)
    this._quad.material = this._widen
    renderer.setRenderTarget(this._wide)
    this._quad.render(renderer)
    this._quad.material = this._sharpen
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this._quad.render(renderer)
  }
}

// A screen of the PlayStation's years, as Arctic Eggs has one (`setLook`'s `shade.retro`, the
// owner's ask of 2026-10-16): the finished picture averaged down to a few hundred lines and shown
// as blocks; its colour cut to `depth` bits a channel and dithered in a 4×4 pattern laid on the
// blocks; red and blue pulled `fringe` of a block apart sideways; each block's lower part a
// little darker (`scanlines`); the corners rounded off as a tube's (`corners`, a share of the
// height). Averaged, not drawn that small: each block is the mean of the picture under it, so
// far detail holds still where a picture drawn at a few hundred lines crawls. It takes the
// picture as the screen shows it (after `OutputPass`, where colour is cut) and brings it to the
// canvas itself, so that the blocks stay sharp-edged: `SharpPass`, which would round them, is
// off while it is on.
//
// Two parts calm what still twinkled (the owner, the same day: "shimmering of objects that are
// tiny or far away... we need to reduce the shimmer when moving"). A pole or a window finer than
// a block, drawn at 720 lines with two samples a pixel, is hit one frame and missed the next,
// and jumps whole from block to block; and a change of a few per cent flips a block a whole step
// of its five bits. So:
// - `far`, metres: from there to `FAR_FULL` times as far a block is averaged from about two
//   blocks' width of the picture, not only what is under it, so a thin thing fades from one block
//   into the next; and is neither cut nor dithered. The blocks stay, as a screen's do. The sky is
//   never far: it has no detail, and its dithered gradient is the look's own.
// - `steady`, 0 to under 1: how much of what a block showed a frame ago it keeps, followed through
//   the view's turn and travel by the scene's depth, so what the scene hits and misses from frame
//   to frame is evened out. Not where the block shows something it did not (another distance
//   there), the hands (nearer than `STEADY_NEAR`), or anything past what its neighbours show now,
//   which is how a flash or a bird leaves no trail.
//
// And a glow, for the cosy look (the owner, the same day, of two stills of Easy Delivery Co.: "see
// this kind of glowy cosy filter? I want smth simular"): `glow`, `{ strength, from, size }`, what
// is brighter than `from` (a share of white, as the screen shows it) shed over the screen around
// it, in a mix by `size` of a halo about a lamp (`GLOW_LINES[0]` lines, blurred) and a haze over
// a room (`GLOW_LINES[1]`). It is laid on after the colour is cut, as light over the screen, so it
// is smooth where the blocks are not, as a tube's glow is; and it is the colour of what sheds it,
// so a lamp's is warm. `vignette`, how dark the screen's corners go.
const GLOW_LINES = [135, 34]
const GLOW_KNEE = 0.25 // over how much brightness past `from` a part comes to glow fully
// The screen as it is without a look's word on any part of it.
const PLAIN_SCREEN = { lines: 300, depth: 5, fringe: 0.5, scanlines: 0.1, corners: 0.03, far: 0, steady: 0, glow: null, vignette: 0 }
const FAR_FULL = 3
const FAR_WIDE = 0.65 // the far average's spread, a standard deviation in blocks
const STEADY_NEAR = 2
const STEADY_MATCH = 0.14 // how far apart two distances may be and be the same thing, in halvings (10%)
const STEADY_SLACK = 0.5 // how far past what its neighbours show now a block's past may be kept, as a share of their spread
const STEADY_MOST = 0.95
const STEADY_FARTHEST = 16 // halvings of a metre: a block's distance is kept as a share of this, so a frame of bytes holds it too
const DEPTH_TO_METRES = /* glsl */ `
  float metres(float depth) {
    return uNear * uFar / ((1.0 - depth) * (uFar - uNear) + uNear);
  }
`
class RetroPass extends Pass {
  constructor(frame, type) {
    super()
    this._frame = frame
    this.camera = null // the eye the scene was drawn from, set before each frame
    this.without = new Set() // `Picture.without`'s: 'far', 'steady' and 'glow' leave those parts out
    this.retro = PLAIN_SCREEN
    const blocks = { depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }
    this._small = new THREE.WebGLRenderTarget(1, 1, blocks)
    // What was shown, the newest first, and the distance of each block (in halvings of a metre, of `STEADY_FARTHEST`), for the next frame.
    this._history = [new THREE.WebGLRenderTarget(1, 1, { ...blocks, type }), new THREE.WebGLRenderTarget(1, 1, { ...blocks, type })]
    this._fresh = true // nothing to keep from the last frame
    // The glow's halo and haze, each a pair to blur through one way and back.
    const smooth = { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }
    this._halo = [new THREE.WebGLRenderTarget(1, 1, smooth), new THREE.WebGLRenderTarget(1, 1, smooth)]
    this._haze = [new THREE.WebGLRenderTarget(1, 1, smooth), new THREE.WebGLRenderTarget(1, 1, smooth)]
    this._before = new THREE.Matrix4() // the last frame's view and projection
    this._now = new THREE.Matrix4()
    this._average = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        uCell: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 1 },
        uFar: { value: 1 },
        uFarFrom: { value: 0 },
      },
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform vec2 uCell; // a block's size, as a share of the picture
        uniform float uNear;
        uniform float uFar;
        uniform float uFarFrom; // metres, 0 for no far calm
        varying vec2 vUv;
        ${DEPTH_TO_METRES}
        float farness(vec2 uv) {
          float depth = texture2D(tDepth, uv).r;
          return depth >= 1.0 ? 0.0 : smoothstep(uFarFrom, uFarFrom * ${FAR_FULL.toFixed(1)}, metres(depth));
        }
        // Sixteen taps over the block, each a bilinear mean of four pixels: all of them under it.
        // How far it is calm is the mean of theirs, so it is as smooth as the picture's cover.
        void main() {
          vec3 sum = vec3(0.0);
          float far = 0.0;
          for (int i = 0; i < 4; i++) {
            for (int j = 0; j < 4; j++) {
              vec2 at = vUv + (vec2(float(i), float(j)) / 4.0 - 0.375) * uCell;
              sum += texture2D(tDiffuse, at).rgb;
              if (uFarFrom > 0.0) far += farness(at);
            }
          }
          vec3 color = sum / 16.0;
          far /= 16.0;
          if (far > 0.0) {
            vec3 wide = vec3(0.0);
            float weight = 0.0;
            for (int i = 0; i < 6; i++) {
              for (int j = 0; j < 6; j++) {
                vec2 off = (vec2(float(i), float(j)) - 2.5) * 0.45;
                float w = exp(-dot(off, off) / ${(2 * FAR_WIDE * FAR_WIDE).toFixed(4)});
                wide += texture2D(tDiffuse, vUv + off * uCell).rgb * w;
                weight += w;
              }
            }
            color = mix(color, wide / weight, far);
          }
          gl_FragColor = vec4(color, far);
        }
      `,
      depthTest: false,
      depthWrite: false,
    })
    this._steady = new THREE.ShaderMaterial({
      uniforms: {
        tNow: { value: this._small.texture },
        tBefore: { value: null },
        tDepth: { value: null },
        uSmall: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 1 },
        uFar: { value: 1 },
        uNowToWorld: { value: new THREE.Matrix4() },
        uBefore: { value: new THREE.Matrix4() },
        uKeep: { value: 0 },
      },
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */ `
        uniform sampler2D tNow; // this frame's blocks
        uniform sampler2D tBefore; // what was shown a frame ago, and how far each block was
        uniform sampler2D tDepth;
        uniform vec2 uSmall; // the blocks across and up
        uniform float uNear;
        uniform float uFar;
        uniform mat4 uNowToWorld; // from this frame's picture and depth into the world
        uniform mat4 uBefore; // from the world into the last frame's picture
        uniform float uKeep;
        varying vec2 vUv;
        ${DEPTH_TO_METRES}
        vec4 block(sampler2D blocks, vec2 at) {
          return texture2D(blocks, (at + 0.5) / uSmall);
        }
        void main() {
          vec4 now = texture2D(tNow, vUv);
          float depth = texture2D(tDepth, vUv).r;
          float ahead = metres(depth);
          // Where this block's point was in the last frame, and how far ahead of the eye.
          vec4 world = uNowToWorld * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
          vec4 was = uBefore * vec4(world.xyz / world.w, 1.0);
          vec2 wasAt = was.xy / was.w * 0.5 + 0.5;
          float keep = uKeep;
          if (ahead < ${STEADY_NEAR.toFixed(1)} || was.w <= 0.0 || any(lessThan(wasAt, vec2(0.0))) || any(greaterThan(wasAt, vec2(1.0)))) keep = 0.0;
          // The last frame's four blocks about there, blended; kept only if one of them was this same thing, as far off.
          vec2 at = wasAt * uSmall - 0.5;
          vec2 base = floor(at);
          vec2 f = at - base;
          vec4 a = block(tBefore, base);
          vec4 b = block(tBefore, base + vec2(1.0, 0.0));
          vec4 c = block(tBefore, base + vec2(0.0, 1.0));
          vec4 d = block(tBefore, base + vec2(1.0, 1.0));
          vec4 seen = abs(vec4(a.a, b.a, c.a, d.a) * ${STEADY_FARTHEST.toFixed(1)} - log2(max(was.w, 1.0)));
          if (min(min(seen.x, seen.y), min(seen.z, seen.w)) > ${STEADY_MATCH.toFixed(3)}) keep = 0.0;
          vec3 past = mix(mix(a.rgb, b.rgb, f.x), mix(c.rgb, d.rgb, f.x), f.y);
          // Held within what this block and its neighbours show now, and a little past.
          vec3 low = now.rgb;
          vec3 high = now.rgb;
          for (int i = -1; i <= 1; i++) {
            for (int j = -1; j <= 1; j++) {
              vec3 around = texture2D(tNow, vUv + vec2(float(i), float(j)) / uSmall).rgb;
              low = min(low, around);
              high = max(high, around);
            }
          }
          vec3 slack = (high - low) * ${STEADY_SLACK.toFixed(2)};
          past = clamp(past, low - slack, high + slack);
          gl_FragColor = vec4(mix(now.rgb, past, keep), log2(max(ahead, 1.0)) / ${STEADY_FARTHEST.toFixed(1)});
        }
      `,
      depthTest: false,
      depthWrite: false,
    })
    // What glows, from the blocks: the mean of the 4×4 of them under a texel of the halo, as
    // much of it as is bright enough. Then from the halo, the mean of four of its texels for one of the haze.
    this._bright = new THREE.ShaderMaterial({
      uniforms: { tBlocks: { value: null }, uCell: { value: new THREE.Vector2(1, 1) }, uFrom: { value: 0.5 } },
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */ `
        uniform sampler2D tBlocks;
        uniform vec2 uCell; // a texel of what is made, as a share of the picture
        uniform float uFrom;
        varying vec2 vUv;
        void main() {
          vec3 sum = vec3(0.0);
          for (int i = 0; i < 4; i++) {
            for (int j = 0; j < 4; j++) {
              vec3 color = texture2D(tBlocks, vUv + (vec2(float(i), float(j)) / 4.0 - 0.375) * uCell).rgb;
              sum += color * smoothstep(uFrom, uFrom + ${GLOW_KNEE.toFixed(2)}, dot(color, vec3(0.2126, 0.7152, 0.0722)));
            }
          }
          gl_FragColor = vec4(sum / 16.0, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    })
    this._shrink = new THREE.ShaderMaterial({
      uniforms: { tSource: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) } },
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSource;
        uniform vec2 uTexel; // one of the source's
        varying vec2 vUv;
        void main() {
          gl_FragColor = 0.25 * (texture2D(tSource, vUv + uTexel * vec2(-1.0, -1.0)) + texture2D(tSource, vUv + uTexel * vec2(1.0, -1.0))
            + texture2D(tSource, vUv + uTexel * vec2(-1.0, 1.0)) + texture2D(tSource, vUv + uTexel * vec2(1.0, 1.0)));
        }
      `,
      depthTest: false,
      depthWrite: false,
    })
    // Nine taps one way, a Gaussian two texels wide.
    this._blur = new THREE.ShaderMaterial({
      uniforms: { tSource: { value: null }, uStep: { value: new THREE.Vector2(1, 0) } },
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSource;
        uniform vec2 uStep; // a texel, along the way blurred
        varying vec2 vUv;
        void main() {
          vec3 sum = vec3(0.0);
          float weight = 0.0;
          for (int i = -4; i <= 4; i++) {
            float w = exp(-float(i * i) / 8.0);
            sum += texture2D(tSource, vUv + uStep * float(i)).rgb * w;
            weight += w;
          }
          gl_FragColor = vec4(sum / weight, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    })
    this._show = new THREE.ShaderMaterial({
      uniforms: {
        tShown: { value: this._small.texture },
        tSmall: { value: this._small.texture },
        tHalo: { value: this._halo[0].texture },
        tHaze: { value: this._haze[0].texture },
        uSmall: { value: new THREE.Vector2(1, 1) },
        uLevels: { value: 31 },
        uFringe: { value: 0.5 },
        uScanlines: { value: 0.1 },
        uCorners: { value: 0.03 },
        uAspect: { value: 16 / 9 },
        uGlow: { value: 0 },
        uGlowSize: { value: 0.5 },
        uVignette: { value: 0 },
      },
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */ `
        uniform sampler2D tShown; // the blocks' colour, steadied or as they are
        uniform sampler2D tSmall; // how far each block is calm, in its alpha
        uniform sampler2D tHalo;
        uniform sampler2D tHaze;
        uniform vec2 uSmall; // the blocks across and up
        uniform float uLevels; // the steps a channel is cut to, less one
        uniform float uFringe;
        uniform float uScanlines;
        uniform float uCorners;
        uniform float uAspect;
        uniform float uGlow;
        uniform float uGlowSize;
        uniform float uVignette;
        varying vec2 vUv;
        const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
        void main() {
          vec2 block = floor(vUv * uSmall);
          vec2 at = (block + 0.5) / uSmall;
          vec2 apart = vec2(uFringe / uSmall.x, 0.0);
          vec3 color = vec3(texture2D(tShown, at + apart).r, texture2D(tShown, at).g, texture2D(tShown, at - apart).b);
          ivec2 cell = ivec2(mod(block, 4.0));
          float dither = (BAYER[cell.x + cell.y * 4] + 0.5) / 16.0;
          float levels = mix(uLevels, 255.0, texture2D(tSmall, at).a); // far, neither cut nor dithered
          color = clamp(floor(color * levels + dither) / levels, 0.0, 1.0);
          color *= 1.0 - uScanlines * smoothstep(0.55, 1.0, 1.0 - fract(vUv.y * uSmall.y));
          if (uGlow > 0.0) {
            vec3 glow = mix(texture2D(tHalo, vUv).rgb, texture2D(tHaze, vUv).rgb, uGlowSize) * uGlow;
            color = 1.0 - (1.0 - color) * (1.0 - min(glow, 1.0)); // light added as light is, never past white
          }
          float round_ = length((vUv - 0.5) * vec2(uAspect, 1.0)) / length(vec2(0.5 * uAspect, 0.5)); // 0 in the middle, 1 in a corner
          color *= 1.0 - uVignette * smoothstep(0.3, 1.0, round_);
          vec2 fromMiddle = abs(vUv - 0.5) * vec2(uAspect, 1.0);
          vec2 inner = vec2(0.5 * uAspect, 0.5) - uCorners;
          float outside = length(max(fromMiddle - inner, 0.0)) - uCorners;
          color *= 1.0 - smoothstep(-0.0015, 0.0015, outside);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    })
    this._quad = new FullScreenQuad(this._average)
  }

  /** Keeps nothing of the frames before: call when the screen comes on again. */
  forget() {
    this._fresh = true
  }

  render(renderer, writeBuffer, readBuffer) {
    const { lines, depth, fringe, scanlines, corners, far, steady, glow, vignette } = this.retro
    const tall = Math.max(1, Math.round(lines))
    const wide = Math.max(1, Math.round((tall * readBuffer.width) / readBuffer.height))
    if (this._small.width !== wide || this._small.height !== tall) {
      for (const target of [this._small, ...this._history]) target.setSize(wide, tall)
      this._fresh = true
    }
    const { near: nearest, far: farthest } = this.camera ?? { near: 1, far: 2 }
    const a = this._average.uniforms
    a.tDiffuse.value = readBuffer.texture
    a.tDepth.value = this._frame.depthTexture
    a.uCell.value.set(1 / wide, 1 / tall)
    a.uNear.value = nearest
    a.uFar.value = farthest
    a.uFarFrom.value = this.without.has('far') ? 0 : far
    this._quad.material = this._average
    renderer.setRenderTarget(this._small)
    this._quad.render(renderer)

    // Steadied into the older of the two frames kept, which becomes the newest.
    const keep = this.without.has('steady') || !this.camera ? 0 : Math.min(STEADY_MOST, steady)
    if (keep > 0) {
      this._now.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)
      const s = this._steady.uniforms
      s.tBefore.value = this._history[0].texture
      s.tDepth.value = this._frame.depthTexture
      s.uSmall.value.set(wide, tall)
      s.uNear.value = nearest
      s.uFar.value = farthest
      s.uNowToWorld.value.copy(this._now).invert()
      s.uBefore.value.copy(this._before)
      s.uKeep.value = this._fresh ? 0 : keep
      this._quad.material = this._steady
      renderer.setRenderTarget(this._history[1])
      this._quad.render(renderer)
      this._history.reverse()
      this._before.copy(this._now)
      this._fresh = false
    } else this._fresh = true
    const shown = keep > 0 ? this._history[0].texture : this._small.texture

    // The glow, from what is shown: its halo, then its haze from the halo, each blurred both ways.
    const glows = !this.without.has('glow') && glow?.strength > 0
    if (glows) {
      const aspect = readBuffer.width / readBuffer.height
      for (const [pair, glowLines] of [[this._halo, GLOW_LINES[0]], [this._haze, GLOW_LINES[1]]]) {
        const glowTall = Math.max(1, Math.min(tall, glowLines))
        const glowWide = Math.max(1, Math.round(glowTall * aspect))
        if (pair[0].height !== glowTall || pair[0].width !== glowWide) for (const target of pair) target.setSize(glowWide, glowTall)
      }
      const b = this._bright.uniforms
      b.tBlocks.value = shown
      b.uCell.value.set(1 / this._halo[0].width, 1 / this._halo[0].height)
      b.uFrom.value = glow.from ?? 0.5
      this._draw(renderer, this._bright, this._halo[0])
      this._blurBoth(renderer, this._halo)
      this._shrink.uniforms.tSource.value = this._halo[0].texture
      this._shrink.uniforms.uTexel.value.set(1 / this._halo[0].width, 1 / this._halo[0].height)
      this._draw(renderer, this._shrink, this._haze[0])
      this._blurBoth(renderer, this._haze)
    }

    const u = this._show.uniforms
    u.tShown.value = shown
    u.uGlow.value = glows ? glow.strength : 0
    u.uGlowSize.value = glow?.size ?? 0.5
    u.uVignette.value = vignette
    u.uSmall.value.set(wide, tall)
    u.uLevels.value = Math.pow(2, depth) - 1
    u.uFringe.value = fringe
    u.uScanlines.value = scanlines
    u.uCorners.value = corners
    u.uAspect.value = readBuffer.width / readBuffer.height
    this._quad.material = this._show
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this._quad.render(renderer)
  }

  _draw(renderer, material, target) {
    this._quad.material = material
    renderer.setRenderTarget(target)
    this._quad.render(renderer)
  }

  // A pair blurred across into its second and back up into its first.
  _blurBoth(renderer, [first, second]) {
    const u = this._blur.uniforms
    u.tSource.value = first.texture
    u.uStep.value.set(1 / first.width, 0)
    this._draw(renderer, this._blur, second)
    u.tSource.value = second.texture
    u.uStep.value.set(0, 1 / first.height)
    this._draw(renderer, this._blur, first)
  }
}

export class Picture {
  /**
   * `smooth` false starts without the off-screen anti-aliasing, as `cheapen` leaves it in the
   * end: for a phone, which could not afford it and may not draw a frame with it at all.
   * `sharp` false leaves the canvas the picture's own size, for the browser to stretch: for a
   * phone again, where two more passes over the whole screen were never tried.
   * `without` is as for the method of that name, and may also hold 'float'.
   */
  constructor(renderer, { smooth = true, sharp = true, without = [] } = {}) {
    this._renderer = renderer
    this._scale = 1
    this._width = 1
    this._height = 1
    this._smooth = smooth
    this._sharp = sharp
    this._without = new Set(without)
    /** How long the last `render` took to hand the frame to the card, in milliseconds. For the debug readout. */
    this.drawMs = 0

    // A frame is several passes, and the debug readout wants them counted together.
    renderer.info.autoReset = false

    // The frames hold light brighter than white, for the glow to find. A card that cannot
    // draw into such a frame draws nothing at all, so there the picture is made in plain ones:
    // lamps and fire still pass the glow's threshold, only none is brighter than another.
    const gl = renderer.getContext()
    const floats = !this._without.has('float') && Boolean(gl.getExtension('EXT_color_buffer_half_float') || gl.getExtension('EXT_color_buffer_float'))
    const type = floats ? THREE.HalfFloatType : THREE.UnsignedByteType
    this._frame = new THREE.WebGLRenderTarget(1, 1, {
      type,
      samples: this._smooth && !this._without.has('msaa') ? SAMPLES : 0,
      depthTexture: new THREE.DepthTexture(1, 1), // the ink, the creases and the mist read it
    })
    this._composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: false }))
    this._shape = new ShapePass(this._frame) // first: lamps and fire then glow over the lines
    this._composer.addPass(this._shape)
    this._mist = new MistPass(this._frame) // before the glow: what the mist has taken sheds none
    this._mist.enabled = false
    this._composer.addPass(this._mist)
    this._bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD)
    // The glow makes its own frames, and asks for the same kind without looking.
    for (const frame of [this._bloom.renderTargetBright, ...this._bloom.renderTargetsHorizontal, ...this._bloom.renderTargetsVertical]) frame.texture.type = type
    this._composer.addPass(this._bloom)
    this._lens = new ShaderPass(Lens)
    this._lens.enabled = false
    this._shade = undefined // the ramp as last set (`null` smooth); unset until the first `setLook`
    this._inkAs = undefined // the ink as last set, likewise
    this._toneAs = undefined // the look's tone mapping as last set, likewise
    this._lift = new THREE.Color() // scratch: a look's grade's lift
    this._paletteAs = undefined // the palette's colours as last set
    this._composer.addPass(this._lens)
    this._composer.addPass(new OutputPass())
    this._retro = new RetroPass(this._frame, type) // a look's PlayStation screen, which brings the picture to the canvas in the sharpening's place
    this._retro.enabled = false
    this._retro.without = this._without
    this._retroOn = false
    this._composer.addPass(this._retro)
    this._sharpen = new SharpPass() // last, and only where the canvas is bigger than the picture
    this._composer.addPass(this._sharpen)
  }

  /** Call when the window changes size, and after changing the renderer's pixel ratio. */
  resize(width, height) {
    this._width = Math.max(1, width)
    this._height = Math.max(1, height)
    const screen = window.devicePixelRatio || 1
    /** How many of the picture's pixels there are to one of the page's. The canvas may have more. */
    this.pixelRatio = Math.min(screen, PICTURE_LINES / this._height) * this._scale
    this._renderer.setPixelRatio(this.pixelRatio)
    this._renderer.setSize(this._width, this._height)
    // The scene's frame and the frames it is passed on through, pixel for pixel the same size.
    const wide = Math.max(1, Math.floor(this._width * this.pixelRatio))
    const tall = Math.max(1, Math.floor(this._height * this.pixelRatio))
    this._composer.setPixelRatio(1)
    this._composer.setSize(wide, tall)
    this._frame.setSize(wide, tall)
    // The canvas is made bigger behind the renderer's back, and the renderer told only where
    // on it to draw. Its own pixel ratio has to stay the picture's: it is what sizes every
    // point drawn into the scene's frame (smoke, sparks), and given the canvas's they came
    // out as squares two and three times too big.
    const shown = Math.max(this.pixelRatio, Math.min(screen, OUTPUT_LINES / this._height))
    const canvasWide = Math.floor(this._width * shown)
    const canvasTall = Math.floor(this._height * shown)
    // The canvas is made bigger for the sharpening's upscale or, with a look's screen on, for
    // that screen's blocks, drawn at its own pixels; neither on a phone (`sharp` false).
    const bigger = this._sharp && canvasTall > tall
    this._sharpen.enabled = bigger && !this._retroOn && !this._without.has('sharp')
    if (!this._sharpen.enabled && !(bigger && this._retroOn)) return
    this._renderer.domElement.width = canvasWide
    this._renderer.domElement.height = canvasTall
    this._renderer.setViewport(0, 0, canvasWide / this.pixelRatio, canvasTall / this.pixelRatio)
    if (this._sharpen.enabled) this._sharpen.setCanvasSize(canvasWide, canvasTall)
  }

  /** What the picture is being made of just now, in a few words. For the play stats and a bug report. */
  get summary() {
    return `${this.lines}>${this.shownLines} lines${this._frame.samples ? ' aa' : ''}${this._sharpen.enabled ? ' sharp' : ''}`
  }

  /** How many lines tall the canvas is, which is what the picture is brought up to. For the debug readout. */
  get shownLines() {
    return this._renderer.domElement.height
  }

  /**
   * How the next frames are to look. Call before `render`, as often as anything changes.
   * - `glow`: `{ strength, threshold }` — the bloom's strength and the brightness it starts
   *   at; omit either, or all of it, for the usual;
   * - `lens`: `{ vignette, shadowTint, tunnel }` — the level's own: how much the corners darken (0 to
   *   1) and a colour added to the darkest parts of the picture; and the moment's: how much of
   *   the light is taken at the far corners in a circle about the middle (0 to 1); omit for a clear lens;
   * - `mists`: records of `MISTS` (`themes.js`), air lying in the depths, as many as lie at once
   *   (up to `MIST_LAYERS`); omit for none;
   * - `air`: the air the mists are in (`Atmosphere.air`): where their glow is lit from, and how
   *   far the wind has carried their banks; omit for mists with neither;
   * - `flow`: where on the picture the air comes from, `{ x, y }` in halves of the picture from
   *   its middle (+ right and up): the smear is drawn out from there; omit for the middle;
   * - `blur`: how hard the edges of the picture smear with speed, from 0 (still) to 1 (flat out);
   * - `punch`: a blast's knock to the lens, 0 to 1 — the same smear and fringe for an instant,
   *   and the picture lifted warm; omit for none;
   * - `cel`: the theme's look: without it, plain light on every lit surface, no ink and
   *   nothing of `shade` (X in play);
   * - `shade`: a theme's `shade`, one of `themes.js`'s `LOOKS`: the steps or smooth light, ink,
   *   grain and its relief, wear, creases, grade, palette, tone and screen the picture has there; omit for the game's own
   *   hard steps, black ink and nothing else.
   */
  setLook({ glow: { strength = BLOOM_STRENGTH, threshold = BLOOM_THRESHOLD } = {}, lens: { vignette = 0, shadowTint = 0x000000, tunnel = 0 } = {}, mists = [], air, flow, blur, punch = 0, cel, shade }) {
    this._bloom.strength = strength
    this._bloom.threshold = threshold

    // The lens pass does the vignette, the tint, the blur and the punch, and is skipped when it has none to do.
    const moody = vignette > 0 || shadowTint !== 0x000000 || tunnel > 0.005
    this._lens.uniforms.uVignette.value = vignette
    this._lens.uniforms.uTunnel.value = tunnel
    this._lens.uniforms.uAspect.value = this._width / this._height
    this._lens.uniforms.uShadowTint.value.setHex(shadowTint)
    const { saturation = 1, shadows = UNGRADED, lights = UNGRADED, lift = 0x000000 } = (cel && shade?.grade) || {}
    if (lift) this._lens.uniforms.uShadowTint.value.add(this._lift.setHex(lift)) // the look's violet in the darks, over the level's own tint
    this._lens.uniforms.uSaturation.value = saturation
    this._lens.uniforms.uShadowsTone.value.set(...shadows)
    this._lens.uniforms.uLightsTone.value.set(...lights)
    const { colors, amount: washed = 0 } = (cel && shade?.palette) || {}
    this._lens.uniforms.uPaletteAmount.value = washed
    if (washed > 0 && colors !== this._paletteAs) {
      this._paletteAs = colors
      const stops = this._lens.uniforms.uPalette.value
      colors.forEach((hex, i) => oklab(hex, stops[i]))
      stops.sort((one, other) => one.x - other.x)
    }
    const graded = saturation !== 1 || shadows !== UNGRADED || lights !== UNGRADED || lift !== 0 || washed > 0
    this._lens.enabled = !this._without.has('lens') && (moody || graded || blur > 0.01 || punch > 0.01)
    this._bloom.enabled = !this._without.has('bloom')
    this._mist.enabled = mists.length > 0 && !this._without.has('mist')
    if (this._mist.enabled) this._mist.set(mists, air)
    this._lens.uniforms.uPunch.value = punch
    this._lens.uniforms.uFlow.value.set(0.5 + (flow?.x ?? 0) / 2, 0.5 + (flow?.y ?? 0) / 2)
    this._lens.uniforms.uAmount.value = blur

    // Both are rewritten only when they change: the ramp is a texture every lit material reads.
    // A ramp by its name in `RAMPS`, or one of the look's own shaped like them.
    const own = typeof shade?.ramp === 'object' ? shade.ramp : undefined
    const ramp = cel ? (own ?? (shade?.ramp in RAMPS ? RAMPS[shade.ramp] : RAMPS.hard)) : null
    if (ramp !== this._shade) {
      this._shade = ramp
      setShade(ramp)
    }
    if (shade?.ink !== this._inkAs) {
      this._inkAs = shade?.ink
      this._shape.ink = shade?.ink || undefined
    }
    this._shape.inked = cel && shade?.ink !== false && !this._without.has('ink')
    this._shape.occlusion = (cel && !this._without.has('occlusion') && shade?.occlusion) || null
    setSurface(cel ? shade : null)

    // Only the last pass, which brings the picture to the screen, tone-maps: the scene is drawn
    // into a frame of its own, so no lit material is rebuilt for it.
    const tone = (cel && TONES[shade?.tone]) || THREE.NoToneMapping
    if (tone !== this._toneAs) {
      this._toneAs = tone
      this._renderer.toneMapping = tone
    }
    this._renderer.toneMappingExposure = (cel && shade?.exposure) || 1

    // A look's screen (`RetroPass`) changes what the canvas is, so turning it on or off lays the canvas out again.
    const retro = (cel && !this._without.has('retro') && shade?.retro) || null
    if (Boolean(retro) !== this._retroOn) {
      this._retroOn = Boolean(retro)
      this._retro.enabled = this._retroOn
      this._retro.forget()
      this.resize(this._width, this._height)
    }
    if (retro) this._retro.retro = { ...PLAIN_SCREEN, ...retro } // what a look leaves out is as the plain screen has it, not as the last look did
    this._sharpen.stops = (cel && shade?.sharpen) ?? SHARPENING_STOPS
  }

  /**
   * Leaves parts of the frame out, to find what each costs: any of 'msaa', 'ink', 'occlusion',
   * 'mist', 'bloom', 'lens', 'retro' (and of its screen 'far', 'steady' and 'glow'), 'sharp'; an empty list puts all back. For measuring only (`?without=`,
   * `itch/smoke.html`): the picture is wrong without them. Takes effect with the next `setLook`.
   */
  without(parts) {
    this._without = new Set(parts)
    this._retro.without = this._without
    this._sample()
    this.resize(this._width, this._height)
  }

  /** How many lines tall the scene is drawn. For the debug readout. */
  get lines() {
    return Math.round(this._height * this.pixelRatio)
  }

  // Gives the scene's frame as many samples as it is now to have.
  _sample() {
    const samples = this._smooth && !this._without.has('msaa') ? SAMPLES : 0
    if (this._frame.samples === samples) return
    this._frame.samples = samples
    this._frame.dispose() // rebuilt on its next use
  }

  /**
   * Makes the frame cheaper to draw, for a machine that cannot keep up: some sharpness a
   * step, which `SharpPass` largely gives back, and only then the off-screen anti-aliasing,
   * whose loss is what shows as stairs. The glow itself is never given up. Returns false once
   * there is nothing left to give.
   */
  cheapen() {
    if (this._scale > MIN_SCALE) {
      this._scale = Math.max(MIN_SCALE, this._scale * SCALE_STEP)
      this.resize(this._width, this._height)
      return true
    }
    if (this._smooth) {
      this._smooth = false
      this._sample()
      return true
    }
    return false
  }

  /**
   * Gets everything in `scene` ready to be drawn, what is hidden for now included: the flicked
   * cigarette, the shock of a blast, the fire front. Otherwise each is made ready by the card
   * in the frame it first shows, and that frame stalls. Call once a scene is built, before
   * its first `render`, and draw nothing of it until the promise this returns is kept.
   *
   * The wait is as long as those stalls would have been, but where the browser can make
   * materials ready off to one side the page is not held still for it: on Windows, where each
   * is first turned into the system's own kind of shader, it can be many seconds, and a tab
   * frozen black for that long looked like a game that had failed to start.
   *
   * That makes the materials ready and no more: a thing's shape and textures still go to the
   * card in the frame it is first in view. `thorough` sends those now as well, by drawing the
   * whole scene once where nobody sees it, what is out of view included. It is a longer wait,
   * for a machine that was seen to stutter (`stutter.js`).
   */
  async prepare(scene, camera, { thorough = false } = {}) {
    // Into the frame the scene is really drawn to: a material is made ready for one kind of frame.
    const frame = this._frame
    await this._withEverything(scene, false, () => {
      this._renderer.setRenderTarget(frame)
      const ready = this._renderer.compileAsync(scene, camera)
      this._renderer.setRenderTarget(null)
      return ready
    })
    if (!thorough) return
    this._withEverything(scene, true, () => {
      this._renderer.setRenderTarget(frame)
      this._renderer.render(scene, camera) // drawn over by the frame that follows
      this._renderer.setRenderTarget(null)
    })
  }

  // Runs `work` with everything in `scene` showing, what is hidden for now included and, if
  // `unculled`, what is out of view; returns what `work` does.
  _withEverything(scene, unculled, work) {
    const hidden = []
    const culled = []
    scene.traverse((object) => {
      if (unculled && object.frustumCulled) {
        culled.push(object)
        object.frustumCulled = false
      }
      if (object.visible) return
      hidden.push(object)
      object.visible = true
    })
    try {
      return work()
    } finally {
      for (const object of hidden) object.visible = false
      for (const object of culled) object.frustumCulled = true
    }
  }

  // A held frame for a menu's little screen. It is scene colour only; the menu's
  // Picture pass gives the screen and its words one shared finish afterward.
  capture(scene, camera, target) {
    this._renderer.setRenderTarget(target)
    this._renderer.render(scene, camera)
    this._renderer.setRenderTarget(null)
  }

  render(scene, camera) {
    this._renderer.info.reset()
    this._shape.camera = camera
    this._retro.camera = camera
    this._mist.camera = camera
    const began = performance.now()
    this._renderer.setRenderTarget(this._frame)
    this._renderer.render(scene, camera)
    this._renderer.setRenderTarget(null)
    this._composer.render()
    this.drawMs = performance.now() - began
  }
}
