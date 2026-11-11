import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useStadium } from '@/features/stadiview/state/stadiumStore'
import type { CameraMode } from '@/features/stadiview/state/stadiumStore'

const v = getVenue()
const A = v.indexOf('P3-12-07')
const B = v.indexOf('S-10-060')
const C = v.indexOf('P1-01-01')

const st = () => useStadium.getState()
/** The three fields that are data, without the actions. */
const snap = () => ({ mode: st().mode, hover: st().hover, selected: st().selected })
/** Puts the store in a given situation directly, without going through the actions under test. */
const given = (mode: CameraMode, selected = -1, hover = -1) => useStadium.setState({ mode, selected, hover })
/** Counts how many times subscribers are told about a change while `run` runs. */
const notifications = (run: () => void): number => {
  let n = 0
  const stop = useStadium.subscribe(() => n++)
  run()
  stop()
  return n
}

// The store is one object shared by every test in this file: put it back before each.
beforeEach(() => useStadium.setState(useStadium.getInitialState(), true))

describe('the stadium store at the start', () => {
  it('is in the overview with nothing hovered or selected', () => {
    expect(snap()).toEqual({ mode: 'orbit', hover: -1, selected: -1 })
  })

  it('uses real seats in these tests', () => {
    expect(A).toBeGreaterThanOrEqual(0)
    expect(B).toBeGreaterThanOrEqual(0)
    expect(C).toBeGreaterThanOrEqual(0)
    expect(new Set([A, B, C]).size).toBe(3)
  })
})

describe('select', () => {
  it('selects the seat and starts a flight from the overview', () => {
    st().select(A)
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: A })
  })

  it('starts a new flight from first person', () => {
    given('pov', A)
    st().select(B)
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: B })
  })

  it('retargets a flight that is on its way in', () => {
    given('fly', A)
    st().select(B)
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: B })
  })

  it('turns a flight back to the overview into a flight to the seat', () => {
    given('fly', -1)
    st().select(B)
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: B })
  })

  it('flies again when the seat the viewer is sitting in is selected, as from any mode', () => {
    given('pov', A)
    st().select(A)
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: A })
  })

  it('accepts the first and the last seat of the venue', () => {
    st().select(0)
    expect(st().selected).toBe(0)
    st().select(v.count - 1)
    expect(st().selected).toBe(v.count - 1)
    expect(st().mode).toBe('fly')
  })

  it('does nothing with a negative index, in any mode', () => {
    for (const [mode, selected, hover] of [['orbit', -1, C], ['fly', A, -1], ['fly', -1, -1], ['pov', A, -1]] as const) {
      given(mode, selected, hover)
      const before = snap()
      expect(notifications(() => st().select(-1))).toBe(0)
      expect(notifications(() => st().select(-7))).toBe(0)
      expect(snap()).toEqual(before)
    }
  })

  it('does nothing with an index that is not a seat of the venue', () => {
    given('orbit', -1, C)
    for (const bad of [v.count, v.count + 1, 1e9, 2.5, NaN, Infinity, -Infinity, -0.5]) {
      expect(notifications(() => st().select(bad)), String(bad)).toBe(0)
      expect(snap()).toEqual({ mode: 'orbit', hover: C, selected: -1 })
    }
  })

  it('clears the hover as the flight starts', () => {
    st().setHover(C)
    expect(st().hover).toBe(C)
    st().select(A)
    expect(st().hover).toBe(-1)
  })

  it('does not tell subscribers again when the same seat is selected twice during its flight', () => {
    // A double click must not restart the flight.
    st().select(A)
    expect(notifications(() => st().select(A))).toBe(0)
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: A })
  })

  it('changes mode, selection and hover in one step', () => {
    // A subscriber must never see "fly" with the old seat, or a hover outside the overview.
    st().setHover(C)
    const seen: ReturnType<typeof snap>[] = []
    const stop = useStadium.subscribe(() => seen.push(snap()))
    st().select(A)
    st().select(B)
    stop()
    expect(seen).toEqual([
      { mode: 'fly', hover: -1, selected: A },
      { mode: 'fly', hover: -1, selected: B },
    ])
  })
})

