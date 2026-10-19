// The ordinary people of the place (`npcs.js`'s `people`), dressed for a cold block as Arctic
// Eggs' people are: a young woman in a pale parka with its hood up (after the owner's reference
// still), a child wrapped up for the snow, an old man on a stick, and a heavy woman who cleans the
// stairs. Every size and colour is a first guess, seen only in stills. Look only.

import * as THREE from 'three'
import { ball, head, loft, paint, part, SIDES, skinPaint } from './npc-kit.js'
import { bind, humanRig, pose } from './npc-rig.js'

// --- A young woman in a pale quilted parka, the hood up, hands in its pockets ---

function parka() {
  const group = new THREE.Group()
  const quilt = (front) => paint(64, 64, (b) => {
    b.fill('#c3cbcd')
    b.blotches('#8e9ca6', { count: 18, size: 9, alpha: 0.45 })
    b.blotches('#e2e6e6', { count: 14, size: 8, alpha: 0.4 })
    b.rows(10, '#9aa6ac', 0.6)
    if (front) {
      b.line([[0.5, 0], [0.5, 1]], '#6a767c', 1)
      for (const s of SIDES) b.rect(0.5 + s * 0.06, 0.1, 0.5 + s * 0.17, 0.28, '#9aa6ac', 0.7)
    }
    b.grain(0.1)
  }, front ? 61 : 62)
  const coat = quilt(true)
  const sleeve = quilt(false)
  const legs = paint(32, 64, (b) => {
    b.fill('#2a2d33')
    b.blotches('#3c4048', { count: 8, size: 7, alpha: 0.4 })
    b.rect(0, 0, 1, 0.19, '#3b2c22') // ankle boots
    b.grain(0.1)
  }, 63)
  const flesh = skinPaint('#d4b2a2', '#b89080')
  const face = paint(64, 32, (b) => {
    b.fill('#d4b2a2')
    b.blotches('#d8908a', { count: 3, size: 4, alpha: 0.5, u: [0.4, 0.6], v: [0.3, 0.42] })
    b.rect(0, 0.2, 0.36, 1, '#a8905e') // her hair, behind and down the sides
    b.rect(0.64, 0.2, 1, 1, '#a8905e')
    b.rect(0.38, 0.3, 0.415, 0.7, '#a8905e') // strands down beside the face
    b.rect(0.585, 0.3, 0.62, 0.7, '#a8905e')
    b.rect(0.42, 0.66, 0.58, 0.8, '#a8905e') // a fringe
    b.blotches('#7a6640', { count: 10, size: 4, alpha: 0.5, u: [0, 0.36], v: [0.2, 1] })
    b.blotches('#7a6640', { count: 10, size: 4, alpha: 0.5, u: [0.64, 1], v: [0.2, 1] })
    b.face({ eyes: [0.05, 0.48, 0.6], brows: '#6a5038' })
    b.rect(0.475, 0.16, 0.525, 0.2, '#a8585a') // lips
    b.rect(0.49, 0.32, 0.51, 0.38, '#b89080', 0.8)
    b.grain(0.08)
  }, 64)

  for (const s of SIDES) {
    const x = 0.075 * s
    group.add(part(loft([
      { at: [x, 0.03, 0], w: 0.05, d: 0.055 }, { at: [x, 0.18, 0], w: 0.052 }, { at: [x, 0.2, 0], w: 0.048 },
      { at: [x, 0.45, 0.01], w: 0.055 }, { at: [x, 0.75, 0], w: 0.07 }, { at: [x, 0.88, 0], w: 0.085 },
    ]), legs))
    group.add(part(ball([x, 0.04, 0.035], [0.048, 0.04, 0.1]), 0x3b2c22))
    group.add(part(ball([0.18 * s, 1.37, 0], [0.075, 0.065, 0.075]), sleeve))
    group.add(part(loft([
      { at: [0.19 * s, 1.37, 0], w: 0.068 }, { at: [0.235 * s, 1.15, -0.01], w: 0.064 },
      { at: [0.205 * s, 0.95, 0.07], w: 0.057 }, { at: [0.15 * s, 0.86, 0.12], w: 0.05 },
    ]), sleeve))
  }
  group.add(part(loft([
    { at: [0, 0.62, 0], w: 0.2, d: 0.16 }, { at: [0, 0.7, 0], w: 0.21, d: 0.165 },
    { at: [0, 0.95, 0], w: 0.205, d: 0.16 }, { at: [0, 1.15, 0], w: 0.2, d: 0.15 },
    { at: [0, 1.32, 0], w: 0.21, d: 0.14 }, { at: [0, 1.42, 0], w: 0.18, d: 0.12 },
    { at: [0, 1.46, 0], w: 0.1, d: 0.09 }, { at: [0, 1.48, 0], w: 0.06 },
  ], { sides: 10 }), coat))
  group.add(part(loft([{ at: [0, 1.44, 0], w: 0.04 }, { at: [0, 1.56, 0.01], w: 0.04 }]), flesh))
  group.add(part(head([0, 1.545, 0], [0.078, 0.225, 0.092]), face))
  group.add(part(ball([0, 1.625, 0.095], [0.012, 0.018, 0.016]), flesh))
  // The hood: set back, so the face shows in its opening; it turns with the head.
  group.add(bind(part(loft([
    { at: [0, 1.47, -0.01], w: 0.045 }, // closed round the neck, so nothing shows through under the chin
    { at: [0, 1.47, -0.01], w: 0.1, d: 0.1 }, { at: [0, 1.53, -0.03], w: 0.112, d: 0.108 },
    { at: [0, 1.63, -0.045], w: 0.114, d: 0.108 }, { at: [0, 1.72, -0.045], w: 0.108, d: 0.104 },
    { at: [0, 1.78, -0.045], w: 0.085 }, { at: [0, 1.81, -0.045], w: 0.04 }, { at: [0, 1.815, -0.045], w: 0 },
  ], { sides: 10 }), sleeve), 'head'))
  const rig = humanRig({
    pelvis: [0, 0.88, 0], waist: [0, 1.08, 0], neck: [0, 1.45, 0], head: [0, 1.55, 0.01], crown: [0, 1.8, 0],
    hip: [0.075, 0.86, 0], knee: [0.075, 0.45, 0.01], ankle: [0.075, 0.06, 0], toe: [0.075, 0.03, 0.13],
    shoulder: [0.19, 1.37, 0], elbow: [0.235, 1.15, -0.01], hand: [0.15, 0.86, 0.12],
  }, { thigh: 0.065, shin: 0.05 })
  // Her weight on her right leg, the hip out over it, the left foot turned out ahead; looking off to her left.
  const place = pose(group, rig, {
    shift: [-0.04, -0.01, 0],
    turn: { pelvis: [0, -0.1, -0.08], chest: [0.02, 0.12, 0.12], head: [0.05, 0.3, -0.1] },
    feet: { L: [0.03, 0.1, 0.35], R: [-0.005, 0, -0.1] },
  })
  return { group, face: place(new THREE.Vector3(0, 1.64, 0.09)) }
}

