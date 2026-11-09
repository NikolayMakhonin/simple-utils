import { afterEach, describe, expect, it, vi } from 'vitest'
import { dateNowUnique } from './dateNowUnique'

describe('dateNowUnique', () => {
  // The prevDate of dateNowUnique stays between tests,
  // so each test starts with a clock ahead of all earlier results
  let clock = Date.now() + 1e9

  afterEach(() => {
    vi.restoreAllMocks()
    clock += 1e6
  })

  function test(now: number, expected: number) {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(dateNowUnique()).toBe(expected)
  }

  it('returns Date.now() when it is greater than the previous result', () => {
    test(clock, clock)
    test(clock + 10, clock + 10)
  })

  it('returns the previous result + 1 while Date.now() does not change', () => {
    test(clock, clock)
    test(clock, clock + 1)
    test(clock, clock + 2)
  })

  it('returns the previous result + 1 when Date.now() goes back', () => {
    test(clock, clock)
    test(clock - 1000, clock + 1)
    test(clock - 1000, clock + 2)
  })

  it('returns Date.now() again once it exceeds the previous result', () => {
    test(clock, clock)
    test(clock, clock + 1)
    test(clock, clock + 2)
    test(clock + 1, clock + 3)
    test(clock + 100, clock + 100)
  })

  it('each result is greater than the previous one with the real Date.now()', () => {
    let prev = dateNowUnique()
    for (let i = 0; i < 1000; i++) {
      const value = dateNowUnique()
      expect(value).toBeGreaterThan(prev)
      prev = value
    }
  })
})
