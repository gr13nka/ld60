// The lessons, each a held frame with one line before the eye (`HeldLine`): the compass after his
// first steps, the suit at the first edge he runs to, the slide after a few landings, R at his
// first steep fall, and the hook once the last feather is his. Play stops, the line is typed and
// given time to be read, and then the frame waits for the control it names: G pressed, Space held
// a while with a bar filling as it is held, Shift, any key at all, or the hook's button. Taught
// once; which were taught is kept in the save.
//
// When a lesson may begin is the game's to tell (`offer`): it knows where he is and what is under
// him. What a lesson says, how long it is read for, and what proves it is learnt are kept here.

import { HeldLine } from './said-sign.js'

const ORDER = ['compass', 'suit', 'slide'] // each waits until the ones before it are taught; `fall` and `hook` wait for nothing here
const TYPE_RATE = 40 // characters a second the line is typed at: CourierView's
const READ_SECONDS = 0.8 // after the line is typed, before the control is taken
const HOLD_SECONDS = 2 // Space held this long, unbroken, is the suit learnt
const BAR = 10 // marks in the bar that fills as Space is held

const LESSONS = {
  compass: {
    asks: 'inspect',
    words: {
      en: { keys: 'Press G to take out the compass', touch: 'Rest a thumb on the right to take out the compass' },
      ru: { keys: 'Нажми G, чтобы достать компас', touch: 'Задержи палец справа, чтобы достать компас' },
    },
  },
  suit: {
    asks: 'jump',
    hold: HOLD_SECONDS,
    words: {
      en: { keys: 'Hold Space to fly the wingsuit', touch: 'Hold Jump to fly the wingsuit' },
      ru: { keys: 'Зажми пробел, чтобы лететь на вингсьюте', touch: 'Зажми «Jump», чтобы лететь на вингсьюте' },
    },
  },
  slide: {
    asks: 'crouch',
    words: {
      en: { keys: 'Hold Shift to slide. A jump out of a slide keeps the speed', touch: 'Hold HOOK to slide. A jump out of a slide keeps the speed' },
      ru: { keys: 'Зажми Shift, чтобы подкатиться. Прыжок из подката не теряет скорость', touch: 'Зажми HOOK, чтобы подкатиться. Прыжок из подката не теряет скорость' },
    },
  },
  fall: {
    asks: 'any',
    words: {
      en: { keys: 'Falling? R takes you back to the last checkpoint, whenever you like.\nAny key to go on', touch: 'Falling? Retry takes you back to the last checkpoint, whenever you like.\nTap to go on' },
      ru: { keys: 'Падаешь? R вернёт к последней точке, когда захочешь.\nЛюбая клавиша — дальше', touch: 'Падаешь? Retry вернёт к последней точке, когда захочешь.\nКоснись, чтобы продолжить' },
    },
  },
  // On his feet only Q throws it (the other hook buttons slide there); a thumb has no Q, so the
  // touch line sends him into the air, where HOOK throws.
  hook: {
    asks: { keys: 'hookAlone', touch: 'hook' },
    words: {
      en: { keys: 'Every feather is yours: so is the hook. Press Q to throw it at the wall or ledge under the sight.\nIn the air the right button throws it too', touch: 'Every feather is yours: so is the hook. In the air, hold HOOK to throw it at the wall or ledge under the sight' },
      ru: { keys: 'Все перья у тебя — теперь есть крюк. Нажми Q, чтобы бросить его в стену или выступ под прицелом.\nВ воздухе его бросает и правая кнопка', touch: 'Все перья у тебя — теперь есть крюк. В воздухе зажми HOOK, чтобы бросить его в стену или выступ под прицелом' },
    },
  },
}

// The control a lesson waits for: one name, or one for keys and one for thumbs.
const asked = (lesson, touch) => typeof lesson.asks === 'string' ? lesson.asks : touch ? lesson.asks.touch : lesson.asks.keys

export class Lessons {
  constructor(camera) {
    this._line = new HeldLine(camera)
    this._taught = new Set()
    this._open = null // the lesson up: `{ id, text, touch, time, held }`
  }

  get holding() { return this._open !== null }

  /** The control the lesson up waits for, `inspect`, `jump`, `crouch`, `any`, `hookAlone` or `hook`, or null with none up. */
  get asks() { return this._open ? asked(LESSONS[this._open.id], this._open.touch) : null }

  /** Whether `id` is the next to teach: not taught yet, and every one before it in `ORDER` is. */
  due(id) {
    if (this._taught.has(id)) return false
    const before = ORDER.includes(id) ? ORDER.slice(0, ORDER.indexOf(id)) : []
    return before.every((earlier) => this._taught.has(earlier))
  }

  /** Puts lesson `id` up if it is due, in `language`, naming the thumbs' controls on a touchscreen. */
  offer(id, language, touch) {
    if (this._open || !this.due(id)) return false
    const words = LESSONS[id].words[language] ?? LESSONS[id].words.en
    this._open = { id, text: touch ? words.touch : words.keys, touch, time: 0, held: 0 }
    return true
  }

  /** A held step. Returns the id of the lesson learnt on it, which is then taken down, or null. */
  step(dt, controls) {
    const open = this._open
    if (!open) return null
    open.time += dt
    if (open.time < open.text.length / TYPE_RATE + READ_SECONDS) return null
    const lesson = LESSONS[open.id]
    const down = controls[asked(lesson, open.touch)]
    open.held = down ? open.held + dt : 0
    if (!down || open.held < (lesson.hold ?? 0)) return null
    this._taught.add(open.id)
    this._open = null
    return open.id
  }

  /** Once a frame, with the camera's `fov`. */
  present(fov) {
    const open = this._open
    if (!open) return this._line.show(null, fov)
    const hold = LESSONS[open.id].hold
    const filled = hold ? Math.min(BAR, Math.floor(open.held / hold * BAR)) : 0
    const text = hold && open.held > 0 ? `${open.text}\n[${'='.repeat(filled)}${'·'.repeat(BAR - filled)}]` : open.text
    this._line.show({ text, typed: Math.floor(open.time * TYPE_RATE) + 1 }, fov)
  }

  /** The ids taught, for the save. */
  snapshot() { return [...this._taught] }

  /** `taught` from a save: the ids taught. A save from before lessons has been taught none. */
  restore(taught) {
    this._taught = new Set(Array.isArray(taught) ? taught.filter((id) => id in LESSONS) : [])
  }
}
