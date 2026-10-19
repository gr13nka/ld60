// What a level looks like: its sky, its light, the shape and colour of its ground, and what
// grows there. A level names one of these; the world, the forest and the fog follow it.

/**
 * - `sky`: zenith and horizon colours, whether stars show, and optionally `afterglow`, the
 *   colour of the last daylight low in the sky ahead;
 * - `fog`: colour and the distances it starts and saturates at;
 * - `light`: the sky and ground colours of the ambient light and its strength, then the sun
 *   (or moon): colour, strength and the direction it shines from;
 * - `ground`: colour of low and high terrain, and of paved city blocks; `rock` (optional) is
 *   `{ color, from, full }`, bare rock that takes over between those heights in metres;
 * - `terrain`: `hills` scales their height; the valley is flat for `floor` metres either side
 *   of the road; the walls that fence it in start `wallStart` out, are full height (`wallHeight`)
 *   by `wallFull`; `terrace` > 0 cuts the hills into steps that tall, as mesas; `mountain`
 *   (optional) stands in for the wall on one side: `{ side, start, full, height }`, `side` +1
 *   for +X (the left, looking down the level) or -1;
 * - `later` (optional): `{ sky, fog, light }` again — what those have become by the far
 *   end of the level, which they turn into as the player goes along it: all the way along, or
 *   over the stretch `between` (optional) gives, as two fractions of the level's length. Stars and moon come
 *   out with it. The sun stays where `light.sunFrom` put it;
 * - `cycle` (optional): in place of `later`, looks `{ at, sky, fog, light }` that the air goes
 *   round as a wheel, by the share of the way `at` (0 to 1) that `present` is told, the last turning
 *   into the first: the pit's, by depth within a turn (`themes.js`'s `pit`);
 * - `clouds` (optional): `floor`, the height in metres above which the ground is cloud, with
 *   banks of it lying where scrub and trees would be (Eden's way up, `cloud-floor.js`). It goes
 *   by how high the way itself has got, so a stretch is cloud right across or not at all. No
 *   theme has clouds in the sky: a layer of them ran through every building taller than it;
 * - `lens` (optional): `vignette`, how much the picture's corners darken, `shadowTint`, a colour
 *   added to its darkest parts, and `tunnel`, how much of the light is taken at the far corners
 *   on foot (VHOLUME's dark lens, `foot-view.js`, unless said);
 * - `shade` (optional): how the picture is drawn here, one of `LOOKS` (below; the game's hard
 *   cartoon unless said). The address's `shade=<name>` wears another, `look=old` none;
 * - `fireflies` (optional): whether they are out around the start;
 * - `crickets` (optional): whether they are heard until the fire starts;
 * - `glow`: how much the picture blooms — `strength`, and the brightness `threshold` it starts at;
 * - `trees`: `shape` ('pine', 'round' or 'cactus'), colours, ranges of crown width and
 *   height, and `density` multiplying the level's own;
 * - `towers` (optional): 'neon' for a city's towers traced in coloured light, their windows
 *   lit in as many colours (`models.js`); 'hive' for a megastructure's concrete, no window
 *   lit; warm windows in dark walls unless said;
 * - `finish` (optional): how the sign at the far end stands here: 'steel' (unless said), 'timber',
 *   or 'neon' where it would be lost in the dark (`targets.js`);
 * - `shadow` (optional): where the sun's shadows are drawn, `{ span, depth, normalBias }`: metres
 *   across and along the light, and the bias that keeps a face from shading itself. A city's
 *   unless said; a room's are a few metres across, or its walls let the light through
 *   (`atmosphere.js`). Only the shadow camera's size changes, so nothing is rebuilt for it.
 */
const DUSK = {
  sky: { top: 0x07112a, horizon: 0x3c6c86, stars: true },
  fog: { color: 0x284a5e, near: 180, far: 1000 },
  // The moon stands ahead and to the right, low enough to be in view.
  light: { sky: 0x9dbfe0, ground: 0x1a2530, ambient: 1.7, sun: 0xb4ccff, sunPower: 1.6, sunFrom: [-0.55, 0.45, 0.7] },
  ground: { low: 0x1f3f3c, high: 0x4c6c5a, paved: 0x23272f },
  terrain: { hills: 1, floor: 25, wallStart: 330, wallFull: 560, wallHeight: 110, terrace: 0 },
  glow: { strength: 0.6, threshold: 0.6 },
  trees: { shape: 'pine', colors: [0x1d4a44, 0x24564a, 0x1a403f], width: [5, 9], height: [10, 20], density: 1 },
}

// What the levels set after sundown share: a darker-cornered, blue-shadowed picture,
// fireflies and a sign at the far end traced in neon. Kept out of DUSK because the daytime themes are built on that.
const EVENING = { lens: { vignette: 0.45, shadowTint: 0x0a1222 }, fireflies: true, crickets: true, finish: 'neon' }

