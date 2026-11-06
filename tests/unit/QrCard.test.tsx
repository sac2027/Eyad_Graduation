import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QrCard, QrSvg } from '@/ui/QrCard'

describe('QrCard', () => {
  it('shows the gate, seat and a labelled QR code', () => {
    render(<QrCard name="Khaled" label="Ticket G05" code="KFUPM57-G05-3-12" rows={[{ label: 'Gate', value: 'Gate 1' }, { label: 'Seat', value: '3 · 12' }]} />)
    expect(screen.getByText('Gate 1')).toBeInTheDocument()
    expect(screen.getByText('3 · 12')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Ticket G05' })).toBeInTheDocument()
  })
  it('lets a 60-character Arabic name wrap instead of overflowing', () => {
    const name = 'عبدالرحمن بن محمد بن عبدالعزيز بن سعود بن فيصل آل سعود الغامدي'
    expect(name.length).toBeGreaterThanOrEqual(60)
    render(<QrCard name={name} label="Ticket" code="X" rows={[]} />)
    const el = screen.getByText(name)
    expect(el.className).toMatch(/break-words/)
    expect(el.className).toMatch(/overflow-wrap:anywhere/)
  })
  it('renders a deterministic QR with only black on white', () => {
    const a = render(<QrSvg value="hello" label="a" />).container.innerHTML
    const b = render(<QrSvg value="hello" label="a" />).container.innerHTML
    expect(a).toBe(b)
    expect(a).toContain('fill="#000"')
  })
  it('offers a share action when given one', () => {
    render(<QrCard name="N" label="L" code="C" rows={[]} onShare={() => {}} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
