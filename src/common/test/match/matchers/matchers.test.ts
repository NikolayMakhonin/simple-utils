import { describe, it, expect } from 'vitest'
import { match } from '../match'
import {
  matchArray,
  matchArrayBuffer,
  matchDeep,
  matchEnum,
  matchNumber,
  matchRef,
  matchString,
  matchUuid,
} from './matchers'
import { MatcherArray } from './MatcherArray'
import type { MatchNumberArgs } from './MatcherNumber'
import type { MatchStringPattern } from './MatcherString'

describe('matchDeep', () => {
  function test(actual: unknown, expected: unknown, result: boolean) {
    expect(match(actual, matchDeep(expected)).result).toBe(result)
  }

  it('base', () => {
    test(null, null, true)
    test(undefined, null, true)
    test(1, 1, true)
    test(1, 2, false)
    test([], [], true)
    test([1, [2]], [1, [2]], true)
    test([1, [2]], [1, [3]], false)
    test({}, {}, true)
    test({ a: { b: 1 } }, { a: { b: 1 } }, true)
    test({ a: { b: 1 } }, { a: { b: 2 } }, false)
    test({ a: 1 }, {}, false)
    test({}, { a: 1 }, false)
  })

  it('class instances are compared by identity', () => {
    const date = new Date(1)
    test(date, date, true)
    test(new Date(1), new Date(1), false)
  })

  it('constructor and __proto__ keys', () => {
    test(
      JSON.parse('{"constructor": 1}'),
      JSON.parse('{"constructor": 1}'),
      true,
    )
    test(
      JSON.parse('{"constructor": 1}'),
      JSON.parse('{"constructor": 2}'),
      false,
    )
    test(JSON.parse('{"__proto__": 1}'), JSON.parse('{"__proto__": 1}'), true)
    test(JSON.parse('{"__proto__": 1}'), JSON.parse('{"__proto__": 2}'), false)
    test(JSON.parse('{"__proto__": 1}'), {}, false)
  })

  it('objects without prototype', () => {
    const create = (value: number) =>
      Object.assign(Object.create(null), { a: value })
    test(create(1), create(1), true)
    test(create(1), create(2), false)
    test({ a: 1 }, create(1), true)
  })

  it('__proto__ key of expected stays a key, not the prototype', () => {
    test({}, JSON.parse('{"__proto__": {"polluted": 1}}'), false)
    test({ polluted: 1 }, JSON.parse('{"__proto__": {"polluted": 1}}'), false)
  })

  it('missing __proto__ key of actual is undefined, not its prototype', () => {
    test({}, JSON.parse('{"__proto__": {}}'), false)
    test({}, JSON.parse('{"__proto__": null}'), true)
    test(JSON.parse('{"__proto__": {}}'), JSON.parse('{"__proto__": {}}'), true)
  })
})

describe('matchUuid', () => {
  function test(actual: unknown, result: boolean) {
    expect(match(actual, matchUuid()).result).toBe(result)
  }

  it('base', () => {
    test(null, false)
    test('', false)
    test('00000000-0000-0000-0000-000000000000', true)
    test('0123abcd-4567-89EF-abcd-0123456789ef', true)
    test('0123456789abcdefABCDEF0123456789', true)
  })

  it('the whole string must be a uuid', () => {
    test('00000000-0000-0000-0000-000000000000 ', false)
    test(' 00000000-0000-0000-0000-000000000000', false)
    test('0123456789abcdef0123456789abcdef ', false)
    test(' 0123456789abcdef0123456789abcdef', false)
  })

  it('dashes must separate groups of 8, 4, 4, 4, and 12 hex digits', () => {
    test('-'.repeat(36), false)
    test('0'.repeat(36), false)
    test('0000000-00000-0000-0000-000000000000', false)
    test('0000000g-0000-0000-0000-000000000000', false)
    test('0123456789abcdef0123456789abcdeg', false)
  })
})

enum NumericEnum {
  A,
  B,
}

enum StringEnum {
  A = 'a',
  B = 'b',
}

describe('matchEnum', () => {
  function test(
    enumObject: Record<string, any>,
    actual: unknown,
    result: boolean,
  ) {
    expect(match(actual, matchEnum(enumObject)).result).toBe(result)
  }

  it('base', () => {
    test({}, undefined, false)
    test({ a: 1 }, 1, true)
    test({ a: 1 }, 2, false)
    test({ a: 1 }, 'a', false)
    test(NumericEnum, NumericEnum.A, true)
    test(NumericEnum, NumericEnum.B, true)
    test(NumericEnum, 2, false)
    test(StringEnum, StringEnum.A, true)
    test(StringEnum, 'A', false)
  })

  it('names of numeric enum members do not match', () => {
    test(NumericEnum, 'A', false)
    test(NumericEnum, 'B', false)
  })
})

