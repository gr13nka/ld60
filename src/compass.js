// The courier's compass: what each part points at, and when the left hand holds it up. The look
// is `compass-model.js`'s. Decided on the game's fixed steps (`step`), shown once a frame
// (`present`). It is no HUD: kept out of view, glanced at once when a find comes near and it is
// safe to look, held up while the player asks (`inspect`), and put away for anything else.
//
// Its route bar points at whoever the story sends him to next, by way of the place's crossings
// (`courier.crossings`): a bridge's two ends, so the needle does not point across the gap the
// bridge goes round. Guidance, not a path: nothing is searched.

import { FINDS } from './finds.js'

// When it may be up at all: on his feet, slower than this (m/s, with hysteresis), the hand free.
const STEADY = { under: 9, over: 11 }
const STANDING = new Set(['run', 'squat', 'sit']) // the runner's modes with his feet on a floor
// When a find may be glanced at unasked: slower still, as a walk or a stop.
const CALM = { under: 5, over: 7 }
// A find comes near at `enter` metres and has gone again past `leave`; each coming is one invitation.
const NEAR = { enter: 18, leave: 26 }
const GLANCE_SECONDS = 1.6 // how long a glance holds it up
const GLANCE_COOLDOWN = 10 // seconds after one before the next
const RAISE_SECONDS = 0.35 // from out of view to up
const LOWER_SECONDS = 0.3 // and back, when it is done with
const STOW_SECONDS = 0.12 // and back when the moment needs the hand or the view
// A nearer find of the same kind takes over the part only when it is this much nearer, so two
// alike in distance do not make the part flick between them.
const SWITCH_SHARE = 0.8
const SWITCH_METRES = 3

const KINDS = Object.keys(FINDS)
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

// Hidden, raising, up and lowering, as `lift` (0 to 1) and which way it is going. Told on each
// step whether it should be up and whether to hurry down.
class Presence {
  constructor() {
    this.lift = 0
    this._wanted = false
  }

  get state() {
    if (this._wanted) return this.lift >= 1 ? 'up' : 'raising'
    return this.lift <= 0 ? 'hidden' : 'lowering'
  }

  step(dt, wanted, hurry) {
    this._wanted = wanted
    const rate = wanted ? 1 / RAISE_SECONDS : -1 / (hurry ? STOW_SECONDS : LOWER_SECONDS)
    this.lift = Math.min(1, Math.max(0, this.lift + rate * dt))
  }

  reset() {
    this.lift = 0
    this._wanted = false
  }
}

export class Compass {
  /**
   * `finds`: the place's `Finds`; `crossings`: its `courier.crossings`, `{ a, b, radius }`
   * each; `model`: the `CompassModel` it moves. `root` is what the hand holds (`Smoker.carry`).
   */
  constructor(finds, crossings, model) {
    this._finds = finds
    this._crossings = crossings
    this._model = model
    this.root = model.root
    this._presence = new Presence()
    this._steady = false
    this._calm = false
    this._near = new Set() // ids of the finds within `NEAR` now
    this._invited = null // the id of a find come near that has not had its glance yet
    this._glance = 0 // seconds of glance left
    this._cooldown = 0
    this._targets = { match: null, feather: null } // the find each part follows, by kind
    this._readings = { route: null, match: null, feather: null }
  }

  /** How far up it is held, 0 to 1: `Smoker.present`'s `carry`. */
  get lift() {
    return this._presence.lift
  }

  /** Out of view at once, nothing owed: a respawn. Finds already near are not glanced at again. */
  reset() {
    this._presence.reset()
    this._glance = 0
    this._invited = null
    this._model.settle()
  }

  /** Held up for one glance, as for a find come near, if he is steady enough to look: the lesson's. */
  glance() {
    this._glance = GLANCE_SECONDS
    this._model.voice.clack()
  }

