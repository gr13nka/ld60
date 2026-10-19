// Judges whether the machine is keeping up, from the frames it is given. Quality follows
// sustained missed deadlines, including alternating fast and slow frames, and only ever goes
// down: one-way adjustments avoid visible oscillation during a run. What "cheaper" means is
// not decided here; see `Picture.cheapen`.
//
// A frame is late by the display's own pace, not by 60 a second: a phone saving its battery is
// shown 30 frames a second however little there is to draw, some screens 50, and a picture made
// cheaper for that is made worse for nothing. That pace can only be told from the machine's
// before the game is drawing, so `watchDisplay` is to be called as early as the page can.
// And late is a frame the display went without, not one a little behind: a browser keeping an
// even 60 hands its frames over anywhere from 15 to 19 ms apart (Chrome on an M2 Pro, measured),
// and a deadline of 18 took one in eight of those for missed and halved the picture's sharpness.

const WINDOW_MS = 750 // how long frames are counted before a verdict
const COOLDOWN_MS = 1000 // left alone for this long after a verdict to cheapen, and at the start
const QUICKEST_INTERVAL_MS = 1000 / 60 // the game asks no more of a display that shows more
const LATE = 1.3 // a frame this many intervals in coming was missed: past any jitter, short of the two a skipped one takes
const WORK_SHARE = 0.84 // as was one whose own work took more than this much of an interval (14 ms of 16.7)
const SLOWEST_DISPLAY_MS = 1000 / 30 // nothing shows fewer; a longer interval is a page not being shown
const PACE_FRAMES = 240 // as many intervals as are watched for the display's pace
const PACE_NEEDS = 20 // and as few as it can be told from
const MISSED_SHARE = 0.15 // of the frames in a window
const PAUSE_MS = 250 // a gap this long is the tab or the debugger, not rendering,
const CRAWL_FRAMES = 3 // unless this many come one after another: then the machine is that slow

const intervals = []
let watching = false

/**
 * Starts timing the frames the browser offers, to learn how often the display shows one. Call
 * once, while the page is still loading and nothing is drawn; a `FrameBudget` made later goes
 * by what was seen, and by 60 a second where this was never called.
 */
export function watchDisplay() {
  if (watching || typeof requestAnimationFrame === 'undefined') return
  watching = true
  let last = null
  const frame = (now) => {
    if (!watching) return
    if (last !== null) intervals.push(now - last)
    last = now
    if (intervals.length < PACE_FRAMES) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

// The display's interval as watched so far, in milliseconds, or null if too little was seen.
// A page busy loading drops frames and never gains one, so the pace is among the shortest
// intervals: the fifth of them from the short end, past the jitter of the very shortest.
function displayInterval() {
  watching = false
  if (intervals.length < PACE_NEEDS) return null
  const sorted = intervals.slice().sort((a, b) => a - b)
  return Math.min(sorted[Math.floor(sorted.length / 5)], SLOWEST_DISPLAY_MS)
}

export class FrameBudget {
  /** `interval`: the display's, in milliseconds, for one that is known; else as `watchDisplay` saw it. */
  constructor(interval = displayInterval()) {
    const pace = Math.max(QUICKEST_INTERVAL_MS, interval ?? 0)
    this._deadline = pace * LATE
    this._budget = pace * WORK_SHARE
    this.reset()
  }

  /** Forgets what has been counted; for when frames stop coming, as on a hidden tab. */
  reset() {
    this._elapsed = 0
    this._frames = 0
    this._missed = 0
    this._cooldown = COOLDOWN_MS
    this._long = 0 // frames over `PAUSE_MS`, one straight after another
  }

  /**
   * Takes note of one displayed frame; call for every one. `elapsedMs` is the time since the
   * frame before it and `workMs` the time this one took to simulate and draw — both in
   * milliseconds, unlike the seconds the game itself runs on. Returns true when rendering
   * should move down one quality step.
   */
  recordFrame(elapsedMs, workMs) {
    if (elapsedMs > PAUSE_MS) {
      // A browser drawing without the graphics card takes this long over every frame.
      const long = this._long + 1
      this.reset()
      if (long >= CRAWL_FRAMES) return true
      this._long = long
      return false
    }
    this._long = 0
    if (this._cooldown > 0) {
      this._cooldown -= elapsedMs
      return false
    }
    this._elapsed += elapsedMs
    this._frames++
    if (elapsedMs > this._deadline || workMs > this._budget) this._missed++
    if (this._elapsed < WINDOW_MS) return false
    const missedTooMany = this._missed / this._frames >= MISSED_SHARE
    this._elapsed = this._frames = this._missed = 0
    if (missedTooMany) this._cooldown = COOLDOWN_MS
    return missedTooMany
  }
}