// The works: a painted works on a summer afternoon, against the genre's grey (the owner's ask,
// 2026-10-13: brighter, colourful, fantasy post-Soviet). The haze stays, and is the sky's blue
// and not the whitewash's near-white, so that the far wall is seen to be bluer than the near one and size still reads
// (`docs/research/vholume-level-design.md`, rule 3); the ground light is warm, a bounce off the
// painted floors; the sun stands to one side so that a lathe's facets differ. The glow
// threshold is over the whitewash (about 0.9 lit), so that only the lamps bloom. The lens is
// nearly clear: VHOLUME's dark edges and a brown in the shadows made a sunny place look dirty.
// `works` is this for the gauge and the shaft; `intake` is the Palace of Culture (`places/palace.json`), the
// same in softer steps, under the `pale` mist the palace wears.
const WORKS = {
  ...DUSK,
  towers: 'hive',
  lens: { vignette: 0.05, tunnel: 0.12 },
  sky: { top: 0x3f8fd8, horizon: 0xdcecf4, stars: false },
  fog: { color: 0xa8cce8, near: 60, far: 1400 },
  light: { sky: 0xdcecff, ground: 0x8a7a5a, ambient: 2.2, sun: 0xfff0d0, sunPower: 2.4, sunFrom: [-0.5, 0.6, 0.6] },
  ground: { low: 0xd6c4a2, high: 0xe4ddcc, paved: 0xd6c4a2 },
  terrain: { ...DUSK.terrain, hills: 0 },
  glow: { strength: 0.6, threshold: 1.05 },
  trees: { ...DUSK.trees, density: 0 },
}

// How a place's picture may be drawn, by name: a theme's `shade`, or any of them over any
// place for comparing (`?shade=`, L in play), or tuned in play (`look-tuner.js`, `&looks`). Each
// says (`picture.js`'s `setLook`, every part optional, none of it unless said):
// - `ramp`: how light falls across a surface, a name in `shading.js`'s `RAMPS` (in steps, as a
//   cartoon's cels, the hard ones unless said, or `smooth`);
// - `ink`: outlines, any of their `color`, `strength`, `edge` and `fade` in place of the game's
//   black (`picture.js`'s `INK`), or `false` for none;
// - `grain`: how strong the real surfaces' relief is on what is painted with grain, and
//   `relief`, how deep it is lit as relief (`shading.js`'s `setSurface`, as is the next);
// - `wear`: `{ patches, streaks, dirt }`, grime over the paint and its colour;
// - `occlusion`: creases, corners and the feet of walls darkened, `{ strength, radius, grime }`,
//   the radius in metres, and the colour they darken toward (black unless said);
// - `grade`: `saturation` (1 as it is); `shadows` and `lights`, what the dark and the light
//   are multiplied by, `[r, g, b]`; `lift`, a colour added into the darkest parts;
// - `palette`: `{ colors: [dark, middle, light], amount }`, a painter's few colours laid by value
//   (`picture.js`'s `Lens`): each point of the picture keeps its lightness and takes, by `amount`
//   (0 to 1), the colour of the palette at that lightness, each colour placed at its own;
//   what is left of the paint's own colour is `1 − amount`;
// - `tone`: filmic tone mapping, `agx`, `aces` or `neutral`, and `exposure` with it;
// - `sharpen`: how far short of its hardest the picture's sharpening stops, in halvings
//   (`picture.js`'s `SHARPENING_STOPS`, 0.3, unless said): more is softer and steadier;
// - `retro`: the picture shown on a PlayStation's screen, as Arctic Eggs is (`picture.js`'s
//   `RetroPass`): `{ lines, depth, fringe, scanlines, corners, far, steady }`, the blocks up the
//   picture, the bits a channel, how far red and blue part (of a block), how dark a block's foot,
//   how round the corners (of the height); the metres from which far blocks are calm (softer,
//   neither cut nor dithered), and how much of the last frame each block keeps, against shimmer
//   when moving; `glow`, `{ strength, from, size }`, what is brighter than `from` (of white) shed
//   softly over the screen, from a tight halo (`size` 0) to a haze (1); `vignette`, how dark the
//   corners go.
//
// - `soft`, a bright place (`docs/research/visual-style.md`, the owner's ask of 2026-10-14):
//   soft steps whose shadow side keeps its paint, an ink of the mist's own deep blue at half
//   strength that outlines things and leaves the creases of a form alone, fading early so the
//   depth stays calm, and the grain of limewash and concrete on what is painted.
// - `brut`, raw concrete in hard daylight (`THEMES.brut`): dark shadow sides (`RAMPS.brut`) and
//   a firmer ink, so a mass reads as heavy.
// - `eggs`, after Arctic Eggs (2026-10-16): no cels and no ink, light falling off smoothly; the
//   real surfaces' relief lit; dirt only where it gathers; the creases darkened; on a
//   PlayStation's screen, blocks 300 up, five bits a channel dithered, a little fringe, faint
//   scanlines, round corners; a cold grade. Of the looks of 2026-10-15/16 (realistic, relief,
//   painted in oils, grimy, eggs) the owner kept this one: "eggs is very good, remove all
//   editions except eggs".
//   Two of its kind made the same day went at the owner's word ("other all are bad"): `clay`,
//   kneaded lumps lit as height after Vangers, and `lucid`, every surface in Lucid Blocks' pixel
//   tiles.
// - `disco`, eggs in Disco Elysium's colours (the same day: "ochra greenish orange brown with
//   deep blue feel a bit dirtsh"): its palette, deep blue in the shadows, olive in the
//   half-tones, ochre in the light, over what is left of the paint's own colour; creases sunk
//   into the blue; grime olive-umber and a little thicker. The colour is all in the grade, none
//   in the paint (the owner, of an earlier look: "I dont like that the purple is part of the
//   texture"). Every number of it is a first guess, seen only in stills; the tuner is for
//   finding them (`look-tuner.js`).
// - `crisp` and `calm`, eggs as the owner tuned it in play (the same day, both sent back from the
//   tuner: "or this looks good"): finer blocks (540 up) cut to three bits a channel, the colour
//   at full, a breath of disco's palette, a little more grime. `crisp` has no far calm and no
//   steadiness; `calm` has both (from 230 m, 0.35), deeper relief and creases, and is darker.
// - `cosy`, `crisp` with Easy Delivery Co.'s glow (the same day, of two stills of it: "see this
//   kind of glowy cosy filter? I want smth simular"; first made on `calm`, then "make it closer
//   to the crisp version"): whatever is lit sheds a soft glow over the
//   screen, more a haze over the room than a halo round a lamp, the colour of what sheds it; the
//   corners dark as a tube's; dimmer, the colour drained, the shadows cool and the light warm.
//   Its numbers are first guesses, unseen.
const SMOOTH = { ramp: 'smooth', ink: false, occlusion: { strength: 1, radius: 3 }, tone: 'neutral' }
const SCREEN = { lines: 300, depth: 5, fringe: 0.5, scanlines: 0.1, corners: 0.03, far: 60, steady: 0.75 }
const DISCO = [0x1c2c48, 0x6a6c40, 0xc4924e] // Disco Elysium's deep blue, olive and ochre
const EGGS = {
  ...SMOOTH,
  occlusion: { ...SMOOTH.occlusion, grime: 0x101418 },
  grain: 0.3,
  relief: 1,
  wear: { patches: 0.1, streaks: 0.12, dirt: 0x34383c },
  grade: { saturation: 0.82, shadows: [0.88, 0.96, 1.1], lights: [0.97, 1.0, 1.04], lift: 0x04080e },
  retro: SCREEN,
}
const TUNED_EGGS = {
  ...EGGS,
  wear: { ...EGGS.wear, patches: 0.12 },
  grade: { ...EGGS.grade, saturation: 1 },
}
export const LOOKS = {
  soft: { ramp: 'soft', ink: { color: 0x2b3448, strength: 0.5, edge: [0.07, 0.18], fade: [120, 450] }, grain: 0.16 },
  brut: { ramp: 'brut', ink: { color: 0x1c212c, strength: 0.65, edge: [0.06, 0.16], fade: [250, 1200] }, grain: 0.3 },
  eggs: EGGS,
  crisp: {
    ...TUNED_EGGS,
    palette: { colors: DISCO, amount: 0.1 },
    retro: { ...SCREEN, lines: 540, depth: 3, far: 0, steady: 0 },
  },
  calm: {
    ...TUNED_EGGS,
    occlusion: { ...EGGS.occlusion, strength: 1.1 },
    relief: 1.5,
    palette: { colors: DISCO, amount: 0.15 },
    exposure: 0.9,
    retro: { ...SCREEN, lines: 540, depth: 3, far: 230, steady: 0.35 },
  },
  cosy: {
    ...TUNED_EGGS,
    grade: { saturation: 0.78, shadows: [0.9, 0.98, 1.04], lights: [1.05, 1.0, 0.92], lift: 0x040808 },
    palette: { colors: DISCO, amount: 0.1 },
    exposure: 0.8,
    retro: { ...SCREEN, lines: 540, depth: 3, far: 0, steady: 0, glow: { strength: 0.7, from: 0.4, size: 0.45 }, vignette: 0.5 },
  },
  disco: {
    ...SMOOTH,
    occlusion: { ...SMOOTH.occlusion, grime: 0x0c1626 },
    grain: 0.3,
    relief: 1,
    wear: { patches: 0.16, streaks: 0.16, dirt: 0x3a3424 },
    grade: { saturation: 0.9, lift: 0x060c1a },
    palette: { colors: DISCO, amount: 0.5 },
    retro: SCREEN,
  },
}

