// The mark of the wait while the game is fetched and the world built: a cigarette turning end
// over end in the middle of the black window, the word under it. `boot.js` puts it up before
// anything of the game is fetched; `main.js` takes it down once the first scene is drawn.
//
// It turns by a CSS animation of `transform` alone, which the browser runs off the main
// thread: the world is built in one long step, and anything the game drew would stand still.

import './loading.css'

let mark = null
let word = null

export function showLoading() {
  mark = document.body.appendChild(document.createElement('div'))
  mark.className = 'loading'
  word = document.body.appendChild(document.createElement('div'))
  word.className = 'loading-word'
  word.textContent = 'loading'
  document.body.classList.add('loading-alone')
}

export function hideLoading() {
  if (!mark) return
  mark.remove()
  word.remove()
  mark = word = null
  document.body.classList.remove('loading-alone')
}
