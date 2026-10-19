// The place editor (`&edit` with `?parkour=…`, dev only), after Blender: E lets the pointer go
// and the game hold still; WASD fly, the view is turned about a pivot with the middle button, a thing is
// clicked, then moved, turned and sized with G, R and T or by its numbers in the panel, and
// Ctrl+S writes the place back to its file (`vite.config.js` takes the POST).
//
// A live asset (`assets.js`) picked shows its builder's parameters in the panel, each a field of
// its kind, the building made again as one is changed; its values can be made the builder's own
// defaults, written into the builder's source (`asset-source.js`). Tab on it is Blender's edit
// mode: its parts are picked and changed one by one, and kept in the instance (`asset-parts.js`).
//
// This is the editor's doing: what is picked, what a key means, what is kept to be undone.
// The rest is asked of others. The eye is `editor-view.js`; a move in hand is
// `editor-grab.js`; what a record's words mean is `editor-things.js`, to which every kind is
// one target; what is shown is `editor-panel.js`. It never builds a mesh of the place's: it
// changes the place's lists and asks the world to stand a thing again (`ParkourWorld.restand`).
// Its own are the gizmo, the box round the pick, and a ball for each point of a path.

import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { Grab, pivoted } from './editor-grab.js'
import { EditorPanel } from './editor-panel.js'
import { seenIn } from './editor-seen.js'
import { copiesOf, groupOf, hasPoints, meshesOf, partOf, partPickables, partsUnder, pickables, pointOf, pointsOf, recordsUnder, setParam, targetOf } from './editor-things.js'
import { KNOWN } from './places.js'
import { EYE as EYES } from './foot-view.js'
import { EditorView } from './editor-view.js'
import { PRESETS } from './forms.js'
import { ASSETS, assetDefaults, assetParts, freshTag, strayParts } from './assets.js'
import { dropPart } from './asset-parts.js'
import { readDefaults, writeDefaults } from './asset-source.js'
import { SUBJECTS } from './murals.js'
import { EDITABLE_LISTS, LISTS, checkPlace, nextFormId, placePath, recordProblem, savePlace } from './place-file.js'

const KEY = 'quitters.editor' // what survives the page reload a save brings
const EYE = EYES.standing // the body's eye over its feet (`foot-view.js`); `placeView` is given the feet
const HISTORY = 200
const CLICK_SLOP = 4 // pixels a press may move and still be a click
const GLOW = 0x335533 // a picked form's own light
const PICKED = 0xff9a2e // the box round the pick: Blender's orange
const POINT = { color: 0xffc840, picked: 0xffffff, seen: 0.012 } // a path's point; its radius, as a share of how far off it is
// Blender's S is T: WASD fly at all times, as a game's keys do, so S is taken.
const OPS = { KeyG: 'move', KeyR: 'turn', KeyT: 'size' }
const FLY_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'Space'])
const GIZMO = { move: 'translate', turn: 'rotate', size: 'scale' }
const AXES = { KeyX: 'x', KeyY: 'y', KeyZ: 'z' }
const LIST_LABEL = Object.fromEntries(EDITABLE_LISTS.map((list) => [list, LISTS[list].noun]))
const EDITING = 'editing' // on the page's body while the editor has the world: the game's own overlay is out of the way
// Blender's numpad, and the top row for a keyboard that has none.
const VIEW_KEYS = { 1: ['front', 'back'], 3: ['right', 'left'], 7: ['top', 'bottom'] }
const STEP_KEYS = { 4: [-1, 0], 6: [1, 0], 8: [0, 1], 2: [0, -1] }
const KEYS = {
  idle: 'WASD fly · Space up · Shift+Space or Q down · right-drag look · wheel zoom · middle-drag orbit · Shift pan · click pick (an asset whole, again a part) · drag box-pick (Shift adds, Ctrl takes off) · Shift+click add or drop · G R T move turn size · Tab parts of an asset · Shift+A add · Shift+D copy · X delete · Ctrl+Z undo · . frame · P start here · N panel · Ctrl+S save · E leave',
  parts: 'click a part (again: the one behind) · drag box-pick · Shift+click add or drop · G R T move turn size · X take away · Ctrl+Z undo · . frame · Ctrl+S save · Tab or Esc back to the building',
  grab: 'X Y Z axis (Shift: the other two) · type a number · Ctrl snap · Shift slow · click or Enter keeps · right-click or Esc puts back',
  points: 'click a point · G move it · Tab or Esc back to the form',
  fly: 'mouse looks · WASD fly · Space up · Shift+Space or Q down · wheel speed',
}

// How many of each kind `targets` are: '3 forms, 1 box'.
function counted(targets) {
  const by = new Map()
  for (const { list, part } of targets) {
    const kind = part ? 'parts' : list
    by.set(kind, (by.get(kind) ?? 0) + 1)
  }
  return [...by].map(([list, n]) => `${n} ${n === 1 ? (LIST_LABEL[list] ?? 'part') : list}`).join(', ')
}

// Whether two picks are the same thing: one record, and the same part of it if an asset's.
const same = (a, b) => a?.record === b?.record && a?.part === b?.part

// What a parameter may be chosen from, if it is a word or a list of words: a mural's subject, a
// paint's look, or for a list the words its default lists (SESC's `uses`). Null for the rest.
function choicesFor(fallback, looks) {
  const words = typeof fallback === 'string' ? [fallback] : Array.isArray(fallback) && fallback.length > 0 && fallback.every((w) => typeof w === 'string') ? fallback : null
  if (!words) return null
  if (words.every((w) => SUBJECTS.includes(w))) return SUBJECTS
  if (words.every((w) => looks.includes(w))) return looks
  return Array.isArray(fallback) ? [...new Set(fallback)] : null
}

const typing = (target) => target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement
const snapshot = (record) => JSON.stringify(record)
// `record` made to hold exactly what `text` says, and still the same record: the lists, the world's
// meshes and the picked target all know it by itself, so a change is made in place, never by swapping a new one in.
function keepIdentity(record, text) {
  for (const key of Object.keys(record)) delete record[key]
  return Object.assign(record, JSON.parse(text))
}

