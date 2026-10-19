// The hook: a line thrown at something solid, which then draws him to where it caught,
// faster and faster, for as long as the button is held. It lets go by itself just short of
// the anchor, and what speed he has by then is his to keep.
//
// Pure: `quitters-game.js` finds the anchor, says when the button is down, and draws the line.

import { Vector3 } from 'three'

export const HOOK_REACH = 130 // metres a throw carries
const PULL = 75 // m/s² toward the anchor; against the suit's drag that tops out near 150 m/s
const HOMING = 2.5 // a second: how fast his pace across the line is taken off, so that he comes in and does not circle
const LETS_GO = 16 // metres from the anchor: any nearer and there is no room left to turn off it

const _in = new Vector3()
const _across = new Vector3()

export class Hook {
  constructor() {
    /** Whether the line has hold of something. */
    this.attached = false
    /** Where it has hold, while it does. */
    this.anchor = new Vector3()
    this._from = 0 // how far off he was when it caught
    this._now = 0 // and is now
  }

  /** How many metres off the anchor he is, while the line has hold. */
  get left() {
    return this._now
  }

  /** The line catches at `anchor`, thrown from `from`. */
  attach(anchor, from) {
    this.anchor.copy(anchor)
    this.attached = true
    this._from = this._now = from.distanceTo(anchor)
  }

  /** Lets go. Returns how many metres nearer the anchor it brought him. */
  release() {
    const drawn = this._from - this._now
    this.attached = false
    this._from = this._now = 0
    return drawn
  }

  /**
   * The line's part in a step of movement just made. Lets go by itself on arriving: `attached`
   * then says so. `top` is the m/s along the line past which it pulls no harder: on foot
   * nothing drags him back the way the suit's air does.
   */
  step(body, dt, top = Infinity) {
    if (!this.attached) return
    const { vel } = body
    _in.subVectors(this.anchor, body.pos)
    this._now = _in.length()
    if (this._now < LETS_GO) return void (this.attached = false)
    _in.divideScalar(this._now)
    _across.copy(vel).addScaledVector(_in, -vel.dot(_in))
    vel.addScaledVector(_across, -Math.min(1, HOMING * dt))
    if (vel.dot(_in) < top) vel.addScaledVector(_in, PULL * dt)
  }
}
