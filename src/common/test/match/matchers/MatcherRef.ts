import { Matcher } from '../Matcher'
import {
  type Expected,
  type MatchResult3,
  type MatchResultNested,
} from '../types'
import { matchNested } from '../match'

export class MatcherRef<T> extends Matcher<T> {
  #hasExpected: boolean = false
  #expected: Expected<T> = undefined as any
  get expected(): Expected<T> {
    return this.#expected
  }

  set expected(value: Expected<T>) {
    this.#expected = value
    this.#hasExpected = true
  }

  match(actual: T): MatchResult3 {
    if (!this.#hasExpected) {
      throw new Error('[test][MatcherRef] expected is not set')
    }
    const matchResult = matchNested(actual, this.#expected)
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