export class Editor {
  /** `game` stands in a `ParkourWorld`; `renderer` is what draws it. */
  constructor(game, renderer) {
    this.game = game
    const canvas = (this.canvas = renderer.domElement)
    this._renderer = renderer // a box select draws the place once more, off the screen
    game.world.keepFormsApart() // a form is picked and stood again by itself (a no-op if the world was started with `formsApart`)
    /** Whether the editor has the world: the view is its, the game held still. */
    this.on = false
    this._view = new EditorView()
    this._keysDown = new Set() // key codes down
    this._drag = null // what a held button is doing to the view: 'orbit', 'pan', 'zoom' or 'fly'
    this._press = null // the left button's press on the canvas, until it is let up
    this._pointer = { x: 0, y: 0, snap: false, slow: false } // where the pointer last was, on the page
    this._last = 0
    this._picked = null // the target picked (`editor-things.js`): one thing, a group of them (`groupOf`), or null
    this._point = null // which point of its path is in hand, while its points are shown
    this._pointTarget = null // that point as a target, kept while it is the one in hand (`_active`)
    this._pointing = false // its path's points are shown (Tab)
    this._grab = null // the move, turn or size in hand
    this._op = 'move' // the last of them asked for: the gizmo's list
    this._before = null // each record the pick changes as it was when a change began: [{ list, record, before }], the text
    this._inside = null // the live asset whose parts are in hand (Tab), or null
    this._rebuild = false // a parameter is being dragged: the building is made again at each frame of it
    this._said = new Map() // each builder's parameters as its source says them (`readDefaults`), by its name, once asked
    this._plain = new Map() // each picked form's mesh → its own paint, while it wears the glow
    this._carried = null // what a drag carries (a group's meshes, an asset's group) → where it stood
    this._carriedFrom = null // the transform of what is carried when the drag began
    this._glows = new Map() // paint → its glowing copy
    this._lit = new WeakSet() // the glowing copies, so one is never copied again
    this._dirty = false // the picked thing has changed and wants standing again
    this._undoStack = [] // changes that can be undone, each a list of { list, record, index, before, after }: a group's are one
    this._redoStack = []
    this._balls = []

    this._proxy = new THREE.Object3D() // what the gizmo holds, at the pivot of what is in hand
    this._gizmoStart = null // { start, pivot }: the transform and the pivot the gizmo began from
    this._points = new THREE.Group()
    this._outline = new THREE.Group() // a box round each thing picked, stood and turned as it is
    this._boxHolders = [] // those boxes, each in a holder; as many as the most ever picked
    this._outline.visible = false
    const controls = (this._controls = new TransformControls(game.view.camera, canvas))
    controls.enabled = false
    controls.addEventListener('objectChange', () => this._gizmoMoved())
    controls.addEventListener('dragging-changed', ({ value }) => (value ? this._begin() : this._keep()))

    this._panel = new EditorPanel({
      presets: Object.keys(PRESETS),
      assets: Object.keys(ASSETS),
      onTransform: (transform) => this._change(() => this._active.write(transform)),
      onRecord: (text) => this._retype(text),
      onAdd: (name) => (name in ASSETS ? this._createAsset(name) : this._create(name)),
      onSlide: (phase, transform) => this._slid(phase, transform),
      onParam: (phase, key, value) => this._param(phase, key, value),
      onDefaults: () => this._makeDefaults(),
      onParts: () => this._putPartsBack(),
      metresPerPixel: () => this._view.metresPerPixel(this.game.view.camera.fov, this.canvas.clientHeight),
    })
    window.addEventListener('keydown', (event) => this._keyDown(event))
    window.addEventListener('keyup', (event) => this._keyUp(event))
    window.addEventListener('blur', () => {
      this._keysDown.clear()
      this._drag = null
    })
    window.addEventListener('pointermove', (event) => this._move(event))
    window.addEventListener('pointerup', (event) => this._up(event))
    canvas.addEventListener('pointerdown', (event) => this._down(event))
    canvas.addEventListener('wheel', (event) => this._wheel(event), { passive: false })

    const kept = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    if (kept) this._restore(kept)
  }

  /** Leaves editing and takes every trace of the editor out of the page and the scene. */
  dispose() {
    this._leave()
    this._controls.dispose()
    this._panel.dispose()
  }

  // --- Coming and going ---

  _enter(view) {
    const { game } = this
    game.input.release()
    game.editing = true
    this.on = true
    if (view) this._view.restore(view)
    else this._view.lookFrom({ x: game.body.pos.x, y: game.body.pos.y + EYE, z: game.body.pos.z }, game.lookYaw, game.lookPitch)
    game.scene.add(this._controls.getHelper(), this._proxy, this._points, this._outline)
    this._controls.enabled = true
    const { file } = game.world
    this._panel.file = file ? placePath(file) : '(made in code: nothing here is saved)'
    this._panel.on = true
    document.body.classList.add(EDITING)
    this._panel.say('')
    this._pick(null)
    this._last = performance.now()
    this._raf = requestAnimationFrame((now) => this._frame(now))
  }

  _leave() {
    if (!this.on) return
    if (this._grab) this._putBack()
    this._pick(null)
    if (this._inside) this._leaveParts(false)
    cancelAnimationFrame(this._raf)
    this.on = false
    this._drag = null
    this._press = null
    this._keysDown.clear()
    this._controls.enabled = false
    this.game.scene.remove(this._controls.getHelper(), this._proxy, this._points, this._outline)
    this._panel.on = false
    document.body.classList.remove(EDITING)
    this.game.editing = false
    this.game.input.capture() // the body stays where the eye was: that is the teleport
  }

