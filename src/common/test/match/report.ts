import type { MatchResult, MatchResultNested } from './types'
import { MatcherNot } from './matchers/MatcherNot'
import { expectedToString, isMatcher } from './helpers'

export function filterMatchResultNested(
  matchResultNested: MatchResultNested,
  inverseResult: boolean,
): MatchResultNested | null {
  const result = filterMatchResult(matchResultNested.result, inverseResult)
  if (!result) {
    return null
  }
  return {
    actualKey: matchResultNested.actualKey,
    expectedKey: matchResultNested.expectedKey,
    result,
  }
}

export function filterMatchResult(
  matchResult: MatchResult<any>,
  inverseResult: boolean,
): MatchResult<any> | null {
  if (inverseResult ? !matchResult.result : matchResult.result) {
    return null
  }

  if (matchResult.expected instanceof MatcherNot) {
    inverseResult = !inverseResult
  }

  let nested: MatchResultNested[] | null = null
  if (matchResult.nested) {
    matchResult.nested.forEach(o => {
      const nestedItem = filterMatchResultNested(o, inverseResult)
      if (nestedItem) {
        if (!nested) {
          nested = []
        }
        nested.push(nestedItem)
      }
    })
  }

  return {
    actual: matchResult.actual,
    expected: matchResult.expected,
    result: matchResult.result,
    cause: matchResult.cause,
    nested,
    error: matchResult.error,
  }
}

export function matchResultNestedToString(
  matchResultNested: MatchResultNested,
  indent: string,
): string {
  const result = matchResultToString(matchResultNested.result, indent + '  ')
  return `${indent}${
    matchResultNested.actualKey == null
      ? '| '
      : matchResultNested.actualKey + ': '
  }${result}`
}

export function matchResultToString(
  matchResult: MatchResult<any>,
  indent: string,
  // keyNull: boolean = false,
) {
  if (matchResult.result) {
    return matchResult.expected.toString()
  }

  let nested = ''
  if (matchResult.nested) {
    // const _keyNull =
    //   matchResult.nested.length === 1 && matchResult.nested[0].actualKey == null
    // if (_keyNull) {
    //   nested = matchResultToString(matchResult.nested[0].result, indent, true)
    // } else {
    nested = matchResult.nested
      .map(o => matchResultNestedToString(o, indent))
      .join('\n')
    // }
  }

  let cause = matchResult.cause || ''
  if (nested) {
    if (!cause) {
      cause = isMatcher(matchResult.expected)
        ? matchResult.expected.toString(matchResult.actual)
        : ''
    }
    return `${cause}\n${nested}`
  }

  return `${cause}\n${indent}expected: ${
    isMatcher(matchResult.expected)
      ? matchResult.expected.toString(matchResult.actual)
      : matchResult.expected
  }\n${indent}actual: ${expectedToString(matchResult.actual)}`

  // return cause
}
