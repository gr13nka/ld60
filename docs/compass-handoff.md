# Quitters compass — implementation handoff

## Intent and agreed decisions

Build a peculiar, intricate, initially hard-to-read **physical compass** for Quitters, inspired by the ornate object in the user's attached screenshot from *The Big Catch: Tacklebox*. It belongs to Quitters' single connected megastructure and the courier's first-person journey. It is a navigation instrument, not a permanent HUD widget. Do not copy the reference object's fish silhouette or exact ornament.

The user has created two kinds of scattered collectible: **matchboxes** and **feathers**. The compass's main mechanism guides the current story/route objective. Separate smaller mechanisms indicate the nearest remaining matchbox and the nearest remaining feather. Its parts should be visually strange but behave consistently enough that the player learns to read them without labels or numbers.

The courier normally keeps the object out of view. They briefly raise it when a collectible comes near, if it is safe to glance at it, and the player can deliberately inspect it for longer. It disappears during fast traversal, a jump, wingsuit flight, and story scenes. The user explicitly approved a brief automatic reveal near collectibles. No permanent corner compass, minimap, distance readout, or objective text.

This is a design brief, not authorization to change story dialogue, collectible meaning, or route order. Where a precise behaviour below is a proposal rather than an explicit user decision, preserve the intent and use judgement during implementation.

## Look and motion

Give it a strong, irregular silhouette: layered rings, a central spiral or dial, offset pivots, dangling or spring-loaded pieces, dents and repairs. Fit the game's concrete, industrial, smoky world: blackened or oxidized metal, a little aged brass, bone or ceramic accents, soot, and wear. Its visual complexity should come from working parts rather than decorative noise.

Suggested readable mapping:

| Part | Job | Motion/signature |
| --- | --- | --- |
| Largest central needle/dial | Current route objective | Steady bearing, with a small settling lag when the player turns. |
| Match striker or toothed arm | Nearest uncollected matchbox | Points toward it; dry tick or increasingly quick tremor nearby. |
| Feather-shaped vane | Nearest uncollected feather | Points toward it; light flutter or lift nearby. |

The exact shapes can change, but each collectible type needs a distinct silhouette and response, not just a different colour. At a glance the central route pointer must remain the strongest signal. Keep the device visible against both the pale architecture and shadowed interiors. A tiny first-person model attached to the camera or hand is a better starting point than a flat screen overlay; it should use the same rendering language as the world and should not clip into nearby solids. Coordinate with the existing hand/smoking presentation so the compass does not intersect it.

## Presence rules

Use one small presence controller for hidden, raising, visible, and lowering states. Feed it facts from the game, then animate it in presentation. Suggested initial rules:

- Auto-glance once when an uncollected matchbox or feather enters a near radius, while the courier is grounded and walking slowly or paused in movement. Keep the glance brief (roughly 1–2 seconds). Let a faint mechanical or feather sound precede or accompany it.
- Do not auto-raise repeatedly each fixed step or every second while the player remains near the same item. Trigger on entry, use a cooldown, and allow another reveal after leaving/re-entering the area or approaching a different item.
- Manual inspect holds or toggles the object up as long as safe. Choose a free, discoverable input in `Input`; avoid overloading E (story interaction and editor) or movement buttons. Give touch users a way to inspect without a permanent gameplay HUD control. Decide its exact gesture/control alongside the existing touch scheme.
- Lower promptly during a sprint, jump, wall movement, wingsuit flight, fall/respawn, pause, editor use, language selection, or any held story card. Resume no automatic animation until normal play returns.
- Never block movement or force a held frame merely to show the compass. A nearby collectible is an invitation to inspect, not an interruption.

Treat thresholds and timing as tuning values at the top of the owning module. Use hysteresis or equivalent state so speed and distance hovering around a threshold do not make the object chatter.

## Bearings and target choice

