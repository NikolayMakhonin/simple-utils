import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { check, checkFunc, CheckError } from './check'
import {
  matchArray,
  matchCustom,
  matchInstanceOf,
  matchNot,
} from './matchers/matchers'

// check logs the report of every mismatch, and checkFunc logs every unexpected error
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('check', () => {
  function test(actual: unknown, expected: unknown, result: boolean) {
    if (result) {
      expect(() => check(actual)(expected)).not.toThrow()
    } else {
      expect(() => check(actual)(expected)).toThrow(CheckError)
    }
  }

  it('base', () => {
    test(1, 1, true)
    test(1, 2, false)
    test([1], matchArray([1]), true)
    test([1], matchArray([2]), false)
  })

  it('report of a mismatch with plain expected values', () => {
    test(null, matchNot(null), false)
    test(undefined, matchNot(undefined), false)
    expect(() => check([{ a: 1 }])(matchArray([{ a: 1 }]))).toThrow(
      /expected: \{a: 1\}/,
    )
  })

  it('error of a matcher is thrown', () => {
    const matcher = matchCustom<unknown>('throws', () => {
      throw new Error('matcher error')
    })
    expect(() => check(1)(matcher)).toThrow('matcher error')
    expect(() => check(1)(matchNot(matcher))).toThrow('matcher error')
  })
})

describe('checkFunc', () => {
  function getErrorThrown(func: () => unknown): unknown {
    try {
      func()
    } catch (error) {
      return error
    }
    throw new Error('[test][getErrorThrown] func did not throw')
  }

  it('base', async () => {
    expect(checkFunc(() => 1)(1)).toBe(1)
    expect(() => checkFunc(() => 1)(2)).toThrow(CheckError)
    expect(await checkFunc(async () => 1)(1)).toBe(1)
    await expect(checkFunc(async () => 1)(2)).rejects.toThrow(CheckError)
  })

  it('an unexpected error is thrown as it is', async () => {
    const error = new Error('func error')
    expect(
      getErrorThrown(() =>
        checkFunc(() => {
          throw error
        })(1),
      ),
    ).toBe(error)
    expect(
      getErrorThrown(() =>
        checkFunc(() => {
          throw error
        })(1, matchInstanceOf(TypeError)),
      ),
    ).toBe(error)
    await expect(
      checkFunc<number>(async () => {
        throw error
      })(1),
    ).rejects.toBe(error)
  })

  it('an expected error', async () => {
    const error = new TypeError('func error')
    expect(
      checkFunc(() => {
        throw error
      })(1, matchInstanceOf(TypeError)),
    ).toBe(undefined)
    expect(
      await checkFunc<number>(async () => {
        throw error
      })(1, matchInstanceOf(TypeError)),
    ).toBe(undefined)
  })
})
