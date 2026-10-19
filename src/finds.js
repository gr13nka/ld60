// Things left about the megastructure for the courier to come upon (`finds` in the place file):
// matches dropped by couriers before him and the gull's feathers. Each is known by its `id`,
// which is what the save keeps, so a find moved in the place stays taken and a new one is new.
// Pure: the game says where he is, `ParkourWorld.showFinds` draws what this answers.

/**
 * The kinds, by the name a record's `kind` gives. `size`: metres across; `lift`: metres it
 * hangs over the floor under its point; `takeRadius`: metres from the middle of his body at
 * which it is taken; `glintFrom`: metres at which it begins to be seen at all.
 * - `match`: one of a courier's forty-two, dropped and never counted back; by a corner.
 * - `feather`: the gull's, hung above a gap or an updraft.
 */
export const FINDS = {
  match: { color: 0xe3b84a, size: 0.3, lift: 2.6, takeRadius: 2.2, glintFrom: 120 },
  feather: { color: 0xeef3f7, size: 0.5, lift: 2.6, takeRadius: 3, glintFrom: 160 },
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

export class Finds {
  /** `finds`: `{ id, kind, x, y, z }` each, at the point where it hangs (`ParkourWorld.rules.finds`). */
  constructor(finds) {
    this.finds = finds
    this.taken = new Set() // ids
  }

  /** Whether the find `id` is taken. */
  has(id) {
    return this.taken.has(id)
  }

  /** Whether every find of `kind` the place has is taken; so too where it has none. All the feathers open the hook. */
  allTaken(kind) {
    return this.finds.every((find) => find.kind !== kind || this.taken.has(find.id))
  }

  /** The ids taken, for the save. Ids the place no longer has are kept: the find may come back. */
  snapshot() {
    return [...this.taken]
  }

  /** Takes back what a save says was taken; anything not a string is passed over. */
  restore(ids) {
    for (const id of Array.isArray(ids) ? ids : []) if (typeof id === 'string') this.taken.add(id)
  }

  /** Where he is (the middle of his body): the find taken on this step, or null. One at a time. */
  take(pos) {
    for (const find of this.finds) {
      if (this.taken.has(find.id) || distance(pos, find) > FINDS[find.kind].takeRadius) continue
      this.taken.add(find.id)
      return find
    }
    return null
  }

  /** The untaken finds of `kind`, each with its `distance` from `pos`, nearest first. */
  around(pos, kind) {
    return this.finds
      .filter((find) => find.kind === kind && !this.taken.has(find.id))
      .map((find) => ({ find, distance: distance(pos, find) }))
      .sort((a, b) => a.distance - b.distance)
  }

  /** How much of itself `find` shows him at `pos`: 0 (nothing, or taken) to 1 (all of it). */
  glint(pos, find) {
    if (this.taken.has(find.id)) return 0
    const t = 1 - distance(pos, find) / FINDS[find.kind].glintFrom
    return t <= 0 ? 0 : Math.min(1, t * 1.5)
  }
}
