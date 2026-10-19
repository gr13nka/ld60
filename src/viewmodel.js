// The smoking habit: flicking the lit cigarette away, then lighting the next one. Owns the
// first-person hands that act it out, and drives the same beats on the third-person model.
// There is no meter for any of this — the hands, the flame and the smoke are the feedback.
//
// The clock that decides when the next flick is possible advances in `update`, on simulation
// time. Everything seen is worked out from that clock once a frame, in `present`.

import * as THREE from 'three'
import { Arm, GRIPS, poseQuaternion, warmHands } from './hands.js'
import { armsFor } from './run-arms.js'
import { materials, box, CIGARETTE_ASPECT, createCigar, createCigarette, createSmoke } from './models.js'
import { TRICKS, trickAt } from './tricks.js'

const RELEASE_AT = 0.18
const FLICK_SECONDS = 0.42
const LIGHT_SECONDS = 2.6
const READY_AT = FLICK_SECONDS + LIGHT_SECONDS
const FLICK_BUFFER_SECONDS = 0.15 // a flick asked for this long before a cigarette is ready is still taken
// Open the pack, pinch the exposed filter, draw it clear, then put the pack away before the
// lighter comes up. The extra time gives the two props a visible handoff in the same hand.
const PACK_OPEN = 0.17
const CIGARETTE_IN = 0.34
const DRAW_FROM = 0.39 // fingertips settle on the filter before the cigarette moves
const EXTRACTED = 0.47
const TURNED = 0.52
const PACK_AWAY = 0.59
const CUP_AT = 0.65
const STRIKE_FROM = 0.73
const FLAME_ON = 0.78
const EMBER_ON = 0.83
const FLAME_OFF = 0.89
const UNCUP_AT = 0.92
const EXHALE_AT = 0.95
const HANDS_AWAY = 0.99
const LID_OPENS_OVER = 0.04 // the fraction before PACK_OPEN that the lid takes to swing up

// An unhurried drag now and then while standing around, in seconds from its start.
const DRAG_EVERY = [18, 28] // observed smokers' breaths were commonly about 20–30 s apart
const DEMO_DRAG_EVERY = [6, 9]
const DRAG_INHALE = 0.65
const DRAG_LOWER = 1.65
const DRAG_EXHALE = 2.05
const EXHALE_SECONDS = 0.55 // a breath leaves over time, rather than as one cloud
const DRAG_SECONDS = 2.8
// How often a perekur's drag goes out as a smoke ring: now and then, not every time (the owner, 2026-10-15). A guess.
const RING_CHANCE = 0.3

// A cigar's light is a ritual of its own on the same beats (`READY_AT` is the game's, and
// does not move): the case's lid is thumbed up, nothing is tapped and the cigar is drawn
// straight out, and the torch's jet is on from the press of its button, not from a spark.
const CIGAR_DRAWN = 0.18 // metres a cigar comes up out of its case, a cigarette 0.14 out of its pack

// Now and then the idle moment is a trick with the cigarette instead of a drag (`tricks.js`).
const TRICK_SHARE = 0.5
const TRICK_CURL_RATE = 40 // the fingers are quicker about a trick than about anything but the flick
const CATCH_SECONDS = 0.08 // the cigarette settling into the fingers that caught it
const SHED_INTERVAL = 0.04 // between the sparks a spinning cigarette drops
const STRUCK_SPARKS = 6
const CLEAR_TRICK_SHARE = 0.5 // how often a cleared level gets a trick, in the air
const CLEAR_TRICK_AFTER = 1.2 // seconds after the clear, once the goal's blast has had its moment
const REHEARSAL_WAIT = 1 // seconds between two goes at a trick being rehearsed

// Robbed (`snatch`): the right hand left open where the cigarette was, then the pack brought up
// and opened on nothing, which is all that says it was the last one. Seconds from the snatch.
const ROBBED_GAPE = 0.6 // the open hand stays where it held the cigarette
const ROBBED_PACK = [0.45, 2.1] // the pack up, and on its way back down
const ROBBED_LID = [0.9, 1.05, 1.75, 1.9] // the lid opening, open, and shut again
const ROBBED_SECONDS = 2.5
const ROBBED_FLINCH = [0.25, 0.35, 0.15] // the kick the right hand takes, in hand metres per second

// Lending a light (`lend`): the lighter held out at arm's length toward the tip of someone else's
// cigarette, struck, held there burning, and taken back. Seconds from the lend.
const LEND_STRIKE = 0.4
const LEND_FLAME = [0.45, 1.45] // lit at the strike's sparks, and let go
const LEND_SECONDS = 2
const LEND_REACH = 0.62 // metres out from the eye, toward the tip, that the flame is held at
const LEND_SPREAD = 0.45 // radians off the middle of the view the flame may go: the hand stays in sight
// While someone asks for a light (`present`'s `lendTo`), the lighter is held up ready in the left
// hand, as the cigarette is in the right: that is all that says a click will give it.
const LEND_READY = { at: [0.2, -0.4, -0.6], pitch: 0.3, yaw: 0.35, roll: -Math.PI / 2 }

const HAND_OVER_SECONDS = 0.35 // the cigarette passing between hand and mouth
const SWAY = 0.5 // how much of a turn of the head the hands lag behind by
const SWAY_FLIP = 1 // radians of yaw in one frame that no head turns: the view went over the top
const SWAY_LIMIT = 0.1
// The wind shoves the hands about: random kicks to each arm's spring, in hand metres per
// second per root second, so the shudder looks the same at any frame rate. Full strength at
// GUST_SPEED; swinging the arms across the stream by turning the head adds to it.
const GUST = 2.4
const GUST_SPEED = 60 // m/s
const GUST_PER_TURN = 1.0 // more gust per rad/s of the head turning, up to GUST_TURN_CAP
const GUST_TURN_CAP = 4
// Keep the full hand, including the wrist behind its grip, beyond the 0.3 m near plane.
// Moving the rig forward also keeps low gestures inside the standing camera's 72° view.
const RIG_DEPTH = -0.12
// The hands are drawn after everything else, and nothing of the world drawn before them hides
// them, as a shooter's gun is: up against a wall they would otherwise sink into it, which is the
// wall seen through. Each part has a twin of the same shape drawn just before the hands, which
// writes nothing but the far depth where the hands will be; the hands then hide their own
// parts by depth as ever, and leave their true depth for the ink and the mist (`picture.js`).
const HANDS_LAST = 1e6 // `renderOrder`, over anything the world sets (the editor's 999)

const CIGARETTE_LENGTH = 0.15
const CIGARETTE_RADIUS = CIGARETTE_LENGTH / CIGARETTE_ASPECT
const BURN_SECONDS = 300 // a five-minute cigarette; real smokers in one study took 2.5–8.5 minutes
const ASH_SECONDS = 45 // let about a centimetre of ash grow before tapping it off
const BURNOUT_PAUSE = 0.65 // the spent filter is gone before the next cigarette is taken out
const ASH_TAP_SECONDS = 0.42
const ASH_TAP_AT = 0.2
const SMOKE_DEMO_RATE = 6 // preview the several-minute burn within a short showroom visit
const HELD_AT = 0.3 // how far along the cigarette the fingers hold it; a cigar is held as far from its head
const HELD_TILT = 0.6 // how far it leans from square to the fingers toward their tips

// The pack lies in the left palm, shown to the face: the forearm comes in across the view,
// the wrist is turned thumb up, the thumb runs up one narrow side and the fingers come round
// the other. Whatever the forearm does, the carton is mounted to stand upright in the view.
const PACK_HOLD = { pitch: 0.25, yaw: 1.15, roll: -Math.PI / 2 }
const PACK_SEEN_AT = [-0.23, -0.355, -0.67] // the carton's centre, in the rig's space
const PACK_IN_HAND = [0.015, -0.053, -0.085] // the same point in the hand's: back to the palm
const PACK_SLIM = [0.68, 0.68] // width and depth of the carton as modelled, to fit the grip
const PACK_HALF_HEIGHT = 0.065
const PACK_THUMB_SPREAD = 0.7 // radians the thumb opens to take the carton's width
// A cigar case is the carton's size across, to lie in the same hand the same way, and taller
// by what a cigar is longer.
const CASE = { width: 0.085, depth: 0.05, height: 0.15, wall: 0.004, lid: 0.04 }
const CASE_SLOTS = [-0.02, 0.02] // where its two cigars stand across it; the first is the one drawn

