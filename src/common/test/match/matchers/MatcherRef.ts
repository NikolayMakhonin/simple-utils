import { Matcher } from '../Matcher'
import {
  type Expected,
  type MatchResult3,
  type MatchResultNested,
} from '../types'
import { match } from '../match'

export class MatcherRef<T> extends Matcher<T> {
  private _hasExpected: boolean = false
  private _expected: Expected<T> = undefined as any
  get expected(): Expected<T> {
    return this._expected
  }

  set expected(value: Expected<T>) {
    this._expected = value
    this._hasExpected = true
  }

  match(actual: T): MatchResult3 {
    const matchResult = match(actual, this._expected)
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
