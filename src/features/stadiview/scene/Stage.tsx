import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, MeshBasicMaterial, SRGBColorSpace } from 'three'
import type { BufferGeometry, Mesh } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import logoUrl from '@/brand/logo/horizontal-negative.svg?url'
import { useDemoFlags } from '@/features/demo-console/flags'
import { VENUE } from '@/features/stadiview/config/venue'
import type { Vec3, VenueConfig } from '@/features/stadiview/config/venue'
import { MeshBuilder, pictureQuad } from '@/features/stadiview/scene/meshBuilder'
import { matrixBarsMaterial } from '@/features/stadiview/scene/matrixShader'
import { PAINT, SV } from '@/features/stadiview/scene/palette'
import { useSceneKit } from '@/features/stadiview/scene/sceneKit'
import { drawCongratsSlide, drawCrestPanel, drawTitleSlide, fontsReady, loadPicture } from '@/features/stadiview/scene/stageArt'
import type { ScreenWords } from '@/features/stadiview/scene/stageArt'
import { formatDate, useLocale, useT } from '@/i18n'
import { SCHEDULE } from '@/time/schedule'

const GROUND = -0.12

/** The crest panel in the middle of the backdrop: its size in metres and the height of its centre above the deck. */
const CREST = { width: 14.4, height: 4.5, above: 5.6 }

/** How long each LED slide stays, and how long the change between two takes, in seconds. */
const SLIDE_HOLD = 7
const SLIDE_FADE = 1.2

interface StageParts {
  lit: BufferGeometry
  glow: BufferGeometry
  /** The east face of the backdrop wall, which carries the animated bars. */
  bars: { geometry: BufferGeometry; size: [number, number] }
  crest: BufferGeometry
  /** One rectangle per LED screen. */
  screens: BufferGeometry[]
}

/** The level unit vector an LED screen faces along: east, turned toward the middle of the seats. */
function screenFacing(centre: Vec3, turnDeg: number): [number, number] {
  const turn = (turnDeg * Math.PI) / 180
  // A screen north of the centre line turns south and one south of it turns north.
  return [Math.cos(turn), (centre[2] < 0 ? 1 : -1) * Math.sin(turn)]
}

