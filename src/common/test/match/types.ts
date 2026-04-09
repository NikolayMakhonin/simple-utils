import type { Matcher } from './Matcher'

export type Expected<T> = T | Matcher<T>
export type MatchResultNested = {
  actualKey?: null | string | number
  expectedKey?: null | string | number
  result: MatchResult<any>
}
export type MatchResult<T> = {
  actual: T
  expected: Expected<T>
  result: boolean
  cause?: null | string
  nested?: null | MatchResultNested[]
  error?: null | Error
}

export interface MatchResult2 {
  result: boolean
  cause?: string | null
  nested?: MatchResultNested[] | null
}

export type MatchResult3 = boolean | string | MatchResult2

export class MatchInternalError extends Error {
  constructor(message: string) {
    super(message)
  }
}
