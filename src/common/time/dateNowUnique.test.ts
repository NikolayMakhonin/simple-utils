import { afterEach, describe, expect, it, vi } from 'vitest'
import { dateNowUnique } from './dateNowUnique'

describe('dateNowUnique', () => {
  // The previous date is shared between tests, so each test starts ahead of it
  let clock = Date.now() + 1e9

  afterEach(() => {
    vi.restoreAllMocks()
    clock += 1e6
  })

  function test(now: number, expected: number) {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(dateNowUnique()).toBe(expected)
  }

  it('returns the clock when it is ahead', () => {
    test(clock, clock)
    test(clock + 10, clock + 10)
  })

  it('increments while the clock stands still', () => {
    test(clock, clock)
    test(clock, clock + 1)
    test(clock, clock + 2)
  })

  it('increments when the clock goes back', () => {
    test(clock, clock)
    test(clock - 1000, clock + 1)
    test(clock - 1000, clock + 2)
  })

  it('returns to the clock after the clock overtakes it', () => {
    test(clock, clock)
    test(clock, clock + 1)
    test(clock, clock + 2)
    test(clock + 1, clock + 3)
    test(clock + 100, clock + 100)
  })

  it('strictly increases on the real clock', () => {
    let prev = dateNowUnique()
    for (let i = 0; i < 1000; i++) {
      const value = dateNowUnique()
      expect(value).toBeGreaterThan(prev)
      prev = value
    }
  })
})
