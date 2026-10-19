// The title and spoken words are scene meshes, so both go through Picture's ink,
// grading, glow and retro screen. The title has its own black scene.
import { Color, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Raycaster, Scene, Vector2, Vector3 } from 'three'
import { SaidSign } from './said-sign.js'

const MENU_DEPTH = -3
const MENU_EYE = new Vector3()

export class CourierView {
  constructor(onPick, scene, canvas, onPoint = () => {}) {
    this.onPick = onPick
    this.onPoint = onPoint
    this.canvas = canvas
    this.menuScene = new Scene()
    this.menuScene.background = new Color(0x000000)
    this.menuCamera = new PerspectiveCamera(70, 1, .1, 100)
    const black = new Mesh(new PlaneGeometry(100, 100), new MeshBasicMaterial({ color: 0x000000 }))
    black.position.z = -6
    this.menuScene.add(black)
    this.menuTitle = new SaidSign(this.menuScene, { wrap: 20, share: .09, centred: true, rise: 0 })
    this.menuChoices = [0, 1].map(() => new SaidSign(this.menuScene, { wrap: 18, share: .052, centred: true, rise: 0 }))

    this.words = new SaidSign(scene, { wrap: 26, share: .036, rise: .3 })
    this.choiceSigns = [0, 1].map(() => new SaidSign(scene, { wrap: 25, share: .029, rise: .3 }))
    this.anchor = null
    this.mode = null
    this.serial = 0
    this.pick = 0
    this.labels = []
    this.ray = new Raycaster()
    this.mouse = new Vector2()
    this.forward = new Vector3()
    this.fallback = new Vector3()
    canvas.addEventListener('click', (event) => this._click(event), true)
    // The language screen is two halves, not two small words: the mouse points at a side and
    // a click anywhere on it, or on the bare page beside the picture, takes it.
    window.addEventListener('mousemove', (event) => {
      if (this.showingLanguage) this.onPoint(this._side(event))
    })
    window.addEventListener('click', (event) => {
      if (!this.showingLanguage || event.button !== 0) return
      event.preventDefault()
      event.stopImmediatePropagation()
      this.onPick(this._side(event))
    }, true)
  }

  _side(event) {
    const rect = this.canvas.getBoundingClientRect()
    return event.clientX < rect.left + rect.width / 2 ? 0 : 1
  }

  get showingLanguage() { return this.mode === 'language' }

  resize(aspect) {
    this.menuCamera.aspect = aspect
    this.menuCamera.updateProjectionMatrix()
  }

  showLanguage(pick = 0) {
    this.mode = 'language'
    this.pick = pick
    this._clearDialogue()
    this._presentLanguage()
  }

  setLanguage(language) { this.language = language }
  setAnchor(anchor) { this.anchor = anchor ?? null }

  show({ text = '', choices = [], pick = 0 }) {
    this.mode = 'dialogue'
    this._clearMenu()
    this.serial++
    this.started = performance.now()
    this.line = text
    this.labels = choices
    this.pick = pick
  }

  present(camera, dt = 0) {
    if (this.showingLanguage) {
      this._presentLanguage(dt)
      return
    }
    if (this.mode !== 'dialogue') return
    camera.updateMatrixWorld()
    const eye = camera.position
    const at = this.anchor ?? this.fallback.copy(eye).addScaledVector(camera.getWorldDirection(this.forward), 3)
    const clear = this.anchor ? 1.1 : 0
    const typed = Math.min(this.line.length, Math.floor((performance.now() - this.started) * .04) + 1)
    this.words.show(this.line ? { id: this.serial, text: this.line, typed, at: { x: at.x, y: at.y + .65, z: at.z }, clear } : null, eye, camera.fov)
    this.choiceSigns.forEach((sign, i) => {
      const label = this.labels[i]
      sign.show(label ? {
        id: this.serial * 100 + this.pick * 10 + i,
        text: i === this.pick ? `[ ${label} ]` : label,
        typed: Infinity,
        at: { x: at.x, y: at.y + .12 - i * .36, z: at.z },
        clear,
      } : null, eye, camera.fov)
    })
    this.camera = camera
  }

  _presentLanguage(dt = 0) {
    const targetYaw = this.pick === 0 ? .11 : -.11
    this.menuCamera.rotation.y += (targetYaw - this.menuCamera.rotation.y) * Math.min(1, dt * 5)
    this.menuCamera.updateMatrixWorld()
    const fov = this.menuCamera.fov
    this.menuTitle.show({ id: 1, text: 'QUITTERS', typed: Infinity, at: { x: 0, y: .8, z: MENU_DEPTH }, clear: 0 }, MENU_EYE, fov)
    this.menuChoices.forEach((sign, i) => sign.show({
      id: 10 + this.pick * 2 + i,
      text: i === this.pick ? `[ ${i ? 'Русский' : 'English'} ]` : i ? 'Русский' : 'English',
      typed: Infinity,
      at: { x: i ? 1 : -1, y: -.45, z: MENU_DEPTH },
      clear: 0,
    }, MENU_EYE, fov))
  }

  choose(index) { this.pick = index }

  hide() {
    this.mode = null
    this._clearMenu()
    this._clearDialogue()
  }

  _clearMenu() {
    this.menuTitle.show(null)
    this.menuChoices.forEach((sign) => sign.show(null))
  }

  _clearDialogue() {
    this.words.show(null)
    this.choiceSigns.forEach((sign) => sign.show(null))
  }

  _click(event) {
    if (this.mode !== 'dialogue') return
    const camera = this.camera
    if (!camera) return
    const rect = this.canvas.getBoundingClientRect()
    this.mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2)
    this.ray.setFromCamera(this.mouse, camera)
    const signs = this.choiceSigns
    const hit = this.ray.intersectObjects(signs.map((sign) => sign.mesh).filter((mesh) => mesh.visible))[0]
    if (!hit) return
    const index = signs.findIndex((sign) => sign.mesh === hit.object)
    if (index < 0) return
    event.preventDefault()
    event.stopImmediatePropagation()
    this.onPick(index)
  }
}
