import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineConfig, normalizePath } from 'vite'
import { checkPlace, layOut, PLACE_NAME, placeNamed, placePath } from './src/place-file.js'
import { assetNamed, describe, rewrite, SOURCES } from './src/asset-source.js'
import { checkRoutes, freshRoutes, layOutRoutes, withStory } from './scripts/builders/routes.mjs'
import { WORLD, keepGrown, noteHand } from './scripts/builders/hand.mjs'

// A request's body, read whole and parsed as JSON; throws 'not JSON' if it is not.
function bodyOf(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('not JSON'))
      }
    })
  })
}

function reply(response, status, body) {
  response.statusCode = status
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify(body))
}

// A place written to its file (`src/place-file.js`), once it passes the structural check; throws what is wrong.
async function writePlace(name, place) {
  if (place === null || typeof place !== 'object' || Array.isArray(place)) throw new Error('a place is an object')
  checkPlace(place, name)
  const path = placePath(name)
  await mkdir(new URL('./', new URL(`./${path}`, import.meta.url)), { recursive: true })
  await writeFile(new URL(`./${path}`, import.meta.url), layOut(place))
  return path
}

// Dev server only: the editor's save (`savePlace`, `src/place-file.js`) is a POST to /__place/<name>,
// checked and written to the place's file (`src/place-file.js` says where and how). A build has no
// such door, and no editor: it is dev-only (`src/main.js`). The check is the structural half of
// `loadPlace`'s (`writePlace`): the themes and asset kinds need modules this file does not import, and the editor checks those.
// A POST with `?quiet` (the editor's autosave) is written with no reload after it: the page
// already holds what was written, and a reload every few seconds would be no editor. Its file's
// change is let pass unanswered (`handleHotUpdate`) if it comes within `QUIET_FOR` of the write.
const QUIET_FOR = 3000 // milliseconds
function placeFiles() {
  const quietly = new Map() // each file written quietly, by its path as Vite names it, and when
  return {
    name: 'place-files',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const name = request.method === 'POST' ? placeNamed(request.url ?? '') : null
        if (!name || !PLACE_NAME.test(name)) return next()
        try {
          const quiet = /[?&]quiet\b/.test(request.url ?? '')
          if (quiet) quietly.set(normalizePath(fileURLToPath(new URL(`./${placePath(name)}`, import.meta.url))), Date.now())
          const place = await bodyOf(request)
          // The grown world's saves are the owner's hand on it, kept for the next grow (`hand.mjs`).
          if (name === WORLD) keepGrown()
          const written = await writePlace(name, place)
          reply(response, 200, { written, hand: name === WORLD ? noteHand(place) : undefined })
        } catch (error) {
          reply(response, 400, { error: String(error.message ?? error) })
        }
      })
    },
    handleHotUpdate({ file }) {
      const at = quietly.get(normalizePath(file))
      if (at === undefined) return
      quietly.delete(normalizePath(file))
      if (Date.now() - at < QUIET_FOR) return []
    },
  }
}

// Dev server only: a builder's defaults (`src/asset-source.js`). GET /__asset/<name> says what each
// parameter is, as the builder's source writes it and the comment after it; POST rewrites the
// values given (`{ values, place }`) into that source, and with `place` (`{ name, record }`)
// writes that place's file first, in one request, since the page reloads when either is written.
function assetSources() {
  const sources = async () => {
    const dir = new URL('./src/', import.meta.url)
    const names = (await readdir(dir)).filter((file) => SOURCES.test(file)).sort()
    return Promise.all(names.map(async (file) => ({ path: `src/${file}`, text: await readFile(new URL(file, dir), 'utf8') })))
  }
  return {
    name: 'asset-sources',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const name = assetNamed(request.url ?? '')
        if (!name || (request.method !== 'GET' && request.method !== 'POST')) return next()
        try {
          if (request.method === 'GET') {
            const said = describe(await sources(), name)
            return said ? reply(response, 200, said) : reply(response, 404, { error: `no defaults for the asset "${name}"` })
          }
          const { values, place } = await bodyOf(request)
          if (!values || typeof values !== 'object') throw new Error('no values to write')
          const { path, text } = rewrite(await sources(), name, values) // checked whole before anything is written
          const written = []
          if (place) {
            if (!PLACE_NAME.test(place.name ?? '')) throw new Error(`no place may be named "${place.name}"`)
            written.push(await writePlace(place.name, place.record))
          }
          await writeFile(new URL(`./${path}`, import.meta.url), text)
          reply(response, 200, { written: [...written, path] })
        } catch (error) {
          reply(response, 400, { error: String(error.message ?? error) })
        }
      })
    },
  }
}

// Dev server only: the story's routes over a place (`itch/routes.html`, `scripts/builders/routes.mjs`),
// kept as plans/<name>-routes.json. GET /__routes/<name> reads them, or makes them afresh from the
// place's file where there are none yet (unsaved until the page saves); POST writes them once
// `checkRoutes` finds nothing wrong with their shape. Both bring the ways in line with the story
// as `STORY` has it now (`withStory`), so a changed story keeps every way drawn.
function routesFiles() {
  return {
    name: 'routes-files',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const name = /^\/__routes\/([a-z0-9-]+)(?:\?.*)?$/.exec(request.url ?? '')?.[1]
        if (!name || (request.method !== 'GET' && request.method !== 'POST')) return next()
        const file = new URL(`./plans/${name}-routes.json`, import.meta.url)
        try {
          if (request.method === 'GET') {
            const kept = await readFile(file, 'utf8').then(JSON.parse, () => null)
            const routes = kept ? withStory(kept) : freshRoutes(name, JSON.parse(await readFile(new URL(`./${placePath(name)}`, import.meta.url), 'utf8')))
            response.setHeader('content-type', 'application/json')
            return response.end(layOutRoutes(routes))
          }
          const routes = await bodyOf(request)
          const wrong = checkRoutes(routes)
          if (wrong.length) throw new Error(wrong.join('; '))
          await mkdir(new URL('./plans/', import.meta.url), { recursive: true })
          await writeFile(file, layOutRoutes(withStory(routes)))
          reply(response, 200, { written: `plans/${name}-routes.json` })
        } catch (error) {
          reply(response, 400, { error: String(error.message ?? error) })
        }
      })
    },
  }
}

// `npm run dev:steady` (mode 'steady'): a second dev server, on its own port, that never reloads
// or hot-swaps a page, so a level is edited on undisturbed while other work changes the code. A
// change is still seen: Vite goes on watching, and a page loaded by hand gets the code as it is.
const STEADY = { port: 5190, strictPort: true, hmr: false }

export default defineConfig(({ mode }) => ({
  // Relative, so that a build plays from any folder: itch.io serves it from a path of its own.
  base: './',
  plugins: [placeFiles(), assetSources(), routesFiles()],
  // When the build was made, to the minute (UTC): said with a visit's first event (`src/boot.js`),
  // so that what players did can be told apart by the build they did it in.
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16)) },
  server: mode === 'steady' ? STEADY : undefined,
}))
