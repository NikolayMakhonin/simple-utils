import { describe, it, expect } from 'vitest'
import { arrayFilterFast } from './arrayFilterFast'

describe('arrayFilterFast', () => {
  function isPositive(value: number): boolean {
    return value > 0
  }

  function test(arr: number[], expected: number[]) {
    const arrCopy = arr.slice()
    const result = arrayFilterFast(arr, isPositive)
    expect(result).toEqual(expected)
    expect(arr).toEqual(arrCopy)
    if (expected.length === arr.length) {
      expect(result).toBe(arr)
    } else {
      expect(result).not.toBe(arr)
    }
  }

  it('base', () => {
    test([], [])
    test([1], [1])
    test([0], [])
    test([1, 2], [1, 2])
    test([0, 2], [2])
    test([1, 0], [1])
    test([0, 0], [])
    test([1, 0, 2], [1, 2])
    test([0, 1, 0, 2, 0], [1, 2])
  })

  it('type guard', () => {
    const arr: (number | null)[] = [1, null, 2]
    const result: number[] = arrayFilterFast(
      arr,
      (item): item is number => item != null,
    )
    expect(result).toEqual([1, 2])
  })
})