export function buildStage(cfg: VenueConfig = VENUE): StageParts {
  const lit = new MeshBuilder()
  const glow = new MeshBuilder()
  const { deck, steps, backdrop, podium, screens } = cfg.stage

  // The deck, carpeted on top, with a gold edge along its three open sides.
  lit.box([deck.xMin, GROUND, deck.zMin], [deck.xMax, deck.height, deck.zMax], { '+y': PAINT.deckTop, '+x': PAINT.deckSide, '-z': PAINT.deckSide, '+z': PAINT.deckSide })
  const edge = 0.12
  const proud = 0.03
  glow.box([deck.xMax, deck.height - edge, deck.zMin], [deck.xMax + proud, deck.height, deck.zMax], PAINT.gold, ['-x', '-y'])
  glow.box([deck.xMin, deck.height - edge, deck.zMin - proud], [deck.xMax, deck.height, deck.zMin], PAINT.gold, ['+z', '-y'])
  glow.box([deck.xMin, deck.height - edge, deck.zMax], [deck.xMax, deck.height, deck.zMax + proud], PAINT.gold, ['-z', '-y'])

  // The steps down from the middle of the deck's east face, each with a thin gold nosing.
  const mid = (deck.zMin + deck.zMax) / 2
  const rise = deck.height / steps.count
  for (let i = 1; i <= steps.count; i++) {
    const top = deck.height - i * rise
    if (top <= 0.001) continue // the last step down is the ground itself
    const x0 = deck.xMax + (i - 1) * steps.run
    lit.box([x0, GROUND, mid - steps.width / 2], [x0 + steps.run, top, mid + steps.width / 2], { '+y': PAINT.deckTop, '+x': PAINT.deckSide, '-z': PAINT.deckSide, '+z': PAINT.deckSide })
    glow.box([x0 + steps.run, top - 0.04, mid - steps.width / 2], [x0 + steps.run + 0.015, top, mid + steps.width / 2], PAINT.gold, ['-x', '-y'])
  }

  // The lectern, with a gold plate on the side the graduates see.
  const [px, py, pz] = podium
  lit.box([px - 0.3, py, pz - 0.45], [px + 0.3, py + 1.15, pz + 0.45], { '+y': PAINT.column, '+x': PAINT.podium, '-x': PAINT.podium, '-z': PAINT.podium, '+z': PAINT.podium })
  glow.face([[px + 0.32, py + 0.5, pz - 0.26], [px + 0.32, py + 0.5, pz + 0.26], [px + 0.32, py + 1.0, pz + 0.26], [px + 0.32, py + 1.0, pz - 0.26]], [1, 0, 0], PAINT.gold)

  // The backdrop wall, plain and dark, with a gold cap. The bars hang on its east face from the deck up.
  lit.box([backdrop.x - backdrop.thickness, GROUND, backdrop.zMin], [backdrop.x, backdrop.yTop, backdrop.zMax], PAINT.wallDark, ['-y'])
  glow.box([backdrop.x - backdrop.thickness, backdrop.yTop, backdrop.zMin], [backdrop.x + 0.04, backdrop.yTop + 0.14, backdrop.zMax], PAINT.gold, ['-y'])
  // Seen from the seats, north is on the right, so the picture's left edge is the south end.
  const xFace = backdrop.x + 0.02
  const bars = {
    geometry: pictureQuad([xFace, backdrop.yBottom, backdrop.zMax], [xFace, backdrop.yBottom, backdrop.zMin], [xFace, backdrop.yTop, backdrop.zMin], [xFace, backdrop.yTop, backdrop.zMax]),
    size: [backdrop.zMax - backdrop.zMin, backdrop.yTop - backdrop.yBottom] as [number, number],
  }
  const zc = (backdrop.zMin + backdrop.zMax) / 2
  const yc = backdrop.yBottom + CREST.above
  const xCrest = backdrop.x + 0.06
  const crest = pictureQuad(
    [xCrest, yc - CREST.height / 2, zc + CREST.width / 2],
    [xCrest, yc - CREST.height / 2, zc - CREST.width / 2],
    [xCrest, yc + CREST.height / 2, zc - CREST.width / 2],
    [xCrest, yc + CREST.height / 2, zc + CREST.width / 2],
  )

  // The LED screens: a dark frame on two legs, and the picture a hand's width in front of it.
  const pictures = screens.centres.map((c) => {
    const [nx, nz] = screenFacing(c, screens.turnDeg)
    // To someone facing the screen, "right" is a quarter turn from the way it faces.
    const rx = nz
    const rz = -nx
    const halfW = screens.width / 2
    const halfH = screens.height / 2
    const frame = 0.25
    lit.turnedBox(c[0] - 0.2 * nx, c[2] - 0.2 * nz, c[1] - halfH - frame, c[1] + halfH + frame, halfW + frame, 0.15, rx, rz, PAINT.wallDark)
    // The turned box has no underside; close it so the frame is solid seen from the seats below.
    const under = c[1] - halfH - frame
    const corner = (a: number, d: number): Vec3 => [c[0] - 0.2 * nx + a * rx + d * nx, under, c[2] - 0.2 * nz + a * rz + d * nz]
    lit.face([corner(-halfW - frame, -0.15), corner(halfW + frame, -0.15), corner(halfW + frame, 0.15), corner(-halfW - frame, 0.15)], [0, -1, 0], PAINT.wallDark)
    for (const side of [-1, 1]) {
      lit.turnedBox(c[0] - 0.2 * nx + side * halfW * 0.62 * rx, c[2] - 0.2 * nz + side * halfW * 0.62 * rz, GROUND, under, 0.18, 0.18, rx, rz, PAINT.steel)
    }
    const at = (a: number, h: number): Vec3 => [c[0] + a * rx, c[1] + h, c[2] + a * rz]
    return pictureQuad(at(-halfW, -halfH), at(halfW, -halfH), at(halfW, halfH), at(-halfW, halfH))
  })

  return { lit: lit.build(), glow: glow.build(), bars, crest, screens: pictures }
}

function pictureTexture(source: HTMLCanvasElement, anisotropy: number): CanvasTexture {
  const texture = new CanvasTexture(source)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = anisotropy
  return texture
}

