import { useState } from 'react'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { Dialog } from '@/ui/Dialog'
import { toast } from '@/ui/toast'

export function KitPage() {
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(false)
  const [state, setState] = useState<'loading' | 'success' | undefined>()
  const run = () => {
    setState('loading')
    setTimeout(() => setState('success'), 700)
    setTimeout(() => setState(undefined), 1800)
  }
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-10">
      <h1 className="text-3xl font-black text-turquoise">UI kit</h1>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="gold">Gold</Button>
        <Button variant="destructive">Destructive</Button>
        <Button disabled>Disabled</Button>
        <Button state={state} onClick={run}>Confirm seat</Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Chip selected={sel} onToggle={setSel}>Chip</Chip>
        <Button variant="ghost" onClick={() => setOpen(true)}>Open dialog</Button>
        <Button variant="ghost" onClick={() => toast.success('Seat held for 10 minutes')}>Show toast</Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen} title="Dialog">
        <p>Plain dialog content.</p>
      </Dialog>
    </main>
  )
}
