import type { Expected, MatchResult3, MatchResultNested } from '../types'
import { match } from '../match'
import { Matcher, type MatcherArgs } from '../Matcher'

export type MatchFewArgs<T> = MatcherArgs<T> & {
  type: 'or' | 'and'
  expecteds: Array<Expected<T>>
  /** If true, then it will not check remains unnecessary expecteds.
   * So there will be less information in logs especially if you use 'Not' operator */
  pipe?: boolean | null
}

export class MatcherFew<T> extends Matcher<T, MatchFewArgs<T>> {
  match(actual: T): MatchResult3 {
    const { type, expecteds, pipe } = this._args
    let result: boolean = type === 'and'
    const nested: MatchResultNested[] = []
    for (let i = 0; i < expecteds.length; i++) {
      const expected = expecteds[i]
      const matchResult = match(actual, expected)
      nested.push({
        actualKey: `<${type} ${i}>`,
        expectedKey: `<${type} ${i}>`,
        result: matchResult,
      })
      if (type === 'or') {
        if (matchResult.result) {
          result = true
          if (pipe) {
            break
          }
        }
      } else if (type === 'and') {
        if (!matchResult.result) {
          result = false
          if (pipe) {
            break
          }
        }
      } else {
        throw new Error(`[test][MatcherFew] Unknown type "${type}"`)
      }
    }

    return {
      result: expecteds.length === 0 || result,
      nested,
    }
  }

  nameDefault(): string {
    return this._args.type
  }
}
