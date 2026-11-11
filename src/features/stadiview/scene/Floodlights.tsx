import { useEffect, useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, ShaderMaterial } from 'three'
import { VENUE } from '@/features/stadiview/config/venue'
import type { Vec3, VenueConfig } from '@/features/stadiview/config/venue'
import { MeshBuilder } from '@/features/stadiview/scene/meshBuilder'
import { PAINT } from '@/features/stadiview/scene/palette'
import { useSceneKit } from '@/features/stadiview/scene/sceneKit'

const GROUND = -0.12

/** The lamp bank at the top of a mast: its width, height and depth in metres, and its grid of lamps. */
const BANK = { width: 8.4, height: 5.2, depth: 0.6, columns: 6, rows: 4 }

/** How wide the halo round a lamp bank is drawn, in metres. */
const HALO_SIZE = 54

/**
 * A light cone reaches this share of the way from the lamps to the point they are aimed at, and its
 * far end is this wide (as a radius) for each metre of its length. Together they keep the cone clear of the
 * ground, so it fades out in the air and never shows a hard edge where it would meet the pitch.
 */
const CONE_REACH = 0.62
const CONE_SPREAD = 0.24

interface Head {
  /** The centre of the lamp bank. */
  centre: Vec3
  /** Unit vectors: the way the lamps point, the bank's width, and its height. */
  forward: Vec3
  right: Vec3
  up: Vec3
  /** Distance from the lamps to the point they are aimed at. */
  throwLength: number
}

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

function heads(cfg: VenueConfig): Head[] {
  return cfg.floodlights.masts.map((foot) => {
    const centre: Vec3 = [foot[0], foot[1] + cfg.floodlights.height, foot[2]]
    const toAim: Vec3 = [cfg.floodlights.aim[0] - centre[0], cfg.floodlights.aim[1] - centre[1], cfg.floodlights.aim[2] - centre[2]]
    const forward = unit(toAim)
    const right = unit(cross(forward, [0, 1, 0]))
    const up = cross(right, forward)
    return { centre, forward, right, up, throwLength: Math.hypot(toAim[0], toAim[1], toAim[2]) }
  })
}

/** The masts and the frames of the lamp banks (lit), and the lamps themselves (self-lit). */
export function buildMasts(cfg: VenueConfig = VENUE): { lit: BufferGeometry; glow: BufferGeometry } {
  const lit = new MeshBuilder()
  const glow = new MeshBuilder()
  cfg.floodlights.masts.forEach((foot, i) => {
    const head = heads(cfg)[i]
    lit.prism(foot[0], foot[2], GROUND, foot[1] + cfg.floodlights.height - BANK.height / 2, 1.0, 0.5, 6, PAINT.steel)

    const at = (a: number, h: number, d: number): Vec3 => add(add(add(head.centre, head.right, a), head.up, h), head.forward, d)
    const w = BANK.width / 2
    const h = BANK.height / 2
    const back = -BANK.depth
    // The frame: its back, its four sides, and a dark plate behind the lamps.
    const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]]
    lit.face([at(-w, -h, back), at(w, -h, back), at(w, h, back), at(-w, h, back)], neg(head.forward), PAINT.steel)
    lit.face([at(-w, -h, 0), at(w, -h, 0), at(w, h, 0), at(-w, h, 0)], head.forward, PAINT.wallDark)
    lit.face([at(-w, h, back), at(w, h, back), at(w, h, 0), at(-w, h, 0)], head.up, PAINT.steel)
    lit.face([at(-w, -h, back), at(w, -h, back), at(w, -h, 0), at(-w, -h, 0)], neg(head.up), PAINT.steel)
    lit.face([at(w, -h, back), at(w, h, back), at(w, h, 0), at(w, -h, 0)], head.right, PAINT.steel)
    lit.face([at(-w, -h, back), at(-w, h, back), at(-w, h, 0), at(-w, -h, 0)], neg(head.right), PAINT.steel)

    // The lamps: a grid of bright squares just proud of the plate.
    const cellW = BANK.width / BANK.columns
    const cellH = BANK.height / BANK.rows
    const gap = 0.16
    for (let c = 0; c < BANK.columns; c++) {
      for (let r = 0; r < BANK.rows; r++) {
        const a0 = -w + c * cellW + gap
        const h0 = -h + r * cellH + gap
        glow.face([at(a0, h0, 0.04), at(a0 + cellW - 2 * gap, h0, 0.04), at(a0 + cellW - 2 * gap, h0 + cellH - 2 * gap, 0.04), at(a0, h0 + cellH - 2 * gap, 0.04)], head.forward, PAINT.lamp)
      }
    }
  })
  return { lit: lit.build(), glow: glow.build() }
}

/** One square per lamp bank that always faces the camera; the shader paints a soft halo on it. */
export function buildHalos(cfg: VenueConfig = VENUE): BufferGeometry {
  const list = heads(cfg)
  const position = new Float32Array(list.length * 4 * 3)
  const corner = new Float32Array(list.length * 4 * 2)
  const forward = new Float32Array(list.length * 4 * 3)
  const index: number[] = []
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  list.forEach((head, i) => {
    // The halo sits just in front of the lamps so the bank itself never hides it.
    const p = add(head.centre, head.forward, 0.5)
    for (let k = 0; k < 4; k++) {
      position.set(p, (i * 4 + k) * 3)
      corner.set(corners[k], (i * 4 + k) * 2)
      forward.set(head.forward, (i * 4 + k) * 3)
    }
    index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3)
  })
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(position, 3))
  g.setAttribute('corner', new BufferAttribute(corner, 2))
  g.setAttribute('forward', new BufferAttribute(forward, 3))
  g.setIndex(index)
  return g
}

