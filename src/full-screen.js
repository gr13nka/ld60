// The whole screen, where the browser gives it: the one place that asks for it and leaves it.
// A browser only grants it from inside a press (a finished tap, a click, a key), and only
// some of them at all; a refusal changes nothing.

/**
 * Full screen and, on a phone, on its side. Does nothing where it already is. Returns whether
 * it was asked for: the screen is then about to change (`fullscreenchange`) or be refused
 * (`fullscreenerror`). Where the browser lets a page keep Escape in full screen (Chrome and
 * Edge in a tab of the game's own, not in a frame like itch.io's), it is kept: Escape then opens
 * the game's menu and the screen stays, and only holding it down leaves full screen.
 */
export function fillScreen() {
  if (document.fullscreenElement || !document.documentElement.requestFullscreen) return false
  try {
    Promise.resolve(document.documentElement.requestFullscreen())
      .then(() => {
        navigator.keyboard?.lock?.(['Escape'])?.catch(() => {})
        screen.orientation?.lock?.('landscape')?.catch?.(() => {})
      })
      .catch(() => {})
  } catch {
    return false // refused outside a press
  }
  return true
}

/** Out of full screen, if in it. */
export function leaveScreen() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
}
