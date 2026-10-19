// What the BLAME! layer must keep clear of: the routes (legs, stops, pads) and every record already
// standing (the old copy and the ways layer's own). Sampled once, then asked by box, vertical
// cylinder or cylindrical shell. Pure.
const STEP = 8 // metres between samples along a leg
const HASH = 64 // metres a bucket of the plan hash

/** The field of `order` (`loadWays()`), the `pads` and the solid records `recs` (`solidRecords`). */
export function fieldOf(order, pads, recs) {
  const samples = [] // [x, y, z, radius]
  for (const way of order.ways) {
    for (const leg of way.legs) {
      const n = Math.max(1, Math.ceil(leg.length / STEP))
      for (let k = 0; k <= n; k++) {
        const t = k / n
        samples.push([leg.a.x + (leg.b.x - leg.a.x) * t, leg.a.y + (leg.b.y - leg.a.y) * t, leg.a.z + (leg.b.z - leg.a.z) * t, 0, leg.move])
      }
    }
  }
  for (const s of order.stops) samples.push([s.x, s.y, s.z, 0])
  for (const p of pads) samples.push([p.x, p.y, p.z, Math.hypot(p.w ?? 10, p.l ?? 10) / 2, p.move])
  const bucket = new Map()
  const key = (i, j) => i * 100003 + j
  samples.forEach((s, n) => {
    const k = key(Math.floor(s[0] / HASH), Math.floor(s[2] / HASH))
    if (!bucket.has(k)) bucket.set(k, [])
    bucket.get(k).push(n)
  })
  // a record whose bounds cover more than 120 000 m² on the plan is a hollow shell of an older shift (a box of its bounds would wall in the routes): not an obstacle here
  const solids = recs.map((r) => r.bounds).filter((b) => b && Number.isFinite(b.min.x) && (b.max.x - b.min.x) * (b.max.z - b.min.z) <= 120000)

  const near = (x0, x1, z0, z1, m) => {
    const out = []
    for (let i = Math.floor((x0 - m - 12) / HASH); i <= Math.floor((x1 + m + 12) / HASH); i++) {
      for (let j = Math.floor((z0 - m - 12) / HASH); j <= Math.floor((z1 + m + 12) / HASH); j++) {
        const list = bucket.get(key(i, j))
        if (list) out.push(...list)
      }
    }
    return out
  }

  return {
    samples,
    /** Something this layer stood: later masses keep off it as off a standing record. */
    addSolid(min, max) {
      solids.push({ min, max })
    },
    /** Whether the box comes within `m` of a route or meets a standing record (within `m / 4`). */
    hitBox(x0, x1, y0, y1, z0, z1, m = 32) {
      for (const n of near(x0, x1, z0, z1, m)) {
        const [x, y, z, r] = samples[n]
        const d = Math.hypot(x - Math.min(x1, Math.max(x0, x)), y - Math.min(y1, Math.max(y0, y)), z - Math.min(z1, Math.max(z0, z)))
        if (d < m + r) return true
      }
      const g = m / 4
      return solids.some((b) => b.min.x < x1 + g && b.max.x > x0 - g && b.min.y < y1 + g && b.max.y > y0 - g && b.min.z < z1 + g && b.max.z > z0 - g)
    },
    /** Whether a vertical cylinder (radius `r`, from `y0` to `y1`) is within `m` of a route or a record. */
    hitAxis(x, z, r, y0, y1, m = 30) {
      return this.hitBox(x - r, x + r, y0, y1, z - r, z + r, m)
    },
    /** Whether the shell between radii `rIn` and `rOut` about the axis (x, z) comes within `m` of a route or a record. */
    hitShell(cx, cz, rIn, rOut, y0, y1, m = 30) {
      for (const [x, y, z, r] of samples) {
        if (y < y0 - m || y > y1 + m) continue
        const d = Math.hypot(x - cx, z - cz)
        if (d > rIn - m - r && d < rOut + m + r) return true
      }
      return solids.some((b) => {
        if (b.max.y < y0 || b.min.y > y1) return false
        const nx = Math.min(b.max.x, Math.max(b.min.x, cx))
        const nz = Math.min(b.max.z, Math.max(b.min.z, cz))
        const far = Math.max(Math.hypot(b.min.x - cx, b.min.z - cz), Math.hypot(b.max.x - cx, b.min.z - cz), Math.hypot(b.min.x - cx, b.max.z - cz), Math.hypot(b.max.x - cx, b.max.z - cz))
        return Math.hypot(nx - cx, nz - cz) < rOut + m / 4 && far > rIn - m / 4
      })
    },
    /**
     * Which of `n` equal arcs of the shell between `rIn` and `rOut` about (cx, cz) are blocked: a route
     * within `m` of it between `y0` and `y1`, or a standing record. A record round the axis blocks all.
     */
    blockedArcs(cx, cz, rIn, rOut, y0, y1, m = 30, n = 72) {
      const blocked = new Array(n).fill(false)
      const mark = (a, b) => {
        // from angle a to b (the short way round), each in radians
        let span = b - a
        while (span > Math.PI) span -= 2 * Math.PI
        while (span < -Math.PI) span += 2 * Math.PI
        const from = span >= 0 ? a : b
        const len = Math.abs(span)
        const k0 = Math.floor(((from % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI) * n)
        const k1 = Math.ceil(len / (2 * Math.PI) * n)
        for (let k = -1; k <= k1 + 1; k++) blocked[(((k0 + k) % n) + n) % n] = true
      }
      for (const [x, y, z, r] of samples) {
        if (y < y0 - m || y > y1 + m) continue
        const d = Math.hypot(x - cx, z - cz)
        if (d <= rIn - m - r || d >= rOut + m + r) continue
        const a = Math.atan2(z - cz, x - cx)
        const w = (m + r) / Math.max(rIn, 1)
        mark(a - w, a + w)
      }
      for (const b of solids) {
        if (b.max.y < y0 || b.min.y > y1) continue
        const g = m / 4
        const nx = Math.min(b.max.x + g, Math.max(b.min.x - g, cx))
        const nz = Math.min(b.max.z + g, Math.max(b.min.z - g, cz))
        const corners = [[b.min.x - g, b.min.z - g], [b.max.x + g, b.min.z - g], [b.min.x - g, b.max.z + g], [b.max.x + g, b.max.z + g]]
        const far = Math.max(...corners.map(([x, z]) => Math.hypot(x - cx, z - cz)))
        if (Math.hypot(nx - cx, nz - cz) >= rOut || far <= rIn) continue
        if (cx > b.min.x - g && cx < b.max.x + g && cz > b.min.z - g && cz < b.max.z + g) return blocked.fill(true)
        const angles = corners.map(([x, z]) => Math.atan2(z - cz, x - cx))
        const base = Math.atan2(nz - cz, nx - cx)
        const rel = angles.map((a) => { let d = a - base; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d })
        mark(base + Math.min(...rel), base + Math.max(...rel))
      }
      return blocked
    },
    /** Whether the disc of radius `r` about (x, z) holds a route sample between `y0` and `y1`. */
    holdsRoute(cx, cz, r, y0, y1) {
      return samples.some(([x, y, z]) => y >= y0 && y <= y1 && Math.hypot(x - cx, z - cz) < r)
    },
  }
}
