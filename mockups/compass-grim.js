// Four compass concepts in cast and forged metal, concrete and old tin, after the owner's
// reference: carved relief, grime in the hollows, worn-bright high spots, verdigris, a marbled
// orb, an asymmetric silhouette. The shared paints and shapes are `grim-kit.js`'s.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { EMBER, M, ball, chain, cyl, dial, feather, mesh, needleSpring, ring, runSheet, slab, ticker, tube } from './grim-kit.js'

// 1 · A cast bronze bar, carved all over: a notched key-bit tail to the left, a horned beast's
// head rising to the right, a ring in the middle holding a marbled orb. An ember inlaid in the
// orb runs round its rim to the route as the orb turns, heavy and slow; behind it a fan of
// verdigris with six gold matchsticks ticks toward a matchbox; a forged feather on a pin at the
// beast's brow turns to a feather; a worn medal hangs from the tail.
function bronze() {
  const root = new THREE.Group()
  const body = [
    [-0.13, 0.004], [-0.115, 0.014], [-0.1, 0.008], [-0.088, 0.017], [-0.07, 0.013], [-0.058, 0.022], [-0.036, 0.026],
    [0.034, 0.024], [0.048, 0.034], [0.058, 0.052], [0.072, 0.066], [0.09, 0.068], [0.104, 0.056], [0.118, 0.05], [0.122, 0.04],
    [0.108, 0.034], [0.116, 0.024], [0.1, 0.02], [0.088, 0.03], [0.076, 0.022], [0.064, 0.002], [0.058, -0.018], [0.074, -0.036],
    [0.068, -0.05], [0.05, -0.038], [0.036, -0.024], [-0.03, -0.026], [-0.046, -0.017], [-0.07, -0.015], [-0.086, -0.024],
    [-0.104, -0.017], [-0.116, -0.011], [-0.13, -0.004],
  ]
  root.add(slab(body, 0.012, M.bronze, [[-0.1, -0.002, 0.004], [-0.075, 0, 0.0035], [0.084, 0.05, 0.004]]))
  root.add(ring(0.032, 0.042, 0.016, M.bronze).translateZ(0.001))
  root.add(ring(0.042, 0.046, 0.01, M.gold).translateZ(0.004))
  const orb = new THREE.Group()
  orb.position.z = 0.012
  orb.add(mesh(new THREE.SphereGeometry(0.032, 48, 32), M.marble))
  const ember = mesh(new THREE.SphereGeometry(0.0045, 12, 8), EMBER, 0, 0.022, 0.022)
  ember.scale.set(1, 1.8, 1)
  orb.add(ember)
  root.add(orb)
  const fan = new THREE.Group()
  fan.position.set(-0.03, 0.03, -0.004)
  const blade = []
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI * (0.2 + 0.6 * (i / 16))
    const r = 0.036 + (i % 2 ? 0 : 0.005)
    blade.push([Math.cos(a) * r, Math.sin(a) * r])
  }
  blade.push([0, 0])
  fan.add(slab(blade, 0.004, M.verdigris, [[0, 0.012, 0.004]]))
  const sticks = []
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.25 + 0.5 * (i / 5))
    const stick = new THREE.Group()
    stick.rotation.z = a - Math.PI / 2
    stick.add(cyl(0.0016, 0.0016, 0.05, M.gold, 0, 0.03, -0.002, 6), ball(0.003, M.char, 0, 0.056, -0.002))
    fan.add(stick)
    sticks.push(stick)
  }
  root.add(fan)
  const quill = new THREE.Group()
  quill.position.set(0.084, 0.068, 0.008)
  quill.add(feather(0.05, M.iron), ball(0.0035, M.gold, 0, 0, 0.002))
  root.add(quill)
  const medal = new THREE.Group()
  medal.position.set(-0.112, -0.012, 0.006)
  medal.add(chain(2, M.gold))
  const disc = cyl(0.009, 0.009, 0.002, M.bronze, 0, -0.022, 0, 20).rotateX(Math.PI / 2)
  medal.add(disc, ring(0.007, 0.0095, 0.0025, M.gold).translateY(-0.022))
  root.add(medal)
  const turn = needleSpring(14, 4), tick = ticker(0.18), wave = needleSpring(25, 5)
  return {
    root, distance: 0.44,
    animate(t, dt, d) {
      orb.rotation.z = turn(d.route, dt)
      fan.rotation.z = Math.max(-0.9, Math.min(0.9, tick(d.matchbox, d.matchNear, dt)))
      sticks.forEach((stick, i) => { stick.position.x = 0.0008 * d.matchNear * d.matchNear * Math.sin(t * 60 + i) })
      quill.rotation.z = wave(d.feather, dt) - 0.6 + 0.12 * d.featherNear * Math.sin(t * 15)
      medal.rotation.z = 0.15 * Math.sin(t * 1.7)
    },
  }
}

