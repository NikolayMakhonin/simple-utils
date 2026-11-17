export interface ITimeController<Handle = any> {
  /** Milliseconds elapsed since an arbitrary moment, like performance.now() */
  now(): number
  setTimeout(handler: () => void, timeout: number): Handle
  clearTimeout(handle: Handle): void
}
