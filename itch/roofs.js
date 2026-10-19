// A place's roofs: every top a runner can stand on, from above, coloured by its height, for the
// pages that draw a place in plan (`plan.html`, `routes.html`). Boxes' tops are rectangles, the
// ground faces of its forms and of its assets' forms triangles. Look only.
//
// `roofsOf(place)` gives `{ lo, hi, color(y), at([x, z], band), draw(g, view, size, band) }`. A
// `band` (`{ min, max }`, either null) keeps only the roofs between those heights: the city stacks
// its tiers, and from above the one being drawn on is hidden under the others. `view` is the
// pages' own: the world point at the picture's centre (`cx`, `cz`) and pixels a metre (`ppm`),
// looking down +Z with +Z up the screen and +X on the left.
import { buildForm } from '/src/forms.js'
import { buildAsset } from '/src/assets.js'

const GROUND = 0.5 // a face rising at least this (its normal's up) is ground, as `faces.js` has it
const COLORS = [[44, 62, 120], [63, 167, 160], [232, 211, 106]] // low, middle, high
// The roofs as one path a shade, lowest shade first so that the higher are drawn over: a few dozen
// fills a picture and not one a triangle (43,000 on the balcony with its city).
const SHADES = 48
const CELL = 32 // metres: the side of a cell of the grid the roofs under a point are looked up by

function inside(corners, [x, z]) {
  let hit = false
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const [xi, zi] = corners[i]
    const [xj, zj] = corners[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit
  }
  return hit
}

const within = (y, band) => !band || ((band.min == null || y >= band.min) && (band.max == null || y <= band.max))

function piecesOf(place) {
  const lost = place.abyss?.lost ?? -Infinity
  const pieces = []
  for (const box of place.boxes ?? []) {
    if (box.y1 <= lost || box.x1 - box.x0 >= 500) continue
    pieces.push({ y: box.slope ? Math.max(box.slope.from, box.slope.to) : box.y1, corners: [[box.x0, box.z0], [box.x1, box.z0], [box.x1, box.z1], [box.x0, box.z1]] })
  }
  const forms = [...(place.forms ?? []), ...(place.assets ?? []).flatMap((instance) => buildAsset(instance).forms)]
  for (const form of forms) {
    for (const face of buildForm(form).faces) {
      if (face.normal.y < GROUND) continue
      const y = Math.max(face.a.y, face.b.y, face.c.y)
      if (y > lost) pieces.push({ y, corners: [[face.a.x, face.a.z], [face.b.x, face.b.z], [face.c.x, face.c.z]] })
    }
  }
  return pieces.sort((a, b) => a.y - b.y)
}

export function roofsOf(place) {
  const pieces = piecesOf(place)
  // The colours span the heights most roofs are at, not the one spire far over them.
  const heights = pieces.map(({ y }) => y)
  const share = (s) => heights[Math.min(heights.length - 1, Math.floor(s * heights.length))] ?? 0
  const lo = share(0.05)
  const hi = share(0.95) > lo ? share(0.95) : lo + 1
  const level = (y) => Math.max(0, Math.min(1, (y - lo) / (hi - lo)))

  function color(y) {
    const t = level(y) * (COLORS.length - 1)
    const i = Math.min(COLORS.length - 2, Math.floor(t))
    const [a, b] = [COLORS[i], COLORS[i + 1]]
    return `rgb(${a.map((c, k) => Math.round(c + (b[k] - c) * (t - i))).join(',')})`
  }

  // Each piece in every cell its box covers, in the order they are drawn.
  const cells = new Map()
  pieces.forEach(({ corners }, i) => {
    const xs = corners.map(([x]) => x)
    const zs = corners.map(([, z]) => z)
    for (let cx = Math.floor(Math.min(...xs) / CELL); cx <= Math.floor(Math.max(...xs) / CELL); cx++)
      for (let cz = Math.floor(Math.min(...zs) / CELL); cz <= Math.floor(Math.max(...zs) / CELL); cz++) {
        const key = `${cx},${cz}`
        if (!cells.has(key)) cells.set(key, [])
        cells.get(key).push(i)
      }
  })

  /** The highest roof over the point [x, z] within `band`, or null. */
  function at([x, z], band = null) {
    const here = cells.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []
    for (let k = here.length - 1; k >= 0; k--) {
      const { y, corners } = pieces[here[k]]
      if (within(y, band) && inside(corners, [x, z])) return y
    }
    return null
  }

  const paths = new Map() // by band
  function pathsIn(band) {
    const key = `${band?.min ?? ''}:${band?.max ?? ''}`
    if (paths.has(key)) return paths.get(key)
    const shades = new Map()
    for (const { y, corners } of pieces) {
      if (!within(y, band)) continue
      const shade = Math.round(level(y) * (SHADES - 1))
      if (!shades.has(shade)) shades.set(shade, new Path2D())
      const path = shades.get(shade)
      corners.forEach(([x, z], i) => path[i ? 'lineTo' : 'moveTo'](x, z))
      path.closePath()
    }
    const made = [...shades].sort(([a], [b]) => a - b).map(([shade, path]) => ({ color: color(lo + (shade / (SHADES - 1)) * (hi - lo)), path }))
    paths.set(key, made)
    return made
  }

  // Drawn once into a picture of their own, and that picture laid down again until the view, the
  // size or the band changes.
  const picture = document.createElement('canvas')
  let drawn = ''
  function draw(g, view, size, band = null) {
    const ratio = devicePixelRatio
    const key = `${view.cx},${view.cz},${view.ppm},${size.w},${size.h},${ratio},${band?.min ?? ''},${band?.max ?? ''}`
    if (drawn !== key) {
      picture.width = Math.round(size.w * ratio)
      picture.height = Math.round(size.h * ratio)
      const own = picture.getContext('2d')
      const { ppm, cx, cz } = view
      // The world drawn straight through the view, as the pages' `toScreen` has it.
      own.setTransform(-ppm * ratio, 0, 0, -ppm * ratio, (size.w / 2 + cx * ppm) * ratio, (size.h / 2 + cz * ppm) * ratio)
      own.lineWidth = 0.6 / ppm // over the hairline seams between a roof's triangles
      for (const { color: fill, path } of pathsIn(band)) {
        own.fillStyle = own.strokeStyle = fill
        own.fill(path)
        own.stroke(path)
      }
      drawn = key
    }
    g.save()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.drawImage(picture, 0, 0)
    g.restore()
  }

  return { lo, hi, color, at, draw }
}