// The mists a place can wear, by name: its `mists` (`places.js`) lie at once, and the number
// keys switch each in play (`?mist=`, `dev-switches.md`). A mist is air that lies in the depths
// and is drawn over the picture by height (`picture.js`): its `color`; `base`, the height in
// metres at which it is `density` thick (the share of the light it takes in a metre); `height`,
// the metres up over which it thins to about a third, and again for each as many more; `most`,
// the most of anything it hides; `glow` (optional), from 0 to 1, how far it takes the sun's
// colour where it is looked through toward the sun; `banks` (optional), from 0 to 1, how much
// thicker and thinner it lies in patches `size` metres across, which the wind carries
// (`atmosphere.js`'s `WIND`). Every number but `pale`'s is a first guess.
// - `ground`: a morning's ground fog, cool white, that buildings stand up out of: the feet of
//   a mass gone, its upper storeys sharp in the sun.
// - `haze`: the air's own blue at every height, thin, so that only distance pales a thing.
// - `sea`: a deep warm layer, a white sea from a roof with the towers standing out of it.
// - `smog`: the dust of a works, amber, high and lumpy.
// - `pale`: the palace's, lying over its fan, cooler than the whitewash so that the walls stand
//   out of it: depth pales toward white as distance does to blue, and each bridge down the
//   void is fainter than the one above it.
// - `chasm`: the room's (`places/room.json`), the haze rising out of the gorge under his balcony:
//   blue, its base the gorge's floor 120 m under the flat's, so that it is thin at his eye and
//   thickens as he looks down, each viaduct below paler than the one above it.
export const MISTS = {
  ground: { color: 0xdfe8ee, base: 0, height: 8, density: 0.016, most: 0.95, glow: 0.6, banks: 0.5, size: 80 },
  haze: { color: 0xb9cfe2, base: 0, height: 400, density: 0.0012, most: 0.85, glow: 0.8 },
  sea: { color: 0xf2ece2, base: 0, height: 45, density: 0.03, most: 1, glow: 1, banks: 0.35, size: 120 },
  smog: { color: 0xb89a78, base: 0, height: 160, density: 0.004, most: 0.8, glow: 0.5, banks: 0.6, size: 90 },
  pale: { color: 0xd4e6f0, base: 30, height: 140, density: 0.005, most: 0.7 },
  // The builders' yard's drop: banks below its decks, where the runner is lost (`abyss.lost`, -60 m).
  yardGorge: { color: 0x7a90a8, base: -110, height: 45, density: 0.004, most: 0.8, glow: 0.6 },
  chasm: { color: 0x7a90a8, base: -120, height: 45, density: 0.006, most: 0.85, glow: 0.6 },
  // The edited balcony's delivery galleries reach -253 m; keep its air below those floors.
  balconyGorge: { color: 0x7a90a8, base: -310, height: 45, density: 0.004, most: 0.8, glow: 0.6 },
  // The builders' copy descends to the Табачная at -503 and its ways to -547: its air lies below them, warm under amber light.
  buildersGorge: { color: 0x8a7c6a, base: -900, height: 60, density: 0.003, most: 0.8, glow: 0.6 },
}