// --- A child in a snowsuit: arms held out by its puff, a scarf up to the nose, a bobble hat ---

function child() {
  const group = new THREE.Group()
  const suit = paint(64, 64, (b) => {
    b.fill('#a8502e')
    b.blotches('#c87050', { count: 12, size: 8, alpha: 0.35 })
    b.blotches('#7a3420', { count: 12, size: 8, alpha: 0.4 })
    b.rows(12, '#7a3420', 0.5)
    b.grain(0.1)
  }, 71)
  const legs = paint(32, 64, (b) => {
    b.fill('#a8502e')
    b.blotches('#7a3420', { count: 8, size: 6, alpha: 0.4 })
    b.rect(0, 0, 1, 0.24, '#2c3550') // rubber boots
    b.grain(0.1)
  }, 72)
  const knit = paint(32, 32, (b) => {
    b.fill('#3a5a8a')
    for (let x = 0; x < 32; x += 2) b.rect(x / 32, 0, (x + 1) / 32, 1, '#2e4a74', 0.8)
    b.rows(5, '#d8d4c8', 1, { v: [0, 0.35], width: 2 })
    b.grain(0.12)
  }, 73)
  const scarf = paint(32, 32, (b) => {
    b.fill('#d8d0c0')
    b.rows(4, '#9a3a3a', 1, { width: 2 })
    b.grain(0.12)
  }, 74)
  const face = paint(64, 32, (b) => {
    b.fill('#dcb8a4')
    for (const s of SIDES) b.dot(0.5 + s * 0.07, 0.4, 2.5, '#e0807a', 0.7) // cheeks red from the cold
    b.rect(0, 0.55, 1, 1, '#6a4a2e') // hair under the hat
    b.rect(0.4, 0.5, 0.6, 1, '#dcb8a4')
    b.face({ eyes: [0.05, 0.5, 1], eyeColor: '#1e1a18', brows: '#8a6a4a' })
    b.grain(0.08)
  }, 75)

  for (const s of SIDES) {
    const x = 0.065 * s
    group.add(part(loft([
      { at: [x, 0.03, 0], w: 0.058 }, { at: [x, 0.14, 0], w: 0.06 }, { at: [x, 0.16, 0], w: 0.062 },
      { at: [x, 0.35, 0.01], w: 0.072 }, { at: [x, 0.5, 0], w: 0.075 },
    ]), legs))
    group.add(part(ball([x, 0.035, 0.035], [0.055, 0.035, 0.085]), 0x2c3550))
    group.add(part(ball([0.13 * s, 0.82, 0], [0.07, 0.065, 0.07]), suit))
    group.add(part(loft([{ at: [0.14 * s, 0.82, 0], w: 0.062 }, { at: [0.21 * s, 0.7, 0.02], w: 0.058 }, { at: [0.25 * s, 0.57, 0.04], w: 0.052 }]), suit))
    group.add(part(ball([0.26 * s, 0.52, 0.05], [0.038, 0.05, 0.032]), knit)) // a mitten
    group.add(part(ball([0.085 * s, 0.995, -0.005], [0.022, 0.04, 0.035]), knit)) // the hat's ear flap
    group.add(part(loft([{ at: [0.08 * s, 0.96, 0], w: 0.005 }, { at: [0.07 * s, 0.86, 0.04], w: 0.005 }], { sides: 4 }), knit))
  }
  group.add(part(loft([
    { at: [0, 0.45, 0], w: 0.15, d: 0.13 }, { at: [0, 0.6, 0], w: 0.16, d: 0.14 },
    { at: [0, 0.75, 0], w: 0.155, d: 0.135 }, { at: [0, 0.84, 0], w: 0.135, d: 0.115 },
    { at: [0, 0.88, 0], w: 0.08, d: 0.075 }, { at: [0, 0.9, 0], w: 0.05 },
  ], { sides: 10 }), suit))
  group.add(part(head([0, 0.9, 0], [0.085, 0.2, 0.09]), face))
  group.add(part(loft([
    { at: [0, 0.86, 0.005], w: 0.085, d: 0.085 }, { at: [0, 0.93, 0.012], w: 0.08, d: 0.085 },
    { at: [0, 0.97, 0.015], w: 0.072, d: 0.078 }, { at: [0, 0.975, 0.015], w: 0.06 },
  ], { sides: 10 }), scarf))
  group.add(part(loft([{ at: [0.05, 0.9, 0.08], w: 0.03, d: 0.012 }, { at: [0.07, 0.75, 0.11], w: 0.03, d: 0.012 }, { at: [0.07, 0.68, 0.1], w: 0.028, d: 0.01 }], { sides: 6 }), scarf))
  group.add(part(loft([
    { at: [0, 1.015, 0], w: 0.093, d: 0.1 }, { at: [0, 1.06, -0.005], w: 0.095, d: 0.1 },
    { at: [0, 1.1, -0.015], w: 0.08, d: 0.085 }, { at: [0, 1.13, -0.02], w: 0.045, d: 0.05 }, { at: [0, 1.14, -0.02], w: 0 },
  ], { sides: 10 }), knit))
  group.add(part(ball([0, 1.16, -0.02], [0.04, 0.04, 0.04]), paint(16, 16, (b) => { b.fill('#e0dcd0'); b.grain(0.25) }, 76)))
  const rig = humanRig({
    pelvis: [0, 0.5, 0], waist: [0, 0.65, 0], neck: [0, 0.88, 0], head: [0, 0.92, 0], crown: [0, 1.12, -0.01],
    hip: [0.065, 0.5, 0], knee: [0.065, 0.28, 0.01], ankle: [0.065, 0.05, 0], toe: [0.065, 0.02, 0.1],
    shoulder: [0.13, 0.82, 0], elbow: [0.21, 0.7, 0.02], hand: [0.26, 0.52, 0.05],
  }, { pelvis: 0.14, chest: 0.14, neck: 0.04, head: 0.09, thigh: 0.045, shin: 0.045, foot: 0.04, upperArm: 0.055, forearm: 0.045 })
  // Belly out, looking up and aside at whoever is there, one foot turned in.
  const place = pose(group, rig, {
    shift: [0, -0.01, 0],
    turn: { pelvis: [-0.05, 0.1, 0], chest: [-0.05, -0.08, 0.04], neck: [-0.1, 0, 0], head: [-0.2, -0.25, 0.12], upperArmL: [-0.2, 0, -0.05], upperArmR: [0.15, 0, 0.1] },
    feet: { L: [0, 0.04, -0.25], R: [-0.01, -0.02, -0.1] },
  })
  return { group, face: place(new THREE.Vector3(0, 0.99, 0.09)) }
}

