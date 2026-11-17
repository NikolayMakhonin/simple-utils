export interface IDate {
  /** Current Unix time in milliseconds, like Date.now() */
  now(): number
  /**
   * Like now(), but greater by at least 1 than now() and than the previous result.
   * Can restart from now() + 1 when now() is far below the previous result
   */
  nowUnique(): number
}
