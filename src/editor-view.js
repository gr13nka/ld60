// The editor's eye (`editor.js`), as Blender's viewport has one: it looks at a pivot from a
// distance, and is turned about it (orbit), slid across it (pan) and brought nearer (zoom).
// Flying is the other way round: the eye is what stays, and the pivot is carried ahead of it.
// Only numbers: no scene, no DOM. `pose()` is what `Game.placeView` is given.
//
// Angles are the game's: yaw 0 looks down +Z with +X on the left, so a turn to the right is a
// falling yaw; pitch rises looking up.

const ORBIT = 0.005 // radians of turn for a pixel dragged
const PITCH_MOST = Math.PI / 2 - 0.001 // straight down, short of where the view's up is lost
const ZOOM = { notch: 1.15, drag: 0.005, nearest: 0.5 } // the wheel's step, a pixel's share of a smooth zoom, metres
const FLY = { start: 40, least: 2, most: 400, notch: 1.25 } // m/s of the flying eye, and the wheel's step
const FRAME = 1.4 // how much further off than its own radius a framed thing is looked at from
const STEP = Math.PI / 12 // the turn of one press of 2, 4, 6 or 8
/** The views looked along an axis, by Blender's names: front looks down the level, +Z. */
export const VIEWS = {
  front: { yaw: 0, pitch: 0 },
  back: { yaw: Math.PI, pitch: 0 },
  right: { yaw: Math.PI / 2, pitch: 0 },
  left: { yaw: -Math.PI / 2, pitch: 0 },
  top: { yaw: 0, pitch: -PITCH_MOST },
  bottom: { yaw: 0, pitch: PITCH_MOST },
}

export class EditorView {
  constructor() {
    this.pivot = { x: 0, y: 0, z: 0 }
    this.distance = 30
    this.yaw = 0
    this.pitch = 0
    /** Metres a second of the flying eye. */
    this.speed = FLY.start
  }

  /** The view as it is to be kept across a reload, and taken back with `restore`. */
  get kept() {
    const { pivot, distance, yaw, pitch, speed } = this
    return { pivot: { ...pivot }, distance, yaw, pitch, speed }
  }

  restore({ pivot, distance, yaw, pitch, speed }) {
    Object.assign(this, { pivot: { ...pivot }, distance, yaw, pitch, speed: speed ?? FLY.start })
  }

  /** Begins looking from `eye` the way `yaw` and `pitch` say, the pivot as far ahead as it was. */
  lookFrom(eye, yaw, pitch) {
    this.yaw = yaw
    this.pitch = Math.max(-PITCH_MOST, Math.min(PITCH_MOST, pitch))
    this._carry(eye)
  }

  /** Where the eye is, and the way it looks: `{ eye, yaw, pitch }`. */
  pose() {
    const aim = this._aim()
    const { pivot, distance } = this
    return { eye: { x: pivot.x - aim.x * distance, y: pivot.y - aim.y * distance, z: pivot.z - aim.z * distance }, yaw: this.yaw, pitch: this.pitch }
  }

  /** Turned about the pivot by a drag of `dx`, `dy` pixels: what is looked at follows the pointer. */
  orbit(dx, dy) {
    this.yaw -= dx * ORBIT
    this.pitch = Math.max(-PITCH_MOST, Math.min(PITCH_MOST, this.pitch - dy * ORBIT))
  }

  /** Turned about the pivot by `across` and `up` steps of a twelfth of a half turn. */
  step(across, up) {
    this.yaw -= across * STEP
    this.pitch = Math.max(-PITCH_MOST, Math.min(PITCH_MOST, this.pitch + up * STEP))
  }

  /** Slid across what is looked at by a drag of `dx`, `dy` pixels; `perPixel` is `metresPerPixel`'s answer. */
  pan(dx, dy, perPixel) {
    const right = this._right()
    const up = this._up()
    const { pivot } = this
    pivot.x += (-right.x * dx + up.x * dy) * perPixel
    pivot.y += up.y * dy * perPixel
    pivot.z += (-right.z * dx + up.z * dy) * perPixel
  }

  /** How many metres a pixel covers at the pivot, for a picture `height` pixels tall seen through `fov` degrees. */
  metresPerPixel(fov, height) {
    return (2 * this.distance * Math.tan((fov * Math.PI) / 360)) / height
  }

  /** Brought nearer by `notches` of the wheel (further, if negative). */
  zoom(notches) {
    this.distance = Math.max(ZOOM.nearest, this.distance * ZOOM.notch ** -notches)
  }

  /** Brought nearer by a drag of `dy` pixels upward. */
  zoomBy(dy) {
    this.distance = Math.max(ZOOM.nearest, this.distance * Math.exp(dy * ZOOM.drag))
  }

  /** Looks at a thing whose middle is `centre` and whose reach from it is `radius`, from where all of it is seen through `fov` degrees. */
  frame(centre, radius, fov) {
    this.pivot = { x: centre.x, y: centre.y, z: centre.z }
    this.distance = Math.max(ZOOM.nearest, (Math.max(radius, 1) * FRAME) / Math.sin((fov * Math.PI) / 360))
  }

  /** Looks along an axis: one of `VIEWS`, by name. */
  along(name) {
    Object.assign(this, VIEWS[name])
  }

  /** The eye turned where it is by a drag of `dx`, `dy` pixels, as a head is. */
  turn(dx, dy) {
    const { eye } = this.pose()
    this.orbit(dx, dy)
    this._carry(eye)
  }

  /**
   * The eye flown for `dt` seconds: `ahead`, `right` and `up` are each -1, 0 or 1. It goes
   * where it looks, as Blender's fly does; up is the world's.
   */
  fly(dt, ahead, right, up) {
    const aim = this._aim()
    const side = this._right()
    const reach = this.speed * dt
    this.pivot.x += (aim.x * ahead + side.x * right) * reach
    this.pivot.y += (aim.y * ahead + up) * reach
    this.pivot.z += (aim.z * ahead + side.z * right) * reach
  }

  /** The flying speed changed by `notches` of the wheel, and what it now is. */
  gear(notches) {
    this.speed = Math.max(FLY.least, Math.min(FLY.most, this.speed * FLY.notch ** notches))
    return this.speed
  }

  // The pivot set ahead of `eye`, so that the eye is there.
  _carry(eye) {
    const aim = this._aim()
    const { distance } = this
    this.pivot = { x: eye.x + aim.x * distance, y: eye.y + aim.y * distance, z: eye.z + aim.z * distance }
  }

  _aim() {
    const { yaw, pitch } = this
    return { x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) }
  }

  // The picture's right and up, as the game's camera has them (`Game.placeView`).
  _right() {
    return { x: -Math.cos(this.yaw), z: Math.sin(this.yaw) }
  }

  _up() {
    const { yaw, pitch } = this
    return { x: -Math.sin(yaw) * Math.sin(pitch), y: Math.cos(pitch), z: -Math.cos(yaw) * Math.sin(pitch) }
  }
}
