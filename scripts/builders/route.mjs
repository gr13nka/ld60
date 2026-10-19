// Whether there is a way over the floors of the copy from one floor to another, on a grid of 2 m
// laid inside a `mask` (a rectangle and what of it counts: `corridor` is a leg's). 'walk' is a
// person's way: steps, stairs, slopes, a rail stepped over, nothing jumped. 'run' is the runner's:
// walking, a ledge pulled up to, and a fair jump (`routes.mjs`' `fairReach`: 0.7 of what a jump at
// 28 m/s reaches). Which floors are to be joined is the order's (`ways.mjs`); this only finds them.
import { ceilingHit, floorsUnder } from './world.mjs'
import { fairReach, LIMITS } from './routes.mjs'

export { fairReach }

const CELL = 2
const HEAD = 2 // metres over a floor a body needs
const WALK_UP = 1.2
const WALK_DOWN = 3
const MANTLE = LIMITS.mantle
const MOST_DROP = LIMITS.dropMost

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** Distance on the plan from (x, z) to the segment a→b (points with x, z). */
export function toSegment(a, b, x, z) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1)
  return Math.hypot(a.x + dx * t - x, a.z + dz * t - z)
}

/** The mask of the ground within `half` metres of the segment a→b, on the plan. */
export function corridor(a, b, half) {
  return { x0: Math.min(a.x, b.x) - half, x1: Math.max(a.x, b.x) + half, z0: Math.min(a.z, b.z) - half, z1: Math.max(a.z, b.z) + half, within: (x, z) => toSegment(a, b, x, z) <= half }
}

// The floors of a cell kept per site: a leg's corridor meets its neighbours', and a floor once
// asked about is not asked about again.
const _floors = new WeakMap()
function floorsOfCell(site, i, j) {
  let cells = _floors.get(site)
  if (!cells) _floors.set(site, (cells = new Map()))
  const k = i * 65536 + j
  if (!cells.has(k)) {
    const x = (i + 0.5) * CELL
    const z = (j + 0.5) * CELL
    const col = []
    for (const floor of floorsUnder(site, x, z, 500, 1400, 1.8)) {
      const ceiling = ceilingHit(site, x, floor.y + 0.05, z)
      const head = ceiling ? ceiling.y - floor.y : Infinity
      if (head >= HEAD) col.push({ y: floor.y, key: floor.key, head })
    }
    cells.set(k, col)
  }
  return cells.get(k)
}

/** The grid of floors inside `mask` ({ x0, x1, z0, z1, within(x, z) }): `{ cols: Map(i,j → [node]), nodes }`. */
export function floorGrid(site, { x0, x1, z0, z1, within = () => true }) {
  const cols = new Map()
  const nodes = []
  for (let i = Math.floor(x0 / CELL); i <= Math.ceil(x1 / CELL); i++) {
    for (let j = Math.floor(z0 / CELL); j <= Math.ceil(z1 / CELL); j++) {
      const x = (i + 0.5) * CELL
      const z = (j + 0.5) * CELL
      if (!within(x, z)) continue
      const col = []
      for (const floor of floorsOfCell(site, i, j)) {
        const node = { id: nodes.length, i, j, x, z, ...floor }
        nodes.push(node)
        col.push(node)
      }
      if (col.length) cols.set(i * 65536 + j, col)
    }
  }
  return { cols, nodes }
}

const colAt = (grid, i, j) => grid.cols.get(i * 65536 + j) ?? []
const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]

// The floor of a neighbouring column a step from `n` lands on, by the moves of `mode`: the
// nearest in height within reach.
function stepTo(grid, n, i, j, mode) {
  let best = null
  const up = mode === 'run' ? MANTLE : WALK_UP
  for (const m of colAt(grid, i, j)) {
    const dy = m.y - n.y
    if (dy > up || dy < -WALK_DOWN) continue
    if (!best || Math.abs(dy) < Math.abs(best.y - n.y)) best = m
  }
  return best
}

// Whether `n` is at an edge: a neighbouring column has no floor a step down from it.
function atEdge(grid, n) {
  return AROUND.some(([di, dj]) => !colAt(grid, n.i + di, n.j + dj).some((m) => m.y > n.y - WALK_DOWN && m.y < n.y + MANTLE))
}

class Heap {
  constructor() {
    this.a = []
  }
  push(item, cost) {
    const a = this.a
    a.push([cost, item])
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p][0] <= a[i][0]) break
      ;[a[p], a[i]] = [a[i], a[p]]
      i = p
    }
  }
  pop() {
    const a = this.a
    const top = a[0]
    const last = a.pop()
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l][0] < a[m][0]) m = l
        if (r < a.length && a[r][0] < a[m][0]) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]
        i = m
      }
    }
    return top
  }
  get size() {
    return this.a.length
  }
}

/**
 * The way from the floor under `from` to the floor under `to` by `mode`, inside `mask` (a
 * corridor round the two by default): `{ found, path: [node], reached: Set(id), start }`. The start
 * is the node of from's column nearest from's height; the goal any node within `near` metres of
 * `to` on the plan and 3 m of its height.
 */
export function findWay(site, { mode = 'run', from, to, near = 4, mask = null }) {
  const grid = floorGrid(site, mask ?? corridor(from, to, 20))
  const startCol = colAt(grid, Math.floor(from.x / CELL), Math.floor(from.z / CELL))
  const start = startCol.reduce((best, n) => (!best || Math.abs(n.y - from.y) < Math.abs(best.y - from.y) ? n : best), null)
  if (!start) return { found: false, path: [], reached: new Set(), start: null }
  const isGoal = (n) => Math.hypot(n.x - to.x, n.z - to.z) <= near && Math.abs(n.y - to.y) < 3
  const cost = new Map()
  const back = new Map()
  const how = new Map()
  const heap = new Heap()
  cost.set(start.id, 0)
  heap.push(start, 0)
  let goal = null
  while (heap.size) {
    const [c, n] = heap.pop()
    if (c > cost.get(n.id)) continue
    if (isGoal(n)) {
      goal = n
      break
    }
    const relax = (m, add, kind) => {
      const next = c + add
      if (next < (cost.get(m.id) ?? Infinity)) {
        cost.set(m.id, next)
        back.set(m.id, n)
        how.set(m.id, kind)
        heap.push(m, next)
      }
    }
    for (const [di, dj] of AROUND) {
      const m = stepTo(grid, n, n.i + di, n.j + dj, mode)
      if (m) relax(m, CELL * Math.hypot(di, dj) + Math.max(0, m.y - n.y), 'step')
    }
    if (mode === 'run' && atEdge(grid, n)) {
      const reachMost = fairReach(MOST_DROP)
      const r = Math.ceil(reachMost / CELL)
      for (let di = -r; di <= r; di++) {
        for (let dj = -r; dj <= r; dj++) {
          if (Math.abs(di) <= 1 && Math.abs(dj) <= 1) continue
          const d = CELL * Math.hypot(di, dj)
          if (d > reachMost) continue
          for (const m of colAt(grid, n.i + di, n.j + dj)) {
            const drop = n.y - m.y
            if (drop > MOST_DROP || d > fairReach(drop)) continue
            relax(m, d + 8, 'jump')
          }
        }
      }
    }
  }
  const path = []
  for (let n = goal; n; n = back.get(n.id)) path.unshift({ ...n, how: how.get(n.id) ?? 'start' })
  return { found: !!goal, path, reached: new Set(cost.keys()), start }
}
