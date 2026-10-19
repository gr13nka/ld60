// The one counter Quitters keeps over the picture: when a find is taken, its silhouette and how
// many are in hand, held a few seconds (the animation in `quitters.css`) and then gone.

const ICONS = {
  match: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 4h10v8H1zM11 5h3v6h-3z"/><path class="find-icon-cut" d="M3 6h6v1H3zM3 9h6v1H3z"/></svg>',
  feather: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 14h2v-2h2v-2h2V8h2V6h2V4h2v4h-1v2h-2v2H8v1H5v1z"/><path class="find-icon-cut" d="M4 12h2v-1h2v-1h2V9h2V7"/></svg>',
}

export class FindCount {
  constructor(parent) {
    this.node = parent.appendChild(document.createElement('div'))
    this.node.className = 'find-count'
    this.node.hidden = true
    this.icon = this.node.appendChild(document.createElement('div'))
    this.icon.className = 'find-count-icon'
    this.text = this.node.appendChild(document.createElement('div'))
    this.text.className = 'find-count-text'
  }

  /** A find of `kind` was taken: `count` of `total` are now in hand. */
  show(kind, count, total) {
    this.node.dataset.kind = kind
    this.icon.innerHTML = ICONS[kind] ?? ICONS.match
    const width = Math.max(2, String(total).length)
    this.text.textContent = `[${String(count).padStart(width, '0')}/${String(total).padStart(width, '0')}]`
    this.node.hidden = true
    void this.node.offsetWidth // restarts the animation when two are taken close together
    this.node.hidden = false
  }
}
