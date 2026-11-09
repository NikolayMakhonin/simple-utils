import { describe, it, expect } from 'vitest'
import { DIFF_NEW, DIFF_OLD, getObjectsDiff } from './getObjectsDiff'

function diff(valueOld: unknown, valueNew: unknown) {
  return { [DIFF_OLD]: valueOld, [DIFF_NEW]: valueNew }
}

describe('getObjectsDiff', () => {
  function test(valueOld: unknown, valueNew: unknown, expected: unknown) {
    expect(getObjectsDiff(valueOld, valueNew)).toEqual(expected)
  }

  it('base', () => {
    test(null, null, null)
    test(1, 1, null)
    test(1, 2, diff(1, 2))
    test([], [], null)
    test({}, {}, null)
    test([1], [1], null)
    test({ a: 1 }, { a: 1 }, null)
    test([1], [2], [diff(1, 2)])
    test({ a: 1 }, { a: 2 }, { a: diff(1, 2) })
    test({ a: [{ b: 1 }] }, { a: [{ b: 2 }] }, { a: [{ b: diff(1, 2) }] })
    test([], {}, diff([], {}))
  })

  it('arrays of different lengths', () => {
    test([1, 2, 3], [1, 2], [diff(3, undefined)])
    test([1, 2], [1, 2, 3], [diff(undefined, 3)])
    test([1], [], [diff(1, undefined)])
    test([], [1], [diff(undefined, 1)])
    test([1, 2], [3], [diff(1, 3), diff(2, undefined)])
  })

  it('objects with different keys', () => {
    test({ a: 1 }, {}, { a: diff(1, undefined) })
    test({}, { a: 1 }, { a: diff(undefined, 1) })
    test({ a: 1 }, { b: 2 }, { a: diff(1, undefined), b: diff(undefined, 2) })
  })

  it('values of different kinds', () => {
    test({}, [], diff({}, []))
    test({ a: 1 }, [1], diff({ a: 1 }, [1]))
    test([1], { a: 1 }, diff([1], { a: 1 }))
    test({}, 1, diff({}, 1))
    test({}, null, diff({}, null))
  })

  it('class instances are compared by identity', () => {
    const date = new Date(1)
    test(date, date, null)
    test(new Date(1), new Date(1), diff(new Date(1), new Date(1)))
    test(new Date(1), new Date(2), diff(new Date(1), new Date(2)))
    test({}, new Date(1), diff({}, new Date(1)))
  })

  it('objects without prototype', () => {
    const create = (value: number) =>
      Object.assign(Object.create(null), { a: value })
    test(create(1), create(1), null)
    test(create(1), create(2), { a: diff(1, 2) })
    test({ a: 1 }, create(1), null)
  })

  it('handleDiff', () => {
    const result = getObjectsDiff([1, 2], [1], (valueOld, valueNew, diffs) => ({
      valueOld,
      valueNew,
      diffs,
    }))
    expect(result).toEqual({
      valueOld: [1, 2],
      valueNew: [1],
      diffs: [
        {
          valueOld: 2,
          valueNew: undefined,
          diffs: diff(2, undefined),
        },
      ],
    })
  })

  it('handleDiff of objects', () => {
    const result = getObjectsDiff(
      { a: 1, b: 1 },
      { a: 2, b: 1 },
      (valueOld, valueNew, diffs) => ({ valueOld, valueNew, diffs }),
    )
    expect(result).toEqual({
      valueOld: { a: 1, b: 1 },
      valueNew: { a: 2, b: 1 },
      diffs: {
        a: { valueOld: 1, valueNew: 2, diffs: diff(1, 2) },
      },
    })
  })

  it('handleDiff returning null drops the difference', () => {
    expect(getObjectsDiff({ a: 1 }, { a: 2 }, () => null)).toBe(null)
    expect(getObjectsDiff([1], [2], () => null)).toBe(null)
    expect(
      getObjectsDiff(
        { a: 1, b: 1 },
        { a: 2, b: 2 },
        (valueOld, valueNew, diffs) =>
          valueOld === 1 && valueNew === 2 ? null : diffs,
      ),
    ).toBe(null)
    expect(
      getObjectsDiff(
        { a: 1, b: 3 },
        { a: 2, b: 4 },
        (valueOld, valueNew, diffs) => (valueOld === 1 ? null : diffs),
      ),
    ).toEqual({ b: diff(3, 4) })
  })

  it('__proto__ key stays a key in the diff, not the prototype', () => {
    function testProto(valueOld: string, valueNew: string, expected: unknown) {
      const result = getObjectsDiff(JSON.parse(valueOld), JSON.parse(valueNew))!
      expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
      expect(Object.keys(result)).toEqual(['__proto__'])
      expect(
        Object.getOwnPropertyDescriptor(result, '__proto__')?.value,
      ).toEqual(expected)
    }

    testProto('{"__proto__": 1}', '{"__proto__": 2}', diff(1, 2))
    testProto('{"__proto__": 1}', '{}', diff(1, undefined))
    testProto('{}', '{"__proto__": 1}', diff(undefined, 1))
  })

  it('inherited properties count as absent keys', () => {
    test({ toString: 1 }, {}, { toString: diff(1, undefined) })
    test({}, { toString: 1 }, { toString: diff(undefined, 1) })
    test(
      JSON.parse('{"constructor": 1}'),
      {},
      JSON.parse('{"constructor": {"-": 1}}'),
    )
  })
})
