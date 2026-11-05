import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { deadlineTicks, Scrubber, SCRUB_MAX, SCRUB_MIN } from '@/features/demo-console/Scrubber'
import { SCHEDULE } from '@/time/schedule'

const mid = Date.parse('2027-03-14T09:00:00+03:00')

describe('Scrubber', () => {
  it('maps a slider position to an epoch within the range', () => {
    const onChange = vi.fn()
    render(<Scrubber value={mid} onChange={onChange} />)
    const input = screen.getByRole('slider', { name: /simulated date/i })
    fireEvent.change(input, { target: { value: String(Date.parse('2027-04-07T20:00:00+03:00')) } })
    expect(onChange).toHaveBeenLastCalledWith(Date.parse('2027-04-07T20:00:00+03:00'))
    fireEvent.change(input, { target: { value: String(SCRUB_MAX + 10_000_000) } })
    expect(onChange.mock.calls.at(-1)![0]).toBeLessThanOrEqual(SCRUB_MAX)
    expect(onChange.mock.calls.at(-1)![0]).toBeGreaterThanOrEqual(SCRUB_MIN)
  })
  it('moves by one hour with the arrow keys and one day with Shift', () => {
    const onChange = vi.fn()
    render(<Scrubber value={mid} onChange={onChange} />)
    const input = screen.getByRole('slider')
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(mid + 3_600_000)
    fireEvent.keyDown(input, { key: 'ArrowLeft', shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith(mid - 86_400_000)
  })
  it('renders a tick for every deadline in the schedule', () => {
    const { container } = render(<Scrubber value={mid} onChange={() => {}} />)
    const ticks = container.querySelectorAll('[data-tick]')
    expect(ticks.length).toBe(deadlineTicks().length)
    for (const id of ['attire', 'tickets', 'candidacy', 'certificate'] as const) {
      expect(container.querySelector(`[data-tick="${id}-due"]`)).not.toBeNull()
      expect(SCHEDULE.stages[id].due).toBeDefined()
    }
  })
})
