import { describe, it, expect } from 'vitest'
import { getNormalizedObject } from './getNormalizedObject'

describe('getNormalizedObject', () => {
  function test(value: unknown, expectedJson: string | undefined) {
    expect(JSON.stringify(getNormalizedObject(value))).toBe(expectedJson)
  }

  it('base', () => {
    test(null, 'null')
    test(undefined, undefined)
    test(0, '0')
    test('', '""')
    test('a', '"a"')
    test(false, 'false')

    test([], '[]')
    test([null, 1, undefined], '[null,1,null]')

    test({}, '{}')
    test({ b: 2, a: 1 }, '{"a":1,"b":2}')
    test(
      { a: null, b: undefined, c: 0, d: '', e: false },
      '{"c":0,"d":"","e":false}',
    )
    test(
      { b: { d: 4, c: null }, a: [{ f: 6, e: 5 }, null] },
      '{"a":[{"e":5,"f":6},null],"b":{"d":4}}',
    )
  })

  it('class instances', () => {
    const date = new Date(1)
    expect(getNormalizedObject(date)).toBe(date)
    expect(getNormalizedObject({ date }).date).toBe(date)
    expect(getNormalizedObject([date])[0]).toBe(date)
    expect(JSON.stringify(getNormalizedObject({ date: new Date(1) }))).not.toBe(
      JSON.stringify(getNormalizedObject({ date: new Date(2) })),
    )

    class Item {
      b = 2
      a = 1
    }
    const item = new Item()
    expect(getNormalizedObject(item)).toBe(item)
  })

  it('special keys', () => {
    const result = getNormalizedObject(
      JSON.parse('{"constructor": 2, "__proto__": {"b": 1, "a": null}}'),
    )
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect(result.b).toBe(undefined)
    expect(JSON.stringify(result)).toBe('{"__proto__":{"b":1},"constructor":2}')

    test(Object.assign(Object.create(null), { b: 1, a: 2 }), '{"a":2,"b":1}')
  })
})
