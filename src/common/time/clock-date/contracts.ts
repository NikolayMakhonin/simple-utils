export interface IClockDate {
  /** Current Unix time in milliseconds, like Date.now() */
  value(): number
  /**
   * Like value(), but greater by at least 1 than value() and than the previous result.
   * Can restart from value() + 1 when value() is far below the previous result
   */
  valueUnique(): number
}
