// A small, isolated conversation room for checking all five characters and both scripts.
// It borrows the world's materials and movement, but has no route or saved progress.
import { LISTS } from './place-file.js'
import { COURIER_SCENES, COURIER_WORDS } from './courier-script.js'
import { CourierStory } from './courier.js'
import { SaidSign } from './said-sign.js'

const TALK_REACH = 5.5

export const LINEUP_CAST = [
  { name: 'Gull', spot: 'roof', scene: 'roof-morning', x: -7 },
  { name: 'Tamara', spot: 'tamara', scene: 'tamara-one', x: -3.5 },
  { name: 'Raccoon', spot: 'raccoon', scene: 'raccoon-one', x: 0 },
  { name: 'Pipe resident', spot: 'pipe', scene: 'pipe-two', x: 3.5 },
  { name: 'Raven', spot: 'works', scene: 'radio', x: 7 },
]

export function lineupPlace(place) {
  for (const list of Object.keys(LISTS)) place[list] = []
  place.abyss = { lost: -30 }
  place.mists = []
  place.start = { x: 0, y: 0, z: -3, yaw: 0 }
  place.boxes = [
    { x0: -12, x1: 12, y0: -1, y1: 0, z0: -8, z1: 15, look: 'steel' },
    { x0: -12, x1: -11.5, y0: 0, y1: 3, z0: -8, z1: 15, look: 'concrete' },
    { x0: 11.5, x1: 12, y0: 0, y1: 3, z0: -8, z1: 15, look: 'concrete' },
    { x0: -12, x1: 12, y0: 0, y1: 3, z0: 14.5, z1: 15, look: 'concrete' },
  ]
  place.courier = { spots: Object.fromEntries(LINEUP_CAST.map(({ spot, x }) => [spot, { x, y: 0, z: 8, radius: 3 }])) }
  place.crows = [{ perches: [{ x: -7, y: 0, z: 8, yaw: Math.PI }] }]
  place.raccoons = [{ x: 0, y: 0, z: 8, yaw: Math.PI }]
  return place
}

export class NPCLineup extends CourierStory {
  constructor(input, place, onEvent, presentation) {
    super(input, place, onEvent, presentation)
    this.prompt = new SaidSign(presentation.scene, { wrap: 18, share: .038 })
    this.nearby = null
  }

  step(dt, controls, position) {
    if (this.card) {
      this.nearby = null
      return super.step(dt, controls, position)
    }
    this.nearby = LINEUP_CAST.reduce((nearest, person) => {
      const distance = Math.hypot(position.x - person.x, position.z - 8)
      return distance < TALK_REACH && (!nearest || distance < nearest.distance)
        ? { person, distance } : nearest
    }, null)?.person ?? null
    if (!this.nearby || !controls.interact) return false
    if (this.nearby.scene === 'radio') {
      this._openRadio(0)
      this.view.setAnchor(this.spots.works)
    } else this._openScene(COURIER_SCENES.findIndex(({ id }) => id === this.nearby.scene))
    this.nearby = null
    return true
  }

  present(camera) {
    if (!this.language || this.card || !this.nearby) {
      this.prompt.show(null)
      return
    }
    const at = this.spots[this.nearby.spot]
    this.prompt.show({
      id: LINEUP_CAST.indexOf(this.nearby) + 1,
      text: COURIER_WORDS[this.language].interact,
      typed: Infinity,
      at: { x: at.x, y: at.y + 1.15, z: at.z },
      clear: .8,
    }, camera.position, camera.fov)
  }
}
