import { describe, it, expect } from 'vitest'
import { compareJsonLike } from './compareJsonLike'
import { deepEqualJsonLike } from './deepEqualJsonLike'

describe('compareJsonLike', () => {
  function test(a: unknown, b: unknown, expected: -1 | 0 | 1) {
    expect(compareJsonLike(a, b)).toBe(expected)
    expect(compareJsonLike(b, a)).toBe(expected === 0 ? 0 : -expected)
    expect(deepEqualJsonLike(a, b)).toBe(expected === 0)
  }

  it('base', () => {
    test(null, null, 0)
    test(undefined, undefined, 0)
    test(null, undefined, 0)
    test(null, false, -1)
    test(null, 0, -1)
    test(null, '', -1)
    test(null, [], -1)
    test(null, {}, -1)

    test(false, false, 0)
    test(false, true, -1)
    test(true, 0, -1)
    test(0, 0, 0)
    test(0, 1, -1)
    test(-1, 0, -1)
    test(1, [], -1)
    test([], '', -1)
    test({}, '', -1)
    test('', '', 0)
    test('', 'a', -1)
    test('a', 'b', -1)
    test('b', 'ab', 1)

    test([], [], 0)
    test([], {}, -1)
    test([1], [1], 0)
    test([1], [2], -1)
    test([1], [1, 2], -1)
    test([2], [1, 2], 1)
    test([null], [undefined], 0)
    test([[1, [2]]], [[1, [2]]], 0)
    test([[1, [2]]], [[1, [3]]], -1)

    test({}, {}, 0)
    test({ a: 1 }, { a: 1 }, 0)
    test({ a: 1 }, { a: 2 }, -1)
    test({ a: 1 }, { b: 1 }, 1)
    test({ a: 1, b: 2 }, { b: 2, a: 1 }, 0)
    test({ a: 2, b: 1 }, { a: 1, b: 2 }, 1)
    test({ b: 1, a: 2 }, { a: 1, b: 2 }, 1)
    test({ a: { b: [1, { c: 2 }] } }, { a: { b: [1, { c: 2 }] } }, 0)
    test({ a: { b: [1, { c: 2 }] } }, { a: { b: [1, { c: 3 }] } }, -1)
  })

  it('null properties', () => {
    test({ a: null }, {}, 0)
    test({ a: undefined }, {}, 0)
    test({ a: null }, { a: undefined }, 0)
    test({ a: null }, { b: null }, 0)
    test({ a: null }, { b: 1 }, -1)
    test({ a: 1, b: null }, { a: 1 }, 0)
    test({ a: 1, b: null }, { a: 1, c: 2 }, -1)
    test({ a: { b: null } }, { a: {} }, 0)
  })

  it('special keys', () => {
    test(JSON.parse('{"constructor": 1}'), JSON.parse('{"constructor": 1}'), 0)
    test(JSON.parse('{"constructor": 1}'), JSON.parse('{"constructor": 2}'), -1)
    test(JSON.parse('{"constructor": 1}'), {}, 1)
    test(
      JSON.parse('{"__proto__": {"a": 1}}'),
      JSON.parse('{"__proto__": {"a": 1}}'),
      0,
    )
    test(
      JSON.parse('{"__proto__": {"a": 1}}'),
      JSON.parse('{"__proto__": {"a": 2}}'),
      -1,
    )
    test(JSON.parse('{"__proto__": {"a": 1}}'), {}, 1)
    test(Object.create(null), {}, 0)
    test(Object.assign(Object.create(null), { a: 1 }), { a: 1 }, 0)
  })

  it('class instances', () => {
    const date = new Date(1)
    test(date, date, 0)
    test({ a: date }, { a: date }, 0)
  })

  it('errors', () => {
    expect(() => compareJsonLike(NaN, 0)).toThrow('NaN has no order')
    expect(() => compareJsonLike(0, NaN)).toThrow('NaN has no order')
    expect(() => compareJsonLike(NaN, NaN)).toThrow('NaN has no order')
    expect(() => compareJsonLike({ a: NaN }, { a: 0 })).toThrow(
      'NaN has no order',
    )
    expect(() => compareJsonLike(new Date(1), new Date(1))).toThrow(
      '[object Date] has no order',
    )
    expect(() => compareJsonLike(new Date(1), {})).toThrow(
      '[object Date] has no order',
    )
    expect(() => compareJsonLike({}, new Date(1))).toThrow(
      '[object Date] has no order',
    )
    expect(() => compareJsonLike({ a: new Date(1) }, { a: {} })).toThrow(
      '[object Date] has no order',
    )
  })
})
