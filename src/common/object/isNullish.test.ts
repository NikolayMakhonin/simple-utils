import { describe, it, expect } from 'vitest'
import { isNotNullish, isNullish } from './isNullish'

describe('isNullish', () => {
  function test(value: unknown, expected: boolean) {
    expect(isNullish(value)).toBe(expected)
    expect(isNotNullish(value)).toBe(!expected)
  }

  it('base', () => {
    test(null, true)
    test(undefined, true)
    test(0, false)
    test('', false)
    test(false, false)
    test(NaN, false)
    test({}, false)
  })
})
