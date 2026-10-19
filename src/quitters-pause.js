// The held world and the menu words share one Picture pass, like the language screen.
import * as THREE from 'three'
import { SaidSign } from './said-sign.js'

const WORDS = {
  en: { resume: 'resume', sound: 'sound', rate: 'rate game ★', quit: 'quit', musicOn: 'music on', musicOff: 'music off', volume: 'volume', sensitivity: 'sensitivity', confirm: 'quit game?', yes: 'yes', no: 'no', gap: ' ' },
  ru: { resume: 'продолжить', sound: 'звук', rate: 'оценить игру ★', quit: 'выйти', musicOn: 'музыка вкл.', musicOff: 'музыка выкл.', volume: 'громкость', sensitivity: 'чувствительность', confirm: 'выйти из игры?', yes: 'да', no: 'нет', gap: '\u2009' },
}
// The brackets round a picked word sit a thin space from it in Russian: a full space there
// read as loose (the owner, 2026-10-19).
const bracket = (words, text) => `[${words.gap}${text}${words.gap}]`
const WHITE = '#f4f1ea'
const YELLOW = '#ffd24a'
const RED = '#ff564d'
// How much brighter than its ink each word is lit, so the picture's glow haloes it: soft for
// the words, more for what is picked or warns (the owner, 2026-10-19: the glow was too harsh).
const GLOW = 1.15
const LIT = 1.25
const ALARM = 1.8
const EYE = new THREE.Vector3()
const DEPTH = -4
const sign = (scene, share = .045) => new SaidSign(scene, { wrap: 36, share, centred: true, rise: 0 })

function curvedScreen(width, height) {
  const geometry = new THREE.PlaneGeometry(width, height, 40, 24)
  const points = geometry.attributes.position
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i) / (width / 2)
    const y = points.getY(i) / (height / 2)
    points.setZ(i, .2 * Math.max(0, 1 - x * x - y * y))
  }
  points.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

