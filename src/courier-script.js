// The two writer-owned scripts are the source of every spoken line. Scene order and choices
// live here; a place supplies only positions, so a rebuilt shaft does not rewrite the story.
import english from './story/courier-en.md?raw'
import russian from './story/courier-ru.md?raw'

export const COURIER_SCENES = [
  { id: 'roof-morning', spot: 'roof', act: 1, scene: 1 },
  { id: 'sorting-one', spot: 'sorting', act: 1, scene: 2 },
  { id: 'tamara-one', spot: 'tamara', act: 1, scene: 3 },
  { id: 'raccoon-one', spot: 'raccoon', act: 1, scene: 4 },
  { id: 'roof-evening-one', spot: 'roof', act: 1, scene: 5 },
  { id: 'sorting-two', spot: 'sorting', act: 2, scene: 1 },
  { id: 'tamara-two', spot: 'tamara', act: 2, scene: 2 },
  { id: 'pipe-two', spot: 'pipe', act: 2, scene: 3 },
  { id: 'raccoon-two', spot: 'raccoon', act: 2, scene: 4 },
  { id: 'grille-two', spot: 'grille', act: 2, scene: 5 },
  { id: 'roof-evening-two', spot: 'roof', act: 2, scene: 6 },
  { id: 'roof-morning-three', spot: 'roof', act: 3, scene: 1 },
  { id: 'sorting-three', spot: 'sorting', act: 3, scene: 2 },
  { id: 'grille-three', spot: 'grille', act: 3, scene: 3, optional: true },
  { id: 'tamara-three', spot: 'tamara', act: 3, scene: 4, optional: true },
  { id: 'pipe-three', spot: 'pipe', act: 3, scene: 5, optional: true },
  { id: 'raccoon-three', spot: 'raccoon', act: 3, scene: 6, optional: true },
  { id: 'roof-evening-three', spot: 'roof', act: 3, scene: 7 },
]

export const COURIER_WORDS = {
  en: { language: 'English', title: 'The Courier', next: 'continue', close: 'back to the route', interact: '[E] to talk',
    procedure: "It's procedure.", silent: 'Remain silent', give: 'Give a match', refuse: 'Refuse',
    open: 'Open the parcel', leave: 'Leave it', knock: 'Knock', lever: 'Pull the lever',
    act: 'day', matches: 'matches', route: 'your route', end: 'end', again: 'begin again' },
  ru: { language: 'Русский', title: 'Курьер', next: 'дальше', close: 'вернуться на маршрут', interact: '[E] поговорить',
    procedure: 'Так положено', silent: 'Промолчать', give: 'Дать спичку', refuse: 'Отказать',
    open: 'Открыть пакет', leave: 'Оставить', knock: 'Постучать', lever: 'Дёрнуть рычаг',
    act: 'день', matches: 'спичек', route: 'ваш маршрут', end: 'конец', again: 'начать снова' },
}

const source = { en: english, ru: russian }

