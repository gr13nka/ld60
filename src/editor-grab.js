// One move, turn or size of the editor's (`editor.js`), as Blender's G, R and S are (T for S here): it takes
// hold at once and follows the pointer until it is kept or put back. X, Y and Z lock it to an
// axis, a number typed is the amount itself, Ctrl snaps and Shift slows.
//
// Only numbers: it is told where the pointer is and answers the transform that makes
// (`{ at, yaw, size }`, `editor-things.js`). Keeping it and putting it back are the editor's.
//
// A thing is turned and sized about its pivot, the middle of what is seen of it, which stays
// where it is: a form's own `at` may be far from it (the palace's axis, for much of the palace).
//
// A pointer is `{ origin, direction, x, y, snap, slow }`: the ray under it in the world
// (`THREE.Vector3`s) and where it is on the screen in pixels, with whether Ctrl and Shift are down.

import { Vector3 } from 'three'

const SNAP = { move: 1, turn: Math.PI / 36, size: 0.1 } // metres, radians (5°), times
const SLOW = 0.1 // of the pointer's travel, with Shift
const LEAST_SIZE = 0.001
const EDGE_ON = 1e-3 // a plane seen this nearly edge-on is not one the pointer can be read on
const WORDS = { move: 'Move', turn: 'Turn', size: 'Size' }
const AXES = ['x', 'y', 'z']

/**
 * `start` moved `by` (`{ x, y, z }`), turned by `turn` about the upright and grown `grow`
 * times along each of its own axes, the point `pivot` of it staying where it is but for the move.
 */
export function pivoted(start, pivot, { by = { x: 0, y: 0, z: 0 }, turn = 0, grow = [1, 1, 1] }) {
  const { at, yaw, size } = start
  // From the pivot to its `at`, in the thing's own axes, grown, and laid back as it is now turned.
  const dx = at.x - pivot.x
  const dz = at.z - pivot.z
  const ownX = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) * grow[0]
  const ownZ = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) * grow[2]
  const cos = Math.cos(yaw + turn)
  const sin = Math.sin(yaw + turn)
  return {
    at: { x: pivot.x + ownX * cos + ownZ * sin + by.x, y: pivot.y + (at.y - pivot.y) * grow[1] + by.y, z: pivot.z - ownX * sin + ownZ * cos + by.z },
    yaw: yaw + turn,
    size: size.map((s, i) => s * grow[i]),
  }
}

export class Grab {
  /**
   * `op` is 'move', 'turn' or 'size'; `start` the transform it begins from; `can` what the
   * thing allows (`{ turns, sizes }` of a target); `seen` how it is looked at: `{ forward }`,
   * the way the eye looks, `{ pivot }`, the point of it that a turn and a sizing leave where
   * it is, and `{ centre }`, where that is on the screen; `pointer` where the pointer is as
   * it begins.
   */
  constructor(op, start, can, seen, pointer) {
    this.op = op
    this._start = { at: { ...start.at }, yaw: start.yaw, size: [...start.size] }
    this._can = can
    this._seen = seen
    this._first = pointer
    this._lock = null // { axis: 'x', own, others }: own is the thing's axis and not the world's; others is every axis but this
    this._typed = ''
    this._restart()
    this.to(pointer)
  }

  /**
   * X, Y or Z was pressed (`others` with Shift: every axis but that one). The same again asks
   * for the thing's own axis where that is another (a move of what is turned), then lets go.
   */
  lock(axis, others = false) {
    if (this.op === 'turn') return // it turns about the upright and nothing else
    const now = this._lock
    const same = now && now.axis === axis && now.others === others
    const ownIsOther = this.op === 'move' && this._start.yaw !== 0 && axis !== 'y'
    if (!same) this._lock = { axis, others, own: false }
    else if (!now.own && ownIsOther) this._lock = { axis, others, own: true }
    else this._lock = null
    this._restart()
  }

  /** A key of a number being typed (a digit, '.', '-', 'Backspace'); whether it was one. */
  type(key) {
    if (key === 'Backspace') this._typed = this._typed.slice(0, -1)
    else if (key === '-') this._typed = this._typed.startsWith('-') ? this._typed.slice(1) : `-${this._typed}`
    else if (/^[0-9]$/.test(key) || (key === '.' && !this._typed.includes('.'))) this._typed += key
    else return false
    return true
  }

  /** The transform with the pointer at `pointer`. */
  to(pointer) {
    this._pointer = pointer
    const typed = this._typed === '' || this._typed === '-' || this._typed === '.' ? null : Number(this._typed)
    const { pivot } = this._seen
    if (this.op === 'move') {
      this._by = typed === null ? this._moved(pointer) : this._along().multiplyScalar(typed)
      return pivoted(this._start, pivot, { by: this._by })
    }
    if (this.op === 'turn') {
      this._by = typed === null ? this._turned(pointer) : (typed * Math.PI) / 180
      return pivoted(this._start, pivot, { turn: this._by })
    }
    this._by = Math.max(LEAST_SIZE, typed === null ? this._sized(pointer) : typed)
    const grown = this._axes()
    return pivoted(this._start, pivot, { grow: AXES.map((axis) => (grown.includes(axis) ? this._by : 1)) })
  }

  /** The transform as it last was: what is kept. */
  get now() {
    return this.to(this._pointer)
  }

  /** The transform it began from: what is put back. */
  get start() {
    const { at, yaw, size } = this._start
    return { at: { ...at }, yaw, size: [...size] }
  }

