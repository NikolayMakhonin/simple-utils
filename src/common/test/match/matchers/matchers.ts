import { MatchArray, MatcherArray } from './MatcherArray'
import { MatcherAny } from './MatcherAny'
import { Expected, MatchResult3 } from '../types'
import { MatcherArrayItem } from './MatcherArrayItem'
import { MatcherConvert } from './MatcherConvert'
import { MatcherIs } from './MatcherIs'
import {
  MatcherNumber,
  MatchNumberArgs,
  MatchNumberArgsRange,
} from './MatcherNumber'
import { MatcherObject, MatchObject } from './MatcherObject'
import { MatcherString, MatchStringPattern } from './MatcherString'
import { MatcherInstanceOf } from './MatchInstanceOf'
import { MatcherIn } from './MatcherIn'
import { MatcherFew } from './MatcherFew'
import { MatcherCustom } from './MatcherCustom'
import { isMatcher } from '../helpers'
import { MatcherNot } from './MatcherNot'
import { Matcher, MatcherArgsName } from '../Matcher'
import { MatcherNever } from './MatcherNever'
import { type NumberRangeOptional } from 'src/common/types/common'
import { ValueState } from '@flemist/async-utils'
import { MatcherObjectEntry } from './MatcherObjectEntry'
import { MatcherRef } from './MatcherRef'

export function matchArray<T extends any[]>(expected?: MatchArray<T> | null) {
  return new MatcherArray<T>({ expected })
}

export function matchArrayIncludes<T extends any[]>(expected: MatchArray<T>) {
  return new MatcherArray<T>({ expected, matchType: 'includes' })
}

export function matchAny() {
  return new MatcherAny()
}

export function matchRef<T>() {
  return new MatcherRef<T>()
}

export function matchNever(name?: MatcherArgsName<any> | null) {
  return new MatcherNever({ name })
}

/** Check array length and then check each item with expected */
export function matchArrayItem<T>(
  expectedLength: Expected<number> | MatchIntArgs | null | undefined,
  expected: Expected<T>,
): Matcher<T[]> {
  const matcherItem = new MatcherArrayItem<T>({ expected })
  if (expectedLength == null) {
    return matcherItem
  }
  return matchAndPipe(
    matchArrayLength(
      isMatcher(expectedLength) || typeof expectedLength === 'number'
        ? expectedLength
        : matchInt(expectedLength),
    ),
    matcherItem,
  ).name(`array item`)
}

export function matchConvert<T, U>(
  name: MatcherArgsName<T>,
  convert: (actual: T) => U,
  expected: Expected<U>,
) {
  return new MatcherConvert<T, U>({ name, convert, expected })
}

export function matchIsNonStrict<T>(expected: T) {
  return new MatcherIs<T>({ expected, nonStrict: true })
}

export function matchIs<T>(expected: T) {
  return new MatcherIs<T>({ expected, nonStrict: false })
}

export function matchNumber(args?: MatchNumberArgs | null) {
  return new MatcherNumber(args)
}

export type MatchIntArgs = MatchNumberArgsRange

export function matchInt(args?: MatchIntArgs | null) {
  return matchNumber({
    ...args,
    float: false,
  })
}

export type MatchFloatArgs = MatchNumberArgsRange

export function matchFloat(args?: MatchFloatArgs | null) {
  return matchNumber({
    ...args,
    float: true,
  })
}

export function matchObject<T>(expected?: MatchObject<T> | null) {
  return new MatcherObject<T>({ expected })
}

export function matchDeep<T>(
  expected?: Expected<T> | null,
  toExpected?: <T>(value: T, key: string | number | null) => Expected<T> | null,
  key: string | number | null = null,
) {
  if (expected instanceof Matcher) {
    return expected
  }
  if (toExpected) {
    expected = toExpected(expected, key)
    if (expected instanceof Matcher) {
      return expected
    }
  }
  if (expected == null) {
    return matchNullish()
  }
  if (Array.isArray(expected)) {
    const newExpected = expected.map((o, i) => matchDeep(o, toExpected, i))
    return matchArray(newExpected)
  }
  if (expected.constructor === Object) {
    const newExpected: any = {}
    for (const key in expected) {
      if (Object.prototype.hasOwnProperty.call(expected, key)) {
        newExpected[key] = matchDeep(expected[key], toExpected, key)
      }
    }
    return matchObject(newExpected)
  }
  if (expected instanceof ValueState) {
    return matchValueState({
      ...expected,
      value: matchDeep(expected.value, toExpected, 'value'),
    })
  }
  return matchIs(expected)
}

export function matchObjectPartial<T>(
  expected?: MatchObject<Partial<T>> | null,
) {
  return matchObject<T>(expected as any).set({
    ignoreExtraKeys: true,
  })
}

export function matchString(
  pattern?: MatchStringPattern | null,
): MatcherString {
  return new MatcherString({
    pattern,
  })
}

