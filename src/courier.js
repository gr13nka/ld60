// The Courier's route. Dialogue and choices are held frames; walking to a place's named spots
// is the only way into its scenes. Until the builders place supplies those spots, the same
// script can be read straight through for editorial review.
import { COURIER_SCENES, COURIER_WORDS, courierEnding, courierScene } from './courier-script.js'
import { CourierView } from './courier-view.js'

const NEXT_FREE = COURIER_SCENES.findIndex((scene) => scene.id === 'grille-three')
const REACH = 4

function near(a, b) {
  if (!b) return false
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz <= (b.radius ?? REACH) ** 2
}

export class CourierStory {
  constructor(input, place, onEvent = () => {}, presentation) {
    this.input = input
    this.onEvent = onEvent
    this.spots = place.courier?.spots ?? null
    /** Set by the game: true while a scene due at its spot should wait (someone there is still busy). */
    this.waits = () => false
    this.preview = !this.spots
    this.view = new CourierView((index) => {
      this.clicked = index
      if (this.card === 'language') this.input.capture()
    }, presentation.scene, presentation.canvas, (index) => {
      if (this.card !== 'language' || this.pick === index) return
      this.pick = index
      this.view.choose(index)
    })
    this.language = null
    this.sceneIndex = 0
    this.seen = new Set()
    this.matches = 42
    this.gaveMatch = false
    this.procedure = false
    this.parcelLeft = false
    this.offRoute = false
    this.radioTime = 0
    this.radioIndex = 0
    this.ending = null
    this.leverResult = false
    this.beats = []
    this.beat = 0
    this.pick = 0
    this.clicked = null
    this.card = 'language'
    this._showLanguage()
  }

  get holding() { return this.card !== null }

  /**
   * The spot the route sends him to next, by name, or null when the story names no one place:
   * before a language, after an ending, and off the route, where the way to the works is his to
   * find and is never given away. In the third act's free part only the roof is the route; the
   * scenes on the way are his to happen upon.
   */
  get destination() {
    if (!this.language || this.ending || this.offRoute || !this.spots) return null
    if (this.sceneIndex < NEXT_FREE) return COURIER_SCENES[this.sceneIndex].spot
    const last = COURIER_SCENES.at(-1)
    return this.seen.has(last.id) ? null : last.spot
  }

  snapshot() {
    return {
      language: this.language,
      sceneIndex: this.sceneIndex,
      seen: [...this.seen],
      matches: this.matches,
      gaveMatch: this.gaveMatch,
      procedure: this.procedure,
      parcelLeft: this.parcelLeft,
      offRoute: this.offRoute,
      radioTime: this.radioTime,
      radioIndex: this.radioIndex,
      ending: this.ending,
    }
  }

  restore(saved) {
    if (!saved || !['en', 'ru'].includes(saved.language)) return
    this.language = saved.language
    this.view.setLanguage(this.language)
    this.sceneIndex = Math.max(0, Math.min(COURIER_SCENES.length, saved.sceneIndex | 0))
    this.seen = new Set(Array.isArray(saved.seen) ? saved.seen : [])
    this.matches = Number.isFinite(saved.matches) ? saved.matches : 42
    this.gaveMatch = !!saved.gaveMatch
    this.procedure = !!saved.procedure
    this.parcelLeft = !!saved.parcelLeft
    this.offRoute = !!saved.offRoute
    this.radioTime = Number.isFinite(saved.radioTime) ? saved.radioTime : 0
    this.radioIndex = Number.isInteger(saved.radioIndex) ? saved.radioIndex : 0
    this.ending = saved.ending ?? null
    this._resume()
  }

  restart() {
    this.sceneIndex = 0
    this.seen.clear()
    this.matches = 42
    this.gaveMatch = false
    this.procedure = false
    this.parcelLeft = false
    this.offRoute = false
    this.radioTime = 0
    this.radioIndex = 0
    this.ending = null
    this._resume()
  }

  _showLanguage() {
    this.input.release()
    this.view.showLanguage(this.pick)
  }

  _showBeat() {
    if (this.leverResult) {
      this.view.show({ choices: [COURIER_WORDS[this.language].next] })
      return
    }
    while (this.beat < this.beats.length &&
      (!this._allowed(this.beats[this.beat]) || (!this.beats[this.beat].speaker && !this.beats[this.beat].choice))) this.beat++
    if (this.beat >= this.beats.length) return this._finishedCard()
    const beat = this.beats[this.beat]
    const w = COURIER_WORDS[this.language]
    const choices = beat.choice === 'procedure' ? [w.procedure, w.silent]
      : beat.choice === 'match' ? [w.give, w.refuse]
        : beat.choice === 'lever' ? [w.lever, w.next] : [w.next]
    this.pick = 0
    this.view.show({ text: beat.speaker ? beat.text ?? '' : '', choices, pick: 0 })
  }

  _allowed(beat) {
    if (beat.when === 'procedure') return this.procedure
    if (beat.when === 'give') return this.gaveMatch
    if (beat.when === 'refuse') return !this.gaveMatch
    return true
  }

  _openScene(index) {
    const entry = COURIER_SCENES[index]
    const scene = courierScene(entry.id, this.language)
    this.view.setAnchor(this.spots?.[entry.spot])
    if (entry.id === 'raccoon-one' && !this.seen.has(entry.id)) {
      this.matches--
      this.onEvent('match', true)
    }
    if (entry.id === 'sorting-three') this.matches = 42
    this.sceneIndex = index
    this.heading = `${COURIER_WORDS[this.language].act} ${scene.act} · ${scene.title}`
    this.beats = scene.beats
    this.beat = 0
    this.leverResult = false
    this.card = 'scene'
    this.onEvent('scene', entry.id)
    this.input.release()
    this._showBeat()
  }

