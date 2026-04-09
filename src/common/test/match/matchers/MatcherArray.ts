import type { Expected, MatchResult3, MatchResultNested } from '../types'
import { match } from '../match'
import { Matcher, type MatcherArgs } from '../Matcher'
import { expectedToString } from '../helpers'
import { MAX_REPORT_ITEMS_DEFAULT } from './constants'

export type MatchArray<T extends any[]> = Array<Expected<T[number]>>
export type MatcherArrayArgs<T extends any[]> = MatcherArgs<T> & {
  expected?: MatchArray<T> | null
  matchType?: 'equals' | 'includes'
  maxReportItems?: number
}

export class MatcherArray<T extends any[]> extends Matcher<
  T,
  MatcherArrayArgs<T> | null | undefined
> {
  match(actual: T): MatchResult3 {
    if (actual == null) {
      return `Expected array, got "${actual}"`
    }
    if (typeof actual !== 'object') {
      return `Expected array, got "${typeof actual}"`
    }
    if (!(actual instanceof Array)) {
      return `Expected array`
    }
    const expected = this._args?.expected
    if (expected == null) {
      return true
    }
    const maxReportItems =
      this._args?.maxReportItems ?? MAX_REPORT_ITEMS_DEFAULT
    const matchType = this._args?.matchType || 'equals'
    if (matchType === 'equals') {
      if (actual.length !== expected.length) {
        return `Expected array length to be ${expected.length}, got ${actual.length}`
      }
      let result: boolean = true
      let resultTrueCount = 0
      let resultFalseCount = 0
      const nested: MatchResultNested[] = []
      for (let i = 0; i < expected.length; i++) {
        const actualValue = actual[i]
        const expectedValue = expected[i] as any
        const matchResult = match(actualValue, expectedValue)
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

    if (matchType === 'includes') {
      let result: boolean = true
      const nested: MatchResultNested[] = []
      let resultTrueCount = 0
      let resultFalseCount = 0
      for (let i = 0; i < expected.length; i++) {
        const expectedValue = expected[i] as any
        let found = false
        for (let j = 0; j < actual.length; j++) {
          const actualValue = actual[j]
          const matchResult = match(actualValue, expectedValue)
          if (matchResult.result) {
            found = true
            if (resultTrueCount < maxReportItems) {
              nested.push({
                actualKey: j,
                expectedKey: i,
                result: matchResult,
              })
            }
            resultTrueCount++
            break
          }
        }
        if (!found) {
          result = false
          if (resultFalseCount < maxReportItems) {
            nested.push({
              expectedKey: i,
              result: {
                result: false,
                actual: void 0,
                expected: expectedValue,
              },
            })
          }
          resultFalseCount++
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

    return `Unknown matchType "${matchType}"`
  }

  nameDefault(): string {
    const matchType = this._args?.matchType || 'equals'
    return `array ${matchType} ${expectedToString(this._args?.expected)}`
  }
}
