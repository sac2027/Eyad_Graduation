import { useEffect, useMemo } from 'react'
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, SphereGeometry } from 'three'
import { AWARD_PROFILE, AWARD_SEGMENTS } from '@/features/honors/awardProfile'
import { MeshBuilder } from '@/features/stadiview/scene/meshBuilder'
import { PAINT, SV } from '@/features/stadiview/scene/palette'
import { useSceneKit } from '@/features/stadiview/scene/sceneKit'

/** The sky dome is far beyond everything else; the camera's far plane must reach past it. */
export const SKY_RADIUS = 1700

/** The colour of the sky just above the horizon: the glow of a lit campus under a dark sky. */
const HORIZON = '#0B4138'
/** By this elevation, in degrees, the glow has faded into the night colour. */
const GLOW_REACH = 24

/** A small seeded random source, so the stars and the campus are the same on every visit. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The dome: night overhead, a soft deep-green glow low down, the plain night colour below the horizon to meet the fogged land. */
function buildDome(): BufferGeometry {
  const g = new SphereGeometry(SKY_RADIUS, 40, 20)
  const position = g.getAttribute('position')
  const colors = new Float32Array(position.count * 3)
  const night = new Color(SV.night)
  const horizon = new Color(HORIZON)
  const c = new Color()
  for (let i = 0; i < position.count; i++) {
    const elevation = (Math.asin(position.getY(i) / SKY_RADIUS) * 180) / Math.PI
    if (elevation <= 0) c.copy(night)
    else {
      const t = Math.min(elevation / GLOW_REACH, 1)
      c.copy(horizon).lerp(night, 1 - (1 - t) * (1 - t))
    }
    colors.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new BufferAttribute(colors, 3))
  return g
}

/** Sparse stars over the upper sky, a few of them tinted sand or green. */
function buildStars(): BufferGeometry {
  const random = seeded(57)
  const count = 520
  const position = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const tints = [new Color('#ffffff'), new Color('#ffffff'), new Color(SV.sand), new Color('#bfe6d6')]
  const c = new Color()
  for (let i = 0; i < count; i++) {
    // Even over the dome above 7 degrees; few stars show through the glow below that.
    const y = 0.12 + 0.88 * random()
    const around = random() * Math.PI * 2
    const level = Math.sqrt(1 - y * y)
    position.set([SKY_RADIUS * 0.98 * level * Math.cos(around), SKY_RADIUS * 0.98 * y, SKY_RADIUS * 0.98 * level * Math.sin(around)], i * 3)
    // Most stars are faint; brightness is carried by the colour, since every point is the same size.
    const brightness = 0.25 + 0.75 * Math.pow(random(), 2.2)
    c.copy(tints[Math.floor(random() * tints.length)]).multiplyScalar(brightness)
    colors.set([c.r, c.g, c.b], i * 3)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(position, 3))
  g.setAttribute('color', new BufferAttribute(colors, 3))
  return g
}

/**
 * The campus beyond the stadium: a ring of dark blocks, some with a band of green light, and the
 * university's tower standing behind the stage end. They are silhouettes; their only job is to
 * give the horizon a shape and the stadium a place.
 */
