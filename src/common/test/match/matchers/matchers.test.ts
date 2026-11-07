import { describe, it, expect } from 'vitest'
import { match } from '../match'
import { matchDeep } from './matchers'

describe('matchDeep', () => {
  function test(actual: unknown, expected: unknown, result: boolean) {
    expect(match(actual, matchDeep(expected)).result).toBe(result)
  }

  it('base', () => {
    test(null, null, true)
    test(undefined, null, true)
    test(1, 1, true)
    test(1, 2, false)
    test([], [], true)
    test([1, [2]], [1, [2]], true)
    test([1, [2]], [1, [3]], false)
    test({}, {}, true)
    test({ a: { b: 1 } }, { a: { b: 1 } }, true)
    test({ a: { b: 1 } }, { a: { b: 2 } }, false)
    test({ a: 1 }, {}, false)
    test({}, { a: 1 }, false)
  })

  it('class instances are compared by identity', () => {
    const date = new Date(1)
    test(date, date, true)
    test(new Date(1), new Date(1), false)
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
    test(JSON.parse('{"__proto__": 1}'), JSON.parse('{"__proto__": 1}'), true)
    test(JSON.parse('{"__proto__": 1}'), JSON.parse('{"__proto__": 2}'), false)
    test(JSON.parse('{"__proto__": 1}'), {}, false)
  })

  it('objects without prototype', () => {
    const create = (value: number) =>
      Object.assign(Object.create(null), { a: value })
    test(create(1), create(1), true)
    test(create(1), create(2), false)
    test({ a: 1 }, create(1), true)
  })

  it('attack attempt: __proto__ in expected does not change the prototype', () => {
    const expected = JSON.parse('{"__proto__": {"polluted": 1}}')
    matchDeep(expected)
    expect(({} as any).polluted).toBeUndefined()
    expect(Object.getPrototypeOf(expected)).toBe(Object.prototype)
  })
})
