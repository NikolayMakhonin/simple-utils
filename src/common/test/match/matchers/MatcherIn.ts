import { MatchResult3 } from '../types'
import { Matcher, MatcherArgs } from '../Matcher'
import { expectedToString } from '../helpers'

export type MatchInArgs<T> = MatcherArgs<T> & {
  expected: Set<T>
}

export class MatcherIn<T> extends Matcher<T, MatchInArgs<T>> {
  constructor(
    args: Omit<MatchInArgs<T>, 'expected'> & {
      expected: Set<T> | Iterable<T>
    },
  ) {
    super({
      ...args,
      expected:
        args.expected instanceof Set ? args.expected : new Set(args.expected),
    })
  }
  match(actual: T): MatchResult3 {
    const expected = this._args.expected
    if (!expected.has(actual)) {
      return false
    }
    return true
  }

  nameDefault(): string {
    return `in(${expectedToString(this._args.expected)})`
  }
}