// --- An old man, stooped, on a stick: a sheepskin coat, a fur hat, a long grey beard ---

function oldMan() {
  const group = new THREE.Group()
  const sheepskin = (front) => paint(64, 64, (b) => {
    b.fill('#6a4a32')
    b.blotches('#8a6848', { count: 14, size: 9, alpha: 0.4 }) // worn pale
    b.blotches('#3e2a1c', { count: 12, size: 8, alpha: 0.45 })
    if (front) {
      b.rect(0.48, 0, 0.52, 1, '#d8cdb8') // the fleece along the front, the hem and the collar
      b.rect(0, 0, 1, 0.06, '#d8cdb8')
      b.rect(0, 0.9, 1, 1, '#d8cdb8')
    } else b.rect(0, 0.88, 1, 1, '#d8cdb8') // the cuff
    b.grain(0.12)
  }, front ? 81 : 82)
  const coat = sheepskin(true)
  const sleeve = sheepskin(false)
  const legs = paint(32, 64, (b) => {
    b.fill('#4a4640')
    b.blotches('#5e5a52', { count: 8, size: 7, alpha: 0.4 })
    b.rect(0, 0, 1, 0.36, '#6a6460') // felt boots
    b.rect(0, 0, 1, 0.07, '#151515') // their rubber overshoes
    b.grain(0.12)
  }, 83)
  const felt = paint(16, 16, (b) => { b.fill('#6a6460'); b.rect(0, 0, 1, 0.4, '#151515'); b.grain(0.12) }, 84)
  const fur = paint(32, 32, (b) => {
    b.fill('#4a4038')
    b.blotches('#6a5a4c', { count: 20, size: 3, alpha: 0.6 })
    b.blotches('#2a221c', { count: 20, size: 3, alpha: 0.6 })
    b.grain(0.35)
  }, 85)
  const beard = paint(32, 32, (b) => {
    b.fill('#c8c4bc')
    for (let x = 0; x < 32; x += 3) b.rect(x / 32, 0, (x + 1) / 32, 1, x % 2 ? '#e8e4dc' : '#8a867e', 0.7)
    b.grain(0.15)
  }, 86)
  const flesh = skinPaint('#c4927c', '#a87060')
  const face = paint(64, 32, (b) => {
    b.fill('#c4927c')
    b.blotches('#b06a5a', { count: 6, size: 5, alpha: 0.5, u: [0.38, 0.62], v: [0.25, 0.5] })
    b.blotches('#8a6a5a', { count: 10, size: 1.5, alpha: 0.7 }) // age spots
    for (const v of [0.6, 0.66]) b.line([[0.42, v], [0.58, v]], '#8a6050', 1, 0.7) // a furrowed brow
    for (const s of SIDES) {
      b.line([[0.5 + s * 0.035, 0.48], [0.5 + s * 0.07, 0.48]], '#2a1a14', 1) // eyes screwed up
      b.line([[0.5 + s * 0.035, 0.44], [0.5 + s * 0.07, 0.43]], '#8a6050', 1, 0.7) // bags under them
      b.line([[0.5 + s * 0.03, 0.53], [0.5 + s * 0.08, 0.52]], '#e8e4dc', 2) // white brows
      b.line([[0.5 + s * 0.03, 0.36], [0.5 + s * 0.06, 0.22]], '#8a6050', 1, 0.7)
    }
    b.grain(0.1)
  }, 87)

  for (const s of SIDES) {
    const x = 0.1 * s
    group.add(part(loft([
      { at: [x, 0.03, 0], w: 0.066, d: 0.07 }, { at: [x, 0.3, 0], w: 0.07 }, { at: [x, 0.32, 0], w: 0.072 },
      { at: [x, 0.6, 0.02], w: 0.085 }, { at: [x, 0.8, 0.02], w: 0.1 },
    ]), legs))
    group.add(part(ball([x, 0.045, 0.05], [0.07, 0.045, 0.13]), felt))
    group.add(part(ball([0.2 * s, 1.3, 0.12], [0.08, 0.07, 0.08]), sleeve))
    group.add(part(ball([0.082 * s, 1.5, 0.3], [0.014, 0.03, 0.022]), flesh)) // an ear
    group.add(part(ball([0.1 * s, 1.61, 0.29], [0.025, 0.05, 0.05]), fur)) // the hat's flaps, tied up
  }
  // Stooped: the back bowed, the head pushed forward.
  group.add(part(loft([
    { at: [0, 0.6, 0], w: 0.22, d: 0.18 }, { at: [0, 0.75, 0], w: 0.22, d: 0.175 },
    { at: [0, 0.95, 0.02], w: 0.215, d: 0.17 }, { at: [0, 1.12, 0.06], w: 0.22, d: 0.165 },
    { at: [0, 1.26, 0.12], w: 0.22, d: 0.16 }, { at: [0, 1.34, 0.17], w: 0.19, d: 0.14 },
    { at: [0, 1.39, 0.21], w: 0.12, d: 0.11 }, { at: [0, 1.41, 0.23], w: 0.07 },
  ], { sides: 10 }), coat))
  group.add(part(ball([0, 1.18, -0.06], [0.17, 0.14, 0.1]), coat))
  // The right hand on the stick, the left behind his back.
  group.add(part(loft([{ at: [-0.21, 1.31, 0.13], w: 0.07 }, { at: [-0.27, 1.1, 0.2], w: 0.065 }, { at: [-0.25, 0.93, 0.3], w: 0.06 }]), sleeve))
  group.add(part(ball([-0.25, 0.9, 0.33], [0.035, 0.045, 0.04]), flesh))
  const wood = paint(8, 32, (b) => { b.fill('#4a3020'); b.blotches('#6a4a30', { count: 4, size: 3, alpha: 0.6 }) }, 88)
  group.add(bind(part(loft([{ at: [-0.25, 0.95, 0.34], w: 0.012 }, { at: [-0.26, 0, 0.42], w: 0.012 }], { sides: 6 }), wood), 'forearmR'))
  group.add(bind(part(loft([{ at: [-0.25, 0.95, 0.34], w: 0.012 }, { at: [-0.25, 0.99, 0.32], w: 0.012 }, { at: [-0.25, 0.98, 0.28], w: 0.011 }], { sides: 6 }), wood), 'forearmR'))
  group.add(part(loft([{ at: [0.21, 1.31, 0.13], w: 0.07 }, { at: [0.25, 1.1, 0.02], w: 0.065 }, { at: [0.12, 0.97, -0.1], w: 0.06 }]), sleeve))
  group.add(part(ball([0.08, 0.95, -0.13], [0.035, 0.045, 0.04]), flesh))
  group.add(part(loft([{ at: [0, 1.36, 0.2], w: 0.042 }, { at: [0, 1.44, 0.27], w: 0.042 }]), flesh))
  group.add(part(head([0, 1.41, 0.3], [0.082, 0.235, 0.095]), face))
  group.add(part(ball([0, 1.495, 0.39], [0.02, 0.028, 0.028]), skinPaint('#b8705e', '#9a4a40', 89))) // a red nose
  group.add(bind(part(ball([0, 1.462, 0.385], [0.045, 0.014, 0.02]), beard), 'head')) // the moustache
  group.add(bind(part(loft([
    { at: [0, 1.45, 0.36], w: 0.06, d: 0.045 }, { at: [0, 1.42, 0.37], w: 0.07, d: 0.05 },
    { at: [0, 1.33, 0.37], w: 0.06, d: 0.04 }, { at: [0, 1.25, 0.35], w: 0.025, d: 0.02 }, { at: [0, 1.22, 0.34], w: 0 },
  ]), beard), 'head'))
  group.add(part(loft([
    { at: [0, 1.545, 0.3], w: 0.098, d: 0.108 }, { at: [0, 1.6, 0.295], w: 0.1, d: 0.11 },
    { at: [0, 1.66, 0.29], w: 0.085, d: 0.095 }, { at: [0, 1.68, 0.29], w: 0.05 }, { at: [0, 1.685, 0.29], w: 0 },
  ], { sides: 10 }), fur))
  group.add(part(ball([0, 1.57, 0.4], [0.075, 0.03, 0.025]), fur)) // the front flap, turned up
  const rig = humanRig({
    pelvis: [0, 0.88, 0], waist: [0, 1.1, 0.05], neck: [0, 1.38, 0.2], head: [0, 1.44, 0.3], crown: [0, 1.66, 0.29],
    hip: [0.1, 0.85, 0], knee: [0.1, 0.45, 0.02], ankle: [0.1, 0.07, 0], toe: [0.1, 0.03, 0.17],
    shoulder: [0.21, 1.31, 0.13], elbow: { L: [0.25, 1.1, 0.02], R: [-0.27, 1.1, 0.2] }, hand: { L: [0.08, 0.95, -0.13], R: [-0.25, 0.9, 0.33] },
  })
  // Leaning on the stick, the knees gone soft, the head lifted out of the stoop to look ahead.
  const place = pose(group, rig, {
    shift: [-0.02, -0.015, 0],
    turn: { pelvis: [0.03, -0.06, -0.04], chest: [0.05, 0.05, 0.05], neck: [-0.05, 0, 0], head: [-0.15, 0.15, -0.06], upperArmR: [-0.08, 0, 0] },
    feet: { L: [0.03, 0.08, 0.3], R: [-0.01, 0, -0.15] },
  })
  return { group, face: place(new THREE.Vector3(0, 1.5, 0.4)) }
}