function buildCampus(): { bodies: BufferGeometry; lights: BufferGeometry } {
  const random = seeded(1963)
  const bodies = new MeshBuilder()
  const lights = new MeshBuilder()
  const count = 68
  for (let i = 0; i < count; i++) {
    const around = ((i + random() * 0.7) / count) * Math.PI * 2
    const distance = 250 + 190 * random()
    const x = distance * Math.cos(around)
    const z = distance * Math.sin(around)
    const along = 14 + 22 * random()
    const across = 9 + 12 * random()
    // Mostly low buildings, now and then a taller one.
    const height = random() < 0.12 ? 30 + 18 * random() : 8 + 16 * random()
    // The long side lies across the line of sight from the stadium.
    const dx = -Math.sin(around)
    const dz = Math.cos(around)
    bodies.turnedBox(x, z, -0.4, height, along, across, dx, dz, random() < 0.5 ? PAINT.campus : PAINT.campusLight)
    if (random() < 0.55) lights.turnedBox(x, z, height - 2.1, height - 1.5, along + 0.06, across + 0.06, dx, dz, PAINT.band)
    if (random() < 0.18) lights.turnedBox(x, z, height * 0.45, height * 0.45 + 0.5, along + 0.06, across + 0.06, dx, dz, PAINT.window)
  }

  // The tower, north-west of the stadium, where a graduate on the pitch sees it beside the stage.
  const tower = { x: -280, z: -230, scale: 15 }
  for (let k = 0; k < AWARD_PROFILE.length - 1; k++) {
    const [r0, h0] = AWARD_PROFILE[k]
    const [r1, h1] = AWARD_PROFILE[k + 1]
    if (r0 === 0 && r1 === 0) continue
    // The lit band is the flared crown near the top.
    const crown = h0 >= 3.98 && h1 <= 4.42
    for (let s = 0; s < AWARD_SEGMENTS; s++) {
      const a = (s / AWARD_SEGMENTS) * Math.PI * 2
      const b = ((s + 1) / AWARD_SEGMENTS) * Math.PI * 2
      const mid = (a + b) / 2
      const at = (r: number, h: number, angle: number): [number, number, number] => [tower.x + tower.scale * r * Math.cos(angle), tower.scale * h, tower.z + tower.scale * r * Math.sin(angle)]
      // Where the outline touches the axis the face is a triangle, not a four-sided strip.
      const corners = r0 === 0 ? [at(r1, h1, a), at(r1, h1, b), at(0, h0, a)] : r1 === 0 ? [at(r0, h0, a), at(r0, h0, b), at(0, h1, a)] : [at(r0, h0, a), at(r0, h0, b), at(r1, h1, b), at(r1, h1, a)]
      // Outward from a turned outline: across its direction of travel, away from the axis.
      const outward: [number, number, number] = [Math.cos(mid) * (h1 - h0), r0 - r1, Math.sin(mid) * (h1 - h0)]
      ;(crown ? lights : bodies).face(corners, outward, crown ? PAINT.goldDim : PAINT.campusLight)
    }
  }
  return { bodies: bodies.build(), lights: lights.build() }
}

/** Street lamps scattered along the campus roads: warm specks, nothing more. */
function buildLamps(): BufferGeometry {
  const random = seeded(2027)
  const points: number[] = []
  const roads = 9
  for (let r = 0; r < roads; r++) {
    const around = ((r + 0.3 * random()) / roads) * Math.PI * 2
    for (let d = 170; d < 460; d += 16 + 6 * random()) points.push(d * Math.cos(around), 7, d * Math.sin(around))
  }
  for (const ring of [210, 330]) {
    for (let k = 0; k < 70; k++) {
      const around = ((k + random() * 0.5) / 70) * Math.PI * 2
      points.push(ring * Math.cos(around), 7, ring * Math.sin(around))
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(points), 3))
  return g
}

/** The night around the stadium: sky, stars, and the campus on the horizon. */
export function Sky() {
  const kit = useSceneKit()
  const dome = useMemo(() => buildDome(), [])
  const stars = useMemo(() => buildStars(), [])
  const campus = useMemo(() => buildCampus(), [])
  const lamps = useMemo(() => buildLamps(), [])

  useEffect(
    () => () => {
      dome.dispose()
      stars.dispose()
      campus.bodies.dispose()
      campus.lights.dispose()
      lamps.dispose()
    },
    [dome, stars, campus, lamps],
  )

  return (
    <group dispose={null}>
      <mesh geometry={dome} renderOrder={-2} frustumCulled={false}>
        <meshBasicMaterial vertexColors side={BackSide} fog={false} toneMapped={false} depthWrite={false} />
      </mesh>
      <points geometry={stars} renderOrder={-1} frustumCulled={false}>
        <pointsMaterial vertexColors size={1.7} sizeAttenuation={false} fog={false} toneMapped={false} depthWrite={false} transparent />
      </points>
      <mesh geometry={campus.bodies} material={kit.glow} />
      <mesh geometry={campus.lights} material={kit.glow} />
      <points geometry={lamps}>
        <pointsMaterial color={PAINT.warm} size={2.2} sizeAttenuation={false} fog={false} toneMapped={false} depthWrite={false} transparent opacity={0.6} blending={AdditiveBlending} />
      </points>
    </group>
  )
}
