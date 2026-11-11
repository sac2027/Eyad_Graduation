import { useEffect, useMemo, useRef } from 'react'
import { PerspectiveCamera, WebGLRenderTarget } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { POV_FOV, lookAngles, seatEye, seatLook } from '@/features/stadiview/engine/cameraMath'
import { onPreviewRequest, PREVIEW_SIZE, publishPreview } from '@/features/stadiview/hud/previewChannel'
import type { PreviewRequest } from '@/features/stadiview/hud/previewChannel'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

/** Linear light to the sRGB bytes a 2D canvas wants, for each of the 256 values a pixel can hold. */
const TO_SRGB = new Uint8ClampedArray(256)
for (let i = 0; i < 256; i++) {
  const c = i / 255
  TO_SRGB[i] = Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055))
}

/**
 * Draws the view from a seat into a small off-screen picture when the inspector asks for one.
 *
 * It is drawn on request, not every frame: one extra drawing of the stadium at a small size, and
 * one read of 64,000 pixels back from the graphics card. That read is too slow to do sixty times
 * a second on a phone, and fine to do once per seat.
 */
export function PreviewCamera() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  const pending = useRef<PreviewRequest | null>(null)

  const kit = useMemo(() => {
    const { width, height } = PREVIEW_SIZE
    const camera = new PerspectiveCamera(POV_FOV, width / height, 0.12, 4000)
    camera.rotation.order = 'YXZ'
    return { camera, target: new WebGLRenderTarget(width, height), pixels: new Uint8Array(width * height * 4) }
  }, [])
  useEffect(() => () => kit.target.dispose(), [kit])

  useEffect(
    () =>
      onPreviewRequest((r) => {
        // Only the latest request matters: a seat inspected a moment ago is no longer wanted.
        pending.current = r
        invalidate()
      }),
    [invalidate],
  )

  // Before the main picture is drawn, so the main camera's frame is untouched.
  useFrame(() => {
    const r = pending.current
    if (!r) return
    pending.current = null
    const v = getVenue()
    if (r.seat < 0 || r.seat >= v.count) return
    const eye = seatEye(r.seat, v)
    const look = r.look ?? lookAngles(eye, seatLook(r.seat, v))
    kit.camera.position.set(eye[0], eye[1], eye[2])
    kit.camera.rotation.set(look.pitch, look.yaw, 0, 'YXZ')
    kit.camera.updateMatrixWorld()

    // The marker stands on the inspected seat, which is exactly where this camera is.
    const marker = scene.getObjectByName('seat-marker')
    const wasVisible = marker?.visible
    if (marker) marker.visible = false
    const previous = gl.getRenderTarget()
    gl.setRenderTarget(kit.target)
    gl.render(scene, kit.camera)
    gl.readRenderTargetPixels(kit.target, 0, 0, PREVIEW_SIZE.width, PREVIEW_SIZE.height, kit.pixels)
    gl.setRenderTarget(previous)
    if (marker && wasVisible !== undefined) marker.visible = wasVisible

    // The graphics card hands the rows back bottom first and in linear light; a canvas wants them top first in sRGB.
    const { width, height } = PREVIEW_SIZE
    const image = new ImageData(width, height)
    for (let y = 0; y < height; y++) {
      const from = (height - 1 - y) * width * 4
      const to = y * width * 4
      for (let x = 0; x < width * 4; x += 4) {
        image.data[to + x] = TO_SRGB[kit.pixels[from + x]]
        image.data[to + x + 1] = TO_SRGB[kit.pixels[from + x + 1]]
        image.data[to + x + 2] = TO_SRGB[kit.pixels[from + x + 2]]
        image.data[to + x + 3] = 255
      }
    }
    publishPreview(image, r.seat)
  })

  return null
}
