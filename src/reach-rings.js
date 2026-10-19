// How far a jump carries on the level, as rings round a point at its height: J in the editor (round
// what is under the pointer), in play on the dev server (round his feet) and on the plan page.
// A plain jump at a run (20 m/s), one with Shift (a slide's boost, about 25), one at 30 m/s, and,
// in play, a white one at the speed he is going. A jump down carries further than its ring. Look only.
import * as THREE from 'three'

export const REACH = { up: 12.5, gravity: 28 } // `parkour.js`'s `jumpSpeed` and `gravity`
/** Metres a jump at `speed` m/s carries to land at the height it left: up and down again in 2·up/gravity seconds. */
export const reachAt = (speed) => (speed * 2 * REACH.up) / REACH.gravity
export const PACES = [
  { speed: 20, words: 'jump', color: 0x2f6fd6 },
  { speed: 25, words: 'Shift', color: 0xd63adb },
  { speed: 30, words: '30 m/s', color: 0xe06a1c },
]

const CIRCLE = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 97 }, (_, i) => new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2), 0, Math.sin((i / 96) * Math.PI * 2))))
const paint = (color) => new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.85 })

/** The rings, hidden: `group` to add to a scene, `shown`, and `place(pos, speed)` to stand them. */
export function createReachRings() {
  const group = new THREE.Group()
  const ring = (color, radius) => {
    const line = new THREE.Line(CIRCLE, paint(color))
    line.scale.setScalar(radius)
    line.renderOrder = 998
    line.frustumCulled = false
    group.add(line)
    return line
  }
  for (const { speed, color } of PACES) ring(color, reachAt(speed))
  const live = ring(0xffffff, 1)
  group.visible = false
  return {
    group,
    get shown() {
      return group.visible
    },
    set shown(on) {
      group.visible = on
    },
    /** Round `pos` (a little over it, off the floor); with `speed`, the white ring is that speed's. */
    place(pos, speed = 0) {
      group.position.set(pos.x, pos.y + 0.1, pos.z)
      live.visible = speed > 1
      if (live.visible) live.scale.setScalar(reachAt(speed))
    },
  }
}

/**
 * J in play, on the dev server (`main.js`): the rings round his feet, the white one at the speed he
 * goes, kept up every frame; not while the editor is open, which has its own.
 */
export function playRings(game) {
  const rings = createReachRings()
  game.scene.add(rings.group)
  addEventListener('keydown', (event) => {
    if (event.code !== 'KeyJ' || event.repeat || event.ctrlKey || event.metaKey || game.editing || event.target instanceof HTMLInputElement) return
    rings.shown = !rings.shown
  })
  const frame = () => {
    if (rings.shown && game.editing) rings.shown = false
    if (rings.shown) rings.place(game.body.pos, Math.hypot(game.body.vel.x, game.body.vel.z))
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
