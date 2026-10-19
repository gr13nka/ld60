# Quitters

A first-person parkour story in one generated BLAME!-style megastructure. The courier runs,
climbs and glides along seven routes between the people of a three-act story, from the gull's
roof down to the cold Табачная. The game is built with Vite and Three.js. This is the only game
and the only level in the repository.

Read `docs/quitters.md` before changing the story, movement or editor, and `docs/world.md`
before changing the world.

## Commands

- `npm run dev` — play the current world.
- `npm run build` — production build and the only automated check.
- `npm run dev -- --host` — serve to another device on the local network.
- `?edit` — open the place editor in the dev server. E toggles it; Ctrl+S writes `builders.json`
  and keeps the owner's edits in `plans/builders-hand.json`, which every grow puts back.
- `node scripts/builders/grow.mjs` — grow the world from the routes and the balcony (about 7 min;
  run it on the Mac mini). `node scripts/builders/grow/story.mjs` only re-places the story.
- `/itch/routes.html` on the dev server — the owner's routes drawing (`plans/balcony-routes.json`).

## Boundaries

- `src/main.js` owns frame timing and rendering. `src/quitters-game.js` owns state, input, the
  courier and the single world. Movement decisions happen in its fixed step; the scene and
  camera are presented once per frame.
- `src/places/builders.json` is the world record, written by `scripts/builders/grow.mjs` from
  `plans/balcony-routes.json`, `src/places/balcony.json` and the owner's edits
  (`plans/builders-hand.json`), and by the editor's save. Change the world by changing the
  generator, the routes, the balcony or in `?edit`, never by editing the record's text.
  `src/parkour-world.js` stands and collides with it. `src/assets.js` and related builders make its architecture. `src/parkour.js` and
  `src/wingsuit.js` are the pure movement rules.
- `src/story/courier-en.md` and `courier-ru.md` own the words. `courier-script.js` maps scenes;
  `courier.js` owns choices and progress. The place owns only where a scene is met.
- `quitters.story.v1` is the only progress key. Changing its shape requires a migration that
  keeps every completed scene and choice. The old game's saves are never read or erased.
- No gameplay HUD but the finds counter (the owner's choice). A story scene or pause is a held
  text card. Every element must help the player decide or understand something at that moment;
  remove anything else.
