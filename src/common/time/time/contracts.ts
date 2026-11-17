export interface ITime<Handle = any> {
  /** Milliseconds elapsed since an arbitrary moment, like performance.now() */
  time(): number
  /** Like time(), but greater by at least 1 than time() and than the previous result */
  timeUnique(): number
  setTimeout(handler: () => void, timeout: number): Handle
  clearTimeout(handle: Handle): void
}
