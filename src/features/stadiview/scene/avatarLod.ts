/**
 * Which figures get the detailed model: the `n` nearest to the eye. The rest are drawn as simple
 * silhouettes. Picking the nearest is a partial selection, not a sort of everyone.
 */
export function nearestSet(seats: ArrayLike<number>, positions: Float32Array, eye: readonly [number, number, number], n: number): Int32Array {
  const count = seats.length
  if (n <= 0 || count === 0) return new Int32Array(0)
  if (n >= count) return Int32Array.from(seats)
  const d = new Float64Array(count)
  const order = new Int32Array(count)
  for (let k = 0; k < count; k++) {
    const s = seats[k]
    const dx = positions[s * 3] - eye[0]
    const dy = positions[s * 3 + 1] - eye[1]
    const dz = positions[s * 3 + 2] - eye[2]
    d[k] = dx * dx + dy * dy + dz * dz
    order[k] = k
  }
  // Quickselect on `order` by distance, so the first n entries are the n nearest (in no order).
  let lo = 0
  let hi = count - 1
  while (lo < hi) {
    const pivot = d[order[(lo + hi) >> 1]]
    let i = lo
    let j = hi
    while (i <= j) {
      while (d[order[i]] < pivot) i++
      while (d[order[j]] > pivot) j--
      if (i <= j) {
        const t = order[i]
        order[i] = order[j]
        order[j] = t
        i++
        j--
      }
    }
    if (n - 1 <= j) hi = j
    else if (n - 1 >= i) lo = i
    else break
  }
  const out = new Int32Array(n)
  for (let k = 0; k < n; k++) out[k] = seats[order[k]]
  return out
}

/**
 * Whether a figure's seat is inside the clear circle round a seated viewer's eyes: closer than
 * `radius` on the ground and within 2.5 m up or down. The shader applies the same rule.
 */
export function insideClear(x: number, y: number, z: number, eye: readonly [number, number, number], radius: number): boolean {
  if (radius <= 0) return false
  const dx = x - eye[0]
  const dz = z - eye[2]
  return dx * dx + dz * dz < radius * radius && Math.abs(y - eye[1]) < 2.5
}
