// The way in: the mark of the wait goes up first, then the game is fetched behind it. `main.js`
// imports three.js and the world record at its top, so it cannot put the mark up itself.

import { showLoading } from './loading.js'

showLoading()
import('./main.js').catch((error) => window.reportTrouble?.(error?.stack ?? String(error)))
