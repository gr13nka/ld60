// Keyboard, mouse and touch, reduced to what the game asks each step: whichever the player
// uses, the game reads one set of controls. The thumb controls themselves are `touch.js`.

import { fillScreen } from './full-screen.js'
import { LookSpeed } from './look.js'
import { TouchControls } from './touch.js'

const KEY_LOOK_SPEED = 700 // mouse-pixel equivalents per second, for turning with the arrow keys

export class Input {
  /**
   * Clicking `element`, or the bare page beside it, captures the mouse; clicks after that are
   * flicks. `frame` is the game's frame on the page, which the thumb controls mark as touched.
   */
  constructor(element, frame) {
    this._look = new LookSpeed()
    this._touch = new TouchControls(frame, this._look)
    this._keys = new Set()
    this._taps = new Set() // keys pressed since the last read
    this._clicked = false
    this._asked = false // a click has asked for the mouse since the last read
    this._everLocked = false // the browser has given the mouse at least once this visit
    this._away = false // the page was hidden (another tab, a locked phone) since the last read
    this._lost = false // the mouse was taken back or refused since the last read, not let go by the game
    this._filling = false // full screen was asked for and has neither come nor been refused yet
    this._screen = false // the game has asked for the whole screen once: any later press takes it back if lost
    this._letGo = false // the mouse was let go on purpose (`release`): a click on the picture does not ask for it
    this._stray = false // a click since the last read landed on the picture or the bare page while the mouse was let go
    /** Whether the mouse is asked for raw, without the system's acceleration, from the next time it is taken (`_lock`). */
    this.raw = true
    this._pressed = false // the left mouse button is down
    this._hooking = false // the right one is
    this._lookX = 0
    this._lookY = 0
    this._wheel = 0 // notches of the wheel since the last read, away from the player positive
    this._element = element

    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space' || event.code === 'Tab' || event.code.startsWith('Arrow')) event.preventDefault()
      if (event.repeat) return
      this._keys.add(event.code)
      this._taps.add(event.code)
    })
    window.addEventListener('keyup', (event) => this._keys.delete(event.code))
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._away = true
    })
    window.addEventListener('blur', () => {
      this._keys.clear()
      this._pressed = this._hooking = false
    })

    element.addEventListener('contextmenu', (event) => event.preventDefault())
    element.addEventListener('mousedown', (event) => {
      if (this.captured) {
        if (event.button === 0) this._clicked = this._pressed = true
        else if (event.button === 2) this._hooking = true
      } else if (!this._letGo) this._ask()
      else if (event.button === 0) this._stray = true
    })
    // Where the window is not the frame's shape there is bare page beside the picture, and a
    // click there is meant for the game as much as one on it. Only the page itself: whatever
    // else is on it (a choice, the look speed) is clicked for its own sake.
    document.body.addEventListener('mousedown', (event) => {
      if (event.target !== document.body || this.captured) return
      if (!this._letGo) this._ask()
      else if (event.button === 0) this._stray = true
    })
    // The mouse gone without `release` is the player's Escape (or another window): the browser
    // keeps that key press to itself, so this is the only word of it the game gets.
    document.addEventListener('pointerlockchange', () => {
      this._everLocked ||= this._locked
      // Asked for and then let go before the browser had given it (`release` found nothing to
      // give back): it is given back now, or the choices let go for could never be clicked.
      if (this._locked && this._letGo) return document.exitPointerLock()
      if (!this._locked && !this._letGo && !this._filling) this._lost = true
    })
    // A browser on its way to full screen may refuse the mouse, or give it and take it back:
    // neither is the player's doing, so nothing is said of it and the mouse is asked for again
    // once the screen has come, which a browser allows there without a new press.
    document.addEventListener('fullscreenchange', () => {
      const filled = this._filling && document.fullscreenElement
      this._filling = false
      if (filled && !this._locked && !this._letGo) this._lock()
    })
    document.addEventListener('fullscreenerror', () => (this._filling = false))
    // Escape, where the browser keeps it to itself, leaves full screen as well as the mouse; the
    // menu it opens is then clicked or keyed in a window. Any such press takes the screen back,
    // after the press has done what it was for (the menu reads its clicks before they get here).
    // Not Escape itself: the browser does not count it as a press, and it is what left.
    const refill = (event) => {
      if (!this._screen || this._filling || this._touch.active || event.code === 'Escape') return
      if (fillScreen()) this._filling = true
    }
    document.addEventListener('click', refill)
    window.addEventListener('keydown', refill)
    // A browser that never gives the mouse leaves a game that does not answer it, so the page
    // says so. One that gave it before is only refusing a click too soon after Escape.
    document.addEventListener('pointerlockerror', () => {
      if (this._filling) return
      if (this._everLocked) this._lost = true
      if (!this._everLocked) window.reportTrouble?.('The browser would not let the game take the mouse. Click the picture again; if that does nothing, try the game in another browser')
    })
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this._pressed = false
      if (event.button === 2) this._hooking = false
    })
    window.addEventListener('mousemove', (event) => {
      if (!this.captured) return
      const turn = this._look.mouse(event.movementX, event.movementY)
      this._lookX += turn.x
      this._lookY += turn.y
    })
    element.addEventListener('wheel', (event) => {
      if (this.captured) this._wheel -= Math.sign(event.deltaY)
    })
  }

  /**
   * Whether the game has the player's pointer: the mouse captured, or a touchscreen touched
   * once. Without it only the arrow keys turn the view (`turnX`).
   */
  get captured() {
    return this._locked || this._touch.engaged
  }

  /** Whether the player is on a touchscreen, for instructions that name a control. */
  get touch() {
    return this._touch.active
  }

  /**
   * The look speed chosen for the pointer in use, a thumb or the mouse: `step` of `steps`,
   * counted from 0.
   */
  get lookSpeed() {
    return this._look.setting(this._pointer)
  }

  /** Moves that look speed one step up (`direction` over 0) or down; it is remembered for the machine. */
  changeLookSpeed(direction) {
    this._look.change(this._pointer, direction)
  }

  get _pointer() {
    return this.touch ? 'touch' : 'mouse'
  }

  /** A phone is being held upright: nothing should move until it is turned. */
  get blocked() {
    return this._touch.upright
  }

  /** Says which thumb buttons the moment has use for; see `TouchControls.offer`. */
  offer(wanted) {
    this._touch.offer(wanted)
  }

  /** Hangs a lesson's bubble over the thumb button named `over`, or none for null; see `TouchControls.point`. */
  point(text, over) {
    this._touch.point(text, over)
  }

  get _locked() {
    return document.pointerLockElement === this._element
  }

  // A click that asks for the mouse. It counts as the player's first word (`wake`) whether or
  // not the browser then gives it.
  _ask() {
    this._asked = true
    this.capture()
  }

  /**
   * Captures the mouse, if the browser allows it right now; a click on the element does
   * otherwise. It takes the whole screen with it, and from then on keeps taking it back.
   */
  capture() {
    this._letGo = false
    // Asked for outside a click or a key press the browser only refuses, and reports the
    // refusal as an error (`pointerlockerror`, which the page then words): the next click asks.
    if (navigator.userActivation && !navigator.userActivation.isActive) return
    if (!this.captured) this._lock()
    // The screen is taken with the mouse, in the same press (`full-screen.js`), and after it:
    // asking for the screen uses the press up, and the mouse would be refused.
    if (this._touch.active) return
    this._screen = true
    if (fillScreen()) this._filling = true
  }

  _lock() {
    try {
      // The mouse as it moved, without the system's acceleration, where the browser can give
      // it so (Chrome); where it cannot it says so, and the mouse is taken as the system gives it.
      // Safari passes the asking over and gives the latter. The movement lab can turn it off (`raw`).
      Promise.resolve(this._element.requestPointerLock({ unadjustedMovement: this.raw })).catch((error) => {
        if (error?.name === 'NotSupportedError') return Promise.resolve(this._element.requestPointerLock()).catch(() => {})
      })
    } catch {
      // Refused outside a key press or click, or too soon after Escape.
    }
  }

  /**
   * Lets the mouse go, so it can point at things on the page. It stays let go until `capture`:
   * a click that misses what it was meant for does not take the mouse back and turn the view,
   * and is only reported (`strayClick`).
   */
  release() {
    this._letGo = true
    this._stray = false // a click from before the mouse was let go missed nothing
    if (this._locked) document.exitPointerLock()
  }

  /**
   * The controls for one step:
   * `lookX`/`lookY` — look deltas in mouse pixels since the last read (right and down positive),
   *   a thumb's drag included, both already at the player's look speed;
   * `turnX` — the same again from the left and right arrows held, for turning the view without
   *   a mouse; kept apart because on a screen of choices those keys choose instead;
   * `flick` — true once per left click or press of F or FLICK;
   * `held` — true for as long as the left mouse button, F or FLICK is down;
   * `hook` — true for as long as the right mouse button, Q, either Shift or HOOK is down;
   * `hookAlone` — true for as long as Q is down: the hook's one button no slide shares, so
   *   the one that throws it from his feet;
   * `moveX`/`moveZ` — -1, 0 or 1 each, from D and A and from W and S held: on foot, to his
   *   right and forward (`parkour.js`); no touchscreen has them;
   * `jump` — true for as long as Space is down;
   * `crouch` — true for as long as either Shift, the right mouse button or HOOK is down: the
   *   hook's own buttons but for Q, which slide on the ground and throw the hook in the air;
   * `toggleCel` — true once per press of X;
   * `nextLook` — true once per press of L;
   * `fly` — true once per press of B: the flying eye in a parkour place (`Game`);
   * `wheel` — notches of the wheel turned since the last read, away from the player positive;
   * `squat` — true once per press of C: on foot, down on his heels or up again (`Game`);
   * `togglePunch` — true once per press of P;
   * `switchMist` — the number key 1 to 9 pressed, on the row or the pad, else 0;
   * `confirm` — true once per press of Space, Enter or the left mouse button;
   * `strayClick` — true once per left click on the picture or the bare page beside it while
   *   the mouse is let go: one that missed everything there is to click;
   * `wake` — true once per click that asked for the mouse, granted or not, and per press of
   *   Space or Enter: what opens his eyes, so that no refusal leaves the screen black;
   * `retry` — true once per press of R or the thumb's retry;
   * `any` — true once per press of any key or button, for a frame that waits for one;
   * `inspect` — true for as long as G is down, or a thumb rests still on the view's side: the
   *   compass held up to be read (`compass.js`);
   * `menu` — true once per press of M or Tab: the levels;
   * `pause` — true once per press of Escape or the thumb's menu;
   * `lostMouse` — true once when the browser took the mouse back unasked (Escape, which it
   *   does not hand on as a key, or another window) or refused to give it again;
   * `away` — true once when the page was hidden: the one pause a touchscreen has no button for;
   * `lookSpeed` — -1 or +1 once per press of minus or plus, the menu's look speed, else 0;
   * `volume` — -1 or +1 once per press of [ or ], the pause menu's volume, else 0;
   * `menuStep` — -1 or +1 once per press of up/W or down/S, else 0;
   * `menuTurn` — -1 or +1 once per press of left/A or right/D, else 0.
   *
   * The last two are how every screen of choices is moved through, with `confirm` to choose;
   * on a touchscreen the choice itself is tapped, so a touch is never a `confirm`.
   */
  /**
   * The mouse's and the thumbs' travel since the last `read`, `{ x, y }` in mouse pixels as
   * `lookX` and `lookY` will give it, without handing it over: what the view is drawn with
   * between two steps (`Game._viewAim`).
   */
  pendingLook() {
    const thumbs = this._touch.pending()
    return { x: this._lookX + thumbs.x, y: this._lookY + thumbs.y }
  }

  read(dt) {
    const held = (...codes) => codes.some((code) => this._keys.has(code))
    const tapped = (...codes) => codes.some((code) => this._taps.has(code))
    const arrowX = (held('ArrowRight') ? 1 : 0) - (held('ArrowLeft') ? 1 : 0)
    let digit = 0
    for (const code of this._taps) if (/^(Digit|Numpad)[1-9]$/.test(code)) digit = Number(code.at(-1))
    const thumbs = this._touch.read()

    const controls = {
      lookX: this._lookX + thumbs.lookX,
      turnX: arrowX * KEY_LOOK_SPEED * dt,
      lookY: this._lookY + thumbs.lookY,
      flick: this._clicked || tapped('KeyF') || thumbs.flick,
      held: (this._pressed && this.captured) || held('KeyF') || thumbs.held,
      hook: (this._hooking && this.captured) || held('KeyQ', 'ShiftLeft', 'ShiftRight') || thumbs.hook,
      hookAlone: held('KeyQ'),
      moveX: thumbs.moveX || (held('KeyD') ? 1 : 0) - (held('KeyA') ? 1 : 0),
      moveZ: thumbs.moveZ || (held('KeyW') ? 1 : 0) - (held('KeyS') ? 1 : 0),
      jump: held('Space') || thumbs.held,
      crouch: thumbs.hook || (this._hooking && this.captured) || held('ShiftLeft', 'ShiftRight'),
      toggleCel: tapped('KeyX'),
      nextLook: tapped('KeyL'),
      fly: tapped('KeyB'),
      wheel: this._wheel,
      squat: tapped('KeyC'),
      togglePunch: tapped('KeyP'),
      switchMist: digit,
      confirm: this._clicked || tapped('Space', 'Enter'),
      strayClick: this._stray,
      wake: this._asked || tapped('Space', 'Enter'),
      retry: tapped('KeyR') || thumbs.retry,
      interact: tapped('KeyE'),
      inspect: held('KeyG') || thumbs.inspect,
      any: this._taps.size > 0 || this._clicked || thumbs.held || thumbs.flick, // some key or button pressed since the last read
      menu: tapped('KeyM', 'Tab'),
      pause: tapped('Escape') || thumbs.menu,
      lostMouse: this._lost,
      away: this._away,
      lookSpeed: (tapped('Equal', 'NumpadAdd') ? 1 : 0) - (tapped('Minus', 'NumpadSubtract') ? 1 : 0),
      volume: (tapped('BracketRight') ? 1 : 0) - (tapped('BracketLeft') ? 1 : 0),
      menuStep: (tapped('ArrowDown', 'KeyS') ? 1 : 0) - (tapped('ArrowUp', 'KeyW') ? 1 : 0),
      menuTurn: (tapped('ArrowRight', 'KeyD') ? 1 : 0) - (tapped('ArrowLeft', 'KeyA') ? 1 : 0),
    }

    this._lookX = 0
    this._lookY = 0
    this._wheel = 0
    this._clicked = false
    this._stray = false
    this._asked = false
    this._lost = false
    this._away = false
    this._taps.clear()
    return controls
  }
}
