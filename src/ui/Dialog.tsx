import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import type { ReactNode } from 'react'
import { useT } from '@/i18n'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}

export function Dialog({ open, onOpenChange, title, children }: DialogProps) {
  const t = useT()
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="dialog-backdrop" />
        <BaseDialog.Popup className="dialog-popup">
          <BaseDialog.Title className="mb-3 font-display text-xl font-bold text-turquoise">{title}</BaseDialog.Title>
          {children}
          <BaseDialog.Close className="mt-4 min-h-11 rounded-xl px-4 font-medium text-turquoise underline">{t('common.close')}</BaseDialog.Close>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}
