// Words said out loud (`talk.js`) drawn in the scene, so that they go through the picture as
// anything there does, its ink, mist, glow, grade and screen (the owner, 2026-10-17: "add same
// effects and glow the character words"), after Arctic Eggs. Another's line is a thing in the world
// ("it must take an exact place in space, like a real object"): upright beside whoever said it,
// where they said it, turned to the eye as it was then and never after, so that it keeps its place
// as he moves, goes small as he goes away and is hidden by what stands in front of it; sized as it
// is said to be read from where he is then. His own is held before his eye, low in the middle, over
// the world and the hands as the hands are over the world (`viewmodel.js`'s `keepInFront`). The
// menus' pixel face, its pixels kept square, with a hard dark shadow; its ink brighter
// than white, so that it glows. Look only.

import * as THREE from 'three'
import { canvasTexture } from './models.js'

const FACE = 'Departure Mono'
const PIXELS = 22 // the face's own height on its texture: twice its grid, so its pixels stay whole
const FONT = `${PIXELS}px "${FACE}"`
const LEADING = 1.25 // a line's height, in its letters'
const INK = '#f4f1ea' // the menus' ink
const GLOW = 1.15 // times the ink's light: just over the glow's threshold, a soft halo that leaves the letters readable (the owner, 2026-10-19: brighter was too strong to read)
const SHADOW = 'rgba(0, 0, 0, 0.8)'
const DROP = 2 // texture pixels the shadow falls down and right: one of the face's own
const PAD = 4 // texture pixels of room round the words, for the shadow
const SHARE = 0.045 // of the picture's height a line takes, seen from where it was said
// Another's: characters a line at most, and the sign's foot over the speaker, in the room kept clear round it.
const THEIR_WRAP = 18
const RISE = 0.3
// His: characters a line at most, metres before the eye (past the 0.3 m near plane, as the hands
// are), and the foot of his lines over the bottom of the picture, in its height (`.hud-line`'s).
const HIS_WRAP = 32
const HELD = 0.6
const HIS_FOOT = 0.18
const OVER_HANDS = 1e6 + 1 // `renderOrder`: after the hands (`viewmodel.js`'s `HANDS_LAST`)

const _right = new THREE.Vector3()
const halfHeight = (fov) => Math.tan(THREE.MathUtils.degToRad(fov) / 2)

// The words as a plane in texture pixels, scaled to metres by its mesh, typed out as far as asked.
class Sign {
  constructor(parent, { wrap, centred, ink = INK }) {
    this._wrap = wrap
    this._centred = centred
    this.ink = ink
    const paint = new THREE.MeshBasicMaterial({ alphaTest: 0.15 })
    paint.color.setScalar(GLOW)
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), paint)
    this.mesh.visible = false
    this.mesh.frustumCulled = false
    parent.add(this.mesh)
    this._lines = []
    this._drawn = null // what of it has been drawn: how much was typed and whether the face was in
    document.fonts?.load(FONT).then(() => (this._drawn = null)).catch(() => {})
  }

  // A new line laid out: its texture made to fit it, its plane's foot at the mesh's middle, on the
  // left or, `centred`, in the middle.
  lay(text) {
    this._lines = wrapped(text, this._wrap)
    const measure = document.createElement('canvas').getContext('2d')
    measure.font = FONT
    this._width = Math.ceil(Math.max(...this._lines.map((line) => measure.measureText(line).width))) + 2 * PAD + DROP
    const height = Math.ceil(this._lines.length * PIXELS * LEADING) + 2 * PAD + DROP
    const { material } = this.mesh
    material.map?.dispose()
    material.map = canvasTexture(this._width, height, () => {})
    material.map.magFilter = material.map.minFilter = THREE.NearestFilter
    material.map.generateMipmaps = false
    material.needsUpdate = true
    const geometry = new THREE.PlaneGeometry(this._width, height)
    geometry.translate(this._centred ? 0 : this._width / 2, height / 2, 0)
    this.mesh.geometry.dispose()
    this.mesh.geometry = geometry
    this._drawn = null
  }

  /** Metres a texture pixel is, for a line to take SHARE of the picture `away` metres off under `fov`. */
  static metresAPixel(away, fov, share = SHARE) {
    return (away * 2 * halfHeight(fov) * share) / (PIXELS * LEADING)
  }

  // The words typed so far, the rest not yet there; their shadow first.
  type(typed) {
    const faced = !document.fonts || document.fonts.check(FONT)
    const key = `${typed}|${faced}`
    if (key === this._drawn) return
    this._drawn = key
    const map = this.mesh.material.map
    const ctx = map.image.getContext('2d')
    ctx.clearRect(0, 0, map.image.width, map.image.height)
    ctx.font = FONT
    ctx.textBaseline = 'top'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 1.2
    let left = typed
    const shown = this._lines.map((line) => {
      const part = line.slice(0, Math.max(0, left))
      left -= line.length + 1
      return part
    })
    for (const [color, off] of [[SHADOW, DROP], [this.ink, 0]]) {
      ctx.fillStyle = color
      // A centred line is placed by the whole of it, so that its words do not move as the rest comes.
      shown.forEach((line, i) => {
        const at = this._centred ? Math.round((this._width - DROP - ctx.measureText(this._lines[i]).width) / 2) : PAD
        if (!off) {
          ctx.strokeStyle = this.ink
          ctx.strokeText(line, at, PAD + i * PIXELS * LEADING)
        }
        ctx.fillText(line, at + off, PAD + off + i * PIXELS * LEADING)
      })
    }
    map.needsUpdate = true
  }
}

