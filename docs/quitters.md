# Quitters

Quitters has one world, `src/places/builders.json`: a megastructure grown by
`scripts/builders/grow.mjs` round the owner's seven routes (`docs/world.md`). It is collidable
through `ParkourWorld`. The courier's story spots stand on the routes' stops: roof on the gull's
roof, sorting at the Raven's, then tamara, raccoon, pipe and grille, and works at the Табачная.
`scripts/builders/grow/story.mjs` places them, with the NPC homes and the finds. They have not
yet been walked in the game.

`src/main.js` owns frame timing and rendering. `src/quitters-game.js` owns player state,
input, movement, story and the world. `src/parkour.js` and `src/wingsuit.js` supply movement
rules; `src/parkour-world.js` supplies collision and grounding. A fall below the abyss
respawns the courier at the start without losing story progress.

`src/story/courier-en.md` and `courier-ru.md` own the words. `courier-script.js` maps scenes
to eight story spots; `courier.js` owns choices, matches, radio, endings and progress.
Gull, Raven (the crow mesh, perched at the sorting office) and Raccoon have animated figures.
Tamara and the pipe resident currently use human stand-ins. The raccoon (`raccoon.js`, met in `QuittersGame._meetRaccoons`) comes up once
looked at and asks for a light; a click while he asks lends one from the courier's lighter, kept
after the gull took the last cigarette (`Smoker.lend`). Watched as he comes, the courier squats to
his height; his chirrs are `chirr.mp3` at the music's volume. His first scene waits while he comes,
asks, is lit and thanks (`CourierStory.waits`), then opens on it; asked 12 s with no light, it opens
anyway and its match lights him. `?raccoon` begins the run a few metres before him, facing him
(`QuittersGame._startAtRaccoon`); story progress is kept, but the save's place is written over. Spoken story text uses the restored `SaidSign` scene meshes, typed beside its
speaker and drawn through the picture's ink, mist and glow. Choices are scene text too. The
language choice is a black full-screen title drawn through the same picture shader. Pause
draws its held world preview and its words through that shader too, with sound, rating and a
confirmed quit. The first click takes the mouse and the whole screen (`Input.capture`, `fillScreen`),
and any later click or key but Escape takes the screen back if the browser dropped it. Chrome and
Edge in a tab of their own let the game keep Escape (Keyboard Lock): it opens the menu and the
screen stays. In a frame such as itch.io's the browser keeps Escape, which leaves full screen; the
menu's first click takes it back. The
sound control plays the original cog loop and remembers music and volume separately from story
progress. Play has no story HUD.

Matches and the gull's feathers lie about the place (`finds` in `builders.json`, each with
an `id` of its own; `finds.js`). One is taken by passing through it, on foot or in the suit.
There are twenty, ten of each, every one on a route point where a run leg ends: a floor he crosses
on his feet anyway (`story.mjs`). The feathers lie on the first four ways, so the hook comes by the
pipe. The courier's compass
(`compass.js`, drawn by `compass-model.js` on surfaces painted by `painted.js`) is a piece of
a wall mosaic broken out of the megastructure, a dial set into it. It is held in the left hand
(`Smoker.carry`) and is otherwise out of view. The bent rebar with an ember on the dial points at
whoever the story sends him to next (`CourierStory.destination`, then `QuittersGame._routeGoal`):
the gull and the raccoon where they are now, the others by their spots, the spot itself for
Gavrilov or for anyone wandered off. A bridge's near end comes first when `courier.crossings` says
one lies between. The wire hook ticks toward the nearest match. The wired feather turns toward
the nearest feather. Each part rests when nothing of its kind is left, and the ember goes dull
and the bar wanders off the route and after the last roof scene. The compass comes up once,
briefly, when a find comes near while he walks or stands. G, or a thumb resting still on the
view's side, holds it up. It goes away for a run, a jump, a wall, the suit and every held card.

Taking every feather gives him the hook (`hook.js`, thrown by `QuittersGame._throwHook`): held,
it throws a line up to 130 m at whatever solid is under the sight (`ParkourWorld.solidAlong`)
and draws him there, letting go 16 m short or when the button is let go, his speed kept. It is
thrown in the air, from a jump, a wall or the suit, by any hook button; on his feet only Q
throws it, since Shift, the right button and HOOK slide there. Caught from his feet it pulls
him off them. A floor, a wall or a ledge met on foot ends the hold. Whether he has it is read
from `found`, so the save keeps nothing more.

Five lessons (`lessons.js`) are held frames with one line before the eye. Once a language is
chosen and he has run a few strides with the hand free, the first asks for G (on a touchscreen, a
thumb resting on the right) and waits for it; the compass then comes up for a glance. At the first
edge he runs at with 12 m of air under it (`QuittersGame._edgeAhead`), or his first drop of that
depth, the second asks for Space (Jump) and waits until it is held 2 s unbroken, a bar filling as
it is held; then he goes off the edge with the suit open, so the held Space flies it. Three
landings later, at a run of 10 m/s, the third asks for Shift, the slide. The fourth stops time the
first time he falls at 18 m/s with 20 m of air under him and says R goes back to the last
checkpoint; any key goes on, and R does what it says. The fifth comes up at his next run on his feet
once the last feather is taken: it says the hook is his and waits for Q (on a touchscreen, HOOK,
which throws only in the air). Each line is typed and read before the control counts.

Checkpoints are the routes' running points (`par`, `do: 'run'`): reaching one on his feet, within
5 m and 2.5 m of height, makes it where R and the abyss put him back, facing the next point
(`QuittersGame._reachCheckpoint`, through `ParkourWorld.respawn`). The save keeps it as
`checkpoint`; starting over forgets it. After the first roof scene the gull leaves along the first
route, 5 m over it, so its way is the player's (`Crow.fly`).

Progress and position use only `quitters.story.v1`. Its `found` lists the ids of the finds
taken; a save without it has taken none. Its `taught` lists the lessons taught; a save without
it has been taught none. `?lessons` teaches both again, whatever the save says. Old game saves are neither read nor erased. Starting
over clears story progress and keeps the finds taken. Storage failure leaves the current visit
playable.

On the development server, `?edit` opens the place editor. E toggles it; Ctrl+S saves the
world file through Vite's place endpoint. The editor can move and add forms, boxes, assets,
signs, murals and lights. It cannot edit the generator's cuts, props or checkpoints. What it
saves is kept as the owner's edits and put back by the next grow (`docs/world.md`).

`?lineup` opens a separate conversation room with Gull, Tamara, Raccoon, the pipe resident and
Raven. It always starts at the language screen, ignores route saves, and lets the player walk
up to any figure and press E to talk. Click the scene after choosing a language to capture the
mouse for camera look.

Keyboard movement uses WASD, Space to jump or unfold the wing after a second press in air,
Shift to slide, G to read the compass, and Escape to pause. On touchscreens, the left side moves, the right side
looks, and Jump and Slide buttons supply the two actions.
