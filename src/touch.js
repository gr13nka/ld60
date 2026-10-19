// Thumb controls on a touchscreen: the buttons as seen, and what the thumbs did since last
// asked. The left half is a movement stick; the right half drags the view. The two action
// buttons let a touchscreen runner jump and slide.
// A thumb that rests on the view's side without dragging, for `REST_SECONDS`, holds the compass
// up until it drags again or is lifted (`inspect`): the one control with no button to show.
// A phone held upright gets a card asking for it to be turned, and the game waits (`upright`)
// until it is, or until the card's own way round is tapped: a phone locked upright cannot be
// turned, and no iPhone's browser lets a page turn the screen for it.
//
// A touch is told from a tap on the HUD by what it landed on: everything tappable there takes
// pointer events and the rest lets them through to the canvas.

import './touch.css'
import { fillScreen } from './full-screen.js'

const REST_SECONDS = 0.45 // a thumb this long still on the view's side is reading the compass
const REST_DRIFT = 14 // px it may wander from where it came down and still be resting

function element(parent, className, text = '') {
  const node = document.createElement('div')
  node.className = className
  node.textContent = text
  parent.appendChild(node)
  return node
}

export class TouchControls {
  /**
   * `frame` is the game's frame on the page; `look` (a `LookSpeed`) says how far a drag turns
   * the view.
   */
  constructor(frame, look) {
    this._frame = frame
    this._look = look
    this._root = element(document.body, 'thumbs')
    this._root.hidden = true
    this._buttons = {
      flick: element(this._root, 'thumbs-button thumbs-flick', 'Jump'),
      hook: element(this._root, 'thumbs-button thumbs-hook', 'Slide'),
      menu: element(this._root, 'thumbs-button thumbs-corner thumbs-menu', '≡'),
      retry: element(this._root, 'thumbs-button thumbs-corner thumbs-retry', '↻'),
    }
    // A lesson's bubble over FLICK or HOOK, saying what the thumb is to do there right now (`point`).
    this._bubble = element(this._root, 'thumbs-bubble')
    this._bubble.hidden = true
    this._card = element(this._root, 'thumbs-turn')
    element(this._card, 'thumbs-turn-ask', 'Turn your phone sideways')
    this._stayUpright = false // the player chose to play upright; for the visit
    element(this._card, 'thumbs-turn-anyway', 'Can’t turn it? Play upright').addEventListener('pointerup', () => {
      this._stayUpright = true
      this._showCard()
    })
    this._card.hidden = true

    this._drags = new Map() // pointer id → where that finger last was and when, `{ x, y, at }`
    this._movePointer = null
    this._moveX = 0
    this._moveZ = 0
    this._lookX = 0
    this._lookY = 0
    this._tapped = { flick: false, menu: false, retry: false }
    // A thumb is on that button now. HOOK is only ever held: it has no tap.
    this._down = { flick: false, hook: false }

    /** Whether the player is on a touchscreen: true from the start on a phone, or from the first touch, until a mouse is clicked. */
    this.active = false
    /** Whether the screen has been touched yet; the first touch is what starts the game on a phone. */
    this.engaged = false

    this._portrait = window.matchMedia('(orientation: portrait)')
    window.addEventListener('resize', () => this._showCard()) // a turned phone is a resized window
    if (window.matchMedia('(pointer: coarse)').matches) this._activate()

    for (const name of ['flick', 'menu', 'retry']) {
      this._buttons[name].addEventListener('pointerdown', (event) => {
        event.preventDefault()
        this._tapped[name] = true
      })
    }
    for (const name of ['flick', 'hook']) {
      this._buttons[name].addEventListener('pointerdown', (event) => {
        event.preventDefault()
        this._down[name] = true
      })
      for (const over of ['pointerup', 'pointercancel', 'pointerleave']) {
        this._buttons[name].addEventListener(over, () => (this._down[name] = false))
      }
    }

    window.addEventListener('pointerdown', (event) => {
      // A laptop with a touchscreen, touched once and then played with its mouse: the thumbs'
      // controls go, and the click itself is free to ask for the mouse (`Input`'s `captured`).
      if (event.pointerType === 'mouse') return this._retire()
      if (event.pointerType !== 'touch') return
      this._activate()
      this.engaged = true
      if (!this._passesThrough(event.target)) return
      // Cancelled, so the browser sends no mouse events after it: a tap is not a click on the canvas.
      event.preventDefault()
      this._look.touchBegan()
      if (event.clientX < window.innerWidth * 0.45 && this._movePointer === null) {
        this._movePointer = event.pointerId
        this._drags.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, at: event.timeStamp })
      } else this._drags.set(event.pointerId, { x: event.clientX, y: event.clientY, at: event.timeStamp, startX: event.clientX, startY: event.clientY, since: event.timeStamp, still: true })
    })
    window.addEventListener('pointermove', (event) => {
      const last = this._drags.get(event.pointerId)
      if (!last) return
      if (event.pointerId === this._movePointer) {
        this._moveX = Math.max(-1, Math.min(1, (event.clientX - last.startX) / 48))
        this._moveZ = Math.max(-1, Math.min(1, (last.startY - event.clientY) / 48))
        return
      }
      if (last.still && Math.hypot(event.clientX - last.startX, event.clientY - last.startY) > REST_DRIFT) last.still = false
      const turn = this._look.touch(event.clientX - last.x, event.clientY - last.y, event.timeStamp - last.at)
      this._lookX += turn.x
      this._lookY += turn.y
      last.x = event.clientX
      last.y = event.clientY
      last.at = event.timeStamp
    })
    const lifted = (event) => {
      this._drags.delete(event.pointerId)
      if (event.pointerId === this._movePointer) {
        this._movePointer = null
        this._moveX = this._moveZ = 0
      }
    }
    window.addEventListener('pointerup', lifted)
    window.addEventListener('pointercancel', lifted)
    // Browsers only go full screen from inside a finished tap, and only some of them at all.
    window.addEventListener('pointerup', (event) => {
      if (event.pointerType === 'touch') fillScreen()
    })
  }

  /** A phone held upright: the card is up, and nothing should move until it is turned. */
  get upright() {
    return this.active && this._portrait.matches && !this._stayUpright
  }

  /**
   * Says which buttons the moment has use for — `flick`, `hook`, `retry`, `menu`, each true
   * or false, a missing one false. Call once per frame.
   */
  offer(wanted) {
    for (const [name, node] of Object.entries(this._buttons)) {
      const hidden = !wanted[name]
      if (node.hidden === hidden) continue
      node.hidden = hidden
      // A button taken away from under a thumb gets no `pointerup` to say the thumb has gone.
      if (hidden && name in this._down) this._down[name] = false
    }
  }

  /**
   * Hangs a speech bubble saying `text` over the button named `over` ('flick' or 'hook'), or
   * takes it away for null. Call once per frame.
   */
  point(text, over = 'flick') {
    const node = this._bubble
    const hidden = !text
    if (node.hidden !== hidden) node.hidden = hidden
    if (!text) return
    if (node.textContent !== text) node.textContent = text
    if (node.dataset.over !== over) node.dataset.over = over
  }

  /** The drag since the last read, `{ x, y }` in mouse pixels, left to be read. */
  pending() {
    return { x: this._lookX, y: this._lookY }
  }

  /**
   * What the thumbs did since the last read: `lookX`/`lookY` — the drag, in mouse-pixel
   * equivalents (right and down positive); `flick`, `menu`, `retry` — true once per press of
   * that button; `held` — true while a thumb is on FLICK; `hook` — true while one is on HOOK;
   * `inspect` — true while a thumb rests still on the view's side.
   */
  read() {
    const tapped = this._tapped
    const did = {
      lookX: this._lookX,
      lookY: this._lookY,
      flick: tapped.flick,
      held: this._down.flick,
      hook: this._down.hook,
      moveX: this._moveX,
      moveZ: this._moveZ,
      menu: tapped.menu,
      retry: tapped.retry,
      inspect: this._resting(),
    }
    this._lookX = 0
    this._lookY = 0
    tapped.flick = tapped.menu = tapped.retry = false
    return did
  }

  // Whether a thumb on the view's side has rested there, undragged, for `REST_SECONDS`.
  _resting() {
    const now = performance.now()
    for (const [id, drag] of this._drags) {
      if (id !== this._movePointer && drag.still && now - drag.since >= REST_SECONDS * 1000) return true
    }
    return false
  }

  _activate() {
    if (this.active) return
    this.active = true
    this._frame.classList.add('touch') // `hud.css` hides the lines that name keys under it
    this._root.hidden = false
    this._showCard()
  }

  // Back to a keyboard and mouse, until the screen is touched again.
  _retire() {
    if (!this.active) return
    this.active = this.engaged = false
    this._frame.classList.remove('touch')
    this._root.hidden = true
    this._drags.clear()
    this._movePointer = null
    this._moveX = this._moveZ = 0
    this._showCard()
  }

  _showCard() {
    this._card.hidden = !this.upright
  }

  // Whether a touch that landed on `target` is on nothing tappable, and so drags the view.
  _passesThrough(target) {
    return target === this._frame || target === document.body || target === document.documentElement || target.tagName === 'CANVAS'
  }
}
