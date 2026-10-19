// The routes page (itch/routes.html): the story's ways from NPC to NPC, drawn over a place's roofs
// from above, every leg saying how it is crossed. What a route is, and what is wrong with one, is
// `scripts/builders/routes.mjs`'; this page only draws it and changes it there. Looking down +Z
// with +Z up the screen, world +X is on the left, as it is in the game and on the plan page.
import { roofsOf } from './roofs.js'
import { PACES, reachAt } from '/src/reach-rings.js'
import * as R from '/scripts/builders/routes.mjs'

const NAME = new URLSearchParams(location.search).get('place') ?? 'balcony'
const PLACES = import.meta.glob('/src/places/*.json', { import: 'default' })

const GRAB = 9 // pixels a point or a stop is caught within
const LEG_GRAB = 6 // pixels a leg is caught within
const SAVE_EVERY = 15000 // milliseconds between autosaves, made only when something changed
const GRID_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500]
const GRID_MIN = 24 // pixels between grid lines at the least
const LABELS_FROM = 0.6 // pixels a metre: legs' lengths are written only nearer than this
const PROFILE_HEIGHT = 220 // pixels: the profile's band under the plan
const PROFILE_GRID = [10, 25, 50, 100, 200] // metres between its height lines, the first that leaves 28 px
const VIEW_KEY = `do-not-smoke.routes-view.${NAME}` // per browser: where the view was left
const COLORS = { round: '#e8590c', branch: '#7048e8', secret: '#2b8a3e' } // the round, Gavrilov's way off it, the hidden ending's way down
const STOP_COLOR = '#1d1d1b'

const canvas = document.getElementById('canvas')
const stage = document.getElementById('stage')
const ctx = canvas.getContext('2d')
const $ = (id) => document.getElementById(id)

let file = null // the routes, as routes.mjs has them
let roofs = roofsOf({})
let view = { cx: 0, cz: 100, ppm: 1 }
let size = { w: 1, h: 1 }
let tool = 'select'
let move = 'run' // how the next leg drawn is crossed
let current = null // the id of the route picked in the panel or on the plan
let picked = null // { kind: 'point' | 'leg' | 'stop', route?, index?, stop? }
let drawing = null // a route being drawn: { route?, way?, leaves?, via, legs }
let placing = null // the id of a stop the next click stands
let drag = null
let pointer = null // [sx, sy]
let spaceHeld = false
let reachShown = false
let heightsShown = 'inferred' // which heights the legs are judged and written at: 'inferred' (`heightsOf`) or 'drawn'
let profileShown = true // the picked way's heights along it, under the plan (P)
let heights = { stops: {}, routes: {}, said: [] }
let heightsOfFile = '' // the file `heights` were inferred from
const undos = []
const redos = []

// ---- the view

const toScreen = (x, z) => [size.w / 2 - (x - view.cx) * view.ppm, size.h / 2 - (z - view.cz) * view.ppm]
const toWorld = (sx, sy) => [view.cx - (sx - size.w / 2) / view.ppm, view.cz - (sy - size.h / 2) / view.ppm]
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const metres = (v) => `${Math.round(v)} m`

function band() {
  const read = (id) => ($(id).value === '' ? null : Number($(id).value))
  const [min, max] = [read('bandMin'), read('bandMax')]
  return min == null && max == null ? null : { min, max }
}
/** A world point at [x, z], on the roof under it within the floors shown, or with its height open. */
const ground = ([x, z]) => ({ x, y: roofs.at([x, z], band()), z })

function resize() {
  const { width, height } = stage.getBoundingClientRect()
  size = { w: width, h: height }
  canvas.width = Math.round(width * devicePixelRatio)
  canvas.height = Math.round(height * devicePixelRatio)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  draw()
}

function fitAll() {
  const points = [...file.stops.map((stop) => stop.at), ...file.routes.flatMap((route) => route.via)].filter(Boolean)
  if (points.length < 2) points.push({ x: -50, z: 0 }, { x: 50, z: 100 })
  const xs = points.map((p) => p.x)
  const zs = points.map((p) => p.z)
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]
  view = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, ppm: Math.min((size.w * 0.85) / Math.max(x1 - x0, 1), (size.h * 0.85) / Math.max(z1 - z0, 1)) }
  keepView()
}

let viewTimer = 0
function keepView() {
  clearTimeout(viewTimer)
  viewTimer = setTimeout(() => {
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(view))
    } catch {}
  }, 300)
}

// ---- what is shown

const colorOf = (route) => {
  const way = R.wayOf(file, route)
  return way?.secret ? COLORS.secret : way?.branch ? COLORS.branch : COLORS.round
}
const shown = (route) => Boolean(R.wayOf(file, route))
const nameOf = (route) => {
  const way = R.wayOf(file, route)
  const words = `${R.stopOf(file, way.from)?.name.split(' · ')[0]} → ${R.stopOf(file, way.to)?.name.split(' · ')[0]}`
  return R.isLine(route) ? `${route.line === 'fast' ? 'fast' : 'slow'} line, ${route.leaves}→${route.joins}` : words
}

// ---- drawing

