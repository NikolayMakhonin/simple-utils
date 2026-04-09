import {
  type Expected,
  MatchInternalError,
  type MatchResult,
  type MatchResult3,
} from './types'
import { isMatcher } from './helpers'

export function validateMatchResult<T>(
  _result: MatchResult<T>,
): MatchResult<T> {
  const { result, cause, nested, error } = _result

  if (error) {
    if (!(error instanceof Error)) {
      throw new MatchInternalError(
        `[test][validateMatchResult] error must be an instance of Error, but it is: ${error}`,
      )
    }
    if (result != null) {
      throw new MatchInternalError(
        `[test][validateMatchResult] result must be null if error is set, but it is: ${result}`,
      )
    }
    if (cause != null) {
      throw new MatchInternalError(
        `[test][validateMatchResult] cause must be null if error is set, but it is: ${cause}`,
      )
    }
    if (nested != null) {
      throw new MatchInternalError(
        `[test][validateMatchResult] nested must be null if error is set, but it is: ${nested}`,
      )
    }
    return _result
  }

  if (typeof result !== 'boolean') {
    throw new MatchInternalError(
      `[test][validateMatchResult] result must be a boolean, but it is: ${result}`,
    )
  }
  if (typeof cause !== 'string' && cause != null) {
    throw new MatchInternalError(
      `[test][validateMatchResult] cause must be a string or null, but it is: ${cause}`,
    )
  }
  if (nested != null && !(nested instanceof Array)) {
    throw new MatchInternalError(
      `[test][validateMatchResult] nested must be an array or null, but it is: ${nested}`,
    )
  }

  return _result
}

export function createMatchResultError<T>(
  actual: T,
  expected: Expected<T>,
  error: Error,
): MatchResult<T> {
  return validateMatchResult({
    actual,
    expected,
    result: null as any,
    cause: null,
    nested: null,
    error,
  })
}

export function createMatchResultBoolean<T>(
  actual: T,
  expected: Expected<T>,
  result: boolean,
): MatchResult<T> {
  return validateMatchResult({
    actual,
    expected,
    result,
    cause: null,
    nested: null,
    error: null,
  })
}

export function createMatchResult<T>(
  actual: T,
  expected: Expected<T>,
  result: MatchResult3,
): MatchResult<T> {
  if (typeof result === 'boolean') {
    return createMatchResultBoolean(actual, expected, result)
  }
  if (typeof result === 'string') {
    return validateMatchResult({
      actual,
      expected,
      result: false,
      cause: result,
      nested: null,
      error: null,
    })
  }
  return validateMatchResult({
    actual,
    expected,
    result: result.result,
    cause: result.cause ?? null,
    nested: result.nested ?? null,
    error: null,
  })
}

export function match<T>(actual: T, expected: Expected<T>): MatchResult<T> {
  try {
    if (isMatcher(expected)) {
      const result = expected.match(actual)
      return createMatchResult(actual, expected, result)
    }
    return createMatchResultBoolean(actual, expected, actual === expected)
  } catch (error: any) {
    return createMatchResultError(actual, expected, error)
  }
}
