// How cheap this machine's picture was found to need to be, remembered for the machine: a
// weak one otherwise sits through the same slide down on every visit, a second or two a step
// (`frame-budget.js` says when, `Picture.cheapen` how). A visit starts one step dearer than
// the last one ended, so a machine judged on a bad day earns its way back in a visit or two.
//
// The sun's shadows are the one saving that cannot be made during play: their kind is built
// into every lit material. So it is decided here, at the start, and like `stutter.js`'s
// verdict it is only ever turned on: a machine still behind with every step taken
// (`exhausted`) gets hard-edged shadows from then on, which cost one look at the shadow map
// where soft ones cost dozens. Not before: the steps hardly show, and hard shadows do.
//
// And a card may refuse shadows outright. The Pixel 10's (a PowerVR D-Series) throws the
// graphics away within the first few frames that look a shadow map up, of whatever kind, by
// the word of two other games that took theirs apart to find it: there the choice is
// shadows or a picture, so such a card gets none. Any card that loses the graphics as a visit
// starts (`lostGraphics`) is taken to be another like it, from then on.

const KEY = 'quitters.picture'
// Cards that lose the graphics over a shadow map, by what they call themselves: Firefox says
// "PowerVR SGX 540, or similar" of every PowerVR, so they cannot be told apart there.
const REFUSES_SHADOWS = /PowerVR|Imagination/i

// `?picture=full` forgets what was remembered.
function remembered() {
  try {
    if (new URLSearchParams(location.search).get('picture') === 'full') localStorage.removeItem(KEY)
    const { steps, hardShadows, noShadows } = JSON.parse(localStorage.getItem(KEY)) ?? {}
    return { steps: Number.isInteger(steps) && steps > 0 ? steps : 0, hardShadows: hardShadows === true, noShadows: noShadows === true }
  } catch {
    return { steps: 0, hardShadows: false, noShadows: false } // no storage, or nothing readable in it: judged afresh
  }
}

/** What the graphics card behind `gl` calls itself, or '' where the browser will not say. */
export function cardOf(gl) {
  const names = gl.getExtension('WEBGL_debug_renderer_info')
  return String(gl.getParameter(names ? names.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '')
}

export class Quality {
  /** `card` is what the graphics card calls itself (`cardOf`). */
  constructor(card = '') {
    const last = remembered()
    /** How many steps cheaper than full the picture is to start this visit. For reading only. */
    this.steps = Math.max(0, last.steps - 1)
    const refused = REFUSES_SHADOWS.test(card)
    /**
     * The sun's shadows: 'soft', 'hard' (hard-edged) or 'none'. For the whole visit, but that
     * `lostGraphics` may make it 'none'. For reading only.
     */
    this.shadows = refused || last.noShadows ? 'none' : last.hardShadows ? 'hard' : 'soft'
    /** Why there are no shadows, in a few words for the debug readout; '' where there are. */
    this.shadowsWhy = refused ? 'PowerVR' : last.noShadows ? 'graphics lost at a start' : ''
    this._hardNext = last.hardShadows
    this._noShadows = last.noShadows
    // Written down at once: a visit that holds at the dearer step is what earns the next one.
    this._remember()
  }

  /** Takes note that the picture was made one step cheaper, the steps it started with aside. */
  cheapened() {
    this.steps++
    this._remember()
  }

  /** Takes note that the machine is still not keeping up with the picture as cheap as it gets. */
  exhausted() {
    if (this._hardNext) return
    this._hardNext = true
    this._remember()
  }

  /**
   * Takes note that the graphics were lost as the visit started: no shadows from now on, in
   * this visit once the graphics are back (every material is remade then anyway) and in later ones.
   */
  lostGraphics() {
    if (this.shadows === 'none') return
    this.shadows = 'none'
    this.shadowsWhy = 'graphics lost at a start'
    this._noShadows = true
    this._remember()
  }

  _remember() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ steps: this.steps, hardShadows: this._hardNext, noShadows: this._noShadows }))
    } catch {
      // No storage: learnt again next visit.
    }
  }
}
