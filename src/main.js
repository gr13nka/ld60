import { PCFSoftShadowMap, BasicShadowMap, WebGLRenderer } from 'three'
import { QuittersGame } from './quitters-game.js'
import { loadMan } from './man.js'
import { Picture } from './picture.js'
import { Quality, cardOf } from './quality.js'
import { FrameBudget, watchDisplay } from './frame-budget.js'
import { hideLoading } from './loading.js'

const STEP = 1 / 120
const MAX_FRAME = STEP * 6
// Graphics lost this early are lost to the shadows (`quality.js`); later it is a sleep or a driver.
const STARTUP_LOSS_SECONDS = 15

watchDisplay() // from the first frames, so the display's own pace is known before the game judges its speed

loadMan().then(() => {
  const app = document.getElementById('app')
  // Anti-aliasing belongs to Picture's off-screen target, not the final canvas.
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
  // Of one kind for the visit: changing it later would rebuild every lit material mid-game.
  const quality = new Quality(cardOf(renderer.getContext()))
  renderer.shadowMap.enabled = quality.shadows !== 'none'
  renderer.shadowMap.type = quality.shadows === 'hard' ? BasicShadowMap : PCFSoftShadowMap
  app.appendChild(renderer.domElement)

  const handheld = window.matchMedia('(pointer: coarse)').matches
  const picture = new Picture(renderer, { smooth: !handheld, sharp: !handheld })
  for (let step = 0; step < quality.steps; step++) picture.cheapen() // as cheap as this machine was found to need
  const budget = new FrameBudget()
  let shown = 0
  renderer.domElement.addEventListener('webglcontextlost', () => {
    if (shown < STARTUP_LOSS_SECONDS) quality.lostGraphics()
  })

  const game = new QuittersGame(renderer.domElement, { lineup: new URLSearchParams(location.search).has('lineup') })
  if (import.meta.env.DEV) window.__perf = { game, picture, renderer } // for measuring from the console
if (import.meta.env.DEV) window.game = game // for trying a route or a control from the console
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('edit')) {
    import('./editor.js').then(({ Editor }) => new Editor(game, renderer))
  }
  function resize() {
    const width = window.innerWidth
    const height = window.innerHeight
    const aspect = Math.min(21.5 / 9, Math.max(16 / 10, width / Math.max(1, height)))
    const frameWidth = Math.min(width, height * aspect)
    const frameHeight = frameWidth / aspect
    app.style.width = `${frameWidth}px`
    app.style.height = `${frameHeight}px`
    picture.resize(frameWidth, frameHeight)
    game.resize(aspect)
  }
  window.addEventListener('resize', resize)
  resize()

  let last = performance.now()
  let pending = 0
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.save()
    last = performance.now()
    pending = 0
    budget.reset()
  })
  function frame(now) {
    requestAnimationFrame(frame)
    if (document.hidden) return
    const workStart = performance.now()
    const elapsed = Math.max(0, now - last)
    const dt = Math.min(MAX_FRAME, elapsed / 1000)
    last = now
    pending += dt
    shown += dt
    while (pending >= STEP) { game.update(STEP); pending -= STEP }
    game.render(picture, dt, pending)
    hideLoading() // the first scene is drawn: the wait is over
    // A machine that misses its frames gets the picture made cheaper a step at a time (`Picture.cheapen`).
    if (budget.recordFrame(elapsed, performance.now() - workStart)) {
      if (picture.cheapen()) quality.cheapened()
      else quality.exhausted()
    }
  }
  requestAnimationFrame(frame)
}).catch((error) => {
  hideLoading()
  window.reportTrouble?.(error?.stack ?? String(error))
})
