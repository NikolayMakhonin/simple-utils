import type { MatchResult3 } from '../types'
import { Matcher } from '../Matcher'

export class MatcherAny extends Matcher<any> {
  match(): MatchResult3 {
    return true
  }

  nameDefault(): string {
    return 'any'
  }
}