describe('matchArrayBuffer', () => {
  function test(
    actual: unknown,
    expected: null | { readonly byteLength: number } | string,
    result: boolean,
  ) {
    expect(match(actual, matchArrayBuffer(expected)).result).toBe(result)
  }

  function createBuffer(...bytes: number[]): ArrayBuffer {
    return new Uint8Array(bytes).buffer
  }

  it('base', () => {
    test(null, null, false)
    test({}, null, false)
    test(createBuffer(), null, true)
    test(createBuffer(), createBuffer(), true)
    test(createBuffer(1), createBuffer(), false)
    test(createBuffer(1), createBuffer(1), true)
    test(createBuffer(1, 2), createBuffer(1, 3), false)
  })

  it('views are compared by the bytes of their range', () => {
    const buffer = createBuffer(1, 2, 3, 4)
    test(new Uint8Array([1, 2]), createBuffer(1, 2), true)
    test(createBuffer(1, 2), new Uint8Array([1, 2]), true)
    test(new Uint8Array([1, 2]), new Uint8Array([1, 3]), false)
    test(new Uint8Array(buffer, 1, 2), createBuffer(2, 3), true)
    test(new DataView(buffer, 2), createBuffer(3, 4), true)
    test(new Uint16Array(buffer), buffer, true)
    test(new Uint16Array(buffer), createBuffer(1, 2, 3, 5), false)
  })

  it('a string is compared by its UTF-8 bytes', () => {
    test(createBuffer(0x61, 0x62), 'ab', true)
    test(new Uint8Array([0x61, 0x62]), 'ab', true)
    test(new Uint8Array([0x61, 0x63]), 'ab', false)
    test(new Uint8Array([0xc3, 0xa9]), 'é', true)
  })
})

describe('matchNumber', () => {
  function test(
    actual: unknown,
    args: MatchNumberArgs | null,
    result: boolean,
  ) {
    expect(match(actual, matchNumber(args)).result).toBe(result)
  }

  it('base', () => {
    test(null, null, false)
    test('1', null, false)
    test(1, null, true)
    test(1.5, null, true)
    test(NaN, null, false)
    test(Infinity, null, false)
    test(1, { float: false }, true)
    test(1.5, { float: false }, false)
    test(1.5, { float: true }, true)
    test(0, { min: 0, max: 1 }, true)
    test(-1, { min: 0 }, false)
    test(2, { max: 1 }, false)
  })

  it('allowNaN and allowInfinity', () => {
    test(NaN, {}, false)
    test(NaN, { allowNaN: true }, true)
    test(NaN, { allowInfinity: true }, false)
    test(Infinity, {}, false)
    test(Infinity, { allowInfinity: true }, true)
    test(-Infinity, { allowInfinity: true, min: 0 }, false)
    test(Infinity, { allowNaN: true }, false)
  })

  it('name', () => {
    expect(matchNumber().toString()).toBe('number')
    expect(matchNumber({ min: 1 }).toString()).toBe('number({min: 1})')
  })
})

describe('matchString', () => {
  function test(
    actual: unknown,
    pattern: MatchStringPattern | null,
    result: boolean,
  ) {
    expect(match(actual, matchString(pattern)).result).toBe(result)
  }

  it('base', () => {
    test(null, null, false)
    test(1, null, false)
    test('', null, true)
    test('ab', /b/, true)
    test('ab', /c/, false)
    test('ab', o => o === 'ab', true)
    test('ab', o => o === 'a', false)
  })

  it('flags g and y do not change the result of the next call', () => {
    const patternGlobal = /a/g
    const matcherGlobal = matchString(patternGlobal)
    expect(match('a', matcherGlobal).result).toBe(true)
    expect(match('a', matcherGlobal).result).toBe(true)
    expect(patternGlobal.lastIndex).toBe(0)
    const matcherSticky = matchString(/a/y)
    expect(match('ab', matcherSticky).result).toBe(true)
    expect(match('ab', matcherSticky).result).toBe(true)
    expect(match('ba', matcherSticky).result).toBe(false)
  })
})

describe('matchArray', () => {
  function test(actual: unknown, expected: unknown[] | null, result: boolean) {
    expect(match(actual, matchArray(expected)).result).toBe(result)
  }

  it('base', () => {
    test(null, null, false)
    test({}, null, false)
    test([], null, true)
    test([], [], true)
    test([1], [], false)
    test([1], [1], true)
    test([1, 2], [1, 3], false)
  })

  it('errors', () => {
    const matcher = new MatcherArray<number[]>({
      expected: [1],
      matchType: 'other' as any,
    })
    expect(match([1], matcher).error?.message).toMatch(
      /Unknown matchType "other"/,
    )
  })
})

describe('matchRef', () => {
  it('base', () => {
    const ref = matchRef<unknown>()
    ref.expected = 1
    expect(match(1, ref).result).toBe(true)
    expect(match(2, ref).result).toBe(false)
    ref.expected = undefined
    expect(match(undefined, ref).result).toBe(true)
  })

  it('errors', () => {
    expect(match(undefined, matchRef()).error?.message).toMatch(
      /expected is not set/,
    )
  })
})
