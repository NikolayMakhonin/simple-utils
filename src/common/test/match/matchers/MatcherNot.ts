import { Expected, MatchResult3 } from '../types'
import { match } from '../match'
import { Matcher, MatcherArgs } from '../Matcher'

export type MatchNotArgs<T> = MatcherArgs<T> & {
  expected: Expected<T>
}

export class MatcherNot<T> extends Matcher<T, MatchNotArgs<T>> {
  match(actual: T): MatchResult3 {
    const expected = this._args.expected
    const nested = match(actual, expected)
    return {
      result: !nested.result,
      nested: [
        {
          actualKey: null,
          result: nested,
        },
      ],
    }
  }

  nameDefault() {
    return 'not'
  }
}
