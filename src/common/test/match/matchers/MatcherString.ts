import type { MatchResult3 } from '../types'
import { Matcher, type MatcherArgs } from '../Matcher'

export type MatchStringPattern = RegExp | ((actual: string) => MatchResult3)

export type MatchStringArgs = MatcherArgs<string> & {
  pattern?: MatchStringPattern | null
}

export class MatcherString extends Matcher<
  string,
  MatchStringArgs | undefined | null
> {
  match(actual: string): MatchResult3 {
    if (actual == null) {
      return `Expected string, got ${actual}`
    }
    if (typeof actual !== 'string') {
      return `Expected string, got "${typeof actual}"`
    }
    if (this._args == null) {
      return true
    }
    const { pattern } = this._args
    if (pattern != null) {
      if (typeof pattern === 'function') {
        return pattern(actual)
      }
      if (!pattern.test(actual)) {
        return false
      }
    }
    return true
  }

  nameDefault(): string {
    return this._args?.pattern ? `string(${this._args.pattern})` : 'string'
  }
}
