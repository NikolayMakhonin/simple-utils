import { describe, it, expect } from 'vitest'
import { Random } from './Random'
import {
  arrayShuffle,
  randomBoolean,
  randomEnum,
  randomFloat,
  randomIndexWeighted,
  randomInt,
  randomItems,
} from './helpers'

/**
 * Random whose next() always returns value,
 * so that tests can check results that a real generator returns rarely
 */
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

// The largest value of Random.next() with a seed
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
  it('stays below toExclusive at RANDOM_MAX', () => {
    const rnd = new RandomFixed(RANDOM_MAX)
    expect(randomInt(rnd, 3)).toBe(2)
    expect(randomInt(rnd, 2 ** 40, 2 ** 40 + 1)).toBe(2 ** 40)
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

  it('never selects a zero weight', () => {
    // The largest value of Math.random(). With it, subtracting the weights
    // 0.1, 0.2, 0.3 from the random value leaves exactly 0 because of rounding
    const rnd = new RandomFixed(1 - 2 ** -53)
    expect(randomIndexWeighted(rnd, [0.1, 0.2, 0.3, 0])).toBe(2)
    expect(randomIndexWeighted(rnd, [0.1, 0.2, 0.3, 0, 0])).toBe(2)
    expect(randomIndexWeighted(rnd, [0, 0.1, 0.2, 0.3, 0])).toBe(3)
  })

  it('errors', () => {
    const rnd = new Random(0)
    expect(() => randomIndexWeighted(rnd, 1, null as any)).toThrow(/getWeight/)
    expect(() => randomIndexWeighted(rnd, [-1, 3])).toThrow(/negative/)
    expect(() => randomIndexWeighted(rnd, [-Infinity])).toThrow(/negative/)
    expect(() => randomIndexWeighted(rnd, [NaN, 1])).toThrow()
    expect(() => randomIndexWeighted(rnd, [Infinity, 1])).toThrow()
  })
})

describe('randomBoolean', () => {
  function test(
    value: number,
    trueProbability: number | null,
    expected: boolean,
  ) {
    expect(randomBoolean(new RandomFixed(value), trueProbability)).toBe(
      expected,
    )
  }

  it('base', () => {
    test(0, null, true)
    test(0.49, null, true)
    test(0.5, null, false)
    test(RANDOM_MAX, null, false)
  })

  it('trueProbability', () => {
    test(0, 0, false)
    test(RANDOM_MAX, 1, true)
    test(0.2, 0.3, true)
    test(0.3, 0.3, false)
  })
})

describe('arrayShuffle', () => {
  it('base', () => {
    const rnd = new Random(0)
    expect(arrayShuffle(rnd, [])).toEqual([])
    expect(arrayShuffle(rnd, [1])).toEqual([1])
  })

  it('shuffles in place and keeps all items', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const result = arrayShuffle(new Random(0), items)
    expect(result).toBe(items)
    expect(items).not.toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(items.slice().sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('selects all permutations with equal probability', () => {
    const rnd = new Random(0)
    const iterations = 60000
    const counts = new Map<string, number>()
    for (let i = 0; i < iterations; i++) {
      const key = arrayShuffle(rnd, [1, 2, 3]).join('')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    expect(counts.size).toBe(6)
    counts.forEach(count => {
      expect(Math.abs(count / (iterations / 6) - 1)).toBeLessThan(0.05)
    })
  })
})

describe('randomItems', () => {
  it('base', () => {
    const rnd = new Random(0)
    expect(randomItems(rnd, [], 0)).toEqual([])
    expect(randomItems(rnd, [1], 0)).toEqual([])
    expect(randomItems(rnd, [1], 2)).toEqual([1, 1])
  })

  it('remove takes the selected items out of items', () => {
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
