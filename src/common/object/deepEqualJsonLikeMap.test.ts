import { describe, it, expect } from 'vitest'
import { deepEqualJsonLikeMap } from './deepEqualJsonLikeMap'

describe('deepEqualJsonLikeMap', () => {
  function test(
    a: Map<string, unknown> | null,
    b: Map<string, unknown> | null,
    expected: boolean,
  ) {
    expect(deepEqualJsonLikeMap(a, b)).toBe(expected)
    expect(deepEqualJsonLikeMap(b, a)).toBe(expected)
  }

  it('base', () => {
    test(null, null, true)
    test(null, new Map(), false)
    test(new Map(), new Map(), true)
    test(new Map([['x', 1]]), new Map([['x', 1]]), true)
    test(new Map([['x', 1]]), new Map([['x', 2]]), false)
    test(new Map([['x', 1]]), new Map([['y', 1]]), false)
    test(new Map([['x', 1]]), new Map(), false)
    test(
      new Map([
        ['x', 1],
        ['y', 2],
      ]),
      new Map([
        ['y', 2],
        ['x', 1],
      ]),
      true,
    )
    test(new Map([['x', { a: [1] }]]), new Map([['x', { a: [1] }]]), true)
    test(new Map([['x', { a: [1] }]]), new Map([['x', { a: [2] }]]), false)
  })

  it('null values', () => {
    test(new Map([['x', null]]), new Map(), true)
    test(new Map([['x', undefined]]), new Map(), true)
    test(new Map([['x', null]]), new Map([['x', undefined]]), true)
    test(new Map([['x', null]]), new Map([['y', null]]), true)
    test(new Map([['x', null]]), new Map([['y', 5]]), false)
    test(new Map([['x', null]]), new Map([['x', 5]]), false)
    test(
      new Map([
        ['x', 1],
        ['y', null],
      ]),
      new Map([['x', 1]]),
      true,
    )
    test(
      new Map([
        ['x', 1],
        ['y', null],
      ]),
      new Map([
        ['x', 1],
        ['z', 2],
      ]),
      false,
    )
  })
})
