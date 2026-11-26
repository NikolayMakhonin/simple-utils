import { describe, it, expect } from 'vitest'
import { getEnumValues } from './getEnumValues'

enum NumericEnum {
  A,
  B,
  C,
}

enum FractionalEnum {
  A = -1,
  B = 1.5,
}

enum StringEnum {
  A = 'a',
  B = 'b',
}

enum MixedEnum {
  A = 1,
  B = 'A',
}

describe('getEnumValues', () => {
  function test(enumObject: Record<string, any>, expected: unknown[]) {
    expect(getEnumValues(enumObject)).toEqual(expected)
  }

  it('base', () => {
    test({}, [])
    test({ a: 1 }, [1])
    test({ x: 'y', y: 5 }, ['y', 5])
    test({ '0': 'a', a: 1 }, ['a', 1])
    test(NumericEnum, [0, 1, 2])
    test(FractionalEnum, [-1, 1.5])
    test(StringEnum, ['a', 'b'])
    test(MixedEnum, [1, 'A'])
  })

  it('filter', () => {
    const filterInputs: unknown[] = []
    expect(
      getEnumValues(NumericEnum, {
        filter: value => {
          filterInputs.push(value)
          return value !== NumericEnum.A
        },
      }),
    ).toEqual([1, 2])
    expect(filterInputs).toEqual([0, 1, 2])
    expect(getEnumValues(StringEnum, { filter: () => false })).toEqual([])
  })
})
