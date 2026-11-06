/** How far the reader is through the step sections (0..1): section i reaches i/8 when its top is mid-screen. */
export function railProgress(scrollY: number, sectionTops: number[], viewportH: number): number {
  const n = sectionTops.length
  if (n < 2) return 0
  const mid = scrollY + viewportH / 2
  if (mid <= sectionTops[0]) return 0
  if (mid >= sectionTops[n - 1]) return 1
  for (let i = 0; i < n - 1; i++) {
    if (mid < sectionTops[i + 1]) return (i + (mid - sectionTops[i]) / (sectionTops[i + 1] - sectionTops[i])) / (n - 1)
  }
  return 1
}

/** The scroll position that gives a rail progress (the inverse of railProgress). */
export function scrollForProgress(p: number, sectionTops: number[], viewportH: number): number {
  const n = sectionTops.length
  const k = Math.min(1, Math.max(0, p)) * (n - 1)
  const i = Math.min(n - 2, Math.floor(k))
  const f = k - i
  const mid = sectionTops[i] + f * (sectionTops[i + 1] - sectionTops[i])
  return mid - viewportH / 2
}
