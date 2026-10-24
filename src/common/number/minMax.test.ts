import { describe, it, expect } from 'vitest'
import { minMax } from './minMax'

describe('minMax', () => {
  function test(
    value: number | null | undefined,
    min: number | null | undefined,
    max: number | null | undefined,
    expected: number | null | undefined,
  ) {
    expect(minMax(value, min, max)).toBe(expected)
  }

  it('base', () => {
    test(null, null, null, null)
    test(undefined, undefined, undefined, undefined)
    test(5, null, null, 5)

    test(-5, 0, null, 0)
    test(0, 0, null, 0)
    test(5, 0, null, 5)
    test(null, 0, null, 0)

    test(5, null, 10, 5)
    test(10, null, 10, 10)
    test(15, null, 10, 10)
    test(null, null, 10, 10)

    test(-5, 0, 10, 0)
    test(0, 0, 10, 0)
    test(5, 0, 10, 5)
    test(10, 0, 10, 10)
    test(15, 0, 10, 10)
    test(-0.5, -1, 1, -0.5)
  })
})