function drawGrid() {
  const step = GRID_STEPS.find((s) => s * view.ppm >= GRID_MIN) ?? GRID_STEPS.at(-1)
  const [xLeft, zTop] = toWorld(0, 0)
  const [xRight, zBottom] = toWorld(size.w, size.h)
  ctx.lineWidth = 1
  ctx.strokeStyle = css('--faint')
  for (const [every, alpha] of [[step, 0.08], [step * 5, 0.2]]) {
    ctx.globalAlpha = alpha
    ctx.beginPath()
    for (let x = Math.ceil(xRight / every) * every; x <= xLeft; x += every) {
      const sx = Math.round(toScreen(x, 0)[0]) + 0.5
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, size.h)
    }
    for (let z = Math.ceil(zBottom / every) * every; z <= zTop; z += every) {
      const sy = Math.round(toScreen(0, z)[1]) + 0.5
      ctx.moveTo(0, sy)
      ctx.lineTo(size.w, sy)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  return step
}

function drawScale(step) {
  const length = step * 5 * view.ppm
  const y = planBottom() - 16
  ctx.strokeStyle = ctx.fillStyle = css('--ink')
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(16, y - 4)
  ctx.lineTo(16, y)
  ctx.lineTo(16 + length, y)
  ctx.lineTo(16 + length, y - 4)
  ctx.stroke()
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillText(`${step * 5} m`, 16, y - 8)
  ctx.textAlign = 'end'
  ctx.fillText('+Z ↑   +X ←', size.w - 12, y)
  ctx.textAlign = 'start'
}

function text(words, sx, sy, color, align = 'center') {
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.strokeStyle = css('--paper')
  ctx.strokeText(words, sx, sy)
  ctx.fillStyle = color
  ctx.fillText(words, sx, sy)
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

function chevron(mx, my, a, r = 6) {
  ctx.beginPath()
  ctx.moveTo(mx - Math.cos(a - 0.6) * r, my - Math.sin(a - 0.6) * r)
  ctx.lineTo(mx, my)
  ctx.lineTo(mx - Math.cos(a + 0.6) * r, my - Math.sin(a + 0.6) * r)
  ctx.stroke()
}

// One leg as its move is drawn, from screen point a to b: a run solid, a jump broken over its gap,
// a glide dotted, a climb a ladder, a drop chevrons down its fall, a wall run a zigzag; an arrow at
// its end.
function drawLeg([ax, ay], [bx, by], kind, color, width) {
  const length = Math.hypot(bx - ax, by - ay)
  if (length < 1) return
  const a = Math.atan2(by - ay, bx - ax)
  const [ux, uy] = [(bx - ax) / length, (by - ay) / length]
  const [nx, ny] = [-uy, ux]
  const at = (t, side = 0) => [ax + ux * t + nx * side, ay + uy * t + ny * side]
  ctx.strokeStyle = ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (kind === 'jump') {
    // The gap is the leg's middle half, its two lips barred.
    const lip = Math.max(4, length * 0.25)
    ctx.moveTo(ax, ay)
    ctx.lineTo(...at(lip))
    ctx.moveTo(...at(length - lip))
    ctx.lineTo(bx, by)
    ctx.stroke()
    ctx.beginPath()
    for (const t of [lip, length - lip]) {
      ctx.moveTo(...at(t, -7))
      ctx.lineTo(...at(t, 7))
    }
    ctx.stroke()
    ctx.setLineDash([2, 5])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(...at(lip))
    ctx.quadraticCurveTo(...at(length / 2, -length * 0.18), ...at(length - lip))
    ctx.stroke()
    ctx.setLineDash([])
  } else if (kind === 'glide') {
    ctx.setLineDash([1, 7])
    ctx.lineWidth = width + 1.5
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.lineWidth = width
    for (let t = 30; t < length - 10; t += 60) {
      ctx.beginPath()
      ctx.moveTo(...at(t - 6, -10))
      ctx.lineTo(...at(t, 0))
      ctx.lineTo(...at(t - 6, 10))
      ctx.stroke()
    }
  } else if (kind === 'wallrun') {
    ctx.moveTo(ax, ay)
    let side = 4
    for (let t = 6; t < length; t += 6, side = -side) ctx.lineTo(...at(t, side))
    ctx.lineTo(bx, by)
    ctx.stroke()
  } else {
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
    if (kind === 'climb') {
      ctx.lineWidth = 1.2
      ctx.beginPath()
      for (let t = 5; t < length - 3; t += 5) {
        ctx.moveTo(...at(t, -5))
        ctx.lineTo(...at(t, 5))
      }
      ctx.stroke()
    } else if (kind === 'drop') {
      ctx.lineWidth = 1.4
      for (let t = 10; t < length - 6; t += 12) {
        ctx.beginPath()
        ctx.moveTo(...at(t - 3, -6))
        ctx.lineTo(...at(t + 2, 0))
        ctx.lineTo(...at(t - 3, 6))
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(...at(t + 1, -6))
        ctx.lineTo(...at(t + 6, 0))
        ctx.lineTo(...at(t + 1, 6))
        ctx.stroke()
      }
    } else if (length > 40) chevron(...at(length / 2 + 4), a)
  }
  ctx.lineWidth = width
  chevron(bx, by, a, 9)
  ctx.lineCap = 'butt'
}

// The heights inferred from the moves and the lengths drawn (`heightsOf`), again only when the file changed.
function inferred() {
  const now = snapshot()
  if (now !== heightsOfFile) {
    heights = R.heightsOf(file)
    heightsOfFile = now
  }
  return heights
}
const legsShown = (route) => (heightsShown === 'inferred' ? R.legsAtHeight(file, route, inferred()) : R.legsOf(file, route))
const legWords = ({ move: kind, suit, length, rise }) => [suit ? 'jump, the suit opening,' : R.MOVES[kind].words, metres(length), rise == null ? '· height open' : `${rise > 0 ? '↑' : '↓'}${Math.abs(Math.round(rise))}`].join(' ')

/** What is wrong with a route as shown: its legs at the heights shown, and whether it is walked whole. */
function saidOf(route) {
  if (!R.pointsOf(file, route)) return [R.isLine(route) ? 'its way is not drawn there' : 'a stop is not placed']
  if (!R.drawn(route)) return ['not drawn']
  const legs = legsShown(route)
  const said = legs.flatMap((leg, i) => (leg.ok ? [] : [`leg ${i + 1}: ${leg.said}`]))
  if (!R.isLine(route) && legs.every((leg) => leg.move === 'run')) said.push('walkable: no jump, glide, climb, drop or wall run')
  return said
}

function drawRoute(route) {
  const legs = legsShown(route)
  if (!legs.length) return
  const on = route.id === current || R.wayOf(file, route)?.id === current
  const color = colorOf(route)
  const width = on ? 3 : 2
  ctx.globalAlpha = R.isLine(route) ? 0.75 : on || !current ? 1 : 0.55
  for (const { a, b } of legs) {
    // A halo under the line, so that it reads over any roof.
    ctx.strokeStyle = css('--paper')
    ctx.lineWidth = width + 4
    ctx.beginPath()
    ctx.moveTo(...toScreen(a.x, a.z))
    ctx.lineTo(...toScreen(b.x, b.z))
    ctx.stroke()
  }
  for (const [i, leg] of legs.entries()) {
    const { a, b, move: kind, ok, said } = leg
    const [sa, sb] = [toScreen(a.x, a.z), toScreen(b.x, b.z)]
    const isPicked = picked?.kind === 'leg' && picked.route === route.id && picked.index === i
    drawLeg(sa, sb, kind, ok ? color : css('--wrong'), isPicked ? width + 2 : width)
    const middle = [(sa[0] + sb[0]) / 2, (sa[1] + sb[1]) / 2]
    if (!ok) text(said, middle[0], middle[1] - 14, css('--wrong'))
    else if (kind !== 'run' && (on || view.ppm >= LABELS_FROM)) {
      text(legWords(leg), middle[0], middle[1] - 14, color)
    }
  }
  // Its points, the via ones as dots; the picked one ringed.
  ctx.fillStyle = color
  const points = R.pointsOf(file, route)
  points.forEach((p, i) => {
    if (i === 0 || i === points.length - 1) return
    const [sx, sy] = toScreen(p.x, p.z)
    ctx.beginPath()
    ctx.arc(sx, sy, on ? 4 : 3, 0, Math.PI * 2)
    ctx.fill()
    if (picked?.kind === 'point' && picked.route === route.id && picked.index === i) {
      ctx.strokeStyle = css('--accent')
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(sx, sy, 8, 0, Math.PI * 2)
      ctx.stroke()
    }
  })
  ctx.globalAlpha = 1
}

function drawStops() {
  for (const stop of file.stops) {
    if (!stop.at) continue
    const [sx, sy] = toScreen(stop.at.x, stop.at.z)
    // Its zone: kept ground, dashed, and the open air round the NPC, washed.
    ctx.strokeStyle = STOP_COLOR
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.arc(sx, sy, Math.max(6, stop.zone.keep * view.ppm), 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.beginPath()
    ctx.arc(sx, sy, Math.max(4, stop.zone.clear * view.ppm), 0, Math.PI * 2)
    ctx.fill()
    const on = picked?.kind === 'stop' && picked.stop === stop.id
    ctx.fillStyle = on ? css('--accent') : STOP_COLOR
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(sx, sy, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    const y = heightsShown === 'inferred' ? inferred().stops[stop.id] : stop.at.y
    text(`${stop.name}${y == null ? '' : ` · ${Math.round(y)} m`}`, sx + 12, sy, css('--ink'), 'start')
  }
}

// The route in hand: its points so far, the leg to the pointer in the move in hand, and a thin
// line on to where it must end.
function drawDrawing() {
  if (!drawing) return
  const start = drawing.way ? R.pointsOf(file, drawing.way)[drawing.leaves] : R.stopOf(file, drawing.route.from).at
  const points = [start, ...drawing.via]
  const color = colorOf(drawing.way ?? drawing.route)
  for (let i = 0; i + 1 < points.length; i++) {
    const leg = R.legOf(points[i], points[i + 1], drawing.legs[i].move)
    drawLeg(toScreen(points[i].x, points[i].z), toScreen(points[i + 1].x, points[i + 1].z), drawing.legs[i].move, leg.ok ? color : css('--wrong'), 3)
  }
  if (!pointer) return
  const last = points.at(-1)
  const here = ground(toWorld(...pointer))
  const leg = R.legOf(last, here, move)
  const [la, lb] = [toScreen(last.x, last.z), pointer]
  ctx.globalAlpha = 0.7
  drawLeg(la, lb, move, leg.ok ? color : css('--wrong'), 2)
  ctx.globalAlpha = 1
  const words = `${R.MOVES[move].words} ${metres(leg.length)}${leg.rise == null ? '' : ` ${leg.rise > 0 ? '↑' : '↓'}${Math.abs(Math.round(leg.rise))}`}${leg.ok ? '' : ` · ${leg.said}`}`
  text(words, pointer[0] + 14, pointer[1] + 16, leg.ok ? css('--ink') : css('--wrong'), 'start')
  if (!drawing.way) {
    const end = R.stopOf(file, drawing.route.to).at
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.setLineDash([3, 6])
    ctx.beginPath()
    ctx.moveTo(...pointer)
    ctx.lineTo(...toScreen(end.x, end.z))
    ctx.stroke()
    ctx.setLineDash([])
  }
}

// J: how far a jump carries on the level at each pace, round the pointer, as the plan page has it.
function drawReach() {
  if (!reachShown || !pointer) return
  PACES.forEach(({ speed, words, color }, i) => {
    const r = reachAt(speed) * view.ppm
    ctx.strokeStyle = ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`
    ctx.lineWidth = 1.5
    ctx.setLineDash(i === 0 ? [] : [6, 4])
    ctx.beginPath()
    ctx.arc(...pointer, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    text(`${words} ${metres(reachAt(speed))}`, pointer[0], pointer[1] - r - 6, ctx.fillStyle)
  })
  const fair = R.fairReach(0) * view.ppm
  ctx.strokeStyle = css('--ink')
  ctx.setLineDash([2, 3])
  ctx.beginPath()
  ctx.arc(...pointer, fair, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  text(`fair ${metres(R.fairReach(0))}`, pointer[0], pointer[1] + fair + 8, css('--ink'))
}

// ---- the profile: the picked way's heights along it, in a band under the plan

const profiled = () => {
  const way = profileShown ? R.routeOf(file, current) : null
  return way && R.drawn(way) && R.pointsOf(file, way) ? way : null
}
const planBottom = () => size.h - (profiled() ? PROFILE_HEIGHT : 0)

// Distance along the way across, height up (not to the same scale): each leg in its move's style at
// the heights shown, the heights it was drawn on as hollow dots, the stops at its ends.
function drawProfile() {
  const way = profiled()
  if (!way) return
  const legs = legsShown(way)
  const drawnPoints = R.pointsOf(file, way)
  const top = size.h - PROFILE_HEIGHT
  ctx.fillStyle = css('--panel')
  ctx.fillRect(0, top, size.w, PROFILE_HEIGHT)
  ctx.strokeStyle = css('--line')
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, top + 0.5)
  ctx.lineTo(size.w, top + 0.5)
  ctx.stroke()
  const along = [0]
  for (const leg of legs) along.push(along.at(-1) + leg.length)
  const shownYs = [legs[0].a.y, ...legs.map((leg) => leg.b.y)]
  const ys = [...shownYs, ...drawnPoints.map((p) => p.y)].filter((y) => y != null)
  const [lo, hi] = [Math.min(...ys) - 10, Math.max(...ys) + 10]
  const [left, right, upper, lower] = [56, size.w - 24, top + 30, size.h - 18]
  const px = (d) => left + (d / (along.at(-1) || 1)) * (right - left)
  const py = (y) => upper + ((hi - y) / (hi - lo || 1)) * (lower - upper)
  // Height lines, each labelled.
  const every = PROFILE_GRID.find((m) => (m / (hi - lo)) * (lower - upper) >= 28) ?? PROFILE_GRID.at(-1)
  ctx.font = '11px system-ui, sans-serif'
  for (let y = Math.ceil(lo / every) * every; y <= hi; y += every) {
    ctx.strokeStyle = css('--line')
    ctx.beginPath()
    ctx.moveTo(left, Math.round(py(y)) + 0.5)
    ctx.lineTo(right, Math.round(py(y)) + 0.5)
    ctx.stroke()
    ctx.fillStyle = css('--faint')
    ctx.textAlign = 'end'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${y} m`, left - 6, py(y))
  }
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = css('--ink')
  ctx.fillText(`${nameOf(way)} · heights ${heightsShown} along the way (${metres(along.at(-1))}) · hollow: the roofs it was drawn on · P hides this`, left, top + 16)
  drawnPoints.forEach((p, i) => {
    if (p.y == null) return
    ctx.strokeStyle = css('--faint')
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(px(along[i]), py(p.y), 3, 0, Math.PI * 2)
    ctx.stroke()
  })
  const color = colorOf(way)
  legs.forEach((leg, i) => {
    if (leg.a.y == null || leg.b.y == null) return
    const [a, b] = [[px(along[i]), py(leg.a.y)], [px(along[i + 1]), py(leg.b.y)]]
    const isPicked = picked?.kind === 'leg' && picked.route === way.id && picked.index === i
    drawLeg(a, b, leg.move, leg.ok ? color : css('--wrong'), isPicked ? 4 : 2)
    if (isPicked || (leg.move !== 'run' && b[0] - a[0] > 70)) text(legWords(leg), (a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 10, leg.ok ? color : css('--wrong'))
  })
  for (const [d, y, stop] of [[0, shownYs[0], way.from], [along.at(-1), shownYs.at(-1), way.to]]) {
    if (y == null) continue
    ctx.fillStyle = STOP_COLOR
    ctx.beginPath()
    ctx.arc(px(d), py(y), 5, 0, Math.PI * 2)
    ctx.fill()
    text(`${R.stopOf(file, stop).name.split(' · ')[0]} ${Math.round(y)} m`, px(d), py(y) - 12, css('--ink'))
  }
}

function draw() {
  if (!file) return
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  ctx.fillStyle = css('--paper')
  ctx.fillRect(0, 0, size.w, size.h)
  ctx.globalAlpha = 0.85
  roofs.draw(ctx, view, size, band())
  ctx.globalAlpha = 1
  const step = drawGrid()
  // The other lines under their ways, the picked way over the rest.
  const routes = file.routes.filter(shown).sort((a, b) => Number(R.wayOf(file, a)?.id === current) - Number(R.wayOf(file, b)?.id === current) || Number(!R.isLine(a)) - Number(!R.isLine(b)))
  for (const route of routes) drawRoute(route)
  drawStops()
  drawDrawing()
  drawReach()
  drawScale(step)
  drawProfile()
  if (pointer) {
    const [x, z] = toWorld(...pointer)
    const y = roofs.at([x, z], band())
    $('hint').textContent = `${hint()}   ·   x ${Math.round(x)}  z ${Math.round(z)}${y == null ? '' : `  roof ${Math.round(y)} m`}`
  } else $('hint').textContent = hint()
}

function hint() {
  if (placing) return `click where ${R.stopOf(file, placing).name} stands · Esc: not now`
  if (drawing?.way) return `another line of ${nameOf(drawing.way)}: click points, then a later point of the way · Enter: back to the way's next point · Esc: give up`
  if (drawing) return `${nameOf(drawing.route)}: click points · 1–6 the next leg's move (${R.MOVES[move].words}) · click the last stop or Enter to end · Esc: give up`
  if (tool === 'route') return current ? 'W or click the way\'s first stop to draw it' : 'pick a way in the list, or click a stop to draw a way from it'
  if (tool === 'line') return 'click a point of a drawn way where the other line leaves it'
  return 'drag a point or a stop · click a leg, then 1–6 · double-click a leg: a new point'
}

// ---- what is under the pointer

function pointAt(sx, sy, routes) {
  let best = null
  for (const route of routes) {
    const points = R.pointsOf(file, route)
    if (!points || !R.drawn(route)) continue
    points.forEach((p, index) => {
      const d = Math.hypot(...toScreen(p.x, p.z).map((v, k) => v - [sx, sy][k]))
      if (d <= GRAB && (!best || d < best.d)) best = { route, index, d }
    })
  }
  return best
}

function stopAt(sx, sy) {
  let best = null
  for (const stop of file.stops) {
    if (!stop.at) continue
    const d = Math.hypot(...toScreen(stop.at.x, stop.at.z).map((v, k) => v - [sx, sy][k]))
    if (d <= GRAB + 2 && (!best || d < best.d)) best = { stop, d }
  }
  return best?.stop ?? null
}

function legAt(sx, sy) {
  const routes = file.routes.filter(shown).sort((a, b) => Number(R.wayOf(file, b)?.id === current) - Number(R.wayOf(file, a)?.id === current))
  for (const route of routes) {
    for (const [index, { a, b }] of legsShown(route).entries()) {
      const [ax, ay] = toScreen(a.x, a.z)
      const [bx, by] = toScreen(b.x, b.z)
      const length = (bx - ax) ** 2 + (by - ay) ** 2 || 1
      const t = Math.max(0, Math.min(1, ((sx - ax) * (bx - ax) + (sy - ay) * (by - ay)) / length))
      if (Math.hypot(ax + t * (bx - ax) - sx, ay + t * (by - ay) - sy) <= LEG_GRAB) return { route, index }
    }
  }
  return null
}

// ---- changing, kept for undo

const snapshot = () => JSON.stringify(file)
function remember(before = snapshot()) {
  undos.push(before)
  if (undos.length > 300) undos.shift()
  redos.length = 0
}
function restore(from, to) {
  if (!from.length) return
  to.push(snapshot())
  file = JSON.parse(from.pop())
  picked = null
  drawing = null
  changed()
}

let unsaved = false
function changed() {
  if (!unsaved) status('unsaved')
  unsaved = true
  showPanel()
  draw()
}

const post = (body, keepalive = false) => fetch(`/__routes/${NAME}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive })
async function save() {
  if (!unsaved) return status(`saved ${new Date().toLocaleTimeString()}`)
  unsaved = false
  try {
    const answer = await post(file)
    const reply = await answer.json()
    if (!answer.ok) throw new Error(reply.error)
    status(`saved ${new Date().toLocaleTimeString()}`)
  } catch (error) {
    unsaved = true
    status(`not saved: ${error.message}`)
  }
}
setInterval(save, SAVE_EVERY)
addEventListener('pagehide', () => {
  if (unsaved) post(file, true)
})

function status(words) {
  $('status').textContent = words
}

// ---- drawing a route

function startWay(route) {
  const [from, to] = [R.stopOf(file, route.from), R.stopOf(file, route.to)]
  const missing = [from, to].filter((stop) => !stop.at)
  if (missing.length) return status(`place ${missing.map((stop) => stop.name).join(' and ')} first (Stops, below)`)
  current = route.id
  picked = null
  drawing = { route, via: [], legs: [] }
  setTool('route')
}

function addToDrawing(point) {
  drawing.via.push(point)
  drawing.legs.push({ move })
}

function endDrawing() {
  if (drawing.way) return status('a line ends on a later point of its way: click it')
  remember()
  const route = drawing.route
  route.via = drawing.via.map((p) => ({ ...p }))
  route.legs = [...drawing.legs, { move }]
  drawing = null
  changed()
}

function endLine(index) {
  const { way, leaves } = drawing
  if (index <= leaves) return status('a line joins its way further on than it leaves it')
  remember()
  const line = R.addLine(file, way, leaves, index, drawing.via, 'run')
  line.legs = [...drawing.legs, { move }]
  current = way.id
  drawing = null
  changed()
}

// ---- the panel

function element(tag, props = {}, children = []) {
  const made = Object.assign(document.createElement(tag), props)
  made.append(...children)
  return made
}

function showMoves() {
  const leg = pickedLeg()
  const on = leg ? leg.move : move
  $('moveBar').replaceChildren(
    ...Object.entries(R.MOVES).map(([kind, { key, words }]) =>
      element('button', { className: kind === on ? 'on' : '', title: leg ? 'the picked leg' : 'the next leg drawn', onclick: () => setMove(kind) }, [words, element('kbd', { textContent: key })]),
    ),
  )
}

function setMove(kind) {
  const leg = pickedLeg()
  if (leg) {
    remember()
    leg.move = kind
    return changed()
  }
  move = kind
  showMoves()
  draw()
}

const pickedLeg = () => (picked?.kind === 'leg' ? R.routeOf(file, picked.route)?.legs[picked.index] : null)

function showHeights() {
  $('heights').replaceChildren(
    ...['inferred', 'drawn'].map((each) =>
      element('button', { className: heightsShown === each ? 'on' : '', textContent: each, title: each === 'inferred' ? 'from each leg\'s move and length, the round closed' : 'the roofs the points were drawn on', onclick: () => ((heightsShown = each), showPanel(), draw()) }),
    ),
  )
  const said = inferred().said
  $('heightsSaid').replaceChildren(...(heightsShown === 'inferred' && said.length ? [element('details', {}, [element('summary', { textContent: `${said.length} legs no height makes as drawn` }), ...said.map((words) => element('div', { className: 'faint', textContent: words }))])] : []))
}

function showRoof() {
  const ramp = [0, 0.5, 1].map((t) => roofs.color(roofs.lo + t * (roofs.hi - roofs.lo))).join(', ')
  $('roofScale').replaceChildren(element('div', { className: 'scale', style: `background: linear-gradient(to right, ${ramp})` }), element('div', { className: 'faint', textContent: `${Math.round(roofs.lo)} m … ${Math.round(roofs.hi)} m` }))
}

function showWays() {
  const items = []
  for (const way of file.routes.filter((route) => !R.isLine(route) && shown(route))) {
    for (const route of [way, ...R.linesOf(file, way)]) {
      const words = saidOf(route)
      const legs = legsShown(route)
      const gaps = legs.filter((leg) => leg.move !== 'run').length
      const length = legs.reduce((sum, leg) => sum + leg.length, 0)
      const line = R.isLine(route)
      const summary = !words.length ? `${metres(length)} · ${gaps} of ${legs.length} legs not run` : words.join(' · ')
      const tags = line ? '' : way.secret ? 'off the round · hidden ending' : way.branch ? 'off the round' : way.acts.length ? '' : 'no longer in the story'
      items.push(
        element('li', { className: [route.id === current ? 'on' : '', line ? 'line' : ''].join(' '), onclick: () => ((current = way.id), (picked = null), showPanel(), draw()) }, [
          element('div', {}, [element('span', { className: 'swatch', style: `background: ${colorOf(route)}` }), nameOf(route), element('span', { className: 'faint', textContent: tags ? `  ${tags}` : '' })]),
          element('div', { className: `said${words.length && words[0] !== 'not drawn' ? ' wrong' : ''}`, textContent: summary }),
        ]),
      )
    }
  }
  $('ways').replaceChildren(...items)
}

function showPicked() {
  const box = $('picked')
  const route = R.routeOf(file, current)
  if (picked?.kind === 'stop') {
    const stop = R.stopOf(file, picked.stop)
    const field = (label, value, apply, title) => {
      const input = element('input', { type: 'number', step: '1', value: value ?? '', placeholder: 'open' })
      let before = null
      input.onfocus = () => (before = snapshot())
      input.onchange = () => {
        remember(before)
        apply(input.value === '' ? null : Number(input.value))
        changed()
      }
      return element('label', { title }, [element('span', { textContent: label }), input])
    }
    return box.replaceChildren(
      element('div', { textContent: stop.name }),
      field('keep m', stop.zone.keep, (v) => (stop.zone.keep = v ?? 0), 'nothing is cut or taken away this near'),
      field('clear m', stop.zone.clear, (v) => (stop.zone.clear = v ?? 0), 'nothing solid is built this near'),
      element('div', { textContent: `inferred height ${inferred().stops[stop.id] ?? '—'} m` }),
      field('drawn', stop.at?.y, (v) => stop.at && (stop.at.y = v), 'what the inferred heights are held to, weakly (the gull\'s roof: firmly)'),
      element('div', { className: 'row' }, [element('button', { textContent: 'Stand again', onclick: () => ((placing = stop.id), draw()) })]),
    )
  }
  if (picked?.kind === 'point') {
    const point = R.pointsOf(file, R.routeOf(file, picked.route))[picked.index]
    const input = element('input', { type: 'number', step: '0.5', value: point.y ?? '', placeholder: 'open' })
    let before = null
    input.onfocus = () => (before = snapshot())
    input.onchange = () => {
      remember(before)
      point.y = input.value === '' ? null : Number(input.value)
      changed()
    }
    const roof = roofs.at([point.x, point.z], band())
    const guess = inferred().routes[picked.route]?.[picked.index]
    return box.replaceChildren(
      element('div', { textContent: `point ${picked.index} of ${nameOf(R.routeOf(file, picked.route))}` }),
      element('div', { textContent: `inferred height ${guess == null ? '—' : `${guess} m`}` }),
      element('label', { title: 'the roof it was drawn on: what the heights are held to only at a stop' }, [element('span', { textContent: 'drawn' }), input]),
      element('div', { className: 'faint', textContent: `x ${point.x} · z ${point.z} · roof under it ${roof == null ? 'none' : `${Math.round(roof * 10) / 10} m`}` }),
      element('div', { className: 'row' }, [element('button', { textContent: 'Remove', onclick: removePicked })]),
    )
  }
  if (picked?.kind === 'leg') {
    const of = R.routeOf(file, picked.route)
    const leg = legsShown(of)[picked.index]
    return box.replaceChildren(
      element('div', { textContent: `leg ${picked.index + 1} of ${nameOf(of)}: ${R.MOVES[leg.move].words}${leg.suit ? ', past any jump: the suit opens on it' : ''}` }),
      element('div', { className: 'faint', textContent: `at the heights ${heightsShown}` }),
      element('div', { className: 'faint', textContent: `${metres(leg.length)} on the plan · ${leg.rise == null ? 'height open' : `${leg.rise >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(leg.rise * 10) / 10)} m`}` }),
      element('div', { className: leg.ok ? 'faint' : 'wrong', textContent: leg.ok ? 'a person can make it' : leg.said }),
      element('div', { className: 'faint', textContent: 'change its move with 1–6 or the bar over the plan' }),
    )
  }
  if (route) {
    const lines = R.linesOf(file, route)
    const buttons = [element('button', { textContent: R.drawn(route) ? 'Draw again' : 'Draw', onclick: () => startWay(route) })]
    if (R.drawn(route)) buttons.push(element('button', { textContent: 'Other line', onclick: () => setTool('line') }), element('button', { textContent: 'Clear', onclick: () => (remember(), removeLines(route), (route.via = []), (route.legs = []), changed()) }))
    return box.replaceChildren(
      element('div', { textContent: nameOf(route) }),
      element('div', { className: 'row' }, buttons),
      ...lines.map((line) =>
        element('div', { className: 'row' }, [
          element('span', { className: 'faint', textContent: `line ${line.leaves}→${line.joins}` }),
          element('span', { className: 'seg' }, ['fast', 'slow'].map((kind) => element('button', { className: line.line === kind ? 'on' : '', textContent: kind, onclick: () => (remember(), (line.line = kind), changed()) }))),
          element('button', { textContent: 'Remove', onclick: () => (remember(), R.removeRoute(file, line), changed()) }),
        ]),
      ),
    )
  }
  box.replaceChildren(element('div', { className: 'faint', textContent: 'Nothing picked. Pick a way in the list above.' }))
}

const removeLines = (way) => R.linesOf(file, way).forEach((line) => R.removeRoute(file, line))

function showStops() {
  $('stops').replaceChildren(
    ...file.stops.map((stop) =>
      element('li', { className: picked?.kind === 'stop' && picked.stop === stop.id ? 'on' : '', onclick: () => pickStop(stop) }, [
        element('div', { textContent: stop.name }),
        element('div', { className: `said${stop.at ? '' : ' wrong'}`, textContent: stop.at ? `x ${stop.at.x} · z ${stop.at.z} · ${stop.at.y == null ? 'height open' : `${stop.at.y} m`}` : 'not placed: click here, then on the plan' }),
      ]),
    ),
  )
}

function pickStop(stop) {
  picked = { kind: 'stop', stop: stop.id }
  if (!stop.at) placing = stop.id
  else {
    view.cx = stop.at.x
    view.cz = stop.at.z
    keepView()
  }
  showPanel()
  draw()
}

function showPanel() {
  showHeights()
  showMoves()
  showWays()
  showPicked()
  showStops()
  for (const button of document.querySelectorAll('#toolBar button')) button.classList.toggle('on', button.dataset.tool === tool)
}

function setTool(name) {
  tool = name
  if (name !== 'route' && drawing && !drawing.way) drawing = null
  if (name !== 'line' && drawing?.way) drawing = null
  if (name === 'route' && !drawing && current) {
    const route = R.routeOf(file, current)
    if (route && !R.isLine(route)) return startWay(route)
  }
  showPanel()
  draw()
}
for (const button of document.querySelectorAll('#toolBar button')) button.onclick = () => setTool(button.dataset.tool)

function removePicked() {
  if (picked?.kind !== 'point') return
  const route = R.routeOf(file, picked.route)
  const last = R.pointsOf(file, route).length - 1
  if (picked.index === 0 || picked.index === last) return status('a route\'s ends are its stops, or the points of its way: move those')
  remember()
  R.removePoint(file, route, picked.index)
  picked = null
  changed()
}

// ---- the pointer

canvas.addEventListener('pointerdown', (event) => {
  const [sx, sy] = [event.offsetX, event.offsetY]
  if (sy > planBottom()) return // the profile is only looked at
  canvas.setPointerCapture(event.pointerId)
  if (event.button === 1 || event.button === 2 || spaceHeld) {
    if (event.button === 2) {
      const hit = pointAt(sx, sy, file.routes.filter(shown))
      if (hit && !drawing) {
        picked = { kind: 'point', route: hit.route.id, index: hit.index }
        return removePicked()
      }
    }
    drag = { kind: 'pan', from: [sx, sy], view: { ...view } }
    return
  }
  const world = toWorld(sx, sy)
  if (placing) {
    remember()
    R.stopOf(file, placing).at = R.setPoint({}, ground(world))
    picked = { kind: 'stop', stop: placing }
    placing = null
    return changed()
  }
  if (drawing && !drawing.way) {
    const end = R.stopOf(file, drawing.route.to)
    if (stopAt(sx, sy) === end) return endDrawing()
    addToDrawing(ground(world))
    return draw()
  }
  if (drawing?.way) {
    const hit = pointAt(sx, sy, [drawing.way])
    if (hit) return endLine(hit.index)
    addToDrawing(ground(world))
    return draw()
  }
  if (tool === 'line') {
    const hit = pointAt(sx, sy, file.routes.filter((route) => shown(route) && !R.isLine(route)))
    if (!hit) return status('click a point of a drawn way')
    if (hit.index === R.pointsOf(file, hit.route).length - 1) return status('a line cannot leave from where its way ends')
    current = hit.route.id
    drawing = { way: hit.route, leaves: hit.index, via: [], legs: [] }
    return draw()
  }
  if (tool === 'route') {
    const stop = stopAt(sx, sy)
    if (!stop) return status('click a stop to draw a way from it')
    const from = file.routes.filter((route) => !R.isLine(route) && shown(route) && route.from === stop.id)
    const route = from.find((each) => each.id === current) ?? from.find((each) => !R.drawn(each)) ?? from[0]
    if (!route) return status(`no way of the story leaves ${stop.name}`)
    return startWay(route)
  }
  // Select: a via point of the picked way first, then a stop, then any point, then a leg.
  const mine = file.routes.filter((route) => R.wayOf(file, route)?.id === current)
  const hit = pointAt(sx, sy, mine) ?? null
  const stop = stopAt(sx, sy)
  const any = hit ?? (stop ? null : pointAt(sx, sy, file.routes.filter(shown)))
  const point = any && any.index > 0 && any.index < R.pointsOf(file, any.route).length - 1 ? any : null
  if (point) {
    picked = { kind: 'point', route: point.route.id, index: point.index }
    current = R.wayOf(file, point.route).id
    drag = { kind: 'point', before: snapshot(), moved: false }
  } else if (stop) {
    picked = { kind: 'stop', stop: stop.id }
    drag = { kind: 'stop', before: snapshot(), moved: false }
  } else {
    const leg = legAt(sx, sy)
    picked = leg ? { kind: 'leg', route: leg.route.id, index: leg.index } : null
    if (leg) current = R.wayOf(file, leg.route).id
  }
  showPanel()
  draw()
})

canvas.addEventListener('pointermove', (event) => {
  const [sx, sy] = [event.offsetX, event.offsetY]
  pointer = [sx, sy]
  if (drag?.kind === 'pan') {
    view.cx = drag.view.cx + (sx - drag.from[0]) / view.ppm
    view.cz = drag.view.cz + (sy - drag.from[1]) / view.ppm
    keepView()
  } else if (drag?.kind === 'point' || drag?.kind === 'stop') {
    const at = toWorld(sx, sy)
    const target = drag.kind === 'point' ? R.pointsOf(file, R.routeOf(file, picked.route))[picked.index] : R.stopOf(file, picked.stop).at
    R.setPoint(target, event.altKey ? { x: at[0], z: at[1] } : ground(at))
    drag.moved = true
  }
  draw()
})

function release() {
  if ((drag?.kind === 'point' || drag?.kind === 'stop') && drag.moved) {
    remember(drag.before)
    drag = null
    return changed()
  }
  drag = null
}
canvas.addEventListener('pointerup', release)
canvas.addEventListener('pointercancel', release)
canvas.addEventListener('pointerleave', () => ((pointer = null), draw()))
canvas.addEventListener('contextmenu', (event) => event.preventDefault())

canvas.addEventListener('dblclick', (event) => {
  if (drawing) return
  const leg = legAt(event.offsetX, event.offsetY)
  if (!leg) return
  remember()
  R.insertPoint(file, leg.route, leg.index + 1, ground(toWorld(event.offsetX, event.offsetY)))
  picked = { kind: 'point', route: leg.route.id, index: leg.index + 1 }
  changed()
})

canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault()
    const [sx, sy] = [event.offsetX, event.offsetY]
    const before = toWorld(sx, sy)
    view.ppm = Math.min(40, Math.max(0.02, view.ppm * Math.exp(-event.deltaY * 0.0015)))
    const after = toWorld(sx, sy)
    view.cx += before[0] - after[0]
    view.cz += before[1] - after[1]
    keepView()
    draw()
  },
  { passive: false },
)

addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return
  const key = event.key.toLowerCase()
  const mod = event.ctrlKey || event.metaKey
  if (mod && key === 's') {
    event.preventDefault()
    return save()
  }
  if (mod && key === 'z') {
    event.preventDefault()
    return event.shiftKey ? restore(redos, undos) : restore(undos, redos)
  }
  if (mod) return
  const kind = Object.keys(R.MOVES).find((each) => R.MOVES[each].key === event.key)
  if (kind) return setMove(kind)
  if (key === ' ') {
    spaceHeld = true
    event.preventDefault()
  } else if (key === 'v') setTool('select')
  else if (key === 'w') setTool('route')
  else if (key === 'l') setTool('line')
  else if (key === 'f') (fitAll(), draw())
  else if (key === 'j') ((reachShown = !reachShown), draw())
  else if (key === 'p') ((profileShown = !profileShown), draw())
  else if (key === 'enter' && drawing && !drawing.way) endDrawing()
  else if (key === 'enter' && drawing?.way) endLine(drawing.leaves + 1)
  else if (key === 'escape') {
    if (placing || drawing) {
      placing = null
      drawing = null
      if (tool !== 'select') setTool('select')
    } else picked = null
    showPanel()
    draw()
  } else if (key === 'delete' || key === 'backspace') {
    if (drawing?.via.length) {
      drawing.via.pop()
      drawing.legs.pop()
      return draw()
    }
    removePicked()
  }
})
addEventListener('keyup', (event) => {
  if (event.key === ' ') spaceHeld = false
})
for (const id of ['bandMin', 'bandMax']) $(id).addEventListener('input', () => draw())

// ---- start

new ResizeObserver(resize).observe(stage)
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => draw())

const loadPlace = PLACES[`/src/places/${NAME}.json`]
status(`reading ${NAME} and its roofs…`) // some seconds: tens of thousands of faces
if (loadPlace) roofs = roofsOf(await loadPlace())
status('')
try {
  const answer = await fetch(`/__routes/${NAME}`)
  if (!answer.ok) throw new Error(answer.status)
  file = await answer.json()
} catch {
  file = R.freshRoutes(NAME, loadPlace ? await loadPlace() : {})
  status('not served by npm run dev: nothing will be saved')
}
resize()
try {
  const kept = JSON.parse(localStorage.getItem(VIEW_KEY))
  if (kept && [kept.cx, kept.cz, kept.ppm].every(Number.isFinite)) view = kept
  else fitAll()
} catch {
  fitAll()
}
showRoof()
showPanel()
draw()