/** Another's line, standing in the world where it was said. */
export class SaidSign {
  constructor(scene, { wrap = THEIR_WRAP, share = SHARE, rise = RISE, centred = false, ink = INK } = {}) {
    this._sign = new Sign(scene, { wrap, centred, ink })
    this.share = share
    this.rise = rise
    this._id = null // the line standing, by `Talk`'s count
  }

  get mesh() { return this._sign.mesh }

  setInk(ink, glow = GLOW) {
    if (this._sign.ink !== ink) {
      this._sign.ink = ink
      this._sign._drawn = null
    }
    this.mesh.material.color.setScalar(glow)
  }

  /**
   * Each frame: `said` is `Talk.theirs` (`{ id, text, typed, at, clear }`) or null; `eye` where the
   * picture is seen from and `fov` its camera's, read only as a line is first stood.
   */
  show(said, eye, fov) {
    const { mesh } = this._sign
    mesh.visible = Boolean(said)
    if (!said) {
      this._id = null
      return
    }
    if (said.id !== this._id) {
      this._id = said.id
      this._sign.lay(said.text)
      const away = Math.hypot(said.at.x - eye.x, said.at.y - eye.y, said.at.z - eye.z)
      mesh.scale.setScalar(Sign.metresAPixel(away, fov, this.share))
      // Beside the speaker on the eye's right, turned to the eye.
      const yaw = Math.atan2(eye.x - said.at.x, eye.z - said.at.z)
      _right.set(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(said.clear)
      mesh.position.set(said.at.x, said.at.y + said.clear * this.rise, said.at.z).add(_right)
      mesh.rotation.set(0, yaw, 0)
    }
    this._sign.type(said.typed)
  }
}

/** His own line, held before his eye, low in the middle. */
export class HeldLine {
  constructor(camera) {
    this._sign = new Sign(camera, { wrap: HIS_WRAP, centred: true })
    const { mesh } = this._sign
    mesh.material.fog = false
    mesh.material.depthTest = false // over the world and the hands; it writes its own depth for the ink and the mist
    mesh.renderOrder = OVER_HANDS
    this._text = null
  }

  /** Each frame: `line` is the text, `{ text, typed }` while it is typed out, or null; `fov` the camera's. */
  show(line, fov) {
    const { text, typed = Infinity } = typeof line === 'string' ? { text: line } : (line ?? {})
    const { mesh } = this._sign
    mesh.visible = Boolean(text)
    if (!text) {
      this._text = null
      return
    }
    if (text !== this._text) {
      this._text = text
      this._sign.lay(text)
    }
    // As the view widens with speed, so that it keeps its size and place in the picture.
    mesh.scale.setScalar(Sign.metresAPixel(HELD, fov))
    mesh.position.set(0, -halfHeight(fov) * HELD * (1 - 2 * HIS_FOOT), -HELD)
    this._sign.type(Math.min(typed, text.length))
  }
}

// `text` broken between words into lines of `wrap` characters at most.
function wrapped(text, wrap) {
  const lines = []
  for (const paragraph of text.split('\n')) {
    let first = true
    for (const word of paragraph.split(' ')) {
      const last = lines.length - 1
      if (!first && last >= 0 && lines[last].length + 1 + word.length <= wrap) lines[last] += ` ${word}`
      else lines.push(word)
      first = false
    }
  }
  return lines
}
