// noinspection EqualityComparisonWithCoercionJS

import { MatchResult3 } from '../types'
import { Matcher, MatcherArgs } from '../Matcher'
import { expectedToString } from '../helpers'

export type MatchIsArgs<T> = MatcherArgs<T> & {
  expected: T
  nonStrict?: boolean | null
}

export class MatcherIs<T> extends Matcher<T, MatchIsArgs<T>> {
  match(actual: T): MatchResult3 {
    const { expected, nonStrict } = this._args

    return nonStrict ? actual == expected : actual === expected
  }

  nameDefault(): string {
    return `is(${expectedToString(this._args.expected)})`
  }
}
