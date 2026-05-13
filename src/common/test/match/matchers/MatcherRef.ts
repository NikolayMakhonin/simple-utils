import { Matcher } from '../Matcher'
import {
  type Expected,
  type MatchResult3,
  type MatchResultNested,
} from '../types'
import { match } from '../match'

export class MatcherRef<T> extends Matcher<T> {
  // #hasExpected: boolean = false
  #expected: Expected<T> = undefined as any
  get expected(): Expected<T> {
    return this.#expected
  }

  set expected(value: Expected<T>) {
    this.#expected = value
    // this.#hasExpected = true
  }

  match(actual: T): MatchResult3 {
    const matchResult = match(actual, this.#expected)
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
    return 'ref'
  }
}