// Where the right hand's grip goes in camera space, the forearm's pitch and inward yaw, and
// the wrist's roll (negative turns the thumb up, -PI the palm to the face). The left arm
// mirrors these. All of it has to stay beyond the camera's near plane.
const POSES = {
  // Thumb side up, the cigarette leaning up and out to the right.
  hold: { at: [0.2, -0.37, -0.62], pitch: 0.35, yaw: 0.45, roll: -0.9 },
  ash: { at: [0.23, -0.39, -0.62], pitch: 0.43, yaw: 0.5, roll: -0.98 },
  // Palm to the face, sinking under the view to where the mouth is.
  mouth: { at: [0.02, -0.32, -0.54], pitch: 1.43, yaw: 0.08, roll: -Math.PI },
  windup: { at: [0.2, -0.37, -0.62], pitch: 0.35, yaw: 0.45, roll: -0.94 },
  thrown: { at: [0.2, -0.365, -0.635], pitch: 0.35, yaw: 0.45, roll: -0.86 },
  // Just under the edge of the view, where the next cigarette comes from.
  fetch: { at: [0.26, -0.47, -0.56], pitch: 0.35, yaw: 0.45, roll: -0.9 },
  away: { at: [0.35, -0.7, -0.45], pitch: 0.2, yaw: 0.3, roll: -0.6 },
  // Flat hands at the lower corners of the view, reaching out along the wing's leading edge.
  wing: { at: [0.8, -0.3, -0.75], pitch: 0.1, yaw: -0.5, roll: -0.25 },
}
// Something carried in the left palm and held up to be read (`carry`): the hand cupped low and
// left of the middle of the view, clear of the right hand's hold; the thing itself lies at its
// own tilt toward the eye over the fingers, whatever the wrist does.
const CARRY = { at: [0.1, -0.21, -0.5], pitch: 0.75, yaw: 0.3, roll: -2.5 } // held up to be read, in the lower third
const CARRY_GRIP = [0.35, 0.42, 0.48, 0.52, 0.58]
const CARRY_OVER_FINGERS = new THREE.Vector3(0.05, 0.02, 0.02) // rig metres from the grip to its middle: over the palm, in front of it
const CARRY_TILT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.25) // face up, turned nearly square to the eye
// Fingers point down into the open pack with the forearm above them. The packet's socket
// describes the cigarette's axis, not a rotation a human wrist can follow.
const PACK_PICK = { pitch: -0.65, yaw: 0.2, roll: -0.35 }
const PACK_PINCH = [0.55, 0.34, 0.3, 0.56, 0.62] // fingertips meet without curling into a claw
// On foot his arms are a runner's (`run-arms.js`) and the cigarette is in his mouth, as in
// flight, once he has the second of these shares of a run's pace (the owner's, 2026-10-12),
// and until he has been under the first for `RUN_ARMS_LINGER` seconds: a climb or a wall met
// stops him for a moment, and the cigarette is not taken out and put back for that.
const RUN_ARMS = [0.3, 0.7]
const RUN_ARMS_LINGER = 1.5

const _from = new THREE.Vector3()
const _forward = new THREE.Vector3()
const _slotAt = new THREE.Vector3()
const _tapAt = new THREE.Vector3()
const _slotQuat = new THREE.Quaternion()
const _rigQuat = new THREE.Quaternion()
const _contactAt = new THREE.Vector3()
const _contactQuat = new THREE.Quaternion()
const _contactEuler = new THREE.Euler(0, 0, 0, 'YXZ')
const _poseAt = new THREE.Vector3()
const _poseQuat = new THREE.Quaternion()
const _spin = new THREE.Quaternion()
const _about = new THREE.Vector3()
const _lendAt = new THREE.Vector3()
const easeBetween = (value, start, end) => THREE.MathUtils.smoothstep(value, start, end)

const CIGAR_RADIUS = CIGARETTE_RADIUS * 1.45 // as `createSmoke` makes the one in the hand
// How high in a pack or a case the fingers take what is drawn: its head just over the rim.
const SOCKET_HEIGHT = 0.145 - HELD_AT * CIGARETTE_LENGTH

// A hollow flip-top pack: its lid and extraction socket remain separate moving parts. It is
// modelled wide and squeezed to PACK_SLIM; the socket stays out of the squeeze so that what
// it says about the cigarette's turn stays true.
export function createPack() {
  const [slimX, slimZ] = PACK_SLIM
  const root = new THREE.Group()
  const shell = new THREE.Group()
  shell.scale.set(slimX, 1, slimZ)
  root.add(shell)
  shell.add(box(0.12, 0.13, 0.008, materials.paper, 0, 0.065, -0.032))
  shell.add(box(0.12, 0.13, 0.008, materials.paper, 0, 0.065, 0.032))
  for (const x of [-0.056, 0.056]) shell.add(box(0.008, 0.13, 0.064, materials.paper, x, 0.065, 0))
  shell.add(box(0.12, 0.008, 0.064, materials.paper, 0, 0, 0))
  shell.add(box(0.122, 0.04, 0.066, materials.lighter, 0, 0.045, 0))
  shell.add(box(0.07, 0.008, 0.002, materials.gold, 0, 0.08, 0.037))
  const lid = new THREE.Group()
  lid.position.set(0, 0.13, -0.036 * slimZ)
  lid.scale.set(slimX, 1, slimZ)
  lid.add(box(0.125, 0.008, 0.075, materials.paper, 0, 0.03, 0.034))
  lid.add(box(0.125, 0.03, 0.008, materials.lighter, 0, 0.015, 0.068))
  for (const x of [-0.059, 0.059]) lid.add(box(0.008, 0.03, 0.07, materials.paper, x, 0.015, 0.034))
  root.add(lid)
  const filling = new THREE.Group()
  shell.add(filling)
  // The middle cigarette is the one carried by the holder, including while it is in the pack.
  for (const x of [-0.036, 0.036]) {
    const cigarette = createCigarette(0.13, 0.13 / CIGARETTE_ASPECT)
    cigarette.ember.visible = false
    cigarette.group.rotation.x = Math.PI / 2
    cigarette.group.position.set(x, 0.14, -0.012)
    filling.add(cigarette.group)
  }
  const socket = new THREE.Group()
  socket.position.set(0, SOCKET_HEIGHT, 0.016 * slimZ)
  socket.rotation.x = Math.PI + HELD_TILT
  root.add(socket)
  // The carton with its lid shut, for whatever closes a hand on it.
  const bounds = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(0, 0.082, 0), new THREE.Vector3(0.125 * slimX, 0.164, 0.075 * slimZ))
  return { root, lid, socket, bounds, filling }
}

