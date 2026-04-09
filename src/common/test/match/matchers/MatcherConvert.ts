import type { Expected, MatchResult3, MatchResultNested } from '../types'
import { match } from '../match'
import { Matcher, type MatcherArgs } from '../Matcher'

export type MatchConvertArgs<T, U> = MatcherArgs<T> & {
  convert: (actual: T) => U
  expected: Expected<U>
}

export class MatcherConvert<T, U> extends Matcher<T, MatchConvertArgs<T, U>> {
  match(actual: T): MatchResult3 {
    const { expected, convert } = this._args
    const matchResult = match(convert(actual), expected)
    const nested: MatchResultNested[] = [
      {
        result: matchResult,
      },
    ]
    return {
      result: matchResult.result,
      nested,
    }
  }

  nameDefault(): string {
    return 'convert'
  }
}