  _restore(kept) {
    try {
      const { view, picked, inside } = JSON.parse(kept)
      this._enter(view)
      if (this._place.assets[inside]) this._enterParts(this._place.assets[inside])
      const things = (Array.isArray(picked) ? picked : []).map(({ list, index, part }) => ({ list, record: this._place[list]?.[index], part }))
      this._pickMany(things.filter(({ record }) => record))
    } catch {
      // A note that cannot be read is only not followed.
    }
  }

  // --- The frame ---

  _frame(now) {
    if (!this.on) return
    const dt = Math.min((now - this._last) / 1000, 0.1)
    this._last = now
    // Not with a move in hand or the add menu open. With Shift down Space goes down, and WASD
    // stand still: Shift+A and Shift+D are commands.
    const held = (code) => (this._keysDown.has(code) ? 1 : 0)
    if (!this._grab && !this._panel.adding) {
      const shift = held('ShiftLeft') || held('ShiftRight')
      const flat = shift ? 0 : 1
      const up = Math.max(-1, Math.min(1, held('Space') * (shift ? -1 : 1) - held('KeyQ')))
      this._view.fly(dt, (held('KeyW') - held('KeyS')) * flat, (held('KeyD') - held('KeyA')) * flat, up)
    }
    const { eye, yaw, pitch } = this._view.pose()
    this.game.placeView(new THREE.Vector3(eye.x, eye.y - EYE, eye.z), yaw, pitch)
    if (this._dirty) this._restand()
    // A point's ball is as big on the screen wherever it is.
    for (const ball of this._balls) ball.scale.setScalar(Math.max(0.2, ball.position.distanceTo(eye) * POINT.seen))
    this._raf = requestAnimationFrame((time) => this._frame(time))
  }

  // --- The pointer ---

  _down(event) {
    if (!this.on) return
    this._track(event)
    if (this._grab) {
      if (event.button === 0) this._keep()
      else if (event.button === 2) this._putBack()
      return
    }
    this._panel.closeAdd()
    // The gizmo's own listener ran first: if it took the press, this one is its drag.
    const gizmo = this._controls.dragging
    const middle = event.button === 1 || (event.button === 0 && event.altKey && !gizmo) // Alt is for a mouse with no wheel button
    if (middle) {
      event.preventDefault()
      this._drag = event.shiftKey ? 'pan' : event.ctrlKey ? 'zoom' : 'orbit'
    } else if (event.button === 2) {
      this._drag = 'fly'
      this._tell()
    } else if (event.button === 0) {
      this._press = { x: event.clientX, y: event.clientY, grabbed: gizmo, shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey, lasso: null }
    }
  }

  _move(event) {
    if (!this.on) return
    this._track(event)
    const { movementX: dx, movementY: dy } = event
    if (this._drag === 'orbit') this._view.orbit(dx, dy)
    else if (this._drag === 'pan') this._view.pan(dx, dy, this._view.metresPerPixel(this.game.view.camera.fov, this.canvas.clientHeight))
    else if (this._drag === 'zoom') this._view.zoomBy(dy)
    else if (this._drag === 'fly') this._view.turn(dx, dy)
    else if (this._grab) this._grabbed()
    else if (this._press && !this._press.grabbed && !this._pointing) this._lasso(event)
  }

  // The left button dragged on the picture past a click: the rectangle of a box select, drawn.
  _lasso({ clientX: x, clientY: y }) {
    const press = this._press
    if (!press.lasso && Math.hypot(x - press.x, y - press.y) <= CLICK_SLOP) return
    press.lasso = { left: Math.min(press.x, x), top: Math.min(press.y, y), right: Math.max(press.x, x), bottom: Math.max(press.y, y) }
    this._panel.lasso(press.lasso)
  }

  _up(event) {
    if (!this.on) return
    if (this._drag) {
      this._drag = null
      this._tell()
    }
    const press = this._press
    if (event.button !== 0 || !press) return
    this._press = null
    if (press.lasso) {
      this._panel.lasso(null)
      return this._boxPick(press.lasso, press.shift ? 'add' : press.ctrl ? 'drop' : 'set')
    }
    if (press.grabbed || Math.hypot(event.clientX - press.x, event.clientY - press.y) > CLICK_SLOP) return
    this._click(press.shift)
  }

  _wheel(event) {
    if (!this.on) return
    event.preventDefault()
    const notches = -Math.sign(event.deltaY)
    if (this._drag === 'fly') this._panel.say(`flying at ${Math.round(this._view.gear(notches))} m/s`)
    else this._view.zoom(notches)
  }

  _track({ clientX, clientY, ctrlKey, shiftKey }) {
    this._pointer = { x: clientX, y: clientY, snap: ctrlKey, slow: shiftKey }
  }

  // The ray under the pointer, as the game's own camera sees.
  _ray() {
    const { camera } = this.game.view
    const frame = this.canvas.getBoundingClientRect()
    const ray = new THREE.Raycaster()
    camera.updateMatrixWorld()
    ray.setFromCamera(new THREE.Vector2(((this._pointer.x - frame.left) / frame.width) * 2 - 1, -((this._pointer.y - frame.top) / frame.height) * 2 + 1), camera)
    return ray
  }

  // --- Picking ---

  get _place() {
    return this.game.world.place
  }

  // What the hands are on: the point of the path in hand, or the thing picked.
  get _active() {
    if (this._point === null) return this._picked
    const { _pointTarget: cached } = this
    if (cached?.record !== this._picked.record || cached.index !== this._point) {
      this._pointTarget = { record: this._picked.record, index: this._point, target: pointOf(this.game.world, this._picked.record, this._point) }
    }
    return this._pointTarget.target
  }

  // Each thing picked, as a target: the one, or the members of the group.
  get _members() {
    return this._picked ? (this._picked.members ?? [this._picked]) : []
  }