// A cigar case in black lacquer, gold at its hinges and inlaid on its face, to `createPack`'s
// contract: `lid` swings up from the back, `socket` is where the fingers take the cigar that
// is drawn, `bounds` the case shut, `filling` what is seen inside it (hidden when it is empty).
// Two cigars fill it at their true size, heads under the lid.
function createCase() {
  const { width, depth, height, wall, lid: skirt } = CASE
  const { lacquer, gold } = materials
  const root = new THREE.Group()
  for (const z of [-1, 1]) root.add(box(width, height, wall, lacquer, 0, height / 2, z * (depth - wall) / 2))
  for (const x of [-1, 1]) root.add(box(wall, height, depth, lacquer, x * (width - wall) / 2, height / 2, 0))
  root.add(box(width, wall, depth, lacquer, 0, wall / 2, 0))
  const face = depth / 2 + 0.0005
  for (const y of [0.035, 0.115]) root.add(box(0.058, 0.003, 0.001, gold, 0, y, face))
  for (const x of [-0.0275, 0.0275]) root.add(box(0.003, 0.08, 0.001, gold, x, 0.075, face))
  const crest = box(0.014, 0.014, 0.001, gold, 0, 0.075, face)
  crest.rotation.z = Math.PI / 4
  root.add(crest)
  for (const x of [-0.025, 0.025]) root.add(box(0.014, 0.012, wall, gold, x, height - 0.004, -depth / 2 - wall / 2))

  const lid = new THREE.Group()
  lid.position.set(0, height, -depth / 2)
  lid.add(box(width + wall, wall, depth + wall, lacquer, 0, skirt, depth / 2))
  lid.add(box(width + wall, skirt, wall, lacquer, 0, skirt / 2, depth + wall / 2))
  for (const x of [-1, 1]) lid.add(box(wall, skirt, depth, lacquer, x * width / 2, skirt / 2, depth / 2))
  lid.add(box(width + wall + 0.001, 0.005, 0.001, gold, 0, 0.005, depth + wall + 0.0005))
  root.add(lid)

  const [drawn, ...others] = CASE_SLOTS
  const top = height + skirt - 0.01 // where a cigar's head is, under the shut lid
  const filling = new THREE.Group()
  root.add(filling)
  for (const x of others) {
    const cigar = createCigar(top - 0.01, CIGAR_RADIUS)
    cigar.ember.visible = false
    cigar.group.rotation.x = Math.PI / 2 // head up
    cigar.group.position.set(x, top, 0)
    filling.add(cigar.group)
  }
  const socket = new THREE.Group()
  socket.position.set(drawn, top - HELD_AT * CIGARETTE_LENGTH, 0)
  socket.rotation.x = Math.PI + HELD_TILT
  root.add(socket)
  const bounds = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(0, (height + skirt) / 2, 0), new THREE.Vector3(width + wall, height + skirt, depth + wall))
  return { root, lid, socket, bounds, filling }
}

// A lighter, lying across the left fist and sticking out past the thumb: `{ root, wheel,
// flame }`, the flame's foot 0.12 along it. The cigarette's is a wheel and a soft flame; the
// cigar's (`torch`) a lacquered slab with a button, no wheel, and a hard blue jet.
function createLighter(torch) {
  const root = new THREE.Group()
  root.position.set(0, -0.034, -0.1)
  root.rotation.z = -Math.PI / 2
  const flame = new THREE.Group()
  flame.position.y = 0.12
  let wheel = null
  if (torch) {
    root.add(box(0.024, 0.1, 0.034, materials.lacquer, 0, 0.05, 0))
    root.add(box(0.025, 0.008, 0.035, materials.gold, 0, 0.1, 0))
    root.add(box(0.016, 0.016, 0.02, materials.steel, 0, 0.112, -0.004))
    root.add(box(0.012, 0.008, 0.01, materials.gold, 0, 0.108, 0.012))
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.075, 6), JET)
    jet.position.y = 0.0375
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.003, 0.04, 5), JET_CORE)
    core.position.y = 0.02
    flame.add(jet, core)
  } else {
    root.add(box(0.02, 0.1, 0.032, materials.lighter, 0, 0.05, 0))
    root.add(box(0.02, 0.02, 0.032, materials.steel, 0, 0.11, 0))
    wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.022, 10), materials.steel)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(0, 0.123, 0.008)
    root.add(wheel)
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.06, 6), materials.flame)
    outer.position.y = 0.03
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.03, 5), materials.warmLight)
    core.position.y = 0.018
    flame.add(outer, core)
  }
  root.add(flame)
  return { root, wheel, flame }
}
// A torch's jet: blue, and white at its heart, which is bright enough to glow.
const JET = new THREE.MeshBasicMaterial({ color: 0x6fb8ff })
const JET_CORE = new THREE.MeshBasicMaterial({ color: 0xffffff })

// Gives each part of the hands a twin that clears the depth under it first (above, `HANDS_LAST`).
// Only what is drawn opaque: a twin left under nothing would leave the far depth, read as sky.
// A twin faces as its part does, or it clears where no part is drawn, or misses where one is.
const punches = new Map() // side → material
function keepInFront(rig) {
  const parts = []
  rig.traverse((part) => {
    if (!part.isMesh || part.isInstancedMesh) return
    // A part painted in several materials (a face and its sides) is opaque only if all of them are.
    if ([part.material].flat().every((material) => !material.transparent && material.visible && material.colorWrite)) parts.push(part)
  })
  for (const part of parts) {
    const { side } = [part.material].flat()[0]
    if (!punches.has(side)) {
      const punch = new THREE.MeshBasicMaterial({ colorWrite: false, depthFunc: THREE.AlwaysDepth, fog: false, side })
      punch.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(/}\s*$/, 'gl_FragDepth = 1.0;\n}')
      }
      punches.set(side, punch)
    }
    const twin = part.isSkinnedMesh ? new THREE.SkinnedMesh(part.geometry, punches.get(side)) : new THREE.Mesh(part.geometry, punches.get(side))
    if (part.isSkinnedMesh) twin.bind(part.skeleton, part.bindMatrix)
    twin.frustumCulled = part.frustumCulled
    twin.renderOrder = HANDS_LAST - 1
    part.renderOrder = HANDS_LAST
    part.add(twin)
  }
}

// Where the cigarette sits when it is in the mouth: low in the middle, pointing ahead and a little up.
const MOUTH = POSES.mouth
const _mouthQuat = poseQuaternion(MOUTH, 1, new THREE.Quaternion())
const _packPickQuat = poseQuaternion(PACK_PICK, 1, new THREE.Quaternion())
const _mouthAt = new THREE.Vector3().fromArray(MOUTH.at)

const rand = (min, max) => min + Math.random() * (max - min)

export class Smoker {
  /** `camera` carries the first-person hands; `player` is the third-person model; smoke goes to `effects`. */
  constructor(camera, player, effects) {
    this._player = player
    this._effects = effects
    this._clock = READY_AT // a lit cigarette in hand
    /** True for the one step in which the lighter's wheel is struck: as of the last `update`, and of no step since. */
    this.struck = false
    this._releasePending = false
    this._wanted = 0 // seconds for which a flick asked for too early is still owed
    this._dropped = false // the cigarette let fall, and the habit with it
    this._robbed = -1 // seconds since a crow took the cigarette (`snatch`), or -1
    this._lend = -1 // seconds into lending a light (`lend`), or -1
    this._shownLend = -1 // the same as of the last frame presented
    this._cigaretteAt = new THREE.Vector3() // where the cigarette was, in the world, as last shown
    this._shownLit = false // whether a lit cigarette was in the last frame shown
    this._shownClock = this._clock // the clock as of the last frame presented
    this._drag = -1 // seconds into an idle drag, or -1
    this._ring = false // whether the drag under way is a perekur's that goes out as a smoke ring
    this._trick = null // the trick being done, one of TRICKS
    this._trickFor = 0 // seconds into it
    this._rehearsed = null // a trick to do over and over, for looking at it
    this._cleared = false // as last told: whether the level has been cleared
    this._untilIdle = this._idleWait()
    this._flight = null // the flight the cigarette was on in the last frame shown
    this._loose = 0 // 1 with the cigarette in the air, 0 with it held
    this._looseAt = new THREE.Vector3() // where it is in the air, in the rig's space
    this._looseQuat = new THREE.Quaternion()
    this._tossQuat = new THREE.Quaternion() // how it lay as it left the hand
    this._shedTimer = 0
    this._inHand = 1 // 1 with the cigarette in the right hand, 0 with it in the mouth
    this._flare = 0
    this._warmth = 0
    this._wasInhaling = false
    this.inhaleCue = false
    this._burnAge = 0
    this._ashAge = 0
    this._ashFell = false
    this._ashTap = -1
    this._burnout = 0
    this._handsUp = 0
    this._lookYaw = 0
    this._lookPitch = 0
    this._lagYaw = 0
    this._lagPitch = 0
    this._headTurn = 0 // rad/s the view turned at over the last frame
    this._fresh = true // nothing shown yet: arrive in place instead of easing there
    this._carried = null // what the left hand holds up when asked (`carry`)
    this._carryPose = { at: [...POSES.away.at], pitch: 0, yaw: 0, roll: 0 }

    this._rig = new THREE.Group()
    this._rig.position.z = RIG_DEPTH
    camera.add(this._rig)

    this._right = new Arm(1)
    this._left = new Arm(-1)
    this._rig.add(this._right.root, this._left.root)

    this._left.anchor.set(0.15, -0.034, -0.1) // poses place the flame, not the fingers
    this._lightPose = { at: [0, 0, 0], pitch: 0.15, yaw: 0.25, roll: -Math.PI / 2 }
    this._shieldPose = { at: [0, 0, 0], pitch: 0.15, yaw: 0.6, roll: -1.9 }
    this._lendPose = { at: [...LEND_READY.at], pitch: 0.15, yaw: 0.1, roll: -Math.PI / 2 }
    this._pumping = false // his arms are a runner's
    this._slowFor = 0 // seconds he has been slow for, on foot

    this._pickAt = new THREE.Vector3()
    this._pickQuat = new THREE.Quaternion()
    this._packUp = new THREE.Vector3()
    this._picked = false
    this._contactPose = { at: [0, 0, 0], pitch: 0, yaw: 0, roll: 0 }
    this._pickGrip = [...GRIPS.relaxed]

    // The cigarette rides in its own holder, which follows the right hand's grip or sits where
    // the mouth is; the hand's `mouth` pose brings the two close enough to pass it across.
    // The cigar that may take its place is held as far from its head, so it shares the mount.
    this._smoke = createSmoke(CIGARETTE_LENGTH, CIGARETTE_RADIUS)
    this._smoke.group.rotation.x = -Math.PI / 2 - HELD_TILT
    this._smoke.group.position.set(0, -Math.cos(HELD_TILT), Math.sin(HELD_TILT)).multiplyScalar(HELD_AT * CIGARETTE_LENGTH)
    this._holder = new THREE.Group()
    this._holder.scale.copy(this._right.root.scale)
    this._holder.add(this._smoke.group)
    this._rig.add(this._holder)
    // The filter's point when it is held in the lips, rather than a guessed camera offset.
    this._mouthSmokeAt = this._smoke.group.position.clone().multiplyScalar(this._holder.scale.x)
      .applyQuaternion(_mouthQuat).add(_mouthAt)

    // Everything that differs between the two habits, made once for each (`_outfit`).
    this._outfits = [this._outfit(false), this._outfit(true)]
    this.setCigars(false)
    keepInFront(this._rig)
  }

