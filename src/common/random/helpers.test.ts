import { describe, it, expect } from 'vitest'
import { Random } from './Random'
import {
  randomEnum,
  randomFloat,
  randomIndexWeighted,
  randomInt,
  randomItems,
} from './helpers'

/** Always returns the same value, to reach the rare results of a real generator */
class RandomFixed extends Random {
  readonly #value: number

  constructor(value: number) {
    super()
    this.#value = value
  }

  override next(): number {
    return this.#value
  }
}

const RANDOM_MAX = 1 - 2 ** -32

describe('randomFloat', () => {
  function test(
    value: number,
    from: number,
    toExclusive: number | null,
    expected: number,
  ) {
    expect(randomFloat(new RandomFixed(value), from, toExclusive)).toBe(
      expected,
    )
  }

  it('base', () => {
    test(0, 5, null, 0)
    test(0.5, 4, null, 2)
    test(0, 1, 3, 1)
    test(0.5, 1, 3, 2)
    test(0.5, -3, -1, -2)
  })

  it('never reaches toExclusive', () => {
    test(RANDOM_MAX, 2 ** 40, 2 ** 40 + 1, 2 ** 40)
    test(RANDOM_MAX, 2 ** 53, 2 ** 53 + 2, 2 ** 53)
    expect(randomFloat(new RandomFixed(RANDOM_MAX), 0, 1)).toBeLessThan(1)
    expect(randomFloat(new RandomFixed(RANDOM_MAX), 1, 2)).toBeLessThan(2)
  })

  it('errors', () => {
    const rnd = new Random(0)
    expect(() => randomFloat(rnd, 0)).toThrow()
    expect(() => randomFloat(rnd, -1)).toThrow()
    expect(() => randomFloat(rnd, 2, 1)).toThrow()
    expect(() => randomFloat(rnd, 1, 1)).toThrow()
    expect(() => randomFloat(rnd, NaN)).toThrow()
    expect(() => randomFloat(rnd, 0, NaN)).toThrow()
    expect(() => randomFloat(rnd, NaN, 1)).toThrow()
    expect(() => randomFloat(rnd, Infinity)).toThrow()
    expect(() => randomFloat(rnd, -1e308, 1e308)).toThrow()
  })
})

describe('randomInt', () => {
  it('stays in range at the maximum value of the generator', () => {
    const rnd = new RandomFixed(RANDOM_MAX)
    expect(randomInt(rnd, 3)).toBe(2)
    expect(randomInt(rnd, 2 ** 40, 2 ** 40 + 1)).toBe(2 ** 40)
    const now = 1700000000000
    expect(randomInt(rnd, now, now + 1)).toBe(now)
  })
})

describe('randomIndexWeighted', () => {
  function test(weights: number[], expected: number) {
    expect(randomIndexWeighted(new Random(0), weights)).toBe(expected)
    expect(
      randomIndexWeighted(new Random(0), weights.length, o => weights[o]),
    ).toBe(expected)
  }

  it('base', () => {
    test([], -1)
    test([0], -1)
    test([0, 0], -1)
    test([1], 0)
    test([1, 0], 0)
    test([0, 1], 1)
    test([0, 1, 0], 1)
  })

  it('selects by weight', () => {
    expect(randomIndexWeighted(new RandomFixed(0), [1, 3])).toBe(0)
    expect(randomIndexWeighted(new RandomFixed(0.24), [1, 3])).toBe(0)
    expect(randomIndexWeighted(new RandomFixed(0.26), [1, 3])).toBe(1)
    expect(randomIndexWeighted(new RandomFixed(RANDOM_MAX), [1, 3])).toBe(1)
  })

  it('errors', () => {
    const rnd = new Random(0)
    expect(() => randomIndexWeighted(rnd, [-1, 3])).toThrow(/negative/)
    expect(() => randomIndexWeighted(rnd, [-Infinity])).toThrow(/negative/)
    expect(() => randomIndexWeighted(rnd, [NaN, 1])).toThrow()
    expect(() => randomIndexWeighted(rnd, [Infinity, 1])).toThrow()
  })
})

describe('randomItems', () => {
  it('base', () => {
    const rnd = new Random(0)
    expect(randomItems(rnd, [], 0)).toEqual([])
    expect(randomItems(rnd, [1], 0)).toEqual([])
    expect(randomItems(rnd, [1], 2)).toEqual([1, 1])
  })

  it('remove', () => {
    const rnd = new Random(0)
    const items = [1, 2, 3]
    const result = randomItems(rnd, items, 2, true)
    expect(result.length).toBe(2)
    expect(items.length).toBe(1)
    expect([...result, ...items].sort()).toEqual([1, 2, 3])
  })

  it('errors', () => {
    const rnd = new Random(0)
    expect(() => randomItems(rnd, [], 1)).toThrow(/empty/)
    expect(() => randomItems(rnd, [1], 2, true)).toThrow(/empty/)
  })
})

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
