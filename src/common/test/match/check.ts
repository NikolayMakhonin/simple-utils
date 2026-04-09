import type { Expected } from './types'
import { match } from './match'
import { filterMatchResult, matchResultToString } from './report'
import { isPromiseLike, type PromiseOrValue } from '@flemist/async-utils'

export class CheckError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export function check<T>(actual: T) {
  return function _check(
    expected: Expected<T>,
    onError?: (error: Error) => void,
  ) {
    const matchResult = match(actual, expected)
    if (matchResult.error) {
      throw matchResult.error
    }
    const matchResultFiltered = filterMatchResult(matchResult, false)
    if (!matchResultFiltered) {
      return
    }
    // TODO: implement error message builder
    const log = matchResultToString(matchResultFiltered, '')
    console.log('[test][check] CheckError:\n' + log)
    const error = new CheckError(log)
    onError?.(error)
    throw error
  }
}

export function checkFunc<T>(
  func: () => Promise<T>,
): (expectedValue: Expected<T>, expectedError?: Expected<any>) => Promise<T>
export function checkFunc<T>(
  func: () => T,
): (expectedValue: Expected<T>, expectedError?: Expected<any>) => T
export function checkFunc<T>(
  func: () => PromiseOrValue<T>,
): (
  expectedValue: Expected<T>,
  expectedError?: Expected<any>,
) => PromiseOrValue<T>
export function checkFunc<T>(func: () => PromiseOrValue<T>) {
  return function _check(
    expectedValue: Expected<T>,
    expectedError?: Expected<any>,
  ): PromiseOrValue<T> {
    let actual: PromiseOrValue<T>
    try {
      actual = func()
    } catch (error) {
      check(error)(expectedError)
      return void 0! as T
    }
    if (!isPromiseLike(actual)) {
      check(actual)(expectedValue)
      return actual
    }
    return actual
      .then<T>(actualValue => {
        check(actualValue)(expectedValue)
        return actualValue
      })
      .catch<T>(actualError => {
        if (actualError instanceof CheckError) {
          throw actualError
        }
        try {
          check(actualError)(expectedError)
        } catch (error) {
          console.error('[test][check] error', error)
          throw actualError
        }
        return void 0! as T
      })
  }
}