  // What one habit is acted out with: the thing smoked, what it is carried and lit with, and
  // how the fingers hold each. `cigar` picks which.
  _outfit(cigar) {
    const smoke = cigar ? this._smoke.cigar : this._smoke.cigarette
    const lighter = createLighter(cigar)
    lighter.root.visible = false
    this._left.hand.add(lighter.root)

    const pack = cigar ? createCase() : createPack()
    // Upright, and turned about the vertical to lie square on the palm of the quarter-turned
    // wrist. The mount undoes the hand's own turn; the pose puts the carton where it is seen.
    const hold = poseQuaternion(PACK_HOLD, -1, new THREE.Quaternion())
    const upright = new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.PI / 2 - PACK_HOLD.yaw)
    const mount = pack.root
    mount.quaternion.copy(hold).invert().multiply(upright)
    mount.position.set(0, -PACK_HALF_HEIGHT, 0).applyQuaternion(mount.quaternion)
      .add(_from.fromArray(PACK_IN_HAND))
    // Poses of the left hand place the flame, so work back from the carton to where that is.
    const flameAt = _from.sub(this._left.anchor).applyQuaternion(hold)
      .multiplyScalar(-this._left.root.scale.x).add(_poseAt.fromArray(PACK_SEEN_AT))
    const packPose = { ...PACK_HOLD, at: [-flameAt.x, flameAt.y, flameAt.z] }
    // The fingers close on the carton itself, wherever it has been put in the hand.
    mount.updateMatrix()
    const intoPack = mount.matrix.clone().invert()
    const packGrip = this._left.closeOn(
      (point) => pack.bounds.distanceToPoint(_tapAt.copy(point).applyMatrix4(intoPack)), PACK_THUMB_SPREAD)
    mount.visible = false
    this._left.hand.add(mount)

