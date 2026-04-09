import { MatchResult3 } from '../types'
import { Matcher } from '../Matcher'

export class MatcherNever extends Matcher<any> {
  match(): MatchResult3 {
    return false
  }

  nameDefault(): string {
    return 'never'
  }
}
