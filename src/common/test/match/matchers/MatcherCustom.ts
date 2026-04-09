import { MatchResult3 } from '../types'
import { Matcher, MatcherArgs } from '../Matcher'
import { isMatcher } from '../helpers'

export type MatchCustomArgs<T> = MatcherArgs<T> & {
  matcher: Matcher<T> | ((actual: T) => MatchResult3)
}

export class MatcherCustom<T> extends Matcher<T, MatchCustomArgs<T>> {
  match(actual: T): MatchResult3 {
    const matcher = this._args.matcher
    if (isMatcher(matcher)) {
      return matcher.match(actual)
    }
    return matcher(actual)
  }

  nameDefault(actual?: T): string {
    const name = this._args.name
    if (typeof name === 'string') {
      return name
    }
    return name ? name(actual) : `custom`
  }
}