/** The main stage: deck, steps, lectern, the backdrop with the animated FAST Matrix, and two LED screens. */
export function Stage({ animate }: { animate: boolean }) {
  const kit = useSceneKit()
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const dateStatus = useDemoFlags((s) => s.dateStatus)

  const parts = useMemo(() => buildStage(), [])
  // "Prestige & Honor": deep green and gold, the pairing reserved for the stage.
  const prestige = useMemo(() => matrixBarsMaterial([SV.deep, SV.gold], 5, parts.bars.size), [parts])

  // The three pictures. Until they are drawn the screens show plain deep green, never black.
  const materials = useMemo(
    () => ({
      title: new MeshBasicMaterial({ color: SV.deep, toneMapped: false, fog: false }),
      congrats: new MeshBasicMaterial({ color: SV.gold, toneMapped: false, fog: false, transparent: true, opacity: 0 }),
      crest: new MeshBasicMaterial({ color: SV.night, toneMapped: false, fog: false }),
    }),
    [],
  )

  const title = t('app.title')
  const congrats = t('screens.congrats')
  const date = dateStatus === 'tbc' ? t('count.tbc') : formatDate(SCHEDULE.ceremonyDay.ceremony.start, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const [drawn, setDrawn] = useState(0)

  useEffect(() => {
    let alive = true
    const words: ScreenWords = { title, date, congrats, rtl: locale === 'ar' }
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    void Promise.all([loadPicture(logoUrl), fontsReady(title + congrats + date)]).then(([logo]) => {
      if (!alive) return
      const next = {
        title: pictureTexture(drawTitleSlide(words, logo), anisotropy),
        congrats: pictureTexture(drawCongratsSlide(words), anisotropy),
        crest: pictureTexture(drawCrestPanel(logo), anisotropy),
      }
      for (const key of ['title', 'congrats', 'crest'] as const) {
        materials[key].map?.dispose()
        materials[key].map = next[key]
        materials[key].color.set('#ffffff')
        materials[key].needsUpdate = true
      }
      setDrawn((n) => n + 1)
      invalidate()
    })
    return () => {
      alive = false
    }
  }, [title, congrats, date, locale, gl, materials, invalidate])

  useEffect(
    () => () => {
      parts.lit.dispose()
      parts.glow.dispose()
      parts.bars.geometry.dispose()
      parts.crest.dispose()
      parts.screens.forEach((g) => g.dispose())
      prestige.dispose()
      for (const m of Object.values(materials)) {
        m.map?.dispose()
        m.dispose()
      }
    },
    [parts, prestige, materials],
  )

  // The second slide fades in over the first and out again. Standing still, the first slide stays.
  const second = useRef<(Mesh | null)[]>([])
  useFrame((state) => {
    if (!animate) return
    prestige.uniforms.uTime.value = state.clock.elapsedTime
    const cycle = 2 * (SLIDE_HOLD + SLIDE_FADE)
    const at = state.clock.elapsedTime % cycle
    const up = Math.min(Math.max((at - SLIDE_HOLD) / SLIDE_FADE, 0), 1)
    const down = Math.min(Math.max((at - (2 * SLIDE_HOLD + SLIDE_FADE)) / SLIDE_FADE, 0), 1)
    const k = up - down
    const opacity = k * k * (3 - 2 * k)
    materials.congrats.opacity = opacity
    for (const mesh of second.current) if (mesh) mesh.visible = opacity > 0.002
  })

  return (
    <group dispose={null} userData={{ drawn }}>
      <mesh geometry={parts.lit} material={kit.lit} />
      <mesh geometry={parts.glow} material={kit.glow} />
      <mesh geometry={parts.bars.geometry} material={prestige} />
      <mesh geometry={parts.crest} material={materials.crest} />
      {parts.screens.map((g, i) => (
        <group key={i}>
          <mesh geometry={g} material={materials.title} />
          {/* The second slide sits a centimetre in front, toward the seats, so the two never fight. */}
          <mesh ref={(m) => { second.current[i] = m }} geometry={g} material={materials.congrats} position={secondSlideOffset(i)} visible={false} renderOrder={2} />
        </group>
      ))}
    </group>
  )
}

function secondSlideOffset(i: number): Vec3 {
  const { centres, turnDeg } = VENUE.stage.screens
  const [nx, nz] = screenFacing(centres[i], turnDeg)
  return [0.02 * nx, 0, 0.02 * nz]
}
