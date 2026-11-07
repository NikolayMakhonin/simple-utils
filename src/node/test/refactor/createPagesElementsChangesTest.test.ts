import { describe, it, expect } from 'vitest'
import {
  objectTransform,
  type ObjectTransform,
} from './createPagesElementsChangesTest'

describe('objectTransform', () => {
  const transformIdentity: ObjectTransform = value => value

  function test(value: unknown, expected: unknown) {
    expect(objectTransform(value, null, null, transformIdentity)).toEqual(
      expected,
    )
  }

  it('base', () => {
    test(null, null)
    test(1, 1)
    test([], [])
    test({}, {})
    test({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })
  })

  it('transform', () => {
    const result = objectTransform({ a: 1, b: [2] }, null, null, value =>
      typeof value === 'number' ? value + 1 : value,
    )
    expect(result).toEqual({ a: 2, b: [3] })
  })

  it('special keys', () => {
    const result = objectTransform(
      JSON.parse('{"__proto__": {"a": 1}}'),
      null,
      null,
      transformIdentity,
    )
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect(Object.keys(result)).toEqual(['__proto__'])
    expect(result.a).toBeUndefined()
  })
})