export const THEMES = {
  dusk: { ...DUSK, ...EVENING, sky: { ...DUSK.sky, afterglow: 0xff8a5a }, glow: { strength: 0.8, threshold: 0.55 } },
  dawn: {
    ...DUSK,
    sky: { top: 0x2a3a6e, horizon: 0xf2a07a, stars: false },
    fog: { color: 0xc98f86, near: 220, far: 1300 },
    light: { sky: 0xf0c8c0, ground: 0x2a3038, ambient: 1.9, sun: 0xffb380, sunPower: 1.8, sunFrom: [0.3, 0.35, 1] },
    ground: { low: 0x3f5a3e, high: 0x7d8a58, paved: 0x3a3c44 },
    trees: { ...DUSK.trees, colors: [0x2f5a40, 0x3a6a48, 0x285040] },
  },
  autumn: {
    ...DUSK,
    sky: { top: 0x355f9a, horizon: 0xf0d0a0, stars: false },
    fog: { color: 0xd0b090, near: 220, far: 1300 },
    light: { sky: 0xffe0c0, ground: 0x3a3020, ambient: 2, sun: 0xffc890, sunPower: 2.2, sunFrom: [-0.5, 0.45, 0.5] },
    ground: { low: 0x6a5a30, high: 0x9a8040, paved: 0x3a3c44 },
    trees: { shape: 'round', colors: [0xc8641e, 0xd99a2a, 0x9a3a1c, 0x6a7a30], width: [6, 9], height: [9, 15], density: 1 },
    finish: 'timber',
  },
  desert: {
    sky: { top: 0x2f6fb0, horizon: 0xf6c58a, stars: false },
    fog: { color: 0xe0a878, near: 260, far: 1500 },
    light: { sky: 0xffe2b8, ground: 0x6a4028, ambient: 2, sun: 0xffd9a0, sunPower: 2.4, sunFrom: [-0.7, 0.5, 0.2] },
    ground: { low: 0xb8733f, high: 0xd99a5a, paved: 0x4a4038 },
    terrain: { hills: 1.6, floor: 30, wallStart: 240, wallFull: 420, wallHeight: 170, terrace: 14 },
    glow: DUSK.glow,
    trees: { shape: 'cactus', colors: [0x4f7a4a, 0x5c8650, 0x466e48], width: [1.6, 2.6], height: [5, 10], density: 0.35 },
    finish: 'timber',
  },
  farm: {
    sky: { top: 0x2f78d0, horizon: 0xbfe0f5, stars: false },
    fog: { color: 0xa8d0e8, near: 300, far: 1700 },
    light: { sky: 0xd8ecff, ground: 0x4a5a30, ambient: 2.3, sun: 0xfff6dc, sunPower: 2.6, sunFrom: [0.3, 1, 0.2] },
    ground: { low: 0x5f9a45, high: 0xa8b85a, paved: 0x4a4c52, rock: { color: 0x8f9499, from: 110, full: 200 } },
    // A narrow valley: a village's width of level ground, low hills behind it, and a mountain
    // going up from the other side of the road.
    terrain: { hills: 0.6, floor: 34, wallStart: 150, wallFull: 420, wallHeight: 70, terrace: 0, mountain: { side: 1, start: 70, full: 420, height: 340 } },
    glow: DUSK.glow,
    trees: { shape: 'round', colors: [0x3f7a35, 0x4c8a3c, 0x356a30], width: [7, 11], height: [8, 13], density: 0.55 },
    finish: 'timber',
  },
  snow: {
    ...DUSK,
    sky: { top: 0x6f8fb4, horizon: 0xdfe8f2, stars: false },
    fog: { color: 0xcfdbe8, near: 140, far: 800 },
    light: { sky: 0xe8f0ff, ground: 0x8090a8, ambient: 2.2, sun: 0xfff4e0, sunPower: 1.4, sunFrom: [0.5, 0.6, -0.3] },
    ground: { low: 0xdfe8f0, high: 0xffffff, paved: 0x8a94a0 },
    // Sunlit snow reaches about 1.1; the threshold sits above it so only fire blooms.
    glow: { strength: 0.55, threshold: 1.2 },
    trees: { ...DUSK.trees, colors: [0x2c4a48, 0x3a5a56, 0xbfd0d8], density: 0.8 },
  },
  sunset: {
    ...DUSK,
    ...EVENING,
    sky: { top: 0x3a2a5a, horizon: 0xff8a4a, stars: false },
    fog: { color: 0xb86a50, near: 180, far: 1100 },
    light: { sky: 0xffb090, ground: 0x2a2028, ambient: 1.8, sun: 0xff9a5a, sunPower: 2, sunFrom: [0.2, 0.25, 1] },
    ground: { low: 0x3a3030, high: 0x6a5040, paved: 0x2a2428 },
    trees: { ...DUSK.trees, colors: [0x2a3a34, 0x34443a, 0x24322e] },
  },
  // The last of a sunset from a mountain top, and night by the time the valley is reached.
  // The land falls away either side of the line down: a spur, not a valley.
  nightfall: {
    ...EVENING,
    sky: { top: 0x3a2a5a, horizon: 0xff8a4a, stars: false, afterglow: 0xff7a4a },
    fog: { color: 0xb86a50, near: 320, far: 2000 },
    // From where the moon will be, so that shadows hold still while the light changes.
    light: { sky: 0xffb090, ground: 0x2a2028, ambient: 1.8, sun: 0xff9a5a, sunPower: 2, sunFrom: DUSK.light.sunFrom },
    later: {
      sky: { top: 0x050a1c, horizon: 0x24405e, stars: true, afterglow: 0x1f4a78 },
      fog: { color: 0x1a2c40, near: 220, far: 1400 },
      light: { sky: 0x8fb0e0, ground: 0x141c28, ambient: 1.5, sun: 0xb4ccff, sunPower: 1.4 },
    },
    ground: { low: 0x344a3c, high: 0x5e5a56, paved: 0x2a2428, rock: { color: 0x8a8090, from: 230, full: 380 } },
    terrain: { hills: 1.5, floor: 45, wallStart: 170, wallFull: 520, wallHeight: -130, terrace: 0 },
    glow: DUSK.glow,
    trees: { ...DUSK.trees, colors: [0x2a3a34, 0x34443a, 0x24322e], density: 0.8 },
  },
  // A mountain climbed out of the world: pines and bare rock under an ordinary noon at its
  // foot, and from where the weather lies on it nothing but shining cloud, under a gold sky.
  // A spur, as `nightfall` is: the land falls away either side of the way up.
  ascension: {
    sky: { top: 0x3976b5, horizon: 0xcbdce9, stars: false },
    fog: { color: 0xb8cbdc, near: 450, far: 2200 },
    // From behind the climber: the slope ahead, and every riser on it, is in the sun.
    light: { sky: 0xe4efff, ground: 0x8a93a8, ambient: 1.2, sun: 0xffefd5, sunPower: 1.3, sunFrom: [-0.35, 0.75, -0.5] },
    later: {
      // Blue and gold mix to mud, so the change is quick: it comes with breaking through the cloud line.
      between: [0.27, 0.39],
      // A climber looks up the slope, at the top of the sky: that is what has to turn to gold.
      sky: { top: 0xffd88a, horizon: 0xfff4d6, stars: false, afterglow: 0xffc060 },
      fog: { color: 0xfdeccc, near: 500, far: 2600 },
      light: { sky: 0xfffcf4, ground: 0xe6dcc8, ambient: 1.4, sun: 0xfff4dc, sunPower: 1.15 },
    },
    ground: { low: 0x3d5a47, high: 0x7c8693, paved: 0x566171 },
    terrain: { hills: 1.4, floor: 110, wallStart: 190, wallFull: 560, wallHeight: -170, terrace: 20 },
    clouds: { floor: 500 },
    // Cloud in the sun is just over the threshold: it shines, and the gold blazes.
    glow: { strength: 0.6, threshold: 1.2 },
    trees: { shape: 'pine', colors: [0x244f44, 0x356451, 0x1e403b], width: [4, 7], height: [12, 22], density: 0.5 },
  },
  // A city that is never dark: a teal night over a sodium-orange horizon, and megastructures
  // traced in light. The air is kept near neutral, so that the colour is the lamps' own.
  neon: {
    ...DUSK,
    lens: { vignette: 0.3, shadowTint: 0x061420 },
    finish: 'neon',
    towers: 'neon',
    sky: { top: 0x050a1e, horizon: 0x1f5a78, stars: true, afterglow: 0xff7a3a },
    fog: { color: 0x1c3a52, near: 220, far: 1400 },
    // The moon is nearly overhead: between towers this tall, a low one would leave the street in shadow.
    light: { sky: 0xb0c8f0, ground: 0x4a4038, ambient: 1.8, sun: 0xd8e4ff, sunPower: 1.1, sunFrom: [-0.12, 1, -0.3] },
    ground: { low: 0x161c28, high: 0x2c3848, paved: 0x20242e },
    terrain: { ...DUSK.terrain, hills: 0.4 },
    // Above the lit street and the windows, so that only the neon and the fire glow.
    glow: { strength: 0.75, threshold: 0.8 },
    trees: { ...DUSK.trees, colors: [0x1a4a52, 0x20565a, 0x183e4a], density: 0.6 },
  },
  // The Works of the challenge mode: an overcast evening over a factory, sodium orange along
  // the horizon, the air thick with it, so that the far end of a well is a guess. The sun
  // stands high, or a shaft would be dark all the way down.
  factory: {
    ...DUSK,
    lens: { vignette: 0.4, shadowTint: 0x100e0c },
    finish: 'neon',
    sky: { top: 0x15181f, horizon: 0x4a4038, stars: false, afterglow: 0xc8702c },
    fog: { color: 0x37332e, near: 150, far: 700 },
    light: { sky: 0xb8aea2, ground: 0x262220, ambient: 1.6, sun: 0xffc890, sunPower: 1.3, sunFrom: [-0.3, 0.85, 0.35] },
    ground: { low: 0x3a3d44, high: 0x4a4e56, paved: 0x282b31 },
    terrain: { ...DUSK.terrain, hills: 0 },
    glow: { strength: 0.7, threshold: 0.75 },
    trees: { ...DUSK.trees, density: 0 },
  },
  // The parkour's sample (`parkour-sample.js`), after VHOLUME: the inside of a megastructure,
  // in a pale haze. Size is read off the haze: what is near is dark and what is far is nearly
  // the sky's colour, so a wall half a kilometre off is seen to be half a kilometre off. Hence
  // fog that begins at 40 m and has taken everything by 1100: a dark or a thin one (both were
  // tried) left the far wall as sharp as the near one, and a fan 400 m across looked like a
  // toy. Sky, horizon and fog are one colour, so there is no ground and no skyline anywhere.
  // The sun stands nearly overhead, or the canyon would be in shadow all the way down.
  hive: {
    ...DUSK,
    towers: 'hive',
    lens: { vignette: 0.35, shadowTint: 0x0c120e },
    sky: { top: 0xc6cabd, horizon: 0xb4b9ac, stars: false },
    fog: { color: 0xb4b9ac, near: 40, far: 1100 },
    light: { sky: 0xd8dccc, ground: 0x3a3f36, ambient: 1.5, sun: 0xfff2d8, sunPower: 1.1, sunFrom: [0.1, 1, 0.15] },
    ground: { low: 0x8a8f84, high: 0x9a9f94, paved: 0x8a8f84 },
    terrain: { ...DUSK.terrain, hills: 0 },
    // Above the sky and the lit concrete, so that only the lamps and a lit window glow.
    glow: { strength: 0.6, threshold: 1.05 },
    trees: { ...DUSK.trees, density: 0 },
  },
  works: WORKS,
  intake: { ...WORKS, shade: LOOKS.soft },
  // The balcony's sunset over the gorge under `cosy`, as the builders' balcony wears it
  // (`Gas-routes`, 2026-10-17), for the builders' yard: warm and coloured where `intake` was pale.
  balcony: {
    ...DUSK,
    shade: LOOKS.cosy,
    towers: 'hive',
    lens: { vignette: 0.4, shadowTint: 0x0a1418, tunnel: 0.3 },
    sky: { top: 0x3e7a86, horizon: 0xf0a868, afterglow: 0xff8a40, stars: false },
    fog: { color: 0x7d8fa0, near: 60, far: 1400 },
    light: { sky: 0x8aa8c0, ground: 0x5a4a40, ambient: 1.1, sun: 0xffa458, sunPower: 2.3, sunFrom: [-0.5, 0.15, 0.85] },
    ground: { low: 0x3a2a20, high: 0x4a3a2a, paved: 0x3a2a20 },
    terrain: { ...DUSK.terrain, hills: 0 },
    glow: { strength: 0.7, threshold: 0.9 },
    trees: { ...DUSK.trees, density: 0 },
  },
  // Raw concrete in hard daylight, for the brutalist landmarks (`asset-*.js`) in the showroom:
  // the owner, of SESC Pompéia in `intake`'s pale mist, "not even close that brutal... Maybe we
  // need to adjust shading light or textures" (2026-10-14). Clear air, so a mass stands sharp
  // against the sky and its size is read off its formwork and openings (`GRAIN.formwork`), not
  // off haze, which is only far off; a sun low to one side (27°), so each face of a block is a
  // tone of its own and every overhang and bridge throws a long shadow; dark shadow sides
  // (`RAMPS.brut`) and a firmer ink, so a mass reads as heavy. The sun nearly white and the light
  // off the ground grey: with the works' warm ones, grey concrete read as beige ("the colors and
  // size are weird"). The ground paved in pale concrete (`street`): asphalt read as a black void.
  brut: {
    ...WORKS,
    sky: { top: 0x2f7fd0, horizon: 0xcfe0ea, stars: false },
    fog: { color: 0xbcd3e4, near: 150, far: 2600 }, // from far enough that a landmark stays sharp, near enough that the ground fades into the horizon
    light: { sky: 0xd4e2f2, ground: 0x6c6c68, ambient: 1.3, sun: 0xfff8ee, sunPower: 3, sunFrom: [0.55, 0.45, -0.7] },
    ground: { low: 0x8b8478, high: 0x968f82, paved: 0x8b8478 },
    street: 0x9a9893, // a parkour place's ground, for `ParkourWorld`; asphalt where a theme gives none
    shade: LOOKS.brut,
  },

  // The tunnels (`places/tunnels.json`): an evening of no colour of its own, so that each
  // tunnel's lamps (the place's `lights`) are what colour it and its paints are seen in each
  // light (the owner, 2026-10-15: "tunnels in different colors to see how the texture is looking
  // in different locations"; the knot before it, violet, coloured everything). A grey-blue sky
  // going dark, a low sky light so that a tunnel is lit by its own lamps, and a low warm sun from
  // one side for the buildings round about, whose shadows keep it out of the tunnels.
  tunnels: {
    ...DUSK,
    towers: 'hive',
    lens: { vignette: 0.2, tunnel: 0.12 },
    // At first a sky light of 0.55 and a sun of 1.6 under a dark sky: night, and the daylight row
    // that is the reference was black. Inside a tunnel its lamps still lead: the sun is shut out.
    sky: { top: 0x34405a, horizon: 0xb0aeb0, stars: false, afterglow: 0xe0b090 },
    fog: { color: 0x7a808c, near: 200, far: 2200 },
    light: { sky: 0xa8b0c0, ground: 0x3a3632, ambient: 0.9, sun: 0xffd8b0, sunPower: 2.2, sunFrom: [0.7, 0.35, -0.4] },
    ground: { low: 0x55555a, high: 0x606064, paved: 0x55555a },
    street: 0x6a6866, // paved in plain concrete, grained
    terrain: { ...DUSK.terrain, hills: 0 },
    glow: { strength: 0.6, threshold: 0.85 },
    trees: { ...DUSK.trees, density: 0 },
    shade: LOOKS.cosy, // the owner, 2026-10-16: "lets use this cosy by default for now"
  },

  // The inside of the megastructure (`parkour-inside.js`), after VHOLUME's corridors: one
  // sepia, the air thick with it, so that the far end of a corridor is a glow and not a wall,
  // yet thin enough that the far side of the chasm, 90 m off, is still there.
  // Dim, since nothing lights a corridor but the sky's own light: the lamps are seen by their
  // glow. The sun is weak and overhead: it is only ever met in the well.
  conapt: {
    ...DUSK,
    towers: 'hive',
    lens: { vignette: 0.5, shadowTint: 0x140c04 },
    sky: { top: 0xb89a66, horizon: 0x8f7448, stars: false },
    fog: { color: 0x8f7448, near: 8, far: 260 },
    light: { sky: 0xe0b878, ground: 0x5a4226, ambient: 1.2, sun: 0xffe2b0, sunPower: 0.5, sunFrom: [0.05, 1, 0.1] },
    ground: { low: 0x6a5636, high: 0x7a6644, paved: 0x6a5636 },
    terrain: { ...DUSK.terrain, hills: 0 },
    glow: { strength: 0.8, threshold: 0.9 },
    trees: { ...DUSK.trees, density: 0 },
  },
  // The room (`places/room.json`), the story's first scene: a bachelor's flat at 4:12 on an
  // October afternoon, and out of its balcony the city's first look: a gorge of tall blocks going
  // away from him, the Spire at its end, as the owner's reference has it (2026-10-17, a still made
  // with an image model: its objects taken, not its paint). A sunset after Disco Elysium's: the
  // sky dusty teal going to burnt orange ahead, the sun low ahead and to his right, so that the
  // blocks stand dark blue against it with their right-hand faces lit orange, and the haze blue,
  // thickening into the gorge (`chasm`). The lit windows and the lamp are amber. The sun's
  // shadows are drawn over the room and its balcony alone (`shadow`), fine enough for its walls
  // and furniture to cast them. Every number a first guess, unseen.
  room: {
    ...DUSK,
    // The look's creases a room's size: at a city's 3 m the television's back and his own hand
    // blacked out the curtain a metre behind them (the owner, 2026-10-17: "the shadow above the tv
    // looks weird and very dark").
    shade: { ...LOOKS.cosy, occlusion: { ...LOOKS.cosy.occlusion, radius: 0.45, strength: 0.7 } },
    towers: 'hive',
    lens: { vignette: 0.4, shadowTint: 0x0a1418, tunnel: 0.3 },
    sky: { top: 0x3e7a86, horizon: 0xf0a868, afterglow: 0xff8a40, stars: false },
    fog: { color: 0x7d8fa0, near: 60, far: 1400 },
    light: { sky: 0x8aa8c0, ground: 0x5a4a40, ambient: 1.2, sun: 0xffa458, sunPower: 2.6, sunFrom: [-0.5, 0.15, 0.85] },
    ground: { low: 0x3a2a20, high: 0x4a3a2a, paved: 0x3a2a20 },
    terrain: { ...DUSK.terrain, hills: 0 },
    glow: { strength: 0.7, threshold: 0.9 },
    trees: { ...DUSK.trees, density: 0 },
    shadow: { span: 24, depth: 60, normalBias: 0.03 },
  },
  // The balcony (`places/balcony.json`), the story's start without the room before it (the
  // owner, 2026-10-17: "cut the room segment entirely, start on the balcony"): the room's air
  // outside, the gorge at sunset under `cosy`, with the city's creases and not the room's. The
  // sun's shadows reach over the balcony and the ledge and gangway along the wing. Every number a
  // first guess, unseen.
  balcony: {
    ...DUSK,
    shade: LOOKS.cosy,
    towers: 'hive',
    lens: { vignette: 0.4, shadowTint: 0x0a1418, tunnel: 0.3 },
    sky: { top: 0x3e7a86, horizon: 0xf0a868, afterglow: 0xff8a40, stars: false },
    fog: { color: 0x7d8fa0, near: 60, far: 1400 },
    light: { sky: 0x8aa8c0, ground: 0x5a4a40, ambient: 1.2, sun: 0xffa458, sunPower: 2.6, sunFrom: [-0.5, 0.15, 0.85] },
    ground: { low: 0x3a2a20, high: 0x4a3a2a, paved: 0x3a2a20 },
    terrain: { ...DUSK.terrain, hills: 0 },
    glow: { strength: 0.7, threshold: 0.9 },
    trees: { ...DUSK.trees, density: 0 },
    shadow: { span: 60, depth: 120, normalBias: 0.04 },
  },
  // The pit (`places/dust.json`): a mine dug so deep it has no bottom, run down a turn at a time
  // (`seam`, `places.js`). Its air goes once round a wheel of colour in each turn, by depth
  // (`cycle`): warm amber at the top of a turn, then rose, violet, indigo and teal as he goes
  // down, then pale through cyan into the gold of the dust he dives through at its foot, and so
  // amber again at the top of the next: the turn below looks as the one he left. Saturated and
  // never grey; it passes through pale light rather than green, and red and green are the
  // game's. Each stop is `{ at, sky, fog, light }`, `at` the share of the turn's depth, each
  // part over the theme's own; the sun stays where the theme has it, high, to light the pit.
  // Every colour is a first guess, unseen.
  pit: {
    ...WORKS,
    lens: { vignette: 0.12, tunnel: 0.12 },
    sky: { top: 0x4a86c8, horizon: 0xf0c27a, stars: false },
    fog: { color: 0xe0b070, near: 120, far: 1500 },
    light: { sky: 0xffe0b0, ground: 0x6a4a2a, ambient: 1.6, sun: 0xffd9a0, sunPower: 2.4, sunFrom: [0.3, 1, 0.2] },
    glow: { strength: 0.6, threshold: 1.05 },
    cycle: [
      { at: 0, sky: { top: 0x4a86c8, horizon: 0xf0c27a }, fog: { color: 0xe0b070, near: 120, far: 1500 }, light: { sky: 0xffe0b0, ground: 0x6a4a2a, ambient: 1.6, sun: 0xffd9a0, sunPower: 2.4 } },
      { at: 0.2, sky: { top: 0x5a5fa8, horizon: 0xf09a8a }, fog: { color: 0xd98a84, near: 120, far: 1400 }, light: { sky: 0xffc8c0, ground: 0x5a3a3a, ambient: 1.5, sun: 0xffb8a0, sunPower: 2.2 } },
      { at: 0.42, sky: { top: 0x3c2f7a, horizon: 0xb87ad0 }, fog: { color: 0x9a6cc0, near: 100, far: 1300 }, light: { sky: 0xd8b8f0, ground: 0x40305a, ambient: 1.45, sun: 0xf0b0d8, sunPower: 2 } },
      { at: 0.62, sky: { top: 0x1c2260, horizon: 0x5a68c8 }, fog: { color: 0x4c5aa8, near: 90, far: 1200 }, light: { sky: 0xa8b8f0, ground: 0x2a2c50, ambient: 1.4, sun: 0xc0c8ff, sunPower: 1.8 } },
      { at: 0.78, sky: { top: 0x10405a, horizon: 0x4ab0b8 }, fog: { color: 0x3c9aa4, near: 80, far: 1100 }, light: { sky: 0x9ae0e0, ground: 0x1e4048, ambient: 1.4, sun: 0xb0f0e8, sunPower: 1.9 } },
      { at: 0.87, sky: { top: 0x6a98b0, horizon: 0xcfe6ea }, fog: { color: 0xbfe0e4, near: 50, far: 800 }, light: { sky: 0xe0f4f4, ground: 0x5a6a6a, ambient: 1.6, sun: 0xf0fff8, sunPower: 1.5 } },
      { at: 0.94, sky: { top: 0xc8b890, horizon: 0xf4e2b8 }, fog: { color: 0xead6a8, near: 20, far: 420 }, light: { sky: 0xfff0d0, ground: 0x8a7a5a, ambient: 1.8, sun: 0xfff0c8, sunPower: 1.2 } },
    ],
  },
  night: {
    ...DUSK,
    ...EVENING,
    sky: { top: 0x02040c, horizon: 0x1a2238, stars: true, afterglow: 0x1f4a78 },
    fog: { color: 0x10182a, near: 160, far: 900 },
    light: { sky: 0x6a80b0, ground: 0x101418, ambient: 1.3, sun: 0x8fa8ff, sunPower: 0.9, sunFrom: [-0.6, 0.7, -0.4] },
    ground: { low: 0x141c24, high: 0x2a3440, paved: 0x16181e },
    // Above the towers' lit windows (about 0.72): between two walls of them their glow was a
    // haze over the whole street. Lamps and fire still bloom.
    glow: { strength: 0.6, threshold: 0.8 },
    trees: { ...DUSK.trees, colors: [0x12302e, 0x183a34, 0x10282a] },
  },
}

// The grown megastructure: the game's own picture (the balcony's `cosy` look and lens, as Quitters
// was drawn), lit so that concrete stays grey under amber (the owner, 2026-10-19): the amber is
// the sun's alone, the shade a cool grey; and a heavy pale haze from 40 m, so each wall further off is
// a paler layer and the depth is read.
THEMES.builders = {
  ...THEMES.balcony,
  fog: { color: 0xb8a89c, near: 40, far: 700 },
  light: { ...THEMES.balcony.light, sky: 0x7f8a96, ground: 0x48484a, ambient: 0.9, sun: 0xffc488, sunPower: 2.4 },
}
