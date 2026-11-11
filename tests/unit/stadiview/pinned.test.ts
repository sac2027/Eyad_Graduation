import { describe, expect, it } from 'vitest'
import { VENUE } from '@/features/stadiview/config/venue'
import { ORBIT_HOME } from '@/features/stadiview/engine/cameraMath'
import { getOccluders } from '@/features/stadiview/engine/occluders'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

/**
 * What Phase 4 must not move. The march, the arch, the bowl and the figures are added round the
 * seats; if any of these hashes changes, a seat, the opening camera or what blocks a click has moved.
 * The values were recorded before Phase 4 began.
 */

function fnv(bytes: Uint8Array): string {
  let h = 0x811c9dc5
  for (let k = 0; k < bytes.length; k++) {
    h ^= bytes[k]
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
const ofFloats = (a: Float32Array) => fnv(new Uint8Array(a.buffer, a.byteOffset, a.byteLength))
const ofJson = (x: unknown) => fnv(new TextEncoder().encode(JSON.stringify(x)))

describe('pinned for Phase 4', () => {
  const v = getVenue()

  it('keeps every seat where it is', () => {
    expect(v.count).toBe(7998)
    expect(ofFloats(v.position)).toBe(PINNED.positions)
    expect(ofFloats(v.yaw)).toBe(PINNED.yaws)
  })

  it('keeps the opening camera and its limits', () => {
    expect(ORBIT_HOME.position).toEqual([72, 64, -88])
    expect(ofJson({ home: ORBIT_HOME, camera: VENUE.camera })).toBe(PINNED.camera)
  })

  it('keeps what blocks a click', () => {
    expect(ofJson(getOccluders())).toBe(PINNED.occluders)
  })

  it('keeps the seated parts of the venue and the east tunnel', () => {
    expect(ofJson({ pitch: VENUE.pitch, track: VENUE.track, stage: VENUE.stage, blocks: VENUE.blocks, stands: VENUE.stands, entrance: VENUE.procession.entrance })).toBe(PINNED.venue)
  })
})

const PINNED = { positions: '46a0ff83', yaws: '013db455', camera: '93bd1f81', occluders: 'a81c3b8e', venue: '5002871b' }
