import { Expected, MatchResult3, MatchResultNested } from '../types'
import { createMatchResult, match } from '../match'
import { argsToString } from '../helpers'
import { Matcher, MatcherArgs } from '../Matcher'
import { MAX_REPORT_ITEMS_DEFAULT } from './constants'

export type MatchObject<T> = {
  [K in keyof T]: Expected<T[K]>
}
export type MatcherObjectArgs<T> = MatcherArgs<T> & {
  expected?: MatchObject<T> | null
  ignoreExtraKeys?: boolean
  maxReportItems?: number
}

export class MatcherObject<T> extends Matcher<
  T,
  MatcherObjectArgs<T> | undefined | null
> {
  match(actual: T): MatchResult3 {
    if (actual == null) {
      return `Expected object, got "${actual}"`
    }
    if (Array.isArray(actual)) {
      return 'Expected object, got array'
    }
    if (typeof actual !== 'object') {
      return `Expected object, got "${typeof actual}"`
    }
    const expected = this._args?.expected
    if (expected == null) {
      return true
    }
    let result: boolean = true
    const nested: MatchResultNested[] = []
    const maxReportItems =
      this._args?.maxReportItems ?? MAX_REPORT_ITEMS_DEFAULT
    let resultTrueCount = 0
    let resultFalseCount = 0
    for (const key in expected) {
      if (!Object.prototype.hasOwnProperty.call(expected, key)) {
        continue
      }
      const actualValue = actual[key]
      const expectedValue = expected[key]
      const matchResult = match(actualValue, expectedValue)
      if (matchResult.result) {
        if (resultTrueCount < maxReportItems) {
          nested.push({
            actualKey: key,
            expectedKey: key,
            result: matchResult,
          })
        }
        resultTrueCount++
      } else {
        if (resultFalseCount < maxReportItems) {
          nested.push({
            actualKey: key,
            expectedKey: key,
            result: matchResult,
          })
        }
        resultFalseCount++
        result = false
      }

      if (
        !result &&
        resultTrueCount >= maxReportItems &&
        resultFalseCount >= maxReportItems
      ) {
        break
      }
    }
    if (!this._args?.ignoreExtraKeys) {
      for (const key in actual) {
        if (
          !Object.prototype.hasOwnProperty.call(actual, key) ||
          Object.prototype.hasOwnProperty.call(expected, key)
        ) {
          continue
        }
        const actualValue = actual[key]
        if (resultFalseCount < maxReportItems) {
          nested.push({
            actualKey: key,
            expectedKey: key,
            result: createMatchResult(actualValue, void 0, 'Unexpected key'),
          })
        }
        resultFalseCount++
        result = false

        if (resultFalseCount >= maxReportItems) {
          break
        }
      }
    }
    return {
      result,
      nested,
    }
  }

  nameDefault(): string {
    return 'object' + argsToString(this._args)
  }
}
