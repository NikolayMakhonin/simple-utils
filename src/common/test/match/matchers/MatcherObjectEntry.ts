import type { Expected, MatchResult3, MatchResultNested } from '../types'
import { match } from '../match'
import { argsToString } from '../helpers'
import { Matcher, type MatcherArgs } from '../Matcher'
import { MAX_REPORT_ITEMS_DEFAULT } from './constants'

export type MatchObjectEntry<T> = Expected<[keyof T, T[keyof T]]>

export type MatcherObjectEntryArgs<T> = MatcherArgs<T> & {
  expected?: MatchObjectEntry<T> | null
  maxReportItems?: number
}

export class MatcherObjectEntry<T> extends Matcher<
  T,
  MatcherObjectEntryArgs<T> | undefined | null
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
    for (const key in actual) {
      if (!Object.prototype.hasOwnProperty.call(actual, key)) {
        continue
      }
      const actualValue = [key, actual[key]] as [keyof T, T[keyof T]]
      const matchResult = match(actualValue, expected)
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
    return {
      result,
      nested,
    }
  }

  nameDefault(): string {
    return 'object entries' + argsToString(this._args)
  }
}
