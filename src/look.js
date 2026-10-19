// How far a pointer's travel turns the view: the player's look speed for the mouse and for
// a thumb, remembered for the machine, and a thumb's own response. Everything is handed on in
// mouse pixels, which `LOOK_SENSITIVITY` in `game.js` makes an angle.
//
// A thumb's drag is measured in CSS pixels, not against the screen: a thumb reaches about as
// far on a tablet as on a phone, and a CSS pixel is about as long on either. It turns the view
// less than evenly when slow and more when fast, so the pumps can be ringed exactly and a look
// behind is still one swipe.

const TOUCH_PIXEL = 1.3 // mouse pixels to a CSS pixel of drag, before the gain
const SLOW_GAIN = 0.7 // at `SLOW_PACE` and under
const FAST_GAIN = 1.6 // at `FAST_PACE` and over
const SLOW_PACE = 150 // CSS pixels a second
const FAST_PACE = 1200
const PACE_SMOOTHING = 0.4 // how much of a move's own pace is taken; the rest is the drag's so far

// The look speeds a player may choose between, as multipliers; the middle one is as built.
const STEPS = [0.5, 0.63, 0.79, 1, 1.26, 1.59, 2]
const AS_BUILT = 3
const SETTING_KEY = 'quitters.look'

const KINDS = ['mouse', 'touch']

function remembered() {
  const steps = { mouse: AS_BUILT, touch: AS_BUILT }
  try {
    const kept = JSON.parse(localStorage.getItem(SETTING_KEY)) ?? {}
    for (const kind of KINDS) if (STEPS[kept[kind]] !== undefined) steps[kind] = kept[kind]
  } catch {
    // No storage, or nothing readable in it: as built.
  }
  return steps
}

export class LookSpeed {
  constructor() {
    this._steps = remembered()
    this._pace = 0 // of the drag in progress, CSS pixels a second, smoothed
  }

  /** A mouse's travel of `dx`, `dy` pixels as the player wants it taken: `{ x, y }`, mouse pixels. */
  mouse(dx, dy) {
    const speed = STEPS[this._steps.mouse]
    return { x: dx * speed, y: dy * speed }
  }

  /** A finger has come down: what the last drag's pace was says nothing of this one. */
  touchBegan() {
    this._pace = 0
  }

  /**
   * A thumb's drag of `dx`, `dy` CSS pixels over `ms` milliseconds, as `{ x, y }` in mouse
   * pixels. `ms` of 0 (two moves handed over at once) is taken at the drag's pace so far.
   */
  touch(dx, dy, ms) {
    if (ms > 0) this._pace += ((Math.hypot(dx, dy) / ms) * 1000 - this._pace) * PACE_SMOOTHING
    const t = Math.min(1, Math.max(0, (this._pace - SLOW_PACE) / (FAST_PACE - SLOW_PACE)))
    const gain = SLOW_GAIN + (FAST_GAIN - SLOW_GAIN) * t * t * (3 - 2 * t)
    const perPixel = TOUCH_PIXEL * gain * STEPS[this._steps.touch]
    return { x: dx * perPixel, y: dy * perPixel }
  }

  /** The look speed chosen for `kind` ('mouse' or 'touch'): `step` of `steps`, counted from 0. */
  setting(kind) {
    return { step: this._steps[kind], steps: STEPS.length }
  }

  /** Moves `kind`'s look speed one step up (`direction` over 0) or down, and remembers it. */
  change(kind, direction) {
    const wanted = this._steps[kind] + Math.sign(direction)
    if (STEPS[wanted] === undefined) return
    this._steps[kind] = wanted
    try {
      localStorage.setItem(SETTING_KEY, JSON.stringify(this._steps))
    } catch {
      // No storage: for this visit only.
    }
  }
}