// --- A heavy woman who cleans the stairs: a flowered housecoat, a headscarf, a bucket and a mop ---

function cleaner() {
  const group = new THREE.Group()
  const housecoat = paint(64, 64, (b) => {
    b.fill('#3d5a8a')
    for (let y = 2; y < 64; y += 6) {
      for (let x = (y % 12) / 2; x < 64; x += 6) {
        const u = (x + b.random()) / 64
        const v = (y + b.random()) / 64
        b.dot(u, v, 0.6, b.random() < 0.5 ? '#d8a0b0' : '#e8e0d0') // a print of small flowers
        b.dot(u + 1 / 64, v - 1 / 64, 0.6, '#5a8a5a')
      }
    }
    b.blotches('#2a3a5a', { count: 12, size: 8, alpha: 0.3 })
    b.rect(0.38, 0.12, 0.62, 0.62, '#b8b0a0') // an apron over it
    b.blotches('#7a7262', { count: 8, size: 4, alpha: 0.5, u: [0.38, 0.62], v: [0.12, 0.62] })
    b.rect(0.44, 0.2, 0.56, 0.32, '#9a9282', 0.8)
    b.grain(0.1)
  }, 91)
  const cardigan = paint(32, 64, (b) => {
    b.fill('#6a4e38')
    b.blotches('#4a3424', { count: 10, size: 6, alpha: 0.5 })
    for (let x = 0; x < 32; x += 2) b.rect(x / 32, 0, (x + 1) / 32, 1, '#5a4030', 0.6)
    b.grain(0.12)
  }, 92)
  const tights = paint(16, 32, (b) => { b.fill('#6a5040'); b.blotches('#5a4232', { count: 5, size: 4, alpha: 0.5 }); b.grain(0.08) }, 93)
  const scarf = paint(32, 32, (b) => {
    b.fill('#a83a3a')
    for (let y = 2; y < 32; y += 6) for (let x = y % 12 ? 3 : 0; x < 32; x += 6) b.dot(x / 32, y / 32, 0.8, '#e8dcd0')
    b.grain(0.1)
  }, 94)
  const zinc = paint(32, 32, (b) => {
    b.fill('#8a9298')
    b.blotches('#a8b0b4', { count: 8, size: 5, alpha: 0.5 })
    b.blotches('#5a6268', { count: 8, size: 4, alpha: 0.5 })
    for (const v of [0.3, 0.7]) b.rect(0, v, 1, v + 0.04, '#5a6268')
    b.rect(0, 0.985, 1, 1, '#1e2a30') // the water
    b.grain(0.1)
  }, 95)
  const flesh = skinPaint('#c99a84', '#b07a68')
  const face = paint(64, 32, (b) => {
    b.fill('#c99a84')
    b.blotches('#b07a68', { count: 8, size: 6, alpha: 0.4 })
    for (const s of SIDES) b.dot(0.5 + s * 0.08, 0.36, 3, '#d08a7a', 0.6)
    b.face({ eyes: [0.05, 0.48, 0.6], brows: '#5a4030' })
    b.line([[0.465, 0.155], [0.5, 0.175], [0.535, 0.155]], '#8a4a48', 1) // a stern mouth
    for (const s of SIDES) b.line([[0.5 + s * 0.03, 0.34], [0.5 + s * 0.055, 0.22]], '#9a6a58', 1, 0.7)
    b.grain(0.08)
  }, 96)

  for (const s of SIDES) {
    const x = 0.11 * s
    group.add(part(loft([{ at: [x, 0.03, 0], w: 0.07, d: 0.075 }, { at: [x, 0.3, 0], w: 0.08 }, { at: [x, 0.48, 0], w: 0.095 }]), tights))
    group.add(part(ball([x, 0.035, 0.05], [0.065, 0.035, 0.12]), 0x2a2420))
    group.add(part(ball([0.24 * s, 1.32, 0], [0.09, 0.08, 0.09]), cardigan))
  }
  group.add(part(loft([
    { at: [0, 0.45, 0], w: 0.25, d: 0.22 }, { at: [0, 0.65, 0], w: 0.27, d: 0.24 },
    { at: [0, 0.9, 0.01], w: 0.29, d: 0.25 }, { at: [0, 1.1, 0.03], w: 0.28, d: 0.25 },
    { at: [0, 1.25, 0.02], w: 0.26, d: 0.21 }, { at: [0, 1.36, 0], w: 0.22, d: 0.16 },
    { at: [0, 1.41, 0], w: 0.12, d: 0.11 }, { at: [0, 1.43, 0], w: 0.06 },
  ], { sides: 12 }), housecoat))
  // The bucket in her right hand pulls the arm out from her side.
  group.add(part(loft([{ at: [-0.25, 1.32, 0], w: 0.08 }, { at: [-0.34, 1.1, 0.03], w: 0.075 }, { at: [-0.42, 0.92, 0.07], w: 0.062 }]), cardigan))
  group.add(part(ball([-0.43, 0.87, 0.07], [0.04, 0.045, 0.04]), flesh))
  group.add(bind(part(loft([
    { at: [-0.43, 0.47, 0.07], w: 0 }, { at: [-0.43, 0.47, 0.07], w: 0.09 }, { at: [-0.43, 0.74, 0.07], w: 0.115 },
    { at: [-0.43, 0.745, 0.07], w: 0.11 }, { at: [-0.43, 0.745, 0.07], w: 0 },
  ], { sides: 12 }), zinc), 'forearmR'))
  group.add(bind(part(loft([
    { at: [-0.545, 0.74, 0.07], w: 0.006 }, { at: [-0.5, 0.82, 0.07], w: 0.006 }, { at: [-0.43, 0.86, 0.07], w: 0.006 },
    { at: [-0.36, 0.82, 0.07], w: 0.006 }, { at: [-0.315, 0.74, 0.07], w: 0.006 },
  ], { sides: 4 }), 0x5a6268), 'forearmR'))
  // The mop in her left.
  group.add(part(loft([{ at: [0.25, 1.32, 0], w: 0.08 }, { at: [0.32, 1.12, 0.06], w: 0.075 }, { at: [0.3, 1.0, 0.18], w: 0.062 }]), cardigan))
  group.add(part(ball([0.3, 0.98, 0.21], [0.04, 0.05, 0.045]), flesh))
  group.add(bind(part(loft([{ at: [0.3, 0.04, 0.24], w: 0.013 }, { at: [0.3, 1.4, 0.2], w: 0.013 }], { sides: 6 }), 0x8a6a44), 'forearmL'))
  group.add(bind(part(loft([{ at: [0.16, 0.04, 0.24], w: 0.02 }, { at: [0.44, 0.04, 0.24], w: 0.02 }], { sides: 6 }), 0x8a6a44), 'forearmL'))
  group.add(bind(part(ball([0.3, 0.025, 0.26], [0.15, 0.025, 0.07]), paint(16, 16, (b) => { b.fill('#7a7468'); b.blotches('#4a463e', { count: 6, size: 4, alpha: 0.6 }); b.grain(0.2) }, 97)), 'forearmL'))
  group.add(part(loft([{ at: [0, 1.38, 0], w: 0.05 }, { at: [0, 1.47, 0.01], w: 0.05 }]), flesh))
  group.add(part(head([0, 1.45, 0.01], [0.09, 0.235, 0.1]), face))
  group.add(bind(part(ball([0, 1.455, 0.05], [0.065, 0.03, 0.045]), flesh), 'head')) // a double chin
  group.add(part(ball([0, 1.535, 0.11], [0.016, 0.02, 0.02]), flesh))
  // The headscarf: set back to frame the face, knotted under the chin.
  group.add(bind(part(loft([
    { at: [0, 1.47, -0.02], w: 0.1, d: 0.1 }, { at: [0, 1.53, -0.035], w: 0.1, d: 0.11 },
    { at: [0, 1.6, -0.045], w: 0.103, d: 0.112 }, { at: [0, 1.66, -0.04], w: 0.095, d: 0.105 },
    { at: [0, 1.7, -0.025], w: 0.07, d: 0.085 }, { at: [0, 1.72, -0.02], w: 0.05 }, { at: [0, 1.73, -0.02], w: 0 },
  ], { sides: 10 }), scarf), 'head'))
  group.add(bind(part(ball([0, 1.435, 0.06], [0.04, 0.03, 0.03]), scarf), 'head'))
  group.add(bind(part(ball([0, 1.47, -0.11], [0.06, 0.06, 0.03]), scarf), 'head'))
  const rig = humanRig({
    pelvis: [0, 0.87, 0], waist: [0, 1.05, 0.02], neck: [0, 1.42, 0], head: [0, 1.47, 0.02], crown: [0, 1.72, -0.02],
    hip: [0.11, 0.85, 0], knee: [0.11, 0.45, 0], ankle: [0.11, 0.06, 0], toe: [0.11, 0.03, 0.16],
    shoulder: [0.25, 1.32, 0], elbow: { L: [0.32, 1.12, 0.06], R: [-0.34, 1.1, 0.03] }, hand: { L: [0.3, 0.98, 0.21], R: [-0.43, 0.87, 0.07] },
  }, { pelvis: 0.27, chest: 0.26 })
  // On her left leg, the bucket pulling her right side down; the head turned, sizing you up.
  const place = pose(group, rig, {
    shift: [0.05, -0.02, 0],
    turn: { pelvis: [0, 0.08, 0.09], chest: [0.05, -0.12, 0.06], head: [0.08, -0.3, -0.12] },
    feet: { L: [0, 0, 0.1], R: [-0.05, 0.1, -0.4] },
  })
  return { group, face: place(new THREE.Vector3(0, 1.56, 0.11)) }
}

export const PEOPLE = [
  { id: 'parka', name: 'Woman', build: parka },
  { id: 'child', name: 'Child', build: child },
  { id: 'old-man', name: 'Old man', build: oldMan },
  { id: 'cleaner', name: 'Cleaner', build: cleaner },
]
