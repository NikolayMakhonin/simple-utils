export interface IClockTime<Handle = any> {
  /** Milliseconds elapsed since an arbitrary moment, like performance.now() */
  value(): number
  /** Like value(), but greater by at least 1 than value() and than the previous result */
  valueUnique(): number
  setTimeout(handler: () => void, timeout: number): Handle
  clearTimeout(handle: Handle): void
}