// 2 · A blackened iron flange off some machine: toothed, a bite broken out of it, riveted, a lug
// with a ring below. Under a scratched smoked glass a long iron needle with an ember at its point
// is the route; a rusted toothed striker hinged at the break ticks toward a matchbox; a tin
// feather on a coiled spring at the top turns to a feather.
function iron() {
  const root = new THREE.Group()
  root.add(ring(0.04, 0.064, 0.012, M.iron, { teeth: 22, gap: [-0.35, 0.25] }))
  root.add(slab([[-0.014, -0.058], [0.014, -0.058], [0.01, -0.082], [-0.01, -0.082]], 0.012, M.iron, [[0, -0.074, 0.004]]))
  root.add(chain(3, M.rust).translateY(-0.078).translateZ(0.006))
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.1
    if (a > Math.PI * 2 - 0.4 || a < 0.3) continue
    root.add(ball(0.0035, M.iron, Math.cos(a) * 0.052, Math.sin(a) * 0.052, 0.014))
  }
  const face = dial(0.04, M.smoke, M.bone)
  face.position.z = 0.004
  root.add(face)
  const needle = new THREE.Group()
  needle.position.z = 0.008
  needle.add(slab([[0, 0.034], [0.003, 0.004], [0.0015, -0.012], [-0.0015, -0.012], [-0.003, 0.004]], 0.0015, M.iron, [], 0.0004))
  needle.add(mesh(new THREE.SphereGeometry(0.003, 10, 8), EMBER, 0, 0.032, 0.002), cyl(0.004, 0.004, 0.004, M.rust, 0, 0, 0.002).rotateX(Math.PI / 2))
  root.add(needle)
  const striker = new THREE.Group()
  striker.position.set(0.058, -0.004, 0.012)
  striker.add(cyl(0.006, 0.006, 0.006, M.rust, 0, 0, 0, 10).rotateX(Math.PI / 2))
  const arm = new THREE.Group()
  arm.add(mesh(new THREE.BoxGeometry(0.005, 0.042, 0.004), M.rust, 0, 0.021, 0.002))
  for (let i = 0; i < 6; i++) arm.add(mesh(new THREE.BoxGeometry(0.004, 0.0024, 0.004), M.rust, 0.004, 0.008 + i * 0.006, 0.002))
  arm.add(ball(0.004, M.char, 0, 0.044, 0.002))
  striker.add(arm)
  root.add(striker)
  const spring = new THREE.Group()
  spring.position.set(0, 0.064, 0.006)
  const coil = []
  for (let i = 0; i <= 40; i++) coil.push([Math.cos(i * 0.9) * 0.003, i * 0.0004, Math.sin(i * 0.9) * 0.003])
  spring.add(tube(coil, 0.0007, M.iron))
  const tin = new THREE.Group()
  tin.position.y = 0.016
  tin.add(feather(0.045, M.iron))
  spring.add(tin)
  root.add(spring)
  const turn = needleSpring(30, 6), tick = ticker(), wave = needleSpring(25, 4)
  return {
    root, distance: 0.37,
    animate(t, dt, d) {
      needle.rotation.z = turn(d.route, dt)
      arm.rotation.z = 0.9 + tick(d.matchbox, d.matchNear, dt) + 0.05 * d.matchNear * d.matchNear * Math.sin(t * 60)
      spring.rotation.z = wave(d.feather * 0.6, dt) + 0.1 * d.featherNear * Math.sin(t * 13)
    },
  }
}