function sections(raw, lang) {
  const acts = raw.split(lang === 'en' ? /^## Act [IVX]+\./m : /^## Акт \d+\./m).slice(1, 4)
  return acts.map((act) => {
    const story = act.split(lang === 'en' ? /^## Ending A\./m : /^### Обычная концовка\./m)[0]
    return story.split(lang === 'en' ? /^### Scene \d+\./m : /^### Сцена \d+\./m).slice(1)
  })
}

function clean(line) {
  return line.replace(/^>\s*/, '').replace(/\*\*/g, '').replace(/^\*|\*$/g, '').trim()
}

function beats(body, lang, sceneId) {
  const out = []
  let condition = null
  for (const raw of body.split('\n').slice(1)) {
    const line = raw.trim()
    if (!line) continue
    if (/^(\*Dialogue choice|\*Player interaction|> Выбор:)/.test(line)) {
      out.push({ choice: sceneId === 'tamara-two' ? 'procedure' : 'match' })
      continue
    }
    if (/^\*(If |Если )/.test(line)) {
      if (sceneId === 'tamara-two') condition = 'procedure'
      else if (sceneId === 'raccoon-two') condition = /refuse|отказал/.test(line) ? 'refuse' : 'give'
      else if (sceneId === 'raccoon-three') condition = 'give'
      else condition = null
      continue
    }
    if (/^\*The conversation continues/.test(line)) { condition = null; continue }
    if (sceneId === 'raccoon-two' && condition === 'refuse' && out.filter((beat) => beat.when === 'refuse').length >= 1) condition = null
    if (sceneId === 'raccoon-three' && condition === 'give' && out.filter((beat) => beat.when === 'give').length >= 1) condition = null
    // The stage directions are read on held frames. Writer-facing notes never enter a scene.
    if (line.startsWith('**') || /^> \*\*/.test(line)) {
      const said = clean(line)
      const cut = said.indexOf(':')
      if (cut > 0 && said.slice(cut + 1).trim()) {
        out.push({ speaker: said.slice(0, cut), text: said.slice(cut + 1).trim(), when: condition })
        if (sceneId === 'raccoon-three' && out.filter((beat) => !!beat.speaker).length === 1) out.push({ choice: 'match' })
      } else out.push({ text: said, when: condition })
    } else if (line.startsWith('*') && !/Design intent|Цель акта/.test(line)) {
      out.push({ text: clean(line), when: condition })
    }
  }
  return out
}

/** The authored scene, with its title and beats in the chosen language. */
export function courierScene(id, lang) {
  const scene = COURIER_SCENES.find((entry) => entry.id === id)
  if (!scene) throw new Error(`unknown courier scene: ${id}`)
  const body = sections(source[lang], lang)[scene.act - 1][scene.scene - 1]
  const [title] = body.split('\n')
  return { ...scene, title: title.trim(), beats: beats(body, lang, id) }
}

/** The ending's spoken lines and scene directions. The last writer-only explanation stays out. */
export function courierEnding(kind, lang) {
  const raw = source[lang]
  const ordinary = lang === 'en' ? raw.split('## Ending A.')[1].split('## Ending B.')[0] : raw.split('### Обычная концовка.')[1].split('### Скрытая концовка.')[0]
  const hidden = lang === 'en' ? raw.split('## Ending B.')[1].split('## Fragment Map')[0] : raw.split('### Скрытая концовка.')[1].split('## Карта осколков')[0]
  const body = kind === 'ordinary' ? ordinary : hidden.split(lang === 'en' ? '*End.*' : '*Конец.')[0]
  const result = beats(body, lang, '')
  if (kind === 'ordinary') result.unshift({ text: lang === 'ru'
    ? 'Внутри нет деталей. Только одна сигарета «Пуск». Курьер закуривает сам.'
    : 'There are no parts inside. Just a single START cigarette. The Courier lights it himself.' })
  if (kind === 'hidden') {
    if (lang === 'ru') {
      const nearby = result.find((beat) => beat.text?.startsWith('Рядом рычаг.'))
      if (nearby) nearby.text = 'Рядом рычаг.'
    }
    const lever = result.findIndex((beat) => /lever nearby|Рядом рычаг/.test(beat.text ?? ''))
    if (lever >= 0) result.splice(lever + 1, 0, { choice: 'lever' })
  }
  return result.filter((beat) => !/ordinary ending|hidden ending|Triggered if|No quest marker|The game returns|No credits|^End\.|^Конец\.|^Срабатывает|^Игра начинается|^Титров нет|^Табачная не работает|^The Tobacco Works isn't running/.test(beat.text ?? ''))
}

export const COURIER_LEVER = {
  en: 'Steam hisses. The Center shudders. Its gears turn halfway around, then stop with a metallic clank.',
  ru: 'Пар шипит. Центр вздрагивает, шестерни делают пол-оборота и встают с лязгом.',
}
