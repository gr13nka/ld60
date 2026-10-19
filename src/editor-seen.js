// What of a place is seen inside a rectangle of the picture: the editor's box select
// (`editor.js`), as Blender's is out of X-ray, so that a drag over a wall picks the wall and
// not the rooms behind it. The scene is drawn once more off the screen, each thing that can be
// picked in a flat colour of its own and everything else in black, and the colours inside the
// rectangle are read back. A ray for each pixel would give the same at thousands of times the cost.

import * as THREE from 'three'

const SHARP = 0.5 // of the picture's own pixels: a thing thinner than two of them may be missed, as in Blender
const AHEAD = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 } // a box drawn over the baked one it is part of

/**
 * Of `things` (`[{ meshes }]` or `[{ box }]`: drawn by meshes of their own, or baked in with
 * others and standing as the upright `THREE.Box3`), those `camera` sees inside `rect` (`{ left, top,
 * right, bottom }`, on the page) as `scene` is drawn now, by `renderer`.
 */
export function seenIn(renderer, scene, camera, things, rect) {
  const frame = renderer.domElement.getBoundingClientRect()
  const width = Math.max(1, Math.round(frame.width * SHARP))
  const height = Math.max(1, Math.round(frame.height * SHARP))
  const x0 = Math.max(0, Math.floor(((rect.left - frame.left) / frame.width) * width))
  const x1 = Math.min(width, Math.ceil(((rect.right - frame.left) / frame.width) * width))
  const y0 = Math.max(0, Math.floor(((frame.bottom - rect.bottom) / frame.height) * height)) // read from the bottom up
  const y1 = Math.min(height, Math.ceil(((frame.bottom - rect.top) / frame.height) * height))
  if (x1 <= x0 || y1 <= y0) return []

  scene.updateMatrixWorld()
  const ids = new THREE.Scene()
  const made = []
  const stand = (geometry, material, matrix) => {
    const copy = new THREE.Mesh(geometry, material)
    copy.matrixAutoUpdate = false
    copy.matrix.copy(matrix)
    copy.frustumCulled = false
    ids.add(copy)
  }
  const black = new THREE.MeshBasicMaterial({ color: 0, side: THREE.DoubleSide, toneMapped: false, fog: false })
  made.push(black)
  const owned = new Set(things.flatMap(({ meshes = [] }) => meshes))
  // What cannot be picked still hides what is behind it; what is see-through, and the editor's own marks, do not.
  scene.traverseVisible((object) => {
    if (!object.isMesh || object.isInstancedMesh || object.isSkinnedMesh || owned.has(object)) return
    const material = Array.isArray(object.material) ? object.material[0] : object.material
    if (!material || material.transparent || material.depthTest === false || material.depthWrite === false) return
    stand(object.geometry, black, object.matrixWorld)
  })
  const cube = new THREE.BoxGeometry(1, 1, 1)
  const size = new THREE.Vector3()
  const middle = new THREE.Vector3()
  things.forEach(({ meshes, box }, i) => {
    const id = i + 1
    const colour = new THREE.Color().setRGB((id & 255) / 255, ((id >> 8) & 255) / 255, ((id >> 16) & 255) / 255, THREE.LinearSRGBColorSpace)
    const material = new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide, toneMapped: false, fog: false, ...AHEAD })
    made.push(material)
    if (meshes) return meshes.forEach((mesh) => stand(mesh.geometry, material, mesh.matrixWorld))
    box.getSize(size)
    box.getCenter(middle)
    stand(cube, material, new THREE.Matrix4().compose(middle, new THREE.Quaternion(), size.max(new THREE.Vector3(0.01, 0.01, 0.01))))
  })

  const target = new THREE.WebGLRenderTarget(width, height)
  const was = { target: renderer.getRenderTarget(), colour: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), shadows: renderer.shadowMap.autoUpdate }
  const pixels = new Uint8Array((x1 - x0) * (y1 - y0) * 4)
  try {
    renderer.shadowMap.autoUpdate = false
    renderer.setRenderTarget(target)
    renderer.setClearColor(0x000000, 1)
    renderer.clear()
    renderer.render(ids, camera)
    renderer.readRenderTargetPixels(target, x0, y0, x1 - x0, y1 - y0, pixels)
  } finally {
    renderer.setRenderTarget(was.target)
    renderer.setClearColor(was.colour, was.alpha)
    renderer.shadowMap.autoUpdate = was.shadows
    target.dispose()
    cube.dispose()
    for (const material of made) material.dispose()
  }
  const found = new Set()
  for (let i = 0; i < pixels.length; i += 4) {
    const id = pixels[i] | (pixels[i + 1] << 8) | (pixels[i + 2] << 16)
    if (id > 0 && id <= things.length) found.add(id - 1)
  }
  return [...found].sort((a, b) => a - b).map((i) => things[i])
}
