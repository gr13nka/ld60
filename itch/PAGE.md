# itch.io page — Quitters

What the page holds, so it can be rebuilt or edited by hand. Images are in `itch/shots/`.

- Page: https://mblw.itch.io/quitters
- Edit: https://itch.io/game/edit/5189714
- State: draft (the edit form read `draft` on 2026-10-19)

## Settings

- Kind of project: HTML, embed 640 × 360, fullscreen button on. No build is marked as played
  in the browser yet.
- Genre: Simulation
- AI disclosure: yes — graphics, code
- Payments: $0 or donate

## Tags

exploration, first-person, ld60, liminal-space, ludum-dare-60, multiple-endings, narrative,
story-rich, vhs — set by the owner; not measured.

## Tagline

Explore megastructure, collect scattered story pieces one by one.

## Description

Liked it? Rate it — five seconds, and it helps a lot. *(rate button)*

**Made in 72 hours for Ludum Dare 60.**

You are a courier in a megastructure with no bottom in sight. Run, climb and glide in a wingsuit
between the few people who still live here, and piece together the story they are part of.

Smoke and chill with the raccoon.

**WASD** move · **Space** jump, again in the air to open the wingsuit · **Shift** slide ·
**G** compass · **Esc** pause

Art director — Mblw · Music — Deadrat

Follow the build: *(TikTok, Instagram, Telegram, Ludum Dare buttons, two to a line)*

*(rate button again, then the comment button)*

## Ratings and links

- Rating page: https://mblw.itch.io/quitters/rate?source=game
- The game asks from the pause (`rate game ★`): the page comes from the frame's referrer, and
  without one it falls back to the old game (`GAME_PAGE` in `src/quitters-game.js` is
  `do-not-smoke`).
- The page asks with image buttons under the opening line and after the text.
- Socials: https://www.tiktok.com/@mr_mblw · https://www.instagram.com/mrmblw/reels/ ·
  https://t.me/yazdelal · https://ldjam.com/events/ludum-dare/60/quitters (the entry is not
  published yet; until then it is `$433864` and this address does not find it).

## Images

- Buttons (`shots/buttons/`): `rate.gif` (600×96, eight frames, the picked choice's brackets
  blink), `comment.png` (600×64), `tiktok.png`, `instagram.png`, `telegram.png`, `ludum.png`
  (294×64). Drawn by the game's own picture as a character's words, in the cosy look:
  `itch/button-render.html?look=cosy&kind=…&frame=…`, saved by `itch/grab-button.sh` from Orca's
  tab with the dev server on :5199 (headless Chromium has no WebGL). The GIF:
  `ffmpeg -framerate 2.5 -i rate-%d.png -filter_complex "split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=none" -loop 0 rate.gif`
- Theme: background `#020608`, panel `#070d10`, text `#cfcabf`, header `#f4f1ea`, links and
  buttons `#ffd24a`, Lato, screenshots in the sidebar.
- Banner (`shots/banner.png`, 960×300): the skyline from 80 m over the roof spot (-3, 80, 5),
  yaw 5.495, pitch -0.12, in the suit, the hands put away, with QUITTERS stood six metres out as
  a SaidSign, so the game's picture draws it; cut from the frame's upper band.
- Screenshots in the sidebar, in order: `1-gull` (the roof scene, the gull smoking his
  cigarette and his line), `2-raccoon` (raccoon-one, "Got a light?", three metres off at 0.6 rad),
  `3-flight` (in the suit 120 m south of the roof and 50 m up, the lattice tower ahead),
  `4-find` (the lit matchbox over the grille spot), `5-canyon` (the raccoon's spot looking up).
  Real frames of the dev build, read from the game's canvas in Orca's tab at 1945×1080, the
  courier put in place from the console (`game.reset`, `game.story._openScene`).

## Left for later

- Cover.
- The Ludum Dare button's address, once the entry is published.
- The pause's rating fallback address (`GAME_PAGE`) still names the old game.