  // A click picks what is under it; on what is already picked, whatever is behind that. A part
  // of an asset (`assets.js`) is picked with the rest of its asset; a click on an asset already
  // held whole picks the one part under the pointer. With `toggle` (Shift) the nearest under it
  // is added to the pick, or taken off it.
  _click(toggle) {
    const ray = this._ray()
    if (this._pointing) {
      // A path's points lie inside the solid they belong to, and are drawn through it.
      const ball = ray.intersectObjects(this._balls, false)[0]
      return this._pickPoint(ball ? this._balls.indexOf(ball.object) : null)
    }
    const under = this._inside ? partsUnder(this.game.world, this._inside, ray) : recordsUnder(this.game.world, ray)
    if (toggle) {
      if (!under[0]) return
      const had = this._members
      return this._pickMany(had.some((m) => same(m, under[0])) ? had.filter((m) => !same(m, under[0])) : [...had, under[0]])
    }
    const tag = under[0]?.record.asset
    if (tag && this._picked?.asset === tag) return this._pick(under[0].list, under[0].record)
    if (tag && this._picked?.record?.asset !== tag) return this._pickAsset(tag)
    const at = under.findIndex((thing) => same(thing, this._picked))
    const next = under[(at + 1) % Math.max(1, under.length)]
    this._pickMany(next ? [next] : [])
  }

  // Every part of the asset `tag`, held as one.
  _pickAsset(tag) {
    const members = assetParts(this._place, tag)
    this._pickMany(members)
    if (this._picked) this._picked.asset = tag
    this._tell(`${tag} · ${members.length} parts`)
  }

  _pick(list, record) {
    this._pickMany(list ? [{ list, record }] : [])
  }

  // `things` (`[{ list, record }]`) picked: one is a target, more a group of them.
  _pickMany(things) {
    this._unglow()
    this._showPoints(false)
    this._picked = this._targets(things)
    this._wearGlow()
    this._focus()
    this._tell()
  }

  // `things` (`[{ list, record, part }]`) as the target they are held by: one, a group, or null.
  // A part no longer standing (taken away) is left out.
  _targets(things) {
    const { world } = this.game
    const targets = things.map(({ list, record, part }) => (part ? partOf(world, record, part) : targetOf(world, list, record))).filter(Boolean)
    return targets.length > 1 ? groupOf(targets) : (targets[0] ?? null)
  }

  // What `target` is drawn as on its own: a part's mesh, or what the world has for its record.
  _drawnOf(target) {
    return target.drawn ? target.drawn() : this.game.world.drawn(target.list, target.record)
  }

  // Each record the pick changes, once: several parts of one asset are one record.
  get _records() {
    return [...new Map(this._members.map(({ list, record }) => [record, { list, record }])).values()]
  }

  // The picked thing if it is one whole live asset, the one whose parameters the panel shows.
  get _wholeAsset() {
    const picked = this._picked
    return picked && !picked.members && !picked.part && picked.list === 'assets' && this._point === null ? picked : null
  }

  // Blender's box select: what is seen inside `rect` (on the page), not what is behind it
  // (`editor-seen.js`). `how` is 'set', 'add' or 'drop'.
  _boxPick(rect, how) {
    const { scene, view, world } = this.game
    const things = this._inside ? partPickables(world, this._inside) : pickables(world)
    const inside = seenIn(this._renderer, scene, view.camera, things, rect)
    const had = this._members.map(({ list, record, part }) => ({ list, record, part }))
    const isIn = (list) => (thing) => list.some((other) => same(other, thing))
    if (how === 'set') this._pickMany(inside)
    else if (how === 'add') this._pickMany([...had, ...inside.filter((thing) => !isIn(had)(thing))])
    else this._pickMany(had.filter((thing) => !isIn(inside)(thing)))
  }

  // The gizmo, the box and the panel brought to what is now in hand.
  _focus() {
    const target = this._picked && this._active
    this._outline.visible = Boolean(target)
    this._controls.getHelper().visible = Boolean(target)
    if (!target) {
      this._controls.detach()
      this._panel.fill(null)
      this._panel.params(null)
      return
    }
    const start = target.read()
    const pivot = target.pivot()
    this._gizmoStart = { start, pivot: { x: pivot.x, y: pivot.y, z: pivot.z } }
    this._proxy.position.set(pivot.x, pivot.y, pivot.z)
    this._proxy.rotation.set(0, start.yaw, 0)
    this._proxy.scale.set(...start.size)
    if (this._controls.object !== this._proxy) this._controls.attach(this._proxy)
    // The gizmo is of the last kind asked for, where the thing allows it.
    const can = { move: true, turn: target.turns, size: target.sizes !== '' }
    const op = can[this._op] ? this._op : 'move'
    this._controls.mode = GIZMO[op]
    this._controls.showX = this._controls.showZ = op !== 'turn' // a thing turns about the upright only
    if (op === 'size') this._controls.showZ = target.sizes.includes('z')
    this._refresh()
  }

  // The box and the numbers, after anything that moved what is in hand.
  _refresh() {
    const { _picked: picked } = this
    if (!picked) return
    this._drawFrames()
    const { members } = picked
    const what = members ? `${members.length} picked · ${counted(members)}` : picked.label()
    this._panel.fill(this._active, this._point === null ? what : `${what} · point ${this._point}`)
    this._showParams()
    this._placeBalls()
  }

  // A box round each thing picked, stood and turned as it is (Blender's orange).
  _drawFrames() {
    const members = this._members
    while (this._boxHolders.length < members.length) {
      const box = new THREE.Box3Helper(new THREE.Box3(), PICKED)
      Object.assign(box.material, { depthTest: false, fog: false })
      box.renderOrder = 998
      const holder = new THREE.Group()
      holder.add(box)
      this._outline.add(holder)
      this._boxHolders.push(holder)
    }
    this._boxHolders.forEach((holder, i) => {
      holder.visible = i < members.length
      if (!holder.visible) return
      const { box, at, yaw } = members[i].outline()
      holder.children[0].box.copy(box)
      holder.position.set(at.x, at.y, at.z)
      holder.rotation.y = yaw
    })
  }

