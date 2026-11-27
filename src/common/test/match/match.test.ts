import { describe, it, expect } from 'vitest'
import { match } from './match'
import {
  matchAnd,
  matchArray,
  matchConvert,
  matchCustom,
  matchNot,
  matchObject,
  matchOr,
  matchOrPipe,
  matchAny,
} from './matchers/matchers'

describe('match', () => {
  function test(actual: unknown, expected: unknown, result: boolean) {
    expect(match(actual, expected).result).toBe(result)
  }

  it('base', () => {
    test(undefined, undefined, true)
    test(null, null, true)
    test(null, undefined, false)
    test(1, 1, true)
    test(1, 2, false)
    test('a', 'a', true)
    const object = {}
    test(object, object, true)
    test({}, {}, false)
    test(1, matchAny(), true)
  })
})

describe('match with an error of a nested matcher', () => {
  function createMatcherThrowing() {
    return matchCustom<unknown>('throws', () => {
      throw new Error('matcher error')
    })
  }

  function test(actual: unknown, expected: unknown) {
    const result = match(actual, expected)
    expect(result.result).toBe(null)
    expect(result.error?.message).toBe('matcher error')
  }

  it('base', () => {
    test(1, createMatcherThrowing())
  })

  it('matchers that match nested values pass the error on', () => {
    test(1, matchNot(createMatcherThrowing()))
    test([1], matchArray([createMatcherThrowing()]))
    test({ a: 1 }, matchObject({ a: createMatcherThrowing() }))
    test(1, matchAnd(matchAny(), createMatcherThrowing()))
    test(
      1,
      matchConvert('value', o => o, createMatcherThrowing()),
    )
    test([1], matchNot(matchArray([createMatcherThrowing()])))
  })

  it('or without pipe passes the error on, also when another branch matches', () => {
    test(1, matchOr(createMatcherThrowing(), matchAny()))
    test(1, matchOr(matchAny(), createMatcherThrowing()))
  })

  it('or with pipe does not run the branches after a match', () => {
    expect(
      match(1, matchOrPipe(matchAny(), createMatcherThrowing())).result,
    ).toBe(true)
  })
})
