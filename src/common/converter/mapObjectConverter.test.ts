import { describe, it, expect } from 'vitest'
import { mapObjectConverter } from './mapObjectConverter'

describe('mapObjectConverter', () => {
  it('base', () => {
    expect(JSON.stringify(mapObjectConverter.to(new Map()))).toBe('{}')
    expect(
      JSON.stringify(
        mapObjectConverter.to(
          new Map<string, any>([
            ['b', 1],
            ['a', null],
          ]),
        ),
      ),
    ).toBe('{"b":1,"a":null}')

    expect(mapObjectConverter.from({})).toEqual(new Map())
    const map = mapObjectConverter.from({ b: 1, a: null })
    expect(Array.from(map.entries())).toEqual([
      ['b', 1],
      ['a', null],
    ])
  })

  it('special keys', () => {
    const obj = mapObjectConverter.to(
      new Map<string, any>([
        ['__proto__', { isAdmin: true }],
        ['constructor', 2],
      ]),
    )
    expect(Object.getPrototypeOf(obj)).toBe(Object.prototype)
    expect(obj.isAdmin).toBe(undefined)
    expect(JSON.stringify(obj)).toBe(
      '{"__proto__":{"isAdmin":true},"constructor":2}',
    )
    expect(({} as Record<string, unknown>).isAdmin).toBe(undefined)

    const map = mapObjectConverter.from(JSON.parse('{"__proto__": {"a": 1}}'))
    expect(Array.from(map.entries())).toEqual([['__proto__', { a: 1 }]])
  })

  it('inherited properties', () => {
    const obj = Object.create({ inherited: 1 })
    obj.own = 2
    expect(Array.from(mapObjectConverter.from(obj).entries())).toEqual([
      ['own', 2],
    ])
  })
})