export function matchInstanceOf<T>(expected: { new (...args: any[]): T }) {
  return new MatcherInstanceOf<T>({ expected })
}

export function matchTypeOf(expected: Expected<string>) {
  return matchConvert(
    'typeof',
    (actual: any) => (actual === null ? 'null' : typeof actual),
    expected,
  )
}

export function matchConstructor<T>(expected: { new (...args: any[]): T }) {
  return matchConvert(
    'constructor',
    (actual: T) => actual!.constructor,
    expected,
  )
}

export function matchBoolean() {
  return matchTypeOf('boolean')
}

export function matchNullish() {
  return matchIsNonStrict<any>(null)
}

export function matchNotNullish() {
  return matchNot(matchNullish())
}

export function matchOr<T>(...expecteds: Array<Expected<T>>) {
  return new MatcherFew({
    expecteds,
    type: 'or',
    pipe: false,
  })
}

export function matchAnd<T>(...expecteds: Array<Expected<T>>) {
  return new MatcherFew({
    expecteds,
    type: 'and',
    pipe: false,
  })
}

export function matchOrPipe<T>(...expecteds: Array<Expected<T>>) {
  return new MatcherFew({
    expecteds,
    type: 'or',
    pipe: true,
  })
}

export function matchAndPipe<T>(...expecteds: Array<Expected<T>>) {
  return new MatcherFew({
    expecteds,
    type: 'and',
    pipe: true,
  })
}

export function matchOptional<T>(
  expected: Expected<T>,
  required?: null | boolean,
): Expected<T> {
  return required == null
    ? matchOrPipe<T | undefined | null>(matchNullish(), expected as any)
    : required
      ? expected
      : matchNullish()
}

export function matchArrayLength(
  args?: MatchIntArgs | Expected<number> | null | undefined,
) {
  const expected =
    typeof args === 'number' || isMatcher(args)
      ? args
      : matchInt((args as any) ?? { min: 1 })
  return matchAndPipe(
    matchArray(),
    matchConvert<any[], number>('length', o => o.length, expected),
  ).name('array length')
}

export function matchStringLength(
  args?: MatchIntArgs | Expected<number> | null | undefined,
) {
  const expected =
    typeof args === 'number' || isMatcher(args)
      ? args
      : matchInt((args as any) ?? { min: 1 })
  return matchAndPipe(
    matchString(),
    matchConvert<string, number>('length', o => o.length, expected),
  ).name('string length')
}

export function matchObjectWith<T>(matcher: Matcher<T>) {
  return matchAndPipe(matchObject<T>(), matcher)
}

/** Check if it is an array and then check with matcher */
export function matchArrayWith<T extends any[]>(matcher: Matcher<T[]>) {
  return matchAndPipe(matchArray<T>(), matcher)
}

export function matchObjectKeys<T extends object>(
  expected: Expected<Array<keyof T>>,
) {
  return matchAndPipe<T>(
    matchObject(),
    matchConvert<T, Array<keyof T>>(
      'keys',
      o => Object.keys(o) as any,
      expected,
    ),
  )
}

export function matchObjectValues<T extends object>(
  expected: Expected<Array<T[keyof T]>>,
) {
  return matchAndPipe<T>(
    matchObject(),
    matchConvert<T, Array<T[keyof T]>>(
      'values',
      o => Object.values(o) as any,
      expected,
    ),
  )
}

export function matchObjectEntries<T extends object>(
  expected: Expected<Array<[keyof T, T[keyof T]]>>,
) {
  return matchAndPipe<T>(
    matchObject(),
    matchConvert<T, Array<[keyof T, T[keyof T]]>>(
      'entries',
      o => Object.entries(o) as any,
      expected,
    ),
  )
}

export function matchObjectEntry<T extends object>(
  expected: Expected<[keyof T, T[keyof T]]>,
) {
  return new MatcherObjectEntry<T>({ expected })
}

export function matchObjectKey<T extends object>(expected: Expected<keyof T>) {
  return matchObjectEntry<T>(matchArray([expected, matchAny()]))
}

export function matchObjectValue<T extends object>(
  expected: Expected<T[keyof T]>,
) {
  return matchObjectEntry<T>(matchArray([matchAny(), expected]))
}

export function matchObjectKeyValue<T extends object>(
  expectedKey: Expected<keyof T>,
  expectedValue: Expected<T[keyof T]>,
) {
  return matchObjectEntry<T>(matchArray([expectedKey, expectedValue]))
}

export function matchObjectKeysNotNull<T extends object>(
  expected: Expected<Array<keyof T>>,
) {
  return matchAndPipe<T>(
    matchObject(),
    matchConvert<T, Array<keyof T>>(
      'keys not null',
      o => Object.keys(o).filter(key => o[key] != null) as any,
      expected,
    ),
  )
}

export function matchIn<T>(expected: Set<T> | Iterable<T>) {
  return new MatcherIn<T>({ expected })
}

