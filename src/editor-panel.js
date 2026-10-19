// What the editor (`editor.js`) shows over the picture: a side panel of the picked thing's
// numbers, as Blender's N panel is (where it stands, how it is turned, its scale and its real
// size, each typed directly or dragged left and right as a slider), a live asset's parameters
// under them, each a field of its kind, its whole record as text folded under them for what has no
// field, a status line along the bottom that names the keys of the moment, and the menu of
// forms and assets that can be added (one menu, so a preset's name and an asset's must not
// overlap: `onAdd` is given only the name). It shows and hands back what was typed; it changes nothing itself.

import './editor.css'

const AXES = ['X', 'Y', 'Z']
const DEGREES = 180 / Math.PI
const shown = (v, places = 3) => String(Math.round(v * 10 ** places) / 10 ** places)
const SLIDE_SLOP = 3 // pixels a press on a field may move and still be a click, to type in it
// What a pixel of a field's drag is, and what Ctrl snaps it to; Shift makes it a tenth.
// A place is metres across the screen at the pivot (`metresPerPixel`); a size grows by times.
const SLIDE = {
  at: { by: 'metres', snap: 1 },
  yaw: { by: 0.5, snap: 5 },
  scale: { times: 1.005, snap: 0.1 },
  size: { times: 1.005, snap: 0.1 },
}
const SLOW = 0.1
// A parameter's drag: a whole number goes one for this many pixels; another a share of its default a pixel.
const PARAM_SLIDE = { pixelsPerOne: 5, share: 0.005, least: 0.01 }

