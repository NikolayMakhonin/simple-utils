import type { Expected, MatchResult3, MatchResultNested } from '../types'
import { match } from '../match'
import { Matcher, type MatcherArgs } from '../Matcher'
import { MAX_REPORT_ITEMS_DEFAULT } from './constants'

export type MatchArrayItemArgs<T> = MatcherArgs<T[]> & {
  expected: Expected<T>
  maxReportItems?: number
}

export class MatcherArrayItem<T> extends Matcher<T[], MatchArrayItemArgs<T>> {
  match(actual: T[]): MatchResult3 {
    if (typeof actual !== 'object') {
      return `Expected array, got "${typeof actual}"`
    }
    if (!(actual instanceof Array)) {
      return `Expected array`
    }
    const expected = this._args.expected
    let result: boolean = true
    const nested: MatchResultNested[] = []
    const maxReportItems =
      this._args?.maxReportItems ?? MAX_REPORT_ITEMS_DEFAULT
    let resultTrueCount = 0
    let resultFalseCount = 0
    for (let i = 0; i < actual.length; i++) {
      const actualValue = actual[i]
      const matchResult = match(actualValue, expected)
      if (matchResult.result) {
        if (resultTrueCount < maxReportItems) {
          nested.push({
            actualKey: i,
            expectedKey: i,
            result: matchResult,
          })
        }
        resultTrueCount++
      } else {
        if (resultFalseCount < maxReportItems) {
          nested.push({
            actualKey: i,
            expectedKey: i,
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
    return 'array item'
  }
}
