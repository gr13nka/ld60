// The thief's beret: red felt pulled down to one side, a brass star on its front, as Che Guevara
// wore his (the owner, 2026-10-17: "put a red beret like che gevara moveed to the side"), so that
// a runner who looks away finds the bird again by its colour. It took the place of a beanie whose
// pompom glowed ("too bright and unnatural"), which took the place of a blinking ring on its leg
// ("looks like there is a lighthouse in her ass"): nothing on it glows. Its red is a deep
// crimson felt, lit as the bird is, never `models.js`'s `blastRed` or `redLight`, which mean what
// blows up. Look only.

import * as THREE from 'three'
import { celMaterial } from './shading.js'

const FELT = [0x7e1b22, 0x721820, 0x8a2027] // the felt and its nap
const BRASS = 0xc9a23a
const SLANT = 0.4 // radians it is pulled down to the bird's right
const OVER = 0.3 // of the band's radius, how far its middle is moved that way
const GROWN = 1.5 // drawn this many times the size its build gives (the owner, 2026-10-17: "2 times bigger", then "not 2, 1.5")
const STAR = { outer: 0.35, inner: 0.15, thick: 0.05 } // of the band's radius
// Its outline as a lathe, `[radius, height]` in the band's radius: the band round the head, the
// felt billowing out past it and lying nearly flat on top, the stalk at its middle.
const PROFILE = [[0, 0.1], [0.95, 0], [1, 0.14], [1.32, 0.3], [1.55, 0.48], [1.52, 0.62], [1.22, 0.76], [0.62, 0.84], [0.1, 0.86], [0.07, 0.98], [0, 0.99]]

let feltMap = null
/** The felt, painted once: a dull red with a nap of darker and lighter flecks. */
function feltTexture() {
  if (feltMap) return feltMap
  const size = 16
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = (x * 7 + y * 13 + ((x * y) % 5)) % 9
      context.fillStyle = `#${FELT[k === 0 ? 1 : k === 4 ? 2 : 0].toString(16).padStart(6, '0')}`
      context.fillRect(x, y, 1, 1)
    }
  }
  feltMap = new THREE.CanvasTexture(canvas)
  feltMap.colorSpace = THREE.SRGBColorSpace
  feltMap.magFilter = feltMap.minFilter = THREE.NearestFilter
  feltMap.generateMipmaps = false
  feltMap.wrapS = feltMap.wrapT = THREE.RepeatWrapping
  feltMap.repeat.set(4, 2)
  return feltMap
}

/** A five-point star, point up, `thick` deep, facing +Z. */
function starGeometry({ outer, inner, thick }) {
  const shape = new THREE.Shape()
  for (let k = 0; k < 10; k++) {
    const angle = Math.PI / 2 + (k * Math.PI) / 5
    const radius = k % 2 ? inner : outer
    shape[k === 0 ? 'moveTo' : 'lineTo'](Math.cos(angle) * radius, Math.sin(angle) * radius)
  }
  return new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false })
}

export class BirdHat {
  /** On `body`'s head where its build's `hat` says (`bird-body.js`). */
  constructor(body) {
    const { at, radius: r, tilt } = body.hat
    const hat = new THREE.Group()
    hat.position.fromArray(at)
    hat.rotation.set(tilt, 0, SLANT, 'XZY')
    hat.position.x -= OVER * r
    hat.scale.setScalar(GROWN)
    body.head.add(hat)

    const felt = new THREE.Mesh(
      new THREE.LatheGeometry(PROFILE.map(([x, y]) => new THREE.Vector2(x * r, y * r)), 14),
      celMaterial({ map: feltTexture(), ramp: body.ramp }),
    )
    // The star on the front of the felt, where it rounds over from the side to the top.
    const scaled = Object.fromEntries(Object.entries(STAR).map(([key, value]) => [key, value * r]))
    const star = new THREE.Mesh(starGeometry(scaled), celMaterial({ color: BRASS, ramp: body.ramp, flatShading: true }))
    star.position.set(0.15 * r, 0.6 * r, 1.5 * r)
    star.rotation.x = -0.5
    felt.castShadow = star.castShadow = true
    hat.add(felt, star)
  }
}
