import { describe, it, expect } from 'vitest'
import { numberMod } from './numberMod'

describe('numberMod', () => {
  function numberEquals(o1: number, o2: number, epsilon = 1e-10) {
    return Math.abs(o1 - o2) < epsilon
  }

  function assertNumberEquals(o1: number, o2: number, epsilon = 1e-10) {
    if (!numberEquals(o1, o2, epsilon)) {
      expect(o1).toBe(o2)
    }
  }

  it('base', () => {
    // expect(numberMod(-3, 1)).toBe(0)
    // expect(numberMod(-2, 1)).toBe(0)
    // expect(numberMod(-1, 1)).toBe(0)
    // expect(numberMod(0, 1)).toBe(0)
    // expect(numberMod(1, 1)).toBe(0)
    // expect(numberMod(2, 1)).toBe(0)
    // expect(numberMod(3, 1)).toBe(0)
    //
    // expect(numberMod(-3, 2)).toBe(1)
    // expect(numberMod(-2, 2)).toBe(0)
    // expect(numberMod(-1, 2)).toBe(1)
    // expect(numberMod(0, 2)).toBe(0)
    // expect(numberMod(1, 2)).toBe(1)
    // expect(numberMod(2, 2)).toBe(0)
    // expect(numberMod(3, 2)).toBe(1)
    //
    // expect(numberMod(-3, 3)).toBe(0)
    // expect(numberMod(-2, 3)).toBe(1)
    // expect(numberMod(-1, 3)).toBe(2)
    // expect(numberMod(0, 3)).toBe(0)
    // expect(numberMod(1, 3)).toBe(1)
    // expect(numberMod(2, 3)).toBe(2)
    // expect(numberMod(3, 3)).toBe(0)
    //
    // expect(numberMod(-3.1, 3)).toBe(2.9)
    // expect(numberMod(-2.1, 3)).toBe(0.9)
    // expect(numberMod(-1.1, 3)).toBe(1.9)
    // expect(numberMod(0.1, 3)).toBe(0.1)
    // expect(numberMod(1.1, 3)).toBe(1.1)
    // expect(numberMod(2.1, 3)).toBe(2.1)
    // expect(numberMod(3.1, 3)).toBe(0.1)

    assertNumberEquals(numberMod(-3, 1), 0)
    assertNumberEquals(numberMod(-2, 1), 0)
    assertNumberEquals(numberMod(-1, 1), 0)
    assertNumberEquals(numberMod(0, 1), 0)
    assertNumberEquals(numberMod(1, 1), 0)
    assertNumberEquals(numberMod(2, 1), 0)
    assertNumberEquals(numberMod(3, 1), 0)

    assertNumberEquals(numberMod(-3, 2), 1)
    assertNumberEquals(numberMod(-2, 2), 0)
    assertNumberEquals(numberMod(-1, 2), 1)
    assertNumberEquals(numberMod(0, 2), 0)
    assertNumberEquals(numberMod(1, 2), 1)
    assertNumberEquals(numberMod(2, 2), 0)
    assertNumberEquals(numberMod(3, 2), 1)

    assertNumberEquals(numberMod(-3, 3), 0)
    assertNumberEquals(numberMod(-2, 3), 1)
    assertNumberEquals(numberMod(-1, 3), 2)
    assertNumberEquals(numberMod(0, 3), 0)
    assertNumberEquals(numberMod(1, 3), 1)
    assertNumberEquals(numberMod(2, 3), 2)
    assertNumberEquals(numberMod(3, 3), 0)

    assertNumberEquals(numberMod(-3.1, 3), 2.9)
    assertNumberEquals(numberMod(-2.1, 3), 0.9)
    assertNumberEquals(numberMod(-1.1, 3), 1.9)
    assertNumberEquals(numberMod(0.1, 3), 0.1)
    assertNumberEquals(numberMod(1.1, 3), 1.1)
    assertNumberEquals(numberMod(2.1, 3), 2.1)
    assertNumberEquals(numberMod(3.1, 3), 0.1)
  })
})
