// Quitters has one place. The courier's route and the runner share this world; dialogue
// holds a frame, while movement and the story's choices advance only on fixed steps.
import * as THREE from 'three'
import { loadPlace } from './places.js'
import { ParkourWorld } from './parkour-world.js'
import { PlayerCamera } from './camera.js'
import { Atmosphere } from './atmosphere.js'
import { MISTS } from './themes.js'
import { EYE as EYES, FootView, TUNNEL } from './foot-view.js'
import { Input } from './input.js'
import { createBody } from './flight.js'
import * as foot from './parkour.js'
import * as wing from './wingsuit.js'
import { CourierStory } from './courier.js'
import { LINEUP_CAST, NPCLineup, lineupPlace } from './npc-lineup.js'
import { Crow } from './crow.js'
import { CrowFigure } from './crow-figure.js'
import { Raccoon } from './raccoon.js'
import { PEOPLE } from './npc-people.js'
import { Effects } from './effects.js'
import { createPlayer } from './models.js'
import { Smoker } from './viewmodel.js'
import { Soundtrack } from './soundtrack.js'
import { QuittersPause } from './quitters-pause.js'
import { Finds } from './finds.js'
import { FindCount } from './find-count.js'
import { HOOK_REACH, Hook } from './hook.js'
import { Compass } from './compass.js'
import { CompassModel } from './compass-model.js'
import { Lessons } from './lessons.js'
import { leaveScreen } from './full-screen.js'
import './quitters.css'

const SAVE_KEY = 'quitters.story.v1'
const GAME_PAGE = 'https://mblw.itch.io/do-not-smoke'

function publishedPage() {
  try {
    const page = new URL(document.referrer)
    if (page.hostname.endsWith('.itch.io')) return `${page.origin}${page.pathname.replace(/\/$/, '')}`
  } catch { /* local preview has no published parent page */ }
  return GAME_PAGE
}
const LOOK_SPEED = 0.0025
const NPC_STRAY = 15 // metres from their spot past which the compass points at the spot, not the one met there
const EYE_UP = new THREE.Vector3(0, 1, 0)
// The hook (`hook.js`), his once every feather is taken.
const HOOK_BUFFER_SECONDS = 0.3 // a press with nothing in reach goes on being tried this long
const HOOK_YANK = 20 // m/s he is pulled off his feet at when it catches from them: his run
const HOOK_YANK_PITCH = 0.45 // radians above level, at least, that pull leaves the floor at
const HOOK_TOP_AFOOT = 40 // m/s along the line past which it pulls no harder on foot: twice his run
const HOOK_HAND = new THREE.Vector3(0.3, -0.35, -0.9) // where the line leaves him, in the view
const _anchor = new THREE.Vector3()
const _hand = new THREE.Vector3()
const _eye = new THREE.Vector3()
const _from = new THREE.Vector3()
const _chest = new THREE.Vector3() // the middle of his body: where a find is taken and the compass reckons from
const _normal = new THREE.Vector3()
const _probe = new THREE.Vector3()
// The suit's lesson waits for an edge: on his feet, running at it, the floor gone this far under
// (m) a step or two ahead (m), enough air for the suit to open. Learnt, it carries him off the edge.
const EDGE_PACE = 3 // m/s along the floor at least
const EDGE_DROP = 12
const EDGE_AHEAD = [1.5, 3]
const LEAP_RISE = 7 // m/s up he goes off the edge with: over a parapet, and clear of the floor
const _edgeWay = new THREE.Vector3()
// The slide's lesson comes after a few landings on his feet past the suit's, at a run with speed
// enough for a slide to begin (`parkour.TUNING.slideFrom`, and some). The fall's comes the first
// time he drops fast with nothing near under him: time stops, so he can read it in the air.
const SLIDE_LANDINGS = 3
const SLIDE_PACE = 10 // m/s
const FALL_SPEED = 18 // m/s down
const FALL_DROP = 20 // m of air under him at least
// Checkpoints are the routes' running points (`place.par`, `do: 'run'`): reached on his feet this
// near (m, level and up), one becomes where R and the abyss put him back, facing the next point.
const CHECKPOINT_NEAR = 5
const CHECKPOINT_RISE = 2.5
// The gull leaves the roof along the first route, this high over it (m), so its way is his.
const GULL_OVER = 5
const GULL_EVERY = 2 // route points, one in so many is a waypoint
const START_BACK = 1.2 // m back from the record's balcony start (which is at the rail) that he begins
const GULL_BEFORE = 1.75 // m before him that it sits at the start, on the rail there
const GULL_RIGHT = 1.4 // and to his right, so that he turns his head to it
const GULL_UP = 1.05 // m up it sits with no rail found: a rail's height
const _speechPoint = new THREE.Vector3()
const _speechCenter = new THREE.Vector3()
// The raccoon who asks for a light (`raccoon.js`, `_meetRaccoons`).
const STILL = 0.5 // m/s along the ground under which he is standing still, and squats to a raccoon who comes
const CHIRR = new URL('./sounds/chirr.mp3', import.meta.url).href
const CHIRR_LOUDNESS = 0.9
const CHIRR_NEAR = 8 // metres within which a chirr is heard at its loudest; past them it fades with the distance
// Seconds the raccoon asks before his first scene opens anyway, the match it counts lighting him:
// a courier who does not think to click is not kept from the story.
const ASK_PATIENCE = 12
// `?raccoon` begins this far before him (m), on his level and out of his scene's spot: the first
// distance and turn off the way he faces that finds a floor there, facing him.
const RACCOON_START = { out: [12, 9, 6], turns: [0, 0.5, -0.5, 1, -1, 1.6, -1.6], level: 1 }
const _lookFrom = new THREE.Vector3()
const _lendTip = new THREE.Vector3()

