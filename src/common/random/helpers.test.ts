import { describe, it, expect } from 'vitest'
import { Random } from './Random'
import { randomEnum } from './helpers'

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

describe('randomEnum', () => {
  function test(
    enumType: Record<string, any>,
    expected: unknown[],
    predicate?: null | ((value: any) => boolean),
  ) {
    const rnd = new Random(0)
    const values = new Set<unknown>()
    for (let i = 0; i < 1000; i++) {
      values.add(randomEnum(rnd, enumType, predicate))
    }
    expect(Array.from(values).sort()).toEqual(expected.slice().sort())
  }

  it('base', () => {
    test({ a: 1 }, [1])
    test(NumericEnum, [0, 1, 2])
    test(FractionalEnum, [-1, 1.5])
    test(StringEnum, ['a', 'b'])
    test(MixedEnum, [1, 'A'])
    test({ x: 'y', y: 5 }, ['y', 5])
    test({ '0': 'a', a: 1 }, ['a', 1])
  })

  it('predicate', () => {
    test(NumericEnum, [1, 2], value => value !== NumericEnum.A)
    test(StringEnum, ['b'], value => value === StringEnum.B)
  })

  it('errors', () => {
    const rnd = new Random(0)
    expect(() => randomEnum(rnd, {})).toThrow()
    expect(() => randomEnum(rnd, NumericEnum, () => false)).toThrow()
  })
})