/** The visible shaft of light under each lamp bank: an open cone from the lamps toward the pitch. */
export function buildCones(cfg: VenueConfig = VENUE): BufferGeometry {
  const list = heads(cfg)
  const around = 24
  const position: number[] = []
  const normal: number[] = []
  const along: number[] = []
  const index: number[] = []
  list.forEach((head) => {
    const length = head.throwLength * CONE_REACH
    const radius = length * CONE_SPREAD
    const base = position.length / 3
    for (let k = 0; k <= around; k++) {
      const a = (k / around) * Math.PI * 2
      // Outward from the cone's axis at this point round it.
      const out = add([0, 0, 0], head.right, Math.cos(a))
      const o: Vec3 = add(out, head.up, Math.sin(a))
      const near = add(add(head.centre, head.forward, 0.6), o, BANK.height * 0.45)
      const far = add(add(head.centre, head.forward, length), o, radius)
      // The surface leans outward by the cone's spread; that tilt goes into the normal.
      const n = unit(add(o, head.forward, -CONE_SPREAD))
      position.push(...near, ...far)
      normal.push(...n, ...n)
      along.push(0, 1)
      if (k < around) {
        const i = base + k * 2
        index.push(i, i + 1, i + 3, i, i + 3, i + 2)
      }
    }
  })
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(position), 3))
  g.setAttribute('normal', new BufferAttribute(new Float32Array(normal), 3))
  g.setAttribute('along', new BufferAttribute(new Float32Array(along), 1))
  g.setIndex(index)
  return g
}

function haloMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uSize: { value: HALO_SIZE }, uColor: { value: new Color(PAINT.lamp) } },
    vertexShader: /* glsl */ `
      attribute vec2 corner;
      attribute vec3 forward;
      uniform float uSize;
      varying vec2 vCorner;
      varying float vFacing;
      void main() {
        vCorner = corner;
        // Push the corner out sideways in view space, so the square always faces the camera.
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        view.xy += corner * uSize * 0.5;
        gl_Position = projectionMatrix * view;
        // Lamps seen from the front dazzle; seen from behind they barely glow.
        vFacing = max(dot(forward, normalize(cameraPosition - position)), 0.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec2 vCorner;
      varying float vFacing;
      void main() {
        float d = length(vCorner);
        float core = exp(-d * d * 26.0);
        float halo = pow(max(1.0 - d, 0.0), 2.6);
        float strength = (0.9 * core + 0.3 * halo) * (0.18 + 0.82 * vFacing);
        gl_FragColor = vec4(uColor, strength);
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  })
}

function coneMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(PAINT.lamp) }, uStrength: { value: 0.085 } },
    vertexShader: /* glsl */ `
      attribute float along;
      varying float vAlong;
      varying vec3 vNormal;
      varying vec3 vToCamera;
      void main() {
        vAlong = along;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormal = mat3(modelMatrix) * normal;
        vToCamera = cameraPosition - world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying float vAlong;
      varying vec3 vNormal;
      varying vec3 vToCamera;
      void main() {
        // Brightest where the eye looks through the middle of the shaft, nothing at its grazing edges.
        float through = abs(dot(normalize(vNormal), normalize(vToCamera)));
        // Bright at the lamps, gone before the ground.
        float fade = pow(1.0 - vAlong, 1.7) * smoothstep(0.0, 0.05, vAlong);
        gl_FragColor = vec4(uColor, uStrength * pow(through, 1.6) * fade);
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
    fog: false,
  })
}

/** The four floodlight masts: steel, lamp banks, a halo round each, and (when `cones` is set) shafts of light toward the pitch. */
export function Floodlights({ cones }: { cones: boolean }) {
  const kit = useSceneKit()
  const masts = useMemo(() => buildMasts(), [])
  const halos = useMemo(() => buildHalos(), [])
  const shafts = useMemo(() => (cones ? buildCones() : null), [cones])
  const haloLook = useMemo(() => haloMaterial(), [])
  const coneLook = useMemo(() => coneMaterial(), [])

  useEffect(
    () => () => {
      masts.lit.dispose()
      masts.glow.dispose()
      halos.dispose()
      haloLook.dispose()
      coneLook.dispose()
    },
    [masts, halos, haloLook, coneLook],
  )
  useEffect(() => () => shafts?.dispose(), [shafts])

  return (
    <group dispose={null}>
      <mesh geometry={masts.lit} material={kit.lit} />
      <mesh geometry={masts.glow} material={kit.glow} />
      {/* The squares are stretched by the shader, so their real bounds are unknown to the renderer: never cull them. */}
      <mesh geometry={halos} material={haloLook} frustumCulled={false} renderOrder={5} />
      {shafts && <mesh geometry={shafts} material={coneLook} frustumCulled={false} renderOrder={4} />}
    </group>
  )
}
