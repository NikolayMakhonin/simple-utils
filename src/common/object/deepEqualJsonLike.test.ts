import { describe, it, expect } from 'vitest'
import { deepEqualJsonLike } from './deepEqualJsonLike'

describe('deepEqualJsonLike', () => {
  function test(a: unknown, b: unknown, expected: boolean) {
    expect(deepEqualJsonLike(a, b)).toBe(expected)
    expect(deepEqualJsonLike(b, a)).toBe(expected)
  }

  it('base', () => {
    test(null, null, true)
    test(undefined, undefined, true)
    test(null, undefined, true)
    test(null, 0, false)
    test(null, '', false)
    test(null, {}, false)
    test(0, 0, true)
    test(0, 1, false)
    test(0, '0', false)
    test('', '', true)
    test('a', 'b', false)
    test(true, true, true)
    test(true, false, false)

    test([], [], true)
    test([], {}, false)
    test([1], [1], true)
    test([1], [2], false)
    test([1], [1, 2], false)
    test([null], [undefined], true)
    test([[1, [2]]], [[1, [2]]], true)

    test({}, {}, true)
    test({ a: 1 }, { a: 1 }, true)
    test({ a: 1 }, { a: 2 }, false)
    test({ a: 1 }, { b: 1 }, false)
    test({ a: 1, b: 2 }, { b: 2, a: 1 }, true)
    test({ a: { b: [1, { c: 2 }] } }, { a: { b: [1, { c: 2 }] } }, true)
    test({ a: { b: [1, { c: 2 }] } }, { a: { b: [1, { c: 3 }] } }, false)
  })

  it('null properties', () => {
    test({ a: null }, {}, true)
    test({ a: undefined }, {}, true)
    test({ a: null }, { a: undefined }, true)
    test({ a: null }, { b: null }, true)
    test({ a: null }, { b: 1 }, false)
    test({ a: 1, b: null }, { a: 1 }, true)
    test({ a: 1, b: null }, { a: 1, c: 2 }, false)
  })

  it('class instances', () => {
    const date = new Date(1)
    test(date, date, true)
    test(new Date(1), new Date(1), false)
    test({ a: date }, { a: date }, true)
    test({ a: new Date(1) }, { a: new Date(1) }, false)
    test(new Date(1), {}, false)
  })

  it('special keys', () => {
    test(
      JSON.parse('{"constructor": 1}'),
      JSON.parse('{"constructor": 1}'),
      true,
    )
    test(
      JSON.parse('{"constructor": 1}'),
      JSON.parse('{"constructor": 2}'),
      false,
    )
    test(
      JSON.parse('{"__proto__": {"a": 1}}'),
      JSON.parse('{"__proto__": {"a": 1}}'),
      true,
    )
    test(
      JSON.parse('{"__proto__": {"a": 1}}'),
      JSON.parse('{"__proto__": {"a": 2}}'),
      false,
    )
    test(JSON.parse('{"__proto__": {"a": 1}}'), {}, false)
    test(Object.create(null), {}, true)
    test(Object.assign(Object.create(null), { a: 1 }), { a: 1 }, true)
  })
})