export function matchEnum<T>(enumObject: { [key: string]: T }) {
  return matchIn(Object.values(enumObject))
}

export function matchCustom<T>(
  name: MatcherArgsName<T>,
  matcher: Matcher<T> | ((actual: T) => MatchResult3),
): MatcherCustom<T> {
  return new MatcherCustom({ matcher, name })
}

export type MatchRangeValueOptions = {
  min?: number | null
  max?: number | null
  optional?: boolean | null
  float?: boolean | null
}

export type MatchRangeOptions = {
  common?: null | MatchRangeValueOptions
  from?: null | MatchRangeValueOptions
  to?: null | MatchRangeValueOptions
}

const DATE_MIN = Math.ceil(Date.now() - 10 * 365.25 * 24 * 60 * 60 * 1000)
const DATE_MAX = Math.ceil(Date.now() + 10 * 365.25 * 24 * 60 * 60 * 1000)
export function matchIntDate(options?: MatchIntArgs): Matcher<number> {
  return matchInt({
    ...options,
    min: options?.min ?? DATE_MIN,
    max: options?.max ?? DATE_MAX,
  }).name('int date')
}

export function matchRange(options?: MatchRangeOptions | null) {
  const fromOptions = {
    min: options?.from?.min ?? options?.common?.min,
    max: options?.from?.max ?? options?.common?.max,
    float: options?.from?.float ?? options?.common?.float,
    optional: options?.from?.optional ?? options?.common?.optional,
  }
  const toOptions = {
    min: options?.to?.min ?? options?.common?.min,
    max: options?.to?.max ?? options?.common?.max,
    float: options?.to?.float ?? options?.common?.float,
    optional: options?.to?.optional ?? options?.common?.optional,
  }
  return matchAndPipe(
    matchArray([
      fromOptions.optional ? matchOptional(matchIntDate()) : matchIntDate(),
      toOptions.optional ? matchOptional(matchIntDate()) : matchIntDate(),
    ]),
    matchCustom('min <= max', (actual: NumberRangeOptional) => {
      if (actual[0] != null && actual[1] != null && actual[0] > actual[1]) {
        return `Expected range to be [min, max], got [${actual.join(', ')}]`
      }
      return true
    }),
  ).name('range')
}

export function matchRangeDate(args?: MatchRangeOptions | null) {
  return matchRange({
    ...args,
    common: {
      min: new Date(2020, 0, 1).getTime(),
      max: Date.now() + 15 * 60 * 1000,
      ...args?.common,
    },
  }).name('range date')
}

export function matchNot<T>(expected: Expected<T>) {
  return new MatcherNot({ expected })
}

export function matchUuid(): Matcher<string> {
  return matchString(/^[\da-f-]{36}|[\da-f]{32}$/i).name('uuid')
}

export function matchValueState<T>(args: MatchObject<Partial<ValueState<T>>>) {
  return matchObject<ValueState<T>>({
    [Symbol.toStringTag]: matchOptional(matchAny()),
    loading: matchOptional(matchBoolean()),
    hasValue: matchOptional(matchBoolean()),
    value: matchAny(),
    hasError: matchOptional(matchBoolean()),
    error: matchAny(),
    ...args,
  })
}

export function matchArrayBuffer<
  T extends {
    readonly byteLength: number
  },
>(
  expected?:
    | {
        readonly byteLength: number
      }
    | string
    | null,
): Matcher<T> {
  if (expected != null && typeof expected === 'string') {
    expected = new TextEncoder().encode(expected).buffer
  }
  return matchCustom('array buffer', (actual: T) => {
    if (
      actual == null ||
      typeof actual !== 'object' ||
      typeof actual.byteLength !== 'number'
    ) {
      return `Expected array buffer, got "${actual}"`
    }
    if (expected == null) {
      return true
    }
    if (actual.byteLength !== expected.byteLength) {
      return `Expected array buffer length to be ${expected.byteLength}, got ${actual.byteLength}`
    }
    for (let i = 0, len = expected.byteLength; i < len; i++) {
      if (actual[i] !== expected[i]) {
        return `Expected array buffer[${i}] to be ${expected[i]}, got ${actual[i]}`
      }
    }
    return true
  })
}

// Это похоже на письменные размышления о структуре интерфейса:
// matchAndPipe(name)(
//   expected1,
//   expected2,
// )
//
// matchAndPipe()(
//   expected1,
//   expected2,
// )
//
// matchAndPipe({
//   expecteds: [
//     expected1,
//     expected2,
//   ],
// })()
//
// matchAndPipe.set({
//   expecteds: [
//     expected1,
//     expected2,
//   ],
// })()
//
// matchAndPipe(
//   expected1,
//   expected2,
// ).set({
//   name: 'name',
// })
//
// matchAndPipe(
//   expected1,
//   expected2,
// ).name(o => `name(${o})`)
//
// matchAndPipe(
//   expected1,
//   expected2,
// ).name('name')