  /** What is being done, for the status line: 'Move X 12 m'. */
  get words() {
    const lock = this._lock ? ` ${this._lock.others ? 'not ' : ''}${this._lock.axis.toUpperCase()}${this._lock.own ? ' (its own)' : ''}` : ''
    const n = (v) => (Math.round(v * 1000) / 1000).toString()
    let amount
    if (this._typed !== '') amount = `[${this._typed}]`
    else if (this.op === 'move') amount = this._lock && !this._lock.others ? `${n(this._by.dot(this._along()))} m` : `${n(this._by.x)}, ${n(this._by.y)}, ${n(this._by.z)} m`
    else if (this.op === 'turn') amount = `${n((this._by * 180) / Math.PI)}°`
    else amount = `×${n(this._by)}`
    return `${WORDS[this.op]}${lock} ${amount}`
  }

  // --- How far the pointer has taken it ---

  // What was gathered so far is let go: the amount is read afresh from where the pointer began.
  _restart() {
    this._sum = null
    this._last = null
  }

  // The pointer's travel since the last reading, added to what there was: all of it, or a
  // tenth with Shift, so that slowing down never makes it jump.
  _gather(raw, slow, add, sub, scale) {
    if (this._last === null) this._sum = raw
    else this._sum = add(this._sum, scale(sub(raw, this._last), slow ? SLOW : 1))
    this._last = raw
    return this._sum
  }

  _moved(pointer) {
    const raw = this._travel(pointer)
    if (!raw) return this._by ?? new Vector3()
    const sum = this._gather(raw, pointer.slow, (a, b) => a.clone().add(b), (a, b) => a.clone().sub(b), (v, k) => v.multiplyScalar(k)).clone()
    if (!pointer.snap) return sum
    const lock = this._lock
    if (lock && !lock.others) return this._along().multiplyScalar(Math.round(sum.dot(this._along()) / SNAP.move) * SNAP.move)
    return sum.set(...sum.toArray().map((v) => Math.round(v / SNAP.move) * SNAP.move))
  }

  // From where the pointer began to where it is, on the plane it is read on, and held to the lock.
  _travel(pointer) {
    const lock = this._lock
    const { forward } = this._seen
    const along = this._along()
    let normal = forward
    if (lock?.others) normal = along
    // An axis is read on the plane it lies in that faces the eye most.
    else if (lock) normal = forward.clone().addScaledVector(along, -forward.dot(along))
    if (normal.lengthSq() < EDGE_ON || Math.abs(normal.clone().normalize().dot(pointer.direction)) < EDGE_ON) normal = forward
    const from = this._onPlane(this._first, normal)
    const to = this._onPlane(pointer, normal)
    if (!from || !to) return null
    const by = to.sub(from)
    if (lock?.others) return by.addScaledVector(along, -by.dot(along))
    if (lock) return along.multiplyScalar(by.dot(along))
    return by
  }

  // Where a pointer's ray meets the plane through the thing that faces `normal`.
  _onPlane({ origin, direction }, normal) {
    const facing = direction.dot(normal)
    if (Math.abs(facing) < 1e-6) return null
    const { pivot } = this._seen
    const reach = new Vector3(pivot.x, pivot.y, pivot.z).sub(origin).dot(normal) / facing
    return reach > 0 ? origin.clone().addScaledVector(direction, reach) : null
  }

  // The locked axis in the world (X, with none): the world's own, or the thing's as it is turned.
  _along() {
    const { axis = 'x', own = false } = this._lock ?? {}
    if (axis === 'y') return new Vector3(0, 1, 0)
    const yaw = own ? this._start.yaw : 0
    return axis === 'x' ? new Vector3(Math.cos(yaw), 0, -Math.sin(yaw)) : new Vector3(Math.sin(yaw), 0, Math.cos(yaw))
  }

  // The angle the pointer has gone round the thing on the screen, as a turn about the upright.
  _turned(pointer) {
    const { centre, forward } = this._seen
    const angle = Math.atan2(pointer.y - centre.y, pointer.x - centre.x)
    // The screen's y runs down, so a rising angle is clockwise as seen; from above that is a falling yaw.
    const sense = forward.y <= 0 ? -1 : 1
    let step = this._last === null ? 0 : angle - this._last
    step -= Math.round(step / (Math.PI * 2)) * Math.PI * 2
    this._sum = (this._sum ?? 0) + step * sense * (pointer.slow ? SLOW : 1)
    this._last = angle
    return pointer.snap ? Math.round(this._sum / SNAP.turn) * SNAP.turn : this._sum
  }

  // How many times further from the thing the pointer is than it began.
  _sized(pointer) {
    const { centre } = this._seen
    const away = ({ x, y }) => Math.hypot(x - centre.x, y - centre.y)
    const raw = away(pointer) / Math.max(1, away(this._first))
    const sum = this._gather(raw, pointer.slow, (a, b) => a + b, (a, b) => a - b, (v, k) => v * k)
    return pointer.snap ? Math.max(SNAP.size, Math.round(sum / SNAP.size) * SNAP.size) : sum
  }

  // The axes a sizing grows: all the thing has, or what the lock leaves of them.
  _axes() {
    const all = [...this._can.sizes]
    const lock = this._lock
    if (!lock) return all
    return all.filter((axis) => (axis === lock.axis) !== lock.others)
  }
}