function storySpots(world) {
  const spots = Object.fromEntries(Object.entries(world.place.courier.spots).map(([name, at]) => [
    name, { ...world.groundedAt(at), radius: at.radius },
  ]))
  return { courier: { spots } }
}

function saveRead() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) } catch { return null }
}

function saveWrite(value) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(value)) } catch { /* play continues without storage */ }
}

export class QuittersGame {
  constructor(canvas, { lineup = false } = {}) {
    this.canvas = canvas
    this.scene = new THREE.Scene()
    const { place, file } = loadPlace()
    this.lineup = lineup
    if (lineup) lineupPlace(place)
    // The story opens at the balcony rail (`starts.balcony`), where he smokes and the gull sits.
    this.world = new ParkourWorld(this.scene, place, { file: lineup ? null : file, bird: 'gull', from: place.starts?.balcony ? 'balcony' : null })
    this.world.load()
    this.atmosphere = new Atmosphere(this.scene)
    this.atmosphere.setTheme(this.world.level.theme)
    this._flow = new THREE.Vector2() // where on the picture the air comes from; still, on foot
    this.view = new PlayerCamera((point, radius, normal) => this.world.eyeOutOfSolids(point, radius, normal))
    this.scene.add(this.view.camera)
    this.effects = new Effects(this.scene, this.view.camera)
    this.player = createPlayer()
    this.player.root.visible = false
    this.scene.add(this.player.root)
    this.smoker = new Smoker(this.view.camera, this.player, this.effects)
    this.finds = new Finds(this.world.rules.finds)
    this.findCount = new FindCount(canvas.parentElement)
    const loudness = () => this.soundtrack.volumeShown.step / this.soundtrack.volumeShown.steps
    this.compass = new Compass(this.finds, this.world.place.courier?.crossings ?? [], new CompassModel(loudness))
    this.smoker.carry(this.compass.root)
    this.lessons = new Lessons(this.view.camera)
    /** The hook and its line as drawn: from the hand to a bright knot where it holds. */
    this.hook = new Hook()
    this.hookAsked = 0 // seconds a press of the hook has left to catch something
    const bright = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 1.2) })
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: bright.color }))
    line.frustumCulled = false
    this.rope = { line, knot: new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bright) }
    line.visible = this.rope.knot.visible = false
    this.scene.add(line, this.rope.knot)
    this.input = new Input(canvas, canvas.parentElement)
    this.body = createBody()
    this.runner = foot.createRunner(this.body)
    this.suit = wing.createSuit(this.body)
    this.footView = new FootView()
    this.flying = false
    this.lookYaw = 0
    this.lookPitch = 0
    this.aim = new THREE.Vector3(0, 0, 1)
    this.strafe = 0
    this.jumpWasDown = false
    this.editing = false
    this.paused = false
    this.pausePick = 0
    this._saveIn = 1
    this.soundtrack = new Soundtrack()
    this._makePause()

    this.crows = this.world.rules.crows.map((perches) => new Crow(perches, 'gull'))
    this._stageRoof()
    this.raccoons = this.world.rules.raccoons.map((home) => new Raccoon(home, (x, y, z) => this.world.floorAt(x, y, z)))
    this._squatted = false // whether he has squatted to a raccoon who has come to him, since none has
    this._standPeople()
    const Story = lineup ? NPCLineup : CourierStory
    const spots = storySpots(this.world)
    if (!lineup && this._gullPerch) spots.courier.spots.roof = { ...this._gullPerch, radius: 6 } // met at the rail; the words stand by the gull
    this._spots = spots.courier.spots
    this.story = new Story(this.input, spots, (event, value) => this._storyEvent(event, value), { scene: this.scene, canvas })
    // A scene due at its spot waits for the one met there: the gull's first words for its swoop,
    // the raccoon's for his asking. Only that scene waits; the story goes on stepping its cards.
    this.story.waits = (id) => (id === 'roof-morning' && this._gullBusy()) || (id === 'raccoon-one' && this._raccoonBusy())
    // `?fresh` plays as a new player would, the save read by nothing; it is written over as he plays.
    const saved = lineup || new URLSearchParams(location.search).has('fresh') ? null : saveRead()
    this._checkpoints = this._routeCheckpoints()
    this._landings = 0 // on his feet, since the start or since starting over: the slide's lesson waits for a few
    this._sceneUp = null // the scene whose card is held, for what follows its end
    const checkpoint = saved?.checkpoint
    if (checkpoint && ['x', 'y', 'z', 'yaw'].every((key) => Number.isFinite(checkpoint[key]))) this.world.respawn = checkpoint
    if (saved?.story) this.story.restore(saved.story) // before the reset, which asks what the story has seen
    if (lineup || this.story.seen.has('roof-morning')) this.soundtrack.begin() // else the gull's scene lets it in
    this.reset(this.world.respawn ?? saved?.position) // the checkpoint he reached, not wherever the second's save caught him
    // `?raccoon` begins before the raccoon, for trying his meeting; the save goes on from there.
    if (!lineup && new URLSearchParams(location.search).has('raccoon')) this._startAtRaccoon()
    this.finds.restore(saved?.found)
    // `?lessons` teaches them again, whatever the save says: for trying them.
    this.lessons.restore(new URLSearchParams(location.search).has('lessons') ? [] : saved?.taught)
  }

  _standPeople() {
    if (this.lineup) {
      this.raccoons[0].mode = 'asking'
      for (const [spot, kind] of [['tamara', 'cleaner'], ['pipe', 'old-man']]) {
        const at = this.world.place.courier.spots[spot]
        const person = PEOPLE.find((entry) => entry.id === kind).build().group
        person.position.set(at.x, at.y, at.z)
        person.rotation.y = Math.PI
        person.scale.setScalar(1.35)
        this.scene.add(person)
      }
      const raven = LINEUP_CAST.find((person) => person.name === 'Raven')
      this.raven = new Crow([{ x: raven.x, y: 0, z: 8, yaw: Math.PI }], 'crow')
      this.ravenFigure = new CrowFigure('crow')
      this.scene.add(this.ravenFigure.group)
      return
    }
    this._people = {} // each standing figure, by the spot of the scenes it is met in
    // The Raven keeps his books at the sorting office: the crow mesh, perched where the old man stood.
    const desk = this.world.place.courier.spots.sorting
    if (desk) {
      const x = desk.x + 1.6, z = desk.z
      const perch = { x, y: this.world.floorAt(x, desk.y + 2, z), z, yaw: Math.PI, stay: true }
      this.raven = new Crow([perch], 'crow')
      this.ravenFigure = new CrowFigure('crow')
      this.scene.add(this.ravenFigure.group)
      this._people.sorting = this.ravenFigure.group // shown at the perch each frame, like the lineup's
    }
    const people = [
      ['tamara', 'cleaner', -1.6, 0, 0],
      ['pipe', 'old-man', 1.7, 0, Math.PI],
    ]
    for (const [spot, kind, dx, dz, yaw] of people) {
      const at = this.world.place.courier.spots[spot]
      const person = PEOPLE.find((entry) => entry.id === kind)?.build().group
      if (!person) continue
      person.position.set(at.x + dx, this.world.floorAt(at.x + dx, at.y + 2, at.z + dz), at.z + dz)
      person.rotation.y = yaw
      person.scale.setScalar(1.35)
      this.scene.add(person)
      this._people[spot] = person
    }
  }

  _makePause() {
    this.pauseMenu = new QuittersPause(this.canvas, (action) => this._pauseAction(action))
  }

  _pauseAction(action) {
    if (action === 'music') return this._choosePause(1)
    if (action === 'volume-') return this._changeVolume(-1)
    if (action === 'volume+') return this._changeVolume(1)
    if (action === 'look-') return this._changeLookSpeed(-1)
    if (action === 'look+') return this._changeLookSpeed(1)
    if (action === 'yes') return this._confirmQuit(true)
    if (action === 'no') return this._confirmQuit(false)
    if (action === 2 && this.pausePick !== 2) {
      this.pausePick = 2
      return this.pauseMenu.choose(2)
    }
    this.pausePick = action
    this.pauseMenu.choose(action)
    this._choosePause(action)
  }

  _pause() {
    this.paused = true
    this.pausePick = 0
    this.pauseConfirm = false
    this.input.release()
    this.pauseMenu.open(this.story.language, this.soundtrack.music, this.soundtrack.volumeShown, this.input.lookSpeed)
  }

  _changeVolume(direction) {
    this.soundtrack.changeVolume(direction)
    this.pauseMenu.setVolume(this.soundtrack.volumeShown)
  }

  _changeLookSpeed(direction) {
    this.input.changeLookSpeed(direction)
    this.pauseMenu.setLook(this.input.lookSpeed)
  }

  _adjustSoundControl(direction) {
    if (this.pauseMenu.soundControlPick === 0) this._changeVolume(direction)
    else if (this.pauseMenu.soundControlPick === 1) this._changeLookSpeed(direction)
    else this._choosePause(2)
  }

  _choosePause(index) {
    if (index === 2) {
      this.soundtrack.setMusic(!this.soundtrack.music)
      this.pauseMenu.setMusic(this.soundtrack.music)
      return
    }
    if (index === 1) return window.open(`${publishedPage()}/rate?source=game`, '_blank', 'noopener')
    if (index === 3) {
      this.pauseConfirm = true
      this.pauseMenu.confirm(1)
      return
    }
    this.paused = false
    this.pauseMenu.close()
    this.input.capture()
  }

  _confirmQuit(yes) {
    if (!yes) {
      this.pauseConfirm = false
      this.pauseMenu.cancelConfirm()
      return
    }
    this.save()
    leaveScreen()
    try { window.top.location.href = publishedPage() } catch { window.open(publishedPage(), '_blank', 'noopener') }
  }

  _storyEvent(event, detail) {
    if (this.lineup) return
    if (event === 'restart') { this.world.respawn = null; this._landings = 0; this.soundtrack.hold(); this.reset(); return }
    if (event === 'match' && detail && !this.raccoons[0]?.lit) this.raccoons[0]?.acceptMatch() // lit by a lent light already, he has had his thanks
    if (event !== 'scene') return
    this._sceneUp = detail
    if (detail === 'sorting-two' || detail === 'sorting-three') this.raccoons[0]?.reset()
    const gull = this.crows[0]
    if (!gull) return
    if (detail === 'roof-evening-one' || detail === 'roof-evening-two' || detail === 'roof-evening-three') {
      gull.reset()
      gull.carrying = true
    }
    if (detail === 'roof-morning' && !gull.carrying) { gull.carrying = true; this.smoker.quit() } // a save from before the gull acted
    if (detail === 'roof-morning-three') gull.mode = 'gone'
  }

  reset(position = null) {
    const spawn = this.world.respawn ?? this._balcony()
    const at = position && ['x', 'y', 'z', 'yaw'].every((key) => Number.isFinite(position[key])) ? position : spawn
    this.body.pos.set(at.x, at.y, at.z)
    this.body.vel.set(0, 0, 0)
    this.lookYaw = at.yaw ?? 0
    this.lookPitch = 0
    // At the start, before the gull has had its scene, his head is turned to it; he stands straight.
    const perch = this._gullPerch
    if (perch && at === this._balcony() && !this.story?.seen.has('roof-morning')) {
      this.lookYaw = Math.atan2(perch.x - at.x, perch.z - at.z)
    }
    this.flying = false
    this.jumpWasDown = false
    this.hook.release()
    this.hookAsked = 0
    this._squatted = false
    foot.reset(this.runner)
    this.smoker.reset()
    if (this.story.seen?.has('roof-morning')) this.smoker.quit() // the gull has his last cigarette: the hand stays free for the compass
    this.compass.reset()
    this.footView.reset()
    this.view.snap()
  }

  resize(aspect) {
    this.view.resize(aspect)
    this.story.view.resize(aspect)
    this.pauseMenu.resize(aspect)
  }

  placeView(pos, yaw, pitch) {
    this.body.pos.copy(pos)
    this.body.vel.set(0, 0, 0)
    this.lookYaw = yaw
    this.lookPitch = pitch
    this.aim.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
  }

  update(dt) {
    const moving = !this.editing && !this.paused && !this.story.holding && !this.lessons.holding
    this.input.offer({ flick: moving || this.lessons.asks === 'jump', hook: moving || this.lessons.asks === 'hook', menu: moving, retry: moving })
    const controls = this.input.read(dt)
    if (!moving || this.input.blocked) this.compass.step(dt, null)
    if (this.editing) return
    if (this.input.blocked) return
    if (this.paused) {
      if (this.pauseConfirm) {
        if (controls.pause) this._confirmQuit(false)
        else if (controls.menuTurn || controls.menuStep) {
          this.pauseMenu.chooseConfirm(THREE.MathUtils.clamp(this.pauseMenu.confirmPick + controls.menuTurn + controls.menuStep, 0, 1))
        } else if (controls.confirm) this._confirmQuit(this.pauseMenu.confirmPick === 0)
        return
      }
      if (this.pauseMenu.inSoundControls) {
        if (controls.pause) { this._choosePause(0); return }
        if (controls.menuStep < 0) {
          if (this.pauseMenu.soundControlPick === 0) this.pauseMenu.leaveSoundControls()
          else this.pauseMenu.stepSoundControl(-1)
        }
        else if (controls.menuStep > 0) this.pauseMenu.stepSoundControl(1)
        if (controls.menuTurn) this._adjustSoundControl(controls.menuTurn)
        if (controls.confirm) this._adjustSoundControl(1)
        if (controls.volume) this._changeVolume(controls.volume)
        if (controls.lookSpeed) this._changeLookSpeed(controls.lookSpeed)
        return
      }
      // Down from sound goes into its settings, which lie under the row.
      if (this.pausePick === 2 && controls.menuStep > 0) this.pauseMenu.enterSoundControls()
      else if (controls.menuStep || controls.menuTurn) {
        this.pausePick = THREE.MathUtils.clamp(this.pausePick + controls.menuStep + controls.menuTurn, 0, 3)
        this.pauseMenu.choose(this.pausePick)
      }
      if (controls.volume) this._changeVolume(controls.volume)
      if (controls.lookSpeed) this._changeLookSpeed(controls.lookSpeed)
      if (controls.confirm) this._choosePause(this.pausePick)
      else if (controls.pause) this._choosePause(0)
      return
    }
    if (this.story.holding) {
      this.jumpWasDown = controls.jump
      this.hook.release()
      this.story.step(dt, controls, this.body.pos)
      if (this.story.holding) this._keepDialogueVisible(dt)
      if (!this.story.holding) { this.save(); this._sceneEnded(this._sceneUp); this._sceneUp = null }
      return
    }
    if (this.lessons.holding) {
      this.jumpWasDown = controls.jump
      const learnt = this.lessons.step(dt, controls)
      // He stopped to read the line: still, so that the compass he was told to take out is steady enough to come up.
      if (learnt === 'compass') { this.body.vel.set(0, 0, 0); this.compass.glance() }
      if (learnt === 'suit') this._leapIntoSuit()
      if (learnt === 'fall' && controls.retry) this.reset() // the lesson said R; he took it at its word
      if (learnt) this.save()
      return
    }
    if (controls.pause || controls.lostMouse || controls.away || controls.menu) { this._pause(); return }
    // Until the gull has acted and said its piece he stands at the rail: his head turns, his feet
    // don't, so that the swoop and the words find him where the story opens.
    if (this._gullBusy()) {
      this.jumpWasDown = controls.jump
      this._turnHead(controls, dt)
      this.smoker.update(dt)
      this._stepGull(dt)
      this.story.step(dt, controls, this.body.pos)
      return
    }
    if (this.story.step(dt, controls, this.body.pos)) return
    if (this._offerLesson()) return
    if (controls.retry) { this.reset(); return }
    const jumpPressed = controls.jump && !this.jumpWasDown
    this.jumpWasDown = controls.jump

    this._turnHead(controls, dt)
    this.strafe = controls.moveX

    if (this.flying && !controls.jump) { this.flying = false; foot.fold(this.runner) }
    else if (!this.flying && this.runner.mode === 'air' && jumpPressed && !foot.canJump(this.runner)
      && this.body.pos.y - this.world.floorAt(this.body.pos.x, this.body.pos.y, this.body.pos.z) > 4) {
      this.flying = true
      wing.open(this.suit)
    }

    this._throwHook(dt, controls)
    if (controls.flick && this._askedForLight()) this.smoker.lend()
    if (this.flying) {
      const floor = this.world.floorAt(this.body.pos.x, this.body.pos.y, this.body.pos.z)
      wing.step(this.suit, { aim: this.aim }, {
        clearance: this.body.pos.y - floor,
        updraft: this.world.updraftAt(this.body.pos, this.body.pos.y - floor, this.aim),
        brush: 0,
      }, dt)
      _probe.copy(this.body.pos).addScaledVector(EYE_UP, 0.9)
      if (this.world.pushOutOfSolids(_probe, foot.TUNING.radius, _normal)) {
        this.body.pos.add(_probe.sub(this.body.pos).addScaledVector(EYE_UP, -0.9))
        const into = this.body.vel.dot(_normal)
        if (into < 0) this.body.vel.addScaledVector(_normal, -into)
      }
      const landing = this.world.floorAt(this.body.pos.x, this.body.pos.y + 1, this.body.pos.z)
      if (this.body.pos.y <= landing && this.body.vel.y <= 0) {
        this.flying = false
        foot.touchDown(this.runner, landing)
      }
    } else {
      const did = foot.step(this.runner, { yaw: this.lookYaw, moveX: controls.moveX, moveZ: controls.moveZ, jump: controls.jump, crouch: controls.crouch }, this.world, dt)
      this.footView.felt(did, this.runner)
      if (did.landed) this._landings++
      if (this.runner.mode === 'run' || this.runner.mode === 'slide') this._reachCheckpoint()
    }
    // Whatever puts him on a floor, a wall or a ledge ends the hold; else the line draws him on.
    if (!this.flying && this.runner.mode !== 'air') this.hook.release()
    this.hook.step(this.body, dt, this.flying ? Infinity : HOOK_TOP_AFOOT)
    if (this.body.pos.y < this.world.place.abyss.lost) this.reset()
    this.smoker.update(dt)
    _chest.copy(this.body.pos).addScaledVector(EYE_UP, 0.9)
    const got = this.finds.take(_chest)
    if (got) {
      this.findCount.show(got.kind, this.finds.finds.filter((find) => this.finds.has(find.id)).length, this.finds.finds.length)
      this.save()
    }
    this.compass.step(dt, {
      pos: _chest,
      goal: this._routeGoal(),
      mode: this.runner.mode,
      flying: this.flying,
      speed: this.body.vel.length(),
      inspect: controls.inspect,
      handFree: this.smoker.handFree,
    })
    if (!this.lineup) this._meetRaccoons(dt)
    if (!this.lineup) this._stepGull(dt)
    this._saveIn -= dt
    if (this._saveIn <= 0) { this._saveIn = 1; this.save() }
  }

  _turnHead(controls, dt) {
    this.lookYaw -= (controls.lookX + controls.turnX + (this.flying ? controls.moveX * 700 * dt : 0)) * LOOK_SPEED
    this.lookPitch = THREE.MathUtils.clamp(this.lookPitch - controls.lookY * LOOK_SPEED, -1.55, 1.55)
    this.aim.set(Math.sin(this.lookYaw) * Math.cos(this.lookPitch), Math.sin(this.lookPitch), Math.cos(this.lookYaw) * Math.cos(this.lookPitch))
  }

  // The place's raccoons (`raccoon.js`): one comes up to him once he looks at him and asks for a
  // light, given by a click while he asks, the flame of the lighter held out to his cigarette.
  // Watched as he comes near, he is met at his own height: the runner, stood still, squats, once a
  // visit, and is up again when the raccoon goes (or by moving or jumping).
  _meetRaccoons(dt) {
    const { body, runner } = this
    const speed = Math.hypot(body.vel.x, body.vel.z)
    _lookFrom.copy(body.pos).y += runner.mode === 'squat' ? EYES.squatting : EYES.standing
    let near = false
    let watched = false
    for (const raccoon of this.raccoons) {
      if (raccoon.step(dt, { feet: body.pos, eye: _lookFrom, aim: this.aim, speed, flame: this.smoker.flameOut }) === 'chirr') {
        const apart = raccoon.pos.distanceTo(_lookFrom)
        this.soundtrack.effect(CHIRR, CHIRR_LOUDNESS * Math.min(1, CHIRR_NEAR / Math.max(apart, 1e-3)))
      }
      if (!raccoon.meets(body.pos)) continue
      near = true
      watched ||= raccoon.seenFrom(_lookFrom, this.aim)
    }
    if (this.flying) return
    if (!near) {
      foot.rise(runner)
      this._squatted = false
    } else if (watched && !this._squatted && runner.mode === 'run' && speed < STILL) {
      foot.squat(runner)
      this._squatted = true
    }
  }

  _startAtRaccoon() {
    const home = this.raccoons[0]?.home
    if (!home) return
    const { out, turns, level } = RACCOON_START
    for (const metres of out) {
      for (const turn of turns) {
        const way = (home.yaw ?? 0) + turn
        const x = home.x + Math.sin(way) * metres
        const z = home.z + Math.cos(way) * metres
        const y = this.world.floorAt(x, home.y + level, z)
        if (Math.abs(y - home.y) > level) continue
        this.reset({ x, y, z, yaw: Math.atan2(home.x - x, home.z - z) })
        return
      }
    }
  }

  /** The raccoon a light can be given to now (`Raccoon.takesLight`), or null. */
  _askedForLight() {
    return this.raccoons.find((raccoon) => raccoon.takesLight(this.body.pos, this.aim)) ?? null
  }

  // Whether the raccoon's first scene waits: while he comes to ask, is lit and thanks, so that the
  // card opens on what has been done, not over it. Asked too long without a light, it waits no more.
  _raccoonBusy() {
    const raccoon = this.raccoons[0]
    if (!raccoon) return false
    const { mode, modeFor } = raccoon
    if (mode === 'asking') return modeFor < ASK_PATIENCE
    return mode === 'rising' || mode === 'waving' || mode === 'walking' || mode === 'catching' || mode === 'thanking'
  }

  // A lesson put up when its moment comes: the compass once he has taken a few steps with a hand
  // free for it, the suit at the first edge he runs to (or his first long drop, if he jumped before
  // the edge was seen), the slide a few landings later at a run, R at his first steep fall, the
  // hook at his next run once the last feather is taken.
  _offerLesson() {
    if (this.lineup || !this.story.language) return false
    const { language } = this.story
    const { touch } = this.input
    const { body, runner } = this
    const afoot = !this.flying && (runner.mode === 'run' || runner.mode === 'slide')
    const drop = body.pos.y - this.world.floorAt(body.pos.x, body.pos.y, body.pos.z)
    if (this.lessons.due('compass')) {
      const footed = afoot && runner.mode === 'run' && this.smoker.handFree && runner.strides >= 3
      return footed && this.lessons.offer('compass', language, touch)
    }
    if (this.lessons.due('suit')) {
      const airborne = !this.flying && runner.mode === 'air' && body.vel.y < 0 && drop > EDGE_DROP
      return (airborne || this._edgeAhead()) && this.lessons.offer('suit', language, touch)
    }
    if (this.lessons.due('slide') && this._landings >= SLIDE_LANDINGS && afoot && runner.mode === 'run'
      && Math.hypot(body.vel.x, body.vel.z) >= SLIDE_PACE) return this.lessons.offer('slide', language, touch)
    if (this.lessons.due('hook') && afoot && runner.mode === 'run' && this._hookEarned()) return this.lessons.offer('hook', language, touch)
    if (this.lessons.due('fall') && !this.flying && runner.mode === 'air' && body.vel.y < -FALL_SPEED && drop > FALL_DROP) {
      return this.lessons.offer('fall', language, touch)
    }
    return false
  }

  // Whether he runs at an edge with air under it for the suit (`EDGE_*`); the level way he runs
  // is left in `_edgeWay`.
  _edgeAhead() {
    const { body, runner } = this
    if (this.flying || (runner.mode !== 'run' && runner.mode !== 'slide')) return false
    const pace = Math.hypot(body.vel.x, body.vel.z)
    if (pace < EDGE_PACE) return false
    _edgeWay.set(body.vel.x / pace, 0, body.vel.z / pace)
    return EDGE_AHEAD.some((ahead) => this.world.floorAt(body.pos.x + _edgeWay.x * ahead, body.pos.y + 0.5,
      body.pos.z + _edgeWay.z * ahead) < body.pos.y - EDGE_DROP)
  }

  // The suit's lesson learnt with Space still held: off the edge he ran at, the suit open, at
  // his run at least, so that the held Space flies it.
  _leapIntoSuit() {
    if (this.runner.mode !== 'air') {
      const pace = Math.max(Math.hypot(this.body.vel.x, this.body.vel.z), foot.TUNING.runSpeed)
      foot.fold(this.runner)
      this.body.vel.set(_edgeWay.x * pace, LEAP_RISE, _edgeWay.z * pace)
    }
    this.flying = true
    wing.open(this.suit)
  }

  // Where he is put back by R and the abyss: the route's running point he last reached on his
  // feet, facing along the route (`CHECKPOINT_*`). Starting over forgets it.
  _reachCheckpoint() {
    const { body } = this
    for (const point of this._checkpoints) {
      if (point === this.world.respawn) continue
      const dy = body.pos.y - point.y
      if (dy < -CHECKPOINT_RISE || dy > CHECKPOINT_RISE) continue
      if (Math.hypot(body.pos.x - point.x, body.pos.z - point.z) > CHECKPOINT_NEAR) continue
      this.world.respawn = point
      this.save()
      return
    }
  }

  // The route's running points as checkpoints, each facing the point after it.
  _routeCheckpoints() {
    const par = this.world.place.par ?? []
    return par.map((point, i) => {
      if (point.do !== 'run') return null
      const next = par[i + 1] ?? point
      const yaw = next === point ? 0 : Math.atan2(next.x - point.x, next.z - point.z)
      return { x: point.x, y: point.y, z: point.z, yaw }
    }).filter(Boolean)
  }

  // The gull's first two perches are set before him where the story opens: the same spot twice,
  // so that after the snatch it comes back down across from him for the words. On a rail or a
  // parapet if one stands there, else on his floor. The rest of its perches are the record's.
  _stageRoof() {
    const gull = this.crows[0]
    const at = this._balcony()
    if (!gull || !at || this.lineup) return
    // Forward is (sin yaw, cos yaw); his right is (-cos yaw, sin yaw).
    const x = at.x + Math.sin(at.yaw) * GULL_BEFORE - Math.cos(at.yaw) * GULL_RIGHT
    const z = at.z + Math.cos(at.yaw) * GULL_BEFORE + Math.sin(at.yaw) * GULL_RIGHT
    const floor = this.world.floorAt(x, at.y + 1.6, z)
    const y = floor > at.y + 0.3 && floor <= at.y + 1.6 ? floor : at.y + GULL_UP
    const perch = { x, y, z, yaw: at.yaw + Math.PI }
    gull.perches.splice(0, 1, perch, { ...perch, stay: true })
    gull.reset()
    this._gullPerch = perch
  }

  // The balcony rail where the story opens, whatever the save's checkpoint: the record's start by that name.
  _balcony() {
    if (this._balconyAt) return this._balconyAt
    const start = this.world.place.starts?.balcony ?? this.world.place.start
    // Stood back from the rail (`START_BACK` m), so that the eye is not pressed against it or the roof's edge.
    const back = this.world.place.starts?.balcony ? START_BACK : 0
    const x = start.x - Math.sin(start.yaw) * back
    const z = start.z - Math.cos(start.yaw) * back
    const y = this.world.floorAt(x, start.y + 1, z)
    this._balconyAt = { x, y: Math.abs(y - start.y) < 1 ? y : start.y, z, yaw: start.yaw }
    return this._balconyAt
  }

  // His eyes on the gull on its perch, at once: for the start and for the words.
  _lookAtGull() {
    const perch = this._gullPerch
    if (!perch) return
    const dx = perch.x - this.body.pos.x, dz = perch.z - this.body.pos.z
    const dy = perch.y + 0.25 - (this.body.pos.y + this.footView.eye)
    this.lookYaw = Math.atan2(dx, dz)
    this.lookPitch = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.2, 1.2)
    this.aim.set(Math.sin(this.lookYaw) * Math.cos(this.lookPitch), Math.sin(this.lookPitch), Math.cos(this.lookYaw) * Math.cos(this.lookPitch))
  }

  // Before the first scene the gull is left to act: it eyes him, swoops and takes the cigarette,
  // then settles back on the rail across from him; the words wait for that (`story.waits`).
  _gullBusy() {
    const gull = this.crows[0]
    if (!gull || this.lineup || !this.story.language || this.story.seen.has('roof-morning')) return false
    return !(gull.carrying && gull.mode === 'perched')
  }

  _stepGull(dt) {
    const gull = this.crows[0]
    if (!gull) return
    const did = gull.step(dt, { feet: this.body.pos, speed: Math.hypot(this.body.vel.x, this.body.vel.z), cigarette: this.smoker.heldAt })
    if (did === 'snatch') { this.smoker.quit(); gull.sit(1); this._lookAtGull() } // it has the cigarette: back beside him at once, and the words follow
  }

  // After the first roof scene the gull leaves along the first route, over it, and he sees the way;
  // the music comes in.
  _sceneEnded(id) {
    if (id !== 'roof-morning') return
    this.soundtrack.begin()
    const path = (this.world.place.par ?? []).filter((point) => point.way === 'gull-voron')
      .filter((point, i) => i > 0 && i % GULL_EVERY === 0)
      .map((point) => ({ x: point.x, y: point.y + GULL_OVER, z: point.z }))
    this.crows[0]?.fly?.(path)
  }

  // Whether the hook is his: every feather the place has is taken, and it has some to take.
  _hookEarned() {
    return this.finds.finds.some((find) => find.kind === 'feather') && this.finds.allTaken('feather')
  }

  // The hook's button, once every feather is taken. A press throws the line at whatever is
  // under the sight and goes on trying for a moment if nothing is in reach; letting go lets go.
  // In the air (a jump, a wall, the suit) every hook button throws; on his feet only Q does,
  // since the others are his slide there.
  _throwHook(dt, controls) {
    const { hook, body, runner } = this
    if (!controls.hook || !this._hookEarned()) {
      hook.release()
      this.hookAsked = HOOK_BUFFER_SECONDS
      return
    }
    if (hook.attached || this.hookAsked <= 0) return
    const afoot = !this.flying && runner.mode !== 'air' && runner.mode !== 'wall'
    if (afoot && !controls.hookAlone) { this.hookAsked = 0; return } // a slide, not a throw
    this.hookAsked -= dt
    _eye.copy(body.pos).addScaledVector(EYE_UP, this.flying ? 1.3 : this.footView.eye)
    if (!this.world.solidAlong(_eye, this.aim, HOOK_REACH, _anchor)) return
    hook.attach(_anchor, body.pos)
    this.hookAsked = 0
    if (this.flying || runner.mode === 'air') return
    // Caught from his feet or a wall: pulled off them, up off the floor, into the air.
    _from.subVectors(_anchor, body.pos).normalize()
    const pitch = Math.max(Math.asin(THREE.MathUtils.clamp(_from.y, -1, 1)), HOOK_YANK_PITCH)
    const level = Math.hypot(_from.x, _from.z) || 1
    body.vel.set(_from.x / level * Math.cos(pitch), Math.sin(pitch), _from.z / level * Math.cos(pitch)).multiplyScalar(HOOK_YANK)
    foot.fold(runner)
  }

  // The hook's line, from his right hand to where it holds.
  _presentRope() {
    const { line, knot } = this.rope
    line.visible = knot.visible = this.hook.attached
    if (!this.hook.attached) return
    const { anchor } = this.hook
    const ends = line.geometry.attributes.position
    this.view.camera.updateMatrixWorld()
    this.view.camera.localToWorld(_hand.copy(HOOK_HAND))
    ends.setXYZ(0, _hand.x, _hand.y, _hand.z)
    ends.setXYZ(1, anchor.x, anchor.y, anchor.z)
    ends.needsUpdate = true
    knot.position.copy(anchor)
  }

  // Whom the story sends him to next (`CourierStory.destination`), where they are now: the gull
  // on the roof and the raccoon by the shaft go about, Raven, Tamara and the pipe's resident
  // stand by their spots. One gone off from their spot (the gull after his cigarette, or flown
  // away) or never seen (Gavrilov, behind the grille) leaves the spot itself as the goal.
  _routeGoal() {
    const spot = this.lineup ? null : this.story.destination
    if (!spot) return null
    const at = this._spots[spot] ?? null
    const who = spot === 'roof' ? this.crows[0]?.mode !== 'gone' && this.crows[0]?.pos
      : spot === 'raccoon' ? this.raccoons[0]?.pos
        : this._people?.[spot]?.position
    return who && at && Math.hypot(who.x - at.x, who.z - at.z) < NPC_STRAY ? who : at
  }

  // `found` is the ids of the finds taken, `taught` the lessons. A save from before either has
  // none, and loses nothing.
  save() {
    if (this.lineup) return
    saveWrite({ position: { x: this.body.pos.x, y: this.body.pos.y, z: this.body.pos.z, yaw: this.lookYaw }, story: this.story.snapshot(), found: this.finds.snapshot(), taught: this.lessons.snapshot(), checkpoint: this.world.respawn ?? undefined })
  }

  // A held line is still a real object. If its bounds leave the picture, ease the eye
  // toward it until the whole line can be read, without moving the speaker or the text.
  _keepDialogueVisible(dt) {
    const storyView = this.story.view
    if (storyView.mode !== 'dialogue') return
    const signs = [storyView.words, ...storyView.choiceSigns]
      .map((sign) => sign.mesh).filter((mesh) => mesh.visible)
    if (!signs.length) return
    const camera = this.view.camera
    camera.updateMatrixWorld()
    let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity
    _speechCenter.set(0, 0, 0)
    for (const mesh of signs) {
      const bounds = mesh.geometry.boundingBox ?? (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox)
      mesh.updateWorldMatrix(true, false)
      bounds.getCenter(_speechPoint).applyMatrix4(mesh.matrixWorld)
      _speechCenter.add(_speechPoint)
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) {
        _speechPoint.set(x, y, 0).applyMatrix4(mesh.matrixWorld).project(camera)
        left = Math.min(left, _speechPoint.x)
        right = Math.max(right, _speechPoint.x)
        bottom = Math.min(bottom, _speechPoint.y)
        top = Math.max(top, _speechPoint.y)
      }
    }
    _speechCenter.multiplyScalar(1 / signs.length).sub(camera.position)
    const behind = _speechCenter.dot(camera.getWorldDirection(_speechPoint)) <= 0
    const horizontal = behind || left < -.82 || right > .82
    const vertical = !behind && (bottom < -.72 || top > .72)
    if (!horizontal && !vertical) return
    if (horizontal) {
      const yaw = Math.atan2(_speechCenter.x, _speechCenter.z)
      const difference = Math.atan2(Math.sin(yaw - this.lookYaw), Math.cos(yaw - this.lookYaw))
      this.lookYaw += difference * Math.min(1, dt * 2.5)
    }
    if (vertical) {
      const pitch = Math.atan2(_speechCenter.y, Math.hypot(_speechCenter.x, _speechCenter.z))
      this.lookPitch = THREE.MathUtils.clamp(this.lookPitch + (pitch - this.lookPitch) * Math.min(1, dt * 2.5), -1.55, 1.55)
    }
    this.aim.set(Math.sin(this.lookYaw) * Math.cos(this.lookPitch), Math.sin(this.lookPitch), Math.cos(this.lookYaw) * Math.cos(this.lookPitch))
  }

  // Draws through `picture` (picture.js), the renderer's stand-in: ink, mist, glow and lens.
  render(picture, dt, ahead) {
    this.footView.present(dt, this.flying ? null : this.runner, this.strafe, this.lookYaw, ahead)
    const speed = this.body.vel.length()
    _from.copy(this.body.pos).addScaledVector(EYE_UP, 0.9)
    _eye.copy(this.body.pos).addScaledVector(EYE_UP, this.flying ? 1.3 : this.footView.eye)
    this.view.update(dt, _eye, this.aim, EYE_UP, speed, this.flying ? this.body.bank : this.footView.bank, this.footView.kick, this.footView.nod, _from)
    this._presentRope()
    this.story.view.present(this.view.camera, dt)
    this.lessons.present(this.view.camera.fov)
    this.story.present?.(this.view.camera)
    this.atmosphere.present(dt, _eye, 0, this.body.pos, 0)
    this.world.present(this.body.pos, dt)
    this.world.showCrows(this.crows, dt, ahead, this.body.pos, this.effects)
    this.world.showRaccoons(this.raccoons, dt, ahead, _eye, this.effects)
    this.world.showFinds(this.finds, _eye, dt)
    this.ravenFigure?.show(this.raven, dt, ahead, _eye, this.effects)
    const mover = this.flying ? null : this.runner
    const pace = mover?.mode === 'climb' ? mover._climb.speed : speed
    this.compass.present(dt, this.lookYaw)
    this.smoker.present(dt, {
      lendTo: this.lineup ? null : this._askedForLight()?.tipAt(_lendTip) ?? null,
      carry: this.compass.lift,
      flying: this.flying,
      firstPerson: true,
      vel: this.body.vel,
      aim: this.aim,
      afoot: mover ? { mode: mover.mode, wallSide: mover.wallSide, share: mover.mode === 'climb' ? 1 : Math.min(1, pace / foot.TUNING.runSpeed), rise: this.body.vel.y, climb: mover._climb?.gone ?? 0 } : null,
    })
    this.effects.update(dt, 0, speed, 0)
    const { glow, lens, shade } = this.world.level.theme
    const mists = this.world.level.mists.flatMap((name) => MISTS[name] ?? [])
    const language = this.story.view.showingLanguage
    picture.setLook({ glow, lens: { ...lens, tunnel: language || this.paused ? 0 : this.footView.tunnel * (lens?.tunnel ?? TUNNEL) }, mists: language || this.paused ? [] : mists, air: this.atmosphere.air, flow: this._flow, blur: language || this.paused ? 0 : this.footView.smear, punch: 0, cel: true, shade })
    if (this.paused && this.pauseMenu.dirty) {
      picture.capture(this.scene, this.view.camera, this.pauseMenu.preview)
      this.pauseMenu.dirty = false
    }
    picture.render(this.paused ? this.pauseMenu.scene : language ? this.story.view.menuScene : this.scene,
      this.paused ? this.pauseMenu.camera : language ? this.story.view.menuCamera : this.view.camera)
  }
}
