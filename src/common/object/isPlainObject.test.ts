import { describe, it, expect } from 'vitest'
import { isPlainObject } from './isPlainObject'

describe('isPlainObject', () => {
  function test(value: unknown, expected: boolean) {
    expect(isPlainObject(value)).toBe(expected)
  }

  it('base', () => {
    test({}, true)
    test({ a: 1 }, true)
    test(new Object(), true)
    test(Object.create(null), true)
    test(Object.create(Object.prototype), true)
    test(JSON.parse('{}'), true)
    test(JSON.parse('{"constructor": 1}'), true)
    test(JSON.parse('{"__proto__": {"a": 1}}'), true)
    test({ constructor: Array }, true)
    test({ ...{ a: 1 } }, true)
    test(Object.assign({}, { a: 1 }), true)
    test(Object.fromEntries([['a', 1]]), true)
    test(structuredClone({ a: 1 }), true)

    test(null, false)
    test(undefined, false)
    test(0, false)
    test(NaN, false)
    test('', false)
    test('a', false)
    test(true, false)
    test(0n, false)
    test(Symbol('a'), false)

    test(() => {}, false)
    test(function func() {}, false)
    test(class {}, false)

    test([], false)
    test([1], false)
    test(new Date(), false)
    test(/a/, false)
    test(new Map(), false)
    test(new Set(), false)
    test(new WeakMap(), false)
    test(new Error(), false)
    test(Promise.resolve(), false)
    test(new ArrayBuffer(1), false)
    test(new Uint8Array(1), false)
    test(new Number(1), false)
    test(new String('a'), false)
    test(new Boolean(true), false)

    test(new (class {})(), false)
    test(new (class extends Object {})(), false)
    test(Object.create({}), false)
    test(Object.create(Object.create(null)), false)
    test(Object.create(Array.prototype), false)
  })
})
