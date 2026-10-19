// Pure per-assembly motion. Runtime clocks stay out of saved prop records.
export const COG_DEFAULTS = Object.freeze({ mode: 'manual', rpm: 0.45 * 60 / (2 * Math.PI), beatsPerRevolution: 4, reverse: false, bpm: 120 })
export const COG_KINDS = ['gearTrain', 'largeCog', 'cogPair', 'largeGearTrain', 'cog']
export function cogAnimationProblem(animation) {
  if (animation === undefined) return null
  if (!animation || typeof animation !== 'object' || Array.isArray(animation)) return 'animation must be an object'
  if (animation.mode !== undefined && !['manual', 'music'].includes(animation.mode)) return 'animation mode must be manual or music'
  for (const key of ['rpm', 'bpm', 'beatsPerRevolution']) {
    if (animation[key] !== undefined && (!Number.isFinite(animation[key]) || (key !== 'rpm' && animation[key] <= 0))) return `${key} must be ${key === 'rpm' ? 'finite' : 'positive and finite'}`
  }
  if (animation.reverse !== undefined && typeof animation.reverse !== 'boolean') return 'reverse must be a boolean'
  return null
}
export function cogStep(state, settings, dt, timing = null) {
  const a = { ...COG_DEFAULTS, ...settings }
  let beats = dt * a.bpm / 60
  if (timing) {
    const expected = dt * timing.bpm / 60
    const delta = timing.beat - state.lastBeat
    // Holds and cuts change score position: continue turning rather than jumping backwards.
    beats = timing.running ? (Number.isFinite(delta) && delta >= 0 && Math.abs(delta - expected) < Math.max(0.05, expected * 0.5) ? delta : expected) : 0
    state.lastBeat = timing.beat
  } else state.lastBeat = undefined
  return a.mode === 'manual' ? dt * a.rpm * Math.PI / 30 : beats * Math.PI * 2 / a.beatsPerRevolution * (a.reverse ? -1 : 1)
}
