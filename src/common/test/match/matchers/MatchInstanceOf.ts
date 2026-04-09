import { MatchResult3 } from '../types'
import { Matcher, MatcherArgs } from '../Matcher'

export type MatchInstanceOfArgs<T> = MatcherArgs<T> & {
  expected: { new (...args: any[]): T }
}

export class MatcherInstanceOf<T> extends Matcher<T, MatchInstanceOfArgs<T>> {
  match(actual: T): MatchResult3 {
    const expected = this._args.expected
    if (!(actual instanceof expected)) {
      return `Expected instance of "${expected}", got "${actual}"`
    }
    return true
  }

  nameDefault(): string {
    return `instanceOf(${this._args.expected.name})`
  }
}
