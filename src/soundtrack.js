// The score is the songs in `sounds/songs` (each brought to one loudness by
// scripts/music/add-song.py), played in a shuffled order: each fades in, fades out at its end, and
// a short silence passes before the next. It is silent until `begin`: the story lets it in once the
// gull's scene is over, rising slowly. The world's few sounds (`effect`) share its volume. Keep
// its setting separate from story progress so a restart or a visit to the lineup does not turn the
// player's sound back on.
const KEY = 'quitters.sound.v1'
const STEPS = 6
const SONGS = Object.values(import.meta.glob('./sounds/songs/*.mp3', { eager: true, query: '?url', import: 'default' }))
// The music's share of the volume, set against the world's sounds: a song at -16 LUFS sits at
// about -22, under a chirr heard close by (`CHIRR_LOUDNESS` in quitters-game.js).
const MUSIC_LEVEL = 0.5
const FADE_IN = 2 // seconds, also when the music is turned back on mid-song
const ENTRANCE = 10 // seconds the first song takes to rise when the music is let in
const FADE_OUT = 4 // seconds before a song's end
const SILENCE = [3, 7] // seconds between songs, least and most

function remembered() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    return {
      music: saved?.music !== false,
      volume: Number.isInteger(saved?.volume) ? Math.max(0, Math.min(STEPS, saved.volume)) : 4,
    }
  } catch { return { music: true, volume: 4 } }
}

export class Soundtrack {
  constructor() {
    const saved = remembered()
    this.music = saved.music
    this.volume = saved.volume
    this.track = new Audio()
    this.track.preload = 'none'
    this._dealt = [] // songs still to come before the order is shuffled again
    this._resting = false // between two songs
    this._held = true // not let in yet (`begin`), or held back again (`hold`)
    this._heldFrom = -Infinity // when it was held back, for its fade out
    this._rise = FADE_IN // the fade in of the next start
    this._heardFrom = 0 // when the track last began to sound, for its fade in
    this.track.addEventListener('playing', () => { this._heardFrom = performance.now() })
    this.track.addEventListener('ended', () => { this._rise = FADE_IN; this._rest() })
    this._cue()
    this._apply()
    setInterval(() => this._shape(), 50)
    // Audio starts on the next real press the browser permits, including the language pick.
    const wake = () => this._play()
    window.addEventListener('pointerdown', wake)
    window.addEventListener('keydown', wake)
  }

  get volumeShown() { return { step: this.volume, steps: STEPS } }

  setMusic(music) {
    this.music = music
    this._apply()
    if (music) this._play()
    this._remember()
  }

  changeVolume(direction) {
    this.volume = Math.max(0, Math.min(STEPS, this.volume + Math.sign(direction)))
    this._apply()
    if (this.volume > 0) this._play()
    this._remember()
  }

  /** Lets the music in, its first song rising over `rise` seconds. */
  begin(rise = ENTRANCE) {
    if (!this._held) return
    this._held = false
    this._rise = rise
    this._play()
  }

  /** Fades the music out and keeps it silent until `begin`, as before the story's first scene. */
  hold() {
    if (this._held) return
    this._held = true
    this._heldFrom = performance.now()
  }

  /** Plays `url` once at `loudness` (0 to 1) of the volume: a sound of the world, heard with the music off. */
  effect(url, loudness = 1) {
    if (this.volume === 0 || loudness <= 0) return
    const sound = new Audio(url)
    sound.volume = Math.min(1, this.volume / STEPS * loudness)
    sound.play().catch(() => {})
  }

  // The next song of a shuffled order, never the one just heard twice in a row.
  _cue() {
    if (SONGS.length === 0) return
    if (this._dealt.length === 0) {
      this._dealt = [...SONGS].sort(() => Math.random() - 0.5)
      if (this._dealt.length > 1 && this._dealt[0] === this.track.getAttribute('src')) this._dealt.push(this._dealt.shift())
    }
    this.track.src = this._dealt.shift()
  }

  _rest() {
    this._resting = true
    const [least, most] = SILENCE
    setTimeout(() => {
      this._resting = false
      if (this._held) return // cued at the hold
      this._cue()
      this._play()
    }, (least + Math.random() * (most - least)) * 1000)
  }

  // The fades, from where the song is, how long it has been sounding and since when it is held.
  _shape() {
    const { track } = this
    if (track.paused) return
    const now = performance.now()
    const fadeIn = (now - this._heardFrom) / 1000 / this._rise
    const fadeOut = Number.isFinite(track.duration) ? (track.duration - track.currentTime) / FADE_OUT : 1
    const held = this._held ? 1 - (now - this._heldFrom) / 1000 / FADE_IN : 1
    if (held <= 0) { track.pause(); this._cue(); return } // a fresh song when it is let in again
    track.volume = this.volume / STEPS * MUSIC_LEVEL * Math.max(0, Math.min(1, fadeIn, fadeOut, held))
  }

  _apply() {
    if (!this.music || this.volume === 0) this.track.pause()
    this._shape()
  }

  _play() {
    if (this.music && this.volume > 0 && !this._held && !this._resting && this.track.paused && this.track.src) {
      this.track.volume = 0
      this.track.play().catch(() => {})
    }
  }

  _remember() {
    try { localStorage.setItem(KEY, JSON.stringify({ music: this.music, volume: this.volume })) } catch { /* play continues */ }
  }
}