function make(tag, className, text) {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

export class EditorPanel {
  /**
   * `presets` are the names in the add menu, and `assets` the buildings under them (`assets.js`). `onTransform(transform)` is called with the picked
   * thing's transform as the fields now have it, `onRecord(text)` with its record as typed,
   * `onAdd(name)` with the preset chosen. A field dragged calls `onSlide('start')`, then
   * `onSlide('move', transform)` at each step, then `onSlide('end')`: one change from start to
   * end. `metresPerPixel()` is how far a place's field goes for a pixel of the drag. A
   * parameter's field calls `onParam('set', key, value)`, or dragged `onParam('start', key)`,
   * `onParam('move', key, value)` and `onParam('end', key)`; `onDefaults()` asks for the
   * asset's values to be made its builder's, `onParts()` for its parts to be put back.
   */
  constructor({ presets, assets = [], onTransform, onRecord, onAdd, onSlide, onParam, onDefaults, onParts, metresPerPixel }) {
    this._onTransform = onTransform
    this._onSlide = onSlide
    this._onParam = onParam
    this._metresPerPixel = metresPerPixel
    this._sliding = null // { input, from, x, moved }: a field pressed, until it is let go
    this._target = null

    this._side = make('aside', 'editor-side')
    this._file = make('b')
    this._name = make('div', 'editor-name')
    this._groups = {
      at: this._group('Location', 'm', 3, SLIDE.at),
      yaw: this._group('Rotation', '°', 1, SLIDE.yaw, ['Y']), // about the upright, the only way a thing here turns
      scale: this._group('Scale', '', 3, SLIDE.scale),
      size: this._group('Dimensions', 'm', 3, SLIDE.size),
    }
    this._record = make('textarea')
    this._record.spellcheck = false
    this._record.addEventListener('change', () => onRecord(this._record.value))
    const fold = make('details', 'editor-record')
    fold.append(make('summary', '', 'Record'), this._record)
    fold.addEventListener('toggle', () => this._fillRecord())
    this._fold = fold
    this._error = make('div', 'editor-error')

    // A live asset's parameters: a row each, and under them what is said of the one pointed at,
    // the button that makes the values the builder's, and the parts changed by hand.
    this._params = make('div', 'editor-params')
    this._params.hidden = true
    this._paramRows = make('div', 'editor-param-rows')
    this._meaning = make('div', 'editor-meaning')
    this._defaults = make('button', '', "Make these the builder's defaults")
    // A control keeps the focus after a click, and Space or a letter would then work it again, not the editor.
    const pressed = (act) => (event) => {
      event.currentTarget.blur()
      act()
    }
    this._defaults.addEventListener('click', pressed(onDefaults))
    this._parts = make('div', 'editor-parts')
    this._partsSaid = make('span')
    const partsBack = make('button', '', 'Put back')
    partsBack.addEventListener('click', pressed(onParts))
    this._parts.append(this._partsSaid, partsBack)
    this._params.append(make('span', 'editor-title', 'Parameters'), this._paramRows, this._meaning, this._defaults, this._parts)
    this._paramsShown = '' // the parameters last shown, as text: shown again only when they change
    this._paramsWaiting = null // what was to be shown while one of them was being typed in
    this._paramSliding = null // { input, from, x, moved, step, whole, put }: a parameter's field pressed, until it is let go
    this._params.addEventListener('focusout', () => setTimeout(() => this._paramsWaiting && this.params(this._paramsWaiting)))
    this._side.append(this._file, this._name, ...Object.values(this._groups).map((group) => group.root), this._params, fold, this._error)

    this._bar = make('footer', 'editor-bar')
    this._said = make('span', 'editor-said')
    this._keys = make('span', 'editor-keys')
    this._bar.append(this._said, this._keys)

    this._lasso = make('div', 'editor-lasso')
    this._lasso.hidden = true

    this._menu = make('div', 'editor-add')
    this._menu.hidden = true
    this._menu.append(make('b', '', 'Add'))
    const offer = (name) => {
      const button = make('button', '', name)
      button.addEventListener('click', () => {
        this.closeAdd()
        onAdd(name)
      })
      this._menu.append(button)
    }
    presets.forEach(offer)
    if (assets.length > 0) {
      this._menu.append(make('b', '', 'Assets'))
      assets.forEach(offer)
    }
    document.body.append(this._side, this._bar, this._menu, this._lasso)
  }

  /** Takes the panel out of the page. */
  dispose() {
    this._side.remove()
    this._bar.remove()
    this._menu.remove()
    this._lasso.remove()
  }

  /** Whether any of it is on the page: with the editor, and gone with it. */
  set on(on) {
    this._side.classList.toggle('shown', on)
    this._bar.classList.toggle('shown', on)
    if (!on) {
      this.closeAdd()
      this.lasso(null)
    }
  }

  /** N: the side panel hidden, or brought back. */
  toggle() {
    this._side.classList.toggle('folded')
  }

  /** The place's file, named at the top. */
  set file(name) {
    this._file.textContent = name
  }

  /**
   * Shows `target` (`editor-things.js`), or nothing with null: `name` says what it is. A field
   * being typed in is left alone.
   */
  fill(target, name = '') {
    this._target = target
    this._name.textContent = target ? name : 'nothing picked'
    const { at, yaw, scale, size } = this._groups
    for (const group of Object.values(this._groups)) group.root.hidden = !target
    this._fold.hidden = !target?.record // a group has no one record
    if (!target) return
    const t = target.read()
    this._set(at, [t.at.x, t.at.y, t.at.z], 'xyz')
    yaw.root.hidden = !target.turns
    this._set(yaw, [t.yaw * DEGREES], 'x')
    scale.root.hidden = !target.scaled || target.sizes === ''
    this._set(scale, t.size, target.sizes)
    size.root.hidden = target.sizes === ''
    this._set(size, target.scaled ? t.size.map((s, i) => s * target.own[i]) : t.size, target.sizes)
    this._fillRecord()
  }

  /**
   * The picked asset's parameters (`spec`: `{ entries: [{ key, value, changed, fallback, meaning,
   * choices }], path, parts, stray }`), or none with null: each a field of its kind (a number
   * typed or dragged, a box to tick, a choice among `choices`, a list of either, or JSON for the
   * rest), one that differs from its default marked and given a way back to it. `path` is the
   * builder's source; `parts` how many of its parts were changed by hand, `stray` how many of
   * those its builder no longer makes. Not shown again while one of them is typed in or dragged.
   */
  params(spec) {
    if (!spec) {
      this._params.hidden = true
      this._paramsShown = ''
      this._paramsWaiting = null
      return
    }
    const text = JSON.stringify(spec)
    if (text === this._paramsShown) return
    if (this._paramSliding || this._params.contains(document.activeElement)) {
      this._paramsWaiting = spec
      return
    }
    this._paramsWaiting = null
    this._paramsShown = text
    this._params.hidden = false
    this._paramRows.replaceChildren(...spec.entries.map((entry) => this._paramRow(entry)))
    this._meaning.textContent = ''
    this._defaults.hidden = !spec.entries.some(({ changed }) => changed)
    this._defaults.title = spec.path ? `written into ${spec.path}; the page reloads` : 'the dev server has not said where this builder is'
    this._parts.hidden = spec.parts === 0
    this._partsSaid.textContent = `${spec.parts} part${spec.parts === 1 ? '' : 's'} changed by hand${spec.stray ? `, ${spec.stray} of them no longer made by the builder` : ''}`
  }

  // One parameter's row: its name, its field and, if it differs from its default, a way back to it.
  _paramRow({ key, value, changed, fallback, meaning, choices }) {
    const row = make('div', changed ? 'editor-param changed' : 'editor-param')
    const say = () => (this._meaning.textContent = `${key}: ${meaning || 'nothing said of it'} · default ${JSON.stringify(fallback)}`)
    row.addEventListener('pointerenter', say)
    row.addEventListener('focusin', say)
    row.append(make('span', 'editor-param-name', key))
    const set = (v) => this._onParam('set', key, v)
    const numbers = (list) => Array.isArray(list) && list.length > 0 && list.every((n) => typeof n === 'number')
    if (typeof fallback === 'boolean') {
      const box = make('input')
      box.type = 'checkbox'
      box.checked = Boolean(value)
      box.addEventListener('change', () => {
        box.blur() // Space is the editor's again
        set(box.checked)
      })
      row.append(box)
    } else if (typeof fallback === 'number') {
      row.append(this._numberField(key, value, fallback, (v) => v))
    } else if (numbers(fallback) && numbers(value)) {
      value.forEach((n, i) => row.append(this._numberField(key, n, fallback[i] ?? n, (v) => value.map((m, j) => (j === i ? v : m)))))
    } else if (choices && typeof fallback === 'string') {
      row.append(this._choice(choices, value, set))
    } else if (choices && Array.isArray(value) && value.every((w) => typeof w === 'string')) {
      value.forEach((word, i) => row.append(this._choice(choices, word, (w) => set(value.map((v, j) => (j === i ? w : v))))))
    } else {
      const input = make('input', 'editor-json')
      input.value = JSON.stringify(value)
      input.addEventListener('change', () => {
        try {
          set(JSON.parse(input.value))
        } catch (error) {
          this.error(`${key}: ${error.message}`)
        }
      })
      input.addEventListener('keydown', (event) => event.key === 'Enter' && input.blur())
      row.append(input)
    }
    if (changed) {
      const back = make('button', 'editor-param-back', '↺')
      back.title = `back to ${JSON.stringify(fallback)}`
      back.addEventListener('click', () => {
        back.blur()
        set(fallback)
      })
      row.append(back)
    }
    return row
  }

  // A choice among `choices`, `now` chosen (and kept among them if it is none of them).
  _choice(choices, now, put) {
    const select = make('select')
    for (const choice of choices.includes(now) ? choices : [now, ...choices]) select.append(new Option(choice, choice, false, choice === now))
    select.addEventListener('change', () => {
      select.blur() // or a letter of WASD would choose again
      put(select.value)
    })
    return select
  }

  // A number field of a parameter: typed (a click), or dragged left and right as a slider. A whole
  // number goes by ones, and stays whole; another by a share of its default. `whole(v)` is the
  // parameter's value with this field's number `v` in it (an element of a list, or itself).
  _numberField(key, value, fallback, whole) {
    const input = make('input')
    input.type = 'number'
    input.step = 'any'
    input.value = shown(value)
    const integer = Number.isInteger(fallback)
    const step = integer ? 1 / PARAM_SLIDE.pixelsPerOne : Math.max(PARAM_SLIDE.least, Math.abs(fallback) * PARAM_SLIDE.share)
    input.addEventListener('change', () => Number.isFinite(input.valueAsNumber) && this._onParam('set', key, whole(input.valueAsNumber)))
    input.addEventListener('keydown', (event) => (event.key === 'Enter' || event.key === 'Escape') && input.blur())
    input.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || document.activeElement === input) return
      event.preventDefault()
      input.setPointerCapture(event.pointerId)
      this._paramSliding = { input, from: value, x: event.clientX, moved: false }
    })
    input.addEventListener('pointermove', (event) => {
      const sliding = this._paramSliding
      if (sliding?.input !== input) return
      const px = event.clientX - sliding.x
      if (!sliding.moved) {
        if (Math.abs(px) <= SLIDE_SLOP) return
        sliding.moved = true
        this._onParam('start', key)
      }
      let v = sliding.from + px * step * (event.shiftKey ? SLOW : 1)
      if (integer || event.ctrlKey || event.metaKey) v = Math.round(v)
      input.value = shown(v)
      this._onParam('move', key, whole(Number(shown(v))))
    })
    const release = () => {
      const sliding = this._paramSliding
      if (sliding?.input !== input) return
      this._paramSliding = null
      if (sliding.moved) return this._onParam('end', key)
      input.focus()
      input.select()
    }
    input.addEventListener('pointerup', release)
    input.addEventListener('lostpointercapture', release)
    input.addEventListener('contextmenu', (event) => this._paramSliding && event.preventDefault())
    return input
  }

  /** What has just happened, at the left of the status line. */
  say(message) {
    this._said.textContent = message
  }

  /** The keys of the moment, at the right of the status line. */
  keys(message) {
    this._keys.textContent = message
  }

  /** What went wrong with what was typed; nothing clears it. */
  error(message = '') {
    this._error.textContent = message
  }

  /** The rectangle of a box select (`{ left, top, right, bottom }` on the page), or none with null. */
  lasso(rect) {
    this._lasso.hidden = !rect
    if (!rect) return
    Object.assign(this._lasso.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.right - rect.left}px`, height: `${rect.bottom - rect.top}px` })
  }

  /** The add menu opened with its corner at `x`, `y` on the page. */
  openAdd(x, y) {
    this._menu.hidden = false
    this._menu.style.left = `${Math.min(x, window.innerWidth - 160)}px`
    this._menu.style.top = `${Math.min(y, window.innerHeight - this._menu.offsetHeight - 30)}px`
  }

  closeAdd() {
    this._menu.hidden = true
    document.activeElement?.blur() // or Space would press the button again
  }

  get adding() {
    return !this._menu.hidden
  }

  // A titled row of three number fields; a change in any hands the whole transform back.
  _group(title, unit, places, slide, axes = AXES) {
    const root = make('div', 'editor-group')
    root.append(make('span', 'editor-title', unit ? `${title}, ${unit}` : title))
    const inputs = axes.map((axis) => {
      const label = make('label', '', axis)
      const input = make('input')
      input.type = 'number'
      input.step = unit === '°' ? '5' : unit === 'm' ? '1' : '0.1'
      input.addEventListener('change', () => this._typed())
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === 'Escape') input.blur()
      })
      input.addEventListener('pointerdown', (event) => this._press(event, input, slide))
      input.addEventListener('pointermove', (event) => this._slide(event))
      input.addEventListener('pointerup', (event) => this._release(event))
      input.addEventListener('lostpointercapture', (event) => this._release(event))
      // On a Mac a press with Ctrl (to snap) is also a right click, whose menu takes the focus.
      input.addEventListener('contextmenu', (event) => this._sliding && event.preventDefault())
      label.append(input)
      root.append(label)
      return input
    })
    return { root, inputs, places }
  }

  _set({ inputs, places }, values, axes) {
    inputs.forEach((input, i) => {
      input.parentElement.hidden = !axes.includes('xyz'[i])
      if (document.activeElement !== input && this._sliding?.input !== input) input.value = shown(values[i] ?? 0, places)
    })
  }

  // A press on a field: dragged, it is a slider (Blender's); let go where it was, it is typed in.
  _press(event, input, slide) {
    if (event.button !== 0 || document.activeElement === input || !this._target) return
    event.preventDefault() // not focused yet: a drag is not a selection of its text
    input.setPointerCapture(event.pointerId)
    this._sliding = { input, slide, from: input.valueAsNumber, x: event.clientX, moved: false }
  }

  _slide(event) {
    const sliding = this._sliding
    if (!sliding || sliding.input !== event.currentTarget) return
    const px = event.clientX - sliding.x
    if (!sliding.moved) {
      if (Math.abs(px) <= SLIDE_SLOP) return
      sliding.moved = true
      this._onSlide('start')
    }
    const { slide, from } = sliding
    const steps = px * (event.shiftKey ? SLOW : 1)
    let value
    if (slide.times) value = Math.max(0.001, from * slide.times ** steps)
    else value = from + steps * (slide.by === 'metres' ? this._metresPerPixel() : slide.by)
    if (event.ctrlKey || event.metaKey) value = Math.round(value / slide.snap) * slide.snap || (slide.times ? slide.snap : 0)
    sliding.input.value = value
    const transform = this._transform()
    if (!transform) return
    this._onSlide('move', transform)
    // The other fields brought up to it now, not at the next frame: a step before then would
    // read a scale left behind as one typed, and undo the drag of the size.
    this.fill(this._target, this._name.textContent)
  }

  _release(event) {
    const sliding = this._sliding
    if (!sliding || sliding.input !== event.currentTarget) return
    this._sliding = null
    if (sliding.moved) {
      if (document.activeElement === sliding.input) sliding.input.blur() // or the editor's keys would be typed into it
      return this._onSlide('end')
    }
    sliding.input.focus()
    sliding.input.select()
  }

  _typed() {
    const transform = this._transform()
    if (transform) this._onTransform(transform)
  }

  // The fields as a transform. The scale and the size say one thing twice: the one that
  // differs from what the thing has is the one that was typed.
  _transform() {
    const target = this._target
    if (!target) return null
    const now = target.read()
    const read = ({ inputs }, fallback) => inputs.map((input, i) => (Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : fallback[i]))
    const [x, y, z] = read(this._groups.at, [now.at.x, now.at.y, now.at.z])
    const [degrees] = read(this._groups.yaw, [now.yaw * DEGREES])
    const scale = read(this._groups.scale, now.size)
    const measure = read(this._groups.size, now.size)
    const size = now.size.map((was, i) => {
      if (!target.scaled) return measure[i]
      if (shown(scale[i]) !== shown(was)) return scale[i]
      return shown(measure[i]) !== shown(was * target.own[i]) && target.own[i] > 0 ? measure[i] / target.own[i] : was
    })
    return { at: { x, y, z }, yaw: shown(degrees, 1) === shown(now.yaw * DEGREES, 1) ? now.yaw : degrees / DEGREES, size }
  }

  // The record as text, when the fold is open and nobody is typing in it.
  _fillRecord() {
    if (!this._target?.record || !this._fold.open || document.activeElement === this._record) return
    this._record.value = JSON.stringify(this._target.shown?.() ?? this._target.record, null, 1)
  }
}
