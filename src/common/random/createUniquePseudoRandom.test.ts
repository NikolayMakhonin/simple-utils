import { describe, it, expect } from 'vitest'
import {
  createUniquePseudoRandom,
  UNIQUE_PSEUDO_RANDOM_MAX_COUNT,
} from './createUniquePseudoRandom'

describe('createUniquePseudoRandom', () => {
  it('base', () => {
    expect(() => createUniquePseudoRandom(0)).toThrow()
    expect(() => createUniquePseudoRandom(-1)).toThrow()
    expect(() =>
      createUniquePseudoRandom(UNIQUE_PSEUDO_RANDOM_MAX_COUNT + 1),
    ).toThrow()
    expect(() =>
      createUniquePseudoRandom(UNIQUE_PSEUDO_RANDOM_MAX_COUNT),
    ).not.toThrow()
    for (let count = 1; count < 500; count++) {
      const random = createUniquePseudoRandom(count)
      const values = new Set<number>()
      for (let i = 0; i < count; i++) {
        const value = random()
        // console.log(value)
        expect(values.has(value)).toBe(false)
        values.add(value)
      }
      for (let i = 0; i < count; i++) {
        const value = random()
        expect(values.has(value)).toBe(true)
      }
    }
  }, 10000)

  it('all numbers', () => {
    const count = UNIQUE_PSEUDO_RANDOM_MAX_COUNT
    const random = createUniquePseudoRandom(count)
    for (let i = 0; i < 2; i++) {
      let hash = 0
      let hashCheck = 0
      let j = 0
      while (true) {
        const value = random()
        hash ^= value
        hashCheck ^= j
        j++
        if (j === count) {
          break
        }
      }

      expect(hash).toBe(hashCheck)
    }
  })
})
