import { Dialog } from '@base-ui/react/dialog'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { LOGO_NEGATIVE_FILE } from '@/brand/logo/Logo'
import { pitchSeats, usePitchSeats } from '@/features/stadiview/data/pitchSeatService'
import { downloadPass, drawPass, loadImage } from '@/features/stadiview/hud/passImage'
import { passWords } from '@/features/stadiview/hud/passWords'
import { SeatCard } from '@/features/stadiview/hud/SeatCard'
import { useHud } from '@/features/stadiview/state/hudStore'
import { useViewer } from '@/features/stadiview/state/useViewer'
import { useLocale, useT } from '@/i18n'

/**
 * The dialog that shows a graduate their Digital Seat Card: right after booking, and whenever they
 * ask for it again. From here the card is printed (or saved as a PDF) or downloaded as a picture.
 */
export function SeatCardDialog() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const viewer = useViewer()
  usePitchSeats()
  const open = useHud((s) => s.cardOpen)
  const fresh = useHud((s) => s.cardFresh)
  const [busy, setBusy] = useState(false)

  const graduate = viewer.graduate
  const seat = graduate ? pitchSeats().seatOf(graduate, viewer.now) : -1
  const shown = open && graduate !== null && seat >= 0

  // Without a seat (released, or another person signed in) there is no card to show.
  useEffect(() => {
    if (open && !shown) useHud.getState().setCardOpen(false)
  }, [open, shown])

  if (!shown || !graduate || !viewer.name) return null
  const words = passWords(graduate, viewer.name[locale], seat, t, locale)

  const download = async () => {
    setBusy(true)
    try {
      const style = getComputedStyle(document.documentElement)
      const display = style.getPropertyValue('--font-display').trim() || 'sans-serif'
      const body = style.getPropertyValue('--font-body').trim() || 'sans-serif'
      // The page's own fonts must be ready before a canvas can draw with them.
      await Promise.all([document.fonts.load(`700 68px ${display}`, words.name), document.fonts.load(`600 36px ${body}`, words.zone), document.fonts.ready]).catch(() => undefined)
      const image = await loadImage(LOGO_NEGATIVE_FILE.src)
      const qr = QRCode.create(words.code, { errorCorrectionLevel: 'M' })
      const canvas = drawPass(words, qr.modules, { rtl: locale === 'ar', display, body, logo: image && { image, ratio: LOGO_NEGATIVE_FILE.ratio } })
      downloadPass(canvas, `kfupm-seat-pass-${words.seatId}.png`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(next) => !next && useHud.getState().setCardOpen(false)}>
      {/* Inside the page's root, so the stadium's colours and focus ring reach it. */}
      <Dialog.Portal container={document.querySelector<HTMLElement>('[data-stadiview]') ?? undefined}>
        <Dialog.Backdrop className="sv-dialog__backdrop" />
        <Dialog.Popup className="sv-card sv-dialog" data-sv-card-dialog>
          <div className="sv-matrix" aria-hidden />
          <div className="sv-dialog__body">
            <Dialog.Title className="sv-dialog__title">{t(fresh ? 'sv.card.booked' : 'sv.card.title')}</Dialog.Title>
            <Dialog.Description className="sv-dialog__lead">{t('sv.card.lead')}</Dialog.Description>
            <SeatCard words={words} />
            <p className="sv-insp__promise">{t('sv.book.promise')}</p>
            <div className="sv-dialog__actions">
              <button type="button" className="sv-plate sv-button sv-button--gold" onClick={download} disabled={busy} data-sv-download>
                {t('sv.card.download')}
              </button>
              <button type="button" className="sv-plate sv-button" onClick={() => window.print()} data-sv-print>
                {t('sv.card.print')}
              </button>
              <Dialog.Close className="sv-plate sv-button" data-sv-card-close>
                {t('common.close')}
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
