import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@/ui/Button'
import { useMotionOverride } from '@/ui/motionPrefs'

afterEach(() => useMotionOverride.getState().setReduced(null))

describe('Button', () => {
  it('has an accessible name and fires onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Confirm seat</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm seat' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
  it('loading sets aria-busy and ignores clicks', () => {
    const onClick = vi.fn()
    render(<Button state="loading" onClick={onClick}>Save</Button>)
    const b = screen.getByRole('button', { name: 'Save' })
    expect(b).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(b)
    expect(onClick).not.toHaveBeenCalled()
  })
  it('disabled ignores clicks', () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Save</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).not.toHaveBeenCalled()
  })
  it('success state shows a check next to the label', () => {
    render(<Button state="success">Saved</Button>)
    expect(screen.getByRole('button', { name: 'Saved' }).querySelector('svg')).not.toBeNull()
  })
  it('applies the press scale normally and drops it under reduced motion', () => {
    const { rerender } = render(<Button>Go</Button>)
    expect(screen.getByRole('button').className).toContain('active:scale-[0.97]')
    useMotionOverride.getState().setReduced(true)
    rerender(<Button>Go</Button>)
    expect(screen.getByRole('button').className).not.toContain('active:scale')
    expect(screen.getByRole('button').querySelector('.matrix-wipe')).toBeNull()
  })
})