  /**
   * One fixed step. `facts` is null while play is held (a story card, the pause, the editor, the
   * language): it is put away. Otherwise `{ pos, goal, mode, flying, speed, inspect, handFree }`:
   * the middle of his body; the point the route leads to (the one to meet, where they stand
   * now), or null for none; the runner's mode;
   * whether he is in the suit; m/s; whether the player asks to read it; whether the left hand is
   * free of the habit (`Smoker.handFree`).
   */
  step(dt, facts) {
    this._cooldown = Math.max(0, this._cooldown - dt)
    if (!facts) {
      this._glance = 0
      this._presence.step(dt, false, true)
      return
    }
    const { pos, goal, mode, flying, speed, inspect, handFree } = facts
    const footed = !flying && STANDING.has(mode) && handFree
    this._steady = footed && speed < (this._steady ? STEADY.over : STEADY.under)
    this._calm = this._steady && speed < (this._calm ? CALM.over : CALM.under)

    this._follow(pos)
    this._readings.route = goal ? this._reading(pos, this._routeAim(pos, goal)) : null
    this._invite(pos)

    if (!this._steady) this._glance = 0
    else if (this._invited && this._calm && this._cooldown <= 0 && !inspect) {
      this._invited = null
      this._glance = GLANCE_SECONDS
      this._cooldown = GLANCE_COOLDOWN
      this._model.voice.clack()
    }
    this._glance = Math.max(0, this._glance - dt)
    const wanted = this._steady && (inspect || this._glance > 0)
    if (wanted && inspect && this._presence.state === 'hidden') this._model.voice.clack()
    this._presence.step(dt, wanted, !this._steady)
  }

  /** Once a frame: the parts moved toward what they point at. `yaw` is the view's. */
  present(dt, yaw) {
    if (this._presence.lift <= 0) return this._model.settle() // brought out, it swings to its bearings
    this._model.present(dt, this._readings, yaw, this._presence.lift)
  }

  // Each kind's part keeps its find until that one is taken or another is well nearer.
  _follow(pos) {
    for (const kind of KINDS) {
      // The one it followed has just been taken: its part lets go with a sound of its own.
      if (this._targets[kind] && this._finds.has(this._targets[kind])) this._model.voice[kind === 'feather' ? 'flutter' : 'clack']()
      const around = this._finds.around(pos, kind)
      const best = around[0] ?? null
      const kept = around.find(({ find }) => find.id === this._targets[kind])
      const next = !kept || (best.find !== kept.find && best.distance < kept.distance * SWITCH_SHARE - SWITCH_METRES) ? best : kept
      this._targets[kind] = next?.find.id ?? null
      this._readings[kind] = next ? this._reading(pos, next.find) : null
    }
  }

  // A find newly come near asks for one glance; it asks again only once it has gone away and come back.
  _invite(pos) {
    for (const find of this._finds.finds) {
      if (this._finds.has(find.id)) {
        this._near.delete(find.id)
        continue
      }
      const away = distance(pos, find)
      if (this._near.has(find.id)) {
        if (away > NEAR.leave) this._near.delete(find.id)
      } else if (away < NEAR.enter) {
        this._near.add(find.id)
        this._invited = find.id
      }
    }
    if (this._invited && !this._near.has(this._invited)) this._invited = null
  }

  // Where the route needle points: at the goal, or, when a crossing lies between him and it, at
  // the crossing's near end, and on it, at its far end.
  _routeAim(pos, goal) {
    let best = null
    for (const crossing of this._crossings) {
      const { a, b } = crossing
      const radius = crossing.radius ?? 4
      const mine = flat(pos, a) <= flat(pos, b) ? a : b
      const theirs = mine === a ? b : a
      if (flat(goal, theirs) >= flat(goal, mine)) continue // the goal is on his side of it
      if (onSegment(pos, a, b, radius)) return theirs
      if (!best || flat(pos, mine) < flat(pos, best)) best = mine
    }
    return best ?? goal
  }

  _reading(pos, at) {
    return { bearing: Math.atan2(at.x - pos.x, at.z - pos.z), distance: distance(pos, at), rise: at.y - pos.y }
  }
}

// Whether `pos` is on the crossing from `a` to `b`: within `radius` of the line between, on the level.
function onSegment(pos, a, b, radius) {
  const dx = b.x - a.x, dz = b.z - a.z
  const along = Math.max(0, Math.min(1, ((pos.x - a.x) * dx + (pos.z - a.z) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(pos.x - (a.x + dx * along), pos.z - (a.z + dz * along)) <= radius
}
