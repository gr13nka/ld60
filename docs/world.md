# The world: a generated megastructure

Quitters' world, `src/places/builders.json`, is not drawn by hand. Three sources make it:
- the owner's routes;
- the generator, which grows a BLAME!-style megastructure round them;
- the owner's edits in `?edit`, put back over each growth.

The target, in the owner's words: an endless built structure of incomprehensible scale, the
human tiny inside it, interesting to explore, every route runnable. The look is grey concrete
under hard amber light, with rust and brass, turning gears, steam mains as big as streets, and
grates breathing steam. The Табачная stays cold and still.

## Sources

- **`plans/balcony-routes.json`**: the owner's seven ways, NPC to NPC.
  - The round: Чайка → Ворон → Тамара → Енот → Человек в трубе → Чайка.
  - The hidden ending: Ворон → Гаврилов → Табачная.
  - About 184 legs, each a move: run, jump, glide, climb, drop or wall run.
  - The owner draws them on `itch/routes.html` (dev server, `/itch/routes.html`). Code never edits
    the drawing.
- **`src/places/balcony.json`**: the owner's hand-made balcony, the generator's base. It is never
  written. The routes come first: the generator may take a balcony record out of the world when
  it stands on a route, and lists it.
- **Heights** come from `heightsOf` (`scripts/builders/routes.mjs`). It is a least-squares fit of
  every leg's asked rise, with the glide drop measured from the real suit (`glideDrop`) and
  `LIMITS.run` 22. Чайка's roof is 0 and the Табачная about −703.

## Growing

```
node scripts/builders/grow.mjs [--layers=ways,blame,stops,steam] [--seed=N] [--dry]
node scripts/builders/grow/story.mjs   # only re-place the story in the current world
```

Run it on the Mac mini (about 7 minutes, 6 of them in blame), then copy `builders.json` back.
- **Repeatable:** it starts from the balcony each time, so the same seed gives the same world.
- **Report:** printed as JSON, and kept in `plans/builders/grow-report.json`. It lists:
  - `made`, from testWays;
  - each layer's time;
  - `removed` balcony records;
  - `guarded` and `repaired`.
- **Editor saves are kept** (`scripts/builders/hand.mjs`). The grow keeps the world as grown in
  `plans/builders/grown.json`; each save in `?edit` writes the difference from it to
  `plans/builders-hand.json` (`changed`, `added`, `removed`, `set`), and the next grow puts it
  back over the new growth. A record is found again by its content, not its id, as the generator
  renumbers. An edit whose record the new growth lacks moves to `orphans` and is listed in the
  report's `hand`; it is never guessed at. Copy `grown.json` and `builders-hand.json` back from
  the mini with `builders.json`.

Layers, in order (`scripts/builders/grow/`):
- **ways** (`grow-ways.mjs`):
  - **What it builds:** a pad at every route point, a slab for every run, a tower face for every
    climb, a wall for every wall run, and a canyon of two walls for a wall run over 41 m.
  - **Gaps:** jumps, glides and drops are left open.
  - **Piers:** massive, down to the mist.
  - **Also:** it lowers the `palace` asset to the Табачная, writes a start per stop (`starts.gull` …
    `starts.tabachnaya`), and returns `remove` for balcony records in a route's way.
- **blame** (`grow-blame.mjs`, `blame-*.mjs`):
  - eight strata;
  - megawalls pierced by framed openings where a route passes;
  - shelves overhead;
  - column forests;
  - cell towers, silos and needles;
  - stairs into ceilings, doors high up a wall, bridges ending in air.
  It may `drop` the ways' `support` piers that a wall replaces.
- **stops** (`stops-east.mjs`, `stops-west.mjs`), a set piece at each NPC:

  | Stop | Set piece |
  |---|---|
  | Чайка | a 300 m antenna |
  | Ворон | a pigeonhole canyon and booth |
  | Гаврилов | a welded grate on a 130-step stair |
  | Табачная | a cold boiler hall under the palace |
  | Тамара | a lit window in a 500 m wall |
  | Енот | a lift shaft and junkyard |
  | Человек в трубе | the heating mains he lives in |

- **steam** (`grow-steam.mjs`, `steam-*.mjs`):
  - gear trains on the megawalls, as `cog` props: some turning, some seized;
  - mains and pipe bundles;
  - cable catenaries (`cables`, look only);
  - vents (`vents`).
  The runtime keeps the 12 nearest emitters live (`src/steam-puffs.js`) and turns gears only
  within 600 m.
- **story** (`story.mjs`): places Quitters' story on the stops, as `courier.spots`, crow perches,
  the raccoon and the finds:

  | Spot | Stop |
  |---|---|
  | roof | Чайка |
  | sorting | Ворон |
  | tamara | Тамара |
  | raccoon | Енот |
  | pipe | Человек в трубе |
  | grille | Гаврилов |
  | works | Табачная |
  | offRoute | the first point of Гаврилов → Табачная |

  It sets `start` to Чайка's roof, and stands a post's mast by each person he is sent to
  (sorting, tamara, raccoon, pipe, grille; `BEACON`): a concrete column 12–26 m from the spot and
  6 m clear of every leg, an amber lantern 45 m over the spot under a concrete cap, a lit strip down
  the face toward the spot, and a light over the spot. They are laid again on each run.

The contract every layer keeps is the header of `grow.mjs`. Two guards hold for every layer after
the ways:
- **The routes' air:** a record that fills a pad's head room or a leg's line is left out.
- **Lost legs:** a layer that unmakes a leg loses its records near it and gives back the piers it
  took.

## Look

- **Theme:** `builders` (`src/themes.js`): the game's own `cosy` look and lens, a cool grey shade, amber from the sun
  only, and haze from 120 to 1700 m.
- **Mist:** `buildersGorge` (base −900).
- **Falling:** below −940 (`abyss.lost`) respawns at the start.

## Checks

- **`testWays` (`scripts/builders/ways.mjs`):** judges every leg on the geometry. A made leg has
  floors at both ends and the air, the way or the wall its move needs.
- **The pilot (`scripts/builders/grow/ways-pilot.mjs`, over `scripts/moves/`):** runs each way
  with the real runner and suit.

## State and what is open (2026-10-19)

- **testWays:** 172/184. Most of the rest are wall runs over 41 m and suit jumps that `heightsOf`
  can't satisfy.
- **The pilot finishes no route yet.** Its best is gull-voron, 37 of 91 points. It fails where a
  glide lands sideways at 26 m/s 17 m before the next jump: the glide must turn onto the next
  jump's line before landing.
- **Not yet seen in play:**
  - the stops' set pieces;
  - the gears at eye level;
  - concrete under the retuned light.
- **Known in the stills:**
  - the palace's painted green floor at the Табачная;
  - the pipe man's stop is a wall at arm's length;
  - no mass overhead on gull-voron.
- **Speed:** blame takes 6 minutes, and the world loads in about 8 s.
