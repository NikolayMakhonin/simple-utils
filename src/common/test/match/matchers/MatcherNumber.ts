import { MatchResult3 } from '../types'
import { Matcher, MatcherArgs } from '../Matcher'
import { argsToString } from '../helpers'

export type MatchNumberArgsRange = MatcherArgs<number> & {
  min?: number | null
  max?: number | null
  allowInfinity?: boolean | null
  allowNaN?: boolean | null
}

export type MatchNumberArgs = MatchNumberArgsRange & {
  float?: boolean | null
}

export class MatcherNumber extends Matcher<
  number,
  MatchNumberArgs | undefined | null
> {
  match(actual: number): MatchResult3 {
    if (actual == null) {
      return `Expected number, got "${actual}"`
    }
    if (typeof actual !== 'number') {
      return `Expected number, got "${typeof actual}"`
    }
    if (this._args == null) {
      return Number.isFinite(actual) ? true : 'Expected finite number'
    }
    if (!this._args.allowNaN && Number.isNaN(actual)) {
      return `Expected not NaN`
    }
    if (!this._args.allowInfinity && !Number.isFinite(actual)) {
      return `Expected not Infinity`
    }
    const { min, max, float } = this._args
    if (!float && !Number.isInteger(actual)) {
      return `Expected integer, got "${actual}"`
    }
    if (min != null && actual < min) {
      return `Expected number to be >= ${min}, got ${actual}`
    }
    if (max != null && actual > max) {
      return `Expected number to be <= ${max}, got ${actual}`
    }
    return true
  }

  nameDefault(): string {
    return `number(${argsToString(this._args)})`
  }
}