describe('back', () => {
  it('starts the flight back from first person', () => {
    given('pov', A)
    st().back()
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: -1 })
  })

  it('turns a flight in around', () => {
    given('fly', A)
    st().back()
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: -1 })
  })

  it('does nothing in the overview', () => {
    given('orbit', -1, C)
    expect(notifications(() => st().back())).toBe(0)
    expect(snap()).toEqual({ mode: 'orbit', hover: C, selected: -1 })
  })

  it('does nothing more during a flight that is already going back', () => {
    // Escape held down repeats; it must not restart the return flight each time.
    given('pov', A)
    st().back()
    expect(notifications(() => st().back())).toBe(0)
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: -1 })
  })

  it('changes mode and selection in one step', () => {
    given('pov', A)
    expect(notifications(() => st().back())).toBe(1)
  })
})

describe('setHover', () => {
  it('sets and clears the hover in the overview', () => {
    st().setHover(A)
    expect(snap()).toEqual({ mode: 'orbit', hover: A, selected: -1 })
    st().setHover(B)
    expect(st().hover).toBe(B)
    st().setHover(-1)
    expect(snap()).toEqual({ mode: 'orbit', hover: -1, selected: -1 })
  })

  it('is ignored in first person', () => {
    given('pov', A)
    expect(notifications(() => st().setHover(B))).toBe(0)
    expect(snap()).toEqual({ mode: 'pov', hover: -1, selected: A })
  })

  it('is ignored during a flight in', () => {
    given('fly', A)
    expect(notifications(() => st().setHover(B))).toBe(0)
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: A })
  })

  it('is ignored during a flight back', () => {
    given('fly', -1)
    expect(notifications(() => st().setHover(B))).toBe(0)
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: -1 })
  })

  it('works again once the camera is back in the overview', () => {
    st().select(A)
    st().setMode('pov')
    st().back()
    st().setHover(B)
    expect(st().hover).toBe(-1)
    st().setMode('orbit')
    st().setHover(B)
    expect(snap()).toEqual({ mode: 'orbit', hover: B, selected: -1 })
  })

  it('tells subscribers only when the hovered seat changes', () => {
    // The pointer handler calls this on every move; most moves stay on the same seat.
    expect(notifications(() => st().setHover(A))).toBe(1)
    expect(notifications(() => st().setHover(A))).toBe(0)
    expect(notifications(() => st().setHover(-1))).toBe(1)
    expect(notifications(() => st().setHover(-1))).toBe(0)
  })

  it('treats an index that is not a seat as no seat', () => {
    for (const bad of [v.count, 1e9, 2.5, NaN, Infinity, -2]) {
      st().setHover(A)
      st().setHover(bad)
      expect(st().hover, String(bad)).toBe(-1)
    }
    st().setHover(v.count - 1)
    expect(st().hover).toBe(v.count - 1)
    st().setHover(0)
    expect(st().hover).toBe(0)
  })

  it('never touches the mode or the selection', () => {
    given('fly', A)
    st().setHover(B)
    st().setHover(-1)
    expect(st().mode).toBe('fly')
    expect(st().selected).toBe(A)
  })
})

describe('setMode', () => {
  it('lands a flight in: first person, same seat', () => {
    st().select(A)
    st().setMode('pov')
    expect(snap()).toEqual({ mode: 'pov', hover: -1, selected: A })
  })

  it('lands a flight back: the overview, nothing selected', () => {
    given('pov', A)
    st().back()
    st().setMode('orbit')
    expect(snap()).toEqual({ mode: 'orbit', hover: -1, selected: -1 })
  })

  it('clears the hover when the camera leaves the overview by any road', () => {
    given('orbit', -1, C)
    st().setMode('fly')
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: -1 })
    given('orbit', A, C)
    st().setMode('pov')
    expect(snap()).toEqual({ mode: 'pov', hover: -1, selected: A })
  })

  it('refuses first person when no seat is selected', () => {
    // A flight in that finishes just as the viewer pressed Back must not seat the camera nowhere.
    given('pov', A)
    st().back()
    expect(notifications(() => st().setMode('pov'))).toBe(0)
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: -1 })
    given('orbit', -1, C)
    st().setMode('pov')
    expect(snap()).toEqual({ mode: 'orbit', hover: C, selected: -1 })
  })

  it('leaves the selection alone', () => {
    given('fly', A)
    st().setMode('orbit')
    expect(snap()).toEqual({ mode: 'orbit', hover: -1, selected: A })
    st().setMode('fly')
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: A })
  })

  it('keeps the hover when the mode is set to the overview it is already in', () => {
    given('orbit', -1, C)
    expect(notifications(() => st().setMode('orbit'))).toBe(0)
    expect(st().hover).toBe(C)
  })

  it('does not tell subscribers when the mode does not change', () => {
    given('pov', A)
    expect(notifications(() => st().setMode('pov'))).toBe(0)
    given('fly', A)
    expect(notifications(() => st().setMode('fly'))).toBe(0)
  })
})