// 3 · A broken lump of a floor slab, concrete with its rebar torn out at the edges. Set into it a
// cast iron ring and a stained dial: a bent bit of rebar with an ember at its end is the route;
// a hook of rusted wire turns in ticks toward a matchbox; a grimy gull feather wired to a rebar
// end turns toward a feather.
function concrete() {
  const root = new THREE.Group()
  const lump = [[-0.075, -0.035], [-0.06, -0.055], [-0.02, -0.05], [0.01, -0.06], [0.05, -0.048], [0.072, -0.02], [0.068, 0.012], [0.078, 0.03], [0.05, 0.052], [0.015, 0.046], [-0.02, 0.058], [-0.05, 0.044], [-0.078, 0.02], [-0.07, -0.005]]
  root.add(slab(lump, 0.026, M.concrete, [], 0.003).translateZ(-0.02))
  for (const [x0, y0, x1, y1, x2, y2] of [[-0.06, -0.04, -0.09, -0.05, -0.1, -0.035], [0.06, 0.035, 0.085, 0.05, 0.092, 0.07], [0.068, -0.03, 0.095, -0.036, 0.1, -0.05], [-0.07, 0.03, -0.095, 0.045, -0.098, 0.06]]) {
    root.add(tube([[x0, y0, -0.004], [x1, y1, -0.002], [x2, y2, 0.004]], 0.0028, M.rust))
  }
  root.add(ring(0.032, 0.04, 0.008, M.iron).translateZ(0.004))
  const face = dial(0.032, M.dial, M.char)
  face.position.z = 0.007
  root.add(face)
  const bar = new THREE.Group()
  bar.position.z = 0.011
  bar.add(tube([[0, -0.008, 0], [0, 0.012, 0.001], [0.004, 0.026, 0.002]], 0.0017, M.rust), mesh(new THREE.SphereGeometry(0.0032, 10, 8), EMBER, 0.004, 0.028, 0.002))
  bar.add(cyl(0.004, 0.004, 0.004, M.iron, 0, 0, 0).rotateX(Math.PI / 2))
  root.add(bar)
  const hook = new THREE.Group()
  hook.position.set(-0.05, -0.04, 0.008)
  hook.add(tube([[0, 0, 0], [0, 0.016, 0.002], [0.006, 0.026, 0.003], [0.012, 0.022, 0.003], [0.011, 0.015, 0.002]], 0.0012, M.rust), ball(0.003, M.iron, 0, 0, 0))
  root.add(hook)
  const tie = new THREE.Group()
  tie.position.set(0.092, 0.07, 0.004)
  tie.add(feather(0.05, M.feather))
  for (let i = 0; i < 3; i++) tie.add(mesh(new THREE.TorusGeometry(0.0028, 0.0006, 4, 8), M.iron, 0, 0.004 + i * 0.0018, 0.001).rotateX(Math.PI / 2))
  root.add(tie)
  const turn = needleSpring(26, 6), tick = ticker(), wave = needleSpring(20, 4)
  return {
    root, distance: 0.37,
    animate(t, dt, d) {
      bar.rotation.z = turn(d.route, dt)
      hook.rotation.z = tick(d.matchbox, d.matchNear, dt) + 0.05 * d.matchNear * d.matchNear * Math.sin(t * 60)
      tie.rotation.z = wave(d.feather * 0.7, dt) - 0.4 + 0.12 * d.featherNear * Math.sin(t * 15)
    },
  }
}

// 4 · A Soviet tobacco tin, red enamel chipped to rust, its lid swung up behind. In it a foxed
// dial: a burnt match is the route, its ember lit; a rusted fork of three match heads ticks
// toward a matchbox; a gull feather pushed under the lid's hinge turns toward a feather.
function tin() {
  const root = new THREE.Group()
  root.add(mesh(new RoundedBoxGeometry(0.11, 0.08, 0.02, 3, 0.006), M.enamel, 0, -0.01, -0.01))
  root.add(mesh(new THREE.BoxGeometry(0.1, 0.07, 0.002), M.rust, 0, -0.01, 0.0005))
  const lid = mesh(new RoundedBoxGeometry(0.11, 0.08, 0.006, 3, 0.003), M.enamel, 0, 0.04, -0.006)
  lid.geometry.translate(0, 0.04, 0)
  lid.position.set(0, 0.03, -0.02)
  lid.rotation.x = -0.35
  root.add(lid)
  const face = dial(0.03, M.dial, M.char)
  face.position.set(0, -0.01, 0.002)
  root.add(face)
  const match = new THREE.Group()
  match.position.set(0, -0.01, 0.006)
  match.add(mesh(new THREE.BoxGeometry(0.0035, 0.046, 0.0035), M.wood, 0, 0.006, 0))
  const head = ball(0.0048, M.char, 0, 0.03, 0)
  head.scale.set(1, 1.5, 1)
  match.add(head, mesh(new THREE.SphereGeometry(0.003, 10, 8), EMBER, 0, 0.034, 0.002), cyl(0.0035, 0.0035, 0.004, M.iron, 0, 0, 0).rotateX(Math.PI / 2))
  root.add(match)
  const fork = new THREE.Group()
  fork.position.set(-0.042, -0.04, 0.004)
  fork.add(ball(0.0035, M.rust, 0, 0, 0), mesh(new THREE.BoxGeometry(0.003, 0.024, 0.003), M.rust, 0, 0.012, 0), mesh(new THREE.BoxGeometry(0.02, 0.003, 0.003), M.rust, 0, 0.024, 0))
  for (const x of [-0.009, 0, 0.009]) fork.add(mesh(new THREE.BoxGeometry(0.002, 0.012, 0.002), M.wood, x, 0.031, 0), ball(0.003, M.char, x, 0.038, 0))
  root.add(fork)
  const tucked = new THREE.Group()
  tucked.position.set(0.045, 0.03, 0.0)
  tucked.add(feather(0.06, M.feather))
  root.add(tucked)
  const turn = needleSpring(30, 6), tick = ticker(), wave = needleSpring(20, 4)
  return {
    root, distance: 0.38,
    animate(t, dt, d) {
      match.rotation.z = turn(d.route, dt)
      fork.rotation.z = tick(d.matchbox, d.matchNear, dt) * 0.8 + 0.05 * d.matchNear * d.matchNear * Math.sin(t * 60)
      tucked.rotation.z = wave(d.feather * 0.6, dt) - 0.5 + 0.12 * d.featherNear * Math.sin(t * 15)
    },
  }
}

runSheet({ bronze, iron, concrete, tin })