  // Each picked form's mesh, and each of a picked asset's, wears a copy of its paint with a glow; the paints are shared, so it
  // is the mesh that is given the copy, never the paint that is changed.
  _wearGlow() {
    for (const member of this._members) {
      const drawn = member.glows ? this._drawnOf(member) : null
      for (const mesh of drawn ? meshesOf(drawn) : []) this._glow(mesh)
    }
  }

  _glow(mesh) {
    if (this._lit.has(mesh.material) || !mesh.material.emissive) return // a mural is unlit paint, and has no glow to wear
    if (!this._glows.has(mesh.material)) {
      const lit = mesh.material.clone()
      lit.emissive.set(GLOW)
      this._lit.add(lit)
      this._glows.set(mesh.material, lit)
    }
    this._plain.set(mesh, mesh.material)
    mesh.material = this._glows.get(mesh.material)
  }

  _unglow() {
    for (const [mesh, plain] of this._plain) mesh.material = plain
    this._plain.clear()
  }

  // --- A path's points (Tab) ---

  _showPoints(shown) {
    this._points.clear()
    this._balls[0]?.geometry.dispose()
    for (const ball of this._balls) ball.material.dispose()
    this._balls = []
    this._point = null
    this._pointing = shown
    if (!shown) return
    const geometry = new THREE.SphereGeometry(1, 12, 8)
    this._balls = this._picked.record.path.map(() => {
      const ball = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: POINT.color, fog: false, depthTest: false }))
      ball.renderOrder = 999
      this._points.add(ball)
      return ball
    })
    this._placeBalls()
  }

  _placeBalls() {
    if (!this._pointing) return
    pointsOf(this._picked.record).forEach(({ x, y, z }, i) => {
      this._balls[i]?.position.set(x, y, z)
      this._balls[i]?.material.color.set(i === this._point ? POINT.picked : POINT.color)
    })
  }

  // Tab: into a picked live asset's parts or back out to the building (Blender's edit mode), or a sweep's points shown or hidden.
  _tab() {
    if (this._inside) return this._leaveParts()
    if (this._wholeAsset) return this._enterParts(this._wholeAsset.record)
    this._togglePoints()
  }

  // The parts of the live asset `instance` in hand: it is stood with each part a mesh of its
  // own, and a click picks among them alone.
  _enterParts(instance) {
    this._pick(null)
    this._inside = instance
    this.game.world.standApart(instance, true)
    this._tell(`${instance.tag}: its parts · click one`)
  }

  // Back out of the asset's parts to the place, the asset picked whole (`pick`) if it is still in it.
  _leaveParts(pick = true) {
    const instance = this._inside
    this._pick(null)
    this._inside = null
    this.game.world.standApart(instance, false)
    if (pick && this._place.assets.includes(instance)) this._pick('assets', instance)
    this._tell()
  }

  _togglePoints() {
    if (!this._picked) return
    if (this._picked.members) return this._panel.say('pick one sweep to see its points')
    if (!this._pointing && !hasPoints(this._picked.record)) return this._panel.say('only a sweep has points')
    this._showPoints(!this._pointing)
    this._focus()
    this._tell()
  }

  _pickPoint(index) {
    this._point = index
    this._focus()
  }

  // --- Changing what is picked ---

  // A change begins: the records are kept as they were, and what is dear to stand is carried
  // while it lasts unless it is to be made again at each frame (`carry` false: a parameter dragged).
  _begin(carry = true) {
    if (!this._picked) return
    this._before = this._records.map(({ list, record }) => ({ list, record, before: snapshot(record) }))
    if (carry) this._carry()
  }

  // A change is over: stood as it now is and, if it is another than it was, kept to be undone.
  _keep() {
    const grab = this._grab
    this._grab = null
    this._controls.enabled = true
    const { _picked: picked, _before: before } = this
    this._before = null
    this._uncarry()
    if (!picked || before === null) return this._tell()
    const members = this._members
    const changes = before.map((change) => ({ ...change, after: snapshot(change.record) })).filter((change) => change.after !== change.before)
    if (changes.length > 0) {
      this._pushHistory(changes)
      if (!this._stand(members)) {
        // What cannot be built is not kept.
        this._undoStack.pop()
        for (const change of before) keepIdentity(change.record, change.before)
        this._stand(members)
      }
      // Its own size may be another now (a path's point was moved, a record typed over), and a group's middle is.
      this._picked = this._targets(members)
      this._wearGlow()
    }
    this._dirty = false
    this._focus()
    this._tell(grab ? `${grab.words}` : undefined)
  }

  // One whole change, from `_begin` to `_keep`, round `change`.
  _change(change) {
    if (!this._picked) return
    this._begin()
    change()
    this._keep()
  }

  // A field of the panel dragged as a slider: one change from the press to the letting go.
  _slid(phase, transform) {
    if (!this._picked || this._grab) return
    if (phase === 'start') this._begin()
    else if (phase === 'move') {
      this._active.write(transform)
      this._dirty = true
    } else this._keep()
  }

  // The change in hand is given up: the record is as it was.
  _putBack() {
    const { _picked: picked, _before: before } = this
    this._grab = null
    this._controls.enabled = true
    this._before = null
    this._uncarry()
    if (picked && before !== null) {
      const members = this._members
      for (const change of before) keepIdentity(change.record, change.before)
      this._stand(members)
      this._picked = this._targets(members)
      this._wearGlow()
    }
    this._dirty = false
    this._focus()
    this._tell('put back')
  }

  // The world stands `targets` again as their records now are, each record once; whether it could.
  _stand(targets) {
    this._unglow()
    try {
      this.game.world.restandMany([...new Map(targets.map(({ list, record }) => [record, { list, record }])).values()])
    } catch (error) {
      this._panel.error(error.message)
      return false
    }
    this._panel.error()
    this._wearGlow()
    return true
  }

  // Each frame of a drag: what is cheap to stand is stood as it goes; the box and the numbers always follow.
  _restand() {
    this._dirty = false
    if (!this._picked) return
    if (this._picked.live || this._rebuild) this._stand(this._members)
    else if (this._carried) this._carryOn()
    this._refresh()
  }

  // What is dear to stand (a group, a whole asset) is not stood again at each step of a drag (a box
  // or a lamp in a group would bake every box of the place each time): its meshes are carried as
  // one, and stood when the change is kept or put back.
  _carry() {
    if (this._picked.live) return
    this._carried = new Map()
    this._carriedFrom = this._picked.read()
    for (const member of this._members) {
      const drawn = this._drawnOf(member)
      if (!drawn) continue
      drawn.updateMatrix()
      this._carried.set(drawn, drawn.matrix.clone())
      drawn.matrixAutoUpdate = false
    }
  }

  // Each carried mesh as the change in hand now puts it: what the transform is now, after what it was when the drag began undone.
  _carryOn() {
    const matrixOf = ({ at, yaw, size }) => new THREE.Matrix4().compose(new THREE.Vector3(at.x, at.y, at.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(...size))
    const move = matrixOf(this._picked.read()).multiply(matrixOf(this._carriedFrom).invert())
    for (const [mesh, was] of this._carried) mesh.matrix.multiplyMatrices(move, was)
  }

  _uncarry() {
    if (!this._carried) return
    for (const [mesh, was] of this._carried) {
      mesh.matrix.copy(was)
      mesh.matrixAutoUpdate = true
    }
    this._carried = null
  }

  _pushHistory(changes) {
    this._undoStack.push(changes)
    if (this._undoStack.length > HISTORY) this._undoStack.shift()
    this._redoStack = []
  }

  // A kept change taken back (`back`) or made again: the record put as it was on that side of it.
  _replay(from, to, back) {
    if (this._grab) return
    const changes = from.pop()
    if (!changes) return this._panel.say(back ? 'nothing to undo' : 'nothing to redo')
    to.push(changes)
    this._pick(null)
    const stood = []
    // Put back where they were in their lists, the first first, so each index is the one it had.
    for (const change of [...changes].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
      const { list, record, index } = change
      const text = back ? change.before : change.after
      const records = this._place[list]
      if (text === null) {
        if (records.includes(record)) records.splice(records.indexOf(record), 1)
      } else {
        keepIdentity(record, text)
        if (!records.includes(record)) records.splice(index ?? records.length, 0, record)
        stood.push({ list, record })
      }
    }
    this.game.world.restandMany(stood, changes.filter(({ record }) => !stood.some((thing) => thing.record === record)))
    if (this._inside && !this._place.assets.includes(this._inside)) this._leaveParts()
    if (!this._inside) this._pickMany(stood) // among an asset's parts, a whole record is no pick
    this._panel.say(back ? 'undone' : 'redone')
  }

  // The gizmo moved what it holds: the thing in hand takes it, and is stood again on the next frame.
  _gizmoMoved() {
    const target = this._picked && this._active
    if (!target) return
    const { start, pivot } = this._gizmoStart
    const { position, scale, quaternion } = this._proxy
    const heading = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion) // the Euler angle would fold past a quarter turn
    target.write(
      pivoted(start, pivot, {
        by: { x: position.x - pivot.x, y: position.y - pivot.y, z: position.z - pivot.z },
        turn: target.turns ? Math.atan2(heading.x, heading.z) - start.yaw : 0,
        grow: scale.toArray().map((s, i) => Math.abs(s) / start.size[i]),
      }),
    )
    this._dirty = true
  }

  // --- G, R and T ---

  _take(op) {
    const target = this._picked && this._active
    if (!target) return this._panel.say('nothing picked')
    if (op === 'turn' && !target.turns) return this._panel.say('this cannot be turned')
    if (op === 'size' && target.sizes === '') return this._panel.say('this cannot be sized')
    this._op = op
    const { camera } = this.game.view
    const start = target.read()
    const { x, y, z } = target.pivot()
    const frame = this.canvas.getBoundingClientRect()
    const seen = new THREE.Vector3(x, y, z).project(camera)
    const centre = { x: frame.left + ((seen.x + 1) / 2) * frame.width, y: frame.top + ((1 - seen.y) / 2) * frame.height }
    this._begin()
    this._controls.enabled = false
    this._controls.getHelper().visible = false // it would stay where the thing was
    this._grab = new Grab(op, start, target, { forward: camera.getWorldDirection(new THREE.Vector3()), centre, pivot: { x, y, z } }, this._pointed())
    this._tell()
  }

  _pointed() {
    const { origin, direction } = this._ray().ray
    return { origin: origin.clone(), direction: direction.clone(), ...this._pointer }
  }

  // The move in hand follows the pointer, or a key that changed what it means.
  _grabbed() {
    this._active.write(this._grab.to(this._pointed()))
    this._dirty = true
    this._tell()
  }

  // --- Adding, copying, deleting ---

  // `record` put at the end of the place's `list`: the change that is.
  _push(list, record) {
    const records = (this._place[list] ??= [])
    records.push(record)
    return { list, record, index: records.length - 1, before: null, after: snapshot(record) }
  }

  // Things just put in the place's lists: kept to be undone, stood and picked.
  _added(changes) {
    this._pushHistory(changes)
    this.game.world.restandMany(changes)
    this._pickMany(changes)
  }

  // A new form stood where the pointer was when the menu was asked for: on what is under it, or at the pivot.
  _create(name) {
    const { x, y, z } = this._adding ?? this._view.pivot
    this._added([this._push('forms', { ...PRESETS[name]({ x: Math.round(x), y: Math.round(y), z: Math.round(z) }), id: nextFormId(this._place), look: 'concrete' })])
  }

  // A new asset (`assets.js`) stood where the pointer was when the menu was asked for, its front
  // toward +Z, under a tag of its own. Its `params` are empty (the builder's defaults), though the
  // panel's record shows them all, so that it shows what can be changed.
  _createAsset(name) {
    const { x, y, z } = this._adding ?? this._view.pivot
    const instance = { tag: freshTag(this._place, name), name, params: {}, at: { x: Math.round(x), y: Math.round(y), z: Math.round(z) } }
    this._added([this._push('assets', instance)])
    this._tell(`${instance.tag} · type its params in the record (N) to change it`)
  }

  _openAdd() {
    if (this._inside) return this._panel.say('Tab back to the place to add to it')
    const ray = this._ray()
    const [under] = recordsUnder(this.game.world, ray)
    this._adding = under ? ray.ray.at(under.distance, new THREE.Vector3()) : null
    this._panel.openAdd(this._pointer.x, this._pointer.y)
  }

  // Blender's Shift+D: a copy of each thing picked where it is, taken hold of at once.
  _copy() {
    if (!this._picked) return
    if (this._inside) return this._panel.say('a part is not copied: Tab back and copy the building')
    const { changes, tag } = copiesOf(this.game.world, this._members, this._picked.asset, (list, copy) => this._push(list, copy))
    this._added(changes)
    if (tag && this._picked) this._picked.asset = tag
    this._take('move')
  }

  _delete() {
    const members = this._members
    if (members.length === 0) return
    if (this._inside) {
      // A part is taken away in its asset's `parts`, and comes back with undo or the panel's put back.
      const instance = this._inside
      this._change(() => members.forEach(({ part }) => dropPart(instance, part)))
      return this._panel.say(members.length > 1 ? `${members.length} parts taken away` : 'part taken away')
    }
    const changes = members.map(({ list, record }) => ({ list, record, index: this._place[list].indexOf(record), before: snapshot(record), after: null }))
    this._pushHistory(changes)
    this._pick(null)
    for (const { list, record } of members) this._place[list].splice(this._place[list].indexOf(record), 1)
    this.game.world.restandMany([], changes)
    this._panel.say(members.length > 1 ? `${members.length} deleted` : 'deleted')
  }

  // The record typed in the panel becomes the thing, if it parses, is the kind of record the place
  // can hold (`recordProblem`, as a load checks it) and can be built; the kind keeps its identity (`onRetype`).
  _retype(text) {
    const picked = this._picked
    if (!picked || picked.members) return
    let typed
    try {
      typed = JSON.parse(text)
    } catch (error) {
      return this._panel.error(error.message)
    }
    picked.onRetype?.(typed)
    const problem = recordProblem(picked.partList ?? picked.list, typed, KNOWN)
    if (problem) return this._panel.error(`the record has ${problem}`)
    this._showPoints(false)
    this._change(() => (picked.retype ? picked.retype(typed) : keepIdentity(picked.record, JSON.stringify(typed))))
  }

  _startHere() {
    const { eye, yaw } = this._view.pose()
    const round = (v) => Math.round(v * 1000) / 1000
    this._place.start = { ...this._place.start, x: round(eye.x), y: round(eye.y - EYE), z: round(eye.z), yaw: round(yaw) }
    this._panel.say('the start is set here')
  }

  _frameSelection() {
    if (!this._picked) return this._panel.say('nothing picked to frame')
    const ball = this._active.bounds().getBoundingSphere(new THREE.Sphere())
    const at = this._point === null ? ball.center : this._active.read().at
    this._view.frame(at, this._point === null ? ball.radius : 10, this.game.view.camera.fov)
  }

  // --- The status line ---

  _tell(said) {
    if (said !== undefined) this._panel.say(said)
    if (this._grab) {
      this._panel.say(this._grab.words)
      this._panel.keys(KEYS.grab)
    } else this._panel.keys(this._drag === 'fly' ? KEYS.fly : this._pointing ? KEYS.points : this._inside ? KEYS.parts : KEYS.idle)
  }

  // --- Keys ---

  _keyUp(event) {
    this._keysDown.delete(event.code)
    if (this.on && this._grab && (event.key === 'Control' || event.key === 'Shift')) {
      Object.assign(this._pointer, { snap: event.ctrlKey, slow: event.shiftKey })
      this._grabbed()
    }
  }

  _keyDown(event) {
    const command = event.ctrlKey || event.metaKey
    if (typing(event.target)) {
      if (this.on && command && event.code === 'KeyS') {
        event.preventDefault()
        event.target.blur() // what is typed is taken first
        this._save()
      }
      return
    }
    const flying = this._drag === 'fly'
    if (event.code === 'KeyE' && !command && !event.repeat && !this._grab) {
      event.preventDefault()
      if (this.on) this._leave()
      else this._enter()
      return
    }
    if (!this.on) return
    if (!command) this._keysDown.add(event.code)
    if (this._grab) {
      event.preventDefault()
      return this._grabKey(event)
    }
    if (!command && (!event.shiftKey || event.code === 'Space') && FLY_KEYS.has(event.code)) return event.preventDefault() // `_frame` flies while it is held
    if (event.repeat || flying) return
    if (this._command(event, command)) event.preventDefault()
  }

  // A key while a move is in hand: all of them are its own.
  _grabKey(event) {
    const { code, key, shiftKey, ctrlKey } = event
    Object.assign(this._pointer, { snap: ctrlKey, slow: shiftKey })
    if (code === 'Escape') return this._putBack()
    if (code === 'Enter' || code === 'NumpadEnter') {
      this._grabbed()
      return this._keep()
    }
    if (AXES[code]) this._grab.lock(AXES[code], shiftKey)
    else if (!this._grab.type(key) && key !== 'Control' && key !== 'Shift') return
    this._grabbed()
  }

  // Whether `event` was a command of the editor's.
  _command({ code, shiftKey, ctrlKey }, command) {
    if (command) {
      if (code === 'KeyZ') shiftKey ? this._replay(this._redoStack, this._undoStack, false) : this._replay(this._undoStack, this._redoStack, true)
      else if (code === 'KeyY') this._replay(this._redoStack, this._undoStack, false)
      else if (code === 'KeyS') this._save()
      else if (VIEW_KEYS[code.at(-1)] && /^(Digit|Numpad)\d$/.test(code)) this._view.along(VIEW_KEYS[code.at(-1)][1])
      else return false
      return true
    }
    if (/^(Digit|Numpad)\d$/.test(code)) {
      const digit = code.at(-1)
      if (VIEW_KEYS[digit]) this._view.along(VIEW_KEYS[digit][0])
      else if (STEP_KEYS[digit]) this._view.step(...STEP_KEYS[digit])
      else return false
      return true
    }
    if (OPS[code]) {
      this._take(OPS[code])
      return true
    }
    switch (code) {
      case 'Escape':
        if (this._panel.adding) this._panel.closeAdd()
        else if (this._point !== null) this._pickPoint(null)
        else if (this._pointing) this._togglePoints()
        else if (this._picked || !this._inside) this._pick(null)
        else this._leaveParts()
        return true
      case 'Tab':
        this._tab()
        return true
      case 'KeyA':
        if (shiftKey) this._openAdd()
        return shiftKey
      case 'KeyD':
        if (shiftKey) this._copy()
        return shiftKey
      case 'KeyX':
      case 'Delete':
      case 'Backspace':
        if (this._pointing) this._panel.say('Tab back to the form to delete it')
        else this._delete()
        return true
      case 'KeyN':
        this._panel.toggle()
        return true
      case 'KeyP':
        this._startHere()
        return true
      case 'Period':
      case 'NumpadDecimal':
        this._frameSelection()
        return true
      default:
        return false
    }
  }

  // --- Saving ---

  // The place's record is POSTed whole to the dev server, which writes it to the place's file
  // (`vite.config.js`); Vite then reloads the page, and the view and the pick are put back from
  // the note left in `sessionStorage` (`KEY`), read once by the constructor.
  async _save() {
    const { place, file } = this.game.world
    if (!file) return this._panel.say('this place is made in code, and has no file to save to')
    if (this._grab) this._keep()
    sessionStorage.setItem(KEY, this._note())
    try {
      checkPlace(place, file, KNOWN) // what a load would refuse is not written
      this._panel.say(`saved ${await savePlace(file, place)}, reloading…`) // Vite reloads the page for the changed file
    } catch (error) {
      sessionStorage.removeItem(KEY) // no reload is coming
      this._panel.say(`not saved: ${error.message}`)
    }
  }

  // What the page reload a write brings must not lose: the view, the pick and the asset whose parts are in hand.
  _note() {
    const { place } = this.game.world
    const picked = this._members.map(({ list, record, part }) => ({ list, index: place[list].indexOf(record), part }))
    return JSON.stringify({ view: this._view.kept, picked, inside: this._inside ? place.assets.indexOf(this._inside) : null })
  }

  // --- An asset's parameters ---

  // The picked live asset's parameters in the panel: each at its own value or its builder's
  // default, with what the builder's source says it means once the dev server has said it.
  _showParams() {
    const target = this._wholeAsset
    if (!target || this._inside) return this._panel.params(null)
    const instance = target.record
    const said = this._saidOf(instance.name)
    const params = instance.params ?? {}
    const { looks } = this.game.world
    this._panel.params({
      entries: Object.entries(assetDefaults(instance.name)).map(([key, fallback]) => ({
        key,
        value: key in params ? params[key] : fallback,
        changed: key in params,
        fallback,
        meaning: said?.meanings.get(key) ?? '',
        choices: choicesFor(fallback, looks),
      })),
      path: said?.path ?? null,
      parts: Object.keys(instance.parts ?? {}).length,
      stray: strayParts(instance).length,
    })
  }

  // What the builder `name`'s source says of its parameters (`{ path, meanings }`), or null
  // while the dev server is asked; the panel is filled again when it answers.
  _saidOf(name) {
    const said = this._said.get(name)
    if (said !== undefined) return said
    this._said.set(name, null)
    readDefaults(name)
      .then(({ path, params }) => this._said.set(name, { path, meanings: new Map(params.map(({ key, meaning }) => [key, meaning])) }))
      .catch((error) => this._said.set(name, { path: null, meanings: new Map(), error: error.message }))
      .then(() => this._showParams())
    return null
  }

  // A parameter of the picked asset changed in the panel: set at once ('set'), or dragged as a
  // slider from 'start' through each 'move' to 'end', one change, the building made again at
  // each frame between.
  _param(phase, key, value) {
    const target = this._wholeAsset
    if (!target || this._grab) return
    if (phase === 'set') return this._change(() => setParam(target.record, key, value))
    if (phase === 'start') {
      this._begin(false)
      this._rebuild = true
    } else if (phase === 'move') {
      setParam(target.record, key, value)
      this._dirty = true
    } else {
      this._rebuild = false
      this._keep()
    }
  }

  // The picked asset's parameters made its builder's own: written into the builder's defaults in
  // its source (`asset-source.js`) and taken off the instance, the place's file written in the
  // same request when it has one, since the page reloads when either is written.
  async _makeDefaults() {
    const target = this._wholeAsset
    if (!target) return
    const instance = target.record
    const values = instance.params ?? {}
    if (Object.keys(values).length === 0) return this._panel.say('nothing here differs from the builder')
    const { place, file } = this.game.world
    instance.params = {} // not stood again: the page is reloaded with the new defaults
    sessionStorage.setItem(KEY, this._note())
    try {
      if (file) checkPlace(place, file, KNOWN)
      const written = await writeDefaults(instance.name, values, file ? { name: file, record: place } : null)
      this._panel.say(`wrote ${written.join(' and ')}, reloading…${file ? '' : ' (this place is made in code: its other changes go with the reload)'}`)
    } catch (error) {
      sessionStorage.removeItem(KEY)
      instance.params = values
      this._panel.say(`not written: ${error.message}`)
    }
  }

  // Every change made by hand to the picked asset's parts undone, as one change.
  _putPartsBack() {
    const target = this._wholeAsset
    if (!target) return
    this._change(() => delete target.record.parts)
    this._panel.say('its parts are as the builder makes them')
  }
}
