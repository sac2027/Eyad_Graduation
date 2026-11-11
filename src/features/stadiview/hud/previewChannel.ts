import type { Look } from '@/features/stadiview/engine/cameraMath'

/**
 * The line between the inspector, which wants a picture of the view from a seat, and the 3D
 * scene, which can draw one. The inspector asks; the scene draws into a small off-screen picture
 * at its next frame and hands the pixels back.
 */
export interface PreviewRequest {
  seat: number
  /** Which way to look; left out, the seat's own view of the stage. */
  look?: Look
}

export const PREVIEW_SIZE = { width: 320, height: 200 }

type RequestListener = (r: PreviewRequest) => void
type PictureListener = (image: ImageData, seat: number) => void

const requestListeners = new Set<RequestListener>()
const pictureListeners = new Set<PictureListener>()

export function requestPreview(seat: number, look?: Look): void {
  for (const fn of requestListeners) fn({ seat, look })
}

export function onPreviewRequest(fn: RequestListener): () => void {
  requestListeners.add(fn)
  return () => {
    requestListeners.delete(fn)
  }
}

export function publishPreview(image: ImageData, seat: number): void {
  for (const fn of pictureListeners) fn(image, seat)
}

export function onPreview(fn: PictureListener): () => void {
  pictureListeners.add(fn)
  return () => {
    pictureListeners.delete(fn)
  }
}
