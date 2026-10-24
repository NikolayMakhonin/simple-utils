import { describe, it, expect } from 'vitest'
import { deepCloneJsonLike } from './deepCloneJsonLike'

describe('deepCloneJsonLike', () => {
  function test(value: unknown, expectedJson: string) {
    const clone = deepCloneJsonLike(value)
    expect(JSON.stringify(clone)).toBe(expectedJson)
    checkNoSharedObjects(value, clone)
  }

  function checkNoSharedObjects(value: any, clone: any) {
    if (value == null || typeof value !== 'object') {
      return
    }
    expect(clone).not.toBe(value)
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        checkNoSharedObjects(value[key], clone[key])
      }
    }
  }

  it('base', () => {
    expect(deepCloneJsonLike(null)).toBe(null)
    expect(deepCloneJsonLike(undefined)).toBe(null)
    test(0, '0')
    test('', '""')
    test('a', '"a"')
    test(true, 'true')

    test([], '[]')
    test([1, null, undefined], '[1,null,null]')
    test([[1], [[2]]], '[[1],[[2]]]')

    test({}, '{}')
    test({ a: 1, b: null, c: undefined }, '{"a":1,"b":null,"c":null}')
    test({ b: { c: [{ d: 1 }] }, a: [] }, '{"b":{"c":[{"d":1}]},"a":[]}')
  })

  it('class instances', () => {
    const date = new Date(1)
    expect(deepCloneJsonLike(date)).toBe(date)
    expect(deepCloneJsonLike({ date }).date).toBe(date)
    expect(deepCloneJsonLike([date])[0]).toBe(date)
  })

  it('special keys', () => {
    const source = JSON.parse('{"constructor": {"a": 1}}')
    test(source, '{"constructor":{"a":1}}')

    const sourceProto = JSON.parse('{"__proto__": {"isAdmin": true}}')
    const clone = deepCloneJsonLike(sourceProto)
    expect(Object.getPrototypeOf(clone)).toBe(Object.prototype)
    expect(clone.isAdmin).toBe(undefined)
    expect(JSON.stringify(clone)).toBe('{"__proto__":{"isAdmin":true}}')
    checkNoSharedObjects(sourceProto, clone)

    const sourceNullPrototype = Object.assign(Object.create(null), { a: 1 })
    test(sourceNullPrototype, '{"a":1}')
  })
})
