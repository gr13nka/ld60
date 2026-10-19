// Stills of each person the courier is sent to, seen from the way that leads to them: a headless
// Chromium plays the dev server's game, the courier is stood at points of the par line so many
// metres before each stop, turned to the stop, and the frame is saved. For judging whether a
// person, their mast or the structure round them reads from afar (the owner, 2026-10-20).
//
//   node scripts/stills/npc.mjs [--out=DIR] [--url=http://localhost:5173/] [--backs=600,300,150,60,15]
//
// Needs the dev server up and Chromium in /Applications (or CHROMIUM=path).

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true] }))
const OUT = resolve(args.out ?? 'reports/stills/npc')
const URL = args.url ?? 'http://localhost:5173/'
const BACKS = String(args.backs ?? '600,300,150,60,15').split(',').map(Number)
const CHROMIUM = process.env.CHROMIUM ?? '/Applications/Chromium.app/Contents/MacOS/Chromium'
const PORT = 9333
const WIDTH = 1600, HEIGHT = 900
const EYE = 1.6 // m over the feet the eye is, for the look's pitch
const PERSON = 1 // m over a spot the person's middle is looked at

const grown = JSON.parse(readFileSync('plans/builders/grown.json', 'utf8'))
const spots = grown.courier.spots
const WAY_TO = { 'gull-voron': 'sorting', 'voron-tamara': 'tamara', 'tamara-raccoon': 'raccoon', 'raccoon-pipeman': 'pipe', 'pipeman-gull': 'roof', 'voron-gavrilov': 'grille', 'gavrilov-tabachnaya': 'works' }

// The par line of each way, and a point on it `back` metres before its end.
const lines = {}
for (const p of grown.par) (lines[p.way] ??= []).push(p)
function pointBack(line, back) {
  let left = back
  for (let i = line.length - 1; i > 0; i--) {
    const a = line[i], b = line[i - 1]
    const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
    if (d >= left) { const t = left / d; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, dist: back } }
    left -= d
  }
  return { ...line[0], dist: back - left }
}

const shots = []
for (const [way, spot] of Object.entries(WAY_TO)) {
  const line = lines[way]
  if (!line) { console.warn(`no par line for ${way}`); continue }
  const at = spots[spot]
  for (const back of BACKS) {
    const p = pointBack(line, back)
    const dx = at.x - p.x, dz = at.z - p.z, dy = at.y + PERSON - (p.y + EYE)
    shots.push({ name: `${way}-${String(Math.round(p.dist)).padStart(4, '0')}m`, pos: p, yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), far: Math.hypot(dx, dy, dz) })
  }
}

// --- a minimal DevTools client ---
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.waiting = new Map(); ws.onmessage = (m) => { const msg = JSON.parse(m.data); const w = this.waiting.get(msg.id); if (w) { this.waiting.delete(msg.id); msg.error ? w.reject(new Error(JSON.stringify(msg.error))) : w.resolve(msg.result) } } }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => this.waiting.set(id, { resolve, reject })) }
  async eval(expression) { const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? '')); return r.result.value }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROMIUM, [`--remote-debugging-port=${PORT}`, '--headless=new', `--window-size=${WIDTH},${HEIGHT}`, '--no-first-run', '--no-default-browser-check', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${OUT}/.profile`, 'about:blank'], { stdio: 'ignore' })
process.on('exit', () => chrome.kill())
try {
  let targets = null
  for (let i = 0; i < 300 && !targets?.some((t) => t.type === 'page'); i++) { await sleep(200); targets = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json()).catch(() => null) }
  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  const cdp = new CDP(ws)
  await cdp.send('Page.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Page.navigate', { url: `${URL}?fresh` })
  for (let i = 0; i < 300; i++) { await sleep(500); if (await cdp.eval('!!(window.game && !document.querySelector(".loading"))')) break }
  console.log('webgl:', await cdp.eval('(() => { const gl = document.querySelector("canvas")?.getContext("webgl2"); const d = gl?.getExtension("WEBGL_debug_renderer_info"); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "?" })()'))
  // Past the language card and the lessons, the gull's scene behind him, no card up.
  await cdp.eval(`(() => { const s = game.story; s.language = 'en'; s.view.setLanguage('en'); s.seen.add('roof-morning'); s._resume(); game.lessons.restore(['compass','suit','slide','fall','hook']); game.smoker.quit(); return true })()`)
  mkdirSync(OUT, { recursive: true })
  const report = []
  for (const shot of shots) {
    const { pos, yaw, pitch } = shot
    await cdp.eval(`(() => { game.reset({ x: ${pos.x}, y: ${pos.y}, z: ${pos.z}, yaw: ${yaw} }); game.placeView(game.body.pos, ${yaw}, ${pitch}); game.view.snap(); game.paused = false; game.pauseMenu.close(); return true })()`)
    await sleep(700)
    const state = await cdp.eval('JSON.stringify({ y: game.body.pos.y, paused: game.paused, card: game.story.card, mode: game.runner.mode })')
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(`${OUT}/${shot.name}.png`, Buffer.from(data, 'base64'))
    const line = `${shot.name}  ${shot.far.toFixed(0)} m to the spot  ${state}`
    console.log(line)
    report.push(line)
  }
  writeFileSync(`${OUT}/report.txt`, report.join('\n') + '\n')
  ws.close()
} finally {
  chrome.kill()
}