  _openEnding(kind) {
    if (kind === 'hidden') this.view.setAnchor(this.spots?.works)
    this.ending = kind
    this.heading = kind === 'ordinary' ? (this.language === 'ru' ? 'Продолжать' : 'Carry on') : (this.language === 'ru' ? 'Сойти с маршрута' : 'Off the route')
    this.beats = courierEnding(kind, this.language).filter((beat) => kind !== 'hidden' || !/RAVEN|Ворон|One minute later|Another minute|Через минуту|Ещё через минуту/.test(`${beat.speaker ?? ''} ${beat.text ?? ''}`))
    this.beat = 0
    this.leverResult = false
    this.card = 'ending'
    this.input.release()
    this._showBeat()
  }

  _finishedCard() {
    if (this.card === 'ending') {
      this.card = 'end'
      this.view.show({ choices: [COURIER_WORDS[this.language].again] })
      return
    }
    if (this.card === 'scene') {
      const scene = COURIER_SCENES[this.sceneIndex]
      this.seen.add(scene.id)
      if (scene.id === 'roof-evening-three') {
        this.card = 'parcel'
        this.view.show({ choices: [COURIER_WORDS[this.language].open, COURIER_WORDS[this.language].leave] })
        return
      }
      if (this.sceneIndex < NEXT_FREE) this.sceneIndex++
    }
    if (this.card === 'radio') return this._resume()
    this._resume()
    if (this.preview && !this.ending) this._previewNext()
  }

  _resume() {
    this.card = null
    this.view.hide()
    this.input.capture() // also lets the next picture click recapture after a card let the mouse go
  }

  _previewNext() {
    if (this.sceneIndex >= NEXT_FREE) {
      const next = COURIER_SCENES.slice(NEXT_FREE).findIndex((scene) => !this.seen.has(scene.id))
      if (next < 0) return
      this.sceneIndex = NEXT_FREE + next
    }
    this._openScene(this.sceneIndex)
  }

  _openRadio(index) {
    this.view.setAnchor(null)
    const lines = courierEnding('hidden', this.language).filter((beat) => /RAVEN|Ворон/.test(beat.speaker ?? ''))
    this.heading = this.language === 'ru' ? 'Рация' : 'Radio'
    this.beats = [lines[index]]
    this.beat = 0
    this.card = 'radio'
    this.input.release()
    this._showBeat()
  }

  _choose(index) {
    if (this.leverResult) {
      this.leverResult = false
      this._showBeat() // the lever remains where it was; it can be pulled again
      return
    }
    if (this.card === 'language') {
      this.language = index === 1 ? 'ru' : 'en'
      this.view.setLanguage(this.language)
      if (this.preview) this._openScene(0)
      else this._resume()
      return
    }
    if (this.card === 'end') {
      this.seen.clear()
      this.sceneIndex = 0
      this.ending = null
      this.parcelLeft = false
      this.offRoute = false
      this.radioTime = 0
      this.radioIndex = 0
      this.matches = 42
      this._resume()
      this.onEvent('restart')
      if (this.preview) this._openScene(0)
      return
    }
    if (this.card === 'parcel') {
      if (index === 0) this._openEnding('ordinary')
      else { this.parcelLeft = true; this._resume() }
      return
    }
    const beat = this.beats[this.beat]
    if (beat.choice === 'lever' && index === 0) {
      this.leverResult = true
      this._showBeat()
      return
    }
    if (beat.choice === 'procedure') this.procedure = index === 0
    if (beat.choice === 'match') {
      this.gaveMatch = index === 0 && this.matches > 0
      if (this.gaveMatch) this.matches--
      this.onEvent('match', this.gaveMatch)
    }
    this.beat++
    this._showBeat()
  }

  // Returns true when the story owns this step. Its UI clicks are queued until here, so the
  // game remains the sole owner of a choice's result, just like every other menu.
  step(dt, controls, position) {
    if (this.card) {
      if (controls.menuStep || controls.menuTurn) {
        const count = this.card === 'language' || this.card === 'parcel' || this.beats[this.beat]?.choice ? 2 : 1
        this.pick = Math.max(0, Math.min(count - 1, this.pick + (controls.menuStep || controls.menuTurn)))
        this.view.choose(this.pick)
      }
      const advance = controls.confirm || (this.card !== 'language' && (controls.strayClick || controls.interact))
      const chosen = this.clicked ?? (advance ? this.pick : null)
      this.clicked = null
      if (chosen !== null) this._choose(chosen)
      return true
    }
    if (!this.language || this.ending) return false
    if (this.offRoute) {
      this.radioTime += dt
      if (this.radioIndex < 3 && this.radioTime >= this.radioIndex * 60) {
        this._openRadio(this.radioIndex++)
        return true
      }
      if (near(position, this.spots?.works)) {
        this._openEnding('hidden')
        return true
      }
      return false
    }
    const ready = this.sceneIndex < NEXT_FREE ? COURIER_SCENES[this.sceneIndex] : null
    if (ready && near(position, this.spots?.[ready.spot]) && !this.waits(ready.id)) {
      this._openScene(this.sceneIndex)
      return true
    }
    if (this.sceneIndex >= NEXT_FREE) {
      if (near(position, this.spots?.offRoute)) {
        this.offRoute = true
        this.radioTime = 0
        this.radioIndex = 0
        this._openRadio(this.radioIndex++)
        return true
      }
      for (let i = NEXT_FREE; i < COURIER_SCENES.length; i++) {
        const scene = COURIER_SCENES[i]
        if (this.seen.has(scene.id) || !near(position, this.spots?.[scene.spot])) continue
        this._openScene(i)
        return true
      }
    }
    return false
  }
}