export class QuittersPause {
  constructor(canvas, onAction) {
    this.canvas = canvas
    this.onAction = onAction
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0)
    this.camera = new THREE.PerspectiveCamera(70, 1, .1, 100)
    const black = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({ color: 0 }))
    black.position.z = -8
    this.scene.add(black)
    this.preview = new THREE.WebGLRenderTarget(1024, 640)
    this.frame = new THREE.Mesh(curvedScreen(5.58, 3.54), new THREE.MeshBasicMaterial({ color: 0x111318 }))
    this.frame.position.set(0, .85, -5.05)
    this.scene.add(this.frame)
    this.screen = new THREE.Mesh(curvedScreen(5.44, 3.4), new THREE.MeshBasicMaterial({ map: this.preview.texture, toneMapped: false }))
    this.screen.position.set(0, .85, -5)
    this.scene.add(this.screen)
    this.main = [0, 1, 2, 3].map(() => sign(this.scene, .046))
    this.details = Object.fromEntries(['music', 'volume', 'volumeMinus', 'volumePlus', 'look', 'lookMinus', 'lookPlus', 'confirm', 'yes', 'no'].map((name) => [name, sign(this.scene, .032)]))
    this.words = WORDS.en
    this.pick = 0
    this.confirming = false
    this.confirmPick = 1
    this.inSoundControls = false
    this.soundControlPick = 0
    this.opened = false
    this.dirty = true
    this.ray = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    canvas.addEventListener('click', (event) => this._click(event), true)
  }

  resize(aspect) {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
    this.preview.setSize(1024, Math.round(1024 / aspect))
    this.screen.geometry.dispose()
    this.screen.geometry = curvedScreen(3.4 * aspect, 3.4)
    this.frame.geometry.dispose()
    this.frame.geometry = curvedScreen(3.4 * aspect + .14, 3.54)
    this.dirty = true
  }

  open(language, music, volume, look) {
    this.words = WORDS[language] ?? WORDS.en
    this.music = music
    this.volume = volume
    this.look = look
    this.pick = 0
    this.confirming = false
    this.confirmPick = 1
    this.inSoundControls = false
    this.soundControlPick = 0
    this.opened = true
    this.dirty = true
    this.present()
  }

  choose(index) { this.pick = index; this.present() }
  enterSoundControls() { this.inSoundControls = true; this.soundControlPick = 0; this.present() }
  leaveSoundControls() { this.inSoundControls = false; this.present() }
  stepSoundControl(direction) {
    this.soundControlPick = THREE.MathUtils.clamp(this.soundControlPick + Math.sign(direction), 0, 2)
    this.present()
  }
  confirm(pick = 1) { this.confirming = true; this.confirmPick = pick; this.present() }
  chooseConfirm(index) { this.confirmPick = index; this.present() }
  cancelConfirm() { this.confirming = false; this.present() }
  setMusic(value) { this.music = value; this.present() }
  setVolume(value) { this.volume = value; this.present() }
  setLook(value) { this.look = value; this.present() }

  close() {
    this.opened = false
    this.inSoundControls = false
    for (const item of [...this.main, ...Object.values(this.details)]) item.show(null)
  }

  _show(item, id, value, x, y, ink = WHITE, glow = GLOW) {
    item.setInk(ink, glow)
    item.show(value ? { id, text: value, typed: Infinity, at: { x, y, z: DEPTH }, clear: 0 } : null, EYE.set(x, y, 0), this.camera.fov)
  }

  present() {
    if (!this.opened) return
    const w = this.words
    const labels = [w.resume, w.rate, w.sound, w.quit]
    const positions = [-3.05, -1.25, 1.05, 3.15]
    this.main.forEach((item, index) => {
      const selected = this.pick === index
      const ink = index === 1 ? YELLOW : index === 3 && (selected || this.confirming) ? RED : WHITE
      this._show(item, index * 10 + Number(selected), selected ? bracket(w, labels[index]) : labels[index], positions[index], -1.25, ink, index === 3 && selected ? ALARM : GLOW)
    })
    const d = this.details
    const sound = this.pick === 2 && !this.confirming
    // A column under the row: volume, sensitivity, then music.
    const picked = (index) => this.inSoundControls && this.soundControlPick === index
    const control = (index, value) => sound && picked(index) ? bracket(w, value) : value
    this._show(d.volume, 21 + this.volume.step + 20 * Number(picked(0)), sound ? control(0, `${w.volume} ${this.volume.step}/${this.volume.steps}`) : '', 0, -1.75, picked(0) ? YELLOW : WHITE, LIT)
    this._show(d.volumeMinus, 22, sound ? '−' : '', -2.15, -1.75)
    this._show(d.volumePlus, 23, sound ? '+' : '', 2.15, -1.75)
    this._show(d.look, 24 + this.look.step + 20 * Number(picked(1)), sound ? control(1, `${w.sensitivity} ${this.look.step + 1}/${this.look.steps}`) : '', 0, -2.12, picked(1) ? YELLOW : WHITE, LIT)
    this._show(d.lookMinus, 25, sound ? '−' : '', -2.15, -2.12)
    this._show(d.lookPlus, 26, sound ? '+' : '', 2.15, -2.12)
    this._show(d.music, 20 + Number(this.music) + 2 * Number(picked(2)), sound ? control(2, this.music ? w.musicOn : w.musicOff) : '', 0, -2.49, picked(2) ? YELLOW : WHITE, LIT)
    this._show(d.confirm, 30, this.confirming ? w.confirm : '', 0, -1.75, RED, LIT)
    this._show(d.yes, 31 + Number(this.confirmPick === 0), this.confirming ? this.confirmPick === 0 ? bracket(w, w.yes) : w.yes : '', -.65, -2.12, RED, this.confirmPick === 0 ? ALARM : GLOW)
    this._show(d.no, 33 + Number(this.confirmPick === 1), this.confirming ? this.confirmPick === 1 ? bracket(w, w.no) : w.no : '', .65, -2.12)
  }

  _click(event) {
    if (!this.opened) return
    const rect = this.canvas.getBoundingClientRect()
    this.mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2)
    this.ray.setFromCamera(this.mouse, this.camera)
    const entries = this.confirming
      ? [[this.details.yes, 'yes'], [this.details.no, 'no']]
      : [
          ...this.main.map((item, index) => [item, index]),
          [this.details.music, 'music'], [this.details.volumeMinus, 'volume-'], [this.details.volumePlus, 'volume+'],
          [this.details.lookMinus, 'look-'], [this.details.lookPlus, 'look+'],
        ]
    const hit = this.ray.intersectObjects(entries.map(([item]) => item.mesh).filter((mesh) => mesh.visible))[0]
    if (!hit) return
    const action = entries.find(([item]) => item.mesh === hit.object)?.[1]
    if (action === undefined) return
    event.preventDefault()
    event.stopImmediatePropagation()
    this.onAction(action)
  }
}