describe('a whole visit', () => {
  it('goes overview, hover, seat, another seat, back, overview', () => {
    st().setHover(A)
    st().select(A)
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: A })
    st().setMode('pov')
    st().setHover(C) // the pointer still moves, but nothing is hovered in first person
    expect(snap()).toEqual({ mode: 'pov', hover: -1, selected: A })
    st().select(B)
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: B })
    st().select(C) // changed their mind mid-flight
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: C })
    st().setMode('pov')
    st().back()
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: -1 })
    st().setMode('orbit')
    expect(snap()).toEqual({ mode: 'orbit', hover: -1, selected: -1 })
    st().back() // already there
    st().setHover(B)
    expect(snap()).toEqual({ mode: 'orbit', hover: B, selected: -1 })
  })

  it('reads the two kinds of flight from the selection', () => {
    st().select(A)
    expect(st().mode === 'fly' && st().selected >= 0).toBe(true) // flying in
    st().back()
    expect(st().mode === 'fly' && st().selected === -1).toBe(true) // flying back
  })

  it('keeps its promises through 20,000 random actions', () => {
    // A small copy of the rules, written from the plan, runs beside the store.
    let seed = 20261110
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    const seats = [A, B, C, 0, v.count - 1]
    const junk = [-1, -1, -3, v.count, 4.5, NaN]
    const anyIndex = () => (rnd() < 0.7 ? seats[Math.floor(rnd() * seats.length)] : junk[Math.floor(rnd() * junk.length)])
    const isSeat = (i: number) => Number.isInteger(i) && i >= 0 && i < v.count
    const modes: CameraMode[] = ['orbit', 'fly', 'pov']
    const model = { mode: 'orbit' as CameraMode, hover: -1, selected: -1 }
    const reached = new Set<string>()

    for (let step = 0; step < 20000; step++) {
      const r = rnd()
      if (r < 0.35) {
        const i = anyIndex()
        st().setHover(i)
        if (model.mode === 'orbit') model.hover = isSeat(i) ? i : -1
      } else if (r < 0.6) {
        const i = anyIndex()
        st().select(i)
        if (isSeat(i)) Object.assign(model, { mode: 'fly', selected: i, hover: -1 })
      } else if (r < 0.75) {
        st().back()
        if (model.mode !== 'orbit') Object.assign(model, { mode: 'fly', selected: -1 })
      } else {
        const m = modes[Math.floor(rnd() * 3)]
        st().setMode(m)
        if (!(m === 'pov' && model.selected === -1)) {
          model.mode = m
          if (m !== 'orbit') model.hover = -1
        }
      }
      const s = snap()
      expect(s).toEqual(model)
      if (s.mode !== 'orbit') expect(s.hover).toBe(-1)
      if (s.mode === 'pov') expect(s.selected).toBeGreaterThanOrEqual(0)
      expect(s.hover === -1 || isSeat(s.hover)).toBe(true)
      expect(s.selected === -1 || isSeat(s.selected)).toBe(true)
      reached.add(`${s.mode}/${s.selected >= 0 ? 'seat' : 'none'}/${s.hover >= 0 ? 'hover' : 'none'}`)
    }
    // The walk really visited every situation the store can be in.
    expect([...reached].sort()).toEqual(['fly/none/none', 'fly/seat/none', 'orbit/none/hover', 'orbit/none/none', 'orbit/seat/hover', 'orbit/seat/none', 'pov/seat/none'])
  })
})