    return {
      smoke,
      // Only this one responds to a drag; world fire shares the original materials.
      glow: smoke.ember.children
        .filter(part => part.material === materials.ember || part.material === materials.flame)
        .map(part => {
          const color = part.material.color.clone()
          part.material = part.material.clone()
          return { material: part.material, color }
        }),
      // A stable target shared by both hands while the lips hold it.
      mouthTip: new THREE.Vector3(0, 0, smoke.ember.position.z)
        .applyQuaternion(this._smoke.group.quaternion)
        .add(this._smoke.group.position)
        .multiplyScalar(this._holder.scale.x)
        .applyQuaternion(_mouthQuat).add(_mouthAt),
      pinch: cigar ? GRIPS.cigar : GRIPS.pinch,
      pack,
      packPose,
      packGrip,
      drawn: cigar ? CIGAR_DRAWN : 0.14,
      lighter,
      flameFrom: cigar ? STRIKE_FROM : FLAME_ON,
      flutter: cigar ? 0.25 : 1, // of a flame's: a jet hardly wavers
    }
  }

  /** Has him smoke cigars, case and torch with them, or cigarettes again. */
  setCigars(on) {
    this._cigars = on
    for (const { pack, lighter } of this._outfits) pack.root.visible = lighter.root.visible = false
    this._kit = this._outfits[on ? 1 : 0]
    this._smoke.setCigars(on)
    this._player.setCigars(on)
    this._fresh = true
  }

  /** Fast burn only in the smoke showroom; ordinary play keeps the measured-minute pace. */
  setSmokeDemo(on) {
    this._smokeDemo = on
    this._untilIdle = this._idleWait()
  }

  /**
   * Does the trick called `name` (a key of TRICKS) over and over whenever he stands idle, in
   * place of the usual wait and the drags: for looking at one while it is being worked on.
   */
  rehearse(name) {
    this._rehearsed = TRICKS[name] ?? null
    this._untilIdle = this._idleWait()
  }

  /** True when a lit cigarette is at hand, ready to flick. A trick does not hold it up. */
  get ready() {
    return !this._dropped && this._burnout <= 0 && this._clock >= READY_AT && this._lend < 0
  }

  /**
   * Where the lit cigarette is in the world, as of the last frame shown, in hand or mouth; null
   * while there is none lit to take (flicked, not yet lit, or the habit given up).
   */
  get heldAt() {
    return this._dropped || !this._shownLit ? null : this._cigaretteAt
  }

  /** Has him take a drag now, if he has a lit cigarette at hand and is doing nothing else with it. */
  drag() {
    if (this.ready && !this._trick && this._drag < 0) this._drag = 0
  }

  /**
   * A perekur's drag: a drag now, as `drag` takes one, whose breath now and then (`RING_CHANCE`)
   * goes out as a smoke ring as well as a lungful. False, and nothing, if he cannot take one now.
   */
  perekur() {
    if (!this.ready || this._trick || this._drag >= 0) return false
    this._drag = 0
    this._ring = Math.random() < RING_CHANCE
    return true
  }

  /** True while he is taking a drag that is not part of lighting up. */
  get dragging() {
    return this._drag >= 0
  }

  /**
   * Flicks the cigarette away and starts lighting the next. Asked a moment before one is ready,
   * the flick is taken as soon as it is. Returns false if none was ready now.
   */
  flick() {
    if (!this.ready) {
      this._wanted = FLICK_BUFFER_SECONDS
      return false
    }
    this._spend()
    return true
  }

  _spend() {
    this._clock = 0
    this._burnAge = this._ashAge = 0
    this._ashFell = false
    this._ashTap = -1
    this._releasePending = true
    this._wanted = 0
    this._picked = false
  }

  /**
   * Lets the cigarette fall and gives the habit up until the next `reset`: no clock, nothing
   * in the hands. Writes where the cigarette was in the last frame shown, in the world, to
   * `out` and returns it.
   */
  drop(out) {
    this._dropped = true
    this._releasePending = false
    return out.copy(this._cigaretteAt)
  }

  /**
   * Gives the left hand `thing` (an Object3D, face up, ahead toward -Z) to hold up when
   * `present`'s `carry` asks: drawn over the world as the hands are, so a wall does not cut it.
   */
  carry(thing) {
    this._carried = thing
    thing.visible = false
    this._rig.add(thing)
    keepInFront(thing)
  }

  /** Whether the left hand is free of the habit now: no pack, lighter or light being lent in it. */
  get handFree() {
    if (this._dropped) return this._lend < 0 && !(this._robbed >= 0 && this._robbed < ROBBED_SECONDS)
    const light = (this._clock - FLICK_SECONDS) / LIGHT_SECONDS
    return this._lend < 0 && this._burnout <= 0 && (light < 0 || light >= HANDS_AWAY)
  }

  /**
   * A crow took the cigarette out of his fingers, and it was the last one: the habit is given
   * up as by `drop` (until the next `reset`), with nothing let fall. The hand flinches, stays
   * open a moment, and the pack comes up empty.
   */
  snatch() {
    this._dropped = true
    this._releasePending = false
    this._robbed = 0
  }

  /**
   * The habit already given up, long ago: as after `snatch`, with no flinch, the hands at rest.
   * For a respawn after the crow has been (a `reset` would put the cigarette back in his hand).
   */
  quit() {
    this._dropped = true
    this._releasePending = false
    this._robbed = -1
  }

  /**
   * Lends a light: the lighter held out to the tip of someone else's cigarette (where is
   * `present`'s `lendTo`), struck, held burning a moment (`flameOut`), and taken back. Only with
   * the left hand free: a lit cigarette of his own at hand, or the habit given up and the lighter
   * kept; false, and nothing, if not.
   */
  lend() {
    if (this._dropped ? !this.handFree : !this.ready) return false
    this._lend = 0
    return true
  }

  /** True while he is lending a light, from the lend to the lighter put away. */
  get lending() {
    return this._lend >= 0
  }

  /** True while the flame of a light he lends is burning: what lights the other cigarette. */
  get flameOut() {
    return this._lend >= LEND_FLAME[0] && this._lend < LEND_FLAME[1]
  }

  /** Advances simulation time; returns true once on the projectile release beat, and sets `struck` for this step. */
  update(dt) {
    this.struck = false
    if (this._lend >= 0) {
      this.struck = this._lend < LEND_STRIKE && this._lend + dt >= LEND_STRIKE
      this._lend += dt
      if (this._lend >= LEND_SECONDS) this._lend = -1
    }
    if (this._dropped) return false
    if (this._burnout > 0) {
      this._burnout -= dt
      if (this._burnout <= 0) {
        this._clock = FLICK_SECONDS // prepare a new one without pretending to flick the spent filter
        this._burnAge = this._ashAge = 0
      }
      return false
    }
    const strikeAt = FLICK_SECONDS + STRIKE_FROM * LIGHT_SECONDS
    this.struck ||= this._clock < strikeAt && this._clock + dt >= strikeAt
    this._clock += dt
    if (!this._cigars && this._clock >= READY_AT) {
      const burnDt = dt * (this._smokeDemo ? SMOKE_DEMO_RATE : 1)
      this._burnAge += burnDt
      this._ashAge = Math.min(ASH_SECONDS, this._ashAge + burnDt)
      if (this._burnAge >= BURN_SECONDS) {
        this._burnAge = BURN_SECONDS
        this._burnout = BURNOUT_PAUSE
      }
    }
    if (this._wanted > 0) {
      this._wanted -= dt
      if (this.ready) this._spend()
    }
    if (this._releasePending && this._clock >= RELEASE_AT) {
      this._releasePending = false
      return true
    }
    return false
  }

  /** Starts a run with a lit cigarette in hand: the first flick is there to be taken at once. */
  reset() {
    this._clock = this._shownClock = READY_AT
    this._releasePending = false
    this._wanted = 0
    this._dropped = false
    this._robbed = -1
    this._lend = this._shownLend = -1
    for (const { pack } of this._outfits) pack.filling.visible = true
    this._drag = -1
    this._ring = false
    this._picked = false
    this._trick = this._flight = null
    this._loose = 0
    this._cleared = false
    this._untilIdle = this._idleWait()
    this._inHand = 1
    this._flare = this._warmth = this._handsUp = 0
    this._wasInhaling = this.inhaleCue = false
    this._burnAge = this._ashAge = this._burnout = 0
    this._ashFell = false
    this._ashTap = -1
    this._lagYaw = this._lagPitch = 0
    this._fresh = true
  }

  /**
   * Shows the habit as it stands, once a frame. `flying` picks where the arms rest and whether
   * the cigarette is held or in the mouth; `firstPerson` picks which body shows the act; `vel`
   * is the smoker's velocity, which the smoke inherits; `aim` is where he looks. `cleared`,
   * the level won and nothing left to do, lets a trick be done in the air. `afoot`, on foot
   * only, is what `armsFor` asks (`run-arms.js`) and `share`, how much of a run's pace he has.
   * `lendTo`, while someone asks him for a light, is where the tip of their cigarette is in the
   * world: the lighter is held up ready for it, and a `lend` is aimed at it. `carry`, 0 to 1,
   * is how far up the left hand holds what it was given to carry (`carry`), when it is free.
   */
  present(dt, { flying, firstPerson, vel, aim, cleared = false, afoot = null, lendTo = null, carry = 0 }) {
    this.inhaleCue = false
    this._carrying = carry > 0.01 && !flying && this._carried !== null && this.handFree
    if (this._carrying) {
      const into = THREE.MathUtils.smoothstep(carry, 0, 1)
      for (let i = 0; i < 3; i++) this._carryPose.at[i] = THREE.MathUtils.lerp(POSES.away.at[i], CARRY.at[i], into)
      for (const turn of ['pitch', 'yaw', 'roll']) this._carryPose[turn] = THREE.MathUtils.lerp(POSES.away[turn], CARRY[turn], into)
    }
    if (this._dropped) {
      this._wasInhaling = false
      this._presentEmptyHanded(dt, { firstPerson, aim, vel, flying, lendTo })
      return this._showCarried(firstPerson)
    }
    const clock = this._clock
    const flicked = clock < this._shownClock // a flick since the last frame
    const before = flicked ? 0 : this._shownClock
    this._shownClock = clock
    const passed = (seconds) => before < seconds && clock >= seconds
    const lightTime = (fraction) => FLICK_SECONDS + fraction * LIGHT_SECONDS

    const flicking = clock < FLICK_SECONDS
    // Progress through lighting: negative while still flicking, >= 1 once done.
    const light = (clock - FLICK_SECONDS) / LIGHT_SECONDS
    const lit = this._burnout <= 0 && (clock < RELEASE_AT || light >= EMBER_ON)
    const hasCigarette = this._burnout <= 0 && (clock < RELEASE_AT || !flicking)
    const lighting = !flicking && light < HANDS_AWAY
    const packing = !flicking && light < PACK_AWAY
    const mouthLighting = light >= PACK_AWAY && light < HANDS_AWAY
    const shielding = light >= CUP_AT && light < UNCUP_AT
    const firstDrag = light >= EMBER_ON && light < UNCUP_AT
    const kit = this._kit
    const flame = light >= kit.flameFrom && light < FLAME_OFF
    const lending = this._lend >= 0
    const lendBefore = this._shownLend
    this._shownLend = this._lend
    const lendFlame = this.flameOut

    // A man at a run does not stop to smoke: his arms are a runner's, and the habit waits.
    this._slowFor = afoot !== null && afoot.share < RUN_ARMS[0] ? this._slowFor + dt : 0
    this._pumping = afoot !== null && (this._pumping ? this._slowFor < RUN_ARMS_LINGER : afoot.share >= RUN_ARMS[1])
    const pumping = this._pumping
    const arms = pumping ? armsFor(afoot) : null
    const draggedFor = this._idle(dt, flying || pumping, cleared)
    const trick = this._trick && trickAt(this._trick, this._trickFor)
    const atMouth = draggedFor >= 0 && draggedFor < DRAG_LOWER
    const inhaling = firstDrag || (draggedFor >= DRAG_INHALE && draggedFor < DRAG_LOWER)
    this.inhaleCue = inhaling && !this._wasInhaling
    this._wasInhaling = inhaling

    // The cigarette changes hands, so to speak, on take-off, on landing and after a light in the air.
    const inHand = mouthLighting ? 0 : ((!flying && !pumping) || packing || flicking || trick ? 1 : 0)
    const handingOver = this._inHand !== inHand && hasCigarette
    // With no cigarette to be seen passing across, the next one simply starts where it belongs.
    if (this._fresh || !hasCigarette || mouthLighting) this._inHand = inHand
    else this._inHand = THREE.MathUtils.clamp(this._inHand + Math.sign(inHand - this._inHand) * (dt / HAND_OVER_SECONDS), 0, 1)

    // Wait until the cigarette is in the fingers; a cap grown during a run is tapped off
    // when he next stops, rather than falling from his mouth on a timer.
    const canTap = this.ready && !flying && !pumping && this._inHand > 0.95
      && !lighting && !trick && draggedFor < 0 && !this._cigars
    if (!canTap) this._ashTap = -1
    else if (this._ashTap < 0 && this._ashAge >= ASH_SECONDS) this._ashTap = 0
    let ashKick = false
    if (this._ashTap >= 0) {
      const beforeTap = this._ashTap
      this._ashTap += dt
      if (beforeTap < ASH_TAP_AT && this._ashTap >= ASH_TAP_AT) {
        ashKick = true
        this._ashFell = true
        this._ashAge = 0
      }
      if (this._ashTap >= ASH_TAP_SECONDS) this._ashTap = -1
    }
    const tapping = this._ashTap >= 0

    this._sway(dt, aim, flying || pumping)
    const { _right: right, _left: left } = this
    if (flying) this._buffet(dt, vel)
    if (clock < RELEASE_AT) right.reach(POSES.windup, GRIPS.flickLoaded)
    else if (flicking) right.reach(POSES.thrown, GRIPS.flicked)
    else if (packing) this._packHands(dt, light)
    else if (!hasCigarette) right.reach(POSES.fetch, GRIPS.relaxed)
    else if (shielding) {
      const tip = kit.mouthTip
      // Poses place the finger grip, not the palm. Put the fingers beyond the tip so
      // the palm itself shelters the flame on its windward side, opening toward the lips.
      this._shieldPose.at[0] = tip.x + 0.045
      this._shieldPose.at[1] = tip.y + 0.015
      this._shieldPose.at[2] = tip.z - 0.15
      right.reach(this._shieldPose, GRIPS.shield)
    } else if (mouthLighting) right.reach(MOUTH, light < CUP_AT ? GRIPS.relaxed : kit.pinch)
    else if (tapping) right.reach(POSES.ash, kit.pinch)
    else if (atMouth || handingOver) right.reach(POSES.mouth, kit.pinch)
    else if (trick) right.reach(trick.pose, trick.grip === GRIPS.pinch ? kit.pinch : trick.grip)
    else if (flying) right.reach(POSES.wing, GRIPS.wing)
    else if (pumping) right.reach(arms.right.pose, arms.right.grip)
    else right.reach(POSES.hold, kit.pinch)
    if (ashKick) right.kick(0, -0.28, 0.12)
    if (!packing) {
      if (this._fresh) right.snap()
      else right.update(dt, flicking ? 90 : trick ? TRICK_CURL_RATE : undefined)
    }

    this._holder.position.lerpVectors(_mouthAt, right.at, this._inHand)
    this._holder.quaternion.slerpQuaternions(_mouthQuat, right.quat, this._inHand)
    const struck = this._fly(dt, trick)
    if (flying && !mouthLighting) {
      // In the mouth it shivers in the wind.
      const shiver = 0.004 * Math.min(1, vel.length() / 90) * (1 - this._inHand)
      this._holder.position.x += rand(-shiver, shiver)
      this._holder.position.y += rand(-shiver, shiver)
    }

    const { ember } = kit.smoke
    // Asked for a light, the lighter is offered only with the left hand free of his own habit.
    const offering = !lending && lendTo !== null && !lighting && !flicking && !flying && !pumping
    if (lending) {
      if (lendTo) this._aimLend(lendTo) // gone from in front of him meanwhile, it stays where it was
      left.reach(this._lend >= LEND_FLAME[1] + 0.1 ? POSES.away : this._lendPose, this._lend >= LEND_STRIKE ? GRIPS.strike : GRIPS.lighter)
    } else if (offering) left.reach(LEND_READY, GRIPS.lighter)
    else if (light >= CUP_AT && light < FLAME_OFF) {
      // The lighter approaches from below the left cheek after the cigarette is in the lips.
      // Its anchor is the flame centre, so it meets the tip without crossing the cupping hand.
      const approach = easeBetween(light, CUP_AT, STRIKE_FROM)
      const tip = kit.mouthTip
      this._lightPose.at[0] = -(tip.x - 0.13 * (1 - approach))
      this._lightPose.at[1] = tip.y - 0.005 - 0.18 * (1 - approach)
      this._lightPose.at[2] = tip.z + 0.08 * (1 - approach)
      left.reach(this._lightPose, light >= STRIKE_FROM ? GRIPS.strike : GRIPS.lighter)
    } else if (!packing) {
      if (this._carrying) left.reach(this._carryPose, CARRY_GRIP)
      else if (flying && !lighting) left.reach(POSES.wing, GRIPS.wing)
      else if (pumping && !lighting) left.reach(arms.left.pose, arms.left.grip)
      else left.reach(POSES.away, GRIPS.relaxed)
    }
    if (!packing) {
      if (this._fresh) left.snap()
      else left.update(dt)
    }
    this._fresh = false
    this._showCarried(firstPerson)

    kit.pack.root.visible = packing
    kit.pack.lid.rotation.x = -1.9 * easeBetween(light, PACK_OPEN - LID_OPENS_OVER, PACK_OPEN)
      * (1 - easeBetween(light, EXTRACTED, PACK_AWAY))
    if (packing && light < DRAW_FROM) {
      // The cigarette waits in the carton while the arm settles on the filter.
      this._holder.position.copy(_slotAt)
      this._holder.quaternion.copy(_slotQuat)
    } else if (packing && light < TURNED) {
      // The cigarette leaves along the pack's axis; only once clear does it turn in the
      // fingers toward the hand's ordinary hold.
      this._holder.position.lerpVectors(_slotAt, right.at,
        easeBetween(light, DRAW_FROM, DRAW_FROM + 0.02))
      this._holder.quaternion.slerpQuaternions(this._pickQuat, right.quat,
        easeBetween(light, EXTRACTED, TURNED))
    }

    this._rig.visible = firstPerson
    right.showWing(flying && !trick)
    left.showWing(flying)
    const { root: lighter, wheel, flame: fire } = kit.lighter
    lighter.visible = (!flicking && light >= CUP_AT && light < HANDS_AWAY + 0.1) || lending || offering
    if (wheel) {
      wheel.rotation.x = -2.4 * (lending ? easeBetween(this._lend, LEND_STRIKE, LEND_FLAME[0]) : easeBetween(light, STRIKE_FROM, FLAME_ON))
    }
    fire.visible = flame || lendFlame
    const flutter = (shielding ? 0.06 : 0.2) * kit.flutter
    fire.scale.set(1 + rand(-flutter, flutter), 1 + rand(-flutter, flutter), 1)
    fire.rotation.z = rand(-flutter, flutter)
    // The hands catch the flame's light.
    this._warmth += ((flame || lendFlame ? 1 : 0) - this._warmth) * Math.min(1, 18 * dt)
    warmHands(this._warmth)

    // A drag brightens the coal without swelling either the tobacco or the ash ring.
    if (passed(lightTime(EMBER_ON))) this._flare = 1
    if (inhaling) this._flare = Math.min(1, this._flare + 4 * dt)
    else this._flare *= Math.exp(-5 * dt)
    this._holder.visible = hasCigarette
    ember.visible = lit
    const used = this._burnAge / BURN_SECONDS
    const ash = this._ashAge / ASH_SECONDS
    this._smoke.setBurn(used, ash)
    this._player.setBurn(used, ash)
    const glow = 0.8 + 0.18 * this._flare + 0.02 * Math.sin(clock * 7)
    for (const { material, color } of kit.glow) material.color.copy(color).multiplyScalar(glow)

    const handsUp = lighting ? 1 : 0
    this._handsUp += (handsUp - this._handsUp) * Math.min(1, 14 * dt)
    this._player.setHands(this._handsUp)
    this._player.setCigarette(hasCigarette, lit)
    if (this._ashFell && hasCigarette) {
      this._effects.cigaretteAsh(firstPerson ? ember.getWorldPosition(_from) : this._player.emberWorld(_from), vel)
    }
    this._ashFell = false
    // Kept for `drop` and `heldAt`, which are asked between frames and must not read the rig then.
    this._smoke.group.getWorldPosition(this._cigaretteAt)
    this._shownLit = hasCigarette && lit

    const exhaling = (clock >= lightTime(EXHALE_AT) && clock < READY_AT + EXHALE_SECONDS)
      || (draggedFor >= DRAG_EXHALE && draggedFor < DRAG_EXHALE + EXHALE_SECONDS)
    const moving = flying || (afoot !== null && afoot.share >= RUN_ARMS[0])
    if (!firstPerson) {
      if (lit) this._smokeBehind(exhaling, vel, moving)
      return
    }
    if (passed(RELEASE_AT)) this._effects.flecks(right.hand.getWorldPosition(_from), vel, 4)
    if (wheel && passed(lightTime(FLAME_ON))) this._effects.flecks(fire.getWorldPosition(_from), vel, 6) // the flint's sparks
    if (wheel && lending && lendBefore < LEND_FLAME[0] && this._lend >= LEND_FLAME[0]) this._effects.flecks(fire.getWorldPosition(_from), vel, 6)
    if (!lit) return
    if (struck) this._effects.flecks(ember.getWorldPosition(_from), vel, STRUCK_SPARKS)
    if (this._flight?.shedding && (this._shedTimer -= dt) <= 0) {
      this._shedTimer = SHED_INTERVAL
      this._effects.flecks(ember.getWorldPosition(_from), vel, 1)
    }
    this._emberSmoke(ember.getWorldPosition(_from), vel, moving)
    if (exhaling) {
      // Breath comes from the mouth, just under the view; the rig faces down the camera's -Z.
      this._rig.getWorldDirection(_forward).negate()
      this._breathe(this._rig.localToWorld(_from.copy(this._mouthSmokeAt)), _forward, vel, 0.65)
    }
    if (this._ring && draggedFor >= DRAG_EXHALE && draggedFor - dt < DRAG_EXHALE) {
      this._ring = false
      this._rig.getWorldDirection(_forward).negate()
      this._effects.smokeRing(this._rig.localToWorld(_from.copy(this._mouthSmokeAt)), _forward, vel)
    }
  }

  // What the left hand carries, over its fingers where the hand is now, at its own tilt.
  _showCarried(firstPerson) {
    const thing = this._carried
    if (!thing) return
    thing.visible = firstPerson && this._carrying
    if (!thing.visible) return
    thing.position.copy(this._left.at).add(CARRY_OVER_FINGERS)
    thing.quaternion.copy(CARRY_TILT)
  }

  // After the drop there is no habit left to show: both hands sink out of view and stay there.
  // Robbed, they first find out that it was the last one (`_presentRobbed`). The lighter is kept:
  // asked for a light, the left hand still holds it up and lends one, as with a cigarette at hand.
  _presentEmptyHanded(dt, { firstPerson, aim, vel, flying, lendTo }) {
    const robbed = this._robbed >= 0 && this._robbed < ROBBED_SECONDS
    if (robbed) this._presentRobbed(dt)
    else {
      for (const arm of [this._right, this._left]) arm.reach(POSES.away, GRIPS.relaxed)
      this._kit.pack.root.visible = false
    }
    const lending = this._lend >= 0
    const lendBefore = this._shownLend
    this._shownLend = this._lend
    const offering = !lending && !robbed && lendTo !== null && !flying
    if (lending) {
      if (lendTo) this._aimLend(lendTo)
      this._left.reach(this._lend >= LEND_FLAME[1] + 0.1 ? POSES.away : this._lendPose, this._lend >= LEND_STRIKE ? GRIPS.strike : GRIPS.lighter)
    } else if (offering) this._left.reach(LEND_READY, GRIPS.lighter)
    else if (this._carrying) this._left.reach(this._carryPose, CARRY_GRIP)
    for (const arm of [this._right, this._left]) {
      arm.update(dt)
      arm.showWing(false)
    }
    this._sway(dt, aim, false)
    this._rig.visible = firstPerson
    this._holder.visible = false
    const { root: lighter, wheel, flame: fire } = this._kit.lighter
    lighter.visible = lending || offering
    if (wheel) wheel.rotation.x = -2.4 * easeBetween(this._lend, LEND_STRIKE, LEND_FLAME[0])
    fire.visible = this.flameOut
    this._warmth += ((this.flameOut ? 1 : 0) - this._warmth) * Math.min(1, 18 * dt)
    warmHands(this._warmth)
    if (firstPerson && wheel && lending && lendBefore < LEND_FLAME[0] && this._lend >= LEND_FLAME[0]) this._effects.flecks(fire.getWorldPosition(_from), vel, 6)
    this._player.setHands(0)
    this._player.setCigarette(false, false)
  }

  // The right hand open where the cigarette was taken from, then away; the pack brought up in
  // the left, its lid opened on nothing and shut, and put away.
  _presentRobbed(dt) {
    if (this._robbed === 0 && dt > 0) this._right.kick(...ROBBED_FLINCH)
    this._robbed += dt
    const t = this._robbed
    const { pack, packPose, packGrip } = this._kit
    this._right.reach(t < ROBBED_GAPE ? POSES.hold : POSES.away, GRIPS.relaxed)
    const [up, down] = ROBBED_PACK
    this._left.reach(t >= up && t < down ? packPose : POSES.away, t >= up ? packGrip : GRIPS.relaxed)
    const [opening, open, shutting, shut] = ROBBED_LID
    pack.root.visible = t >= up
    pack.filling.visible = false
    pack.lid.rotation.x = -1.9 * easeBetween(t, opening, open) * (1 - easeBetween(t, shutting, shut))
  }

  // The lend's pose aimed along the line from the eye to `tip`, a point in the world: LEND_REACH
  // out along it, kept within LEND_SPREAD of the middle of the view. The hands are drawn over the
  // world at their own scale, so the flame meets the tip in the picture, not in the world.
  _aimLend(tip) {
    const camera = this._rig.parent
    camera.worldToLocal(_lendAt.copy(tip)) // the camera looks down its -Z
    const across = THREE.MathUtils.clamp(Math.atan2(_lendAt.x, -_lendAt.z), -LEND_SPREAD, LEND_SPREAD)
    const up = THREE.MathUtils.clamp(Math.atan2(_lendAt.y, Math.hypot(_lendAt.x, _lendAt.z)), -LEND_SPREAD, LEND_SPREAD)
    _lendAt.set(Math.sin(across) * Math.cos(up), Math.sin(up), -Math.cos(across) * Math.cos(up)).multiplyScalar(LEND_REACH)
    this._rig.worldToLocal(camera.localToWorld(_lendAt))
    // A left hand's pose is given as the right's would be, mirrored across the view.
    this._lendPose.at[0] = -_lendAt.x
    this._lendPose.at[1] = _lendAt.y
    this._lendPose.at[2] = _lendAt.z
  }

  // The packet gives the hand a target; the arm's spring carries it there. The cigarette
  // waits for contact, then follows the actual hand rather than its ahead-of-time target.
  _packHands(dt, light) {
    const left = this._left
    const { pack, packPose, packGrip, pinch } = this._kit
    // The pack comes up out of the pocket already gripped, and goes back the same way.
    if (this._fresh) {
      left.reach(POSES.away, packGrip)
      left.snap()
    }
    left.reach(light < EXTRACTED ? packPose : POSES.away, packGrip)
    left.update(dt)

    pack.socket.getWorldPosition(_slotAt)
    this._rig.worldToLocal(_slotAt)
    pack.socket.getWorldQuaternion(_slotQuat)
    this._rig.getWorldQuaternion(_rigQuat)
    _slotQuat.premultiply(_rigQuat.invert())
    if (light < DRAW_FROM || !this._picked) {
      this._pickAt.copy(_slotAt)
      this._pickQuat.copy(_slotQuat)
      // The slot points down the cigarette; extraction goes up the carton's axis.
      this._packUp.set(0, -Math.cos(HELD_TILT), Math.sin(HELD_TILT))
        .applyQuaternion(_slotQuat)
      this._picked = light >= DRAW_FROM
    }

    if (light < DRAW_FROM) {
      // Reach over the opened lid to the filter. The lift in the path keeps the fingers out
      // of the front wall; the closing grip waits until they meet the cigarette.
      const approach = easeBetween(light, PACK_OPEN, CIGARETTE_IN)
      _poseAt.fromArray(POSES.fetch.at)
      _contactAt.lerpVectors(_poseAt, _slotAt, approach)
      _contactAt.y += 0.09 * Math.sin(Math.PI * approach)
      _contactAt.z += 0.07 * Math.sin(Math.PI * approach)
      poseQuaternion(POSES.fetch, 1, _poseQuat)
      _contactQuat.slerpQuaternions(_poseQuat, _packPickQuat, approach)
    } else {
      _contactAt.copy(this._pickAt).addScaledVector(this._packUp,
        this._kit.drawn * easeBetween(light, DRAW_FROM, EXTRACTED))
      // The hand turns toward the mouth after the cigarette clears the rim.
      const turn = easeBetween(light, EXTRACTED, TURNED)
      _contactQuat.slerpQuaternions(_packPickQuat, _mouthQuat, turn)
      _contactAt.lerp(_mouthAt, easeBetween(light, TURNED, PACK_AWAY))
    }
    _contactEuler.setFromQuaternion(_contactQuat, 'YXZ')
    const pose = this._contactPose
    _contactAt.toArray(pose.at)
    pose.pitch = _contactEuler.x
    pose.yaw = _contactEuler.y
    pose.roll = _contactEuler.z
    const closing = easeBetween(light, CIGARETTE_IN - 0.055, CIGARETTE_IN)
    const changingHold = easeBetween(light, EXTRACTED, TURNED)
    for (let i = 0; i < this._pickGrip.length; i++) {
      this._pickGrip[i] = THREE.MathUtils.lerp(GRIPS.relaxed[i],
        THREE.MathUtils.lerp(PACK_PINCH[i], pinch[i], changingHold), closing)
    }
    this._right.reach(pose, this._pickGrip)
    this._right.update(dt)
  }

  // Puts the cigarette where a trick has thrown it: on its arc while a flight lasts, then back
  // into the fingers over CATCH_SECONDS, which is also how a trick cut short gives it back.
  // Returns true in the frame a flight begins with a blow.
  _fly(dt, trick) {
    const flight = trick ? trick.flight : null
    const begun = flight !== null && flight !== this._flight
    this._flight = flight
    if (flight) {
      // Batted on, it keeps the turn it came down with; let go, the way the fingers held it.
      if (begun) this._tossQuat.copy(this._loose > 0 ? this._looseQuat : this._holder.quaternion)
      this._looseAt.fromArray(trick.at)
      this._looseQuat.copy(this._tossQuat).premultiply(_spin.setFromAxisAngle(_about.fromArray(flight.about), trick.turn))
      this._loose = 1
    } else this._loose = Math.max(0, this._loose - dt / CATCH_SECONDS)
    if (this._loose > 0) {
      this._holder.position.lerp(this._looseAt, this._loose)
      this._holder.quaternion.slerp(this._looseQuat, this._loose)
    }
    if (begun && flight.struck) this._right.kick(0, 0.4, 0)
    return begun && flight.struck === true
  }

  _idleWait() {
    return this._rehearsed ? REHEARSAL_WAIT : rand(...(this._smokeDemo ? DEMO_DRAG_EVERY : DRAG_EVERY))
  }

  // Runs what he does now and then while standing with a lit cigarette: an unhurried drag, or
  // a trick, which `_trick` and `_trickFor` then describe. A cleared level may get one trick
  // too, in the air. Returns seconds into the drag, or -1 outside one. Anything else happening
  // cancels either.
  _idle(dt, flying, cleared) {
    if (cleared && !this._cleared) {
      const tricked = this._rehearsed || Math.random() < CLEAR_TRICK_SHARE
      this._untilIdle = tricked ? CLEAR_TRICK_AFTER : Infinity
    }
    this._cleared = cleared
    if (!this.ready || (flying && !cleared)) {
      this._drag = -1
      this._ring = false
      this._trick = null
      if (!cleared) this._untilIdle = this._idleWait()
    } else if (this._trick) {
      // It waits for the cigarette to come down from the mouth.
      if (this._inHand >= 1) this._trickFor += dt
      if (this._trickFor >= this._trick.seconds) {
        this._trick = null
        this._untilIdle = cleared ? Infinity : this._idleWait()
      }
    } else if (this._drag >= 0) {
      this._drag += dt
      if (this._drag >= DRAG_SECONDS) {
        this._drag = -1
        this._ring = false
        this._untilIdle = this._idleWait()
      }
    } else {
      this._untilIdle -= dt
      if (this._untilIdle > 0) return -1
      if (cleared || this._rehearsed || Math.random() < TRICK_SHARE) {
        const all = Object.values(TRICKS)
        this._trick = this._rehearsed ?? all[Math.floor(Math.random() * all.length)]
        this._trickFor = 0
      } else this._drag = 0
    }
    return this._drag
  }

  // Lets the hands trail a turn of the head and catch up, and breathe while standing.
  _sway(dt, aim, flying) {
    const yaw = Math.atan2(aim.x, aim.z)
    const pitch = Math.asin(THREE.MathUtils.clamp(aim.y, -1, 1))
    if (!this._fresh) {
      // The shorter way round, where the yaw wraps.
      let turnedYaw = Math.atan2(Math.sin(yaw - this._lookYaw), Math.cos(yaw - this._lookYaw))
      // A view going over the top faces the other way from one frame to the next: no turn of the head.
      if (Math.abs(turnedYaw) > SWAY_FLIP) turnedYaw = 0
      const turnedPitch = pitch - this._lookPitch
      this._lagYaw += turnedYaw * SWAY
      this._lagPitch += turnedPitch * SWAY
      if (dt > 0) this._headTurn = Math.hypot(turnedYaw, turnedPitch) / dt
    }
    this._lookYaw = yaw
    this._lookPitch = pitch
    const settle = Math.exp(-9 * dt)
    this._lagYaw = THREE.MathUtils.clamp(this._lagYaw * settle, -SWAY_LIMIT, SWAY_LIMIT)
    this._lagPitch = THREE.MathUtils.clamp(this._lagPitch * settle, -SWAY_LIMIT, SWAY_LIMIT)
    this._rig.rotation.set(-this._lagPitch, -this._lagYaw, 0)
    this._rig.position.y = flying ? 0 : 0.006 * Math.sin(this._shownClock * 1.6)
  }

  // Shoves each hand about in the wind, on its own, through the spring that holds it in place.
  _buffet(dt, vel) {
    const wind = Math.min(1, vel.length() / GUST_SPEED)
    const strength = wind * (GUST + GUST_PER_TURN * Math.min(this._headTurn, GUST_TURN_CAP)) * Math.sqrt(dt)
    for (const arm of [this._right, this._left]) {
      arm.kick(rand(-strength, strength), rand(-strength, strength), rand(-strength, strength) * 0.5)
    }
  }

  // Each filament stays attached to the coal; motion thins its density.
  _emberSmoke(tip, vel, moving) {
    this._effects.ribbon(tip, vel, null, moving)
  }

  _smokeBehind(exhaling, vel, moving) {
    const tip = this._player.emberWorld(_from)
    this._emberSmoke(tip, vel, moving)
    if (exhaling) {
      this._rig.getWorldDirection(_forward).negate()
      this._breathe(this._player.mouthWorld(_from), _forward, vel, 1)
    }
  }

  _breathe(pos, dir, vel, size) {
    this._effects.exhale(pos, dir, vel, size)
  }
}