The route pointer represents **where to go next**, not a raw line through concrete. In the connected megastructure, a bearing directly to a distant story spot can repeatedly point through walls or across inaccessible gaps. Provide an authored route point or small waypoint chain where necessary. It can lead toward the next turn or crossing, then toward the story spot. Route navigation is guidance, not automatic pathfinding.

The current destination comes from story state. `CourierStory` has ordered scenes followed by optional/free scenes and an off-route branch. Do not infer the destination from the nearest NPC, hard-code one marker for all of Act 3, or reveal the hidden `works` ending before the story has made that route known. If there is no single legitimate current goal, let the central needle rest, wander, or indicate the last known route rather than claim certainty. Define this as a small story-facing navigation API so the compass does not read internal indices and branching flags throughout its rendering code.

For collectibles, select the closest **uncollected** item of each type independently. Use stable IDs and update the target when an item is taken, not only when the player crosses a radius. The pointer may initially use horizontal bearing, but the world has stacked balconies: if a target is above or below, add a restrained height cue (rise/dip or a suspended bead) so the device does not misleadingly imply it is on the current floor. Suppress or quiet a part when its type has no remaining item. Avoid rapid switching between two nearly equidistant items; keep the current target until another is meaningfully closer.

## Existing code to integrate with

- `docs/quitters.md` describes the current game boundary and must be read before editing world, story, movement, or editor behaviour.
- `src/quitters-game.js` owns the fixed-step update, story and player state, save, and one-frame presentation. Its `update()` reads input and returns early for editor, blocked input, pause, and held story; its `render()` updates `PlayerCamera` and presents `Smoker` before picture rendering. Use these boundaries: decide targets and presence in fixed steps; animate/display the model once per rendered frame.
- `src/courier.js` owns scene order, `sceneIndex`, `seen`, optional scenes and the off-route state. `src/courier-script.js` maps scene IDs to named spots. `src/places/builders.json` contains the `courier.spots` coordinates. `QuittersGame.storySpots()` grounds those spots. Add a narrow method that answers the available destination instead of making the compass parse story internals.
- `src/parkour-world.js` stands the one place. `src/places.js` loads and validates `builders.json`. Collectible positions should have one authoritative owner in the place data or the collectible system the user has already made; do not duplicate positions in a compass module.
- `src/input.js` consolidates keyboard, mouse and touch into one control record. E is `interact`; C, F, Q, R, M/Tab and Escape already have uses. Check the current bindings before picking a manual compass input.
- `src/viewmodel.js`/`Smoker` already owns a camera-attached first-person object. Integrate or coordinate rather than stacking unrelated hands and props. `PlayerCamera` handles eye/solid clearance; the compass should not move the camera after its update.
- `src/quitters-game.js` currently writes `quitters.story.v1` with position and `story.snapshot()`. If collectible state is not already saved, add stable collected IDs without erasing any existing story/choice data; update restart semantics deliberately. Old Do Not Smoke!!! saves must remain untouched.

The working tree already contained unrelated edits at handoff time. Inspect the current versions before editing and preserve those changes. The current source scan did not find a documented placement/persistence interface for matchboxes and feathers, so locate the user's actual collectible records before designing another one.

## Scope and completion criteria

Deliver a code-native compass model and animation, independent target selection for route/matchbox/feather, short contextual reveal plus manual inspect, safe suppression during movement and story, and integration with collectible removal and save state. Keep the game free of a persistent gameplay HUD. Do not add floating text, collectible counters, arrows on the world, or a map as part of this feature.

The feature is ready for the owner to judge when: (1) it briefly appears once near a new collectible while walking; (2) the player can inspect it on demand; (3) each part consistently reacts to its own target and falls quiet when none remains; (4) the route pointer changes with the story without spoiling hidden routes or pointing blindly through a wall; (5) the device gets out of the way during parkour, flight and dialogue; and (6) collected objects stay collected after a reload without damaging earlier progress.

For a prototype implementation, follow the repository's AGENTS.md rule: stop when the artifact is written. Do not run the game, tests, lint, typecheck, build, browser or screenshot capture unless the owner explicitly asks for verification.