describe('the store as others use it', () => {
  it('keeps the same action functions for its whole life', () => {
    // Components and the camera rig hold on to these; they must not go stale after a change.
    const { setHover, select, back, setMode } = st()
    st().setHover(A)
    st().select(A)
    st().setMode('pov')
    st().back()
    st().setMode('orbit')
    expect(st().setHover).toBe(setHover)
    expect(st().select).toBe(select)
    expect(st().back).toBe(back)
    expect(st().setMode).toBe(setMode)
  })

  it('works when the actions are called detached from the store', () => {
    const { setHover, select, back, setMode } = st()
    setHover(A)
    expect(st().hover).toBe(A)
    select(B)
    setMode('pov')
    expect(snap()).toEqual({ mode: 'pov', hover: -1, selected: B })
    back()
    expect(snap()).toEqual({ mode: 'fly', hover: -1, selected: -1 })
  })

  it('holds exactly the fields the plans list', () => {
    // `facing` came with Phase 3: a guest sits in their seat turned toward their graduate.
    expect(Object.keys(st()).sort()).toEqual(['back', 'facing', 'hover', 'mode', 'select', 'selected', 'setHover', 'setMode'])
  })

  it('can be put back to the start with its own initial state', () => {
    st().select(A)
    st().setMode('pov')
    useStadium.setState(useStadium.getInitialState(), true)
    expect(snap()).toEqual({ mode: 'orbit', hover: -1, selected: -1 })
    st().setHover(B)
    expect(st().hover).toBe(B)
  })

  it('re-renders a component that reads the mode when the mode changes, and not when the hover does', () => {
    // Hover changes many times a second; only the tooltip should pay for them.
    let renders = 0
    const { result } = renderHook(() => {
      renders++
      return useStadium((s) => s.mode)
    })
    expect(result.current).toBe('orbit')
    const start = renders
    act(() => st().setHover(A))
    act(() => st().setHover(B))
    act(() => st().setHover(-1))
    expect(renders).toBe(start)
    act(() => st().select(A))
    expect(result.current).toBe('fly')
    expect(renders).toBe(start + 1)
    act(() => st().select(B)) // a retarget does not change the mode
    expect(renders).toBe(start + 1)
  })

  it('gives a component the hovered seat as it changes', () => {
    const { result } = renderHook(() => useStadium((s) => s.hover))
    expect(result.current).toBe(-1)
    act(() => st().setHover(A))
    expect(result.current).toBe(A)
    act(() => st().select(A))
    expect(result.current).toBe(-1)
  })
})

describe('facing another seat', () => {
  beforeEach(() => useStadium.setState(useStadium.getInitialState(), true))

  it('looks at the stage unless asked otherwise', () => {
    st().select(B)
    expect(st()).toMatchObject({ mode: 'fly', selected: B, facing: -1 })
  })

  it('remembers the seat to face until the camera leaves', () => {
    st().select(B, A)
    expect(st()).toMatchObject({ mode: 'fly', selected: B, facing: A })
    st().setMode('pov')
    expect(st().facing).toBe(A)
    st().back()
    expect(st()).toMatchObject({ selected: -1, facing: -1 })
  })

  it('turns the view when the same seat is chosen again with someone to face', () => {
    st().select(B)
    st().setMode('pov')
    st().select(B, A)
    expect(st()).toMatchObject({ mode: 'fly', selected: B, facing: A })
    // And back to the stage.
    st().setMode('pov')
    st().select(B)
    expect(st()).toMatchObject({ mode: 'fly', selected: B, facing: -1 })
  })

  it('ignores a seat that cannot be faced: itself, or no seat at all', () => {
    st().select(B, B)
    expect(st().facing).toBe(-1)
    st().back()
    st().setMode('orbit')
    st().select(C, 99_999)
    expect(st().facing).toBe(-1)
  })
})
