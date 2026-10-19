// The birds that can play the thief of `crow.js`, by name: what its flight and its snatch need of
// each one's body, in metres as its body is built (`crow-body.js`, `gull-body.js`), how many times
// that it is drawn, and the sound it calls with (`sound.js`). A place's is the crow unless
// `&bird=` names another (`main.js`); `crow-figure.js` gives each its body and poses. Pure.

export const BIRDS = {
  // At its real size the crow was a sparrow from across a place (the owner, 2026-10-16: "make it
  // much bigger... it should be very noticable"): half a metre from beak to tail, drawn 4.4 times.
  crow: {
    size: 4.4,
    beakAhead: 0.218, // from its middle to the tip of its beak, along its heading
    legs: 0.12, // from its middle down to a perch (`crow-figure.js` sets its feet there)
    beakUp: 0.14, // how far the beak rides over its middle at a full flare, the body stood upright and the head level
    call: 'caw',
  },
  // A herring gull, 0.6 m from beak to tail, drawn as long as the crow is: its wings, longer for
  // its length, span more. Its legs and its beak at the snatch as `itch/crow-sheet.html?bird=gull`
  // measures them (2026-10-16).
  gull: {
    size: 3.8,
    beakAhead: 0.275,
    legs: 0.133,
    beakUp: 0.146,
    call: 'gull',
  },
}

/** The bird called `name`, or the crow if there is none of that name. */
export function birdNamed(name) {
  if (!name || name === 'crow') return 'crow'
  if (BIRDS[name]) return name
  console.warn(`there is no bird "${name}": the crow plays the part`)
  return 'crow'
}
